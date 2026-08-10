import { ReactNode } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppShellArea } from '@/types/navigation/shell';
import { resolveMainModuleFromPath } from '@/lib/navigation/resolvemainmodule';
import { resolveMainModuleAccent } from '@/lib/navigation/mainModuleAccent';
import { resolvePlatformContentPadding } from '@/lib/platform/shellLayoutMetrics';
import { useHydrationSafeWindowDimensions } from '@/hooks/useHydrationSafeWindowDimensions';
import { AutoScrollView } from '@/components/layout/AutoScrollView';
import { MobilePlatformContextPanel } from './mobileplatformcontextpanel';
import { OrbitTopNavigation } from '@/components/layout/OrbitTopNavigation';
import { spacing } from '@/theme';

type PlatformShellProps = {
  area: AppShellArea;
  children: ReactNode;
  accentColor?: string;
};

/**
 * ORBIT workspace shell for the internal CareSuite system.
 * Navigation lives exclusively at the top; no rail, sidebar or slide panel.
 */
export function PlatformShell({ area, children, accentColor }: PlatformShellProps) {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width } = useHydrationSafeWindowDimensions();
  const mainModule = resolveMainModuleFromPath(pathname);
  const accent = accentColor ?? resolveMainModuleAccent(mainModule);
  const contentPadding = resolvePlatformContentPadding(width);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="orbit-platform-shell">
      <OrbitTopNavigation area={area} accentColor={accent} />
      <View style={styles.stage}>
        <AutoScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { padding: contentPadding, paddingBottom: spacing.xxl },
          ]}
          fillViewport
          testID="main-work-area"
        >
          <View style={styles.content}>{children}</View>
          <View style={styles.contextCards}>
            <MobilePlatformContextPanel mainModule={mainModule} accentColor={accent} />
          </View>
        </AutoScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    backgroundColor: 'transparent',
  },
  stage: {
    flex: 1,
    minHeight: 0,
    margin: 14,
    marginTop: 10,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(20,64,112,0.12)',
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(30px) saturate(1.18)',
          WebkitBackdropFilter: 'blur(30px) saturate(1.18)',
          boxShadow: '0 28px 80px rgba(37,78,128,0.13)',
        } as unknown as ViewStyle)
      : null),
  },
  scroll: { flex: 1, minHeight: 0, backgroundColor: 'transparent' },
  scrollContent: { flexGrow: 1, gap: spacing.lg },
  content: { flex: 1, minHeight: 0, width: '100%', gap: spacing.lg },
  contextCards: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.07)',
    paddingTop: spacing.md,
  },
});
