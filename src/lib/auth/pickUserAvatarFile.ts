import * as DocumentPicker from 'expo-document-picker';
import {
  USER_AVATAR_ALLOWED_MIME_TYPES,
  type UserAvatarPending,
  validateUserAvatarFile,
} from '@/lib/auth/useravatarservice';

export type PickUserAvatarResult =
  | { ok: true; data: UserAvatarPending }
  | { ok: false; cancelled: true }
  | { ok: false; cancelled: false; error: string };

async function readPickedImage(
  asset: DocumentPicker.DocumentPickerAsset,
): Promise<{ ok: true; data: UserAvatarPending } | { ok: false; error: string }> {
  const mimeType = asset.mimeType ?? '';
  const initialSize = asset.size ?? 0;
  const typeCheck = validateUserAvatarFile(mimeType, initialSize || 1);
  if (!typeCheck.ok) {
    return { ok: false, error: typeCheck.error };
  }

  if (!asset.uri) {
    return { ok: false, error: 'Datei konnte nicht gelesen werden.' };
  }

  try {
    const response = await fetch(asset.uri);
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const sizeBytes = initialSize || bytes.length;
    const sizeCheck = validateUserAvatarFile(mimeType, sizeBytes);
    if (!sizeCheck.ok) {
      return { ok: false, error: sizeCheck.error };
    }

    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i] ?? 0);
    }

    return {
      ok: true,
      data: {
        localUri: asset.uri,
        fileName: asset.name ?? `avatar.${typeCheck.data === 'image/png' ? 'png' : 'jpg'}`,
        mimeType: typeCheck.data,
        sizeBytes,
        contentBase64: btoa(binary),
      },
    };
  } catch {
    return { ok: false, error: 'Datei konnte nicht gelesen werden.' };
  }
}

export async function pickUserAvatarFile(): Promise<PickUserAvatarResult> {
  const result = await DocumentPicker.getDocumentAsync({
    type: [...USER_AVATAR_ALLOWED_MIME_TYPES],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets?.[0]) {
    return { ok: false, cancelled: true };
  }

  const read = await readPickedImage(result.assets[0]);
  if (!read.ok) {
    return { ok: false, cancelled: false, error: read.error };
  }

  return { ok: true, data: read.data };
}
