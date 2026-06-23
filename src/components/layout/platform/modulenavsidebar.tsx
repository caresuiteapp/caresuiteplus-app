import { useMemo } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import {
  getModuleNavConfig,
  resolveActiveModuleNavKey,
} from '@/lib/navigation/modulenav';
import { navigateModuleNavItem } from '@/lib/navigation/modulenav/navigateModuleNavItem';
import { useModalStack } from '@/hooks/useModalStack';
import { usePlatformLayout } from '@/hooks/usePlatformLayout';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { useAuroraAdaptiveText, lightLiquidGlass, lightLiquidGlassWebFx } from '@/design/tokens/auroraGlass';
import { glassFx, withAlpha } from '@/design/tokens/motion';
import {
  PLATFORM_MODULE_NAV_WIDTH,
  PLATFORM_SHELL_HEADER_TOP_INSET,
} from '@/lib/platform/shellLayoutMetrics';
import { radius, spacing, typography } from '@/theme';
import { SpaceKpiIcon } from '@/components/icons/space';
import { AccentTextChip } from '@/components/ui/AccentTextChip';
import { resolveLightColoredTextColor } from '@/design/tokens/accentContrast';
import type { MainModuleKey } from '@/types/navigation/platform';

type ModuleNavSidebarProps = {
  mainModule: MainModuleKey;
  accentColor?: string;
};

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : null;

function NavItem({
  active,
  accent,
  icon,
  label,
  badge,
  isDark,
  onPress,
}: {
  active: boolean;
  accent: string;
  icon: string;
  label: string;
  badge?: string | number;
  isDark: boolean;
  onPress: () => void;
}) {
  const bgRest = withAlpha(accent, 0);
  const bgActive = withAlpha(accent, isDark ? 0.2 : 0.12);
  const borderRest = withAlpha(accent, 0);
  const borderActive = withAlpha(accent, 0.45);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={webCursor}
    >
      <View
        style={[
          navStyles.navItem,
          {
            backgroundColor: active ? bgActive : bgRest,
            borderColor: active ? borderActive : borderRest,
          },
        ]}
      >
        {active ? <View style={[navStyles.navActiveBar, { backgroundColor: accent }]} /> : null}
        <SpaceKpiIcon icon={icon} accentColor={accent} size={22} />
        <Text
          style={[
            navStyles.navLabel,
            { color: isDark ? '#A9B2C7' : '#475569' },
            active && {
              color: isDark ? '#FFFFFF' : resolveLightColoredTextColor(accent, accent),
              fontWeight: '700',
            },
          ]}
        >
          {label}
        </Text>
        {badge != null ? (
          <AccentTextChip label={String(badge)} accentColor={accent} textStyle={navStyles.badgeText} />
        ) : null}
      </View>
    </Pressable>
  );
}

/** Grouped module navigation — active module only. */
export function ModuleNavSidebar({ mainModule, accentColor }: ModuleNavSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { adaptiveShell } = usePlatformLayout();
  const { openModal } = useModalStack();
  const { colors, isDark } = useLegacyTheme();
  const text = useAuroraAdaptiveText();
  const accent = accentColor ?? colors.violet;
  const config = getModuleNavConfig(mainModule);
  const activeKey = resolveActiveModuleNavKey(pathname, config);
  const styles = useMemo(() => createStyles(isDark, colors, text, accent), [accent, isDark, colors, text]);

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{config.label}</Text>
      <Text style={styles.subtitle}>Navigation</Text>
      <ScrollView style={styles.nav} contentContainerStyle={styles.navContent}>
        {config.groups.map((group) => (
          <View key={group.title} style={styles.group}>
            <Text style={styles.groupTitle}>{group.title}</Text>
            {group.items.map((item) => (
              <NavItem
                key={item.key}
                active={item.key === activeKey}
                accent={accent}
                icon={item.icon}
                label={item.label}
                badge={item.badge}
                isDark={isDark}
                onPress={() =>
                  navigateModuleNavItem(item, router, openModal, adaptiveShell)
                }
              />
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const navStyles = StyleSheet.create({
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
    position: 'relative',
  },
  navActiveBar: { position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, borderRadius: 3 },
  navIcon: { width: 22, height: 22 },
  navLabel: { ...typography.body, fontWeight: '600', flex: 1 },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.capsule,
    minWidth: 22,
    alignItems: 'center',
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
});

function createStyles(
  isDark: boolean,
  colors: ReturnType<typeof useLegacyTheme>['colors'],
  text: ReturnType<typeof useAuroraAdaptiveText>,
  accent: string,
) {
  const glassBorder = isDark ? glassFx.border : lightLiquidGlass.borderAccent;

  return StyleSheet.create({
    root: {
      width: PLATFORM_MODULE_NAV_WIDTH,
      flexGrow: 0,
      flexShrink: 0,
      alignSelf: 'stretch',
      minHeight: 0,
      backgroundColor: isDark ? 'rgba(18,22,43,0.32)' : lightLiquidGlass.sidebar,
      ...(isDark ? null : lightLiquidGlassWebFx(lightLiquidGlass.blur.medium)),
      borderRightWidth: 1,
      borderRightColor: withAlpha(accent, isDark ? 0.42 : 0.28),
      paddingHorizontal: spacing.md,
      paddingTop: PLATFORM_SHELL_HEADER_TOP_INSET,
      paddingBottom: spacing.md,
    },
    title: { ...typography.h3, color: accent },
    subtitle: {
      ...typography.caption,
      color: text.muted,
      marginBottom: spacing.md,
    },
    nav: { flex: 1 },
    navContent: { gap: spacing.md, paddingBottom: spacing.md },
    group: { gap: spacing.xs },
    groupTitle: {
      ...typography.caption,
      color: text.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      paddingHorizontal: spacing.sm,
      marginBottom: spacing.xs,
    },
  });
}
