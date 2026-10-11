import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VisitCreateInput, VisitDispositionDetail } from '@/lib/assist/visitTypes';

const f = vi.hoisted(() => ({ records: [] as any[], resolve: (_table: string, _op: string): any => ({ data: null, error: null }), legacy: vi.fn(), taskMirror: vi.fn(), calendar: vi.fn(), release: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({}) }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: (_client: unknown, table: string) => {
  const record: any = { table, op: 'select', filters: [] }; f.records.push(record);
  const chain: any = { select: (value: string) => { record.select = value; return chain; }, insert: (payload: unknown) => { record.op = 'insert'; record.payload = payload; return chain; }, update: (payload: unknown) => { record.op = 'update'; record.payload = payload; return chain; }, delete: () => { record.op = 'delete'; return chain; }, eq: (...args: unknown[]) => { record.filters.push(args); return chain; }, single: () => Promise.resolve(f.resolve(table, record.op)), maybeSingle: () => Promise.resolve(f.resolve(table, record.op)), then: (resolve: any, reject: any) => Promise.resolve(f.resolve(table, record.op)).then(resolve, reject) }; return chain;
} }));
vi.mock('@/lib/calendar/calendarSyncService', () => ({ syncCalendarEvent: f.calendar, syncCalendarEventAsync: vi.fn(), buildCalendarEventFromVisitDetail: (value: unknown) => value, cancelCalendarEventBySourceAsync: vi.fn(), archiveCalendarEventBySource: vi.fn() }));
vi.mock('@/lib/assist/assistVisitLegacyAssignmentSync', () => ({ upsertLegacyAssignmentFromVisit: f.legacy, syncLegacyAssignmentTasksFromVisit: f.taskMirror, syncLegacyAssignmentStatusFromVisit: vi.fn() }));
vi.mock('@/lib/assist/assignmentBudgetAllocationService', () => ({ releaseAssignmentBudgetReservation: f.release, persistAssignmentBudgetAllocations: vi.fn(), reserveAssignmentBudget: vi.fn() }));
import { visitSupabaseRepository } from '@/lib/assist/repositories/visitRepository.supabase';

const id = '27be8d4e-e6e1-4b2a-bccb-918ade0ad1ab';
const input: VisitCreateInput = { clientId: 'client', employeeId: 'employee', serviceKey: 'assist', serviceName: 'Haushalt', title: 'Plan', assignmentDate: '2026-10-12', plannedStartAt: '2026-10-12T07:00:00Z', plannedEndAt: '2026-10-12T08:00:00Z', tasks: ['Einkauf'], portalReleaseEnabled: true, saveAsDraft: false };
const detail = { id, tenantId: 'tenant', clientId: input.clientId, employeeId: input.employeeId, assignmentDate: input.assignmentDate, scheduledStart: input.plannedStartAt, scheduledEnd: input.plannedEndAt, title: input.title, assignmentStatus: 'geplant', planningStatus: 'scheduled', portalStatus: 'scheduled', tasks: [{ id: 'task-old', title: 'Einkauf', status: 'open', isRequired: true, notDoneReason: null }], catalogSnapshotJson: {} } as unknown as VisitDispositionDetail;
beforeEach(() => {
  vi.clearAllMocks(); f.records = []; f.resolve = (table, op) => ({ data: table === 'assist_visits' && ['insert', 'update'].includes(op) ? { id } : null, error: null }); f.legacy.mockResolvedValue({ ok: true, data: null }); f.taskMirror.mockResolvedValue({ ok: true, data: null }); f.calendar.mockResolvedValue({ ok: true, data: null }); f.release.mockResolvedValue({ ok: true, data: null }); vi.spyOn(visitSupabaseRepository, 'getById').mockResolvedValue({ ok: true, data: detail });
});
afterEach(() => vi.restoreAllMocks());

describe('Planning repository confirms writes and awaited mirrors', () => {
  it.each(['legacy', 'taskMirror', 'calendar'] as const)('retains the saved ID on %s mirror rejection', async (operation) => {
    f[operation].mockResolvedValue({ ok: false, error: 'Mirror verweigert' });
    expect(await visitSupabaseRepository.create('tenant', input)).toMatchObject({ ok: false, persistedVisitId: id, error: expect.stringContaining('gespeichert') });
  });
  it('retains the saved ID on task insertion failure and stops later mirrors', async () => {
    f.resolve = (table, op) => ({ data: table === 'assist_visits' && op === 'insert' ? { id } : null, error: table === 'assist_visit_tasks' && op === 'insert' ? { message: 'Tasks verweigert' } : null });
    expect(await visitSupabaseRepository.create('tenant', input)).toMatchObject({ ok: false, persistedVisitId: id }); expect(f.legacy).not.toHaveBeenCalled();
  });
  it('retains the saved ID when a follow-up throws', async () => {
    f.legacy.mockRejectedValueOnce(new Error('Transport'));
    expect(await visitSupabaseRepository.create('tenant', input)).toMatchObject({ ok: false, persistedVisitId: id });
  });
  it('keeps a draft hidden in both audience flags and calendar projections', async () => {
    expect((await visitSupabaseRepository.create('tenant', { ...input, saveAsDraft: true })).ok).toBe(true);
    expect(f.records.find(r => r.table === 'assist_visits' && r.op === 'insert').payload).toMatchObject({ planning_status: 'draft', portal_status: 'hidden', portal_release_enabled: false, employee_portal_visible: false });
    expect(f.calendar).toHaveBeenCalledWith(expect.objectContaining({ portalReleaseEnabled: false, employeePortalVisible: false }));
  });
  it('rejects a zero-row update before modifying any tasks or mirrors', async () => {
    f.resolve = () => ({ data: null, error: null });
    expect(await visitSupabaseRepository.update('tenant', id, { ...input, tasks: ['Neu'] })).toMatchObject({ ok: false, error: expect.stringContaining('Zugriff') });
    expect(f.records.filter(r => r.table === 'assist_visit_tasks')).toHaveLength(0); expect(f.legacy).not.toHaveBeenCalled(); expect(f.calendar).not.toHaveBeenCalled();
    expect(f.records.find(r => r.op === 'update').filters).toEqual([['tenant_id', 'tenant'], ['id', id]]);
  });
  it('publishes an assigned draft with current employee and independent client visibility', async () => {
    vi.mocked(visitSupabaseRepository.getById).mockResolvedValue({ ok: true, data: { ...detail, planningStatus: 'draft', portalStatus: 'hidden' } });
    expect((await visitSupabaseRepository.update('tenant', id, { ...input, portalReleaseEnabled: false })).ok).toBe(true);
    expect(f.records.find(r => r.table === 'assist_visits' && r.op === 'update').payload).toMatchObject({ planning_status: 'scheduled', employee_portal_visible: true, portal_release_enabled: false, portal_status: 'hidden' });
    expect(f.calendar).toHaveBeenCalledWith(expect.objectContaining({ employeePortalVisible: true, portalReleaseEnabled: false }));
  });
  it('clears employee visibility when removing an assignment', async () => {
    expect((await visitSupabaseRepository.update('tenant', id, { ...input, employeeId: null })).ok).toBe(true);
    expect(f.records.find(r => r.table === 'assist_visits' && r.op === 'update').payload.employee_portal_visible).toBe(false);
  });
  it('reports a persisted update if its calendar projection fails', async () => {
    f.calendar.mockResolvedValue({ ok: false, error: 'Kalender gesperrt' });
    expect(await visitSupabaseRepository.update('tenant', id, input)).toMatchObject({ ok: false, persistedVisitId: id });
  });
  it('reports task follow-up failure and restores existing task identities, rather than inventing new rows', async () => {
    let inserts = 0; f.resolve = (table, op) => ({ data: table === 'assist_visits' && op === 'update' ? { id } : null, error: table === 'assist_visit_tasks' && op === 'insert' && ++inserts === 1 ? { message: 'Tasks fehlgeschlagen' } : null });
    expect(await visitSupabaseRepository.update('tenant', id, { ...input, tasks: ['Neu'] })).toMatchObject({ ok: false, persistedVisitId: id });
    const taskWrites = f.records.filter(r => r.table === 'assist_visit_tasks' && r.op === 'insert'); expect(taskWrites[1].payload[0]).toMatchObject({ id: 'task-old', title: 'Einkauf' }); expect(f.legacy).not.toHaveBeenCalled();
  });
});
