import { describe, expect, it, vi } from 'vitest';
import {
  buildExtendedStarrySky,
  drawAnimatedStarrySky,
  resolveStarrySkyCount,
  type StarrySkyStar,
} from '@/components/backgrounds/lightStarrySkyCanvas';
import { llganStarDust } from '@/design/tokens/lightLiquidGlassAuroraNebula';

function mockCanvasContext(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
  } as unknown as CanvasRenderingContext2D;
}

const drawOptions = {
  animate: true,
  starOpacity: 0.6,
  palette: 'aurora' as const,
  parallaxScale: (layerDepth: number, animate: boolean) => (animate ? layerDepth : 1),
};

describe('lightStarrySkyCanvas', () => {
  it('ergänzt deterministische Extra-Sterne', () => {
    const field = buildExtendedStarrySky(llganStarDust.slice(0, 4), 16, 'test-seed');
    expect(field.length).toBe(20);
    expect(buildExtendedStarrySky(llganStarDust.slice(0, 4), 16, 'test-seed')).toEqual(field);
  });

  it('skaliert Sternanzahl nach Viewport', () => {
    expect(resolveStarrySkyCount(390, llganStarDust.length).extraCount).toBe(12);
    expect(resolveStarrySkyCount(1280, llganStarDust.length).extraCount).toBe(32);
  });

  it('drawAnimatedStarrySky wirft nicht bei ungültigem stars-Input', () => {
    const ctx = mockCanvasContext();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(() =>
      drawAnimatedStarrySky(ctx, 800, 600, 0, undefined as unknown as StarrySkyStar[], drawOptions),
    ).not.toThrow();
    expect(() =>
      drawAnimatedStarrySky(ctx, 800, 600, 0, {} as unknown as StarrySkyStar[], drawOptions),
    ).not.toThrow();
    expect(ctx.arc).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('drawAnimatedStarrySky zeichnet Sterne bei gültigem Array', () => {
    const ctx = mockCanvasContext();
    const stars: StarrySkyStar[] = [
      {
        nx: 0.5,
        ny: 0.5,
        radius: 1,
        baseOpacity: 0.5,
        twinkleSpeed: 0.05,
        glowRadius: 3,
        layerDepth: 0.9,
        phase: 0,
      },
    ];

    drawAnimatedStarrySky(ctx, 800, 600, 1.5, stars, drawOptions);

    expect(ctx.arc).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });
});
