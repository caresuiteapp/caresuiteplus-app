/**
 * ASSIST.WORKFLOW.1 — Save visit documentation to DB.
 */
import type { ServiceResult } from '@/types';
import type { RoleKey } from '@/types';
import type { EmployeePortalDocumentationInput } from '@/types/modules/employeePortalExecution';
import { assignmentSupabaseRepository } from '@/lib/assist/repositories/assignmentRepository.supabase';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
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

  await fromUnknownTable(supabase, 'assist_visits')
    .update({
      documentation_status: 'complete',
      employee_notes: buildDocumentationText(doc),
      updated_at: now,
    })
    .eq('tenant_id', tenantId)
    .eq('id', visitId);

  return { ok: true, data: undefined };
}

export async function saveVisitDocumentation(
  input: SaveVisitDocumentationInput,
): Promise<ServiceResult<AssistExecutionContext>> {
  const { ctx, documentation } = input;

  if (!documentation.shortDescription.trim()) {
    return assistWorkflowErrorToResult(
      createAssistWorkflowError('AWF_DOCUMENTATION_REQUIRED', {
        tenantId: ctx.tenantId,
        assignmentId: ctx.assignmentId,
        operation: 'saveVisitDocumentation',
      }, 'Kurzbeschreibung ist erforderlich.'),
    );
  }

  if (documentation.deviations?.trim() && !documentation.deviationJustification?.trim()) {
    return assistWorkflowErrorToResult(
      createAssistWorkflowError('AWF_VALIDATION', {
        tenantId: ctx.tenantId,
        assignmentId: ctx.assignmentId,
        operation: 'saveVisitDocumentation',
      }, 'Abweichungen müssen begründet werden.'),
    );
  }

  const allowedStatuses = ['beendet', 'dokumentation_offen', 'gestartet'];
  if (!allowedStatuses.includes(ctx.assignmentStatus)) {
    return assistWorkflowErrorToResult(
      createAssistWorkflowError('AWF_INVALID_TRANSITION', {
        tenantId: ctx.tenantId,
        assignmentId: ctx.assignmentId,
        operation: 'saveVisitDocumentation',
      }, 'Dokumentation erst nach Beendigung des Einsatzes möglich.'),
    );
  }

  if (getServiceMode() === 'supabase') {
    const visitDoc = await persistDocumentationToAssistVisit(
      ctx.tenantId,
      ctx.assistVisitId,
      documentation,
      ctx.profileId,
    );
    if (!visitDoc.ok) {
      const text = buildDocumentationText(documentation);
      const legacy = await assignmentSupabaseRepository.completeWithDocumentation(
        ctx.tenantId,
        ctx.assignmentId,
        text,
        {
          actorProfileId: ctx.profileId ?? ctx.employeeId,
          actorEmployeeId: ctx.employeeId,
        },
      );
      if (!legacy.ok) return { ok: false, error: legacy.error };
    } else {
      const text = buildDocumentationText(documentation);
      await fromUnknownTable(getSupabaseClient()!, 'assignments')
        .update({
          documentation_notes: text,
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', ctx.tenantId)
        .eq('id', ctx.assignmentId);
      if (ctx.assignmentStatus === 'beendet') {
        await assignmentSupabaseRepository.updateStatus(
          ctx.tenantId,
          ctx.assignmentId,
          'dokumentation_offen',
          {
            actorProfileId: ctx.profileId ?? ctx.employeeId,
            actorEmployeeId: ctx.employeeId,
          },
        );
      }
    }
  }

  return resolveAssistExecutionContext({
    tenantId: ctx.tenantId,
    assignmentId: ctx.assignmentId,
    employeeId: ctx.employeeId,
    profileId: ctx.profileId,
    roleKey: ctx.roleKey as RoleKey | null,
  });
}
