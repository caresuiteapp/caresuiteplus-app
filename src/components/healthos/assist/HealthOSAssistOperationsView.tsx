import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AdaptiveKpiGrid } from '@/components/adaptive';
import {
  HealthOSAlert,
  HealthOSCard,
  HealthOSEmptyState,
  HealthOSErrorState,
  HealthOSLoadingState,
  HealthOSMetricCard,
  HealthOSPage,
  HealthOSSection,
  HealthOSStatusBadge,
} from '@/components/healthos';
import { resolveHealthOSShellBreakpoint } from '@/components/healthos/shell/healthosShellLayoutRules';
import { PremiumListRow } from '@/components/ui';
import type { ActiveExecutionItem, AssistDashboardStats, AssignmentListItem } from '@/types/modules/assist';
import { useMainModuleAccent } from '@/hooks/useMainModuleAccent';
import { useShellHostsAurora } from '@/hooks/useshellhostsaurora';
import {
  buildAssistOperationsModel,
  type AssistOperationsMetric,
  type AssistOperationsLink,
  type AssistOperationsBlockerRow,
} from '@/lib/assist/assistOperationsModel';
import { spacing, typography } from '@/theme';
import { useHydrationSafeWindowDimensions } from '@/hooks/useHydrationSafeWindowDimensions';

type Props = {
  stats: AssistDashboardStats | null;
  todayAssignments: AssignmentListItem[];
  activeExecutions: ActiveExecutionItem[];
  activeLoading: boolean;
  loading: boolean;
  error: string | null;
  displayName: string;
  onRefresh: () => void;
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function MetricsSection({
  metrics,
  accentColor,
  variant,
  columns,
  onNavigate,
}: {
  metrics: AssistOperationsMetric[];
  accentColor: string;
  variant: 'glass' | 'light';
  columns: { phone: number; tablet: number; desktop: number; wide: number };
  onNavigate: (route?: string) => void;
}) {
  return (
    <AdaptiveKpiGrid
      columns={columns}
      items={metrics.map((metric) => ({
        id: metric.id,
        node: (
          <Pressable
            onPress={() => onNavigate(metric.route)}
            accessibilityRole="button"
            accessibilityLabel={`${metric.label}: ${metric.value}`}
            testID={`healthos-assist-metric-${metric.id}`}
          >
            <HealthOSMetricCard
              label={metric.label}
              value={metric.value}
              subValue={metric.subValue}
              icon={metric.icon}
              accentColor={accentColor}
              variant={variant}
            />
          </Pressable>
        ),
      }))}
    />
  );
}

function LinkList({
  links,
  accentColor,
  onNavigate,
}: {
  links: AssistOperationsLink[];
  accentColor: string;
  onNavigate: (route: string) => void;
}) {
  return (
    <View style={styles.linkList}>
      {links.map((link, index) => (
        <PremiumListRow
          key={link.id}
          title={link.label}
          subtitle={link.description}
          leading={link.icon ? <Text style={styles.leadingIcon}>{link.icon}</Text> : undefined}
          trailing={
            link.count !== undefined ? (
              <Text style={[styles.countBadge, { color: accentColor }]}>{link.count}</Text>
            ) : undefined
          }
          showChevron
          showDivider={index < links.length - 1}
          onPress={() => onNavigate(link.route)}
        />
      ))}
    </View>
  );
}

function BlockerList({
  blockers,
  accentColor,
  onNavigate,
}: {
  blockers: AssistOperationsBlockerRow[];
  accentColor: string;
  onNavigate: (route?: string) => void;
}) {
  return (
    <View style={styles.linkList}>
      {blockers.map((blocker, index) => (
        <PremiumListRow
          key={blocker.id}
          title={blocker.label}
          trailing={
            <Text style={[styles.countBadge, { color: accentColor }]}>{blocker.count}</Text>
          }
          showChevron={Boolean(blocker.route)}
          showDivider={index < blockers.length - 1}
          onPress={() => onNavigate(blocker.route)}
        />
      ))}
    </View>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function HealthOSAssistOperationsView({
  stats,
  todayAssignments,
  activeExecutions,
  activeLoading,
  loading,
  error,
  displayName,
  onRefresh,
}: Props) {
  const router = useRouter();
  const { width } = useHydrationSafeWindowDimensions();
  const breakpoint = resolveHealthOSShellBreakpoint(width);
  const kpiColumns =
    breakpoint === 'mobile'
      ? { phone: 2, tablet: 2, desktop: 4, wide: 4 }
      : breakpoint === 'tablet'
        ? { phone: 2, tablet: 2, desktop: 3, wide: 3 }
        : { phone: 2, tablet: 2, desktop: 4, wide: 4 };
  const moduleAccent = useMainModuleAccent();
  const shellHostsAurora = useShellHostsAurora();
  const cardVariant = shellHostsAurora ? 'light' : 'glass';

  const navigate = (route?: string) => {
    if (route) router.push(route as never);
  };

  const model = useMemo(
    () =>
      stats
        ? buildAssistOperationsModel({
            stats,
            todayAssignments: todayAssignments ?? [],
            activeExecutions: activeExecutions ?? [],
            displayName,
          })
        : null,
    [stats, todayAssignments, activeExecutions, displayName],
  );

  if (loading && !stats) {
    return <HealthOSLoadingState message="Assist Operations wird geladen…" />;
  }

  if (error && !stats) {
    return (
      <HealthOSErrorState
        title="Assist Operations nicht verfügbar"
        message={error}
        onRetry={onRefresh}
      />
    );
  }

  if (!stats || !model) {
    return (
      <HealthOSEmptyState
        title="Keine Assist-Daten"
        message="Für Ihre Rolle sind aktuell keine Assist-Daten verfügbar."
        actionLabel="Erneut laden"
        onAction={onRefresh}
      />
    );
  }

  const hasBlockers = model.blockerZentrale.length > 0;
  const hasLiveOps = model.liveOperations.length > 0;

  return (
    <HealthOSPage scroll testID="healthos-assist-operations">
      {/* A: Einsatzbetrieb heute */}
      <HealthOSSection
        title="Einsatzbetrieb heute"
        subtitle={`${model.greetingLine} · Tagesübersicht`}
        accentColor={moduleAccent}
      >
        <MetricsSection
          metrics={model.einsatzbetriebHeute}
          accentColor={moduleAccent}
          variant={cardVariant}
          columns={kpiColumns}
          onNavigate={navigate}
        />
      </HealthOSSection>

      {/* B: Live Operations */}
      <HealthOSSection
        title="Live Operations"
        subtitle="Aktive Einsätze in Echtzeit"
        accentColor={moduleAccent}
      >
        {activeLoading && !hasLiveOps ? (
          <HealthOSLoadingState message="Live-Daten werden geladen…" />
        ) : hasLiveOps ? (
          <HealthOSCard variant="elevated">
            <View style={styles.liveList}>
              {model.liveOperations.map((row, index) => (
                <View key={row.assignmentId} style={styles.liveRow}>
                  <View style={styles.liveRowMain}>
                    <Text style={styles.liveRowTitle} numberOfLines={1}>
                      {row.title}
                    </Text>
                    <Text style={styles.liveRowSub} numberOfLines={1}>
                      {row.clientName} · {row.location}
                    </Text>
                  </View>
                  <View style={styles.liveRowBadge}>
                    <HealthOSStatusBadge
                      domain="assignment"
                      technicalValue={row.assignmentStatus}
                      label={row.phaseLabel}
                      dot
                    />
                  </View>
                  {index < model.liveOperations.length - 1 ? (
                    <View style={styles.divider} />
                  ) : null}
                </View>
              ))}
            </View>
          </HealthOSCard>
        ) : (
          <HealthOSEmptyState
            title="Keine aktiven Einsätze"
            message="Sobald Mitarbeitende Einsätze starten, erscheinen sie hier."
          />
        )}
      </HealthOSSection>

      {/* C: Nachweise & Qualität */}
      <HealthOSSection
        title="Nachweise & Qualität"
        subtitle="Freigaben, Signaturen und Portal-Sichtbarkeit"
        accentColor={moduleAccent}
      >
        <MetricsSection
          metrics={model.nachweiseQualitaet}
          accentColor={moduleAccent}
          variant={cardVariant}
          columns={{ phone: 2, tablet: 2, desktop: 4, wide: 4 }}
          onNavigate={navigate}
        />
      </HealthOSSection>

      {/* D: Budget Assist Summary */}
      <HealthOSSection
        title="Budget Assist Summary"
        subtitle="Lesende Übersicht — keine Buchungen möglich"
        accentColor={moduleAccent}
      >
        <HealthOSAlert
          variant="info"
          title="Budget-Daten nicht verfügbar"
          message="Budget-Informationen sind über die Klient:innenakte zugänglich. Im Assist-Dashboard werden keine aggregierten Budget-Daten angezeigt."
        />
        <MetricsSection
          metrics={model.budgetSummary}
          accentColor={moduleAccent}
          variant={cardVariant}
          columns={{ phone: 2, tablet: 2, desktop: 3, wide: 3 }}
          onNavigate={navigate}
        />
      </HealthOSSection>

      {/* E: Blocker / Qualitätszentrale */}
      <HealthOSSection
        title="Blocker / Qualitätszentrale"
        subtitle="Offene Vorgänge mit Handlungsbedarf"
        accentColor={moduleAccent}
      >
        {hasBlockers ? (
          <>
            <HealthOSAlert
              variant="warning"
              title="Offene Vorgänge"
              message="Prüfen Sie fehlende Dokumentation, ausstehende Signaturen oder Leistungsnachweise."
            />
            <BlockerList
              blockers={model.blockerZentrale}
              accentColor={moduleAccent}
              onNavigate={navigate}
            />
          </>
        ) : (
          <HealthOSEmptyState
            title="Keine offenen Blocker"
            message="Alle Einsätze sind dokumentiert oder es liegen keine Meldungen vor."
          />
        )}
      </HealthOSSection>

      {/* F: Schnellzugriffe */}
      <HealthOSSection
        title="Schnellzugriffe"
        subtitle="Bestehende Assist-Bereiche"
        accentColor={moduleAccent}
      >
        <LinkList links={model.schnellzugriffe} accentColor={moduleAccent} onNavigate={navigate} />
      </HealthOSSection>
    </HealthOSPage>
  );
}

const styles = StyleSheet.create({
  linkList: {
    gap: spacing.xs,
  },
  countBadge: {
    ...typography.caption,
    fontWeight: '700',
    minWidth: 24,
    textAlign: 'right',
  },
  leadingIcon: {
    fontSize: 18,
    width: 28,
    textAlign: 'center',
  },
  liveList: {
    gap: spacing.xs,
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  liveRowMain: {
    flex: 1,
    gap: 2,
  },
  liveRowTitle: {
    ...typography.bodySmall,
    fontWeight: '600',
  },
  liveRowSub: {
    ...typography.caption,
    opacity: 0.7,
  },
  liveRowBadge: {
    alignItems: 'flex-end',
  },
  divider: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
});
