const UMLAUT_MAP: Record<string, string> = {
  ä: 'ae',
  ö: 'oe',
  ü: 'ue',
  Ä: 'Ae',
  Ö: 'Oe',
  Ü: 'Ue',
  ß: 'ss',
};

export function sanitizeDocumentPdfBaseName(value: string): string {
  const normalized = value
    .trim()
    .split('')
    .map((char) => UMLAUT_MAP[char] ?? char)
    .join('')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');

  return normalized || 'Dokument';
}

export function buildDocumentPdfFileName(
  title: string,
  clientLastName?: string | null,
): string {
  const parts = [sanitizeDocumentPdfBaseName(title)];
  const lastName = clientLastName?.trim();
  if (lastName) {
    parts.push(sanitizeDocumentPdfBaseName(lastName));
  }
  return `${parts.join('_')}.pdf`;
}

export function isDirectPdfDownloadMimeType(mimeType: string): boolean {
  return mimeType.trim().toLowerCase() === 'application/pdf';
}

export function isDirectImageDownloadMimeType(mimeType: string): boolean {
  return mimeType.trim().toLowerCase().startsWith('image/');
}

export function isHtmlDocumentMimeType(mimeType: string): boolean {
  return mimeType.trim().toLowerCase() === 'text/html';
}
