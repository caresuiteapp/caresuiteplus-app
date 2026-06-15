import { describe, expect, it } from 'vitest';
import { resolveResponsiveValue } from '@/design/tokens/responsiveValue';

describe('useResponsiveValue / resolveResponsiveValue', () => {
  const values = {
    phone: 'mobile',
    tablet: 'tablet',
    desktop: 'desktop',
    wide: 'wide',
  };

  it('liefert phone-Wert unter 768px', () => {
    expect(resolveResponsiveValue(375, values)).toBe('mobile');
    expect(resolveResponsiveValue(767, values)).toBe('mobile');
  });

  it('liefert tablet-Wert 768–1023px', () => {
    expect(resolveResponsiveValue(768, values)).toBe('tablet');
    expect(resolveResponsiveValue(1023, values)).toBe('tablet');
  });

  it('liefert desktop-Wert 1024–1439px', () => {
    expect(resolveResponsiveValue(1024, values)).toBe('desktop');
    expect(resolveResponsiveValue(1439, values)).toBe('desktop');
  });

  it('liefert wide-Wert ab 1440px', () => {
    expect(resolveResponsiveValue(1440, values)).toBe('wide');
    expect(resolveResponsiveValue(1920, values)).toBe('wide');
  });

  it('fällt auf phone zurück wenn Klasse fehlt', () => {
    expect(resolveResponsiveValue(1280, { phone: 'fallback' })).toBe('fallback');
  });
});
