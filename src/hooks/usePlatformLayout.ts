import { useMemo } from 'react';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { useHydrationSafeWindowDimensions } from '@/hooks/useHydrationSafeWindowDimensions';
import { masterPaneWidth } from '@/lib/platform/breakpoints';
import { buildPlatformLayoutSnapshot } from '@/lib/platform/layoutSnapshot';
import { resolvePlatformTarget } from '@/lib/platform/platform';

export function usePlatformLayout() {
  const { width, height } = useHydrationSafeWindowDimensions();
  const { deviceClass, isPhone, isTablet, isDesktop, isWide } = useDeviceClass();

  const layout = useMemo(() => {
    const platform = resolvePlatformTarget();
    return buildPlatformLayoutSnapshot(width, height, platform);
  }, [width, height]);

  /** Compact shell (app bar + bottom nav + drawer) below desktop breakpoint; desktop shell unchanged ≥1024. */
  const isCompactShell = width <= 1023;
  const adaptiveShell = isCompactShell ? 'compact' : 'desktop';

  return {
    ...layout,
    adaptiveDeviceClass: deviceClass,
    adaptiveShell,
    isCompactShell,
    isPhone,
    isTablet,
    isDesktop,
    isWide,
    masterPaneWidth: masterPaneWidth(layout.deviceClass),
    showBottomTabs: isCompactShell,
    showSideNavigation: !isCompactShell,
  };
}
