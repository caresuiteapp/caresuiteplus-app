/**
 * Resolve documentation/signature requirements for live employee-portal assignments.
 * Reads assist_visits.service_key → assist_service_catalog_items when available.
 */
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import { resolveLiveVisitId } from '@/features/liveTracking/resolveLiveAssignment';
import { fetchValidVisitSignature } from '@/lib/assist/assistVisitSignaturePersistenceService';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import type { EmployeePortalAssignmentDetail } from '@/types/modules/employeePortalExecution';

export type EmployeePortalDocumentationFlags = {
  requiresSignature: boolean;
  requiresDocumentation: boolean;
  signatureStatus: EmployeePortalAssignmentDetail['signatureStatus'];
};

const SIGNATURE_WORKFLOW_STATUSES: AssignmentStatus[] = ['dokumentation_offen', 'unterschrift_offen'];

function signatureStatusFromState(input: {
  requiresSignature: boolean;
  status: AssignmentStatus;
  hasPersistedSignature: boolean;
}): EmployeePortalAssignmentDetail['signatureStatus'] {
  if (!input.requiresSignature) return 'none';
  if (input.hasPersistedSignature) return 'captured';
  if (SIGNATURE_WORKFLOW_STATUSES.includes(input.status)) return 'pending';
  return 'none';
}

export async function resolveEmployeePortalDocumentationFlags(
  tenantId: string,
  assignmentId: string,
  status: AssignmentStatus,
  documentationNotes?: string | null,
): Promise<EmployeePortalDocumentationFlags> {
  let requiresSignature = status === 'unterschrift_offen';
  let requiresDocumentation = true;

  const supabase = getSupabaseClient();
  const visitId = supabase ? await resolveLiveVisitId(tenantId, assignmentId) : null;

  if (supabase && visitId) {
    const { data: visitRow, error: visitError } = await fromUnknownTable(supabase, 'assist_visits')
      .select('service_key, proof_status')
      .eq('tenant_id', tenantId)
      .eq('id', visitId)
      .maybeSingle();

    if (!visitError && visitRow) {
      const proofStatus = String(visitRow.proof_status ?? '');
      if (proofStatus === 'pending' || proofStatus === 'signed') {
        requiresSignature = true;
      }

      const serviceKey = String(visitRow.service_key ?? '').trim();
      if (serviceKey) {
        const { data: catalogRow, error: catalogError } = await fromUnknownTable(
          supabase,
          'assist_service_catalog_items',
        )
          .select('requires_signature, requires_documentation')
          .eq('tenant_id', tenantId)
          .eq('service_key', serviceKey)
          .maybeSingle();

        if (catalogError && isMissingTableError(catalogError)) {
          // catalog table not deployed — keep status heuristic below
        } else if (!catalogError && catalogRow) {
          requiresSignature = Boolean(catalogRow.requires_signature);
          requiresDocumentation = catalogRow.requires_documentation !== false;
        }
      }
    }
  }

  if (SIGNATURE_WORKFLOW_STATUSES.includes(status) && Boolean(documentationNotes?.trim())) {
    requiresSignature = true;
  }

  let hasPersistedSignature = false;
  if (visitId) {
    const sig = await fetchValidVisitSignature(tenantId, visitId);
    hasPersistedSignature = sig.ok && Boolean(sig.data);
  }

  return {
    requiresSignature,
    requiresDocumentation,
    signatureStatus: signatureStatusFromState({
      requiresSignature,
      status,
      hasPersistedSignature,
    }),
  };
}
