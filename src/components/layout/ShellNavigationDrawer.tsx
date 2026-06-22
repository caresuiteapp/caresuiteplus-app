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
import { SpaceModuleIcon } from '@/components/icons/space';
import {
  getVisibleMainModuleRailItems,
  MAIN_MODULE_RAIL,
} from '@/lib/navigation/mainmodulerail';
import {
  getModuleNavConfig,
  resolveActiveModuleNavKey,
} from '@/lib/navigation/modulenav';
import { navigateModuleNavItem } from '@/lib/navigation/modulenav/navigateModuleNavItem';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { usePermissions } from '@/hooks/usePermissions';
import { useTenantModuleSettings } from '@/hooks/useTenantModuleSettings';
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
import type { MainModuleKey } from '@/types/navigation/platform';
import { useModalStack } from '@/hooks/useModalStack';
import { usePlatformLayout } from '@/hooks/usePlatformLayout';

type ShellNavigationDrawerProps = {
  visible: boolean;
  onClose: () => void;
  mainModule: MainModuleKey;
  accentColor?: string;
};

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : null;

/** Overlay drawer for compact shell — module rail + current module nav (not slide-out sidebar). */
export function ShellNavigationDrawer({
  visible,
  onClose,
  mainModule,
  accentColor = '#7C3AED',
}: ShellNavigationDrawerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const text = useAuroraAdaptiveText();
  const auroraActive = useAuroraGlassActive();
  const { isLight } = useLegacyTheme();
  const useLightDrawer = auroraActive && isLight;
  const { tenantId } = useModuleAccess();
  const { roleKey } = usePermissions();
  const { modules: tenantModules } = useTenantModuleSettings();
  const { openModal } = useModalStack();
  const { adaptiveShell } = usePlatformLayout();

  const visibleModules = useMemo(() => {
    if (!tenantId) {
      return MAIN_MODULE_RAIL.filter((m) => m.key === 'zentrale' || m.key === 'admin');
    }
    return getVisibleMainModuleRailItems({ tenantId, roleKey, tenantModules });
  }, [tenantId, roleKey, tenantModules]);

  const navConfig = useMemo(() => getModuleNavConfig(mainModule), [mainModule]);
  const activeNavKey = resolveActiveModuleNavKey(pathname, navConfig);

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

  const handleModulePress = (path: string) => {
    onClose();
    router.push(path as never);
  };

  const handleNavPress = (item: (typeof navConfig.groups)[number]['items'][number]) => {
    onClose();
    navigateModuleNavItem(item, router, openModal, adaptiveShell);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      testID="shell-navigation-drawer"
    >
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Menü schließen"
        />
        <View
          style={[
            styles.panel,
            drawerSurface,
            { paddingTop: insets.top + careSpacing.sm, paddingBottom: insets.bottom + careSpacing.sm },
          ]}
        >
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: text.primary }]}>Navigation</Text>
            <Pressable
              onPress={onClose}
              style={[styles.closeBtn, webCursor]}
              accessibilityRole="button"
              accessibilityLabel="Schließen"
            >
              <Text style={[styles.closeText, { color: text.muted }]}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <Text style={[styles.sectionLabel, { color: text.muted }]}>Module</Text>
            <View style={styles.moduleGrid}>
              {visibleModules.map((mod) => {
                const active = mod.key === mainModule;
                return (
                  <Pressable
                    key={mod.key}
                    onPress={() => handleModulePress(mod.path)}
                    style={[
                      styles.moduleTile,
                      active && { borderColor: withAlpha(mod.accentColor, 0.6), backgroundColor: withAlpha(mod.accentColor, 0.12) },
                      webCursor,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <SpaceModuleIcon
                      moduleKey={mod.key}
                      accentColor={mod.accentColor}
                      active={active}
                      size={40}
                      frame="rail"
                    />
                    <Text style={[styles.moduleLabel, { color: active ? mod.accentColor : text.secondary }]} numberOfLines={1}>
                      {mod.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {mainModule !== 'zentrale' && navConfig.groups.length > 0 ? (
              <>
                <Text style={[styles.sectionLabel, { color: text.muted, marginTop: careSpacing.md }]}>
                  {navConfig.label}
                </Text>
                {navConfig.groups.map((group) => (
                  <View key={group.title}>
                    <Text style={[styles.groupTitle, { color: text.muted }]}>{group.title}</Text>
                    {group.items.map((item) => {
                      const active = item.key === activeNavKey;
                      return (
                        <Pressable
                          key={item.key}
                          onPress={() => handleNavPress(item)}
                          style={[
                            styles.navRow,
                            active && { backgroundColor: withAlpha(accentColor, 0.12), borderColor: withAlpha(accentColor, 0.45) },
                            webCursor,
                          ]}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                        >
                          <Text style={styles.navIcon}>{item.icon}</Text>
                          <Text style={[styles.navLabel, { color: active ? text.primary : text.secondary }, active && { fontWeight: '700' }]}>
                            {item.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  panel: {
    width: '82%',
    maxWidth: 320,
    borderLeftWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: careSpacing.md,
    paddingBottom: careSpacing.sm,
  },
  headerTitle: {
    ...careTypography.h3,
    fontWeight: '800',
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 18,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: careSpacing.md,
    paddingBottom: careSpacing.xl,
  },
  sectionLabel: {
    ...careTypography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: careSpacing.sm,
  },
  moduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: careSpacing.sm,
  },
  moduleTile: {
    width: '47%',
    alignItems: 'center',
    gap: careSpacing.xs,
    paddingVertical: careSpacing.sm,
    paddingHorizontal: careSpacing.xs,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: auroraGlass.border,
    backgroundColor: auroraGlass.chip,
  },
  moduleLabel: {
    ...careTypography.caption,
    fontWeight: '600',
    textAlign: 'center',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: careSpacing.sm,
    paddingVertical: careSpacing.sm,
    paddingHorizontal: careSpacing.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    marginBottom: careSpacing.xs,
  },
  navIcon: {
    fontSize: 18,
    width: 28,
    textAlign: 'center',
  },
  navLabel: {
    ...careTypography.body,
    fontWeight: '600',
    flex: 1,
  },
  groupTitle: {
    ...careTypography.caption,
    fontWeight: '700',
    marginTop: careSpacing.sm,
    marginBottom: careSpacing.xs,
    paddingHorizontal: careSpacing.xs,
  },
});
