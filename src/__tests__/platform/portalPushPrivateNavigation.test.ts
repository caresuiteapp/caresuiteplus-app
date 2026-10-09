import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PortalSessionRecord } from '@/lib/auth/portalSessionStore';
import { resolvePortalPushDestination } from '@/lib/portal/resolvePortalPushDestination';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), session: vi.fn(), client: vi.fn() }));
vi.mock('@/lib/auth/portalSessionStore', () => ({ getActivePortalSession: mocks.session }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: mocks.client }));

const id = '00000000-0000-4000-8000-000000000001';
const account = '00000000-0000-4000-8000-000000000002';
const tenant = '00000000-0000-4000-8000-000000000003';
const session: PortalSessionRecord = {
  sessionToken: 'private-session-token', accountId: account, tenantId: tenant,
  loginType: 'client_portal', roleKey: 'client_portal',
  expiresAt: new Date(Date.now() + 3600_000).toISOString(),
};
const row = { route: `/portal/client/messages/${id}`, account_id: account, tenant_id: tenant };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockReturnValue(session);
  mocks.client.mockReturnValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ data: [row], error: null });
});
afterEach(() => vi.useRealTimers());

describe('Private push destination lookup', () => {
  it('resolves an opaque notification inside authenticated Supabase with the expected account', async () => {
    expect(await resolvePortalPushDestination({ notificationId: id }, session)).toBe(row.route);
    expect(mocks.rpc).toHaveBeenCalledWith('portal_push_resolve_destination', {
      p_notification_id: id, p_expected_account_id: account,
    });
  });
  it('ignores destinations included in an opaque push and uses only the server response', async () => {
    expect(await resolvePortalPushDestination({ notificationId: id, route: 'https://evil.test', tenantId: 'other' }, session)).toBe(row.route);
  });
  it('does not request a destination without a current complete session', async () => {
    for (const current of [null, { ...session, mustChangePassword: true }, { ...session, sessionToken: 'changed' }, { ...session, expiresAt: 'invalid' }]) {
      mocks.session.mockReturnValue(current);
      expect(await resolvePortalPushDestination({ notificationId: id }, session)).toBeNull();
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('rejects malformed opaque IDs without falling back to an embedded route', async () => {
    for (const notificationId of [null, 42, '', '../private', 'not-a-uuid']) {
      expect(await resolvePortalPushDestination({ notificationId, route: row.route, accountId: account, tenantId: tenant }, session)).toBeNull();
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('rejects cross-account, cross-tenant, cross-role and arbitrary destinations returned by a response', async () => {
    for (const data of [
      [{ ...row, account_id: id }], [{ ...row, tenant_id: id }],
      [{ ...row, route: `/portal/employee/messages/${id}` }],
      [{ ...row, route: 'https://evil.test' }], [], [row, row], [null], [{}], 'invalid',
    ]) {
      mocks.rpc.mockResolvedValue({ data, error: null });
      expect(await resolvePortalPushDestination({ notificationId: id }, session)).toBeNull();
    }
  });
  it('rejects a session switch while the lookup is in flight', async () => {
    let complete!: (result: unknown) => void;
    mocks.rpc.mockReturnValue(new Promise(resolve => { complete = resolve; }));
    const pending = resolvePortalPushDestination({ notificationId: id }, session);
    mocks.session.mockReturnValue({ ...session, sessionToken: 'new-login' });
    complete({ data: [row], error: null });
    expect(await pending).toBeNull();
  });
  it('handles offline errors, missing clients and inaccessible destinations without navigation', async () => {
    mocks.rpc.mockRejectedValue(new Error('offline'));
    expect(await resolvePortalPushDestination({ notificationId: id }, session)).toBeNull();
    mocks.rpc.mockResolvedValue({ data: [row], error: { message: 'denied' } });
    expect(await resolvePortalPushDestination({ notificationId: id }, session)).toBeNull();
    mocks.client.mockReturnValue(null);
    expect(await resolvePortalPushDestination({ notificationId: id }, session)).toBeNull();
  });
  it('bounds an unresponsive lookup and ignores its late result', async () => {
    vi.useFakeTimers();
    let complete!: (result: unknown) => void;
    mocks.rpc.mockReturnValue(new Promise(resolve => { complete = resolve; }));
    const pending = resolvePortalPushDestination({ notificationId: id }, session);
    await vi.advanceTimersByTimeAsync(12_001);
    expect(await pending).toBeNull();
    complete({ data: [row], error: null });
  });
  it('keeps account-scoped older notifications compatible without contacting Expo or a lookup service', async () => {
    const legacy = { route: row.route, accountId: account, tenantId: tenant };
    expect(await resolvePortalPushDestination(legacy, session)).toBe(row.route);
    expect(await resolvePortalPushDestination({ ...legacy, accountId: id }, session)).toBeNull();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
