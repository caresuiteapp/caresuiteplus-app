import { describe, expect, it } from 'vitest';
import {
  BREAKPOINT_MIN,
  isDesktopClass,
  isPhoneClass,
  isTabletClass,
  masterPaneWidth,
  resolveDeviceClass,
  supportsMasterDetail,
} from '@/lib/platform/breakpoints';

describe('breakpoints', () => {
  it('klassifiziert Phone unter 768px', () => {
    expect(resolveDeviceClass(0)).toBe('phone');
    expect(resolveDeviceClass(767)).toBe('phone');
    expect(isPhoneClass('phone')).toBe(true);
  });

  it('klassifiziert Tablet-Stufen korrekt', () => {
    expect(resolveDeviceClass(768)).toBe('small_tablet');
    expect(resolveDeviceClass(899)).toBe('small_tablet');
    expect(resolveDeviceClass(900)).toBe('tablet');
    expect(resolveDeviceClass(1199)).toBe('tablet');
    expect(isTabletClass('small_tablet')).toBe(true);
    expect(isTabletClass('tablet')).toBe(true);
  });

  it('klassifiziert Desktop-Stufen korrekt', () => {
    expect(resolveDeviceClass(1200)).toBe('desktop');
    expect(resolveDeviceClass(1599)).toBe('desktop');
    expect(resolveDeviceClass(1600)).toBe('wide_desktop');
    expect(resolveDeviceClass(2000)).toBe('wide_desktop');
    expect(isDesktopClass('desktop')).toBe(true);
    expect(isDesktopClass('wide_desktop')).toBe(true);
  });

  it('aktiviert Master-Detail ab 768px', () => {
    expect(supportsMasterDetail(767)).toBe(false);
    expect(supportsMasterDetail(768)).toBe(true);
    expect(supportsMasterDetail(BREAKPOINT_MIN.small_tablet)).toBe(true);
  });

  it('liefert Master-Pane-Breiten pro DeviceClass', () => {
    expect(masterPaneWidth('phone')).toBe(0);
    expect(masterPaneWidth('small_tablet')).toBeGreaterThan(0);
    expect(masterPaneWidth('wide_desktop')).toBeGreaterThan(masterPaneWidth('tablet'));
  });
});
