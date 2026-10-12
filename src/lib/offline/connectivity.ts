/** Best-effort offline detection for cache-first reads (no React hooks). */
let reportedOffline: boolean | null = null;

export function reportDeviceOffline(offline: boolean): void { reportedOffline = offline; }

/** Native NetInfo and the web listener publish their latest explicit state. */
export function isDeviceOffline(): boolean {
  return reportedOffline === true || (typeof navigator !== 'undefined' && navigator.onLine === false);
}

export function isBrowserOffline(preferCache = false): boolean {
  if (preferCache) return true;
  if (typeof navigator === 'undefined') return false;
  return navigator.onLine === false;
}
