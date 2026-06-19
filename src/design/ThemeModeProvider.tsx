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

/** PlatformShell desktop column starts at 960px — aurora-glass applies from here up. */
export const DESKTOP_AURORA_MIN_WIDTH = 960;

export type DesktopThemeMode = 'aurora-glass' | 'light';

/**
 * Redesign 2026 default: Web/Desktop = dark aurora-glass, Mobile = light premium.
 * A stored user preference (non-demo) overrides this on mobile only.
 */
function isDesktopWeb(): boolean {
  return Platform.OS === 'web' && Dimensions.get('window').width >= DESKTOP_AURORA_MIN_WIDTH;
}

function resolveDesktopThemeMode(): DesktopThemeMode {
  return isDesktopWeb() ? 'aurora-glass' : 'light';
}

function resolveInitialMode(): ColorMode {
  return isDesktopWeb() ? 'dark' : 'light';
}

type ThemeModeContextValue = {
  mode: ColorMode;
  setMode: (mode: ColorMode) => void;
  toggleMode: () => void;
  /** Desktop web ≥960px — forces aurora-glass surfaces, never light wrappers. */
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
      const aurora = isDesktopWeb();
      setDesktopThemeMode(aurora ? 'aurora-glass' : 'light');
      if (aurora) {
        setModeState('dark');
        void AsyncStorage.setItem(STORAGE_KEY, 'dark');
      }
    };

    syncDesktop();

    if (Platform.OS !== 'web') {
      void AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
        if (stored === 'light' || stored === 'dark') {
          setModeState(stored);
        } else {
          setModeState(resolveInitialMode());
        }
      });
      return;
    }

    const sub = Dimensions.addEventListener('change', syncDesktop);
    if (!isDesktopWeb()) {
      void AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
        if (stored === 'light' || stored === 'dark') {
          setModeState(stored);
        }
      });
    }
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
