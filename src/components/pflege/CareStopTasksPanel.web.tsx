import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { ErrorState, LoadingState, PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { formatTime } from '@/lib/formatters/dateTimeFormatters';
import type { RoleKey } from '@/types';
import {
  fetchCareStopTaskContext, fetchPortalCareStopTaskContext, newCareStopTaskRequestId,
  prepareCareStopTasks, preparePortalCareStopTasks, recordCareStopTaskExecution,
  recordPortalCareStopTaskExecution, type CareStopTaskContext, type CareStopTaskExecutionInput,
  type CareStopTaskOutcome,
} from '@/lib/pflege/careStopTaskService';
import { validateCareStopTaskDraft } from '@/lib/pflege/careStopTaskDomain';

type Draft = { outcome: CareStopTaskOutcome | ''; resultDetail: string; hasDeviation: boolean; deviationReason: string; observation: string };
const blank = (): Draft => ({ outcome: '', resultDetail: '', hasDeviation: false, deviationReason: '', observation: '' });
const outcomeLabel: Record<CareStopTaskOutcome, string> = { performed: 'Durchgeführt', not_performed: 'Nicht durchgeführt', refused: 'Abgelehnt' };

export function CareStopTasksPanel({ stopId, tenantId, role, portal = false, disabled, onChanged }: { stopId: string; tenantId?: string | null; role?: RoleKey | null; portal?: boolean; disabled?: boolean; onChanged: () => void | Promise<void> }) {
  const { c } = useCareLightPalette(); const [context, setContext] = useState<CareStopTaskContext | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({}); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const pending = useRef<Record<string, CareStopTaskExecutionInput>>({}); const alive = useRef(true);
  async function load() { if (!portal && !tenantId) return; setBusy(true); setError(''); const r = portal ? await fetchPortalCareStopTaskContext(stopId) : await fetchCareStopTaskContext(tenantId!, role, stopId); if (!alive.current) return; setBusy(false); if (!r.ok) setError(r.error); else setContext(r.data); }
  useEffect(() => { alive.current = true; pending.current = {}; setDrafts({}); void load(); return () => { alive.current = false; }; }, [stopId, tenantId, role, portal]);
  function patch(bindingId: string, value: Partial<Draft>) { setDrafts((all) => ({ ...all, [bindingId]: { ...(all[bindingId] ?? blank()), ...value } })); }
  async function prepare() { if (busy || (!portal && !tenantId)) return; setBusy(true); setError(''); const r = portal ? await preparePortalCareStopTasks(stopId) : await prepareCareStopTasks(tenantId!, role, stopId); if (!alive.current) return; setBusy(false); if (!r.ok) setError(r.error); else setContext(r.data); }
  async function submit(bindingId: string) {
    if (busy || (!portal && !tenantId)) return; const draft = drafts[bindingId] ?? blank();
    if (!pending.current[bindingId]) {
      const checked = validateCareStopTaskDraft(draft); if (!checked.ok) { setError(checked.error); return; }
      pending.current[bindingId] = { bindingId, ...checked.data, requestId: newCareStopTaskRequestId() };
    }
    setBusy(true); setError(''); const frozen = pending.current[bindingId];
    const r = portal ? await recordPortalCareStopTaskExecution(frozen) : await recordCareStopTaskExecution(tenantId!, role, frozen);
    if (!alive.current) return; setBusy(false);
    if (!r.ok) { setError(`${r.error} Dieselbe unveränderte Anfrage kann erneut gesendet werden.`); return; }
    delete pending.current[bindingId]; setDrafts((all) => { const next = { ...all }; delete next[bindingId]; return next; }); await load(); await onChanged();
  }
  return <SectionPanel title="Planaufgaben im Einsatz" subtitle="Planstand gebunden · Ergebnis und Abweichung getrennt">
    {busy && !context ? <LoadingState message="Planaufgaben werden geladen…" /> : null}{error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
    {context && !context.openingId ? <Text style={{ color: c.muted }}>Für diesen Einsatz liegt kein bestätigter Versorgungsbeginn mit gebundenem Planstand vor.</Text> : null}
    {context?.openingId && !context.prepared && context.availableTaskCount > 0 ? <><Text style={{ color: c.text }}>Die beim Versorgungsbeginn eingefrorenen Planaufgaben müssen vor der Einzeldokumentation gebunden werden.</Text><PremiumButton title="Planaufgaben aus Beginnstand binden" disabled={busy || disabled} loading={busy} onPress={() => void prepare()} /></> : null}
    {context?.openingId && !context.prepared && context.availableTaskCount === 0 ? <Text style={{ color: c.muted }}>Beim bestätigten Beginn wurden keine offenen Planaufgaben gespeichert. Daraus wird keine Durchführung abgeleitet.</Text> : null}
    {context?.tasks.map((task) => { const draft = drafts[task.bindingId] ?? blank(); const frozen = pending.current[task.bindingId]; return <View key={task.bindingId} style={{ gap: 8, paddingVertical: 12 }}>
      <Text style={{ color: c.text, fontWeight: '700' }}>{String(task.plannedTask.title ?? 'Planaufgabe')}</Text>
      {task.plannedTask.intervention ? <Text style={{ color: c.text }}>{String(task.plannedTask.intervention)}</Text> : null}
      <Text style={{ color: c.muted }}>{[task.plannedTask.timing,task.plannedTask.frequency,task.plannedTask.responsibleRole].filter(Boolean).map(String).join(' · ') || 'Keine weiteren Planangaben'}</Text>
      {task.execution ? <><Text style={{ color: c.text }}>{outcomeLabel[task.execution.outcome]} · {task.execution.resultDetail}</Text><Text style={{ color: c.muted }}>{formatTime(task.execution.recordedAt)} · {task.execution.recordedByName}{task.execution.deviationReason ? ` · Abweichung: ${task.execution.deviationReason}` : ''}{task.execution.observation ? ` · Beobachtung: ${task.execution.observation}` : ''}</Text></> : <>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{(['performed','not_performed','refused'] as const).map((outcome) => <PremiumButton key={outcome} variant="secondary" title={`${draft.outcome === outcome ? 'Ausgewählt: ' : ''}${outcomeLabel[outcome]}`} disabled={busy || disabled || !!frozen} onPress={() => patch(task.bindingId, { outcome })} />)}</View>
        <PremiumInput label="Tatsächliches Ergebnis / fachliches Detail" value={draft.resultDetail} onChangeText={(value) => patch(task.bindingId, { resultDetail: value })} multiline editable={!busy && !disabled && !frozen} />
        <PremiumButton variant="secondary" title={draft.hasDeviation ? 'Abweichung: ja' : 'Abweichung: nein'} disabled={busy || disabled || !!frozen || (draft.outcome !== '' && draft.outcome !== 'performed')} onPress={() => patch(task.bindingId, { hasDeviation: !draft.hasDeviation })} />
        {(draft.hasDeviation || (draft.outcome !== '' && draft.outcome !== 'performed')) ? <PremiumInput label="Grund der Abweichung / Nichtdurchführung" value={draft.deviationReason} onChangeText={(value) => patch(task.bindingId, { deviationReason: value })} multiline editable={!busy && !disabled && !frozen} /> : null}
        <PremiumInput label="Beobachtung (optional)" value={draft.observation} onChangeText={(value) => patch(task.bindingId, { observation: value })} multiline editable={!busy && !disabled && !frozen} />
        <PremiumButton title={frozen ? 'Unveränderte Anfrage erneut senden' : 'Einzeldokumentation speichern'} disabled={busy || disabled} loading={busy} onPress={() => void submit(task.bindingId)} />
      </>}
    </View>; })}
    <Text style={{ color: c.muted }}>Ein Planpunkt, eine Auswahl oder ein beendeter Einsatz bestätigt keine Durchführung. Gespeichert werden Planbezug, Ergebnis, Abweichung, Beobachtung, Person und Serverzeit; fachliche Prüfung und Freigabe bleiben getrennt.</Text>
  </SectionPanel>;
}
