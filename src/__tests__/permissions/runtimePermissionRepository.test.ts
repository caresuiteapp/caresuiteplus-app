import { beforeEach, describe, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ replies: [] as any[], client: true, mode: 'supabase', queries: vi.fn(), filters: [] as [string, string, unknown][] }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => f.mode }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => f.client ? { from: (table: string) => { f.queries(table); const chain: any = { select: () => chain, eq: (key: string, value: unknown) => { f.filters.push([table, key, value]); return chain; }, is: (key: string, value: unknown) => { f.filters.push([table, key, value]); return chain; }, maybeSingle: () => chain, then: (resolve: any, reject: any) => Promise.resolve(f.replies.shift() ?? { data: [], error: null }).then(resolve, reject) }; return chain; } } : null }));
import { clearRuntimePermissionCache, fetchRuntimePermissions, getCachedRuntimePermissions } from '@/lib/supabase/permissionRepository';
const ok = (data: any) => ({ data, error: null });
const success = (permission: string) => [ok({ id: 'role' }), ok([{ permission_key: permission }]), ok([])];
beforeEach(() => { clearRuntimePermissionCache(); f.replies = []; f.client = true; f.mode = 'supabase'; f.queries.mockClear(); f.filters = []; });
describe('runtime permission repository error and cache boundaries', () => {
  it('recognizes legacy assignment view and management flags for the active tenant role', async () => {
    f.replies = [ok({ id: 'role' }), ok([{ permission_key: 'assignments', can_view: true, can_update: true, can_delete: false }]), ok([])];
    const permissions = await fetchRuntimePermissions('owner', 'tenant', 'actor');
    expect(permissions).toContain('assist.assignments.view');
    expect(permissions).toContain('assist.assignments.manage');
  });
  it.each([false, null, undefined])('does not turn legacy delete or read access into management when update is %s', async canUpdate => {
    f.replies = [ok({ id: 'role' }), ok([{ permission_key: 'assignments', can_view: true, can_update: canUpdate, can_delete: true }]), ok([])];
    const permissions = await fetchRuntimePermissions('owner', 'tenant', 'actor');
    expect(permissions).toContain('assist.assignments.view');
    expect(permissions).not.toContain('assist.assignments.manage');
  });
  it('keeps an explicit tenant permission list authoritative over legacy assignment grants', async () => {
    f.replies = [ok({ id: 'role' }), ok([{ permission_key: 'assignments', can_view: true, can_update: true }]), ok([{ permission_key: 'assist.assignments.view' }])];
    expect(await fetchRuntimePermissions('owner', 'tenant', 'actor')).toEqual(['assist.assignments.view']);
  });
  it('does not infer assignment read access from a legacy management flag', async () => {
    f.replies = [ok({ id: 'role' }), ok([{ permission_key: 'assignments', can_view: false, can_update: true }]), ok([])];
    const permissions = await fetchRuntimePermissions('owner', 'tenant', 'actor');
    expect(permissions).toContain('assist.assignments.manage');
    expect(permissions).not.toContain('assist.assignments.view');
  });
  it('retains exact assignment grants independently of the old module flags', async () => {
    f.replies = [ok({ id: 'role' }), ok([{ permission_key: 'assist.assignments.manage', can_view: false, can_update: false }]), ok([])];
    expect(await fetchRuntimePermissions('owner', 'tenant', 'actor')).toEqual(['assist.assignments.manage']);
  });
  it('does not expand a foreign tenant legacy grant on a shared role', async () => {
    f.replies = [ok({ id: 'role' }), ok([{ permission_key: 'office.clients.view', tenant_id: null }, { permission_key: 'assignments', tenant_id: 'foreign', can_view: true, can_update: true }]), ok([])];
    expect(await fetchRuntimePermissions('owner', 'tenant', 'actor')).toEqual(['office.clients.view']);
  });
  it.each([0, 1, 2])('does not grant static rights when read %s fails or cache the denial as a successful response', async position => { f.replies = [...success('office.clients.edit').slice(0, position), { data: null, error: { message: 'unavailable' } }]; expect(await fetchRuntimePermissions('business_admin', 'tenant', 'actor')).toEqual([]); f.replies = success('office.clients.view'); expect(await fetchRuntimePermissions('business_admin', 'tenant', 'actor')).toEqual(['office.clients.view']); });
  it('does not grant live rights without a configured client', async () => { f.client = false; expect(await fetchRuntimePermissions('business_admin', 'tenant', 'actor')).toEqual([]); expect(getCachedRuntimePermissions('business_admin', 'tenant')).toEqual([]); });
  it('does not reuse one actor cache entry for another or for legacy unscoped callers', async () => { f.replies = success('office.clients.edit'); await fetchRuntimePermissions('business_admin', 'tenant', 'actor-a'); f.replies = success('office.clients.view'); expect(await fetchRuntimePermissions('business_admin', 'tenant', 'actor-b')).toEqual(['office.clients.view']); f.replies = success('office.clients.view'); expect(await fetchRuntimePermissions('business_admin', 'tenant')).toEqual(['office.clients.view']); expect(f.queries).toHaveBeenCalledTimes(9); });
  it('does not repopulate a cleared cache from an earlier in-flight request', async () => { let finish!: (value: any) => void; f.replies = [new Promise(resolve => { finish = resolve; }), ok([{ permission_key: 'office.clients.edit' }]), ok([])]; const pending = fetchRuntimePermissions('business_admin', 'tenant', 'actor'); clearRuntimePermissionCache(); finish(ok({ id: 'role' })); await pending; expect(getCachedRuntimePermissions('business_admin', 'tenant', 'actor')).toEqual([]); });
  it('selects the exact tenant role even when a system role has the same key', async () => { f.replies = success('office.clients.view'); await fetchRuntimePermissions('business_admin', 'tenant', 'actor'); expect(f.filters).toContainEqual(['roles', 'tenant_id', 'tenant']); expect(f.queries.mock.calls.filter(call => call[0] === 'roles')).toHaveLength(1); });
  it('uses a system role only after a successful empty tenant-role read', async () => { f.replies = [ok(null), ...success('office.clients.view')]; expect(await fetchRuntimePermissions('business_admin', 'tenant', 'actor')).toEqual(['office.clients.view']); expect(f.filters).toContainEqual(['roles', 'tenant_id', null]); });
  it('honors tenant overrides even when the legacy base role definition is absent', async () => { f.replies = [ok(null), ok(null), ok([{ permission_key: 'office.clients.view' }])]; expect(await fetchRuntimePermissions('business_admin', 'tenant', 'actor')).toEqual(['office.clients.view']); });
  it('retains static defaults only for a successful empty legacy definition', async () => { f.replies = [ok(null), ok(null)]; expect(await fetchRuntimePermissions('business_admin', 'tenant', 'actor')).toContain('office.clients.edit'); });
});
