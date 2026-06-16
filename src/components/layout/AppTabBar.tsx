import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ShellTabConfig } from '@/types/navigation/shell';
import { resolveActiveTabKey } from '@/lib/navigation/shellConfig';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { radius, spacing } from '@/theme';

type AppTabBarProps = {
  tabs: ShellTabConfig[];
  accentColor?: string;
};

export function AppTabBar({ tabs, accentColor }: AppTabBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { colors, typography } = useLegacyTheme();
  const activeKey = resolveActiveTabKey(pathname, tabs);
  const accent = accentColor ?? colors.primary;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flexDirection: 'row',
          backgroundColor: colors.bgPremium,
          borderTopWidth: 1,
          borderTopColor: colors.borderSoft,
          paddingTop: spacing.xs,
        },
        tab: {
          flex: 1,
          alignItems: 'center',
          paddingVertical: spacing.xs,
          borderTopWidth: 2,
          borderTopColor: 'transparent',
          borderRadius: radius.sm,
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
        },
      }),
    [colors.bgPremium, colors.borderSoft, typography.caption],
  );

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      {tabs.map((tab) => {
        const active = tab.key === activeKey;
        return (
          <Pressable
            key={tab.key}
            onPress={() => router.push(tab.href as never)}
            style={({ pressed }) => [
              styles.tab,
              active && { borderTopColor: accent },
              pressed && styles.tabPressed,
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.label}
          >
            <Text style={[styles.icon, active && styles.iconActive]}>{tab.icon}</Text>
            <Text style={[styles.label, active && { color: accent }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
