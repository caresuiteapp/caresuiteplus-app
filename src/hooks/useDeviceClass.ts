import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import {
  type AdaptiveDeviceClass,
  isAdaptiveDesktop,
  isAdaptivePhone,
  isAdaptiveTablet,
  resolveAdaptiveDeviceClass,
} from '@/design/tokens/breakpoints';

export type { AdaptiveDeviceClass };

export function useDeviceClass() {
  const { width } = useWindowDimensions();
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
