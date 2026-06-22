import { ReactNode, useState } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppShellArea } from '@/types/navigation/shell';
import type { ShellTabConfig } from '@/types/navigation/shell';
import { AutoScrollView } from '@/components/layout/AutoScrollView';
import { AppTabBar } from '@/components/layout/AppTabBar';
import { ShellAppBar } from '@/components/layout/ShellAppBar';
import { ShellNavigationDrawer } from '@/components/layout/ShellNavigationDrawer';
import { NotificationBellFab } from '@/components/notifications/notificationcenter';
import { useAppShell } from '@/hooks/useAppShell';
import { resolveMainModuleFromPath } from '@/lib/navigation/resolvemainmodule';
import { resolveMainModuleAccent } from '@/lib/navigation/mainModuleAccent';
import { MAIN_MODULE_RAIL } from '@/lib/navigation/mainmodulerail';
import {
  MOBILE_BOTTOM_NAV_HEIGHT,
  resolvePlatformContentPadding,
} from '@/lib/platform/shellLayoutMetrics';
import { spacing } from '@/theme';

type MobileAppShellProps = {
  area: AppShellArea;
  children: ReactNode;
  accentColor?: string;
  tabsOverride?: ShellTabConfig[];
};

function resolveShellTitle(mainModule: ReturnType<typeof resolveMainModuleFromPath>): string {
  const rail = MAIN_MODULE_RAIL.find((m) => m.key === mainModule);
  return rail?.label ?? 'CareSuite+';
}

/**
 * Compact app shell for mobile (≤767) and tablet (768–1023):
 * fixed top app bar, bottom nav, drawer overlay menu — no desktop rail/sidebar.
 */
export function MobileAppShell({
  area,
  children,
  accentColor,
  tabsOverride,
}: MobileAppShellProps) {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const mainModule = resolveMainModuleFromPath(pathname);
  const accent = accentColor ?? resolveMainModuleAccent(mainModule);
  const { tabs } = useAppShell(area);
  const effectiveTabs = tabsOverride?.length ? tabsOverride : tabs;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const contentPadding = resolvePlatformContentPadding(width);
  const bottomNavOffset = MOBILE_BOTTOM_NAV_HEIGHT + Math.max(insets.bottom, spacing.sm);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="mobile-app-shell">
      <ShellAppBar
        title={resolveShellTitle(mainModule)}
        subtitle="CareSuite+"
        accentColor={accent}
        onMenuPress={() => setDrawerOpen(true)}
        menuOpen={drawerOpen}
      />

      <View style={styles.content}>
        <AutoScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { padding: contentPadding, paddingBottom: bottomNavOffset + spacing.lg },
          ]}
          fillViewport
          testID="mobile-app-shell-content"
        >
          {children}
        </AutoScrollView>
      </View>

      <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
        <AppTabBar tabs={effectiveTabs} accentColor={accent} />
      </View>

      <ShellNavigationDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        mainModule={mainModule}
        accentColor={accent}
      />

      {Platform.OS !== 'web' ? (
        <NotificationBellFab bottomOffset={bottomNavOffset} />
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
  content: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: 'transparent',
  },
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 15,
    backgroundColor: 'transparent',
  },
});
