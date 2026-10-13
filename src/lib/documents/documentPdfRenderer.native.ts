import { printToFileAsync } from 'expo-print';
import { File } from 'expo-file-system';
import { getSupabaseConfig } from '@/lib/supabase/config';

/** Render on the device; the source document stays unchanged. */
export async function renderHtmlToPdfBytes(html: string): Promise<Uint8Array> {
  if (!html.trim()) throw new Error('Der Dokumentinhalt fehlt.');
  const origin = new URL(getSupabaseConfig().url || 'https://www.caresuiteplus.app').origin;
  // The print copy cannot run scripts, open frames or make arbitrary requests.
  const policy = `default-src 'none'; script-src 'none'; connect-src 'none'; img-src data: ${origin}; style-src 'unsafe-inline'; font-src data:; base-uri 'none'; form-action 'none'`;
  const safeguards = `<meta http-equiv="Content-Security-Policy" content="${policy}"><style>@page{size:A4;margin:0}[data-pdf-page]{break-after:page}[data-pdf-page]:last-child{break-after:auto}</style>`;
  const printHtml = /<head(?:\s[^>]*)?>/i.test(html)
    ? html.replace(/<head(?:\s[^>]*)?>/i, opening => opening + safeguards)
    : `<!DOCTYPE html><html><head>${safeguards}</head><body>${html}</body></html>`;
  const rendered = await printToFileAsync({ html: printHtml, base64: true, width: 595.28, height: 841.89 });
  try {
    if (!rendered.base64 || rendered.numberOfPages < 1) throw new Error('Die PDF-Datei konnte nicht vollständig erzeugt werden.');
    const bytes = Uint8Array.from(atob(rendered.base64), char => char.charCodeAt(0));
    if (bytes.length < 512 || !new TextDecoder().decode(bytes.slice(0, 8)).startsWith('%PDF-')
      || !new TextDecoder().decode(bytes.slice(-1024)).includes('%%EOF')) {
      throw new Error('Die erzeugte PDF-Datei konnte nicht bestätigt werden.');
    }
    return bytes;
  } finally {
    try { const file = new File(rendered.uri); if (file.exists) file.delete(); } catch { /* cache cleanup is best effort */ }
  }
}
