export const NATIVE_WORKSPACE_RETURN_URL = 'caresuiteplus:///business/connect/google-workspace';
/** OAuth may return only to the registered app screen or an approved web origin. */
export function safeGoogleWorkspaceReturnUrl(raw: string, fallback: string, allowedOrigins: string): string {
  const defaultUrl = `${fallback.replace(/\/$/, '')}/business/connect/google-workspace`;
  try {
    const url = new URL(raw || fallback);
    if (url.username || url.password) return defaultUrl;
    if (url.protocol === 'caresuiteplus:') {
      const nativePath = url.hostname ? `/${url.hostname}${url.pathname}` : url.pathname;
      return nativePath === '/business/connect/google-workspace' && !url.port && !url.search && !url.hash ? NATIVE_WORKSPACE_RETURN_URL : defaultUrl;
    }
    const allowed = allowedOrigins.split(',').map(value => value.trim()).filter(Boolean);
    return /^https?:$/.test(url.protocol) && allowed.includes(url.origin) ? url.toString() : defaultUrl;
  } catch { return defaultUrl; }
}
