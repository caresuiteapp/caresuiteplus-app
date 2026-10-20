import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { Platform } from 'react-native';

export const DESKTOP_WORKSPACE_STORAGE_KEYS = {
  left: 'caresuite.desktop-workspace.left-collapsed.v1',
  right: 'caresuite.desktop-workspace.right-collapsed.v1',
} as const;

const useHydrationLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

type Side = keyof typeof DESKTOP_WORKSPACE_STORAGE_KEYS;

function readPreference(side: Side): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(DESKTOP_WORKSPACE_STORAGE_KEYS[side]) === 'true';
  } catch {
    return false;
  }
}

function writePreference(side: Side, value: boolean) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DESKTOP_WORKSPACE_STORAGE_KEYS[side], String(value));
  } catch {
    // Storage can be unavailable in private/locked-down browser contexts.
  }
}

export function useDesktopWorkspacePreferences() {
  // A deterministic server/first-render value keeps static rendering hydration-safe.
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  useHydrationLayoutEffect(() => {
    setLeftCollapsed(readPreference('left'));
    setRightCollapsed(readPreference('right'));
  }, []);

  const toggleLeft = useCallback(() => {
    setLeftCollapsed((current) => {
      const next = !current;
      writePreference('left', next);
      return next;
    });
  }, []);

  const toggleRight = useCallback(() => {
    setRightCollapsed((current) => {
      const next = !current;
      writePreference('right', next);
      return next;
    });
  }, []);

  return { leftCollapsed, rightCollapsed, toggleLeft, toggleRight };
}
