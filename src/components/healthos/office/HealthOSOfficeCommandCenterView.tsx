import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
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
} from '@/components/healthos';
import { resolveHealthOSShellBreakpoint } from '@/components/healthos/shell/healthosShellLayoutRules';
import { PremiumListRow, Timeline } from '@/components/ui';
import type { DashboardSnapshot } from '@/types/dashboard';
import { useMainModuleAccent } from '@/hooks/useMainModuleAccent';
import { useShellHostsAurora } from '@/hooks/useshellhostsaurora';
import {
  buildOfficeCommandCenterModel,
  type OfficeCommandCenterMetric,
} from '@/lib/office/officeCommandCenterModel';
import { spacing, typography } from '@/theme';

type Props = {
  snapshot: DashboardSnapshot | null;
  loading: boolean;
  error: string | null;
  displayName: string;
  onRefresh: () => void;
};

function MetricsSection({
  metrics,
  accentColor,
  variant,
  columns,
  onNavigate,
}: {
  metrics: OfficeCommandCenterMetric[];
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
            testID={`healthos-cc-metric-${metric.id}`}
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
  links: { id: string; label: string; description?: string; route: string; count?: number; icon?: string }[];
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

export function HealthOSOfficeCommandCenterView({
  snapshot,
  loading,
  error,
  displayName,
  onRefresh,
}: Props) {
  const router = useRouter();
  const { width } = useWindowDimensions();
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
    () => (snapshot ? buildOfficeCommandCenterModel(snapshot, displayName) : null),
    [snapshot, displayName],
  );

  if (loading && !snapshot) {
    return <HealthOSLoadingState message="Command Center wird geladen…" />;
  }

  if (error && !snapshot) {
    return (
      <HealthOSErrorState title="Command Center nicht verfügbar" message={error} onRetry={onRefresh} />
    );
  }

  if (!snapshot || !model) {
    return (
      <HealthOSEmptyState
        title="Keine Übersichtsdaten"
        message="Für Ihre Rolle sind aktuell keine Office-Daten verfügbar."
        actionLabel="Erneut laden"
        onAction={onRefresh}
      />
    );
  }

  const hasBlockers = model.qualityBlockers.length > 0;

  return (
    <HealthOSPage scroll testID="healthos-office-command-center">
      <HealthOSSection
        title="Betriebsstatus heute"
        subtitle={`${model.greetingLine} · Steuerungszentrale`}
        accentColor={moduleAccent}
      >
        <MetricsSection
          metrics={model.operationsToday}
          accentColor={moduleAccent}
          variant={cardVariant}
          columns={kpiColumns}
          onNavigate={navigate}
        />
      </HealthOSSection>

      <HealthOSSection
        title="Qualitäts- und Blockerzentrum"
        subtitle="Offene Vorgänge mit Handlungsbedarf"
        accentColor={moduleAccent}
      >
        {hasBlockers ? (
          <>
            {model.qualityBlockers.some((b) => b.id === 'blocker-aggregate') ? (
              <HealthOSAlert
                variant="warning"
                title="Einsatz-Blocker offen"
                message="Prüfen Sie fehlende Dokumentation, Nachweise oder Sync-Vorgänge."
              />
            ) : null}
            <LinkList
              links={model.qualityBlockers.filter((b): b is typeof b & { route: string } => Boolean(b.route))}
              accentColor={moduleAccent}
              onNavigate={navigate}
            />
          </>
        ) : (
          <HealthOSEmptyState
            title="Keine offenen Blocker"
            message="Alle Einsätze sind dokumentiert oder es liegen noch keine Meldungen vor."
          />
        )}
      </HealthOSSection>

      <HealthOSSection title="Budget Health Summary" subtitle="Nur Übersicht — keine Buchungen" accentColor={moduleAccent}>
        <MetricsSection
          metrics={model.budgetSummary}
          accentColor={moduleAccent}
          variant={cardVariant}
          columns={{ phone: 2, tablet: 2, desktop: 3, wide: 3 }}
          onNavigate={navigate}
        />
      </HealthOSSection>

      <HealthOSSection title="Workforce / Zeitkonto" subtitle="Lesende Übersicht" accentColor={moduleAccent}>
        <MetricsSection
          metrics={model.workforceSummary}
          accentColor={moduleAccent}
          variant={cardVariant}
          columns={{ phone: 2, tablet: 2, desktop: 2, wide: 2 }}
          onNavigate={navigate}
        />
      </HealthOSSection>

      <HealthOSSection title="Nachweise & Dokumente" subtitle="Freigaben und Portal-Sichtbarkeit" accentColor={moduleAccent}>
        <MetricsSection
          metrics={model.proofDocuments}
          accentColor={moduleAccent}
          variant={cardVariant}
          columns={{ phone: 2, tablet: 2, desktop: 3, wide: 3 }}
          onNavigate={navigate}
        />
      </HealthOSSection>

      <HealthOSSection title="Schnellzugriffe" subtitle="Bestehende Office-Bereiche" accentColor={moduleAccent}>
        <LinkList links={model.quickAccess} accentColor={moduleAccent} onNavigate={navigate} />
      </HealthOSSection>

      <HealthOSSection title="Letzte Aktivitäten" subtitle="Chronologischer Verlauf">
        {snapshot.activities.length > 0 ? (
          <HealthOSCard variant="elevated">
            <Timeline items={snapshot.activities} />
          </HealthOSCard>
        ) : (
          <HealthOSEmptyState
            title="Noch keine Aktivitäten"
            message="Sobald Klient:innen, Dokumente oder Vorgänge bearbeitet werden, erscheinen sie hier."
          />
        )}
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
});
