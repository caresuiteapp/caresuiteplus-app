import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ShellTabConfig } from '@/types/navigation/shell';
import { resolveActiveTabKey } from '@/lib/navigation/shellConfig';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { colors, radius, spacing, typography } from '@/theme';

type AppTabBarProps = {
  tabs: ShellTabConfig[];
  accentColor?: string;
};

const SCROLLABLE_TAB_THRESHOLD = 4;

export function AppTabBar({ tabs, accentColor = colors.primary }: AppTabBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { isPhone } = useDeviceClass();
  const activeKey = resolveActiveTabKey(pathname, tabs);
  const scrollable = isPhone && tabs.length > SCROLLABLE_TAB_THRESHOLD;
  const bottomInset = Math.max(insets.bottom, spacing.sm);

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
    <View style={[styles.container, { paddingBottom: bottomInset }]}>
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
