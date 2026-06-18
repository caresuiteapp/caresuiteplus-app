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
import { isDemoMode } from '@/lib/supabase/config';

const STORAGE_KEY = '@caresuite/theme-mode';

/**
 * Redesign 2026 default: Web/Desktop = dark space dashboard, Mobile = light premium.
 * A stored user preference (non-demo) overrides this.
 */
function isWebWide(): boolean {
  return Platform.OS === 'web' && Dimensions.get('window').width >= 1024;
}

function resolveInitialMode(): ColorMode {
  return isWebWide() ? 'dark' : 'light';
}

type ThemeModeContextValue = {
  mode: ColorMode;
  setMode: (mode: ColorMode) => void;
  toggleMode: () => void;
  /** True when light mode is active but static @/theme imports still resolve to dark. */
  isPartialLightMode: boolean;
};

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ColorMode>(resolveInitialMode);

  useEffect(() => {
    // Web/Desktop is a dark space dashboard by design — force dark there so a
    // previously stored "light" preference can't fall back to the old shell.
    if (isWebWide()) {
      setModeState('dark');
      void AsyncStorage.setItem(STORAGE_KEY, 'dark');
      return;
    }
    void AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark') {
        setModeState(stored);
      } else {
        setModeState(resolveInitialMode());
      }
    });
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
      isPartialLightMode: false,
    }),
    [mode, setMode, toggleMode],
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
