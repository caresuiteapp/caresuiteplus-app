import { Platform } from 'react-native';
import { cleanupOrphanedFullscreenOverlays } from '@/lib/dom/cleanupOrphanedFullscreenOverlays';

type FullscreenDocument = Document & {
  webkitExitFullscreen?: () => Promise<void>;
  mozCancelFullScreen?: () => Promise<void>;
  msExitFullscreen?: () => Promise<void>;
  webkitFullscreenElement?: Element | null;
  mozFullScreenElement?: Element | null;
  msFullscreenElement?: Element | null;
};

type FullscreenElement = Element & {
  webkitExitFullscreen?: () => Promise<void>;
  mozCancelFullScreen?: () => Promise<void>;
  msExitFullscreen?: () => Promise<void>;
};

function resolveActiveFullscreenElement(doc: FullscreenDocument): Element | null {
  return (
    doc.fullscreenElement ??
    doc.webkitFullscreenElement ??
    doc.mozFullScreenElement ??
    doc.msFullscreenElement ??
    null
  );
}

function exitBrowserFullscreen(doc: FullscreenDocument): void {
  const active = resolveActiveFullscreenElement(doc);
  if (!active) return;

  const exitFromElement =
    (active as FullscreenElement).webkitExitFullscreen?.bind(active) ??
    (active as FullscreenElement).mozCancelFullScreen?.bind(active) ??
    (active as FullscreenElement).msExitFullscreen?.bind(active);

  const exitFromDocument =
    doc.exitFullscreen?.bind(doc) ??
    doc.webkitExitFullscreen?.bind(doc) ??
    doc.mozCancelFullScreen?.bind(doc) ??
    doc.msExitFullscreen?.bind(doc);

  void (exitFromElement ?? exitFromDocument)?.().catch(() => {
    /* user may already have exited fullscreen */
  });
}

function unlockOrientationIfPossible(): void {
  if (typeof screen === 'undefined') return;
  const orientation = screen.orientation as ScreenOrientation & {
    unlock?: () => Promise<void> | void;
  };
  try {
    const unlockResult = orientation?.unlock?.();
    if (unlockResult != null && typeof (unlockResult as Promise<void>).catch === 'function') {
      void (unlockResult as Promise<void>).catch(() => {});
    }
  } catch {
    /* ignore */
  }
}

/**
 * Tear down leaked signature fullscreen UI (portal overlay + browser fullscreen).
 * Safe to call on route change, modal close, and deferred finalize.
 */
export function releaseSignatureCaptureEnvironment(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  cleanupOrphanedFullscreenOverlays();
  exitBrowserFullscreen(document as FullscreenDocument);
  unlockOrientationIfPossible();

  document.body.style.overflow = '';
  document.body.style.overscrollBehavior = '';
  document.body.style.touchAction = '';
}
