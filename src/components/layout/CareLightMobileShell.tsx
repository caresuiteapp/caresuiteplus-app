import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { AppShellArea } from '@/types/navigation/shell';
import { useAppShell } from '@/hooks/useAppShell';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { CareLightBottomNav } from '@/components/ui/CareLightBottomNav';
import { ModuleSwitcher } from './ModuleSwitcher';

type CareLightMobileShellProps = {
  area: AppShellArea;
  children: ReactNode;
  accentColor?: string;
  showModuleSwitcher?: boolean;
};

export function CareLightMobileShell({
  area,
  children,
  accentColor = careLightColors.green,
  showModuleSwitcher = true,
}: CareLightMobileShellProps) {
  const { tabs, switcherOpen, openSwitcher, closeSwitcher } = useAppShell(area);

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
          <Text style={styles.switcherFabText}>🧩 Module</Text>
        </Pressable>
      ) : null}
      <CareLightBottomNav tabs={tabs} accentColor={accentColor} />
      {showModuleSwitcher ? (
        <ModuleSwitcher visible={switcherOpen} onClose={closeSwitcher} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: careLightColors.page,
  },
  content: {
    flex: 1,
  },
  switcherFab: {
    position: 'absolute',
    right: careSpacing.md,
    bottom: 80,
    backgroundColor: careLightColors.surface,
    borderWidth: 1,
    borderColor: careLightColors.border,
    borderRadius: careRadius.capsule,
    paddingHorizontal: careSpacing.md,
    paddingVertical: careSpacing.xs,
    shadowColor: careLightColors.navy,
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  switcherFabText: {
    ...careTypography.caption,
    fontWeight: '700',
    color: careLightColors.cyan,
  },
});
