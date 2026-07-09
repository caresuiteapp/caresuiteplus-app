import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { PlatformModal } from '@/components/layout/platform/platformmodal';
import { PremiumButton, PremiumInput } from '@/components/ui';
import {
  countDoneTasks,
  groupEmployeePortalTasks,
  type VisitTaskCategoryGroup,
} from '@/lib/portal/groupEmployeePortalTasks';
import {
  visitTaskStatusLabel,
  visitTaskStatusRequiresNote,
  VISIT_TASK_STATUS_OPTIONS,
} from '@/lib/portal/visitTaskStatusLabels';
import {
  employeePortalExecutionSurface,
  employeePortalExecutionText,
} from '@/lib/portal/employeePortalExecutionSurface';
import { useDeviceClass } from '@/hooks/platform/useDeviceClass';
import { isDesktopClass } from '@/lib/platform/breakpoints';
import type { EmployeePortalTaskItem } from '@/types/modules/employeePortalExecution';
import type { ExtendedAssignmentTaskStatus } from '@/types/modules/assignmentWorkflow';
import { colors, spacing, typography } from '@/theme';

type EmployeePortalVisitTasksPanelProps = {
  tasks: EmployeePortalTaskItem[];
  disabled?: boolean;
  loading?: boolean;
  visible?: boolean;
  onClose?: () => void;
  embedded?: boolean;
  onUpdateTask: (
    taskId: string,
    status: ExtendedAssignmentTaskStatus,
    note?: string,
  ) => Promise<{ ok: boolean; error?: string }>;
};

type StatusPickerState = {
  taskId: string;
  status: ExtendedAssignmentTaskStatus;
} | null;

export function EmployeePortalVisitTasksPanel({
  tasks,
  disabled = false,
  loading = false,
  visible = true,
  onClose,
  embedded = false,
  onUpdateTask,
}: EmployeePortalVisitTasksPanelProps) {
  const text = employeePortalExecutionText;
  const deviceClass = useDeviceClass();
  const isMobile = !isDesktopClass(deviceClass);
  const groups = useMemo(() => groupEmployeePortalTasks(tasks), [tasks]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [statusPicker, setStatusPicker] = useState<StatusPickerState>(null);
  const [note, setNote] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const group of groups) {
      next[`${group.key}::${group.label}`] = !group.isComplete;
    }
    setExpanded((prev) => ({ ...next, ...prev }));
  }, [groups]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        summary: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: spacing.sm,
        },
        summaryText: { ...typography.bodyStrong, color: text.primary },
        summaryMeta: { ...typography.caption, color: text.muted },
        group: {
          borderWidth: 1,
          borderColor: employeePortalExecutionSurface.border,
          borderRadius: 12,
          marginBottom: spacing.sm,
          overflow: 'hidden',
          backgroundColor: employeePortalExecutionSurface.background,
        },
        groupHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          backgroundColor: employeePortalExecutionSurface.subtleBackground,
        },
        groupTitle: { ...typography.bodyStrong, color: text.primary },
        groupMeta: { ...typography.caption, color: text.secondary },
        groupBody: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.xs },
        taskRow: {
          paddingVertical: spacing.sm,
          borderTopWidth: 1,
          borderTopColor: employeePortalExecutionSurface.border,
          gap: spacing.xs,
        },
        taskTitle: { ...typography.body, color: text.primary },
        taskStatus: { ...typography.caption, color: text.muted },
        taskNote: { ...typography.caption, color: text.secondary },
        statusSheet: { gap: spacing.xs },
        statusOption: {
          borderWidth: 1,
          borderColor: employeePortalExecutionSurface.border,
          borderRadius: 10,
          padding: spacing.sm,
        },
        statusOptionActive: { borderColor: colors.amber, backgroundColor: 'rgba(255,149,0,0.08)' },
        statusOptionLabel: { ...typography.body, color: text.primary },
        noteBox: { gap: spacing.sm, marginTop: spacing.sm },
      }),
    [text],
  );

  const totalDone = countDoneTasks(tasks);

  const toggleGroup = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const applyStatus = useCallback(
    async (taskId: string, status: ExtendedAssignmentTaskStatus, noteValue?: string) => {
      if (visitTaskStatusRequiresNote(status) && !noteValue?.trim()) {
        setStatusPicker({ taskId, status });
        setNote('');
        return;
      }
      setPendingId(taskId);
      await onUpdateTask(taskId, status, noteValue?.trim() || undefined);
      setPendingId(null);
      setStatusPicker(null);
      setNote('');
    },
    [onUpdateTask],
  );

  const completeCategory = async (group: VisitTaskCategoryGroup) => {
    for (const task of group.tasks) {
      if (task.status !== 'done') {
        await onUpdateTask(task.id, 'done');
      }
    }
  };

  const renderTask = (task: EmployeePortalTaskItem) => (
    <Pressable
      key={task.id}
      style={styles.taskRow}
      onPress={() => !disabled && setStatusPicker({ taskId: task.id, status: task.status })}
      accessibilityRole="button"
    >
      <Text style={styles.taskTitle}>
        {task.required ? '★ ' : ''}
        {task.title}
      </Text>
      <Text style={styles.taskStatus}>{visitTaskStatusLabel(task.status)}</Text>
      {task.completionNote ? <Text style={styles.taskNote}>{task.completionNote}</Text> : null}
    </Pressable>
  );

  const renderGroup = (group: VisitTaskCategoryGroup) => {
    const groupId = `${group.key}::${group.label}`;
    const isOpen = expanded[groupId] ?? false;
    return (
      <View key={groupId} style={styles.group}>
        <Pressable style={styles.groupHeader} onPress={() => toggleGroup(groupId)}>
          <View>
            <Text style={styles.groupTitle}>{group.label}</Text>
            <Text style={styles.groupMeta}>
              {group.doneCount} / {group.totalCount} erledigt
            </Text>
          </View>
          <Text style={styles.groupMeta}>{isOpen ? '▼' : '▶'}</Text>
        </Pressable>
        {isOpen ? (
          <View style={styles.groupBody}>
            {group.tasks.map(renderTask)}
            {!disabled ? (
              <PremiumButton
                title="Alle in dieser Kategorie erledigt"
                variant="secondary"
                size="sm"
                loading={loading}
                onPress={() => void completeCategory(group)}
              />
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  const body = (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={styles.summary}>
        <Text style={styles.summaryText}>Aufgaben</Text>
        <Text style={styles.summaryMeta}>
          {totalDone} / {tasks.length} erledigt
        </Text>
      </View>
      {groups.map(renderGroup)}
    </ScrollView>
  );

  const closeStatusPicker = useCallback(() => {
    setStatusPicker(null);
    setNote('');
  }, []);

  const renderStatusOption = (option: (typeof VISIT_TASK_STATUS_OPTIONS)[number]) => {
    if (!statusPicker) return null;
    const selectStatus = () => {
      void applyStatus(statusPicker.taskId, option.value);
    };
    return (
      <Pressable
        key={option.value}
        style={[
          styles.statusOption,
          statusPicker.status === option.value ? styles.statusOptionActive : null,
          Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : null,
        ]}
        onPress={selectStatus}
        {...(Platform.OS === 'web'
          ? ({
              onClick: (event: { preventDefault?: () => void; stopPropagation?: () => void }) => {
                event.preventDefault?.();
                event.stopPropagation?.();
                selectStatus();
              },
            } as Record<string, unknown>)
          : {})}
      >
        <Text style={styles.statusOptionLabel}>{option.label}</Text>
      </Pressable>
    );
  };

  const statusPickerBody = statusPicker ? (
    <View style={styles.statusSheet}>
      {VISIT_TASK_STATUS_OPTIONS.map(renderStatusOption)}
      {visitTaskStatusRequiresNote(statusPicker.status) ? (
        <View style={styles.noteBox}>
          <PremiumInput
            label="Notiz *"
            value={note}
            onChangeText={setNote}
            placeholder="Bitte kurz begründen"
            multiline
          />
          <PremiumButton
            title="Speichern"
            loading={loading && pendingId === statusPicker.taskId}
            onPress={() => void applyStatus(statusPicker.taskId, statusPicker.status, note)}
          />
        </View>
      ) : null}
    </View>
  ) : null;

  if (embedded) {
    return statusPicker ? statusPickerBody : body;
  }

  return (
    <PlatformModal
      visible={visible}
      title={statusPicker ? 'Aufgabenstatus' : 'Aufgaben'}
      subtitle={
        statusPicker ? 'Status für diese Aufgabe wählen' : `${totalDone} / ${tasks.length} erledigt`
      }
      onClose={statusPicker ? closeStatusPicker : (onClose ?? (() => {}))}
      onBack={statusPicker ? closeStatusPicker : undefined}
      variant={isMobile ? 'bottomSheet' : 'center'}
      animationType={isMobile ? 'slide' : 'fade'}
      maxWidth={statusPicker ? 480 : 560}
    >
      {statusPicker ? statusPickerBody : body}
    </PlatformModal>
  );
}
