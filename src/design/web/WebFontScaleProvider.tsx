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
import { Platform, useWindowDimensions } from 'react-native';
import { usePathname } from 'expo-router';
import { isMobileWorkspace, MOBILE_WORKSPACE_BASE_SCALE, MOBILE_WORKSPACE_FONT_KEY } from './mobileWorkspaceDensity';
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
  /** Actual text metric; the displayed percentage remains relative to the baseline. */
  effectiveScale: number;
  increase: () => void;
  decrease: () => void;
  reset: () => void;
  canIncrease: boolean;
  canDecrease: boolean;
};

const WebFontScaleContext = createContext<WebFontScaleContextValue | null>(null);

function applyWebFontScaleCss(scale: number): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  document.documentElement.style.setProperty('--app-font-scale', String(scale));
}

export function WebFontScaleProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const compactWorkspace = isMobileWorkspace(pathname, width);
  const [regularScale, setRegularScale] = useState<WebFontScale>(WEB_FONT_SCALE_DEFAULT);
  const [mobileScale, setMobileScale] = useState<WebFontScale>(WEB_FONT_SCALE_DEFAULT);
  const scale = compactWorkspace ? mobileScale : regularScale;
  const effectiveScale = scale * (compactWorkspace ? MOBILE_WORKSPACE_BASE_SCALE : 1);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    let cancelled = false;
    void Promise.all([
      AsyncStorage.getItem(WEB_FONT_SCALE_STORAGE_KEY),
      AsyncStorage.getItem(MOBILE_WORKSPACE_FONT_KEY),
    ]).then(([stored, mobileStored]) => {
      if (cancelled) return;
      const parsed = stored != null ? Number(stored) : NaN;
      const next = isWebFontScale(parsed) ? parsed : WEB_FONT_SCALE_DEFAULT;
      setRegularScale(next);
      const mobileParsed = mobileStored != null ? Number(mobileStored) : NaN;
      // Existing 90/100% preferences adopt the new normal. Keep larger text selected.
      setMobileScale(isWebFontScale(mobileParsed) ? mobileParsed : next > 1 ? next : 1);
    }).catch(() => { /* Storage can be unavailable in private browsing. */ });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    applyWebFontScaleCss(effectiveScale);
  }, [effectiveScale]);

  const persistScale = useCallback((next: WebFontScale) => {
    if (compactWorkspace) setMobileScale(next);
    else setRegularScale(next);
    void AsyncStorage.setItem(compactWorkspace ? MOBILE_WORKSPACE_FONT_KEY : WEB_FONT_SCALE_STORAGE_KEY, String(next)).catch(() => {});
  }, [compactWorkspace]);

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

  const reset = useCallback(() => {
    persistScale(WEB_FONT_SCALE_DEFAULT);
  }, [persistScale]);

  const value = useMemo(
    () => ({
      scale,
      effectiveScale,
      increase,
      decrease,
      reset,
      canIncrease: scale < WEB_FONT_SCALE_STEPS[WEB_FONT_SCALE_STEPS.length - 1],
      canDecrease: scale > WEB_FONT_SCALE_STEPS[0],
    }),
    [decrease, increase, reset, scale, effectiveScale],
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
