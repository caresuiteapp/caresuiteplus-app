import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { type DeviceClass, resolveDeviceClass } from '@/lib/platform/breakpoints';

export function useDeviceClass(): DeviceClass {
  const { width } = useWindowDimensions();
  return useMemo(() => resolveDeviceClass(width), [width]);
}
