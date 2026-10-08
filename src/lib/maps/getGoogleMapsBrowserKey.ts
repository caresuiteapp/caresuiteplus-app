/** Compatibility exports: maps no longer read or expose any Google key. */
export function resetGoogleMapsBrowserKeyCacheForTests(): void {}
export async function getGoogleMapsBrowserKey(_tenantId?: string | null): Promise<string> { return 'openfreemap'; }
export function isGoogleMapsBrowserKeyConfiguredSync(): boolean { return true; }
