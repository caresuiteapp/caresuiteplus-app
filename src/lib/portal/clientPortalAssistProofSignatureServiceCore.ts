import { randomUUID } from 'expo-crypto';
import type { ServiceResult } from '@/types';
import type { AssistVisitProofRow } from '@/types/assistExecutionPersistence';
import { computeSignatureDataHash, computeVisitSignaturePayloadHash, saveVisitSignaturePersistent, fetchValidVisitSignature, type VisitSignaturePayloadInput } from '@/lib/assist/assistVisitSignaturePersistenceService';
import { computeVisitProofPayloadHash, fetchVisitProofById } from '@/lib/assist/assistVisitProofPersistenceService';
import { getReleasedProofForClientPortal } from '@/lib/portal/assist/portalAssistVisitProofService';
import { invalidatePortalProofCache } from '@/lib/portal/portalProofCacheSignal';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { ASSIST_EXECUTION_STORAGE_BUCKET, buildAssistVisitProofStoragePath } from '@/lib/assist/assistStoragePaths';
import { sha256FileHex } from '@/lib/crypto/sha256Hex';
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
  signerName: string; signatureDataUrl: string; expectedPayloadHash?: string;
};
const active = new Map<string, Promise<ServiceResult<ClientPortalAssistProofSignResult>>>();

function sameDigest(stored: unknown, expected: string): boolean {
  return typeof stored === 'string' && /^(sha256:)?[a-f0-9]{64}$/.test(stored)
    && stored.replace(/^sha256:/, '') === expected.replace(/^sha256:/, '');
}

async function verifyPortalPdf(download: (path: string) => PromiseLike<{data: Blob | null; error: unknown}>, path: string, hash: string, prefix: string): Promise<boolean> {
  if (!path.startsWith(prefix) || !/^[A-Za-z0-9_-]{1,128}[.]pdf$/.test(path.slice(prefix.length))) return false;
  const result = await download(path);
  const file = result.data;
  if (result.error || !file || file.size < 5 || file.size > 10 * 1024 * 1024) return false;
  const bytes = new Uint8Array(await file.arrayBuffer());
  return bytes[0]===37 && bytes[1]===80 && bytes[2]===68 && bytes[3]===70 && bytes[4]===45
    && sameDigest(hash, sha256FileHex(bytes));
}

export function saveClientPortalAssistProofSignature(input: SignInput, verifyWebReceipt = false): Promise<ServiceResult<ClientPortalAssistProofSignResult>> {
  const key = JSON.stringify([input.tenantId, input.clientId, input.proofId, verifyWebReceipt]);
  const existing = active.get(key);
  if (existing) return existing;
  const operation = sign(input, verifyWebReceipt).catch(() => ({ ok: false as const, error: 'Die Speicherung konnte nicht bestätigt werden. Bitte den Status erneut laden und die Fertigstellung wiederholen.' })).finally(() => {
    active.delete(key);
    invalidatePortalProofCache();
  });
  active.set(key, operation);
  return operation;
}

async function sign(input: SignInput, verifyWebReceipt: boolean): Promise<ServiceResult<ClientPortalAssistProofSignResult>> {
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
  if (input.expectedPayloadHash && input.expectedPayloadHash !== proof.payloadHash) {
    return { ok: false, error: 'Der Nachweis wurde geändert. Bitte laden Sie ihn neu und prüfen Sie die neue Fassung, bevor Sie unterschreiben.' };
  }
  if (verifyWebReceipt && (proof.id !== input.proofId || proof.tenantId !== input.tenantId
      || proof.payloadSnapshot.visitId !== proof.visitId || proof.payloadSnapshot.clientId !== input.clientId)) {
    return { ok: false, error: 'Der Nachweis gehört nicht zum geöffneten Einsatz. Bitte neu laden.' };
  }
  if (verifyWebReceipt && !proof.signatureId
      && !sameDigest(proof.payloadHash, await computeVisitProofPayloadHash(proof.payloadSnapshot))) {
    return { ok: false, error: 'Der gespeicherte Inhalt stimmt nicht mit der freigegebenen Fassung überein. Bitte die Verwaltung informieren.' };
  }
  if (!released.data.signatureRequired || released.data.portalReleaseStatus !== 'pending_client_signature') {
    const signedAt = readSnapshotString(proof.payloadSnapshot, 'clientPortalSignedAt');
    if (proof.signatureId && signedAt && proof.pdfStoragePath && proof.payloadSnapshot.clientPortalPdfSignatureId === proof.signatureId && proof.payloadSnapshot.signedViaClientPortal === true) {
      if (verifyWebReceipt) {
        if (!proof.pdfHash || !sameDigest(proof.payloadHash, await computeVisitProofPayloadHash(proof.payloadSnapshot))) {
          return { ok: false, error: 'Die unterschriebene Fassung konnte nicht bestätigt werden.' };
        }
        const files = supabase.storage.from(ASSIST_EXECUTION_STORAGE_BUCKET);
        const prefix = `tenant/${input.tenantId}/assist/visits/${proof.visitId}/proofs/${proof.id}-${proof.signatureId}-`;
        if (!await verifyPortalPdf(path => files.download(path), proof.pdfStoragePath, proof.pdfHash, prefix)) {
          return { ok: false, error: 'Die gespeicherte PDF-Datei stimmt nicht mit dem unterschriebenen Nachweis überein oder ist nicht verfügbar.' };
        }
        const reply = await supabase.rpc('client_portal_finalize_assist_proof' as never, {
          p_tenant_id: input.tenantId, p_proof_id: proof.id, p_signature_id: proof.signatureId,
          p_expected_payload_hash: proof.payloadHash, p_signed_payload_hash: proof.payloadHash,
          p_pdf_storage_path: proof.pdfStoragePath, p_pdf_hash: proof.pdfHash,
        } as never);
        const receipt = reply.data as unknown as ClientPortalAssistProofSignResult | null;
        if (reply.error || receipt?.proofPersisted !== true || receipt.proofId !== proof.id
            || receipt.signatureId !== proof.signatureId || Date.parse(receipt.signedAt) !== Date.parse(signedAt)) {
          return { ok: false, error: 'Der gespeicherte Abschluss konnte nicht bestätigt werden. Bitte den Status erneut laden.' };
        }
        return { ok: true, data: receipt };
      }
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
    && ((!verifyWebReceipt && prior.data.metadata?.proofPayloadHash == null)
      || prior.data.metadata?.proofPayloadHash === proof.payloadHash
      || (proof.signatureId === prior.data.id && (!verifyWebReceipt || proof.payloadSnapshot.signedViaClientPortal === true)));
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
  const pdfHash = `sha256:${sha256FileHex(pdf)}`;
  // Unique immutable upload while the proof is still pending; retries never overwrite a signed PDF.
  const pdfPath = buildAssistVisitProofStoragePath(input.tenantId, proof.visitId, `${proof.id}-${signature.id}-${randomUUID()}`, 'pdf');
  const upload = await supabase.storage.from(ASSIST_EXECUTION_STORAGE_BUCKET).upload(pdfPath, pdf.slice().buffer as ArrayBuffer, { contentType: 'application/pdf', upsert: false });
  if (upload.error) return { ok: false, error: 'Ihre Unterschrift ist gespeichert. Der Leistungsnachweis konnte noch nicht übertragen werden. Bitte die Fertigstellung erneut versuchen.' };
  if (verifyWebReceipt) {
    const files = supabase.storage.from(ASSIST_EXECUTION_STORAGE_BUCKET);
    const prefix = `tenant/${input.tenantId}/assist/visits/${proof.visitId}/proofs/${proof.id}-${signature.id}-`;
    if (!await verifyPortalPdf(path => files.download(path), pdfPath, pdfHash, prefix)) {
      return { ok: false, error: 'Die gespeicherte PDF-Datei konnte nicht bestätigt werden. Ihre erfasste Unterschrift bleibt für einen erneuten Versuch erhalten.' };
    }
  }
  const result = await supabase.rpc('client_portal_finalize_assist_proof' as never, {
    p_tenant_id: input.tenantId, p_proof_id: proof.id, p_signature_id: signature.id,
    p_expected_payload_hash: proof.payloadHash, p_signed_payload_hash: await computeVisitProofPayloadHash(snapshot),
    p_pdf_storage_path: pdfPath, p_pdf_hash: pdfHash,
  } as never);
  if (result.error) return { ok: false, error: 'Ihre Unterschrift ist gespeichert. Die Übergabe an die Verwaltung konnte noch nicht bestätigt werden. Bitte die Fertigstellung erneut versuchen.' };
  const receipt = result.data as unknown as ClientPortalAssistProofSignResult | null;
  if (receipt?.proofId !== proof.id || !receipt.signatureId || !receipt.signedAt || receipt.proofPersisted !== true
      || (verifyWebReceipt && (receipt.signatureId !== signature.id || Date.parse(receipt.signedAt) !== Date.parse(signature.signedAt)))) {
    return { ok: false, error: 'Die Fertigstellung wurde noch nicht bestätigt. Bitte den Status erneut laden.' };
  }
  return { ok: true, data: receipt };
}

export function retryClientPortalAssistProofDelivery(input: { tenantId: string; clientId: string; proofId: string }): Promise<ServiceResult<ClientPortalAssistProofSignResult>> {
  return saveClientPortalAssistProofSignature({ ...input, signerName: '', signatureDataUrl: '' });
}
