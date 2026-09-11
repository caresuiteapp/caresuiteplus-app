import { fetchValidVisitSignature } from '@/lib/assist/assistVisitSignaturePersistenceService';
import { fetchAllPortalRows } from '@/lib/portal/fetchAllPortalRows.web';
/**
 * Client portal — released assist visit proofs only (portal_visible).
 * No GPS / tracking data exposed.
 */

import type { ServiceResult } from '@/types';
import type {
  ClientPortalAssistVisitProof,
  AssistVisitProofRow,
} from '@/types/assistExecutionPersistence';
import type { PortalDocumentDetail } from '@/types/portal/documents';
import { stripPortalBlockedKeysFromSnapshot } from '@/lib/assist/assistProofPdfPayload';
import { buildEnrichedAssistProofPdfPayload } from '@/lib/assist/assistProofPdfService';
import { fetchVisitProofById } from '@/lib/assist/assistVisitProofPersistenceService';
import { ASSIST_EXECUTION_STORAGE_BUCKET } from '@/lib/assist/assistStoragePaths';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { ASSIST_EXECUTION_TABLES } from '@/types/assistExecutionPersistence';

function readString(snapshot: Record<string, unknown>, key: string): string | null {
  const value = snapshot[key];
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

type ProofRow = {
  id: string;
  visit_id: string;
  proof_number: string | null;
  payload_snapshot: Record<string, unknown>;
  pdf_storage_path: string | null;
  released_to_portal_at: string | null;
  portal_release_status: string;
  signature_id: string | null;
};

type VisitRow = {
  id: string;
  title: string | null;
  planned_start_at: string | null;
  planned_end_at: string | null;
};

function mapReleasedProof(proof: ProofRow, visit?: VisitRow | null): ClientPortalAssistVisitProof {
  const snapshot = stripPortalBlockedKeysFromSnapshot(proof.payload_snapshot ?? {});
  const signedAt = readString(snapshot, 'clientPortalSignedAt') ?? readString(snapshot, 'signedAt');
  const signerName = readString(snapshot, 'signerName');
  const portalReleaseStatus =
    proof.portal_release_status as ClientPortalAssistVisitProof['portalReleaseStatus'];

  return {
    id: proof.id,
    visitId: proof.visit_id,
    proofNumber: proof.proof_number,
    title: readString(snapshot, 'title') ?? visit?.title ?? 'Leistungsnachweis',
    serviceName: readString(snapshot, 'serviceName'),
    clientName: readString(snapshot, 'clientName'),
    employeeName: readString(snapshot, 'employeeName'),
    scheduledStart: readString(snapshot, 'scheduledStart') ?? visit?.planned_start_at ?? null,
    scheduledEnd: readString(snapshot, 'scheduledEnd') ?? visit?.planned_end_at ?? null,
    documentationNote:
      readString(snapshot, 'documentationNote') ?? readString(snapshot, 'documentation'),
    signedAt,
    signerName,
    releasedAt: proof.released_to_portal_at,
    pdfStoragePath: proof.pdf_storage_path,
    portalReleaseStatus,
    signatureRequired: portalReleaseStatus === 'pending_client_signature',
  };
}

type JoinedProof = ProofRow & { assist_visits: VisitRow | VisitRow[] };
async function queryReleasedProofs(tenantId: string, clientId: string, proofId?: string): Promise<ServiceResult<ClientPortalAssistVisitProof[]>> {
  if (!tenantId || !clientId) return { ok: false, error: 'Ihr Portalprofil konnte nicht zugeordnet werden.' };
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
  const result = await fetchAllPortalRows<JoinedProof>((from, to) => {
    let query = fromUnknownTable(supabase, ASSIST_EXECUTION_TABLES.proofs)
      .select('id, visit_id, proof_number, payload_snapshot, pdf_storage_path, released_to_portal_at, portal_release_status, signature_id, assist_visits!inner(id, title, planned_start_at, planned_end_at, client_id, tenant_id)', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .eq('assist_visits.tenant_id', tenantId)
      .eq('assist_visits.client_id', clientId)
      .neq('assist_visits.planning_status', 'draft')
      .not('assist_visits.canonical_status', 'in', '(cancelled,no_show)')
      .eq('portal_visible', true)
      .in('portal_release_status', ['released', 'pending_client_signature'])
      .order('released_to_portal_at', { ascending: false }).order('id', { ascending: true });
    if (proofId) query = query.eq('id', proofId);
    return query.range(from, to);
  });
  if (!result.ok) return result;
  return { ok: true, data: result.data.map((row) => mapReleasedProof(row, Array.isArray(row.assist_visits) ? row.assist_visits[0] : row.assist_visits)) };
}

export async function listReleasedProofsForClientPortal(tenantId: string, clientId: string): Promise<ServiceResult<ClientPortalAssistVisitProof[]>> {
  return queryReleasedProofs(tenantId, clientId);
}

export async function getReleasedProofForClientPortal(tenantId: string, clientId: string, proofId: string): Promise<ServiceResult<ClientPortalAssistVisitProof | null>> {
  const result = await queryReleasedProofs(tenantId, clientId, proofId);
  if (!result.ok) return result;
  return { ok: true, data: result.data[0] ?? null };
}

export async function getProofPdfForClientPortal(
  tenantId: string,
  clientId: string,
  proofId: string,
): Promise<ServiceResult<string>> {
  const proof = await getReleasedProofForClientPortal(tenantId, clientId, proofId);
  if (!proof.ok) return proof;
  if (!proof.data?.pdfStoragePath) {
    return { ok: false, error: 'PDF ist noch nicht verfügbar.' };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { data, error } = await supabase.storage
    .from(ASSIST_EXECUTION_STORAGE_BUCKET)
    .createSignedUrl(proof.data.pdfStoragePath, 3600);

  if (error || !data?.signedUrl) {
    return { ok: false, error: error?.message ?? 'Download konnte nicht vorbereitet werden.' };
  }

  return { ok: true, data: data.signedUrl };
}

async function mapAssistProofToPortalDocumentDetail(
  tenantId: string,
  proof: ClientPortalAssistVisitProof,
  fullProof: AssistVisitProofRow | null,
): Promise<PortalDocumentDetail> {
  const previewHtml = fullProof
    ? (await buildEnrichedAssistProofPdfPayload(tenantId, fullProof)).html
    : null;
  const fileName = proof.proofNumber
    ? `Leistungsnachweis-${proof.proofNumber}.pdf`
    : 'Leistungsnachweis.pdf';
  const signaturePending =
    proof.signatureRequired === true && proof.portalReleaseStatus === 'pending_client_signature';
  const signedViaClientPortal = Boolean(
    proof.signedAt && fullProof?.payloadSnapshot?.signedViaClientPortal === true,
  );

  return {
    id: proof.id,
    title: proof.title,
    fileName,
    mimeType: 'application/pdf',
    category: 'assignment',
    fileSizeBytes: 0,
    status: 'aktiv',
    updatedAt: proof.releasedAt ?? proof.scheduledStart ?? new Date().toISOString(),
    visibility: 'shared',
    sensitivity: 'standard',
    clientName: proof.clientName,
    displayFileName: fileName,
    documentSource: 'assist_visit_proof',
    previewHtml,
    createdAt: proof.releasedAt ?? proof.scheduledStart ?? new Date().toISOString(),
    description: signaturePending
      ? 'Bitte bestätigen Sie den Einsatz mit Ihrer Unterschrift. Der Leistungsnachweis wird danach erstellt.'
      : signedViaClientPortal
        ? 'Klient:in hat unterschrieben — Leistungsnachweis wird geprüft.'
        : null,
    downloadReady: Boolean(proof.pdfStoragePath),
    viewReady: Boolean(previewHtml || proof.pdfStoragePath || signaturePending),
    signatureRequired: proof.signatureRequired === true,
    signaturePending,
    canSign: signaturePending,
    signedViaClientPortal,
  };
}

/** Client portal document detail for released assist visit proofs. */
export async function fetchAssistProofPortalDocumentDetail(
  tenantId: string,
  clientId: string,
  proofId: string,
): Promise<ServiceResult<PortalDocumentDetail>> {
  const released = await getReleasedProofForClientPortal(tenantId, clientId, proofId);
  if (!released.ok) return released;
  if (!released.data) {
    return { ok: false, error: 'Dokument nicht gefunden oder nicht freigegeben.' };
  }

  const full = await fetchVisitProofById(tenantId, proofId);
  const fullProof = full.ok ? full.data : null;

  if (!full.ok) return full;
  if (!fullProof) return { ok: false, error: 'Leistungsnachweis konnte nicht geladen werden.' };
  const detail = await mapAssistProofToPortalDocumentDetail(tenantId, released.data, fullProof);
  let signatureCaptured = detail.signedViaClientPortal === true;
  if (detail.signaturePending) {
    const signature = await fetchValidVisitSignature(tenantId, fullProof.visitId);
    if (!signature.ok) return signature;
    signatureCaptured = signature.data?.metadata?.proofId === proofId && signature.data?.metadata?.signedVia === 'client_portal'
      && (signature.data?.metadata?.proofPayloadHash == null || signature.data.metadata.proofPayloadHash === fullProof.payloadHash);
  }
  return { ok: true, data: { ...detail, signatureCaptured, signatureDeliveryPending: detail.signedViaClientPortal && fullProof.payloadSnapshot.clientPortalPdfSignatureId !== fullProof.signatureId } as PortalDocumentDetail };

}
