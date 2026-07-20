/**
 * SIGNATURE.2 — Keep drawn signatures horizontally readable in proofs.
 * Canvas capture targets landscape (width >= height). Tall PNGs indicate a
 * swapped buffer from mobile landscape capture and are corrected at save/render.
 */

/** True when stored image dimensions suggest a portrait-oriented signature buffer. */
export function needsSignatureOrientationCorrection(
  width: number,
  height: number,
): boolean {
  if (width <= 0 || height <= 0) return false;
  return height > width;
}

/** Read PNG IHDR dimensions from a data URL (works in Node for tests). */
export function readPngDimensionsFromDataUrl(
  dataUrl: string,
): { width: number; height: number } | null {
  const match = /^data:image\/png;base64,(.+)$/i.exec(dataUrl.trim());
  if (!match) return null;

  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(match[1]), (char) => char.charCodeAt(0));
  } catch {
    return null;
  }

  return readPngDimensionsFromBytes(bytes);
}

export type SignatureProofImageStyle = {
  maxWidth: number;
  maxHeight: number;
  objectFit: 'contain';
  marginTop: number;
  transform?: string;
};

export type SignatureInkBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  pixelCount: number;
};

export type NormalizedSignatureProofImage = {
  dataUrl: string;
  width: number;
  height: number;
  rotated: boolean;
  cropped: boolean;
};

/**
 * Finds the written ink rather than trusting the outer PNG dimensions.
 * Mobile landscape captures can have a landscape buffer while the actual
 * signature pixels are stored sideways inside that buffer.
 */
export function detectSignatureInkBounds(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): SignatureInkBounds | null {
  if (width <= 0 || height <= 0 || pixels.length < width * height * 4) return null;

  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  let pixelCount = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const red = pixels[offset];
      const green = pixels[offset + 1];
      const blue = pixels[offset + 2];
      const alpha = pixels[offset + 3];
      if (alpha < 16) continue;

      const luminance = (red * 299 + green * 587 + blue * 114) / 1000;
      const saturation = Math.max(red, green, blue) - Math.min(red, green, blue);
      const isInk = alpha < 245 || luminance < 242 || saturation > 20;
      if (!isInk) continue;

      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
      pixelCount += 1;
    }
  }

  if (right < left || bottom < top || pixelCount < 4) return null;
  return {
    left,
    top,
    right,
    bottom,
    width: right - left + 1,
    height: bottom - top + 1,
    pixelCount,
  };
}

/** A signature is always presented in reading direction: wider than tall. */
export function shouldRotateSignatureInk(bounds: SignatureInkBounds): boolean {
  return bounds.height > bounds.width * 1.08;
}

/** Layout for proof/PDF signature `<img>` — rotates tall buffers for display. */
export function buildSignatureProofImageStyle(
  width?: number | null,
  height?: number | null,
): SignatureProofImageStyle {
  const base = {
    objectFit: 'contain' as const,
    marginTop: 8,
  };

  if (width && height && needsSignatureOrientationCorrection(width, height)) {
    return {
      ...base,
      maxWidth: 120,
      maxHeight: 280,
      transform: 'rotate(-90deg)',
    };
  }

  return {
    ...base,
    maxWidth: 280,
    maxHeight: 120,
  };
}

export function signatureProofImageStyleToCss(style: SignatureProofImageStyle): string {
  const parts = [
    `max-width:${style.maxWidth}px`,
    `max-height:${style.maxHeight}px`,
    `margin-top:${style.marginTop}px`,
    `object-fit:${style.objectFit}`,
  ];
  if (style.transform) {
    parts.push(`transform:${style.transform}`);
  }
  return parts.join(';');
}

export function readPngDimensionsFromBytes(
  bytes: Uint8Array,
): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let index = 0; index < signature.length; index += 1) {
    if (bytes[index] !== signature[index]) return null;
  }

  const width =
    ((bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19]) >>> 0;
  const height =
    ((bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23]) >>> 0;

  if (width <= 0 || height <= 0) return null;
  return { width, height };
}

export function resolveSignatureImageDimensions(
  imageUrl?: string | null,
  width?: number | null,
  height?: number | null,
): { width: number; height: number } | null {
  if (width && height && width > 0 && height > 0) {
    return { width, height };
  }
  if (imageUrl?.trim().startsWith('data:image/png')) {
    return readPngDimensionsFromDataUrl(imageUrl);
  }
  return null;
}

/** Probe PNG dimensions from inline data URL or remote PNG (Assist signature storage). */
export async function probeSignatureImageDimensions(
  imageUrl: string,
): Promise<{ width: number; height: number } | null> {
  const trimmed = imageUrl.trim();
  if (!trimmed) return null;

  const inline = resolveSignatureImageDimensions(trimmed);
  if (inline) return inline;

  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return null;
  }

  try {
    const response = await fetch(trimmed);
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    return readPngDimensionsFromBytes(bytes);
  } catch {
    return null;
  }
}

/**
 * Browser-side proof normalization for new and already stored signatures.
 * It trims unused canvas space and rotates sideways ink into a horizontal,
 * readable image before html2canvas creates the Leistungsnachweis PDF.
 */
export async function normalizeSignatureImageForProof(
  imageUrl: string,
): Promise<NormalizedSignatureProofImage | null> {
  const trimmed = imageUrl.trim();
  if (!trimmed || typeof document === 'undefined' || typeof Image === 'undefined') {
    return null;
  }

  const image = await new Promise<HTMLImageElement | null>((resolve) => {
    const candidate = new Image();
    if (/^https?:\/\//i.test(trimmed)) candidate.crossOrigin = 'anonymous';
    candidate.onload = () => resolve(candidate);
    candidate.onerror = () => resolve(null);
    candidate.src = trimmed;
  });
  if (!image || image.naturalWidth <= 0 || image.naturalHeight <= 0) return null;

  const source = document.createElement('canvas');
  source.width = image.naturalWidth;
  source.height = image.naturalHeight;
  const sourceContext = source.getContext('2d', { willReadFrequently: true });
  if (!sourceContext) return null;
  sourceContext.drawImage(image, 0, 0);

  let bounds: SignatureInkBounds | null = null;
  try {
    bounds = detectSignatureInkBounds(
      sourceContext.getImageData(0, 0, source.width, source.height).data,
      source.width,
      source.height,
    );
  } catch {
    // Signed storage URLs without usable CORS still retain dimension fallback.
  }

  const rotate = bounds
    ? shouldRotateSignatureInk(bounds)
    : needsSignatureOrientationCorrection(source.width, source.height);
  const padding = Math.max(8, Math.round(Math.max(source.width, source.height) * 0.025));
  const sourceX = bounds ? Math.max(0, bounds.left - padding) : 0;
  const sourceY = bounds ? Math.max(0, bounds.top - padding) : 0;
  const sourceRight = bounds ? Math.min(source.width, bounds.right + padding + 1) : source.width;
  const sourceBottom = bounds ? Math.min(source.height, bounds.bottom + padding + 1) : source.height;
  const cropWidth = Math.max(1, sourceRight - sourceX);
  const cropHeight = Math.max(1, sourceBottom - sourceY);

  const naturalTargetWidth = rotate ? cropHeight : cropWidth;
  const naturalTargetHeight = rotate ? cropWidth : cropHeight;
  const maxDimension = 1600;
  const scale = Math.min(1, maxDimension / Math.max(naturalTargetWidth, naturalTargetHeight));
  const target = document.createElement('canvas');
  target.width = Math.max(1, Math.round(naturalTargetWidth * scale));
  target.height = Math.max(1, Math.round(naturalTargetHeight * scale));
  const targetContext = target.getContext('2d');
  if (!targetContext) return null;

  targetContext.imageSmoothingEnabled = true;
  targetContext.imageSmoothingQuality = 'high';
  if (rotate) {
    targetContext.translate(0, target.height);
    targetContext.rotate(-Math.PI / 2);
    targetContext.drawImage(
      source,
      sourceX,
      sourceY,
      cropWidth,
      cropHeight,
      0,
      0,
      target.height,
      target.width,
    );
  } else {
    targetContext.drawImage(
      source,
      sourceX,
      sourceY,
      cropWidth,
      cropHeight,
      0,
      0,
      target.width,
      target.height,
    );
  }

  return {
    dataUrl: target.toDataURL('image/png'),
    width: target.width,
    height: target.height,
    rotated: rotate,
    cropped: Boolean(bounds),
  };
}
