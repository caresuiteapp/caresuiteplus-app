/**
 * Klient:innenportal — sign deferred assist visit proofs (pending_client_signature).
 */
import type { ServiceResult } from '@/types';
import type { AssistVisitProofRow } from '@/types/assistExecutionPersistence';
import { upsertAssistVisitExecutionState } from '@/features/assistWorkflow/assistVisitExecutionStatePersistence';
import {
  computeSignatureDataHash,
  computeVisitSignaturePayloadHash,
  fetchValidVisitSignature,
  saveVisitSignaturePersistent,
  type VisitSignaturePayloadInput,
} from '@/lib/assist/assistVisitSignaturePersistenceService';
import {
  computeVisitProofPayloadHash,
  fetchVisitProofById,
  updateVisitProofRow,
} from '@/lib/assist/assistVisitProofPersistenceService';
import { getReleasedProofForClientPortal } from '@/lib/portal/assist/portalAssistVisitProofService';
import { invalidatePortalProofCache } from '@/lib/portal/portalProofCacheSignal';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';

export type ClientPortalAssistProofSignResult = {
  proofId: string;
  signatureId: string;
  signedAt: string;
  proofPersisted: boolean;
};

function readSnapshotString(snapshot: Record<string, unknown>, key: string): string | null {
  const value = snapshot[key];
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function buildSignaturePayloadFromProof(
  proof: AssistVisitProofRow,
  clientId: string,
): VisitSignaturePayloadInput {
  const snapshot = proof.payloadSnapshot ?? {};
  const tasks = Array.isArray(snapshot.tasks) ? snapshot.tasks : [];
  return {
    visitId: proof.visitId,
    clientId,
    employeeId: readSnapshotString(snapshot, 'employeeId'),
    plannedStartAt:
      readSnapshotString(snapshot, 'plannedStartAt') ??
      readSnapshotString(snapshot, 'scheduledStart') ??
      new Date().toISOString(),
    plannedEndAt:
      readSnapshotString(snapshot, 'plannedEndAt') ??
      readSnapshotString(snapshot, 'scheduledEnd') ??
      new Date().toISOString(),
    taskStatuses: tasks.map((task) => {
      const row = task as Record<string, unknown>;
      return {
        taskId: String(row.id ?? ''),
        status: String(row.status ?? 'open'),
      };
    }),
    documentationNote:
      readSnapshotString(snapshot, 'documentationNote') ??
      readSnapshotString(snapshot, 'documentation'),
  };
}

async function updateClientDocumentAfterSign(
  tenantId: string,
  proofId: string,
  signedAt: string,
  title: string,
): Promise<ServiceResult<void>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { error } = await fromUnknownTable(supabase, 'client_documents')
    .update({
      title,
      signed_at: signedAt,
      signature_required: false,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .eq('id', proofId);

  if (error && !isMissingTableError(error)) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: undefined };
}

/** Persist Leistungsnachweis snapshot after client portal signature (updates existing draft proof). */
async function regenerateProofAfterClientSignature(
  tenantId: string,
  proof: AssistVisitProofRow,
  signatureId: string,
  signerName: string,
  signedAt: string,
): Promise<ServiceResult<AssistVisitProofRow>> {
  const sig = await fetchValidVisitSignature(tenantId, proof.visitId);
  const snapshot = {
    ...(proof.payloadSnapshot ?? {}),
    signatureDeferredToClientPortal: false,
    clientPortalSignedAt: signedAt,
    signedViaClientPortal: true,
    signerName,
    signedAt,
    signature: {
      signerName,
      signedAt,
      signerRole: 'client',
    },
  };

  const payloadHash = await computeVisitProofPayloadHash(snapshot);
  const updated = await updateVisitProofRow(tenantId, proof.id, {
    signature_id: signatureId,
    payload_snapshot: snapshot,
    payload_hash: payloadHash,
    portal_release_status: 'released',
    status: 'pending_review',
    updated_at: new Date().toISOString(),
  });

  if (!updated.ok || !updated.data) {
    return { ok: false, error: updated.error ?? 'Leistungsnachweis konnte nicht aktualisiert werden.' };
  }

  void sig;
  return updated;
}

/**
 * Capture client signature for a portal-released assist visit proof and refresh the proof snapshot.
 */
export async function saveClientPortalAssistProofSignature(input: {
  tenantId: string;
  clientId: string;
  proofId: string;
  profileId?: string | null;
  signerName: string;
  signatureDataUrl: string;
}): Promise<ServiceResult<ClientPortalAssistProofSignResult>> {
  if (!input.signerName.trim() || !input.signatureDataUrl.trim()) {
    return { ok: false, error: 'Signatur und Name sind erforderlich.' };
  }

  if (getServiceMode() !== 'supabase') {
    return {
      ok: true,
      data: {
        proofId: input.proofId,
        signatureId: 'demo-sig',
        signedAt: new Date().toISOString(),
        proofPersisted: true,
      },
    };
  }

  const released = await getReleasedProofForClientPortal(
    input.tenantId,
    input.clientId,
    input.proofId,
  );
  if (!released.ok) return released;
  if (!released.data) {
    return { ok: false, error: 'Nachweis nicht gefunden oder nicht freigegeben.' };
  }
  if (!released.data.signatureRequired || released.data.portalReleaseStatus !== 'pending_client_signature') {
    return { ok: false, error: 'Für diesen Nachweis ist keine Unterschrift mehr erforderlich.' };
  }

  const loaded = await fetchVisitProofById(input.tenantId, input.proofId);
  if (!loaded.ok || !loaded.data) {
    return { ok: false, error: loaded.error ?? 'Leistungsnachweis nicht gefunden.' };
  }

  const proof = loaded.data;
  const payload = buildSignaturePayloadFromProof(proof, input.clientId);
  const payloadHash = await computeVisitSignaturePayloadHash(payload);
  const signatureHash = await computeSignatureDataHash(input.signatureDataUrl);
  const signedAt = new Date().toISOString();

  const saved = await saveVisitSignaturePersistent(input.tenantId, {
    visitId: proof.visitId,
    signerName: input.signerName.trim(),
    signerRole: 'client',
    storagePath: '',
    payloadHash,
    signatureHash,
    signedAt,
    signedByProfileId: input.profileId ?? null,
    signatureDataUrl: input.signatureDataUrl,
    metadata: {
      signedVia: 'client_portal',
      proofId: proof.id,
      clientId: input.clientId,
    },
  });

  if (!saved.ok || !saved.data) {
    return { ok: false, error: saved.error ?? 'Unterschrift konnte nicht gespeichert werden.' };
  }

  const regenerated = await regenerateProofAfterClientSignature(
    input.tenantId,
    proof,
    saved.data.id,
    input.signerName.trim(),
    signedAt,
  );
  if (!regenerated.ok || !regenerated.data) {
    return { ok: false, error: regenerated.error ?? 'Leistungsnachweis konnte nicht aktualisiert werden.' };
  }

  const title =
    readSnapshotString(regenerated.data.payloadSnapshot ?? {}, 'title') ??
    readSnapshotString(regenerated.data.payloadSnapshot ?? {}, 'serviceName') ??
    'Leistungsnachweis';

  const documentSync = await updateClientDocumentAfterSign(
    input.tenantId,
    proof.id,
    signedAt,
    title,
  );
  if (!documentSync.ok) {
    return { ok: false, error: documentSync.error ?? 'Portal-Dokument konnte nicht aktualisiert werden.' };
  }

  try {
    const { buildEnrichedAssistProofPdfPayload } = await import('@/lib/assist/assistProofPdfService');
    const { upsertAssistProofClientPortalDocument } = await import(
      '@/lib/assist/assistProofPortalDocumentService'
    );
    const enriched = await buildEnrichedAssistProofPdfPayload(input.tenantId, regenerated.data);
    const mirror = await upsertAssistProofClientPortalDocument(input.tenantId, regenerated.data, {
      actorProfileId: input.profileId ?? null,
      signatureRequired: false,
    });
    void enriched;
    void mirror;
  } catch {
    // PDF / mirror is best-effort — signature + proof snapshot are authoritative.
  }

  const assignmentId =
    readSnapshotString(regenerated.data.payloadSnapshot ?? {}, 'assignmentId') ?? proof.visitId;
  await upsertAssistVisitExecutionState(input.tenantId, assignmentId, 'abgeschlossen', {
    signatureComplete: true,
    proofGenerated: true,
    finalizedAt: signedAt,
  });

  invalidatePortalProofCache();

  return {
    ok: true,
    data: {
      proofId: proof.id,
      signatureId: saved.data.id,
      signedAt,
      proofPersisted: true,
    },
  };
}
