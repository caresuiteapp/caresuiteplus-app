import type { AssistExecutionContext } from './types';
import type { WorkflowWriteExpectation } from './workflowWriteExpectation';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { resolveAuthenticatedProfileId } from '@/lib/auth/resolveAuthenticatedProfile';
import { fetchValidVisitSignature } from '@/lib/assist/assistVisitSignaturePersistenceService';
import { resolveAssistExecutionContext } from './resolveAssistExecutionContext';
import { readFinalWorkflowProofConfirmation } from './readFinalWorkflowProofConfirmation';
import {
  didWorkflowActionReachPostcondition,
  type RecoverableWorkflowAction,
} from './workflowRecoveryVerification';
import {
  withWorkflowTimeout,
  WORKFLOW_CONTEXT_REFRESH_TIMEOUT_MS,
} from './internal/withWorkflowTimeout';

export type WorkflowActionConfirmation =
  | { state: 'confirmed'; context: AssistExecutionContext }
  | { state: 'pending'; context?: AssistExecutionContext }
  | { state: 'unavailable' };

/** A pending write is confirmed by a fresh, read-only server read, never by a cached UI fallback. */
export async function readWorkflowActionConfirmation(
  before: AssistExecutionContext,
  action: RecoverableWorkflowAction,
  expected?: WorkflowWriteExpectation,
): Promise<WorkflowActionConfirmation> {
  try {
    const result = await withWorkflowTimeout(
      resolveAssistExecutionContext({
        tenantId: before.tenantId,
        assignmentId: before.assignmentId,
        employeeId: before.employeeId,
        profileId: before.profileId,
        roleKey: before.roleKey as import('@/types').RoleKey | null,
        autoRepair: false,
      }),
      WORKFLOW_CONTEXT_REFRESH_TIMEOUT_MS,
      'workflowConfirmationReadback',
    );
    if (!result.ok) return { state: 'unavailable' };
    if (!didWorkflowActionReachPostcondition(action, before, result.data)) return { state: 'pending', context: result.data };
    if (action === 'finalize' || action === 'finalize_deferred') {
      const proof = await withWorkflowTimeout(readFinalWorkflowProofConfirmation(before, result.data, action === 'finalize_deferred'),
        WORKFLOW_CONTEXT_REFRESH_TIMEOUT_MS, 'workflowFinalProofReadback');
      return proof === 'confirmed' ? { state: 'confirmed', context: result.data }
        : proof === 'pending' ? { state: 'pending', context: result.data } : { state: 'unavailable' };
    }
    if (action === 'save_documentation' || action === 'save_signature') {
      // A submitted/captured flag can belong to an earlier version. It never
      // proves that this correction or replacement reached the server.
      if (!expected || (action === 'save_documentation' ? expected.kind !== 'documentation' : expected.kind !== 'signature'))
        return { state: 'pending', context: result.data };
      const confirmed = await withWorkflowTimeout((async () => {
        const actor = await resolveAuthenticatedProfileId(before.tenantId);
        if (!actor.ok) return 'unavailable' as const;
        if (expected.kind === 'signature') {
          const signature = await fetchValidVisitSignature(before.tenantId, before.assistVisitId);
          if (!signature.ok || signature.tableMissing) return 'unavailable' as const;
          const row = signature.data;
          const matches = row && row.tenantId === before.tenantId && row.visitId === before.assistVisitId
            && row.isValid && Boolean(row.storagePath) && row.signedByProfileId === actor.data
            && row.signatureHash === expected.signature.signatureHash && row.payloadHash === expected.signature.payloadHash
            && row.signerName === expected.signature.signerName && row.signerRole === expected.signature.signerRole;
          return matches ? 'confirmed' as const : 'pending' as const;
        }
        const client = getSupabaseClient();
        if (!client) return 'unavailable' as const;
        const { data: row, error } = await fromUnknownTable(client, 'assist_visit_documentation')
          .select('tenant_id, visit_id, submitted_by, submitted_at, short_description, special_notes, deviations, deviation_justification, referral_required, emergency_or_problem, sis_notes, vitals_summary, body_map_notes, medication_notes, care_report_notes, photo_references')
          .eq('tenant_id', before.tenantId).eq('visit_id', before.assistVisitId).maybeSingle();
        if (error) return 'unavailable' as const;
        const fields = Object.keys(expected.content) as (keyof typeof expected.content)[];
        const matches = row && row.tenant_id === before.tenantId && row.visit_id === before.assistVisitId
          && row.submitted_by === actor.data && Boolean(row.submitted_at)
          && fields.every((field) => JSON.stringify(row[field]) === JSON.stringify(expected.content[field]));
        return matches ? 'confirmed' as const : 'pending' as const;
      })(), WORKFLOW_CONTEXT_REFRESH_TIMEOUT_MS, 'workflowWriteVersionReadback');
      const context = confirmed === 'confirmed' && expected.kind === 'documentation'
        ? { ...result.data, detail: { ...result.data.detail, documentationNotes: expected.content.short_description } }
        : result.data;
      return confirmed === 'confirmed' ? { state: 'confirmed', context }
        : confirmed === 'pending' ? { state: 'pending', context: result.data } : { state: 'unavailable' };
    }
    return { state: 'confirmed', context: result.data };
  } catch {
    return { state: 'unavailable' };
  }
}
