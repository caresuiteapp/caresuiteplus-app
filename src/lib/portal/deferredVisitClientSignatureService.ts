/**
 * Deferred client signature — employee portal finalizes without on-device signature;
 * signature request is released to Klient:innenportal for later signing.
 */
import type { ServiceResult } from '@/types';
import type { AssistVisitProofRow } from '@/types/assistExecutionPersistence';
import { buildServiceRecordSnapshot } from '@/features/assistWorkflow/buildServiceRecordHtml';
import type { AssistExecutionContext } from '@/features/assistWorkflow/types';
import {
  computeVisitProofPayloadHash,
  fetchLatestVisitProof,
  persistVisitProof,
  updateVisitProofRow,
} from '@/lib/assist/assistVisitProofPersistenceService';
import { invalidatePortalProofCache } from '@/lib/portal/portalProofCacheSignal';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { resolvePortalSignatureVisitId } from './resolveEmployeePortalSignatureRequirement';

const PROOF_CATEGORY = 'leistungsnachweis';

export type DeferredClientSignatureReleaseResult = {
  proofId: string;
  clientDocumentId: string | null;
};

/** True when visit has a portal-visible proof awaiting client signature. */
export async function hasPortalDeferredClientSignature(
  tenantId: string,
  assignmentId: string,
  employeeId?: string | null,
): Promise<boolean> {
  if (getServiceMode() !== 'supabase') return false;

  const visitId = await resolvePortalSignatureVisitId(tenantId, assignmentId, employeeId);
  if (!visitId) return false;

  const proof = await fetchLatestVisitProof(tenantId, visitId);
  if (!proof.ok || !proof.data) return false;

  return (
    proof.data.portalVisible === true &&
    proof.data.portalReleaseStatus === 'pending_client_signature' &&
    !proof.data.signatureId
  );
}

async function upsertDeferredSignatureClientPortalDocument(
  tenantId: string,
  proof: AssistVisitProofRow,
  clientId: string,
  options?: { actorProfileId?: string | null },
): Promise<ServiceResult<{ clientDocumentId: string }>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const snapshot = proof.payloadSnapshot ?? {};
  const title =
    String(snapshot.title ?? snapshot.serviceName ?? 'Leistungsnachweis').trim() ||
    'Leistungsnachweis';
  const now = new Date().toISOString();

  const { data: existing, error: lookupError } = await fromUnknownTable(supabase, 'client_documents')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('id', proof.id)
    .maybeSingle();

  if (lookupError && !isMissingTableError(lookupError)) {
    return { ok: false, error: lookupError.message };
  }

  const row = {
    title: `${title} — Unterschrift ausstehend`,
    file_name: `unterschrift-${proof.id}.pending`,
    storage_path: null,
    portal_visible: true,
    status: 'aktiv',
    category: PROOF_CATEGORY,
    signed_at: null,
    signature_required: true,
    updated_at: now,
  };

  if (existing) {
    const { error } = await fromUnknownTable(supabase, 'client_documents')
      .update(row)
      .eq('tenant_id', tenantId)
      .eq('id', proof.id);

    if (error) return { ok: false, error: error.message };
    return { ok: true, data: { clientDocumentId: proof.id } };
  }

  const { error: insertError } = await fromUnknownTable(supabase, 'client_documents').insert({
    id: proof.id,
    tenant_id: tenantId,
    client_id: clientId,
    mime_type: 'application/pdf',
    sensitivity: 'care',
    source: 'assist_visit_proof',
    uploaded_by: options?.actorProfileId ?? null,
    ...row,
  });

  if (insertError) return { ok: false, error: insertError.message };
  return { ok: true, data: { clientDocumentId: proof.id } };
}

/**
 * Create or update a draft proof and release a signature request to the client portal.
 * No PDF / Leistungsnachweis is generated — that happens after the client signs (Phase 2+).
 */
export async function releaseDeferredClientSignatureRequest(
  ctx: AssistExecutionContext,
  documentationText?: string | null,
): Promise<ServiceResult<DeferredClientSignatureReleaseResult>> {
  if (getServiceMode() !== 'supabase') {
    return { ok: true, data: { proofId: 'demo-proof', clientDocumentId: null } };
  }

  const visitId = await resolvePortalSignatureVisitId(
    ctx.tenantId,
    ctx.assignmentId,
    ctx.employeeId,
  );
  if (!visitId) {
    return { ok: false, error: 'Einsatzbesuch konnte nicht zugeordnet werden.' };
  }

  const docText =
    documentationText?.trim() ||
    (ctx.detail.documentationStatus === 'submitted' ? 'submitted' : '');

  const snapshot = {
    ...buildServiceRecordSnapshot({
      detail: ctx.detail,
      visitTimes: ctx.visitTimes,
      documentationText: docText,
      visitId,
      employeeId: ctx.employeeId,
      serviceName: ctx.detail.title,
    }),
    signatureDeferredToClientPortal: true,
    signatureDeferredAt: new Date().toISOString(),
    signatureDeferredBy: ctx.profileId ?? ctx.employeeId ?? null,
  };

  let proofId: string;
  const existing = await fetchLatestVisitProof(ctx.tenantId, visitId);
  if (existing.ok && existing.data) {
    proofId = existing.data.id;
    const payloadHash = await computeVisitProofPayloadHash(snapshot);
    const updated = await updateVisitProofRow(ctx.tenantId, proofId, {
      payload_snapshot: snapshot,
      payload_hash: payloadHash,
      signature_id: null,
    });
    if (!updated.ok) {
      return { ok: false, error: updated.error ?? 'Unterschriftsanfrage konnte nicht gespeichert werden.' };
    }
  } else {
    const created = await persistVisitProof(
      ctx.tenantId,
      {
        visitId,
        payloadSnapshot: snapshot,
        status: 'draft',
      },
      ctx.profileId ?? ctx.employeeId ?? null,
    );
    if (!created.ok || !created.data) {
      return { ok: false, error: created.error ?? 'Unterschriftsanfrage konnte nicht angelegt werden.' };
    }
    proofId = created.data.id;
  }

  const now = new Date().toISOString();
  const released = await updateVisitProofRow(ctx.tenantId, proofId, {
    portal_visible: true,
    portal_release_status: 'pending_client_signature',
    released_to_portal_at: now,
    updated_by: ctx.profileId ?? null,
  });
  if (!released.ok || !released.data) {
    return { ok: false, error: released.error ?? 'Portal-Freigabe fehlgeschlagen.' };
  }

  const clientId = ctx.detail.clientId;
  if (!clientId) {
    return { ok: false, error: 'Klient:in konnte dem Einsatz nicht zugeordnet werden.' };
  }

  const documentSync = await upsertDeferredSignatureClientPortalDocument(
    ctx.tenantId,
    released.data,
    clientId,
    { actorProfileId: ctx.profileId ?? null },
  );
  if (!documentSync.ok) {
    return { ok: false, error: documentSync.error ?? 'Klient:innenportal-Eintrag fehlgeschlagen.' };
  }

  invalidatePortalProofCache();

  return {
    ok: true,
    data: {
      proofId,
      clientDocumentId: documentSync.data.clientDocumentId,
    },
  };
}
