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
import { useTenantBranding } from '@/hooks/useTenantDisplayName';
import { useOfficeDashboard } from '@/hooks/useOfficeDashboard';
import { resolveActiveModuleNavKey } from '@/lib/navigation/modulenav';
import { PLATFORM_SHELL_HEADER_TOP_INSET } from '@/lib/platform/shellLayoutMetrics';
import { SUPPORT_LINKS } from '@/lib/platform/supportLinks';
import { getServiceMode } from '@/lib/services/mode';
import { GlowCard } from '@/components/ui/effects';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { breakpoints } from '@/design/tokens/breakpoints';
import { glassFx, withAlpha } from '@/design/tokens/motion';
import { radius, spacing, typography } from '@/theme';
import type { MainModuleKey } from '@/types/navigation/platform';
import {
  buildOpenTasks,
  OFFICE_QUICK_ACTIONS,
  resolveContextPanelNavConfig,
} from './platformContextData';
import { CollapsibleSidebarSection } from './collapsiblesidebarsection';
import { TenantMandantCardContent } from './TenantMandantCardContent';

type RightContextPanelProps = {
  mainModule: MainModuleKey;
  accentColor?: string;
};

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : null;

function openExternal(url: string) {
  void Linking.openURL(url).catch(() => undefined);
}

/** Context panel — tenant card, tasks, Schnellaktionen, nav groups, support. */
export function RightContextPanel({ mainModule, accentColor }: RightContextPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const { logoUrl: tenantLogoUrl } = useTenantBranding();
  const { colors, isDark } = useLegacyTheme();
  const accent = accentColor ?? colors.violet;
  const { data: officeData } = useOfficeDashboard();
  const isLive = getServiceMode() === 'supabase';
  const styles = useMemo(() => createStyles(isDark, colors, accent), [isDark, colors, accent]);

  const navConfig = useMemo(() => resolveContextPanelNavConfig(mainModule), [mainModule]);
  const activeNavKey = resolveActiveModuleNavKey(pathname, navConfig);

  if (width < breakpoints.tablet || width < 1280) {
    return null;
  }

  const quickActions = mainModule === 'office' ? OFFICE_QUICK_ACTIONS : OFFICE_QUICK_ACTIONS.slice(0, 2);
  const openTasks = buildOpenTasks(mainModule, officeData, isLive);

  return (
    <View style={styles.root}>
      <GlowCard glowColor={accent} style={styles.tenantCard}>
        <TenantMandantCardContent
          logoUrl={tenantLogoUrl}
          accentColor={accent}
          labelStyle={{ color: colors.textMuted }}
        />
      </GlowCard>

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

      <CollapsibleSidebarSection
        title="Schnellaktionen"
        items={quickActions}
        getItemKey={(action) => action.label}
        titleStyle={styles.sectionHeading}
        itemsContainerStyle={styles.quickActions}
        renderItem={(action, context) => (
          <Pressable
            onPress={() => {
              context?.closeMenu();
              router.push(action.href as never);
            }}
            style={[styles.actionBtn, webCursor]}
            accessibilityRole="button"
          >
            <Text style={styles.actionIcon}>{action.icon}</Text>
            <Text style={styles.actionLabel} numberOfLines={2}>
              {action.label}
            </Text>
          </Pressable>
        )}
      />

      <View style={styles.navSection}>
        {navConfig.groups.map((group) => (
          <CollapsibleSidebarSection
            key={group.title}
            title={group.title}
            items={group.items}
            getItemKey={(item) => item.key}
            titleStyle={styles.groupTitle}
            itemsContainerStyle={styles.navGroup}
            renderItem={(item, context) => {
              const active = item.key === activeNavKey;
              return (
                <Pressable
                  onPress={() => {
                    context?.closeMenu();
                    router.push(item.href as never);
                  }}
                  style={webCursor}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <View
                    style={[
                      styles.navItem,
                      active && {
                        backgroundColor: withAlpha(accent, isDark ? 0.2 : 0.12),
                        borderColor: withAlpha(accent, 0.45),
                      },
                    ]}
                  >
                    {active ? (
                      <View style={[styles.navActiveBar, { backgroundColor: accent }]} />
                    ) : null}
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
                  </View>
                </Pressable>
              );
            }}
          />
        ))}
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
      width: 272,
      flexGrow: 0,
      flexShrink: 0,
      alignSelf: 'stretch',
      backgroundColor: isDark ? 'rgba(18,22,43,0.28)' : colors.bgSurface,
      borderLeftWidth: 1,
      borderLeftColor: glassBorder,
      paddingHorizontal: spacing.sm + spacing.xs,
      paddingTop: PLATFORM_SHELL_HEADER_TOP_INSET,
      paddingBottom: spacing.lg,
      gap: spacing.md,
    },
    tenantCard: {
      padding: spacing.sm + spacing.xs,
    },
    sectionHeading: {
      ...typography.caption,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
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
    quickActions: {
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
    navSection: { gap: spacing.md },
    navGroup: { gap: spacing.xs },
    groupTitle: {
      ...typography.caption,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    navItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      minHeight: 40,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: 'transparent',
      backgroundColor: chipBg,
      position: 'relative',
    },
    navActiveBar: {
      position: 'absolute',
      left: 0,
      top: 8,
      bottom: 8,
      width: 3,
      borderRadius: 3,
    },
    navIcon: { fontSize: 14, width: 18, textAlign: 'center' },
    navLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '600', flex: 1 },
    support: { marginTop: 'auto', gap: spacing.xs },
    supportLink: { paddingVertical: spacing.xs },
    supportLinkText: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
  });
}
