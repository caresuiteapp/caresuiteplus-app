import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchCareOperationalStats } from '@/lib/pflege/careDashboardOperationalService';
import { buildPflegeWorkspaceKpis } from '@/lib/pflege/pflegeDashboardWorkspace';
import { emptyPflegeDashboardStats } from '@/types/modules/pflege';
const mocks = vi.hoisted(() => ({ tours: vi.fn(), clients: vi.fn(), permission: vi.fn(), guard: vi.fn(), results: new Map<string, { count: number; error: unknown }>(), filters: [] as unknown[][] }));
vi.mock('@/lib/permissions', () => ({ hasPermission: mocks.permission }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: mocks.guard }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({}) }));
vi.mock('@/lib/supabase/errors', () => ({ toGermanSupabaseError: () => 'Datenbankfehler' }));
vi.mock('@/lib/pflege/careTourPlanningService', () => ({ fetchCareTours: mocks.tours }));
vi.mock('@/lib/careAssessment/careAssessmentService', () => ({ fetchEligibleCareClients: mocks.clients }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: (_client: unknown, table: string) => {
  const result = mocks.results.get(table) ?? { count: 3, error: null };
  const query = { select: () => query, eq: (key: string, value: unknown) => { mocks.filters.push([table, key, value]); return query; }, in: () => query, then: (resolve: (r: unknown) => void) => resolve(result) }; return query;
} }));
beforeEach(() => {
  mocks.results.clear(); mocks.filters.length = 0; mocks.permission.mockReturnValue(true); mocks.guard.mockReturnValue(null);
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date());
  mocks.tours.mockResolvedValue({ ok: true, data: [{ tourDate: today, status: 'in_progress', stops: [{ status: 'in_progress' }, { status: 'completed' }, { status: 'cancelled' }] }, { tourDate: today, status: 'cancelled', stops: [{ status: 'planned' }] }] });
  mocks.clients.mockResolvedValue({ ok: true, data: [{ id: 'one' }, { id: 'two' }] });
});
describe('Ambulante Startseite: echte Kennzahlen statt Platzhalter', () => {
  it('counts active stops today and clinical evidence', async () => {
    const result = await fetchCareOperationalStats('tenant', 'nurse'); expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.visitsToday).toBe(2); expect(result.data.runningNow).toBe(1); expect(result.data.openDocumentationCount).toBe(3); expect(result.data.assignedClientsCount).toBe(2);
    expect(mocks.filters).toContainEqual(['care_assessments', 'subject_type', 'client']);
  });
  it('distinguishes uncomputed medication/vital schedules from confirmed zero', async () => {
    mocks.results.set('clinical_handovers', { count: 0, error: null });
    const result = await fetchCareOperationalStats('tenant', 'nurse'); if (!result.ok) throw Error(result.error);
    const kpis = buildPflegeWorkspaceKpis({ ...emptyPflegeDashboardStats(), ...result.data });
    expect(kpis.find((k) => k.id === 'pflege-ws-kpi-medication')?.value).toBe('—');
    expect(kpis.find((k) => k.id === 'pflege-ws-kpi-handovers')?.value).toBe(0);
  });
  it('does not turn denied clinical access into reassuring zeros', async () => {
    mocks.permission.mockImplementation((_role, permission) => permission !== 'pflege.wounds.view');
    const result = await fetchCareOperationalStats('tenant', 'nurse'); if (!result.ok) throw Error(result.error);
    expect(result.data.unavailableKpiIds).toContain('pflege-ws-kpi-wounds');
  });
  it('surfaces database errors and stops before reads for foreign tenants', async () => {
    mocks.results.set('clinical_handovers', { count: 0, error: { code: '42P01' } });
    expect((await fetchCareOperationalStats('tenant', 'nurse')).ok).toBe(false);
    mocks.guard.mockReturnValue({ ok: false, error: 'Kein Mandantenzugriff' }); mocks.filters.length = 0;
    expect((await fetchCareOperationalStats('foreign', 'nurse')).ok).toBe(false); expect(mocks.filters).toHaveLength(0);
  });
});
