import { ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppShellArea } from '@/types/navigation/shell';
import { useAppShell } from '@/hooks/useAppShell';
import { resolveActiveTabKey } from '@/lib/navigation/shellConfig';
import { SUPPORT_LINKS } from '@/lib/platform/supportLinks';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { ModuleSwitcher } from './ModuleSwitcher';

type CareLightTabletShellProps = {
  area: AppShellArea;
  children: ReactNode;
  accentColor?: string;
  showModuleSwitcher?: boolean;
};

function openExternal(url: string) {
  void Linking.openURL(url).catch(() => undefined);
}

export function CareLightTabletShell({
  area,
  children,
  accentColor = careLightColors.green,
  showModuleSwitcher = true,
}: CareLightTabletShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { tabs, switcherOpen, openSwitcher, closeSwitcher } = useAppShell(area);
  const activeKey = resolveActiveTabKey(pathname, tabs);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.body}>
        <View style={[styles.rail, { paddingBottom: Math.max(insets.bottom, careSpacing.sm) }]}>
          {tabs.map((tab) => {
            const active = tab.key === activeKey;
            return (
              <Pressable
                key={tab.key}
                onPress={() => router.push(tab.href as never)}
                style={[styles.railItem, active && { backgroundColor: `${accentColor}14` }]}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={tab.label}
              >
                <Text style={styles.railIcon}>{tab.icon}</Text>
                <Text style={[styles.railLabel, active && { color: accentColor }]} numberOfLines={2}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
          <View style={styles.railSpacer} />
          {showModuleSwitcher ? (
            <Pressable onPress={openSwitcher} style={styles.railItem} accessibilityRole="button">
              <Text style={styles.railIcon}>🧩</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => openExternal(SUPPORT_LINKS.help)}
            style={styles.railItem}
            accessibilityRole="link"
          >
            <Text style={styles.railIcon}>❓</Text>
          </Pressable>
        </View>
        <View style={styles.content}>{children}</View>
      </View>
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
  body: {
    flex: 1,
    flexDirection: 'row',
  },
  rail: {
    width: 72,
    backgroundColor: careLightColors.surface,
    borderRightWidth: 1,
    borderRightColor: careLightColors.border,
    alignItems: 'center',
    paddingTop: careSpacing.sm,
    gap: careSpacing.xs,
  },
  railItem: {
    width: 56,
    alignItems: 'center',
    paddingVertical: careSpacing.xs,
    borderRadius: careRadius.sm,
  },
  railIcon: {
    fontSize: 20,
  },
  railLabel: {
    ...careTypography.caption,
    fontSize: 9,
    textAlign: 'center',
    color: careLightColors.navy,
    marginTop: 2,
  },
  railSpacer: {
    flex: 1,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
});
