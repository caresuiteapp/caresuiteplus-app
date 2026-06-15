import { useCallback, useEffect, useState } from 'react';
import type { DesktopListViewMode } from '@/components/ui/DesktopListViewToggle';
import {
  loadDesktopListViewPreference,
  saveDesktopListViewPreference,
} from '@/lib/preferences/desktopListViewPreference';

export function useDesktopListViewPreference(
  storageKey: string,
  defaultMode: DesktopListViewMode = 'table',
) {
  const [viewMode, setViewModeState] = useState<DesktopListViewMode>(defaultMode);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadDesktopListViewPreference(storageKey, defaultMode).then((mode) => {
      if (!cancelled) {
        setViewModeState(mode);
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [storageKey, defaultMode]);

  const setViewMode = useCallback(
    (mode: DesktopListViewMode) => {
      setViewModeState(mode);
      void saveDesktopListViewPreference(storageKey, mode);
    },
    [storageKey],
  );

  return { viewMode, setViewMode, ready };
}
