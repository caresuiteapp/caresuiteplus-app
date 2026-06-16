import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumCard,
  SectionPanel,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchInternalTasks } from '@/lib/tasks/internalTaskService';
import { fetchTeamThreads, getTeamChannelLabel } from '@/lib/tasks/teamCommunicationService';
import type { InternalTaskViewKey } from '@/types/modules/internalTasks';
import { INTERNAL_TASK_TYPE_LABELS } from '@/types/modules/internalTasks';
import { colors, spacing, typography } from '@/theme';

const VIEW_FILTERS: { key: InternalTaskViewKey; label: string }[] = [
  { key: 'my_tasks', label: 'Meine Aufgaben' },
  { key: 'team', label: 'Team' },
  { key: 'critical', label: 'Kritisch' },
  { key: 'overdue', label: 'Überfällig' },
  { key: 'billing', label: 'Abrechnung' },
  { key: 'qm', label: 'QM' },
  { key: 'planning', label: 'Planung' },
  { key: 'employees', label: 'Mitarbeitende' },
  { key: 'client_requests', label: 'Klient:innenanfragen' },
  { key: 'system_errors', label: 'Systemfehler' },
  { key: 'archive', label: 'Archiv' },
];

const PRIORITY_COLORS = {
  low: colors.textSecondary,
  normal: colors.cyan,
  high: colors.orange,
  critical: colors.danger,
} as const;

export function InternalTasksScreen() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [activeView, setActiveView] = useState<InternalTaskViewKey>('team');

  const tasksQuery = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchInternalTasks(
        tenantId,
        {
          view: activeView === 'team' ? undefined : activeView,
          actorRoleKey: profile?.roleKey,
          actorUserId: profile?.id,
        },
        profile?.roleKey,
      );
    },
    [tenantId, activeView, profile?.roleKey, profile?.id],
    { enabled: !!tenantId },
  );

  const threadsQuery = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchTeamThreads(tenantId, {}, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const taskCount = tasksQuery.data?.length ?? 0;
  const criticalCount = useMemo(
    () => (tasksQuery.data ?? []).filter((t) => t.priority === 'critical').length,
    [tasksQuery.data],
  );

  if (tasksQuery.loading && !tasksQuery.data) {
    return (
      <ScreenShell title="Aufgaben & Tickets" subtitle="Wird geladen…" scroll>
        <LoadingState message="Aufgaben werden geladen…" />
      </ScreenShell>
    );
  }

  if (tasksQuery.error && !tasksQuery.data) {
    return (
      <ScreenShell title="Aufgaben & Tickets" subtitle="Fehler" scroll>
        <ErrorState message={tasksQuery.error} onRetry={tasksQuery.refresh} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="Aufgaben & Tickets"
      subtitle={`${taskCount} Aufgaben${criticalCount ? ` · ${criticalCount} kritisch` : ''}`}
      scroll
    >
      <SectionPanel title="Ansichten">
        <View style={styles.filterRow}>
          {VIEW_FILTERS.map((view) => (
            <Pressable
              key={view.key}
              onPress={() => setActiveView(view.key)}
              style={[styles.filterChip, activeView === view.key && styles.filterChipActive]}
            >
              <Text style={styles.filterText}>{view.label}</Text>
            </Pressable>
          ))}
        </View>
      </SectionPanel>

      <SectionPanel title="Aufgaben">
        {(tasksQuery.data ?? []).length === 0 ? (
          <EmptyState title="Keine Aufgaben" message="In dieser Ansicht liegen keine Aufgaben vor." />
        ) : (
          (tasksQuery.data ?? []).map((task) => (
            <PremiumCard key={task.id} accentColor={PRIORITY_COLORS[task.priority]}>
              <View style={styles.taskHeader}>
                <Text style={styles.taskTitle}>{task.title}</Text>
                <PremiumBadge label={task.priority} variant={task.priority === 'critical' ? 'red' : 'muted'} />
              </View>
              <Text style={styles.taskMeta}>
                {INTERNAL_TASK_TYPE_LABELS[task.taskType]} · {task.status}
              </Text>
              <Text style={styles.taskDescription}>{task.description}</Text>
              {task.dueAt ? (
                <Text style={styles.taskMeta}>Fällig: {new Date(task.dueAt).toLocaleDateString('de-DE')}</Text>
              ) : null}
            </PremiumCard>
          ))
        )}
      </SectionPanel>

      <SectionPanel title="Teamkommunikation">
        {(threadsQuery.data ?? []).length === 0 ? (
          <EmptyState title="Keine Threads" message="Noch keine Team-Threads vorhanden." />
        ) : (
          (threadsQuery.data ?? []).slice(0, 6).map((thread) => (
            <PremiumCard key={thread.id} accentColor={colors.gold}>
              <Text style={styles.taskTitle}>{thread.title}</Text>
              <Text style={styles.taskMeta}>{getTeamChannelLabel(thread.channelKey)}</Text>
            </PremiumCard>
          ))
        )}
      </SectionPanel>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  filterChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: { borderColor: colors.orange, backgroundColor: colors.bgElevated },
  filterText: { ...typography.caption },
  taskHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  taskTitle: { ...typography.bodyStrong, flex: 1 },
  taskMeta: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  taskDescription: { ...typography.body, marginTop: spacing.xs },
});
