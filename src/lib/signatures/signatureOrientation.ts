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

export type CanonicalSignatureFrame = {
  width: number;
  height: number;
  contentX: number;
  contentY: number;
};

/**
 * A proof signature is stored in a predictable landscape frame while its ink
 * remains in the exact direction in which it was written.
 */
export function resolveCanonicalSignatureFrame(
  contentWidth: number,
  contentHeight: number,
  padding: number,
): CanonicalSignatureFrame {
  const safeWidth = Math.max(1, Math.ceil(contentWidth));
  const safeHeight = Math.max(1, Math.ceil(contentHeight));
  const safePadding = Math.max(0, Math.ceil(padding));
  const paddedWidth = safeWidth + safePadding * 2;
  const paddedHeight = safeHeight + safePadding * 2;
  const width = Math.max(paddedWidth, Math.ceil(paddedHeight * 2.4));
  const height = Math.max(paddedHeight, Math.ceil(width / 4));
  return {
    width,
    height,
    contentX: Math.round((width - safeWidth) / 2),
    contentY: Math.round((height - safeHeight) / 2),
  };
}

export type SignatureCaptureOrientation = {
  isLandscape: boolean;
  orientationType?:
    | 'portrait-primary'
    | 'portrait-secondary'
    | 'landscape-primary'
    | 'landscape-secondary'
    | 'unknown';
  angle?: number | null;
};

/**
 * Resolve a real capture-buffer mismatch from the device orientation.
 *
 * The browser canvas already follows the visible viewport, so a landscape
 * buffer must not be rotated merely because a particular signature happens
 * to be tall. Rotation is only required when the device reports landscape
 * while the exported backing buffer is still portrait. The primary/secondary
 * orientation then provides the otherwise unknowable rotation direction.
 */
export function resolveSignatureCaptureRotation(
  width: number,
  height: number,
  orientation?: SignatureCaptureOrientation | null,
): -90 | 0 | 90 {
  if (width <= 0 || height <= 0 || width >= height || !orientation?.isLandscape) return 0;

  if (orientation.orientationType === 'landscape-secondary') return -90;
  if (orientation.orientationType === 'landscape-primary') return 90;

  const normalizedAngle =
    typeof orientation.angle === 'number'
      ? ((orientation.angle % 360) + 360) % 360
      : null;
  if (normalizedAngle === 270) return -90;
  if (normalizedAngle === 90) return 90;

  // Most mobile browsers expose landscape-primary as +90 degrees.
  return 90;
}

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

/** Layout for proof/PDF signature `<img>` — never rotates user handwriting. */
export function buildSignatureProofImageStyle(
  width?: number | null,
  height?: number | null,
): SignatureProofImageStyle {
  void width;
  void height;
  return {
    objectFit: 'contain' as const,
    marginTop: 8,
    maxWidth: 320,
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
 * It trims unused canvas space and places the original ink, without rotation,
 * into a canonical landscape frame before the Leistungsnachweis is rendered.
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

  const padding = Math.max(8, Math.round(Math.max(source.width, source.height) * 0.025));
  const sourceX = bounds?.left ?? 0;
  const sourceY = bounds?.top ?? 0;
  const cropWidth = Math.max(1, bounds?.width ?? source.width);
  const cropHeight = Math.max(1, bounds?.height ?? source.height);
  const frame = resolveCanonicalSignatureFrame(cropWidth, cropHeight, padding);
  const naturalTargetWidth = frame.width;
  const naturalTargetHeight = frame.height;
  const maxDimension = 1600;
  const scale = Math.min(1, maxDimension / Math.max(naturalTargetWidth, naturalTargetHeight));
  const target = document.createElement('canvas');
  target.width = Math.max(1, Math.round(naturalTargetWidth * scale));
  target.height = Math.max(1, Math.round(naturalTargetHeight * scale));
  const targetContext = target.getContext('2d');
  if (!targetContext) return null;

  targetContext.imageSmoothingEnabled = true;
  targetContext.imageSmoothingQuality = 'high';
  targetContext.drawImage(
    source,
    sourceX,
    sourceY,
    cropWidth,
    cropHeight,
    Math.round(frame.contentX * scale),
    Math.round(frame.contentY * scale),
    Math.max(1, Math.round(cropWidth * scale)),
    Math.max(1, Math.round(cropHeight * scale)),
  );

  return {
    dataUrl: target.toDataURL('image/png'),
    width: target.width,
    height: target.height,
    rotated: false,
    cropped: Boolean(bounds),
  };
}
