/** Coordinates in the unmodified source PNG: left, top, width, height. */
export type DesktopArtworkBounds = readonly [number, number, number, number];

export type DesktopArtworkGeometry = {
  pixelSize: readonly [number, number];
  contentBounds: DesktopArtworkBounds;
  paintBounds: DesktopArtworkBounds;
};

/** The visible motif occupies the same share of every square or wide artwork stage. */
export const DESKTOP_ARTWORK_FILL = 0.88;

export type DesktopArtworkFrame = { x: number; y: number; side: number };

function validBounds(bounds: DesktopArtworkBounds, width: number, height: number) {
  const [x, y, w, h] = bounds;
  return bounds.every(Number.isFinite) && x >= 0 && y >= 0 && w > 0 && h > 0 &&
    x + w <= width && y + h <= height;
}

/** A square SVG viewBox also fits wide/narrow stages without stretching the motif. */
export function desktopArtworkFrame(geometry: DesktopArtworkGeometry): DesktopArtworkFrame | null {
  const [width, height] = geometry.pixelSize;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 ||
      !validBounds(geometry.contentBounds, width, height) || !validBounds(geometry.paintBounds, width, height)) return null;
  const [x, y, w, h] = geometry.contentBounds;
  const [paintX, paintY, paintW, paintH] = geometry.paintBounds;
  const centerX = x + w / 2;
  const centerY = y + h / 2;
  // Future artwork with a wider shadow gets enough room instead of being clipped.
  const side = Math.max(Math.max(w, h) / DESKTOP_ARTWORK_FILL,
    2 * (centerX - paintX), 2 * (paintX + paintW - centerX),
    2 * (centerY - paintY), 2 * (paintY + paintH - centerY));
  return { x: centerX - side / 2, y: centerY - side / 2, side };
}

export function desktopArtworkResolution(geometry: DesktopArtworkGeometry): number {
  return Math.max(geometry.contentBounds[2], geometry.contentBounds[3]);
}
