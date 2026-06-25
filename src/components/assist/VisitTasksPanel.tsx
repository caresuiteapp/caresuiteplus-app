import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import { VisitDispositionBadge } from '@/components/assist/VisitDispositionBadge';
import { useAssistCatalogItems } from '@/hooks/assistCatalog/useAssistCatalog';
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
    notCompletedReasonKey?: string,
  ) => Promise<void>;
};

const ACTION_STATUSES: VisitTaskStatus[] = [
  'done',
  'partial',
  'not_requested',
  'not_possible',
  'cancelled',
  'deferred',
  'open',
];

const REASON_REQUIRED: VisitTaskStatus[] = ['partial', 'not_requested', 'not_possible', 'cancelled', 'deferred'];

export function VisitTasksPanel({
  visit,
  disabled = false,
  actionLoading = false,
  onUpdateTask,
}: VisitTasksPanelProps) {
  const text = useAuroraAdaptiveText();
  const { items: reasonOptions } = useAssistCatalogItems('assist.task.not_completed_reasons');
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<VisitTaskStatus | null>(null);
  const [reasonKey, setReasonKey] = useState('');
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
        chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
        chip: {
          borderWidth: 1,
          borderColor: auroraGlass.innerBorder,
          borderRadius: 16,
          paddingHorizontal: spacing.sm,
          paddingVertical: 4,
        },
        chipSelected: { borderColor: text.primary, backgroundColor: auroraGlass.elevated },
        chipText: { ...typography.caption, color: text.primary },
      }),
    [text],
  );

  const handleStatus = async (taskId: string, status: VisitTaskStatus) => {
    if (REASON_REQUIRED.includes(status)) {
      setPendingTaskId(taskId);
      setPendingStatus(status);
      setReasonKey('');
      setReasonDraft('');
      return;
    }
    await onUpdateTask(taskId, status);
  };

  const submitReason = async () => {
    if (!pendingTaskId || !pendingStatus) return;
    const label = reasonOptions.find((r) => r.itemKey === reasonKey)?.label ?? reasonDraft;
    if (!label.trim()) return;
    await onUpdateTask(pendingTaskId, pendingStatus, label, reasonKey || undefined);
    setPendingTaskId(null);
    setPendingStatus(null);
    setReasonKey('');
    setReasonDraft('');
  };

  const needsNote = reasonKey === 'sonstiger_grund' || !reasonOptions.length;

  return (
    <SectionPanel title="Aufgaben" subtitle={`${visit.tasks.length} Aufgaben am Einsatz`}>
      {visit.tasks.length === 0 ? (
        <Text style={styles.taskMeta}>Keine Aufgaben hinterlegt.</Text>
      ) : (
        visit.tasks.map((task) => (
          <View key={task.id} style={styles.taskRow}>
            <Text style={styles.taskTitle}>{task.title}</Text>
            {task.isRequired ? <Text style={styles.taskMeta}>Pflichtaufgabe</Text> : null}
            <VisitDispositionBadge
              label={VISIT_TASK_STATUS_LABELS[task.status] ?? task.status}
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
                <Text style={styles.taskMeta}>Grund auswählen (Office-Katalog)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.chipRow}>
                    {reasonOptions.map((opt) => (
                      <TouchableOpacity
                        key={opt.id}
                        style={[styles.chip, reasonKey === opt.itemKey && styles.chipSelected]}
                        onPress={() => setReasonKey(opt.itemKey)}
                      >
                        <Text style={styles.chipText}>{opt.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
                {needsNote ? (
                  <PremiumInput
                    label="Pflichtnotiz"
                    value={reasonDraft}
                    onChangeText={setReasonDraft}
                    multiline
                    placeholder="Bitte kurz begründen…"
                  />
                ) : null}
                <PremiumButton
                  title="Speichern"
                  size="sm"
                  loading={actionLoading}
                  disabled={!reasonKey && !reasonDraft.trim()}
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
