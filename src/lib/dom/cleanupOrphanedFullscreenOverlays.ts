import { Platform } from 'react-native';

const OVERLAY_SELECTOR = '[data-caresuite-fullscreen-overlay]';

/**
 * Removes leaked signature/fullscreen overlay portal hosts from document.body.
 * Safe to call on app boot and on every route change (web only).
 */
export function cleanupOrphanedFullscreenOverlays(): number {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return 0;

  const nodes = document.body.querySelectorAll(OVERLAY_SELECTOR);
  nodes.forEach((node) => node.remove());

  if (nodes.length === 0) return 0;

  const remaining = document.body.querySelectorAll(OVERLAY_SELECTOR);
  if (remaining.length === 0) {
    document.body.style.overflow = '';
    document.body.style.overscrollBehavior = '';
    document.body.style.touchAction = '';
  }

  return nodes.length;
}
