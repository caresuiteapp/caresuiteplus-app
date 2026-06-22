import { ReactNode, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AutoScrollView } from '@/components/layout/AutoScrollView';
import { PortalLeftNav } from './PortalLeftNav';
import { PortalTabLeftNav } from './PortalTabLeftNav';
import { PortalMobileNav } from '@/components/layout/PortalMobileNav';
import { PortalRightSidebar } from './PortalRightSidebar';
import { PortalNavigationDrawer } from './PortalNavigationDrawer';
import { NotificationBellFab } from '@/components/notifications/notificationcenter';
import { PortalTopBar } from './PortalTopBar';
import { careSpacing } from '@/design/tokens/spacing';
import { PORTAL_MOBILE_NAV_HEIGHT } from '@/lib/navigation/portalMobileTabs';
import { PORTAL_EMPLOYEE_TABS } from '@/lib/navigation/shellConfig';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { usePlatformLayout } from '@/hooks/usePlatformLayout';
import { usePortalClientTabs } from '@/hooks/usePortalClientTabs';
import { moduleColor } from '@/design/tokens/modules';
import { BREAKPOINT_MIN } from '@/lib/platform/breakpoints';

export type PortalShellKind = 'client' | 'employee';

type PortalShellLayoutProps = {
  children: ReactNode;
  accentColor?: string;
  kind?: PortalShellKind;
};

/**
 * Dedicated portal shell — client or employee navigation, no office/admin rails.
 * Desktop (≥1024): left nav + top bar + right sidebar (≥1200px).
 * Mobile/tablet (<1024): app bar with hamburger drawer + bottom nav.
 */
export function PortalShellLayout({
  children,
  accentColor = moduleColor('assist'),
  kind = 'client',
}: PortalShellLayoutProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { isDesktopOrWide } = useDeviceClass();
  const { showBottomTabs } = usePlatformLayout();
  const clientTabs = usePortalClientTabs();
  const portalTabs = kind === 'employee' ? PORTAL_EMPLOYEE_TABS : clientTabs;
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isCompactShell = !isDesktopOrWide;
  const showRightSidebar = width >= BREAKPOINT_MIN.desktop && kind === 'client';
  const showLeftNav = isDesktopOrWide;
  const portalLabel = kind === 'employee' ? 'Mitarbeiterportal' : 'Klient:innenportal';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <PortalTopBar
        accentColor={accentColor}
        compact={isCompactShell}
        showHamburger={isCompactShell}
        onMenuPress={() => setDrawerOpen(true)}
        portalLabel={portalLabel}
      />

      <View style={styles.body}>
        {showLeftNav ? (
          kind === 'employee' ? (
            <PortalTabLeftNav
              tabs={portalTabs}
              accentColor={accentColor}
              portalLabel={portalLabel}
            />
          ) : (
            <PortalLeftNav
              accentColor={accentColor}
              collapsed={navCollapsed}
              onToggleCollapse={() => setNavCollapsed((v) => !v)}
            />
          )
        ) : null}

        <View style={styles.main}>
          <AutoScrollView
            style={styles.mainScroll}
            contentContainerStyle={[
              styles.mainContent,
              showBottomTabs ? styles.mainContentWithBottomNav : null,
            ]}
            fillViewport
          >
            {children}
          </AutoScrollView>
        </View>

        {showRightSidebar ? <PortalRightSidebar accentColor={accentColor} /> : null}
      </View>

      {showBottomTabs ? (
        <PortalMobileNav tabs={portalTabs} accentColor={accentColor} />
      ) : null}
      <PortalNavigationDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        tabs={portalTabs}
        accentColor={accentColor}
        portalLabel={portalLabel}
      />
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
  mainScroll: {
    flex: 1,
    minHeight: 0,
  },
  mainContent: {
    flexGrow: 1,
    padding: careSpacing.md,
    paddingBottom: careSpacing.xl,
    backgroundColor: 'transparent',
  },
  mainContentWithBottomNav: {
    paddingBottom: PORTAL_MOBILE_NAV_HEIGHT + careSpacing.xl,
  },
});
