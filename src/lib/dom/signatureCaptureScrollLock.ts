/** Selectors for signature canvas elements that must keep receiving touch gestures. */
export const SIGNATURE_CAPTURE_TOUCH_SELECTOR =
  '[data-signature-capture="true"], [data-testid="portal-signature-canvas"]';

export function isSignatureCaptureTouchTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest(SIGNATURE_CAPTURE_TOUCH_SELECTOR) != null;
}

/**
 * Blocks document scroll while a fullscreen modal is open, but allows finger drawing
 * on the signature canvas (global touchmove preventDefault breaks iOS canvas input).
 */
export function blockDocumentTouchScrollOutsideSignatureCapture(event: TouchEvent): void {
  if (isSignatureCaptureTouchTarget(event.target)) return;
  event.preventDefault();
}
