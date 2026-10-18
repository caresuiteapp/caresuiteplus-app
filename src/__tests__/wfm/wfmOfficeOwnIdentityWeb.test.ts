import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PermissionKey } from '@/types/permissions';

const state = vi.hoisted(() => ({ client: {} as object | null, auth: vi.fn(), rpc: vi.fn(), table: vi.fn(), permission: vi.fn(), guard: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => state.client }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: state.table }));
vi.mock('@/lib/permissions', () => ({ enforcePermission: state.permission }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: state.guard }));
vi.mock('@/lib/supabase/errors', () => ({ toGermanSupabaseError: (error: { message: string }) => error.message }));
import { resolveOfficeOwnIdentity } from '@/lib/wfm/wfmOfficeOwnIdentity.web';

const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn() };
const input = { tenantId: 'tenant-a', userId: 'auth-user-a', roleKey: 'business_admin' as const, effectivePermissions: ['time.tracking.own.view'] as PermissionKey[] };
const row = { id: 'employee-a', tenant_id: 'tenant-a', status: 'active', deleted_at: null };
beforeEach(() => {
  vi.clearAllMocks(); state.client = { auth: { getUser: state.auth }, rpc: state.rpc };
  state.auth.mockResolvedValue({ data: { user: { id: 'auth-user-a' } }, error: null });
  state.rpc.mockImplementation(async (name: string) => ({ data: name === 'current_tenant_id' ? 'tenant-a' : 'employee-a', error: null }));
  state.permission.mockReturnValue(null); state.guard.mockReturnValue(null); state.table.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({ data: row, error: null });
});

describe('Office own identity without portal table access', () => {
  it('resolves the server-bound Office profile even when auth UID differs from profile id', async () => {
    expect(await resolveOfficeOwnIdentity(input)).toEqual({ ok: true, data: { employeeId: 'employee-a' } });
    expect(state.auth).toHaveBeenCalledTimes(1);
    expect(state.rpc.mock.calls).toEqual([['current_tenant_id'], ['current_employee_id_from_profile']]);
    expect(state.table).toHaveBeenCalledExactlyOnceWith(state.client, 'employees');
    expect(query.eq.mock.calls).toEqual([['tenant_id', 'tenant-a'], ['id', 'employee-a']]);
    expect(query.select).toHaveBeenCalledWith('id,tenant_id,status,deleted_at');
    // No profile_id=auth_user_id shortcut and no forbidden portal account read.
    expect(query.eq).not.toHaveBeenCalledWith('profile_id', 'auth-user-a');
  });
  it('returns a legitimate unbound administrator as a neutral missing mapping', async () => {
    state.rpc.mockImplementation(async (name: string) => ({ data: name === 'current_tenant_id' ? 'tenant-a' : null, error: null }));
    expect(await resolveOfficeOwnIdentity(input)).toEqual({ ok: true, data: { employeeId: null } });
    expect(state.table).not.toHaveBeenCalled();
  });
  it('never lets a caller-supplied cached employee override the authoritative identity', async () => {
    const cachedInput = { ...input, employeeId: 'another-person', knownEmployeeId: 'another-person' };
    expect(await resolveOfficeOwnIdentity(cachedInput)).toEqual({ ok: true, data: { employeeId: 'employee-a' } });
    expect(query.eq).toHaveBeenCalledWith('id', 'employee-a'); expect(query.eq).not.toHaveBeenCalledWith('id', 'another-person');
  });
  it('preserves real permission or RPC errors instead of pretending the link is absent', async () => {
    state.rpc.mockImplementation(async (name: string) => name === 'current_tenant_id' ? { data: 'tenant-a', error: null } : { data: null, error: { code: '42501', message: 'Zuordnung nicht freigegeben' } });
    expect(await resolveOfficeOwnIdentity(input)).toEqual({ ok: false, error: 'Zuordnung nicht freigegeben' });
    expect(state.table).not.toHaveBeenCalled();
  });
  it('rejects another auth user and another tenant before loading any employee record', async () => {
    state.auth.mockResolvedValueOnce({ data: { user: { id: 'other-user' } }, error: null });
    expect((await resolveOfficeOwnIdentity(input)).ok).toBe(false); expect(state.rpc).not.toHaveBeenCalled();
    state.rpc.mockImplementation(async (name: string) => ({ data: name === 'current_tenant_id' ? 'other-tenant' : 'employee-a', error: null }));
    expect((await resolveOfficeOwnIdentity(input)).ok).toBe(false); expect(state.table).not.toHaveBeenCalled();
  });
  it.each(['sick', 'vacation', 'on_leave'])('does not confuse absence status %s with account deactivation', async status => {
    query.maybeSingle.mockResolvedValue({ data: { ...row, status }, error: null });
    expect(await resolveOfficeOwnIdentity(input)).toEqual({ ok: true, data: { employeeId: 'employee-a' } });
  });
  it.each(['inactive', 'terminated', 'blocked', 'deleted', 'archived', 'inaktiv', 'gesperrt', 'archiviert'])('rejects explicitly disabled personnel status %s', async status => {
    query.maybeSingle.mockResolvedValue({ data: { ...row, status }, error: null });
    expect((await resolveOfficeOwnIdentity(input)).ok).toBe(false);
  });
  it('rejects a deleted, hidden or mismatched returned employee', async () => {
    for (const data of [null, { ...row, deleted_at: '2026-10-18T08:00:00Z' }, { ...row, id: 'other' }, { ...row, tenant_id: 'other' }]) {
      query.maybeSingle.mockResolvedValue({ data, error: null }); expect((await resolveOfficeOwnIdentity(input)).ok).toBe(false);
    }
  });
  it('preserves an employee RLS error as an actual retrieval failure', async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: { message: 'Mitarbeiterzugriff verweigert' } });
    expect(await resolveOfficeOwnIdentity(input)).toEqual({ ok: false, error: 'Mitarbeiterzugriff verweigert' });
  });
  it('checks Office access, effective permission and tenant guard before IO', async () => {
    expect((await resolveOfficeOwnIdentity({ ...input, roleKey: 'employee_portal' })).ok).toBe(false);
    state.permission.mockReturnValueOnce({ ok: false, error: 'Keine Berechtigung' });
    expect((await resolveOfficeOwnIdentity({ ...input, effectivePermissions: [] })).ok).toBe(false);
    state.guard.mockReturnValue({ ok: false, error: 'Falscher Mandant' });
    expect((await resolveOfficeOwnIdentity(input)).ok).toBe(false);
    expect(state.auth).not.toHaveBeenCalled(); expect(state.rpc).not.toHaveBeenCalled(); expect(state.table).not.toHaveBeenCalled();
  });
  it('fails closed for missing login, connection and malformed RPC results', async () => {
    state.client = null; expect((await resolveOfficeOwnIdentity(input)).ok).toBe(false);
    state.client = { auth: { getUser: state.auth }, rpc: state.rpc };
    state.auth.mockResolvedValueOnce({ data: { user: null }, error: null }); expect((await resolveOfficeOwnIdentity(input)).ok).toBe(false);
    state.rpc.mockImplementation(async (name: string) => ({ data: name === 'current_tenant_id' ? 'tenant-a' : '', error: null }));
    expect((await resolveOfficeOwnIdentity(input)).ok).toBe(false); expect(state.table).not.toHaveBeenCalled();
  });
});
