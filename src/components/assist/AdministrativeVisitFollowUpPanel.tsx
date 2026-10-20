import { documentationBlockAlreadyStored, mergeAdministrativeTaskDrafts } from '@/lib/assist/administrativeFollowUpState';
import { notifyWfmOfficeDataChanged } from '@/lib/wfm/wfmOfficeDataChanged';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CareDateInput, CareTimeInput } from '@/components/inputs';
import { InfoBanner, PremiumButton, PremiumInput, SectionPanel, useWorkflowFeedback } from '@/components/ui';
import {
  appendAdministrativeDocumentation,
  bulkUpdateAdministrativeTasks,
  completeAdministrativeFollowUp,
  correctAdministrativeVisitTimes,
  requestClientVisitSignature,
} from '@/lib/assist/administrativeVisitService';
import type { VisitDispositionDetail, VisitTaskStatus } from '@/lib/assist/visitTypes';
import { VISIT_TASK_STATUS_LABELS } from '@/lib/assist/visitTypes';
import { spacing, typography } from '@/theme';

function localDate(iso: string): string {
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return iso.slice(0, 10);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function localTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return '';
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}

function toIso(date: string, time: string): string | null {
  if (!date || !time) return null;
  const value = new Date(`${date}T${time}:00`);
  return Number.isNaN(value.getTime()) ? null : value.toISOString();
}

const TASK_CORRECTIONS: VisitTaskStatus[] = ['done', 'not_requested', 'not_possible', 'deferred'];

export function AdministrativeVisitFollowUpPanel({ visit, tenantId, onSaved, onMessage, onTaskDraftsChange }: {
  visit: VisitDispositionDetail;
  tenantId: string;
  onSaved: () => Promise<void>;
  onMessage: (message: string, error?: boolean) => void;
  onTaskDraftsChange?: (drafts: Record<string, VisitTaskStatus>) => void;
}) {
  const initialStart = visit.actualStartAt ?? visit.scheduledStart;
  const initialEnd = visit.actualEndAt ?? visit.scheduledEnd;
  const [date, setDate] = useState(localDate(initialStart));
  const [startTime, setStartTime] = useState(localTime(initialStart));
  const [endTime, setEndTime] = useState(localTime(initialEnd));
  const [wayTime, setWayTime] = useState(localTime(visit.onTheWayAt));
  const [arrivedTime, setArrivedTime] = useState(localTime(visit.arrivedAt));
  const [pause, setPause] = useState('0');
  const [travel, setTravel] = useState('0');
  const [documentation, setDocumentation] = useState('');
  const [taskDrafts, setTaskDrafts] = useState<Record<string, VisitTaskStatus>>(() =>
    Object.fromEntries(visit.tasks.map((task) => [task.id, task.status])),
  );
  const [overlap, setOverlap] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const persistedMinutes = useRef({ pause: '0', travel: '0' });
  const feedback = useWorkflowFeedback();
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [showStoredDocumentation, setShowStoredDocumentation] = useState(false);
  const savedDocumentation = useRef<string | null>(null);
  const previousTaskState = useRef(Object.fromEntries(visit.tasks.map(task => [task.id, task.status])));
  const timesDirty = date !== localDate(initialStart) || startTime !== localTime(initialStart) || endTime !== localTime(initialEnd) ||
    wayTime !== localTime(visit.onTheWayAt) || arrivedTime !== localTime(visit.arrivedAt) || pause !== persistedMinutes.current.pause || travel !== persistedMinutes.current.travel;
  const signaturePresent = visit.proofStatus === 'signed' || visit.proofStatus === 'verified';
  const report = (text: string, error = false) => { setMessage({ text, error }); onMessage(text, error); };

  const persistedTaskState = useMemo(
    () => JSON.stringify(visit.tasks.map((task) => [task.id, task.status])),
    [visit.tasks],
  );

  useEffect(() => {
    const start = visit.actualStartAt ?? visit.scheduledStart;
    const end = visit.actualEndAt ?? visit.scheduledEnd;
    setDate(localDate(start));
    setStartTime(localTime(start));
    setEndTime(localTime(end));
    setWayTime(localTime(visit.onTheWayAt));
    setArrivedTime(localTime(visit.arrivedAt));
  }, [visit.id, visit.actualEndAt, visit.actualStartAt, visit.arrivedAt, visit.onTheWayAt, visit.scheduledEnd, visit.scheduledStart]);

  useEffect(() => {
    const nextTasks = JSON.parse(persistedTaskState).map(([id, status]: [string, VisitTaskStatus]) => ({ id, status })) as VisitDispositionDetail['tasks'];
    const previous = previousTaskState.current;
    setTaskDrafts(current => mergeAdministrativeTaskDrafts(previous, nextTasks, current));
    previousTaskState.current = Object.fromEntries(nextTasks.map(task => [task.id, task.status]));
  }, [persistedTaskState]);
  useEffect(() => { onTaskDraftsChange?.(taskDrafts); }, [taskDrafts, onTaskDraftsChange]);

  const changedTasks = useMemo(
    () => visit.tasks
      .filter((task) => (taskDrafts[task.id] ?? task.status) !== task.status)
      .map((task) => ({ taskId: task.id, status: taskDrafts[task.id] ?? task.status })),
    [taskDrafts, visit.tasks],
  );

  const netMinutes = useMemo(() => {
    const start = toIso(date, startTime);
    const end = toIso(date, endTime);
    if (!start || !end) return null;
    const gross = Math.round((Date.parse(end) - Date.parse(start)) / 60_000);
    const value = gross - (Number(pause) || 0);
    return value > 0 ? value : null;
  }, [date, endTime, pause, startTime]);

  const run = async (operation: () => Promise<{ ok: boolean; error?: string }>, successMessage: string, committed?: () => void) => {
    if (savingRef.current) return false;
    savingRef.current = true; setSaving(true); setMessage(null);
    const loadingId = feedback.showLoading('Nachbearbeitung wird gespeichert und die Einsatzakte aktualisiert…');
    let stored = false;
    try {
      const result = await operation();
      if (!result.ok) { report(result.error ?? 'Die Nachbearbeitung ist fehlgeschlagen.', true); return false; }
      stored = true;
      committed?.();
      notifyWfmOfficeDataChanged(tenantId);
      await onSaved();
      report(successMessage);
      return true;
    } catch (error) {
      report(stored ? 'Änderung gespeichert. Die Einsatzakte konnte noch nicht neu geladen werden. Bitte die Ansicht aktualisieren.' :
        error instanceof Error ? error.message : 'Speichern fehlgeschlagen. Ihre Eingaben bleiben erhalten.', true);
      return false;
    } finally { savingRef.current = false; setSaving(false); feedback.dismiss(loadingId); }
  };

  const save = async () => {
    const startedAt = toIso(date, startTime); const endedAt = toIso(date, endTime);
    if (!startedAt || !endedAt) { report('Datum, Beginn und Ende bitte vollständig eingeben.', true); return; }
    const pauseMinutes = Number(pause); const travelMinutes = Number(travel);
    if (!Number.isFinite(pauseMinutes) || !Number.isFinite(travelMinutes) || pauseMinutes < 0 || travelMinutes < 0) {
      report('Pause und Fahrzeit müssen gültige, nicht negative Minutenwerte enthalten.', true); return;
    }
    await run(async () => {
      const result = await correctAdministrativeVisitTimes(visit.id, { onTheWayAt: toIso(date, wayTime), arrivedAt: toIso(date, arrivedTime), startedAt, endedAt,
        pauseMinutes, travelMinutes, confirmOverlap: overlap });
      if (!result.ok) return result;
      if (result.data.overlap) { setOverlap(true); return { ok: false, error: 'Zeitüberschneidung erkannt. Prüfen und bewusst erneut bestätigen.' }; }
      setOverlap(false); return { ok: true };
    }, 'Arbeitszeit gespeichert. Einsatzakte und verknüpfte Zeitkonten wurden aktualisiert.', () => { persistedMinutes.current = { pause, travel }; });
  };

  const saveDocumentation = async () => {
    const content = documentation.trim();
    if (!content) { report('Bitte eine Dokumentation eingeben.', true); return; }
    if (savedDocumentation.current === content || documentationBlockAlreadyStored(visit.documentationNotes, content)) {
      report('Dieser Dokumentationsabschnitt ist bereits gespeichert und wird nicht erneut angehängt.'); return;
    }
    await run(() => appendAdministrativeDocumentation(visit.id, content), 'Dokumentation wurde ergänzt und auditiert.', () => {
      savedDocumentation.current = content;
      setDocumentation('');
    });
  };

  const ensureNoPendingInputs = () => {
    if (documentation.trim()) { report('Bitte den Dokumentationstext zuerst speichern oder das Eingabefeld leeren.', true); return false; }
    if (timesDirty) { report('Bitte die geänderten Zeiten zuerst mit „Zeiten prüfen und buchen“ speichern.', true); return false; }
    return true;
  };

  const requestSignature = async () => {
    if (!ensureNoPendingInputs()) return;
    if (changedTasks.length) { report('Bitte die vorgemerkten Aufgaben zuerst gemeinsam speichern.', true); return; }
    if (signaturePresent) { report('Die Unterschrift liegt bereits vor. Eine erneute Anforderung ist nicht erforderlich.'); return; }
    await run(() => requestClientVisitSignature(tenantId, visit), 'Signaturanforderung übertragen. Bis zur Unterschrift bleibt die Abrechnung gesperrt.');
  };

  const saveTasks = async () => {
    if (!changedTasks.length) return;
    await run(async () => {
      const result = await bulkUpdateAdministrativeTasks(visit.id, changedTasks);
      if (result.ok && result.data.skipped) report('Eine nicht mehr vorhandene Aufgabe wurde entfernt.');
      return result;
    }, 'Aufgaben gemeinsam gespeichert. Einsatzakte und Vorschau wurden aktualisiert.');
  };

  const markAllTasks = (status: VisitTaskStatus) => setTaskDrafts(Object.fromEntries(visit.tasks.map(task => [task.id, status])));

  const completeFollowUp = async () => {
    if (!ensureNoPendingInputs()) return;
    const taskStates = visit.tasks.map((task) => ({ taskId: task.id, status: taskDrafts[task.id] ?? task.status }));
    await run(() => completeAdministrativeFollowUp(visit.id, taskStates), signaturePresent
      ? 'Nachbearbeitung abgeschlossen. Die vorhandene Unterschrift bleibt nachvollziehbar zugeordnet.'
      : 'Nachbearbeitung gespeichert. Die angeforderte Unterschrift steht weiterhin aus; die Abrechnung bleibt gesperrt.');
  };

  return (
    <SectionPanel title="Administrative Nachbearbeitung" subtitle="Zeiten, Aufgaben, Dokumentation und Signatur vollständig berichtigen.">
      <View style={{ gap: spacing.md }} testID="administrative-follow-up" pointerEvents={saving ? 'none' : 'auto'}>
        <InfoBanner message="Gespeicherte Änderungen werden automatisch revisionssicher protokolliert. Vorgemerkte Eingaben sind ausdrücklich gekennzeichnet." />

        <SectionPanel title="Arbeitszeit" subtitle="Alle Zeiten gelten für das gewählte Einsatzdatum.">
          <View style={styles.fields}>
          <View style={styles.field}><CareDateInput label="Einsatzdatum" value={date} onChange={value => { setDate(value); setOverlap(false); }} /></View>
          <View style={styles.field}><CareTimeInput label="Unterwegs (optional)" value={wayTime} onChange={value => { setWayTime(value); setOverlap(false); }} showFormatHint={false} /></View>
          <View style={styles.field}><CareTimeInput label="Angekommen (optional)" value={arrivedTime} onChange={value => { setArrivedTime(value); setOverlap(false); }} showFormatHint={false} /></View>
          <View style={styles.field}><CareTimeInput label="Einsatzbeginn" value={startTime} onChange={value => { setStartTime(value); setOverlap(false); }} showFormatHint={false} /></View>
          <View style={styles.field}><CareTimeInput label="Einsatzende" value={endTime} onChange={value => { setEndTime(value); setOverlap(false); }} showFormatHint={false} /></View>
          <View style={styles.field}><PremiumInput label="Pause (Minuten)" accessibilityLabel="Pause (Minuten)" value={pause} onChangeText={value => { setPause(value); setOverlap(false); }} keyboardType="number-pad" /></View>
          <View style={styles.field}><PremiumInput label="Fahrzeit (Minuten, optional)" accessibilityLabel="Fahrzeit (Minuten, optional)" value={travel} onChangeText={value => { setTravel(value); setOverlap(false); }} keyboardType="number-pad" /></View>
          </View>
          {netMinutes != null ? <InfoBanner message={`Voraussichtliche Arbeitszeit: ${netMinutes} Minuten`} /> : null}
          {overlap ? <Text style={{ ...typography.body, color: '#EF4444' }}>Überschneidung erkannt: Erneutes Speichern bestätigt die Korrektur bewusst.</Text> : null}
          <PremiumButton title={overlap ? 'Überschneidung bestätigen und buchen' : 'Zeiten prüfen und buchen'} onPress={save} loading={saving} disabled={saving} fullWidth />
        </SectionPanel>

        <SectionPanel title="Aufgaben">
          <InfoBanner message={changedTasks.length ? `${changedTasks.length} Aufgabenänderung(en) vorgemerkt · noch nicht gespeichert. Gemeinsam speichern oder beim Abschluss übernehmen.` : 'Alle angezeigten Aufgaben entsprechen dem gespeicherten Stand.'} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            <PremiumButton title="Alle erledigt" size="sm" onPress={() => markAllTasks('done')} disabled={saving} />
            <PremiumButton title="Alle nicht gewünscht" size="sm" variant="secondary" onPress={() => markAllTasks('not_requested')} disabled={saving} />
            <PremiumButton title="Auswahl zurücksetzen" size="sm" variant="ghost" onPress={() => setTaskDrafts(Object.fromEntries(visit.tasks.map((task) => [task.id, task.status])))} disabled={saving || changedTasks.length === 0} />
          </View>
          {visit.tasks.map((task) => (
            <View key={task.id} style={styles.task} testID={`admin-task-${task.id}`}>
              <Pressable accessibilityRole="button" accessibilityLabel={`${task.title} bearbeiten`} accessibilityState={{ expanded: expandedTaskId === task.id, disabled: saving }} disabled={saving} onPress={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)} style={styles.taskHeader}>
                <Text style={styles.taskTitle}>{task.title}</Text>
                <Text style={styles.taskStatus}>{VISIT_TASK_STATUS_LABELS[taskDrafts[task.id] ?? task.status]}{(taskDrafts[task.id] ?? task.status) !== task.status ? ' · vorgemerkt' : ''} · {expandedTaskId === task.id ? '−' : '+'}</Text>
              </Pressable>
              {expandedTaskId === task.id ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                {TASK_CORRECTIONS.map((status) => (
                  <PremiumButton
                    key={status}
                    title={VISIT_TASK_STATUS_LABELS[status]}
                    size="sm"
                    variant={(taskDrafts[task.id] ?? task.status) === status ? 'primary' : 'secondary'}
                    onPress={() => setTaskDrafts((current) => ({ ...current, [task.id]: status }))}
                    disabled={saving}
                  />
                ))}
              </View> : null}
            </View>
          ))}
          <PremiumButton
            title={`Aufgaben gemeinsam speichern (${changedTasks.length})`}
            onPress={saveTasks}
            loading={saving}
            disabled={saving || changedTasks.length === 0}
            fullWidth
          />
        </SectionPanel>

        <SectionPanel title="Dokumentation & Signatur">
          {visit.documentationNotes?.trim() ? (
            <View style={styles.task}>
              <PremiumButton title={showStoredDocumentation ? 'Gespeicherte Dokumentation zuklappen' : 'Gespeicherte Dokumentation anzeigen'} variant="secondary" onPress={() => setShowStoredDocumentation(!showStoredDocumentation)} />
              {showStoredDocumentation ? <InfoBanner message={`Bereits gespeichert: ${visit.documentationNotes.trim()}`} /> : null}
            </View>
          ) : null}
          <PremiumInput label="Dokumentationstext" accessibilityLabel="Dokumentationstext" editable={!saving} placeholder="Durchführung, Besonderheiten und Ergebnis vollständig dokumentieren" hint="Der Text wird revisionssicher an die vorhandene Einsatzdokumentation angehängt." value={documentation} onChangeText={setDocumentation} multiline style={{ minHeight: 120 }} />
          <PremiumButton title="Dokumentation dauerhaft speichern" variant="secondary" onPress={saveDocumentation} disabled={saving || !documentation.trim()} fullWidth />
          {signaturePresent ? <InfoBanner message="Die Unterschrift liegt bereits vor. Prüfen Sie die Nachbearbeitung und schließen Sie die Einsatzakte anschließend ab." /> : <PremiumButton title="Signatur im Klient:innenportal anfordern" variant="secondary" onPress={requestSignature} disabled={saving} fullWidth />}
        </SectionPanel>

        {message ? <InfoBanner message={message.text} variant={message.error ? 'warning' : 'info'} /> : null}
        {changedTasks.length ? <Text style={styles.taskStatus}>Beim Abschluss werden {changedTasks.length} vorgemerkte Aufgabenänderung(en) gemeinsam gespeichert.</Text> : null}
        <PremiumButton title="Nachbearbeitung abschließen" onPress={completeFollowUp} loading={saving} disabled={saving} fullWidth />
      </View>
    </SectionPanel>
  );
}

const styles = StyleSheet.create({
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  field: { flexGrow: 1, flexShrink: 1, flexBasis: 240, minWidth: 0, maxWidth: '100%' },
  task: { gap: spacing.xs, padding: spacing.sm, borderWidth: 1, borderColor: '#C8DBED', borderRadius: 12, backgroundColor: '#F6FBFF' },
  taskHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  taskTitle: { ...typography.bodyStrong, color: '#0B2342', flexGrow: 1, flexShrink: 1, flexBasis: 220 },
  taskStatus: { ...typography.caption, color: '#31597F', flexShrink: 1 },
});
