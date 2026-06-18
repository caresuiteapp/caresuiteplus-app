import { useMemo, type ComponentType } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type ViewStyle,
} from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { usePathname, useRouter } from 'expo-router';
import {
  getModuleNavConfig,
  resolveActiveModuleNavKey,
} from '@/lib/navigation/modulenav';
import { SUPPORT_LINKS } from '@/lib/platform/supportLinks';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { fxMotion, glassFx, withAlpha } from '@/design/tokens/motion';
import { radius, spacing, typography } from '@/theme';
import type { MainModuleKey } from '@/types/navigation/platform';

type ModuleNavSidebarProps = {
  mainModule: MainModuleKey;
  accentColor?: string;
};

type HoverProps = { onHoverIn?: () => void; onHoverOut?: () => void };
const HoverPressable = Pressable as unknown as ComponentType<PressableProps & HoverProps>;
const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : null;

function openExternal(url: string) {
  void Linking.openURL(url).catch(() => undefined);
}

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
  const hovered = useSharedValue(0);
  const bgRest = withAlpha(accent, 0);
  const bgActive = withAlpha(accent, isDark ? 0.2 : 0.12);
  const bgHover = withAlpha(accent, 0.1);
  const borderRest = withAlpha(accent, 0);
  const borderActive = withAlpha(accent, 0.45);
  const borderHover = withAlpha(accent, 0.22);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: 3 * hovered.value }],
    backgroundColor: active
      ? bgActive
      : interpolateColor(hovered.value, [0, 1], [bgRest, bgHover]),
    borderColor: active
      ? borderActive
      : interpolateColor(hovered.value, [0, 1], [borderRest, borderHover]),
  }));

  return (
    <HoverPressable
      onPress={onPress}
      onHoverIn={() => {
        hovered.value = withTiming(1, { duration: fxMotion.fast });
      }}
      onHoverOut={() => {
        hovered.value = withTiming(0, { duration: fxMotion.base });
      }}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={webCursor}
    >
      <Animated.View style={[navStyles.navItem, animStyle]}>
        {active ? <View style={[navStyles.navActiveBar, { backgroundColor: accent }]} /> : null}
        <Text style={navStyles.navIcon}>{icon}</Text>
        <Text
          style={[
            navStyles.navLabel,
            { color: isDark ? '#A9B2C7' : '#475569' },
            active && { color: isDark ? '#FFFFFF' : accent, fontWeight: '700' },
          ]}
        >
          {label}
        </Text>
        {badge != null ? (
          <View style={[navStyles.badge, { backgroundColor: withAlpha(accent, 0.25) }]}>
            <Text style={[navStyles.badgeText, { color: accent }]}>{badge}</Text>
          </View>
        ) : null}
      </Animated.View>
    </HoverPressable>
  );
}

/** Grouped module navigation — active module only, footer links at bottom. */
export function ModuleNavSidebar({ mainModule, accentColor }: ModuleNavSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { colors, isDark } = useLegacyTheme();
  const accent = accentColor ?? colors.violet;
  const config = getModuleNavConfig(mainModule);
  const activeKey = resolveActiveModuleNavKey(pathname, config);
  const styles = useMemo(() => createStyles(isDark, colors), [isDark, colors]);

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
                onPress={() => router.push(item.href as never)}
              />
            ))}
          </View>
        ))}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable onPress={() => openExternal(SUPPORT_LINKS.help)} style={styles.footerLink}>
          <Text style={styles.footerLinkText}>Hilfe</Text>
        </Pressable>
        <Pressable onPress={() => openExternal(SUPPORT_LINKS.privacy)} style={styles.footerLink}>
          <Text style={styles.footerLinkText}>Datenschutz</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/settings/data-request' as never)} style={styles.footerLink}>
          <Text style={styles.footerLinkText}>Betroffenenrechte</Text>
        </Pressable>
        <Pressable onPress={() => openExternal(SUPPORT_LINKS.imprint)} style={styles.footerLink}>
          <Text style={styles.footerLinkText}>Impressum</Text>
        </Pressable>
      </View>
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
  navIcon: { fontSize: 16, width: 24, textAlign: 'center' },
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

function createStyles(isDark: boolean, colors: ReturnType<typeof useLegacyTheme>['colors']) {
  const glassBorder = isDark ? glassFx.border : colors.borderSoft;

  return StyleSheet.create({
    root: {
      width: 248,
      backgroundColor: isDark ? 'rgba(18,22,43,0.32)' : colors.bgPremium,
      borderRightWidth: 1,
      borderRightColor: glassBorder,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
    },
    title: { ...typography.h3, color: colors.textPrimary, marginTop: spacing.md },
    subtitle: {
      ...typography.caption,
      color: colors.textMuted,
      marginBottom: spacing.md,
    },
    nav: { flex: 1 },
    navContent: { gap: spacing.md, paddingBottom: spacing.md },
    group: { gap: spacing.xs },
    groupTitle: {
      ...typography.caption,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      paddingHorizontal: spacing.sm,
      marginBottom: spacing.xs,
    },
    footer: {
      borderTopWidth: 1,
      borderTopColor: glassBorder,
      paddingTop: spacing.sm,
      gap: spacing.xs,
    },
    footerLink: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
    footerLinkText: { ...typography.caption, color: colors.textMuted },
  });
}
