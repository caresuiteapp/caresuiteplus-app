import type { Profile, ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isDemoMode } from '@/lib/supabase/config';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { buildTenantStoragePath } from '@/lib/storage/storagePaths';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { patchDemoProfileOverride } from '@/lib/auth/userprofileservice';

export const USER_AVATAR_BUCKET = 'user-avatars';

export const USER_AVATAR_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type UserAvatarMimeType = (typeof USER_AVATAR_ALLOWED_MIME_TYPES)[number];

export const USER_AVATAR_MAX_BYTES = 5 * 1024 * 1024;

export type UserAvatarPending = {
  localUri: string;
  fileName: string;
  mimeType: UserAvatarMimeType;
  sizeBytes: number;
  contentBase64: string;
};

const MIME_TO_EXT: Record<UserAvatarMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function isUserAvatarMimeType(mimeType: string): mimeType is UserAvatarMimeType {
  return (USER_AVATAR_ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType);
}

export function validateUserAvatarFile(
  mimeType: string,
  sizeBytes: number,
): ServiceResult<UserAvatarMimeType> {
  if (!isUserAvatarMimeType(mimeType)) {
    return {
      ok: false,
      error: 'Nur JPEG, PNG oder WebP sind erlaubt.',
    };
  }
  if (sizeBytes <= 0) {
    return { ok: false, error: 'Datei ist leer.' };
  }
  if (sizeBytes > USER_AVATAR_MAX_BYTES) {
    return { ok: false, error: 'Profilbild darf maximal 5 MB groß sein.' };
  }
  return { ok: true, data: mimeType };
}

export function buildUserAvatarStoragePath(
  tenantId: string,
  authUserId: string,
  mimeType: UserAvatarMimeType,
): string {
  const ext = MIME_TO_EXT[mimeType];
  return buildTenantStoragePath(tenantId, 'users', authUserId, `avatar.${ext}`);
}

export function resolveUserAvatarPublicUrl(storagePath: string): string | null {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data } = supabase.storage.from(USER_AVATAR_BUCKET).getPublicUrl(storagePath);
  return data.publicUrl ?? null;
}

function buildDemoAvatarDataUrl(mimeType: UserAvatarMimeType, contentBase64: string): string {
  return `data:${mimeType};base64,${contentBase64}`;
}

export function toUserAvatarUploadError(message: string): string {
  const msg = message.trim();
  const lower = msg.toLowerCase();

  if (
    lower.includes('bucket not found')
    || lower.includes('bucket does not exist')
    || lower.includes('invalid bucket')
  ) {
    return 'Profilbild-Speicher ist nicht eingerichtet — Migration 0088 anwenden.';
  }
  if (lower.includes('row-level security') || lower.includes('rls') || lower.includes('policy')) {
    return 'Kein Zugriff auf Profilbild-Speicher (Berechtigung fehlt).';
  }
  if (lower.includes('payload too large') || lower.includes('maximum allowed size')) {
    return 'Profilbild darf maximal 5 MB groß sein.';
  }
  if (lower.includes('mime') && lower.includes('not allowed')) {
    return 'Nur JPEG, PNG oder WebP sind erlaubt.';
  }

  return msg || 'Profilbild-Upload fehlgeschlagen.';
}

export async function uploadUserAvatar(
  tenantId: string,
  authUserId: string,
  pending: UserAvatarPending,
): Promise<ServiceResult<{ avatarUrl: string; storagePath: string }>> {
  const validation = validateUserAvatarFile(pending.mimeType, pending.sizeBytes);
  if (!validation.ok) return validation;

  if (isDemoMode()) {
    return {
      ok: true,
      data: {
        avatarUrl: buildDemoAvatarDataUrl(validation.data, pending.contentBase64),
        storagePath: 'demo',
      },
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const storagePath = buildUserAvatarStoragePath(tenantId, authUserId, validation.data);
  const payload = Uint8Array.from(atob(pending.contentBase64), (c) => c.charCodeAt(0));

  const { error: uploadError } = await supabase.storage
    .from(USER_AVATAR_BUCKET)
    .upload(storagePath, payload, {
      contentType: validation.data,
      upsert: true,
    });

  if (uploadError) {
    return { ok: false, error: toUserAvatarUploadError(uploadError.message ?? '') };
  }

  const avatarUrl = resolveUserAvatarPublicUrl(storagePath);
  if (!avatarUrl) {
    return { ok: false, error: 'Profilbild-URL konnte nicht erzeugt werden.' };
  }

  return { ok: true, data: { avatarUrl, storagePath } };
}

export async function persistUserAvatarUrl(
  profileId: string,
  avatarUrl: string | null,
): Promise<ServiceResult<void>> {
  if (isDemoMode()) {
    patchDemoProfileOverride(profileId, { avatarUrl });
    return { ok: true, data: undefined };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
    .eq('id', profileId);

  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: undefined };
}

export async function saveUserProfileAvatar(
  profile: Profile,
  authUserId: string,
  pending: UserAvatarPending,
): Promise<ServiceResult<Profile>> {
  if (!profile.tenantId) {
    return { ok: false, error: 'Mandanten-Kontext fehlt für Profilbild-Upload.' };
  }

  const uploaded = await uploadUserAvatar(profile.tenantId, authUserId, pending);
  if (!uploaded.ok) return uploaded;

  const persisted = await persistUserAvatarUrl(profile.id, uploaded.data.avatarUrl);
  if (!persisted.ok) return persisted;

  const updatedAt = new Date().toISOString();
  return {
    ok: true,
    data: {
      ...profile,
      avatarUrl: uploaded.data.avatarUrl,
      updatedAt,
    },
  };
}

export async function removeUserProfileAvatar(
  profile: Profile,
): Promise<ServiceResult<Profile>> {
  const persisted = await persistUserAvatarUrl(profile.id, null);
  if (!persisted.ok) return persisted;

  const updatedAt = new Date().toISOString();
  return {
    ok: true,
    data: {
      ...profile,
      avatarUrl: null,
      updatedAt,
    },
  };
}
