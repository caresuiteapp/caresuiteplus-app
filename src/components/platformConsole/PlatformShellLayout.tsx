import { ReactNode, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import type { PlatformCapability } from '@/types/platformConsole';
import { PLATFORM_CONSOLE_TITLE, PLATFORM_NAV_ITEMS } from '@/lib/platformConsole/platformNavigation';
import { platformRoleHasCapability, PLATFORM_ROLE_LABELS } from '@/lib/platformConsole';
import { usePlatformAuth } from '@/lib/platformConsole/PlatformAuthProvider';
import { spacing } from '@/theme';

const PLATFORM_COLORS = {
  bg: '#050816',
  sidebar: '#0B1024',
  panel: '#101827',
  border: '#1E293B',
  text: '#E2E8F0',
  muted: '#94A3B8',
  accent: '#62F3FF',
  warning: '#F59E0B',
  danger: '#EF4444',
};

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

  const navItems = useMemo(
    () => filterNavByRole(platformUser?.role),
    [platformUser?.role],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, flexDirection: isWide ? 'row' : 'column', backgroundColor: PLATFORM_COLORS.bg },
        sidebar: {
          width: isWide ? 260 : undefined,
          backgroundColor: PLATFORM_COLORS.sidebar,
          borderRightWidth: isWide ? 1 : 0,
          borderBottomWidth: isWide ? 0 : 1,
          borderColor: PLATFORM_COLORS.border,
          paddingVertical: spacing.md,
        },
        brand: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: 4 },
        brandTitle: { color: PLATFORM_COLORS.accent, fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
        brandSub: { color: PLATFORM_COLORS.muted, fontSize: 11 },
        navScroll: { flexGrow: 0 },
        navItem: {
          paddingHorizontal: spacing.md,
          paddingVertical: 10,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        },
        navItemActive: { backgroundColor: '#132036' },
        navIcon: { color: PLATFORM_COLORS.accent, width: 18, textAlign: 'center' },
        navLabel: { color: PLATFORM_COLORS.text, fontSize: 14 },
        navLabelActive: { color: '#FFFFFF', fontWeight: '600' },
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
        main: { flex: 1 },
        header: {
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderBottomWidth: 1,
          borderColor: PLATFORM_COLORS.border,
          backgroundColor: PLATFORM_COLORS.panel,
        },
        headerTitle: { color: PLATFORM_COLORS.text, fontSize: 22, fontWeight: '700' },
        headerSub: { color: PLATFORM_COLORS.muted, fontSize: 13, marginTop: 4 },
        auditHint: {
          marginTop: spacing.sm,
          paddingHorizontal: spacing.sm,
          paddingVertical: 6,
          borderRadius: 6,
          backgroundColor: '#1a1f2e',
          borderWidth: 1,
          borderColor: PLATFORM_COLORS.border,
        },
        auditHintText: { color: PLATFORM_COLORS.muted, fontSize: 11 },
        content: { flex: 1, padding: spacing.lg },
      }),
    [isWide],
  );

  return (
    <View style={styles.root}>
      <View style={styles.sidebar}>
        <View style={styles.brand}>
          <Text style={styles.brandTitle}>{PLATFORM_CONSOLE_TITLE}</Text>
          <Text style={styles.brandSub}>SaaS-Betrieb · isoliert</Text>
        </View>
        <ScrollView horizontal={!isWide} style={styles.navScroll} showsHorizontalScrollIndicator={false}>
          {navItems.map((item) => {
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
          })}
        </ScrollView>
        {platformUser ? (
          <View style={styles.userBox}>
            <Text style={styles.userRole}>{PLATFORM_ROLE_LABELS[platformUser.role]}</Text>
            <Text style={styles.userEmail}>{platformUser.email}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.main}>
        {title ? (
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{title}</Text>
            {subtitle ? <Text style={styles.headerSub}>{subtitle}</Text> : null}
            <View style={styles.auditHint}>
              <Text style={styles.auditHintText}>
                Alle kritischen Aktionen werden protokolliert. Mandantendaten nur im Support-Modus.
              </Text>
            </View>
          </View>
        ) : null}
        <View style={styles.content}>{children}</View>
      </View>
    </View>
  );
}

export { PLATFORM_COLORS };
