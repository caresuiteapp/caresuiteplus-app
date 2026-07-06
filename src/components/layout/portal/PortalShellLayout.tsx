import { ReactNode, useMemo, useState } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
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
import { resolveEmployeePortalNavigationTabs } from '@/lib/navigation/employeePortalNavigation';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { usePlatformLayout } from '@/hooks/usePlatformLayout';
import { usePortalClientPrimaryTabs, usePortalClientTabs } from '@/hooks/usePortalClientTabs';
import { useHydrationSafeWindowDimensions } from '@/hooks/useHydrationSafeWindowDimensions';
import { moduleColor } from '@/design/tokens/modules';
import { BREAKPOINT_MIN } from '@/lib/platform/breakpoints';
import {
  resolvePortalMobileContentPaddingBottom,
  webSafeAreaCalc,
  webSafeAreaPadding,
  webShellViewportLockStyle,
} from '@/lib/platform/webSafeArea';
import { usePortalMessengerFocus } from '@/lib/portal/portalMessengerFocusContext';

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
  const { width } = useHydrationSafeWindowDimensions();
  const { isDesktopOrWide } = useDeviceClass();
  const { showBottomTabs } = usePlatformLayout();
  const clientDrawerTabs = usePortalClientTabs();
  const clientPrimaryTabs = usePortalClientPrimaryTabs();
  const portalTabs =
    kind === 'employee' ? PORTAL_EMPLOYEE_TABS : clientPrimaryTabs;
  const drawerTabs =
    kind === 'employee'
      ? resolveEmployeePortalNavigationTabs(PORTAL_EMPLOYEE_TABS)
      : clientDrawerTabs;
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { active: messengerFocusActive } = usePortalMessengerFocus();

  const isCompactShell = !isDesktopOrWide;
  const showMobileBottomNav = showBottomTabs && !messengerFocusActive;
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

  const scrollContentStyle = [
    styles.mainContent,
    messengerFocusActive ? styles.mainContentMessengerFocus : null,
    showMobileBottomNav ? { paddingBottom: mobileContentPaddingBottom } : null,
  ];

  const mainContent = messengerFocusActive ? (
    <View style={[styles.mainScroll, scrollContentStyle]} testID="portal-shell-scroll">
      {children}
    </View>
  ) : (
    <AutoScrollView
      style={styles.mainScroll}
      contentContainerStyle={scrollContentStyle}
      fillViewport
      testID="portal-shell-scroll"
    >
      {children}
    </AutoScrollView>
  );

  return (
    <View
      style={[
        styles.root,
        isCompactShell ? webShellViewportLockStyle() : null,
        isCompactShell ? ({ paddingTop: webSafeAreaPadding('top', topInset) } as ViewStyle) : null,
      ]}
      testID="portal-shell-layout"
    >
      <View style={styles.topBarHost}>
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
        <View style={styles.content}>{mainContent}</View>
      ) : (
        <View style={styles.body}>
          {showLeftNav ? (
            kind === 'employee' ? (
              <PortalTabLeftNav
                tabs={drawerTabs}
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

          <View style={styles.main}>{mainContent}</View>

          {showRightSidebar ? <PortalRightSidebar accentColor={accentColor} /> : null}
        </View>
      )}

      {showMobileBottomNav ? (
        <View style={styles.bottomNavHost}>
          <PortalMobileNav tabs={portalTabs} accentColor={accentColor} area={mobileNavArea} />
        </View>
      ) : null}
      <PortalNavigationDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        tabs={drawerTabs}
        accentColor={accentColor}
        portalLabel={portalLabel}
      />
      {!messengerFocusActive ? (
        <NotificationBellFab bottomOffset={showMobileBottomNav ? bottomNavOffset : 0} />
      ) : null}
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
    position: 'relative',
    zIndex: 20,
    overflow: 'visible',
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
  mainContentMessengerFocus: {
    flex: 1,
    minHeight: 0,
    padding: 0,
    paddingBottom: 0,
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
