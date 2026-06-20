import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import { VisitDispositionBadge } from '@/components/assist/VisitDispositionBadge';
import type { VisitDispositionDetail } from '@/lib/assist/visitTypes';
import type { VisitTaskStatus } from '@/lib/assist/visitTypes';
import { VISIT_TASK_STATUS_LABELS } from '@/lib/assist/visitTypes';
import { auroraGlass, useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { spacing, typography } from '@/theme';

type VisitTasksPanelProps = {
  visit: VisitDispositionDetail;
  disabled?: boolean;
  actionLoading?: boolean;
  onUpdateTask: (
    taskId: string,
    status: VisitTaskStatus,
    notDoneReason?: string,
  ) => Promise<void>;
};

const ACTION_STATUSES: VisitTaskStatus[] = ['done', 'not_done', 'not_requested', 'open'];

export function VisitTasksPanel({
  visit,
  disabled = false,
  actionLoading = false,
  onUpdateTask,
}: VisitTasksPanelProps) {
  const text = useAuroraAdaptiveText();
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<VisitTaskStatus | null>(null);
  const [reasonDraft, setReasonDraft] = useState('');

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
        taskMeta: { ...typography.caption, color: text.muted },
        actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
        reasonBox: { gap: spacing.xs, marginTop: spacing.xs },
      }),
    [text],
  );

  const handleStatus = async (taskId: string, status: VisitTaskStatus) => {
    if (status === 'not_done' || status === 'not_requested') {
      setPendingTaskId(taskId);
      setPendingStatus(status);
      setReasonDraft('');
      return;
    }
    await onUpdateTask(taskId, status);
  };

  const submitReason = async () => {
    if (!pendingTaskId || !pendingStatus) return;
    await onUpdateTask(pendingTaskId, pendingStatus, reasonDraft);
    setPendingTaskId(null);
    setPendingStatus(null);
    setReasonDraft('');
  };

  return (
    <SectionPanel title="Aufgaben" subtitle={`${visit.tasks.length} Aufgaben am Einsatz`}>
      {visit.tasks.length === 0 ? (
        <Text style={styles.taskMeta}>Keine Aufgaben hinterlegt.</Text>
      ) : (
        visit.tasks.map((task) => (
          <View key={task.id} style={styles.taskRow}>
            <Text style={styles.taskTitle}>{task.title}</Text>
            {task.isRequired ? (
              <Text style={styles.taskMeta}>Pflichtaufgabe</Text>
            ) : null}
            <VisitDispositionBadge
              label={VISIT_TASK_STATUS_LABELS[task.status]}
              variant={task.status === 'done' ? 'green' : task.status === 'open' ? 'orange' : 'muted'}
              compact
            />
            {task.notDoneReason ? (
              <Text style={styles.taskMeta}>Begründung: {task.notDoneReason}</Text>
            ) : null}
            {!disabled ? (
              <View style={styles.actions}>
                {ACTION_STATUSES.filter((s) => s !== task.status).map((status) => (
                  <PremiumButton
                    key={status}
                    title={VISIT_TASK_STATUS_LABELS[status]}
                    size="sm"
                    variant="secondary"
                    loading={actionLoading}
                    onPress={() => handleStatus(task.id, status)}
                  />
                ))}
              </View>
            ) : null}
            {pendingTaskId === task.id ? (
              <View style={styles.reasonBox}>
                <PremiumInput
                  label="Begründung (Pflicht)"
                  value={reasonDraft}
                  onChangeText={setReasonDraft}
                  multiline
                  placeholder="Warum nicht erledigt / nicht gewünscht?"
                />
                <PremiumButton
                  title="Speichern"
                  size="sm"
                  loading={actionLoading}
                  disabled={!reasonDraft.trim()}
                  onPress={submitReason}
                />
              </View>
            ) : null}
          </View>
        ))
      )}
    </SectionPanel>
  );
}
