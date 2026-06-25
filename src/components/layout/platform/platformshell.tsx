import { ReactNode } from 'react';
import { Platform, StyleSheet, View, type ViewStyle, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';
import type { AppShellArea } from '@/types/navigation/shell';
import type { MainModuleKey } from '@/types/navigation/platform';
import { resolveMainModuleFromPath } from '@/lib/navigation/resolvemainmodule';
import { resolveMainModuleAccent } from '@/lib/navigation/mainModuleAccent';
import {
  PLATFORM_CONTEXT_PANEL_BREAKPOINT,
  resolvePlatformContentPadding,
} from '@/lib/platform/shellLayoutMetrics';
import { breakpoints } from '@/design/tokens/breakpoints';
import { spacing } from '@/theme';
import { MainModuleRail } from './mainmodulerail';
import { MobilePlatformContextPanel } from './mobileplatformcontextpanel';
import { ModuleNavSidebar } from './modulenavsidebar';
import { NotificationBellFab } from '@/components/notifications/notificationcenter';
import { PlatformTopbar } from './platformtopbar';
import { RightContextPanel } from './rightcontextpanel';
import { AutoScrollView } from '@/components/layout/AutoScrollView';

type PlatformShellProps = {
  area: AppShellArea;
  children: ReactNode;
  accentColor?: string;
};

function isZentraleKpiDashboard(pathname: string, mainModule: MainModuleKey): boolean {
  if (mainModule !== 'zentrale') return false;
  const path = pathname.split('?')[0].replace(/\/$/, '') || '/';
  if (path === '/business' || path === '/zentrale') return true;
  const segments = path.split('/').filter(Boolean);
  return segments.length === 1 && segments[0] === 'business';
}

/**
 * Desktop shell (≥1280px with right panel):
 * MainModuleRail | ModuleNavSidebar (full height) | Topbar + main | RightContextPanel
 * Mobile (<768px): no ModuleNavSidebar; context panel scrolls below main content.
 * Zentrale: no left ModuleNavSidebar — navigation lives in RightContextPanel only.
 */
export function PlatformShell({ area: _area, children, accentColor }: PlatformShellProps) {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const mainModule = resolveMainModuleFromPath(pathname);
  const accent = resolveMainModuleAccent(mainModule);

  const isPhoneLayout = width < breakpoints.tablet;
  const centerKpiOverview = !isPhoneLayout && isZentraleKpiDashboard(pathname, mainModule);
  const showContext = width >= PLATFORM_CONTEXT_PANEL_BREAKPOINT;
  const showModuleNav = !isPhoneLayout && mainModule !== 'zentrale';
  const contentPadding = resolvePlatformContentPadding(width);

  const mainWorkArea = centerKpiOverview ? (
    <View style={styles.kpiAlignColumn} testID="main-work-area">
      <AutoScrollView
        style={styles.kpiAlignScroll}
        contentContainerStyle={[
          styles.mainContent,
          styles.mainContentKpiBlock,
          styles.kpiAlignScrollContent,
          styles.mainContentKpiFill,
        ]}
        fillViewport={false}
      >
        {children}
      </AutoScrollView>
    </View>
  ) : (
    <AutoScrollView
      style={styles.main}
      contentContainerStyle={
        isPhoneLayout ? styles.mainScrollContent : styles.mainScrollContentDesktop
      }
      testID="main-work-area"
      fillViewport={!isPhoneLayout}
    >
      <View style={[styles.mainContent, styles.mainContentStretch, { padding: contentPadding }]}>
        {children}
      </View>
      {isPhoneLayout ? (
        <MobilePlatformContextPanel mainModule={mainModule} accentColor={accent} />
      ) : null}
    </AutoScrollView>
  );

  const content = (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.shellRow}>
        <MainModuleRail activeModule={mainModule} />
        {showModuleNav ? <ModuleNavSidebar mainModule={mainModule} accentColor={accent} /> : null}
        <View style={styles.contentColumn}>
          <PlatformTopbar mainModule={mainModule} accentColor={accent} />
          <View style={styles.body}>{mainWorkArea}</View>
        </View>
        {showContext ? <RightContextPanel mainModule={mainModule} accentColor={accent} /> : null}
      </View>
      {Platform.OS !== 'web' ? <NotificationBellFab /> : null}
    </View>
  );

  return content;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  shellRow: { flex: 1, flexDirection: 'row', minHeight: 0 },
  contentColumn: { flex: 1, minWidth: 0, minHeight: 0, flexDirection: 'column' },
  body: { flex: 1, flexDirection: 'column', minHeight: 0 },
  main: { flex: 1, minWidth: 0, minHeight: 0, backgroundColor: 'transparent' },
  mainScrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xxl,
  },
  mainScrollContentDesktop: {
    flexGrow: 1,
    paddingBottom: spacing.xxl,
  },
  kpiAlignColumn: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    width: '100%',
  },
  kpiAlignScroll: {
    flex: 1,
    minHeight: 0,
    backgroundColor: 'transparent',
    ...(Platform.OS === 'web'
      ? ({ overflow: 'auto', height: '100%' } as const)
      : null) as unknown as ViewStyle,
  },
  kpiAlignScrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    width: '100%',
  },
  mainContent: {
    padding: spacing.lg,
    gap: spacing.lg,
    backgroundColor: 'transparent',
  },
  mainContentStretch: {
    flex: 1,
    flexGrow: 1,
    alignSelf: 'stretch',
    minHeight: 0,
    minWidth: 0,
    width: '100%',
  },
  mainContentKpiBlock: {
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
  },
  mainContentKpiFill: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
});