import { Image } from 'react-native';
import { File } from 'expo-file-system';
import { randomUUID } from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getSupabaseClient } from '@/lib/supabase/client';
import { TENANT_LOGO_BUCKET, TENANT_LOGO_MAX_BYTES } from '@/lib/tenant/tenantLogoService';
import { blobBytes } from '@/lib/platform/blobBytes';
export type NativeDocumentLogo = { bytes: Uint8Array; mimeType: string; fileName: string; previewUrl: string; width: number; height: number; uploadId: string };
export async function pickDocumentLogo(): Promise<NativeDocumentLogo | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['image/png', 'image/jpeg', 'image/webp'], copyToCacheDirectory: true, multiple: false });
  if (result.canceled) return null;
  const asset = result.assets[0]; const file = new File(asset.uri);
  if (!file.size || file.size > TENANT_LOGO_MAX_BYTES) throw new Error('Das Logo darf höchstens 5 MB groß sein.');
  const bytes = await file.bytes(); const png = [137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v); const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255; const webp = String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP';
  if ((!png && !jpg && !webp) || bytes.length > TENANT_LOGO_MAX_BYTES) throw new Error('Bitte ein gültiges Logo als PNG, JPG oder WebP wählen.');
  const size = await Image.getSize(asset.uri); if (!size.width || !size.height || size.width * size.height > 24000000) throw new Error('Das Logo darf höchstens 24 Megapixel haben.');
  return { bytes, mimeType: png ? 'image/png' : jpg ? 'image/jpeg' : 'image/webp', fileName: asset.name, previewUrl: asset.uri, ...size, uploadId: randomUUID() };
}
export async function uploadNativeDocumentLogo(tenantId: string, logo: NativeDocumentLogo, roleKey: RoleKey | null): Promise<ServiceResult<string>> {
  const denied = enforcePermission<string>(roleKey, 'office.catalogs.edit') ?? guardServiceTenant(tenantId); if (denied) return denied;
  if (!/^[0-9a-f-]{36}$/i.test(tenantId) || !/^[0-9a-f-]{36}$/i.test(logo.uploadId)) return { ok: false, error: 'Die Unternehmenszuordnung ist ungültig.' };
  try { const client = getSupabaseClient(); if (!client) throw new Error('Die Datenverbindung ist nicht verfügbar.'); const storage = client.storage.from(TENANT_LOGO_BUCKET); const ext = logo.mimeType === 'image/png' ? 'png' : logo.mimeType === 'image/jpeg' ? 'jpg' : 'webp'; const path = `tenant/${tenantId}/document-logos/${logo.uploadId}.${ext}`;
    const result = await storage.upload(path, logo.bytes, { contentType: logo.mimeType, upsert: false, cacheControl: '31536000' });
    if (result.error) { const existing = await storage.download(path); if (existing.error || !existing.data) throw new Error('Das Logo konnte nicht hochgeladen werden. Bitte erneut versuchen.'); const saved = await blobBytes(existing.data); if (saved.length !== logo.bytes.length || !saved.every((value, i) => value === logo.bytes[i])) throw new Error('Die gespeicherte Datei stimmt nicht mit dem ausgewählten Logo überein.'); }
    const url = storage.getPublicUrl(path).data.publicUrl; if (!url || new URL(url).protocol !== 'https:') throw new Error('Das Logo konnte nicht bereitgestellt werden.'); return { ok: true, data: url };
  } catch (cause) { return { ok: false, error: cause instanceof Error ? cause.message : 'Das Logo konnte nicht gespeichert werden.' }; }
}
