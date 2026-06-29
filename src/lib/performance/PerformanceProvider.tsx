import { useEffect, useMemo, type ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';
import { usePrefersReducedMotion } from '@/hooks/useprefersreducedmotion';
import {
  getDevicePerformanceProfile,
  type DevicePerformanceSnapshot,
} from './devicePerformance';
import { syncPerformanceBodyClasses } from './performanceCss';

export const PerformanceContext = {
  current: null as DevicePerformanceSnapshot | null,
};

type PerformanceProviderProps = {
  children: ReactNode;
};

export function PerformanceProvider({ children }: PerformanceProviderProps) {
  const { width } = useWindowDimensions();
  const prefersReducedMotion = usePrefersReducedMotion();

  const snapshot = useMemo(
    () =>
      getDevicePerformanceProfile({
        viewportWidth: width,
        prefersReducedMotion,
      }),
    [width, prefersReducedMotion],
  );

  useEffect(() => {
    PerformanceContext.current = snapshot;
    syncPerformanceBodyClasses(snapshot);
  }, [snapshot]);

  return <>{children}</>;
}

export function useDevicePerformance(): DevicePerformanceSnapshot {
  const { width } = useWindowDimensions();
  const prefersReducedMotion = usePrefersReducedMotion();
  return useMemo(
    () =>
      getDevicePerformanceProfile({
        viewportWidth: width,
        prefersReducedMotion,
      }),
    [width, prefersReducedMotion],
  );
}
