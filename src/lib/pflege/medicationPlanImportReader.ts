import { getDocumentAsync } from 'expo-document-picker';
import { File as ExpoFile, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { readLocalBmpParts } from '@/lib/calendar/localPlanReader';

export const MEDICATION_PLAN_MAX_FILE_BYTES = 3 * 1024 * 1024;
const MAX_XML = 131_072;

export type MedicationPlanImportFile = {
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
  xmlPages: string[];
};

function check(signal?: AbortSignal) {
  if (signal?.aborted) {
    const error = new Error('Dateiauswahl abgebrochen.');
    error.name = 'AbortError';
    throw error;
  }
}

function assertSize(size: number) {
  if (!Number.isSafeInteger(size) || size < 1 || size > MEDICATION_PLAN_MAX_FILE_BYTES) {
    throw new Error('Bitte einen nicht leeren Medikationsplan bis 3 MiB auswählen.');
  }
}

function latin1(bytes: Uint8Array): string {
  let value = '';
  for (let start = 0; start < bytes.length; start += 8192) value += String.fromCharCode(...bytes.subarray(start, start + 8192));
  return value;
}

function utf8(bytes: Uint8Array): string {
  if (typeof TextDecoder === 'function') return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  // The small XML bound also limits this fallback on engines without TextDecoder.
  return decodeURIComponent(Array.from(bytes, (byte) => `%${byte.toString(16).padStart(2, '0')}`).join(''));
}

function isBmpXml(xml: string) {
  return xml.length <= MAX_XML && !xml.includes('\uFFFD')
    && /^\uFEFF?\s*(?:<\?xml\s[^?]*\?>\s*)?<MP(?:\s|>)/.test(xml);
}

/** Keep UTF-8 and BMP's ISO-8859-1 characters exact; no replacement decoding. */
export function decodeBmpXml(bytes: Uint8Array): string {
  if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length > MAX_XML) throw new Error('Die BMP-XML-Daten sind leer oder zu groß.');
  const bom = bytes[0] === 239 && bytes[1] === 187 && bytes[2] === 191;
  const raw = bom ? bytes.subarray(3) : bytes;
  const declaration = /^\s*<\?xml\s+[^?]*?encoding\s*=\s*(["'])([^"']+)\1/i.exec(latin1(raw.subarray(0, 256)));
  const encoding = declaration?.[2]?.toLowerCase();
  if (encoding && !['utf-8', 'iso-8859-1'].includes(encoding) || bom && encoding === 'iso-8859-1') {
    throw new Error('Die BMP-XML-Datei muss UTF-8 oder ISO-8859-1 verwenden.');
  }
  let xml: string;
  if (encoding === 'iso-8859-1') xml = latin1(raw);
  else {
    try { xml = utf8(raw); }
    catch {
      if (encoding || bom) throw new Error('Die UTF-8-Daten des Medikationsplans sind beschädigt.');
      xml = latin1(raw);
    }
  }
  if (!isBmpXml(xml)) throw new Error('Die Datei enthält keinen gültig erkennbaren BMP-XML-Plan.');
  return xml;
}

function pictureOrPdf(bytes: Uint8Array): string | null {
  const prefix = latin1(bytes.subarray(0, 12));
  if (prefix.startsWith('%PDF-')) return 'application/pdf';
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)) return 'image/png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (prefix.startsWith('RIFF') && prefix.slice(8) === 'WEBP') return 'image/webp';
  return null;
}

function fileNameFor(value: string, mimeType: string) {
  const name = value.replace(/[\\/:*?"<>|\x00-\x1f\x7f]/g, '_').trim().slice(0, 180);
  const extension = ({ 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as Record<string, string>)[mimeType] ?? 'xml';
  return name || `Medikationsplan.${extension}`;
}

/** Select and read a local BMP original. No URI fetch, network OCR, or medication write. */
export async function importMedicationPlanFile(signal?: AbortSignal): Promise<MedicationPlanImportFile | null> {
  check(signal);
  const web = Platform.OS === 'web';
  let picked;
  try {
    picked = await getDocumentAsync({
      type: web ? ['.xml', 'application/xml', 'text/xml', 'application/pdf', 'image/jpeg', 'image/png', 'image/webp'] : ['application/xml', 'text/xml', 'text/plain'],
      copyToCacheDirectory: !web, base64: false, multiple: false,
    });
  } catch {
    check(signal);
    throw new Error('Die Datei konnte nicht ausgewählt werden. Bitte die BMP-Datei erneut öffnen.');
  }
  if (picked.canceled || !picked.assets[0]) { check(signal); return null; }
  const asset = picked.assets[0];
  let cached: ExpoFile | null = null;
  try {
    let bytes: Uint8Array;
    if (web) {
      check(signal);
      if (!asset.file) throw new Error('Die Datei konnte nicht lokal gelesen werden. Bitte erneut auswählen.');
      assertSize(asset.file.size);
      bytes = new Uint8Array(await asset.file.arrayBuffer());
    } else {
      const cachePrefix = `${Paths.cache.uri.replace(/\/$/, '')}/DocumentPicker/`;
      const suffix = asset.uri.slice(cachePrefix.length);
      if (!asset.uri.startsWith(cachePrefix) || !suffix || /[\\/]/.test(suffix) || /^\.{1,2}$/.test(suffix)) {
        throw new Error('Die lokale Dateikopie ist nicht verfügbar. Bitte erneut auswählen.');
      }
      cached = new ExpoFile(asset.uri);
      check(signal);
      assertSize(cached.size);
      bytes = await cached.bytes();
    }
    check(signal);
    assertSize(bytes.byteLength);
    const visualMimeType = pictureOrPdf(bytes);
    if (!visualMimeType) return { fileName: fileNameFor(asset.name, 'application/xml'), mimeType: 'application/xml', bytes, xmlPages: [decodeBmpXml(bytes)] };
    if (!web || !asset.file) throw new Error('In der App bitte BMP-XML verwenden. PDF und Fotos werden im Browser lokal gelesen.');

    let parts: Array<string | Uint8Array>;
    try { parts = await readLocalBmpParts(asset.file, signal); }
    catch (cause) {
      check(signal);
      if (cause instanceof Error && cause.name === 'CareSuiteBmpReadError') throw cause;
      throw new Error('Die Datei konnte nicht lokal als Medikationsplan gelesen werden. Bitte eine lesbare BMP-Datei oder BMP-XML verwenden.');
    }
    check(signal);
    if (!Array.isArray(parts) || parts.length < 1 || parts.length > 12) throw new Error('Die Anzahl der gelesenen BMP-Seiten ist ungültig.');
    const xmlPages = parts.map((part) => {
      if (typeof part !== 'string') return decodeBmpXml(part);
      if (!isBmpXml(part)) throw new Error('Die BMP-Daten aus dem Code sind unvollständig. Bitte BMP-XML verwenden.');
      return part;
    });
    return { fileName: fileNameFor(asset.name, visualMimeType), mimeType: visualMimeType, bytes, xmlPages };
  } finally {
    if (web && asset.uri.startsWith('blob:')) URL.revokeObjectURL(asset.uri);
    try { if (cached?.exists) cached.delete(); } catch { /* Only our picker cache copy; cleanup is best effort. */ }
  }
}
