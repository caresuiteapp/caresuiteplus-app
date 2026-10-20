import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

describe('webFontSize', () => {
  const originalPlatform = process.env.EXPO_OS;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env.EXPO_OS = originalPlatform;
  });

  it('returns calc() expressions on web', async () => {
    vi.doMock('react-native', () => ({
      Platform: { OS: 'web' },
    }));
    const { webScaledFontMetric, WEB_FONT_SCALE_CSS_VAR } = await import('@/design/web/webFontSize');
    expect(WEB_FONT_SCALE_CSS_VAR).toBe('var(--app-font-scale, 1)');
    expect(webScaledFontMetric(15)).toBe('calc(15px * var(--app-font-scale, 1))');
    expect(webScaledFontMetric(22)).toBe('calc(22px * var(--app-font-scale, 1))');
  });

  it('returns base px on native', async () => {
    vi.doMock('react-native', () => ({
      Platform: { OS: 'ios' },
    }));
    const { webScaledFontMetric } = await import('@/design/web/webFontSize');
    expect(webScaledFontMetric(15)).toBe(15);
  });

  it('does not include zoom in web font scale CSS', async () => {
    const { WEB_FONT_SCALE_CSS } = await import('@/design/web/webFontScaleCss');
    expect(WEB_FONT_SCALE_CSS).toContain('--app-font-scale');
    expect(WEB_FONT_SCALE_CSS).not.toContain('zoom');
  });
});
