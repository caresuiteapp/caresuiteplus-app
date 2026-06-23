import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_SCREENSAVER_SETTINGS,
  normalizeScreensaverSettings,
  validateScreensaverSettingsPatch,
  type ScreensaverSettings,
} from './screensaverTypes';

const USER_KEY_PREFIX = 'caresuite:screensaver:user:';
const TENANT_DEFAULT_KEY_PREFIX = 'caresuite:screensaver:tenant-default:';

function userKey(tenantId: string, userId: string): string {
  return `${USER_KEY_PREFIX}${tenantId}:${userId}`;
}

function tenantDefaultKey(tenantId: string): string {
  return `${TENANT_DEFAULT_KEY_PREFIX}${tenantId}`;
}

async function readJson<T>(key: string): Promise<Partial<T> | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Partial<T>;
  } catch {
    return null;
  }
}

export async function loadScreensaverSettings(
  tenantId: string,
  userId: string,
): Promise<ScreensaverSettings> {
  const tenantDefault = await readJson<ScreensaverSettings>(tenantDefaultKey(tenantId));
  const userOverrides = await readJson<ScreensaverSettings>(userKey(tenantId, userId));
  return normalizeScreensaverSettings({
    ...DEFAULT_SCREENSAVER_SETTINGS,
    ...tenantDefault,
    ...userOverrides,
  });
}

export async function saveScreensaverUserSettings(
  tenantId: string,
  userId: string,
  settings: ScreensaverSettings,
): Promise<void> {
  await AsyncStorage.setItem(userKey(tenantId, userId), JSON.stringify(settings));
}

export async function saveScreensaverTenantDefaults(
  tenantId: string,
  settings: Partial<ScreensaverSettings>,
): Promise<void> {
  const patch = validateScreensaverSettingsPatch(settings);
  if (!patch) throw new Error('Ungültige Bildschirmschoner-Einstellungen.');
  const existing = await readJson<ScreensaverSettings>(tenantDefaultKey(tenantId));
  const merged = normalizeScreensaverSettings({ ...DEFAULT_SCREENSAVER_SETTINGS, ...existing, ...patch });
  await AsyncStorage.setItem(tenantDefaultKey(tenantId), JSON.stringify(merged));
}

export async function mergeAndSaveScreensaverSettings(
  tenantId: string,
  userId: string,
  current: ScreensaverSettings,
  patch: Partial<ScreensaverSettings>,
): Promise<ScreensaverSettings | null> {
  const validPatch = validateScreensaverSettingsPatch(patch);
  if (!validPatch) return null;
  const next = normalizeScreensaverSettings({ ...current, ...validPatch });
  if (next.mode === 'off') next.enabled = false;
  if (next.enabled && next.mode === 'off') next.mode = 'logo_bounce';
  await saveScreensaverUserSettings(tenantId, userId, next);
  return next;
}
