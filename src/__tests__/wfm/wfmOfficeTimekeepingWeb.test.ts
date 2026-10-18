import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WfmOfficeTimeEntry } from '@/types/modules/wfmOfficeTimekeeping';
import type { WfmTimeEvent } from '@/types/modules/wfm';
import { getWfmOfficeTimeOverview, reviewWfmOfficeTimeEntry, createWfmOfficeManualEntry } from '@/lib/wfm/wfmOfficeTimekeepingService.web';
import { officeReviewIdentity, officeVisitPauseMinutes } from '@/lib/wfm/wfmOfficeReviewIntegrity';
import { readStoredOfficeEntry, applyStoredOfficeEntry } from '@/lib/wfm/wfmOfficeStoredEntry.web';

const stubs = vi.hoisted(() => ({
  rpc: vi.fn(), single: vi.fn(), employees: vi.fn(), sessions: vi.fn(), reviews: vi.fn(), actions: vi.fn(), absences: vi.fn(), requests: vi.fn(),
}));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: () => null }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ rpc: stubs.rpc }) }));
vi.mock('@/lib/wfm/wfmOfficePlannedVisitRepository.web', () => ({
  listPlannedVisitsForPeriod: async () => ({ ok: true, data: [] }), fetchActiveEmployeeIds: async () => ({ ok: true, data: [employeeId] }),
}));
vi.mock('@/lib/wfm/wfmOfficeTimekeepingReads', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/wfm/wfmOfficeTimekeepingReads')>(),
  readOfficeEmployees: stubs.employees, readOfficeSessions: stubs.sessions, readOfficeReviews: stubs.reviews,
  readOfficeReviewActions: stubs.actions, readOfficeAbsences: stubs.absences, readOfficePendingRequestCount: stubs.requests,
}));

const tenantId = '11111111-1111-4111-8111-111111111111';
const employeeId = '22222222-2222-4222-8222-222222222222';
const sessionId = '33333333-3333-4333-8333-333333333333';
const revision = '2026-08-26T12:00:00.000Z';
function entry(overrides: Partial<WfmOfficeTimeEntry> = {}): WfmOfficeTimeEntry {
  return {
    id: `session:${sessionId}`, tenantId, employeeId, employeeName: 'Erika Muster', workDate: '2026-08-24', sessionId,
    assignmentId: null, visitId: null, clientLabel: null, plannedStartAt: null, plannedEndAt: null,
    actualStartAt: '2026-08-24T06:00:00.000Z', actualEndAt: '2026-08-24T11:00:00.000Z',
    startDeviationMinutes: null, endDeviationMinutes: null, startAmpel: null, endAmpel: null, overallAmpel: null,
    startJustification: null, endJustification: null, startJustificationAt: null, endJustificationAt: null,
    grossMinutes: 240, pauseMinutes: 30, netMinutes: 210, travelMinutes: null, workKind: 'buero',
    status: 'open', reviewStatus: 'open', source: 'portal', exportStatus: 'not_exported', officeComment: null,
    hasOpenOfficeMessage: false, flags: [], officeRevision: revision, ...overrides,
  };
}
function response(selected: WfmOfficeTimeEntry, overrides: Record<string, unknown> = {}) {
  const identity = officeReviewIdentity(selected);
  return {
    id: '44444444-4444-4444-8444-444444444444', tenant_id: tenantId, employee_id: employeeId,
    work_date: selected.workDate, entry_kind: identity.entryKind, reference_id: identity.referenceId, reference_key: identity.referenceKey,
    review_status: 'approved', export_status: 'export_ready', export_blocking: false, updated_at: '2026-08-26T12:01:00.000Z',
    metadata: { office_time_entry: selected }, ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  stubs.rpc.mockReturnValue({ single: stubs.single });
  stubs.single.mockResolvedValue({ data: response(entry()), error: null });
  stubs.employees.mockResolvedValue({ ok: true, data: [{ id: employeeId, tenant_id: tenantId, first_name: 'Erika', last_name: 'Muster', status: 'active' }] });
  for (const mock of [stubs.sessions, stubs.reviews, stubs.actions, stubs.absences]) mock.mockResolvedValue({ ok: true, data: [] });
  stubs.requests.mockResolvedValue({ ok: true, data: 0 });
});

describe('Office Web approval integrity', () => {
  it('preserves separate work blocks and sends the expected revision with a full actual snapshot', async () => {
    const selected = entry();
    const result = await reviewWfmOfficeTimeEntry(tenantId, 'actor', 'business_admin', selected.id, 'approved', undefined, selected);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.netMinutes).toBe(210);
    expect(stubs.rpc).toHaveBeenCalledWith('wfm_review_office_time_entry', expect.objectContaining({
      p_expected_updated_at: revision, p_employee_id: employeeId, p_office_entry: expect.objectContaining({ grossMinutes: 240, netMinutes: 210 }),
    }));
  });

  it('requires a context belonging to the selected tenant and entry', async () => {
    for (const selected of [entry({ tenantId: 'foreign' }), entry({ id: 'other' }), undefined]) {
      const result = await reviewWfmOfficeTimeEntry(tenantId, 'actor', 'business_admin', `session:${sessionId}`, 'approved', undefined, selected);
      expect(result.ok).toBe(false);
    }
    expect(stubs.rpc).not.toHaveBeenCalled();
  });

  it.each([
    { actualStartAt: null, actualEndAt: null, plannedStartAt: '2026-08-24T06:00:00Z', plannedEndAt: '2026-08-24T11:00:00Z' },
    { actualEndAt: null }, { actualEndAt: '2999-01-01T11:00:00Z' }, { pauseMinutes: 500 },
    { reviewStatus: 'locked' as const }, { exportStatus: 'exported' as const },
  ])('rejects unapprovable values before mutation: %j', async overrides => {
    const selected = entry(overrides);
    expect((await reviewWfmOfficeTimeEntry(tenantId, 'actor', 'business_admin', selected.id, 'approved', undefined, selected)).ok).toBe(false);
    expect(stubs.rpc).not.toHaveBeenCalled();
  });

  it('does not claim success when returned identity or saved values are incomplete', async () => {
    const selected = entry();
    for (const override of [{ work_date: '2026-08-25' }, { updated_at: null }, { metadata: {} }, { reference_id: 'foreign' }]) {
      stubs.single.mockResolvedValueOnce({ data: response(selected, override), error: null });
      expect((await reviewWfmOfficeTimeEntry(tenantId, 'actor', 'business_admin', selected.id, 'approved', undefined, selected)).ok).toBe(false);
    }
  });

  it.each(['40001', 'PGRST202'])('reports revision/unavailable RPC errors without a legacy write fallback (%s)', async code => {
    stubs.single.mockResolvedValue({ data: null, error: { code, message: 'failure' } });
    const selected = entry();
    expect((await reviewWfmOfficeTimeEntry(tenantId, 'actor', 'business_admin', selected.id, 'approved', undefined, selected)).ok).toBe(false);
    expect(stubs.rpc).toHaveBeenCalledTimes(1);
  });

  it('persists assignment actual values on approval instead of leaving an empty booking', async () => {
    const selected = entry({ id: `planned:${sessionId}:2026-08-24`, sessionId: null, visitId: sessionId, assignmentId: sessionId,
      actualStartAt: null, actualEndAt: null, assignmentActualStartAt: '2026-08-24T06:00:00.000Z', assignmentActualEndAt: '2026-08-24T07:00:00.000Z',
      rowKind: 'planned_missing_actual', grossMinutes: 0, netMinutes: 0, pauseMinutes: 0, source: 'system' });
    const saved = { ...selected, actualStartAt: selected.assignmentActualStartAt!, actualEndAt: selected.assignmentActualEndAt!, grossMinutes: 60, netMinutes: 60, source: 'correction' as const };
    stubs.single.mockResolvedValue({ data: response(saved), error: null });
    const result = await reviewWfmOfficeTimeEntry(tenantId, 'actor', 'business_admin', selected.id, 'approved', undefined, selected);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.netMinutes).toBe(60);
  });
});

describe('Office Web complete overview reads', () => {
  it.each(['employees', 'sessions', 'reviews', 'actions', 'absences', 'requests'] as const)('propagates a required %s failure rather than returning partial totals', async name => {
    stubs[name].mockResolvedValue({ ok: false, error: 'Lesen fehlgeschlagen' });
    const result = await getWfmOfficeTimeOverview(tenantId, 'business_admin', { preset: 'custom', fromDate: '2026-08-24', toDate: '2026-08-24' });
    expect(result).toEqual({ ok: false, error: 'Lesen fehlgeschlagen' });
  });
});

describe('Office saved snapshot and identity', () => {
  it('deducts each pause only from the visit it overlaps', () => {
    const events = [
      { eventType: 'pause_start', occurredAt: '2026-08-24T08:20:00Z' },
      { eventType: 'pause_end', occurredAt: '2026-08-24T08:40:00Z' },
      { eventType: 'pause_start', occurredAt: '2026-08-24T11:00:00Z' },
      { eventType: 'pause_end', occurredAt: '2026-08-24T11:30:00Z' },
    ] as WfmTimeEvent[];
    expect(officeVisitPauseMinutes(events, '2026-08-24T08:00:00Z', '2026-08-24T09:00:00Z')).toBe(20);
    expect(officeVisitPauseMinutes(events, '2026-08-24T10:00:00Z', '2026-08-24T11:00:00Z')).toBe(0);
    expect(officeVisitPauseMinutes(events, '2026-08-24T08:30:00Z', '2026-08-24T09:00:00Z')).toBe(10);
  });
  it('reads and reapplies recorded totals without filling an unpaid gap', () => {
    const selected = entry();
    const stored = readStoredOfficeEntry(selected, tenantId, employeeId, selected.workDate);
    expect(stored?.netMinutes).toBe(210);
    expect(applyStoredOfficeEntry(entry({ grossMinutes: 300, netMinutes: 270 }), stored).netMinutes).toBe(210);
  });
  it('keeps virtual recurrence references separated by the actual work date', () => {
    const selected = entry({ id: `planned:${sessionId}::2026-08-25:2026-08-25`, visitId: `${sessionId}::2026-08-25`, sessionId: null, workDate: '2026-08-25' });
    expect(officeReviewIdentity(selected).workDate).toBe('2026-08-25');
    expect(officeReviewIdentity(selected).rawReferenceId).toBe(`${sessionId}::2026-08-25`);
    expect(officeReviewIdentity(selected).referenceKey).toContain(':2026-08-25:visit:');
  });
  it('rejects a future or wrong-day manual addition before any write', async () => {
    const input = { employeeId, workDate: '2026-08-24', actualStartAt: '2026-08-25T06:00:00Z', actualEndAt: '2026-08-25T07:00:00Z', pauseMinutes: 0, reason: 'Nachtrag', workKind: 'buero' as const };
    expect((await createWfmOfficeManualEntry(tenantId, 'actor', 'business_admin', input)).ok).toBe(false);
    expect((await createWfmOfficeManualEntry(tenantId, 'actor', 'business_admin', { ...input, actualStartAt: '2999-01-01T06:00:00Z', actualEndAt: '2999-01-01T07:00:00Z', workDate: '2999-01-01' })).ok).toBe(false);
    expect(stubs.rpc).not.toHaveBeenCalled();
  });
});
