import { useMemo } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { DESKTOP_AURORA_MIN_WIDTH, useThemeMode } from '@/design/ThemeModeProvider';

/**
 * True when the desktop/web PlatformShell already paints GlobalAnimatedBackground
 * behind the main work column — page shells must stay transparent so dark
 * glass surfaces and typography remain readable (RN Web defaults Views to white).
 */
export function useShellHostsAurora(embedded?: boolean): boolean {
  const { desktopThemeMode, mode } = useThemeMode();
  const { width } = useWindowDimensions();

  return useMemo(() => {
    if (embedded !== undefined) return embedded;
    if (desktopThemeMode === 'aurora-glass') return true;
    if (Platform.OS === 'web' && width >= DESKTOP_AURORA_MIN_WIDTH && mode === 'dark') return true;
    return false;
  }, [desktopThemeMode, embedded, mode, width]);
}

/** Shorthand — desktop web is always aurora-glass, never light premium wrappers. */
export function useAuroraGlassActive(): boolean {
  return useShellHostsAurora();
}
