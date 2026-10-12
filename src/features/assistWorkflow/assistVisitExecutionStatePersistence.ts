/**
 * ASSIST.PERMISSIONS.2 / ASSIST.WORKFLOW.2 — assist_visit_execution_state upsert for portal workflow steps.
 */
import type { ServiceResult } from '@/types';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import { resolveAssistVisitIdForPersistence } from '@/lib/assist/assistExecutionVisitResolver';
import { getSupabaseClient } from '@/lib/supabase/client';
import { assistWorkflowErrorFromSupabase, assistWorkflowErrorToResult } from '@/features/assistWorkflow/assistWorkflowErrors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { getServiceMode } from '@/lib/services/mode';
import type { VisitTimesSummary } from './calculateVisitTimes';

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

export type UpsertExecutionStateOptions = {
  employeeId?: string | null;
  visitTimes?: VisitTimesSummary | null;
  documentationComplete?: boolean;
  signatureComplete?: boolean;
  proofGenerated?: boolean;
  finalizedAt?: string | null;
};

/** Idempotent upsert of workflow step snapshot — safe on repeat arrival taps. */
export async function upsertAssistVisitExecutionState(
  tenantId: string,
  assignmentOrVisitId: string,
  assignmentStatus: AssignmentStatus,
  options?: UpsertExecutionStateOptions,
): Promise<ServiceResult<{ visitId: string; currentStep: VisitExecutionStep; updatedAt?: string }>> {
  if (getServiceMode() !== 'supabase') {
    return { ok: true, data: { visitId: assignmentOrVisitId, currentStep: assignmentStatusToStep(assignmentStatus) } };
  }

  const visitId = await resolveAssistVisitIdForPersistence(tenantId, assignmentOrVisitId);
  if (!visitId) {
    return { ok: false, error: 'Die Durchführungsfassung konnte keinem kanonischen Einsatz zugeordnet werden.' };
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
  const times = options?.visitTimes;

  const payload: Record<string, unknown> = {
    tenant_id: tenantId,
    visit_id: visitId,
    current_step: currentStep,
    assignment_status: assignmentStatus,
    updated_at: now,
  };

  if (times?.driveStartedAt) payload.travel_started_at = times.driveStartedAt;
  if (times?.arrivedAt) payload.travel_ended_at = times.arrivedAt;
  if (times?.serviceStartedAt) payload.service_started_at = times.serviceStartedAt;
  if (times?.serviceEndedAt) payload.service_ended_at = times.serviceEndedAt;
  if (options?.documentationComplete != null) payload.documentation_complete = options.documentationComplete;
  if (options?.signatureComplete != null) payload.signature_complete = options.signatureComplete;
  if (options?.proofGenerated != null) payload.proof_generated = options.proofGenerated;
  if (options?.finalizedAt != null) payload.finalized_at = options.finalizedAt;

  const { data: receipt, error } = await fromUnknownTable(supabase, TABLE).upsert(payload, {
    onConflict: 'tenant_id,visit_id',
  }).select('*').maybeSingle();

  if (error) {
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

  // A trigger may retain a newer step; a 2xx/zero-row response is never a
  // receipt for this snapshot. Do not silently drop required schema fields.
  const matches = receipt && Object.entries(payload).every(([field, expected]) => {
    if (field === 'updated_at') return typeof receipt[field] === 'string' && Number.isFinite(Date.parse(receipt[field]));
    if (field.endsWith('_at') && typeof expected === 'string')
      return typeof receipt[field] === 'string' && Date.parse(receipt[field]) === Date.parse(expected);
    return receipt[field] === expected;
  });
  if (!matches) return { ok: false, error: 'Die gespeicherte Durchführungsfassung wurde noch nicht bestätigt. Bitte den aktuellen Einsatzstatus erneut prüfen.' };

  return { ok: true, data: { visitId, currentStep, updatedAt: receipt.updated_at as string } };
}
