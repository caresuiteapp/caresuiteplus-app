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
