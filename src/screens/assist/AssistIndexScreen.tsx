import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  AssistDashboardCheckpoints,
  AssistDashboardHero,
  AssignmentListCard,
  AssistDataSourceBanner,
  AssistSystemStatusCard,
} from '@/components/assist';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumButton,
  SectionPanel,
} from '@/components/ui';
import { useAdaptiveContentStyles } from '@/design/tokens/carelightadaptive';
import { careSpacing } from '@/design/tokens/spacing';
import { useActiveExecutions } from '@/hooks/useActiveExecutions';
import { useAssistDashboard } from '@/hooks/useAssistDashboard';
import { usePermissions } from '@/hooks/usePermissions';
import {
  pickNextAssignment,
  pickRunningAssignment,
} from '@/lib/assist/assistDashboardService';
import { wp258A11y } from '@/lib/a11y/wp258-assist-planning';

export function AssistIndexScreen() {
  const router = useRouter();
  const { can, roleLabel } = usePermissions();
  const content = useAdaptiveContentStyles();
  const { stats, todayAssignments, loading, error, refresh, emptyStats } = useAssistDashboard();
  const { items: activeExecutions, loading: activeLoading } = useActiveExecutions();

  const displayStats = stats ?? emptyStats;
  const runningVisit = pickRunningAssignment(todayAssignments);
  const nextVisit = pickNextAssignment(todayAssignments);
  const canPlan = can('assist.assignments.manage');

  const handleKpiPress = (target: string) => {
    router.push(target as never);
  };

  if (loading) {
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
      subtitle="Einsatzplanung, Durchführung und Leistungsnachweise"
      showBack={false}
      rightSlot={
        canPlan ? (
          <PremiumButton
            title="+ Einsatz planen"
            size="sm"
            onPress={() => router.push('/assist/einsaetze/new' as never)}
          />
        ) : null
      }
    >
      <View style={styles.headerActions}>
        <PremiumButton
          title="Live-Status öffnen"
          variant="secondary"
          size="sm"
          onPress={() => router.push('/assist/live-status' as never)}
        />
        <PremiumButton
          title="Nachweise prüfen"
          variant="secondary"
          size="sm"
          onPress={() => router.push('/assist/nachweise' as never)}
        />
      </View>

      <AssistDataSourceBanner />

      <AssistSystemStatusCard />

      <AssistDashboardHero stats={displayStats} onKpiPress={handleKpiPress} />

      <SectionPanel
        title={runningVisit ? 'Laufender Einsatz' : 'Nächster Einsatz'}
        subtitle={
          runningVisit
            ? 'Aktuell in Durchführung'
            : nextVisit
              ? 'Als Nächstes geplant'
              : 'Heutige Einsatzplanung'
        }
      >
        {runningVisit ? (
          <View style={styles.visitBlock}>
            <AssignmentListCard
              assignment={runningVisit}
              onPress={() => router.push(`/assist/assignments/${runningVisit.id}` as never)}
            />
            <PremiumButton
              title="Zur Durchführung"
              variant="secondary"
              onPress={() => router.push('/assist/durchfuehrung' as never)}
            />
          </View>
        ) : nextVisit ? (
          <AssignmentListCard
            assignment={nextVisit}
            onPress={() => router.push(`/assist/assignments/${nextVisit.id}` as never)}
          />
        ) : (
          <View style={styles.visitEmpty}>
            <EmptyState
              title="Kein Einsatz geplant"
              message="Für heute sind keine Assist-Einsätze geplant."
              actionLabel={canPlan ? '+ Einsatz planen' : undefined}
              onAction={
                canPlan ? () => router.push('/assist/einsaetze/new' as never) : undefined
              }
            />
            <PremiumButton
              title="Alle Einsätze anzeigen"
              variant="secondary"
              size="sm"
              onPress={() => router.push('/assist/assignments' as never)}
            />
          </View>
        )}
      </SectionPanel>

      <SectionPanel
        title="Live-Aktivität"
        subtitle="Einsätze in Durchführung — mandantenweite Übersicht"
      >
        {activeLoading && activeExecutions.length === 0 ? (
          <LoadingState message="Live-Aktivität wird geladen…" />
        ) : activeExecutions.length === 0 ? (
          <EmptyState
            title="Keine laufenden Einsätze"
            message="Derzeit sind keine Einsätze in Durchführung. Der Live-Status zeigt aktive Einsätze als Liste oder Karte."
            actionLabel="Live-Status öffnen"
            onAction={() => router.push('/assist/live-status' as never)}
          />
        ) : (
          <View style={styles.liveList}>
            {activeExecutions.slice(0, 5).map((item) => (
              <View key={item.assignmentId} style={styles.liveRow}>
                <Text style={content.bodyStrong}>{item.title}</Text>
                <Text style={content.caption}>
                  {item.clientName} · {item.phase === 'in_progress' ? 'In Arbeit' : 'Aktiv'}
                </Text>
                <PremiumButton
                  title="Details"
                  size="sm"
                  variant="secondary"
                  onPress={() =>
                    router.push(`/assist/assignments/${item.assignmentId}` as never)
                  }
                />
              </View>
            ))}
          </View>
        )}
      </SectionPanel>

      <AssistDashboardCheckpoints stats={displayStats} />

      <SectionPanel title="Einsätze heute" subtitle="Alle geplanten Einsätze für heute">
        {todayAssignments.length === 0 ? (
          <EmptyState
            title="Keine Einsätze heute"
            message="Für heute sind keine Assist-Einsätze geplant."
            actionLabel={canPlan ? '+ Einsatz planen' : 'Alle Einsätze anzeigen'}
            onAction={
              canPlan
                ? () => router.push('/assist/einsaetze/new' as never)
                : () => router.push('/assist/assignments' as never)
            }
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
            title="Fahrten"
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
  headerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: careSpacing.sm,
  },
  visitBlock: { gap: careSpacing.sm },
  visitEmpty: { gap: careSpacing.sm, alignItems: 'center' },
  todayList: { gap: careSpacing.sm },
  liveList: { gap: careSpacing.sm },
  liveRow: { gap: careSpacing.xs },
  quickActions: { gap: careSpacing.sm },
  readOnlyHint: { opacity: 0.85, fontSize: 13 },
  a11yAnchor: { height: 0, width: 0 },
});
