import { ReactNode } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppShellArea } from '@/types/navigation/shell';
import { useAppShell } from '@/hooks/useAppShell';
import { useAuth } from '@/lib/auth/context';
import { resolveActiveTabKey } from '@/lib/navigation/shellConfig';
import { SUPPORT_LINKS } from '@/lib/platform/supportLinks';
import { colors, radius, spacing, typography } from '@/theme';
import { ModuleSwitcher } from './ModuleSwitcher';
import { TenantSettingsNavLink } from './TenantSettingsNavLink';

type DesktopShellProps = {
  area: AppShellArea;
  children: ReactNode;
  accentColor?: string;
  showModuleSwitcher?: boolean;
};

function openExternal(url: string) {
  void Linking.openURL(url).catch(() => undefined);
}

/**
 * Desktop shell: persistent side navigation — no bottom tabs.
 */
export function DesktopShell({
  area,
  children,
  accentColor = colors.primary,
  showModuleSwitcher = true,
}: DesktopShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { tabs, switcherOpen, openSwitcher, closeSwitcher } = useAppShell(area);
  const { signOut } = useAuth();
  const activeKey = resolveActiveTabKey(pathname, tabs);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.body}>
        <View style={styles.sidebar}>
          <Text style={styles.brand}>CareSuite+</Text>
          <Text style={styles.areaLabel}>{area}</Text>
          <ScrollView style={styles.nav} contentContainerStyle={styles.navContent}>
            {tabs.map((tab) => {
              const active = tab.key === activeKey;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => router.push(tab.href as never)}
                  style={[styles.navItem, active && { backgroundColor: colors.bgElevated }]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={tab.label}
                >
                  <Text style={styles.navIcon}>{tab.icon}</Text>
                  <Text style={[styles.navLabel, active && { color: accentColor }]}>
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.footer}>
            {showModuleSwitcher ? (
              <Pressable onPress={openSwitcher} style={styles.footerLink} accessibilityRole="button">
                <Text style={styles.footerLinkText}>🧩 Module wechseln</Text>
              </Pressable>
            ) : null}
            <TenantSettingsNavLink />
            <Pressable
              onPress={() => openExternal(SUPPORT_LINKS.help)}
              style={styles.footerLink}
              accessibilityRole="link"
            >
              <Text style={styles.footerLinkText}>Hilfe</Text>
            </Pressable>
            <Pressable
              onPress={() => openExternal(SUPPORT_LINKS.privacy)}
              style={styles.footerLink}
              accessibilityRole="link"
            >
              <Text style={styles.footerLinkText}>Datenschutz</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/settings/data-request' as never)}
              style={styles.footerLink}
              accessibilityRole="button"
            >
              <Text style={styles.footerLinkText}>Betroffenenrechte</Text>
            </Pressable>
            <Pressable
              onPress={() => openExternal(SUPPORT_LINKS.imprint)}
              style={styles.footerLink}
              accessibilityRole="link"
            >
              <Text style={styles.footerLinkText}>Impressum</Text>
            </Pressable>
            <Pressable
              onPress={() => signOut().then(() => router.replace('/' as never))}
              style={styles.footerLink}
              accessibilityRole="button"
            >
              <Text style={[styles.footerLinkText, styles.logout]}>Abmelden</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.main}>{children}</View>
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
  sidebar: {
    width: 240,
    backgroundColor: colors.bgPremium,
    borderRightWidth: 1,
    borderRightColor: colors.borderSoft,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  brand: {
    ...typography.h3,
    color: colors.orange,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  areaLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'capitalize',
    marginBottom: spacing.md,
  },
  nav: {
    flex: 1,
  },
  navContent: {
    gap: spacing.xs,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  navIcon: {
    fontSize: 16,
    width: 24,
    textAlign: 'center',
  },
  navLabel: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  footerLink: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  footerLinkText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  logout: {
    color: colors.orange,
    fontWeight: '600',
  },
});
