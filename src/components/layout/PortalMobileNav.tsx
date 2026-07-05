import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SpaceKpiIcon } from '@/components/icons/space';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { useInteractiveTextColor } from '@/design/tokens/carelightadaptive';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { resolveCompactShellMobileTabs } from '@/lib/navigation/shellMobileTabs';
import { resolveActiveTabKey } from '@/lib/navigation/shellConfig';
import { MOBILE_MIN_TOUCH_TARGET, webSafeAreaPadding } from '@/lib/platform/webSafeArea';
import type { AppShellArea } from '@/types/navigation/shell';
import type { ShellTabConfig } from '@/types/navigation/shell';

type PortalMobileNavProps = {
  tabs: ShellTabConfig[];
  accentColor?: string;
  /** When set, resolves area-specific 4+Mehr tab slots (business, office, assist, portal). */
  area?: AppShellArea;
};

/** Opaque bottom nav — five fixed tabs on phone (no horizontal scroll). */
export function PortalMobileNav({ tabs, accentColor = '#FF9500', area }: PortalMobileNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const text = useAuroraAdaptiveText();
  const navSurface = careLightColors.surface;
  const navBorder = careLightColors.borderStrong;
  const activeChip = 'rgba(14, 165, 233, 0.14)';
  const labelDefault = text.primary;
  const activeLabelColor = useInteractiveTextColor(accentColor);
  const mobileTabs = useMemo(() => resolveCompactShellMobileTabs(tabs, area), [tabs, area]);
  const activeKey = resolveActiveTabKey(pathname, mobileTabs);
  const compactLabels = mobileTabs.length >= 5;
  const bottomInset = Math.max(insets.bottom, careSpacing.sm);
  const iconSize = 22;

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: webSafeAreaPadding('bottom', bottomInset),
          backgroundColor: navSurface,
          borderTopColor: navBorder,
        } as ViewStyle,
      ]}
      testID="compact-mobile-nav"
    >
      {mobileTabs.map((tab) => {
        const active = tab.key === activeKey;
        return (
          <Pressable
            key={tab.key}
            onPress={() => router.push(tab.href as never)}
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.label}
          >
            <View style={[styles.pill, active && { backgroundColor: activeChip }]}>
              <SpaceKpiIcon
                icon={tab.icon}
                accentColor={active ? accentColor : labelDefault}
                size={iconSize}
                active={active}
                frame="rail"
              />
              <Text
                style={[
                  styles.label,
                  compactLabels && styles.labelCompact,
                  { color: labelDefault },
                  active && { color: activeLabelColor, fontWeight: '700' },
                ]}
                numberOfLines={compactLabels ? 2 : 1}
                adjustsFontSizeToFit={compactLabels}
                minimumFontScale={0.85}
              >
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
    borderTopWidth: 1,
    paddingTop: careSpacing.xs,
    paddingHorizontal: careSpacing.xs,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    minHeight: MOBILE_MIN_TOUCH_TARGET,
  },
  pill: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: MOBILE_MIN_TOUCH_TARGET,
    paddingVertical: careSpacing.xs,
    paddingHorizontal: 2,
    borderRadius: 999,
    minWidth: 48,
    maxWidth: '100%',
    gap: 2,
  },
  pressed: {
    opacity: 0.88,
  },
  label: {
    ...careTypography.caption,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 12,
  },
  labelCompact: {
    fontSize: 9,
    lineHeight: 11,
  },
});
