/**
 * ASSIST.WORKFLOW.1 — Read execution status for Office/Assist/Client portals.
 */
import type { ServiceResult } from '@/types';
import { fetchLatestVisitProof } from '@/lib/assist/assistVisitProofPersistenceService';
import { fetchValidVisitSignature } from '@/lib/assist/assistVisitSignaturePersistenceService';
import { fetchTimeEventsForVisit } from '@/lib/assist/assistTrackingPersistenceService';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { isSupabaseMissingTableError } from '@/lib/supabase/errors';
import { assignmentStatusToWorkflowStep } from './assistVisitStateMachine';
import { calculateVisitTimes } from './calculateVisitTimes';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import type { AssistWorkflowStep } from './types';

export type PortalExecutionStatusView = {
  assignmentId: string;
  visitId: string;
  workflowStep: AssistWorkflowStep;
  assignmentStatus: AssignmentStatus;
  hasDocumentation: boolean;
  hasSignature: boolean;
  hasProof: boolean;
  proofStatus: string | null;
  visitTimes: ReturnType<typeof calculateVisitTimes> | null;
  noShowNote: string | null;
};

export async function readExecutionStatusForPortals(
  tenantId: string,
  assignmentId: string,
  visitId: string,
  assignmentStatus: AssignmentStatus,
): Promise<ServiceResult<PortalExecutionStatusView>> {
  const supabase = getSupabaseClient();
  let hasDocumentation = false;
  let noShowNote: string | null = null;

  if (supabase) {
    const { data: docRow, error: docError } = await fromUnknownTable(
      supabase,
      'assist_visit_documentation',
    )
      .select('short_description, locked')
      .eq('tenant_id', tenantId)
      .eq('visit_id', visitId)
      .maybeSingle();

    if (!docError || !isSupabaseMissingTableError(docError)) {
      hasDocumentation = Boolean(
        (docRow as { short_description?: string } | null)?.short_description?.trim(),
      );
    }

    const { data: visitRow } = await fromUnknownTable(supabase, 'assist_visits')
      .select('error_message, employee_notes')
      .eq('tenant_id', tenantId)
      .eq('id', visitId)
      .maybeSingle();

    if (visitRow) {
      const row = visitRow as { error_message?: string; employee_notes?: string };
      noShowNote = row.error_message?.trim() ?? null;
      if (!hasDocumentation && row.employee_notes?.trim()) hasDocumentation = true;
    }
  }

  const sig = await fetchValidVisitSignature(tenantId, visitId);
  const proof = await fetchLatestVisitProof(tenantId, visitId);
  const events = await fetchTimeEventsForVisit(tenantId, visitId, 100);
  const visitTimes =
    events.ok && events.data.length
      ? calculateVisitTimes(
          events.data.map((e) => ({ eventType: e.eventType, occurredAt: e.occurredAt })),
          assignmentStatus,
        )
      : null;

  return {
    ok: true,
    data: {
      assignmentId,
      visitId,
      workflowStep: assignmentStatusToWorkflowStep(assignmentStatus),
      assignmentStatus,
      hasDocumentation,
      hasSignature: sig.ok && Boolean(sig.data),
      hasProof: proof.ok && Boolean(proof.data),
      proofStatus: proof.ok && proof.data ? proof.data.status : null,
      visitTimes,
      noShowNote,
    },
  };
}
