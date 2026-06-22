import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { AdaptiveKpiGrid } from '@/components/adaptive';
import { ModuleOverviewDashboard } from '@/components/dashboard/ModuleOverviewDashboard';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumKpiCard,
  SectionPanel,
} from '@/components/ui';
import type { DashboardSnapshot } from '@/types/dashboard';
import { useShellHostsAurora } from '@/hooks/useshellhostsaurora';
import { useMainModuleAccent } from '@/hooks/useMainModuleAccent';
import { spacing } from '@/theme';

type OfficeDashboardViewProps = {
  snapshot: DashboardSnapshot | null;
  loading: boolean;
  error: string | null;
  displayName: string;
  onRefresh: () => void;
};

function createOfficeDashboardStyles(shellHostsAurora: boolean) {
  return StyleSheet.create({
    container: {
      width: '100%',
      flexGrow: 1,
      gap: spacing.md,
      backgroundColor: shellHostsAurora ? 'transparent' : undefined,
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
  const shellHostsAurora = useShellHostsAurora();
  const moduleAccent = useMainModuleAccent();
  const styles = useMemo(
    () => createOfficeDashboardStyles(shellHostsAurora),
    [shellHostsAurora],
  );

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

  return (
    <View style={styles.container}>
      <SectionPanel
        title="Zentrale Dashboard"
        subtitle="Live Mandantenübersicht"
        headerAlign="center"
        headerVariant="hero"
        accentColor={moduleAccent}
        fillHeight={Boolean(snapshot.moduleOverviewRows)}
        surface="open"
      >
        {snapshot.moduleOverviewRows ? (
          <ModuleOverviewDashboard rows={snapshot.moduleOverviewRows} />
        ) : (
          <AdaptiveKpiGrid
            columns={{ phone: 2, tablet: 2, desktop: 4, wide: 4 }}
            items={snapshot.kpis.map((kpi) => ({
              id: kpi.id,
              node: (
                <PremiumKpiCard
                  label={kpi.label}
                  value={kpi.value}
                  subValue={kpi.subValue}
                  icon={kpi.icon}
                  accentColor={moduleAccent}
                  trend={kpi.trend}
                  trendValue={kpi.trendValue}
                />
              ),
            }))}
          />
        )}
      </SectionPanel>
    </View>
  );
}
