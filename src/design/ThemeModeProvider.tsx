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
import type { ColorMode } from '@/design/tokens/colors';
import { isDemoMode } from '@/lib/supabase/config';

const STORAGE_KEY = '@caresuite/theme-mode';

type ThemeModeContextValue = {
  mode: ColorMode;
  setMode: (mode: ColorMode) => void;
  toggleMode: () => void;
  /** True when light mode is active but static @/theme imports still resolve to dark. */
  isPartialLightMode: boolean;
};

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ColorMode>('light');

  useEffect(() => {
    if (isDemoMode()) {
      setModeState('light');
      void AsyncStorage.setItem(STORAGE_KEY, 'light');
      return;
    }
    void AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark') {
        setModeState(stored);
      }
    });
  }, []);

  const setMode = useCallback((next: ColorMode) => {
    const resolved = isDemoMode() ? 'light' : next;
    setModeState(resolved);
    void AsyncStorage.setItem(STORAGE_KEY, resolved);
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
