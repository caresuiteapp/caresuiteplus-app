/**
 * ASSIST.WORKFLOW.1 — Shared status transition with DB persistence.
 */
import type { RoleKey, ServiceResult } from '@/types';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import { transitionLiveEmployeePortalAssignment } from '@/lib/portal/employeePortalExecutionLiveService';
import { transitionEmployeePortalAssignment } from '@/lib/portal/employeePortalExecutionService';
import { getServiceMode } from '@/lib/services/mode';
import { validateWorkflowTransition } from '../assistVisitStateMachine';
import { resolveAssistExecutionContext } from '../resolveAssistExecutionContext';
import type { AssistExecutionContext } from '../types';
import { resolveAllowedActions, resolveAssistExecutionDiagnostics } from '../resolveAllowedActions';
import {
  assistWorkflowErrorFromSupabase,
  assistWorkflowErrorToResult,
  createAssistWorkflowError,
} from '../assistWorkflowErrors';

export type TransitionOptions = {
  noShowNote?: string | null;
  hasServiceStarted?: boolean;
  hasTravelEnded?: boolean;
  hasDocumentation?: boolean;
  hasRequiredSignature?: boolean;
  signatureImpossibleJustified?: boolean;
  signatureDeferredToClientPortal?: boolean;
  /** When true, caller persists status side-effects (markArrived). */
  skipStatusPersistence?: boolean;
  arrivalOptions?: {
    arrivalMode?: 'gps' | 'without_gps' | 'manual';
    manualReason?: string | null;
  };
  /** Avoid full context reload and wait only for the canonical status write. */
  fastWorkflow?: boolean;
};

function buildFastTransitionContext(
  ctx: AssistExecutionContext,
  status: AssignmentStatus,
  persisted: Awaited<ReturnType<typeof transitionLiveEmployeePortalAssignment>> extends ServiceResult<infer T>
    ? T
    : never,
): AssistExecutionContext {
  const detail = {
    ...ctx.detail,
    status,
    onTheWayAt: persisted.onTheWayAt ?? ctx.detail.onTheWayAt,
    arrivedAt: persisted.arrivedAt ?? ctx.detail.arrivedAt,
    actualStartAt: persisted.actualStartAt ?? ctx.detail.actualStartAt,
    actualEndAt: persisted.actualEndAt ?? ctx.detail.actualEndAt,
  };
  const visitTimes = ctx.visitTimes
    ? {
        ...ctx.visitTimes,
        driveStartedAt:
          status === 'unterwegs'
            ? persisted.onTheWayAt ?? ctx.visitTimes.driveStartedAt
            : ctx.visitTimes.driveStartedAt,
        arrivedAt:
          status === 'angekommen'
            ? persisted.arrivedAt ?? ctx.visitTimes.arrivedAt
            : ctx.visitTimes.arrivedAt,
        serviceStartedAt:
          status === 'gestartet' && ctx.assignmentStatus !== 'pausiert'
            ? persisted.actualStartAt ?? ctx.visitTimes.serviceStartedAt
            : ctx.visitTimes.serviceStartedAt,
        serviceEndedAt:
          status === 'beendet'
            ? persisted.actualEndAt ?? ctx.visitTimes.serviceEndedAt
            : ctx.visitTimes.serviceEndedAt,
        activeTimer:
          status === 'unterwegs'
            ? 'drive' as const
            : status === 'gestartet'
              ? 'service' as const
              : status === 'pausiert'
                ? 'pause' as const
                : status === 'beendet'
                  ? null
                  : ctx.visitTimes.activeTimer,
      }
    : ctx.visitTimes;
  const workflow = {
    derivedStatus: status,
    recordedStatus: status,
    consistencyStatus: ctx.consistencyStatus,
    inconsistencies: ctx.inconsistencies,
    repairOptions: ctx.repairOptions,
    canStartService: status === 'angekommen',
    nextActionHint: null,
  };
  return {
    ...ctx,
    assignmentStatus: status,
    derivedStatus: status,
    detail,
    visitTimes,
    diagnostics: resolveAssistExecutionDiagnostics(status, visitTimes, workflow),
    allowedActions: resolveAllowedActions({
      assignmentStatus: status,
      visitTimes,
      detail,
      derivedStatus: status,
      canStartService: status === 'angekommen',
    }),
  };
}

export async function transitionAssistExecutionStatus(
  ctx: AssistExecutionContext,
  toStatus: AssignmentStatus,
  options?: TransitionOptions,
): Promise<ServiceResult<AssistExecutionContext>> {
  if (ctx.assignmentStatus === toStatus) {
    if (options?.fastWorkflow) return { ok: true, data: ctx };
    return resolveAssistExecutionContext({
      tenantId: ctx.tenantId,
      assignmentId: ctx.assignmentId,
      employeeId: ctx.employeeId,
      profileId: ctx.profileId,
      roleKey: ctx.roleKey as RoleKey | null,
    });
  }

  const hasServiceStarted =
    options?.hasServiceStarted ??
    Boolean(ctx.visitTimes?.serviceStartedAt);

  const hasTravelEnded =
    options?.hasTravelEnded ??
    Boolean(ctx.visitTimes?.arrivedAt);

  const validation = validateWorkflowTransition(ctx.assignmentStatus, toStatus, {
    requireArrivedBeforeStart: true,
    hasServiceStarted: toStatus === 'beendet' ? hasServiceStarted : undefined,
    hasTravelEnded: toStatus === 'beendet' ? hasTravelEnded : undefined,
    hasDocumentation: options?.hasDocumentation,
    hasRequiredSignature: options?.hasRequiredSignature,
    signatureImpossibleJustified: options?.signatureImpossibleJustified,
    signatureDeferredToClientPortal: options?.signatureDeferredToClientPortal,
    noShowNote: options?.noShowNote,
  });

  if (!validation.valid) {
    return assistWorkflowErrorToResult(
      createAssistWorkflowError('AWF_INVALID_TRANSITION', {
        tenantId: ctx.tenantId,
        assignmentId: ctx.assignmentId,
        operation: 'transitionAssistExecutionStatus',
      }, validation.error),
    );
  }

  const roleKey = ctx.roleKey as RoleKey | null;
  const transitionFn =
    getServiceMode() === 'supabase'
      ? transitionLiveEmployeePortalAssignment
      : transitionEmployeePortalAssignment;

  const note = toStatus === 'nicht_erschienen' ? options?.noShowNote?.trim() : undefined;
  const result = await transitionFn(
    ctx.tenantId,
    ctx.assignmentId,
    ctx.employeeId,
    roleKey,
    toStatus,
    options?.skipStatusPersistence
      ? {
          profileId: ctx.profileId,
          skipStatusPersistence: true,
          arrivalOptions: options.arrivalOptions,
          executionTransition: {
            hasDocumentation: options.hasDocumentation,
            hasRequiredSignature: options.hasRequiredSignature,
            signatureDeferredToClientPortal: options.signatureDeferredToClientPortal,
          },
          fastWorkflow: options.fastWorkflow,
          knownDetail: options.fastWorkflow ? ctx.detail : undefined,
        }
      : {
          profileId: ctx.profileId,
          executionTransition: {
            hasDocumentation: options?.hasDocumentation,
            hasRequiredSignature: options?.hasRequiredSignature,
            signatureDeferredToClientPortal: options?.signatureDeferredToClientPortal,
          },
          fastWorkflow: options?.fastWorkflow,
          knownDetail: options?.fastWorkflow ? ctx.detail : undefined,
        },
  );

  if (!result.ok) {
    if (result.error?.includes('Datenbankfehler')) {
      return assistWorkflowErrorToResult(
        assistWorkflowErrorFromSupabase(
          { message: result.error },
          {
            tenantId: ctx.tenantId,
            assignmentId: ctx.assignmentId,
            employeeId: ctx.employeeId,
            operation: 'transitionAssistExecutionStatus',
          },
        ),
      );
    }
    return { ok: false, error: result.error };
  }

  void note;

  if (options?.fastWorkflow) {
    return { ok: true, data: buildFastTransitionContext(ctx, toStatus, result.data) };
  }

  return resolveAssistExecutionContext({
    tenantId: ctx.tenantId,
    assignmentId: ctx.assignmentId,
    employeeId: ctx.employeeId,
    profileId: ctx.profileId,
    roleKey,
  });
}
