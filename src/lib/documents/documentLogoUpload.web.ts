import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getSupabaseClient } from '@/lib/supabase/client';
import { TENANT_LOGO_BUCKET, TENANT_LOGO_MAX_BYTES } from '@/lib/tenant/tenantLogoService';

export const DOCUMENT_LOGO_ACCEPT = 'image/png,image/jpeg,image/webp';
const extensions: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type PreparedDocumentLogo = { file: File; previewUrl: string; width: number; height: number; uploadId: string };

async function validateFile(file: File): Promise<string | null> {
  if (!Object.prototype.hasOwnProperty.call(extensions, file.type)) return 'Bitte wählen Sie ein Logo als PNG, JPG oder WebP aus.';
  if (!file.size || file.size > TENANT_LOGO_MAX_BYTES) return 'Das Logo muss zwischen 1 Byte und 5 MB groß sein.';
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => b[i] === v);
  const jpg = b[0] === 255 && b[1] === 216 && b[2] === 255;
  const webp = String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP';
  if (!(file.type === 'image/png' ? png : file.type === 'image/jpeg' ? jpg : webp)) return 'Die Datei enthält kein gültiges Bild im angegebenen Format.';
  return null;
}

export async function prepareDocumentLogo(file: File): Promise<ServiceResult<PreparedDocumentLogo>> {
  let previewUrl: string | null = null;
  try {
    const invalid = await validateFile(file);
    if (invalid) return { ok: false, error: invalid };
    previewUrl = URL.createObjectURL(file);
    const image = new Image();
    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const timer = window.setTimeout(() => { image.onload = null; image.onerror = null; image.src = ''; reject(new Error('Das Logo konnte nicht gelesen werden. Bitte wählen Sie die Datei erneut aus.')); }, 10000);
      image.onload = () => { window.clearTimeout(timer); resolve({ width: image.naturalWidth, height: image.naturalHeight }); };
      image.onerror = () => { window.clearTimeout(timer); reject(new Error('Die Bilddatei konnte nicht geöffnet werden. Bitte wählen Sie ein anderes Logo aus.')); };
      image.src = previewUrl!;
    });
    if (!dimensions.width || !dimensions.height || dimensions.width * dimensions.height > 24_000_000) throw new Error('Bitte verwenden Sie ein Logo mit höchstens 24 Megapixeln.');
    return { ok: true, data: { file, previewUrl, ...dimensions, uploadId: crypto.randomUUID() } };
  } catch (error) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    return { ok: false, error: error instanceof Error ? error.message : 'Das Logo konnte nicht gelesen werden.' };
  }
}

export async function uploadDocumentLogo(tenantId: string, logo: PreparedDocumentLogo, roleKey?: RoleKey | null): Promise<ServiceResult<string>> {
  const denied = enforcePermission<string>(roleKey, 'office.catalogs.edit');
  if (denied) return denied;
  const blocked = guardServiceTenant(tenantId);
  if (blocked) return blocked;
  if (!uuid.test(tenantId) || !uuid.test(logo.uploadId)) return { ok: false, error: 'Das Logo kann diesem Unternehmen nicht zugeordnet werden.' };
  try {
    const invalid = await validateFile(logo.file);
    if (invalid) return { ok: false, error: invalid };
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: 'Die Verbindung zum Dateispeicher ist nicht verfügbar.' };
    const storage = client.storage.from(TENANT_LOGO_BUCKET);
    // Every selection gets an immutable key: replacing a logo must not change saved documents.
    const path = `tenant/${tenantId}/document-logos/${logo.uploadId}.${extensions[logo.file.type]}`;
    const { error } = await storage.upload(path, logo.file, { contentType: logo.file.type, upsert: false, cacheControl: '31536000' });
    if (error) {
      // An interrupted response may still have stored the file. Only reuse an exact byte match.
      const existing = await storage.download(path);
      if (existing.error || !existing.data || existing.data.size !== logo.file.size) return { ok: false, error: 'Das Logo konnte nicht hochgeladen werden. Bitte versuchen Sie es erneut.' };
      const [saved, selected] = await Promise.all([existing.data.arrayBuffer(), logo.file.arrayBuffer()]);
      const bytes = new Uint8Array(saved), wanted = new Uint8Array(selected);
      if (bytes.length !== wanted.length || !bytes.every((value, index) => value === wanted[index])) return { ok: false, error: 'Das gespeicherte Logo stimmt nicht mit der ausgewählten Datei überein. Bitte wählen Sie das Logo erneut aus.' };
    }
    const url = storage.getPublicUrl(path).data.publicUrl;
    if (!url || new URL(url).protocol !== 'https:') return { ok: false, error: 'Das hochgeladene Logo konnte nicht bereitgestellt werden.' };
    return { ok: true, data: url };
  } catch { return { ok: false, error: 'Das Logo konnte nicht hochgeladen werden. Bitte versuchen Sie es erneut.' }; }
}
