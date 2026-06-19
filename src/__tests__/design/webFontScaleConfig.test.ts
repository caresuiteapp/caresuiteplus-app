import { describe, expect, it } from 'vitest';
import {
  WEB_FONT_SCALE_DEFAULT,
  WEB_FONT_SCALE_STEPS,
  formatWebFontScaleLabel,
  indexOfWebFontScale,
  isWebFontScale,
} from '@/design/web/webFontScaleConfig';

describe('webFontScaleConfig', () => {
  it('exposes discrete scale steps from 90% to 150%', () => {
    expect(WEB_FONT_SCALE_STEPS).toEqual([0.9, 1, 1.1, 1.25, 1.5]);
    expect(WEB_FONT_SCALE_DEFAULT).toBe(1);
  });

  it('formats labels as percentages', () => {
    expect(formatWebFontScaleLabel(1)).toBe('100%');
    expect(formatWebFontScaleLabel(1.25)).toBe('125%');
  });

  it('validates stored scale values', () => {
    expect(isWebFontScale(1.1)).toBe(true);
    expect(isWebFontScale(1.15)).toBe(false);
    expect(indexOfWebFontScale(1.5)).toBe(4);
  });
});
