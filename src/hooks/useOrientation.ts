import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import {
  resolveLandscapeRequirement,
  shouldBlockUntilLandscape,
  shouldShowLandscapeOverlay,
  type LandscapeRequirement,
  type LandscapeScreenKey,
} from '@/config/landscapeRequiredScreens';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import {
  buildOrientationSnapshot,
  type OrientationSnapshot,
} from '@/lib/orientation/detectOrientation';
import {
  requestLandscapeLock,
  type LandscapeLockResult,
} from '@/lib/orientation/requestLandscapeLock';

export type { OrientationSnapshot, OrientationType } from '@/lib/orientation/detectOrientation';
export {
  buildOrientationSnapshot,
  detectIsLandscape,
  matchesLandscapeMediaQuery,
  readScreenOrientationType,
} from '@/lib/orientation/detectOrientation';
export { requestLandscapeLock, type LandscapeLockResult } from '@/lib/orientation/requestLandscapeLock';

export function useOrientation(): OrientationSnapshot {
  const { width, height } = useWindowDimensions();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const bump = () => setTick((n) => n + 1);

    window.addEventListener('resize', bump);
    window.addEventListener('orientationchange', bump);

    const mq = window.matchMedia?.('(orientation: landscape)');
    mq?.addEventListener?.('change', bump);

    const orientation = screen.orientation as ScreenOrientation | undefined;
    orientation?.addEventListener?.('change', bump);

    return () => {
      window.removeEventListener('resize', bump);
      window.removeEventListener('orientationchange', bump);
      mq?.removeEventListener?.('change', bump);
      orientation?.removeEventListener?.('change', bump);
    };
  }, []);

  return useMemo(() => buildOrientationSnapshot(width, height), [width, height, tick]);
}

export type UseLandscapeRequiredOptions = {
  /** When false, skip lock attempts and overlay (e.g. modal closed). */
  active?: boolean;
  /** Attempt lock on mount when active. */
  autoLock?: boolean;
  /** Pass true from user gesture handler for fullscreen fallback. */
  tryFullscreenOnRequest?: boolean;
};

export type LandscapeRequiredState = OrientationSnapshot & {
  requirement: LandscapeRequirement;
  landscapeRequired: boolean;
  showOverlay: boolean;
  blockContent: boolean;
  lockPending: boolean;
  lockError: string | null;
  requestLandscapeLock: () => Promise<LandscapeLockResult>;
};

export function useLandscapeRequired(
  screenKey: LandscapeScreenKey,
  options: UseLandscapeRequiredOptions = {},
): LandscapeRequiredState {
  const { active = true, autoLock = false, tryFullscreenOnRequest = true } = options;
  const orientation = useOrientation();
  const { isPhone } = useDeviceClass();
  const requirement = resolveLandscapeRequirement(screenKey);
  const unlockRef = useRef<(() => void) | undefined>(undefined);
  const [lockPending, setLockPending] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);

  const landscapeRequired = requirement === 'required' || requirement === 'preferred';
  const showOverlay = active && shouldShowLandscapeOverlay(requirement, orientation.isLandscape, isPhone);
  const blockContent = active && shouldBlockUntilLandscape(requirement, isPhone) && !orientation.isLandscape;

  const runLock = useCallback(async (): Promise<LandscapeLockResult> => {
    setLockPending(true);
    setLockError(null);
    const result = await requestLandscapeLock({ tryFullscreen: tryFullscreenOnRequest });
    setLockPending(false);
    if (result.ok) {
      unlockRef.current = result.unlock;
    } else {
      setLockError(result.error ?? 'Querformat konnte nicht aktiviert werden.');
    }
    return result;
  }, [tryFullscreenOnRequest]);

  useEffect(() => {
    if (!active || !autoLock || !isPhone || !landscapeRequired) return;
    void runLock();
  }, [active, autoLock, isPhone, landscapeRequired, runLock]);

  useEffect(() => {
    if (!active) {
      unlockRef.current?.();
      unlockRef.current = undefined;
    }
    return () => {
      unlockRef.current?.();
      unlockRef.current = undefined;
    };
  }, [active]);

  return {
    ...orientation,
    requirement,
    landscapeRequired,
    showOverlay,
    blockContent,
    lockPending,
    lockError,
    requestLandscapeLock: runLock,
  };
}
