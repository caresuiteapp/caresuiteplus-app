/**
 * ASSIST.PERMISSIONS.2 — assist_visit_execution_state upsert for portal workflow steps.
 */
import type { ServiceResult } from '@/types';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import { resolveAssistVisitIdForPersistence } from '@/lib/assist/assistExecutionVisitResolver';
import { getSupabaseClient } from '@/lib/supabase/client';
import { assistWorkflowErrorFromSupabase, assistWorkflowErrorToResult } from '@/features/assistWorkflow/assistWorkflowErrors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { getServiceMode } from '@/lib/services/mode';

const TABLE = 'assist_visit_execution_state';

export type VisitExecutionStep =
  | 'consent'
  | 'en_route'
  | 'arrived'
  | 'in_service'
  | 'paused'
  | 'tasks'
  | 'documentation'
  | 'signature'
  | 'finalize'
  | 'completed'
  | 'no_show'
  | 'locked';

function assignmentStatusToStep(status: AssignmentStatus): VisitExecutionStep {
  switch (status) {
    case 'unterwegs':
      return 'en_route';
    case 'angekommen':
      return 'arrived';
    case 'gestartet':
      return 'in_service';
    case 'pausiert':
      return 'paused';
    case 'beendet':
    case 'dokumentation_offen':
      return 'documentation';
    case 'unterschrift_offen':
      return 'signature';
    case 'abgeschlossen':
      return 'completed';
    case 'nicht_erschienen':
      return 'no_show';
    case 'storniert':
      return 'locked';
    default:
      return 'consent';
  }
}

/** Idempotent upsert of workflow step snapshot — safe on repeat arrival taps. */
export async function upsertAssistVisitExecutionState(
  tenantId: string,
  assignmentOrVisitId: string,
  assignmentStatus: AssignmentStatus,
  options?: { employeeId?: string | null },
): Promise<ServiceResult<{ visitId: string; currentStep: VisitExecutionStep }>> {
  if (getServiceMode() !== 'supabase') {
    return { ok: true, data: { visitId: assignmentOrVisitId, currentStep: assignmentStatusToStep(assignmentStatus) } };
  }

  const visitId = await resolveAssistVisitIdForPersistence(tenantId, assignmentOrVisitId);
  if (!visitId) {
    return { ok: true, data: { visitId: assignmentOrVisitId, currentStep: assignmentStatusToStep(assignmentStatus) } };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return assistWorkflowErrorToResult(
      assistWorkflowErrorFromSupabase(null, {
        tenantId,
        assignmentId: assignmentOrVisitId,
        employeeId: options?.employeeId,
        operation: 'upsertAssistVisitExecutionState',
      }),
    );
  }

  const currentStep = assignmentStatusToStep(assignmentStatus);
  const now = new Date().toISOString();

  const { error } = await fromUnknownTable(supabase, TABLE).upsert(
    {
      tenant_id: tenantId,
      visit_id: visitId,
      current_step: currentStep,
      assignment_status: assignmentStatus,
      updated_at: now,
    },
    { onConflict: 'tenant_id,visit_id' },
  );

  if (error) {
    if (error.code === '42P01') {
      return { ok: true, data: { visitId, currentStep } };
    }
    return assistWorkflowErrorToResult(
      assistWorkflowErrorFromSupabase(error, {
        tenantId,
        assignmentId: assignmentOrVisitId,
        assistVisitId: visitId,
        employeeId: options?.employeeId,
        operation: 'upsertAssistVisitExecutionState',
      }),
    );
  }

  return { ok: true, data: { visitId, currentStep } };
}
