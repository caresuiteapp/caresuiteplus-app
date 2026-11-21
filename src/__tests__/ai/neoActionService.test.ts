import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createNeoAppointment, moveNeoVisit } from '@/ai/neo/neoActionService';
const mock = vi.hoisted(() => ({ auth: vi.fn(), rpc: vi.fn(), detail: vi.fn(), update: vi.fn(), conflicts: vi.fn(), snapshot: vi.fn(), denied: false }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ auth: { getUser: mock.auth }, rpc: mock.rpc }) }));
vi.mock('@/lib/permissions', () => ({ enforcePermission: () => mock.denied ? { ok: false, error: 'Keine Berechtigung' } : null }));
vi.mock('@/lib/assist/visitService', () => ({ fetchVisitDispositionDetail: mock.detail, updateVisitFromWizard: mock.update }));
vi.mock('@/lib/assist/repositories/visitRepository.supabase', () => ({ visitSupabaseRepository: { listPlanningConflictCandidates: mock.conflicts } }));
vi.mock('@/lib/calendar/employeeMonthPlanningService', () => ({ loadPlanningSnapshot: mock.snapshot }));
const scope = { tenantId: '11111111-1111-4111-8111-111111111111', actorId: '22222222-2222-4222-8222-222222222222', subjectId: '33333333-3333-4333-8333-333333333333' }, id = '44444444-4444-4444-8444-444444444444';
const visit = () => ({ id, tenantId: scope.tenantId, clientId: scope.subjectId, employeeId: null, title: 'Begleitung', updatedAt: '2026-11-20T12:00:00Z', scheduledStart: '2090-11-20T12:00:00Z', scheduledEnd: '2090-11-20T13:30:00Z', executionStatus: 'pending', proofStatus: 'open', tasks: [{ id: 't', title: 'Einkauf', isRequired: true }], notes: 'Interne Notiz', portalReleaseEnabled: true, riskFlagKeys: ['fall'], budget: { budgetAmountCents: 2500 }, assignmentStatus: 'planned' });
const input = () => ({ visitId: id, date: '2090-11-21', time: '14:00', expectedUpdatedAt: visit().updatedAt });
const appointment = () => ({ title: 'Beratung', startsAt: '2090-11-21T13:00:00Z', endsAt: '2090-11-21T13:30:00Z', location: '', clientId: scope.subjectId });
beforeEach(() => {
  vi.resetAllMocks(); mock.denied = false; mock.auth.mockResolvedValue({ data: { user: { id: scope.actorId } }, error: null });
  mock.rpc.mockResolvedValue({ data: { id, tenantId: scope.tenantId, requestId: id }, error: null });
  mock.detail.mockResolvedValue({ ok: true, data: visit() }); mock.conflicts.mockResolvedValue({ ok: true, data: [] }); mock.snapshot.mockResolvedValue({ plans: [], absences: [] }); mock.update.mockResolvedValue({ ok: true, data: { id } });
});
describe('NEO guarded administrative writes', () => {
  it('uses a stable, typed appointment RPC and requires a matching receipt', async () => {
    expect(await createNeoAppointment(scope, id, appointment(), 'business_admin')).toMatchObject({ ok: true, id });
    expect(mock.rpc).toHaveBeenCalledWith('neo_create_appointment', { p_tenant_id: scope.tenantId, p_request_id: id, p_payload: appointment() });
    mock.rpc.mockResolvedValue({ data: { id, tenantId: id, requestId: id }, error: null });
    expect(await createNeoAppointment(scope, id, appointment(), 'business_admin')).toMatchObject({ ok: false, uncertain: true });
  });
  it('does not write after a changed login, missing permission or missing end time', async () => {
    mock.auth.mockResolvedValue({ data: { user: { id } }, error: null }); expect((await createNeoAppointment(scope, id, appointment(), 'business_admin')).ok).toBe(false);
    mock.denied = true; expect((await moveNeoVisit(scope, input(), 'business_admin')).ok).toBe(false);
    expect((await createNeoAppointment(scope, id, { ...appointment(), endsAt: 'invalid' }, 'business_admin')).ok).toBe(false); expect(mock.rpc).not.toHaveBeenCalled(); expect(mock.update).not.toHaveBeenCalled();
  });
  it('uses the existing visit writer for a single occurrence and preserves tasks, notes, duration and budgets', async () => {
    mock.detail.mockResolvedValueOnce({ ok: true, data: visit() }).mockResolvedValueOnce({ ok: true, data: visit() }).mockResolvedValueOnce({ ok: true, data: { ...visit(), scheduledStart: '2090-11-21T13:00:00Z', scheduledEnd: '2090-11-21T14:30:00Z' } });
    expect(await moveNeoVisit(scope, input(), 'business_admin')).toMatchObject({ ok: true, id });
    expect(mock.update).toHaveBeenCalledWith(scope.tenantId, id, expect.objectContaining({ assignmentDate: '2090-11-21', plannedStartTime: '14:00', plannedEndTime: '15:30', tasks: ['Einkauf'], internalNotes: 'Interne Notiz', budgetAmountCents: 2500, portalReleaseEnabled: true, riskFlagKeys: ['fall'] }), 'business_admin', 'this_only');
  });
  it.each([{ updatedAt: 'changed' }, { clientId: id }, { tenantId: id }, { executionStatus: 'started' }, { actualStartAt: '2090-11-20T12:00Z' }, { persistedSignature: { signed: true } }])('rejects a stale, foreign or started visit %j', async change => {
    mock.detail.mockResolvedValue({ ok: true, data: { ...visit(), ...change } }); expect((await moveNeoVisit(scope, input(), 'business_admin')).ok).toBe(false); expect(mock.update).not.toHaveBeenCalled();
  });
  it('refuses conflicts, unconfirmed availability and changes arriving during the check', async () => {
    mock.conflicts.mockResolvedValueOnce({ ok: true, data: [{ id: 'other', canonicalStatus: 'planned' }] }); expect((await moveNeoVisit(scope, input(), 'business_admin')).ok).toBe(false);
    mock.detail.mockResolvedValue({ ok: true, data: { ...visit(), employeeId: id } }); expect((await moveNeoVisit(scope, input(), 'business_admin')).ok).toBe(false);
    mock.detail.mockResolvedValueOnce({ ok: true, data: visit() }).mockResolvedValueOnce({ ok: true, data: { ...visit(), updatedAt: 'changed' } }); expect((await moveNeoVisit(scope, input(), 'business_admin')).ok).toBe(false); expect(mock.update).not.toHaveBeenCalled();
  });
  it('never reports partial follow-up persistence or failed readback as success', async () => {
    mock.update.mockResolvedValueOnce({ ok: false, persistedVisitId: id, error: 'Kalender noch nicht bestätigt' });
    expect(await moveNeoVisit(scope, input(), 'business_admin')).toMatchObject({ ok: false, uncertain: true });
    expect(await moveNeoVisit(scope, input(), 'business_admin')).toMatchObject({ ok: false, uncertain: true });
  });
});
