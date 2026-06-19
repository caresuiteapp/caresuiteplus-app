import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';
import {
  WEB_FONT_SCALE_DEFAULT,
  WEB_FONT_SCALE_STORAGE_KEY,
  WEB_FONT_SCALE_STEPS,
  clampWebFontScaleIndex,
  indexOfWebFontScale,
  isWebFontScale,
  type WebFontScale,
} from './webFontScaleConfig';

type WebFontScaleContextValue = {
  scale: WebFontScale;
  increase: () => void;
  decrease: () => void;
  canIncrease: boolean;
  canDecrease: boolean;
};

const WebFontScaleContext = createContext<WebFontScaleContextValue | null>(null);

function applyWebFontScaleCss(scale: WebFontScale): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  document.documentElement.style.setProperty('--app-font-scale', String(scale));
}

export function WebFontScaleProvider({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState<WebFontScale>(WEB_FONT_SCALE_DEFAULT);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    let cancelled = false;
    void AsyncStorage.getItem(WEB_FONT_SCALE_STORAGE_KEY).then((stored) => {
      if (cancelled) return;
      const parsed = stored != null ? Number(stored) : NaN;
      const next = isWebFontScale(parsed) ? parsed : WEB_FONT_SCALE_DEFAULT;
      setScale(next);
      applyWebFontScaleCss(next);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const persistScale = useCallback((next: WebFontScale) => {
    setScale(next);
    applyWebFontScaleCss(next);
    void AsyncStorage.setItem(WEB_FONT_SCALE_STORAGE_KEY, String(next));
  }, []);

  const increase = useCallback(() => {
    const idx = indexOfWebFontScale(scale);
    const nextIdx = clampWebFontScaleIndex(idx + 1);
    if (nextIdx === idx) return;
    persistScale(WEB_FONT_SCALE_STEPS[nextIdx]);
  }, [persistScale, scale]);

  const decrease = useCallback(() => {
    const idx = indexOfWebFontScale(scale);
    const nextIdx = clampWebFontScaleIndex(idx - 1);
    if (nextIdx === idx) return;
    persistScale(WEB_FONT_SCALE_STEPS[nextIdx]);
  }, [persistScale, scale]);

  const value = useMemo(
    () => ({
      scale,
      increase,
      decrease,
      canIncrease: scale < WEB_FONT_SCALE_STEPS[WEB_FONT_SCALE_STEPS.length - 1],
      canDecrease: scale > WEB_FONT_SCALE_STEPS[0],
    }),
    [decrease, increase, scale],
  );

  return <WebFontScaleContext.Provider value={value}>{children}</WebFontScaleContext.Provider>;
}

export function useWebFontScale(): WebFontScaleContextValue {
  const ctx = useContext(WebFontScaleContext);
  if (!ctx) {
    throw new Error('useWebFontScale must be used within WebFontScaleProvider');
  }
  return ctx;
}
