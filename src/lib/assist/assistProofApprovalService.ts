/**
 * Assist visit proof approval workflow — review, approve, reject, portal release.
 * Status: draft → pending_review → approved → exported (PDF) → portal released.
 */

import type { RoleKey, ServiceResult } from '@/types';
import type { AssistVisitProofRow } from '@/types/assistExecutionPersistence';
import { generateAssistProofPdf } from '@/lib/assist/assistProofPdfService';
import { consumeOnProofApproval } from '@/lib/assist/clientBudgetTransactionService';
import { fetchVisitForBilling } from '@/lib/billing/clientProofBillingMapper';
import {
  fetchVisitProofById,
  updateVisitProofRow,
} from '@/lib/assist/assistVisitProofPersistenceService';
import { enforcePermission } from '@/lib/permissions';
import {
  ASSIST_PROOF_PORTAL_RELEASE_LABELS,
  ASSIST_PROOF_STATUS_LABELS,
} from '@/lib/assist/assistProofLabels';
import { invalidatePortalProofCache } from '@/lib/portal/portalProofCacheSignal';

export { ASSIST_PROOF_PORTAL_RELEASE_LABELS, ASSIST_PROOF_STATUS_LABELS };

function denied<T>(roleKey: RoleKey | null | undefined, key: 'assist.records.view' | 'assist.records.sign'): ServiceResult<T> | null {
  return enforcePermission<T>(roleKey, key);
}

async function loadProof(
  tenantId: string,
  proofId: string,
): Promise<ServiceResult<AssistVisitProofRow>> {
  const loaded = await fetchVisitProofById(tenantId, proofId);
  if (!loaded.ok) return loaded;
  if (!loaded.data) return { ok: false, error: 'Leistungsnachweis nicht gefunden.' };
  return { ok: true, data: loaded.data };
}

export async function submitProofForReview(
  tenantId: string,
  proofId: string,
  actorProfileId?: string | null,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<AssistVisitProofRow>> {
  const perm = denied<AssistVisitProofRow>(actorRoleKey, 'assist.records.view');
  if (perm) return perm;

  const loaded = await loadProof(tenantId, proofId);
  if (!loaded.ok) return loaded;

  if (loaded.data.status !== 'draft' && loaded.data.status !== 'rejected') {
    return { ok: false, error: 'Nur Entwürfe können zur Prüfung eingereicht werden.' };
  }

  return updateVisitProofRow(tenantId, proofId, {
    status: 'pending_review',
    rejection_reason: null,
    updated_by: actorProfileId ?? null,
  });
}

export async function approveAssistProof(
  tenantId: string,
  proofId: string,
  actorProfileId?: string | null,
  actorRoleKey?: RoleKey | null,
  approvalNote?: string | null,
): Promise<ServiceResult<AssistVisitProofRow>> {
  const perm = denied<AssistVisitProofRow>(actorRoleKey, 'assist.records.sign');
  if (perm) return perm;

  const loaded = await loadProof(tenantId, proofId);
  if (!loaded.ok) return loaded;

  if (loaded.data.status !== 'pending_review') {
    return { ok: false, error: 'Nur zur Prüfung eingereichte Nachweise können freigegeben werden.' };
  }

  const now = new Date().toISOString();
  const result = await updateVisitProofRow(tenantId, proofId, {
    status: 'approved',
    approved_at: now,
    approved_by: actorProfileId ?? null,
    approval_note: approvalNote?.trim() || null,
    rejection_reason: null,
    updated_by: actorProfileId ?? null,
  });

  if (result.ok) {
    const visit = await fetchVisitForBilling(tenantId, loaded.data.visitId);
    if (visit?.client_id) {
      await consumeOnProofApproval({
        tenantId,
        proofId,
        visitId: loaded.data.visitId,
        clientId: visit.client_id,
        amountCents: visit.budget_amount_cents,
        createdBy: actorProfileId,
      });
    }
  }

  return result;
}

export async function rejectAssistProof(
  tenantId: string,
  proofId: string,
  rejectionReason: string,
  actorProfileId?: string | null,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<AssistVisitProofRow>> {
  const perm = denied<AssistVisitProofRow>(actorRoleKey, 'assist.records.sign');
  if (perm) return perm;

  if (!rejectionReason.trim()) {
    return { ok: false, error: 'Ablehnungsgrund ist erforderlich.' };
  }

  const loaded = await loadProof(tenantId, proofId);
  if (!loaded.ok) return loaded;

  if (loaded.data.status !== 'pending_review') {
    return { ok: false, error: 'Nur zur Prüfung eingereichte Nachweise können abgelehnt werden.' };
  }

  return updateVisitProofRow(tenantId, proofId, {
    status: 'rejected',
    rejection_reason: rejectionReason.trim(),
    approved_at: null,
    approved_by: null,
    updated_by: actorProfileId ?? null,
  });
}

export type AssistProofPortalReleaseMode = 'full' | 'restricted';

async function releaseApprovedProofToPortal(
  tenantId: string,
  proofId: string,
  actorProfileId: string | null | undefined,
  releaseMode: AssistProofPortalReleaseMode,
): Promise<ServiceResult<AssistVisitProofRow>> {
  const loaded = await loadProof(tenantId, proofId);
  if (!loaded.ok) return loaded;

  if (loaded.data.status !== 'approved' && loaded.data.status !== 'exported') {
    return {
      ok: false,
      error: 'Nur freigegebene Nachweise können ins Klientenportal veröffentlicht werden.',
    };
  }

  let proof = loaded.data;
  if (!proof.pdfStoragePath) {
    const pdfResult = await generateAssistProofPdf(tenantId, proofId);
    if (!pdfResult.ok) return pdfResult;
    proof = pdfResult.data;
  }

  const now = new Date().toISOString();
  const result = await updateVisitProofRow(tenantId, proofId, {
    status: 'exported',
    portal_visible: true,
    released_to_portal_at: now,
    portal_release_status:
      releaseMode === 'restricted' ? 'pending_client_signature' : 'released',
    updated_by: actorProfileId ?? null,
  });
  if (result.ok) invalidatePortalProofCache();
  return result;
}

export async function releaseAssistProofToPortal(
  tenantId: string,
  proofId: string,
  actorProfileId?: string | null,
  actorRoleKey?: RoleKey | null,
  releaseMode: AssistProofPortalReleaseMode = 'full',
): Promise<ServiceResult<AssistVisitProofRow>> {
  const perm = denied<AssistVisitProofRow>(actorRoleKey, 'assist.records.sign');
  if (perm) return perm;

  return releaseApprovedProofToPortal(tenantId, proofId, actorProfileId, releaseMode);
}

/** Approve pending proof and release to client portal in one step. */
export async function approveAndReleaseAssistProof(
  tenantId: string,
  proofId: string,
  actorProfileId: string | null | undefined,
  actorRoleKey: RoleKey | null | undefined,
  options: {
    approvalNote?: string | null;
    releaseMode: AssistProofPortalReleaseMode;
  },
): Promise<ServiceResult<AssistVisitProofRow>> {
  const approved = await approveAssistProof(
    tenantId,
    proofId,
    actorProfileId,
    actorRoleKey,
    options.approvalNote,
  );
  if (!approved.ok) return approved;

  return releaseApprovedProofToPortal(
    tenantId,
    proofId,
    actorProfileId,
    options.releaseMode,
  );
}

export async function revokeAssistProofPortalRelease(
  tenantId: string,
  proofId: string,
  actorProfileId?: string | null,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<AssistVisitProofRow>> {
  const perm = denied<AssistVisitProofRow>(actorRoleKey, 'assist.records.sign');
  if (perm) return perm;

  const loaded = await loadProof(tenantId, proofId);
  if (!loaded.ok) return loaded;

  if (
    (loaded.data.portalReleaseStatus !== 'released' &&
      loaded.data.portalReleaseStatus !== 'pending_client_signature') ||
    !loaded.data.portalVisible
  ) {
    return { ok: false, error: 'Nachweis ist nicht im Klientenportal veröffentlicht.' };
  }

  const result = await updateVisitProofRow(tenantId, proofId, {
    portal_visible: false,
    portal_release_status: 'revoked',
    updated_by: actorProfileId ?? null,
  });
  if (result.ok) invalidatePortalProofCache();
  return result;
}
