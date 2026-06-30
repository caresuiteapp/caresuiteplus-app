/**
 * ASSIST.WORKFLOW.2 — Save visit documentation and chain to signature step.
 */
import type { ServiceResult } from '@/types';
import type { RoleKey } from '@/types';
import type { EmployeePortalDocumentationInput } from '@/types/modules/employeePortalExecution';
import { assignmentSupabaseRepository } from '@/lib/assist/repositories/assignmentRepository.supabase';
import { resolveVisitMasterId } from '@/lib/assist/visitRecurrenceExpansion';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { transitionAssistExecutionStatus } from './internal/transitionAssistExecutionStatus';
import { upsertAssistVisitExecutionState } from './assistVisitExecutionStatePersistence';
import { resolveAssistExecutionContext } from './resolveAssistExecutionContext';
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

  if (!ctx.visitTimes?.serviceStartedAt) {
    return assistWorkflowErrorToResult(
      createAssistWorkflowError('WORKFLOW_SERVICE_NOT_STARTED', {
        tenantId: ctx.tenantId,
        assignmentId: ctx.assignmentId,
        operation: 'saveVisitDocumentation',
      }),
    );
  }

  const allowedStatuses = ['beendet', 'dokumentation_offen'];
  if (!allowedStatuses.includes(ctx.assignmentStatus)) {
    return assistWorkflowErrorToResult(
      createAssistWorkflowError(
        'WORKFLOW_INVALID_STATE',
        {
          tenantId: ctx.tenantId,
          assignmentId: ctx.assignmentId,
          operation: 'saveVisitDocumentation',
        },
        'Dokumentation erst nach Beendigung des Einsatzes möglich.',
      ),
    );
  }

  const docText = buildDocumentationText(documentation);
  let documentationPersisted = false;

  if (getServiceMode() === 'supabase') {
    const visitDoc = await persistDocumentationToAssistVisit(
      ctx.tenantId,
      ctx.assistVisitId,
      documentation,
      ctx.profileId,
    );
    if (!visitDoc.ok) {
      const legacy = await assignmentSupabaseRepository.completeWithDocumentation(
        ctx.tenantId,
        masterAssignmentId,
        docText,
        {
          actorProfileId: ctx.profileId ?? undefined,
          actorEmployeeId: ctx.employeeId,
        },
      );
      if (!legacy.ok) return { ok: false, error: legacy.error };
      documentationPersisted = true;
    } else {
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
  }

  let updatedCtx = ctx;
  if (ctx.assignmentStatus === 'beendet') {
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

  void upsertAssistVisitExecutionState(ctx.tenantId, masterAssignmentId, 'dokumentation_offen', {
    employeeId: ctx.employeeId,
    visitTimes: updatedCtx.visitTimes,
    documentationComplete: true,
  });

  const refreshed = await resolveAssistExecutionContext({
    tenantId: ctx.tenantId,
    assignmentId: ctx.assignmentId,
    employeeId: ctx.employeeId,
    profileId: ctx.profileId,
    roleKey: ctx.roleKey as RoleKey | null,
  });

  if (!refreshed.ok) return { ok: false, error: refreshed.error };

  const nextStep = refreshed.data.detail.requiresSignature ? 'signature' : 'finalize';

  return {
    ok: true,
    data: { ctx: refreshed.data, nextStep },
  };
}
