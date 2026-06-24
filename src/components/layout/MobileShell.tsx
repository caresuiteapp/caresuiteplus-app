import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { AppShellArea } from '@/types/navigation/shell';
import { useAppShell } from '@/hooks/useAppShell';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { useInteractiveTextColor } from '@/design/tokens/carelightadaptive';
import { colors, radius, spacing, typography } from '@/theme';
import { AppTabBar } from './AppTabBar';
import { ModuleSwitcher } from './ModuleSwitcher';
import type { ShellTabConfig } from '@/types/navigation/shell';

type MobileShellProps = {
  area: AppShellArea;
  children: ReactNode;
  accentColor?: string;
  showModuleSwitcher?: boolean;
  tabsOverride?: ShellTabConfig[];
};

/**
 * Mobile shell: bottom tab bar + optional module switcher FAB.
 */
export function MobileShell({
  area,
  children,
  accentColor,
  showModuleSwitcher =
    area === 'office' ||
    area === 'business' ||
    area === 'assist' ||
    area === 'pflege' ||
    area === 'beratung' ||
    area === 'akademie' ||
    area === 'stationaer',
  tabsOverride,
}: MobileShellProps) {
  const { colors } = useLegacyTheme();
  const linkColor = useInteractiveTextColor();
  const { tabs, switcherOpen, openSwitcher, closeSwitcher } = useAppShell(area);
  const effectiveTabs = tabsOverride?.length ? tabsOverride : tabs;

  return (
    <View style={styles.root}>
      <View style={styles.content}>{children}</View>
      {showModuleSwitcher ? (
        <Pressable
          onPress={openSwitcher}
          style={styles.switcherFab}
          accessibilityRole="button"
          accessibilityLabel="Module wechseln"
        >
          <Text style={[styles.switcherFabText, { color: linkColor }]}>🧩 Module</Text>
        </Pressable>
      ) : null}
      <AppTabBar
        tabs={effectiveTabs}
        accentColor={accentColor}
        area={area}
      />
      {showModuleSwitcher ? (
        <ModuleSwitcher visible={switcherOpen} onClose={closeSwitcher} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  content: { flex: 1, backgroundColor: 'transparent' },
  switcherFab: {
    position: 'absolute',
    right: spacing.md,
    bottom: 72,
    backgroundColor: colors.bgPremium,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.capsule,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  switcherFabText: {
    ...typography.caption,
    fontWeight: '700',
  },
});
