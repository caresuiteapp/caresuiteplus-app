import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import type { VisitCreateInput, VisitDispositionDetail } from '@/lib/assist/visitTypes';

const f = vi.hoisted(() => ({
  writes: [] as { table: string; operation: string; payload: Record<string, unknown> }[],
  legacy: vi.fn(), statusMirror: vi.fn(), taskMirror: vi.fn(), calendar: vi.fn(),
}));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({}) }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: (_client: unknown, table: string) => {
  let payload: Record<string, unknown> = {};
  const response = () => ({ data: { id: 'visit', canonical_status: payload.canonical_status }, error: null });
  const chain = {
    update(value: Record<string, unknown>) { payload = value; f.writes.push({ table, operation: 'update', payload }); return chain; },
    insert(value: Record<string, unknown>) { payload = value; f.writes.push({ table, operation: 'insert', payload }); return chain; },
    eq() { return chain; }, select() { return chain; },
    maybeSingle: async () => response(),
    then(resolve: (value: ReturnType<typeof response>) => unknown) { return Promise.resolve(response()).then(resolve); },
  };
  return chain;
} }));
vi.mock('@/lib/assist/assistVisitLegacyAssignmentSync', () => ({
  upsertLegacyAssignmentFromVisit: f.legacy,
  syncLegacyAssignmentStatusFromVisit: f.statusMirror,
  syncLegacyAssignmentTasksFromVisit: f.taskMirror,
}));
vi.mock('@/lib/calendar/calendarSyncService', () => ({
  buildCalendarEventFromVisitDetail: (value: unknown) => value,
  syncCalendarEvent: f.calendar, syncCalendarEventAsync: vi.fn(),
  cancelCalendarEventBySourceAsync: vi.fn(), archiveCalendarEventBySource: vi.fn(),
}));
vi.mock('@/lib/assist/clientBudgetTransactionService', () => ({ markAssignmentExecuted: vi.fn(), storno: vi.fn() }));
vi.mock('@/lib/assist/assignmentBudgetAllocationService', () => ({
  releaseAssignmentBudgetReservation: vi.fn(), persistAssignmentBudgetAllocations: vi.fn(), reserveAssignmentBudget: vi.fn(),
}));
import { visitSupabaseRepository } from '@/lib/assist/repositories/visitRepository.supabase';

const input: VisitCreateInput = {
  clientId: 'client', employeeId: 'employee', serviceKey: 'assist', serviceName: 'Betreuung', title: 'Plan',
  assignmentDate: '2026-10-27', plannedStartAt: '2026-10-27T10:30:00Z', plannedEndAt: '2026-10-27T12:30:00Z',
  tasks: ['Betreuung'], portalReleaseEnabled: false, saveAsDraft: false,
};
const detail = {
  id: 'visit', tenantId: 'tenant', clientId: input.clientId, employeeId: input.employeeId,
  assignmentDate: input.assignmentDate, scheduledStart: input.plannedStartAt, scheduledEnd: input.plannedEndAt,
  title: input.title, assignmentStatus: 'geplant', planningStatus: 'scheduled', portalStatus: 'hidden',
  employeePortalVisible: true, portalReleaseEnabled: false,
  tasks: [{ id: 'task', title: 'Betreuung', status: 'open', isRequired: true, notDoneReason: null }],
  catalogSnapshotJson: {},
} as VisitDispositionDetail;

beforeEach(() => {
  vi.clearAllMocks(); f.writes = [];
  for (const operation of [f.legacy, f.statusMirror, f.taskMirror, f.calendar]) operation.mockResolvedValue({ ok: true, data: null });
  vi.spyOn(visitSupabaseRepository, 'getById').mockResolvedValue({ ok: true, data: detail });
});
afterEach(() => vi.restoreAllMocks());

function expectNoMutation() {
  expect(f.writes).toEqual([]);
  expect(f.legacy).not.toHaveBeenCalled();
  expect(f.statusMirror).not.toHaveBeenCalled();
  expect(f.taskMirror).not.toHaveBeenCalled();
  expect(f.calendar).not.toHaveBeenCalled();
}

describe('employee portal publication boundaries', () => {
  it.each(['scheduled', 'confirmed', 'at_risk'] as const)('keeps a published %s plan visible when saving as draft is requested', async (planningStatus) => {
    vi.mocked(visitSupabaseRepository.getById).mockResolvedValue({ ok: true, data: { ...detail, planningStatus } });
    const result = await visitSupabaseRepository.update('tenant', 'visit', { ...input, saveAsDraft: true, tasks: ['Geändert'] });
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('umplanen oder absagen') });
    expectNoMutation();
  });

  it.each<AssignmentStatus>(['bestaetigt', 'unterwegs', 'angekommen', 'gestartet', 'pausiert', 'beendet', 'dokumentation_offen', 'unterschrift_offen', 'abgeschlossen', 'nicht_erschienen'])('does not turn a private draft into hidden %s assignment', async (status) => {
    vi.mocked(visitSupabaseRepository.getById).mockResolvedValue({ ok: true, data: { ...detail, planningStatus: 'draft', employeePortalVisible: false } });
    const result = await visitSupabaseRepository.updateAssignmentStatus('tenant', 'visit', status);
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('zuerst über „Bearbeiten“ freigeben') });
    expectNoMutation();
  });

  it('still permits editing an existing private draft without making it visible', async () => {
    vi.mocked(visitSupabaseRepository.getById).mockResolvedValue({ ok: true, data: { ...detail, planningStatus: 'draft', employeePortalVisible: false } });
    expect((await visitSupabaseRepository.update('tenant', 'visit', { ...input, saveAsDraft: true })).ok).toBe(true);
    expect(f.writes.find(write => write.table === 'assist_visits')?.payload).toMatchObject({ planning_status: 'draft', employee_portal_visible: false, portal_release_enabled: false });
    expect(f.calendar).toHaveBeenCalledWith(expect.objectContaining({ employeePortalVisible: false, portalReleaseEnabled: false }));
  });

  it('preserves explicit publication through the ordinary edit flow', async () => {
    vi.mocked(visitSupabaseRepository.getById).mockResolvedValue({ ok: true, data: { ...detail, planningStatus: 'draft', employeePortalVisible: false } });
    expect((await visitSupabaseRepository.update('tenant', 'visit', input)).ok).toBe(true);
    expect(f.writes.find(write => write.table === 'assist_visits')?.payload).toMatchObject({ planning_status: 'scheduled', employee_portal_visible: true, portal_release_enabled: false });
    expect(f.legacy).toHaveBeenCalledOnce();
    expect(f.calendar).toHaveBeenCalledWith(expect.objectContaining({ employeePortalVisible: true, portalReleaseEnabled: false }));
  });

  it('still confirms an already published plan and updates its assignment mirror', async () => {
    expect((await visitSupabaseRepository.updateAssignmentStatus('tenant', 'visit', 'bestaetigt')).ok).toBe(true);
    expect(f.writes.find(write => write.table === 'assist_visits')?.payload).toMatchObject({ canonical_status: 'confirmed' });
    expect(f.statusMirror).toHaveBeenCalledOnce();
  });

  it('keeps the draft untouched when its current state cannot be read', async () => {
    vi.mocked(visitSupabaseRepository.getById).mockResolvedValue({ ok: false, error: 'Zugriff fehlgeschlagen' });
    expect(await visitSupabaseRepository.updateAssignmentStatus('tenant', 'visit', 'bestaetigt')).toEqual({ ok: false, error: 'Zugriff fehlgeschlagen' });
    expectNoMutation();
  });
});
