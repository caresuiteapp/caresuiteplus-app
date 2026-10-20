import { getSupabaseConfig, isDemoMode, isSupabaseConfigured } from '@/lib/supabase/config';
import { getServiceMode } from '@/lib/services/mode';
import { parsePlatformRuntime, PLATFORM_RUNTIME_RELEASE, type PlatformRuntimeSnapshot } from './platformRuntimePolicy';

const INITIAL: PlatformRuntimeSnapshot = { status: 'checking', settings: null, checkedAt: null };
let snapshot = INITIAL;
let pending: Promise<PlatformRuntimeSnapshot> | null = null;
const listeners = new Set<() => void>();
export const getPlatformRuntimeSnapshot = () => snapshot;
export const getPlatformRuntimeServerSnapshot = () => INITIAL;
export function subscribePlatformRuntime(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function update(value: PlatformRuntimeSnapshot) {
  snapshot = value;
  for (const listener of listeners) listener();
  return snapshot;
}

export function refreshPlatformRuntime(): Promise<PlatformRuntimeSnapshot> {
  if (pending) return pending;
  pending = load().finally(() => { pending = null; });
  return pending;
}

async function load(): Promise<PlatformRuntimeSnapshot> {
  if (isDemoMode() || getServiceMode() !== 'supabase') return update({ status: 'ready', checkedAt: null,
    settings: { release: PLATFORM_RUNTIME_RELEASE, maintenanceMode: false, registrationEnabled: true, notice: '' } });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    if (!isSupabaseConfigured()) throw new Error('not_configured');
    const config = getSupabaseConfig();
    const response = await fetch(`${config.url.replace(/\/$/, '')}/functions/v1/platform-observation`, {
      method: 'GET', headers: { apikey: config.anonKey }, credentials: 'omit', cache: 'no-store', signal: controller.signal,
    });
    const data = await response.json();
    const settings = response.ok ? parsePlatformRuntime(data?.runtime) : null;
    if (!settings) throw new Error('runtime_unavailable');
    return update({ status: 'ready', settings, checkedAt: new Date().toISOString() });
  } catch {
    // A connection failure must not silently reopen a known maintenance/registration closure.
    return update({ ...snapshot, status: 'failed' });
  } finally { clearTimeout(timer); }
}
