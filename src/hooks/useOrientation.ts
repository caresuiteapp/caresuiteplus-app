import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import {
  resolveLandscapeOverlayVariant,
  resolveLandscapeRequirement,
  shouldBlockUntilLandscape,
  shouldShowLandscapeOverlay,
  type LandscapeOverlayVariant,
  type LandscapeRequirement,
  type LandscapeScreenKey,
} from '@/config/landscapeRequiredScreens';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import {
  buildOrientationSnapshot,
  type OrientationSnapshot,
} from '@/lib/orientation/detectOrientation';
import {
  isLandscapeLockAvailable,
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
export {
  isLandscapeLockAvailable,
  requestLandscapeLock,
  type LandscapeLockResult,
} from '@/lib/orientation/requestLandscapeLock';

const LOG_PREFIX = '[CareSuite orientation]';

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
  overlayVariant: LandscapeOverlayVariant;
  showOverlay: boolean;
  blockContent: boolean;
  lockPending: boolean;
  lockFailed: boolean;
  requestLandscapeLock: () => Promise<LandscapeLockResult>;
  dismissBanner: () => void;
  continueInPortrait: () => void;
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
  const [lockFailed, setLockFailed] = useState(
    () => autoLock && !isLandscapeLockAvailable(),
  );
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [portraitBypass, setPortraitBypass] = useState(false);

  const landscapeRequired = requirement === 'required' || requirement === 'preferred';
  const bypass = lockFailed || portraitBypass;
  const overlayVariant = resolveLandscapeOverlayVariant(requirement, lockFailed, portraitBypass);
  const overlayDismissed = bannerDismissed || portraitBypass;
  const showOverlay =
    active &&
    shouldShowLandscapeOverlay(requirement, orientation.isLandscape, isPhone, overlayDismissed);
  const blockContent =
    active && shouldBlockUntilLandscape(requirement, isPhone, bypass) && !orientation.isLandscape;

  const runLock = useCallback(async (): Promise<LandscapeLockResult> => {
    setLockPending(true);
    const result = await requestLandscapeLock({ tryFullscreen: tryFullscreenOnRequest });
    setLockPending(false);
    if (result.ok) {
      unlockRef.current = result.unlock;
      setLockFailed(false);
    } else {
      console.warn(LOG_PREFIX, 'landscape lock request failed', result.error ?? 'unknown');
      setLockFailed(true);
    }
    return result;
  }, [tryFullscreenOnRequest]);

  const dismissBanner = useCallback(() => {
    setBannerDismissed(true);
  }, []);

  const continueInPortrait = useCallback(() => {
    setPortraitBypass(true);
  }, []);

  useEffect(() => {
    if (!active) {
      setLockFailed(false);
      setBannerDismissed(false);
      setPortraitBypass(false);
      return;
    }

    if (!isPhone || !landscapeRequired) return;

    if (autoLock && !isLandscapeLockAvailable()) {
      console.warn(LOG_PREFIX, 'autoLock skipped — orientation.lock unavailable');
      setLockFailed(true);
      return;
    }

    if (autoLock) {
      void runLock();
    }
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
    overlayVariant,
    showOverlay,
    blockContent,
    lockPending,
    lockFailed,
    requestLandscapeLock: runLock,
    dismissBanner,
    continueInPortrait,
  };
}
