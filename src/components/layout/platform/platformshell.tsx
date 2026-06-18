import { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';
import type { AppShellArea } from '@/types/navigation/shell';
import { resolveMainModuleFromPath } from '@/lib/navigation/resolvemainmodule';
import { MAIN_MODULE_RAIL } from '@/lib/navigation/mainmodulerail';
import { AuroraBackground } from '@/components/ui/effects';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { spacing } from '@/theme';
import { MainModuleRail } from './mainmodulerail';
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
 */
export function PlatformShell({ area: _area, children, accentColor }: PlatformShellProps) {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { isDark } = useLegacyTheme();
  const mainModule = resolveMainModuleFromPath(pathname);
  const railItem = MAIN_MODULE_RAIL.find((m) => m.key === mainModule);
  const accent = accentColor ?? railItem?.accentColor;

  const showContext = width >= 1280;
  const showModuleNav = width >= 960;

  const content = (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <PlatformTopbar mainModule={mainModule} accentColor={accent} />
      <View style={styles.body}>
        <MainModuleRail activeModule={mainModule} />
        {showModuleNav ? <ModuleNavSidebar mainModule={mainModule} accentColor={accent} /> : null}
        <View style={styles.main}>
          <ScrollView
            style={styles.mainScroll}
            contentContainerStyle={styles.mainContent}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </View>
        {showContext ? <RightContextPanel mainModule={mainModule} accentColor={accent} /> : null}
      </View>
    </View>
  );

  if (!isDark) {
    return content;
  }

  return (
    <View style={styles.gradientRoot}>
      <AuroraBackground />
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  gradientRoot: { flex: 1, backgroundColor: '#0B1020' },
  root: { flex: 1, backgroundColor: 'transparent' },
  body: { flex: 1, flexDirection: 'row', minHeight: 0 },
  main: { flex: 1, minWidth: 0 },
  mainScroll: { flex: 1 },
  mainContent: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
});
