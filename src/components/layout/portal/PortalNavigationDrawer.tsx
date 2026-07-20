import { useMemo } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { darkGlassSurfaceText, lightSurfaceText } from '@/design/tokens/auroraGlass';
import { careLightColors } from '@/design/tokens/lightTheme';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { withAlpha } from '@/design/tokens/motion';
import { resolveActiveTabKey } from '@/lib/navigation/shellConfig';
import { useAuth } from '@/lib/auth/context';
import {
  MOBILE_EDGE_INSET,
  MOBILE_MIN_TOUCH_TARGET,
  webSafeAreaPadding,
} from '@/lib/platform/webSafeArea';
import type { ShellTabConfig } from '@/types/navigation/shell';

type PortalNavigationDrawerProps = {
  visible: boolean;
  onClose: () => void;
  tabs: ShellTabConfig[];
  accentColor?: string;
  portalLabel?: string;
};

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : null;

/** Overlay drawer for compact portal shell — full nav list, not slide-out sidebar. */
export function PortalNavigationDrawer({
  visible,
  onClose,
  tabs,
  accentColor = '#1478FF',
  portalLabel = 'Portal',
}: PortalNavigationDrawerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const { isLight } = useLegacyTheme();
  const drawerText = isLight ? lightSurfaceText : darkGlassSurfaceText;
  const activeKey = resolveActiveTabKey(pathname, tabs);

  const drawerSurface = useMemo(() => {
    if (isLight) {
      return {
        backgroundColor: careLightColors.surface,
        borderColor: careLightColors.borderStrong,
      } as ViewStyle;
    }
    return {
      backgroundColor: '#0F172A',
      borderColor: 'rgba(148, 163, 184, 0.35)',
    } as ViewStyle;
  }, [isLight]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      testID="portal-navigation-drawer"
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Menü schließen" />
        <View
          style={[
            styles.panel,
            drawerSurface,
            {
              paddingTop: webSafeAreaPadding('top', insets.top + careSpacing.sm) as number,
              paddingBottom: webSafeAreaPadding('bottom', insets.bottom + careSpacing.sm) as number,
            },
          ]}
        >
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: drawerText.primary }]}>{portalLabel}</Text>
            <Pressable onPress={onClose} style={[styles.closeBtn, webCursor]} accessibilityRole="button" accessibilityLabel="Schließen">
              <Text style={[styles.closeText, { color: drawerText.muted }]}>✕</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {tabs.map((tab) => {
              const active = tab.key === activeKey;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => {
                    onClose();
                    router.push(tab.href as never);
                  }}
                  style={[
                    styles.navRow,
                    active && { backgroundColor: withAlpha(accentColor, 0.12), borderColor: withAlpha(accentColor, 0.45) },
                    webCursor,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={styles.navIcon}>{tab.icon}</Text>
                  <Text style={[styles.navLabel, { color: active ? drawerText.primary : drawerText.secondary }, active && { fontWeight: '700' }]}>
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={[styles.logoutSection, { borderTopColor: drawerSurface.borderColor as string }]}>
            <Pressable
              onPress={() => {
                onClose();
                void signOut().then(() => router.replace('/' as never));
              }}
              style={[styles.logoutRow, webCursor]}
              accessibilityRole="button"
              accessibilityLabel="Abmelden"
              testID="portal-drawer-logout"
            >
              <Text style={styles.navIcon}>⎋</Text>
              <Text style={[styles.logoutLabel, { color: drawerText.primary }]}>Abmelden</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, flexDirection: 'row' },
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.62)' },
  panel: { width: '86%', maxWidth: 340, borderLeftWidth: 1, elevation: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: careSpacing.md,
    paddingBottom: careSpacing.sm,
  },
  headerTitle: { ...careTypography.h3, fontWeight: '800', flex: 1, minWidth: 0 },
  closeBtn: {
    width: MOBILE_MIN_TOUCH_TARGET,
    height: MOBILE_MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { fontSize: 18, fontWeight: '700' },
  scrollContent: { paddingHorizontal: MOBILE_EDGE_INSET, paddingBottom: careSpacing.md, gap: careSpacing.xs },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: careSpacing.sm,
    minHeight: MOBILE_MIN_TOUCH_TARGET,
    paddingVertical: careSpacing.sm,
    paddingHorizontal: careSpacing.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  navIcon: { fontSize: 18, width: 28, textAlign: 'center' },
  navLabel: { ...careTypography.body, fontWeight: '600', flex: 1 },
  logoutSection: {
    borderTopWidth: 1,
    marginTop: careSpacing.sm,
    paddingHorizontal: MOBILE_EDGE_INSET,
    paddingTop: careSpacing.sm,
    paddingBottom: careSpacing.xs,
  },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: careSpacing.sm,
    minHeight: MOBILE_MIN_TOUCH_TARGET,
    paddingVertical: careSpacing.sm,
    paddingHorizontal: careSpacing.sm,
    borderRadius: 10,
  },
  logoutLabel: { ...careTypography.body, fontWeight: '700', flex: 1 },
});
