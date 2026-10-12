/** Selectors for signature canvas elements that must keep receiving touch gestures. */
export const SIGNATURE_CAPTURE_TOUCH_SELECTOR =
  '[data-signature-capture="true"], [data-testid="portal-signature-canvas"]';

export function isSignatureCaptureTouchTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest(SIGNATURE_CAPTURE_TOUCH_SELECTOR) != null;
}

/**
 * Locks only the background while a signature/fullscreen dialog is mounted.
 * Canvas drawing and native scrolling within the dialog remain available.
 */
export function blockDocumentTouchScrollOutsideSignatureCapture(event: TouchEvent): void {
  if (isSignatureCaptureTouchTarget(event.target)) return;
  if (!(event.target instanceof Element) || !event.target.isConnected) return;

  // Keep dialog fields, actions and long content reachable by native swipes.
  if (event.target.closest('[data-caresuite-fullscreen-overlay], [aria-modal="true"]')) return;

  const doc = event.target.ownerDocument;
  const fullscreenHost = doc.querySelector('[data-caresuite-fullscreen-overlay]');
  const signatureDialog = Array.from(doc.querySelectorAll(SIGNATURE_CAPTURE_TOUCH_SELECTOR))
    .map(canvas => canvas.closest('[aria-modal="true"]'))
    .find(dialog => dialog && dialog.getClientRects().length > 0);

  // Routing can remove a portal host before React releases its listener.
  // A leftover listener must never lock the newly opened visit workspace.
  if (!fullscreenHost && !signatureDialog) return;

  if (event.cancelable) event.preventDefault();
}
