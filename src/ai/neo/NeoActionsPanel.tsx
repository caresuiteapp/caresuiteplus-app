import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumButton, PremiumInput } from './neoUi';
import type { RoleKey } from '@/types';
import { usePermissions } from '@/hooks/usePermissions';
import { fetchVisitDispositionList, fetchVisitDispositionDetail } from '@/lib/assist/visitService';
import { secureRandomId } from '@/lib/platform/secureRandomId';
import { neoScopeKey, type NeoScope } from './neoDomain';
import { neoBerlinTimestamp, parseNeoAdministrativeCommand, type NeoParsedCommand } from './neoActions';
import { createNeoAppointment, moveNeoVisit } from './neoActionService';
import { NeoCommandRecorder } from './NeoCommandRecorder';

export function NeoActionsPanel(props: { scope: NeoScope; role: RoleKey | null }) { return <NeoActionSession key={neoScopeKey(props.scope)} {...props} />; }
function NeoActionSession({ scope, role }: { scope: NeoScope; role: RoleKey | null }) {
  const permissions = usePermissions();
  const [command, setCommand] = useState(''), [plan, setPlan] = useState<NeoParsedCommand | null>(null), [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false), [locked, setLocked] = useState(false), [uncertain, setUncertain] = useState(false);
  const [recording, setRecording] = useState(false), [completed, setCompleted] = useState(false);
  const [visitId, setVisitId] = useState(''), [visitVersion, setVisitVersion] = useState('');
  const [visits, setVisits] = useState<{ id: string; title: string; when: string }[]>([]);
  const alive = useRef(true), inFlight = useRef(false), requestId = useRef('');
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  function changeCommand(text: string) { if (locked || inFlight.current) return; setCommand(text); setPlan(null); setVisits([]); setVisitId(''); setVisitVersion(''); requestId.current = ''; setMessage(''); }
  async function prepare() {
    if (inFlight.current || locked || recording || busy) return;
    try {
      const parsed = parseNeoAdministrativeCommand(command); setPlan(parsed); setMessage(''); setVisitId(''); setVisitVersion(''); setVisits([]); requestId.current = secureRandomId();
      if (parsed.kind === 'visit.move') {
        setBusy(true); const result = await fetchVisitDispositionList(scope.tenantId, role);
        if (!alive.current) return; if (!result.ok) throw Error(result.error);
        setVisits(result.data.filter(item => item.clientId === scope.subjectId && Date.parse(item.scheduledStart) > Date.now() && item.executionStatus === 'pending').map(item => ({ id: item.id, title: item.title, when: new Date(item.scheduledStart).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' }) })));
      }
    } catch (error) { if (alive.current) setMessage(error instanceof Error ? error.message : 'Der Auftrag konnte nicht vorbereitet werden.'); }
    finally { if (alive.current) setBusy(false); }
  }
  async function selectVisit(id: string) {
    if (busy || locked) return;
    setBusy(true); setVisitId(''); setVisitVersion('');
    try {
      const result = await fetchVisitDispositionDetail(id, scope.tenantId, role);
      if (!alive.current) return;
      if (!result.ok || !result.data || result.data.clientId !== scope.subjectId) throw Error(result.ok ? 'Bitte die Personenzuordnung prüfen.' : result.error);
      setVisitId(id); setVisitVersion(result.data.updatedAt);
    } catch (error) { if (alive.current) setMessage((error as Error).message); }
    finally { if (alive.current) setBusy(false); }
  }
  async function execute() {
    if (!plan || recording || inFlight.current || locked && !uncertain || plan.questions.length || plan.kind === 'visit.move' && !visitId) return;
    if (!permissions.can(plan.kind === 'appointment.create' ? 'office.appointments.edit' : 'assist.assignments.manage')) { setMessage('Für diesen Auftrag fehlt die aktuelle Berechtigung.'); return; }
    inFlight.current = true; setBusy(true); setMessage('');
    try {
      const start = neoBerlinTimestamp(plan.date, plan.time);
      const result = plan.kind === 'appointment.create'
        ? await createNeoAppointment(scope, requestId.current, { title: plan.title, startsAt: start, endsAt: new Date(Date.parse(start) + plan.durationMinutes! * 60000).toISOString(), location: '', clientId: scope.subjectId }, role)
        : await moveNeoVisit(scope, { visitId, date: plan.date, time: plan.time, expectedUpdatedAt: visitVersion }, role);
      if (!alive.current) return;
      if (result.ok) { setMessage(result.message); setLocked(true); setUncertain(false); setCompleted(true); }
      else { setMessage(result.error); if (result.uncertain) { setLocked(true); setUncertain(plan.kind === 'appointment.create'); } }
    } catch (error) { if (alive.current) { setLocked(true); setMessage(error instanceof Error ? error.message : 'Die Ausführung ist noch nicht bestätigt. Bitte den ursprünglichen Datensatz prüfen.'); } }
    finally { inFlight.current = false; if (alive.current) setBusy(false); }
  }
  return <View testID="neo-actions-panel" style={styles.panel}>
    <Text style={styles.title}>NEO · Termine und Einsätze</Text>
    <Text style={styles.body}>Ein konkreter Auftrag für die ausgewählte Person. Zum Beispiel: „Erstelle einen Termin morgen um 14 Uhr für 30 Minuten: Beratung“.</Text>
    <NeoCommandRecorder scope={scope} disabled={busy || locked} onCommand={changeCommand} onBusyChange={setRecording} />
    <PremiumInput label="Arbeitsauftrag" value={command} onChangeText={changeCommand} maxLength={2000} multiline editable={!busy && !locked && !recording} />
    <PremiumButton title="Auftrag prüfen" disabled={busy || recording || locked || !command.trim()} onPress={() => void prepare()} />
    {plan ? <View style={{ gap: 12 }}>
      <Text style={styles.body}>{plan.kind === 'appointment.create' ? `Termin: ${plan.title || 'Titel fehlt'}` : 'Einzelnen Einsatz verschieben'} · {plan.date || 'Datum fehlt'} · {plan.time || 'Uhrzeit fehlt'} Uhr{plan.durationMinutes ? ` · ${plan.durationMinutes} Minuten` : plan.kind === 'visit.move' ? ' · Dauer bleibt erhalten' : ''}</Text>
      {plan.questions.map(text => <Text style={styles.notice} key={text}>{text} Bitte den Arbeitsauftrag ergänzen und erneut prüfen.</Text>)}
      {plan.kind === 'visit.move' ? <View style={{ gap: 8 }}><Text style={styles.body}>Welcher konkrete Einsatz?</Text>{visits.map(visit => <PremiumButton key={visit.id} title={`${visit.title} · ${visit.when}`} variant={visitId === visit.id ? 'primary' : 'secondary'} disabled={busy || locked} onPress={() => void selectVisit(visit.id)} />)}{!visits.length && !busy ? <Text style={styles.notice}>Keine zukünftigen, noch nicht begonnenen Einsätze für diese Person gefunden.</Text> : null}</View> : null}
      <PremiumButton title={busy ? 'Auftrag wird ausgeführt …' : uncertain ? 'Dieselbe Terminbestätigung prüfen' : locked ? 'Auftrag abgeschlossen / gesperrt' : 'Geprüften Auftrag ausführen'} disabled={busy || recording || locked && !uncertain || !!plan.questions.length || plan.kind === 'visit.move' && !visitId} onPress={() => void execute()} />
    </View> : null}
    {message ? <Text accessibilityRole="alert" style={styles.notice}>{message}</Text> : null}
    {completed ? <PremiumButton title="Neuen Auftrag beginnen" variant="secondary" onPress={() => { setLocked(false); setCompleted(false); setCommand(''); setPlan(null); setMessage(''); requestId.current = ''; }} /> : null}
  </View>;
}
const styles = StyleSheet.create({ panel: { padding: 18, borderRadius: 20, borderWidth: 1, borderColor: '#4B829D', backgroundColor: '#102B40', gap: 14, marginVertical: 12 }, title: { fontSize: 20, lineHeight: 28, fontWeight: '800', color: '#E8F8FF' }, body: { fontSize: 16, lineHeight: 24, color: '#D9EBF5' }, notice: { fontSize: 16, lineHeight: 24, color: '#FFE2A3' } });
