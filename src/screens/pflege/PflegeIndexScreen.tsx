import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  CareLightModuleDashboard,
  CareLightScreen,
} from '@/components/layout';
import { CareLightCarePlanCard } from '@/components/pflege/CareLightCarePlanCard';
import {
  CareLightModuleTile,
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/ui';
import { moduleColor } from '@/design/tokens/modules';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { usePflegeDashboard } from '@/hooks/usePflegeDashboard';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { buildPflegeDashboardKpis } from '@/lib/pflege/pflegeDashboardStats';
import {
  isCareDocumentationLiveReady,
  isMedicationLiveReady,
  isPflegeReportsLiveReady,
  isPflegeSettingsLiveReady,
  isShiftScheduleLiveReady,
  isSisLiveReady,
  isVitalReadingsLiveReady,
  isWoundDocumentationLiveReady,
} from '@/lib/pflege/pflegeModuleConfig';
import { fetchPflegeDashboardStats } from '@/lib/pflege/carePlanListService';
import { wp378A11y } from '@/lib/a11y/wp378-pflege';

function tilePreparedOnly(liveReady: boolean): boolean | undefined {
  return liveReady ? undefined : true;
}

export function PflegeIndexScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { can, roleLabel, isReadOnly } = usePermissions();
  const pflegeAccent = moduleColor('pflege');
  const {
    stats,
    activePlans,
    loading,
    error,
    refresh,
  } = usePflegeDashboard();

  if (loading && !stats) {
    return (
      <CareLightScreen>
        <LoadingState message="Dashboard wird geladen…" />
      </CareLightScreen>
    );
  }

  if (error && !stats) {
    return (
      <CareLightScreen>
        <ErrorState message={error} onRetry={refresh} />
      </CareLightScreen>
    );
  }

  const kpis = stats
    ? buildPflegeDashboardKpis(stats, 'light').map((kpi) => ({
        id: kpi.id,
        label: kpi.label,
        value: kpi.value,
        subValue: kpi.subValue,
        icon: kpi.icon,
        accentColor: kpi.accentColor ?? pflegeAccent,
      }))
    : [];

  return (
    <CareLightScreen>
      <CareLightModuleDashboard
        moduleKey="pflege"
        subtitle={`Ambulante Pflege · ${roleLabel ?? 'Demo'}${isReadOnly ? ' · Lesemodus' : ''}`}
        kpis={kpis}
        kpiTitle="Pflege-Kennzahlen"
        recentTitle="Aktive Pflegepläne"
        recentSubtitle="Zuletzt aktualisiert"
        recentSection={
          activePlans.length === 0 ? (
            <EmptyState
              title="Keine aktiven Pläne"
              message="Derzeit sind keine aktiven Pflegepläne hinterlegt."
              actionLabel="Alle Pflegepläne anzeigen"
              onAction={() => router.push('/pflege/plans' as never)}
            />
          ) : (
            activePlans.slice(0, 4).map((plan) => (
              <CareLightCarePlanCard
                key={plan.id}
                plan={plan}
                accentColor={pflegeAccent}
                onOpen={() => router.push(`/pflege/plans/${plan.id}` as never)}
              />
            ))
          )
        }
        quickActions={
          <View style={styles.quickGrid}>
            {can('pflege.plans.view') ? (
              <CareLightModuleTile
                icon="📋"
                title="Pflegepläne"
                description="Suche, Filter und Status"
                accentColor={pflegeAccent}
                isActive
                onPress={() => router.push('/pflege/plans' as never)}
              />
            ) : null}
            {can('pflege.vitals.view') ? (
              <CareLightModuleTile
                icon="❤️"
                title="Vitalwerte"
                description="Messungen und Fälligkeiten"
                accentColor={moduleColor('assist')}
                isActive
                preparedOnly={tilePreparedOnly(isVitalReadingsLiveReady())}
                onPress={() => router.push('/pflege/vitalwerte' as never)}
              />
            ) : null}
            {can('pflege.plans.view') ? (
              <CareLightModuleTile
                icon="💊"
                title="Medikation"
                description="Verordnungen und Einnahmezeiten"
                accentColor={moduleColor('assist')}
                preparedOnly={tilePreparedOnly(isMedicationLiveReady())}
                onPress={() => router.push('/pflege/medikation' as never)}
              />
            ) : null}
            {can('pflege.plans.view') ? (
              <CareLightModuleTile
                icon="🩹"
                title="Wunddokumentation"
                description="Wundfälle und BodyMap"
                accentColor={moduleColor('stationaer')}
                preparedOnly={tilePreparedOnly(isWoundDocumentationLiveReady())}
                onPress={() => router.push('/pflege/wunddokumentation' as never)}
              />
            ) : null}
            {can('pflege.plans.view') ? (
              <CareLightModuleTile
                icon="📝"
                title="Pflegedokumentation"
                description="Nachweise und Signaturen"
                accentColor={moduleColor('beratung')}
                preparedOnly={tilePreparedOnly(isCareDocumentationLiveReady())}
                onPress={() => router.push('/pflege/dokumentation' as never)}
              />
            ) : null}
            {can('pflege.plans.view') ? (
              <CareLightModuleTile
                icon="📅"
                title="Dienstpläne"
                description="Schichtplanung und Einsätze"
                accentColor={moduleColor('beratung')}
                preparedOnly={tilePreparedOnly(isShiftScheduleLiveReady())}
                onPress={() => router.push('/pflege/dienstplaene' as never)}
              />
            ) : null}
            <CareLightModuleTile
              icon="📊"
              title="SIS-Assessments"
              description="Strukturierte Informationssammlung"
              accentColor={moduleColor('beratung')}
              preparedOnly={tilePreparedOnly(isSisLiveReady())}
              onPress={() => router.push('/pflege/sis' as never)}
            />
            <CareLightModuleTile
              icon="🏠"
              title="Bewohner:innen"
              description="Stationär — Liste und Detail"
              accentColor={moduleColor('stationaer')}
              onPress={() => router.push('/stationaer/bewohner' as never)}
            />
            <CareLightModuleTile
              icon="📈"
              title="Auswertungen"
              description="KPIs und Kennzahlen"
              accentColor={moduleColor('akademie')}
              preparedOnly={tilePreparedOnly(isPflegeReportsLiveReady())}
              onPress={() => router.push('/pflege/auswertungen' as never)}
            />
            <CareLightModuleTile
              icon="⚙️"
              title="Einstellungen"
              description="Modul-Konfiguration"
              accentColor={careLightColors.muted}
              preparedOnly={tilePreparedOnly(isPflegeSettingsLiveReady())}
              onPress={() => router.push('/pflege/settings' as never)}
            />
            {!can('pflege.plans.view') && !can('pflege.vitals.view') ? (
              <Text style={styles.readOnlyHint}>
                Lesemodus — Detailbereiche sind für {roleLabel ?? 'Ihre Rolle'} nicht freigegeben.
              </Text>
            ) : null}
          </View>
        }
      />
      <View
        accessible
        accessibilityLabel={`${wp378A11y.screenLabel} · WP ${wp378A11y.wpNumber}`}
        accessibilityRole={wp378A11y.headingRole}
        style={styles.a11yAnchor}
      />
    </CareLightScreen>
  );
}

const styles = StyleSheet.create({
  quickGrid: {
    gap: careSpacing.md,
  },
  readOnlyHint: {
    ...careTypography.caption,
    color: careLightColors.muted,
  },
  loading: {
    ...careTypography.body,
    color: careLightColors.muted,
    textAlign: 'center',
    paddingVertical: careSpacing.xl,
  },
  a11yAnchor: {
    height: 0,
    width: 0,
  },
});
