/**
 * Resolve documentation/signature requirements for live employee-portal assignments.
 * Reads assist_visits.service_key → assist_service_catalog_items when available.
 */
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import { resolveLiveAssignment, resolveLiveVisitId } from '@/features/liveTracking/resolveLiveAssignment';
import { fetchValidVisitSignature } from '@/lib/assist/assistVisitSignaturePersistenceService';
import { fetchLatestVisitProof } from '@/lib/assist/assistVisitProofPersistenceService';
import { resolveVisitMasterId } from '@/lib/assist/visitRecurrenceExpansion';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { isUuid } from '@/lib/validation/uuid';
import type { EmployeePortalAssignmentDetail } from '@/types/modules/employeePortalExecution';

export type EmployeePortalDocumentationFlags = {
  requiresSignature: boolean;
  requiresDocumentation: boolean;
  signatureStatus: EmployeePortalAssignmentDetail['signatureStatus'];
  /** True when client signed via Klient:innenportal after deferred release. */
  signatureCapturedViaClientPortal?: boolean;
};

const SIGNATURE_WORKFLOW_STATUSES: AssignmentStatus[] = [
  'beendet',
  'dokumentation_offen',
  'unterschrift_offen',
];

function signatureStatusFromState(input: {
  requiresSignature: boolean;
  status: AssignmentStatus;
  hasPersistedSignature: boolean;
  hasDeferredPortalSignature?: boolean;
  administrativeApprovalStatus?: 'pending_admin_approval' | 'rejected' | null;
  hasSubmittedDocumentation?: boolean;
}): EmployeePortalAssignmentDetail['signatureStatus'] {
  if (!input.requiresSignature) return 'none';
  if (input.hasPersistedSignature) return 'captured';
  if (input.hasDeferredPortalSignature) return 'deferred_to_client_portal';
  if (input.administrativeApprovalStatus === 'pending_admin_approval') {
    return 'administrative_approval_pending';
  }
  if (input.administrativeApprovalStatus === 'rejected') return 'administratively_rejected';
  if (SIGNATURE_WORKFLOW_STATUSES.includes(input.status)) return 'pending';
  if (input.hasSubmittedDocumentation) return 'pending';
  return 'none';
}

/** Align visit id resolution with execution context + persistence (employee-scoped). */
export async function resolvePortalSignatureVisitId(
  tenantId: string,
  assignmentId: string,
  employeeId?: string | null,
): Promise<string | null> {
  const masterId = resolveVisitMasterId(assignmentId);
  if (!isUuid(masterId)) return null;

  const supabase = getSupabaseClient();
  if (!supabase) return masterId;

  const resolved = await resolveLiveAssignment({
    tenantId,
    rawId: assignmentId,
    employeeId: employeeId ?? undefined,
  });
  if (resolved.ok && resolved.data?.visitId) {
    return resolved.data.visitId;
  }

  const liveVisitId = await resolveLiveVisitId(tenantId, assignmentId);
  if (liveVisitId) return liveVisitId;

  return masterId;
}

export async function hasPortalPersistedClientSignature(
  tenantId: string,
  assignmentId: string,
  employeeId?: string | null,
): Promise<boolean> {
  const visitId = await resolvePortalSignatureVisitId(tenantId, assignmentId, employeeId);
  if (!visitId) return false;
  const sig = await fetchValidVisitSignature(tenantId, visitId);
  return sig.ok && Boolean(sig.data);
}

export async function resolveEmployeePortalDocumentationFlags(
  tenantId: string,
  assignmentId: string,
  status: AssignmentStatus,
  documentationNotes?: string | null,
  employeeId?: string | null,
): Promise<EmployeePortalDocumentationFlags> {
  const requiresSignature = true;
  const requiresDocumentation = true;

  const supabase = getSupabaseClient();
  const visitId = supabase
    ? await resolvePortalSignatureVisitId(tenantId, assignmentId, employeeId)
    : resolveVisitMasterId(assignmentId);

  let visitDocumentationComplete = false;

  if (supabase && visitId) {
    try {
      const { data: visitRow, error: visitError } = await fromUnknownTable(supabase, 'assist_visits')
        .select('documentation_status')
        .eq('tenant_id', tenantId)
        .eq('id', visitId)
        .maybeSingle();

      if (!visitError && visitRow) {
        visitDocumentationComplete = String(visitRow.documentation_status ?? '') === 'complete';
      }
    } catch {
      // A transient visit lookup must not crash the active execution view.
    }
  }

  const hasSubmittedDocumentation =
    Boolean(documentationNotes?.trim()) || visitDocumentationComplete;

  let hasPersistedSignature = false;
  let hasDeferredPortalSignature = false;
  let signatureCapturedViaClientPortal = false;
  let administrativeApprovalStatus: 'pending_admin_approval' | 'rejected' | null = null;
  if (visitId) {
    try {
      const sig = await fetchValidVisitSignature(tenantId, visitId);
      const persistedSignature = sig.ok ? sig.data : null;
      hasPersistedSignature = Boolean(persistedSignature);

      const proof = await fetchLatestVisitProof(tenantId, visitId);
      if (proof.ok && proof.data) {
        if (
          !hasPersistedSignature &&
          proof.data.portalVisible === true &&
          proof.data.portalReleaseStatus === 'pending_client_signature' &&
          !proof.data.signatureId
        ) {
          hasDeferredPortalSignature = true;
        }
        signatureCapturedViaClientPortal =
          hasPersistedSignature &&
          (proof.data.payloadSnapshot?.signedViaClientPortal === true ||
            persistedSignature?.metadata?.signedVia === 'client_portal');
      }
      if (!hasPersistedSignature && !hasDeferredPortalSignature && supabase) {
        const { data: approval } = await fromUnknownTable(supabase, 'assist_visit_signature_requests')
          .select('status')
          .eq('tenant_id', tenantId)
          .eq('visit_id', visitId)
          .in('status', ['pending_admin_approval', 'rejected'])
          .order('requested_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (approval?.status === 'pending_admin_approval' || approval?.status === 'rejected') {
          administrativeApprovalStatus = approval.status;
        }
      }
    } catch {
      // A transient proof lookup must not hide documentation or crash an active visit.
    }
  }

  return {
    requiresSignature,
    requiresDocumentation,
    signatureStatus: signatureStatusFromState({
      requiresSignature,
      status,
      hasPersistedSignature,
      hasDeferredPortalSignature,
      administrativeApprovalStatus,
      hasSubmittedDocumentation,
    }),
    signatureCapturedViaClientPortal,
  };
}
