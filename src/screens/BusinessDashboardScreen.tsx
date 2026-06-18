import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CareLightModuleDashboard, CareLightScreen } from '@/components/layout';
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
import { useAuth } from '@/lib/auth/context';
import { wp138A11y } from '@/lib/a11y/wp138-business';
import type { DashboardQuickAction } from '@/types/dashboard';

const BUSINESS_QUICK_TILES = [
  {
    id: 'office',
    title: 'CareSuite+ Office',
    description: 'Klient:innen, Team, Rechnungen, Termine',
    route: '/office',
    icon: '🏢',
    accentColor: '#FF7A1A',
  },
  {
    id: 'modules',
    title: 'Module verwalten',
    description: 'Free Platform — Modulstatus & Rechte',
    route: '/business/modules',
    icon: '🧩',
    accentColor: '#22C55E',
  },
  {
    id: 'pflege',
    title: 'Pflege',
    description: 'Pflegepläne, Vitalwerte, Medikation',
    route: '/pflege',
    icon: '💊',
    accentColor: '#22C55E',
  },
  {
    id: 'assist',
    title: 'Assist',
    description: 'Einsätze, Durchführung, Fahrten',
    route: '/assist',
    icon: '🤝',
    accentColor: '#0EA5E9',
  },
] as const;

export function BusinessDashboardScreen() {
  const router = useRouter();
  const { profile, signOut, user } = useAuth();
  const { data, loading, error, refresh } = useDashboard('business');
  const [showSuccess, setShowSuccess] = useState(false);
  const businessAccent = moduleColor('office');

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
            {data.quickActions.map((action) => (
              <CareLightButton
                key={action.id}
                title={`${action.icon} ${action.label}`}
                variant={action.variant === 'primary' ? 'primary' : 'secondary'}
                onPress={() => handleAction(action)}
                accentColor={businessAccent}
              />
            ))}
            {BUSINESS_QUICK_TILES.map((tile) => (
              <CareLightModuleTile
                key={tile.id}
                icon={tile.icon}
                title={tile.title}
                description={tile.description}
                accentColor={tile.accentColor}
                isActive
                onPress={() => router.push(tile.route as never)}
              />
            ))}
            <CareLightButton
              title="Abmelden"
              variant="ghost"
              onPress={() => signOut().then(() => router.replace('/' as never))}
              accentColor={careLightColors.muted}
            />
          </View>
        }
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
