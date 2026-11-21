import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { usePermissions } from '@/hooks/usePermissions';
import { secureRandomId } from '@/lib/platform/secureRandomId';
import { PremiumButton, PremiumInput } from './neoUi';
import { neoScopeKey, type NeoScope, type NeoSegment } from './neoDomain';
import { detectNeoWorkRequest, findNeoWorkCandidates, NEO_WORK_LABELS, neoWorkSourcesCurrent, neoWorkText, parseNeoWorkFields, prepareNeoWork, reviewNeoWork, type NeoWorkDraft, type NeoWorkFields, type NeoWorkKind } from './neoWork';

export type NeoWorkPanelProps = {
  scope: NeoScope; segments: NeoSegment[]; directedCommand?: { id: string; text: string };
  disabled?: boolean; onPendingChange?: (pending: boolean) => void; onPrepared?: (draft: NeoWorkDraft, text: string) => void;
};
export function NeoWorkPanel(props: NeoWorkPanelProps) { return <NeoWorkSession key={neoScopeKey(props.scope)} {...props} />; }
function NeoWorkSession({ scope, segments, directedCommand, disabled = false, onPendingChange, onPrepared }: NeoWorkPanelProps) {
  const [kind, setKind] = useState<NeoWorkKind>('task'), [title, setTitle] = useState(''), [assignee, setAssignee] = useState(''), [dueOn, setDueOn] = useState('');
  const [draft, setDraft] = useState<NeoWorkDraft | null>(null), [message, setMessage] = useState(''), [selection, setSelection] = useState<string[] | undefined>();
  const [request, setRequest] = useState(''), [waiting, setWaiting] = useState<{ id: string; text: string; kind: NeoWorkKind; fields: NeoWorkFields }[]>([]);
  const commands = useRef(new Set<string>()), pendingCallback = useRef(onPendingChange); pendingCallback.current = onPendingChange;
  const permissions = usePermissions(), router = useRouter();
  const dirty = Boolean(draft || title.trim() || assignee.trim() || dueOn.trim() || request.trim());
  const pending = dirty || waiting.length > 0;
  useEffect(() => { onPendingChange?.(pending); }, [pending, onPendingChange]);
  useEffect(() => () => pendingCallback.current?.(false), []);
  useEffect(() => {
    if (!directedCommand || commands.current.has(directedCommand.id)) return;
    commands.current.add(directedCommand.id);
    const next = detectNeoWorkRequest(directedCommand.text);
    if (!next) return;
    const fields = parseNeoWorkFields(directedCommand.text);
    if (dirty) {
      if (waiting.length >= 16) setMessage('16 weitere Arbeitsaufträge warten bereits. Bitte zuerst einen Entwurf abschließen; den zusätzlichen Auftrag anschließend erneut an NEO richten.');
      else setWaiting(before => [...before, { ...directedCommand, kind: next, fields }]);
      return;
    }
    setKind(next); setRequest(directedCommand.text); setDraft(null); setSelection(undefined);
    setTitle(fields.title ?? ''); setAssignee(fields.assignee ?? ''); setDueOn(fields.dueOn ?? '');
    setMessage('Auftrag erkannt. Bitte die Gesprächsbelege und die offenen Angaben prüfen.');
  }, [directedCommand, dirty, waiting.length]);
  const candidates = findNeoWorkCandidates(segments);
  const stale = draft ? !neoWorkSourcesCurrent(draft, scope, segments) : false;
  function reset() { setDraft(null); setTitle(''); setAssignee(''); setDueOn(''); setSelection(undefined); setRequest(''); setMessage(''); }
  function prepare(sourceIds = selection) {
    if (disabled) return;
    try { setDraft(prepareNeoWork(scope, segments, { id: secureRandomId(), kind, title, assignee, dueOn, sourceIds })); setMessage(''); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Der Entwurf konnte nicht vorbereitet werden.'); }
  }
  function confirm() {
    if (!draft || disabled) return;
    try { setDraft(reviewNeoWork(draft, scope, segments)); setMessage('Entwurf geprüft. Es wurde noch keine Aufgabe angelegt und keine Erinnerung aktiviert.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Bitte den Entwurf erneut prüfen.'); }
  }
  return <View testID="neo-work-panel" style={styles.panel}>
    <Text style={styles.heading}>NEO · Aufgaben und Übergabe</Text>
    <Text style={styles.body}>Aus Gesprächsaussagen entstehen prüfbare Entwürfe. Zuständigkeiten und Fristen bleiben offen, bis sie ausdrücklich geklärt sind.</Text>
    <View style={styles.row}>{(Object.keys(NEO_WORK_LABELS) as NeoWorkKind[]).map(value => <PremiumButton key={value} title={NEO_WORK_LABELS[value]} variant={kind === value ? 'primary' : 'secondary'} disabled={disabled} onPress={() => { setKind(value); setDraft(null); }} />)}</View>
    {request ? <Text style={styles.source}>Erkannter Auftrag: {request}</Text> : null}
    {waiting.length ? <View style={styles.quote}><Text style={styles.label}>{waiting.length} {waiting.length === 1 ? 'weiterer Arbeitsauftrag wartet' : 'weitere Arbeitsaufträge warten'}</Text><Text style={styles.body}>{waiting[0].text}</Text><PremiumButton title="Nächsten Arbeitsauftrag vorbereiten" variant="secondary" disabled={disabled || dirty} onPress={() => { if (disabled || dirty || !waiting.length) return; const next = waiting[0]; setWaiting(before => before.slice(1)); setKind(next.kind); setRequest(next.text); setTitle(next.fields.title ?? ''); setAssignee(next.fields.assignee ?? ''); setDueOn(next.fields.dueOn ?? ''); setSelection(undefined); setDraft(null); setMessage('Nächster Auftrag bereit. Bitte die Angaben und Gesprächsbelege prüfen.'); }} /><PremiumButton title="Wartende Arbeitsaufträge verwerfen" variant="secondary" disabled={disabled} onPress={() => setWaiting([])} /></View> : null}
    <PremiumInput label="Titel des Entwurfs" value={title} maxLength={180} editable={!disabled} onChangeText={text => { setTitle(text); setDraft(null); }} onDarkSurface />
    {kind !== 'handover' ? <>
      <PremiumInput label="Zuständige Person, ausdrücklich bestätigt" value={assignee} maxLength={100} editable={!disabled} onChangeText={text => { setAssignee(text); setDraft(null); }} onDarkSurface />
      <PremiumInput label="Fällig am (JJJJ-MM-TT)" value={dueOn} maxLength={10} editable={!disabled} onChangeText={text => { setDueOn(text); setDraft(null); }} onDarkSurface />
    </> : null}
    {selection ? <View style={styles.row}><Text style={styles.source}>Ein ausgewählter Gesprächsbeleg</Text><PremiumButton title="Alle Gesprächsbelege verwenden" variant="secondary" disabled={disabled} onPress={() => { setSelection(undefined); setDraft(null); }} /></View> : null}
    <PremiumButton title="Entwurf aus Gespräch vorbereiten" disabled={disabled || !segments.length} onPress={() => prepare()} />
    {kind !== 'handover' && !selection && candidates.length ? <View style={{ gap: 8 }}><Text style={styles.label}>Mögliche Arbeitsaufträge aus dem Gespräch</Text>{candidates.map(candidate => <View key={candidate.segmentId} style={styles.quote}><Text style={styles.body}>{candidate.text}</Text><PremiumButton title="Diesen Gesprächsbeleg auswählen" variant="secondary" disabled={disabled} onPress={() => { setSelection([candidate.segmentId]); setKind(candidate.kind); setDraft(null); setMessage('Gesprächsbeleg ausgewählt. Bitte Titel, Zuständigkeit und Fälligkeit ergänzen.'); }} /></View>)}</View> : null}
    {draft ? <View style={styles.quote}>
      <Text selectable style={styles.body}>{neoWorkText(draft)}</Text>
      {stale ? <Text accessibilityRole="alert" style={styles.notice}>Der Gesprächsbeleg wurde geändert. Bitte den Entwurf neu vorbereiten.</Text> : null}
      <PremiumButton title={draft.reviewed ? 'Entwurf geprüft' : 'Entwurf nach Sichtprüfung bestätigen'} disabled={disabled || stale || draft.reviewed || !!draft.questions.length} onPress={confirm} />
      {onPrepared && draft.reviewed ? <PremiumButton title="Geprüften Entwurf übernehmen" disabled={disabled || stale} onPress={() => { if (!draft || disabled) return; try { const checked = reviewNeoWork(draft, scope, segments); onPrepared(checked, neoWorkText(checked)); reset(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Bitte die Quellen erneut prüfen.'); } }} /> : null}
    </View> : null}
    {permissions.can('pflege.plans.view') && permissions.can('pflege.plans.manage') ? <PremiumButton title="Vorhandene Aufgabenplanung öffnen" variant="secondary" disabled={disabled || pending} onPress={() => { if (!disabled && !pending && permissions.can('pflege.plans.view') && permissions.can('pflege.plans.manage')) router.push({ pathname: '/pflege/aufgaben', params: { clientId: scope.subjectId } } as never); }} /> : null}
    <Text style={styles.source}>Die Aufgabenplanung wird ohne Gesprächsinhalte im Link geöffnet. Die Entwürfe hier sind noch keine gespeicherten Aufgaben oder aktiven Erinnerungen.</Text>
    {dirty ? <PremiumButton title="Arbeitsentwurf verwerfen" variant="secondary" disabled={disabled} onPress={reset} /> : null}
    {message ? <Text accessibilityRole="alert" style={styles.notice}>{message}</Text> : null}
  </View>;
}
const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderColor: '#4B829D', borderRadius: 18, backgroundColor: '#102B40', padding: 16, gap: 12, marginVertical: 10 },
  heading: { fontSize: 19, lineHeight: 27, fontWeight: '800', color: '#E8F8FF' }, body: { fontSize: 16, lineHeight: 24, color: '#D9EBF5' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }, label: { fontSize: 16, lineHeight: 23, fontWeight: '700', color: '#F0FAFF' },
  source: { fontSize: 14, lineHeight: 21, color: '#B6D6E8' }, notice: { fontSize: 16, lineHeight: 24, color: '#FFE2A3' },
  quote: { padding: 12, gap: 10, borderRadius: 12, backgroundColor: '#193D52' },
});
