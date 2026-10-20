import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import {
  DEFAULT_SCREENSAVER_SETTINGS,
  type ScreensaverSettings,
} from '@/lib/screensaver/screensaverTypes';
import {
  loadScreensaverSettings,
  mergeAndSaveScreensaverSettings,
} from '@/lib/screensaver/screensaverSettingsService';

type ScreensaverSettingsContextValue = {
  settings: ScreensaverSettings;
  isLoaded: boolean;
  saveSettings: (patch: Partial<ScreensaverSettings>) => Promise<boolean>;
  previewActive: boolean;
  previewSettings: ScreensaverSettings | null;
  requestPreview: (override?: ScreensaverSettings) => void;
  clearPreview: () => void;
  visible: boolean;
  showScreensaver: () => void;
  hideScreensaver: () => void;
};

const ScreensaverSettingsContext = createContext<ScreensaverSettingsContextValue | null>(null);

export function ScreensaverSettingsProvider({ children }: { children: ReactNode }) {
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const userId = profile?.id ?? 'anonymous';

  const [settings, setSettings] = useState<ScreensaverSettings>(DEFAULT_SCREENSAVER_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);
  const [previewActive, setPreviewActive] = useState(false);
  const [previewSettings, setPreviewSettings] = useState<ScreensaverSettings | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoaded(false);
    void loadScreensaverSettings(tenantId ?? 'demo', userId).then((loaded) => {
      if (!cancelled) {
        setSettings(loaded);
        setIsLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [tenantId, userId]);

  const saveSettings = useCallback(
    async (patch: Partial<ScreensaverSettings>) => {
      const tid = tenantId ?? 'demo';
      const next = await mergeAndSaveScreensaverSettings(tid, userId, settings, patch);
      if (!next) return false;
      setSettings(next);
      return true;
    },
    [tenantId, userId, settings],
  );

  const requestPreview = useCallback((override?: ScreensaverSettings) => {
    setPreviewSettings(override ?? null);
    setPreviewActive(true);
    setVisible(true);
  }, []);

  const clearPreview = useCallback(() => {
    setPreviewActive(false);
    setPreviewSettings(null);
  }, []);

  const showScreensaver = useCallback(() => {
    setVisible(true);
  }, []);

  const hideScreensaver = useCallback(() => {
    setVisible(false);
    setPreviewActive(false);
    setPreviewSettings(null);
  }, []);

  const value = useMemo(
    () => ({
      settings,
      isLoaded,
      saveSettings,
      previewActive,
      previewSettings,
      requestPreview,
      clearPreview,
      visible,
      showScreensaver,
      hideScreensaver,
    }),
    [
      settings,
      isLoaded,
      saveSettings,
      previewActive,
      previewSettings,
      requestPreview,
      clearPreview,
      visible,
      showScreensaver,
      hideScreensaver,
    ],
  );

  return (
    <ScreensaverSettingsContext.Provider value={value}>{children}</ScreensaverSettingsContext.Provider>
  );
}

export function useScreensaverSettings(): ScreensaverSettingsContextValue {
  const ctx = useContext(ScreensaverSettingsContext);
  if (!ctx) {
    throw new Error('useScreensaverSettings must be used within ScreensaverSettingsProvider');
  }
  return ctx;
}
