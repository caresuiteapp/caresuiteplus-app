import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumButton, PremiumInput } from '@/components/ui';
import type { EmployeePortalAssignmentDetail } from '@/types/modules/employeePortalExecution';
import { useAuth } from '@/lib/auth/context';
import { ensurePortalWriteSession } from '@/lib/auth/portalSupabaseAuth';
import { formatEditableVisitTime, parseEditableVisitTime, saveEmployeeOpenVisitTimes } from '@/lib/portal/employeeOpenVisitTimeEdit';

export function EmployeeOpenVisitTimeEditor({ visit, onSaved, disabled = false }: { visit: EmployeePortalAssignmentDetail; onSaved: () => Promise<unknown>; disabled?: boolean }) {
  const { portalSession } = useAuth();
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [drive, setDrive] = useState('');
  const [arrival, setArrival] = useState('');
  const [pause, setPause] = useState('0');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [overlap, setOverlap] = useState(false);
  const lock = useRef(false);
  const begin = () => {
    if (disabled) return;
    setStart(formatEditableVisitTime(visit.actualStartAt));
    setEnd(formatEditableVisitTime(visit.actualEndAt));
    setDrive(formatEditableVisitTime(visit.onTheWayAt));
    setArrival(formatEditableVisitTime(visit.arrivedAt));
    const seconds = (visit.pauseEvents ?? []).reduce((sum, item) => sum + (item.resumedAt ? Math.max(0, (Date.parse(item.resumedAt) - Date.parse(item.pausedAt)) / 1000) : 0), 0);
    setPause(String(Math.round(seconds / 60))); setReason(''); setOverlap(false); setMessage(null); setOpen(true);
  };
  const save = async (confirmOverlap = false) => {
    if (lock.current || disabled) return;
    const startedAt = parseEditableVisitTime(start), endedAt = parseEditableVisitTime(end);
    const onTheWayAt = drive.trim() ? parseEditableVisitTime(drive) : null;
    const arrivedAt = arrival.trim() ? parseEditableVisitTime(arrival) : null;
    const pauseMinutes = Number(pause);
    if (!startedAt || !endedAt || (drive.trim() && !onTheWayAt) || (arrival.trim() && !arrivedAt)) {
      setMessage('Datum und Uhrzeit bitte als TT.MM.JJJJ HH:MM eingeben, z. B. 06.09.2026 10:00.'); return;
    }
    if (startedAt >= endedAt || (onTheWayAt && onTheWayAt > startedAt) || (onTheWayAt && arrivedAt && onTheWayAt > arrivedAt) || (arrivedAt && arrivedAt > startedAt) || !Number.isInteger(pauseMinutes) || pauseMinutes < 0 || pauseMinutes >= (Date.parse(endedAt) - Date.parse(startedAt)) / 60000) {
      setMessage('Bitte Zeitfolge und Pausendauer prüfen.'); return;
    }
    if (!reason.trim()) { setMessage('Bitte die Änderung kurz begründen.'); return; }
    lock.current = true; setBusy(true); setMessage(null);
    try {
      const session = await ensurePortalWriteSession(portalSession, 'workflow');
      if (!session.ok) throw new Error(session.error);
      const result = await saveEmployeeOpenVisitTimes({ tenantId: visit.tenantId, assignmentId: visit.assignmentId, startedAt, endedAt, onTheWayAt, arrivedAt, pauseMinutes, reason, confirmOverlap });
      if (result.overlap) { setOverlap(true); setMessage('Die Zeiten überschneiden sich mit einem anderen Einsatz. Bitte prüfen und nur bestätigen, wenn die Angaben stimmen.'); return; }
      setOpen(false); setMessage('Zeiten gespeichert. Bitte Dokumentation prüfen und die Unterschrift für die geänderten Angaben erneut einholen.');
      await onSaved();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Zeiten konnten nicht gespeichert werden.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return (
    <View style={styles.section}>
      {!open ? <PremiumButton title="Zeiten nachtragen oder bearbeiten" variant="secondary" fullWidth disabled={disabled} onPress={begin} /> : (
        <View style={styles.form}>
          <Text style={styles.title}>Tatsächliche Einsatzzeiten</Text>
          <Text style={styles.copy}>Tragen Sie die tatsächlich geleisteten Zeiten ein. Die Änderung wird mit Begründung gespeichert; eine bisherige Unterschrift muss danach erneuert werden.</Text>
          <PremiumInput label="Anfahrt begonnen (TT.MM.JJJJ HH:MM, optional)" value={drive} onChangeText={setDrive} />
          <PremiumInput label="Angekommen (TT.MM.JJJJ HH:MM, optional)" value={arrival} onChangeText={setArrival} />
          <PremiumInput label="Einsatzbeginn (TT.MM.JJJJ HH:MM)" value={start} onChangeText={setStart} />
          <PremiumInput label="Einsatzende (TT.MM.JJJJ HH:MM)" value={end} onChangeText={setEnd} />
          <PremiumInput label="Pausen in Minuten" value={pause} onChangeText={setPause} keyboardType="number-pad" />
          <PremiumInput label="Grund der Änderung" value={reason} onChangeText={setReason} multiline />
          <PremiumButton title="Zeiten speichern" loading={busy} disabled={disabled} fullWidth onPress={() => void save()} />
          {overlap ? <PremiumButton title="Angaben trotz Überschneidung bestätigen" disabled={busy || disabled} variant="secondary" onPress={() => void save(true)} /> : null}
          <PremiumButton title="Abbrechen" disabled={busy} variant="ghost" onPress={() => setOpen(false)} />
        </View>
      )}
      {message ? <Text style={styles.copy} accessibilityRole="alert">{message}</Text> : null}
    </View>
  );
}
const styles = StyleSheet.create({ section: { gap: 10 }, form: { gap: 12, padding: 16, borderWidth: 1, borderColor: '#BCD6F3', borderRadius: 18, backgroundColor: '#FFFFFF' }, title: { fontSize: 20, fontWeight: '700', color: '#123251' }, copy: { fontSize: 15, lineHeight: 22, color: '#355573' } });
