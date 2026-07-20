/**
 * SIGNATURE.3 — Web canvas export: normalize the actual ink to landscape PNG.
 */
import {
  detectSignatureInkBounds,
  normalizeSignatureImageForProof,
  resolveSignatureCaptureRotation,
  type SignatureCaptureOrientation,
} from '@/lib/signatures/signatureOrientation';

/**
 * Export the visible signature exactly in the direction in which it was
 * written. Device orientation is used only when the backing buffer axes are
 * demonstrably swapped; ink proportions alone never decide direction.
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

  const rotation = resolveSignatureCaptureRotation(sourceWidth, sourceHeight, orientation);
  const padding = Math.max(8, Math.round(Math.max(sourceWidth, sourceHeight) * 0.025));
  const sourceX = bounds ? Math.max(0, bounds.left - padding) : 0;
  const sourceY = bounds ? Math.max(0, bounds.top - padding) : 0;
  const sourceRight = bounds ? Math.min(sourceWidth, bounds.right + padding + 1) : sourceWidth;
  const sourceBottom = bounds ? Math.min(sourceHeight, bounds.bottom + padding + 1) : sourceHeight;
  const cropWidth = Math.max(1, sourceRight - sourceX);
  const cropHeight = Math.max(1, sourceBottom - sourceY);

  if (rotation === 0 && !bounds) return canvas.toDataURL('image/png');

  const target = document.createElement('canvas');
  target.width = rotation === 0 ? cropWidth : cropHeight;
  target.height = rotation === 0 ? cropHeight : cropWidth;

  const ctx = target.getContext('2d');
  if (!ctx) return canvas.toDataURL('image/png');

  if (rotation === 90) {
    ctx.translate(cropHeight, 0);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(canvas, sourceX, sourceY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
  } else if (rotation === -90) {
    ctx.translate(0, cropWidth);
    ctx.rotate(-Math.PI / 2);
    ctx.drawImage(canvas, sourceX, sourceY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
  } else {
    ctx.drawImage(canvas, sourceX, sourceY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
  }
  return target.toDataURL('image/png');
}

/** Normalize an inline PNG data URL when dimensions are portrait-oriented. */
export async function normalizeSignatureDataUrl(dataUrl: string): Promise<string> {
  const trimmed = dataUrl.trim();
  if (!trimmed.startsWith('data:image/') || typeof document === 'undefined') {
    return trimmed;
  }
  const normalized = await normalizeSignatureImageForProof(trimmed);
  return normalized?.dataUrl ?? trimmed;
}
