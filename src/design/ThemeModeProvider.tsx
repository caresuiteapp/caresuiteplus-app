import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Dimensions, Platform } from 'react-native';
import type { ColorMode } from '@/design/tokens/colors';

const STORAGE_KEY = '@caresuite/theme-mode';
/** Bumps when desktop stops auto-forcing dark into storage (2026 light-space default). */
const THEME_PREF_MIGRATION_KEY = '@caresuite/theme-pref-migration-v2';

/** PlatformShell desktop column starts at 960px — liquid glass shell from here up. */
export const DESKTOP_AURORA_MIN_WIDTH = 960;

export type DesktopThemeMode = 'aurora-glass' | 'light';

/**
 * Redesign 2026 default: Web/Desktop = light space nebula + light liquid glass,
 * Mobile = light premium. A stored user preference (non-demo) overrides on all platforms.
 */
function isDesktopWeb(): boolean {
  return Platform.OS === 'web' && Dimensions.get('window').width >= DESKTOP_AURORA_MIN_WIDTH;
}

function resolveDesktopThemeMode(): DesktopThemeMode {
  return isDesktopWeb() ? 'light' : 'light';
}

function resolveInitialMode(): ColorMode {
  return 'light';
}

type ThemeModeContextValue = {
  mode: ColorMode;
  setMode: (mode: ColorMode) => void;
  toggleMode: () => void;
  /** Desktop web ≥960px uses liquid glass shell; mobile uses light premium surfaces. */
  desktopThemeMode: DesktopThemeMode;
  /** True when light mode is active but static @/theme imports still resolve to dark. */
  isPartialLightMode: boolean;
};

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ColorMode>(resolveInitialMode);
  const [desktopThemeMode, setDesktopThemeMode] = useState<DesktopThemeMode>(resolveDesktopThemeMode);

  useEffect(() => {
    const syncDesktop = () => {
      setDesktopThemeMode(isDesktopWeb() ? 'light' : 'light');
    };

    syncDesktop();

    void (async () => {
      const migrated = await AsyncStorage.getItem(THEME_PREF_MIGRATION_KEY);
      let stored = await AsyncStorage.getItem(STORAGE_KEY);

      // Legacy desktop shell wrote 'dark' on every resize — not a user choice.
      if (migrated !== '1') {
        await AsyncStorage.setItem(THEME_PREF_MIGRATION_KEY, '1');
        if (isDesktopWeb() && stored === 'dark') {
          stored = 'light';
          await AsyncStorage.setItem(STORAGE_KEY, 'light');
        }
      }

      if (stored === 'light' || stored === 'dark') {
        setModeState(stored);
      } else {
        setModeState(resolveInitialMode());
      }
    })();

    if (Platform.OS !== 'web') {
      return;
    }

    const sub = Dimensions.addEventListener('change', syncDesktop);
    return () => sub?.remove();
  }, []);

  const setMode = useCallback((next: ColorMode) => {
    setModeState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  const toggleMode = useCallback(() => {
    setMode(mode === 'dark' ? 'light' : 'dark');
  }, [mode, setMode]);

  const value = useMemo(
    () => ({
      mode,
      setMode,
      toggleMode,
      desktopThemeMode,
      isPartialLightMode: false,
    }),
    [desktopThemeMode, mode, setMode, toggleMode],
  );

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

export function useThemeMode() {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) {
    throw new Error('useThemeMode must be used within ThemeModeProvider');
  }
  return ctx;
}
