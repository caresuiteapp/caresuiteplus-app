import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import type { AssistExecutionContext } from './types';

export type RecoverableWorkflowAction =
  | 'mark_arrived'
  | 'start_service'
  | 'start_pause'
  | 'end_pause'
  | 'end_service'
  | 'save_documentation'
  | 'save_signature'
  | 'finalize'
  | 'finalize_deferred'
  | 'report_no_show';

const STATUS_PROGRESS: Partial<Record<AssignmentStatus, number>> = {
  geplant: 10,
  bestaetigt: 20,
  unterwegs: 30,
  angekommen: 40,
  gestartet: 50,
  pausiert: 55,
  beendet: 60,
  dokumentation_offen: 65,
  unterschrift_offen: 70,
  abgeschlossen: 80,
};

function statusAtLeast(ctx: AssistExecutionContext, target: AssignmentStatus): boolean {
  const targetRank = STATUS_PROGRESS[target] ?? Number.MAX_SAFE_INTEGER;
  return [ctx.assignmentStatus, ctx.derivedStatus, ctx.detail.status].some(
    (status) => (STATUS_PROGRESS[status] ?? 0) >= targetRank,
  );
}

/**
 * A timeout/stale response is recovered only when a read-back proves the
 * requested action itself reached its durable postcondition.
 */
export function didWorkflowActionReachPostcondition(
  action: RecoverableWorkflowAction,
  before: AssistExecutionContext,
  after: AssistExecutionContext,
): boolean {
  switch (action) {
    case 'mark_arrived':
      return Boolean(after.visitTimes?.arrivedAt || after.detail.arrivedAt) && statusAtLeast(after, 'angekommen');
    case 'start_service':
      return Boolean(after.visitTimes?.serviceStartedAt || after.detail.actualStartAt) && statusAtLeast(after, 'gestartet');
    case 'start_pause':
      return after.assignmentStatus === 'pausiert' || after.derivedStatus === 'pausiert' || after.visitTimes?.activeTimer === 'pause';
    case 'end_pause':
      return (
        (before.assignmentStatus === 'pausiert' || before.derivedStatus === 'pausiert') &&
        after.assignmentStatus !== 'pausiert' &&
        after.derivedStatus !== 'pausiert' &&
        (after.visitTimes?.activeTimer === 'service' || statusAtLeast(after, 'beendet'))
      );
    case 'end_service':
      return Boolean(after.visitTimes?.serviceEndedAt || after.detail.actualEndAt) && statusAtLeast(after, 'beendet');
    case 'save_documentation':
      return (
        after.detail.documentationStatus === 'submitted' ||
        after.detail.documentationStatus === 'locked'
      );
    case 'save_signature':
      return after.detail.signatureStatus === 'captured';
    case 'finalize':
      return statusAtLeast(after, 'abgeschlossen') && after.detail.signatureStatus !== 'deferred_to_client_portal';
    case 'finalize_deferred':
      return (
        statusAtLeast(after, 'abgeschlossen') &&
        (after.detail.signatureStatus === 'deferred_to_client_portal' || after.detail.clientPortalSignatureCompleted === true)
      );
    case 'report_no_show':
      return after.assignmentStatus === 'nicht_erschienen' || after.derivedStatus === 'nicht_erschienen';
  }
}
