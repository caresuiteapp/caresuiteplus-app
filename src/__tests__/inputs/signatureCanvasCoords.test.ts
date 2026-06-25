import { describe, expect, it } from 'vitest';
import {
  clientToCanvasPoint,
  pointerToCanvasPoint,
  readCanvasCoordinateSpace,
  readPointerOffset,
} from '@/components/inputs/signatureCanvasCoords';

describe('pointerToCanvasPoint', () => {
  it('maps 1:1 when draw space matches display size', () => {
    const space = { displayWidth: 400, displayHeight: 200, drawWidth: 400, drawHeight: 200 };
    expect(pointerToCanvasPoint(100, 50, space)).toEqual({ x: 100, y: 50 });
  });

  it('maps corners exactly when synced', () => {
    const space = { displayWidth: 600, displayHeight: 320, drawWidth: 600, drawHeight: 320 };
    expect(pointerToCanvasPoint(0, 0, space)).toEqual({ x: 0, y: 0 });
    expect(pointerToCanvasPoint(600, 320, space)).toEqual({ x: 600, y: 320 });
  });

  it('does not inflate coords when draw space exceeds display (v1 regression)', () => {
    const syncedSpace = { displayWidth: 598, displayHeight: 318, drawWidth: 598, drawHeight: 318 };
    const v1StyleSpace = { displayWidth: 598, displayHeight: 318, drawWidth: 672, drawHeight: 320 };

    const touch = pointerToCanvasPoint(299, 159, syncedSpace);
    const v1Touch = pointerToCanvasPoint(299, 159, v1StyleSpace);

    expect(touch).toEqual({ x: 299, y: 159 });
    expect(v1Touch.x).toBeGreaterThan(touch.x);
    expect(v1Touch.y).toBeGreaterThan(touch.y);
  });

  it('clamps outside bounds', () => {
    const space = { displayWidth: 400, displayHeight: 200, drawWidth: 400, drawHeight: 200 };
    expect(pointerToCanvasPoint(-10, -5, space)).toEqual({ x: 0, y: 0 });
    expect(pointerToCanvasPoint(500, 300, space)).toEqual({ x: 400, y: 200 });
  });
});

describe('clientToCanvasPoint', () => {
  const rect = { left: 100, top: 50, width: 400, height: 200 };
  const space = { displayWidth: 400, displayHeight: 200, drawWidth: 400, drawHeight: 200 };

  it('maps client coords via rect offset', () => {
    expect(clientToCanvasPoint(200, 100, rect, space)).toEqual({ x: 100, y: 50 });
  });

  it('returns origin for zero-sized display', () => {
    expect(
      clientToCanvasPoint(200, 200, rect, {
        displayWidth: 0,
        displayHeight: 0,
        drawWidth: 600,
        drawHeight: 320,
      }),
    ).toEqual({ x: 0, y: 0 });
  });
});

describe('readPointerOffset', () => {
  it('uses offsetX/Y when canvas is the event target', () => {
    const canvas = { tagName: 'CANVAS' } as HTMLCanvasElement;
    const offset = readPointerOffset({
      currentTarget: canvas,
      nativeEvent: {
        target: canvas,
        offsetX: 42,
        offsetY: 17,
        clientX: 200,
        clientY: 100,
      } as unknown as PointerEvent,
    });
    expect(offset).toEqual({ offsetX: 42, offsetY: 17 });
  });

  it('falls back to client coords relative to canvas rect', () => {
    const canvas = {
      tagName: 'CANVAS',
      getBoundingClientRect: () => ({ left: 100, top: 50, width: 400, height: 200 }),
    } as HTMLCanvasElement;
    const offset = readPointerOffset({
      currentTarget: canvas,
      nativeEvent: {
        target: {} as EventTarget,
        clientX: 200,
        clientY: 100,
      } as PointerEvent,
    });
    expect(offset).toEqual({ offsetX: 100, offsetY: 50 });
  });
});

describe('readCanvasCoordinateSpace', () => {
  it('derives draw size from canvas buffer and dpr', () => {
    const canvas = {
      width: 1200,
      height: 640,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 600, height: 320 }),
    } as HTMLCanvasElement;

    expect(readCanvasCoordinateSpace(canvas, 2)).toEqual({
      displayWidth: 600,
      displayHeight: 320,
      drawWidth: 600,
      drawHeight: 320,
    });
  });
});
