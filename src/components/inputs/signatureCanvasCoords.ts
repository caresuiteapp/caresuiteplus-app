export type CanvasRect = Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>;

export type CanvasPoint = { x: number; y: number };

export type CanvasCoordinateSpace = {
  /** CSS layout size from getBoundingClientRect(). */
  displayWidth: number;
  displayHeight: number;
  /** Canvas 2D draw space (canvas.width / devicePixelRatio when ctx.scale(dpr) is applied). */
  drawWidth: number;
  drawHeight: number;
};

/**
 * Maps pointer offset (relative to canvas padding edge) into canvas draw coordinates.
 * Equivalent to scaling by canvas.width/rect.width when draw space matches display size.
 */
export function pointerToCanvasPoint(
  offsetX: number,
  offsetY: number,
  space: CanvasCoordinateSpace,
): CanvasPoint {
  const { displayWidth, displayHeight, drawWidth, drawHeight } = space;
  if (displayWidth <= 0 || displayHeight <= 0 || drawWidth <= 0 || drawHeight <= 0) {
    return { x: 0, y: 0 };
  }
  const x = (offsetX / displayWidth) * drawWidth;
  const y = (offsetY / displayHeight) * drawHeight;
  return {
    x: Math.max(0, Math.min(drawWidth, x)),
    y: Math.max(0, Math.min(drawHeight, y)),
  };
}

/**
 * Maps viewport (client) coordinates to canvas draw coordinates via getBoundingClientRect().
 * x = (clientX - rect.left) * (drawWidth / rect.width)
 * Handles modal/scroll/transform offsets because rect is viewport-relative.
 */
export function clientToCanvasPoint(
  clientX: number,
  clientY: number,
  rect: CanvasRect,
  space: CanvasCoordinateSpace,
): CanvasPoint {
  return pointerToCanvasPoint(clientX - rect.left, clientY - rect.top, space);
}

export function readCanvasCoordinateSpace(
  canvas: HTMLCanvasElement,
  dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
): CanvasCoordinateSpace {
  const rect = canvas.getBoundingClientRect();
  return {
    displayWidth: rect.width,
    displayHeight: rect.height,
    drawWidth: canvas.width / dpr,
    drawHeight: canvas.height / dpr,
  };
}

/** Scale stored stroke points when the canvas draw area changes size. */
export function scaleCanvasPoints(
  points: CanvasPoint[],
  from: Pick<CanvasCoordinateSpace, 'drawWidth' | 'drawHeight'>,
  to: Pick<CanvasCoordinateSpace, 'drawWidth' | 'drawHeight'>,
): CanvasPoint[] {
  if (from.drawWidth <= 0 || from.drawHeight <= 0) return points;
  const scaleX = to.drawWidth / from.drawWidth;
  const scaleY = to.drawHeight / from.drawHeight;
  return points.map((point) => ({
    x: point.x * scaleX,
    y: point.y * scaleY,
  }));
}
