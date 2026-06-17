import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { CareLightModuleDashboard, CareLightScreen } from '@/components/layout';
import {
  CareLightButton,
  CareLightEmptyState,
  CareLightErrorState,
  CareLightModuleTile,
  EmptyState,
  ErrorState,
  InfoBanner,
  LoadingState,
  Timeline,
} from '@/components/ui';
import { OFFICE_AREA_SHORTCUTS } from '@/data/demo/officeDashboard';
import { moduleColor } from '@/design/tokens/modules';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { useOfficeDashboard } from '@/hooks/useOfficeDashboard';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { fetchOfficeDashboard } from '@/lib/office/officeDashboardService';
import { wp158A11y } from '@/lib/a11y/wp158-office';
import {
  isOfficeDashboardLiveReady,
  OFFICE_DASHBOARD_PREPARED_MESSAGE,
} from '@/lib/office/officeModuleConfig';
import type { DashboardQuickAction } from '@/types/dashboard';

export function OfficeIndexScreen() {
  const router = useRouter();
  const { profile, user } = useAuth();
  const { roleLabel } = usePermissions();
  const { data, loading, error, refresh } = useOfficeDashboard();
  const officeAccent = moduleColor('office');

  const displayName = profile?.displayName ?? user?.displayName ?? 'Verwaltung';

  const handlePrimaryAction = (action: DashboardQuickAction) => {
    if (action.route) {
      router.push(action.route as never);
    }
  };

  if (loading && !data) {
    return (
      <CareLightScreen>
        <LoadingState message="Office-Dashboard wird geladen…" />
      </CareLightScreen>
    );
  }

  if (error && !data) {
    return (
      <CareLightScreen>
        <ErrorState message={error} onRetry={refresh} />
      </CareLightScreen>
    );
  }

  if (!data) {
    return (
      <CareLightScreen>
        <EmptyState
          title="Keine Dashboard-Daten"
          message="Für Ihre Rolle sind aktuell keine Office-Übersichtsdaten verfügbar."
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
    accentColor: kpi.accentColor ?? officeAccent,
  }));

  return (
    <CareLightScreen>
      {!isOfficeDashboardLiveReady() ? (
        <InfoBanner title="Dashboard Demo-Daten" message={OFFICE_DASHBOARD_PREPARED_MESSAGE} />
      ) : null}
      <CareLightModuleDashboard
        moduleKey="office"
        subtitle={`${data.greeting}, ${displayName} · ${roleLabel ?? 'Demo'}`}
        kpis={kpis}
        recentTitle="Letzte Aktivitäten"
        recentSubtitle="Chronologischer Verlauf"
        recentSection={
          <>
            <Timeline items={data.activities} />
            <CareLightButton title="Aktualisieren" variant="ghost" onPress={refresh} accentColor={officeAccent} />
            <CareLightButton
              title={`${data.primaryAction.icon} ${data.primaryAction.label}`}
              onPress={() => handlePrimaryAction(data.primaryAction)}
              accentColor={officeAccent}
            />
          </>
        }
        quickActions={
          <View style={styles.quickGrid}>
            {OFFICE_AREA_SHORTCUTS.map((area) => (
              <CareLightModuleTile
                key={area.id}
                icon={area.icon}
                title={area.label}
                description={area.description}
                accentColor={area.accentColor ?? officeAccent}
                isActive
                onPress={() => router.push(area.href as never)}
              />
            ))}
          </View>
        }
      />
      <View
        accessible
        accessibilityLabel={`${wp158A11y.screenLabel} · WP ${wp158A11y.wpNumber}`}
        accessibilityRole={wp158A11y.headingRole}
        style={styles.a11yAnchor}
      />
    </CareLightScreen>
  );
}

const styles = StyleSheet.create({
  quickGrid: { gap: careSpacing.md },
  loading: { ...careTypography.body, color: careLightColors.muted, textAlign: 'center', paddingVertical: careSpacing.xl },
  a11yAnchor: { height: 0, width: 0 },
});
