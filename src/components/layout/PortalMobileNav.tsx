import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PortalMoreMenu } from '@/components/portal/PortalMoreMenu';
import { auroraGlass } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { splitPortalTabsForMobile } from '@/lib/navigation/portalMobileTabs';
import { resolveActiveTabKey } from '@/lib/navigation/shellConfig';
import type { ShellTabConfig } from '@/types/navigation/shell';

type PortalMobileNavProps = {
  tabs: ShellTabConfig[];
  accentColor?: string;
};

const MORE_TAB_KEY = 'portal-more';

const webGlassBlur =
  Platform.OS === 'web'
    ? ({
        backdropFilter: `blur(${auroraGlass.blur.medium}px)`,
        WebkitBackdropFilter: `blur(${auroraGlass.blur.medium}px)`,
      } as unknown as ViewStyle)
    : null;

/** Aurora glass bottom nav — max 4 primary tabs plus „Mehr“ overflow on phone. */
export function PortalMobileNav({ tabs, accentColor = '#FF9500' }: PortalMobileNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const activeKey = resolveActiveTabKey(pathname, tabs);
  const { primary, overflow } = useMemo(
    () => splitPortalTabsForMobile(tabs, activeKey),
    [tabs, activeKey],
  );
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = overflow.some((tab) => tab.key === activeKey);
  const bottomInset = Math.max(insets.bottom, careSpacing.sm);

  const renderTab = (tab: ShellTabConfig) => {
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
        <View style={[styles.pill, active && { backgroundColor: auroraGlass.chipActive }]}>
          <Text style={[styles.icon, active && styles.iconActive]}>{tab.icon}</Text>
          <Text
            style={[styles.label, active && { color: accentColor, fontWeight: '700' }]}
            numberOfLines={1}
          >
            {tab.label}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <>
      <View style={[styles.container, { paddingBottom: bottomInset }, webGlassBlur]}>
        {primary.map(renderTab)}
        {overflow.length > 0 ? (
          <Pressable
            key={MORE_TAB_KEY}
            onPress={() => setMoreOpen(true)}
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityState={{ selected: moreActive }}
            accessibilityLabel="Mehr"
          >
            <View style={[styles.pill, moreActive && { backgroundColor: auroraGlass.chipActive }]}>
              <Text style={[styles.icon, moreActive && styles.iconActive]}>⋯</Text>
              <Text
                style={[styles.label, moreActive && { color: accentColor, fontWeight: '700' }]}
                numberOfLines={1}
              >
                Mehr
              </Text>
            </View>
          </Pressable>
        ) : null}
      </View>

      {overflow.length > 0 ? (
        <PortalMoreMenu
          visible={moreOpen}
          tabs={overflow}
          activeKey={activeKey}
          accentColor={accentColor}
          onClose={() => setMoreOpen(false)}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: auroraGlass.panel,
    borderTopWidth: 1,
    borderTopColor: auroraGlass.border,
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
    color: auroraGlass.text.secondary,
    textAlign: 'center',
  },
});
