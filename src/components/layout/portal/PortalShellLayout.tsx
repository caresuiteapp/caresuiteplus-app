import { ReactNode, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PortalLeftNav } from './PortalLeftNav';
import { PortalMobileNav } from '@/components/layout/PortalMobileNav';
import { PortalRightSidebar } from './PortalRightSidebar';
import { NotificationBellFab } from '@/components/notifications/notificationcenter';
import { PortalTopBar } from './PortalTopBar';
import { careSpacing } from '@/design/tokens/spacing';
import { PORTAL_MOBILE_NAV_HEIGHT } from '@/lib/navigation/portalMobileTabs';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { usePlatformLayout } from '@/hooks/usePlatformLayout';
import { usePortalClientTabs } from '@/hooks/usePortalClientTabs';
import { moduleColor } from '@/design/tokens/modules';
import { BREAKPOINT_MIN } from '@/lib/platform/breakpoints';

type PortalShellLayoutProps = {
  children: ReactNode;
  accentColor?: string;
};

/**
 * Dedicated Klient:innenportal shell — client-only navigation, no office/admin rails.
 * Desktop: left nav + top bar + right sidebar (≥1200px).
 * Mobile: compact top bar + bottom nav (PortalMobileNav).
 */
export function PortalShellLayout({
  children,
  accentColor = moduleColor('assist'),
}: PortalShellLayoutProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { isPhone } = useDeviceClass();
  const { showBottomTabs } = usePlatformLayout();
  const portalTabs = usePortalClientTabs();
  const [navCollapsed, setNavCollapsed] = useState(false);

  const showRightSidebar = width >= BREAKPOINT_MIN.desktop;
  const showLeftNav = !isPhone;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {isPhone ? (
        <PortalTopBar accentColor={accentColor} compact />
      ) : (
        <PortalTopBar accentColor={accentColor} />
      )}

      <View style={styles.body}>
        {showLeftNav ? (
          <PortalLeftNav
            accentColor={accentColor}
            collapsed={navCollapsed}
            onToggleCollapse={() => setNavCollapsed((v) => !v)}
          />
        ) : null}

        <View style={styles.main}>
          <View style={styles.mainContent}>{children}</View>
        </View>

        {showRightSidebar ? <PortalRightSidebar accentColor={accentColor} /> : null}
      </View>

      {showBottomTabs ? (
        <PortalMobileNav tabs={portalTabs} accentColor={accentColor} />
      ) : null}
      <NotificationBellFab
        bottomOffset={showBottomTabs ? PORTAL_MOBILE_NAV_HEIGHT + careSpacing.sm : 0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    minHeight: 0,
  },
  main: {
    flex: 1,
    minWidth: 0,
    backgroundColor: 'transparent',
  },
  mainContent: {
    flex: 1,
    minHeight: 0,
    padding: careSpacing.md,
    paddingBottom: careSpacing.xl,
    backgroundColor: 'transparent',
  },
});
