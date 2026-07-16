import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { CareDateInput, CareTimeInput } from '@/components/inputs';
import { InfoBanner, PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import {
  appendAdministrativeDocumentation,
  completeAdministrativeFollowUp,
  correctAdministrativeVisitTimes,
  requestClientVisitSignature,
  updateAdministrativeTask,
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
  const [overlap, setOverlap] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const start = visit.actualStartAt ?? visit.scheduledStart;
    const end = visit.actualEndAt ?? visit.scheduledEnd;
    setDate(localDate(start));
    setStartTime(localTime(start));
    setEndTime(localTime(end));
    setWayTime(localTime(visit.onTheWayAt));
    setArrivedTime(localTime(visit.arrivedAt));
  }, [
    visit.actualEndAt,
    visit.actualStartAt,
    visit.arrivedAt,
    visit.onTheWayAt,
    visit.scheduledEnd,
    visit.scheduledStart,
  ]);

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
    setReason('');
    setOverlap(false);
    onMessage(`Arbeitszeit aktualisiert${result.data.netMinutes ? `: ${result.data.netMinutes} Minuten` : ''}.`);
    await onSaved();
  };

  const requestSignature = async () => {
    const result = await requestClientVisitSignature(tenantId, visit, reason);
    if (!result.ok) return onMessage(result.error, true);
    setReason('');
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
    setReason('');
    onMessage(message);
    await onSaved();
    return true;
  };

  return (
    <SectionPanel title="Administrative Nachbearbeitung" subtitle="Zeiten, Aufgaben, Dokumentation und Signatur vollständig berichtigen.">
      <View style={{ gap: spacing.md }}>
        <PremiumInput label="Begründung für die Änderung (Pflicht)" value={reason} onChangeText={setReason} multiline />

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
          {visit.tasks.map((task) => (
            <View key={task.id} style={{ gap: spacing.xs }}>
              <Text style={typography.body}>{task.title} · {VISIT_TASK_STATUS_LABELS[task.status]}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                {TASK_CORRECTIONS.map((status) => (
                  <PremiumButton
                    key={status}
                    title={VISIT_TASK_STATUS_LABELS[status]}
                    size="sm"
                    variant={task.status === status ? 'primary' : 'secondary'}
                    onPress={() => run(
                      () => updateAdministrativeTask(visit.id, task.id, status, reason),
                      'Aufgabe wurde aktualisiert und auditiert.',
                    )}
                    disabled={saving || !reason.trim() || task.status === status}
                  />
                ))}
              </View>
            </View>
          ))}
        </SectionPanel>

        <SectionPanel title="Dokumentation & Signatur">
          <PremiumInput label="Dokumentation ergänzen" value={documentation} onChangeText={setDocumentation} multiline />
          <PremiumButton title="Dokumentation ergänzen" variant="secondary" onPress={() => run(() => appendAdministrativeDocumentation(visit.id, documentation, reason), 'Dokumentation wurde ergänzt und auditiert.').then((saved) => { if (saved) setDocumentation(''); })} disabled={saving || !reason.trim() || !documentation.trim()} fullWidth />
          <PremiumButton title="Signatur im Klient:innenportal anfordern" variant="secondary" onPress={requestSignature} disabled={saving || !reason.trim()} fullWidth />
        </SectionPanel>

        <PremiumButton title="Nachbearbeitung abschließen" onPress={() => run(() => completeAdministrativeFollowUp(visit.id, reason), 'Einsatzakte wurde vollständig abgeschlossen.')} disabled={saving || !reason.trim()} fullWidth />
      </View>
    </SectionPanel>
  );
}
