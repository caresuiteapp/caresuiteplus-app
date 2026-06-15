import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DesktopListViewMode } from '@/components/ui/DesktopListViewToggle';

const STORAGE_PREFIX = 'caresuite:desktop-list-view:';

export async function loadDesktopListViewPreference(
  key: string,
  defaultMode: DesktopListViewMode = 'table',
): Promise<DesktopListViewMode> {
  const raw = await AsyncStorage.getItem(`${STORAGE_PREFIX}${key}`);
  if (raw === 'cards' || raw === 'table') return raw;
  return defaultMode;
}

export async function saveDesktopListViewPreference(
  key: string,
  mode: DesktopListViewMode,
): Promise<void> {
  await AsyncStorage.setItem(`${STORAGE_PREFIX}${key}`, mode);
}

export async function clearDesktopListViewPreference(key: string): Promise<void> {
  await AsyncStorage.removeItem(`${STORAGE_PREFIX}${key}`);
}
