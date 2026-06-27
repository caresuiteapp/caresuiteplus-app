import { getSupabaseClient } from '@/lib/supabase/client';
import { USER_AVATAR_BUCKET } from '@/lib/auth/useravatarservice';

/** Cache-bust helper so refreshed avatar URLs render immediately after upload. */
export function appendProfileAvatarCacheBust(url: string, version?: string | null): string {
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith('data:')) return trimmed;

  const bust = (version ?? trimmed).trim() || '1';
  const sep = trimmed.includes('?') ? '&' : '?';
  return `${trimmed}${sep}v=${encodeURIComponent(bust.slice(-48))}`;
}

export function extractUserAvatarStoragePath(publicUrl: string): string | null {
  try {
    const url = new URL(publicUrl);
    const marker = `/storage/v1/object/public/${USER_AVATAR_BUCKET}/`;
    const idx = url.pathname.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(url.pathname.slice(idx + marker.length));
  } catch {
    return null;
  }
}

/** Prefer signed URL for private bucket objects; fall back to public URL + cache bust. */
export async function resolveProfileAvatarDisplayUrl(
  avatarUrl: string | null | undefined,
  version?: string | null,
): Promise<string | undefined> {
  const trimmed = avatarUrl?.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('data:')) return trimmed;

  const storagePath = extractUserAvatarStoragePath(trimmed);
  const supabase = getSupabaseClient();
  if (storagePath && supabase) {
    const { data, error } = await supabase.storage
      .from(USER_AVATAR_BUCKET)
      .createSignedUrl(storagePath, 3600);
    if (!error && data?.signedUrl) {
      return appendProfileAvatarCacheBust(data.signedUrl, version);
    }
  }

  return appendProfileAvatarCacheBust(trimmed, version);
}
