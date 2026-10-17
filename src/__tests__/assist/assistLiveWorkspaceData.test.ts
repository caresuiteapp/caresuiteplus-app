import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VisitDispositionListItem } from '@/lib/assist/visitTypes';
import type { AssistLiveWorkspaceRow } from '@/features/assistLive/getAssistLiveMonitoringWorkspace';
const f = vi.hoisted(() => ({ list: vi.fn(), repositoryList: vi.fn(), active: vi.fn(), latest: vi.fn(), points: vi.fn(), times: vi.fn(), consent: vi.fn(), permission: vi.fn(), client: true }));
vi.mock('@/lib/assist/repositories/visitRepository.supabase', () => ({ visitSupabaseRepository: { list: f.repositoryList } }));
vi.mock('@/lib/assist/visitService', () => ({ fetchVisitDispositionList: f.list }));
vi.mock('@/lib/assist/assistTrackingPersistenceService', () => ({ fetchActiveTrackingSession: f.active, fetchLatestTrackingSessionWithConsent: f.latest, fetchLocationPointsForVisit: f.points, fetchTimeEventsForVisit: f.times }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: () => { const chain = { select: () => chain, eq: () => chain, maybeSingle: f.consent }; return chain; } }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => f.client ? {} : null }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: () => null }));
vi.mock('@/lib/permissions', () => ({ enforcePermission: f.permission }));
vi.mock('@/features/liveTracking/reconcileAssistLiveRouteGaps', () => ({ reconcileAssistLiveRouteGaps: async () => ({ resolvedGapCount: 0, unresolvedGapCount: 1, googleGapDistanceKm: 0 }) }));
import { getAssistLiveMonitoringWorkspace, isFreshLivePosition, isVisitInLiveDay, liveMonitoringDayKey, buildLiveWorkspaceOverview } from '@/features/assistLive/getAssistLiveMonitoringWorkspace';
const now = new Date('2026-10-17T08:05:00Z');
const visit = (id = 'visit-a', patch: Partial<VisitDispositionListItem> = {}): VisitDispositionListItem => ({
  id, tenantId: 'tenant-a', title: 'Betreuung', clientId: 'client-a', clientName: 'Testklient', employeeId: 'employee-a', employeeName: 'Testperson',
  scheduledStart: '2026-10-17T08:00:00Z', scheduledEnd: '2026-10-17T09:00:00Z', assignmentStatus: 'gestartet', actualStartAt: '2026-10-17T08:00:00Z',
  proofStatus: 'none', documentationStatus: 'none', isAtRisk: false, ...patch,
} as VisitDispositionListItem);
const session = { id: 'session-a', tenantId: 'tenant-a', visitId: 'visit-a', employeeId: 'employee-a', isActive: true, consentGrantedAt: '2026-10-17T07:00:00Z', consentExplainedAt: null, updatedAt: '2026-10-17T08:04:50Z', metadata: {} };
const point = { tenantId: 'tenant-a', visitId: 'visit-a', latitude: 51.5, longitude: 7.2, accuracyMeters: 8, recordedAt: '2026-10-17T08:04:50Z', sessionId: 'session-a' };
async function loaded() { const result = await getAssistLiveMonitoringWorkspace('tenant-a', 'business_admin', now); if (!result.ok) throw new Error(result.error); return result.data; }
beforeEach(() => { vi.clearAllMocks(); f.client = true; f.permission.mockReturnValue(null); f.list.mockResolvedValue({ ok: true, data: [visit()] }); f.repositoryList.mockResolvedValue({ ok: true, data: [visit()] }); f.active.mockResolvedValue({ ok: true, data: session }); f.latest.mockResolvedValue({ ok: true, data: session }); f.points.mockResolvedValue({ ok: true, data: [point] }); f.times.mockResolvedValue({ ok: true, data: [{ eventType: 'service_start', occurredAt: '2026-10-17T08:00:00Z' }] }); f.consent.mockResolvedValue({ data: null, error: null }); });
afterEach(() => vi.useRealTimers());

describe('Web live monitoring data truth', () => {
  it('loads read-only persisted tracking and derives timers from the same visit', async () => {
    const data = await loaded(); expect(data.rows).toHaveLength(1); expect(data.rows[0].tracking?.timers.serviceSeconds).toBe(300);
    expect(data.mapMarkers).toHaveLength(1); expect(data.freshGpsCount).toBe(1); expect(data.partialData).toBe(false);
    expect(f.points).toHaveBeenCalledWith('tenant-a', 'visit-a', 'session-a');
    expect(data.generatedAt).toBe(now.toISOString());
  });
  it('aligns all running timers with generatedAt after slower team queries finish', async () => {
    vi.useFakeTimers(); vi.setSystemTime(now);
    f.list.mockResolvedValue({ ok: true, data: [visit(), visit('visit-b')] });
    let release!: (value: unknown) => void;
    const slower = new Promise(resolve => { release = resolve; });
    f.times.mockImplementation((_tenant: string, visitId: string) => visitId === 'visit-b' ? slower : Promise.resolve({ ok: true, data: [{ eventType: 'service_start', occurredAt: '2026-10-17T08:00:00Z' }] }));
    const read = getAssistLiveMonitoringWorkspace('tenant-a', 'business_admin');
    // Finish all immediately available reads while the second member is waiting.
    for (let index = 0; index < 30; index++) await Promise.resolve();
    vi.setSystemTime(new Date('2026-10-17T08:05:20Z'));
    release({ ok: true, data: [] });
    const result = await read;
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.generatedAt).toBe('2026-10-17T08:05:20.000Z');
    expect(result.data.rows.find(row => row.assignmentId === 'visit-a')?.tracking?.timers.serviceSeconds).toBe(320);
  });
  it('honours an explicit consent withdrawal even when a historical session granted consent', async () => {
    f.consent.mockResolvedValue({ data: { consent_granted_at: '2026-10-16T08:00:00Z', revoked_at: '2026-10-17T08:02:00Z' }, error: null });
    const data = await loaded(); expect(data.rows[0].tracking?.consent.granted).toBe(false); expect(data.rows[0].tracking?.lastPosition).toBeNull(); expect(data.rows[0].route).toBeNull(); expect(data.mapMarkers).toEqual([]);
  });
  it.each([{ employeeId: 'previous-employee' }, { employeeId: null }, { tenantId: 'other-tenant' }, { visitId: 'other-visit' }])('does not attribute a mismatched session to the current employee: %o', async patch => {
    const otherSession = { ...session, ...patch };
    f.active.mockResolvedValue({ ok: true, data: otherSession }); f.latest.mockResolvedValue({ ok: true, data: otherSession });
    f.consent.mockResolvedValue({ data: { consent_granted_at: '2026-10-17T07:00:00Z', revoked_at: null }, error: null });
    const data = await loaded();
    expect(data.rows[0].tracking?.lastPosition).toBeNull(); expect(data.rows[0].tracking?.trackingActive).toBe(false);
    expect(data.rows[0].tracking?.googleRouteReference).toBeNull(); expect(data.rows[0].route).toBeNull();
    expect(data.rows[0].tracking?.timers.serviceSeconds).toBe(300); expect(data.partialData).toBe(true); expect(data.mapMarkers).toEqual([]);
    expect(f.points).not.toHaveBeenCalled();
  });
  it('discards foreign visit, tenant and session points without plotting them', async () => {
    f.points.mockResolvedValue({ ok: true, data: [{ ...point, tenantId: 'other-tenant' }, { ...point, visitId: 'other-visit' }, { ...point, sessionId: 'other-session' }] });
    const data = await loaded(); expect(data.rows[0].tracking?.lastPosition).toBeNull(); expect(data.rows[0].route).toBeNull(); expect(data.mapMarkers).toEqual([]); expect(data.partialData).toBe(true);
  });
  it('includes invalid GPS points in the visible discarded-point count', async () => {
    f.points.mockResolvedValue({ ok: true, data: [point, { ...point, latitude: 95 }] });
    const data = await loaded(); expect(data.rows[0].route?.acceptedPointCount).toBe(1); expect(data.rows[0].route?.discardedPointCount).toBe(1);
  });
  it('does not infer current permission from a historical session after a failed consent read', async () => {
    f.consent.mockResolvedValue({ data: null, error: { message: 'Zugriff fehlt' } });
    const data = await loaded(); expect(data.partialData).toBe(true); expect(data.rows[0].tracking?.consent.granted).toBe(false); expect(data.rows[0].tracking?.lastPosition).toBeNull(); expect(data.mapMarkers).toEqual([]);
  });
  it('retains the visit but marks a tracking read failure as incomplete', async () => {
    f.active.mockResolvedValue({ ok: false, error: 'Verbindung fehlgeschlagen' });
    const data = await loaded(); expect(data.rows).toHaveLength(1); expect(data.rows[0].tracking).toBeNull(); expect(data.rows[0].trackingError).toContain('Tracking-Sitzungen');
    expect(data.partialData).toBe(true); expect(data.mapMarkers).toEqual([]); expect(data.activeTrackingCount).toBe(0);
  });
  it('treats a missing table and thrown request as failed reads, not successful emptiness', async () => {
    f.times.mockResolvedValue({ ok: true, data: [], tableMissing: true }); expect((await loaded()).partialData).toBe(true);
    f.times.mockRejectedValue(new Error('Offline')); expect((await loaded()).rows[0].trackingError).toContain('Einsatzzeiten');
  });
  it('keeps confirmed time data when location loading fails and exposes the warning', async () => {
    f.points.mockResolvedValue({ ok: false, error: 'Standorte fehlen' }); const data = await loaded();
    expect(data.rows[0].tracking?.timers.serviceSeconds).toBe(300); expect(data.rows[0].trackingError).toContain('Standortdaten'); expect(data.partialData).toBe(true);
  });
  it('does not promote historical positions or ended tracking into live markers', async () => {
    f.active.mockResolvedValue({ ok: true, data: null }); const data = await loaded(); expect(data.rows[0].route?.points).toHaveLength(1);
    expect(data.mapMarkers).toEqual([]); expect(data.activeTrackingCount).toBe(0);
  });
  it('does not attach a series master tracking session to a virtual occurrence', async () => {
    f.list.mockResolvedValue({ ok: true, data: [visit('00000000-0000-4000-8000-000000000001::2026-10-17')] });
    const data = await loaded(); expect(data.rows[0].tracking).toBeNull(); expect(f.active).not.toHaveBeenCalled(); expect(f.points).not.toHaveBeenCalled();
  });
  it('reuses one employee consent read and excludes a foreign tenant before enrichment', async () => {
    f.list.mockResolvedValue({ ok: true, data: [visit('a'), visit('b'), visit('c', { tenantId: 'tenant-b' })] });
    const data = await loaded(); expect(data.rows).toHaveLength(2); expect(f.consent).toHaveBeenCalledTimes(1); expect(f.active).toHaveBeenCalledTimes(2);
  });
  it('does not substitute demo data when the live client or permission is absent', async () => {
    f.client = false; expect((await getAssistLiveMonitoringWorkspace('tenant-a', 'business_admin', now)).ok).toBe(false); expect(f.list).not.toHaveBeenCalled();
    f.client = true; f.permission.mockReturnValue({ ok: false, error: 'Kein Zugriff' }); expect((await getAssistLiveMonitoringWorkspace('tenant-a', 'client_portal', now)).ok).toBe(false); expect(f.list).not.toHaveBeenCalled();
  });
  it('passes effective rights through enforcement and uses the tenant-scoped repository', async () => {
    const permissions = ['assist.assignments.view'] as const;
    const data = await getAssistLiveMonitoringWorkspace('tenant-a', 'billing', now, permissions);
    expect(data.ok).toBe(true); expect(f.permission).toHaveBeenCalledWith('billing', 'assist.assignments.view', { effectivePermissions: permissions });
    expect(f.repositoryList).toHaveBeenCalledWith('tenant-a'); expect(f.list).not.toHaveBeenCalled();
  });
  it('rejects future, invalid and inaccurate positions and expires live GPS without fetching', async () => {
    const data = await loaded(); const row = data.rows[0]; expect(isFreshLivePosition(row, now.getTime() + 40_000)).toBe(false);
    const changed = (patch: object): AssistLiveWorkspaceRow => ({ ...row, tracking: { ...row.tracking!, lastPosition: { ...row.tracking!.lastPosition!, ...patch } } });
    for (const patch of [{ capturedAt: '2026-10-17T08:06:00Z' }, { capturedAt: 'invalid' }, { latitude: 95 }, { longitude: NaN }, { accuracyMeters: 500 }, { accuracyMeters: -2 }]) expect(isFreshLivePosition(changed(patch), now.getTime())).toBe(false);
    expect(buildLiveWorkspaceOverview([row], data.generatedAt, now.getTime() + 40_000).freshGpsCount).toBe(0);
    expect(isFreshLivePosition({ ...row, tracking: { ...row.tracking!, deviceHeartbeatAt: '2026-10-17T08:06:00Z' } }, now.getTime())).toBe(false);
  });
});
describe('Berlin live day boundary', () => {
  it('uses Berlin instead of server/browser timezone and retains overnight work', () => {
    const midnight = new Date('2026-10-17T22:15:00Z'); expect(liveMonitoringDayKey(midnight)).toBe('2026-10-18');
    expect(isVisitInLiveDay(visit('overnight', { scheduledStart: '2026-10-17T21:00:00Z', scheduledEnd: '2026-10-17T23:00:00Z' }), midnight)).toBe(true);
    expect(isVisitInLiveDay(visit('ongoing', { scheduledStart: '2026-10-16T12:00:00Z', scheduledEnd: '2026-10-16T13:00:00Z' }), midnight)).toBe(true);
    expect(isVisitInLiveDay(visit('done', { assignmentStatus: 'abgeschlossen' }), midnight)).toBe(false);
  });
  it('excludes an event ending exactly at midnight and handles DST dates', () => {
    const midnight = new Date('2026-10-17T22:00:00Z');
    expect(isVisitInLiveDay(visit('done', { scheduledEnd: '2026-10-17T22:00:00Z', assignmentStatus: 'abgeschlossen' }), midnight)).toBe(false);
    expect(liveMonitoringDayKey('2026-03-29T22:30:00Z')).toBe('2026-03-30'); expect(liveMonitoringDayKey('2026-10-25T23:30:00Z')).toBe('2026-10-26');
  });
});
