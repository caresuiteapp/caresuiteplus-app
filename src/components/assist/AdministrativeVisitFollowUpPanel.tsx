import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { CareDateInput, CareTimeInput } from '@/components/inputs';
import { InfoBanner, PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
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

export function AdministrativeVisitFollowUpPanel({ visit, tenantId, onSaved, onMessage }: {
  visit: VisitDispositionDetail;
  tenantId: string;
  onSaved: () => Promise<void>;
  onMessage: (message: string, error?: boolean) => void;
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
  const [reason, setReason] = useState('');
  const [documentation, setDocumentation] = useState('');
  const [taskDrafts, setTaskDrafts] = useState<Record<string, VisitTaskStatus>>(() =>
    Object.fromEntries(visit.tasks.map((task) => [task.id, task.status])),
  );
  const [overlap, setOverlap] = useState(false);
  const [saving, setSaving] = useState(false);
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
    setTaskDrafts(Object.fromEntries(
      JSON.parse(persistedTaskState) as [string, VisitTaskStatus][],
    ));
  }, [
    visit.actualEndAt,
    visit.actualStartAt,
    visit.arrivedAt,
    visit.onTheWayAt,
    visit.scheduledEnd,
    visit.scheduledStart,
    persistedTaskState,
  ]);

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

  const save = async () => {
    const startedAt = toIso(date, startTime);
    const endedAt = toIso(date, endTime);
    if (!startedAt || !endedAt) {
      onMessage('Datum, Beginn und Ende bitte vollständig eingeben.', true);
      return;
    }
    setSaving(true);
    const result = await correctAdministrativeVisitTimes(visit.id, {
      onTheWayAt: toIso(date, wayTime),
      arrivedAt: toIso(date, arrivedTime),
      startedAt,
      endedAt,
      pauseMinutes: Number(pause) || 0,
      travelMinutes: Number(travel) || 0,
      reason,
      confirmOverlap: overlap,
    });
    setSaving(false);
    if (!result.ok) return onMessage(result.error, true);
    if (result.data.overlap) {
      setOverlap(true);
      return onMessage('Zeitüberschneidung erkannt. Prüfen und bewusst erneut bestätigen.', true);
    }
    setOverlap(false);
    onMessage(`Arbeitszeit aktualisiert${result.data.netMinutes ? `: ${result.data.netMinutes} Minuten` : ''}.`);
    await onSaved();
  };

  const requestSignature = async () => {
    const result = await requestClientVisitSignature(tenantId, visit, reason);
    if (!result.ok) return onMessage(result.error, true);
    onMessage('Signaturanforderung wurde an das Klient:innenportal übertragen.');
    await onSaved();
  };

  const run = async (operation: () => Promise<{ ok: boolean; error?: string }>, message: string) => {
    setSaving(true);
    const result = await operation();
    setSaving(false);
    if (!result.ok) {
      onMessage(result.error ?? 'Die Nachbearbeitung ist fehlgeschlagen.', true);
      return false;
    }
    onMessage(message);
    await onSaved();
    return true;
  };

  const saveTasks = async () => {
    setSaving(true);
    const result = await bulkUpdateAdministrativeTasks(visit.id, changedTasks, reason);
    setSaving(false);
    if (!result.ok) return onMessage(result.error, true);
    onMessage(`${result.data.updated} Aufgaben wurden gemeinsam gespeichert und auditiert.`);
    await onSaved();
  };

  const markAllTasks = (status: VisitTaskStatus) => {
    setTaskDrafts(Object.fromEntries(visit.tasks.map((task) => [task.id, status])));
  };

  return (
    <SectionPanel title="Administrative Nachbearbeitung" subtitle="Zeiten, Aufgaben, Dokumentation und Signatur vollständig berichtigen.">
      <View style={{ gap: spacing.md }}>
        <InfoBanner
          message={reason.trim()
            ? 'Die Begründung gilt für alle Änderungen in dieser Nachbearbeitung.'
            : 'Zuerst eine Begründung eingeben. Danach können Zeiten, Aufgaben, Dokumentation und Signatur bearbeitet werden.'}
        />
        <PremiumInput
          label="Gemeinsame Begründung für die Nachbearbeitung (Pflicht)"
          placeholder="z. B. Einsatz wurde vor Ort durchgeführt, mobile Erfassung war nicht möglich"
          hint="Einmal eingeben – gilt für alle folgenden Änderungen und bleibt während der Bearbeitung erhalten."
          value={reason}
          onChangeText={setReason}
          multiline
          style={{ minHeight: 88 }}
        />

        <SectionPanel title="Arbeitszeit" subtitle="Alle Zeiten gelten für das gewählte Einsatzdatum.">
          <CareDateInput label="Einsatzdatum" value={date} onChange={setDate} />
          <CareTimeInput label="Unterwegs (optional)" value={wayTime} onChange={setWayTime} showFormatHint={false} />
          <CareTimeInput label="Angekommen (optional)" value={arrivedTime} onChange={setArrivedTime} showFormatHint={false} />
          <CareTimeInput label="Einsatzbeginn" value={startTime} onChange={setStartTime} showFormatHint={false} />
          <CareTimeInput label="Einsatzende" value={endTime} onChange={setEndTime} showFormatHint={false} />
          <PremiumInput label="Pause (Minuten)" value={pause} onChangeText={setPause} keyboardType="number-pad" />
          <PremiumInput label="Fahrzeit (Minuten, optional)" value={travel} onChangeText={setTravel} keyboardType="number-pad" />
          {netMinutes != null ? <InfoBanner message={`Voraussichtliche Arbeitszeit: ${netMinutes} Minuten`} /> : null}
          {overlap ? <Text style={{ ...typography.body, color: '#EF4444' }}>Überschneidung erkannt: Erneutes Speichern bestätigt die Korrektur bewusst.</Text> : null}
          <PremiumButton title={overlap ? 'Überschneidung bestätigen und buchen' : 'Zeiten prüfen und buchen'} onPress={save} loading={saving} disabled={saving || !reason.trim()} fullWidth />
        </SectionPanel>

        <SectionPanel title="Aufgaben">
          <InfoBanner message={`${changedTasks.length} Aufgabenänderungen vorgemerkt. Erst „Aufgaben gemeinsam speichern“ schreibt sie dauerhaft.`} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            <PremiumButton title="Alle erledigt" size="sm" onPress={() => markAllTasks('done')} disabled={saving} />
            <PremiumButton title="Alle nicht gewünscht" size="sm" variant="secondary" onPress={() => markAllTasks('not_requested')} disabled={saving} />
            <PremiumButton title="Auswahl zurücksetzen" size="sm" variant="ghost" onPress={() => setTaskDrafts(Object.fromEntries(visit.tasks.map((task) => [task.id, task.status])))} disabled={saving || changedTasks.length === 0} />
          </View>
          {visit.tasks.map((task) => (
            <View key={task.id} style={{ gap: spacing.xs }}>
              <Text style={typography.body}>{task.title} · {VISIT_TASK_STATUS_LABELS[taskDrafts[task.id] ?? task.status]}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
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
              </View>
            </View>
          ))}
          <PremiumButton
            title={`Aufgaben gemeinsam speichern (${changedTasks.length})`}
            onPress={saveTasks}
            loading={saving}
            disabled={saving || !reason.trim() || changedTasks.length === 0}
            fullWidth
          />
        </SectionPanel>

        <SectionPanel title="Dokumentation & Signatur">
          <PremiumInput label="Dokumentationstext" placeholder="Durchführung, Besonderheiten und Ergebnis vollständig dokumentieren" hint="Der Text wird revisionssicher an die vorhandene Einsatzdokumentation angehängt." value={documentation} onChangeText={setDocumentation} multiline style={{ minHeight: 120 }} />
          <PremiumButton title="Dokumentation dauerhaft speichern" variant="secondary" onPress={() => run(() => appendAdministrativeDocumentation(visit.id, documentation, reason), 'Dokumentation wurde ergänzt und auditiert.').then((saved) => { if (saved) setDocumentation(''); })} disabled={saving || !reason.trim() || !documentation.trim()} fullWidth />
          <PremiumButton title="Signatur im Klient:innenportal anfordern" variant="secondary" onPress={requestSignature} disabled={saving || !reason.trim()} fullWidth />
        </SectionPanel>

        <PremiumButton title="Nachbearbeitung abschließen" onPress={() => run(() => completeAdministrativeFollowUp(visit.id, reason), 'Einsatzakte wurde vollständig abgeschlossen.')} disabled={saving || !reason.trim()} fullWidth />
      </View>
    </SectionPanel>
  );
}
