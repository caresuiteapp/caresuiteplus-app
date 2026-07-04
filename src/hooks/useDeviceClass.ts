import { useMemo } from 'react';
import {
  type AdaptiveDeviceClass,
  isAdaptiveDesktop,
  isAdaptivePhone,
  isAdaptiveTablet,
  resolveAdaptiveDeviceClass,
} from '@/design/tokens/breakpoints';
import { useHydrationSafeWindowDimensions } from '@/hooks/useHydrationSafeWindowDimensions';

export type { AdaptiveDeviceClass };

export function useDeviceClass() {
  const { width } = useHydrationSafeWindowDimensions();
  const deviceClass = useMemo(() => resolveAdaptiveDeviceClass(width), [width]);

  return {
    deviceClass,
    width,
    isPhone: isAdaptivePhone(deviceClass),
    isTablet: isAdaptiveTablet(deviceClass),
    isDesktop: deviceClass === 'desktop',
    isWide: deviceClass === 'wide',
    isDesktopOrWide: isAdaptiveDesktop(deviceClass),
  };
}
