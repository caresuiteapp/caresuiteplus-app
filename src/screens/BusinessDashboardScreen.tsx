import { useState, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CareLightModuleDashboard, CareLightScreen } from '@/components/layout';
import { GuidedTourOverlay } from '@/components/onboarding/GuidedTourOverlay';
import {
  CareLightButton,
  CareLightEmptyState,
  CareLightErrorState,
  CareLightModuleTile,
  SuccessState,
  Timeline,
} from '@/components/ui';
import { careLightColors } from '@/design/tokens/lightTheme';
import { moduleColor } from '@/design/tokens/modules';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { useDashboard } from '@/hooks/useDashboard';
import { useBusinessDashboardTour } from '@/hooks/useBusinessDashboardTour';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { MODULE_NAV_CONFIG } from '@/data/demo/navigation';
import { PRODUCT_LABELS } from '@/data/demo/products';
import { resolveModuleNavState } from '@/lib/modules/moduleVisibilityService';
import { wp138A11y } from '@/lib/a11y/wp138-business';
import type { DashboardQuickAction } from '@/types/dashboard';
import type { ProductKey } from '@/types';

const DASHBOARD_MODULE_TILES: ProductKey[] = ['office', 'pflege', 'assist'];

export function BusinessDashboardScreen() {
  const router = useRouter();
  const { profile, signOut, user } = useAuth();
  const tenantId = useServiceTenantId();
  const { data, loading, error, refresh, isEmpty } = useDashboard('business');
  const [showSuccess, setShowSuccess] = useState(false);
  const businessAccent = moduleColor('office');

  const tour = useBusinessDashboardTour({
    ready: Boolean(data) && !loading,
    isEmptyTenant: isEmpty,
  });

  const moduleTiles = useMemo(() => {
    const context = { tenantId, roleKey: profile?.roleKey ?? null };
    type DashboardTile = {
      id: string;
      title: string;
      description: string;
      route: string;
      icon: string;
      accentColor: string;
      navState: ReturnType<typeof resolveModuleNavState>;
    };

    const tiles: DashboardTile[] = DASHBOARD_MODULE_TILES.map((key) => {
      const config = MODULE_NAV_CONFIG[key];
      const navState = resolveModuleNavState(key, context);
      return {
        id: key,
        title: PRODUCT_LABELS[key],
        description: config.description,
        route: config.path,
        icon: config.icon,
        accentColor: config.accentColor,
        navState,
      };
    }).filter((tile) => tile.navState.isVisible);

    const modulesHub = resolveModuleNavState('modules_hub', context);
    if (modulesHub.isVisible) {
      tiles.push({
        id: 'modules_hub',
        title: 'Module verwalten',
        description: 'Modulstatus & Rechte',
        route: '/business/modules',
        icon: '🧩',
        accentColor: '#22C55E',
        navState: modulesHub,
      });
    }

    return tiles;
  }, [tenantId, profile?.roleKey]);

  const displayName = profile?.displayName ?? user?.displayName ?? 'Willkommen';

  const handleRefresh = async () => {
    await refresh();
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  };

  const handleAction = (action: DashboardQuickAction) => {
    if (action.route) {
      router.push(action.route as never);
    }
  };

  if (loading && !data) {
    return (
      <CareLightScreen>
        <Text style={styles.loading}>Dashboard wird geladen…</Text>
      </CareLightScreen>
    );
  }

  if (error && !data) {
    return (
      <CareLightScreen>
        <CareLightErrorState message={error} onRetry={refresh} />
      </CareLightScreen>
    );
  }

  if (!data) {
    return (
      <CareLightScreen>
        <CareLightEmptyState
          title="Keine Dashboard-Daten"
          message="Für Ihre Rolle sind aktuell keine Übersichtsdaten verfügbar."
          actionLabel="Erneut laden"
          onAction={refresh}
          accentColor={businessAccent}
        />
      </CareLightScreen>
    );
  }

  const kpis = data.kpis.map((kpi) => ({
    id: kpi.id,
    label: kpi.label,
    value: String(kpi.value),
    subValue: kpi.subValue,
    icon: kpi.icon,
    accentColor: kpi.accentColor ?? businessAccent,
  }));

  return (
    <CareLightScreen>
      {showSuccess ? <SuccessState message="Dashboard erfolgreich aktualisiert." /> : null}
      <CareLightModuleDashboard
        moduleKey="office"
        subtitle={`${data.greeting}, ${displayName} · ${data.tenantName}`}
        kpis={kpis}
        recentTitle="Letzte Aktivitäten"
        recentSubtitle="Chronologischer Verlauf"
        sectionRefs={{
          header: tour.refs.welcome,
          kpis: tour.refs.kpis,
        }}
        recentSection={
          <>
            <Timeline items={data.activities} />
            <CareLightButton
              title="Aktualisieren"
              variant="ghost"
              onPress={handleRefresh}
              accentColor={businessAccent}
            />
            <CareLightButton
              title={`${data.primaryAction.icon} ${data.primaryAction.label}`}
              onPress={() => handleAction(data.primaryAction)}
              accentColor={businessAccent}
            />
          </>
        }
        quickActions={
          <View style={styles.quickGrid}>
            <View ref={tour.refs.quickActions} collapsable={false} style={styles.quickGrid}>
              {data.quickActions.map((action) => {
                const isClientAction =
                  action.id === 'qa-client' || action.route === '/office/clients';
                return (
                  <View
                    key={action.id}
                    ref={isClientAction ? tour.refs.firstClient : undefined}
                    collapsable={false}
                  >
                    <CareLightButton
                      title={`${action.icon} ${action.label}`}
                      variant={action.variant === 'primary' ? 'primary' : 'secondary'}
                      onPress={() => handleAction(action)}
                      accentColor={businessAccent}
                    />
                  </View>
                );
              })}
            </View>
            <View ref={tour.refs.modules} collapsable={false} style={styles.quickGrid}>
              {moduleTiles.map((tile) => (
                <CareLightModuleTile
                  key={tile.id}
                  icon={tile.icon}
                  title={tile.title}
                  description={tile.description}
                  accentColor={tile.accentColor}
                  isActive={tile.navState.isNavigable}
                  preparedOnly={tile.navState.effectiveStatus === 'coming_soon'}
                  onPress={
                    tile.navState.isNavigable
                      ? () => router.push(tile.route as never)
                      : undefined
                  }
                />
              ))}
            </View>
            {tour.tourFinished ? (
              <CareLightButton
                title="Tour starten"
                variant="ghost"
                onPress={tour.startTour}
                accentColor={businessAccent}
              />
            ) : null}
            <CareLightButton
              title="Abmelden"
              variant="ghost"
              onPress={() => signOut().then(() => router.replace('/' as never))}
              accentColor={careLightColors.muted}
            />
          </View>
        }
      />
      <GuidedTourOverlay
        visible={tour.visible}
        step={tour.currentStep}
        stepIndex={tour.stepIndex}
        totalSteps={tour.totalSteps}
        targetLayout={tour.targetLayout}
        accentColor={businessAccent}
        onNext={tour.onNext}
        onSkip={tour.onSkip}
        onCta={tour.currentStep.ctaRoute ? tour.onCta : undefined}
      />
      <View
        accessible
        accessibilityLabel={`${wp138A11y.screenLabel} · WP ${wp138A11y.wpNumber}`}
        accessibilityRole={wp138A11y.headingRole}
        style={styles.a11yAnchor}
      />
    </CareLightScreen>
  );
}

const styles = StyleSheet.create({
  quickGrid: { gap: careSpacing.md },
  loading: {
    ...careTypography.body,
    color: careLightColors.muted,
    textAlign: 'center',
    paddingVertical: careSpacing.xl,
  },
  a11yAnchor: { height: 0, width: 0 },
});
