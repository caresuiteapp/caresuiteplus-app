import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FamilyPortalAccessScope, FamilyPortalCapability } from '@/lib/portal/familyPortalAccessScope';
import type { PortalContext } from '@/lib/portal/types';

const f = vi.hoisted(() => ({ client: null as any, queries: [] as { table: string; calls: unknown[][] }[], metrics: vi.fn(), activities: vi.fn(), requests: vi.fn(), budget: vi.fn(), proofs: vi.fn(), care: vi.fn(), widgets: vi.fn(), modules: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => f.client }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: (client: any, table: string) => client.from(table) }));
vi.mock('@/lib/portal/clientPortalDashboardLive', () => ({ fetchClientPortalLiveMetrics: f.metrics }));
vi.mock('@/lib/portal/assist/portalActivityService', () => ({ listPortalActivities: f.activities }));
vi.mock('@/lib/portal/assist/portalRequestService', () => ({ listPortalRequests: f.requests }));
vi.mock('@/lib/portal/assist/portalBudgetService', () => ({ fetchPortalBudgetVisuals: f.budget }));
vi.mock('@/lib/portal/assist/portalServiceProofService', () => ({ countOpenPortalServiceProofs: f.proofs }));
vi.mock('@/lib/portal/portalClientCareService', () => ({ fetchPortalClientCareProfile: f.care }));
vi.mock('@/lib/portal/engine/fetchPortalWidgetData', () => ({ fetchPortalWidgetData: f.widgets }));
vi.mock('@/lib/portal/clientModuleAssignmentService', () => ({ fetchClientModuleAssignments: f.modules }));
vi.mock('@/lib/portal/clientPortalDisplayName', () => ({ fetchClientPortalDisplayName: async () => 'Synthetische Testperson' }));
vi.mock('@/lib/tenant/tenantDisplayName', () => ({ fetchTenantDisplayName: async () => 'Synthetischer Mandant' }));
import { fetchAssistDashboardData } from '@/lib/portal/assist/portalAssistDashboardService';
import { resolvePortalContext, resolvePortalContextFromData } from '@/lib/portal/engine/resolvePortalContext';
const { fetchClientPortalLiveMetrics } = await vi.importActual<typeof import('@/lib/portal/clientPortalDashboardLive')>('@/lib/portal/clientPortalDashboardLive');

const assignments = [{ moduleKey: 'assist' as const, isPrimary: true, isActive: true, assignedAt: '2026-01-01' }];
function scope(...capabilities: FamilyPortalCapability[]): FamilyPortalAccessScope {
  return { tenantId: 'tenant-a', accountId: 'account-a', clientId: 'client-a', relativeContactId: 'relative-a', validFrom: '2026-01-01T00:00:00.000000Z', expiresAt: null, source: 'authenticated_family_portal_scope', permissions: Object.fromEntries(capabilities.map(key => [key, true])) as FamilyPortalAccessScope['permissions'] };
}
function context(familyAccess: FamilyPortalAccessScope | null = null, roleKey: 'family_portal' | 'client_portal' = 'family_portal'): PortalContext {
  return resolvePortalContextFromData({ tenantId: 'tenant-a', clientId: 'client-a', roleKey, familyAccess, displayName: 'Synthetische Testperson', tenantName: 'Synthetischer Mandant', assignments });
}
beforeEach(() => {
  vi.clearAllMocks(); f.queries = [];
  f.metrics.mockResolvedValue({ upcomingAppointments: 2, documents: 3, openMessages: 1, totalVisits: 4 });
  f.activities.mockResolvedValue({ ok: true, data: [] }); f.requests.mockResolvedValue({ ok: true, data: [] });
  f.budget.mockResolvedValue({ ok: true, data: [{ id: 'entlastung', totalCents: 10000, usedCents: 1000, availableCents: 9000 }] });
  f.proofs.mockResolvedValue(2); f.care.mockResolvedValue({ careContexts: [], configuredBudgetTypes: [], hasBudgetSnapshot: false }); f.widgets.mockResolvedValue({}); f.modules.mockResolvedValue({ ok: true, data: assignments });
  f.client = { from(table: string) {
    const entry = { table, calls: [] as unknown[][] }; f.queries.push(entry);
    const result = () => ({ data: table === 'message_threads' ? [{ portal_unread_count: 1 }] : table === 'assignments' ? [{ id: 'visit-a', title: 'Einsatz', planned_start_at: '2026-11-01T12:00:00Z', planned_end_at: '2026-11-01T14:00:00Z', status: 'geplant' }] : [], count: 2, error: null });
    const query: any = { then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => Promise.resolve(result()).then(resolve, reject) };
    for (const method of ['select', 'eq', 'gte', 'in', 'not', 'neq', 'order', 'limit', 'range']) query[method] = (...args: unknown[]) => { entry.calls.push([method, ...args]); return query; };
    query.maybeSingle = async () => ({ data: { phone: '0511 000000' }, error: null });
    return query;
  } };
});
function privateCallsAbsent() {
  expect(f.activities).not.toHaveBeenCalled(); expect(f.requests).not.toHaveBeenCalled(); expect(f.budget).not.toHaveBeenCalled();
  expect(f.queries.some(query => query.table === 'clients' || query.table === 'cs_document_requests')).toBe(false);
}

describe('family home aggregation before transport', () => {
  it('does not turn missing family scope into a normal client grant', async () => {
    const result = await fetchAssistDashboardData(context()); expect(result.ok).toBe(true);
    expect(f.metrics).toHaveBeenCalledExactlyOnceWith('tenant-a', 'client-a', { appointments: false, documents: false, messages: false });
    expect(f.queries).toEqual([]); expect(f.proofs).not.toHaveBeenCalled(); privateCallsAbsent();
  });
  it('loads only explicitly allowed appointment data with exact tenant/client filters', async () => {
    const result = await fetchAssistDashboardData(context(scope('appointments')));
    expect(f.metrics).toHaveBeenCalledExactlyOnceWith('tenant-a', 'client-a', { appointments: true, documents: false, messages: false });
    expect(f.queries.map(query => query.table)).toEqual(['assignments', 'assist_visits']);
    for (const query of f.queries) { expect(query.calls).toContainEqual(['eq', 'tenant_id', 'tenant-a']); expect(query.calls).toContainEqual(['eq', 'client_id', 'client-a']); }
    expect(result.ok && result.data.nextAppointment?.id).toBe('visit-a'); privateCallsAbsent();
  });
  it('does not load budgets, activities, requests or signature tasks for a read-only document/message grant', async () => {
    const result = await fetchAssistDashboardData(context(scope('documents', 'messages')));
    expect(f.metrics).toHaveBeenCalledExactlyOnceWith('tenant-a', 'client-a', { appointments: false, documents: true, messages: true });
    expect(f.queries).toEqual([]); expect(f.proofs).not.toHaveBeenCalled(); privateCallsAbsent();
    expect(result.ok && result.data.budgetVisuals).toEqual([]); expect(result.ok && result.data.openRequests).toEqual([]); expect(result.ok && result.data.activities).toEqual([]);
  });
  it('permits released proof counts only through the service-record grant and bound identifiers', async () => {
    await fetchAssistDashboardData(context(scope('service_records')));
    expect(f.proofs).toHaveBeenCalledExactlyOnceWith('tenant-a', 'client-a'); privateCallsAbsent();
  });
  it.each(['tenantId', 'clientId'] as const)('denies a scope bound to another %s even when all flags are true', async field => {
    const access = { ...scope('appointments', 'documents', 'messages', 'service_records', 'sign_records'), [field]: 'foreign' };
    await fetchAssistDashboardData(context(access));
    expect(f.metrics).toHaveBeenCalledWith('tenant-a', 'client-a', { appointments: false, documents: false, messages: false }); expect(f.proofs).not.toHaveBeenCalled(); expect(f.queries).toEqual([]); privateCallsAbsent();
  });
  it('retains the ordinary client explanatory-budget contract and original scoped service arguments', async () => {
    const result = await fetchAssistDashboardData(context(null, 'client_portal'));
    expect(f.budget).toHaveBeenCalledExactlyOnceWith('tenant-a', 'client-a'); expect(f.activities).toHaveBeenCalledExactlyOnceWith('tenant-a', 'client-a', 8);
    expect(f.requests).toHaveBeenCalledWith('tenant-a', 'client-a', { status: ['offen', 'in_bearbeitung'], limit: 5 });
    expect(result.ok && result.data.budgetVisuals).toHaveLength(1); expect(result.ok && result.data.kpis.budgetAvailable).toBe(false);
  });
  it('does not invoke clinical profile or mixed widget loaders for a family context', async () => {
    const result = await resolvePortalContext({ tenantId: 'tenant-a', clientId: 'client-a', roleKey: 'family_portal', displayName: 'Testperson', familyAccess: scope('documents') });
    expect(f.care).not.toHaveBeenCalled(); expect(f.widgets).not.toHaveBeenCalled();
    expect(f.metrics).toHaveBeenCalledExactlyOnceWith('tenant-a', 'client-a', { appointments: false, documents: true, messages: false });
    expect(result.visibleFeatures.map(feature => feature.featureKey)).toEqual(['documents', 'hilfe']); expect(result.familyAccess?.accountId).toBe('account-a');
  });
});

describe('actual client metrics SQL builder', () => {
  it('does not build any table query for denied data categories', async () => {
    const result = await fetchClientPortalLiveMetrics('tenant-a', 'client-a', { appointments: false, documents: false, messages: false });
    expect(f.queries).toEqual([]); expect(result).toEqual({ upcomingAppointments: 0, totalVisits: 0, documents: 0, openMessages: 0 });
  });
  it.each(['appointments', 'documents', 'messages'] as const)('builds only %s queries, each bound to the permitted client and tenant', async feature => {
    const allowed = { appointments: false, documents: false, messages: false, [feature]: true };
    await fetchClientPortalLiveMetrics('tenant-a', 'client-a', allowed);
    expect(f.queries.map(query => query.table)).toEqual(feature === 'appointments' ? ['assignments', 'assist_visits'] : feature === 'documents' ? ['client_documents'] : ['message_threads']);
    for (const query of f.queries) { expect(query.calls).toContainEqual(['eq', 'tenant_id', 'tenant-a']); expect(query.calls).toContainEqual(['eq', 'client_id', 'client-a']); }
  });
  it('does not turn a missing client identity into tenant-wide counts', async () => {
    await fetchClientPortalLiveMetrics('tenant-a'); expect(f.queries).toEqual([]);
  });
});
