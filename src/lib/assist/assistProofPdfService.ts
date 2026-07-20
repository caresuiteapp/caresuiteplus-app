/**
 * Assist visit proof PDF export — html2canvas + jsPDF (web only).
 * Uploads to office-documents tenant/…/assist/visits/…/proofs/{id}.pdf
 */

import { Platform } from 'react-native';
import type { ServiceResult } from '@/types';
import type { AssistVisitProofRow } from '@/types/assistExecutionPersistence';
import { computeSha256Hex } from '@/lib/assist/assistExecutionHashService';
import {
  buildAssistProofPdfPayload,
  type AssistProofPdfPayload,
} from '@/lib/assist/assistProofPdfPayload';
import {
  loadVisitProofBrandingForTenant,
  resolveVisitProofBranding,
  resolveVisitProofEmployeeName,
  VISIT_PROOF_EMPLOYEE_UNKNOWN,
  VISIT_PROOF_TENANT_NAME_FALLBACK,
} from '@/lib/assist/visitProofBranding';
import {
  enrichVisitProofForPreview,
  mergeVisitProofEnrichment,
  type VisitProofSnapshotEnrichment,
} from '@/lib/assist/visitProofSnapshotPreviewService';
import {
  fetchVisitProofById,
  updateVisitProofRow,
} from '@/lib/assist/assistVisitProofPersistenceService';
import {
  ASSIST_EXECUTION_STORAGE_BUCKET,
  buildAssistVisitProofStoragePath,
} from '@/lib/assist/assistStoragePaths';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toStorageUploadError } from '@/lib/storage/storagePaths';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { pickSignatureImageUrl } from '@/lib/assist/visitSignatureImageService';
import { normalizeSignatureImageForProof } from '@/lib/signatures/signatureOrientation';

export type { AssistProofPdfPayload };
export { buildAssistProofPdfPayload } from '@/lib/assist/assistProofPdfPayload';

function brandingInputFromEnrichment(
  enrichment: VisitProofSnapshotEnrichment,
): Parameters<typeof resolveVisitProofBranding>[1] {
  return {
    logoUrl: enrichment.tenantLogoUrl,
    tenantName: enrichment.tenantName,
    legalName: enrichment.tenantLegalName,
    addressLine: enrichment.tenantAddressLine,
    ikNumber: enrichment.tenantIkNumber,
    taxId: enrichment.tenantTaxId,
  };
}

/** Runtime PDF/HTML builder — backfills logo, tenant name and employee from DB when snapshot is incomplete. */
export async function buildEnrichedAssistProofPdfPayload(
  tenantId: string,
  proof: AssistVisitProofRow,
  enrichment: VisitProofSnapshotEnrichment = {},
): Promise<AssistProofPdfPayload> {
  const snapshot = proof.payloadSnapshot ?? {};
  let merged = { ...enrichment };

  const employeeName = resolveVisitProofEmployeeName(snapshot, { employeeName: merged.employeeName });
  const branding = resolveVisitProofBranding(snapshot, brandingInputFromEnrichment(merged));

  const needsEmployee = employeeName === VISIT_PROOF_EMPLOYEE_UNKNOWN;
  const needsBranding = !branding.logoUrl || branding.tenantName === VISIT_PROOF_TENANT_NAME_FALLBACK;
  const snapshotHasSignature = Boolean(
    proof.signatureId ||
    snapshot.signature ||
    snapshot.signerName ||
    snapshot.signedAt,
  );
  const needsSignature = snapshotHasSignature && !pickSignatureImageUrl(
    merged.signatureImageUrl,
    merged.signature?.dataUrl,
  );

  if (needsEmployee || needsSignature) {
    const enriched = await enrichVisitProofForPreview(tenantId, proof);
    if (enriched.ok) {
      merged = mergeVisitProofEnrichment(enriched.data, merged);
    }
  } else if (needsBranding) {
    const tenantBranding = await loadVisitProofBrandingForTenant(tenantId);
    merged = mergeVisitProofEnrichment(
      {
        tenantLogoUrl: tenantBranding.logoUrl,
        tenantName: tenantBranding.tenantName,
        tenantLegalName: tenantBranding.legalName,
        tenantAddressLine: tenantBranding.addressLine,
        tenantIkNumber: tenantBranding.ikNumber,
        tenantTaxId: tenantBranding.taxId,
      },
      merged,
    );
  }

  const signatureImageUrl = pickSignatureImageUrl(
    merged.signatureImageUrl,
    merged.signature?.dataUrl,
  );
  if (signatureImageUrl) {
    const normalized = await normalizeSignatureImageForProof(signatureImageUrl);
    if (normalized) {
      merged = {
        ...merged,
        signatureImageUrl: normalized.dataUrl,
        signatureImageWidth: normalized.width,
        signatureImageHeight: normalized.height,
        signature: merged.signature
          ? { ...merged.signature, dataUrl: normalized.dataUrl }
          : merged.signature,
      };
    }
  }

  return buildAssistProofPdfPayload(proof, merged);
}

export type AssistProofPdfPreviewResult = {
  url: string;
  fileName: string;
  kind: 'storage' | 'blob';
};

type PdfRenderer = {
  html2canvas: typeof import('html2canvas').default;
  jsPDF: typeof import('jspdf').jsPDF;
};

let pdfRendererPromise: Promise<PdfRenderer> | null = null;

async function loadPdfRenderer(): Promise<PdfRenderer> {
  if (!pdfRendererPromise) {
    pdfRendererPromise = Promise.all([
      import('html2canvas'),
      // @ts-expect-error jspdf ships no type declarations for ESM entry
      import('jspdf/dist/jspdf.es.min.js'),
    ]).then(([html2canvasModule, jsPDFModule]) => ({
      html2canvas: html2canvasModule.default,
      jsPDF: jsPDFModule.jsPDF,
    }));
  }
  return pdfRendererPromise;
}

export async function renderHtmlToPdfBytes(html: string): Promise<Uint8Array> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    throw new Error('PDF-Erzeugung ist nur im Web-Browser verfügbar.');
  }

  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '794px';
  container.style.background = '#ffffff';
  container.style.padding = '24px';
  document.body.appendChild(container);

  try {
    const { html2canvas, jsPDF } = await loadPdfRenderer();
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
    });

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const contentWidth = pageWidth - margin * 2;
    const imgHeight = (canvas.height * contentWidth) / canvas.width;
    const imgData = canvas.toDataURL('image/png');

    let heightLeft = imgHeight;
    let position = margin;

    pdf.addImage(imgData, 'PNG', margin, position, contentWidth, imgHeight);
    heightLeft -= pageHeight - margin * 2;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight + margin;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', margin, position, contentWidth, imgHeight);
      heightLeft -= pageHeight - margin * 2;
    }

    return new Uint8Array(pdf.output('arraybuffer'));
  } finally {
    document.body.removeChild(container);
  }
}

export async function renderAssistProofPdfBytes(
  proof: AssistVisitProofRow,
  enrichment?: VisitProofSnapshotEnrichment,
): Promise<Uint8Array> {
  const payload = await buildEnrichedAssistProofPdfPayload(proof.tenantId, proof, enrichment);
  return renderHtmlToPdfBytes(payload.html);
}

/** Signed storage URL or in-browser blob URL for PDF preview in Nachweis-Prüfung. Always renders layout v2 from source data. */
export async function resolveAssistProofPdfPreviewUrl(
  tenantId: string,
  proof: AssistVisitProofRow,
  enrichment?: VisitProofSnapshotEnrichment,
): Promise<ServiceResult<AssistProofPdfPreviewResult>> {
  const payload = await buildEnrichedAssistProofPdfPayload(tenantId, proof, enrichment);

  if (Platform.OS !== 'web' || typeof URL === 'undefined') {
    return { ok: false, error: 'PDF-Vorschau ist nur im Web-Browser verfügbar.' };
  }

  try {
    const pdfBytes = await renderAssistProofPdfBytes(proof, enrichment);
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    return { ok: true, data: { url, fileName: payload.fileName, kind: 'blob' } };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'PDF-Vorschau konnte nicht erzeugt werden.',
    };
  }
}

/** Generate PDF, upload to Storage, persist pdf_storage_path + pdf_hash. */
export async function generateAssistProofPdf(
  tenantId: string,
  proofId: string,
  enrichment?: VisitProofSnapshotEnrichment,
): Promise<ServiceResult<AssistVisitProofRow>> {
  const loaded = await fetchVisitProofById(tenantId, proofId);
  if (!loaded.ok) return loaded;
  if (!loaded.data) return { ok: false, error: 'Leistungsnachweis nicht gefunden.' };

  const proof = loaded.data;
  if (!['approved', 'exported', 'pending_review'].includes(proof.status)) {
    return {
      ok: false,
      error: 'PDF kann erst nach Prüfung oder Freigabe erzeugt werden.',
    };
  }

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await renderAssistProofPdfBytes(proof, enrichment);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'PDF-Erzeugung fehlgeschlagen.',
    };
  }

  const pdfHash = await computeSha256Hex(
    Array.from(pdfBytes, (byte) => String.fromCharCode(byte)).join(''),
  );

  const pdfStoragePath =
    proof.pdfStoragePath ??
    buildAssistVisitProofStoragePath(tenantId, proof.visitId, proof.id, 'pdf');

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { error: uploadError } = await supabase.storage
    .from(ASSIST_EXECUTION_STORAGE_BUCKET)
    .upload(pdfStoragePath, pdfBytes, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadError) {
    return { ok: false, error: toStorageUploadError(uploadError.message) };
  }

  return updateVisitProofRow(tenantId, proofId, {
    pdf_storage_path: pdfStoragePath,
    pdf_hash: pdfHash,
    status: proof.status === 'approved' ? 'exported' : proof.status,
  });
}

export async function downloadAssistProofPdfInBrowser(
  tenantId: string,
  proofId: string,
  enrichment?: VisitProofSnapshotEnrichment,
): Promise<ServiceResult<{ fileName: string }>> {
  const loaded = await fetchVisitProofById(tenantId, proofId);
  if (!loaded.ok) return loaded;
  if (!loaded.data) return { ok: false, error: 'Leistungsnachweis nicht gefunden.' };

  const proof = loaded.data;

  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    if (proof.pdfStoragePath) {
      const supabase = getSupabaseClient();
      if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

      const { data, error } = await supabase.storage
        .from(ASSIST_EXECUTION_STORAGE_BUCKET)
        .download(proof.pdfStoragePath);

      if (error || !data) {
        return { ok: false, error: error?.message ?? 'PDF konnte nicht geladen werden.' };
      }

      const fileName = (await buildEnrichedAssistProofPdfPayload(tenantId, proof, enrichment)).fileName;
      return { ok: true, data: { fileName } };
    }
    return { ok: false, error: 'PDF-Download ist nur im Web-Browser verfügbar.' };
  }

  try {
    const payload = await buildEnrichedAssistProofPdfPayload(tenantId, proof, enrichment);
    const pdfBytes = await renderHtmlToPdfBytes(payload.html);
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = payload.fileName;
    anchor.click();
    URL.revokeObjectURL(url);
    return { ok: true, data: { fileName: payload.fileName } };
  } catch (error) {
    if (proof.pdfStoragePath) {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : 'PDF-Erzeugung fehlgeschlagen.',
        };
      }

      const { data, error: downloadError } = await supabase.storage
        .from(ASSIST_EXECUTION_STORAGE_BUCKET)
        .download(proof.pdfStoragePath);

      if (downloadError || !data) {
        return { ok: false, error: downloadError?.message ?? 'PDF konnte nicht geladen werden.' };
      }

      const buffer = await data.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const fileName = (await buildEnrichedAssistProofPdfPayload(tenantId, proof, enrichment)).fileName;
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(url);
      return { ok: true, data: { fileName } };
    }

    return {
      ok: false,
      error: error instanceof Error ? error.message : 'PDF-Erzeugung fehlgeschlagen.',
    };
  }
}
