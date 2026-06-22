import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { InactiveModuleBanner, ResidentListCard } from '@/components/stationaer';
import { CareLightModuleDashboard, CareLightScreen } from '@/components/layout';
import {
  CareLightModuleTile,
  EmptyState,
  ErrorState,
  InfoBanner,
  LoadingState,
} from '@/components/ui';
import { moduleColor } from '@/design/tokens/modules';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { useStationaerDashboard } from '@/hooks/useStationaerDashboard';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { buildStationaerDashboardKpis } from '@/lib/stationaer/stationaerDashboardStats';
import { mapToCareLightKpis } from '@/lib/adaptive/careLightKpiMap';
import {
  STATIONAER_EXTENSION_PREPARED_MESSAGE,
  isStationaerExtensionLiveReady,
  isStationaerResidentsLiveReady,
} from '@/lib/stationaer/stationaerModuleConfig';
import { fetchStationaerDashboardStats } from '@/lib/stationaer/residentListService';
import { CARE_RECORDS_MISSING_BANNER_MESSAGE, PREVIEW_DATA_BANNER_MESSAGE } from '@/lib/supabase/missingtablefallback';
import { wp398A11y } from '@/lib/a11y/wp398-stationaer';

void fetchStationaerDashboardStats;

export function StationaerIndexScreen() {
  const router = useRouter();
  const { can, roleLabel } = usePermissions();
  const stationaerAccent = moduleColor('stationaer');
  const residentsLive = isStationaerResidentsLiveReady();
  const { stats, activeResidents, loading, error, refresh, isPreviewData, tableMissing } =
    useStationaerDashboard();

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

  const kpis = stats ? mapToCareLightKpis(buildStationaerDashboardKpis(stats, 'light')) : [];

  return (
    <CareLightScreen>
      <InactiveModuleBanner productKey="stationaer" />
      {tableMissing ? (
        <InfoBanner title="Datenbank-Schema fehlt" message={CARE_RECORDS_MISSING_BANNER_MESSAGE} />
      ) : isPreviewData ? (
        <InfoBanner title="Vorschaudaten" message={PREVIEW_DATA_BANNER_MESSAGE} />
      ) : !isStationaerExtensionLiveReady() ? (
        <InfoBanner title="Demo-funktional" message={STATIONAER_EXTENSION_PREPARED_MESSAGE} />
      ) : null}
      <CareLightModuleDashboard
        moduleKey="stationaer"
        subtitle={`Pflegeheim · ${roleLabel ?? 'Demo'}`}
        kpis={kpis}
        recentTitle="Aktive Bewohner:innen"
        recentSubtitle="Alphabetisch sortiert"
        recentSection={
          activeResidents.length === 0 ? (
            <EmptyState
              title="Keine aktiven Bewohner:innen"
              message="Derzeit sind keine aktiven Bewohner:innen hinterlegt."
              actionLabel="Alle Bewohner:innen anzeigen"
              onAction={() => router.push('/stationaer/bewohner' as never)}
            />
          ) : (
            activeResidents.map((resident) => (
              <ResidentListCard
                key={resident.id}
                resident={resident}
                onPress={() => router.push(`/stationaer/bewohner/${resident.id}` as never)}
              />
            ))
          )
        }
        quickActions={
          <View style={styles.quickGrid}>
            <CareLightModuleTile icon="🏥" title="Alle Bewohner:innen" description="Suche, Filter und Zimmer" accentColor={stationaerAccent} isActive={residentsLive} onPress={() => router.push('/stationaer/bewohner' as never)} />
            <CareLightModuleTile icon="🛏️" title="Wohnbereiche" description="Zimmer und Belegung" accentColor={moduleColor('assist')} isActive onPress={() => router.push('/stationaer/wohnbereiche' as never)} />
            <CareLightModuleTile icon="📝" title="Übergabebericht" description="Schichtübergabe dokumentieren" accentColor={moduleColor('akademie')} isActive onPress={() => router.push('/stationaer/uebergabebericht' as never)} />
            <CareLightModuleTile icon="📈" title="Auswertungen" description="Belegung und Kennzahlen" accentColor={moduleColor('pflege')} isActive onPress={() => router.push('/stationaer/auswertungen' as never)} />
            <CareLightModuleTile icon="⚙️" title="Einstellungen" description="Modul-Konfiguration" accentColor={careLightColors.muted} isActive onPress={() => router.push('/stationaer/settings' as never)} />
            {!can('stationaer.residents.view') ? (
              <Text style={styles.readOnlyHint}>Lesemodus — Bewohner:innen sind für {roleLabel ?? 'Ihre Rolle'} nicht sichtbar.</Text>
            ) : null}
          </View>
        }
      />
      <View accessible accessibilityLabel={`${wp398A11y.screenLabel} · WP ${wp398A11y.wpNumber}`} accessibilityRole={wp398A11y.headingRole} style={styles.a11yAnchor} />
    </CareLightScreen>
  );
}

const styles = StyleSheet.create({
  quickGrid: { gap: careSpacing.md },
  readOnlyHint: { ...careTypography.caption, color: careLightColors.muted },
  loading: { ...careTypography.body, color: careLightColors.muted, textAlign: 'center', paddingVertical: careSpacing.xl },
  a11yAnchor: { height: 0, width: 0 },
});
