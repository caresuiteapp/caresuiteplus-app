/**
 * Adaptive Design System breakpoints (phone / tablet / desktop / wide).
 */
export const breakpoints = {
  phone: 0,
  largePhone: 390,
  tablet: 768,
  desktop: 1024,
  wide: 1440,
} as const;

export type AdaptiveDeviceClass = 'phone' | 'tablet' | 'desktop' | 'wide';

export function resolveAdaptiveDeviceClass(width: number): AdaptiveDeviceClass {
  if (width < breakpoints.tablet) return 'phone';
  if (width < breakpoints.desktop) return 'tablet';
  if (width < breakpoints.wide) return 'desktop';
  return 'wide';
}

export function isAdaptivePhone(deviceClass: AdaptiveDeviceClass): boolean {
  return deviceClass === 'phone';
}

export function isAdaptiveTablet(deviceClass: AdaptiveDeviceClass): boolean {
  return deviceClass === 'tablet';
}

export function isAdaptiveDesktop(deviceClass: AdaptiveDeviceClass): boolean {
  return deviceClass === 'desktop' || deviceClass === 'wide';
}

export function kpiColumnsForDeviceClass(deviceClass: AdaptiveDeviceClass): number {
  switch (deviceClass) {
    case 'phone':
      return 2;
    case 'tablet':
      return 4;
    case 'desktop':
      return 4;
    case 'wide':
      return 6;
    default:
      return 2;
  }
}

/** Pure column resolver — used by AdaptiveKpiGrid and tests. */
export function kpiGridColumnCount(
  width: number,
  overrides?: Partial<Record<AdaptiveDeviceClass, number>>,
): number {
  const deviceClass = resolveAdaptiveDeviceClass(width);
  const base = kpiColumnsForDeviceClass(deviceClass);
  return overrides?.[deviceClass] ?? base;
}
