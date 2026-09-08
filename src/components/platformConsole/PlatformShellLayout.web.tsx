import { webScaledFontMetric as font } from '@/design/web/webFontSize';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
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
import { HealthOSPageSurface } from '@/components/layout/HealthOSPageSurface';
import { LiquidLogo } from '@/liquid-command/components/LiquidPrimitives';
import { PortalTextSizeControls } from '@/components/portal/accessibility/PortalTextSizeControls';

type PlatformShellLayoutProps = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  scroll?: boolean;
};

function filterNavByRole(role: Parameters<typeof platformRoleHasCapability>[0]) {
  return PLATFORM_NAV_ITEMS.filter((item) => {
    if (!item.capability) return true;
    return platformRoleHasCapability(role, item.capability);
  });
}

export function PlatformShellLayout({ children, title, subtitle, scroll = true }: PlatformShellLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const { platformUser } = usePlatformAuth();
  const isWide = width >= 960;
  const { leftCollapsed, toggleLeft } = useDesktopWorkspacePreferences();
  const [closedGroups, setClosedGroups] = useState<string[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const environment = getPlatformReleaseInfo().environment;

  useEffect(() => { setMobileMenuOpen(false); }, [pathname, isWide]);

  const navItems = useMemo(
    () => filterNavByRole(platformUser?.role),
    [platformUser?.role],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, minHeight: 0, minWidth: 0, flexDirection: isWide ? 'row' : 'column', backgroundColor: PLATFORM_COLORS.bg },
        sidebar: {
          flex: isWide ? undefined : 1,
          minHeight: 0,
          width: isWide ? 248 : undefined,
          backgroundColor: PLATFORM_COLORS.sidebar,
          borderRightWidth: isWide ? 1 : 0,
          borderBottomWidth: isWide ? 0 : 1,
          borderColor: PLATFORM_COLORS.border,
          paddingVertical: spacing.md,
        },
        brand: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: 3 },
        brandLogo: { alignSelf: 'flex-start', padding: 8, marginBottom: 6, borderRadius: 8, backgroundColor: PLATFORM_COLORS.panel },
        brandTitle: { color: PLATFORM_COLORS.sidebarText, fontSize: font(16), fontWeight: '800', letterSpacing: 0.2 },
        brandSub: { color: PLATFORM_COLORS.sidebarMuted, fontSize: font(13) },
        navScroll: { flex: 1, minHeight: 0 },
        navItem: {
          marginHorizontal: isWide ? spacing.sm : 0,
          paddingHorizontal: spacing.sm,
          paddingVertical: 12,
          minHeight: 46,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          borderRadius: 10,
        },
        navItemActive: { backgroundColor: PLATFORM_COLORS.accentSoft },
        navGroup: { marginTop: spacing.sm },
        navGroupHeader: { marginHorizontal: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: 7, flexDirection: 'row', justifyContent: 'space-between' },
        navGroupLabel: { color: PLATFORM_COLORS.sidebarMuted, fontSize: font(13), fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.7 },
        navIcon: { color: PLATFORM_COLORS.accent, width: 18, textAlign: 'center' },
        navLabel: { color: PLATFORM_COLORS.sidebarText, fontSize: font(16) },
        navLabelActive: { color: PLATFORM_COLORS.sidebarText, fontWeight: '700' },
        userBox: {
          marginTop: spacing.sm,
          marginHorizontal: spacing.md,
          padding: spacing.sm,
          borderRadius: 8,
          backgroundColor: PLATFORM_COLORS.panel,
          borderWidth: 1,
          borderColor: PLATFORM_COLORS.border,
        },
        userRole: { color: PLATFORM_COLORS.accent, fontSize: font(13), fontWeight: '600' },
        userEmail: { color: PLATFORM_COLORS.muted, fontSize: font(13), marginTop: 2 },
        main: { flex: 1, minWidth: 0, minHeight: 0 },
        header: {
          minHeight: 68,
          paddingHorizontal: isWide ? spacing.lg : spacing.md,
          paddingVertical: spacing.sm,
          borderBottomWidth: 1,
          borderColor: PLATFORM_COLORS.border,
          backgroundColor: PLATFORM_COLORS.panel,
          flexDirection: 'row',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: spacing.md,
        },
        headerCopy: { flexGrow: 1, flexBasis: isWide ? 240 : 160, minWidth: 0 },
        breadcrumb: { color: PLATFORM_COLORS.muted, fontSize: font(13), marginBottom: 3 },
        headerTools: { flexGrow: 1, flexBasis: isWide ? 'auto' : '100%', minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: isWide ? 'flex-end' : 'flex-start', gap: spacing.xs },
        menuButton: { minHeight: 42, justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: PLATFORM_COLORS.borderStrong, paddingHorizontal: 12, backgroundColor: PLATFORM_COLORS.panel },
        menuButtonText: { color: PLATFORM_COLORS.text, fontWeight: '700', fontSize: font(14) },
        menuBackdrop: { flex: 1, padding: 12, backgroundColor: 'rgba(5,20,43,0.55)' },
        menuPanel: { flex: 1, minHeight: 0, width: '100%', maxWidth: 360, borderRadius: 12, overflow: 'hidden', backgroundColor: PLATFORM_COLORS.sidebar },
        menuCloseRow: { padding: spacing.sm, alignItems: 'flex-end' },
        contextPill: { paddingHorizontal: 9, paddingVertical: 7, borderRadius: 999, backgroundColor: PLATFORM_COLORS.panelSoft, borderWidth: 1, borderColor: PLATFORM_COLORS.border },
        contextText: { color: PLATFORM_COLORS.muted, fontSize: font(13), fontWeight: '700' },
        securityPill: { paddingHorizontal: 9, paddingVertical: 7, borderRadius: 999, backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#BBF7D0' },
        securityText: { color: '#166534', fontSize: font(13), fontWeight: '700' },
        headerTitle: { color: PLATFORM_COLORS.text, fontSize: font(24), fontWeight: '800' },
        headerSub: { color: PLATFORM_COLORS.muted, fontSize: font(15), marginTop: 4 },
        content: { flex: 1, minHeight: 0, minWidth: 0, padding: isWide ? spacing.lg : spacing.md },
      }),
    [isWide],
  );

  const navigation = (
      <View style={styles.sidebar} nativeID="desktop-module-navigation">
        <View style={styles.brand}>
          <View style={styles.brandLogo}><LiquidLogo width={200} /></View>
          <Text style={styles.brandTitle}>{PLATFORM_CONSOLE_TITLE}</Text>
          <Text style={styles.brandSub}>Sicherer SaaS-Betrieb</Text>
        </View>
        <ScrollView style={styles.navScroll} keyboardShouldPersistTaps="handled">
          {(['overview', 'customers', 'product', 'finance', 'operations'] as const).map((group) => {
            const groupItems = navItems.filter((item) => item.group === group);
            if (!groupItems.length) return null;
            const groupLabel = { overview: 'Übersicht', customers: 'Kunden & Verträge', product: 'Produktverwaltung', finance: 'Finanzen', operations: 'Betrieb', mobile: '' }[group];
            const closed = closedGroups.includes(group);
            return <View key={group} style={styles.navGroup}>
              <Pressable accessibilityRole="button" accessibilityLabel={groupLabel} accessibilityState={{ expanded: !closed }} style={styles.navGroupHeader} onPress={() => setClosedGroups((current) => current.includes(group) ? current.filter((item) => item !== group) : [...current, group])}><Text style={styles.navGroupLabel}>{groupLabel}</Text><Text style={styles.navGroupLabel}>{closed ? '+' : '−'}</Text></Pressable>
              {!closed ? groupItems.map((item) => {
            const active = pathname === item.path || pathname.startsWith(`${item.path}/`);
            return (
              <Pressable
                key={item.path}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                style={[styles.navItem, active && styles.navItemActive]}
                onPress={() => { setMobileMenuOpen(false); router.push(item.path as never); }}
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
      </View>
  );

  return (
    <View style={styles.root}>
      {isWide && !leftCollapsed ? navigation : null}
      {!isWide ? (
        <Modal visible={mobileMenuOpen} transparent animationType="none" onRequestClose={() => setMobileMenuOpen(false)}>
          <Pressable style={styles.menuBackdrop} onPress={() => setMobileMenuOpen(false)}>
            <Pressable style={styles.menuPanel} onPress={event => event.stopPropagation()}>
              <View style={styles.menuCloseRow}><Pressable accessibilityRole="button" accessibilityLabel="Navigation schließen" style={styles.menuButton} onPress={() => setMobileMenuOpen(false)}><Text style={styles.menuButtonText}>Schließen ✕</Text></Pressable></View>
              {navigation}
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
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
        {title || !isWide ? (
          <View style={styles.header}>
            {!isWide ? <Pressable accessibilityRole="button" accessibilityLabel="Navigation öffnen" accessibilityState={{ expanded: mobileMenuOpen }} style={styles.menuButton} onPress={() => setMobileMenuOpen(true)}><Text style={styles.menuButtonText}>☰ Menü</Text></Pressable> : null}
            <View style={styles.headerCopy}>
              <Text style={styles.breadcrumb}>Platform Console / {title}</Text>
              <Text accessibilityRole="header" style={styles.headerTitle}>{title}</Text>
              {subtitle ? <Text style={styles.headerSub}>{subtitle}</Text> : null}
            </View>
            <View style={styles.headerTools}>
              <PortalTextSizeControls />
              <PlatformGlobalSearch />
              <View style={styles.securityPill}><Text style={styles.securityText}>✓ Audit aktiv</Text></View>
              <View style={styles.contextPill}><Text style={styles.contextText}>{environment === 'production' ? 'Produktion' : environment}</Text></View>
              {platformUser ? <View style={styles.contextPill}><Text style={styles.contextText}>{PLATFORM_ROLE_LABELS[platformUser.role]}</Text></View> : null}
            </View>
          </View>
        ) : null}
        <View style={styles.content}>
          <HealthOSPageSurface padded>
            <PlatformErrorBoundary>{scroll ? <ScrollView style={{ flex: 1, minHeight: 0 }} contentContainerStyle={{ flexGrow: 1, gap: 16 }} keyboardShouldPersistTaps="handled">{children}</ScrollView> : children}</PlatformErrorBoundary>
          </HealthOSPageSurface>
        </View>
      </View>
    </View>
  );
}

export { PLATFORM_COLORS };
