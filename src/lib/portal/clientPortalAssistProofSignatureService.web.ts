import type { ServiceResult } from '@/types';
import type { AssistVisitProofRow } from '@/types/assistExecutionPersistence';
import { computeSignatureDataHash, computeVisitSignaturePayloadHash, saveVisitSignaturePersistent, fetchValidVisitSignature, type VisitSignaturePayloadInput } from '@/lib/assist/assistVisitSignaturePersistenceService';
import { computeVisitProofPayloadHash, fetchVisitProofById } from '@/lib/assist/assistVisitProofPersistenceService';
import { getReleasedProofForClientPortal } from '@/lib/portal/assist/portalAssistVisitProofService';
import { invalidatePortalProofCache } from '@/lib/portal/portalProofCacheSignal';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { ASSIST_EXECUTION_STORAGE_BUCKET, buildAssistVisitProofStoragePath } from '@/lib/assist/assistStoragePaths';
import { computeSha256Hex } from '@/lib/assist/assistExecutionHashService';
import { resolveVisitSignatureImageUrl } from '@/lib/assist/visitSignatureImageService';

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
      proof.createdAt,
    plannedEndAt:
      readSnapshotString(snapshot, 'plannedEndAt') ??
      readSnapshotString(snapshot, 'scheduledEnd') ??
      proof.createdAt,
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

type SignInput = {
  tenantId: string; clientId: string; proofId: string; profileId?: string | null;
  signerName: string; signatureDataUrl: string;
};
const active = new Map<string, Promise<ServiceResult<ClientPortalAssistProofSignResult>>>();

export function saveClientPortalAssistProofSignature(input: SignInput): Promise<ServiceResult<ClientPortalAssistProofSignResult>> {
  const key = JSON.stringify([input.tenantId, input.clientId, input.proofId]);
  const existing = active.get(key);
  if (existing) return existing;
  const operation = sign(input).catch(() => ({ ok: false as const, error: 'Die Speicherung konnte nicht bestätigt werden. Bitte den Status erneut laden und die Fertigstellung wiederholen.' })).finally(() => {
    active.delete(key);
    invalidatePortalProofCache();
  });
  active.set(key, operation);
  return operation;
}

async function sign(input: SignInput): Promise<ServiceResult<ClientPortalAssistProofSignResult>> {
  if (!input.tenantId || !input.clientId || !input.proofId) {
    return { ok: false, error: 'Signatur, Name und Portalzuordnung sind erforderlich.' };
  }
  if (getServiceMode() !== 'supabase') return { ok: true, data: { proofId: input.proofId, signatureId: 'demo-sig', signedAt: new Date().toISOString(), proofPersisted: true } };
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Die Verbindung konnte nicht hergestellt werden.' };
  const released = await getReleasedProofForClientPortal(input.tenantId, input.clientId, input.proofId);
  if (!released.ok) return released;
  if (!released.data) return { ok: false, error: 'Nachweis nicht gefunden oder nicht freigegeben.' };
  const loaded = await fetchVisitProofById(input.tenantId, input.proofId);
  if (!loaded.ok) return loaded;
  if (!loaded.data) return { ok: false, error: 'Leistungsnachweis nicht gefunden.' };
  const proof = loaded.data;
  if (!released.data.signatureRequired || released.data.portalReleaseStatus !== 'pending_client_signature') {
    const signedAt = readSnapshotString(proof.payloadSnapshot, 'clientPortalSignedAt');
    if (proof.signatureId && signedAt && proof.pdfStoragePath && proof.payloadSnapshot.clientPortalPdfSignatureId === proof.signatureId && proof.payloadSnapshot.signedViaClientPortal === true) {
      return { ok: true, data: { proofId: proof.id, signatureId: proof.signatureId, signedAt, proofPersisted: true } };
    }
    if (!(proof.signatureId && signedAt && proof.payloadSnapshot.signedViaClientPortal === true)) {
      return { ok: false, error: 'Für diesen Nachweis ist keine Unterschrift mehr erforderlich. Bitte den aktuellen Status prüfen.' };
    }
  }
  const payloadHash = await computeVisitSignaturePayloadHash(buildSignaturePayloadFromProof(proof, input.clientId));
  const prior = await fetchValidVisitSignature(input.tenantId, proof.visitId);
  if (!prior.ok) return prior;
  // A retry finishes the already captured signature instead of asking the client to sign again.
  const reusable = prior.data?.payloadHash === payloadHash
    && prior.data.metadata?.proofId === proof.id && prior.data.metadata?.signedVia === 'client_portal'
    && (prior.data.metadata?.proofPayloadHash == null || prior.data.metadata.proofPayloadHash === proof.payloadHash || proof.signatureId === prior.data.id);
  if (!reusable && (!input.signerName.trim() || !input.signatureDataUrl.trim())) return { ok: false, error: 'Bitte unterschreiben Sie den Nachweis zuerst.' };
  const saved = reusable ? prior : await saveVisitSignaturePersistent(input.tenantId, {
    visitId: proof.visitId, signerName: input.signerName.trim(), signerRole: 'client', storagePath: '', payloadHash,
    signatureHash: await computeSignatureDataHash(input.signatureDataUrl), signedAt: new Date().toISOString(),
    // Portal account ids are not necessarily profile foreign keys.
    signedByProfileId: null, signatureDataUrl: input.signatureDataUrl,
    metadata: { signedVia: 'client_portal', proofId: proof.id, clientId: input.clientId, proofPayloadHash: proof.payloadHash },
  });
  if (!saved.ok) return saved;
  if (!saved.data) return { ok: false, error: 'Unterschrift konnte nicht gespeichert werden.' };
  const signature = { ...saved.data, signedAt: new Date(saved.data.signedAt).toISOString() };
  const imageUrl = reusable ? await resolveVisitSignatureImageUrl(signature.storagePath) : input.signatureDataUrl;
  if (!imageUrl) return { ok: false, error: 'Ihre Unterschrift ist gespeichert. Das Signaturbild konnte für den Nachweis noch nicht geladen werden. Bitte erneut versuchen.' };
  const snapshot = {
    ...proof.payloadSnapshot, signatureDeferredToClientPortal: false,
    clientPortalSignedAt: signature.signedAt, signedViaClientPortal: true, clientPortalPdfSignatureId: signature.id,
    signerName: signature.signerName, signedAt: signature.signedAt,
    signature: { signerName: signature.signerName, signedAt: signature.signedAt, signerRole: 'client' },
  };
  const signedProof = { ...proof, signatureId: signature.id, payloadSnapshot: snapshot, status: 'pending_review' as const };
  const { renderAssistProofPdfBytes } = await import('@/lib/assist/assistProofPdfService');
  const pdf = await renderAssistProofPdfBytes(signedProof, { signatureImageUrl: imageUrl });
  const pdfHash = await computeSha256Hex(Array.from(pdf, (byte) => String.fromCharCode(byte)).join(''));
  // Unique immutable upload while the proof is still pending; retries never overwrite a signed PDF.
  const pdfPath = buildAssistVisitProofStoragePath(input.tenantId, proof.visitId, `${proof.id}-${signature.id}-${crypto.randomUUID()}`, 'pdf');
  const upload = await supabase.storage.from(ASSIST_EXECUTION_STORAGE_BUCKET).upload(pdfPath, pdf, { contentType: 'application/pdf', upsert: false });
  if (upload.error) return { ok: false, error: 'Ihre Unterschrift ist gespeichert. Der Leistungsnachweis konnte noch nicht übertragen werden. Bitte die Fertigstellung erneut versuchen.' };
  const result = await supabase.rpc('client_portal_finalize_assist_proof' as never, {
    p_tenant_id: input.tenantId, p_proof_id: proof.id, p_signature_id: signature.id,
    p_expected_payload_hash: proof.payloadHash, p_signed_payload_hash: await computeVisitProofPayloadHash(snapshot),
    p_pdf_storage_path: pdfPath, p_pdf_hash: pdfHash,
  } as never);
  if (result.error) return { ok: false, error: 'Ihre Unterschrift ist gespeichert. Die Übergabe an die Verwaltung konnte noch nicht bestätigt werden. Bitte die Fertigstellung erneut versuchen.' };
  const receipt = result.data as unknown as ClientPortalAssistProofSignResult | null;
  if (receipt?.proofId !== proof.id || !receipt.signatureId || !receipt.signedAt || receipt.proofPersisted !== true) {
    return { ok: false, error: 'Die Fertigstellung wurde noch nicht bestätigt. Bitte den Status erneut laden.' };
  }
  return { ok: true, data: receipt };
}

export function retryClientPortalAssistProofDelivery(input: { tenantId: string; clientId: string; proofId: string }): Promise<ServiceResult<ClientPortalAssistProofSignResult>> {
  return saveClientPortalAssistProofSignature({ ...input, signerName: '', signatureDataUrl: '' });
}
