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
import {
  auroraGlass,
  lightLiquidGlass,
  lightLiquidGlassWebFx,
  useAuroraAdaptiveText,
  useAuroraGlassActive,
} from '@/design/tokens/auroraGlass';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { withAlpha } from '@/design/tokens/motion';
import { resolveActiveTabKey } from '@/lib/navigation/shellConfig';
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
  accentColor = '#FF9500',
  portalLabel = 'Portal',
}: PortalNavigationDrawerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const text = useAuroraAdaptiveText();
  const auroraActive = useAuroraGlassActive();
  const { isLight } = useLegacyTheme();
  const useLightDrawer = auroraActive && isLight;
  const activeKey = resolveActiveTabKey(pathname, tabs);

  const drawerSurface = useMemo(() => {
    if (useLightDrawer) {
      return {
        backgroundColor: lightLiquidGlass.modal,
        borderColor: lightLiquidGlass.borderAccent,
        ...lightLiquidGlassWebFx(lightLiquidGlass.blur.medium),
      } as ViewStyle;
    }
    return {
      backgroundColor: auroraGlass.modal,
      borderColor: auroraGlass.borderStrong,
    } as ViewStyle;
  }, [useLightDrawer]);

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
            { paddingTop: insets.top + careSpacing.sm, paddingBottom: insets.bottom + careSpacing.sm },
          ]}
        >
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: text.primary }]}>{portalLabel}</Text>
            <Pressable onPress={onClose} style={[styles.closeBtn, webCursor]} accessibilityRole="button" accessibilityLabel="Schließen">
              <Text style={[styles.closeText, { color: text.muted }]}>✕</Text>
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
                  <Text style={[styles.navLabel, { color: active ? text.primary : text.secondary }, active && { fontWeight: '700' }]}>
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, flexDirection: 'row' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  panel: { width: '82%', maxWidth: 320, borderLeftWidth: 1, elevation: 8 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: careSpacing.md,
    paddingBottom: careSpacing.sm,
  },
  headerTitle: { ...careTypography.h3, fontWeight: '800' },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 18, fontWeight: '700' },
  scrollContent: { paddingHorizontal: careSpacing.md, paddingBottom: careSpacing.xl, gap: careSpacing.xs },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: careSpacing.sm,
    paddingVertical: careSpacing.sm,
    paddingHorizontal: careSpacing.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  navIcon: { fontSize: 18, width: 28, textAlign: 'center' },
  navLabel: { ...careTypography.body, fontWeight: '600', flex: 1 },
});
