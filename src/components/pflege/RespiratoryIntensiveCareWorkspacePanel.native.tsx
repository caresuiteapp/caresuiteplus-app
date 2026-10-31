// Generated native presentation from src/components/pflege/RespiratoryIntensiveCareWorkspacePanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone,nativeCrypto as crypto} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { SourcePicker } from "../../screens/pflege/TreatmentSourcePicker.native.tsx";
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { ErrorState, FilterChipGroup, InfoBanner, LoadingState, PremiumButton, PremiumInput, SectionPanel, SuccessState } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useTreatmentCorrectionStyles } from "../../screens/pflege/TreatmentCorrectionScreen.native.tsx";
import { blankRespiratoryCareEntry, makeRespiratoryCarePacket, respiratoryCareEntryIssue, type RespiratoryCareEntry, type RespiratoryCareKind, type RespiratoryCareOriginal, type RespiratoryCareRef, type RespiratoryCareSources } from "../../lib/pflege/respiratoryIntensiveCarePath.native.ts";
import { readRespiratoryCarePage, readRespiratoryCareSources } from "../../lib/pflege/respiratoryIntensiveCareRepository.supabase.native.ts";
import { recoverRespiratoryCare, saveRespiratoryCareDurably } from "../../lib/pflege/respiratoryIntensiveCareWorkflow.native.ts";
import { clearRespiratoryCareDraft, readRespiratoryCareDraft, saveRespiratoryCareDraft } from "../../lib/pflege/respiratoryIntensiveCareDraft.native.ts";
import { RespiratoryCareReviewPanel } from "./RespiratoryCareReviewPanel.native.tsx";
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
    key: RespiratoryCareKind;
    label: string;
}[] = [{ key: 'oxygen_support', label: 'Sauerstoffgabe' }, { key: 'tracheostomy_care', label: 'Tracheostomaversorgung' }, { key: 'suction', label: 'Absaugung' }, { key: 'ventilation_review', label: 'Beatmungsabgleich' }, { key: 'alarm_response', label: 'Gerätealarm' }, { key: 'emergency_equipment', label: 'Notfallausstattung' }, { key: 'qualification_review', label: 'Qualifikation prüfen' }, { key: 'intensive_handover', label: 'Intensivpflege übergeben' }, { key: 'correction', label: 'Append-only berichtigen' }];
const respiratoryTypes = new Set(['respiratory_rate', 'oxygen', 'oxygen_saturation', 'oxygen_flow', 'fio2', 'peep', 'tidal_volume', 'minute_ventilation', 'peak_pressure', 'plateau_pressure', 'ventilator_rate']);
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const value = (r: RespiratoryCareRef, key: string) => typeof r.payload[key] === 'string' ? String(r.payload[key]) : '';
const nullable = (v: string) => v.trim() || null;
const pairs = (v: string) => Object.fromEntries(v.split('\n').map(line => line.split('=', 2).map(x => x.trim())).filter((x): x is [
    string,
    string
] => x.length === 2 && !!x[0] && !!x[1]));
const lines = (v: Record<string, string>) => Object.entries(v).map(x => x.join(' = ')).join('\n');
export function RespiratoryIntensiveCareWorkspacePanel(props: Props) { const key = [props.tenantId, props.clientId, props.measurementId, props.actorId, props.canRead, props.canWrite].join(':'); return <RespiratoryIntensiveCareWorkspace key={key} {...props}/>; }
function RespiratoryIntensiveCareWorkspace({ tenantId, clientId, measurementId, actorId, canRead, canWrite, canReview }: Props) {
    const styles = useTreatmentCorrectionStyles(), alive = useRef(true), generation = useRef(0), [kind, setKind] = useState<RespiratoryCareKind | null>(null), [selectedOriginal, setSelectedOriginal] = useState(''), [entry, setEntry] = useState<RespiratoryCareEntry | null>(null), [reason, setReason] = useState(''), [draftAvailable, setDraftAvailable] = useState(() => !!readRespiratoryCareDraft({ tenantId, clientId, measurementId, actorId })), [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false), [error, setError] = useState<string | null>(null), [success, setSuccess] = useState<string | null>(null);
    const current = () => alive.current && canRead;
    const q = useAsyncQuery(async () => { const token = ++generation.current, isCurrent = () => current() && generation.current === token; const [sources, history] = await Promise.all([readRespiratoryCareSources({ tenantId, clientId, measurementId, actorId, isCurrent }), readRespiratoryCarePage({ tenantId, clientId, measurementId, actorId, isCurrent })]); if (!isCurrent())
        throw Error('Messung, Profil oder Rechtekontext hat gewechselt.'); if (!sources.ok)
        throw Error(sources.error); if (!history.ok)
        throw Error(history.error); return { ok: true as const, data: { sources: sources.data, history: history.data } }; }, [tenantId, clientId, measurementId, actorId, canRead], { enabled: canRead, queryKey: `${tenantId}:${clientId}:${measurementId}:${actorId}:respiratory-intensive-care` });
    useEffect(() => { alive.current = true; return () => { alive.current = false; generation.current++; }; }, []);
    const history = q.data?.history ?? [], sources = q.data?.sources, original = history.find(x => x.headId === selectedOriginal) ?? null, issue = entry ? respiratoryCareEntryIssue(entry) : null, measurementType = sources ? String(sources.measurements[0]?.payload.vital_key ?? '') : '';
    const set = <K extends keyof RespiratoryCareEntry>(field: K, next: RespiratoryCareEntry[K]) => { if (!busy && !uncertain)
        setEntry(old => old ? ({ ...old, [field]: next }) : old); };
    const begin = (next: RespiratoryCareKind) => { if (!sources || busy || uncertain)
        return; setKind(next); setSelectedOriginal(''); setEntry(seed(next, tenantId, clientId, measurementId, sources)); setReason(''); setError(null); setSuccess(null); };
    const chooseOriginal = (head: string) => { const found = history.find(x => x.headId === head); if (!found || busy || uncertain)
        return; setSelectedOriginal(head); setKind(found.kind); setEntry(structuredClone(found.payload)); setReason(''); setError(null); };
    const continueOriginal = (next: RespiratoryCareKind) => { if (!original || !sources || busy || uncertain)
        return; setKind(next); setEntry(seed(next, tenantId, clientId, measurementId, sources)); setReason('Nächste tatsächlich getrennte Phase des bestehenden Atem-/Intensivpflegeverlaufs.'); setError(null); setSuccess(null); };
    const save = async () => { if (!entry || !sources || !kind || busy)
        return; const problem = respiratoryCareEntryIssue(entry); if (problem) {
        setError(problem);
        return;
    } setBusy(true); setError(null); setSuccess(null); try {
        const requestId = crypto.randomUUID();
        let final = structuredClone(entry);
        if (final.kind === 'correction')
            final = { ...final, correction: { ...final.correction, replacementId: requestId, approvedBy: actorId, approvedAt: new Date().toISOString() } };
        const packet = makeRespiratoryCarePacket({ schemaVersion: '1', action: original ? 'revise' : 'create', requestId, tenantId, clientId, measurementId, actorId, expectedHeadId: original?.headId ?? null, expectedRevision: original?.revision ?? 0, entry: final, reason: original ? reason : '', original: original ?? null, sources });
        const result = await saveRespiratoryCareDurably(packet, current);
        if (result.ok) {
            clearRespiratoryCareDraft({ tenantId, clientId, measurementId, actorId });
            setDraftAvailable(false);
            setUncertain(false);
            setSelectedOriginal(result.data.headId);
            setEntry(structuredClone(result.data.payload));
            setReason('');
            setSuccess('Atem-/Intensivpflegephase und alle gebundenen Originale wurden gemeinsam mit nativer Quittung gespeichert.');
            await q.refresh();
        }
        else {
            setError(result.error);
            setUncertain(result.uncertain === true);
        }
    }
    catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Atem-/Intensivpflegepfad konnte nicht gespeichert werden.');
    }
    finally {
        if (alive.current)
            setBusy(false);
    } };
    const keepDraft = () => { if (!entry)
        return; try {
        saveRespiratoryCareDraft({ tenantId, clientId, measurementId, actorId }, entry, original?.headId ?? null, reason);
        setDraftAvailable(true);
        setSuccess('Der unvollständige Entwurf wurde nur für dieses Profil, diesen Pflegefall und diese Messung lokal gesichert.');
        setError(null);
    }
    catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Entwurf konnte nicht lokal gesichert werden.');
    } };
    const resumeDraft = () => { const draft = readRespiratoryCareDraft({ tenantId, clientId, measurementId, actorId }); if (!draft) {
        setDraftAvailable(false);
        setError('Kein passender lokaler Entwurf gefunden.');
        return;
    } if (draft.originalHeadId && !history.some(x => x.headId === draft.originalHeadId)) {
        setError('Historischer Atempflegekopf des Entwurfs ist nicht mehr aktuell vollständig lesbar.');
        return;
    } setEntry(structuredClone(draft.entry)); setKind(draft.entry.kind); setSelectedOriginal(draft.originalHeadId ?? ''); setReason(draft.reason); setSuccess(`Entwurf vom ${draft.updatedAt} wiederaufgenommen; alle Originale werden beim Speichern erneut geprüft.`); setError(null); };
    const recover = async () => { setBusy(true); setError(null); const result = await recoverRespiratoryCare({ tenantId, clientId, measurementId, actorId }, current); if (alive.current) {
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
        return <SectionPanel title="Atem-/Intensivpflege-Gesamtweg"><InfoBanner variant="warning" message="Aktueller vollständiger Lesebezug fehlt. Entwurf und unklare Originalanfrage bleiben an das bisherige Profil gebunden."/></SectionPanel>;
    return <SectionPanel title="Atem-/Intensivpflege-Gesamtweg L-01 bis L-08"><InfoBanner variant="info" title="Verordnung, Ist-Wert, Handlung und Freigabe bleiben getrennt" message="Ein Atemwert ersetzt keine Diagnose. Verordnete Werte werden nicht als Ist-Werte ausgegeben. Alarmquittierung ist kein Abschluss; allgemeine Pflegefunktionen sind keine spezialisierte Intensivpflegefreigabe."/>
  {q.loading && !q.data ? <LoadingState message="Messung, Verordnungen, Geräte, Ausführungen, Qualifikationen, Übergaben und Personen werden vollständig geladen…"/> : !q.data ? <ErrorState message={q.error ?? 'Verbundener Atem-/Intensivpflegepfad nicht verfügbar.'} onRetry={q.refresh}/> : !respiratoryTypes.has(measurementType) ? <InfoBanner variant="warning" message={`Die ausgewählte Messart ${measurementType || 'ist nicht bestätigt'} ist keine unterstützte Atem-/Beatmungsquelle; es wird kein Pflegeweg begonnen.`}/> : <>
   <SectionPanel title="Phase beginnen oder append-only fortschreiben"><FilterChipGroup wrap options={kinds} value={selectedOriginal ? undefined : kind ?? undefined} onChange={begin}/>{history.length ? <SourcePicker label="Bestehender vollständiger Atem-/Intensivpflegepfad" rows={history.map(x => ({ id: x.headId, label: `${kinds.find(k => k.key === x.kind)?.label ?? x.kind} · Revision ${x.revision}` }))} value={selectedOriginal} disabled={busy || uncertain} onChange={chooseOriginal}/> : null}{original ? <><Text style={styles.body}>Bestehenden Verlauf aktuell berichtigen oder als nächste getrennte Phase fortschreiben:</Text><FilterChipGroup wrap options={kinds} value={kind ?? undefined} onChange={continueOriginal}/></> : null}</SectionPanel>
   {entry ? <RespiratoryCareForm entry={entry} sources={q.data.sources} actorId={actorId} busy={busy || uncertain} set={set} reason={reason} setReason={setReason} original={original}/> : null}
   {original && ['intensive_handover', 'correction'].includes(original.kind) ? <RespiratoryCareReviewPanel tenantId={tenantId} clientId={clientId} measurementId={measurementId} actorId={actorId} canView={canRead} canRequest={canWrite} canReview={canReview} careOriginal={original} sources={q.data.sources}/> : null}
   {issue ? <InfoBanner variant="danger" title="Noch nicht speicherbar" message={issue}/> : null}{entry && !canWrite ? <InfoBanner variant="warning" message="Das aktuelle Atem-/Intensivpflege-Verwaltungsrecht fehlt; vorhandene Originale bleiben nur lesbar."/> : null}{q.refreshError ? <ErrorState message={q.refreshError} onRetry={q.refresh}/> : null}{error ? <ErrorState message={error}/> : null}{success ? <SuccessState message={success}/> : null}
   {uncertain ? <><InfoBanner variant="warning" title="Speicherausgang ungeklärt" message="Die ursprüngliche Anfrage bleibt gesperrt; es wird keine Ersatzhandlung, Ersatzfreigabe oder zweite Übergabe erzeugt."/><PremiumButton title="Genau diese native Quittung erneut prüfen" loading={busy} onPress={recover}/></> : <View style={styles.actions}><PremiumButton title={original ? 'Atempflegepfad append-only fortschreiben' : 'Phase vollständig speichern'} disabled={busy || !entry || !!issue || !canWrite} loading={busy} onPress={save}/>{entry ? <PremiumButton title="Unvollständigen Entwurf lokal sichern" variant="secondary" disabled={busy} onPress={keepDraft}/> : null}{draftAvailable ? <PremiumButton title="Gesicherten Entwurf wiederaufnehmen" variant="secondary" disabled={busy} onPress={resumeDraft}/> : null}<PremiumButton title="Alle Originale und Rechte neu laden" variant="secondary" disabled={busy} onPress={q.refresh}/></View>}
  </>}<InfoBanner variant="warning" message="Lokale Prüfungen bestätigen weder Diagnose noch Therapie, Geräte-/Notfalltauglichkeit, Qualifikation, Schichtfreigabe, pflegefachliche, Datenschutz-, Design- oder Rechtsabnahme."/></SectionPanel>;
}
function RespiratoryCareForm({ entry, sources, actorId, busy, set, reason, setReason, original }: {
    entry: RespiratoryCareEntry;
    sources: RespiratoryCareSources;
    actorId: string;
    busy: boolean;
    set: <K extends keyof RespiratoryCareEntry>(key: K, value: RespiratoryCareEntry[K]) => void;
    reason: string;
    setReason(v: string): void;
    original: RespiratoryCareOriginal | null;
}) {
    const styles = useTreatmentCorrectionStyles(), people = sources.people.filter(x => x.payload.active === true).map(x => ({ id: x.id, label: value(x, 'display_name') || x.id })), s = entry.source;
    return <>
 <SectionPanel title="Gemeinsame Atemmessung, Verordnung und Gerät"><PremiumInput label="Vorgangstitel" value={entry.title} onChangeText={v => set('title', v)}/><Text style={styles.body}>Messung: {s.measurementType} · {JSON.stringify(s.values)} {s.unit}</Text><Text style={styles.body}>Situation: {JSON.stringify(s.context)}</Text><SourcePicker label="Medizinische Verordnung" rows={sources.medicalOrders.map(x => ({ id: x.id, label: `${value(x, 'title') || value(x, 'order_type') || 'Verordnung'} · ${x.recordedAt}` }))} value={s.medicalOrderId ?? ''} disabled={busy} onChange={id => set('source', { ...s, medicalOrderId: nullable(id) })}/><SourcePicker label="Gerät" rows={sources.devices.map(x => ({ id: x.id, label: value(x, 'name') || x.id }))} value={s.deviceId ?? ''} disabled={busy} onChange={id => set('source', { ...s, deviceId: nullable(id), calibrationId: null })}/><SourcePicker label="Kalibrierungs-/Wartungsoriginal" rows={sources.calibrations.filter(x => !s.deviceId || x.payload.device_id === s.deviceId).map(x => ({ id: x.id, label: `${value(x, 'status') || 'Status offen'} · ${x.recordedAt}` }))} value={s.calibrationId ?? ''} disabled={busy} onChange={id => set('source', { ...s, calibrationId: nullable(id) })}/></SectionPanel>
 {entry.kind === 'oxygen_support' ? <Oxygen busy={busy} entry={entry} people={people} set={set}/> : entry.kind === 'tracheostomy_care' ? <Tracheostomy busy={busy} entry={entry} people={people} set={set}/> : entry.kind === 'suction' ? <Suction busy={busy} entry={entry} people={people} set={set}/> : entry.kind === 'ventilation_review' ? <Ventilation busy={busy} entry={entry} people={people} set={set}/> : entry.kind === 'alarm_response' ? <Alarm busy={busy} entry={entry} people={people} set={set}/> : entry.kind === 'emergency_equipment' ? <Equipment busy={busy} entry={entry} people={people} set={set}/> : entry.kind === 'qualification_review' ? <Qualification busy={busy} entry={entry} sources={sources} people={people} set={set}/> : entry.kind === 'intensive_handover' ? <Handover busy={busy} entry={entry} people={people} set={set}/> : <SectionPanel title="Append-only Korrektur"><SourcePicker label="Historisches Atem-/Intensivpflegeoriginal" rows={sources.paths.map(x => ({ id: x.id, label: `${value(x, 'title') || 'Atempflegepfad'} · ${x.recordedAt}` }))} value={entry.correction.targetId ?? ''} disabled={busy} onChange={id => set('correction', { ...entry.correction, targetId: nullable(id) })}/><PremiumInput label="Begründeter append-only Nachtrag" value={entry.correction.reason} onChangeText={v => set('correction', { ...entry.correction, reason: v })} multiline/><PremiumInput label="Aktuelle Freigabeperson" value={actorId} editable={false}/></SectionPanel>}
 {original ? <PremiumInput label="Konkreter Grund der append-only Fortschreibung" value={reason} onChangeText={setReason} multiline/> : null}</>;
}
type Setter = <K extends keyof RespiratoryCareEntry>(key: K, value: RespiratoryCareEntry[K]) => void;
type Person = {
    id: string;
    label: string;
};
function Oxygen({ busy, entry, people, set }: {
    busy: boolean;
    entry: RespiratoryCareEntry;
    people: Person[];
    set: Setter;
}) { const x = entry.oxygen; return <SectionPanel title="Sauerstoff: Verordnung und tatsächliche Gabe"><PremiumInput label="Verordneter Fluss / Ziel" value={x.prescribedFlow} onChangeText={v => set('oxygen', { ...x, prescribedFlow: v })}/><PremiumInput label="Tatsächlicher Fluss" value={x.actualFlow} onChangeText={v => set('oxygen', { ...x, actualFlow: v })}/><PremiumInput label="Applikationsform" value={x.application} onChangeText={v => set('oxygen', { ...x, application: v })}/><PremiumInput label="Tatsächlich verwendetes Gerät" value={x.device} onChangeText={v => set('oxygen', { ...x, device: v })}/><PremiumInput label="Tatsächlicher Zeitpunkt" value={x.occurredAt ?? ''} onChangeText={v => set('oxygen', { ...x, occurredAt: nullable(v) })}/><SourcePicker disabled={busy} label="Ausführende Person" rows={people} value={x.performedBy ?? ''} onChange={id => set('oxygen', { ...x, performedBy: nullable(id) })}/></SectionPanel>; }
function Tracheostomy({ busy, entry, people, set }: {
    busy: boolean;
    entry: RespiratoryCareEntry;
    people: Person[];
    set: Setter;
}) { const x = entry.tracheostomy; return <SectionPanel title="Tracheostoma: Versorgung, Wechselgrundlage und Beobachtung"><PremiumInput label="Kanülentyp" value={x.cannulaType} onChangeText={v => set('tracheostomy', { ...x, cannulaType: v })}/><PremiumInput label="Tatsächliche Versorgung" value={x.care} onChangeText={v => set('tracheostomy', { ...x, care: v })} multiline/><PremiumInput label="Wechselgrundlage / Verordnung" value={x.changeBasis} onChangeText={v => set('tracheostomy', { ...x, changeBasis: v })}/><PremiumInput label="Hautbeobachtung" value={x.skin} onChangeText={v => set('tracheostomy', { ...x, skin: v })}/><PremiumInput label="Sekretbeobachtung" value={x.secretion} onChangeText={v => set('tracheostomy', { ...x, secretion: v })}/><PremiumInput label="Tatsächlicher Zeitpunkt" value={x.occurredAt ?? ''} onChangeText={v => set('tracheostomy', { ...x, occurredAt: nullable(v) })}/><SourcePicker disabled={busy} label="Ausführende Person" rows={people} value={x.performedBy ?? ''} onChange={id => set('tracheostomy', { ...x, performedBy: nullable(id) })}/></SectionPanel>; }
function Suction({ busy, entry, people, set }: {
    busy: boolean;
    entry: RespiratoryCareEntry;
    people: Person[];
    set: Setter;
}) { const x = entry.suction; return <SectionPanel title="Absaugung: Anlass, Durchführung, Verträglichkeit und Folge"><PremiumInput label="Tatsächlicher Grund" value={x.reason} onChangeText={v => set('suction', { ...x, reason: v })}/><PremiumInput label="Absaugweg" value={x.route} onChangeText={v => set('suction', { ...x, route: v })}/><PremiumInput label="Sekret" value={x.secretion} onChangeText={v => set('suction', { ...x, secretion: v })}/><PremiumInput label="Tatsächliche Durchführung" value={x.execution} onChangeText={v => set('suction', { ...x, execution: v })} multiline/><PremiumInput label="Tatsächliche Verträglichkeit" value={x.tolerance} onChangeText={v => set('suction', { ...x, tolerance: v })}/><PremiumInput label="Erforderliche Nachbeobachtung" value={x.followUp} onChangeText={v => set('suction', { ...x, followUp: v })}/><PremiumInput label="Tatsächlicher Zeitpunkt" value={x.occurredAt ?? ''} onChangeText={v => set('suction', { ...x, occurredAt: nullable(v) })}/><SourcePicker disabled={busy} label="Ausführende Person" rows={people} value={x.performedBy ?? ''} onChange={id => set('suction', { ...x, performedBy: nullable(id) })}/></SectionPanel>; }
function Ventilation({ busy, entry, people, set }: {
    busy: boolean;
    entry: RespiratoryCareEntry;
    people: Person[];
    set: Setter;
}) { const x = entry.ventilation; return <SectionPanel title="Beatmung: verordnete und tatsächliche Werte getrennt"><PremiumInput label="Modus" value={x.mode} onChangeText={v => set('ventilation', { ...x, mode: v })}/><PremiumInput label="Verordnete Einstellungen (je Zeile Schlüssel = Wert)" value={lines(x.prescribedSettings)} onChangeText={v => set('ventilation', { ...x, prescribedSettings: pairs(v) })} multiline/><PremiumInput label="Tatsächlich beobachtete Einstellungen (je Zeile Schlüssel = Wert)" value={lines(x.actualSettings)} onChangeText={v => set('ventilation', { ...x, actualSettings: pairs(v) })} multiline/><PremiumInput label="Abweichung / weiterer Klärbedarf" value={x.deviation} onChangeText={v => set('ventilation', { ...x, deviation: v })} multiline/><PremiumInput label="Tatsächlicher Prüfzeitpunkt" value={x.occurredAt ?? ''} onChangeText={v => set('ventilation', { ...x, occurredAt: nullable(v) })}/><SourcePicker disabled={busy} label="Prüfende Person" rows={people} value={x.reviewedBy ?? ''} onChange={id => set('ventilation', { ...x, reviewedBy: nullable(id) })}/></SectionPanel>; }
function Alarm({ busy, entry, people, set }: {
    busy: boolean;
    entry: RespiratoryCareEntry;
    people: Person[];
    set: Setter;
}) { const x = entry.alarm; return <SectionPanel title="Gerätealarm: Reaktion, Ursache, Behebung und Kontrolle"><PremiumInput label="Alarm" value={x.label} onChangeText={v => set('alarm', { ...x, label: v })}/><PremiumInput label="Beginn" value={x.beganAt ?? ''} onChangeText={v => set('alarm', { ...x, beganAt: nullable(v) })}/><PremiumInput label="Quittiert um (kein Abschluss)" value={x.acknowledgedAt ?? ''} onChangeText={v => set('alarm', { ...x, acknowledgedAt: nullable(v) })}/><PremiumInput label="Tatsächliche Reaktion" value={x.reaction} onChangeText={v => set('alarm', { ...x, reaction: v })}/><PremiumInput label="Tatsächliche oder offene Ursache" value={x.cause} onChangeText={v => set('alarm', { ...x, cause: v })}/><PremiumInput label="Behoben um" value={x.resolvedAt ?? ''} onChangeText={v => set('alarm', { ...x, resolvedAt: nullable(v) })}/><PremiumInput label="Tatsächliche Abschlusskontrolle" value={x.control} onChangeText={v => set('alarm', { ...x, control: v })}/><SourcePicker disabled={busy} label="Verantwortliche Person" rows={people} value={x.responsibleBy ?? ''} onChange={id => set('alarm', { ...x, responsibleBy: nullable(id) })}/></SectionPanel>; }
function Equipment({ busy, entry, people, set }: {
    busy: boolean;
    entry: RespiratoryCareEntry;
    people: Person[];
    set: Setter;
}) { const x = entry.equipment; return <SectionPanel title="Notfallausstattung: Bestand, Lücke, Funktionsprüfung und Behebung"><PremiumInput label="Erforderlich" value={x.required} onChangeText={v => set('equipment', { ...x, required: v })}/><PremiumInput label="Vorhanden" value={x.present} onChangeText={v => set('equipment', { ...x, present: v })}/><PremiumInput label="Fehlend / offen" value={x.missing} onChangeText={v => set('equipment', { ...x, missing: v })}/><PremiumInput label="Tatsächliche Funktionsprüfung" value={x.functionCheckAt ?? ''} onChangeText={v => set('equipment', { ...x, functionCheckAt: nullable(v) })}/><PremiumInput label="Tatsächliches Prüfergebnis" value={x.functionResult} onChangeText={v => set('equipment', { ...x, functionResult: v })}/><PremiumInput label="Lücke tatsächlich behoben um" value={x.resolvedAt ?? ''} onChangeText={v => set('equipment', { ...x, resolvedAt: nullable(v) })}/><SourcePicker disabled={busy} label="Verantwortliche Person" rows={people} value={x.responsibleBy ?? ''} onChange={id => set('equipment', { ...x, responsibleBy: nullable(id) })}/></SectionPanel>; }
function Qualification({ busy, entry, sources, people, set }: {
    busy: boolean;
    entry: RespiratoryCareEntry;
    sources: RespiratoryCareSources;
    people: Person[];
    set: Setter;
}) { const x = entry.qualification; return <SectionPanel title="Intensivpflege-Qualifikation: Nachweis, Gültigkeit, Einweisung und Einsatzentscheidung"><PremiumInput label="Konkrete Anforderung" value={x.requirement} onChangeText={v => set('qualification', { ...x, requirement: v })}/><SourcePicker disabled={busy} label="Qualifikationsoriginal" rows={sources.qualifications.map(q => ({ id: q.id, label: `${value(q, 'title') || value(q, 'qualification_type') || 'Qualifikation'} · bis ${value(q, 'valid_until') || 'offen'}` }))} value={x.qualificationId ?? ''} onChange={id => { const q = sources.qualifications.find(v => v.id === id); set('qualification', { ...x, qualificationId: nullable(id), validUntil: q ? value(q, 'valid_until') || null : null }); }}/><PremiumInput label="Gelesener Nachweis" value={x.evidence} onChangeText={v => set('qualification', { ...x, evidence: v })}/><PremiumInput label="Einweisung" value={x.instruction} onChangeText={v => set('qualification', { ...x, instruction: v })}/><FilterChipGroup wrap options={[{ key: 'unknown', label: 'Noch nicht entschieden' }, { key: 'eligible', label: 'Für diesen Einsatz geeignet' }, { key: 'not_eligible', label: 'Einsatz gesperrt' }]} value={x.eligible} onChange={v => set('qualification', { ...x, eligible: v as typeof x.eligible })}/><SourcePicker disabled={busy} label="Prüfende Person" rows={people} value={x.reviewedBy ?? ''} onChange={id => set('qualification', { ...x, reviewedBy: nullable(id) })}/></SectionPanel>; }
function Handover({ busy, entry, people, set }: {
    busy: boolean;
    entry: RespiratoryCareEntry;
    people: Person[];
    set: Setter;
}) { const x = entry.handover; return <SectionPanel title="Spezialisierte Übergabe und eigene Freigabe"><PremiumInput label="Intensivpflegeprofil" value={x.careProfile} onChangeText={v => set('handover', { ...x, careProfile: v })} multiline/><PremiumInput label="Überwachung" value={x.monitoring} onChangeText={v => set('handover', { ...x, monitoring: v })} multiline/><PremiumInput label="Offene Punkte" value={x.pending} onChangeText={v => set('handover', { ...x, pending: v })} multiline/><PremiumInput label="Tatsächliche Empfänger:in" value={x.recipient} onChangeText={v => set('handover', { ...x, recipient: v })}/><PremiumInput label="Tatsächlicher Übergabezeitpunkt" value={x.handedOverAt ?? ''} onChangeText={v => set('handover', { ...x, handedOverAt: nullable(v) })}/><SourcePicker disabled={busy} label="Übergebende Person" rows={people} value={x.handedOverBy ?? ''} onChange={id => set('handover', { ...x, handedOverBy: nullable(id) })}/><FilterChipGroup wrap options={[{ key: 'not_requested', label: 'Nicht angefordert' }, { key: 'pending', label: 'Spezialfreigabe offen' }, { key: 'approved', label: 'Spezialfreigabe erteilt' }, { key: 'rejected', label: 'Spezialfreigabe abgelehnt' }]} value={x.specialistApproval} onChange={v => set('handover', { ...x, specialistApproval: v as typeof x.specialistApproval, approvedBy: v === 'approved' ? x.approvedBy : null, approvedAt: v === 'approved' ? x.approvedAt : null })}/>{x.specialistApproval === 'approved' ? <><SourcePicker disabled={busy} label="Spezialisierte Freigabeperson" rows={people} value={x.approvedBy ?? ''} onChange={id => set('handover', { ...x, approvedBy: nullable(id) })}/><PremiumInput label="Tatsächlicher Freigabezeitpunkt" value={x.approvedAt ?? ''} onChangeText={v => set('handover', { ...x, approvedAt: nullable(v) })}/></> : null}</SectionPanel>; }
function seed(kind: RespiratoryCareKind, tenantId: string, clientId: string, measurementId: string, sources: RespiratoryCareSources): RespiratoryCareEntry { const e = blankRespiratoryCareEntry(kind, tenantId, clientId, measurementId), m = sources.measurements[0], values = object(m.payload.values) ? Object.fromEntries(Object.entries(m.payload.values).filter((x): x is [
    string,
    number
] => typeof x[1] === 'number' && Number.isFinite(x[1]))) : {}, context = object(m.payload.context) ? Object.fromEntries(Object.entries(m.payload.context).filter((x): x is [
    string,
    string
] => typeof x[1] === 'string')) : {}; return { ...e, title: `Atem-/Intensivpflege: ${kinds.find(x => x.key === kind)?.label ?? kind}`, observedAt: typeof m.payload.occurred_at === 'string' ? m.payload.occurred_at : e.observedAt, source: { ...e.source, measurementType: String(m.payload.vital_key ?? ''), values, unit: String(m.payload.unit ?? ''), context } }; }
