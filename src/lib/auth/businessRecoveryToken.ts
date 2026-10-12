export function readBusinessRecoveryToken(hash: string): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const token = params.get('token_hash');
  return params.getAll('token_hash').length === 1 && params.getAll('type').length === 1
    && !params.has('access_token') && !params.has('refresh_token')
    && params.get('type') === 'recovery' && token && /^[a-zA-Z0-9_-]{32,128}$/.test(token) ? token : null;
}
export function extractNativeBusinessRecoveryToken(input: string): string | null {
  try {
    const url = new URL(input.trim());
    const path = url.hostname && url.protocol === 'caresuiteplus:' ? `/${url.hostname}${url.pathname}` : url.pathname;
    const hostAllowed = url.protocol === 'caresuiteplus:' || (url.protocol === 'https:' && ['www.caresuiteplus.app', 'caresuiteplus.app'].includes(url.hostname));
    if (!hostAllowed || url.username || url.password || url.port || url.search || !['/auth/reset-password', '/liquid-command/access/reset-password'].includes(path)) return null;
    return readBusinessRecoveryToken(url.hash);
  } catch { return null; }
}
