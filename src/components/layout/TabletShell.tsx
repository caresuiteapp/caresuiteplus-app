import { ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppShellArea } from '@/types/navigation/shell';
import { useAppShell } from '@/hooks/useAppShell';
import { resolveActiveTabKey } from '@/lib/navigation/shellConfig';
import { SUPPORT_LINKS } from '@/lib/platform/supportLinks';
import { colors, radius, spacing, typography } from '@/theme';
import { ModuleSwitcher } from './ModuleSwitcher';
import { TenantSettingsNavLink } from './TenantSettingsNavLink';

type TabletShellProps = {
  area: AppShellArea;
  children: ReactNode;
  accentColor?: string;
  showModuleSwitcher?: boolean;
};

function openExternal(url: string) {
  void Linking.openURL(url).catch(() => undefined);
}

/**
 * Tablet shell: compact side rail + content. No bottom tab bar.
 */
export function TabletShell({
  area,
  children,
  accentColor = colors.primary,
  showModuleSwitcher = true,
}: TabletShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { tabs, switcherOpen, openSwitcher, closeSwitcher } = useAppShell(area);
  const activeKey = resolveActiveTabKey(pathname, tabs);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.body}>
        <View style={[styles.rail, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
          {tabs.map((tab) => {
            const active = tab.key === activeKey;
            return (
              <Pressable
                key={tab.key}
                onPress={() => router.push(tab.href as never)}
                style={[styles.railItem, active && { borderLeftColor: accentColor }]}
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
          <TenantSettingsNavLink variant="rail" />
          <Pressable
            onPress={() => openExternal(SUPPORT_LINKS.help)}
            style={styles.railItem}
            accessibilityRole="link"
            accessibilityLabel="Hilfe"
          >
            <Text style={styles.railIcon}>❓</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/settings/data-request' as never)}
            style={styles.railItem}
            accessibilityRole="button"
            accessibilityLabel="Betroffenenrechte"
          >
            <Text style={styles.railIcon}>🛡️</Text>
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
    backgroundColor: colors.bgBase,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
  },
  rail: {
    width: 72,
    backgroundColor: colors.bgPremium,
    borderRightWidth: 1,
    borderRightColor: colors.borderSoft,
    alignItems: 'center',
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  railItem: {
    width: 56,
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
    borderRadius: radius.sm,
  },
  railIcon: {
    fontSize: 20,
  },
  railLabel: {
    ...typography.caption,
    fontSize: 9,
    textAlign: 'center',
    color: colors.textMuted,
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
