/**
 * SIGNATURE.3 — Web canvas export: normalize the actual ink to landscape PNG.
 */
import {
  detectSignatureInkBounds,
  normalizeSignatureImageForProof,
  resolveCanonicalSignatureFrame,
  type SignatureCaptureOrientation,
} from '@/lib/signatures/signatureOrientation';

/**
 * Export the visible signature exactly in the direction in which it was
 * written. The ink is placed, without rotation, into a landscape proof frame.
 * This avoids device-orientation guesses that can turn a valid signature
 * sideways or upside down.
 */
export function exportSignatureCanvasPng(
  canvas: HTMLCanvasElement,
  orientation?: SignatureCaptureOrientation | null,
): string {
  const sourceWidth = canvas.width;
  const sourceHeight = canvas.height;
  const sourceContext = canvas.getContext('2d', { willReadFrequently: true });
  let bounds: ReturnType<typeof detectSignatureInkBounds> = null;
  if (sourceContext) {
    try {
      bounds = detectSignatureInkBounds(
        sourceContext.getImageData(0, 0, sourceWidth, sourceHeight).data,
        sourceWidth,
        sourceHeight,
      );
    } catch {
      // Local signature canvases are readable; retain the old fallback if not.
    }
  }

  // The visible canvas is already synchronized to its CSS coordinate space.
  // Retain the parameter for API compatibility, but never rotate the ink from
  // volatile device-orientation metadata.
  void orientation;
  const padding = Math.max(8, Math.round(Math.max(sourceWidth, sourceHeight) * 0.025));
  const sourceX = bounds?.left ?? 0;
  const sourceY = bounds?.top ?? 0;
  const cropWidth = Math.max(1, bounds?.width ?? sourceWidth);
  const cropHeight = Math.max(1, bounds?.height ?? sourceHeight);
  const frame = resolveCanonicalSignatureFrame(cropWidth, cropHeight, padding);

  const target = document.createElement('canvas');
  target.width = frame.width;
  target.height = frame.height;

  const ctx = target.getContext('2d');
  if (!ctx) return canvas.toDataURL('image/png');

  ctx.drawImage(
    canvas,
    sourceX,
    sourceY,
    cropWidth,
    cropHeight,
    frame.contentX,
    frame.contentY,
    cropWidth,
    cropHeight,
  );
  return target.toDataURL('image/png');
}

/** Normalize an inline PNG into the canonical proof frame without rotating ink. */
export async function normalizeSignatureDataUrl(dataUrl: string): Promise<string> {
  const trimmed = dataUrl.trim();
  if (!trimmed.startsWith('data:image/') || typeof document === 'undefined') {
    return trimmed;
  }
  const normalized = await normalizeSignatureImageForProof(trimmed);
  return normalized?.dataUrl ?? trimmed;
}
