import { useMemo } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useTenantDisplayName } from '@/hooks/useTenantDisplayName';
import { useOfficeDashboard } from '@/hooks/useOfficeDashboard';
import { resolveActiveModuleNavKey } from '@/lib/navigation/modulenav';
import { SUPPORT_LINKS } from '@/lib/platform/supportLinks';
import { getServiceMode } from '@/lib/services/mode';
import { GlowCard } from '@/components/ui/effects';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { breakpoints } from '@/design/tokens/breakpoints';
import { glassFx, withAlpha } from '@/design/tokens/motion';
import { radius, spacing, typography } from '@/theme';
import type { MainModuleKey } from '@/types/navigation/platform';
import {
  buildContextPanelNavItems,
  buildLiveModuleStatusChips,
  buildOfficeModuleStatusChips,
  buildOpenTasks,
  DEMO_MODULE_STATUS,
  OFFICE_QUICK_ACTIONS,
  resolveContextPanelNavConfig,
} from './platformContextData';

type RightContextPanelProps = {
  mainModule: MainModuleKey;
  accentColor?: string;
};

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : null;

function openExternal(url: string) {
  void Linking.openURL(url).catch(() => undefined);
}

/** Context panel — tenant status, module chips, tasks, Schnellaktionen + nav, support. */
export function RightContextPanel({ mainModule, accentColor }: RightContextPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const tenantName = useTenantDisplayName();
  const { colors, isDark } = useLegacyTheme();
  const accent = accentColor ?? colors.violet;
  const { data: officeData } = useOfficeDashboard();
  const isLive = getServiceMode() === 'supabase';
  const styles = useMemo(() => createStyles(isDark, colors, accent), [isDark, colors, accent]);

  const navConfig = useMemo(() => resolveContextPanelNavConfig(mainModule), [mainModule]);
  const navItems = useMemo(() => buildContextPanelNavItems(mainModule), [mainModule]);
  const activeNavKey = resolveActiveModuleNavKey(pathname, navConfig);

  if (width < breakpoints.tablet || width < 1280) {
    return null;
  }

  const statusChips =
    mainModule === 'office' && officeData
      ? buildOfficeModuleStatusChips(officeData.kpis)
      : isLive
        ? buildLiveModuleStatusChips(mainModule)
        : DEMO_MODULE_STATUS[mainModule];

  const quickActions = mainModule === 'office' ? OFFICE_QUICK_ACTIONS : OFFICE_QUICK_ACTIONS.slice(0, 2);
  const openTasks = buildOpenTasks(mainModule, officeData, isLive);

  return (
    <View style={styles.root}>
      <GlowCard glowColor={accent} style={styles.tenantCard}>
        <Text style={styles.cardHeading}>Mandant</Text>
        <Text style={styles.tenantName} numberOfLines={2}>
          {tenantName}
        </Text>
        <View style={[styles.liveChip, { borderColor: withAlpha(accent, 0.45) }]}>
          <Text style={[styles.liveChipText, { color: accent }]}>● Live</Text>
        </View>
      </GlowCard>

      <Text style={styles.sectionHeading}>Modulstatus</Text>
      <View style={styles.chipRow}>
        {statusChips.map((chip) => (
          <View key={chip.label} style={[styles.statusChip, { borderColor: withAlpha(accent, 0.35) }]}>
            <Text style={styles.chipLabel}>{chip.label}</Text>
            <Text style={[styles.chipValue, { color: accent }]}>{chip.status}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionHeading}>Heute</Text>
      <ScrollView style={styles.taskList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
        {openTasks.map((task) => (
          <View key={task.title} style={styles.taskItem}>
            <Text style={styles.taskTitle} numberOfLines={1}>
              {task.title}
            </Text>
            <View style={[styles.taskBadge, { backgroundColor: withAlpha(accent, 0.2) }]}>
              <Text style={[styles.taskBadgeText, { color: accent }]}>{task.count}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <Text style={styles.sectionHeading}>Schnellaktionen</Text>
      <View style={styles.schnellRow}>
        <View style={styles.schnellLeft}>
          {quickActions.map((action) => (
            <Pressable
              key={action.label}
              onPress={() => router.push(action.href as never)}
              style={[styles.actionBtn, webCursor]}
              accessibilityRole="button"
            >
              <Text style={styles.actionIcon}>{action.icon}</Text>
              <Text style={styles.actionLabel} numberOfLines={2}>
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.schnellRight}>
          {navItems.map((item) => {
            const active = item.key === activeNavKey;
            return (
              <Pressable
                key={item.key}
                onPress={() => router.push(item.href as never)}
                style={[
                  styles.navPill,
                  active && {
                    backgroundColor: withAlpha(accent, isDark ? 0.2 : 0.12),
                    borderColor: withAlpha(accent, 0.45),
                  },
                  webCursor,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={styles.navIcon}>{item.icon}</Text>
                <Text
                  style={[
                    styles.navLabel,
                    active && { color: isDark ? '#FFFFFF' : accent, fontWeight: '700' },
                  ]}
                  numberOfLines={2}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.support}>
        <Text style={styles.sectionHeading}>Support</Text>
        <Pressable onPress={() => openExternal(SUPPORT_LINKS.help)} style={styles.supportLink}>
          <Text style={styles.supportLinkText}>❓ Hilfe & Dokumentation</Text>
        </Pressable>
        <Pressable onPress={() => openExternal(SUPPORT_LINKS.privacy)} style={styles.supportLink}>
          <Text style={styles.supportLinkText}>🔒 Datenschutz</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/settings/data-request' as never)} style={styles.supportLink}>
          <Text style={styles.supportLinkText}>📋 Betroffenenrechte</Text>
        </Pressable>
        <Pressable onPress={() => openExternal(SUPPORT_LINKS.imprint)} style={styles.supportLink}>
          <Text style={styles.supportLinkText}>ℹ️ Impressum</Text>
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(
  isDark: boolean,
  colors: ReturnType<typeof useLegacyTheme>['colors'],
  accent: string,
) {
  const glassBorder = isDark ? glassFx.border : colors.borderSoft;
  const chipBg = isDark ? 'rgba(255,255,255,0.04)' : colors.bgSurface;

  return StyleSheet.create({
    root: {
      width: 320,
      backgroundColor: isDark ? 'rgba(18,22,43,0.28)' : colors.bgSurface,
      borderLeftWidth: 1,
      borderLeftColor: glassBorder,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.lg,
      paddingBottom: spacing.lg,
      gap: spacing.md,
    },
    tenantCard: {
      padding: spacing.md,
      gap: spacing.xs,
    },
    cardHeading: {
      ...typography.caption,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    tenantName: {
      ...typography.bodyStrong,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    liveChip: {
      alignSelf: 'flex-start',
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radius.capsule,
      borderWidth: 1,
      marginTop: spacing.xs,
    },
    liveChipText: { fontSize: 11, fontWeight: '700' },
    sectionHeading: {
      ...typography.caption,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    chipRow: { gap: spacing.xs },
    statusChip: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      backgroundColor: chipBg,
    },
    chipLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
    chipValue: { ...typography.caption, fontWeight: '700' },
    taskList: { maxHeight: 120 },
    taskItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.xs,
      gap: spacing.sm,
    },
    taskTitle: { ...typography.body, color: colors.textSecondary, flex: 1, fontWeight: '600' },
    taskBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: radius.capsule,
      minWidth: 24,
      alignItems: 'center',
    },
    taskBadgeText: { fontSize: 11, fontWeight: '700' },
    schnellRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.xs,
    },
    schnellLeft: {
      flex: 1,
      minWidth: 0,
      gap: spacing.xs,
    },
    schnellRight: {
      flex: 1,
      minWidth: 0,
      gap: spacing.xs,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      minHeight: 40,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: glassBorder,
      backgroundColor: chipBg,
    },
    actionIcon: { fontSize: 14 },
    actionLabel: { ...typography.caption, color: colors.textPrimary, fontWeight: '600', flex: 1 },
    navPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      minHeight: 40,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: glassBorder,
      backgroundColor: chipBg,
    },
    navIcon: { fontSize: 14, width: 18, textAlign: 'center' },
    navLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '600', flex: 1 },
    support: { marginTop: 'auto', gap: spacing.xs },
    supportLink: { paddingVertical: spacing.xs },
    supportLinkText: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
  });
}
