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
  SectionPanel,
  SuccessState,
  Timeline,
} from '@/components/ui';
import type { DashboardQuickAction, DashboardSnapshot } from '@/types/dashboard';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { SENSITIVITY_LABELS } from '@/types/portal/visibility';
import { colors, spacing, typography } from '@/theme';
import { DashboardHero } from './DashboardHero';

type DashboardHeroProps = {
  snapshot: DashboardSnapshot;
  displayName: string;
  onPrimaryAction?: (action: DashboardQuickAction) => void;
};

type DashboardViewProps = {
  snapshot: DashboardSnapshot | null;
  loading: boolean;
  error: string | null;
  displayName: string;
  onRefresh: () => void;
  footer?: React.ReactNode;
  showSuccess?: boolean;
  HeroComponent?: React.ComponentType<DashboardHeroProps>;
};

export function DashboardView({
  snapshot,
  loading,
  error,
  displayName,
  onRefresh,
  footer,
  showSuccess = false,
  HeroComponent,
}: DashboardViewProps) {
  const router = useRouter();
  const Hero = HeroComponent ?? DashboardHero;

  const handleAction = (action: DashboardQuickAction) => {
    if (action.route) {
      router.push(action.route as never);
    }
  };

  if (loading && !snapshot) {
    return <LoadingState message="Dashboard wird geladen…" />;
  }

  if (error && !snapshot) {
    return (
      <ErrorState
        title="Dashboard nicht verfügbar"
        message={error}
        onRetry={onRefresh}
      />
    );
  }

  if (!snapshot) {
    return (
      <EmptyState
        title="Keine Dashboard-Daten"
        message="Für Ihre Rolle sind aktuell keine Übersichtsdaten verfügbar."
        actionLabel="Erneut laden"
        onAction={onRefresh}
      />
    );
  }

  return (
    <View style={styles.container}>
      {showSuccess ? (
        <SuccessState message="Dashboard erfolgreich aktualisiert." />
      ) : null}

      <Hero
        snapshot={snapshot}
        displayName={displayName}
        onPrimaryAction={handleAction}
      />

      <SectionPanel title="Kennzahlen" subtitle="Aktuelle Übersicht Ihres Mandanten">
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
                pulse={kpi.id === 'kpi-assignments' || kpi.id === 'kpi-my-assignments'}
              />
            ),
          }))}
        />
      </SectionPanel>

      <SectionPanel title="Status & Vorgänge" subtitle="Was braucht Ihre Aufmerksamkeit?">
        <View style={styles.statusList}>
          {snapshot.statusCards.map((card) => (
            <PremiumCard key={card.id} accentColor={colors.orange}>
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
                  <PremiumBadge
                    label={SENSITIVITY_LABELS[card.sensitivity]}
                    variant="cyan"
                  />
                ) : null}
              </View>
            </PremiumCard>
          ))}
        </View>
      </SectionPanel>

      <SectionPanel title="Schnellaktionen" subtitle="Häufige Aufgaben">
        <View style={styles.actions}>
          {snapshot.quickActions.map((action) => (
            <PremiumButton
              key={action.id}
              title={`${action.icon} ${action.label}`}
              variant={action.variant ?? 'secondary'}
              size="sm"
              onPress={() => handleAction(action)}
            />
          ))}
        </View>
      </SectionPanel>

      <SectionPanel title="Letzte Aktivitäten" subtitle="Chronologischer Verlauf">
        <Timeline items={snapshot.activities} />
        <PremiumButton
          title="Aktualisieren"
          variant="ghost"
          size="sm"
          onPress={onRefresh}
        />
      </SectionPanel>

      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
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
    flex: 1,
  },
  statusCount: {
    ...typography.h3,
    color: colors.orange,
  },
  statusDesc: {
    ...typography.caption,
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
});
