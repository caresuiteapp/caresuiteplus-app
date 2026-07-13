/**
 * ASSIST.WORKFLOW.2 — Save visit documentation and chain to signature step.
 */
import type { ServiceResult } from '@/types';
import type { RoleKey } from '@/types';
import type { EmployeePortalDocumentationInput } from '@/types/modules/employeePortalExecution';
import { resolveAssistVisitIdForPersistence } from '@/lib/assist/assistExecutionVisitResolver';
import { resolveVisitMasterId } from '@/lib/assist/visitRecurrenceExpansion';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { transitionAssistExecutionStatus } from './internal/transitionAssistExecutionStatus';
import { upsertAssistVisitExecutionState } from './assistVisitExecutionStatePersistence';
import { resolveAssistExecutionContext } from './resolveAssistExecutionContext';
import { resolveAllowedActions } from './resolveAllowedActions';
import type { AssistExecutionContext } from './types';
import {
  assistWorkflowErrorToResult,
  createAssistWorkflowError,
} from './assistWorkflowErrors';

export type SaveVisitDocumentationInput = {
  ctx: AssistExecutionContext;
  documentation: EmployeePortalDocumentationInput;
};

export type SaveVisitDocumentationResult = {
  ctx: AssistExecutionContext;
  nextStep: 'signature' | 'finalize';
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
): Promise<ServiceResult<void>> {
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
    submitted_by: null,
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

  const { error: visitUpdateError } = await fromUnknownTable(supabase, 'assist_visits')
    .update({
      documentation_status: 'complete',
      employee_notes: buildDocumentationText(doc),
      updated_at: now,
    })
    .eq('tenant_id', tenantId)
    .eq('id', visitId);

  if (visitUpdateError) {
    return { ok: false, error: toGermanSupabaseError(visitUpdateError) };
  }

  return { ok: true, data: undefined };
}

export async function saveVisitDocumentation(
  input: SaveVisitDocumentationInput,
): Promise<ServiceResult<SaveVisitDocumentationResult>> {
  const { ctx } = input;
  const documentation = normalizeDocumentationInput(input.documentation);
  const masterAssignmentId = resolveVisitMasterId(ctx.assignmentId);

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

  if (getServiceMode() === 'supabase') {
    const visitId =
      ctx.assistVisitId ||
      (await resolveAssistVisitIdForPersistence(ctx.tenantId, masterAssignmentId));

    if (!visitId) {
      return assistWorkflowErrorToResult(
        createAssistWorkflowError(
          'AWF_DATABASE_ERROR',
          {
            tenantId: ctx.tenantId,
            assignmentId: ctx.assignmentId,
            operation: 'saveVisitDocumentation.resolveVisit',
          },
          'Einsatzbesuch konnte nicht zugeordnet werden — Dokumentation nicht gespeichert.',
        ),
      );
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

    const { error: notesError } = await fromUnknownTable(getSupabaseClient()!, 'assignments')
      .update({
        documentation_notes: docText,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', ctx.tenantId)
      .eq('id', masterAssignmentId);

    if (notesError) {
      return { ok: false, error: toGermanSupabaseError(notesError) };
    }
  }

  let updatedCtx = ctx;
  if (documentationPersisted && ctx.assignmentStatus === 'beendet') {
    void transitionAssistExecutionStatus(ctx, 'dokumentation_offen', {
      hasServiceStarted: true,
      hasDocumentation: true,
    }).then((transitioned) => {
      if (transitioned.ok) {
        void upsertAssistVisitExecutionState(
          ctx.tenantId,
          masterAssignmentId,
          'dokumentation_offen',
          {
            employeeId: ctx.employeeId,
            visitTimes: transitioned.data.visitTimes,
            documentationComplete: true,
          },
        );
      }
    });
    updatedCtx = {
      ...ctx,
      assignmentStatus: 'dokumentation_offen',
      derivedStatus: 'dokumentation_offen',
    };
  } else if (ctx.assignmentStatus === 'beendet') {
    const transitioned = await transitionAssistExecutionStatus(ctx, 'dokumentation_offen', {
      hasServiceStarted: true,
      hasDocumentation: true,
    });
    if (transitioned.ok) {
      updatedCtx = transitioned.data;
    } else if (!documentationPersisted) {
      return { ok: false, error: transitioned.error };
    }
  }

  if (getServiceMode() === 'supabase' && documentationPersisted) {
    void upsertAssistVisitExecutionState(
      ctx.tenantId,
      masterAssignmentId,
      persistedExecutionStatus,
      {
        employeeId: ctx.employeeId,
        visitTimes: updatedCtx.visitTimes,
        documentationComplete: true,
      },
    );
  } else {
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

    if (!executionState.ok && getServiceMode() === 'supabase') {
      return { ok: false, error: executionState.error ?? 'Dokumentationsstatus konnte nicht gespeichert werden.' };
    }
  }

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

  void resolveAssistExecutionContext({
    tenantId: ctx.tenantId,
    assignmentId: ctx.assignmentId,
    employeeId: ctx.employeeId,
    profileId: ctx.profileId,
    roleKey: ctx.roleKey as RoleKey | null,
  });

  return {
    ok: true,
    data: { ctx: optimisticCtx, nextStep },
  };
}
