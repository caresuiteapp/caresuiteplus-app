const KEY = 'caresuite.web.login-return.v1';
const MAX_AGE = 30 * 60_000;

export function safeWebReturnPath(value: string): string | null {
  if (value.length > 4096 || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020]/.test(value) || /%5c|%2f%2f/i.test(value)) return null;
  const path = value.split(/[?#]/, 1)[0];
  return /^\/(?:business|office|unternehmen|assist|pflege|stationaer|beratung|akademie|insight|settings|robotics|medical|communication|design-system|onboarding|admin|platform|portal\/(?:client|employee|relative))(?:\/|$)/.test(path) ? value : null;
}

export function rememberWebLoginReturn(requestedPath?: string): void {
  if (typeof window === 'undefined') return;
  const path = safeWebReturnPath(requestedPath ?? window.location.pathname + window.location.search + window.location.hash);
  if (!path) return;
  try { window.sessionStorage.setItem(KEY, JSON.stringify({ path, expiresAt: Date.now() + MAX_AGE })); } catch { /* Login remains available without storage. */ }
}

export function resolveWebLoginReturn(fallback: string): string {
  if (typeof window === 'undefined' || fallback.startsWith('/auth/')) return fallback;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return fallback;
    const value = JSON.parse(raw);
    const path = typeof value.path === 'string' ? safeWebReturnPath(value.path) : null;
    if (!path || !Number.isFinite(value.expiresAt) || value.expiresAt <= Date.now() || value.expiresAt > Date.now() + MAX_AGE) {
      window.sessionStorage.removeItem(KEY); return fallback;
    }
    const expectedPortal = fallback.startsWith('/portal/client') ? '/portal/client' : fallback.startsWith('/portal/employee') ? '/portal/employee' : null;
    const pathname = path.split(/[?#]/, 1)[0];
    if (fallback.startsWith('/platform') ? !pathname.startsWith('/platform') : pathname.startsWith('/platform')) return fallback;
    if (expectedPortal ? !(pathname === expectedPortal || pathname.startsWith(`${expectedPortal}/`)) : pathname.startsWith('/portal/')) return fallback;
    return path;
  } catch { return fallback; }
}

export function clearReachedWebLoginReturn(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (raw && JSON.parse(raw).path === window.location.pathname + window.location.search + window.location.hash) window.sessionStorage.removeItem(KEY);
  } catch { /* Storage may be unavailable. */ }
}
