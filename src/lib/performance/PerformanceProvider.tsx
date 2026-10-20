import { useEffect, useMemo, type ReactNode } from 'react';
import { usePrefersReducedMotion } from '@/hooks/useprefersreducedmotion';
import { useHydrationSafeWindowDimensions } from '@/hooks/useHydrationSafeWindowDimensions';
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
  const { width } = useHydrationSafeWindowDimensions();
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
  const { width } = useHydrationSafeWindowDimensions();
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
