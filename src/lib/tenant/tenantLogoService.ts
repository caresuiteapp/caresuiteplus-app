import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { buildTenantStoragePath } from '@/lib/storage/storagePaths';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';

export const TENANT_LOGO_BUCKET = 'tenant-branding';

export const TENANT_LOGO_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
] as const;

export type TenantLogoMimeType = (typeof TENANT_LOGO_ALLOWED_MIME_TYPES)[number];

export const TENANT_LOGO_MAX_BYTES = 5 * 1024 * 1024;

export type TenantLogoPending = {
  localUri: string;
  fileName: string;
  mimeType: TenantLogoMimeType;
  sizeBytes: number;
  contentBase64: string;
};

export type TenantLogoValue = {
  displayUri: string | null;
  pending: TenantLogoPending | null;
  removed: boolean;
};

export const EMPTY_TENANT_LOGO: TenantLogoValue = {
  displayUri: null,
  pending: null,
  removed: false,
};

const MIME_TO_EXT: Record<TenantLogoMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

export function isTenantLogoMimeType(mimeType: string): mimeType is TenantLogoMimeType {
  return (TENANT_LOGO_ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType);
}

export function validateTenantLogoFile(
  mimeType: string,
  sizeBytes: number,
): ServiceResult<TenantLogoMimeType> {
  if (!isTenantLogoMimeType(mimeType)) {
    return {
      ok: false,
      error: 'Nur JPEG, PNG, SVG oder WebP sind erlaubt.',
    };
  }
  if (sizeBytes <= 0) {
    return { ok: false, error: 'Datei ist leer.' };
  }
  if (sizeBytes > TENANT_LOGO_MAX_BYTES) {
    return { ok: false, error: 'Logo darf maximal 5 MB groß sein.' };
  }
  return { ok: true, data: mimeType };
}

export function buildTenantLogoStoragePath(
  tenantId: string,
  mimeType: TenantLogoMimeType,
): string {
  const ext = MIME_TO_EXT[mimeType];
  return buildTenantStoragePath(tenantId, `logo.${ext}`);
}

export function resolveTenantLogoPublicUrl(storagePath: string): string | null {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data } = supabase.storage.from(TENANT_LOGO_BUCKET).getPublicUrl(storagePath);
  return data.publicUrl ?? null;
}

export async function uploadTenantLogo(
  tenantId: string,
  pending: TenantLogoPending,
): Promise<ServiceResult<{ logoUrl: string; storagePath: string }>> {
  const validation = validateTenantLogoFile(pending.mimeType, pending.sizeBytes);
  if (!validation.ok) return validation;

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const storagePath = buildTenantLogoStoragePath(tenantId, validation.data);
  const payload = Uint8Array.from(atob(pending.contentBase64), (c) => c.charCodeAt(0));

  const { error: uploadError } = await supabase.storage
    .from(TENANT_LOGO_BUCKET)
    .upload(storagePath, payload, {
      contentType: validation.data,
      upsert: true,
    });

  if (uploadError) {
    const msg = uploadError.message ?? '';
    if (msg.includes('row-level security') || msg.includes('RLS')) {
      return { ok: false, error: 'Kein Zugriff auf Logo-Speicher (Berechtigung fehlt).' };
    }
    return { ok: false, error: msg || 'Logo-Upload fehlgeschlagen.' };
  }

  const logoUrl = resolveTenantLogoPublicUrl(storagePath);
  if (!logoUrl) {
    return { ok: false, error: 'Logo-URL konnte nicht erzeugt werden.' };
  }

  return { ok: true, data: { logoUrl, storagePath } };
}

export async function persistTenantLogoUrl(
  tenantId: string,
  logoUrl: string | null,
): Promise<ServiceResult<void>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { error } = await fromUnknownTable(supabase, 'tenant_branding')
    .upsert({ tenant_id: tenantId, logo_url: logoUrl }, { onConflict: 'tenant_id' });

  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: undefined };
}

export async function resolveTenantLogoUrlForSave(
  tenantId: string,
  logo: TenantLogoValue,
  manualLogoUrl: string,
  isLive: boolean,
): Promise<ServiceResult<string | null>> {
  if (logo.removed) {
    if (isLive) {
      const cleared = await persistTenantLogoUrl(tenantId, null);
      if (!cleared.ok) return cleared;
    }
    return { ok: true, data: null };
  }

  if (logo.pending) {
    const uploaded = await uploadTenantLogo(tenantId, logo.pending);
    if (!uploaded.ok) return uploaded;
    if (isLive) {
      const persisted = await persistTenantLogoUrl(tenantId, uploaded.data.logoUrl);
      if (!persisted.ok) return persisted;
    }
    return { ok: true, data: uploaded.data.logoUrl };
  }

  const trimmed = manualLogoUrl.trim();
  return { ok: true, data: trimmed || null };
}
