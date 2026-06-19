import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { AdaptiveKpiGrid } from '@/components/adaptive';
import { ZentraleDashboardHero } from '@/components/dashboard/ZentraleDashboardHero';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumKpiCard,
  SectionPanel,
} from '@/components/ui';
import type { DashboardSnapshot } from '@/types/dashboard';
import { useShellHostsAurora } from '@/hooks/useshellhostsaurora';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
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
  const { colors } = useLegacyTheme();
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
      <ZentraleDashboardHero
        greeting={snapshot.greeting}
        displayName={displayName}
        tenantName={snapshot.tenantName}
        subtitle={snapshot.heroSubtitle}
      />
      <SectionPanel title="Kennzahlen Übersicht" subtitle="Live Mandantenübersicht">
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
                accentColor={kpi.accentColor ?? colors.orange}
                trend={kpi.trend}
                trendValue={kpi.trendValue}
              />
            ),
          }))}
        />
      </SectionPanel>
    </View>
  );
}
