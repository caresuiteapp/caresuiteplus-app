import { getSupabaseClient } from '@/lib/supabase/client';
import { USER_AVATAR_BUCKET } from '@/lib/auth/useravatarservice';
import { EMPLOYEE_AVATAR_BUCKET } from '@/lib/office/employeeAvatarService';

const AVATAR_BUCKETS = [USER_AVATAR_BUCKET, EMPLOYEE_AVATAR_BUCKET] as const;

/** Cache-bust helper so refreshed avatar URLs render immediately after upload. */
export function appendProfileAvatarCacheBust(url: string, version?: string | null): string {
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith('data:')) return trimmed;

  const bust = (version ?? trimmed).trim() || '1';
  const sep = trimmed.includes('?') ? '&' : '?';
  return `${trimmed}${sep}v=${encodeURIComponent(bust.slice(-48))}`;
}

export function extractAvatarStoragePath(
  publicUrl: string,
  bucket: string = USER_AVATAR_BUCKET,
): string | null {
  try {
    const url = new URL(publicUrl);
    const marker = `/storage/v1/object/public/${bucket}/`;
    const idx = url.pathname.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(url.pathname.slice(idx + marker.length));
  } catch {
    return null;
  }
}

/** @deprecated Use extractAvatarStoragePath */
export function extractUserAvatarStoragePath(publicUrl: string): string | null {
  return extractAvatarStoragePath(publicUrl, USER_AVATAR_BUCKET);
}

function resolveAvatarBucket(publicUrl: string): (typeof AVATAR_BUCKETS)[number] | null {
  for (const bucket of AVATAR_BUCKETS) {
    if (extractAvatarStoragePath(publicUrl, bucket)) return bucket;
  }
  return null;
}

/** Prefer signed URL for private bucket objects; fall back to public URL + cache bust. */
export async function resolveProfileAvatarDisplayUrl(
  avatarUrl: string | null | undefined,
  version?: string | null,
): Promise<string | undefined> {
  const trimmed = avatarUrl?.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('data:')) return trimmed;

  const bucket = resolveAvatarBucket(trimmed);
  const storagePath = bucket ? extractAvatarStoragePath(trimmed, bucket) : null;
  const supabase = getSupabaseClient();
  if (storagePath && bucket && supabase) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(storagePath, 3600);
    if (!error && data?.signedUrl) {
      return appendProfileAvatarCacheBust(data.signedUrl, version);
    }
  }

  return appendProfileAvatarCacheBust(trimmed, version);
}
