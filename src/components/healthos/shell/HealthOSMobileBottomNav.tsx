import { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import type { ShellTabConfig } from '@/types/navigation/shell';
import { MOBILE_MIN_TOUCH_TARGET, webSafeAreaPadding } from '@/lib/platform/webSafeArea';
import { healthosShellLayoutRules } from './healthosShellLayoutRules';

type Props = {
  tabs: ShellTabConfig[];
  accentColor?: string;
  testID?: string;
};

/**
 * HealthOS mobile bottom navigation — config-driven, no portal/office domain logic.
 */
export function HealthOSMobileBottomNav({
  tabs,
  accentColor = '#007AFF',
  testID = 'healthos-mobile-bottom-nav',
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flexDirection: 'row',
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: 'rgba(0,0,0,0.1)',
          backgroundColor: 'rgba(255,255,255,0.95)',
          paddingTop: careSpacing.xs,
          zIndex: healthosShellLayoutRules.zIndex.bottomNav,
          ...(Platform.OS === 'web'
            ? ({
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
              } as unknown as ViewStyle)
            : null),
        },
        tab: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: MOBILE_MIN_TOUCH_TARGET,
          paddingVertical: careSpacing.xs,
          gap: 2,
        },
        icon: { fontSize: 20 },
        label: { ...careTypography.caption, fontSize: 11 },
        labelActive: { color: accentColor, fontWeight: '700' },
        labelInactive: { opacity: 0.65 },
      }),
    [accentColor],
  );

  const bottomInset = Math.max(insets.bottom, careSpacing.sm);

  return (
    <View
      style={[
        styles.container,
        Platform.OS === 'web'
          ? (webSafeAreaPadding('bottom', bottomInset) as ViewStyle)
          : { paddingBottom: bottomInset },
      ]}
      testID={testID}
    >
      {tabs.map((tab) => {
        const basePath = tab.href.split('?')[0];
        const active = pathname === basePath || pathname.startsWith(`${basePath}/`);
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => router.push(tab.href as never)}
            style={styles.tab}
            testID={`healthos-bottom-tab-${tab.key}`}
          >
            <Text style={styles.icon}>{tab.icon}</Text>
            <Text style={[styles.label, active ? styles.labelActive : styles.labelInactive]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
