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
/** Bumps when every surface migrates to the single system Liquid Glass design. */
const THEME_PREF_MIGRATION_KEY = '@caresuite/theme-pref-liquid-glass-v33';

/** PlatformShell desktop column starts at 960px — liquid glass shell from here up. */
export const DESKTOP_AURORA_MIN_WIDTH = 960;

export type DesktopThemeMode = 'aurora-glass' | 'light';

/**
 * System design V33: every product, portal and device uses the same dark
 * Liquid Glass language. The legacy union remains only for source compatibility.
 */
function isDesktopWeb(): boolean {
  return Platform.OS === 'web' && Dimensions.get('window').width >= DESKTOP_AURORA_MIN_WIDTH;
}

function resolveDesktopThemeMode(): DesktopThemeMode {
  return isDesktopWeb() ? 'aurora-glass' : 'aurora-glass';
}

function resolveInitialMode(): ColorMode {
  return 'dark';
}

type ThemeModeContextValue = {
  mode: ColorMode;
  setMode: (mode: ColorMode) => void;
  toggleMode: () => void;
  /** All form factors use the canonical Liquid Glass shell. */
  desktopThemeMode: DesktopThemeMode;
  /** Compatibility flag; the system no longer exposes a partial light mode. */
  isPartialLightMode: boolean;
};

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ColorMode>(resolveInitialMode);
  const [desktopThemeMode, setDesktopThemeMode] = useState<DesktopThemeMode>(resolveDesktopThemeMode);

  useEffect(() => {
    const syncDesktop = () => {
      setDesktopThemeMode(isDesktopWeb() ? 'aurora-glass' : 'aurora-glass');
    };

    syncDesktop();

    void (async () => {
      const migrated = await AsyncStorage.getItem(THEME_PREF_MIGRATION_KEY);
      const stored = await AsyncStorage.getItem(STORAGE_KEY);

      // Legacy desktop shell wrote 'dark' on every resize — not a user choice.
      if (migrated !== '1' || stored !== 'dark') {
        await AsyncStorage.setItem(THEME_PREF_MIGRATION_KEY, '1');
        await AsyncStorage.setItem(STORAGE_KEY, 'dark');
      }
      setModeState('dark');
    })();

    if (Platform.OS !== 'web') {
      return;
    }

    const sub = Dimensions.addEventListener('change', syncDesktop);
    return () => sub?.remove();
  }, []);

  const setMode = useCallback((next: ColorMode) => {
    void next;
    setModeState('dark');
    void AsyncStorage.setItem(STORAGE_KEY, 'dark');
  }, []);

  const toggleMode = useCallback(() => {
    setMode('dark');
  }, [setMode]);

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
