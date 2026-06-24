/**
 * Assist visit proof approval workflow — review, approve, reject, portal release.
 * Status: draft → pending_review → approved → exported (PDF) → portal released.
 */

import type { RoleKey, ServiceResult } from '@/types';
import type { AssistVisitProofRow } from '@/types/assistExecutionPersistence';
import { generateAssistProofPdf } from '@/lib/assist/assistProofPdfService';
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
  return updateVisitProofRow(tenantId, proofId, {
    status: 'approved',
    approved_at: now,
    approved_by: actorProfileId ?? null,
    approval_note: approvalNote?.trim() || null,
    rejection_reason: null,
    updated_by: actorProfileId ?? null,
  });
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

export async function releaseAssistProofToPortal(
  tenantId: string,
  proofId: string,
  actorProfileId?: string | null,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<AssistVisitProofRow>> {
  const perm = denied<AssistVisitProofRow>(actorRoleKey, 'assist.records.sign');
  if (perm) return perm;

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
    portal_release_status: 'released',
    updated_by: actorProfileId ?? null,
  });
  if (result.ok) invalidatePortalProofCache();
  return result;
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

  if (loaded.data.portalReleaseStatus !== 'released' || !loaded.data.portalVisible) {
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
