import { ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions, type ViewStyle } from 'react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppShellArea, ShellTabConfig } from '@/types/navigation/shell';
import { AutoScrollView } from '@/components/layout/AutoScrollView';
import { OrbitTopNavigation } from '@/components/layout/OrbitTopNavigation';
import { resolveMainModuleFromPath } from '@/lib/navigation/resolvemainmodule';
import { resolveMainModuleAccent } from '@/lib/navigation/mainModuleAccent';
import { resolvePlatformContentPadding } from '@/lib/platform/shellLayoutMetrics';
import { webSafeAreaPadding } from '@/lib/platform/webSafeArea';
import { spacing } from '@/theme';

type MobileAppShellProps = {
  area: AppShellArea;
  children: ReactNode;
  accentColor?: string;
  tabsOverride?: ShellTabConfig[];
};

/** Compact ORBIT shell for phone and tablet — top navigation only. */
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
  const contentPadding = resolvePlatformContentPadding(width);
  const topInset = Math.max(insets.top, spacing.xs);

  return (
    <View
      style={[styles.root, { paddingTop: webSafeAreaPadding('top', topInset) } as ViewStyle]}
      testID="orbit-compact-shell"
    >
      <OrbitTopNavigation area={area} accentColor={accent} tabsOverride={tabsOverride} />
      <AutoScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            padding: contentPadding,
            paddingBottom: Math.max(insets.bottom, spacing.sm) + spacing.xl,
          },
        ]}
        fillViewport
        testID="orbit-compact-shell-content"
      >
        {children}
      </AutoScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  scroll: { flex: 1, minHeight: 0 },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: 'rgba(255,255,255,0.74)',
  },
});
