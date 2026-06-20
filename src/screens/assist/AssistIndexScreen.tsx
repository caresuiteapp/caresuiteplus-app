import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  AssistDashboardHero,
  AssignmentListCard,
  AssistDataSourceBanner,
} from '@/components/assist';
import { AssistSetupHintsBanner } from '@/components/assist/AssistSetupHintsBanner';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  InfoBanner,
  LoadingState,
  PremiumButton,
  SectionPanel,
} from '@/components/ui';
import { careSpacing } from '@/design/tokens/spacing';
import { useAssistDashboard } from '@/hooks/useAssistDashboard';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { ASSIST_EXTENSION_PREPARED_MESSAGE, isAssistExtensionLiveReady } from '@/lib/assist/assistModuleConfig';
import { wp258A11y } from '@/lib/a11y/wp258-assist-planning';

export function AssistIndexScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { can, roleLabel } = usePermissions();
  const { stats, todayAssignments, loading, error, refresh } = useAssistDashboard();
  const roleKey = profile?.roleKey ?? 'business_admin';

  const handleKpiPress = (target: string) => {
    router.push(target as never);
  };

  if (loading && !stats) {
    return (
      <ScreenShell title="Assist" subtitle="Dashboard wird geladen…" showBack={false}>
        <LoadingState message="Dashboard wird geladen…" />
      </ScreenShell>
    );
  }

  if (error && !stats) {
    return (
      <ScreenShell title="Assist" subtitle="Fehler" showBack={false}>
        <ErrorState message={error} onRetry={refresh} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="Assist"
      subtitle={`Einsatzplanung · ${roleLabel ?? 'Demo'}`}
      showBack={false}
      rightSlot={
        can('assist.assignments.manage') ? (
          <PremiumButton
            title="Einsätze"
            size="sm"
            onPress={() => router.push('/assist/assignments' as never)}
          />
        ) : null
      }
    >
      <AssistDataSourceBanner />

      <AssistSetupHintsBanner maxVisible={3} />

      {!isAssistExtensionLiveReady() ? (
        <InfoBanner title="Demo-funktional" message={ASSIST_EXTENSION_PREPARED_MESSAGE} />
      ) : null}

      {stats ? (
        <AssistDashboardHero stats={stats} roleKey={roleKey} onKpiPress={handleKpiPress} />
      ) : null}

      <SectionPanel title="Einsätze heute" subtitle="Geplante Einsätze für heute">
        {todayAssignments.length === 0 ? (
          <EmptyState
            title="Keine Einsätze heute"
            message="Für heute sind keine Einsätze geplant."
            actionLabel="Alle Einsätze anzeigen"
            onAction={() => router.push('/assist/assignments' as never)}
          />
        ) : (
          <View style={styles.todayList}>
            {todayAssignments.map((assignment) => (
              <AssignmentListCard
                key={assignment.id}
                assignment={assignment}
                onPress={() => router.push(`/assist/assignments/${assignment.id}` as never)}
              />
            ))}
          </View>
        )}
      </SectionPanel>

      <SectionPanel title="Schnellzugriff" subtitle="Häufige Assist-Bereiche">
        <View style={styles.quickActions}>
          <PremiumButton
            title="Alle Einsätze"
            variant="secondary"
            onPress={() => router.push('/assist/assignments' as never)}
          />
          <PremiumButton
            title="Kalender"
            variant="secondary"
            onPress={() => router.push('/assist/calendar' as never)}
          />
          <PremiumButton
            title="Fahrtenbuch"
            variant="secondary"
            onPress={() => router.push('/assist/fahrten' as never)}
          />
          <PremiumButton
            title="Live-Status"
            variant="secondary"
            onPress={() => router.push('/assist/live-status' as never)}
          />
          {!can('assist.assignments.manage') ? (
            <View style={styles.readOnlyHint} accessibilityRole="text">
              Lesemodus — Statusänderungen sind für {roleLabel ?? 'Ihre Rolle'} nicht freigegeben.
            </View>
          ) : null}
        </View>
      </SectionPanel>

      <View
        accessible
        accessibilityLabel={`${wp258A11y.screenLabel} · WP ${wp258A11y.wpNumber}`}
        accessibilityRole={wp258A11y.headingRole}
        style={styles.a11yAnchor}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  todayList: { gap: careSpacing.sm },
  quickActions: { gap: careSpacing.sm },
  readOnlyHint: { opacity: 0.75, fontSize: 13 },
  a11yAnchor: { height: 0, width: 0 },
});
