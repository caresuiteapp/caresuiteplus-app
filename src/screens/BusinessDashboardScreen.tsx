import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { AdaptiveKpiGrid } from '@/components/adaptive';
import { ZentraleDashboardHero } from '@/components/dashboard/ZentraleDashboardHero';
import {
  CareLightEmptyState,
  CareLightErrorState,
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumKpiCard,
  SectionPanel,
} from '@/components/ui';
import { careLightColors } from '@/design/tokens/lightTheme';
import { moduleColor } from '@/design/tokens/modules';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { useShellHostsAurora } from '@/hooks/useshellhostsaurora';
import { useDashboard } from '@/hooks/useDashboard';
import { useAuth } from '@/lib/auth/context';
import { wp138A11y } from '@/lib/a11y/wp138-business';
import { Text } from 'react-native';

export function BusinessDashboardScreen() {
  const { profile, user } = useAuth();
  const { data, loading, error, refresh } = useDashboard('business');
  const shellHostsAurora = useShellHostsAurora();
  const businessAccent = moduleColor('office');

  const displayName = profile?.displayName ?? user?.displayName ?? 'Willkommen';

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          gap: careSpacing.md,
          backgroundColor: shellHostsAurora ? 'transparent' : undefined,
        },
        /** Align KPI heading with sidebar Übersicht group (tenant + heute + schnellaktionen ≈ 96px). */
        kpiSection: {
          marginTop: careSpacing.xxl * 2,
        },
        loading: {
          ...careTypography.body,
          color: careLightColors.muted,
          textAlign: 'center',
          paddingVertical: careSpacing.xl,
        },
        a11yAnchor: { height: 0, width: 0 },
      }),
    [shellHostsAurora],
  );

  if (loading && !data) {
    if (shellHostsAurora) {
      return <LoadingState message="Dashboard wird geladen…" />;
    }
    return <Text style={styles.loading}>Dashboard wird geladen…</Text>;
  }

  if (error && !data) {
    if (shellHostsAurora) {
      return <ErrorState title="Dashboard nicht verfügbar" message={error} onRetry={refresh} />;
    }
    return <CareLightErrorState message={error} onRetry={refresh} />;
  }

  if (!data) {
    if (shellHostsAurora) {
      return (
        <EmptyState
          title="Keine Dashboard-Daten"
          message="Für Ihre Rolle sind aktuell keine Übersichtsdaten verfügbar."
          actionLabel="Erneut laden"
          onAction={refresh}
        />
      );
    }
    return (
      <CareLightEmptyState
        title="Keine Dashboard-Daten"
        message="Für Ihre Rolle sind aktuell keine Übersichtsdaten verfügbar."
        actionLabel="Erneut laden"
        onAction={refresh}
        accentColor={businessAccent}
      />
    );
  }

  return (
    <View style={styles.root}>
      <ZentraleDashboardHero
        greeting={data.greeting}
        displayName={displayName}
        tenantName={data.tenantName}
        subtitle={data.heroSubtitle}
      />
      <View style={styles.kpiSection}>
        <SectionPanel title="Kennzahlen Übersicht" subtitle="Live Mandantenübersicht">
          <AdaptiveKpiGrid
            columns={{ phone: 2, tablet: 2, desktop: 4, wide: 4 }}
            items={data.kpis.map((kpi) => ({
              id: kpi.id,
              node: (
                <PremiumKpiCard
                  label={kpi.label}
                  value={kpi.value}
                  subValue={kpi.subValue}
                  icon={kpi.icon}
                  accentColor={kpi.accentColor ?? businessAccent}
                  trend={kpi.trend}
                  trendValue={kpi.trendValue}
                />
              ),
            }))}
          />
        </SectionPanel>
      </View>
      <View
        accessible
        accessibilityLabel={`${wp138A11y.screenLabel} · WP ${wp138A11y.wpNumber}`}
        accessibilityRole={wp138A11y.headingRole}
        style={styles.a11yAnchor}
      />
    </View>
  );
}
