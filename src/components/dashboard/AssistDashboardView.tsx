import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  AssistDashboardCheckpoints,
  AssistSystemStatusCard,
  AssignmentListCard,
} from '@/components/assist';
import { AdaptiveKpiGrid } from '@/components/adaptive';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumButton,
  PremiumKpiCard,
  SectionPanel,
} from '@/components/ui';
import type { ActiveExecutionItem } from '@/types/modules/assist';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { useShellHostsAurora } from '@/hooks/useshellhostsaurora';
import { useMainModuleAccent } from '@/hooks/useMainModuleAccent';
import { moduleColor } from '@/design/tokens/modules';
import {
  pickNextAssignment,
  pickRunningAssignment,
} from '@/lib/assist/assistDashboardService';
import {
  ASSIST_QUICK_ACCESS,
  ASSIST_WORKSPACE_KPI_COUNT,
  buildAssistWorkspaceKpis,
} from '@/lib/assist/assistDashboardWorkspace';
import type { AssistDashboardStats, AssignmentListItem } from '@/types/modules/assist';
import { spacing } from '@/theme';

type AssistDashboardViewProps = {
  stats: AssistDashboardStats | null;
  todayAssignments: AssignmentListItem[];
  activeExecutions: ActiveExecutionItem[];
  activeLoading: boolean;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  canPlan?: boolean;
};

function createAssistDashboardStyles(shellHostsAurora: boolean) {
  return StyleSheet.create({
    container: {
      width: '100%',
      flexGrow: 1,
      gap: spacing.md,
      backgroundColor: shellHostsAurora ? 'transparent' : undefined,
    },
    body: {
      gap: spacing.md,
    },
    bodyDesktop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    main: {
      flex: 1,
      minWidth: 0,
      gap: spacing.md,
    },
    side: {
      minWidth: 0,
      gap: spacing.md,
    },
    sidePhone: {
      width: '100%',
    },
    sideWide: {
      width: 320,
      flexShrink: 0,
    },
    visitBlock: {
      gap: spacing.sm,
    },
    visitEmpty: {
      gap: spacing.sm,
      alignItems: 'center',
    },
    todayList: {
      gap: spacing.sm,
    },
    liveList: {
      gap: spacing.sm,
    },
    liveRow: {
      gap: spacing.xs,
    },
    quickGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    liveLabel: {
      fontWeight: '600',
    },
    liveCaption: {
      opacity: 0.85,
      fontSize: 13,
    },
  });
}

export function AssistDashboardView({
  stats,
  todayAssignments,
  activeExecutions,
  activeLoading,
  loading,
  error,
  onRefresh,
  canPlan = false,
}: AssistDashboardViewProps) {
  const router = useRouter();
  const shellHostsAurora = useShellHostsAurora();
  const { isPhone, isDesktopOrWide } = useDeviceClass();
  const moduleAccent = useMainModuleAccent() ?? moduleColor('assist');
  const styles = useMemo(
    () => createAssistDashboardStyles(shellHostsAurora),
    [shellHostsAurora],
  );

  const navigate = (route?: string) => {
    if (route) {
      router.push(route as never);
    }
  };

  if (loading && !stats) {
    return <LoadingState message="Assist-Dashboard wird geladen…" />;
  }

  if (error && !stats) {
    return (
      <ErrorState title="Dashboard nicht verfügbar" message={error} onRetry={onRefresh} />
    );
  }

  if (!stats) {
    return (
      <EmptyState
        title="Keine Dashboard-Daten"
        message="Für Ihre Rolle sind aktuell keine Assist-Übersichtsdaten verfügbar."
        actionLabel="Erneut laden"
        onAction={onRefresh}
      />
    );
  }

  const workspaceKpis = buildAssistWorkspaceKpis(stats).slice(0, ASSIST_WORKSPACE_KPI_COUNT);
  const runningVisit = pickRunningAssignment(todayAssignments);
  const nextVisit = pickNextAssignment(todayAssignments);

  return (
    <View style={styles.container}>
      <SectionPanel
        title="Kennzahlen"
        subtitle="Aktuelle Übersicht"
        headerAlign="left"
        accentColor={moduleAccent}
        surface="open"
      >
        <AdaptiveKpiGrid
          columns={{ phone: 2, tablet: 2, desktop: 4, wide: 4 }}
          items={workspaceKpis.map((kpi) => ({
            id: kpi.id,
            node: (
              <Pressable
                onPress={() => navigate(kpi.route)}
                accessibilityRole="button"
                accessibilityLabel={`${kpi.label}: ${kpi.value}`}
              >
                <PremiumKpiCard
                  label={kpi.label}
                  value={kpi.value}
                  subValue={kpi.subValue}
                  icon={kpi.icon}
                  accentColor={moduleAccent}
                  variant={shellHostsAurora ? 'light' : 'glass'}
                />
              </Pressable>
            ),
          }))}
        />
      </SectionPanel>

      <View style={[styles.body, isDesktopOrWide && styles.bodyDesktop]}>
        <View style={styles.main}>
          <SectionPanel
            title="Heutige Einsätze"
            subtitle={
              runningVisit
                ? 'Laufender Einsatz und Tagesplanung'
                : nextVisit
                  ? 'Nächster Einsatz und Tagesplanung'
                  : 'Alle geplanten Einsätze für heute'
            }
            surface="open"
          >
            {runningVisit ? (
              <View style={styles.visitBlock}>
                <AssignmentListCard
                  assignment={runningVisit}
                  onPress={() => navigate(`/assist/assignments/${runningVisit.id}`)}
                />
                <PremiumButton
                  title="Zur Durchführung"
                  variant="secondary"
                  size="sm"
                  onPress={() => navigate('/assist/durchfuehrung')}
                />
              </View>
            ) : nextVisit ? (
              <AssignmentListCard
                assignment={nextVisit}
                onPress={() => navigate(`/assist/assignments/${nextVisit.id}`)}
              />
            ) : null}

            {todayAssignments.length === 0 ? (
              <View style={styles.visitEmpty}>
                <EmptyState
                  title="Kein Einsatz geplant"
                  message="Für heute sind keine Assist-Einsätze geplant."
                  actionLabel={canPlan ? '+ Einsatz planen' : undefined}
                  onAction={
                    canPlan ? () => navigate('/assist/einsaetze/new') : undefined
                  }
                />
                <PremiumButton
                  title="Alle Einsätze anzeigen"
                  variant="secondary"
                  size="sm"
                  onPress={() => navigate('/assist/assignments')}
                />
              </View>
            ) : (
              <View style={[styles.todayList, runningVisit || nextVisit ? { marginTop: spacing.sm } : null]}>
                {todayAssignments.map((assignment) => (
                  <AssignmentListCard
                    key={assignment.id}
                    assignment={assignment}
                    onPress={() => navigate(`/assist/assignments/${assignment.id}`)}
                  />
                ))}
              </View>
            )}
          </SectionPanel>
        </View>

        <View style={[styles.side, isPhone ? styles.sidePhone : styles.sideWide]}>
          <SectionPanel
            title="Schnellzugriff"
            subtitle="Häufige Assist-Bereiche"
            surface="open"
          >
            <View style={styles.quickGrid}>
              {ASSIST_QUICK_ACCESS.map((action) => (
                <PremiumButton
                  key={action.id}
                  title={action.label}
                  variant="secondary"
                  size="sm"
                  onPress={() => navigate(action.route)}
                />
              ))}
            </View>
          </SectionPanel>
          <AssistSystemStatusCard compact />
        </View>
      </View>

      <SectionPanel
        title="Live-Aktivität"
        subtitle="Einsätze in Durchführung — mandantenweite Übersicht"
        surface="open"
      >
        {activeLoading && activeExecutions.length === 0 ? (
          <LoadingState message="Live-Aktivität wird geladen…" />
        ) : activeExecutions.length === 0 ? (
          <EmptyState
            title="Keine laufenden Einsätze"
            message="Derzeit sind keine Einsätze in Durchführung. Der Live-Status zeigt aktive Einsätze als Liste oder Karte."
            actionLabel="Live-Status öffnen"
            onAction={() => navigate('/assist/live-status')}
          />
        ) : (
          <View style={styles.liveList}>
            {activeExecutions.slice(0, 5).map((item) => (
              <View key={item.assignmentId} style={styles.liveRow}>
                <Text style={styles.liveLabel}>{item.title}</Text>
                <Text style={styles.liveCaption}>
                  {item.clientName} · {item.phase === 'in_progress' ? 'In Arbeit' : 'Aktiv'}
                </Text>
                <PremiumButton
                  title="Details"
                  size="sm"
                  variant="secondary"
                  onPress={() => navigate(`/assist/assignments/${item.assignmentId}`)}
                />
              </View>
            ))}
          </View>
        )}
      </SectionPanel>

      <AssistDashboardCheckpoints stats={stats} />
    </View>
  );
}
