import { useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useAiPageContext } from '@/ai/useAiPageContext';
import { breakpoints } from '@/design/tokens/breakpoints';
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
  const { width } = useWindowDimensions();
  /** Tablet+ uses the module-rail-aligned column layout (see kpiCenter). */
  const alignKpiWithModuleRail = width >= breakpoints.tablet;

  const displayName = profile?.displayName ?? user?.displayName ?? 'Willkommen';

  useAiPageContext({
    pageTitle: 'Business Dashboard',
    entityType: 'dashboard',
    summary: `Dashboard für ${displayName}`,
  });

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: alignKpiWithModuleRail
          ? {
              flex: 1,
              minHeight: 0,
              backgroundColor: shellHostsAurora ? 'transparent' : undefined,
            }
          : {
              gap: careSpacing.sm,
              backgroundColor: shellHostsAurora ? 'transparent' : undefined,
            },
        /** Hero overlays the top — same role as the rail logo; must not push KPI down in the flex column. */
        heroOverlay: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          alignItems: 'center',
          zIndex: 1,
        },
        /**
         * Vertically centers Kennzahlen Übersicht in the main work area below the topbar,
         * mirroring MainModuleRail scroll (flexGrow + justifyContent: 'center') for the icon stack.
         * "Menü" = left module icon rail, not the right Übersicht sidebar.
         */
        kpiCenter: {
          flex: 1,
          justifyContent: 'center',
          minHeight: 0,
        },
        loading: {
          ...careTypography.body,
          color: careLightColors.muted,
          textAlign: 'center',
          paddingVertical: careSpacing.xl,
        },
        a11yAnchor: { height: 0, width: 0 },
      }),
    [alignKpiWithModuleRail, shellHostsAurora],
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
      <View
        style={alignKpiWithModuleRail ? styles.heroOverlay : undefined}
        pointerEvents="box-none"
      >
        <ZentraleDashboardHero
          greeting={data.greeting}
          displayName={displayName}
          tenantName={data.tenantName}
          subtitle={data.heroSubtitle}
        />
      </View>
      <View style={alignKpiWithModuleRail ? styles.kpiCenter : undefined}>
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
