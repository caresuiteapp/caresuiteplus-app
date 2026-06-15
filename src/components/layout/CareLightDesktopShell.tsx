import { ReactNode } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppShellArea } from '@/types/navigation/shell';
import { useAppShell } from '@/hooks/useAppShell';
import { useAuth } from '@/lib/auth/context';
import { resolveActiveTabKey } from '@/lib/navigation/shellConfig';
import { SUPPORT_LINKS } from '@/lib/platform/supportLinks';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { ModuleSwitcher } from './ModuleSwitcher';

type CareLightDesktopShellProps = {
  area: AppShellArea;
  children: ReactNode;
  accentColor?: string;
  showModuleSwitcher?: boolean;
};

function openExternal(url: string) {
  void Linking.openURL(url).catch(() => undefined);
}

export function CareLightDesktopShell({
  area,
  children,
  accentColor = careLightColors.orange,
  showModuleSwitcher = true,
}: CareLightDesktopShellProps) {
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
                  style={[styles.navItem, active && { backgroundColor: `${accentColor}14` }]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={styles.navIcon}>{tab.icon}</Text>
                  <Text style={[styles.navLabel, active && { color: accentColor }]}>{tab.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.sidebarFooter}>
            {showModuleSwitcher ? (
              <Pressable onPress={openSwitcher} style={styles.footerBtn} accessibilityRole="button">
                <Text style={styles.footerBtnText}>🧩 Module wechseln</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => openExternal(SUPPORT_LINKS.help)}
              style={styles.footerBtn}
              accessibilityRole="link"
            >
              <Text style={styles.footerBtnText}>❓ Hilfe</Text>
            </Pressable>
            <Pressable onPress={() => void signOut()} style={styles.footerBtn} accessibilityRole="button">
              <Text style={styles.footerBtnText}>Abmelden</Text>
            </Pressable>
          </View>
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
  sidebar: {
    width: 240,
    backgroundColor: careLightColors.surface,
    borderRightWidth: 1,
    borderRightColor: careLightColors.border,
    paddingTop: careSpacing.md,
  },
  brand: {
    ...careTypography.h3,
    color: careLightColors.navy,
    fontWeight: '800',
    paddingHorizontal: careSpacing.md,
  },
  areaLabel: {
    ...careTypography.caption,
    color: careLightColors.muted,
    paddingHorizontal: careSpacing.md,
    marginBottom: careSpacing.sm,
    textTransform: 'capitalize',
  },
  nav: {
    flex: 1,
  },
  navContent: {
    paddingHorizontal: careSpacing.sm,
    gap: careSpacing.xs,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: careSpacing.sm,
    paddingVertical: careSpacing.sm,
    paddingHorizontal: careSpacing.sm,
    borderRadius: careRadius.md,
  },
  navIcon: {
    fontSize: 18,
  },
  navLabel: {
    ...careTypography.body,
    color: careLightColors.navy,
    fontWeight: '600',
  },
  sidebarFooter: {
    borderTopWidth: 1,
    borderTopColor: careLightColors.border,
    padding: careSpacing.sm,
    gap: careSpacing.xs,
  },
  footerBtn: {
    paddingVertical: careSpacing.xs,
    paddingHorizontal: careSpacing.sm,
  },
  footerBtnText: {
    ...careTypography.caption,
    color: careLightColors.muted,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
});
