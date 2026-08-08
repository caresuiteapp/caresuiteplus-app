/**
 * Klient:innenportal — sign deferred assist visit proofs (pending_client_signature).
 */
import type { ServiceResult } from '@/types';
import type { AssistVisitProofRow } from '@/types/assistExecutionPersistence';
import { upsertAssistVisitExecutionState } from '@/features/assistWorkflow/assistVisitExecutionStatePersistence';
import {
  computeSignatureDataHash,
  computeVisitSignaturePayloadHash,
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

  if (!updated.ok) return { ok: false, error: updated.error };
  if (!updated.data) return { ok: false, error: 'Leistungsnachweis konnte nicht aktualisiert werden.' };

  return updated;
}

async function finishSignedProofDelivery(input: {
  tenantId: string;
  proof: AssistVisitProofRow;
  signedAt: string;
}): Promise<ServiceResult<void>> {
  const title =
    readSnapshotString(input.proof.payloadSnapshot ?? {}, 'title') ??
    readSnapshotString(input.proof.payloadSnapshot ?? {}, 'serviceName') ??
    'Leistungsnachweis';

  const { generateAssistProofPdf } = await import('@/lib/assist/assistProofPdfService');
  const pdfResult = await generateAssistProofPdf(input.tenantId, input.proof.id);
  if (!pdfResult.ok || !pdfResult.data) {
    return {
      ok: false,
      error:
        pdfResult.error ??
        'Die Unterschrift wurde gespeichert, der Leistungsnachweis konnte aber nicht fertiggestellt werden.',
    };
  }

  const documentSync = await updateClientDocumentAfterSign(
    input.tenantId,
    input.proof.id,
    input.signedAt,
    title,
  );
  if (!documentSync.ok) {
    return {
      ok: false,
      error: documentSync.error ?? 'Portal-Dokument konnte nicht aktualisiert werden.',
    };
  }

  const assignmentId =
    readSnapshotString(input.proof.payloadSnapshot ?? {}, 'assignmentId') ?? input.proof.visitId;
  await upsertAssistVisitExecutionState(input.tenantId, assignmentId, 'abgeschlossen', {
    signatureComplete: true,
    proofGenerated: true,
    finalizedAt: input.signedAt,
  });

  return { ok: true, data: undefined };
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
  const loaded = await fetchVisitProofById(input.tenantId, input.proofId);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  if (!loaded.data) return { ok: false, error: 'Leistungsnachweis nicht gefunden.' };

  const proof = loaded.data;

  if (!released.data.signatureRequired || released.data.portalReleaseStatus !== 'pending_client_signature') {
    const snapshot = proof.payloadSnapshot ?? {};
    const existingSignedAt =
      readSnapshotString(snapshot, 'clientPortalSignedAt') ??
      readSnapshotString(snapshot, 'signedAt');
    if (proof.signatureId && existingSignedAt && snapshot.signedViaClientPortal === true) {
      const recovered = await finishSignedProofDelivery({
        tenantId: input.tenantId,
        proof,
        signedAt: existingSignedAt,
      });
      if (!recovered.ok) return recovered;
      invalidatePortalProofCache();
      return {
        ok: true,
        data: {
          proofId: proof.id,
          signatureId: proof.signatureId,
          signedAt: existingSignedAt,
          proofPersisted: true,
        },
      };
    }
    return { ok: false, error: 'Für diesen Nachweis ist keine Unterschrift mehr erforderlich.' };
  }

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

  if (!saved.ok) return { ok: false, error: saved.error };
  if (!saved.data) return { ok: false, error: 'Unterschrift konnte nicht gespeichert werden.' };

  const regenerated = await regenerateProofAfterClientSignature(
    input.tenantId,
    proof,
    saved.data.id,
    input.signerName.trim(),
    signedAt,
  );
  if (!regenerated.ok) return { ok: false, error: regenerated.error };
  if (!regenerated.data) return { ok: false, error: 'Leistungsnachweis konnte nicht aktualisiert werden.' };

  const delivery = await finishSignedProofDelivery({
    tenantId: input.tenantId,
    proof: regenerated.data,
    signedAt,
  });
  if (!delivery.ok) return delivery;

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
