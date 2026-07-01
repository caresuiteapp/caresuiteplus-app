/** Session-only dismiss flags for landscape prompts — never shown again after user opts out. */

const PREFIX = 'landscape-dismissed-';

export function landscapeDismissStorageKey(scope: string): string {
  return `${PREFIX}${scope}`;
}

export function isLandscapeDismissed(scope: string | undefined): boolean {
  if (!scope || typeof globalThis.sessionStorage === 'undefined') return false;
  try {
    return globalThis.sessionStorage.getItem(landscapeDismissStorageKey(scope)) === '1';
  } catch {
    return false;
  }
}

export function setLandscapeDismissed(scope: string): void {
  if (typeof globalThis.sessionStorage === 'undefined') return;
  try {
    globalThis.sessionStorage.setItem(landscapeDismissStorageKey(scope), '1');
  } catch {
    /* quota / private mode */
  }
}

export function clearLandscapeDismissed(scope: string): void {
  if (typeof globalThis.sessionStorage === 'undefined') return;
  try {
    globalThis.sessionStorage.removeItem(landscapeDismissStorageKey(scope));
  } catch {
    /* ignore */
  }
}
