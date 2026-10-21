import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PermissionKey } from '@/types';

const f = vi.hoisted(() => ({ demo: vi.fn(), client: vi.fn(), profile: vi.fn(), resolveProfile: vi.fn(), company: vi.fn(), demoPermissions: vi.fn() }));
vi.mock('@/lib/supabase/config', () => ({ isDemoMode: f.demo }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: f.client }));
vi.mock('@/lib/supabase/tenantService', () => ({ fetchTenantProfile: f.profile }));
vi.mock('@/lib/auth/resolveAuthenticatedProfile', () => ({ resolveAuthenticatedProfileId: f.resolveProfile }));
vi.mock('@/lib/tenant/companyAccessService.web', () => ({ loadCompanyAccess: f.company }));
vi.mock('@/lib/permissions/staticRolePermissions', () => ({ getPermissionsForRole: f.demoPermissions }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: (client: { from: (table: string) => unknown }, table: string) => client.from(table) }));
vi.mock('@/data/demo/tenant', () => ({ demoTenant: { id: 'demo-tenant', name: 'Demo-Unternehmen' } }));
vi.mock('@/lib/officeCore/demoRepository', () => ({ officeCoreDemoRepository: {
  listClientModuleAssignments: () => [{ id: 'demo-1', tenantId: 'demo-tenant', clientId: 'client-demo', clientName: 'Demo Person', moduleKey: 'assist', status: 'aktiv' }],
  listEmployeeModuleAssignments: () => [], listModuleServiceCatalog: () => [], listModuleDocumentVisibility: () => [],
  listModuleTemplateAssignments: () => [], listModulePermissionProfiles: () => [], listModuleBillingSources: () => [],
} }));

import { fetchModuleAssignmentWorkspace, type ModuleAssignmentWorkspaceScope } from '@/lib/officeModules/moduleAssignmentWorkspaceService.web';

const scope: ModuleAssignmentWorkspaceScope = { authUserId: 'auth-live', profileId: 'profile-live', tenantId: 'tenant-live', roleKey: 'business_admin' };
const permissions: PermissionKey[] = ['office.access', 'office.clients.view', 'office.clients.edit', 'office.employees.view', 'office.employees.edit', 'office.catalogs.view', 'office.documents.view', 'business.tenant.manage', 'office.invoices.view'];
type Row = Record<string, unknown>;
type Call = { table: string; columns: string; filters: [string, unknown][]; ids?: string[]; from: number; to: number };
const assignment = (id: string, extra: Row = {}): Row => ({ id, tenant_id: scope.tenantId, module_key: 'assist', status: 'active', is_active: true, client_id: `client-${id}`, assigned_at: '2026-10-21T09:30:00Z', ...extra });

function setupClient() {
  const rows: Record<string, Row[]> = {
    tenants: [{ id: scope.tenantId, name: ' Live-Unternehmen ' }], roles: [{ id: 'role-live', key: 'owner' }], role_permission_sets: [], employee_permission_overrides: [],
    client_module_assignments: [], employee_module_assignments: [], module_service_catalog: [], module_document_visibility: [], module_template_assignments: [], module_permission_profiles: [], module_billing_sources: [], clients: [], employees: [],
  };
  const calls: Call[] = [], denied = new Set<string>();
  const getUser = vi.fn().mockResolvedValue({ data: { user: { id: scope.authUserId } }, error: null });
  const rpc = vi.fn(async (name: string, args?: { p_permission_key: string }): Promise<{ data: unknown; error: unknown }> => ({ data: name === 'current_employee_id_from_profile' ? rows.employees.find(row => row.profile_id === scope.profileId)?.id ?? null : !denied.has(args!.p_permission_key), error: null }));
  const errors = new Set<string>();
  let failOffset = -1;
  const from = vi.fn((table: string) => {
    const call: Call = { table, columns: '', filters: [], from: 0, to: Number.MAX_SAFE_INTEGER };
    async function reply(single = false) {
      calls.push({ ...call, filters: [...call.filters] });
      if (errors.has(table) || call.from === failOffset) return { data: null, count: null, error: { message: 'offline' } };
      let values = (rows[table] ?? []).filter(row => call.filters.every(([key, value]) => row[key] === value));
      if (call.ids) values = values.filter(row => call.ids!.includes(String(row.id)));
      const count = values.length;
      if (single && count > 1) return { data: null, count, error: { message: 'Multiple rows' } };
      values = values.slice(call.from, call.to + 1).map(row => Object.fromEntries(call.columns.split(',').map(key => key.trim()).map(key => [key, row[key]])));
      return { data: single ? values[0] ?? null : values, count, error: null };
    }
    const query = { select: vi.fn((columns: string) => { call.columns = columns; return query; }), eq: vi.fn((key: string, value: unknown) => { call.filters.push([key, value]); return query; }),
      in: vi.fn((_key: string, ids: string[]) => { call.ids = ids; return query; }), order: vi.fn(() => query), range: vi.fn((start: number, end: number) => { call.from = start; call.to = end; return query; }),
      maybeSingle: vi.fn(() => reply(true)), then: (resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) => reply().then(resolve, reject),
    };
    return query;
  });
  const client = { from, rpc, auth: { getUser } };
  f.client.mockReturnValue(client);
  return { rows, calls, denied, getUser, rpc, errors, from, failOnOffset: (value: number) => { failOffset = value; } };
}

beforeEach(() => {
  vi.clearAllMocks();
  f.demo.mockReturnValue(false);
  f.demoPermissions.mockReturnValue(permissions);
  f.profile.mockResolvedValue({ id: scope.profileId, tenantId: scope.tenantId, roleKey: scope.roleKey, roleId: 'role-live' });
  f.resolveProfile.mockResolvedValue({ ok: true, data: scope.profileId });
  f.company.mockResolvedValue({ ok: true, data: { scopeLimited: false, canManageScopes: true, permissions: ['office.employees.view', 'office.employees.edit', 'office.documents.view', 'business.tenant.manage'] } });
});

describe('module assignment workspace read boundary', () => {
  it('returns all saved counts and separate active counts without reading personal records for the hub', async () => {
    const state = setupClient();
    state.rows.client_module_assignments = [assignment('a'), assignment('b', { is_active: false }), assignment('c', { status: 'prepared' })];
    const result = await fetchModuleAssignmentWorkspace(scope);
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.data).toMatchObject({ tenantId: scope.tenantId, tenantName: 'Live-Unternehmen', source: 'live', section: null, items: [] });
    expect(result.data.sections.find(item => item.key === 'clients')).toMatchObject({ count: 3, activeCount: 2, state: 'ready' });
    expect(state.calls.some(call => ['clients', 'employees'].includes(call.table) && /name/.test(call.columns))).toBe(false);
    expect(state.calls.filter(call => call.table.endsWith('_assignments') || call.table.startsWith('module_')).every(call => !/client_id|employee_id|title|name|notes|\*/.test(call.columns))).toBe(true);
    expect(f.demoPermissions).not.toHaveBeenCalled();
  });

  it('reads all count pages, including records beyond the first thousand', async () => {
    const state = setupClient(); state.rows.client_module_assignments = Array.from({ length: 1001 }, (_, index) => assignment(`a-${index}`));
    const result = await fetchModuleAssignmentWorkspace(scope);
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.data.sections.find(item => item.key === 'clients')?.count).toBe(1001);
    expect(state.calls.filter(call => call.table === 'client_module_assignments').map(call => call.from)).toEqual([0, 250, 500, 750, 1000]);
  });

  it('isolates failed categories and never displays a failed count as zero', async () => {
    const state = setupClient(); state.errors.add('module_billing_sources');
    const hub = await fetchModuleAssignmentWorkspace(scope);
    expect(hub.ok).toBe(true); if (!hub.ok) return;
    expect(hub.data.sections.find(item => item.key === 'billing')).toMatchObject({ state: 'error', count: null, activeCount: null });
    expect(hub.data.sections.find(item => item.key === 'clients')).toMatchObject({ state: 'ready', count: 0 });
    expect(await fetchModuleAssignmentWorkspace(scope, 'billing')).toMatchObject({ ok: false, code: 'connection' });
  });

  it('does not return a partial count when a later page fails', async () => {
    const state = setupClient(); state.rows.client_module_assignments = Array.from({ length: 251 }, (_, index) => assignment(`a-${index}`)); state.failOnOffset(250);
    const result = await fetchModuleAssignmentWorkspace(scope);
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.data.sections.find(item => item.key === 'clients')).toMatchObject({ state: 'error', count: null });
  });

  it('enforces current category permissions before fetching its records', async () => {
    const state = setupClient(); state.denied.add('office.invoices.view');
    const result = await fetchModuleAssignmentWorkspace(scope);
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.data.sections.find(item => item.key === 'billing')).toMatchObject({ state: 'restricted', count: null, action: null });
    expect(state.calls.some(call => call.table === 'module_billing_sources')).toBe(false);
    expect(await fetchModuleAssignmentWorkspace(scope, 'billing')).toMatchObject({ ok: false, code: 'permission' });
  });

  it('honors a tenant role set using the actual server role key, without static defaults', async () => {
    const state = setupClient(); state.rows.role_permission_sets = [{ tenant_id: scope.tenantId, role_key: 'owner', permission_key: 'office.access' }];
    const result = await fetchModuleAssignmentWorkspace(scope);
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.data.sections.filter(item => ['clients', 'services', 'templates', 'billing'].includes(item.key)).every(item => item.state === 'restricted')).toBe(true);
    expect(result.data.sections.filter(item => ['employees', 'documents', 'permissions'].includes(item.key)).every(item => item.state === 'ready')).toBe(true);
    expect(f.demoPermissions).not.toHaveBeenCalled();
  });

  it('honors active personal deny overrides', async () => {
    const state = setupClient();
    // Production fetchTenantProfile has no employeeId property.
    state.rows.employees = [{ id: 'employee-self', tenant_id: scope.tenantId, profile_id: scope.profileId, status: 'active' }];
    state.rows.employee_permission_overrides = [{ tenant_id: scope.tenantId, employee_id: 'employee-self', permission_key: 'office.clients.view', allowed: false, valid_from: null, valid_until: null }];
    expect(await fetchModuleAssignmentWorkspace(scope, 'clients')).toMatchObject({ ok: false, code: 'permission' });
    expect(state.calls.some(call => call.table === 'client_module_assignments')).toBe(false);
  });

  it('blocks restricted company scopes before fetching assignments', async () => {
    const state = setupClient(); f.company.mockResolvedValue({ ok: true, data: { scopeLimited: true, permissions } });
    expect(await fetchModuleAssignmentWorkspace(scope)).toMatchObject({ ok: false, code: 'permission' });
    expect(state.calls).toEqual([]);
  });

  it('discards data after an account change during the request', async () => {
    const state = setupClient(); state.getUser.mockResolvedValueOnce({ data: { user: { id: scope.authUserId } }, error: null }).mockResolvedValueOnce({ data: { user: { id: scope.authUserId } }, error: null }).mockResolvedValue({ data: { user: { id: 'other-account' } }, error: null });
    expect(await fetchModuleAssignmentWorkspace(scope)).toMatchObject({ ok: false, code: 'identity' });
  });

  it('discards data after permissions are revoked during the request', async () => {
    const state = setupClient(); let officeReads = 0;
    state.rpc.mockImplementation(async (name, args) => ({ data: name === 'current_employee_id_from_profile' ? null : args!.p_permission_key === 'office.access' ? ++officeReads === 1 : true, error: null }));
    expect(await fetchModuleAssignmentWorkspace(scope)).toMatchObject({ ok: false, code: 'permission' });
  });

  it('rejects unknown modules instead of turning them into Office assignments', async () => {
    const state = setupClient(); state.rows.client_module_assignments = [assignment('bad', { module_key: 'mystery' })];
    const hub = await fetchModuleAssignmentWorkspace(scope);
    expect(hub.ok).toBe(true); if (!hub.ok) return;
    expect(hub.data.sections.find(item => item.key === 'clients')).toMatchObject({ state: 'error', count: null });
    expect(await fetchModuleAssignmentWorkspace(scope, 'clients')).toMatchObject({ ok: false });
  });

  it('fails closed when the server permission response is unavailable', async () => {
    const state = setupClient(); state.rpc.mockResolvedValue({ data: null as unknown as boolean, error: null });
    expect(await fetchModuleAssignmentWorkspace(scope)).toMatchObject({ ok: false, code: 'unavailable' });
    expect(state.calls.some(call => call.table === 'client_module_assignments')).toBe(false);
  });

  it('clears stale data when authentication or the permission evaluator throws', async () => {
    const state = setupClient(); state.getUser.mockRejectedValue(new Error('auth offline'));
    expect(await fetchModuleAssignmentWorkspace(scope)).toMatchObject({ ok: false, code: 'unavailable' });
    expect(state.calls).toEqual([]);
    state.getUser.mockResolvedValue({ data: { user: { id: scope.authUserId } }, error: null });
    state.rpc.mockRejectedValue(new Error('permission offline'));
    expect(await fetchModuleAssignmentWorkspace(scope)).toMatchObject({ ok: false, code: 'unavailable' });
  });

  it('fails closed for duplicate or inactive employee links', async () => {
    const state = setupClient();
    state.rows.employees = [{ id: 'employee-self', tenant_id: scope.tenantId, profile_id: scope.profileId, status: 'inactive' }];
    expect(await fetchModuleAssignmentWorkspace(scope)).toMatchObject({ ok: false, code: 'unavailable' });
    state.rows.employees[0].status = 'active';
    state.rows.employees.push({ ...state.rows.employees[0], id: 'duplicate-self' });
    expect(await fetchModuleAssignmentWorkspace(scope)).toMatchObject({ ok: false, code: 'unavailable' });
    expect(state.calls.some(call => call.table === 'client_module_assignments')).toBe(false);
  });

  it('does not mistake an RLS-hidden own employee link for an absent link', async () => {
    const state = setupClient();
    state.rpc.mockImplementation(async name => ({ data: name === 'current_employee_id_from_profile' ? 'hidden-self' : true, error: null }));
    expect(await fetchModuleAssignmentWorkspace(scope)).toMatchObject({ ok: false, code: 'unavailable' });
    expect(state.calls.some(call => call.table === 'client_module_assignments')).toBe(false);
  });

  it('fails closed on a timed-out identity check so stale data cannot remain visible', async () => {
    vi.useFakeTimers();
    try {
      const state = setupClient(); state.getUser.mockImplementation(() => new Promise(() => {}));
      const pending = fetchModuleAssignmentWorkspace(scope);
      await vi.advanceTimersByTimeAsync(30_001);
      expect(await pending).toMatchObject({ ok: false, code: 'unavailable' });
    } finally { vi.useRealTimers(); }
  });
});

describe('module assignment details and actions', () => {
  it.each([
    { is_active: false, rawStatus: 'active', active: false, status: 'archiviert' },
    { is_active: true, rawStatus: 'prepared', active: true, status: 'in_bearbeitung' },
    { is_active: true, rawStatus: 'inactive', active: true, status: 'archiviert' },
  ])('preserves actual portal membership independently of workflow status: $is_active / $rawStatus', async ({ is_active, rawStatus, active, status }) => {
    const state = setupClient(); state.rows.client_module_assignments = [assignment('a', { is_active, status: rawStatus })];
    state.rows.clients = [{ id: 'client-a', tenant_id: scope.tenantId, first_name: 'Erika', last_name: 'Muster' }];
    const result = await fetchModuleAssignmentWorkspace(scope, 'clients');
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.data.items[0]).toMatchObject({ active, status });
    expect(result.data.sections.find(item => item.key === 'clients')?.activeCount).toBe(active ? 1 : 0);
    if (is_active && rawStatus === 'inactive') expect(result.data.warnings.some(warning => warning.includes('Bearbeitungsstatus'))).toBe(true);
  });

  it('shows soft-deactivated clients as archived and links to the real portal editor', async () => {
    const state = setupClient(); state.rows.client_module_assignments = [assignment('a', { is_active: false })];
    state.rows.clients = [{ id: 'client-a', tenant_id: scope.tenantId, first_name: 'Erika', last_name: 'Muster' }];
    const result = await fetchModuleAssignmentWorkspace(scope, 'clients');
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.data.items[0]).toMatchObject({ title: 'Erika Muster', active: false, status: 'archiviert', actions: [{ route: '/business/office/clients/client-a' }, { route: '/business/office/clients/client-a/portal' }] });
  });

  it('loads names in bounded chunks and does not silently lose names after one thousand people', async () => {
    const state = setupClient(); state.rows.client_module_assignments = Array.from({ length: 1001 }, (_, index) => assignment(`${index}`));
    state.rows.clients = state.rows.client_module_assignments.map(row => ({ id: row.client_id, tenant_id: scope.tenantId, first_name: 'Person', last_name: row.id }));
    const result = await fetchModuleAssignmentWorkspace(scope, 'clients');
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.data.items).toHaveLength(1001);
    expect(result.data.items.every(item => item.title.startsWith('Person '))).toBe(true);
    expect(state.calls.filter(call => call.table === 'clients').every(call => call.ids!.length <= 100)).toBe(true);
  });

  it('does not silently turn failed name queries into unknown persons', async () => {
    const state = setupClient(); state.rows.client_module_assignments = [assignment('a')]; state.errors.add('clients');
    expect(await fetchModuleAssignmentWorkspace(scope, 'clients')).toMatchObject({ ok: false, code: 'connection' });
  });

  it('does not query primary employee names when employee access is denied', async () => {
    const state = setupClient(); state.rows.client_module_assignments = [assignment('a', { primary_employee_id: 'employee-private' })];
    state.rows.clients = [{ id: 'client-a', tenant_id: scope.tenantId, first_name: 'Erika', last_name: 'Muster' }];
    f.company.mockResolvedValue({ ok: true, data: { scopeLimited: false, permissions: ['office.documents.view', 'business.tenant.manage'] } });
    const result = await fetchModuleAssignmentWorkspace(scope, 'clients');
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.data.items[0].meta).toBeUndefined();
    expect(state.calls.some(call => call.table === 'employees' && /name/.test(call.columns))).toBe(false);
  });

  it('keeps missing linked records visible without a broken record action', async () => {
    const state = setupClient(); state.rows.client_module_assignments = [assignment('a')];
    const result = await fetchModuleAssignmentWorkspace(scope, 'clients');
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.data.items[0]).toMatchObject({ title: 'Klientenakte nicht verfügbar', actions: [] });
    expect(result.data.warnings).toHaveLength(1);
  });

  it('links permissions to personnel rather than recursively to the passive profiles list', async () => {
    const state = setupClient(); state.rows.module_permission_profiles = [assignment('permission', { profile_name: 'Leitung', role_key: 'business_admin', can_view: true, can_edit: false, can_export: true })];
    const result = await fetchModuleAssignmentWorkspace(scope, 'permissions');
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.data.items[0]).toMatchObject({ meta: 'Lesen · Export', actions: [{ route: '/office/employees' }] });
  });

  it('does not show a document catalog action without its document-view permission', async () => {
    setupClient(); f.company.mockResolvedValue({ ok: true, data: { scopeLimited: false, permissions: ['office.employees.view', 'business.tenant.manage'] } });
    const result = await fetchModuleAssignmentWorkspace(scope, 'templates');
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.data.sections.find(item => item.key === 'templates')?.action).toBeNull();
  });

  it('keeps demo data explicitly isolated and never falls back to it after a live failure', async () => {
    f.demo.mockReturnValue(true);
    const demo = await fetchModuleAssignmentWorkspace({ ...scope, tenantId: 'demo-tenant' }, 'clients');
    expect(demo.ok).toBe(true); if (demo.ok) expect(demo.data).toMatchObject({ source: 'demo', items: [{ title: 'Demo Person' }] });
    expect(f.client).not.toHaveBeenCalled();
    expect(await fetchModuleAssignmentWorkspace(scope)).toMatchObject({ ok: false, code: 'identity' });
    f.demo.mockReturnValue(false); f.client.mockReturnValue(null);
    expect(await fetchModuleAssignmentWorkspace(scope)).toMatchObject({ ok: false, code: 'unavailable' });
  });
});
