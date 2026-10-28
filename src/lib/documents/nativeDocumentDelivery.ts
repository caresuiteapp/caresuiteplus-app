import { Directory, File, Paths } from 'expo-file-system';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { printAsync } from 'expo-print';

function cacheDocument(bytes: Uint8Array, fileName: string) {
  const folder = new Directory(Paths.cache, 'caresuite-documents');
  folder.create({ intermediates: true, idempotent: true });
  const name = fileName.replace(/[\\/:*?"<>|]/g, '_').replace(/^\.+/, '_') || 'Dokument.pdf';
  const file = new File(folder, name); file.create({ overwrite: true }); file.write(bytes); return file;
}
export async function shareNativeDocument(bytes: Uint8Array, fileName: string, original: boolean | string = false) {
  if (!(await isAvailableAsync())) throw new Error('Auf diesem Gerät steht keine Dateifreigabe zur Verfügung.');
  const file = cacheDocument(bytes, fileName);
  await shareAsync(file.uri, { mimeType: typeof original === 'string' ? original : original ? undefined : 'application/pdf', dialogTitle: 'Dokument öffnen, speichern oder teilen' });
}
export async function printNativeDocument(bytes: Uint8Array, fileName: string) {
  const file = cacheDocument(bytes, fileName); await printAsync({ uri: file.uri });
}
export async function nativeDocumentLogo(url: string): Promise<string | undefined> {
  if (!url) return undefined;
  if (/^data:image\/(png|jpeg|webp);base64,/.test(url)) return url;
  if (new URL(url).protocol !== 'https:') throw new Error('Das Unternehmenslogo benötigt eine sichere Adresse.');
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error('Das Unternehmenslogo konnte nicht geladen werden.');
    const mime = response.headers.get('content-type')?.split(';')[0];
    if (!mime || !['image/png', 'image/jpeg', 'image/webp'].includes(mime) || Number(response.headers.get('content-length')) > 5 * 1024 * 1024) throw new Error('Das Logo muss eine PNG-, JPEG- oder WebP-Datei mit höchstens 5 MB sein.');
    const bytes = new Uint8Array(await response.arrayBuffer()); if (bytes.length > 5 * 1024 * 1024) throw new Error('Das Unternehmenslogo ist zu groß.');
    let binary = ''; for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    return `data:${mime};base64,${btoa(binary)}`;
  } finally { clearTimeout(timer); }
}
