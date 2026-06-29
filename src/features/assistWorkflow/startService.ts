/**
 * ASSIST.STABILIZE.1 — Start service with inconsistency repair + service_start backfill.
 */
import type { ServiceResult } from '@/types';
import { fetchTimeEventsForVisit } from '@/lib/assist/assistTrackingPersistenceService';
import { transitionAssistExecutionStatus } from './internal/transitionAssistExecutionStatus';
import { upsertAssistVisitExecutionState } from './assistVisitExecutionStatePersistence';
import { repairWorkflowState } from './repairWorkflowState';
import { ensureVisitTimeEvent } from './saveVisitTimeEvent';
import { resolveAssistExecutionContext } from './resolveAssistExecutionContext';
import type { AssistExecutionContext } from './types';
import {
  assistWorkflowErrorToResult,
  createAssistWorkflowError,
} from './assistWorkflowErrors';

export async function startService(
  ctx: AssistExecutionContext,
): Promise<ServiceResult<AssistExecutionContext>> {
  const derived = ctx.derivedStatus ?? ctx.assignmentStatus;
  const canStart =
    derived === 'angekommen' ||
    (ctx.assignmentStatus === 'gestartet' && !ctx.visitTimes?.serviceStartedAt);

  if (!canStart && ctx.assignmentStatus !== 'pausiert') {
    if (ctx.consistencyStatus === 'repairable') {
      const repaired = await repairWorkflowState(ctx);
      if (repaired.ok && repaired.data.repaired) {
        return startService(repaired.data.ctx);
      }
      if (repaired.ok && !repaired.data.repaired) {
        const refreshed = await resolveAssistExecutionContext({
          tenantId: ctx.tenantId,
          assignmentId: ctx.assignmentId,
          employeeId: ctx.employeeId,
          profileId: ctx.profileId,
          roleKey: ctx.roleKey as import('@/types').RoleKey | null,
          autoRepair: true,
        });
        if (refreshed.ok) return startService(refreshed.data);
      }
    }

    return assistWorkflowErrorToResult(
      createAssistWorkflowError('WORKFLOW_INVALID_STATE', {
        tenantId: ctx.tenantId,
        assignmentId: ctx.assignmentId,
        operation: 'startService',
      }, 'Einsatz kann nur nach Ankunft gestartet werden.'),
    );
  }

  let workingCtx = ctx;

  if (
    workingCtx.consistencyStatus === 'repairable' &&
    workingCtx.derivedStatus !== workingCtx.assignmentStatus &&
    !['gestartet', 'pausiert'].includes(workingCtx.assignmentStatus)
  ) {
    const repaired = await repairWorkflowState(workingCtx);
    if (repaired.ok) workingCtx = repaired.data.ctx;
  }

  if (
    workingCtx.assignmentStatus === 'gestartet' &&
    !workingCtx.visitTimes?.serviceStartedAt
  ) {
    const events = await fetchTimeEventsForVisit(
      workingCtx.tenantId,
      workingCtx.assistVisitId,
      50,
    );
    const existing = events.ok ? events.data.map((e) => ({ eventType: e.eventType })) : [];
    const saved = await ensureVisitTimeEvent(
      {
        tenantId: workingCtx.tenantId,
        visitId: workingCtx.assistVisitId,
        eventType: 'service_start',
        recordedBy: workingCtx.profileId ?? workingCtx.employeeId,
      },
      existing,
    );
    if (!saved.ok) return saved;

    const refreshed = await resolveAssistExecutionContext({
      tenantId: workingCtx.tenantId,
      assignmentId: workingCtx.assignmentId,
      employeeId: workingCtx.employeeId,
      profileId: workingCtx.profileId,
      roleKey: workingCtx.roleKey as import('@/types').RoleKey | null,
      autoRepair: false,
    });
    if (!refreshed.ok) return refreshed;

    void upsertAssistVisitExecutionState(
      workingCtx.tenantId,
      workingCtx.assignmentId,
      'gestartet',
      {
        employeeId: workingCtx.employeeId,
        visitTimes: refreshed.data.visitTimes,
      },
    );
    return refreshed;
  }

  const result = await transitionAssistExecutionStatus(workingCtx, 'gestartet', {
    hasTravelEnded: Boolean(workingCtx.visitTimes?.arrivedAt),
  });

  if (result.ok) {
    void upsertAssistVisitExecutionState(workingCtx.tenantId, workingCtx.assignmentId, 'gestartet', {
      employeeId: workingCtx.employeeId,
      visitTimes: result.data.visitTimes,
    });
  }

  return result;
}
