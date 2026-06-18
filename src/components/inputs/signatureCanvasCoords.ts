export type CanvasRect = Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>;

export type CanvasPoint = { x: number; y: number };

export type CanvasCoordinateSpace = {
  /** CSS layout size from getBoundingClientRect(). */
  displayWidth: number;
  displayHeight: number;
  /** Canvas 2D context coordinate space (canvas.width / devicePixelRatio). */
  drawWidth: number;
  drawHeight: number;
};

/**
 * Maps pointer offset (relative to canvas padding edge) into canvas draw coordinates.
 * When draw space is synced to display size (ResizeObserver), offset maps 1:1.
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
 * Maps viewport (client) coordinates to canvas draw coordinates.
 * Prefer pointerToCanvasPoint with offsetX/offsetY when the event target is the canvas.
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

/** Prefer offsetX/Y when the canvas is the event target (1:1 on web). */
export function readPointerOffset(event: {
  nativeEvent: PointerEvent;
  currentTarget: HTMLCanvasElement;
}): { offsetX: number; offsetY: number } {
  const native = event.nativeEvent;
  const canvas = event.currentTarget;
  if (
    native.target === canvas &&
    Number.isFinite(native.offsetX) &&
    Number.isFinite(native.offsetY)
  ) {
    return { offsetX: native.offsetX, offsetY: native.offsetY };
  }
  const rect = canvas.getBoundingClientRect();
  return {
    offsetX: native.clientX - rect.left,
    offsetY: native.clientY - rect.top,
  };
}
