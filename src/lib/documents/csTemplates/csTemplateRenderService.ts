import type { DocumentContext } from '@/types/documents/csTemplateDatabase';
import { normalizeDocumentContext } from './csDocumentContextNormalize';

const PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

function escapeHtmlText(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]!);
}

function readContextPath(context: DocumentContext, path: string): string {
  const normalized = normalizeDocumentContext(context);
  const parts = path.split('.');
  let current: unknown = normalized;
  for (const part of parts) {
    if (!current || typeof current !== 'object') return '';
    current = (current as Record<string, unknown>)[part];
  }
  return current == null ? '' : String(current);
}

export function extractPlaceholderKeys(html: string): string[] {
  const keys = new Set<string>();
  for (const match of html.matchAll(PLACEHOLDER_PATTERN)) {
    if (match[1]) keys.add(match[1]);
  }
  return [...keys];
}

export function renderCsTemplateHtml(
  html: string,
  context: DocumentContext,
  options?: { emptyOptionalPlaceholder?: string },
): string {
  const empty = options?.emptyOptionalPlaceholder ?? '—';
  const normalized = normalizeDocumentContext(context);
  return html.replace(PLACEHOLDER_PATTERN, (_full, key: string) => {
    const value = readContextPath(normalized, key).trim();
    return escapeHtmlText(value || empty);
  });
}

export function annotateSignatureRegions(html: string): string {
  return html.replace(
    /(<span[^>]*data-signature-anchor="([^"]+)"[^>]*>)([\s\S]*?)(<\/span>)/gi,
    (_match, open: string, anchor: string, inner: string, close: string) =>
      `${open}<strong style="color:#7c3aed;">[Pflichtsignatur · ${escapeHtmlText(anchor)}]</strong>${inner}${close}`,
  );
}

export function injectSignatureIntoHtml(
  html: string,
  anchorToken: string,
  signatureDataUrl: string,
  signerName: string,
  signedAt: string,
): string {
  if (!/^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(signatureDataUrl)) {
    throw new Error('Die Unterschrift enthält kein unterstütztes Bildformat.');
  }
  const escapedAnchor = anchorToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const anchorPattern = new RegExp(
    `(<span[^>]*data-signature-anchor="${escapedAnchor}"[^>]*>)(\\[SIGNATURE:[^\\]]+\\])(</span>)`,
    'i',
  );
  const img = `<img src="${signatureDataUrl}" alt="Unterschrift" style="max-height:80px;max-width:240px;" /><br/><small>${escapeHtmlText(signerName)} · ${new Date(signedAt).toLocaleString('de-DE')}</small>`;
  if (anchorPattern.test(html)) {
    return html.replace(anchorPattern, (_match, open: string, _signature: string, close: string) => `${open}${img}${close}`);
  }
  return `${html}<p data-signature-anchor="${escapeHtmlText(anchorToken)}">${img}</p>`;
}
