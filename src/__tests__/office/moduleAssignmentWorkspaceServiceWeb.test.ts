import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PermissionKey } from '@/types';

const f = vi.hoisted(() => ({ demo: vi.fn(), client: vi.fn(), profile: vi.fn(), resolveProfile: vi.fn(), company: vi.fn(), demoPermissions: vi.fn(), moduleAccess: vi.fn() }));
vi.mock('@/lib/modules/moduleAccessService', () => ({ hasEffectiveModuleGateAccess: f.moduleAccess }));
vi.mock('@/lib/modules/constants', () => ({ isUnreleasedCatalogModuleKey: (key: string) => key !== 'assist' }));
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
import { countModuleAssignmentDocumentInventory } from '@/lib/officeModules/moduleAssignmentInventory.web';
import { CENTRAL_CATALOG_INDEX } from '@/data/seeds/documentCatalog/centralCatalogIndex';

const scope: ModuleAssignmentWorkspaceScope = { authUserId: 'auth-live', profileId: 'profile-live', tenantId: 'tenant-live', roleKey: 'business_admin' };
const permissions: PermissionKey[] = ['office.access', 'office.clients.view', 'office.clients.edit', 'office.employees.view', 'office.employees.edit', 'office.catalogs.view', 'office.documents.view', 'business.tenant.manage', 'office.invoices.view'];
type Row = Record<string, unknown>;
type Call = { table: string; columns: string; filters: [string, unknown][]; excludes: [string, unknown][]; nulls: string[]; memberships: [string, string[]][]; orders: { column: string; ascending: boolean; nullsFirst: boolean }[]; systemAndTenant?: string; ids?: string[]; from: number; to: number };
const assignment = (id: string, extra: Row = {}): Row => ({ id, tenant_id: scope.tenantId, module_key: 'assist', status: 'active', is_active: true, client_id: `client-${id}`, assigned_at: '2026-10-21T09:30:00Z', ...extra });

function setupClient() {
  const rows: Record<string, Row[]> = {
    tenants: [{ id: scope.tenantId, name: ' Live-Unternehmen ' }], roles: [{ id: 'role-live', key: 'owner' }], role_permission_sets: [], employee_permission_overrides: [],
    client_module_assignments: [], employee_module_assignments: [], module_service_catalog: [], module_document_visibility: [], module_template_assignments: [], module_permission_profiles: [], module_billing_sources: [], clients: [], employees: [],
    tenant_service_catalog: [], tenant_service_prices: [], client_documents: [], client_intake_documents: [], role_templates: [], invoices: [],
  };
  const calls: Call[] = [], denied = new Set<string>();
  const getUser = vi.fn().mockResolvedValue({ data: { user: { id: scope.authUserId } }, error: null });
  const rpc = vi.fn(async (name: string, args?: { p_permission_key: string }): Promise<{ data: unknown; error: unknown }> => ({ data: name === 'current_employee_id_from_profile' ? rows.employees.find(row => row.profile_id === scope.profileId)?.id ?? null : !denied.has(args!.p_permission_key), error: null }));
  const errors = new Set<string>(), throws = new Set<string>();
  let failOffset = -1;
  const from = vi.fn((table: string) => {
    const call: Call = { table, columns: '', filters: [], excludes: [], nulls: [], memberships: [], orders: [], from: 0, to: Number.MAX_SAFE_INTEGER };
    async function reply(single = false) {
      calls.push({ ...call, filters: [...call.filters] });
      if (throws.has(table)) throw new Error('Query rejected unexpectedly');
      if (errors.has(table) || call.from === failOffset) return { data: null, count: null, error: { message: 'offline' } };
      let values = (rows[table] ?? []).filter(row => call.filters.every(([key, value]) => row[key] === value));
      values = values.filter(row => call.excludes.every(([key, value]) => row[key] !== value) && call.nulls.every(key => row[key] == null)
        && call.memberships.every(([key, values]) => values.includes(String(row[key])))
        && (!call.systemAndTenant || row.tenant_id === null || row.tenant_id === call.systemAndTenant));
      if (call.ids) values = values.filter(row => call.ids!.includes(String(row.id)));
      const count = values.length;
      if (single && count > 1) return { data: null, count, error: { message: 'Multiple rows' } };
      values.sort((a, b) => {
        for (const order of call.orders) {
          const left = a[order.column], right = b[order.column];
          if (left == null && right == null || left === right) continue;
          if (left == null) return order.nullsFirst ? -1 : 1;
          if (right == null) return order.nullsFirst ? 1 : -1;
          // Fixtures use uniformly formatted UTC timestamps, preserving PostgreSQL fractional precision.
          return (String(left) < String(right) ? -1 : 1) * (order.ascending ? 1 : -1);
        }
        return 0;
      });
      values = values.slice(call.from, call.to + 1).map(row => Object.fromEntries(call.columns.split(',').map(key => key.trim()).map(key => [key, row[key]])));
      return { data: single ? values[0] ?? null : values, count, error: null };
    }
    const query = { select: vi.fn((columns: string) => { call.columns = columns; return query; }), eq: vi.fn((key: string, value: unknown) => { call.filters.push([key, value]); return query; }),
      neq: vi.fn((key: string, value: unknown) => { call.excludes.push([key, value]); return query; }), is: vi.fn((key: string, _value: null) => { call.nulls.push(key); return query; }),
      or: vi.fn((value: string) => { call.systemAndTenant = value.split('tenant_id.eq.')[1]; return query; }),
      in: vi.fn((key: string, values: string[]) => { if (key === 'id') call.ids = values; else call.memberships.push([key, values]); return query; }),
      order: vi.fn((column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) => { const ascending = options?.ascending ?? true; call.orders.push({ column, ascending, nullsFirst: options?.nullsFirst ?? !ascending }); return query; }),
      range: vi.fn((start: number, end: number) => { call.from = start; call.to = end; return query; }),
      maybeSingle: vi.fn(() => reply(true)), then: (resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) => reply().then(resolve, reject),
    };
    return query;
  });
  const client = { from, rpc, auth: { getUser } };
  f.client.mockReturnValue(client);
  return { rows, calls, denied, getUser, rpc, errors, throws, from, failOnOffset: (value: number) => { failOffset = value; } };
}

beforeEach(() => {
  vi.clearAllMocks();
  f.demo.mockReturnValue(false);
  f.moduleAccess.mockReturnValue(true);
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

  it('clears stale data when an unexpected query rejection skips the final access check', async () => {
    const state = setupClient(); state.throws.add('tenants');
    expect(await fetchModuleAssignmentWorkspace(scope)).toMatchObject({ ok: false, code: 'unavailable' });
    expect(f.profile).toHaveBeenCalledTimes(1);
    expect(state.calls.some(call => call.table === 'client_module_assignments')).toBe(false);
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
    expect(state.calls.filter(call => call.table === 'clients' && call.ids).every(call => call.ids!.length <= 100)).toBe(true);
  });

  it('does not silently turn failed name queries into unknown persons', async () => {
    const state = setupClient(); state.rows.client_module_assignments = [assignment('a')]; state.errors.add('clients');
    expect(await fetchModuleAssignmentWorkspace(scope, 'clients')).toMatchObject({ ok: false, code: 'connection' });
    expect(f.profile).toHaveBeenCalledTimes(2);
  });

  it('rechecks revoked access after a name read failure instead of retaining stale personal data', async () => {
    const state = setupClient(); state.rows.client_module_assignments = [assignment('a')]; state.errors.add('clients');
    let clientPermissionReads = 0;
    state.rpc.mockImplementation(async (name, args) => ({ data: name === 'current_employee_id_from_profile' ? null : args!.p_permission_key === 'office.clients.view' ? ++clientPermissionReads === 1 : true, error: null }));
    expect(await fetchModuleAssignmentWorkspace(scope, 'clients')).toMatchObject({ ok: false, code: 'permission' });
    expect(clientPermissionReads).toBe(2);
    expect(f.profile).toHaveBeenCalledTimes(2);
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

describe('real source inventory alongside explicit module assignments', () => {
  it('shows existing non-deleted people, catalog rows, available role templates and invoices even with no assignments', async () => {
    const state = setupClient();
    state.rows.clients = [
      { id: 'client-active', tenant_id: scope.tenantId, status: 'active' },
      { id: 'client-archived', tenant_id: scope.tenantId, status: 'archived' },
      { id: 'client-deleted', tenant_id: scope.tenantId, status: 'deleted' },
      { id: 'client-other', tenant_id: 'other-tenant', status: 'active' },
    ];
    state.rows.employees = [
      { id: 'employee-active', tenant_id: scope.tenantId, status: 'active', deleted_at: null },
      { id: 'employee-inactive', tenant_id: scope.tenantId, status: 'inactive', deleted_at: null },
      { id: 'employee-deleted', tenant_id: scope.tenantId, status: 'deleted', deleted_at: null },
      { id: 'employee-soft-deleted', tenant_id: scope.tenantId, status: 'active', deleted_at: '2026-10-20T00:00:00Z' },
    ];
    state.rows.tenant_service_catalog = [
      { id: 'service-active', tenant_id: scope.tenantId, module_key: 'assist', is_active: true },
      { id: 'service-inactive', tenant_id: scope.tenantId, module_key: 'assist', is_active: false },
      { id: 'service-unreleased', tenant_id: scope.tenantId, module_key: 'pflege', is_active: true },
    ];
    state.rows.tenant_service_prices = Array.from({ length: 12 }, (_, index) => ({ id: `price-${index}`, tenant_id: scope.tenantId, catalog_id: 'service-active' }));
    state.rows.role_templates = [{ id: 'role-system', tenant_id: null }, { id: 'role-custom', tenant_id: scope.tenantId }, { id: 'role-other', tenant_id: 'other-tenant' }];
    state.rows.invoices = [{ id: 'invoice-draft', tenant_id: scope.tenantId, status: 'draft' }, { id: 'invoice-final', tenant_id: scope.tenantId, status: 'sent' }];
    const result = await fetchModuleAssignmentWorkspace(scope);
    expect(result.ok).toBe(true); if (!result.ok) return;
    for (const key of ['clients', 'employees', 'services', 'permissions', 'billing']) {
      expect(result.data.sections.find(item => item.key === key)).toMatchObject({ count: 0, activeCount: 0, state: 'ready', inventory: { count: 2, state: 'ready' } });
    }
    expect(result.data.sections.find(item => item.key === 'templates')?.inventory).toMatchObject({ count: CENTRAL_CATALOG_INDEX.length, state: 'ready', action: { route: '/business/office/document-catalog' } });
    expect(CENTRAL_CATALOG_INDEX).toHaveLength(450);
    expect(state.calls.some(call => call.table === 'tenant_service_prices')).toBe(false);
    expect(state.calls.filter(call => ['clients', 'employees', 'role_templates', 'tenant_service_catalog', 'invoices'].includes(call.table)).every(call => !/name|address|iban|amount|description|\*/.test(call.columns))).toBe(true);
    expect(f.moduleAccess).toHaveBeenCalledWith('assist', scope.tenantId);
  });

  it('does not count catalog rows from modules that the catalog destination does not expose', async () => {
    const state = setupClient(); f.moduleAccess.mockReturnValue(false);
    state.rows.tenant_service_catalog = [{ id: 'service', tenant_id: scope.tenantId, module_key: 'assist' }];
    const result = await fetchModuleAssignmentWorkspace(scope);
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.data.sections.find(item => item.key === 'services')?.inventory).toMatchObject({ count: 0, state: 'ready' });
    expect(state.calls.some(call => call.table === 'tenant_service_catalog')).toBe(false);
  });

  it('discards catalog inventory when a module gate changes during its read', async () => {
    const state = setupClient(); f.moduleAccess.mockReturnValueOnce(true).mockReturnValue(false);
    state.rows.tenant_service_catalog = [{ id: 'service', tenant_id: scope.tenantId, module_key: 'assist' }];
    const result = await fetchModuleAssignmentWorkspace(scope);
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.data.sections.find(item => item.key === 'services')).toMatchObject({ state: 'ready', count: 0, inventory: { count: null, state: 'error', action: null } });
    expect(result.data.sections.find(item => item.key === 'templates')?.inventory).toMatchObject({ count: 450, state: 'ready' });
    expect(f.moduleAccess).toHaveBeenCalledTimes(2);
    expect(f.profile).toHaveBeenCalledTimes(2);
  });

  it('loads all source pages beyond the API default and excludes other tenants', async () => {
    const state = setupClient(); state.rows.clients = Array.from({ length: 1001 }, (_, index) => ({ id: `client-${index}`, tenant_id: scope.tenantId, status: 'active' }));
    state.rows.clients.push({ id: 'private-other', tenant_id: 'other-tenant', status: 'active' });
    const result = await fetchModuleAssignmentWorkspace(scope);
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.data.sections.find(item => item.key === 'clients')).toMatchObject({ count: 0, inventory: { count: 1001, state: 'ready' } });
    expect(state.calls.filter(call => call.table === 'clients').map(call => call.from)).toEqual([0, 250, 500, 750, 1000]);
  });

  it('does not substitute a partial source page or static role seeds after a source read failure', async () => {
    const state = setupClient(); state.rows.clients = Array.from({ length: 251 }, (_, index) => ({ id: `client-${index}`, tenant_id: scope.tenantId, status: 'active' }));
    state.failOnOffset(250); state.errors.add('role_templates');
    const result = await fetchModuleAssignmentWorkspace(scope);
    expect(result.ok).toBe(true); if (!result.ok) return;
    for (const key of ['clients', 'permissions']) expect(result.data.sections.find(item => item.key === key)).toMatchObject({ count: 0, state: 'ready', inventory: { count: null, state: 'error' } });
    expect(f.profile).toHaveBeenCalledTimes(2);
  });

  it('keeps inventory errors local while returning real selected assignment details', async () => {
    const state = setupClient(); state.rows.module_document_visibility = [assignment('visibility', { document_title: 'Freigegeben', visibility: 'office_and_module' })];
    state.throws.add('client_documents');
    const result = await fetchModuleAssignmentWorkspace(scope, 'documents');
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.data.items).toHaveLength(1);
    expect(result.data.sections.find(item => item.key === 'documents')).toMatchObject({ count: 1, state: 'ready', inventory: { count: null, state: 'error' } });
    expect(f.profile).toHaveBeenCalledTimes(2);
  });

  it('does not return source data when access is revoked during a failed inventory read', async () => {
    const state = setupClient(); state.throws.add('client_documents');
    f.company.mockResolvedValueOnce({ ok: true, data: { scopeLimited: false, permissions } }).mockResolvedValue({ ok: true, data: { scopeLimited: false, permissions: permissions.filter(key => key !== 'office.documents.view') } });
    expect(await fetchModuleAssignmentWorkspace(scope)).toMatchObject({ ok: false, code: 'permission' });
    expect(f.profile).toHaveBeenCalledTimes(2);
  });

  it('allows template inventory and its detail route independently from assignment catalog access', async () => {
    const state = setupClient(); state.denied.add('office.catalogs.view');
    const result = await fetchModuleAssignmentWorkspace(scope, 'templates');
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.data.items).toEqual([]);
    expect(result.data.sections.find(item => item.key === 'templates')).toMatchObject({ count: null, state: 'restricted', action: null, inventory: { count: 450, state: 'ready', action: { route: '/business/office/document-catalog' } } });
    expect(state.calls.some(call => call.table === 'module_template_assignments')).toBe(false);
  });

  it('gates real source reads independently and never returns restricted source counts', async () => {
    const state = setupClient(); state.denied.add('office.clients.view'); state.denied.add('office.invoices.view');
    f.company.mockResolvedValue({ ok: true, data: { scopeLimited: false, permissions: ['office.employees.view', 'business.tenant.manage'] } });
    const result = await fetchModuleAssignmentWorkspace(scope, 'templates');
    expect(result.ok).toBe(true); if (!result.ok) return;
    for (const key of ['clients', 'documents', 'templates', 'billing']) expect(result.data.sections.find(item => item.key === key)?.inventory).toMatchObject({ count: null, state: 'restricted', action: null });
    expect(state.calls.some(call => ['clients', 'client_documents', 'client_intake_documents', 'invoices'].includes(call.table))).toBe(false);
    expect(result.data.sections.find(item => item.key === 'templates')).toMatchObject({ count: 0, state: 'ready' });
  });

  it('matches the archive merge for promoted, title-matched, skipped and cross-client documents without fetching content', async () => {
    const state = setupClient();
    const stored = (id: string, extra: Row = {}): Row => ({ id, tenant_id: scope.tenantId, client_id: 'client-a', title: 'Unterlage', file_name: `${id}.pdf`, source: 'upload', intake_document_id: null, updated_at: '2026-10-20T10:00:00Z', ...extra });
    const intake = (id: string, template_key: string, extra: Row = {}): Row => ({ id, tenant_id: scope.tenantId, client_id: 'client-a', title: 'Aufnahmeunterlage', template_key, document_type: 'client_contract', status: 'finalized', updated_at: '2026-10-20T10:00:00Z', ...extra });
    state.rows.client_documents = [stored('stored-link', { intake_document_id: 'intake-link' }), stored('stored-file', { file_name: 'client_contract_assist.html' }), stored('stored-title', { client_id: 'client-b', title: 'privacy_consent_default' }), stored('same-id')];
    state.rows.client_intake_documents = [intake('intake-link', 'linked'), intake('intake-file', 'client_contract_assist'), intake('intake-title', 'privacy_consent_default', { client_id: 'client-b' }), intake('intake-other-client', 'privacy_consent_default', { client_id: 'client-c' }), intake('same-id', 'different-key'), intake('intake-new', 'new-key'), ...['not_started', 'declined', 'revoked', 'replaced'].map(status => intake(`skip-${status}`, status, { status }))];
    const result = await fetchModuleAssignmentWorkspace(scope);
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.data.sections.find(item => item.key === 'documents')).toMatchObject({ count: 0, inventory: { count: 6, state: 'ready' } });
    expect(state.calls.filter(call => ['client_documents', 'client_intake_documents'].includes(call.table)).every(call => !/html|storage|rendered_pdf|first_name|last_name|\*/.test(call.columns))).toBe(true);
    expect(state.calls.some(call => call.table === 'clients' && /name/.test(call.columns))).toBe(false);
  });

  it.each([
    { kind: 'different dates', older: '2026-10-19T00:00:00Z', newer: '2026-10-20T00:00:00Z', finalId: 'a-final', pendingId: 'z-not-started' },
    { kind: 'timestamp tie', older: '2026-10-19T00:00:00Z', newer: '2026-10-19T00:00:00Z', finalId: 'a-final', pendingId: 'z-not-started' },
    { kind: 'PostgreSQL microseconds', older: '2026-10-19T00:00:00.123100Z', newer: '2026-10-19T00:00:00.123200Z', finalId: 'z-final', pendingId: 'a-not-started' },
  ])('preserves archive order when legacy title matching sees intake versions with $kind', async ({ older, newer, finalId, pendingId }) => {
    const state = setupClient();
    state.rows.client_documents = [{ id: 'stored', tenant_id: scope.tenantId, client_id: 'client-a', title: 'privacy_consent_default', file_name: 'renamed.pdf', source: 'upload', intake_document_id: null, updated_at: '2026-10-20T00:00:00Z' }];
    state.rows.client_intake_documents = [
      { id: finalId, tenant_id: scope.tenantId, client_id: 'client-a', title: 'Einwilligung', template_key: 'privacy_consent_default', document_type: 'privacy_consent', status: 'finalized', updated_at: older },
      { id: pendingId, tenant_id: scope.tenantId, client_id: 'client-a', title: 'Einwilligung', template_key: 'privacy_consent_default', document_type: 'privacy_consent', status: 'not_started', updated_at: newer },
    ];
    const result = await fetchModuleAssignmentWorkspace(scope);
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.data.sections.find(item => item.key === 'documents')?.inventory).toMatchObject({ count: 1, state: 'ready' });
    for (const call of state.calls.filter(call => ['client_documents', 'client_intake_documents'].includes(call.table))) expect(call.orders).toEqual([{ column: 'updated_at', ascending: false, nullsFirst: true }, { column: 'id', ascending: false, nullsFirst: true }]);
    expect(() => countModuleAssignmentDocumentInventory(state.rows.client_documents, [{ ...state.rows.client_intake_documents[0], tenant_id: 'other-tenant' }], scope.tenantId)).toThrow();
  });
});
