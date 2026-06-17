export type CanvasRect = Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>;

export type CanvasPoint = { x: number; y: number };

/**
 * Maps viewport (client) coordinates to canvas logical coordinates.
 * Accounts for CSS display size differing from the canvas buffer (width/height props, DPR, modal layout).
 */
export function clientToCanvasPoint(
  clientX: number,
  clientY: number,
  rect: CanvasRect,
  logicalWidth: number,
  logicalHeight: number,
): CanvasPoint {
  if (rect.width <= 0 || rect.height <= 0 || logicalWidth <= 0 || logicalHeight <= 0) {
    return { x: 0, y: 0 };
  }
  const x = ((clientX - rect.left) / rect.width) * logicalWidth;
  const y = ((clientY - rect.top) / rect.height) * logicalHeight;
  return {
    x: Math.max(0, Math.min(logicalWidth, x)),
    y: Math.max(0, Math.min(logicalHeight, y)),
  };
}
