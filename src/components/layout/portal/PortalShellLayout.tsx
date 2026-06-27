import { ReactNode, useMemo, useState } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions, type ViewStyle } from 'react-native';
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
import {
  resolvePortalMobileContentPaddingBottom,
  webSafeAreaCalc,
  webSafeAreaPadding,
  webShellViewportLockStyle,
} from '@/lib/platform/webSafeArea';

export type PortalShellKind = 'client' | 'employee' | 'relative';

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
  const portalLabel =
    kind === 'employee'
      ? 'Mitarbeiterportal'
      : kind === 'relative'
        ? 'Angehörigenportal'
        : 'Klient:innenportal';

  const topInset = Math.max(insets.top, careSpacing.xs);
  const bottomNavOffset = PORTAL_MOBILE_NAV_HEIGHT + Math.max(insets.bottom, careSpacing.sm);
  const mobileContentPaddingBottom = useMemo(() => {
    if (Platform.OS === 'web') {
      return webSafeAreaCalc('bottom', bottomNavOffset + careSpacing.lg) as number;
    }
    return resolvePortalMobileContentPaddingBottom(insets.bottom);
  }, [bottomNavOffset, insets.bottom]);

  const mobileNavArea: import('@/types/navigation/shell').AppShellArea =
    kind === 'employee' ? 'portal_employee' : 'portal_client';

  return (
    <View
      style={[
        styles.root,
        isCompactShell ? webShellViewportLockStyle() : null,
        isCompactShell ? ({ paddingTop: webSafeAreaPadding('top', topInset) } as ViewStyle) : null,
      ]}
      testID="portal-shell-layout"
    >
      <View style={isCompactShell ? styles.topBarHost : undefined}>
        <PortalTopBar
          accentColor={accentColor}
          compact={isCompactShell}
          showHamburger={isCompactShell}
          onMenuPress={() => setDrawerOpen(true)}
          portalLabel={portalLabel}
          portalKind={kind}
        />
      </View>

      {isCompactShell ? (
        <View style={styles.content}>
          <AutoScrollView
            style={styles.mainScroll}
            contentContainerStyle={[
              styles.mainContent,
              showBottomTabs ? { paddingBottom: mobileContentPaddingBottom } : null,
            ]}
            fillViewport
            testID="portal-shell-scroll"
          >
            {children}
          </AutoScrollView>
        </View>
      ) : (
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
                showBottomTabs ? { paddingBottom: mobileContentPaddingBottom } : null,
              ]}
              fillViewport
              testID="portal-shell-scroll"
            >
              {children}
            </AutoScrollView>
          </View>

          {showRightSidebar ? <PortalRightSidebar accentColor={accentColor} /> : null}
        </View>
      )}

      {showBottomTabs ? (
        <View style={styles.bottomNavHost}>
          <PortalMobileNav tabs={portalTabs} accentColor={accentColor} area={mobileNavArea} />
        </View>
      ) : null}
      <PortalNavigationDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        tabs={portalTabs}
        accentColor={accentColor}
        portalLabel={portalLabel}
      />
      <NotificationBellFab
        bottomOffset={showBottomTabs ? bottomNavOffset : 0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
    minHeight: 0,
    overflow: 'hidden',
  },
  topBarHost: {
    flexShrink: 0,
    zIndex: 10,
  },
  content: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    minHeight: 0,
    zIndex: 1,
  },
  main: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
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
  bottomNavHost: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 15,
    backgroundColor: 'transparent',
  },
});
