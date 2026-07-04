/**
 * SIGNATURE.2 — Web canvas export: normalize tall signature buffers to landscape PNG.
 */
import { needsSignatureOrientationCorrection } from '@/lib/signatures/signatureOrientation';

/** Export canvas PNG with width >= height (rotate -90° when buffer is tall). */
export function exportSignatureCanvasPng(canvas: HTMLCanvasElement): string {
  const sourceWidth = canvas.width;
  const sourceHeight = canvas.height;

  if (!needsSignatureOrientationCorrection(sourceWidth, sourceHeight)) {
    return canvas.toDataURL('image/png');
  }

  const target = document.createElement('canvas');
  target.width = sourceHeight;
  target.height = sourceWidth;

  const ctx = target.getContext('2d');
  if (!ctx) return canvas.toDataURL('image/png');

  ctx.translate(0, sourceWidth);
  ctx.rotate(-Math.PI / 2);
  ctx.drawImage(canvas, 0, 0);
  return target.toDataURL('image/png');
}

/** Normalize an inline PNG data URL when dimensions are portrait-oriented. */
export async function normalizeSignatureDataUrl(dataUrl: string): Promise<string> {
  const trimmed = dataUrl.trim();
  if (!trimmed.startsWith('data:image/') || typeof document === 'undefined') {
    return trimmed;
  }

  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const { naturalWidth: width, naturalHeight: height } = image;
      if (!needsSignatureOrientationCorrection(width, height)) {
        resolve(trimmed);
        return;
      }

      const target = document.createElement('canvas');
      target.width = height;
      target.height = width;
      const ctx = target.getContext('2d');
      if (!ctx) {
        resolve(trimmed);
        return;
      }

      ctx.translate(0, width);
      ctx.rotate(-Math.PI / 2);
      ctx.drawImage(image, 0, 0);
      resolve(target.toDataURL('image/png'));
    };
    image.onerror = () => resolve(trimmed);
    image.src = trimmed;
  });
}
