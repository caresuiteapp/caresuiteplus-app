import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { AppShellArea } from '@/types/navigation/shell';
import { useAppShell } from '@/hooks/useAppShell';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { radius, spacing, typography } from '@/theme';
import { AppTabBar } from './AppTabBar';
import { ModuleSwitcher } from './ModuleSwitcher';

type MobileShellProps = {
  area: AppShellArea;
  children: ReactNode;
  accentColor?: string;
  showModuleSwitcher?: boolean;
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
}: MobileShellProps) {
  const { tabs, switcherOpen, openSwitcher, closeSwitcher } = useAppShell(area);
  const { colors } = useLegacyTheme();

  return (
    <View style={styles.root}>
      <View style={styles.content}>{children}</View>
      {showModuleSwitcher ? (
        <Pressable
          onPress={openSwitcher}
          style={[
            styles.switcherFab,
            { backgroundColor: colors.bgPremium, borderColor: colors.borderSoft },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Module wechseln"
        >
          <Text style={[styles.switcherFabText, { color: colors.cyan }]}>🧩 Module</Text>
        </Pressable>
      ) : null}
      <AppTabBar tabs={tabs} accentColor={accentColor ?? colors.primary} />
      {showModuleSwitcher ? (
        <ModuleSwitcher visible={switcherOpen} onClose={closeSwitcher} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
  switcherFab: {
    position: 'absolute',
    right: spacing.md,
    bottom: 72,
    borderWidth: 1,
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
