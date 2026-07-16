import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import { appendAdministrativeDocumentation, completeAdministrativeFollowUp, correctAdministrativeVisitTimes, requestClientVisitSignature, updateAdministrativeTask } from '@/lib/assist/administrativeVisitService';
import type { VisitDispositionDetail } from '@/lib/assist/visitTypes';
import { spacing, typography } from '@/theme';

export function AdministrativeVisitFollowUpPanel({ visit, tenantId, onSaved, onMessage }: {
  visit: VisitDispositionDetail; tenantId: string; onSaved: () => Promise<void>; onMessage: (message: string, error?: boolean) => void;
}) {
  const [start, setStart] = useState(visit.actualStartAt ?? visit.scheduledStart);
  const [end, setEnd] = useState(visit.actualEndAt ?? visit.scheduledEnd);
  const [way, setWay] = useState(visit.onTheWayAt ?? ''); const [arrived, setArrived] = useState(visit.arrivedAt ?? '');
  const [pause, setPause] = useState('0'); const [travel, setTravel] = useState('0'); const [reason, setReason] = useState('');
  const [documentation, setDocumentation] = useState('');
  const [overlap, setOverlap] = useState(false); const [saving, setSaving] = useState(false);
  useEffect(() => { setStart(visit.actualStartAt ?? visit.scheduledStart); setEnd(visit.actualEndAt ?? visit.scheduledEnd); }, [visit.actualEndAt, visit.actualStartAt, visit.scheduledEnd, visit.scheduledStart]);
  const save = async () => {
    setSaving(true);
    const result = await correctAdministrativeVisitTimes(visit.id, { onTheWayAt: way || null, arrivedAt: arrived || null, startedAt: start, endedAt: end, pauseMinutes: Number(pause), travelMinutes: Number(travel), reason, confirmOverlap: overlap });
    setSaving(false);
    if (!result.ok) return onMessage(result.error, true);
    if (result.data.overlap) { setOverlap(true); return onMessage('Zeitüberschneidung erkannt. Prüfen und bewusst erneut bestätigen.', true); }
    setReason(''); setOverlap(false); onMessage('Administrative Zeiten und Zeitkonto wurden atomar aktualisiert.'); await onSaved();
  };
  const requestSignature = async () => {
    const result = await requestClientVisitSignature(tenantId, visit, reason);
    if (!result.ok) return onMessage(result.error, true);
    setReason(''); onMessage('Signaturanforderung im Klient:innenportal ist offen.'); await onSaved();
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
    <SectionPanel title="Administrative Nachbearbeitung" subtitle="Korrekturen überschreiben keine Werte still und werden vollständig auditiert.">
      <View style={{ gap: spacing.sm }}>
        <PremiumInput label="Unterwegs (ISO-Zeit)" value={way} onChangeText={setWay} />
        <PremiumInput label="Angekommen (ISO-Zeit)" value={arrived} onChangeText={setArrived} />
        <PremiumInput label="Einsatzbeginn (ISO-Zeit)" value={start} onChangeText={setStart} />
        <PremiumInput label="Einsatzende (ISO-Zeit)" value={end} onChangeText={setEnd} />
        <PremiumInput label="Pause (Minuten)" value={pause} onChangeText={setPause} keyboardType="number-pad" />
        <PremiumInput label="Fahrzeit (Minuten, optional)" value={travel} onChangeText={setTravel} keyboardType="number-pad" />
        <PremiumInput label="Begründung (Pflicht)" value={reason} onChangeText={setReason} multiline />
        {overlap ? <Text style={{ ...typography.body, color: '#EF4444' }}>Überschneidung bestätigt: Erneutes Speichern führt die Korrektur bewusst aus.</Text> : null}
        <PremiumButton title={overlap ? 'Überschneidung bestätigen und Zeiten buchen' : 'Zeiten prüfen und buchen'} onPress={save} loading={saving} disabled={saving || !reason.trim()} fullWidth />
        <PremiumButton title="Signatur im Klient:innenportal anfordern" variant="secondary" onPress={requestSignature} disabled={!reason.trim()} fullWidth />
        <PremiumInput label="Dokumentation ergänzen" value={documentation} onChangeText={setDocumentation} multiline />
        <PremiumButton title="Dokumentation revisionssicher ergänzen" variant="secondary" onPress={() => run(() => appendAdministrativeDocumentation(visit.id, documentation, reason), 'Dokumentation wurde ergänzt und auditiert.').then((saved) => { if (saved) setDocumentation(''); })} disabled={saving || !reason.trim() || !documentation.trim()} fullWidth />
        {visit.tasks.map((task) => (
          <View key={task.id} style={{ gap: spacing.xs }}>
            <Text style={typography.body}>{task.title} · {task.status}</Text>
            {task.status === 'open' ? <PremiumButton title="Aufgabe als erledigt markieren" variant="secondary" onPress={() => run(() => updateAdministrativeTask(visit.id, task.id, 'done', reason), 'Aufgabe wurde aktualisiert und auditiert.')} disabled={saving || !reason.trim()} fullWidth /> : null}
          </View>
        ))}
        <PremiumButton title="Administrative Nachbearbeitung abschließen" onPress={() => run(() => completeAdministrativeFollowUp(visit.id, reason), 'Einsatzakte wurde vollständig abgeschlossen.')} disabled={saving || !reason.trim()} fullWidth />
      </View>
    </SectionPanel>
  );
}
