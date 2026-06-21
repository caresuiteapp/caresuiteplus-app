import { sha256Hex } from '@/lib/crypto/sha256Hex';

/** SHA-256 Hash für Dokumentinhalt — cross-platform (web, Node, React Native). */
export function computeDocumentContentHash(content: string): string {
  return `sha256:${sha256Hex(content)}`;
}

export function computeDocumentPackageHash(input: {
  html: string;
  pdfPath: string | null;
  documentNumber: string | null;
}): string {
  const payload = [input.html, input.pdfPath ?? '', input.documentNumber ?? ''].join('\n---\n');
  return computeDocumentContentHash(payload);
}
