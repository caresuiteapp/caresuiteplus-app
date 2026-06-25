import { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SpaceKpiIcon } from '@/components/icons/space';
import {
  auroraGlass,
  lightLiquidGlass,
  lightLiquidGlassWebFx,
  useAuroraAdaptiveText,
  useAuroraGlassActive,
} from '@/design/tokens/auroraGlass';
import { useInteractiveTextColor } from '@/design/tokens/carelightadaptive';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { resolveCompactShellMobileTabs } from '@/lib/navigation/shellMobileTabs';
import { resolveActiveTabKey } from '@/lib/navigation/shellConfig';
import { webSafeAreaPadding } from '@/lib/platform/webSafeArea';
import type { AppShellArea } from '@/types/navigation/shell';
import type { ShellTabConfig } from '@/types/navigation/shell';

type PortalMobileNavProps = {
  tabs: ShellTabConfig[];
  accentColor?: string;
  /** When set, resolves area-specific 4+Mehr tab slots (business, office, assist, portal). */
  area?: AppShellArea;
};

/** Light frosted-glass bottom nav — five fixed tabs on phone (no horizontal scroll). */
export function PortalMobileNav({ tabs, accentColor = '#FF9500', area }: PortalMobileNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const text = useAuroraAdaptiveText();
  const auroraActive = useAuroraGlassActive();
  const { isLight } = useLegacyTheme();
  const useLightNav = auroraActive && isLight;
  const navSurface = useLightNav ? lightLiquidGlass.panel : auroraGlass.panel;
  const navBorder = useLightNav ? lightLiquidGlass.borderAccent : auroraGlass.border;
  const navGlassFx = useLightNav
    ? lightLiquidGlassWebFx(lightLiquidGlass.blur.light)
    : Platform.OS === 'web'
      ? ({
          backdropFilter: `blur(${auroraGlass.blur.medium}px)`,
          WebkitBackdropFilter: `blur(${auroraGlass.blur.medium}px)`,
        } as unknown as ViewStyle)
      : null;
  const activeChip = useLightNav ? lightLiquidGlass.chipActive : auroraGlass.chipActive;
  const labelDefault = useLightNav ? text.primary : text.secondary;
  const activeLabelColor = useInteractiveTextColor(accentColor);
  const mobileTabs = useMemo(() => resolveCompactShellMobileTabs(tabs, area), [tabs, area]);
  const activeKey = resolveActiveTabKey(pathname, mobileTabs);
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
        navGlassFx,
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
                  { color: labelDefault },
                  active && { color: activeLabelColor, fontWeight: '700' },
                ]}
                numberOfLines={1}
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
  },
  pill: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingVertical: careSpacing.xs,
    paddingHorizontal: careSpacing.xs,
    borderRadius: 999,
    minWidth: 56,
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
  },
});
