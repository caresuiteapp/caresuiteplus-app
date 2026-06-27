/** Cache-bust helper so refreshed avatar URLs render immediately after upload. */

export function appendProfileAvatarCacheBust(url: string, version?: string | null): string {
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith('data:')) return trimmed;

  const bust = (version ?? trimmed).trim() || '1';
  const sep = trimmed.includes('?') ? '&' : '?';
  return `${trimmed}${sep}v=${encodeURIComponent(bust.slice(-48))}`;
}
