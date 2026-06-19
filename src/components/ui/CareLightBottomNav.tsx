import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ShellTabConfig } from '@/types/navigation/shell';
import { resolveActiveTabKey } from '@/lib/navigation/shellConfig';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';

type CareLightBottomNavProps = {
  tabs: ShellTabConfig[];
  accentColor?: string;
};

const SCROLLABLE_TAB_THRESHOLD = 4;

/** Light premium bottom navigation — navy text, active pill in module color. */
export function CareLightBottomNav({ tabs, accentColor = careLightColors.green }: CareLightBottomNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { isPhone } = useDeviceClass();
  const activeKey = resolveActiveTabKey(pathname, tabs);
  const scrollable = isPhone && tabs.length > SCROLLABLE_TAB_THRESHOLD;
  const bottomInset = Math.max(insets.bottom, careSpacing.sm);

  const renderTab = (tab: ShellTabConfig) => {
    const active = tab.key === activeKey;
    return (
      <Pressable
        key={tab.key}
        onPress={() => router.push(tab.href as never)}
        style={[styles.tab, scrollable && styles.tabScrollable]}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityLabel={tab.label}
      >
        <View style={[styles.pill, active && { backgroundColor: `${accentColor}18` }]}>
          <Text style={styles.icon}>{tab.icon}</Text>
          <Text style={[styles.label, active && { color: accentColor, fontWeight: '700' }]} numberOfLines={1}>
            {tab.label}
          </Text>
        </View>
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
    backgroundColor: careLightColors.surface,
    borderTopWidth: 1,
    borderTopColor: careLightColors.border,
    paddingTop: careSpacing.xs,
    paddingHorizontal: careSpacing.xs,
  },
  scrollContent: {
    flexDirection: 'row',
    gap: careSpacing.xs,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
  },
  tabScrollable: {
    flex: 0,
    minWidth: 72,
  },
  pill: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingVertical: careSpacing.xs,
    paddingHorizontal: careSpacing.sm,
    borderRadius: careRadius.capsule,
    minWidth: 64,
  },
  icon: {
    fontSize: 18,
    marginBottom: 2,
  },
  label: {
    ...careTypography.caption,
    fontSize: 10,
    fontWeight: '600',
    color: careLightColors.navy,
    textAlign: 'center',
  },
});
