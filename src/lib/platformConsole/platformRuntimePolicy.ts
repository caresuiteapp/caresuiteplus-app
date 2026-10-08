export const PLATFORM_RUNTIME_RELEASE = 'caresuite-platform-runtime-controls-20261007';
export const PLATFORM_RUNTIME_WEB_RELEASE = 'caresuite-platform-runtime-web-20261007';
export type PlatformRuntimeSettings = { release: string; maintenanceMode: boolean; registrationEnabled: boolean; notice: string };
export type PlatformRuntimeSnapshot = { status: 'checking' | 'ready' | 'failed'; settings: PlatformRuntimeSettings | null; checkedAt: string | null };
export type PlatformRuntimeBlock = 'checking' | 'maintenance' | 'registration' | 'unavailable' | null;

export function parsePlatformRuntime(value: unknown): PlatformRuntimeSettings | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (row.release !== PLATFORM_RUNTIME_RELEASE || typeof row.maintenanceMode !== 'boolean'
    || typeof row.registrationEnabled !== 'boolean' || typeof row.notice !== 'string'
    || Array.from(row.notice).length > 2000) return null;
  return { release: PLATFORM_RUNTIME_RELEASE, maintenanceMode: row.maintenanceMode,
    registrationEnabled: row.registrationEnabled, notice: row.notice };
}

export function isPlatformRegistrationPath(path: string): boolean {
  const clean = path.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/';
  return ['/auth/register', '/auth/register-business', '/liquid-command/access/register'].includes(clean);
}

export function isPlatformRuntimeExemptPath(path: string): boolean {
  const clean = path.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/';
  return clean === '/platform' || clean.startsWith('/platform/') || [
    '/impressum', '/datenschutz', '/nutzungsbedingungen', '/agb', '/support',
    '/auth/forgot-password', '/auth/reset-password', '/auth/recovery-bridge',
  ].includes(clean);
}

export function platformRuntimeBlock(path: string, snapshot: PlatformRuntimeSnapshot): PlatformRuntimeBlock {
  if (isPlatformRuntimeExemptPath(path)) return null;
  if (snapshot.settings?.maintenanceMode) return 'maintenance';
  if (isPlatformRegistrationPath(path)) {
    if (snapshot.settings && !snapshot.settings.registrationEnabled) return 'registration';
    if (!snapshot.settings && snapshot.status === 'failed') return 'unavailable';
  }
  if (!snapshot.settings && snapshot.status === 'checking') return 'checking';
  return null;
}

export function platformRegistrationError(snapshot: PlatformRuntimeSnapshot): string | null {
  if (snapshot.status !== 'ready' || !snapshot.settings)
    return 'Die Firmenregistrierung ist vorübergehend nicht verfügbar. Bitte versuchen Sie es später erneut.';
  if (snapshot.settings.maintenanceMode)
    return 'CareSuite wird gerade gewartet. Bitte versuchen Sie die Firmenregistrierung später erneut.';
  if (!snapshot.settings.registrationEnabled)
    return 'Die Firmenregistrierung ist derzeit pausiert. Bereits registrierte Unternehmen können CareSuite weiterhin nutzen.';
  return null;
}
