import { createHash } from 'crypto';

/** SHA-256 Hash für Dokumentinhalt — server-/Node-kompatibel. */
export function computeDocumentContentHash(content: string): string {
  return `sha256:${createHash('sha256').update(content, 'utf8').digest('hex')}`;
}

export function computeDocumentPackageHash(input: {
  html: string;
  pdfPath: string | null;
  documentNumber: string | null;
}): string {
  const payload = [input.html, input.pdfPath ?? '', input.documentNumber ?? ''].join('\n---\n');
  return computeDocumentContentHash(payload);
}
