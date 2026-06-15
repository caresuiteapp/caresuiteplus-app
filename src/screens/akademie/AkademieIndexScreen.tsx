import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CourseListCard } from '@/components/akademie';
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
import { useAkademieDashboard } from '@/hooks/useAkademieDashboard';
import { usePermissions } from '@/hooks/usePermissions';
import { buildAkademieDashboardKpis } from '@/lib/akademie/akademieDashboardStats';
import { mapToCareLightKpis } from '@/lib/adaptive/careLightKpiMap';
import {
  AKADEMIE_EXTENSION_PREPARED_MESSAGE,
  isAkademieCoursesLiveReady,
  isAkademieExtensionLiveReady,
} from '@/lib/akademie/akademieModuleConfig';
import { fetchAkademieDashboardStats } from '@/lib/akademie/courseListService';
import { wp438A11y } from '@/lib/a11y/wp438-akademie';

void fetchAkademieDashboardStats;

export function AkademieIndexScreen() {
  const router = useRouter();
  const { can, roleLabel } = usePermissions();
  const akademieAccent = moduleColor('akademie');
  const coursesLive = isAkademieCoursesLiveReady();
  const { stats, upcomingCourses, loading, error, refresh } = useAkademieDashboard();

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

  const kpis = stats ? mapToCareLightKpis(buildAkademieDashboardKpis(stats, 'light')) : [];

  return (
    <CareLightScreen>
      {!isAkademieExtensionLiveReady() ? (
        <InfoBanner title="Demo-funktional" message={AKADEMIE_EXTENSION_PREPARED_MESSAGE} />
      ) : null}
      <CareLightModuleDashboard
        moduleKey="akademie"
        subtitle={`Schulungen & Zertifikate · ${roleLabel ?? 'Demo'}`}
        kpis={kpis}
        recentTitle="Anstehende Kurse"
        recentSubtitle="Nach Starttermin sortiert"
        recentSection={
          upcomingCourses.length === 0 ? (
            <EmptyState
              title="Keine anstehenden Kurse"
              message="Derzeit sind keine aktiven Kurse geplant."
              actionLabel="Alle Kurse anzeigen"
              onAction={() => router.push('/akademie/courses' as never)}
            />
          ) : (
            upcomingCourses.map((course) => (
              <CourseListCard
                key={course.id}
                course={course}
                onPress={() => router.push(`/akademie/courses/${course.id}` as never)}
              />
            ))
          )
        }
        quickActions={
          <View style={styles.quickGrid}>
            <CareLightModuleTile icon="🎓" title="Alle Kurse" description="Suche, Filter und Pflichtschulungen" accentColor={akademieAccent} isActive={coursesLive} onPress={() => router.push('/akademie/courses' as never)} />
            <CareLightModuleTile icon="👥" title="Teilnehmer" description="Einschreibungen und Fortschritt" accentColor={moduleColor('assist')} isActive onPress={() => router.push('/akademie/teilnehmer' as never)} />
            <CareLightModuleTile icon="🏅" title="Zertifikate" description="Ausgestellte Nachweise" accentColor={moduleColor('pflege')} isActive onPress={() => router.push('/akademie/zertifikate' as never)} />
            <CareLightModuleTile icon="📈" title="Auswertungen" description="KPIs und Kennzahlen" accentColor={moduleColor('beratung')} isActive onPress={() => router.push('/akademie/auswertungen' as never)} />
            <CareLightModuleTile icon="⚙️" title="Einstellungen" description="Modul-Konfiguration" accentColor={careLightColors.muted} isActive onPress={() => router.push('/akademie/settings' as never)} />
            {!can('akademie.courses.view') ? (
              <Text style={styles.readOnlyHint}>Lesemodus — Kurse sind für {roleLabel ?? 'Ihre Rolle'} nicht sichtbar.</Text>
            ) : null}
          </View>
        }
      />
      <View accessible accessibilityLabel={`${wp438A11y.screenLabel} · WP ${wp438A11y.wpNumber}`} accessibilityRole={wp438A11y.headingRole} style={styles.a11yAnchor} />
    </CareLightScreen>
  );
}

const styles = StyleSheet.create({
  quickGrid: { gap: careSpacing.md },
  readOnlyHint: { ...careTypography.caption, color: careLightColors.muted },
  loading: { ...careTypography.body, color: careLightColors.muted, textAlign: 'center', paddingVertical: careSpacing.xl },
  a11yAnchor: { height: 0, width: 0 },
});
