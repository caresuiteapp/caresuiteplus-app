import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import { auroraGlass, useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import type { EmployeePortalTaskItem } from '@/types/modules/employeePortalExecution';
import type { ExtendedAssignmentTaskStatus } from '@/types/modules/assignmentWorkflow';
import { spacing, typography } from '@/theme';

type EmployeePortalVisitTasksPanelProps = {
  tasks: EmployeePortalTaskItem[];
  disabled?: boolean;
  loading?: boolean;
  onUpdateTask: (
    taskId: string,
    status: ExtendedAssignmentTaskStatus,
    note?: string,
  ) => Promise<{ ok: boolean; error?: string }>;
};

const QUICK_STATUSES: ExtendedAssignmentTaskStatus[] = ['done', 'not_done', 'open'];

export function EmployeePortalVisitTasksPanel({
  tasks,
  disabled = false,
  loading = false,
  onUpdateTask,
}: EmployeePortalVisitTasksPanelProps) {
  const text = useAuroraAdaptiveText();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const styles = useMemo(
    () =>
      StyleSheet.create({
        taskRow: {
          paddingVertical: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: auroraGlass.innerBorder,
          gap: spacing.xs,
        },
        taskTitle: { ...typography.bodyStrong, color: text.primary },
        taskStatus: { ...typography.caption, color: text.muted },
        taskNote: { ...typography.caption, color: text.secondary },
        actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
        noteBox: { gap: spacing.sm, marginTop: spacing.sm },
      }),
    [text],
  );

  const handleStatus = (taskId: string, status: ExtendedAssignmentTaskStatus) => {
    if (status === 'not_done' && !note.trim()) {
      setPendingId(taskId);
      return;
    }
    setPendingId(taskId);
    void onUpdateTask(taskId, status, note.trim() || undefined);
    setPendingId(null);
    setNote('');
  };

  return (
    <SectionPanel title="Aufgaben" subtitle="Pflichtaufgaben vor Abschluss erledigen">
      {tasks.map((task) => (
        <View key={task.id} style={styles.taskRow}>
          <Text style={styles.taskTitle}>
            {task.required ? '★ ' : ''}
            {task.title}
          </Text>
          <Text style={styles.taskStatus}>Status: {task.status}</Text>
          {task.completionNote ? (
            <Text style={styles.taskNote}>{task.completionNote}</Text>
          ) : null}
          {!disabled ? (
            <View style={styles.actions}>
              {QUICK_STATUSES.map((s) => (
                <PremiumButton
                  key={s}
                  title={s === 'done' ? 'Erledigt' : s === 'not_done' ? 'Nicht erledigt' : 'Offen'}
                  variant={task.status === s ? 'primary' : 'ghost'}
                  loading={loading && pendingId === task.id}
                  onPress={() => handleStatus(task.id, s)}
                />
              ))}
            </View>
          ) : null}
          {pendingId === task.id ? (
            <View style={styles.noteBox}>
              <PremiumInput
                label="Begründung (Pflicht)"
                value={note}
                onChangeText={setNote}
                placeholder="Warum nicht erledigt?"
              />
              <PremiumButton
                title="Speichern"
                loading={loading}
                onPress={() => handleStatus(task.id, 'not_done')}
              />
            </View>
          ) : null}
        </View>
      ))}
    </SectionPanel>
  );
}
