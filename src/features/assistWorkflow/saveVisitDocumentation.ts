/**
 * ASSIST.WORKFLOW.2 — Save visit documentation and chain to signature step.
 */
import type { ServiceResult } from '@/types';
import type { EmployeePortalDocumentationInput } from '@/types/modules/employeePortalExecution';
import { resolveAssistVisitIdForPersistence } from '@/lib/assist/assistExecutionVisitResolver';
import { resolveVisitMasterId } from '@/lib/assist/visitRecurrenceExpansion';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { transitionAssistExecutionStatus } from './internal/transitionAssistExecutionStatus';
import { upsertAssistVisitExecutionState } from './assistVisitExecutionStatePersistence';
import { resolveAllowedActions } from './resolveAllowedActions';
import { generateServiceRecord } from './generateServiceRecord';
import { assistProofProjectionKey } from './internal/workflowProjectionKeys';
import type { AssistExecutionContext } from './types';
import {
  assistWorkflowErrorToResult,
  createAssistWorkflowError,
} from './assistWorkflowErrors';
import { scheduleDeferredTask } from '@/lib/async/deferredTask';

export type SaveVisitDocumentationInput = {
  ctx: AssistExecutionContext;
  documentation: EmployeePortalDocumentationInput;
};

export type SaveVisitDocumentationResult = {
  ctx: AssistExecutionContext;
  nextStep: 'signature' | 'finalize';
  /** Documentation is durable; a secondary status/administration mirror needs a retry. */
  wfmSyncFailed?: boolean;
};

function buildDocumentationText(doc: EmployeePortalDocumentationInput): string {
  const parts: string[] = [doc.shortDescription.trim()];
  if (doc.specialNotes?.trim()) parts.push(`Besonderheiten: ${doc.specialNotes.trim()}`);
  if (doc.deviations?.trim()) {
    parts.push(`Abweichungen: ${doc.deviations.trim()}`);
    if (doc.deviationJustification?.trim()) {
      parts.push(`Begründung: ${doc.deviationJustification.trim()}`);
    }
  }
  if (doc.referralRequired) parts.push('Weiterleitung erforderlich.');
  if (doc.emergencyOrProblem) parts.push('Notfall/Problem gemeldet.');
  return parts.join('\n\n');
}

function normalizeDocumentationInput(
  documentation: EmployeePortalDocumentationInput,
): EmployeePortalDocumentationInput {
  const shortDescription =
    documentation.shortDescription.trim() ||
    documentation.specialNotes?.trim() ||
    '';
  return {
    ...documentation,
    shortDescription,
    specialNotes: documentation.specialNotes?.trim() || undefined,
    deviations: documentation.deviations?.trim() || undefined,
    deviationJustification: documentation.deviationJustification?.trim() || undefined,
  };
}

async function persistDocumentationToAssistVisit(
  tenantId: string,
  visitId: string,
  doc: EmployeePortalDocumentationInput,
  profileId: string | null,
): Promise<ServiceResult<{ visitMirrorFailed: boolean }>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase ist nicht verfügbar.' };

  const now = new Date().toISOString();
  const payload = {
    short_description: doc.shortDescription.trim(),
    special_notes: doc.specialNotes?.trim() ?? null,
    deviations: doc.deviations?.trim() ?? null,
    deviation_justification: doc.deviationJustification?.trim() ?? null,
    referral_required: doc.referralRequired,
    emergency_or_problem: doc.emergencyOrProblem,
    sis_notes: doc.sisNotes?.trim() ?? null,
    vitals_summary: doc.vitalsSummary?.trim() ?? null,
    body_map_notes: doc.bodyMapNotes?.trim() ?? null,
    medication_notes: doc.medicationNotes?.trim() ?? null,
    care_report_notes: doc.careReportNotes?.trim() ?? null,
    photo_references: doc.photoReferences ?? [],
    submitted_at: now,
    submitted_by: profileId,
    locked: false,
  };

  const { error } = await fromUnknownTable(supabase, 'assist_visit_documentation')
    .upsert(
      {
        tenant_id: tenantId,
        visit_id: visitId,
        ...payload,
        updated_at: now,
      },
      { onConflict: 'tenant_id,visit_id' },
    );

  if (error) {
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  scheduleDeferredTask(`assist-documentation-visit:${tenantId}:${visitId}`, async () => {
    const { error: visitUpdateError } = await fromUnknownTable(supabase, 'assist_visits')
      .update({ documentation_status: 'complete', updated_at: now })
      .eq('tenant_id', tenantId)
      .eq('id', visitId);
    if (visitUpdateError) throw new Error(toGermanSupabaseError(visitUpdateError));
  });

  return { ok: true, data: { visitMirrorFailed: false } };
}

export async function saveVisitDocumentation(
  input: SaveVisitDocumentationInput,
): Promise<ServiceResult<SaveVisitDocumentationResult>> {
  const { ctx } = input;
  const documentation = normalizeDocumentationInput(input.documentation);
  const masterAssignmentId = resolveVisitMasterId(
    ctx.detail.assignmentId || ctx.assignmentId,
  );

  if (!documentation.shortDescription.trim()) {
    return assistWorkflowErrorToResult(
      createAssistWorkflowError(
        'WORKFLOW_DOCUMENTATION_REQUIRED',
        {
          tenantId: ctx.tenantId,
          assignmentId: ctx.assignmentId,
          operation: 'saveVisitDocumentation',
        },
        'Kurzbeschreibung ist erforderlich.',
      ),
    );
  }

  if (documentation.deviations?.trim() && !documentation.deviationJustification?.trim()) {
    return assistWorkflowErrorToResult(
      createAssistWorkflowError(
        'AWF_VALIDATION',
        {
          tenantId: ctx.tenantId,
          assignmentId: ctx.assignmentId,
          operation: 'saveVisitDocumentation',
        },
        'Abweichungen müssen begründet werden.',
      ),
    );
  }

  if (!ctx.visitTimes?.serviceStartedAt && !ctx.detail.actualStartAt) {
    if (!['beendet', 'dokumentation_offen', 'unterschrift_offen', 'abgeschlossen', 'gestartet', 'pausiert'].includes(ctx.assignmentStatus)) {
      return assistWorkflowErrorToResult(
        createAssistWorkflowError('WORKFLOW_SERVICE_NOT_STARTED', {
          tenantId: ctx.tenantId,
          assignmentId: ctx.assignmentId,
          operation: 'saveVisitDocumentation',
        }),
      );
    }
  }

  const allowedStatuses = ['gestartet', 'beendet', 'dokumentation_offen'] as const;
  const canSaveDocumentation =
    allowedStatuses.includes(ctx.assignmentStatus as (typeof allowedStatuses)[number]) ||
    allowedStatuses.includes(ctx.derivedStatus as (typeof allowedStatuses)[number]) ||
    Boolean(ctx.visitTimes?.serviceEndedAt) ||
    Boolean(ctx.detail.actualEndAt);
  const isLiveDocumentation =
    (ctx.assignmentStatus === 'gestartet' || ctx.derivedStatus === 'gestartet') &&
    !ctx.visitTimes?.serviceEndedAt &&
    !ctx.detail.actualEndAt;

  if (!canSaveDocumentation) {
    return assistWorkflowErrorToResult(
      createAssistWorkflowError(
        'WORKFLOW_INVALID_STATE',
        {
          tenantId: ctx.tenantId,
          assignmentId: ctx.assignmentId,
          operation: 'saveVisitDocumentation',
        },
        'Dokumentation ist erst nach Beginn des Einsatzes möglich.',
      ),
    );
  }

  const docText = buildDocumentationText(documentation);
  const persistedExecutionStatus = isLiveDocumentation
    ? 'gestartet'
    : 'dokumentation_offen';
  let documentationPersisted = false;
  let wfmSyncFailed = false;

  if (getServiceMode() === 'supabase') {
    const visitId =
      ctx.assistVisitId ||
      (await resolveAssistVisitIdForPersistence(ctx.tenantId, masterAssignmentId));

    if (!visitId) {
      return {
        ok: false,
        error: 'Einsatzbesuch konnte nicht zugeordnet werden — Dokumentation nicht gespeichert.',
      };
    }

    const visitDoc = await persistDocumentationToAssistVisit(
      ctx.tenantId,
      visitId,
      documentation,
      ctx.profileId,
    );
    if (!visitDoc.ok) {
      return { ok: false, error: visitDoc.error };
    }
    documentationPersisted = true;
    if (visitDoc.data.visitMirrorFailed) wfmSyncFailed = true;

    scheduleDeferredTask(`assignment-documentation:${ctx.tenantId}:${masterAssignmentId}`, async () => {
      const { error: notesError } = await fromUnknownTable(getSupabaseClient()!, 'assignments')
        .update({ documentation_notes: docText, updated_at: new Date().toISOString() })
        .eq('tenant_id', ctx.tenantId)
        .eq('id', masterAssignmentId);
      if (notesError) throw new Error(toGermanSupabaseError(notesError));
    });
  }

  let updatedCtx = ctx;
  if (documentationPersisted && ctx.assignmentStatus === 'beendet') {
    const transitioned = await transitionAssistExecutionStatus(ctx, 'dokumentation_offen', {
      hasServiceStarted: true,
      hasDocumentation: true,
      fastWorkflow: true,
    });
    if (transitioned.ok) {
      updatedCtx = transitioned.data;
    } else {
      // The documentation is already durable. Keep the employee in the
      // post-service workflow even when a legacy status mirror is temporarily
      // unavailable; a later refresh can safely reconcile the status.
      console.warn(
        '[saveVisitDocumentation] documentation stored, status transition deferred:',
        transitioned.error,
      );
      updatedCtx = {
        ...ctx,
        assignmentStatus: 'dokumentation_offen',
        derivedStatus: 'dokumentation_offen',
      };
    }
  } else if (ctx.assignmentStatus === 'beendet') {
    const transitioned = await transitionAssistExecutionStatus(ctx, 'dokumentation_offen', {
      hasServiceStarted: true,
      hasDocumentation: true,
      fastWorkflow: true,
    });
    if (transitioned.ok) {
      updatedCtx = transitioned.data;
    } else if (!documentationPersisted) {
      return { ok: false, error: transitioned.error };
    }
  }

  scheduleDeferredTask(`assist-execution-state:${ctx.tenantId}:${masterAssignmentId}`, async () => {
    const executionState = await upsertAssistVisitExecutionState(
      ctx.tenantId,
      masterAssignmentId,
      persistedExecutionStatus,
      {
        employeeId: ctx.employeeId,
        visitTimes: updatedCtx.visitTimes,
        documentationComplete: true,
      },
    );
    if (!executionState.ok) throw new Error(executionState.error);
  });

  const detail = {
    ...updatedCtx.detail,
    status: isLiveDocumentation ? updatedCtx.detail.status : 'dokumentation_offen' as const,
    documentationStatus: 'submitted' as const,
    documentationNotes: docText,
  };
  const visitTimes = updatedCtx.visitTimes;
  const optimisticStatus = isLiveDocumentation
    ? 'gestartet'
    : 'dokumentation_offen';
  const resolvedActions = resolveAllowedActions({
    assignmentStatus: optimisticStatus,
    visitTimes,
    detail,
    derivedStatus: optimisticStatus,
    canStartService: false,
  });
  const optimisticCtx: AssistExecutionContext = {
    ...updatedCtx,
    assignmentStatus: optimisticStatus,
    derivedStatus: optimisticStatus,
    detail,
    allowedActions: isLiveDocumentation
      ? resolvedActions.filter((action) =>
          !['capture_signature', 'finalize_visit', 'finalize_visit_deferred_signature'].includes(action),
        )
      : resolvedActions,
  };
  const nextStep = detail.requiresSignature ? 'signature' : 'finalize';

  // Start the proof projection as soon as the canonical documentation is
  // durable. A later signature replaces this coalesced job with the signed
  // proof, so finalization normally only needs one quick completeness read.
  scheduleDeferredTask(assistProofProjectionKey(optimisticCtx), async () => {
    const proof = await generateServiceRecord(optimisticCtx, docText);
    if (!proof.ok) throw new Error(proof.error);
  });

  return {
    ok: true,
    data: { ctx: optimisticCtx, nextStep, wfmSyncFailed },
  };
}
