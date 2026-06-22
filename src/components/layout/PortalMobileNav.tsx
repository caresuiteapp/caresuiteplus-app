import { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auroraGlass, lightLiquidGlass, lightLiquidGlassWebFx, useAuroraGlassActive } from '@/design/tokens/auroraGlass';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { resolveFixedMobilePortalTabs } from '@/lib/navigation/portalMobileTabs';
import { resolveActiveTabKey } from '@/lib/navigation/shellConfig';
import type { ShellTabConfig } from '@/types/navigation/shell';

type PortalMobileNavProps = {
  tabs: ShellTabConfig[];
  accentColor?: string;
};

const webGlassBlur =
  Platform.OS === 'web'
    ? ({
        backdropFilter: `blur(${auroraGlass.blur.medium}px)`,
        WebkitBackdropFilter: `blur(${auroraGlass.blur.medium}px)`,
      } as unknown as ViewStyle)
    : null;

/** Aurora glass bottom nav — five fixed tabs on phone (no overflow). */
export function PortalMobileNav({ tabs, accentColor = '#FF9500' }: PortalMobileNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const auroraActive = useAuroraGlassActive();
  const { isLight } = useLegacyTheme();
  const useLightNav = auroraActive && isLight;
  const navSurface = useLightNav ? lightLiquidGlass.panel : auroraGlass.panel;
  const navBorder = useLightNav ? lightLiquidGlass.borderAccent : auroraGlass.border;
  const navGlassFx = useLightNav ? lightLiquidGlassWebFx(lightLiquidGlass.blur.light) : webGlassBlur;
  const activeChip = useLightNav ? lightLiquidGlass.chipActive : auroraGlass.chipActive;
  const labelMuted = useLightNav ? lightLiquidGlass.text.secondary : auroraGlass.text.secondary;
  const mobileTabs = useMemo(() => resolveFixedMobilePortalTabs(tabs), [tabs]);
  const activeKey = resolveActiveTabKey(pathname, mobileTabs);
  const bottomInset = Math.max(insets.bottom, careSpacing.sm);

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: bottomInset, backgroundColor: navSurface, borderTopColor: navBorder },
        navGlassFx,
      ]}
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
              <Text style={[styles.icon, active && styles.iconActive]}>{tab.icon}</Text>
              <Text
                style={[
                  styles.label,
                  { color: labelMuted },
                  active && { color: accentColor, fontWeight: '700' },
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
  },
  pressed: {
    opacity: 0.88,
  },
  icon: {
    fontSize: 18,
    marginBottom: 2,
    opacity: 0.75,
  },
  iconActive: {
    opacity: 1,
  },
  label: {
    ...careTypography.caption,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
});
