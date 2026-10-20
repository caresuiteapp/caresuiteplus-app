export const PLATFORM_RUNTIME_RELEASE = 'caresuite-platform-runtime-controls-20261007';

export type PlatformRuntimeSettings = {
  release: string;
  maintenanceMode: boolean;
  registrationEnabled: boolean;
  notice: string;
};

type RuntimeClient = { rpc(name: string): PromiseLike<{ data: unknown; error: unknown }> };

export function normalizePlatformRuntime(value: unknown): PlatformRuntimeSettings | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (row.release !== PLATFORM_RUNTIME_RELEASE || typeof row.maintenanceMode !== 'boolean'
    || typeof row.registrationEnabled !== 'boolean' || typeof row.notice !== 'string'
    || Array.from(row.notice).length > 2000) return null;
  return { release: PLATFORM_RUNTIME_RELEASE, maintenanceMode: row.maintenanceMode,
    registrationEnabled: row.registrationEnabled, notice: row.notice };
}

export async function readPlatformRuntimeSettings(service: RuntimeClient): Promise<PlatformRuntimeSettings> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      service.rpc('platform_get_runtime_settings'),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('runtime_unavailable')), 3000); }),
    ]);
    const settings = normalizePlatformRuntime(result.data);
    if (result.error || !settings) throw new Error('runtime_unavailable');
    return settings;
  } finally { if (timer) clearTimeout(timer); }
}

export function registrationRuntimeError(settings: PlatformRuntimeSettings): { code: string; error: string } | null {
  if (settings.maintenanceMode) return { code: 'maintenance_active',
    error: 'CareSuite wird gerade gewartet. Bitte versuchen Sie die Firmenregistrierung später erneut.' };
  if (!settings.registrationEnabled) return { code: 'registration_paused',
    error: 'Die Firmenregistrierung ist derzeit pausiert. Bereits registrierte Unternehmen können CareSuite weiterhin nutzen.' };
  return null;
}
