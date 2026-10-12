const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_PDF_BYTES = 20 * 1024 * 1024;
export type PdfUploadInput = { tenantId: string; documentId: string; employeeId: string | null; pdfBytes: Uint8Array };

/** Validate the upload envelope, not the truth of a signed document's contents. */
export function parsePdfUpload(value: unknown): PdfUploadInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Ungültige PDF-Anfrage.');
  const body = value as Record<string, unknown>;
  const tenantId = typeof body.tenantId === 'string' ? body.tenantId.trim() : '';
  const documentId = typeof body.documentId === 'string' ? body.documentId.trim() : '';
  const employeeId = typeof body.employeeId === 'string' ? body.employeeId.trim() : null;
  if (!UUID.test(tenantId) || !(UUID.test(documentId) || /^payroll-/.test(documentId) && UUID.test(documentId.slice(8)))) {
    throw new Error('Mandant oder Dokument-ID ist ungültig.');
  }
  if (documentId.startsWith('payroll-') && (!employeeId || !UUID.test(employeeId))) throw new Error('Die Mitarbeiterzuordnung zur Monatsübersicht fehlt.');
  const encoded = typeof body.pdfBase64 === 'string' ? body.pdfBase64.trim() : '';
  if (!encoded) throw new Error('Eine erzeugte PDF-Datei fehlt. HTML allein ist keine PDF-Datei.');
  if (encoded.length > Math.ceil(MAX_PDF_BYTES / 3) * 4 || encoded.length % 4 !== 0
    || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) {
    throw new Error('Die PDF-Datei ist zu groß oder ihre Kodierung ist ungültig.');
  }
  const binary = atob(encoded);
  if (btoa(binary) !== encoded) throw new Error('Die PDF-Kodierung ist ungültig.');
  const pdfBytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  const text = new TextDecoder('latin1').decode(pdfBytes);
  if (pdfBytes.length < 512 || pdfBytes.length > MAX_PDF_BYTES || !/^%PDF-\d\.\d/.test(text)
    || !/\/Type\s*\/(?:Page|ObjStm)\b/.test(text) || !/\/Root\s+\d+\s+\d+\s+R/.test(text)
    || !/startxref\s+\d+\s+%%EOF\s*$/.test(text)) {
    throw new Error('Die Datei enthält keine vollständige PDF-Struktur. Bitte das Dokument erneut erzeugen.');
  }
  return { tenantId, documentId, employeeId, pdfBytes };
}
export async function pdfSha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
export function pdfUploadPath(input: Pick<PdfUploadInput, 'tenantId' | 'documentId'>, hash: string): string {
  return `tenant/${input.tenantId}/generated/${input.documentId}/${hash}.pdf`;
}
export async function pdfUploadJobId(input: PdfUploadInput, actorProfileId: string, hash: string): Promise<string> {
  const id = await pdfSha256(new TextEncoder().encode(`${input.tenantId}:${input.documentId}:${actorProfileId}:${hash}`));
  return `${id.slice(0, 8)}-${id.slice(8, 12)}-8${id.slice(13, 16)}-a${id.slice(17, 20)}-${id.slice(20, 32)}`;
}
