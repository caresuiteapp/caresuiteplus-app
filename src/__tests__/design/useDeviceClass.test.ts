import { describe, expect, it } from 'vitest';
import {
  isAdaptiveDesktop,
  isAdaptivePhone,
  isAdaptiveTablet,
  resolveAdaptiveDeviceClass,
} from '@/design/tokens/breakpoints';

describe('useDeviceClass / adaptive breakpoints', () => {
  it('klassifiziert Phone unter 768px', () => {
    expect(resolveAdaptiveDeviceClass(375)).toBe('phone');
    expect(resolveAdaptiveDeviceClass(767)).toBe('phone');
    expect(isAdaptivePhone('phone')).toBe(true);
  });

  it('klassifiziert Tablet 768–1023px', () => {
    expect(resolveAdaptiveDeviceClass(768)).toBe('tablet');
    expect(resolveAdaptiveDeviceClass(1023)).toBe('tablet');
    expect(isAdaptiveTablet('tablet')).toBe(true);
  });

  it('klassifiziert Desktop 1024–1439px', () => {
    expect(resolveAdaptiveDeviceClass(1024)).toBe('desktop');
    expect(resolveAdaptiveDeviceClass(1439)).toBe('desktop');
  });

  it('klassifiziert Wide ab 1440px', () => {
    expect(resolveAdaptiveDeviceClass(1440)).toBe('wide');
    expect(resolveAdaptiveDeviceClass(1920)).toBe('wide');
    expect(isAdaptiveDesktop('wide')).toBe(true);
  });
});
