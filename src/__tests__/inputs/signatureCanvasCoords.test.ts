import { describe, expect, it } from 'vitest';
import { clientToCanvasPoint } from '@/components/inputs/signatureCanvasCoords';

describe('clientToCanvasPoint', () => {
  const rect = { left: 100, top: 50, width: 400, height: 200 };

  it('maps top-left corner to (0, 0)', () => {
    expect(clientToCanvasPoint(100, 50, rect, 600, 320)).toEqual({ x: 0, y: 0 });
  });

  it('maps bottom-right corner to logical dimensions', () => {
    expect(clientToCanvasPoint(500, 250, rect, 600, 320)).toEqual({ x: 600, y: 320 });
  });

  it('scales when display size differs from logical size (modal CSS mismatch)', () => {
    const displayRect = { left: 0, top: 0, width: 894, height: 320 };
    const center = clientToCanvasPoint(447, 160, displayRect, 672, 320);
    expect(center.x).toBeCloseTo(336, 5);
    expect(center.y).toBeCloseTo(160, 5);
  });

  it('handles devicePixelRatio-style buffers: logical coords stay in CSS space', () => {
    const point = clientToCanvasPoint(300, 150, rect, 600, 320);
    expect(point.x).toBeCloseTo(300, 5);
    expect(point.y).toBeCloseTo(160, 5);
  });

  it('clamps points outside the canvas bounds', () => {
    expect(clientToCanvasPoint(50, 10, rect, 600, 320)).toEqual({ x: 0, y: 0 });
    expect(clientToCanvasPoint(999, 999, rect, 600, 320)).toEqual({ x: 600, y: 320 });
  });

  it('returns origin for zero-sized rect', () => {
    expect(clientToCanvasPoint(200, 200, { left: 0, top: 0, width: 0, height: 0 }, 600, 320)).toEqual({
      x: 0,
      y: 0,
    });
  });
});
