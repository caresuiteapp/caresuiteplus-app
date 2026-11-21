import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { PremiumButton, PremiumInput } from './neoUi';
import { secureRandomId } from '@/lib/platform/secureRandomId';
import { createNeoCapture } from './neoCapture';
import type { NeoCapture, NeoCaptureSource } from './neoCaptureTypes';
import { checkNeoService, requestNeoModelDraft, transcribeNeoAudio } from './neoGateway';
import { readNeoRecording } from './neoRecording';
import { encodeNeoWav } from './neoAudio';
import { assertNeoScope, extractNeoFacts, neoDraftText, neoScopeKey, NEO_TOPICS, validateNeoReviewedDraft, type NeoDraft, type NeoRole, type NeoScope, type NeoSegment } from './neoDomain';

export type NeoDocumentationPanelProps = {
  scope: NeoScope; disabled?: boolean; onBusyChange?: (busy: boolean) => void;
  onPendingChange?: (pending: boolean) => void;
  onApply: (draft: NeoDraft, segments: NeoSegment[]) => void;
};
export function NeoDocumentationPanel(props: NeoDocumentationPanelProps) {
  const key = neoScopeKey(props.scope);
  return <NeoDocumentationSession key={key} {...props} />;
}
function NeoDocumentationSession({ scope, disabled = false, onApply, onBusyChange, onPendingChange }: NeoDocumentationPanelProps) {
  const [source, setSource] = useState<NeoCaptureSource>('own'), [role, setRole] = useState<NeoRole>('person');
  const [speaker, setSpeaker] = useState('Person selbst'), [consent, setConsent] = useState(false), [expanded, setExpanded] = useState(false);
  const [state, setState] = useState('paused'), [segments, setSegments] = useState<NeoSegment[]>([]), [draft, setDraft] = useState<NeoDraft | null>(null);
  const [manual, setManual] = useState(''), [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const capture = useRef<NeoCapture | null>(null), alive = useRef(true), epoch = useRef(0), busy = useRef(false), limit = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const analysis = useRef<AbortController | null>(null), serviceCheck = useRef<AbortController | null>(null);
  const applied = useRef(new Set<string>());
  const factKey = (fact: NeoDraft['facts'][number]) => JSON.stringify([fact.segmentId, fact.topic, fact.text, fact.role, fact.speaker, fact.status]);
  const latest = useRef({ role, speaker, disabled, consent, segments, onApply, onBusyChange, onPendingChange }); latest.current = { role, speaker, disabled, consent, segments, onApply, onBusyChange, onPendingChange };
  const active = state !== 'paused';
  useEffect(() => { onPendingChange?.(pending || active); }, [pending, active, onPendingChange]);
  const stopNow = () => { epoch.current++; capture.current?.cancel(); capture.current = null; analysis.current?.abort(); serviceCheck.current?.abort(); clearTimeout(limit.current); busy.current = false; latest.current.onBusyChange?.(false); if (alive.current) setState('paused'); };
  useEffect(() => {
    alive.current = true;
    const subscription = AppState.addEventListener('change', next => { if (next !== 'active') stopNow(); });
    const visibility = () => { if (document.hidden) stopNow(); };
    if (Platform.OS === 'web') { document.addEventListener('visibilitychange', visibility); window.addEventListener('pagehide', stopNow); }
    return () => { alive.current = false; stopNow(); latest.current.onPendingChange?.(false); subscription.remove(); if (Platform.OS === 'web') { document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pagehide', stopNow); } };
  }, []);
  useEffect(() => { if (disabled || !consent) stopNow(); }, [disabled, consent]);
  const addText = (text: string, startedAt: number, endedAt: number, provenance?: { role: NeoRole; speaker: string }) => {
    if (!text.trim()) return;
    const current = latest.current;
    setSegments(before => {
      if (before.length >= 200 || before.reduce((n, s) => n + s.text.length, 0) + text.length > 60000) { queueMicrotask(() => { stopNow(); setMessage('Dieser Abschnitt ist vollständig. Bitte die Angaben übernehmen und danach einen neuen Abschnitt beginnen.'); }); return before; }
      const next = [...before, { id: secureRandomId(), text: text.trim(), role: provenance?.role ?? current.role, speaker: provenance?.speaker ?? current.speaker.trim(), startedAt, endedAt }];
      return next;
    });
    setDraft(null);
    setPending(true);
  };
  async function start() {
    if (busy.current || disabled || !consent) return;
    try { assertNeoScope(scope); } catch (error) { setMessage((error as Error).message); return; }
    const serial = ++epoch.current; busy.current = true; onBusyChange?.(true); setState('starting'); setMessage('');
    try {
      if (source === 'own') {
        const request = new AbortController(); serviceCheck.current = request;
        if (!await checkNeoService(scope, request.signal)) throw Error('Der eigene NEO-Sprachdienst ist noch nicht eingerichtet. Im Paket ist der Einrichtungsablauf enthalten.');
      }
      if (!alive.current || serial !== epoch.current || latest.current.disabled || !latest.current.consent) return;
      const engine = createNeoCapture(source, {
        transcribe: (audio, signal) => transcribeNeoAudio(scope, audio, signal),
        onText: (text, begin, end) => { if (alive.current && serial === epoch.current && latest.current.consent && !latest.current.disabled) addText(text, begin, end); },
        onStatus: next => { if (alive.current && serial === epoch.current) setState(next); },
        onError: text => { if (alive.current && serial === epoch.current) { stopNow(); setMessage(text); } },
      }); capture.current = engine;
      await engine.start();
      if (serial !== epoch.current || !alive.current) { engine.cancel(); return; }
      limit.current = setTimeout(() => { stopNow(); setMessage('Die Aufnahme wurde nach 30 Minuten beendet. Die erfassten Aussagen stehen zur Prüfung bereit.'); }, 30 * 60 * 1000);
    } catch (error) { if (serial === epoch.current && alive.current) { stopNow(); setMessage(error instanceof Error ? error.message : 'Die Aufnahme konnte nicht beginnen.'); } }
  }
  async function pause() {
    if (!capture.current) { stopNow(); return; }
    const serial = epoch.current; setState('processing');
    await capture.current.stop(); if (serial !== epoch.current || !alive.current) return;
    capture.current = null; clearTimeout(limit.current); busy.current = false; onBusyChange?.(false); setState('paused');
  }
  function analyze() { if (active || disabled) return; try { setDraft(extractNeoFacts(segments)); setMessage(''); } catch (error) { setMessage((error as Error).message); } }
  async function modelAnalyze() {
    if (active || disabled || busy.current) return;
    const request = new AbortController(); analysis.current?.abort(); analysis.current = request; const serial = ++epoch.current;
    busy.current = true; onBusyChange?.(true); setState('processing'); setMessage('');
    try { const result = await requestNeoModelDraft(scope, segments, request.signal); if (alive.current && serial === epoch.current) setDraft(result); }
    catch (error) { if (alive.current && serial === epoch.current && !request.signal.aborted) setMessage(error instanceof Error ? error.message : 'Die Analyse konnte nicht abgeschlossen werden.'); }
    finally { if (alive.current && serial === epoch.current) { busy.current = false; onBusyChange?.(false); setState('paused'); } }
  }
  async function importRecording() {
    if (busy.current || disabled || !consent) return;
    const serial = ++epoch.current, request = new AbortController(); analysis.current = request;
    busy.current = true; onBusyChange?.(true); setState('processing'); setMessage('');
    try {
      const audio = await readNeoRecording(request.signal); if (!audio) return;
      if (!await checkNeoService(scope, request.signal)) throw Error('Für Audiodateien muss der eigene NEO-Sprachdienst eingerichtet sein.');
      const width = Math.floor(audio.rate * 10), total = Math.ceil(audio.samples.length / width), base = 0;
      if (total + latest.current.segments.length > 200) throw Error('Bitte die Aufnahme in kürzere Abschnitte aufteilen.');
      for (let offset = 0, part = 1; offset < audio.samples.length; offset += width, part++) {
        request.signal.throwIfAborted(); if (serial !== epoch.current || !alive.current) return;
        const samples = audio.samples.subarray(offset, Math.min(offset + width, audio.samples.length));
        if (samples.length / audio.rate < .1) break;
        setMessage(`Aufnahme wird verarbeitet · Abschnitt ${part} von ${total}`);
        const text = await transcribeNeoAudio(scope, encodeNeoWav(samples, audio.rate), request.signal);
        if (serial === epoch.current && alive.current) addText(text, base + offset / audio.rate * 1000, base + (offset + samples.length) / audio.rate * 1000, { role: 'unknown', speaker: `Aufnahme · Abschnitt ${part}` });
      }
      if (serial === epoch.current && alive.current) setMessage('Aufnahme eingelesen. Bitte die Sprecher der erkannten Abschnitte zuordnen und Aussagen prüfen.');
    } catch (error) { if (alive.current && serial === epoch.current && !request.signal.aborted) setMessage(error instanceof Error ? error.message : 'Die Aufnahme konnte nicht vollständig eingelesen werden.'); }
    finally { if (alive.current && serial === epoch.current) { busy.current = false; onBusyChange?.(false); setState('paused'); } }
  }
  const apply = () => {
    if (!draft || active || disabled) return;
    try {
      const verified = validateNeoReviewedDraft(draft, segments);
      const fresh = verified.facts.filter(fact => fact.decision === 'accepted' && !applied.current.has(factKey(fact)));
      if (!fresh.length) { setMessage('Diese Angaben wurden bereits übernommen.'); return; }
      neoDraftText({ ...verified, facts: fresh }); onApply({ ...verified, facts: fresh }, segments);
      fresh.forEach(fact => applied.current.add(factKey(fact))); setPending(verified.facts.some(fact => fact.decision === 'pending'));
      setMessage('Die geprüften Angaben wurden in den aktuellen Entwurf übernommen. Zum verbindlichen Speichern den normalen Speichervorgang verwenden.');
    }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Die Angaben konnten nicht übernommen werden.'); }
  };
  const choose = (id: string, decision: 'accepted' | 'rejected') => setDraft(before => before ? { ...before, facts: before.facts.map(f => f.id === id ? { ...f, decision } : f) } : before);
  return <View testID="neo-documentation-panel" style={styles.panel}>
    <Pressable accessibilityRole="button" accessibilityLabel="NEO-Sprachbegleitung" accessibilityState={{ expanded }} aria-expanded={expanded} onPress={() => { if (!active) setExpanded(value => !value); }} style={styles.heading}>
      <View style={{ flex: 1, minWidth: 0 }}><Text style={styles.title}>NEO · Sprachbegleitung</Text><Text style={styles.body}>Still zuhören, Aussagen zuordnen und den Entwurf vorbereiten.</Text></View><Text style={styles.badge}>{active ? state === 'processing' ? 'Verarbeitung' : 'Aufnahme' : expanded ? 'Schließen' : 'Öffnen'}</Text>
    </Pressable>
    {expanded ? <View style={styles.content}>
      <View style={styles.row}>{(['own', 'device'] as const).map(item => <PremiumButton key={item} title={item === 'own' ? 'Eigener Sprachdienst' : Platform.OS === 'web' ? 'Browsererkennung' : 'Lokale Geräteerkennung'} variant={source === item ? 'primary' : 'secondary'} disabled={active || disabled} onPress={() => setSource(item)} />)}</View>
      <Text style={styles.body}>{source === 'own' ? 'Die Audiodaten verarbeitet der eingerichtete eigene NEO-Dienst. Es erfolgt keine Übertragung an einen fremden KI-Sprachdienst.' : Platform.OS === 'web' ? 'Die Browsererkennung kann den Sprachdienst des Browseranbieters verwenden. Für eine vollständig selbst betriebene Erkennung den eigenen Sprachdienst wählen.' : 'Die Erkennung erfolgt mit dem installierten lokalen Sprachpaket des Geräts.'}</Text>
      <View style={styles.row}>{([['person', 'Person selbst'], ['relative', 'Angehörige'], ['professional', 'Fachperson'], ['unknown', 'Mehrere / unklar']] as const).map(([value, label]) => <PremiumButton key={value} title={label} variant={role === value ? 'primary' : 'secondary'} disabled={active || disabled} onPress={() => { setRole(value); setSpeaker(label); }} />)}</View>
      <PremiumInput label="Sprecher / Quelle" value={speaker} onChangeText={setSpeaker} maxLength={100} editable={!active && !disabled} />
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: consent }} aria-checked={consent} onPress={() => { if (!active) setConsent(v => !v); }} style={styles.consent} disabled={disabled || active}>
        <Text style={styles.check}>{consent ? '✓' : '○'}</Text><Text style={[styles.body, { flex: 1 }]}>Die Beteiligten sind informiert und haben der Aufnahme für diesen Dokumentationszweck zugestimmt.</Text>
      </Pressable>
      <View style={styles.row}><PremiumButton title={active ? 'Aufnahme abschließen' : 'Still zuhören'} disabled={disabled || !consent || state === 'processing' && !capture.current} onPress={() => void (active ? pause() : start())} /><PremiumButton title="Sofort stoppen / Freigabe widerrufen" variant="secondary" disabled={!active && !consent} onPress={() => { stopNow(); setConsent(false); setMessage('Aufnahme beendet. Noch nicht verarbeitete Audiodaten wurden verworfen.'); }} /></View>
      <Text accessibilityLiveRegion="polite" style={styles.status}>{state === 'starting' ? 'Mikrofon wird vorbereitet …' : state === 'listening' ? 'NEO hört still zu. Zum Sprecherwechsel die Aufnahme abschließen.' : state === 'processing' ? 'Sprachabschnitt wird verarbeitet …' : 'Mikrofon aus.'}</Text>
      <PremiumButton title={Platform.OS === 'web' ? 'Vorhandene Audioaufnahme einlesen' : 'WAV-Aufnahme einlesen'} variant="secondary" disabled={active || disabled || !consent} onPress={() => void importRecording()} />
      {message ? <Text accessibilityRole="alert" style={styles.notice}>{message}</Text> : null}
      <PremiumInput label="Gesprächsabschnitt ergänzen oder korrigiert einfügen" value={manual} onChangeText={setManual} maxLength={6000} multiline editable={!active && !disabled} />
      <PremiumButton title="Abschnitt hinzufügen" variant="secondary" disabled={active || disabled || !consent || !manual.trim()} onPress={() => { addText(manual, Date.now(), Date.now()); setManual(''); }} />
      {segments.map((segment, index) => <View key={segment.id} style={styles.segment}>
        <Text style={styles.label}>Abschnitt {index + 1} · {segment.speaker}</Text>
        <PremiumInput label={`Erkannter Wortlaut ${index + 1}`} multiline maxLength={6000} value={segment.text} editable={!active && !disabled} onChangeText={text => { setSegments(before => before.map(s => s.id === segment.id ? { ...s, text } : s)); setDraft(null); setPending(true); }} />
        <PremiumButton title="Abschnitt entfernen" variant="secondary" disabled={active || disabled} onPress={() => { const next = segments.filter(s => s.id !== segment.id); setSegments(next); setDraft(null); setPending(!!next.length); }} />
        {segment.role === 'unknown' ? <View style={styles.row}>{([['person', 'Person selbst'], ['relative', 'Angehörige'], ['professional', 'Fachperson']] as const).map(([value, label]) => <PremiumButton key={value} title={label} variant="secondary" disabled={active || disabled} onPress={() => { setSegments(before => before.map(s => s.id === segment.id ? { ...s, role: value, speaker: label } : s)); setDraft(null); }} />)}</View> : null}
      </View>)}
      <View style={styles.row}><PremiumButton title="Angaben zuordnen" disabled={active || disabled || !segments.length} onPress={analyze} /><PremiumButton title="Eigenes Sprachmodell verwenden" variant="secondary" disabled={active || disabled || !segments.length} onPress={() => void modelAnalyze()} /></View>
      {segments.length ? <PremiumButton title="Gesprächsabschnitte verwerfen" variant="secondary" disabled={active || disabled} onPress={() => { setSegments([]); setDraft(null); setPending(false); setMessage('Die noch angezeigten Gesprächsabschnitte wurden verworfen. Bereits übernommene Angaben bleiben im Dokumentationsentwurf.'); }} /> : null}
      {draft ? <View style={{ gap: 12 }}><Text style={styles.label}>{draft.engine === 'rules' ? 'Belegte Zuordnung mit NEO-Regeln' : 'Belegte Zuordnung mit eigenem Modell'} · {draft.facts.length} Angaben</Text>
        {draft.facts.map(fact => <View key={fact.id} style={styles.fact}><Text style={styles.label}>{NEO_TOPICS[fact.topic]}</Text><Text style={styles.body}>{fact.text}</Text><Text style={styles.source}>Quelle: {fact.speaker} · {fact.status === 'family' ? 'Familien-/Fremdanamnese' : fact.status === 'uncertain' ? 'Ungeklärt' : fact.status === 'historical' ? 'Historisch' : fact.status === 'negated' ? 'Verneint' : 'Berichtet'}</Text><View style={styles.row}><PremiumButton title={fact.decision === 'accepted' ? 'Geprüft und ausgewählt' : 'Geprüft übernehmen'} variant={fact.decision === 'accepted' ? 'primary' : 'secondary'} onPress={() => choose(fact.id, 'accepted')} /><PremiumButton title={fact.decision === 'rejected' ? 'Verworfen' : 'Verwerfen'} variant="secondary" onPress={() => choose(fact.id, 'rejected')} /></View></View>)}
        {draft.openQuestions.map((text, i) => <Text key={i} style={styles.notice}>{text}</Text>)}
        {!draft.facts.length ? <Text style={styles.body}>Keine eindeutig zuordenbaren Angaben gefunden. Unklare Sprecher zuerst zuordnen; der Originaltext bleibt erhalten.</Text> : null}
        <PremiumButton title="Geprüfte Angaben in den Entwurf übernehmen" disabled={active || disabled || !draft.facts.some(f => f.decision === 'accepted')} onPress={apply} />
      </View> : null}
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
