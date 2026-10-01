const STORAGE_KEY = 'caresuite.tv.login-return.v1';
const CODE = /^[A-Za-z0-9_-]{43}$/;
const ROLES = ['administration', 'employee', 'client'];
type ReturnRequest = { code: string; role: string; expiresAt: number };

/** Same-tab, short-lived, strict internal return target; never accepts a URL. */
export function rememberTvLoginReturn(code: string, role: string, expiresAt: string): boolean {
  if (!CODE.test(code) || !ROLES.includes(role)) return false;
  const expiry = Date.parse(expiresAt);
  if (!Number.isFinite(expiry) || expiry <= Date.now()) return false;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ code, role, expiresAt: Math.min(expiry, Date.now() + 5 * 60_000) }));
    return true;
  } catch { return false; }
}
export function clearTvLoginReturn(): void {
  try { window.sessionStorage.removeItem(STORAGE_KEY); } catch { /* Storage may be unavailable. */ }
}
export function getTvLoginReturnPath(): string | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as ReturnRequest;
    if (!CODE.test(value.code) || !ROLES.includes(value.role) || !Number.isFinite(value.expiresAt) || value.expiresAt <= Date.now() || value.expiresAt > Date.now() + 5 * 60_000) {
      clearTvLoginReturn();
      return null;
    }
    return `/device/confirm?code=${encodeURIComponent(value.code)}`;
  } catch { return null; }
}
export function resolveTvLoginReturn(fallback: string): string {
  // Password setup and account recovery always take precedence.
  if (fallback.startsWith('/auth/employee-first-login') || fallback.startsWith('/auth/reset-password')) return fallback;
  return getTvLoginReturnPath() ?? fallback;
}
