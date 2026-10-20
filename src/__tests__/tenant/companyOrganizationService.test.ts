import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompanyOrganizationScope, CompanySiteInput } from '@/types/tenant/companyOrganization';
import { archiveCompanyOrganization, getCompanyOrganizationPermissions, loadCompanyOrganization, saveCompanyEmployeePlacement, saveCompanyLegalEntity, saveCompanyRelationship, saveCompanySite } from '@/lib/tenant/companyOrganizationService.web';

const state = vi.hoisted(() => ({ client: null as unknown, mode: 'supabase', blocked: false, denied: new Set<string>(), serverPermissions: ['business.tenant.manage', 'office.employees.view'], scopeLimited: false }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => state.client }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => state.mode }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: () => state.blocked ? { ok: false, error: 'Mandant gesperrt' } : null }));
vi.mock('@/lib/permissions', () => ({ enforcePermission: (_role: unknown, permission: string, context?: { effectivePermissions?: readonly string[] }) => state.denied.has(permission) || (context?.effectivePermissions && !context.effectivePermissions.includes(permission)) ? { ok: false, error: 'Keine Berechtigung' } : null }));
vi.mock('@/lib/tenant/companyAccessService.web', () => ({ loadCompanyAccess: async () => ({ ok: true, data: { permissions: state.serverPermissions, scopeLimited: state.scopeLimited, canManageScopes: !state.scopeLimited } }) }));
const tenant = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const recordId = '33333333-3333-4333-8333-333333333333';
const timestamp = '2026-10-15T08:00:00Z';
const scope: CompanyOrganizationScope = { tenantId: tenant, actorRoleKey: 'business_admin' };
type Row = Record<string, unknown>;
const site: CompanySiteInput = { name: 'Niederlassung Nord', code: 'NORD', entityId: null, kind: 'branch', leaderEmployeeId: null, costCenterId: null,
  openingHours: null, contactName: null, email: null, phone: null, street: null, postalCode: null, city: 'Herne', country: 'DE', notes: null };
const record = (extra: Row = {}): Row => ({ id: recordId, tenant_id: tenant, status: 'active', version: 1, created_at: timestamp, updated_at: timestamp, ...extra });
let tables: Map<string, Row[]>;
let reads: { name: string; columns: string; filters: [string, unknown][]; start: number }[];
let rpc: ReturnType<typeof vi.fn>;
let error: unknown;
function query(name: string) {
  let columns = '*'; const filters: [string, unknown][] = []; let start = 0; let end = 499;
  const builder = {
    select(value: string) { columns = value; return builder; }, eq(key: string, value: unknown) { filters.push([key, value]); return builder; },
    order() { return builder; }, range(a: number, b: number) { start = a; end = b; return builder; },
    then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) { return Promise.resolve().then(() => {
      reads.push({ name, columns, filters, start });
      if (error) return { data: null, error };
      const selected = (tables.get(name) ?? []).filter(row => filters.every(([key, value]) => row[key] === value)).slice(start, end + 1);
      return { data: selected.map(row => columns === '*' ? row : Object.fromEntries(columns.split(',').map(key => [key, row[key]]))), error: null };
    }).then(resolve, reject); },
  };
  return builder;
}
beforeEach(() => {
  tables = new Map(); reads = []; error = null; state.denied.clear(); state.mode = 'supabase'; state.blocked = false; state.scopeLimited = false; state.serverPermissions = ['business.tenant.manage', 'office.employees.view'];
  rpc = vi.fn(async (name: string, args: Row) => name === 'company_organization_choices' ? { data: (tables.get(args.p_kind === 'employees' ? 'employees' : 'tenant_cost_centers') ?? []).slice(Number(args.p_offset), Number(args.p_offset) + 500), error: null }
    : { data: record({ ...(args.p_data as Row), id: args.p_id ?? recordId, version: Number(args.p_expected_version ?? 0) + 1 }), error: null });
  state.client = { from: query, rpc };
});

describe('company organization live data boundary', () => {
  it('reads all pages within the tenant and only minimal employee fields', async () => {
    tables.set('company_sites', Array.from({ length: 503 }, (_, i) => record({ id: `33333333-3333-4333-8333-${String(i).padStart(12, '0')}`, name: `Standort ${i}` })).concat(record({ tenant_id: other })));
    tables.set('employees', [{ id: recordId, tenant_id: tenant, first_name: 'Erika', last_name: 'Beispiel', status: 'aktiv', salary: 'private' }]);
    const result = await loadCompanyOrganization(scope);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.sites).toHaveLength(503);
    expect(result.data.employees).toEqual([{ id: recordId, firstName: 'Erika', lastName: 'Beispiel', status: 'aktiv' }]);
    expect(reads.every(read => read.filters.some(([key, value]) => key === 'tenant_id' && value === tenant))).toBe(true);
    expect(reads.filter(read => read.name === 'company_sites').map(read => read.start)).toEqual([0, 500]);
    expect(rpc.mock.calls.every(call => call[0] === 'company_organization_choices')).toBe(true);
  });
  it('does not query personnel or placements without the personnel permission', async () => {
    state.denied.add('office.employees.view');
    const result = await loadCompanyOrganization(scope);
    expect(result.ok && result.data.employeesVisible).toBe(false);
    expect(reads.some(read => ['employees', 'company_employee_placements'].includes(read.name))).toBe(false);
    expect(getCompanyOrganizationPermissions('business_admin').managePlacements).toBe(false);
    expect(rpc.mock.calls.some(call => call[1].p_kind === 'employees')).toBe(false);
  });
  it.each(['permission', 'tenant', 'demo', 'connection', 'uuid'])('fails closed for %s before querying', async reason => {
    if (reason === 'permission') state.denied.add('business.tenant.manage');
    if (reason === 'tenant') state.blocked = true;
    if (reason === 'demo') state.mode = 'demo';
    if (reason === 'connection') state.client = null;
    const result = await loadCompanyOrganization(reason === 'uuid' ? { ...scope, tenantId: 'invalid' } : scope);
    expect(result.ok).toBe(false); expect(reads).toHaveLength(0); expect(rpc).not.toHaveBeenCalled();
  });
  it('honors runtime removal of company management', async () => {
    expect((await saveCompanySite({ ...scope, effectivePermissions: [] }, site)).ok).toBe(false); expect(rpc).not.toHaveBeenCalled();
  });
  it('uses server authority and suppresses global audit/entity management for limited scopes', async () => {
    state.scopeLimited = true;
    const result = await loadCompanyOrganization(scope);
    expect(result.ok && result.data.scopeLimited).toBe(true);
    expect(result.ok && result.data.canManageEntities).toBe(false);
    expect(reads.some(read => ['employees', 'tenant_cost_centers', 'company_organization_audit'].includes(read.name))).toBe(false);
  });
  it('stops loading when the server has revoked company access', async () => {
    state.serverPermissions = [];
    expect((await loadCompanyOrganization(scope)).ok).toBe(false);
    expect(reads).toHaveLength(0); expect(rpc).not.toHaveBeenCalled();
  });
  it('reports a missing server feature instead of presenting an empty company', async () => {
    error = { code: '42P01', message: 'relation does not exist' };
    const result = await loadCompanyOrganization(scope);
    expect(result.ok).toBe(false); expect(!result.ok && result.setupRequired).toBe(true);
  });
  it('rejects corrupted versions in server rows', async () => {
    tables.set('company_sites', [record({ version: '1' })]);
    expect((await loadCompanyOrganization(scope)).ok).toBe(false);
  });
});

describe('company organization transactions and validation', () => {
  it('saves the canonical tenant scope in one RPC and maps the committed row', async () => {
    const result = await saveCompanySite(scope, { ...site, name: '  Standort Nord  ', id: recordId, expectedVersion: 4 });
    expect(result.ok && result.data.name).toBe('Standort Nord'); expect(result.ok && result.data.version).toBe(5);
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc.mock.calls[0]).toEqual(['company_organization_save', { p_tenant_id: tenant, p_kind: 'site', p_id: recordId, p_expected_version: 4,
      p_data: { name: 'Standort Nord', code: 'NORD', entity_id: null, kind: 'branch', leader_employee_id: null, cost_center_id: null, opening_hours: null,
        contact_name: null, email: null, phone: null, street: null, postal_code: null, city: 'Herne', country: 'DE', notes: null } }]);
  });
  it.each([{ name: '' }, { email: 'invalid' }, { country: 'Deutschland' }, { kind: 'invented' }, { entityId: 'other' }, { id: recordId }, { id: recordId, expectedVersion: 0 }])('rejects invalid edits before the RPC: %j', async extra => {
    expect((await saveCompanySite(scope, { ...site, ...extra } as CompanySiteInput)).ok).toBe(false); expect(rpc).not.toHaveBeenCalled();
  });
  it('archives with the expected version and no editable metadata', async () => {
    const result = await archiveCompanyOrganization(scope, 'site', recordId, 1);
    expect(result.ok && result.data.status).toBe('archived');
    expect(rpc.mock.calls[0][1].p_data).toEqual({ status: 'archived' });
  });
  it('reports a compare-and-swap conflict explicitly', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '40001', message: 'changed' } });
    const result = await saveCompanySite(scope, { ...site, id: recordId, expectedVersion: 1 });
    expect(!result.ok && result.conflict).toBe(true); expect(!result.ok && result.reloadRequired).toBe(true);
  });
  it('does not accept a foreign-tenant success response', async () => {
    rpc.mockResolvedValue({ data: record({ tenant_id: other }), error: null });
    const result = await saveCompanySite(scope, site);
    expect(result.ok).toBe(false); expect(!result.ok && result.reloadRequired).toBe(true);
  });
  it('does not accept an unconfirmed write and asks for reload after transport failure', async () => {
    rpc.mockRejectedValue(new Error('connection interrupted'));
    const result = await saveCompanySite(scope, site);
    expect(!result.ok && result.reloadRequired).toBe(true);
  });
  it('rejects invalid dates, percentages and employee access in placements', async () => {
    const input = { employeeId: recordId, entityId: recordId, siteId: null, departmentId: null, roleTitle: null, startsOn: '2026-02-30', endsOn: null, isPrimary: true, allocationPercent: 100, notes: null };
    expect((await saveCompanyEmployeePlacement(scope, input)).ok).toBe(false);
    expect((await saveCompanyEmployeePlacement(scope, { ...input, startsOn: '2026-10-15', endsOn: '2026-10-14' })).ok).toBe(false);
    expect((await saveCompanyEmployeePlacement(scope, { ...input, startsOn: '2026-10-15', allocationPercent: 101 })).ok).toBe(false);
    state.denied.add('office.employees.view');
    expect((await saveCompanyEmployeePlacement(scope, { ...input, startsOn: '2026-10-15' })).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('rejects self partnerships and circular direct parents', async () => {
    expect((await saveCompanyRelationship(scope, { kind: 'franchise', entityId: recordId, partnerEntityId: recordId, partnerName: 'Partner', territory: null, ownershipPercent: null,
      startsOn: null, endsOn: null, contractReference: null, responsibilities: null, contactName: null, email: null, phone: null, notes: null })).ok).toBe(false);
    expect((await saveCompanyLegalEntity(scope, { ...site, id: recordId, expectedVersion: 1, parentEntityId: recordId, legalForm: null, registrationNumber: null, taxNumber: null, vatId: null, website: null })).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
});
