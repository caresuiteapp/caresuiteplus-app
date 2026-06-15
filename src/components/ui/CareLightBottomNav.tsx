import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ShellTabConfig } from '@/types/navigation/shell';
import { resolveActiveTabKey } from '@/lib/navigation/shellConfig';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';

type CareLightBottomNavProps = {
  tabs: ShellTabConfig[];
  accentColor?: string;
};

/** Light premium bottom navigation — navy text, active pill in module color. */
export function CareLightBottomNav({ tabs, accentColor = careLightColors.green }: CareLightBottomNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const activeKey = resolveActiveTabKey(pathname, tabs);

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, careSpacing.sm) }]}>
      {tabs.map((tab) => {
        const active = tab.key === activeKey;
        return (
          <Pressable
            key={tab.key}
            onPress={() => router.push(tab.href as never)}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.label}
          >
            <View style={[styles.pill, active && { backgroundColor: `${accentColor}18` }]}>
              <Text style={styles.icon}>{tab.icon}</Text>
              <Text style={[styles.label, active && { color: accentColor, fontWeight: '700' }]}>
                {tab.label}
              </Text>
            </View>
          </Pressable>
        );
      })}
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
  tab: {
    flex: 1,
    alignItems: 'center',
  },
  pill: {
    alignItems: 'center',
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
  },
});
