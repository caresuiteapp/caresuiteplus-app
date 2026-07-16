import { ReactNode, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { PLATFORM_CONSOLE_TITLE, PLATFORM_NAV_ITEMS } from '@/lib/platformConsole/platformNavigation';
import { getPlatformReleaseInfo, platformRoleHasCapability, PLATFORM_ROLE_LABELS } from '@/lib/platformConsole';
import { usePlatformAuth } from '@/lib/platformConsole/PlatformAuthProvider';
import { spacing } from '@/theme';
import { DesktopSidebarToggle } from '@/components/layout/DesktopSidebarToggle';
import { useDesktopWorkspacePreferences } from '@/hooks/useDesktopWorkspacePreferences';
import { PlatformErrorBoundary } from './PlatformErrorBoundary';
import { PlatformGlobalSearch } from './PlatformGlobalSearch';
import { PLATFORM_COLORS } from './PlatformColors';

type PlatformShellLayoutProps = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
};

function filterNavByRole(role: Parameters<typeof platformRoleHasCapability>[0]) {
  return PLATFORM_NAV_ITEMS.filter((item) => {
    if (!item.capability) return true;
    return platformRoleHasCapability(role, item.capability);
  });
}

export function PlatformShellLayout({ children, title, subtitle }: PlatformShellLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const { platformUser } = usePlatformAuth();
  const isWide = width >= 960;
  const { leftCollapsed, toggleLeft } = useDesktopWorkspacePreferences();
  const [closedGroups, setClosedGroups] = useState<string[]>([]);
  const environment = getPlatformReleaseInfo().environment;

  const navItems = useMemo(
    () => filterNavByRole(platformUser?.role),
    [platformUser?.role],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, flexDirection: isWide ? 'row' : 'column', backgroundColor: PLATFORM_COLORS.bg },
        sidebar: {
          width: isWide ? 248 : undefined,
          backgroundColor: PLATFORM_COLORS.sidebar,
          borderRightWidth: isWide ? 1 : 0,
          borderBottomWidth: isWide ? 0 : 1,
          borderColor: PLATFORM_COLORS.border,
          paddingVertical: spacing.md,
        },
        brand: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: 3 },
        brandTitle: { color: PLATFORM_COLORS.text, fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
        brandSub: { color: PLATFORM_COLORS.muted, fontSize: 11 },
        navScroll: { flexGrow: 0 },
        navItem: {
          marginHorizontal: isWide ? spacing.sm : 0,
          paddingHorizontal: spacing.sm,
          paddingVertical: 11,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          borderRadius: 10,
        },
        navItemActive: { backgroundColor: PLATFORM_COLORS.accentSoft },
        navGroup: { marginTop: spacing.sm },
        navGroupHeader: { marginHorizontal: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: 7, flexDirection: 'row', justifyContent: 'space-between' },
        navGroupLabel: { color: PLATFORM_COLORS.muted, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.7 },
        navIcon: { color: PLATFORM_COLORS.accent, width: 18, textAlign: 'center' },
        navLabel: { color: PLATFORM_COLORS.text, fontSize: 14 },
        navLabelActive: { color: PLATFORM_COLORS.text, fontWeight: '600' },
        userBox: {
          marginTop: spacing.sm,
          marginHorizontal: spacing.md,
          padding: spacing.sm,
          borderRadius: 8,
          backgroundColor: PLATFORM_COLORS.panel,
          borderWidth: 1,
          borderColor: PLATFORM_COLORS.border,
        },
        userRole: { color: PLATFORM_COLORS.accent, fontSize: 11, fontWeight: '600' },
        userEmail: { color: PLATFORM_COLORS.muted, fontSize: 11, marginTop: 2 },
        main: { flex: 1, minWidth: 0 },
        header: {
          minHeight: 68,
          paddingHorizontal: isWide ? spacing.lg : spacing.md,
          paddingVertical: spacing.sm,
          borderBottomWidth: 1,
          borderColor: PLATFORM_COLORS.border,
          backgroundColor: PLATFORM_COLORS.panel,
          flexDirection: isWide ? 'row' : 'column',
          alignItems: isWide ? 'center' : 'stretch',
          gap: spacing.md,
        },
        headerCopy: { flex: 1, minWidth: 220 },
        breadcrumb: { color: PLATFORM_COLORS.muted, fontSize: 10, marginBottom: 3 },
        headerTools: { flex: 1, minWidth: 360, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.xs },
        contextPill: { paddingHorizontal: 9, paddingVertical: 7, borderRadius: 999, backgroundColor: PLATFORM_COLORS.panelSoft, borderWidth: 1, borderColor: PLATFORM_COLORS.border },
        contextText: { color: PLATFORM_COLORS.muted, fontSize: 10, fontWeight: '700' },
        securityPill: { paddingHorizontal: 9, paddingVertical: 7, borderRadius: 999, backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#BBF7D0' },
        securityText: { color: '#166534', fontSize: 10, fontWeight: '700' },
        headerTitle: { color: PLATFORM_COLORS.text, fontSize: 18, fontWeight: '800' },
        headerSub: { color: PLATFORM_COLORS.muted, fontSize: 13, marginTop: 4 },
        content: { flex: 1, minWidth: 0, padding: isWide ? spacing.lg : spacing.md },
      }),
    [isWide],
  );

  return (
    <View style={styles.root}>
      {!isWide || !leftCollapsed ? <View style={styles.sidebar} nativeID="desktop-module-navigation">
        <View style={styles.brand}>
          <Text style={styles.brandTitle}>{PLATFORM_CONSOLE_TITLE}</Text>
          <Text style={styles.brandSub}>Sicherer SaaS-Betrieb</Text>
        </View>
        <ScrollView horizontal={!isWide} style={styles.navScroll} showsHorizontalScrollIndicator={false}>
          {(isWide ? (['overview', 'customers', 'product', 'finance', 'operations'] as const) : ['mobile'] as const).map((group) => {
            const groupItems = group === 'mobile' ? navItems : navItems.filter((item) => item.group === group);
            if (!groupItems.length) return null;
            const groupLabel = { overview: 'Übersicht', customers: 'Kunden & Verträge', product: 'Produktverwaltung', finance: 'Finanzen', operations: 'Betrieb', mobile: '' }[group];
            const closed = closedGroups.includes(group);
            return <View key={group} style={isWide ? styles.navGroup : undefined}>
              {isWide ? <Pressable style={styles.navGroupHeader} onPress={() => setClosedGroups((current) => current.includes(group) ? current.filter((item) => item !== group) : [...current, group])}><Text style={styles.navGroupLabel}>{groupLabel}</Text><Text style={styles.navGroupLabel}>{closed ? '+' : '−'}</Text></Pressable> : null}
              {!closed ? groupItems.map((item) => {
            const active = pathname === item.path || pathname.startsWith(`${item.path}/`);
            return (
              <Pressable
                key={item.path}
                style={[styles.navItem, active && styles.navItemActive]}
                onPress={() => router.push(item.path as never)}
              >
                <Text style={styles.navIcon}>{item.icon}</Text>
                <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
              </Pressable>
            );
            }) : null}</View>;
          })}
        </ScrollView>
        {platformUser ? (
          <View style={styles.userBox}>
            <Text style={styles.userRole}>{PLATFORM_ROLE_LABELS[platformUser.role]}</Text>
            <Text style={styles.userEmail}>{platformUser.email}</Text>
          </View>
        ) : null}
      </View> : null}
      {isWide ? (
        <DesktopSidebarToggle
          side="left"
          collapsed={leftCollapsed}
          onPress={toggleLeft}
          controls="desktop-module-navigation"
          accentColor={PLATFORM_COLORS.accent}
        />
      ) : null}
      <View style={styles.main}>
        {title ? (
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.breadcrumb}>Platform Console / {title}</Text>
              <Text accessibilityRole="header" style={styles.headerTitle}>{title}</Text>
              {subtitle ? <Text style={styles.headerSub}>{subtitle}</Text> : null}
            </View>
            <View style={styles.headerTools}>
              <PlatformGlobalSearch />
              <View style={styles.securityPill}><Text style={styles.securityText}>✓ Audit aktiv</Text></View>
              <View style={styles.contextPill}><Text style={styles.contextText}>{environment === 'production' ? 'Produktion' : environment}</Text></View>
              {platformUser ? <View style={styles.contextPill}><Text style={styles.contextText}>{PLATFORM_ROLE_LABELS[platformUser.role]}</Text></View> : null}
            </View>
          </View>
        ) : null}
        <View style={styles.content}>
          <PlatformErrorBoundary>{children}</PlatformErrorBoundary>
        </View>
      </View>
    </View>
  );
}

export { PLATFORM_COLORS };
