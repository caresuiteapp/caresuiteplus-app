import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions, type ViewStyle } from 'react-native';
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
import { isPhoneClass } from '@/lib/platform/breakpoints';
import { useWebVisualViewport } from '@/hooks/useWebVisualViewport.web';
import { resolvePlatformModalMaxHeight } from '@/lib/platform/platformModalLayout';
import { cleanOptionalTaskTitle, optionalTaskTitleKey, searchOptionalTaskChoices, validateOptionalTaskDrafts,
  OPTIONAL_TASK_BATCH_LIMIT, OPTIONAL_TASK_TITLE_LIMIT, type OptionalVisitTaskDraft } from '@/lib/portal/optionalVisitTasks';
import type { OptionalTaskSaveResult } from '@/lib/portal/optionalVisitTaskService.web';
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
  canAdd?: boolean;
  saveError?: string | null;
  onAddTasks?: (drafts: OptionalVisitTaskDraft[]) => Promise<OptionalTaskSaveResult>;
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
  canAdd = false,
  saveError,
  onAddTasks,
  onUpdateTask,
}: EmployeePortalVisitTasksPanelProps) {
  const text = employeePortalExecutionText;
  const deviceClass = useDeviceClass();
  const isPhone = isPhoneClass(deviceClass);
  const { height } = useWindowDimensions();
  const viewport = useWebVisualViewport();
  const sheetHeight = resolvePlatformModalMaxHeight(viewport.height ?? height, isPhone ? 'bottomSheet' : 'center', isPhone ? 0.94 : 0.92, spacing.lg * 2);
  const groups = useMemo(() => groupEmployeePortalTasks(tasks), [tasks]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [statusPicker, setStatusPicker] = useState<StatusPickerState>(null);
  const [note, setNote] = useState('');
  const [query, setQuery] = useState('');
  const [entryMode, setEntryMode] = useState<'existing' | 'catalog' | 'manual'>(tasks.length ? 'existing' : 'catalog');
  const [manualTitle, setManualTitle] = useState('');
  const [selected, setSelected] = useState<OptionalVisitTaskDraft[]>([]);
  const [adding, setAdding] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const addInFlight = useRef(false);
  const statusInFlight = useRef(false);
  const manualDraft = useRef<OptionalVisitTaskDraft | null>(null);
  const choices = useMemo(() => searchOptionalTaskChoices(query), [query]);
  const existingTitles = useMemo(() => new Set(tasks.map(task => optionalTaskTitleKey(task.title))), [tasks]);
  const editable = !disabled && canAdd && Boolean(onAddTasks) && !adding;

  useEffect(() => {
    if (visible) return;
    setQuery(''); setManualTitle(''); setSelected([]); setFeedback(null);
    manualDraft.current = null;
  }, [visible]);

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
          flexWrap: 'wrap',
          gap: spacing.xs,
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
        groupTitle: { ...typography.bodyStrong, color: text.primary, flexShrink: 1 },
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
        modalSheet: { backgroundColor: employeePortalExecutionSurface.background, height: sheetHeight },
        modalBody: { backgroundColor: employeePortalExecutionSurface.background },
        body: { width: '100%', minWidth: 0 },
        empty: { borderWidth: 1, borderStyle: 'dashed', borderColor: employeePortalExecutionSurface.border, borderRadius: 16, padding: spacing.md, gap: spacing.xs, marginBottom: spacing.md },
        editor: { borderTopWidth: 1, borderColor: employeePortalExecutionSurface.border, paddingTop: spacing.md, marginTop: spacing.md, gap: spacing.sm },
        choice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, minHeight: 56, borderWidth: 1, borderColor: employeePortalExecutionSurface.border, borderRadius: 14 },
        choiceSelected: { borderColor: '#086bea', backgroundColor: '#eaf4ff' },
        choiceText: { flex: 1, minWidth: 0, gap: spacing.xs },
        choiceMark: { ...typography.bodyStrong, color: text.primary, width: 24, textAlign: 'center' },
        unavailable: { opacity: 0.65 },
        feedbackError: { ...typography.body, color: '#9e2424', backgroundColor: '#fff0f0', padding: spacing.sm, borderRadius: 10 },
        feedbackSuccess: { ...typography.body, color: '#175734', backgroundColor: '#e8f7ef', padding: spacing.sm, borderRadius: 10 },
      }),
    [text, sheetHeight],
  );

  const totalDone = countDoneTasks(tasks);

  const toggleGroup = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const applyStatus = useCallback(
    async (taskId: string, status: ExtendedAssignmentTaskStatus, noteValue?: string) => {
      if (disabled || adding || statusInFlight.current) return;
      if (visitTaskStatusRequiresNote(status) && !noteValue?.trim()) {
        setStatusPicker({ taskId, status });
        setNote('');
        return;
      }
      statusInFlight.current = true;
      try {
        const result = await onUpdateTask(taskId, status, noteValue?.trim() || undefined);
        if (!result.ok) { setFeedback({ kind: 'error', text: result.error ?? 'Die Aufgabe konnte nicht gespeichert werden.' }); return; }
        setStatusPicker(null); setNote('');
      } catch { setFeedback({ kind: 'error', text: 'Die Aufgabe konnte nicht gespeichert werden. Ihre Eingabe bleibt erhalten.' }); }
      finally { statusInFlight.current = false; }
    },
    [disabled, adding, onUpdateTask],
  );

  const completeCategory = async (group: VisitTaskCategoryGroup) => {
    if (disabled || adding || statusInFlight.current) return;
    statusInFlight.current = true;
    try {
      const results = await Promise.all(group.tasks.filter(task => task.status !== 'done').map(task => onUpdateTask(task.id, 'done')));
      const failed = results.find(result => !result.ok);
      if (failed) setFeedback({ kind: 'error', text: failed.error ?? 'Nicht alle Aufgaben konnten gespeichert werden.' });
    } catch { setFeedback({ kind: 'error', text: 'Nicht alle Aufgaben konnten gespeichert werden. Bitte den Status prüfen.' }); }
    finally { statusInFlight.current = false; }
  };

  const newDraft = (title: string, catalogId?: string): OptionalVisitTaskDraft => {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes); bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    return { id: `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`, title: cleanOptionalTaskTitle(title), ...(catalogId ? { catalogId } : {}) };
  };

  const submit = async (drafts: OptionalVisitTaskDraft[], kind: 'catalog' | 'manual') => {
    if (!editable || !onAddTasks || addInFlight.current) return;
    const valid = validateOptionalTaskDrafts(drafts);
    if (!valid.ok) { setFeedback({ kind: 'error', text: valid.error }); return; }
    addInFlight.current = true; setAdding(true); setFeedback(null);
    try {
      const result = await onAddTasks(valid.data);
      if (!result.ok) { setFeedback({ kind: 'error', text: result.error }); return; }
      if (kind === 'manual') { setManualTitle(''); manualDraft.current = null; }
      else setSelected([]);
      setFeedback({ kind: 'success', text: result.inserted === 0 ? 'Die Auswahl ist bereits in diesem Einsatz vorhanden.'
        : result.inserted === 1 ? 'Die Aufgabe ist im Einsatz gespeichert.' : `${result.inserted} Aufgaben sind im Einsatz gespeichert.` });
    } catch { setFeedback({ kind: 'error', text: 'Die Speicherung konnte nicht bestätigt werden. Ihre Auswahl bleibt erhalten.' }); }
    finally { addInFlight.current = false; setAdding(false); }
  };

  const addManual = () => {
    try {
      if (!manualDraft.current || manualDraft.current.title !== cleanOptionalTaskTitle(manualTitle)) manualDraft.current = newDraft(manualTitle);
      void submit([manualDraft.current], 'manual');
    } catch { setFeedback({ kind: 'error', text: 'Bitte die Software über die sichere Webadresse erneut öffnen.' }); }
  };

  const toggleChoice = (choice: (typeof choices)[number]) => {
    if (!editable || existingTitles.has(optionalTaskTitleKey(choice.title))) return;
    try {
      const existing = selected.find(task => task.catalogId === choice.id);
      if (existing) { setSelected(selected.filter(task => task.catalogId !== choice.id)); return; }
      if (selected.length >= OPTIONAL_TASK_BATCH_LIMIT) { setFeedback({ kind: 'error', text: `Bitte höchstens ${OPTIONAL_TASK_BATCH_LIMIT} Aufgaben auf einmal auswählen.` }); return; }
      setSelected([...selected, newDraft(choice.title, choice.id)]); setFeedback(null);
    } catch { setFeedback({ kind: 'error', text: 'Bitte die Software über die sichere Webadresse erneut öffnen.' }); }
  };

  const renderTask = (task: EmployeePortalTaskItem) => (
    <Pressable
      key={task.id}
      style={styles.taskRow}
      onPress={() => !disabled && !adding && setStatusPicker({ taskId: task.id, status: task.status })}
      accessibilityRole="button"
      disabled={disabled || adding}
      accessibilityState={{ disabled: disabled || adding }}
    >
      <Text style={styles.taskTitle}>{task.title}</Text>
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
          <View style={{ flex: 1, minWidth: 0 }}>
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
                disabled={adding}
                onPress={() => void completeCategory(group)}
              />
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  const body = (
    <View style={styles.body}>
      <View style={styles.summary}>
        <Text style={styles.summaryText}>Optionale Aufgaben</Text>
        <Text style={styles.summaryMeta}>
          {loading ? 'Speicherung läuft im Hintergrund' : `${totalDone} / ${tasks.length} erledigt`}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm }}>
        <PremiumButton title={`Im Einsatz (${tasks.length})`} variant={entryMode === 'existing' ? 'primary' : 'secondary'} onPress={() => setEntryMode('existing')} disabled={adding} testID="optional-tasks-mode-existing" />
        <PremiumButton title={selected.length ? `Vorlagen auswählen (${selected.length})` : 'Vorlagen auswählen'} variant={entryMode === 'catalog' ? 'primary' : 'secondary'} onPress={() => setEntryMode('catalog')} disabled={adding} testID="optional-tasks-mode-catalog" />
        <PremiumButton title="Eigene Aufgabe" variant={entryMode === 'manual' ? 'primary' : 'secondary'} onPress={() => setEntryMode('manual')} disabled={adding} testID="optional-tasks-mode-manual" />
      </View>
      {entryMode === 'existing' ? groups.map(renderGroup) : null}
      {!tasks.length ? <View style={styles.empty} testID="optional-tasks-empty">
        <Text style={styles.summaryText}>Noch keine Aufgaben für diesen Einsatz</Text>
        <Text style={styles.taskTitle}>Wählen Sie unten passende Vorlagen aus oder tragen Sie eine eigene Aufgabe ein.</Text>
      </View> : null}
      {embedded && (saveError || feedback) ? <Text accessibilityRole="alert" style={saveError || feedback?.kind === 'error' ? styles.feedbackError : styles.feedbackSuccess}>{saveError ?? feedback?.text}</Text> : null}
      {entryMode !== 'existing' ? <View style={styles.editor}>
        <Text style={styles.summaryText}>Aufgaben hinzufügen</Text>
        <Text style={styles.taskStatus}>Die Ergänzungen gelten für diesen Einsatz und bleiben optional.</Text>
        {!canAdd || disabled ? <Text style={styles.taskTitle}>Dieser Einsatz ist derzeit nur lesbar. Neue Aufgaben können vor der Freigabe zur Unterschrift ergänzt werden.</Text> : null}
        {entryMode === 'catalog' ? <>
        <PremiumInput onLightSurface label="Aufgaben suchen" value={query} onChangeText={setQuery} placeholder="Zum Beispiel Einkauf, Wäsche oder Spaziergang" testID="optional-task-search" />
        <Text style={styles.summaryMeta}>{choices.length} {choices.length === 1 ? 'Vorlage' : 'Vorlagen'} · {selected.length} ausgewählt</Text>
        {!choices.length ? <Text style={styles.taskTitle}>Keine passende Vorlage gefunden. Wechseln Sie zu „Eigene Aufgabe“, um sie selbst einzutragen.</Text> : null}
        {choices.map(choice => {
          const chosen = selected.some(task => task.catalogId === choice.id);
          const exists = existingTitles.has(optionalTaskTitleKey(choice.title));
          return <Pressable key={choice.id} testID={`optional-task-choice-${choice.id}`} accessibilityRole="checkbox"
            accessibilityLabel={choice.title} accessibilityState={{ checked: chosen || exists, disabled: !editable || exists }}
            disabled={!editable || exists} onPress={() => toggleChoice(choice)} style={[styles.choice, chosen ? styles.choiceSelected : null, exists ? styles.unavailable : null]}>
            <Text style={styles.choiceMark}>{chosen || exists ? '✓' : '+'}</Text><View style={styles.choiceText}>
              <Text style={styles.groupTitle}>{choice.title}</Text><Text style={styles.taskStatus}>{choice.category} · {exists ? 'Bereits im Einsatz' : choice.description}</Text>
            </View></Pressable>;
        })}
        {selected.length ? <PremiumButton title="Auswahl aufheben" variant="secondary" onPress={() => setSelected([])} disabled={adding} /> : null}
        </> : <View style={styles.editor}>
          <Text style={styles.summaryText}>Aufgabe manuell hinzufügen</Text>
          <PremiumInput onLightSurface label="Eigene Aufgabe" value={manualTitle} onChangeText={value => { setManualTitle(value); manualDraft.current = null; }}
            placeholder="Was möchten Sie bei diesem Einsatz erledigen?" multiline maxLength={OPTIONAL_TASK_TITLE_LIMIT} editable={editable} testID="optional-task-manual-title" />
          <Text style={styles.summaryMeta}>{Array.from(manualTitle).length} / {OPTIONAL_TASK_TITLE_LIMIT} Zeichen</Text>
        </View>}
        {embedded ? <PremiumButton title={entryMode === 'manual' ? 'Eigene Aufgabe hinzufügen' : 'Ausgewählte Aufgaben hinzufügen'}
          onPress={entryMode === 'manual' ? addManual : () => void submit(selected, 'catalog')}
          disabled={!editable || (entryMode === 'manual' ? !manualTitle.trim() : !selected.length)} loading={adding} /> : null}
      </View> : null}
    </View>
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
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
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
      {saveError || feedback?.kind === 'error' ? <Text accessibilityRole="alert" style={styles.feedbackError}>{saveError ?? feedback?.text}</Text> : null}
      {VISIT_TASK_STATUS_OPTIONS.map(renderStatusOption)}
      {visitTaskStatusRequiresNote(statusPicker.status) ? (
        <View style={styles.noteBox}>
          <PremiumInput
            onLightSurface
            label="Notiz *"
            value={note}
            onChangeText={setNote}
            placeholder="Bitte kurz begründen"
            multiline
          />
          <PremiumButton
            title="Speichern"
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
      title={statusPicker ? 'Aufgabenstatus' : 'Optionale Aufgaben'}
      subtitle={
        statusPicker ? 'Status für diese Aufgabe wählen' : `${totalDone} / ${tasks.length} erledigt`
      }
      onBack={statusPicker ? closeStatusPicker : undefined}
      variant={isPhone ? 'bottomSheet' : 'center'}
      animationType={isPhone ? 'slide' : 'fade'}
      maxWidth={statusPicker ? (isPhone ? 480 : 640) : isPhone ? 560 : 920}
      maxHeightRatio={isPhone ? 0.94 : 0.92}
      sheetStyle={styles.modalSheet}
      bodyStyle={styles.modalBody}
      surfaceScope="personal"
      isDirty={Boolean(selected.length || manualTitle.trim() || note.trim())}
      dirtyCloseMessage="Die noch nicht gespeicherte Aufgabenauswahl oder Eingabe verwerfen?"
      dismissOnBackdrop={!adding}
      onClose={adding ? () => {} : statusPicker ? closeStatusPicker : (onClose ?? (() => {}))}
      footerContent={!statusPicker && (saveError || feedback) ? <Text accessibilityRole="alert" style={saveError || feedback?.kind === 'error' ? styles.feedbackError : styles.feedbackSuccess}>{saveError ?? feedback?.text}</Text> : undefined}
      footerActions={!statusPicker ? entryMode === 'existing' ? [
        { title: 'Vorlagen auswählen', onPress: () => setEntryMode('catalog'), disabled: adding },
        { title: 'Eigene Aufgabe', onPress: () => setEntryMode('manual'), disabled: adding },
      ] : [{ title: adding ? 'Speicherung wird bestätigt …' : entryMode === 'manual' ? 'Eigene Aufgabe hinzufügen'
        : selected.length ? `${selected.length} ausgewählte Aufgaben hinzufügen` : 'Ausgewählte Aufgaben hinzufügen',
        onPress: entryMode === 'manual' ? addManual : () => void submit(selected, 'catalog'), loading: adding,
        disabled: !editable || (entryMode === 'manual' ? !manualTitle.trim() : !selected.length) },
        { title: 'Aufgaben im Einsatz anzeigen', onPress: () => setEntryMode('existing'), disabled: adding },
      ] : undefined}
    >
      {statusPicker ? statusPickerBody : body}
    </PlatformModal>
  );
}
