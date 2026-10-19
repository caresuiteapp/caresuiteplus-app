import type { Profile, ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isDemoMode } from '@/lib/supabase/config';
import { resolveAuthenticatedProfileId } from '@/lib/auth/resolveAuthenticatedProfile';
import { composeUserFullName } from '@/lib/auth/userdisplayname';
import { buildUserProfileWritePayload, patchDemoProfileOverride } from '@/lib/auth/userprofileservice';
import {
  USER_AVATAR_BUCKET,
  USER_AVATAR_MAX_BYTES,
  validateUserAvatarFile,
  type UserAvatarMimeType,
  type UserAvatarPending,
} from '@/lib/auth/useravatarservice';
import { buildTenantStoragePath } from '@/lib/storage/storagePaths';

export type UserProfileAccountDraft = { firstName: string; lastName: string; phone: string };

const IDENTITY_ERROR = 'Ihr angemeldetes Profil konnte nicht bestätigt werden. Bitte melden Sie sich erneut an.';
const SAVE_ERROR = 'Die Änderungen konnten nicht gespeichert werden. Bitte versuchen Sie es erneut.';
const IMAGE_ERROR = 'Die Datei ist kein lesbares JPEG-, PNG- oder WebP-Bild.';
const PROFILE_COLUMNS = 'id, tenant_id, first_name, last_name, phone, avatar_url, updated_at';
type AccountClient = NonNullable<ReturnType<typeof getSupabaseClient>>;
type AccountRow = {
  id: string;
  tenant_id: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  updated_at: string;
};

export function validateUserProfileAccountDraft(draft: UserProfileAccountDraft): ServiceResult<UserProfileAccountDraft> {
  const normalized = {
    firstName: draft.firstName.trim(),
    lastName: draft.lastName.trim(),
    phone: draft.phone.trim(),
  };
  if (!normalized.firstName && !normalized.lastName) {
    return { ok: false, error: 'Bitte geben Sie mindestens einen Vor- oder Nachnamen an.' };
  }
  if (normalized.firstName.length > 120 || normalized.lastName.length > 120) {
    return { ok: false, error: 'Vor- und Nachname dürfen jeweils höchstens 120 Zeichen enthalten.' };
  }
  if (normalized.phone.length > 50) {
    return { ok: false, error: 'Die Telefonnummer darf höchstens 50 Zeichen enthalten.' };
  }
  if (Object.values(normalized).some((value) => /[\u0000-\u001f\u007f]/.test(value))) {
    return { ok: false, error: 'Bitte entfernen Sie Zeilenumbrüche und unsichtbare Steuerzeichen.' };
  }
  return { ok: true, data: normalized };
}

function friendlyError(error: unknown, fallback = SAVE_ERROR): string {
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
  if (/network|fetch|offline|connection|timeout/i.test(message)) {
    return 'Die Verbindung ist unterbrochen. Bitte prüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.';
  }
  if (/row.level.security|policy|permission|unauthorized|jwt|not authenticated/i.test(message)) {
    return 'Die Änderung wurde nicht freigegeben. Bitte melden Sie sich erneut an und versuchen Sie es noch einmal.';
  }
  return fallback;
}

async function confirmAccount(profile: Profile, authUserId: string): Promise<ServiceResult<AccountClient>> {
  if (!profile.id || !profile.tenantId || !authUserId ||
      !/^[a-zA-Z0-9_-]+$/.test(profile.tenantId) || !/^[a-zA-Z0-9_-]+$/.test(authUserId)) {
    return { ok: false, error: IDENTITY_ERROR };
  }
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Ihr Konto ist momentan nicht erreichbar. Bitte versuchen Sie es erneut.' };
  const { data, error } = await client.auth.getUser();
  if (error || data.user?.id !== authUserId) return { ok: false, error: IDENTITY_ERROR };
  // profiles.id can differ from auth.uid() on older accounts. Reuse the verified mapping.
  const resolved = await resolveAuthenticatedProfileId(profile.tenantId);
  if (!resolved.ok || resolved.data !== profile.id) return { ok: false, error: IDENTITY_ERROR };
  return { ok: true, data: client };
}

function accountResult(profile: Profile, row: AccountRow | null): ServiceResult<Profile> {
  if (!row || row.id !== profile.id || row.tenant_id !== profile.tenantId) {
    return { ok: false, error: 'Die Änderung konnte nicht bestätigt werden. Bitte laden Sie Ihr Profil neu.' };
  }
  return {
    ok: true,
    data: {
      ...profile,
      firstName: row.first_name?.trim() || null,
      lastName: row.last_name?.trim() || null,
      displayName: composeUserFullName(row.first_name, row.last_name),
      phone: row.phone?.trim() || null,
      avatarUrl: row.avatar_url,
      updatedAt: row.updated_at,
    },
  };
}

function demoResult(profile: Profile, patch: Partial<Profile>): ServiceResult<Profile> {
  patchDemoProfileOverride(profile.id, patch);
  return { ok: true, data: { ...profile, ...patch } };
}

export async function saveUserProfileAccount(
  profile: Profile,
  authUserId: string,
  draft: UserProfileAccountDraft,
): Promise<ServiceResult<Profile>> {
  const validated = validateUserProfileAccountDraft(draft);
  if (!validated.ok) return validated;
  const { firstName, lastName, phone } = validated.data;
  const updatedAt = new Date().toISOString();
  if (isDemoMode()) {
    return demoResult(profile, {
      firstName: firstName || null, lastName: lastName || null,
      displayName: composeUserFullName(firstName, lastName), phone: phone || null, updatedAt,
    });
  }
  try {
    const account = await confirmAccount(profile, authUserId);
    if (!account.ok) return account;
    const { data, error } = await account.data.from('profiles')
      .update({ ...buildUserProfileWritePayload(firstName, lastName, updatedAt), phone: phone || null })
      .eq('id', profile.id).eq('tenant_id', profile.tenantId!)
      .select(PROFILE_COLUMNS).maybeSingle();
    if (error) return { ok: false, error: friendlyError(error) };
    return accountResult(profile, data);
  } catch (error) {
    return { ok: false, error: friendlyError(error) };
  }
}

function matchesImageSignature(bytes: Uint8Array, mimeType: UserAvatarMimeType): boolean {
  if (mimeType === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === 'image/png') return [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
  return bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
}

function checkImage(mimeType: string, sizeBytes: number): ServiceResult<UserAvatarMimeType> {
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) return { ok: false, error: 'Die Bilddatei ist leer oder konnte nicht gelesen werden.' };
  return validateUserAvatarFile(mimeType, sizeBytes);
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let start = 0; start < bytes.length; start += 8192) {
    binary += String.fromCharCode(...bytes.subarray(start, start + 8192));
  }
  return btoa(binary);
}

async function canDecodeImage(dataUrl: string): Promise<boolean> {
  return new Promise((resolve) => {
    const image = new Image();
    const timer = setTimeout(() => finish(false), 10_000);
    const finish = (valid: boolean) => {
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      image.src = '';
      resolve(valid);
    };
    image.onload = () => finish(image.naturalWidth > 0 && image.naturalHeight > 0);
    image.onerror = () => finish(false);
    image.src = dataUrl;
  });
}

export async function readUserProfileAvatarFile(file: File): Promise<ServiceResult<UserAvatarPending>> {
  const validation = checkImage(file.type, file.size);
  if (!validation.ok) return validation;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const actual = checkImage(validation.data, bytes.byteLength);
    if (!actual.ok) return actual;
    if (bytes.byteLength !== file.size || !matchesImageSignature(bytes, validation.data)) {
      return { ok: false, error: IMAGE_ERROR };
    }
    const contentBase64 = toBase64(bytes);
    const localUri = `data:${validation.data};base64,${contentBase64}`;
    if (!await canDecodeImage(localUri)) return { ok: false, error: IMAGE_ERROR };
    return {
      ok: true,
      data: { localUri, fileName: file.name, mimeType: validation.data, sizeBytes: bytes.byteLength, contentBase64 },
    };
  } catch {
    return { ok: false, error: 'Die Bilddatei konnte nicht gelesen werden. Bitte wählen Sie sie erneut aus.' };
  }
}

function pendingBytes(pending: UserAvatarPending): ServiceResult<Uint8Array<ArrayBuffer>> {
  const validation = checkImage(pending.mimeType, pending.sizeBytes);
  if (!validation.ok) return validation;
  if (!pending.contentBase64 || pending.contentBase64.length > Math.ceil(USER_AVATAR_MAX_BYTES / 3) * 4) {
    return { ok: false, error: IMAGE_ERROR };
  }
  try {
    const bytes = Uint8Array.from(atob(pending.contentBase64), (character) => character.charCodeAt(0));
    if (bytes.length !== pending.sizeBytes || !matchesImageSignature(bytes, validation.data)) {
      return { ok: false, error: IMAGE_ERROR };
    }
    return { ok: true, data: bytes };
  } catch {
    return { ok: false, error: IMAGE_ERROR };
  }
}

export async function saveUserAccountAvatar(
  profile: Profile,
  authUserId: string,
  pending: UserAvatarPending,
): Promise<ServiceResult<Profile>> {
  const bytes = pendingBytes(pending);
  if (!bytes.ok) return bytes;
  const updatedAt = new Date().toISOString();
  if (isDemoMode()) {
    return demoResult(profile, { avatarUrl: `data:${pending.mimeType};base64,${pending.contentBase64}`, updatedAt });
  }
  try {
    const account = await confirmAccount(profile, authUserId);
    if (!account.ok) return account;
    const extension = pending.mimeType === 'image/jpeg' ? 'jpg' : pending.mimeType === 'image/png' ? 'png' : 'webp';
    // A replacement must never overwrite the current image before the profile update succeeds.
    const storagePath = buildTenantStoragePath(profile.tenantId!, 'users', authUserId, `avatar-${crypto.randomUUID()}.${extension}`);
    const bucket = account.data.storage.from(USER_AVATAR_BUCKET);
    const { error: uploadError } = await bucket.upload(storagePath, bytes.data, { contentType: pending.mimeType, upsert: false });
    if (uploadError) return { ok: false, error: friendlyError(uploadError, 'Das Profilbild konnte nicht hochgeladen werden. Bitte versuchen Sie es erneut.') };
    const avatarUrl = bucket.getPublicUrl(storagePath).data.publicUrl;
    if (!avatarUrl) return { ok: false, error: 'Das Profilbild konnte nicht bestätigt werden. Bitte versuchen Sie es erneut.' };
    // Recheck after upload so a sign-out/account switch cannot persist an earlier account's image.
    const stillCurrent = await confirmAccount(profile, authUserId);
    if (!stillCurrent.ok) return stillCurrent;
    const { data, error } = await stillCurrent.data.from('profiles')
      .update({ avatar_url: avatarUrl, updated_at: updatedAt })
      .eq('id', profile.id).eq('tenant_id', profile.tenantId!)
      .select(PROFILE_COLUMNS).maybeSingle();
    if (error) return { ok: false, error: friendlyError(error) };
    // Keep objects after an uncertain response: the DB update may already have committed.
    // Existing objects are also retained to avoid breaking other references or concurrent saves.
    const result = accountResult(profile, data);
    if (result.ok && result.data.avatarUrl !== avatarUrl) return { ok: false, error: SAVE_ERROR };
    return result;
  } catch (error) {
    return { ok: false, error: friendlyError(error, 'Das Profilbild konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.') };
  }
}

export async function removeUserAccountAvatar(profile: Profile, authUserId: string): Promise<ServiceResult<Profile>> {
  const updatedAt = new Date().toISOString();
  if (isDemoMode()) return demoResult(profile, { avatarUrl: null, updatedAt });
  try {
    const account = await confirmAccount(profile, authUserId);
    if (!account.ok) return account;
    const { data, error } = await account.data.from('profiles')
      .update({ avatar_url: null, updated_at: updatedAt })
      .eq('id', profile.id).eq('tenant_id', profile.tenantId!)
      .select(PROFILE_COLUMNS).maybeSingle();
    if (error) return { ok: false, error: friendlyError(error) };
    const result = accountResult(profile, data);
    if (result.ok && result.data.avatarUrl !== null) return { ok: false, error: SAVE_ERROR };
    return result;
  } catch (error) {
    return { ok: false, error: friendlyError(error) };
  }
}
