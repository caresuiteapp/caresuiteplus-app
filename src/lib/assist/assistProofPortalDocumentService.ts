/**
 * Mirror released assist visit proofs into client_documents for Klientenportal Nachweise/Dokumente.
 */

import type { ServiceResult } from '@/types';
import type { AssistVisitProofRow } from '@/types/assistExecutionPersistence';
import { buildAssistProofPdfPayload } from '@/lib/assist/assistProofPdfPayload';
import { fetchVisitForBilling } from '@/lib/billing/clientProofBillingMapper';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';

const PROOF_CATEGORY = 'leistungsnachweis';

function readSnapshotString(snapshot: Record<string, unknown>, key: string): string | null {
  const value = snapshot[key];
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

async function resolveClientId(
  tenantId: string,
  proof: AssistVisitProofRow,
): Promise<string | null> {
  const fromSnapshot = readSnapshotString(proof.payloadSnapshot ?? {}, 'clientId');
  if (fromSnapshot) return fromSnapshot;

  const visit = await fetchVisitForBilling(tenantId, proof.visitId);
  return visit?.client_id ?? null;
}

/** Upsert client_documents row for a portal-released assist visit proof. */
export async function upsertAssistProofClientPortalDocument(
  tenantId: string,
  proof: AssistVisitProofRow,
  options?: {
    actorProfileId?: string | null;
    signatureRequired?: boolean;
  },
): Promise<ServiceResult<{ clientDocumentId: string }>> {
  if (!proof.pdfStoragePath?.trim()) {
    return { ok: false, error: 'PDF muss vor Portal-Freigabe erzeugt werden.' };
  }

  const clientId = await resolveClientId(tenantId, proof);
  if (!clientId) {
    return { ok: false, error: 'Klient:in konnte dem Nachweis nicht zugeordnet werden.' };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const payload = buildAssistProofPdfPayload(proof);
  const signedAt = readSnapshotString(proof.payloadSnapshot ?? {}, 'signedAt');
  const signatureRequired = options?.signatureRequired === true;
  const now = new Date().toISOString();

  const { data: existing, error: lookupError } = await fromUnknownTable(supabase, 'client_documents')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('id', proof.id)
    .maybeSingle();

  if (lookupError && !isMissingTableError(lookupError)) {
    return { ok: false, error: lookupError.message };
  }

  if (existing) {
    const { error } = await fromUnknownTable(supabase, 'client_documents')
      .update({
        title: payload.title,
        file_name: payload.fileName,
        storage_path: proof.pdfStoragePath,
        portal_visible: true,
        status: 'aktiv',
        category: PROOF_CATEGORY,
        signed_at: signedAt,
        signature_required: signatureRequired,
        updated_at: now,
      })
      .eq('tenant_id', tenantId)
      .eq('id', proof.id);

    if (error) return { ok: false, error: error.message };
    return { ok: true, data: { clientDocumentId: proof.id } };
  }

  const { error: insertError } = await fromUnknownTable(supabase, 'client_documents').insert({
    id: proof.id,
    tenant_id: tenantId,
    client_id: clientId,
    title: payload.title,
    file_name: payload.fileName,
    mime_type: 'application/pdf',
    category: PROOF_CATEGORY,
    storage_path: proof.pdfStoragePath,
    status: 'aktiv',
    sensitivity: 'care',
    portal_visible: true,
    source: 'assist_visit_proof',
    signed_at: signedAt,
    signature_required: signatureRequired,
    uploaded_by: options?.actorProfileId ?? null,
  });

  if (insertError) return { ok: false, error: insertError.message };
  return { ok: true, data: { clientDocumentId: proof.id } };
}

/** Hide mirrored client_documents row when portal release is revoked. */
export async function revokeAssistProofClientPortalDocument(
  tenantId: string,
  proofId: string,
): Promise<ServiceResult<void>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { error } = await fromUnknownTable(supabase, 'client_documents')
    .update({
      portal_visible: false,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .eq('id', proofId);

  if (error && !isMissingTableError(error)) {
    return { ok: false, error: error.message };
  }

  return { ok: true, data: undefined };
}
