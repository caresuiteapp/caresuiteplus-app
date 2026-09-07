import { describe, expect, it } from 'vitest';
import { resolveDesktopGridLayout } from '@/lib/platform/desktopGridLayout';

describe('responsive desktop workspace', () => {
  it.each([320, 768, 1024, 1280, 1440, 1920, 2560, 3440, 3840])('fits %i pixels without stretching the viewport', width => {
    for (const scale of [1, 1.1, 1.25, 1.5, 2]) {
      const result = resolveDesktopGridLayout(width, scale);
      expect(result.cardWidth * result.columns + result.gap * (result.columns - 1)).toBeCloseTo(width);
      expect(result.columns).toBeGreaterThanOrEqual(1);
      expect(result.columns).toBeLessThanOrEqual(6);
      if (result.columns > 1) expect(result.cardWidth).toBeGreaterThanOrEqual(248 * scale);
    }
  });
  it('reflows when text is enlarged and handles missing initial measurements', () => {
    expect(resolveDesktopGridLayout(1200, 1.5).columns).toBeLessThan(resolveDesktopGridLayout(1200).columns);
    expect(resolveDesktopGridLayout(NaN)).toEqual({ columns: 1, gap: 16, cardWidth: 0 });
  });
});
