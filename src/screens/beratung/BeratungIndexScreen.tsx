import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CounselingCaseListCard } from '@/components/beratung';
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
import { useBeratungDashboard } from '@/hooks/useBeratungDashboard';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { buildBeratungDashboardKpis } from '@/lib/beratung/beratungDashboardStats';
import { mapToCareLightKpis } from '@/lib/adaptive/careLightKpiMap';
import {
  BERATUNG_EXTENSION_PREPARED_MESSAGE,
  isBeratungExtensionLiveReady,
} from '@/lib/beratung/beratungModuleConfig';
import { fetchBeratungDashboardStats } from '@/lib/beratung/caseListService';
import { wp418A11y } from '@/lib/a11y/wp418-beratung';

void fetchBeratungDashboardStats;

export function BeratungIndexScreen() {
  const router = useRouter();
  const { can, roleLabel } = usePermissions();
  const beratungAccent = moduleColor('beratung');
  const { stats, recentCases, loading, error, refresh } = useBeratungDashboard();

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

  const kpis = stats ? mapToCareLightKpis(buildBeratungDashboardKpis(stats, 'light')) : [];

  return (
    <CareLightScreen>
      {!isBeratungExtensionLiveReady() ? (
        <InfoBanner title="Demo-funktional" message={BERATUNG_EXTENSION_PREPARED_MESSAGE} />
      ) : null}
      <CareLightModuleDashboard
        moduleKey="beratung"
        subtitle={`Sozial- und Pflegeberatung · ${roleLabel ?? 'Demo'}`}
        kpis={kpis}
        recentTitle="Aktuelle Fälle"
        recentSubtitle="Zuletzt bearbeitet"
        recentSection={
          recentCases.length === 0 ? (
            <EmptyState
              title="Keine offenen Fälle"
              message="Derzeit sind keine aktiven Beratungsfälle hinterlegt."
              actionLabel="Alle Fälle anzeigen"
              onAction={() => router.push('/beratung/cases' as never)}
            />
          ) : (
            recentCases.map((counselingCase) => (
              <CounselingCaseListCard
                key={counselingCase.id}
                counselingCase={counselingCase}
                onPress={() => router.push(`/beratung/cases/${counselingCase.id}` as never)}
              />
            ))
          )
        }
        quickActions={
          <View style={styles.quickGrid}>
            <CareLightModuleTile icon="📋" title="Alle Fälle" description="Suche, Filter und Status" accentColor={beratungAccent} isActive onPress={() => router.push('/beratung/cases' as never)} />
            <CareLightModuleTile icon="📄" title="Protokolle" description="Fallbezogene Dokumentation" accentColor={moduleColor('assist')} isActive onPress={() => router.push('/beratung/protokolle' as never)} />
            <CareLightModuleTile icon="🔔" title="Wiedervorlagen" description="Fällige Nachverfolgungen" accentColor={moduleColor('akademie')} isActive onPress={() => router.push('/beratung/wiedervorlagen' as never)} />
            <CareLightModuleTile icon="📈" title="Auswertungen" description="KPIs und Kennzahlen" accentColor={moduleColor('pflege')} isActive onPress={() => router.push('/beratung/auswertungen' as never)} />
            <CareLightModuleTile icon="⚙️" title="Einstellungen" description="Modul-Konfiguration" accentColor={careLightColors.muted} isActive onPress={() => router.push('/beratung/settings' as never)} />
            {!can('beratung.cases.view') ? (
              <Text style={styles.readOnlyHint}>Lesemodus — Beratungsfälle sind für {roleLabel ?? 'Ihre Rolle'} nicht sichtbar.</Text>
            ) : null}
          </View>
        }
      />
      <View accessible accessibilityLabel={`${wp418A11y.screenLabel} · WP ${wp418A11y.wpNumber}`} accessibilityRole={wp418A11y.headingRole} style={styles.a11yAnchor} />
    </CareLightScreen>
  );
}

const styles = StyleSheet.create({
  quickGrid: { gap: careSpacing.md },
  readOnlyHint: { ...careTypography.caption, color: careLightColors.muted },
  loading: { ...careTypography.body, color: careLightColors.muted, textAlign: 'center', paddingVertical: careSpacing.xl },
  a11yAnchor: { height: 0, width: 0 },
});
