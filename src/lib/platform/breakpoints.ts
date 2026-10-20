/**
 * Responsive breakpoints for CareSuite+ multi-platform layouts.
 * Width-based device classes — independent of native platform.
 */
export type DeviceClass =
  | 'phone'
  | 'small_tablet'
  | 'tablet'
  | 'desktop'
  | 'wide_desktop';

export const BREAKPOINT_MIN = {
  phone: 0,
  small_tablet: 768,
  tablet: 900,
  desktop: 1200,
  wide_desktop: 1600,
} as const;

export const MASTER_DETAIL_MIN_WIDTH = BREAKPOINT_MIN.small_tablet;

export function resolveDeviceClass(width: number): DeviceClass {
  if (width < BREAKPOINT_MIN.small_tablet) return 'phone';
  if (width < BREAKPOINT_MIN.tablet) return 'small_tablet';
  if (width < BREAKPOINT_MIN.desktop) return 'tablet';
  if (width < BREAKPOINT_MIN.wide_desktop) return 'desktop';
  return 'wide_desktop';
}

export function isPhoneClass(deviceClass: DeviceClass): boolean {
  return deviceClass === 'phone';
}

export function isTabletClass(deviceClass: DeviceClass): boolean {
  return deviceClass === 'small_tablet' || deviceClass === 'tablet';
}

export function isDesktopClass(deviceClass: DeviceClass): boolean {
  return deviceClass === 'desktop' || deviceClass === 'wide_desktop';
}

export function supportsMasterDetail(width: number): boolean {
  return width >= MASTER_DETAIL_MIN_WIDTH;
}

export function masterPaneWidth(deviceClass: DeviceClass): number {
  switch (deviceClass) {
    case 'small_tablet':
      return 300;
    case 'tablet':
      return 340;
    case 'desktop':
      return 380;
    case 'wide_desktop':
      return 420;
    default:
      return 0;
  }
}
