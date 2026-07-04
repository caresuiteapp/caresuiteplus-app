/** Best-effort offline detection for cache-first reads (no React hooks). */
export function isBrowserOffline(preferCache = false): boolean {
  if (preferCache) return true;
  if (typeof navigator === 'undefined') return false;
  return navigator.onLine === false;
}
