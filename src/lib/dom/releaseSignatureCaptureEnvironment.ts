import { Platform } from 'react-native';
import { cleanupOrphanedFullscreenOverlays } from '@/lib/dom/cleanupOrphanedFullscreenOverlays';

/**
 * Tear down leaked signature fullscreen UI (portal overlay + browser fullscreen).
 * Safe to call on route change, modal close, and deferred finalize.
 */
export function releaseSignatureCaptureEnvironment(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  cleanupOrphanedFullscreenOverlays();

  const doc = document as Document & {
    webkitExitFullscreen?: () => Promise<void>;
  };
  const exit =
    document.exitFullscreen?.bind(document) ?? doc.webkitExitFullscreen?.bind(document);

  if (exit && document.fullscreenElement) {
    void exit().catch(() => {
      /* ignore — user may have exited manually */
    });
  }
}
