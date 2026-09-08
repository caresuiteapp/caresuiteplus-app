import { describe, expect, it } from 'vitest';
import { resolveDesktopGridLayout } from '@/lib/platform/desktopGridLayout';

describe('responsive desktop workspace', () => {
  it.each([320, 768, 1024, 1280, 1440, 1920, 2560, 3440, 3840])('fits %i pixels without stretching the viewport', width => {
    for (const scale of [1, 1.1, 1.25, 1.5, 2]) {
      const result = resolveDesktopGridLayout(width, scale);
      const total = result.cardWidth * result.columns + result.gap * (result.columns - 1);
      expect(total).toBeLessThanOrEqual(width);
      expect(width - total).toBeLessThan(0.07);
      expect(result.columns).toBeGreaterThanOrEqual(1);
      expect(result.columns).toBeLessThanOrEqual(6);
      if (result.columns > 1) expect(result.cardWidth).toBeGreaterThanOrEqual(240 * scale);
    }
  });
  it.each([
    { workspace: 1218, height: 530 }, // 1920 physical pixels at 125% browser zoom, open sidebar
    { workspace: 1602, height: 730 }, // 1920 CSS pixels, open sidebar
  ])('keeps twelve cards in four columns at $workspace CSS pixels', ({ workspace, height }) => {
    const grid = resolveDesktopGridLayout(workspace, 1, height);
    expect(grid.columns).toBe(4); expect(grid.rows).toBe(3);
    expect(grid.contentHeight).toBeLessThanOrEqual(height);
    expect(grid.labelHeight).toBeGreaterThanOrEqual(64);
    expect(grid.imageHeight).toBeGreaterThanOrEqual(72);
  });
  it('responds to available height without shrinking text', () => {
    const tall = resolveDesktopGridLayout(1218, 1, 900);
    const short = resolveDesktopGridLayout(1218, 1, 530);
    expect(short.imageHeight).toBeLessThan(tall.imageHeight);
    expect(short.labelHeight).toBe(tall.labelHeight);
    expect(short.cardWidth).toBe(tall.cardWidth);
  });
  it('preserves a scrollable minimum when the viewport cannot fit every row', () => {
    const grid = resolveDesktopGridLayout(320, 2, 250);
    expect(grid.columns).toBe(1); expect(grid.imageHeight).toBe(72);
    expect(grid.labelHeight).toBe(112); expect(grid.contentHeight).toBeGreaterThan(250);
  });
  it('uses ultrawide space and reflows for enlarged text', () => {
    expect(resolveDesktopGridLayout(2200).columns).toBe(6);
    expect(resolveDesktopGridLayout(1200, 1.5).columns).toBeLessThan(resolveDesktopGridLayout(1200).columns);
    expect(resolveDesktopGridLayout(NaN)).toMatchObject({ columns: 1, cardWidth: 0 });
  });
});
