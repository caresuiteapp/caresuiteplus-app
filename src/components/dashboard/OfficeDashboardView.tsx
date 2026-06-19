import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AdaptiveKpiGrid } from '@/components/adaptive';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
  PremiumKpiCard,
  PremiumListRow,
  SectionPanel,
  Timeline,
} from '@/components/ui';
import type { DashboardQuickAction, DashboardSnapshot } from '@/types/dashboard';
import { OFFICE_AREA_SHORTCUTS } from '@/data/demo/officeDashboard';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { SENSITIVITY_LABELS } from '@/types/portal/visibility';
import { usePlatformLayout } from '@/hooks/platform/usePlatformLayout';
import { useShellHostsAurora } from '@/hooks/useshellhostsaurora';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { designTokens, spacing } from '@/theme';
import { DashboardHero } from './DashboardHero';

type OfficeDashboardViewProps = {
  snapshot: DashboardSnapshot | null;
  loading: boolean;
  error: string | null;
  displayName: string;
  onRefresh: () => void;
};

function KpiSection({ snapshot }: { snapshot: DashboardSnapshot }) {
  return (
    <SectionPanel title="Kennzahlen" subtitle="Aktuelle Mandantenübersicht">
      <AdaptiveKpiGrid
        items={snapshot.kpis.map((kpi) => ({
          id: kpi.id,
          node: (
            <PremiumKpiCard
              label={kpi.label}
              value={kpi.value}
              subValue={kpi.subValue}
              icon={kpi.icon}
              accentColor={kpi.accentColor}
              trend={kpi.trend}
              trendValue={kpi.trendValue}
            />
          ),
        }))}
      />
    </SectionPanel>
  );
}

function StatusSection({
  snapshot,
  styles,
  accentColor,
}: {
  snapshot: DashboardSnapshot;
  styles: ReturnType<typeof createOfficeDashboardStyles>;
  accentColor: string;
}) {
  return (
    <SectionPanel title="Aufmerksamkeit" subtitle="Vorgänge, die Ihre Aktion brauchen">
      <View style={styles.statusList}>
        {snapshot.statusCards.map((card) => (
          <PremiumCard key={card.id} accentColor={accentColor}>
            <View style={styles.statusHeader}>
              <Text style={styles.statusTitle}>{card.title}</Text>
              {card.count !== undefined ? (
                <Text style={styles.statusCount}>{card.count}</Text>
              ) : null}
            </View>
            <Text style={styles.statusDesc}>{card.description}</Text>
            <View style={styles.statusBadges}>
              <PremiumBadge
                label={WORKFLOW_STATUS_LABELS[card.status]}
                variant={
                  card.status === 'fehlerhaft'
                    ? 'red'
                    : card.status === 'abgeschlossen'
                      ? 'green'
                      : 'orange'
                }
                dot
              />
              {card.sensitivity ? (
                <PremiumBadge label={SENSITIVITY_LABELS[card.sensitivity]} variant="cyan" />
              ) : null}
            </View>
          </PremiumCard>
        ))}
      </View>
    </SectionPanel>
  );
}

function QuickActionsSection({
  snapshot,
  onAction,
  styles,
}: {
  snapshot: DashboardSnapshot;
  onAction: (action: DashboardQuickAction) => void;
  styles: ReturnType<typeof createOfficeDashboardStyles>;
}) {
  return (
    <SectionPanel title="Schnellaktionen" subtitle="Häufige Verwaltungsaufgaben">
      <View style={styles.actions}>
        {snapshot.quickActions.map((action) => (
          <PremiumButton
            key={action.id}
            title={`${action.icon} ${action.label}`}
            variant={action.variant ?? 'secondary'}
            size="sm"
            onPress={() => onAction(action)}
          />
        ))}
      </View>
    </SectionPanel>
  );
}

function AreasSection({
  onNavigate,
  styles,
}: {
  onNavigate: (route: string) => void;
  styles: ReturnType<typeof createOfficeDashboardStyles>;
}) {
  return (
    <SectionPanel title="Arbeitsbereiche" subtitle="Office-Module und Verwaltung">
      <View style={styles.areaList}>
        {OFFICE_AREA_SHORTCUTS.map((area, index) => (
          <PremiumListRow
            key={area.id}
            title={area.title}
            subtitle={area.description}
            leading={
              <View style={[styles.areaIcon, { backgroundColor: `${area.accentColor}22` }]}>
                <Text style={styles.areaIconText}>{area.icon}</Text>
              </View>
            }
            trailing={
              area.count !== undefined ? (
                <Text style={styles.areaCount}>{area.count}</Text>
              ) : undefined
            }
            showChevron
            showDivider={index < OFFICE_AREA_SHORTCUTS.length - 1}
            onPress={() => onNavigate(area.route)}
          />
        ))}
      </View>
    </SectionPanel>
  );
}

function ActivitySection({
  snapshot,
  onRefresh,
}: {
  snapshot: DashboardSnapshot;
  onRefresh: () => void;
}) {
  return (
    <SectionPanel title="Letzte Aktivitäten" subtitle="Chronologischer Verlauf">
      <Timeline items={snapshot.activities} />
      <PremiumButton title="Aktualisieren" variant="ghost" size="sm" onPress={onRefresh} />
    </SectionPanel>
  );
}

function createOfficeDashboardStyles(
  colors: ReturnType<typeof useLegacyTheme>['colors'],
  typography: ReturnType<typeof useLegacyTheme>['typography'],
  text: ReturnType<typeof useAuroraAdaptiveText>,
  isDark: boolean,
  shellHostsAurora: boolean,
) {
  return StyleSheet.create({
    container: {
      gap: spacing.md,
      backgroundColor: shellHostsAurora ? 'transparent' : undefined,
    },
    statusList: {
      gap: spacing.sm,
    },
    statusHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    statusTitle: {
      ...typography.bodyStrong,
      color: text.primary,
      flex: 1,
    },
    statusCount: {
      ...typography.h3,
      color: colors.orange,
    },
    statusDesc: {
      ...typography.caption,
      color: text.secondary,
      marginBottom: spacing.sm,
    },
    statusBadges: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    areaList: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: shellHostsAurora || isDark ? designTokens.glass.border : colors.borderSoft,
      overflow: 'hidden',
      backgroundColor:
        shellHostsAurora || isDark ? designTokens.glass.background : colors.bgSurface,
    },
    areaIcon: {
      width: 40,
      height: 40,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    areaIconText: {
      fontSize: 18,
    },
    areaCount: {
      ...typography.bodyStrong,
      color: text.muted,
      minWidth: 24,
      textAlign: 'right',
    },
    tabletGrid: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    tabletCol: {
      flex: 1,
      minWidth: 0,
      gap: spacing.md,
    },
    desktopGrid: {
      flexDirection: 'row',
      gap: spacing.md,
      alignItems: 'flex-start',
    },
    desktopNav: {
      width: 280,
      flexShrink: 0,
    },
    desktopMain: {
      flex: 1,
      minWidth: 0,
      gap: spacing.md,
    },
    desktopSide: {
      width: 320,
      flexShrink: 0,
    },
  });
}

export function OfficeDashboardView({
  snapshot,
  loading,
  error,
  displayName,
  onRefresh,
}: OfficeDashboardViewProps) {
  const router = useRouter();
  const { shellVariant } = usePlatformLayout();
  const shellHostsAurora = useShellHostsAurora();
  const { colors, typography, isDark } = useLegacyTheme();
  const text = useAuroraAdaptiveText();
  const styles = useMemo(
    () => createOfficeDashboardStyles(colors, typography, text, isDark, shellHostsAurora),
    [colors, typography, text, isDark, shellHostsAurora],
  );

  const handleAction = (action: DashboardQuickAction) => {
    if (action.route) {
      router.push(action.route as never);
    }
  };

  const handleNavigate = (route: string) => {
    router.push(route as never);
  };

  if (loading) {
    return <LoadingState message="Office-Dashboard wird geladen…" />;
  }

  if (error) {
    return (
      <ErrorState title="Dashboard nicht verfügbar" message={error} onRetry={onRefresh} />
    );
  }

  if (!snapshot) {
    return (
      <EmptyState
        title="Keine Dashboard-Daten"
        message="Für Ihre Rolle sind aktuell keine Office-Übersichtsdaten verfügbar."
        actionLabel="Erneut laden"
        onAction={onRefresh}
      />
    );
  }

  const hero = (
    <DashboardHero
      snapshot={snapshot}
      displayName={displayName}
      onPrimaryAction={handleAction}
    />
  );

  if (shellVariant === 'desktop') {
    return (
      <View style={styles.container}>
        {hero}
        <View style={styles.desktopGrid}>
          <View style={styles.desktopNav}>
            <AreasSection onNavigate={handleNavigate} styles={styles} />
          </View>
          <View style={styles.desktopMain}>
            <KpiSection snapshot={snapshot} />
            <StatusSection snapshot={snapshot} styles={styles} accentColor={colors.orange} />
            <QuickActionsSection snapshot={snapshot} onAction={handleAction} styles={styles} />
          </View>
          <View style={styles.desktopSide}>
            <ActivitySection snapshot={snapshot} onRefresh={onRefresh} />
          </View>
        </View>
      </View>
    );
  }

  if (shellVariant === 'tablet') {
    return (
      <View style={styles.container}>
        {hero}
        <View style={styles.tabletGrid}>
          <View style={styles.tabletCol}>
            <KpiSection snapshot={snapshot} />
            <QuickActionsSection snapshot={snapshot} onAction={handleAction} styles={styles} />
          </View>
          <View style={styles.tabletCol}>
            <StatusSection snapshot={snapshot} styles={styles} accentColor={colors.orange} />
            <ActivitySection snapshot={snapshot} onRefresh={onRefresh} />
          </View>
        </View>
        <AreasSection onNavigate={handleNavigate} styles={styles} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {hero}
      <KpiSection snapshot={snapshot} />
      <StatusSection snapshot={snapshot} styles={styles} accentColor={colors.orange} />
      <QuickActionsSection snapshot={snapshot} onAction={handleAction} styles={styles} />
      <AreasSection onNavigate={handleNavigate} styles={styles} />
      <ActivitySection snapshot={snapshot} onRefresh={onRefresh} />
    </View>
  );
}
