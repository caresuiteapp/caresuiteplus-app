// Generated native presentation from src/components/pflege/VitalCarePathWorkspacePanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone,nativeCrypto as crypto} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { SourcePicker } from "../../screens/pflege/TreatmentSourcePicker.native.tsx";
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { ErrorState, FilterChipGroup, InfoBanner, LoadingState, PremiumButton, PremiumInput, SectionPanel, SuccessState } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useTreatmentCorrectionStyles } from "../../screens/pflege/TreatmentCorrectionScreen.native.tsx";
import { blankVitalCareEntry, makeVitalCarePacket, vitalCareEntryIssue, type VitalCareEntry, type VitalCareKind, type VitalCareOriginal, type VitalCareRef, type VitalCareSources } from "../../lib/pflege/vitalCarePathPacket.native.ts";
import { readVitalCarePage, readVitalCareSources } from "../../lib/pflege/vitalCarePathRepository.supabase.native.ts";
import { saveVitalCareDurably, recoverVitalCare } from "../../lib/pflege/vitalCarePathWorkflow.native.ts";
import { clearVitalCareDraft, readVitalCareDraft, saveVitalCareDraft } from "../../lib/pflege/vitalCarePathDraft.native.ts";
import { VitalCareReviewPanel } from "./VitalCareReviewPanel.native.tsx";
type Props = {
    tenantId: string;
    clientId: string;
    measurementId: string;
    actorId: string;
    canRead: boolean;
    canWrite: boolean;
    canReview: boolean;
};
const kinds: {
    key: VitalCareKind;
    label: string;
}[] = [{ key: 'measurement_review', label: 'Messung fachlich einordnen' }, { key: 'anomaly_response', label: 'Auffälligkeit bearbeiten' }, { key: 'control_review', label: 'Kontrolle dokumentieren' }, { key: 'case_resolution', label: 'Vorgang abschließen' }, { key: 'correction', label: 'Append-only berichtigen' }];
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const value = (r: VitalCareRef, key: string) => typeof r.payload[key] === 'string' ? String(r.payload[key]) : '';
const nullable = (v: string) => v.trim() || null;
export function VitalCarePathWorkspacePanel(props: Props) { const key = [props.tenantId, props.clientId, props.measurementId, props.actorId, props.canRead, props.canWrite, props.canReview].join(':'); return <VitalCarePathWorkspace key={key} {...props}/>; }
function VitalCarePathWorkspace({ tenantId, clientId, measurementId, actorId, canRead, canWrite, canReview }: Props) {
    const styles = useTreatmentCorrectionStyles(), alive = useRef(true), generation = useRef(0), [kind, setKind] = useState<VitalCareKind | null>(null), [selectedOriginal, setSelectedOriginal] = useState(''), [entry, setEntry] = useState<VitalCareEntry | null>(null), [reason, setReason] = useState(''), [draftAvailable, setDraftAvailable] = useState(() => !!readVitalCareDraft({ tenantId, clientId, measurementId, actorId })), [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false), [error, setError] = useState<string | null>(null), [success, setSuccess] = useState<string | null>(null);
    const current = () => alive.current && canRead;
    const q = useAsyncQuery(async () => { const token = ++generation.current, isCurrent = () => current() && generation.current === token; const [sources, history] = await Promise.all([readVitalCareSources({ tenantId, clientId, measurementId, actorId, isCurrent }), readVitalCarePage({ tenantId, clientId, measurementId, actorId, isCurrent })]); if (!isCurrent())
        throw Error('Messung oder Rechtekontext hat gewechselt.'); if (!sources.ok)
        throw Error(sources.error); if (!history.ok)
        throw Error(history.error); return { ok: true as const, data: { sources: sources.data, history: history.data } }; }, [tenantId, clientId, measurementId, actorId, canRead], { enabled: canRead, queryKey: `${tenantId}:${clientId}:${measurementId}:${actorId}:vital-care-path` });
    useEffect(() => { alive.current = true; return () => { alive.current = false; generation.current++; }; }, []);
    const history = q.data?.history ?? [], sources = q.data?.sources, original = history.find(x => x.headId === selectedOriginal) ?? null, issue = entry ? vitalCareEntryIssue(entry) : null, reviewCandidate = history.find(x => ['case_resolution', 'correction'].includes(x.kind) && x.payload.control.state === 'resolved' && ['performed', 'not_required'].includes(x.payload.response.state) && x.payload.interpretation.state !== 'unrated' && ['confirmed', 'limited', 'not_applicable'].includes(x.payload.device.suitability) && (x.payload.device.deviceId === null || x.payload.device.calibrationId !== null)) ?? null;
    const set = <K extends keyof VitalCareEntry>(field: K, next: VitalCareEntry[K]) => { if (!busy && !uncertain)
        setEntry(old => old ? ({ ...old, [field]: next }) : old); };
    const begin = (next: VitalCareKind) => { if (!sources || busy || uncertain)
        return; setKind(next); setSelectedOriginal(''); setEntry(seed(next, tenantId, clientId, measurementId, sources)); setReason(''); setError(null); setSuccess(null); };
    const chooseOriginal = (head: string) => { const found = history.find(x => x.headId === head); if (!found || busy || uncertain)
        return; setSelectedOriginal(head); setKind(found.kind); setEntry(structuredClone(found.payload)); setReason(''); setError(null); };
    const continueOriginal = (next: VitalCareKind) => { if (!original || !sources || busy || uncertain)
        return; setKind(next); setEntry(seed(next, tenantId, clientId, measurementId, sources)); setReason('Nächste tatsächlich getrennte Phase des bestehenden Messungs- und Reaktionsverlaufs.'); setError(null); setSuccess(null); };
    const save = async () => { if (!entry || !sources || !kind || busy)
        return; const problem = vitalCareEntryIssue(entry); if (problem) {
        setError(problem);
        return;
    } setBusy(true); setError(null); setSuccess(null); try {
        const requestId = crypto.randomUUID();
        let final = structuredClone(entry);
        if (final.kind === 'correction')
            final = { ...final, correction: { ...final.correction, replacementId: requestId, approvedBy: actorId, approvedAt: new Date().toISOString() } };
        const packet = makeVitalCarePacket({ schemaVersion: '1', action: original ? 'revise' : 'create', requestId, tenantId, clientId, measurementId, actorId, expectedHeadId: original?.headId ?? null, expectedRevision: original?.revision ?? 0, entry: final, reason: original ? reason : '', original: original ?? null, sources });
        const result = await saveVitalCareDurably(packet, current);
        if (result.ok) {
            clearVitalCareDraft({ tenantId, clientId, measurementId, actorId });
            setDraftAvailable(false);
            setUncertain(false);
            setSelectedOriginal(result.data.headId);
            setEntry(structuredClone(result.data.payload));
            setReason('');
            setSuccess('Messung, Grenzbezug, Gerät, tatsächliche Reaktion und Kontrolle wurden gemeinsam mit nativer Quittung gespeichert.');
            await q.refresh();
        }
        else {
            setError(result.error);
            setUncertain(result.uncertain === true);
        }
    }
    catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Vitalpfad konnte nicht gespeichert werden.');
    }
    finally {
        if (alive.current)
            setBusy(false);
    } };
    const keepDraft = () => { if (!entry)
        return; try {
        saveVitalCareDraft({ tenantId, clientId, measurementId, actorId }, entry, original?.headId ?? null, reason);
        setDraftAvailable(true);
        setSuccess('Der unvollständige Entwurf wurde nur für dieses Profil und diese Messung lokal gesichert.');
        setError(null);
    }
    catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Entwurf konnte nicht lokal gesichert werden.');
    } };
    const resumeDraft = () => { const draft = readVitalCareDraft({ tenantId, clientId, measurementId, actorId }); if (!draft) {
        setDraftAvailable(false);
        setError('Kein passender lokaler Entwurf gefunden.');
        return;
    } if (draft.originalHeadId && !history.some(x => x.headId === draft.originalHeadId)) {
        setError('Historischer Vitalpfadkopf des Entwurfs ist nicht mehr aktuell vollständig lesbar.');
        return;
    } setEntry(structuredClone(draft.entry)); setKind(draft.entry.kind); setSelectedOriginal(draft.originalHeadId ?? ''); setReason(draft.reason); setSuccess(`Entwurf vom ${draft.updatedAt} wiederaufgenommen; aktuelle Originale werden beim Speichern erneut geprüft.`); setError(null); };
    const recover = async () => { setBusy(true); setError(null); const result = await recoverVitalCare({ tenantId, clientId, measurementId, actorId }, current); if (alive.current) {
        setBusy(false);
        if (result?.ok) {
            setUncertain(false);
            setSelectedOriginal(result.data.headId);
            setEntry(structuredClone(result.data.payload));
            setSuccess('Die ursprüngliche unveränderte Anfrage wurde anhand ihrer nativen Quittung bestätigt.');
            await q.refresh();
        }
        else
            setError(result?.error ?? 'Keine passende vollständige Quittung gefunden.');
    } };
    if (!canRead)
        return <SectionPanel title="Vitalwerte-Gesamtweg"><InfoBanner variant="warning" message="Aktueller vollständiger Vitalwert-Lesebezug fehlt. Entwurf und unklare Originalanfrage bleiben an das bisherige Profil gebunden."/></SectionPanel>;
    return <SectionPanel title="Vitalwerte-, Geräte-, Reaktions- und Korrekturweg K-01 bis K-12"><InfoBanner variant="info" title="Messwert, Grenzvergleich, Alarm, Reaktion und Diagnose bleiben getrennt" message="Ein Messwert oder technischer Grenzvergleich ist keine Diagnose. Ein Alarm oder Plan ist keine tatsächliche Maßnahme. Gerät, Kalibrierung, Messsituation, Lücken, Korrektur und Kontrolle bleiben als Originale sichtbar."/>
  {q.loading && !q.data ? <LoadingState message="Messung, Grenzen, Geräte, Kalibrierungen, Reaktionen, Korrekturen und Personen werden vollständig geladen…"/> : !q.data ? <ErrorState message={q.error ?? 'Verbundener Vitalpfad nicht verfügbar.'} onRetry={q.refresh}/> : <>
   <SectionPanel title="Vorgang beginnen oder append-only fortschreiben"><FilterChipGroup wrap options={kinds} value={selectedOriginal ? undefined : kind ?? undefined} onChange={begin}/>{history.length ? <SourcePicker label="Bestehender vollständiger Vitalpfad" rows={history.map(x => ({ id: x.headId, label: `${kinds.find(k => k.key === x.kind)?.label ?? x.kind} · Revision ${x.revision} · ${x.payload.control.state}` }))} value={selectedOriginal} disabled={busy || uncertain} onChange={chooseOriginal}/> : null}{original ? <><Text style={styles.body}>Bestehenden Verlauf in der aktuellen Phase berichtigen oder als nächste getrennte Phase fortschreiben:</Text><FilterChipGroup wrap options={kinds} value={kind ?? undefined} onChange={continueOriginal}/></> : null}</SectionPanel>
   {entry ? <VitalCareForm entry={entry} sources={q.data.sources} actorId={actorId} busy={busy || uncertain} set={set} reason={reason} setReason={setReason} original={original}/> : null}
   {issue ? <InfoBanner variant="danger" title="Noch nicht speicherbar" message={issue}/> : null}{entry && !canWrite ? <InfoBanner variant="warning" message="Das aktuelle Vitalwerte-Verwaltungsrecht fehlt; vorhandene Originale bleiben nur lesbar."/> : null}{q.refreshError ? <ErrorState message={q.refreshError} onRetry={q.refresh}/> : null}{error ? <ErrorState message={error}/> : null}{success ? <SuccessState message={success}/> : null}
   {uncertain ? <><InfoBanner variant="warning" title="Speicherausgang ungeklärt" message="Die ursprüngliche Anfrage bleibt gesperrt; es wird keine Ersatzreaktion, Ersatzkorrektur oder zweiter Abschluss erzeugt."/><PremiumButton title="Genau diese native Quittung erneut prüfen" loading={busy} onPress={recover}/></> : <View style={styles.actions}><PremiumButton title={original ? 'Vitalpfad append-only fortschreiben' : 'Vitalpfad vollständig speichern'} disabled={busy || !entry || !!issue || !canWrite} loading={busy} onPress={save}/>{entry ? <PremiumButton title="Unvollständigen Entwurf lokal sichern" variant="secondary" disabled={busy} onPress={keepDraft}/> : null}{draftAvailable ? <PremiumButton title="Gesicherten Entwurf wiederaufnehmen" variant="secondary" disabled={busy} onPress={resumeDraft}/> : null}<PremiumButton title="Alle Vitalpfadquellen und Rechte neu laden" variant="secondary" disabled={busy} onPress={q.refresh}/></View>}
   {reviewCandidate && sources ? <VitalCareReviewPanel tenantId={tenantId} clientId={clientId} measurementId={measurementId} actorId={actorId} canView={canRead} canRequest={canWrite} canReview={canReview} careOriginal={reviewCandidate} sources={sources}/> : <InfoBanner variant="info" message="Eine getrennte Fachprüfung wird erst für einen ausdrücklich abgeschlossenen Vitalpfad mit Bewertung, tatsächlicher Reaktion oder begründeter Nicht-Erforderlichkeit, Kontrolle und vollständigem Gerätebezug angeboten."/>}
  </>}<InfoBanner variant="warning" message="Lokale Prüfungen bestätigen weder Diagnose noch tatsächliche Behandlung, Geräte-/Kalibrierungseignung, Grenzwertfreigabe, Aufgabenabschluss oder pflegefachliche, Datenschutz-, Design- und Rechtsfreigabe."/></SectionPanel>;
}
function VitalCareForm({ entry, sources, actorId, busy, set, reason, setReason, original }: {
    entry: VitalCareEntry;
    sources: VitalCareSources;
    actorId: string;
    busy: boolean;
    set: <K extends keyof VitalCareEntry>(key: K, value: VitalCareEntry[K]) => void;
    reason: string;
    setReason(v: string): void;
    original: VitalCareOriginal | null;
}) {
    const styles = useTreatmentCorrectionStyles(), i = entry.interpretation, d = entry.device, r = entry.response, c = entry.control;
    return <>
 <SectionPanel title="Originalmessung, Situation und patientenspezifische Grenze"><PremiumInput label="Vorgangstitel" value={entry.title} onChangeText={v => set('title', v)}/><PremiumInput label="Tatsächlicher Beobachtungszeitpunkt" value={entry.observedAt} onChangeText={v => set('observedAt', v)}/><Text style={styles.body}>Messart: {i.measurementType} · Einheit: {i.unit} · Werte: {JSON.stringify(i.values)}</Text><Text style={styles.body}>Messsituation: {JSON.stringify(i.context)}</Text><FilterChipGroup wrap options={[{ key: 'unrated', label: 'Nicht fachlich eingeordnet' }, { key: 'within_configured_range', label: 'Innerhalb gespeicherter Grenze – keine Diagnose' }, { key: 'outside_configured_range', label: 'Außerhalb gespeicherter Grenze' }, { key: 'measurement_uncertain', label: 'Messqualität unklar' }]} value={i.state} onChange={v => set('interpretation', { ...i, state: v as typeof i.state })}/><PremiumInput label="Fachliche Einordnung und Grenzen" value={i.summary} onChangeText={v => set('interpretation', { ...i, summary: v })} multiline/><SourcePicker label="Patientenspezifische Grenzquelle" rows={sources.settings.map(x => ({ id: x.id, label: `${value(x, 'source_kind') || 'Grenzquelle'} · ${value(x, 'valid_from') || x.recordedAt}` }))} value={i.configuredLimitId ?? ''} disabled={busy} onChange={id => set('interpretation', { ...i, configuredLimitId: nullable(id) })}/></SectionPanel>
 <SectionPanel title="Messgerät, Verfahren, Wartung und Kalibrierung"><SourcePicker label="Messgerät" rows={sources.devices.map(x => ({ id: x.id, label: `${value(x, 'name') || 'Gerät'} · ${value(x, 'serial_number') || x.id}` }))} value={d.deviceId ?? ''} disabled={busy} onChange={id => set('device', { ...d, deviceId: nullable(id), calibrationId: null })}/><SourcePicker label="Kalibrierungs-/Wartungsoriginal" rows={sources.calibrations.filter(x => !d.deviceId || x.payload.device_id === d.deviceId).map(x => ({ id: x.id, label: `${value(x, 'status') || 'Status offen'} · ${x.recordedAt}` }))} value={d.calibrationId ?? ''} disabled={busy} onChange={id => set('device', { ...d, calibrationId: nullable(id) })}/><FilterChipGroup wrap options={[{ key: 'confirmed', label: 'Eignung im Original bestätigt' }, { key: 'limited', label: 'Eingeschränkt geeignet' }, { key: 'unknown', label: 'Eignung unbekannt' }, { key: 'not_applicable', label: 'Kein Gerät erforderlich' }]} value={d.suitability} onChange={v => set('device', { ...d, suitability: v as typeof d.suitability })}/><PremiumInput label="Tatsächliches Messverfahren" value={d.method} onChangeText={v => set('device', { ...d, method: v })}/><PremiumInput label="Bekannte Einschränkung / fehlender Nachweis" value={d.limitation} onChangeText={v => set('device', { ...d, limitation: v })} multiline/></SectionPanel>
 <SectionPanel title="Tatsächliche Reaktion und Verantwortung"><FilterChipGroup wrap options={[{ key: 'not_required', label: 'Ausdrücklich nicht erforderlich' }, { key: 'pending', label: 'Noch keine Reaktion' }, { key: 'performed', label: 'Tatsächlich durchgeführt' }, { key: 'declined', label: 'Abgelehnt' }, { key: 'failed', label: 'Nicht gelungen' }]} value={r.state} onChange={v => set('response', { ...r, state: v as typeof r.state })}/><PremiumInput label="Tatsächlicher Reaktionszeitpunkt" value={r.occurredAt ?? ''} onChangeText={v => set('response', { ...r, occurredAt: nullable(v) })}/><PremiumInput label="Tatsächliche Handlung" value={r.action} onChangeText={v => set('response', { ...r, action: v })} multiline/><PremiumInput label="Grund / fachliche Entscheidung" value={r.reason} onChangeText={v => set('response', { ...r, reason: v })} multiline/><PremiumInput label="Erreichte oder verantwortliche Gegenstelle" value={r.contactName} onChangeText={v => set('response', { ...r, contactName: v })}/><SourcePicker label="Reaktionsverantwortung" rows={sources.people.filter(x => x.payload.active === true).map(x => ({ id: x.id, label: value(x, 'display_name') || x.id }))} value={r.responsibleBy ?? ''} disabled={busy} onChange={id => set('response', { ...r, responsibleBy: nullable(id) })}/></SectionPanel>
 <SectionPanel title="Kontrolle, Verlauf und Abschluss"><FilterChipGroup wrap options={[{ key: 'none', label: 'Keine Kontrolle begonnen' }, { key: 'scheduled', label: 'Kontrolle geplant' }, { key: 'performed', label: 'Kontrolle durchgeführt' }, { key: 'resolved', label: 'Ausdrücklich abgeschlossen' }]} value={c.state} onChange={v => set('control', { ...c, state: v as typeof c.state })}/><PremiumInput label="Geplanter Kontrollzeitpunkt" value={c.dueAt ?? ''} onChangeText={v => set('control', { ...c, dueAt: nullable(v) })}/><PremiumInput label="Tatsächlicher Kontrollzeitpunkt" value={c.performedAt ?? ''} onChangeText={v => set('control', { ...c, performedAt: nullable(v) })}/><PremiumInput label="Tatsächliches Kontrollergebnis" value={c.result} onChangeText={v => set('control', { ...c, result: v })} multiline/><SourcePicker label="Kontroll-/Abschlussverantwortung" rows={sources.people.filter(x => x.payload.active === true).map(x => ({ id: x.id, label: value(x, 'display_name') || x.id }))} value={c.responsibleBy ?? ''} disabled={busy} onChange={id => set('control', { ...c, responsibleBy: nullable(id) })}/>{entry.kind === 'correction' ? <><SourcePicker label="Historisches Vitalpfadoriginal" rows={sources.paths.map(x => ({ id: x.id, label: `${value(x, 'title') || 'Vitalpfad'} · ${x.recordedAt}` }))} value={entry.correction.targetId ?? ''} disabled={busy} onChange={id => set('correction', { ...entry.correction, targetId: nullable(id) })}/><PremiumInput label="Begründeter append-only Nachtrag" value={entry.correction.reason} onChangeText={v => set('correction', { ...entry.correction, reason: v })} multiline/><PremiumInput label="Aktuelle Freigabeperson" value={actorId} editable={false}/></> : null}{original ? <PremiumInput label="Konkreter Grund der append-only Fortschreibung" value={reason} onChangeText={setReason} multiline/> : null}</SectionPanel>
 </>;
}
function seed(kind: VitalCareKind, tenantId: string, clientId: string, measurementId: string, sources: VitalCareSources): VitalCareEntry { const e = blankVitalCareEntry(kind, tenantId, clientId, measurementId), m = sources.measurements[0], values = object(m.payload.values) ? Object.fromEntries(Object.entries(m.payload.values).filter((x): x is [
    string,
    number
] => typeof x[1] === 'number' && Number.isFinite(x[1]))) : {}, context = object(m.payload.context) ? Object.fromEntries(Object.entries(m.payload.context).filter((x): x is [
    string,
    string
] => typeof x[1] === 'string')) : {}, flag = String(m.payload.flag_status ?? 'unrated'), state = (['within_configured_range', 'outside_configured_range'].includes(flag) ? flag : sources.invalidations.length ? 'measurement_uncertain' : 'unrated') as VitalCareEntry['interpretation']['state']; return { ...e, title: `Vitalpfad: ${kinds.find(x => x.key === kind)?.label ?? kind}`, observedAt: typeof m.payload.occurred_at === 'string' ? m.payload.occurred_at : e.observedAt, interpretation: { ...e.interpretation, state, summary: 'Messwert, Situation, Plausibilität und Grenzen ohne Diagnosewirkung fachlich einordnen.', measurementType: String(m.payload.vital_key ?? ''), values, unit: String(m.payload.unit ?? ''), context }, device: { ...e.device, limitation: 'Eignung, Wartung und Kalibrierung des verwendeten Messmittels prüfen.' }, response: { ...e.response, state: kind === 'anomaly_response' ? 'performed' : kind === 'case_resolution' ? 'not_required' : 'pending', reason: kind === 'case_resolution' ? 'Keine weitere tatsächliche Reaktion erforderlich; Begründung dokumentieren.' : '' }, control: { ...e.control, state: kind === 'control_review' ? 'performed' : kind === 'case_resolution' ? 'resolved' : 'none' } }; }
