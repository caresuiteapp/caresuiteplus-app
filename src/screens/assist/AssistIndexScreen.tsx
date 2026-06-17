import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AssignmentListCard } from '@/components/assist';
import { CareLightModuleDashboard, CareLightScreen } from '@/components/layout';
import {
  CareLightButton,
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
import { useAssistDashboard } from '@/hooks/useAssistDashboard';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { buildAssistDashboardKpis } from '@/lib/assist/assistDashboardStats';
import { fetchAssistDashboardStats } from '@/lib/assist/assignmentListService';
import { mapToCareLightKpis } from '@/lib/adaptive/careLightKpiMap';
import { ASSIST_EXTENSION_PREPARED_MESSAGE, isAssistExtensionLiveReady } from '@/lib/assist/assistModuleConfig';
import { wp258A11y } from '@/lib/a11y/wp258-assist-planning';

export function AssistIndexScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { can, roleLabel } = usePermissions();
  const assistAccent = moduleColor('assist');
  const { stats, todayAssignments, loading, error, refresh } = useAssistDashboard();

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

  const kpis = stats ? mapToCareLightKpis(buildAssistDashboardKpis(stats, 'light')) : [];

  return (
    <CareLightScreen>
      {!isAssistExtensionLiveReady() ? (
        <InfoBanner title="Demo-funktional" message={ASSIST_EXTENSION_PREPARED_MESSAGE} />
      ) : null}
      <CareLightModuleDashboard
        moduleKey="assist"
        subtitle={`Einsatzplanung · ${roleLabel ?? 'Demo'}`}
        kpis={kpis}
        recentTitle="Einsätze heute"
        recentSubtitle="Geplante Einsätze für heute"
        recentSection={
          todayAssignments.length === 0 ? (
            <EmptyState
              title="Keine Einsätze heute"
              message="Für heute sind keine Einsätze geplant."
              actionLabel="Alle Einsätze anzeigen"
              onAction={() => router.push('/assist/assignments' as never)}
            />
          ) : (
            todayAssignments.map((assignment) => (
              <AssignmentListCard
                key={assignment.id}
                assignment={assignment}
                onPress={() => router.push(`/assist/assignments/${assignment.id}` as never)}
              />
            ))
          )
        }
        quickActions={
          <View style={styles.quickGrid}>
            <CareLightModuleTile
              icon="📋"
              title="Alle Einsätze"
              description="Suche, Filter und Status"
              accentColor={assistAccent}
              isActive
              onPress={() => router.push('/assist/assignments' as never)}
            />
            <CareLightModuleTile
              icon="📅"
              title="Wochenübersicht"
              description="Kalender und Einsätze"
              accentColor={moduleColor('beratung')}
              isActive
              onPress={() => router.push('/assist/calendar' as never)}
            />
            <CareLightModuleTile
              icon="🚗"
              title="Fahrtenbuch"
              description="Fahrten und Kilometer"
              accentColor={moduleColor('assist')}
              isActive
              onPress={() => router.push('/assist/fahrten' as never)}
            />
            <CareLightModuleTile
              icon="📍"
              title="Live-Tracking"
              description="GPS und Geofence"
              accentColor={careLightColors.green}
              isActive
              onPress={() => router.push('/assist/fahrten' as never)}
            />
            {can('assist.assignments.manage') ? (
              <CareLightButton
                title="Einsatz planen"
                onPress={() => router.push('/assist/einsaetze/new' as never)}
                accentColor={assistAccent}
              />
            ) : null}
            {can('assist.assignments.manage') ? (
              <CareLightButton
                title="Einsätze verwalten"
                onPress={() => router.push('/assist/assignments' as never)}
                accentColor={assistAccent}
              />
            ) : (
              <Text style={styles.readOnlyHint}>
                Lesemodus — Statusänderungen sind für {roleLabel ?? 'Ihre Rolle'} nicht freigegeben.
              </Text>
            )}
          </View>
        }
      />
      <View
        accessible
        accessibilityLabel={`${wp258A11y.screenLabel} · WP ${wp258A11y.wpNumber}`}
        accessibilityRole={wp258A11y.headingRole}
        style={styles.a11yAnchor}
      />
    </CareLightScreen>
  );
}

const styles = StyleSheet.create({
  quickGrid: { gap: careSpacing.md },
  readOnlyHint: { ...careTypography.caption, color: careLightColors.muted },
  loading: { ...careTypography.body, color: careLightColors.muted, textAlign: 'center', paddingVertical: careSpacing.xl },
  a11yAnchor: { height: 0, width: 0 },
});
