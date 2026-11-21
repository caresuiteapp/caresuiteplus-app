import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { usePermissions } from '@/hooks/usePermissions';
import { PremiumButton, PremiumInput } from './neoUi';
import { secureRandomId } from '@/lib/platform/secureRandomId';
import { createNeoCapture } from './neoCapture';
import type { NeoCapture, NeoCaptureSource } from './neoCaptureTypes';
import { checkNeoService, requestNeoModelDraft, transcribeNeoAudio } from './neoGateway';
import { readNeoRecording } from './neoRecording';
import { encodeNeoWav } from './neoAudio';
import { assertNeoScope, extractNeoFacts, neoDraftText, neoScopeKey, NEO_TOPICS, validateNeoReviewedDraft, type NeoDraft, type NeoScope, type NeoSegment } from './neoDomain';
import { createNeoSession, toNeoSegment, type NeoSessionMode, type NeoSpeakerRole } from './neoSession';
import { NeoWorkPanel } from './NeoWorkPanel';
import { checkNeoLocalRecognition, installNeoLocalRecognition, type NeoLocalRecognitionStatus } from './neoLocalRecognition.web';
import { NeoActionsPanel } from './NeoActionsPanel';

const speakerChoices = [['unknown', 'Sprecher ungeklärt'], ['client', 'Klient:in'], ['caregiver', 'Pflegekraft'], ['relative', 'Angehörige'], ['doctor', 'Ärzt:in'], ['other', 'Andere Person']] as const;
export type NeoDocumentationPanelProps = {
  scope: NeoScope; disabled?: boolean; onBusyChange?: (busy: boolean) => void;
  onPendingChange?: (pending: boolean) => void; onApply: (draft: NeoDraft, segments: NeoSegment[]) => void;
  onWorkPrepared?: (text: string) => void;
};
export function NeoDocumentationPanel(props: NeoDocumentationPanelProps) { return <NeoDocumentationSession key={neoScopeKey(props.scope)} {...props} />; }
function NeoDocumentationSession({ scope, disabled = false, onApply, onBusyChange, onPendingChange, onWorkPrepared }: NeoDocumentationPanelProps) {
  const permissions = usePermissions();
  const [source, setSource] = useState<NeoCaptureSource>('own'), [role, setRole] = useState<NeoSpeakerRole>('unknown');
  const [speaker, setSpeaker] = useState('Sprecher ungeklärt'), [consent, setConsent] = useState(false), [expanded, setExpanded] = useState(false);
  const [state, setState] = useState('paused'), [mode, setMode] = useState<NeoSessionMode>('off');
  const [segments, setSegmentState] = useState<NeoSegment[]>([]), [draft, setDraft] = useState<NeoDraft | null>(null);
  const [manual, setManual] = useState(''), [message, setMessage] = useState(''), [pending, setPending] = useState(false);
  const [localPack, setLocalPack] = useState<NeoLocalRecognitionStatus>();
  const [workPending, setWorkPending] = useState(false), [actionPending, setActionPending] = useState(false);
  const [directedCommand, setDirectedCommand] = useState<{ id: string; text: string }>();
  const capture = useRef<NeoCapture | null>(null), alive = useRef(true), epoch = useRef(0), busy = useRef(false);
  const analysis = useRef<AbortController | null>(null), serviceCheck = useRef<AbortController | null>(null);
  const session = useRef(createNeoSession(scope)), segmentState = useRef<NeoSegment[]>([]), applied = useRef(new Set<string>());
  const selections = useRef<{ at: number; role: NeoSpeakerRole; speaker: string }[]>([{ at: 0, role: 'unknown', speaker: 'Sprecher ungeklärt' }]);
  const factKey = (fact: NeoDraft['facts'][number]) => JSON.stringify([fact.segmentId, fact.topic, fact.text, fact.role, fact.speaker, fact.status]);
  const latest = useRef({ disabled, consent, onApply, onBusyChange, onPendingChange }); latest.current = { disabled, consent, onApply, onBusyChange, onPendingChange };
  const active = state !== 'paused';
  useEffect(() => { onPendingChange?.(pending || active || workPending || actionPending); }, [pending, active, workPending, actionPending, onPendingChange]);
  function updateSegments(next: NeoSegment[]) {
    segmentState.current = next; setSegmentState(next);
    if (!next.length) { setDraft(null); setPending(false); return; }
    setDraft(before => {
      const decisions = new Map(before?.facts.map(fact => [factKey(fact), fact.decision]));
      const fresh = extractNeoFacts(next); return { ...fresh, facts: fresh.facts.map(fact => ({ ...fact, decision: decisions.get(factKey(fact)) ?? 'pending' })) };
    }); setPending(true);
  }
  const stopNow = () => {
    epoch.current++; capture.current?.cancel(); capture.current = null; analysis.current?.abort(); serviceCheck.current?.abort(); session.current.stop();
    busy.current = false; latest.current.onBusyChange?.(false); if (alive.current) { setState('paused'); setMode('off'); }
  };
  useEffect(() => {
    alive.current = true;
    const subscription = AppState.addEventListener('change', next => { if (next !== 'active') stopNow(); });
    const visibility = () => { if (document.hidden) stopNow(); };
    if (Platform.OS === 'web') { document.addEventListener('visibilitychange', visibility); window.addEventListener('pagehide', stopNow); }
    const timer = setInterval(() => { if (alive.current) setMode(session.current.getMode()); }, 1000);
    return () => { alive.current = false; stopNow(); clearInterval(timer); latest.current.onPendingChange?.(false); subscription.remove(); if (Platform.OS === 'web') { document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pagehide', stopNow); } };
  }, []);
  useEffect(() => { if (disabled || !consent) stopNow(); }, [disabled, consent]);
  function chooseSource(nextRole: NeoSpeakerRole, label: string) {
    setRole(nextRole); setSpeaker(label); selections.current.push({ at: Date.now(), role: nextRole, speaker: label });
    if (selections.current.length > 200) selections.current = [selections.current[0], ...selections.current.slice(-199)];
  }
  function addText(text: string, startedAt: number, endedAt: number, provenance?: { role: NeoSpeakerRole; speaker: string }, route = false) {
    if (!text.trim()) return;
    const chosen = selections.current.filter(value => value.at <= startedAt).at(-1)!;
    const crossed = selections.current.some(value => value.at > startedAt && value.at <= endedAt);
    const origin = provenance ?? (crossed ? { role: 'unknown' as const, speaker: 'Sprecherwechsel ungeklärt' } : chosen);
    const id = secureRandomId(); session.current.start({ consent: latest.current.consent });
    // IDs represent manually attributed sections, never inferred voice identities.
    session.current.assignSpeaker(id, origin.role, origin.speaker);
    const receipt = session.current.receive({ id, text, speakerId: id, startedAt, endedAt, addressable: route });
    if (!receipt.accepted || !receipt.evidence) {
      if (receipt.reason === 'capacity' || receipt.reason === 'backpressure') { stopNow(); setMessage('Der Abschnitt ist vollständig. Die erfassten Aussagen bleiben erhalten. Bitte prüfen und einen neuen Abschnitt beginnen.'); }
      return;
    }
    const next = [...segmentState.current, toNeoSegment(receipt.evidence)]; updateSegments(next);
    session.current.nextWork().forEach(job => session.current.completeWork(job.item.id, job.token, { payload: extractNeoFacts(next.filter(value => job.item.sourceIds.includes(value.id))) }));
    if (route) {
      setMode(session.current.getMode());
      if (receipt.command) { setDirectedCommand({ id: receipt.command.sourceId, text: receipt.command.text }); setMessage('Auftrag erkannt. Die passende Vorbereitung erscheint unten; ausgeführt wird erst nach deiner Prüfung.'); }
      else if (receipt.wake) setMessage('Ich höre zu. Was soll ich vorbereiten?');
    }
  }
  async function prepareLocalLanguage(install: boolean) {
    if (Platform.OS !== 'web' || busy.current || disabled || active) return;
    const request = new AbortController(), serial = ++epoch.current; serviceCheck.current = request;
    busy.current = true; onBusyChange?.(true); setState('processing');
    setMessage(install ? 'Deutsches Sprachpaket wird im Browser geladen. Das Mikrofon bleibt aus.' : 'Lokales deutsches Sprachpaket wird geprüft. Das Mikrofon bleibt aus.');
    try {
      const Constructor = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
      const result = await (install ? installNeoLocalRecognition(Constructor, request.signal) : checkNeoLocalRecognition(Constructor, request.signal));
      if (alive.current && serial === epoch.current && !request.signal.aborted) { setLocalPack(result); setMessage(result.message + (result.code ? ` [${result.code}]` : '')); }
    } catch { if (alive.current && serial === epoch.current && !request.signal.aborted) setMessage('Die lokale Sprachvorbereitung konnte nicht abgeschlossen werden.'); }
    finally { if (alive.current && serial === epoch.current) { busy.current = false; onBusyChange?.(false); setState('paused'); } }
  }
  async function start() {
    if (busy.current || disabled || !consent) return;
    try { assertNeoScope(scope); } catch (error) { setMessage((error as Error).message); return; }
    const serial = ++epoch.current; busy.current = true; onBusyChange?.(true); setState('starting'); setMessage('');
    try {
      if (source === 'own') { const request = new AbortController(); serviceCheck.current = request; if (!await checkNeoService(scope, request.signal)) throw Error('Die eigene NEO-Erkennung ist noch nicht betriebsbereit. Bitte die Sprachdienst-Einrichtung prüfen.'); }
      else if (Platform.OS === 'web') {
        const request = new AbortController(); serviceCheck.current = request;
        const Constructor = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
        const result = await checkNeoLocalRecognition(Constructor, request.signal);
        if (!alive.current || serial !== epoch.current || request.signal.aborted) return;
        setLocalPack(result); if (!result.canStart) throw Error(result.message + (result.code ? ` [${result.code}]` : ''));
      }
      if (!alive.current || serial !== epoch.current || latest.current.disabled || !latest.current.consent) return;
      session.current.start({ consent: true }); setMode('ambient');
      const engine = createNeoCapture(source, {
        transcribe: (audio, signal) => transcribeNeoAudio(scope, audio, signal),
        onText: (text, begin, end) => { if (alive.current && serial === epoch.current && latest.current.consent && !latest.current.disabled) addText(text, begin, end, undefined, true); },
        onStatus: next => { if (alive.current && serial === epoch.current) setState(next); },
        onError: text => { if (alive.current && serial === epoch.current) { stopNow(); setMessage(text); } },
      }); capture.current = engine; await engine.start();
      if (serial !== epoch.current || !alive.current) { engine.cancel(); return; }
    } catch (error) { if (serial === epoch.current && alive.current) { stopNow(); setMessage(error instanceof Error ? error.message : 'Die Aufnahme konnte nicht beginnen.'); } }
  }
  async function pause() {
    if (!capture.current) { stopNow(); return; }
    const serial = epoch.current; setState('processing');
    await capture.current.stop(); if (serial !== epoch.current || !alive.current) return;
    capture.current = null; session.current.stop(); busy.current = false; onBusyChange?.(false); setState('paused'); setMode('off');
  }
  function analyze() { if (disabled) return; try { updateSegments(segmentState.current); setMessage(''); } catch (error) { setMessage((error as Error).message); } }
  async function modelAnalyze() {
    if (active || disabled || busy.current) return;
    const request = new AbortController(); analysis.current?.abort(); analysis.current = request; const serial = ++epoch.current;
    busy.current = true; onBusyChange?.(true); setState('processing'); setMessage('');
    try { const result = await requestNeoModelDraft(scope, segmentState.current, request.signal); if (alive.current && serial === epoch.current) setDraft(result); }
    catch (error) { if (alive.current && serial === epoch.current && !request.signal.aborted) setMessage(error instanceof Error ? error.message : 'Die Analyse konnte nicht abgeschlossen werden.'); }
    finally { if (alive.current && serial === epoch.current) { busy.current = false; onBusyChange?.(false); setState('paused'); } }
  }
  async function importRecording() {
    if (busy.current || disabled || !consent) return;
    const serial = ++epoch.current, request = new AbortController(); analysis.current = request;
    busy.current = true; onBusyChange?.(true); setState('processing'); setMessage('');
    try {
      const audio = await readNeoRecording(request.signal); if (!audio) return;
      if (!await checkNeoService(scope, request.signal)) throw Error('Für Audiodateien muss die eigene NEO-Erkennung eingerichtet sein.');
      const width = Math.floor(audio.rate * 10), total = Math.ceil(audio.samples.length / width);
      if (total + segmentState.current.length > 200) throw Error('Bitte die Aufnahme in kürzere Abschnitte aufteilen.');
      for (let offset = 0, part = 1; offset < audio.samples.length; offset += width, part++) {
        request.signal.throwIfAborted(); if (serial !== epoch.current || !alive.current) return;
        const samples = audio.samples.subarray(offset, Math.min(offset + width, audio.samples.length)); if (samples.length / audio.rate < .1) break;
        setMessage(`Aufnahme wird verarbeitet · Abschnitt ${part} von ${total}`);
        const text = await transcribeNeoAudio(scope, encodeNeoWav(samples, audio.rate), request.signal);
        if (serial === epoch.current && alive.current) addText(text, offset / audio.rate * 1000, (offset + samples.length) / audio.rate * 1000, { role: 'unknown', speaker: `Aufnahme · Abschnitt ${part}` });
      }
      if (serial === epoch.current && alive.current) setMessage('Aufnahme eingelesen. Bitte Sprecher zuordnen und Aussagen prüfen. Aufgezeichnete NEO-Anreden werden nicht als neue Befehle ausgeführt.');
    } catch (error) { if (alive.current && serial === epoch.current && !request.signal.aborted) setMessage(error instanceof Error ? error.message : 'Die Aufnahme konnte nicht vollständig eingelesen werden.'); }
    finally { session.current.stop(); if (alive.current && serial === epoch.current) { busy.current = false; onBusyChange?.(false); setState('paused'); setMode('off'); } }
  }
  function assignSegment(id: string, nextRole: NeoSpeakerRole, label: string) {
    session.current.assignSpeaker(id, nextRole, label);
    const original = segmentState.current.find(item => item.id === id); if (!original) return;
    const next = toNeoSegment({ ...original, speakerId: id, role: nextRole, speaker: label });
    updateSegments(segmentState.current.map(item => item.id === id ? next : item));
  }
  const apply = () => {
    if (!draft || disabled) return;
    try {
      const verified = validateNeoReviewedDraft(draft, segmentState.current), fresh = verified.facts.filter(fact => fact.decision === 'accepted' && !applied.current.has(factKey(fact)));
      if (!fresh.length) { setMessage('Diese Angaben wurden bereits übernommen.'); return; }
      neoDraftText({ ...verified, facts: fresh }); onApply({ ...verified, facts: fresh }, segmentState.current);
      fresh.forEach(fact => applied.current.add(factKey(fact))); setPending(verified.facts.some(fact => fact.decision === 'pending'));
      setMessage('Die geprüften Angaben wurden in den aktuellen Entwurf übernommen. Verbindlich speichern erfolgt im bestehenden Dokumentationsablauf.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Die Angaben konnten nicht übernommen werden.'); }
  };
  const choose = (id: string, decision: 'accepted' | 'rejected') => setDraft(before => before ? { ...before, facts: before.facts.map(f => f.id === id ? { ...f, decision } : f) } : before);
  return <View testID="neo-documentation-panel" style={styles.panel}>
    <Pressable accessibilityRole="button" accessibilityLabel="NEO-Sprachbegleitung" accessibilityState={{ expanded }} aria-expanded={expanded} onPress={() => { if (!active && !workPending && !actionPending) setExpanded(value => !value); }} style={styles.heading}>
      <View style={{ flex: 1, minWidth: 0 }}><Text style={styles.title}>NEO · Sprachbegleitung</Text><Text style={styles.body}>Still zuhören, bei „NEO“ Aufträge vorbereiten und Aussagen parallel zuordnen.</Text></View><Text style={styles.badge}>{active ? mode === 'dialogue' ? 'Hört aktiv zu' : 'Hört still zu' : expanded ? 'Schließen' : 'Öffnen'}</Text>
    </Pressable>
    {expanded ? <View style={styles.content}>
      <View style={styles.row}>{(['own', 'device'] as const).map(item => <PremiumButton key={item} title={item === 'own' ? 'Eigener Sprachdienst' : Platform.OS === 'web' ? 'Lokale Browsererkennung' : 'Lokale Geräteerkennung'} variant={source === item ? 'primary' : 'secondary'} disabled={active || disabled} onPress={() => setSource(item)} />)}</View>
      <Text style={styles.body}>{source === 'own' ? 'Die eigene NEO-Erkennung verarbeitet Audio innerhalb der eingerichteten Vercel-/Supabase-Architektur.' : Platform.OS === 'web' ? 'Nur lokale Erkennung im Browser. Fehlt diese Fähigkeit oder das deutsche Sprachpaket, bleibt das Mikrofon aus. Es gibt keinen automatischen Wechsel zu einem fremden Sprachdienst.' : 'Die Erkennung verwendet das installierte lokale Sprachpaket des Geräts.'}</Text>
      {Platform.OS === 'web' && source === 'device' ? <View style={styles.row}>
        <PremiumButton title="Sprachpaketstatus prüfen" variant="secondary" disabled={active || disabled} onPress={() => void prepareLocalLanguage(false)} />
        {localPack?.canInstall ? <PremiumButton title="Deutsches Sprachpaket laden" disabled={active || disabled} onPress={() => void prepareLocalLanguage(true)} /> : null}
      </View> : null}
      <Text style={styles.body}>Quelle für folgende Abschnitte manuell bestätigen. Ohne automatische Sprechertrennung bleibt ein Stimmenwechsel ungeklärt; die Rollenwahl ist keine Stimmerkennung.</Text>
      <View style={styles.row}>{speakerChoices.map(([value, label]) => <PremiumButton key={value} title={label} variant={role === value ? 'primary' : 'secondary'} disabled={disabled} onPress={() => chooseSource(value, label)} />)}</View>
      <PremiumInput label="Sprecher / Quelle" value={speaker} onChangeText={value => chooseSource(role, value)} maxLength={100} editable={!disabled} />
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: consent }} aria-checked={consent} onPress={() => { if (!active) setConsent(value => !value); }} style={styles.consent} disabled={disabled || active}>
        <Text style={styles.check}>{consent ? '✓' : '○'}</Text><Text style={[styles.body, { flex: 1 }]}>Die Beteiligten sind informiert und haben der Aufnahme für diesen Dokumentationszweck zugestimmt.</Text>
      </Pressable>
      <View style={styles.row}><PremiumButton title={active ? 'Aufnahme abschließen' : 'Still zuhören'} disabled={disabled || !consent || state === 'processing' && !capture.current} onPress={() => void (active ? pause() : start())} /><PremiumButton title="Sofort stoppen / Freigabe widerrufen" variant="secondary" disabled={!active && !consent} onPress={() => { stopNow(); setConsent(false); setMessage('Aufnahme beendet. Noch nicht verarbeitete Audiodaten wurden verworfen.'); }} /></View>
      <Text accessibilityLiveRegion="polite" style={styles.status}>{state === 'starting' ? 'Mikrofon wird vorbereitet …' : capture.current ? mode === 'dialogue' ? 'Ich höre aktiv zu. Unklare Angaben bleiben zur Rückfrage offen.' : 'NEO hört still zu. „NEO“ am Satzanfang öffnet den Dialog.' : state === 'processing' ? 'Sprachabschnitt wird verarbeitet …' : 'Mikrofon aus.'}</Text>
      <Text style={styles.source}>Die NEO-Anrede wird derzeit im erkannten Wortlaut erkannt. Eine bestätigte Sitzung bleibt im sichtbaren Arbeitsbereich aktiv, bis du sie beendest, den Bereich verlässt oder der Abschnitt voll ist.</Text>
      <PremiumButton title={Platform.OS === 'web' ? 'Vorhandene Audioaufnahme einlesen' : 'WAV-Aufnahme einlesen'} variant="secondary" disabled={active || disabled || !consent} onPress={() => void importRecording()} />
      {message ? <Text accessibilityRole="alert" style={styles.notice}>{message}</Text> : null}
      <PremiumInput label="Gesprächsabschnitt ergänzen oder korrigiert einfügen" value={manual} onChangeText={setManual} maxLength={6000} multiline editable={!disabled} />
      <PremiumButton title="Abschnitt hinzufügen" variant="secondary" disabled={disabled || !consent || !manual.trim()} onPress={() => { addText(manual, Date.now(), Date.now(), { role, speaker }); setManual(''); if (!capture.current) { session.current.stop(); setMode('off'); } }} />
      {segments.map((segment, index) => <View key={segment.id} style={styles.segment}>
        <Text style={styles.label}>Abschnitt {index + 1} · {segment.speaker}</Text>
        <PremiumInput label={`Erkannter Wortlaut ${index + 1}`} multiline maxLength={6000} value={segment.text} editable={!active && !disabled} onChangeText={text => updateSegments(segmentState.current.map(item => item.id === segment.id ? { ...item, text } : item))} />
        <PremiumButton title="Abschnitt entfernen" variant="secondary" disabled={active || disabled} onPress={() => updateSegments(segmentState.current.filter(item => item.id !== segment.id))} />
        <Text style={styles.source}>{segment.role === 'unknown' ? 'Rückfrage: Wer hat diese Aussage gemacht?' : 'Quelle manuell bestätigt. Bei einer falschen Zuordnung neu wählen.'}</Text>
        <View style={styles.row}>{speakerChoices.map(([value, label]) => <PremiumButton key={value} title={`${label} für Abschnitt ${index + 1}`} variant="secondary" disabled={disabled} onPress={() => assignSegment(segment.id, value, label)} />)}</View>
      </View>)}
      <View style={styles.row}><PremiumButton title="Angaben zuordnen" disabled={disabled || !segments.length} onPress={analyze} /><PremiumButton title="Eigenes Sprachmodell verwenden" variant="secondary" disabled={active || disabled || !segments.length} onPress={() => void modelAnalyze()} /></View>
      {segments.length ? <PremiumButton title="Gesprächsabschnitte verwerfen" variant="secondary" disabled={active || disabled || workPending || actionPending} onPress={() => { updateSegments([]); session.current.resetScope(scope); setMode('off'); setMessage('Gesprächsabschnitte verworfen. Bereits übernommene Angaben bleiben im Dokumentationsentwurf.'); }} /> : null}
      {draft ? <View style={{ gap: 12 }}><Text style={styles.label}>{draft.engine === 'rules' ? 'Laufende belegte Zuordnung mit NEO-Regeln' : 'Belegte Zuordnung mit eigenem Modell'} · {draft.facts.length} Angaben</Text>
        {draft.facts.map(fact => <View key={fact.id} style={styles.fact}><Text style={styles.label}>{NEO_TOPICS[fact.topic]}</Text><Text style={styles.body}>{fact.text}</Text><Text style={styles.source}>Quelle: {fact.speaker} · {fact.status === 'family' ? 'Familien-/Fremdanamnese' : fact.status === 'uncertain' ? 'Ungeklärt' : fact.status === 'historical' ? 'Historisch' : fact.status === 'negated' ? 'Verneint' : 'Berichtet'}</Text><View style={styles.row}><PremiumButton title={fact.decision === 'accepted' ? 'Geprüft und ausgewählt' : 'Geprüft übernehmen'} variant={fact.decision === 'accepted' ? 'primary' : 'secondary'} disabled={disabled} onPress={() => choose(fact.id, 'accepted')} /><PremiumButton title={fact.decision === 'rejected' ? 'Verworfen' : 'Verwerfen'} variant="secondary" disabled={disabled} onPress={() => choose(fact.id, 'rejected')} /></View></View>)}
        {draft.openQuestions.map((text, index) => <Text key={index} style={styles.notice}>{text}</Text>)}
        {!draft.facts.length ? <Text style={styles.body}>Keine eindeutig zuordenbaren Angaben gefunden. Unklare Sprecher zuerst zuordnen; der Originaltext bleibt erhalten.</Text> : null}
        <PremiumButton title="Geprüfte Angaben in den Entwurf übernehmen" disabled={disabled || !draft.facts.some(fact => fact.decision === 'accepted')} onPress={apply} />
      </View> : null}
      <NeoWorkPanel scope={scope} segments={segments} directedCommand={directedCommand} disabled={disabled} onPendingChange={setWorkPending} onPrepared={onWorkPrepared ? (_draft, text) => onWorkPrepared(text) : undefined} />
      {!scope.assessmentId && (permissions.can('office.appointments.edit') || permissions.can('assist.assignments.manage')) ? <NeoActionsPanel scope={scope} role={permissions.roleKey ?? null} initialCommand={directedCommand} disableRecorder onPendingChange={setActionPending} disabled={disabled} /> : null}
    </View> : null}
  </View>;
}
const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderColor: '#4B829D', borderRadius: 20, backgroundColor: '#102B40', overflow: 'hidden', marginVertical: 12 },
  heading: { padding: 16, gap: 12, flexDirection: 'row', alignItems: 'center' }, title: { fontSize: 20, lineHeight: 27, fontWeight: '800', color: '#E8F8FF' },
  body: { fontSize: 16, lineHeight: 24, color: '#D9EBF5' }, badge: { color: '#90E5F0', fontSize: 14, fontWeight: '700', maxWidth: 110 },
  content: { padding: 16, paddingTop: 0, gap: 14 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  consent: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 12, backgroundColor: '#193D52' }, check: { color: '#89E5CB', fontSize: 23 },
  status: { fontSize: 16, lineHeight: 24, color: '#8FE6D0' }, notice: { fontSize: 16, lineHeight: 24, color: '#FFE2A3' },
  segment: { padding: 12, gap: 8, borderRadius: 12, backgroundColor: '#16384D' }, fact: { padding: 14, gap: 10, borderRadius: 14, backgroundColor: '#1B4056' },
  label: { fontSize: 16, lineHeight: 23, fontWeight: '700', color: '#F0FAFF' }, source: { fontSize: 14, lineHeight: 21, color: '#B6D6E8' },
});
