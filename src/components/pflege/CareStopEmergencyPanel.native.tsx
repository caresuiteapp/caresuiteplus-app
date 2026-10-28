// Generated native presentation from src/components/pflege/CareStopEmergencyPanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { ErrorState, LoadingState, PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import { CareWriteReconciliationNotice } from "./CareWriteReconciliationNotice.native.tsx";
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { formatTime } from '@/lib/formatters/dateTimeFormatters';
import type { RoleKey } from '@/types';
import { fetchCareEmergencyContext, openCareEmergency, recordCareEmergencyEvent, type CareEmergencyContext } from '@/lib/pflege/careStopEmergencyService';
import { newCareEmergencyRequestId, validateCareEmergencyEventDraft, validateCareEmergencyOpenDraft, type CareEmergencyEventDraft, type CareEmergencyEventKind, type CareEmergencyOpenDraft } from '@/lib/pflege/careStopEmergencyDomain';
import { freezeCareStopWriteRequest } from '@/lib/pflege/careStopWriteReconciliationDomain';
const blankOpen = (): CareEmergencyOpenDraft => ({ observedFacts: '', severity: '', immediateMeasure: '' });
const blankEvent = (kind: CareEmergencyEventKind = 'immediate_measure'): CareEmergencyEventDraft => ({ kind, detail: '', channel: '', targetLabel: '', referenceEventId: '', outcome: '', recipientName: '', recipientRole: '', responsibility: '', confirmation: '', assigneeLabel: '', dueAt: '', noHandoverReason: '' });
type FrozenEmergencyRequest = {
    kind: 'open';
    requestId: string;
    expectedStopUpdatedAt: string;
    payload: CareEmergencyOpenDraft;
} | {
    kind: 'event';
    requestId: string;
    incidentId: string;
    payload: CareEmergencyEventDraft;
};
export function CareStopEmergencyPanel({ stopId, tenantId, role, disabled }: {
    stopId: string;
    tenantId: string;
    role?: RoleKey | null;
    disabled?: boolean;
}) {
    const { c } = useCareLightPalette();
    const [context, setContext] = useState<CareEmergencyContext | null>(null);
    const [opening, setOpening] = useState(blankOpen);
    const [event, setEvent] = useState(blankEvent);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const frozen = useRef<FrozenEmergencyRequest | null>(null);
    const alive = useRef(true);
    async function load() { setBusy(true); setError(''); const r = await fetchCareEmergencyContext(tenantId, role, stopId); if (!alive.current)
        return; setBusy(false); if (!r.ok)
        setError(r.error);
    else
        setContext(r.data); }
    useEffect(() => { alive.current = true; frozen.current = null; void load(); return () => { alive.current = false; }; }, [stopId, tenantId, role]);
    async function submitOpen() { if (!context || busy)
        return; if (!frozen.current) {
        const v = validateCareEmergencyOpenDraft(opening);
        if (!v.ok) {
            setError(v.error);
            return;
        }
        frozen.current = { kind: 'open', requestId: newCareEmergencyRequestId(), expectedStopUpdatedAt: context.stopUpdatedAt, payload: v.data };
    } const f = frozen.current; if (f.kind !== 'open')
        return; setBusy(true); const r = await openCareEmergency(tenantId, role, stopId, f.expectedStopUpdatedAt, f.payload, f.requestId); if (!alive.current)
        return; setBusy(false); if (!r.ok) {
        setError(`${r.error} Dieselbe unveränderte Anfrage kann erneut gesendet werden.`);
        return;
    } frozen.current = null; setOpening(blankOpen()); await load(); }
    async function submitEvent() { if (!context?.incident || busy)
        return; if (!frozen.current) {
        const v = validateCareEmergencyEventDraft(event);
        if (!v.ok) {
            setError(v.error);
            return;
        }
        frozen.current = { kind: 'event', requestId: newCareEmergencyRequestId(), incidentId: context.incident.id, payload: v.data };
    } const f = frozen.current; if (f.kind !== 'event')
        return; setBusy(true); const r = await recordCareEmergencyEvent(tenantId, role, f.incidentId, f.payload, f.requestId); if (!alive.current)
        return; setBusy(false); if (!r.ok) {
        setError(`${r.error} Dieselbe unveränderte Anfrage kann erneut gesendet werden.`);
        return;
    } frozen.current = null; setEvent(blankEvent()); await load(); }
    const reconciliation = frozen.current?.kind === 'open' ? freezeCareStopWriteRequest('emergency_open', frozen.current.requestId, { stopId, expectedStopUpdatedAt: frozen.current.expectedStopUpdatedAt, ...frozen.current.payload }) : frozen.current?.kind === 'event' ? freezeCareStopWriteRequest('emergency_event', frozen.current.requestId, { incidentId: frozen.current.incidentId, ...frozen.current.payload }) : null;
    async function acceptReconciliation() { const pending = frozen.current; frozen.current = null; if (pending?.kind === 'open')
        setOpening(blankOpen());
    else if (pending?.kind === 'event')
        setEvent(blankEvent()); await load(); }
    const incident = context?.incident;
    const attempts = incident?.events.filter(e => e.kind === 'contact_attempt') ?? [];
    const reached = incident?.events.filter(e => e.kind === 'contact_result' && e.outcome === 'reached') ?? [];
    return <SectionPanel title="Akuter Notfall" subtitle="Reale Maßnahmen · Kontakte · Übergabe · Verlauf"><Text accessibilityRole="alert" style={{ color: c.danger, fontWeight: '700' }}>Bei akuter Gefahr sofort die örtlich vorgesehene Notfallkette auslösen. Diese Dokumentation löst selbst keinen Notruf aus.</Text>{busy && !context ? <LoadingState message="Notfallverlauf wird geladen…"/> : null}{error ? <ErrorState message={error} onRetry={() => void load()}/> : null}{reconciliation ? <CareWriteReconciliationNotice tenantId={tenantId} role={role} request={reconciliation} disabled={busy || disabled} onConfirmed={() => acceptReconciliation()}/> : null}
 {!incident && context ? <><PremiumInput label="Tatsächlich beobachtetes Ereignis" value={opening.observedFacts} onChangeText={observedFacts => setOpening(v => ({ ...v, observedFacts }))} multiline editable={!busy && !disabled && !frozen.current}/><View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}><PremiumButton variant="secondary" title={`${opening.severity === 'urgent' ? 'Ausgewählt: ' : ''}Dringend`} onPress={() => setOpening(v => ({ ...v, severity: 'urgent' }))} disabled={busy || disabled || !!frozen.current}/><PremiumButton variant="secondary" title={`${opening.severity === 'life_threatening' ? 'Ausgewählt: ' : ''}Lebensbedrohlich`} onPress={() => setOpening(v => ({ ...v, severity: 'life_threatening' }))} disabled={busy || disabled || !!frozen.current}/></View><PremiumInput label="Tatsächlich veranlasste Sofortmaßnahme" value={opening.immediateMeasure} onChangeText={immediateMeasure => setOpening(v => ({ ...v, immediateMeasure }))} multiline editable={!busy && !disabled && !frozen.current}/><PremiumButton title={frozen.current ? 'Unveränderte Notfallanlage erneut senden' : 'Notfallvorgang dokumentieren'} onPress={() => void submitOpen()} disabled={busy || disabled}/></> : null}
 {incident ? <><Text style={{ color: c.text, fontWeight: '700' }}>{incident.severity === 'life_threatening' ? 'Lebensbedrohlicher' : 'Dringender'} Vorgang · {formatTime(incident.openedAt)} · {incident.openedByName}</Text><Text style={{ color: c.text }}>{incident.observedFacts}</Text>{incident.events.map(e => <Text key={e.id} style={{ color: c.muted }}>{e.sequence}. {e.kind} · {formatTime(e.recordedAt)} · {e.recordedByName} · {e.detail}{e.targetLabel ? ` · Ziel: ${e.targetLabel}` : ''}{e.outcome ? ` · Ergebnis: ${e.outcome}` : ''}</Text>)}{!incident.closed ? <><View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>{(['immediate_measure', 'contact_attempt', 'contact_result', 'handover', 'follow_up', 'closure'] as CareEmergencyEventKind[]).map(kind => <PremiumButton key={kind} variant="secondary" title={`${event.kind === kind ? 'Ausgewählt: ' : ''}${kind}`} onPress={() => setEvent(blankEvent(kind))} disabled={busy || disabled || !!frozen.current}/>)}</View><PremiumInput label="Tatsächliches Detail" value={event.detail} onChangeText={detail => setEvent(v => ({ ...v, detail }))} multiline editable={!busy && !disabled && !frozen.current}/>{event.kind === 'contact_attempt' ? <><PremiumInput label="Kontaktweg (phone / in_person / emergency_service / office / contact_person / other)" value={event.channel} onChangeText={channel => setEvent(v => ({ ...v, channel }))} editable={!busy && !disabled && !frozen.current}/><PremiumInput label="Tatsächlich adressiertes Ziel" value={event.targetLabel} onChangeText={targetLabel => setEvent(v => ({ ...v, targetLabel }))} editable={!busy && !disabled && !frozen.current}/></> : null}{event.kind === 'contact_result' ? <><PremiumInput label="Bezug: ID des Kontaktversuchs" value={event.referenceEventId} onChangeText={referenceEventId => setEvent(v => ({ ...v, referenceEventId }))} editable={!busy && !disabled && !frozen.current}/><PremiumInput label="Ergebnis (reached / no_answer / failed)" value={event.outcome} onChangeText={outcome => setEvent(v => ({ ...v, outcome }))} editable={!busy && !disabled && !frozen.current}/><Text style={{ color: c.muted }}>{attempts.length} dokumentierte Kontaktversuche stehen als Originalbezug bereit.</Text></> : null}{event.kind === 'handover' ? <><PremiumInput label="Bezug: ID des erreichten Kontaktergebnisses" value={event.referenceEventId} onChangeText={referenceEventId => setEvent(v => ({ ...v, referenceEventId }))} editable={!busy && !disabled && !frozen.current}/><PremiumInput label="Empfangende Person" value={event.recipientName} onChangeText={recipientName => setEvent(v => ({ ...v, recipientName }))} editable={!busy && !disabled && !frozen.current}/><PremiumInput label="Rolle / Stelle" value={event.recipientRole} onChangeText={recipientRole => setEvent(v => ({ ...v, recipientRole }))} editable={!busy && !disabled && !frozen.current}/><PremiumInput label="Übernommene Zuständigkeit" value={event.responsibility} onChangeText={responsibility => setEvent(v => ({ ...v, responsibility }))} multiline editable={!busy && !disabled && !frozen.current}/><PremiumInput label="Tatsächliche Bestätigung / Rückmeldung" value={event.confirmation} onChangeText={confirmation => setEvent(v => ({ ...v, confirmation }))} multiline editable={!busy && !disabled && !frozen.current}/><Text style={{ color: c.muted }}>{reached.length} tatsächlich erreichte Kontaktergebnisse stehen als Übergabebezug bereit.</Text></> : null}{event.kind === 'follow_up' ? <><PremiumInput label="Zuständige Person / Stelle" value={event.assigneeLabel} onChangeText={assigneeLabel => setEvent(v => ({ ...v, assigneeLabel }))} editable={!busy && !disabled && !frozen.current}/><PremiumInput label="Frist mit Zeitzone" value={event.dueAt} onChangeText={dueAt => setEvent(v => ({ ...v, dueAt }))} editable={!busy && !disabled && !frozen.current}/></> : null}{event.kind === 'closure' ? <><PremiumInput label="Ausgang (transferred / stabilized / other)" value={event.outcome} onChangeText={outcome => setEvent(v => ({ ...v, outcome }))} editable={!busy && !disabled && !frozen.current}/><PremiumInput label="Falls keine Übergabe möglich war: konkreter Grund" value={event.noHandoverReason} onChangeText={noHandoverReason => setEvent(v => ({ ...v, noHandoverReason }))} multiline editable={!busy && !disabled && !frozen.current}/></> : null}<PremiumButton title={frozen.current ? 'Unverändertes Ereignis erneut senden' : 'Tatsächliches Ereignis speichern'} onPress={() => void submitEvent()} disabled={busy || disabled}/></> : <Text style={{ color: c.muted }}>Notfallverlauf abgeschlossen. Originalereignisse bleiben unverändert.</Text>}</> : null}</SectionPanel>;
}
