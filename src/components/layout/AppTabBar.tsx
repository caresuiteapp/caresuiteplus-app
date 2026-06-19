import { Platform, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PortalMobileNav } from '@/components/layout/PortalMobileNav';
import { auroraGlass, useAuroraGlassActive } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import type { ShellTabConfig } from '@/types/navigation/shell';
import { resolveActiveTabKey } from '@/lib/navigation/shellConfig';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { colors, radius, spacing, typography } from '@/theme';

type AppTabBarProps = {
  tabs: ShellTabConfig[];
  accentColor?: string;
  /** Portal client — primary tabs + „Mehr“ overflow instead of horizontal scroll. */
  portalOverflowNav?: boolean;
};

const SCROLLABLE_TAB_THRESHOLD = 4;

const webGlassBlur =
  Platform.OS === 'web'
    ? ({
        backdropFilter: `blur(${auroraGlass.blur.medium}px)`,
        WebkitBackdropFilter: `blur(${auroraGlass.blur.medium}px)`,
      } as unknown as ViewStyle)
    : null;

export function AppTabBar({
  tabs,
  accentColor = colors.primary,
  portalOverflowNav = false,
}: AppTabBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { isPhone } = useDeviceClass();
  const auroraActive = useAuroraGlassActive();
  const activeKey = resolveActiveTabKey(pathname, tabs);
  const scrollable = isPhone && !portalOverflowNav && tabs.length > SCROLLABLE_TAB_THRESHOLD;
  const bottomInset = Math.max(insets.bottom, spacing.sm);

  if (isPhone && portalOverflowNav) {
    return <PortalMobileNav tabs={tabs} accentColor={accentColor} />;
  }

  const renderTab = (tab: ShellTabConfig) => {
    const active = tab.key === activeKey;
    return (
      <Pressable
        key={tab.key}
        onPress={() => router.push(tab.href as never)}
        style={({ pressed }) => [
          styles.tab,
          scrollable && styles.tabScrollable,
          active && { borderTopColor: accentColor },
          pressed && styles.tabPressed,
        ]}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityLabel={tab.label}
      >
        <Text style={[styles.icon, active && styles.iconActive]}>{tab.icon}</Text>
        <Text style={[styles.label, active && { color: accentColor }]} numberOfLines={1}>
          {tab.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      style={[
        styles.container,
        auroraActive && styles.containerGlass,
        auroraActive && webGlassBlur,
        { paddingBottom: bottomInset },
      ]}
    >
      {scrollable ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {tabs.map(renderTab)}
        </ScrollView>
      ) : (
        tabs.map(renderTab)
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.bgPremium,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    paddingTop: spacing.xs,
  },
  containerGlass: {
    backgroundColor: auroraGlass.panel,
    borderTopColor: auroraGlass.border,
  },
  scrollContent: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xs,
    gap: spacing.xs,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderTopWidth: 2,
    borderTopColor: 'transparent',
    borderRadius: radius.sm,
  },
  tabScrollable: {
    flex: 0,
    minWidth: 72,
    maxWidth: 96,
  },
  tabPressed: {
    opacity: 0.85,
  },
  icon: {
    fontSize: 18,
    marginBottom: 2,
    opacity: 0.7,
  },
  iconActive: {
    opacity: 1,
  },
  label: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
});
