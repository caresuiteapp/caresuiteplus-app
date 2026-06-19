import { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';
import type { AppShellArea } from '@/types/navigation/shell';
import { resolveMainModuleFromPath } from '@/lib/navigation/resolvemainmodule';
import { MAIN_MODULE_RAIL } from '@/lib/navigation/mainmodulerail';
import { breakpoints } from '@/design/tokens/breakpoints';
import { spacing } from '@/theme';
import { MainModuleRail } from './mainmodulerail';
import { MobilePlatformContextPanel } from './mobileplatformcontextpanel';
import { ModuleNavSidebar } from './modulenavsidebar';
import { PlatformTopbar } from './platformtopbar';
import { RightContextPanel } from './rightcontextpanel';

type PlatformShellProps = {
  area: AppShellArea;
  children: ReactNode;
  accentColor?: string;
};

/**
 * Five-zone desktop/web shell:
 * Topbar | MainModuleRail | ModuleNavSidebar | Main work area | RightContextPanel
 * Mobile (<768px): no ModuleNavSidebar; context panel scrolls below main content.
 * Zentrale: no left ModuleNavSidebar — navigation lives in RightContextPanel only.
 */
export function PlatformShell({ area: _area, children, accentColor }: PlatformShellProps) {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const mainModule = resolveMainModuleFromPath(pathname);
  const railItem = MAIN_MODULE_RAIL.find((m) => m.key === mainModule);
  const accent = accentColor ?? railItem?.accentColor;

  const isPhoneLayout = width < breakpoints.tablet;
  const showContext = width >= 1280;
  const showModuleNav = width >= 960 && !isPhoneLayout && mainModule !== 'zentrale';

  const content = (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <PlatformTopbar mainModule={mainModule} accentColor={accent} />
      <View style={styles.body}>
        <MainModuleRail activeModule={mainModule} />
        {showModuleNav ? <ModuleNavSidebar mainModule={mainModule} accentColor={accent} /> : null}
        {isPhoneLayout ? (
          <ScrollView
            style={styles.main}
            contentContainerStyle={styles.mainScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.mainContent}>{children}</View>
            <MobilePlatformContextPanel mainModule={mainModule} accentColor={accent} />
          </ScrollView>
        ) : (
          <View style={styles.main} testID="main-work-area">
            <View style={styles.mainContent}>{children}</View>
          </View>
        )}
        {showContext ? <RightContextPanel mainModule={mainModule} accentColor={accent} /> : null}
      </View>
    </View>
  );

  return content;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  body: { flex: 1, flexDirection: 'row', minHeight: 0 },
  main: { flex: 1, minWidth: 0, backgroundColor: 'transparent' },
  mainScrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xxl,
  },
  mainContent: {
    flex: 1,
    minHeight: 0,
    padding: spacing.lg,
    gap: spacing.lg,
    backgroundColor: 'transparent',
  },
});
