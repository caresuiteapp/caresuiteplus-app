import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PortalMobileNav } from '@/components/layout/PortalMobileNav';
import {
  auroraGlass,
  lightLiquidGlass,
  lightLiquidGlassWebFx,
  useAuroraAdaptiveText,
  useAuroraGlassActive,
} from '@/design/tokens/auroraGlass';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import type { AppShellArea, ShellTabConfig } from '@/types/navigation/shell';
import { resolveActiveTabKey } from '@/lib/navigation/shellConfig';
import { shouldUseCompactMobileNav } from '@/lib/navigation/shellMobileTabs';
import { webSafeAreaPadding } from '@/lib/platform/webSafeArea';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { colors, radius, spacing, typography } from '@/theme';

type AppTabBarProps = {
  tabs: ShellTabConfig[];
  accentColor?: string;
  /** Shell area — enables 4+Mehr compact nav on phone for business/office/assist/portal. */
  area?: AppShellArea;
  /** @deprecated Use `area` — kept for legacy MobileShell portal_client routing. */
  portalOverflowNav?: boolean;
};

export function AppTabBar({
  tabs,
  accentColor = colors.primary,
  area,
  portalOverflowNav = false,
}: AppTabBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { isPhone } = useDeviceClass();
  const text = useAuroraAdaptiveText();
  const auroraActive = useAuroraGlassActive();
  const { isLight } = useLegacyTheme();
  const useLightNav = auroraActive && isLight && isPhone;
  const effectiveArea = area ?? (portalOverflowNav ? 'portal_client' : undefined);
  const useCompactNav = shouldUseCompactMobileNav(tabs.length, isPhone);
  const activeKey = resolveActiveTabKey(pathname, tabs);
  const bottomInset = Math.max(insets.bottom, spacing.sm);

  if (isPhone && useCompactNav) {
    return <PortalMobileNav tabs={tabs} accentColor={accentColor} area={effectiveArea} />;
  }

  const navGlassFx = useLightNav
    ? lightLiquidGlassWebFx(lightLiquidGlass.blur.light)
    : Platform.OS === 'web'
      ? ({
          backdropFilter: `blur(${auroraGlass.blur.medium}px)`,
          WebkitBackdropFilter: `blur(${auroraGlass.blur.medium}px)`,
        } as unknown as ViewStyle)
      : null;

  const renderTab = (tab: ShellTabConfig) => {
    const active = tab.key === activeKey;
    return (
      <Pressable
        key={tab.key}
        onPress={() => router.push(tab.href as never)}
        style={({ pressed }) => [
          styles.tab,
          active && { borderTopColor: accentColor },
          pressed && styles.tabPressed,
        ]}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityLabel={tab.label}
      >
        <Text style={[styles.icon, active && styles.iconActive]}>{tab.icon}</Text>
        <Text
          style={[
            styles.label,
            { color: useLightNav ? text.primary : undefined },
            active && { color: accentColor },
          ]}
          numberOfLines={1}
        >
          {tab.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      style={[
        styles.container,
        useLightNav
          ? {
              backgroundColor: lightLiquidGlass.panel,
              borderTopColor: lightLiquidGlass.borderAccent,
            }
          : auroraActive && styles.containerGlass,
        navGlassFx,
        { paddingBottom: webSafeAreaPadding('bottom', bottomInset) },
      ]}
    >
      {tabs.map(renderTab)}
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
