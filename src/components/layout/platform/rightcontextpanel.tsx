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
import { useBeratungDashboard } from '@/hooks/useBeratungDashboard';
import { useAkademieDashboard } from '@/hooks/useAkademieDashboard';
import { useStationaerDashboard } from '@/hooks/useStationaerDashboard';
import { useAssistDashboard } from '@/hooks/useAssistDashboard';
import { useAssistLiveMonitoring } from '@/features/assistLive/useAssistLiveMonitoring';
import { resolveActiveModuleNavKey } from '@/lib/navigation/modulenav';
import { navigateModuleNavItem } from '@/lib/navigation/modulenav/navigateModuleNavItem';
import { useModalStack } from '@/hooks/useModalStack';
import { usePlatformLayout } from '@/hooks/usePlatformLayout';
import { PLATFORM_SHELL_HEADER_TOP_INSET } from '@/lib/platform/shellLayoutMetrics';
import { SUPPORT_LINKS } from '@/lib/platform/supportLinks';
import { getServiceMode } from '@/lib/services/mode';
import { useAuroraAdaptiveText, lightLiquidGlassWebFx, useShellGlassSurfaceStyle } from '@/design/tokens/auroraGlass';
import { resolveLlganGlassSurface } from '@/design/tokens/lightLiquidGlassAuroraNebula';
import { llgsTypography } from '@/design/tokens/lightLiquidGlassSpace';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { breakpoints } from '@/design/tokens/breakpoints';
import { glassFx, withAlpha } from '@/design/tokens/motion';
import { radius, spacing, typography } from '@/theme';
import type { MainModuleKey } from '@/types/navigation/platform';
import {
  buildOpenTasks,
  ASSIST_QUICK_ACTIONS,
  AKADEMIE_QUICK_ACTIONS,
  BERATUNG_QUICK_ACTIONS,
  OFFICE_QUICK_ACTIONS,
  PFLEGE_QUICK_ACTIONS,
  STATIONAER_QUICK_ACTIONS,
  resolveContextPanelNavConfig,
} from './platformContextData';
import { CollapsibleSidebarSection } from './collapsiblesidebarsection';
import { PlatformContextSearch } from './PlatformContextSearch';
import { PlatformProfileMenu } from './PlatformProfileMenu';
import { TenantMandantCardContent } from './TenantMandantCardContent';
import { SpaceKpiIcon } from '@/components/icons/space';
import { AccentTextChip } from '@/components/ui/AccentTextChip';
import { resolveLightColoredTextColor } from '@/design/tokens/accentContrast';

const SUPPORT_LINKS_ITEMS = [
  { label: 'Hilfe & Dokumentation', icon: 'helpOrb', href: 'help' as const },
  { label: 'Datenschutz', icon: 'lockShield', href: 'privacy' as const },
  { label: 'Betroffenenrechte', icon: 'dataRights', href: 'data-request' as const },
  { label: 'Impressum', icon: 'infoBeacon', href: 'imprint' as const },
] as const;

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
  const { adaptiveShell } = usePlatformLayout();
  const { openModal } = useModalStack();
  const { width } = useWindowDimensions();
  const { logoUrl: tenantLogoUrl, logoLoading: tenantLogoLoading } = useTenantBranding();
  const { colors, isDark } = useLegacyTheme();
  const text = useAuroraAdaptiveText();
  const tenantGlass = useShellGlassSurfaceStyle('card', { intensity: 'strong' });
  const accent = accentColor ?? colors.violet;
  const { data: officeData } = useOfficeDashboard({ enabled: mainModule === 'office' });
  const { stats: stationaerStats } = useStationaerDashboard({ enabled: mainModule === 'stationaer' });
  const { stats: beratungStats } = useBeratungDashboard({ enabled: mainModule === 'beratung' });
  const { stats: akademieStats } = useAkademieDashboard({ enabled: mainModule === 'akademie' });
  const { stats: assistStats } = useAssistDashboard({ enabled: mainModule === 'assist' });
  const { counters: assistLiveCounters } = useAssistLiveMonitoring({
    enabled: mainModule === 'assist',
  });
  const isLive = getServiceMode() === 'supabase';
  const styles = useMemo(() => createStyles(isDark, colors, accent), [isDark, colors, accent]);

  const navConfig = useMemo(() => resolveContextPanelNavConfig(mainModule), [mainModule]);
  const activeNavKey = resolveActiveModuleNavKey(pathname, navConfig);

  if (width < breakpoints.tablet || width < 1280) {
    return null;
  }

  const quickActions =
    mainModule === 'office'
      ? OFFICE_QUICK_ACTIONS
      : mainModule === 'assist'
        ? ASSIST_QUICK_ACTIONS
        : mainModule === 'pflege'
          ? PFLEGE_QUICK_ACTIONS
          : mainModule === 'stationaer'
            ? STATIONAER_QUICK_ACTIONS
            : mainModule === 'beratung'
              ? BERATUNG_QUICK_ACTIONS
              : mainModule === 'akademie'
                ? AKADEMIE_QUICK_ACTIONS
                : OFFICE_QUICK_ACTIONS.slice(0, 2);
  const openTasks = buildOpenTasks(
    mainModule,
    officeData,
    isLive,
    stationaerStats,
    beratungStats,
    akademieStats,
    assistStats,
    assistLiveCounters,
  );

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        <PlatformProfileMenu accentColor={accent} fullWidth />

        <View style={[styles.tenantCard, tenantGlass]}>
          <View style={styles.tenantCardTint} pointerEvents="none" />
          <TenantMandantCardContent
            logoUrl={tenantLogoUrl}
            logoLoading={tenantLogoLoading}
            accentColor={accent}
            labelStyle={{ color: text.muted }}
            chipTextStyle={{ color: accent }}
          />
        </View>

        <PlatformContextSearch mainModule={mainModule} accentColor={accent} fullWidth />

        <View style={styles.todaySection}>
          <Text style={styles.sectionHeading}>Heute</Text>
          <View style={styles.taskList}>
            {openTasks.map((task) => (
              <View key={task.title} style={styles.taskItem}>
                <Text style={styles.taskTitle} numberOfLines={1}>
                  {task.title}
                </Text>
                <AccentTextChip label={String(task.count)} accentColor={accent} />
              </View>
            ))}
          </View>
        </View>

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
              <SpaceKpiIcon icon={action.icon} accentColor={accent} size={26} />
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
                      navigateModuleNavItem(item, router, openModal, adaptiveShell);
                    }}
                    style={webCursor}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <View
                      style={[
                        styles.navItem,
                        active && {
                          backgroundColor: 'rgba(130,170,255,0.16)',
                          borderColor: 'rgba(130,170,255,0.32)',
                        },
                      ]}
                    >
                      {active ? (
                        <View style={[styles.navActiveBar, { backgroundColor: accent }]} />
                      ) : null}
                      <SpaceKpiIcon icon={item.icon} accentColor={accent} size={26} />
                      <Text
                        style={[
                          styles.navLabel,
                          active && {
                            color: resolveLightColoredTextColor(accent, accent),
                            fontWeight: '700',
                          },
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
      </ScrollView>

      <View style={styles.supportFooter}>
        <Text style={[styles.sectionHeading, styles.supportHeading]}>Support</Text>
        {SUPPORT_LINKS_ITEMS.map((item) => (
          <Pressable
            key={item.label}
            onPress={() => {
              if (item.href === 'data-request') {
                router.push('/settings/data-request' as never);
                return;
              }
              openExternal(SUPPORT_LINKS[item.href]);
            }}
            style={[styles.supportLink, webCursor]}
            accessibilityRole="button"
          >
            <SpaceKpiIcon icon={item.icon} accentColor={accent} size={26} />
            <Text style={styles.supportLinkText}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function createStyles(
  isDark: boolean,
  colors: ReturnType<typeof useLegacyTheme>['colors'],
  accent: string,
) {
  const sidebarSurface = resolveLlganGlassSurface('default');
  const chipSurface = resolveLlganGlassSurface('subtle');
  const glassBorder = isDark ? glassFx.border : sidebarSurface.borderAccent;
  const chipBg = chipSurface.chip;
  const sidebarGlass = {
    backgroundColor: sidebarSurface.sidebar,
    ...lightLiquidGlassWebFx(sidebarSurface.blurDesktop, sidebarSurface.saturate),
  };

  return StyleSheet.create({
    root: {
      width: 272,
      minWidth: 272,
      flexGrow: 0,
      flexShrink: 0,
      alignSelf: 'stretch',
      minHeight: 0,
      flexDirection: 'column',
      overflow: 'hidden',
      ...sidebarGlass,
      borderLeftWidth: 1,
      borderLeftColor: withAlpha(accent, isDark ? 0.45 : 0.32),
    },
    scroll: {
      flex: 1,
      minHeight: 0,
      ...(Platform.OS === 'web'
        ? ({ overflowY: 'auto', overflowX: 'hidden', scrollbarGutter: 'stable' } as unknown as ViewStyle)
        : null),
    },
    scrollContent: {
      paddingHorizontal: spacing.sm + spacing.xs,
      paddingTop: PLATFORM_SHELL_HEADER_TOP_INSET,
      paddingBottom: spacing.lg,
      gap: spacing.md,
    },
    tenantCard: {
      padding: spacing.sm + spacing.xs,
      borderRadius: radius.lg,
      overflow: 'hidden',
      position: 'relative',
    },
    tenantCardTint: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(210,235,255,0.10)',
      borderRadius: radius.lg,
    },
    sectionHeading: {
      ...typography.caption,
      color: isDark ? colors.textMuted : llgsTypography.secondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    todaySection: {
      gap: spacing.xs,
    },
    taskList: { gap: spacing.xs },
    taskItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.xs,
      gap: spacing.sm,
      minHeight: 32,
    },
    taskTitle: {
      ...typography.body,
      color: colors.textSecondary,
      flex: 1,
      minWidth: 0,
      fontWeight: '600',
    },
    taskBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: radius.capsule,
      minWidth: 24,
      alignItems: 'center',
      flexShrink: 0,
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
      borderColor: withAlpha(accent, 0.24),
      backgroundColor: chipBg,
      ...lightLiquidGlassWebFx(chipSurface.blurMobile, chipSurface.saturate),
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
      borderColor: withAlpha(accent, 0.18),
      backgroundColor: chipBg,
      ...lightLiquidGlassWebFx(chipSurface.blurMobile, chipSurface.saturate),
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
    supportFooter: {
      flexShrink: 0,
      alignItems: 'stretch',
      paddingHorizontal: spacing.sm + spacing.xs,
      paddingTop: spacing.sm,
      paddingBottom: spacing.lg,
      gap: spacing.xs,
      borderTopWidth: 1,
      borderTopColor: withAlpha(accent, isDark ? 0.4 : 0.3),
    },
    supportHeading: {
      textAlign: 'left',
      width: '100%',
    },
    supportLink: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      paddingVertical: spacing.xs,
      gap: spacing.sm,
      width: '100%',
    },
    supportLinkText: {
      ...typography.caption,
      color: colors.textMuted,
      fontWeight: '600',
      textAlign: 'left',
      flexShrink: 1,
    },
  });
}
