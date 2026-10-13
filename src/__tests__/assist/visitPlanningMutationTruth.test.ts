import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VisitCreateWizardData, VisitDispositionDetail } from '@/lib/assist/visitTypes';
import { EMPTY_VISIT_WIZARD_DATA } from '@/lib/assist/visitTypes';
import { mapVisitDetailToEditForm } from '@/lib/assist/visitEditMappers';
import { buildPlannedTimestamps, validateAssignmentCreateForm } from '@/lib/assist/assignmentProductionValidation';

const repo = vi.hoisted(() => ({ getById: vi.fn(), resolveVisitId: vi.fn(), create: vi.fn(), update: vi.fn(), updateAssignmentStatus: vi.fn(), materializeOccurrence: vi.fn(), listSeriesOccurrences: vi.fn(), listPlanningConflictCandidates: vi.fn() }));
vi.mock('@/lib/assist/repositories/visitRepository.supabase', () => ({ visitSupabaseRepository: repo }));
vi.mock('@/lib/assist/overlayVisitDispositionFromAssignment', () => ({ overlayVisitDispositionDetailFromAssignment: async (_tenant: string, data: unknown) => data }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/permissions', () => ({ enforcePermission: () => null }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: () => null }));
import { createVisitFromWizard, updateVisitFromWizard } from '@/lib/assist/visitService';

const masterId = '27be8d4e-e6e1-4b2a-bccb-918ade0ad1ab';
const childId = 'a264ad19-8c79-4350-a11b-6d71c7605515';
const visit = (id = masterId) => ({ id, tenantId: 'tenant', clientId: 'client', employeeId: 'employee', title: 'Haushalt', serviceName: 'Betreuung', assignmentDate: '2026-10-12', scheduledStart: '2026-10-12T07:00:00Z', scheduledEnd: '2026-10-12T08:00:00Z', assignmentStatus: 'geplant', planningStatus: 'scheduled', executionStatus: 'pending', documentationStatus: 'none', proofStatus: 'none', billingStatus: 'none', tasks: [{ id: 'task', title: 'Einkauf', status: 'open', isRequired: true, notDoneReason: null }], recurrenceJson: { pattern: 'none' } }) as unknown as VisitDispositionDetail;
const wizard = (): VisitCreateWizardData => ({ ...EMPTY_VISIT_WIZARD_DATA, clientId: 'client', employeeId: 'employee', title: 'Haushalt', tasks: ['Einkauf'], assignmentDate: '2026-10-12', plannedStartTime: '09:00', plannedEndTime: '10:00', saveAsDraft: true, recurrencePattern: 'weekly', recurrenceWeekdays: ['mo'], recurrenceOccurrenceCount: 3 });
beforeEach(() => {
  repo.listPlanningConflictCandidates.mockResolvedValue({ ok: true, data: [] });
  vi.clearAllMocks(); repo.getById.mockResolvedValue({ ok: true, data: visit() }); repo.resolveVisitId.mockResolvedValue(masterId); repo.create.mockResolvedValue({ ok: true, data: { id: masterId } }); repo.update.mockResolvedValue({ ok: true, data: visit() }); repo.updateAssignmentStatus.mockResolvedValue({ ok: true, data: visit() }); repo.materializeOccurrence.mockResolvedValue({ ok: true, data: { id: childId, materialized: true } });
});

describe('Planning service persisted identity and series boundaries', () => {
  it('preserves the master identity if a following occurrence write fails', async () => {
    repo.materializeOccurrence.mockResolvedValueOnce({ ok: false, error: 'Serie nicht verfügbar' });
    expect(await createVisitFromWizard('tenant', wizard(), 'business_admin')).toMatchObject({ ok: false, persistedVisitId: masterId, error: expect.stringContaining('gespeichert') });
    expect(repo.create).toHaveBeenCalledOnce();
  });
  it('also preserves that identity if the series follow-up throws', async () => {
    repo.materializeOccurrence.mockRejectedValueOnce(new Error('Transport'));
    expect(await createVisitFromWizard('tenant', wizard(), 'business_admin')).toMatchObject({ ok: false, persistedVisitId: masterId });
  });
  it('materializes a virtual single occurrence and writes its real child instead of the master', async () => {
    const child = { ...visit(childId), assignmentDate: '2026-10-19', recurrenceJson: { pattern: 'none', parentSeriesId: masterId, sourceOccurrenceDate: '2026-10-19' } };
    repo.getById.mockImplementation(async (_tenant, id) => ({ ok: true, data: id === childId ? child : { ...visit(), recurrenceJson: { pattern: 'weekly', weekdays: ['mo'], occurrenceCount: 3 } } }));
    const form = mapVisitDetailToEditForm(child); form.title = 'Nur dieser';
    expect(await updateVisitFromWizard('tenant', `${masterId}::2026-10-19`, form, 'business_admin')).toEqual({ ok: true, data: { id: childId } });
    expect(repo.materializeOccurrence).toHaveBeenCalledWith('tenant', masterId, '2026-10-19');
    expect(repo.update).toHaveBeenCalledWith('tenant', childId, expect.objectContaining({ title: 'Nur dieser', recurrenceJson: expect.objectContaining({ parentSeriesId: masterId }) }));
  });
  it('reports a saved edit if the subsequent status write is rejected or throws', async () => {
    const form = { ...mapVisitDetailToEditForm(visit()), assignmentStatus: 'bestaetigt' as const };
    repo.updateAssignmentStatus.mockResolvedValueOnce({ ok: false, error: 'Status gesperrt' }).mockRejectedValueOnce(new Error('Status Transport'));
    expect(await updateVisitFromWizard('tenant', masterId, form, 'business_admin')).toMatchObject({ ok: false, persistedVisitId: masterId });
    expect(await updateVisitFromWizard('tenant', masterId, form, 'business_admin')).toMatchObject({ ok: false, persistedVisitId: masterId });
  });
  it('reports partial series edits and does not replay old form/status snapshots as a fake transaction rollback', async () => {
    const master = { ...visit(), recurrenceJson: { pattern: 'weekly', weekdays: ['mo'], occurrenceCount: 3 } };
    const next = { ...visit(childId), assignmentDate: '2026-10-19', scheduledStart: '2026-10-19T07:00:00Z', recurrenceJson: { pattern: 'none', parentSeriesId: masterId, sourceOccurrenceDate: '2026-10-19' } };
    repo.getById.mockResolvedValue({ ok: true, data: master }); repo.listSeriesOccurrences.mockResolvedValue({ ok: true, data: [master, next] }); repo.update.mockResolvedValueOnce({ ok: true, data: master }).mockResolvedValueOnce({ ok: false, error: 'Folgetermin gesperrt' });
    expect(await updateVisitFromWizard('tenant', masterId, mapVisitDetailToEditForm(master), 'business_admin', 'this_and_following')).toMatchObject({ ok: false, persistedVisitId: masterId });
    expect(repo.update).toHaveBeenCalledTimes(2); expect(repo.updateAssignmentStatus).not.toHaveBeenCalled();
  });
  it('rejects an impossible date before resolving or writing an edit', async () => {
    const form = { ...mapVisitDetailToEditForm(visit()), assignmentDate: '2026-02-31' };
    expect((await updateVisitFromWizard('tenant', masterId, form, 'business_admin')).ok).toBe(false);
    expect(repo.getById).not.toHaveBeenCalled(); expect(repo.update).not.toHaveBeenCalled();
  });
});

describe('German planning clock independent of device timezone', () => {
  it('uses German summer and winter offsets, and maps the same times back into the editor', () => {
    expect(buildPlannedTimestamps({ ...wizard(), assignmentDate: '2026-07-01', plannedStartTime: '10:00', plannedEndTime: '11:00' })).toEqual({ plannedStartAt: '2026-07-01T08:00:00.000Z', plannedEndAt: '2026-07-01T09:00:00.000Z' });
    expect(buildPlannedTimestamps({ ...wizard(), assignmentDate: '2026-12-01', plannedStartTime: '10:00', plannedEndTime: '11:00' }).plannedStartAt).toBe('2026-12-01T09:00:00.000Z');
    expect(mapVisitDetailToEditForm({ ...visit(), scheduledStart: '2026-07-01T08:00:00Z', scheduledEnd: '2026-07-01T09:00:00Z', assignmentDate: undefined }).plannedStartTime).toBe('10:00');
  });
  it.each(['2026-02-31', '2026-13-01'])('rejects overflowing date %s', (assignmentDate) => {
    expect(validateAssignmentCreateForm({ ...wizard(), assignmentDate }).assignmentDate).toBeTruthy();
  });
  it.each(['24:00', '09:60', '99:00'])('rejects overflowing clock %s', (plannedStartTime) => {
    expect(validateAssignmentCreateForm({ ...wizard(), plannedStartTime }).plannedStartTime).toBeTruthy();
  });
  it('rejects a nonexistent local time in the spring DST jump', () => {
    expect(validateAssignmentCreateForm({ ...wizard(), assignmentDate: '2026-03-29', plannedStartTime: '02:30', plannedEndTime: '03:30' }).plannedStartTime).toBeTruthy();
  });
});
