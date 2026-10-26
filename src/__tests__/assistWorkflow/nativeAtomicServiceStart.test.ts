import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssistExecutionContext } from '@/features/assistWorkflow/types';

const h = vi.hoisted(() => ({ rpc: vi.fn(), deferred: vi.fn(), event: vi.fn(), state: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ rpc: h.rpc }) }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/async/deferredTask', () => ({ scheduleDeferredTask: h.deferred }));
// Keep the real ensureVisitTimeEvent path: the atomic receipt already carries
// service_start, so only a second authoritative INSERT must be forbidden.
vi.mock('@/lib/assist/assistTrackingPersistenceService', () => ({ recordTimeEvent: h.event }));
vi.mock('@/lib/wfm/wfmAssistAdapter', () => ({ syncAssistTimeEventToWfmPortalSafe: vi.fn() }));
vi.mock('@/features/assistWorkflow/assistVisitExecutionStatePersistence', () => ({ upsertAssistVisitExecutionState: h.state }));
vi.mock('@/features/assistWorkflow/internal/transitionAssistExecutionStatus', () => ({ transitionAssistExecutionStatus: vi.fn() }));
vi.mock('@/features/assistWorkflow/repairWorkflowState', () => ({ repairWorkflowState: vi.fn() }));
vi.mock('@/lib/wfm/wfmOfficeTimekeepingService', () => ({ checkVisitDeviationGate: vi.fn() }));
import { startService as nativeStart } from '@/features/assistWorkflow/startService';
import { startService as webStart } from '@/features/assistWorkflow/startService.web';

const startedAt = '2026-10-11T08:20:00.000Z';
const arrivedAt = '2026-10-11T08:10:00.000Z';
function ctx(): AssistExecutionContext {
  return { tenantId: 'tenant', employeeId: 'employee', assignmentId: 'route-assignment', assistVisitId: 'canonical-visit',
    profileId: 'profile', roleKey: 'employee_portal', assignmentStatus: 'angekommen', derivedStatus: 'angekommen',
    consistencyStatus: 'consistent', inconsistencies: [], repairOptions: [], detail: { assignmentId: 'route-assignment',
      status: 'angekommen', arrivedAt, isLocked: false, tasks: [], allowedTransitions: [], requiresDocumentation: true,
      requiresSignature: true, documentationStatus: 'none', signatureStatus: 'pending' },
    visitTimes: null, timeEvents: [], liveContext: null, allowedActions: ['start_service'] } as unknown as AssistExecutionContext;
}
const receipt = () => ({ visitId: 'canonical-visit', employeeId: 'employee', status: 'started',
  startedAt, arrivedAt, eventId: 'event', events: [{ eventType: 'arrive', occurredAt: arrivedAt },
    { eventType: 'service_start', occurredAt: startedAt }] });
beforeEach(() => {
  vi.clearAllMocks(); h.rpc.mockResolvedValue({ data: receipt(), error: null });
  h.state.mockResolvedValue({ok:true,data:{visitId:'canonical-visit',currentStep:'in_service'}});
  h.event.mockResolvedValue({ok:true,data:{id:'unexpected-second-event'}});
});
describe('native and web canonical service start', () => {
  it('uses the same implementation and advances only from the atomic server receipt', async () => {
    expect(nativeStart).toBe(webStart);
    const result = await nativeStart(ctx());
    expect(h.rpc).toHaveBeenCalledWith('web_start_assist_visit_service', expect.objectContaining({
      p_tenant_id: 'tenant', p_visit_id: 'canonical-visit', p_employee_id: 'employee' }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.detail.actualStartAt).toBe(startedAt);
      expect(result.data.visitTimes?.serviceStartedAt).toBe(startedAt);
      expect(result.data.allowedActions).toContain('end_service');
    }
    expect(h.state).toHaveBeenCalledWith('tenant','route-assignment','gestartet',expect.objectContaining({employeeId:'employee'}));
    expect(h.event).not.toHaveBeenCalled(); // The canonical timer is never inserted twice.
    expect(h.deferred).toHaveBeenCalledTimes(1);
  });
  it('does not update a derived snapshot or schedule its WFM mirror before the canonical reply',async()=>{
    let reply!:(value:unknown)=>void;
    h.rpc.mockReturnValueOnce(new Promise(resolve=>{reply=resolve;}));
    const result=nativeStart(ctx());await Promise.resolve();
    expect(h.state).not.toHaveBeenCalled();expect(h.event).not.toHaveBeenCalled();expect(h.deferred).not.toHaveBeenCalled();
    reply({data:receipt(),error:null});expect((await result).ok).toBe(true);
    expect(h.state).toHaveBeenCalledOnce();expect(h.deferred).toHaveBeenCalledOnce();expect(h.event).not.toHaveBeenCalled();
  });
  it('keeps the confirmed canonical start and marks a failed projection for reconciliation',async()=>{
    h.state.mockResolvedValueOnce({ok:false,error:'Projection unavailable'});
    const warning=vi.spyOn(console,'warn').mockImplementation(()=>{});
    try {
      const result=await nativeStart(ctx());expect(result.ok).toBe(true);
      if(result.ok){expect(result.data.detail.actualStartAt).toBe(startedAt);expect(result.data).toMatchObject({wfmSyncFailed:true});}
      expect(h.event).not.toHaveBeenCalled();expect(h.deferred).toHaveBeenCalledOnce();
    }finally{warning.mockRestore();}
  });
  it.each([
    ['wrong visit', { ...receipt(), visitId: 'other' }],
    ['wrong employee', { ...receipt(), employeeId: 'other' }],
    ['missing start event', { ...receipt(), events: [] }],
    ['invalid actual time', { ...receipt(), startedAt: 'invalid' }],
  ])('keeps %s receipt unconfirmed instead of inventing a start', async (_label, data) => {
    h.rpc.mockResolvedValue({ data, error: null });
    const result = await nativeStart(ctx());
    expect(result).toMatchObject({ ok: false, errorCode: 'WORKFLOW_ACTION_TIMEOUT_UNCONFIRMED' });
    expect(h.deferred).not.toHaveBeenCalled(); expect(h.event).not.toHaveBeenCalled();
  });
  it('does not fabricate the beginning of an already-started visit with a missing actual time', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { code: 'P0S04', message: 'Tatsächliche Anfangszeit fehlt. Bitte Zeiten nachtragen.' } });
    const context = ctx(); context.assignmentStatus = 'gestartet';
    const result = await nativeStart(context);
    expect(result).toMatchObject({ ok: false, errorCode: 'START_SERVICE_INVALID_TRANSITION' });
    expect(h.event).not.toHaveBeenCalled(); expect(h.deferred).not.toHaveBeenCalled();
  });
  it('distinguishes an unavailable server function from an ambiguous lost reply', async () => {
    h.rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'Missing RPC' } });
    expect(await nativeStart(ctx())).toMatchObject({ ok: false, errorCode: 'START_SERVICE_SCHEMA_MISSING' });
    h.rpc.mockRejectedValueOnce(new Error('offline'));
    expect(await nativeStart(ctx())).toMatchObject({ ok: false, errorCode: 'WORKFLOW_ACTION_TIMEOUT_UNCONFIRMED' });
  });
  it('passes a scoped deviation approval, not an approval for a different visit', async () => {
    await nativeStart(ctx(), { deviationApproved: true, deviationPhase: 'start', deviationVisitId: 'other',
      deviationActualAt: startedAt, deviationJustification: 'Ein ausführlicher Grund' });
    expect(h.rpc.mock.calls[0][1].p_justification).toBe(null);
    await nativeStart(ctx(), { deviationApproved: true, deviationPhase: 'start', deviationVisitId: 'canonical-visit',
      deviationActualAt: startedAt, deviationJustification: 'Ein ausführlicher Grund' });
    expect(h.rpc.mock.calls[1][1].p_started_at).toBe(startedAt);
    expect(h.rpc.mock.calls[1][1].p_justification).toBe('Ein ausführlicher Grund');
  });
});
