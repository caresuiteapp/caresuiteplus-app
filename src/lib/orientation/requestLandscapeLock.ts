import { Platform } from 'react-native';

const LOG_PREFIX = '[CareSuite orientation]';

export type LandscapeLockResult = {
  ok: boolean;
  error?: string;
  unlock?: () => void;
};

/** Synchronous check — iOS Safari often lacks orientation.lock entirely. */
export function isLandscapeLockAvailable(): boolean {
  if (Platform.OS !== 'web' || typeof screen === 'undefined') return false;
  const orientation = screen.orientation as ScreenOrientation & {
    lock?: (orientation: string) => Promise<void>;
  };
  return typeof orientation?.lock === 'function';
}

async function tryLockLandscape(): Promise<LandscapeLockResult> {
  if (Platform.OS !== 'web' || typeof screen === 'undefined') {
    return { ok: false, error: 'not-web' };
  }

  const orientation = screen.orientation as ScreenOrientation & {
    lock?: (orientation: string) => Promise<void>;
    unlock?: () => Promise<void>;
  };

  if (typeof orientation?.lock !== 'function') {
    console.warn(LOG_PREFIX, 'orientation.lock unavailable on this browser');
    return { ok: false, error: 'lock-unavailable' };
  }

  try {
    await orientation.lock('landscape');
    return {
      ok: true,
      unlock: () => {
        void orientation.unlock?.().catch((err: unknown) => {
          console.warn(LOG_PREFIX, 'unlock failed', err);
        });
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(LOG_PREFIX, 'lock(landscape) failed', message);
    return { ok: false, error: message };
  }
}

async function tryFullscreenThenLock(): Promise<LandscapeLockResult> {
  if (typeof document === 'undefined') {
    return { ok: false, error: 'no-document' };
  }

  const root = document.documentElement;
  const request =
    root.requestFullscreen?.bind(root) ??
    (root as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> })
      .webkitRequestFullscreen?.bind(root);

  if (!request) {
    return tryLockLandscape();
  }

  try {
    await request();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(LOG_PREFIX, 'requestFullscreen failed', message);
  }

  return tryLockLandscape();
}

/** Attempt landscape lock; optionally request fullscreen first on user gesture. */
export async function requestLandscapeLock(options?: {
  tryFullscreen?: boolean;
}): Promise<LandscapeLockResult> {
  if (options?.tryFullscreen) {
    return tryFullscreenThenLock();
  }

  return tryLockLandscape();
}
