import { Platform } from 'react-native';
import type { PortalSignatureCapture, PortalSignatureDocument } from '@/types/portal/documentSignatures';
import { computeDocumentContentHash } from '@/lib/documents/documentHashService';
import { renderHtmlToPdfBytes } from '@/lib/assist/assistProofPdfService';
import {
  buildPortalSignatureFinalPdfPath,
  PORTAL_SIGNATURE_STORAGE_BUCKET,
} from '@/lib/portal/portalDocumentSignatureHelpers';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toStorageUploadError } from '@/lib/storage/storagePaths';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import type { ServiceResult } from '@/types';
import { applyCapturedSignatureToHtml } from '@/lib/portal/portalSignatureFieldParser';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatSignedAt(iso: string): string {
  return new Date(iso).toLocaleString('de-DE');
}

async function resolveSignatureImageUrl(storagePath: string): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data } = await supabase.storage
    .from(PORTAL_SIGNATURE_STORAGE_BUCKET)
    .createSignedUrl(storagePath, 3600);
  return data?.signedUrl ?? null;
}

export function buildPortalSignatureFinalHtml(input: {
  document: PortalSignatureDocument;
  captures: PortalSignatureCapture[];
  signatureImageUrls: Array<string | null>;
}): string {
  let bodyHtml = input.document.previewHtml ?? '<p>Dokumentinhalt</p>';

  input.captures.forEach((capture, index) => {
    const imageUrl = input.signatureImageUrls[index];
    const fieldId =
      capture.signerRole === 'employee'
        ? input.document.signatureFields.find((f) => f.role === 'employee')?.id ?? 'employee_signature'
        : input.document.signatureFields.find((f) => f.role === 'client')?.id ?? 'client_signature';

    bodyHtml = applyCapturedSignatureToHtml(bodyHtml, fieldId, {
      signerName: capture.signerName,
      signedAt: capture.signedAt,
      imageUrl,
    });
  });

  const orphanCaptures = input.captures.filter((capture) => {
    const fieldId =
      capture.signerRole === 'employee' ? 'employee_signature' : 'client_signature';
    return !bodyHtml.includes(`data-signature-field-id="${fieldId}"`) &&
      !bodyHtml.includes(capture.signerName);
  });

  const signatureBlocks = orphanCaptures
    .map((capture, index) => {
      const imageUrl = input.signatureImageUrls[input.captures.indexOf(capture)];
      const roleLabel = capture.signerRole === 'employee' ? 'Mitarbeiter' : 'Klient';
      const imageHtml = imageUrl
        ? `<img src="${escapeHtml(imageUrl)}" alt="Unterschrift" style="max-width:280px;height:120px;object-fit:contain;" />`
        : `<p style="font-style:italic;color:#666;">Signaturbild (${escapeHtml(capture.signerName)})</p>`;
      return `
        <div style="margin-top:24px;padding-top:12px;border-top:1px solid #ddd;">
          <p><strong>${roleLabel}-Unterschrift</strong></p>
          ${imageHtml}
          <p style="font-size:12px;color:#444;">${escapeHtml(capture.signerName)} · ${formatSignedAt(capture.signedAt)}</p>
          <p style="font-size:11px;color:#888;">Audit-ID: ${escapeHtml(capture.auditId)}</p>
        </div>`;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html lang="de">
      <head><meta charset="utf-8" /><title>${escapeHtml(input.document.title)}</title></head>
      <body style="font-family:Arial,sans-serif;color:#111;padding:24px;">
        <h1>${escapeHtml(input.document.title)}</h1>
        ${bodyHtml}
        ${signatureBlocks ? `<hr /><h2>Weitere Unterschriften</h2>${signatureBlocks}` : ''}
        <p style="margin-top:32px;font-size:11px;color:#888;">Finalisiert · Version ${input.document.versionNumber}</p>
      </body>
    </html>`;
}

/** Render final PDF with embedded signatures and upload to Storage. */
export async function finalizePortalSignatureDocumentPdf(input: {
  tenantId: string;
  document: PortalSignatureDocument;
  captures: PortalSignatureCapture[];
}): Promise<ServiceResult<{ storagePath: string; pdfHash: string }>> {
  if (Platform.OS !== 'web') {
    return { ok: false, error: 'PDF-Finalisierung ist nur im Web verfügbar.' };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const signatureImageUrls = await Promise.all(
    input.captures.map(async (capture) =>
      capture.storagePath ? resolveSignatureImageUrl(capture.storagePath) : null,
    ),
  );

  const html = buildPortalSignatureFinalHtml({
    document: input.document,
    captures: input.captures,
    signatureImageUrls,
  });

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await renderHtmlToPdfBytes(html);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'PDF-Erzeugung fehlgeschlagen.',
    };
  }

  const storagePath = buildPortalSignatureFinalPdfPath(input.tenantId, input.document.id);
  const pdfHash = computeDocumentContentHash(
    `${input.document.id}:${input.document.versionNumber}:${pdfBytes.byteLength}`,
  );

  const { error: uploadError } = await supabase.storage
    .from(PORTAL_SIGNATURE_STORAGE_BUCKET)
    .upload(storagePath, pdfBytes, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadError) {
    return { ok: false, error: toStorageUploadError(uploadError.message) };
  }

  return { ok: true, data: { storagePath, pdfHash } };
}
