import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { buildTenantStoragePath } from '@/lib/storage/storagePaths';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';

export const EMPLOYEE_AVATAR_BUCKET = 'employee-avatars';

export const EMPLOYEE_AVATAR_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type EmployeeAvatarMimeType = (typeof EMPLOYEE_AVATAR_ALLOWED_MIME_TYPES)[number];

export const EMPLOYEE_AVATAR_MAX_BYTES = 5 * 1024 * 1024;

export type EmployeeAvatarPending = {
  localUri: string;
  fileName: string;
  mimeType: EmployeeAvatarMimeType;
  sizeBytes: number;
  contentBase64: string;
};

const MIME_TO_EXT: Record<EmployeeAvatarMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function isEmployeeAvatarMimeType(mimeType: string): mimeType is EmployeeAvatarMimeType {
  return (EMPLOYEE_AVATAR_ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType);
}

export function validateEmployeeAvatarFile(
  mimeType: string,
  sizeBytes: number,
): ServiceResult<EmployeeAvatarMimeType> {
  if (!isEmployeeAvatarMimeType(mimeType)) {
    return {
      ok: false,
      error: 'Nur JPEG, PNG oder WebP sind erlaubt.',
    };
  }
  if (sizeBytes <= 0) {
    return { ok: false, error: 'Datei ist leer.' };
  }
  if (sizeBytes > EMPLOYEE_AVATAR_MAX_BYTES) {
    return { ok: false, error: 'Profilbild darf maximal 5 MB groß sein.' };
  }
  return { ok: true, data: mimeType };
}

export function buildEmployeeAvatarStoragePath(
  tenantId: string,
  employeeId: string,
  mimeType: EmployeeAvatarMimeType,
): string {
  const ext = MIME_TO_EXT[mimeType];
  return buildTenantStoragePath(tenantId, 'employees', employeeId, `avatar.${ext}`);
}

export function resolveEmployeeAvatarPublicUrl(storagePath: string): string | null {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data } = supabase.storage.from(EMPLOYEE_AVATAR_BUCKET).getPublicUrl(storagePath);
  return data.publicUrl ?? null;
}

export function mapEmployeeAvatarUrl(
  avatarUrl: string | null | undefined,
  storagePath?: string | null,
): string | null {
  const trimmed = avatarUrl?.trim();
  if (trimmed) return trimmed;
  if (storagePath?.trim()) {
    return resolveEmployeeAvatarPublicUrl(storagePath.trim());
  }
  return null;
}

export async function uploadEmployeeAvatar(
  tenantId: string,
  employeeId: string,
  pending: EmployeeAvatarPending,
): Promise<ServiceResult<{ avatarUrl: string; storagePath: string }>> {
  const validation = validateEmployeeAvatarFile(pending.mimeType, pending.sizeBytes);
  if (!validation.ok) return validation;

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const storagePath = buildEmployeeAvatarStoragePath(tenantId, employeeId, validation.data);
  const payload = Uint8Array.from(atob(pending.contentBase64), (c) => c.charCodeAt(0));

  const { error: uploadError } = await supabase.storage
    .from(EMPLOYEE_AVATAR_BUCKET)
    .upload(storagePath, payload, {
      contentType: validation.data,
      upsert: true,
    });

  if (uploadError) {
    return { ok: false, error: uploadError.message || 'Profilbild-Upload fehlgeschlagen.' };
  }

  const avatarUrl = resolveEmployeeAvatarPublicUrl(storagePath);
  if (!avatarUrl) {
    return { ok: false, error: 'Profilbild-URL konnte nicht erzeugt werden.' };
  }

  return { ok: true, data: { avatarUrl, storagePath } };
}

export async function persistEmployeeAvatarUrl(
  tenantId: string,
  employeeId: string,
  avatarUrl: string | null,
): Promise<ServiceResult<void>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { error } = await fromUnknownTable(supabase, 'employees')
    .update({ avatar_url: avatarUrl })
    .eq('tenant_id', tenantId)
    .eq('id', employeeId);

  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: undefined };
}
