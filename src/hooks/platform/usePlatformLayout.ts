import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { masterPaneWidth } from '@/lib/platform/breakpoints';
import { buildPlatformLayoutSnapshot } from '@/lib/platform/layoutSnapshot';
import { resolvePlatformTarget } from '@/lib/platform/platform';

export function usePlatformLayout() {
  const { width, height } = useWindowDimensions();

  const layout = useMemo(() => {
    const platform = resolvePlatformTarget();
    return buildPlatformLayoutSnapshot(width, height, platform);
  }, [width, height]);

  return {
    ...layout,
    masterPaneWidth: masterPaneWidth(layout.deviceClass),
    showBottomTabs: layout.shellVariant === 'mobile',
    showSideNavigation: layout.shellVariant !== 'mobile',
  };
}
