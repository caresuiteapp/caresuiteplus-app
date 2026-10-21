import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { buildSync } from 'esbuild';
import { describe, expect, it, vi } from 'vitest';

// Execute the deployed entrypoint with only its two remote runtime imports mocked.
const source = readFileSync(resolve('supabase/functions/ti-provider-proxy/index.ts'), 'utf8');
const compiled = buildSync({
  stdin: { contents: source, loader: 'ts' }, bundle: true, write: false,
  platform: 'node', format: 'cjs', external: ['https://*'],
}).outputFiles[0].text;
const tenant = '11111111-1111-4111-8111-111111111111';
const otherTenant = '22222222-2222-4222-8222-222222222222';
const userId = '33333333-3333-4333-8333-333333333333';
const profileId = '44444444-4444-4444-8444-444444444444';
const providerId = '55555555-5555-4555-8555-555555555555';
const mailboxId = '66666666-6666-4666-8666-666666666666';
type Row = Record<string, unknown>;
type Query = { table: string; columns?: string; filters: Row; or?: string };
type Scenario = {
  invalidToken?: boolean; family?: boolean; tenantId?: string | null;
  deniedPermission?: string; profile?: Row | null; provider?: Row | null;
  mailbox?: Row | null; auditError?: boolean;
};

function harness(scenario: Scenario = {}) {
  let handler!: (request: Request) => Promise<Response>;
  const queries: Query[] = [];
  const audits: Row[] = [];
  const getUser = vi.fn(async () => ({ error: scenario.invalidToken ? new Error('invalid') : null,
    data: { user: scenario.invalidToken ? null : { id: userId, app_metadata: scenario.family ? { portal_type: 'academy_family' } : {} } },
  }));
  const rpc = vi.fn(async (name: string, args?: Row) => {
    expect(getUser).toHaveBeenCalledTimes(1);
    return { error: null, data: name === 'current_tenant_id'
      ? (scenario.tenantId === undefined ? tenant : scenario.tenantId)
      : args?.p_permission_key !== scenario.deniedPermission };
  });
  const from = vi.fn((table: string) => {
    expect(getUser).toHaveBeenCalledTimes(1);
    const query: Query = { table, filters: {} };
    queries.push(query);
    const row = table === 'profiles'
      ? scenario.profile === null ? null : { id: profileId, tenant_id: tenant, auth_user_id: userId, status: 'active', is_active: true, ...scenario.profile }
      : table === 'ti_providers'
        ? scenario.provider === null ? null : { id: providerId, tenant_id: tenant, kind: 'kim', is_active: true, ...scenario.provider }
        : scenario.mailbox === null ? null : { id: mailboxId, tenant_id: tenant, provider_id: providerId, ...scenario.mailbox };
    const finish = async () => ({ error: null, data: row && Object.entries(query.filters).every(([key, value]) => row[key as keyof typeof row] === value) ? row : null });
    const builder = {
      select(columns: string) { query.columns = columns; return builder; },
      eq(key: string, value: unknown) { query.filters[key] = value; return builder; },
      or(filter: string) { query.or = filter; return builder; },
      single: finish, maybeSingle: finish,
      async insert(value: Row) { audits.push(value); return { error: scenario.auditError ? new Error('private database error') : null }; },
    };
    return builder;
  });
  const createClient = vi.fn(() => ({ auth: { getUser }, rpc, from }));
  const environment: Record<string, string> = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'public-anon-key' };
  const envGet = vi.fn((key: string) => environment[key]);
  runInNewContext(compiled, {
    require: (name: string) => {
      if (name === 'https://deno.land/std@0.168.0/http/server.ts') return { serve: (fn: typeof handler) => { handler = fn; } };
      if (name === 'https://esm.sh/@supabase/supabase-js@2') return { createClient };
      throw new Error(`Unexpected runtime import ${name}`);
    },
    Deno: { env: { get: envGet } }, Response,
  });
  const request = (body: unknown = { action: 'check_connection', providerId }, authorization = 'Bearer verified-token', method = 'POST') => handler(new Request('https://example.test/ti-provider-proxy', {
    method, headers: { Authorization: authorization, 'Content-Type': 'application/json' },
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
  }));
  return { request, createClient, envGet, getUser, rpc, from, queries, audits };
}

describe('TI provider caller and tenant boundary', () => {
  it.each(['', 'Basic token', 'Bearer token extra'])('rejects malformed authorization before creating a database client: %s', async (authorization) => {
    const h = harness();
    expect((await h.request(undefined, authorization)).status).toBe(401);
    expect(h.createClient).not.toHaveBeenCalled();
  });

  it.each([{ invalidToken: true, status: 401 }, { family: true, status: 403 }])('rejects unverified or Academy-only identity before any query: %j', async (scenario) => {
    const h = harness(scenario);
    expect((await h.request()).status).toBe(scenario.status);
    expect(h.rpc).not.toHaveBeenCalled();
    expect(h.from).not.toHaveBeenCalled();
  });

  it('requires a trusted tenant and existing action permission before provider queries', async () => {
    for (const scenario of [{ tenantId: null }, { deniedPermission: 'ti.view' }, { deniedPermission: 'ti.provider.manage' }]) {
      const h = harness(scenario);
      expect((await h.request()).status).toBe(403);
      expect(h.from).not.toHaveBeenCalled();
      expect(h.audits).toEqual([]);
    }
  });

  it.each([
    { profile: { is_active: false } }, { profile: { status: 'inactive' } },
    { profile: { tenant_id: otherTenant } }, { profile: { auth_user_id: providerId } },
  ])('rejects inactive, foreign or ambiguously linked profiles: %j', async (scenario) => {
    const h = harness(scenario);
    expect((await h.request()).status).toBe(403);
    expect(h.queries.map((query) => query.table)).toEqual(['profiles']);
    expect(h.audits).toEqual([]);
  });

  it('keeps all database access in caller context and ignores caller-supplied tenant and actor IDs', async () => {
    const h = harness();
    const response = await h.request({ action: 'check_connection', providerId, tenantId: otherTenant, tenant_id: otherTenant, actor_id: providerId });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, action: 'check_connection', providerId, message: 'Stub: check_connection für Provider kim' });
    expect(h.createClient).toHaveBeenCalledWith('https://example.supabase.co', 'public-anon-key', {
      global: { headers: { Authorization: 'Bearer verified-token' } }, auth: { persistSession: false, autoRefreshToken: false },
    });
    expect(h.envGet.mock.calls.flat()).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(h.getUser).toHaveBeenCalledWith('verified-token');
    expect(h.queries.find((query) => query.table === 'profiles')).toMatchObject({ filters: { tenant_id: tenant }, or: `id.eq.${userId},auth_user_id.eq.${userId}` });
    expect(h.queries.find((query) => query.table === 'ti_providers')).toEqual({ table: 'ti_providers', columns: 'id, tenant_id, kind, is_active', filters: { tenant_id: tenant, id: providerId } });
    expect(h.audits).toEqual([expect.objectContaining({ tenant_id: tenant, actor_id: profileId, resource_id: providerId })]);
  });

  it('does not find or audit a foreign provider even when its ID is supplied with the foreign tenant', async () => {
    const h = harness({ provider: { tenant_id: otherTenant } });
    expect((await h.request({ action: 'check_connection', providerId, tenantId: otherTenant })).status).toBe(404);
    expect(h.queries.find((query) => query.table === 'ti_providers')?.filters).toEqual({ tenant_id: tenant, id: providerId });
    expect(h.audits).toEqual([]);
  });

  it.each([['sync_kim', 'ti.kim.manage'], ['fetch_messages', 'ti.kim.view']])('requires the existing %s permission and scopes its mailbox to the provider and tenant', async (action, permission) => {
    const denied = harness({ deniedPermission: permission });
    expect((await denied.request({ action, providerId, mailboxId })).status).toBe(403);
    expect(denied.from).not.toHaveBeenCalled();
    const h = harness();
    expect((await h.request({ action, providerId, mailboxId })).status).toBe(200);
    expect(h.rpc).toHaveBeenCalledWith('has_permission', { p_permission_key: permission });
    expect(h.queries.find((query) => query.table === 'kim_mailboxes')?.filters).toEqual({ tenant_id: tenant, provider_id: providerId, id: mailboxId });
  });

  it.each([{ tenant_id: otherTenant }, { provider_id: userId }])('denies a mailbox belonging to another tenant or provider: %j', async (mailbox) => {
    const h = harness({ mailbox });
    expect((await h.request({ action: 'sync_kim', providerId, mailboxId })).status).toBe(404);
    expect(h.audits).toEqual([]);
  });

  it('returns failure without database details if the tenant-bound audit cannot be saved', async () => {
    const h = harness({ auditError: true });
    const response = await h.request();
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('private database error');
    expect(h.audits[0]).toMatchObject({ tenant_id: tenant, actor_id: profileId });
  });

  it('rejects invalid actions and identifiers before database queries and allows preflight without auth', async () => {
    for (const body of [null, { action: '__proto__', providerId }, { action: 'check_connection', providerId: 'invalid' }, { action: 'sync_kim', providerId, mailboxId: 'invalid' }]) {
      const h = harness();
      expect((await h.request(body)).status).toBe(400);
      expect(h.rpc).not.toHaveBeenCalled();
      expect(h.from).not.toHaveBeenCalled();
    }
    const h = harness();
    expect((await h.request(undefined, '', 'OPTIONS')).status).toBe(200);
    expect((await h.request(undefined, '', 'GET')).status).toBe(405);
    expect(h.createClient).not.toHaveBeenCalled();
  });
});
