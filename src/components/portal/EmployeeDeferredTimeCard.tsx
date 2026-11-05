import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumButton, PremiumInput } from '@/components/ui';
import { useAuth } from '@/lib/auth/context';
import { ensurePortalWriteSession } from '@/lib/auth/portalSupabaseAuth';
import { formatEditableVisitTime, parseEditableVisitTime } from '@/lib/portal/employeeOpenVisitTimeEdit';
import { EMPLOYEE_DEFERRED_REASON_LABELS, type EmployeeDeferredTime } from '@/lib/portal/employeeDeferredTimeModel';
import { submitEmployeeDeferredTime } from '@/lib/portal/employeeDeferredTimeService';
import { validateOfficeTimeValues } from '@/lib/wfm/wfmOfficeStoredEntry';

export function EmployeeDeferredTimeCard({ task, onSaved, onOpenVisit }: {
  task: EmployeeDeferredTime; onSaved: () => Promise<boolean>; onOpenVisit?: () => void;
}) {
  const { portalSession } = useAuth();
  const [editing, setEditing] = useState(false);
  const [start, setStart] = useState(''), [end, setEnd] = useState('');
  const [pause, setPause] = useState('0'), [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState<string | null>(null);
  const flight = useRef(false);
  const begin = () => {
    setStart(formatEditableVisitTime(task.entry?.actualStartAt ?? null));
    setEnd(formatEditableVisitTime(task.entry?.actualEndAt ?? null));
    setPause(String(task.entry?.pauseMinutes ?? 0)); setReason(''); setMessage(null); setEditing(true);
  };
  const save = async () => {
    if (flight.current || task.state !== 'correction_needed') return;
    const startedAt = parseEditableVisitTime(start), endedAt = parseEditableVisitTime(end);
    const pauseMinutes = /^\d+$/.test(pause.trim()) ? Number(pause.trim()) : NaN;
    const invalid = validateOfficeTimeValues(startedAt, endedAt, pauseMinutes);
    if (invalid || !startedAt || !endedAt) { setMessage(invalid ?? 'Bitte Beginn und Ende vollständig angeben.'); return; }
    if (!reason.trim()) { setMessage('Bitte begründen Sie die Korrektur.'); return; }
    flight.current = true; setBusy(true); setMessage(null);
    try {
      const session = await ensurePortalWriteSession(portalSession, 'workflow');
      if (!session.ok) throw new Error(session.error);
      const result = await submitEmployeeDeferredTime({ task, startedAt, endedAt, pauseMinutes, reason });
      if (!result.ok) throw new Error(result.error);
      setEditing(false);
      const refreshed = await onSaved();
      setMessage(refreshed ? 'Korrektur eingereicht. Die Verwaltung prüft die Zeiten vor der Nachberechnung.'
        : 'Korrektur eingereicht. Der Listenstand konnte noch nicht aktualisiert werden. Bitte erneut laden.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Die Korrektur konnte nicht gespeichert werden.'); }
    finally { flight.current = false; setBusy(false); }
  };
  const stateLabel = task.state === 'awaiting_review' ? 'Wartet auf Freigabe' : task.state === 'office_required' ? 'Klärung durch die Verwaltung' : 'Korrektur erforderlich';
  return <View style={styles.card} testID={`deferred-time-${task.id}`}>
    <Text style={styles.date}>{task.workDate.split('-').reverse().join('.')} · Zurückgestellt</Text>
    <Text style={styles.name}>{task.label}</Text>
    <Text style={styles.copy}>{EMPLOYEE_DEFERRED_REASON_LABELS[task.reason]}</Text>
    <Text style={task.state === 'awaiting_review' ? styles.waiting : styles.status}>{stateLabel}</Text>
    {task.note ? <Text style={styles.copy}>{task.note}</Text> : null}
    {editing ? <View style={styles.form}>
      <Text style={styles.copy}>Bitte tragen Sie die tatsächlich geleisteten Zeiten ein. Die Verwaltung muss die Korrektur anschließend freigeben.</Text>
      <PremiumInput label="Arbeitsbeginn (TT.MM.JJJJ HH:MM)" value={start} onChangeText={setStart} editable={!busy} />
      <PremiumInput label="Arbeitsende (TT.MM.JJJJ HH:MM)" value={end} onChangeText={setEnd} editable={!busy} />
      <PremiumInput label="Pause in Minuten" value={pause} onChangeText={setPause} keyboardType="number-pad" editable={!busy} />
      <PremiumInput label="Grund der Korrektur" value={reason} onChangeText={setReason} multiline editable={!busy} />
      <PremiumButton title="Korrektur zur Prüfung einreichen" fullWidth loading={busy} disabled={busy} onPress={save} />
      <PremiumButton title="Abbrechen" variant="ghost" disabled={busy} onPress={() => setEditing(false)} />
    </View> : task.state === 'correction_needed' ? <PremiumButton title="Zeiten korrigieren" variant="secondary" fullWidth disabled={busy} onPress={begin} /> : null}
    {onOpenVisit ? <PremiumButton title="Einsatz nachbearbeiten" variant="ghost" fullWidth disabled={busy} onPress={onOpenVisit} /> : null}
    {message ? <Text style={styles.copy} accessibilityRole="alert">{message}</Text> : null}
  </View>;
}
const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: '#D7B774', backgroundColor: '#FFFCF5', borderRadius: 18, padding: 18, gap: 10 },
  date: { color: '#76500E', fontSize: 14, fontWeight: '600' },
  name: { color: '#123251', fontSize: 20, fontWeight: '700' },
  copy: { color: '#355573', fontSize: 16, lineHeight: 23 },
  status: { color: '#80510A', fontSize: 14, fontWeight: '700' },
  waiting: { color: '#075FA6', fontSize: 14, fontWeight: '700' },
  form: { gap: 12, paddingTop: 6 },
});
