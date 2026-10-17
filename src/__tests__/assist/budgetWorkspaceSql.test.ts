import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER_USER = '22222222-2222-4222-8222-222222222222';
const PROFILE = '33333333-3333-4333-8333-333333333333';
const OTHER_PROFILE = '44444444-4444-4444-8444-444444444444';
const TENANT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_TENANT = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CLIENT = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const OTHER_CLIENT = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const FOREIGN_CLIENT = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

const migration = (name: string) => readFileSync(resolve('supabase/migrations', name), 'utf8');

function workspaceSql() {
  if (process.env.BUDGET_WORKSPACE_SQL_PATH) {
    return readFileSync(resolve(process.env.BUDGET_WORKSPACE_SQL_PATH), 'utf8');
  }
  const candidates = readdirSync(resolve('supabase/migrations'))
    .filter((file) => file.endsWith('.sql'))
    .map((file) => migration(file))
    .filter((sql) => /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.mutate_budget_workspace\s*\(/i.test(sql));
  if (candidates.length !== 1) {
    throw new Error('Expected exactly one mutate_budget_workspace migration; use BUDGET_WORKSPACE_SQL_PATH for a local draft.');
  }
  return candidates[0];
}

function tableDeclaration(file: string, name: string) {
  const match = migration(file).match(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${name} \\([\\s\\S]*?\\n\\);`));
  if (!match) throw new Error(`Missing production table declaration for ${name}`);
  return match[0];
}

// Only identity and unrelated parent tables are synthetic. The budget catalog,
// accounts, constraints, ledger, audit and RLS use the actual migrations. No
// Supabase connection or production records are involved in these SQL tests.
const FIXTURE = `
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE public.tenants(id uuid PRIMARY KEY);
CREATE TABLE public.profiles(
  id uuid PRIMARY KEY, auth_user_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id), role_key text DEFAULT 'owner',
  is_active boolean NOT NULL DEFAULT true, status text DEFAULT 'active', locked_at timestamptz
);
CREATE TYPE public.care_level AS ENUM ('none','pg1','pg2','pg3','pg4','pg5','unknown');
CREATE TABLE public.clients(
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  care_level public.care_level DEFAULT 'pg2', insurance_name text, insurance_number text,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.tenant_client_service_types(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('test.uid', true), '')::uuid
$$;
CREATE FUNCTION public.current_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('test.tenant', true), '')::uuid
$$;
CREATE FUNCTION public.current_role_key() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('test.role', true), '')
$$;
CREATE FUNCTION public.current_client_id() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT null::uuid
$$;
CREATE FUNCTION public.has_permission(permission text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT permission = ANY(string_to_array(current_setting('test.permissions', true), ','))
$$;
CREATE FUNCTION public.resolve_current_profile_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT p.id FROM public.profiles p
  WHERE p.auth_user_id = auth.uid() OR p.id = auth.uid()
  ORDER BY CASE WHEN p.id = auth.uid() THEN 0 ELSE 1 END LIMIT 1
$$;
CREATE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;
GRANT USAGE ON SCHEMA auth TO authenticated;
INSERT INTO auth.users VALUES ('${USER}'), ('${OTHER_USER}');
INSERT INTO public.tenants VALUES ('${TENANT}'), ('${OTHER_TENANT}');
INSERT INTO public.profiles(id, auth_user_id, tenant_id)
  VALUES ('${PROFILE}', '${USER}', '${TENANT}'), ('${OTHER_PROFILE}', '${OTHER_USER}', '${TENANT}');
INSERT INTO public.clients(id, tenant_id)
  VALUES ('${CLIENT}', '${TENANT}'), ('${OTHER_CLIENT}', '${TENANT}'), ('${FOREIGN_CLIENT}', '${OTHER_TENANT}');
`;

type Row = Record<string, unknown>;
let db: PGlite;

async function actor(options: { user?: string; tenant?: string; role?: string; permissions?: string[] } = {}) {
  const { user = USER, tenant = TENANT, role = 'owner', permissions = ['clients.budgets.edit', 'clients.billing_profile.view'] } = options;
  await db.query("SELECT set_config('test.uid', $1, false), set_config('test.tenant', $2, false), set_config('test.role', $3, false), set_config('test.permissions', $4, false)", [user, tenant, role, permissions.join(',')]);
}

async function owner<T>(work: () => Promise<T>): Promise<T> {
  await db.exec('RESET ROLE;');
  try { return await work(); } finally { await db.exec('SET ROLE authenticated;'); }
}

async function rows(table: string): Promise<Row[]> {
  return owner(async () => (await db.query<{ row: Row }>(`SELECT to_jsonb(t) AS row FROM public.${table} t`)).rows.map(({ row }) => row));
}

async function call(action: string, input: unknown, options: { tenant?: string; client?: string; request?: string | null } = {}) {
  const result = await db.query<{ result: Row }>('SELECT public.mutate_budget_workspace($1, $2, $3, $4, $5::jsonb) AS result', [
    options.tenant ?? TENANT, options.client ?? CLIENT,
    options.request === undefined ? randomUUID() : options.request, action, JSON.stringify(input),
  ]);
  return result.rows[0].result;
}

async function account(overrides: Row = {}) {
  const data: Row = {
    id: randomUUID(), tenant_id: TENANT, client_id: CLIENT,
    catalog_key: 'paragraph_45b', catalog_year: 2026, period: 'monthly',
    period_start: '2026-10-01', period_end: '2027-06-30',
    allocated_cents: 13100, standard_amount_cents: 13100,
    used_cents: 1000, reserved_cents: 2000, ...overrides,
  };
  return owner(async () => (await db.query<{ row: Row }>(
    `INSERT INTO public.client_budget_accounts(${Object.keys(data).join(',')}) VALUES (${Object.keys(data).map((_, i) => `$${i + 1}`).join(',')}) RETURNING to_jsonb(client_budget_accounts) AS row`,
    Object.values(data),
  )).rows[0].row);
}

async function entitlement(overrides: Row = {}) {
  const data: Row = {
    id: randomUUID(), tenant_id: TENANT, client_id: CLIENT,
    care_grade: 'pg2', valid_from: '2026-01-01', conversion_enabled: false,
    care_fund_name: 'Testkasse', care_fund_member_id: 'SYNTHETIC-123', ...overrides,
  };
  return owner(async () => (await db.query<{ row: Row }>(
    `INSERT INTO public.client_care_entitlement(${Object.keys(data).join(',')}) VALUES (${Object.keys(data).map((_, i) => `$${i + 1}`).join(',')}) RETURNING to_jsonb(client_care_entitlement) AS row`,
    Object.values(data),
  )).rows[0].row);
}

async function funding(sources = ['entlastungsleistung'], effectiveFrom = '2026-01-01') {
  return owner(async () => (await db.query<{ row: Row }>(`INSERT INTO public.client_funding_selections(tenant_id,client_id,sources,effective_from,created_by)
    VALUES($1,$2,$3,$4,$5) RETURNING to_jsonb(client_funding_selections) AS row`, [TENANT, CLIENT, sources, effectiveFrom, PROFILE])).rows[0].row);
}

function correction(a: Row, overrides: Row = {}) {
  return { accountId: a.id, expectedUpdatedAt: a.updated_at, amountCents: -500, effectiveDate: '2026-10-01', reason: 'Abgleich mit bestätigtem Kontostand', ...overrides };
}

async function receiptCount() {
  return owner(async () => Number((await db.query<{ count: string }>('SELECT count(*) AS count FROM budget_workspace_private.receipts')).rows[0].count));
}

async function readReceipt(request: string, client = CLIENT) {
  return (await db.query<{ result: unknown }>('SELECT public.get_budget_workspace_receipt($1,$2,$3) AS result', [TENANT, client, request])).rows[0].result;
}

async function template(key = 'paragraph_45b') {
  return owner(async () => (await db.query<{ row: Row }>('SELECT to_jsonb(t) AS row FROM public.budget_template_catalog t WHERE catalog_key=$1 AND budget_year=2026', [key])).rows[0].row);
}

function expectedEntitlement(e: Row | null) {
  return e ? { id: e.id, updatedAt: e.updated_at } : null;
}

async function legacyLevel(e: Row) {
  await owner(() => db.query(`INSERT INTO public.client_care_levels(tenant_id,client_id,grade,valid_from,care_fund_name,care_fund_member_id)
    VALUES($1,$2,$3,$4,$5,$6)`, [TENANT, CLIENT, e.care_grade, e.valid_from, e.care_fund_name, e.care_fund_member_id]));
}

beforeAll(async () => {
  const { PGlite: Database } = await import('@electric-sql/pglite');
  db = new Database();
  await db.exec(FIXTURE);
  await db.exec(tableDeclaration('0010_client_extended.sql', 'client_care_levels'));
  await db.exec(tableDeclaration('0039_client_context_intake_record_locale_catalogs.sql', 'client_insurance_profiles'));
  await db.exec(tableDeclaration('0272_client_funding_runtime_and_catalog_rate.sql', 'client_funding_selections'));
  for (const file of [
    '0175_client_billing_budget_catalog_2026.sql',
    '0177_client_billing_transaction_lifecycle.sql',
    '0180_budget_catalog_umwandlung_monthly_fix.sql',
    '0270_client_budget_visuals_rebuild.sql',
  ]) await db.exec(migration(file));
  await db.exec(workspaceSql());
}, 30_000);

beforeEach(async () => {
  await db.exec(`RESET ROLE;
    TRUNCATE budget_workspace_private.receipts, public.client_budget_accounts,
      public.client_budget_transactions, public.client_billing_audit_log,
      public.client_care_entitlement, public.client_care_levels,
      public.client_funding_selections, public.client_billing_warnings, public.client_insurance_profiles,
      public.client_budget_mode CASCADE;
    UPDATE public.clients SET care_level = 'pg2', insurance_name = NULL, insurance_number = NULL;
    UPDATE public.profiles SET is_active = true, status = 'active', locked_at = NULL;
    SET ROLE authenticated;
  `);
  await actor();
});

afterAll(async () => { await db?.close(); });

describe('budget workspace SQL security', () => {
  it('exposes only an INVOKER wrapper, keeps the privileged implementation private and excludes anonymous execution', async () => {
    const result = await owner(async () => (await db.query<Row>(`SELECT p.prosecdef, p.proconfig,
      has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
      has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'mutate_budget_workspace'`)).rows[0]);
    expect(result).toMatchObject({ prosecdef: false, anon_execute: false, authenticated_execute: true });
    expect(result.proconfig).toEqual(expect.arrayContaining([expect.stringMatching(/^search_path=/)]));
    const implementation = await owner(async () => (await db.query<Row>(`SELECT prosecdef, proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='budget_workspace_private' AND p.proname='mutate_budget_workspace'`)).rows[0]);
    expect(implementation).toMatchObject({ prosecdef: true, proconfig: ['search_path=pg_catalog'] });
  });

  it('rejects an anonymous SQL role before any write', async () => {
    await db.exec('RESET ROLE; SET ROLE anon;');
    await expect(call('correction', {})).rejects.toMatchObject({ code: '42501' });
  });

  it('rejects an authenticated role without an authenticated identity', async () => {
    await actor({ user: '' });
    await expect(call('correction', {})).rejects.toMatchObject({ code: '42501' });
    expect(await rows('client_billing_audit_log')).toEqual([]);
  });

  it.each(['employee_portal', 'client_portal', 'family_portal'])('rejects portal role %s even with budget editing permission', async (role) => {
    await actor({ role });
    await expect(call('correction', {})).rejects.toMatchObject({ code: '42501' });
    expect(await rows('client_budget_transactions')).toEqual([]);
  });

  it('rejects a viewer without budget editing permission', async () => {
    await actor({ permissions: ['clients.billing_profile.view'] });
    await expect(call('correction', {})).rejects.toMatchObject({ code: '42501' });
  });

  it('rejects a tenant parameter different from the current tenant', async () => {
    await expect(call('correction', {}, { tenant: OTHER_TENANT, client: FOREIGN_CLIENT })).rejects.toMatchObject({ code: '42501' });
  });

  it('rejects a client belonging to another tenant', async () => {
    await expect(call('correction', {}, { client: FOREIGN_CLIENT })).rejects.toMatchObject({ code: '42501' });
  });

  it.each(["is_active=false", "status='disabled'", 'locked_at=now()'])('rejects an unavailable profile (%s)', async (state) => {
    await owner(() => db.query(`UPDATE public.profiles SET ${state} WHERE id=$1`, [PROFILE]));
    await expect(call('correction', {})).rejects.toMatchObject({ code: '42501' });
  });

  it('does not grant direct access to receipts or private helper functions', async () => {
    await expect(db.query('SELECT * FROM budget_workspace_private.receipts')).rejects.toMatchObject({ code: '42501' });
    await expect(db.query('SELECT budget_workspace_private.actor($1)', [TENANT])).rejects.toMatchObject({ code: '42501' });
  });
});

describe('budget workspace SQL correction and receipts', () => {
  it('books a signed correction, balance and audit atomically under the real profile ID', async () => {
    const a = await account();
    const result = await call('correction', correction(a));
    expect(result).toMatchObject({ action: 'correction', tenantId: TENANT, clientId: CLIENT, data: { transactionId: expect.any(String) } });
    expect(await rows('client_budget_accounts')).toEqual([expect.objectContaining({ id: a.id, allocated_cents: 12600, used_cents: 1000, reserved_cents: 2000 })]);
    expect(await rows('client_budget_transactions')).toEqual([expect.objectContaining({ amount_cents: -500, balance_after_cents: 9600, transaction_type: 'adjustment', created_by: PROFILE, reference_type: 'manual_correction' })]);
    expect(await rows('client_billing_audit_log')).toEqual([expect.objectContaining({ actor_id: PROFILE, payload: expect.objectContaining({ input: expect.objectContaining({ amountCents: -500 }) }) })]);
    expect(await receiptCount()).toBe(1);
  });

  it.each([-500, 500])('keeps an individual amount consistent with its allocation after correction %+d', async (amountCents) => {
    const a = await account({ allocated_cents: 15000, is_individual_override: true, individual_amount_cents: 15000 });
    await call('correction', correction(a, { amountCents }));
    expect((await rows('client_budget_accounts'))[0]).toMatchObject({ allocated_cents: 15000 + amountCents, individual_amount_cents: 15000 + amountCents, is_individual_override: true });
    expect((await rows('client_budget_transactions'))[0].amount_cents).toBe(amountCents);
  });

  it('replays an identical request without double booking even after the account timestamp changes', async () => {
    const a = await account();
    const request = randomUUID();
    const input = correction(a);
    const first = await call('correction', input, { request });
    expect(await call('correction', input, { request })).toEqual(first);
    expect(await readReceipt(request)).toEqual(first);
    expect(await rows('client_budget_transactions')).toHaveLength(1);
    expect(await rows('client_billing_audit_log')).toHaveLength(1);
    expect(await receiptCount()).toBe(1);
  });

  it('rejects reuse of a request ID for different content or actor', async () => {
    const a = await account();
    const request = randomUUID();
    const input = correction(a);
    await call('correction', input, { request });
    await expect(call('correction', { ...input, amountCents: 1000 }, { request })).rejects.toMatchObject({ code: '40001' });
    await actor({ user: OTHER_USER });
    await expect(call('correction', input, { request })).rejects.toMatchObject({ code: '40001' });
    expect(await readReceipt(request)).toBeNull();
    await actor();
    expect(await readReceipt(request, OTHER_CLIENT)).toBeNull();
    expect(await rows('client_budget_transactions')).toHaveLength(1);
  });

  it('rejects stale account updates and never changes an account from another client', async () => {
    const a = await account();
    await expect(call('correction', correction(a, { expectedUpdatedAt: '2000-01-01T00:00:00Z' }))).rejects.toMatchObject({ code: '40001' });
    await expect(call('correction', correction(a), { client: OTHER_CLIENT })).rejects.toMatchObject({ code: '42501' });
    expect((await rows('client_budget_accounts'))[0].allocated_cents).toBe(13100);
    expect(await rows('client_budget_transactions')).toEqual([]);
    expect(await receiptCount()).toBe(0);
  });

  it.each([0, 1.5, '500', null, 9007199254740992, -10101])('rejects invalid or unaffordable correction %j', async (amountCents) => {
    const a = await account();
    await expect(call('correction', correction(a, { amountCents }))).rejects.toMatchObject({ code: '22023' });
    expect((await rows('client_budget_accounts'))[0].allocated_cents).toBe(13100);
    expect(await rows('client_budget_transactions')).toEqual([]);
  });

  it.each(['2026-09-30', '2027-07-01', '2199-01-01'])('rejects correction dates outside the account or in the future (%s)', async (effectiveDate) => {
    const a = await account();
    await expect(call('correction', correction(a, { effectiveDate }))).rejects.toMatchObject({ code: '22023' });
    expect(await receiptCount()).toBe(0);
  });

  it('rolls back account, ledger and receipt if writing the audit fails', async () => {
    const a = await account();
    await owner(() => db.exec(`CREATE FUNCTION public.test_reject_budget_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic audit outage'; END; $$;
      CREATE TRIGGER test_reject_budget_audit BEFORE INSERT ON public.client_billing_audit_log FOR EACH ROW EXECUTE FUNCTION public.test_reject_budget_audit();`));
    try {
      await expect(call('correction', correction(a))).rejects.toThrow('Synthetic audit outage');
      expect((await rows('client_budget_accounts'))[0].allocated_cents).toBe(13100);
      expect(await rows('client_budget_transactions')).toEqual([]);
      expect(await receiptCount()).toBe(0);
    } finally {
      await owner(() => db.exec('DROP TRIGGER test_reject_budget_audit ON public.client_billing_audit_log; DROP FUNCTION public.test_reject_budget_audit();'));
    }
  });
});

describe('budget workspace SQL account editing', () => {
  it('keeps an individual override, its signed ledger delta and a readable reason', async () => {
    const a = await account();
    await call('update_account', { accountId: a.id, expectedUpdatedAt: a.updated_at, isIndividualOverride: true, individualAmountCents: 15000, notes: 'Individuelle Zusage', reason: 'Kassenzusage übernommen' });
    expect((await rows('client_budget_accounts'))[0]).toMatchObject({ allocated_cents: 15000, individual_amount_cents: 15000, is_individual_override: true, notes: 'Individuelle Zusage' });
    expect((await rows('client_budget_transactions'))[0]).toMatchObject({ amount_cents: 1900, balance_after_cents: 12000 });
  });

  it('deactivates without deleting account history once no reservations remain', async () => {
    const a = await account({ reserved_cents: 0 });
    await call('deactivate', { accountId: a.id, expectedUpdatedAt: a.updated_at, reason: 'Keine weiteren Leistungen über dieses Konto' });
    expect((await rows('client_budget_accounts'))[0]).toMatchObject({ id: a.id, is_enabled: false, locked: true, status: 'suspended', used_cents: 1000, allocated_cents: 13100 });
    expect(await rows('client_billing_audit_log')).toHaveLength(1);
  });

  it.each(['deactivate', 'locked', 'isEnabled', 'status'])('blocks %s while reservations remain', async (mode) => {
    const a = await account();
    const patch = mode === 'locked' ? { locked: true } : mode === 'isEnabled' ? { isEnabled: false } : mode === 'status' ? { status: 'suspended' } : {};
    await expect(call(mode === 'deactivate' ? mode : 'update_account', { accountId: a.id, expectedUpdatedAt: a.updated_at, reason: 'Sperre', ...patch })).rejects.toMatchObject({ code: '22023' });
    expect((await rows('client_budget_accounts'))[0]).toMatchObject({ is_enabled: true, locked: false, status: 'active' });
  });

  it('rejects arbitrary account fields and external Sachleistungen on an unrelated account', async () => {
    const a = await account();
    const base = { accountId: a.id, expectedUpdatedAt: a.updated_at, reason: 'Korrektur' };
    await expect(call('update_account', { ...base, clientId: OTHER_CLIENT })).rejects.toMatchObject({ code: '22023' });
    await expect(call('update_account', { ...base, externalSachleistungCents: 5000 })).rejects.toMatchObject({ code: '22023' });
    expect(await rows('client_billing_audit_log')).toEqual([]);
  });

  it.each(['correction', 'deactivate'])('does not let %s smuggle unvalidated account edits into its payload', async (action) => {
    const a = await account({ reserved_cents: 0 });
    const base = action === 'correction' ? correction(a) : { accountId: a.id, expectedUpdatedAt: a.updated_at, reason: 'Konto deaktivieren' };
    await expect(call(action, { ...base, isIndividualOverride: true, individualAmountCents: -900 })).rejects.toMatchObject({ code: '22023' });
    expect((await rows('client_budget_accounts'))[0]).toMatchObject({ is_individual_override: false, individual_amount_cents: null, status: 'active' });
    expect(await receiptCount()).toBe(0);
  });

  it('stores external Sachleistungen only on a monthly conversion account without changing its budget ledger', async () => {
    const a = await account({ catalog_key: 'umwandlung_pg2' });
    await call('update_account', { accountId: a.id, expectedUpdatedAt: a.updated_at, externalSachleistungCents: 25000, reason: 'Bestätigung eines anderen Anbieters' });
    expect((await rows('client_budget_accounts'))[0]).toMatchObject({ external_sachleistung_cents: 25000, allocated_cents: 13100 });
    expect(await rows('client_budget_transactions')).toEqual([]);
    expect(await rows('client_billing_audit_log')).toHaveLength(1);
  });
});

describe('budget workspace SQL catalog recalculation', () => {
  it('uses the live catalog for a signed decrease and retains already used and reserved amounts', async () => {
    await entitlement();
    await funding();
    const a = await account({ allocated_cents: 15000 });
    const result = await call('recalculate', { reason: 'Katalogstand übernehmen', asOfDate: '2026-10-01', diffs: [{ accountId: a.id, currentAllocatedCents: 15000, catalogAmountCents: 13100 }] });
    expect(result.data).toMatchObject({ updated: 1, created: 0 });
    expect((await rows('client_budget_accounts'))[0]).toMatchObject({ allocated_cents: 13100, used_cents: 1000, reserved_cents: 2000 });
    expect((await rows('client_budget_transactions'))[0]).toMatchObject({ transaction_type: 'adjustment', amount_cents: -1900, balance_after_cents: 10100, created_by: PROFILE });
  });

  it('rolls back all accounts if a later selected account changed after the preview', async () => {
    await entitlement();
    await funding();
    const a = await account({ id: '00000000-0000-4000-8000-000000000001', allocated_cents: 12000 });
    const b = await account({ id: '00000000-0000-4000-8000-000000000002', allocated_cents: 11000, period_start: '2026-09-01' });
    await expect(call('recalculate', { reason: 'Katalogstand übernehmen', asOfDate: '2026-10-01', diffs: [
      { accountId: a.id, currentAllocatedCents: 12000, catalogAmountCents: 13100 },
      { accountId: b.id, currentAllocatedCents: 12000, catalogAmountCents: 13100 },
    ] })).rejects.toMatchObject({ code: '40001' });
    expect((await rows('client_budget_accounts')).map((a) => a.allocated_cents).sort()).toEqual([11000, 12000]);
    expect(await rows('client_budget_transactions')).toEqual([]);
    expect(await rows('client_billing_audit_log')).toEqual([]);
    expect(await receiptCount()).toBe(0);
  });

  it.each([
    { is_individual_override: true, individual_amount_cents: 15000 },
    { locked: true }, { is_enabled: false }, { status: 'suspended' },
    { used_cents: 13000, reserved_cents: 1000 },
  ])('protects overrides, locked accounts and existing commitments (%j)', async (patch) => {
    await entitlement();
    await funding();
    const a = await account({ allocated_cents: 15000, ...patch });
    await expect(call('recalculate', { reason: 'Katalogstand', asOfDate: '2026-10-01', diffs: [{ accountId: a.id, currentAllocatedCents: 15000, catalogAmountCents: 13100 }] })).rejects.toMatchObject({ code: '40001' });
    expect((await rows('client_budget_accounts'))[0]).toMatchObject({ allocated_cents: 15000, ...patch });
  });

  it('rejects a forged catalog amount, duplicate selections and an unselected financing source', async () => {
    await entitlement();
    await funding(['selbstzahler']);
    const a = await account({ allocated_cents: 12000 });
    const diff = { accountId: a.id, currentAllocatedCents: 12000, catalogAmountCents: 13100 };
    const base = { reason: 'Katalogstand', asOfDate: '2026-10-01' };
    await expect(call('recalculate', { ...base, diffs: [diff] })).rejects.toMatchObject({ code: '40001' });
    await expect(call('recalculate', { ...base, diffs: [diff, diff] })).rejects.toMatchObject({ code: '22023' });
    await owner(() => db.query("UPDATE public.client_funding_selections SET sources=ARRAY['entlastungsleistung']"));
    await expect(call('recalculate', { ...base, diffs: [{ ...diff, catalogAmountCents: 99999 }] })).rejects.toMatchObject({ code: '40001' });
    expect(await rows('client_budget_transactions')).toEqual([]);
  });

  it('creates a missing eligible monthly bucket once with its correct carry-over expiry and ledger', async () => {
    await entitlement();
    await funding();
    const t = await template();
    const diff = { create: true, accountId: 'new:paragraph_45b:2026-01', catalogTemplateId: t.id, periodStart: '2026-01-01', periodEnd: '2027-06-30', catalogAmountCents: 13100 };
    const input = { reason: 'Fehlendes Monatskonto ergänzen', asOfDate: '2026-10-01', diffs: [diff] };
    const request = randomUUID();
    expect((await call('recalculate', input, { request })).data).toMatchObject({ updated: 1, created: 1 });
    await call('recalculate', input, { request });
    expect(await rows('client_budget_accounts')).toEqual([expect.objectContaining({ allocated_cents: 13100, period_start: '2026-01-01', period_end: '2027-06-30', catalog_template_id: t.id })]);
    expect(await rows('client_budget_transactions')).toEqual([expect.objectContaining({ transaction_type: 'allocation', amount_cents: 13100, balance_after_cents: 13100 })]);
    await expect(call('recalculate', input)).rejects.toMatchObject({ code: '40001' });
  });

  it('never creates entitlement buckets before the actual care entitlement starts', async () => {
    await entitlement({ valid_from: '2026-10-01' });
    await funding();
    const t = await template();
    await expect(call('recalculate', { reason: 'Fehlendes Konto', asOfDate: '2026-10-01', diffs: [{
      create: true, accountId: 'new:paragraph_45b:2026-01', catalogTemplateId: t.id, periodStart: '2026-01-01', periodEnd: '2027-06-30', catalogAmountCents: 13100,
    }] })).rejects.toMatchObject({ code: '40001' });
    expect(await rows('client_budget_accounts')).toEqual([]);
  });

  it.each(['used_cents', 'reserved_cents', 'external_sachleistung_cents'])('blocks a second care-grade conversion budget in the same month when the former grade has %s', async (field) => {
    await entitlement({ care_grade: 'pg2', conversion_enabled: true, valid_until: '2026-10-09' });
    await entitlement({ care_grade: 'pg3', conversion_enabled: true, valid_from: '2026-10-10' });
    await funding(['entlastungsleistung', 'umwandlung']);
    const prior = await account({ catalog_key: 'umwandlung_pg2', allocated_cents: 31840, period_end: '2026-10-31', status: 'suspended', is_enabled: false, used_cents: 0, reserved_cents: 0, [field]: 100 });
    const t = await template('umwandlung_pg3');
    await expect(call('recalculate', { reason: 'Neues Pflegegradkonto', asOfDate: '2026-10-17', diffs: [{
      create: true, accountId: 'new:umwandlung_pg3:2026-10', catalogTemplateId: t.id, periodStart: '2026-10-01', periodEnd: '2026-10-31', catalogAmountCents: 59880,
    }] })).rejects.toMatchObject({ code: '22023' });
    expect(await rows('client_budget_accounts')).toEqual([prior]);
    expect(await rows('client_budget_transactions')).toEqual([]);
    expect(await receiptCount()).toBe(0);
  });

  it('allows the new care-grade monthly conversion account when former-grade usage belongs to an earlier month', async () => {
    await entitlement({ care_grade: 'pg2', conversion_enabled: true, valid_until: '2026-09-30' });
    await entitlement({ care_grade: 'pg3', conversion_enabled: true, valid_from: '2026-10-01' });
    await funding(['entlastungsleistung', 'umwandlung']);
    await account({ catalog_key: 'umwandlung_pg2', allocated_cents: 31840, period_start: '2026-09-01', period_end: '2026-09-30', used_cents: 1000, reserved_cents: 0 });
    const t = await template('umwandlung_pg3');
    await call('recalculate', { reason: 'Umwandlung im neuen Monat', asOfDate: '2026-10-17', diffs: [{
      create: true, accountId: 'new:umwandlung_pg3:2026-10', catalogTemplateId: t.id, periodStart: '2026-10-01', periodEnd: '2026-10-31', catalogAmountCents: 59880,
    }] });
    expect(await rows('client_budget_accounts')).toHaveLength(2);
    expect((await rows('client_budget_accounts')).find((row) => row.catalog_key === 'umwandlung_pg3')).toMatchObject({ allocated_cents: 59880, period_start: '2026-10-01', period_end: '2026-10-31' });
  });
});

describe('budget workspace SQL care and financing history', () => {
  it('creates the first entitlement using a null expected token and records both current client and history', async () => {
    await owner(() => db.query('UPDATE public.clients SET insurance_name=$1, insurance_number=$2 WHERE id=$3', ['Vorhandene Testkasse', 'BESTAND-123', CLIENT]));
    await call('change_grade', { expectedEntitlement: null, newCareGrade: 'pg2', effectiveFrom: '2026-01-01', reason: 'Erstmalige Pflegegradeinstufung' });
    expect(await rows('client_care_entitlement')).toEqual([expect.objectContaining({ care_grade: 'pg2', valid_from: '2026-01-01', valid_until: null, care_fund_name: 'Vorhandene Testkasse', care_fund_member_id: 'BESTAND-123' })]);
    expect(await rows('client_care_levels')).toEqual([expect.objectContaining({ grade: 'pg2', valid_from: '2026-01-01', care_fund_name: 'Vorhandene Testkasse' })]);
    expect((await rows('clients')).find((c) => c.id === CLIENT)?.care_level).toBe('pg2');
  });

  it('reuses an existing matching legacy care level while creating its missing entitlement', async () => {
    await legacyLevel({ care_grade: 'pg2', valid_from: '2026-01-01', care_fund_name: 'Historisch bestätigte Pflegekasse A', care_fund_member_id: 'A-123' });
    await owner(() => db.query('UPDATE public.clients SET insurance_name=$1, insurance_number=$2 WHERE id=$3', ['Veraltete Pflegekasse B', 'B-123', CLIENT]));
    await owner(() => db.query(`INSERT INTO public.client_insurance_profiles(tenant_id,client_id,is_primary,care_fund_name,insurance_number,health_insurance)
      VALUES($1,$2,true,'Abweichende Pflegekasse C','C-123','Krankenkasse bleibt')`, [TENANT, CLIENT]));
    const priorHistory = await rows('client_care_levels');
    await call('change_grade', { expectedEntitlement: null, newCareGrade: 'pg2', effectiveFrom: '2026-01-01', reason: 'Bestehende Einstufung übernehmen' });
    expect(await rows('client_care_levels')).toEqual(priorHistory);
    expect(await rows('client_care_entitlement')).toEqual([expect.objectContaining({ care_fund_name: 'Historisch bestätigte Pflegekasse A', care_fund_member_id: 'A-123' })]);
    expect((await rows('clients')).find((row) => row.id === CLIENT)).toMatchObject({ insurance_name: 'Historisch bestätigte Pflegekasse A', insurance_number: 'A-123' });
    expect((await rows('client_insurance_profiles'))[0]).toMatchObject({ care_fund_name: 'Historisch bestätigte Pflegekasse A', insurance_number: 'A-123', health_insurance: 'Krankenkasse bleibt' });
  });

  it('preserves primary insurance care data when neither entitlement nor legacy/client care data exists', async () => {
    await owner(() => db.query(`INSERT INTO public.client_insurance_profiles(tenant_id,client_id,is_primary,care_fund_name,insurance_number,health_insurance)
      VALUES($1,$2,true,'Pflegekasse aus Versicherungsprofil','PROFIL-123','Unabhängige Krankenkasse')`, [TENANT, CLIENT]));
    await call('change_grade', { expectedEntitlement: null, newCareGrade: 'pg2', effectiveFrom: '2026-01-01', reason: 'Erste Anspruchserfassung' });
    expect((await rows('client_care_entitlement'))[0]).toMatchObject({ care_fund_name: 'Pflegekasse aus Versicherungsprofil', care_fund_member_id: 'PROFIL-123' });
    expect((await rows('client_care_levels'))[0]).toMatchObject({ care_fund_name: 'Pflegekasse aus Versicherungsprofil', care_fund_member_id: 'PROFIL-123' });
    expect((await rows('clients')).find((row) => row.id === CLIENT)).toMatchObject({ insurance_name: 'Pflegekasse aus Versicherungsprofil', insurance_number: 'PROFIL-123' });
    expect((await rows('client_insurance_profiles'))[0]).toMatchObject({ care_fund_name: 'Pflegekasse aus Versicherungsprofil', insurance_number: 'PROFIL-123', health_insurance: 'Unabhängige Krankenkasse' });
  });

  it('changes care grade with closed prior history while preserving historical used money', async () => {
    const e = await entitlement({ conversion_enabled: true });
    await legacyLevel(e);
    await funding(['entlastungsleistung', 'umwandlung']);
    const a = await account({ catalog_key: 'umwandlung_pg2', reserved_cents: 0 });
    await call('change_grade', { expectedEntitlement: expectedEntitlement(e), newCareGrade: 'pg3', effectiveFrom: '2026-10-01', reason: 'Neuer Pflegegradbescheid' });
    expect(await rows('client_care_entitlement')).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: e.id, care_grade: 'pg2', valid_from: '2026-01-01', valid_until: '2026-09-30' }),
      expect.objectContaining({ care_grade: 'pg3', valid_from: '2026-10-01', valid_until: null, conversion_enabled: true }),
    ]));
    expect(await rows('client_care_levels')).toEqual(expect.arrayContaining([
      expect.objectContaining({ grade: 'pg2', valid_until: '2026-09-30' }),
      expect.objectContaining({ grade: 'pg3', valid_from: '2026-10-01', valid_until: null }),
    ]));
    expect((await rows('client_budget_accounts')).find((row) => row.id === a.id)).toMatchObject({ status: 'suspended', used_cents: 1000, allocated_cents: 13100 });
    expect((await rows('clients')).find((row) => row.id === CLIENT)?.care_level).toBe('pg3');
  });

  it('rejects a care grade change with reservations and leaves all prior history intact', async () => {
    const e = await entitlement();
    await legacyLevel(e);
    await account();
    await expect(call('change_grade', { expectedEntitlement: expectedEntitlement(e), newCareGrade: 'pg3', effectiveFrom: '2026-10-01', reason: 'Pflegegradwechsel' })).rejects.toMatchObject({ code: '22023' });
    expect(await rows('client_care_entitlement')).toEqual([e]);
    expect(await rows('client_care_levels')).toHaveLength(1);
    expect(await receiptCount()).toBe(0);
  });

  it.each([
    ['kein', true], ['kein', false], ['hospiz', true], ['hospiz', false],
  ] as const)('suspends ineligible statutory accounts after downgrade to %s (catalog linked: %s)', async (newCareGrade, linked) => {
    const e = await entitlement({ conversion_enabled: true });
    await funding(['entlastungsleistung', 'umwandlung', 'verhinderungspflege', 'selbstzahler']);
    const statutoryIds: unknown[] = [];
    for (const key of ['paragraph_45b', 'umwandlung_pg2', 'verhinderungspflege']) {
      const t = await template(key);
      const a = await account({ catalog_key: key, catalog_template_id: linked ? t.id : null, reserved_cents: 0 });
      statutoryIds.push(a.id);
    }
    const selfTemplate = await template('selbstzahler');
    const privateAccount = await account({ catalog_key: 'selbstzahler', catalog_template_id: selfTemplate.id, reserved_cents: 0 });
    await call('change_grade', { expectedEntitlement: expectedEntitlement(e), newCareGrade, effectiveFrom: '2026-10-01', reason: 'Einstufung laut aktuellem Bescheid' });
    const allAccounts = await rows('client_budget_accounts');
    for (const id of statutoryIds) expect(allAccounts.find((row) => row.id === id)).toMatchObject({ status: 'suspended', is_enabled: false, locked: true, used_cents: 1000, allocated_cents: 13100 });
    expect(allAccounts.find((row) => row.id === privateAccount.id)).toMatchObject({ status: 'active', is_enabled: true, locked: false });
  });

  it('updates current care fund details consistently without overwriting prior care history', async () => {
    await entitlement({ care_grade: 'pg1', valid_from: '2025-01-01', valid_until: '2025-12-31', care_fund_name: 'Historische Testkasse' });
    const e = await entitlement();
    await legacyLevel(e);
    await call('update_fund', { expectedEntitlement: expectedEntitlement(e), careFundName: ' Neue Testkasse ', careFundMemberId: ' NEU-123 ', reason: 'Kassenwechsel' });
    expect((await rows('client_care_entitlement')).find((row) => row.id === e.id)).toMatchObject({ care_fund_name: 'Neue Testkasse', care_fund_member_id: 'NEU-123' });
    expect((await rows('client_care_entitlement')).find((row) => row.valid_until !== null)?.care_fund_name).toBe('Historische Testkasse');
    expect((await rows('client_care_levels'))[0]).toMatchObject({ care_fund_name: 'Neue Testkasse', care_fund_member_id: 'NEU-123' });
    expect((await rows('clients')).find((row) => row.id === CLIENT)).toMatchObject({ insurance_name: 'Neue Testkasse', insurance_number: 'NEU-123' });
    await expect(call('update_fund', { expectedEntitlement: expectedEntitlement(e), careFundName: 'Staler Stand', careFundMemberId: '', reason: 'Alte Ansicht' })).rejects.toMatchObject({ code: '40001' });
  });

  it('propagates care fund, care grade and validity to the primary insurance without changing health insurance or secondary profiles', async () => {
    const e = await entitlement();
    await legacyLevel(e);
    await owner(() => db.query(`INSERT INTO public.client_insurance_profiles(tenant_id,client_id,is_primary,care_fund_name,health_insurance,insurance_number,care_level,care_level_valid_from)
      VALUES($1,$2,true,'Alte Pflegekasse','Unveränderte Krankenkasse','ALT-123','pg2','2026-01-01'),
        ($1,$2,false,'Historische Pflegekasse','Historische Krankenkasse','HIST-123','pg1','2025-01-01')`, [TENANT, CLIENT]));
    const secondary = (await rows('client_insurance_profiles')).find((row) => !row.is_primary);
    await call('update_fund', { expectedEntitlement: expectedEntitlement(e), careFundName: 'Neue Pflegekasse', careFundMemberId: 'NEU-456', reason: 'Aktualisierter Versicherungsnachweis' });
    const current = (await rows('client_care_entitlement')).find((row) => row.valid_until === null)!;
    await call('change_grade', { expectedEntitlement: expectedEntitlement(current), newCareGrade: 'pg3', effectiveFrom: '2026-10-01', reason: 'Neuer Pflegegradbescheid' });
    const next = (await rows('client_care_entitlement')).find((row) => row.valid_until === null)!;
    await call('update_valid_from', { expectedEntitlement: expectedEntitlement(next), validFrom: '2026-10-02', reason: 'Tag laut Bescheid korrigiert' });
    expect((await rows('client_insurance_profiles')).find((row) => row.is_primary)).toMatchObject({ care_fund_name: 'Neue Pflegekasse', insurance_number: 'NEU-456', health_insurance: 'Unveränderte Krankenkasse', care_level: 'pg3', care_level_valid_from: '2026-10-02' });
    expect((await rows('client_insurance_profiles')).find((row) => !row.is_primary)).toEqual(secondary);
  });

  it('rejects ambiguous primary insurance profiles before changing care or insurance data', async () => {
    const e = await entitlement();
    await owner(() => db.query('INSERT INTO public.client_insurance_profiles(tenant_id,client_id,is_primary) VALUES($1,$2,true),($1,$2,true)', [TENANT, CLIENT]));
    await expect(call('update_fund', { expectedEntitlement: expectedEntitlement(e), careFundName: 'Neue Testkasse', careFundMemberId: 'NEU', reason: 'Kassenwechsel' })).rejects.toMatchObject({ code: '22023' });
    expect(await rows('client_care_entitlement')).toEqual([e]);
    expect(await rows('client_billing_audit_log')).toEqual([]);
    expect(await receiptCount()).toBe(0);
  });

  it('updates the care start in current legacy data but rejects overlap with older entitlement history', async () => {
    await entitlement({ care_grade: 'pg1', valid_from: '2025-01-01', valid_until: '2025-12-31' });
    const e = await entitlement();
    await legacyLevel(e);
    await expect(call('update_valid_from', { expectedEntitlement: expectedEntitlement(e), validFrom: '2025-12-01', reason: 'Datum korrigieren' })).rejects.toMatchObject({ code: '22023' });
    await call('update_valid_from', { expectedEntitlement: expectedEntitlement(e), validFrom: '2026-02-01', reason: 'Datum laut Bescheid' });
    expect((await rows('client_care_entitlement')).find((row) => row.id === e.id)?.valid_from).toBe('2026-02-01');
    expect((await rows('client_care_levels'))[0].valid_from).toBe('2026-02-01');
  });

  it.each(['used_cents', 'reserved_cents', 'external_sachleistung_cents'])('does not move the care start past an existing %s booking', async (field) => {
    const e = await entitlement();
    await legacyLevel(e);
    const a = await account({ period_start: '2026-01-01', used_cents: 0, reserved_cents: 0, external_sachleistung_cents: 0, [field]: 100 });
    await expect(call('update_valid_from', { expectedEntitlement: expectedEntitlement(e), validFrom: '2026-02-01', reason: 'Datum laut Bescheid' })).rejects.toMatchObject({ code: '22023' });
    expect(await rows('client_care_entitlement')).toEqual([e]);
    expect((await rows('client_budget_accounts')).find((row) => row.id === a.id)).toMatchObject({ status: 'active', [field]: 100 });
    expect(await receiptCount()).toBe(0);
  });

  it('suspends unused monthly accounts excluded by a later care start and preserves their history', async () => {
    const e = await entitlement();
    const earlier = await account({ period_start: '2026-01-01', used_cents: 0, reserved_cents: 0 });
    const current = await account({ period_start: '2026-02-01', used_cents: 0, reserved_cents: 0 });
    await call('update_valid_from', { expectedEntitlement: expectedEntitlement(e), validFrom: '2026-02-01', reason: 'Datum laut Bescheid' });
    expect((await rows('client_budget_accounts')).find((row) => row.id === earlier.id)).toMatchObject({ status: 'suspended', locked: true, is_enabled: false, allocated_cents: 13100, lock_reason: 'Gültigkeitsbeginn geändert' });
    expect((await rows('client_budget_accounts')).find((row) => row.id === current.id)).toMatchObject({ status: 'active', locked: false, is_enabled: true });
  });

  it('changes financing and conversion together while preserving previous selections and manual locks', async () => {
    const e = await entitlement({ conversion_enabled: true });
    await funding(['entlastungsleistung', 'umwandlung']);
    const t = await template('umwandlung_pg2');
    const a = await account({ catalog_key: 'umwandlung_pg2', catalog_template_id: t.id, reserved_cents: 0, locked: true, lock_reason: 'Manuelle Prüfung' });
    await call('set_conversion', { expectedEntitlement: expectedEntitlement(e), enabled: false, reason: 'Umwandlung abgewählt' });
    expect((await rows('client_care_entitlement'))[0].conversion_enabled).toBe(false);
    expect((await rows('client_funding_selections')).filter((row) => row.replaced_at === null)).toEqual([expect.objectContaining({ sources: ['entlastungsleistung'], created_by: PROFILE })]);
    expect(await rows('client_funding_selections')).toHaveLength(2);
    expect((await rows('client_budget_accounts')).find((row) => row.id === a.id)).toMatchObject({ locked: true, lock_reason: 'Manuelle Prüfung', is_enabled: false });
    const next = (await rows('client_care_entitlement'))[0];
    await call('set_conversion', { expectedEntitlement: expectedEntitlement(next), enabled: true, reason: 'Umwandlung wieder ausgewählt' });
    expect((await rows('client_care_entitlement'))[0].conversion_enabled).toBe(true);
    expect((await rows('client_budget_accounts')).find((row) => row.id === a.id)).toMatchObject({ locked: true, lock_reason: 'Manuelle Prüfung', is_enabled: false });
  });

  it('rejects funding source removal with open reservations and stale expected selections', async () => {
    await entitlement();
    await funding();
    await account();
    const input = { expectedSources: ['entlastungsleistung'], sources: ['selbstzahler'], effectiveFrom: '2026-10-01', reason: 'Finanzierung ändern' };
    await expect(call('set_funding', input)).rejects.toMatchObject({ code: '22023' });
    await expect(call('set_funding', { ...input, expectedSources: [] })).rejects.toMatchObject({ code: '40001' });
    expect((await rows('client_funding_selections'))[0]).toMatchObject({ sources: ['entlastungsleistung'], replaced_at: null });
    expect(await receiptCount()).toBe(0);
  });

  it('sets self-payment in the primary insurance profile together with the new selection', async () => {
    await entitlement();
    await owner(() => db.query('INSERT INTO public.client_insurance_profiles(tenant_id,client_id,is_primary,self_pay) VALUES($1,$2,true,false)', [TENANT, CLIENT]));
    await call('set_funding', { expectedSources: [], sources: ['selbstzahler'], effectiveFrom: '2026-10-01', reason: 'Private Abrechnung vereinbart' });
    expect((await rows('client_funding_selections'))[0]).toMatchObject({ sources: ['selbstzahler'], created_by: PROFILE });
    expect((await rows('client_insurance_profiles'))[0].self_pay).toBe(true);
  });

  it('treats selected financing sources as a set and stores them in a stable order', async () => {
    await entitlement();
    await funding(['entlastungsleistung', 'selbstzahler']);
    await call('set_funding', { expectedSources: ['selbstzahler', 'entlastungsleistung'], sources: ['selbstzahler', 'entlastungsleistung', 'verhinderungspflege'], effectiveFrom: '2026-10-01', reason: 'Bestätigte Finanzierungsarten' });
    expect((await rows('client_funding_selections')).find((row) => row.replaced_at === null)?.sources).toEqual(['entlastungsleistung', 'verhinderungspflege', 'selbstzahler']);
  });

  it('restores only financing-controlled locks when a source is selected again', async () => {
    const e = await entitlement();
    await funding(['entlastungsleistung']);
    const t = await template('umwandlung_pg2');
    const a = await account({ catalog_key: 'umwandlung_pg2', catalog_template_id: t.id, reserved_cents: 0, locked: true, is_enabled: false, status: 'suspended', lock_reason: 'Finanzierungsart nicht ausgewählt' });
    await call('set_conversion', { expectedEntitlement: expectedEntitlement(e), enabled: true, reason: 'Umwandlung bestätigt' });
    expect((await rows('client_budget_accounts')).find((row) => row.id === a.id)).toMatchObject({ locked: false, lock_reason: null, is_enabled: true, status: 'active' });
  });

  it('rejects conversion for care grade 1 and invalid duplicate funding sources', async () => {
    const e = await entitlement({ care_grade: 'pg1' });
    await funding(['entlastungsleistung']);
    await expect(call('set_conversion', { expectedEntitlement: expectedEntitlement(e), enabled: true, reason: 'Umwandlung' })).rejects.toMatchObject({ code: '22023' });
    await expect(call('set_funding', { expectedSources: ['entlastungsleistung'], sources: ['selbstzahler', 'selbstzahler'], effectiveFrom: '2026-10-01', reason: 'Finanzierungsarten' })).rejects.toMatchObject({ code: '22023' });
    expect(await rows('client_funding_selections')).toHaveLength(1);
    expect((await rows('client_care_entitlement'))[0].conversion_enabled).toBe(false);
  });

  it('rolls back entitlement closure and client changes when the legacy history insert fails', async () => {
    const e = await entitlement();
    await legacyLevel(e);
    await owner(() => db.exec(`CREATE FUNCTION public.test_reject_budget_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic history outage'; END; $$;
      CREATE TRIGGER test_reject_budget_history BEFORE INSERT ON public.client_care_levels FOR EACH ROW EXECUTE FUNCTION public.test_reject_budget_history();`));
    try {
      await expect(call('change_grade', { expectedEntitlement: expectedEntitlement(e), newCareGrade: 'pg3', effectiveFrom: '2026-10-01', reason: 'Pflegegradwechsel' })).rejects.toThrow('Synthetic history outage');
      expect(await rows('client_care_entitlement')).toEqual([e]);
      expect((await rows('client_care_levels'))[0]).toMatchObject({ grade: 'pg2', valid_until: null });
      expect((await rows('clients')).find((row) => row.id === CLIENT)?.care_level).toBe('pg2');
      expect(await receiptCount()).toBe(0);
    } finally {
      await owner(() => db.exec('DROP TRIGGER test_reject_budget_history ON public.client_care_levels; DROP FUNCTION public.test_reject_budget_history();'));
    }
  });
});

describe('budget workspace SQL annual budget safeguards', () => {
  const annualPeriod = { period: 'yearly', period_start: '2026-01-01', period_end: '2026-12-31' };

  async function annualCreation(key = 'gemeinsames_jahresbudget') {
    const t = await template(key);
    return {
      reason: 'Bestätigtes Jahresbudget ergänzen', asOfDate: '2026-10-17',
      diffs: [{ create: true, accountId: `new:${key}:2026`, catalogTemplateId: t.id, periodStart: '2026-01-01', periodEnd: '2026-12-31', catalogAmountCents: t.default_amount_cents }],
    };
  }

  it('explicitly creates the common 2026 annual budget of 353900 cents for an eligible midyear care start', async () => {
    await entitlement({ valid_from: '2026-10-01' });
    await funding(['verhinderungspflege']);
    await owner(() => db.query(`INSERT INTO public.client_budget_mode(tenant_id,client_id,budget_year,care_prevention_mode)
      VALUES($1,$2,2026,'separate_preventive_short_term'),($1,$2,2025,'separate_preventive_short_term'),($1,$3,2026,'separate_preventive_short_term')`, [TENANT, CLIENT, OTHER_CLIENT]));
    expect((await template('gemeinsames_jahresbudget')).auto_generate).toBe(false);
    const result = await call('recalculate', await annualCreation());
    expect(result.data).toMatchObject({ created: 1, updated: 1 });
    expect(await rows('client_budget_accounts')).toEqual([expect.objectContaining({ catalog_key: 'gemeinsames_jahresbudget', allocated_cents: 353900, standard_amount_cents: 353900, ...annualPeriod })]);
    expect(await rows('client_budget_transactions')).toEqual([expect.objectContaining({ transaction_type: 'allocation', amount_cents: 353900 })]);
    const modes = await rows('client_budget_mode');
    expect(modes.find((mode) => mode.client_id === CLIENT && mode.budget_year === 2026)).toMatchObject({ care_prevention_mode: 'joint_annual_budget', mode_change_reason: 'Bestätigtes Jahresbudget ergänzen' });
    expect(modes.filter((mode) => mode.client_id !== CLIENT || mode.budget_year !== 2026)).toEqual([
      expect.objectContaining({ care_prevention_mode: 'separate_preventive_short_term' }),
      expect.objectContaining({ care_prevention_mode: 'separate_preventive_short_term' }),
    ]);
  });

  it('rolls back the annual mode, account and ledger if a later selected creation is invalid', async () => {
    await entitlement();
    await funding(['entlastungsleistung', 'verhinderungspflege']);
    await owner(() => db.query(`INSERT INTO public.client_budget_mode(tenant_id,client_id,budget_year,care_prevention_mode)
      VALUES($1,$2,2026,'separate_preventive_short_term')`, [TENANT, CLIENT]));
    const previousModes = await rows('client_budget_mode');
    const common = await annualCreation();
    const monthly = await template('paragraph_45b');
    await expect(call('recalculate', { ...common, diffs: [...common.diffs, {
      create: true, accountId: 'new:paragraph_45b:2026-10', catalogTemplateId: monthly.id,
      periodStart: '2026-10-01', periodEnd: '2027-06-30', catalogAmountCents: 1,
    }] })).rejects.toMatchObject({ code: '40001' });
    expect(await rows('client_budget_mode')).toEqual(previousModes);
    expect(await rows('client_budget_accounts')).toEqual([]);
    expect(await rows('client_budget_transactions')).toEqual([]);
    expect(await rows('client_billing_audit_log')).toEqual([]);
    expect(await receiptCount()).toBe(0);
  });

  it('does not infer common annual budget eligibility for care grade 1 from legacy catalog metadata', async () => {
    await entitlement({ care_grade: 'pg1' });
    await funding(['verhinderungspflege']);
    await expect(call('recalculate', await annualCreation())).rejects.toMatchObject({ code: '40001' });
    expect(await rows('client_budget_accounts')).toEqual([]);
  });

  it.each(['verhinderungspflege', 'kurzzeitpflege'])('does not create a new separate %s account for 2026', async (key) => {
    await entitlement();
    await funding(['verhinderungspflege']);
    await expect(call('recalculate', await annualCreation(key))).rejects.toMatchObject({ code: '22023' });
    expect(await rows('client_budget_accounts')).toEqual([]);
    expect(await receiptCount()).toBe(0);
  });

  it.each(['active', 'suspended', 'closed'])('blocks a common annual account while any separate annual account remains (%s)', async (status) => {
    await entitlement();
    await funding(['verhinderungspflege']);
    const prior = await account({ catalog_key: 'verhinderungspflege', ...annualPeriod, allocated_cents: 168500, used_cents: 0, reserved_cents: 0, status });
    await expect(call('recalculate', await annualCreation())).rejects.toMatchObject({ code: '22023' });
    expect(await rows('client_budget_accounts')).toEqual([prior]);
    expect(await rows('client_budget_transactions')).toEqual([]);
  });

  it('keeps a prior-year separate account while creating the new-year common annual account', async () => {
    await entitlement();
    await funding(['verhinderungspflege']);
    const prior = await account({ catalog_key: 'verhinderungspflege', period: 'yearly', catalog_year: 2025, period_start: '2025-01-01', period_end: '2025-12-31', allocated_cents: 168500, reserved_cents: 0, status: 'closed' });
    await call('recalculate', await annualCreation());
    expect(await rows('client_budget_accounts')).toHaveLength(2);
    expect((await rows('client_budget_accounts')).find((row) => row.id === prior.id)).toEqual(prior);
  });

  it.each(['correction', 'update_account', 'recalculate'])('blocks %s increases while common and separate annual balances coexist', async (action) => {
    await entitlement();
    await funding(['verhinderungspflege']);
    const joint = await account({ catalog_key: 'gemeinsames_jahresbudget', ...annualPeriod, allocated_cents: 350000, reserved_cents: 0 });
    await account({ catalog_key: 'verhinderungspflege', ...annualPeriod, allocated_cents: 168500, reserved_cents: 0 });
    const input = action === 'correction' ? correction(joint, { amountCents: 500 }) : action === 'update_account'
      ? { accountId: joint.id, expectedUpdatedAt: joint.updated_at, allocatedCents: 350500, reason: 'Erhöhung' }
      : { reason: 'Katalogstand', asOfDate: '2026-10-17', diffs: [{ accountId: joint.id, currentAllocatedCents: 350000, catalogAmountCents: 353900 }] };
    await expect(call(action, input)).rejects.toMatchObject({ code: '22023' });
    expect((await rows('client_budget_accounts')).find((row) => row.id === joint.id)?.allocated_cents).toBe(350000);
    expect(await rows('client_budget_transactions')).toEqual([]);
    expect(await receiptCount()).toBe(0);
  });

  it('permits a documented reduction while duplicate annual accounts are being reconciled', async () => {
    const joint = await account({ catalog_key: 'gemeinsames_jahresbudget', ...annualPeriod, allocated_cents: 350000, reserved_cents: 0 });
    await account({ catalog_key: 'verhinderungspflege', ...annualPeriod, allocated_cents: 168500, reserved_cents: 0 });
    await call('correction', correction(joint, { amountCents: -500 }));
    expect((await rows('client_budget_accounts')).find((row) => row.id === joint.id)?.allocated_cents).toBe(349500);
    expect((await rows('client_budget_transactions'))[0].amount_cents).toBe(-500);
  });
});
