import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { masterPaneWidth } from '@/lib/platform/breakpoints';
import { buildPlatformLayoutSnapshot } from '@/lib/platform/layoutSnapshot';
import { resolvePlatformTarget } from '@/lib/platform/platform';

export function usePlatformLayout() {
  const { width, height } = useWindowDimensions();
  const { deviceClass, isPhone, isTablet, isDesktop, isWide } = useDeviceClass();

  const layout = useMemo(() => {
    const platform = resolvePlatformTarget();
    return buildPlatformLayoutSnapshot(width, height, platform);
  }, [width, height]);

  const adaptiveShell =
    isPhone ? 'mobile' : isTablet ? 'tablet' : isWide && layout.isWeb ? 'web' : 'desktop';

  return {
    ...layout,
    adaptiveDeviceClass: deviceClass,
    adaptiveShell,
    isPhone,
    isTablet,
    isDesktop,
    isWide,
    masterPaneWidth: masterPaneWidth(layout.deviceClass),
    showBottomTabs: layout.shellVariant === 'mobile',
    showSideNavigation: layout.shellVariant !== 'mobile',
  };
}
