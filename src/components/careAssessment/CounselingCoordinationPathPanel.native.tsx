// Generated native presentation from src/components/careAssessment/CounselingCoordinationPathPanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone,nativeCrypto as crypto} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { EmptyState, ErrorState, FilterChipGroup, InfoBanner, LoadingState, PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { blankCounselingCoordinationEntry, counselingCoordinationEntryIssue, makeCounselingCoordinationPacket, type CounselingCoordinationEntry, type CounselingCoordinationOriginal, type CounselingCoordinationSources } from "../../lib/careAssessment/counselingCoordinationPath.native.ts";
import { readCounselingCoordinationPage, readCounselingCoordinationSources } from "../../lib/careAssessment/counselingCoordinationRepository.supabase.native.ts";
import { recoverCounselingCoordination, saveCounselingCoordinationDurably } from "../../lib/careAssessment/counselingCoordinationWorkflow.native.ts";
import { clearCounselingCoordinationDraft, readCounselingCoordinationDraft, saveCounselingCoordinationDraft } from "../../lib/careAssessment/counselingCoordinationDraft.native.ts";
import { CounselingCoordinationReviewPanel } from "./CounselingCoordinationReviewPanel.native.tsx";
import { colors, spacing, typography } from '@/theme';
type Props = {
    tenantId: string;
    clientId: string;
    assessmentId: string;
    actorId: string;
    canRead: boolean;
    canWrite: boolean;
    canRelease: boolean;
    canReview: boolean;
};
type Step = 'consultation' | 'mandatoryVisit' | 'relativeInstruction' | 'aidSupply' | 'discharge' | 'benefitChange' | 'therapy' | 'doctorCommunication' | 'review';
const steps: {
    key: Step;
    label: string;
}[] = [{ key: 'consultation', label: 'O-01 Beratung' }, { key: 'mandatoryVisit', label: 'O-02 Pflichtbesuch' }, { key: 'relativeInstruction', label: 'O-03 Angehörige' }, { key: 'aidSupply', label: 'O-04 Hilfsmittel' }, { key: 'discharge', label: 'O-05 Entlassung' }, { key: 'benefitChange', label: 'O-06 Leistungsänderung' }, { key: 'therapy', label: 'O-07 Therapien' }, { key: 'doctorCommunication', label: 'O-08 Arztkontakt' }, { key: 'review', label: 'Prüfung & Freigabe' }];
const options = (rows: readonly {
    id: string;
    payload: Record<string, unknown>;
}[], empty: string) => [{ key: '', label: empty }, ...rows.map(row => ({ key: row.id, label: String(row.payload.display_name ?? row.payload.title ?? row.payload.name ?? row.payload.label ?? row.id) }))];
const nullable = (v: string) => v.trim() || null;
export function CounselingCoordinationPathPanel(props: Props) { const remount = [props.tenantId, props.clientId, props.assessmentId, props.actorId, props.canRead, props.canWrite, props.canRelease, props.canReview].join(':'); return <CounselingCoordinationWorkspace key={remount} {...props}/>; }
function CounselingCoordinationWorkspace({ tenantId, clientId, assessmentId, actorId, canRead, canWrite, canRelease, canReview }: Props) {
    const alive = useRef(true), generation = useRef(0), [step, setStep] = useState<Step>('consultation'), [entry, setEntry] = useState<CounselingCoordinationEntry | null>(null), [original, setOriginal] = useState<CounselingCoordinationOriginal | null>(null), [reason, setReason] = useState(''), [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false), [error, setError] = useState<string | null>(null), [success, setSuccess] = useState<string | null>(null), [draftAvailable, setDraftAvailable] = useState(() => !!readCounselingCoordinationDraft({ tenantId, clientId, assessmentId, actorId }));
    const current = () => alive.current && canRead;
    const query = useAsyncQuery(async () => { const ticket = ++generation.current, isCurrent = () => current() && generation.current === ticket; const [sources, history] = await Promise.all([readCounselingCoordinationSources({ tenantId, clientId, assessmentId, actorId, isCurrent }), readCounselingCoordinationPage({ tenantId, clientId, assessmentId, actorId, isCurrent })]); if (!isCurrent())
        throw Error('Assessment, Profil oder Rechtekontext hat gewechselt.'); if (!sources.ok)
        throw Error(sources.error); if (!history.ok)
        throw Error(history.error); return { ok: true as const, data: { sources: sources.data, history: history.data } }; }, [tenantId, clientId, assessmentId, actorId, canRead], { enabled: canRead, queryKey: `${tenantId}:${clientId}:${assessmentId}:${actorId}:counseling-coordination` });
    useEffect(() => { alive.current = true; return () => { alive.current = false; generation.current++; }; }, []);
    const context = { tenantId, clientId, assessmentId, actorId };
    const issue = entry ? counselingCoordinationEntryIssue(entry) : null;
    const begin = () => { if (!query.data || busy || uncertain)
        return; setOriginal(null); setEntry(blankCounselingCoordinationEntry(tenantId, clientId, assessmentId)); setReason(''); setStep('consultation'); setError(null); setSuccess(null); };
    const continueOriginal = (row: CounselingCoordinationOriginal) => { if (busy || uncertain)
        return; setOriginal(row); setEntry(structuredClone(row.entry)); setReason('Fortschreibung des vollständig gelesenen Beratungs- und Koordinationsverlaufs.'); setStep('consultation'); setError(null); };
    const patch = <K extends keyof CounselingCoordinationEntry>(key: K, value: CounselingCoordinationEntry[K]) => { if (canWrite && !busy && !uncertain)
        setEntry(old => old ? ({ ...old, [key]: value }) : old); };
    const storeDraft = () => { if (!entry)
        return; try {
        saveCounselingCoordinationDraft(context, entry, original?.headId ?? null, reason);
        setDraftAvailable(true);
        setSuccess('Entwurf akten-, assessment- und profilgebunden lokal gesichert.');
        setError(null);
    }
    catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Entwurf konnte nicht gesichert werden.');
    } };
    const resume = () => { const draft = readCounselingCoordinationDraft(context); if (!draft) {
        setDraftAvailable(false);
        setError('Kein passender Entwurf gefunden.');
        return;
    } const head = draft.originalHeadId ? query.data?.history.find(row => row.headId === draft.originalHeadId) ?? null : null; if (draft.originalHeadId && !head) {
        setError('Ausgangsfassung ist nicht mehr vollständig lesbar.');
        return;
    } setOriginal(head); setEntry(structuredClone(draft.entry)); setReason(draft.reason); setSuccess(`Entwurf vom ${draft.updatedAt} wiederaufgenommen; Originale werden vor dem Schreiben neu geprüft.`); setError(null); };
    const write = async (next: CounselingCoordinationEntry) => { if (!query.data || busy || !canWrite)
        return; const problem = counselingCoordinationEntryIssue(next); if (problem) {
        setError(problem);
        return;
    } setBusy(true); setError(null); setSuccess(null); try {
        const packet = makeCounselingCoordinationPacket({ schemaVersion: '1', requestId: crypto.randomUUID(), action: original ? 'revise' : 'create', tenantId, clientId, assessmentId, actorId, expectedHeadId: original?.headId ?? null, expectedRevision: original?.revision ?? 0, entry: next, reason: original ? reason : '', original, sources: query.data.sources }), result = await saveCounselingCoordinationDurably(packet, current);
        if (result.ok) {
            clearCounselingCoordinationDraft(context);
            setDraftAvailable(false);
            setUncertain(false);
            setOriginal(result.data);
            setEntry(structuredClone(result.data.entry));
            setSuccess('Gesamter Beratungs- und Koordinationsweg mit vollständiger nativer Quittung gespeichert.');
            await query.refresh();
        }
        else {
            setUncertain(result.uncertain === true);
            setError(result.error);
        }
    }
    finally {
        setBusy(false);
    } };
    const transition = (status: CounselingCoordinationEntry['status']) => { if (!entry)
        return; const now = new Date().toISOString(), review = { ...entry.review }; if (status === 'review_requested') {
        review.requestedBy = actorId;
        review.requestedAt = now;
        review.releasedBy = null;
        review.releasedAt = null;
    } if (status === 'returned') {
        review.returnedBy = actorId;
        review.returnedAt = now;
    } if (status === 'released') {
        review.releasedBy = actorId;
        review.releasedAt = now;
    } void write({ ...entry, status, review }); };
    const recover = async () => { setBusy(true); try {
        const result = await recoverCounselingCoordination(context, current);
        if (result?.ok) {
            setUncertain(false);
            setOriginal(result.data);
            setEntry(structuredClone(result.data.entry));
            setSuccess('Unklarer Speicherausgang über unveränderte Quittung bestätigt.');
            await query.refresh();
        }
        else if (result) {
            setUncertain(result.uncertain === true);
            setError(result.error);
        }
        else
            setError('Kein ungeklärter Versand vorhanden.');
    }
    finally {
        setBusy(false);
    } };
    if (!canRead)
        return <EmptyState title="Beratungskoordination nicht lesbar" message="Aktuelle Assessment-, Dokument-, Kommunikations- und Sensitivitätsrechte fehlen."/>;
    if (query.loading)
        return <LoadingState message="Beratungs- und Koordinationsoriginale werden vollständig geladen …"/>;
    if (query.error)
        return <ErrorState title="Originale nicht vollständig lesbar" message={query.error} onRetry={() => void query.refresh()}/>;
    if (!query.data)
        return <ErrorState title="Kein bestätigter Lesestand" message="Der Ablauf bleibt gesperrt."/>;
    const sources = query.data.sources;
    const input = (label: string, value: string, onChange: (v: string) => void) => <PremiumInput label={label} value={value} onChangeText={onChange} editable={canWrite && !busy && !uncertain}/>;
    const choose = (rows: readonly {
        id: string;
        payload: Record<string, unknown>;
    }[], label: string, value: string | null, onChange: (v: string | null) => void) => <FilterChipGroup wrap options={options(rows, label)} value={value ?? ''} onChange={v => onChange(nullable(v))}/>;
    const body = entry ? <StepPanel step={step} entry={entry} sources={sources} input={input} choose={choose} patch={patch}/> : null;
    return <View style={{ gap: spacing.md }}><SectionPanel title="Beratung, Anleitung und Versorgungskoordination"><InfoBanner variant="warning" message="Plantermin, tatsächliche Durchführung, Lieferung, Einweisung, Einwilligung, ärztliche Antwort, Anordnung und Bestätigung bleiben getrennte Originale. Technische Vollständigkeit ist keine fachliche, rechtliche oder Datenschutzfreigabe."/><FilterChipGroup wrap options={steps} value={step} onChange={v => setStep(v as Step)}/>{error ? <InfoBanner variant="error" message={error}/> : null}{success ? <InfoBanner variant="success" message={success}/> : null}{uncertain ? <PremiumButton title="Unklaren Ausgang nur per Quittung prüfen" onPress={() => void recover()} disabled={busy}/> : null}{!entry ? <View style={{ gap: spacing.sm }}><PremiumButton title="Neuen Gesamtweg beginnen" onPress={begin} disabled={!canWrite || busy || uncertain}/>{draftAvailable ? <PremiumButton title="Lokalen Entwurf wiederaufnehmen" variant="secondary" onPress={resume}/> : null}{query.data.history.map(row => <PremiumButton key={row.id} title={`Fassung ${row.revision} · ${row.status} fortschreiben`} variant="secondary" onPress={() => continueOriginal(row)} disabled={busy || uncertain}/>)}</View> : <><Text style={{ ...typography.body, color: colors.textSecondary }}>Status: {entry.status} · {issue ?? 'alle O-01–O-08 Pflichtangaben technisch vollständig'}</Text>{body}{original ? input('Fortschreibungsgrund', reason, setReason) : null}<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}><PremiumButton title="Entwurf speichern" variant="secondary" onPress={storeDraft} disabled={!canWrite || busy}/><PremiumButton title="Prüfung anfordern" onPress={() => transition('review_requested')} disabled={!canWrite || busy || !!issue}/><PremiumButton title="Zurückgeben" variant="secondary" onPress={() => transition('returned')} disabled={!canWrite || busy || entry.review.returnReason.trim().length < 10}/><PremiumButton title="Append-only berichtigen" variant="secondary" onPress={() => transition("corrected")} disabled={!canWrite || busy || !entry.review.correctionTargetId || entry.review.correctionReason.trim().length < 10}/><PremiumButton title="Mit zweiter Identität freigeben" onPress={() => transition('released')} disabled={!canRelease || busy || !!issue || !entry.review.requestedBy || entry.review.requestedBy === actorId}/></View></>}</SectionPanel>{original && ['released', 'corrected'].includes(original.status) ? <CounselingCoordinationReviewPanel tenantId={tenantId} clientId={clientId} assessmentId={assessmentId} actorId={actorId} canView={canRead} canRequest={canWrite} canReview={canReview} careOriginal={original} sources={query.data.sources}/> : null}</View>;
}
type StepProps = {
    step: Step;
    entry: CounselingCoordinationEntry;
    sources: CounselingCoordinationSources;
    input: (l: string, v: string, c: (v: string) => void) => import('react').ReactElement;
    choose: (r: readonly {
        id: string;
        payload: Record<string, unknown>;
    }[], l: string, v: string | null, c: (v: string | null) => void) => import('react').ReactElement;
    patch: <K extends keyof CounselingCoordinationEntry>(key: K, value: CounselingCoordinationEntry[K]) => void;
};
function StepPanel({ step, entry, sources, input, choose, patch }: StepProps) { const at = (v: string) => nullable(v); if (step === 'consultation') {
    const x = entry.consultation, set = (v: Partial<typeof x>) => patch('consultation', { ...x, ...v });
    return <SectionPanel title="O-01 Beratung: geplant und tatsächlich durchgeführt">{input('Anlass', x.occasion, v => set({ occasion: v }))}{choose(sources.appointments, 'Explizit verknüpften Termin wählen', x.appointmentId, v => set({ appointmentId: v }))}{input('Planzeit (ISO)', x.scheduledAt ?? '', v => set({ scheduledAt: at(v) }))}{input('Beteiligte', x.participants, v => set({ participants: v }))}{input('Bedarf', x.need, v => set({ need: v }))}{input('Zuständigkeit', x.responsibility, v => set({ responsibility: v }))}{input('Tatsächlich durchgeführt (ISO)', x.performedAt ?? '', v => set({ performedAt: at(v) }))}{choose(sources.people, 'Durchführende Person wählen', x.performedBy, v => set({ performedBy: v }))}{input('Ergebnis', x.result, v => set({ result: v }))}{input('Abgrenzung Plan/Durchführung', x.scheduleBoundary, v => set({ scheduleBoundary: v }))}</SectionPanel>;
} if (step === 'mandatoryVisit') {
    const x = entry.mandatoryVisit, set = (v: Partial<typeof x>) => patch('mandatoryVisit', { ...x, ...v });
    return <SectionPanel title="O-02 Beratungsbesuch mit konkreter Formularfassung">{input('Leistungsgrundlage', x.legalBasis, v => set({ legalBasis: v }))}{input('Frist (ISO)', x.deadlineAt ?? '', v => set({ deadlineAt: at(v) }))}{choose(sources.consultations, 'Beratungssitzung wählen', x.sessionId, v => set({ sessionId: v }))}{choose(sources.documents, 'Protokoll/Formular wählen', x.documentId, v => set({ documentId: v }))}{input('Formularfassung', x.formVersion, v => set({ formVersion: v }))}{input('Inhalt', x.content, v => set({ content: v }))}{input('Empfehlung', x.recommendation, v => set({ recommendation: v }))}{input('Bestätigt (ISO)', x.confirmedAt ?? '', v => set({ confirmedAt: at(v) }))}{choose(sources.people, 'Bestätigende Person wählen', x.confirmationBy, v => set({ confirmationBy: v }))}{input('Freigabeanforderungen', x.releaseRequirements, v => set({ releaseRequirements: v }))}</SectionPanel>;
} if (step === 'relativeInstruction') {
    const x = entry.relativeInstruction, set = (v: Partial<typeof x>) => patch('relativeInstruction', { ...x, ...v });
    return <SectionPanel title="O-03 Angehörige anleiten">{choose(sources.contacts, 'Bezugsperson wählen', x.contactId, v => set({ contactId: v }))}{input('Thema', x.topic, v => set({ topic: v }))}{input('Demonstrierte Handlung', x.demonstratedAction, v => set({ demonstratedAction: v }))}{input('Demonstriert (ISO)', x.demonstratedAt ?? '', v => set({ demonstratedAt: at(v) }))}{input('Angeleitete Person', x.instructedPerson, v => set({ instructedPerson: v }))}{input('Gezeigtes Verständnis', x.understanding, v => set({ understanding: v }))}{input('Unabhängige Durchführung — nur tatsächlicher Stand', x.independentPerformance, v => set({ independentPerformance: v }))}{input('Grenzen', x.limits, v => set({ limits: v }))}</SectionPanel>;
} if (step === 'aidSupply') {
    const x = entry.aidSupply, set = (v: Partial<typeof x>) => patch('aidSupply', { ...x, ...v });
    return <SectionPanel title="O-04 Hilfsmittel: Bestellung, Lieferung und Einweisung getrennt">{input('Bedarf', x.need, v => set({ need: v }))}{choose(sources.prescriptions, 'Verordnung wählen', x.prescriptionId, v => set({ prescriptionId: v }))}{choose(sources.orders, 'Auftrag wählen', x.orderId, v => set({ orderId: v }))}{choose(sources.contacts, 'Lieferant wählen', x.supplierContactId, v => set({ supplierContactId: v }))}{input('Auftragsstatus', x.orderState, v => set({ orderState: v }))}{input('Bestellt (ISO)', x.orderedAt ?? '', v => set({ orderedAt: at(v) }))}{input('Geliefert (ISO)', x.deliveredAt ?? '', v => set({ deliveredAt: at(v) }))}{input('Eingewiesen (ISO)', x.instructedAt ?? '', v => set({ instructedAt: at(v) }))}{choose(sources.people, 'Einweisende Person wählen', x.instructedBy, v => set({ instructedBy: v }))}{input('Abgrenzung Bestellung/Lieferung/Einweisung', x.deliveryBoundary, v => set({ deliveryBoundary: v }))}</SectionPanel>;
} if (step === 'discharge') {
    const x = entry.discharge, set = (v: Partial<typeof x>) => patch('discharge', { ...x, ...v });
    return <SectionPanel title="O-05 Entlassmanagement und sichtbare Versorgungslücken">{choose(sources.documents, 'Überleitungsdokument wählen', x.transferDocumentId, v => set({ transferDocumentId: v }))}{input('Entlassen (ISO)', x.dischargedAt ?? '', v => set({ dischargedAt: at(v) }))}{input('Diagnosenquelle', x.diagnosisSource, v => set({ diagnosisSource: v }))}{input('Medikationsabgleich', x.medicationReconciliation, v => set({ medicationReconciliation: v }))}{input('Verordnungslücken', x.prescriptionGaps, v => set({ prescriptionGaps: v }))}{input('Offene Punkte', x.unresolvedItems, v => set({ unresolvedItems: v }))}{input('Lückenplan', x.gapPlan, v => set({ gapPlan: v }))}{choose(sources.serviceRecords, 'Erste tatsächliche Versorgung wählen', x.firstCareRecordId, v => set({ firstCareRecordId: v }))}{input('Erste Versorgung (ISO)', x.firstCareAt ?? '', v => set({ firstCareAt: at(v) }))}{input('Abgrenzung Übergabe/tatsächliche Versorgung', x.transferBoundary, v => set({ transferBoundary: v }))}</SectionPanel>;
} if (step === 'benefitChange') {
    const x = entry.benefitChange, set = (v: Partial<typeof x>) => patch('benefitChange', { ...x, ...v });
    return <SectionPanel title="O-06 Pflegegrad- und Leistungsänderung ohne Rückwirkung">{choose(sources.careLevels, 'Pflegegradfassung wählen', x.careLevelId, v => set({ careLevelId: v }))}{choose(sources.documents, 'Bescheid wählen', x.decisionDocumentId, v => set({ decisionDocumentId: v }))}{input('Eingang (ISO)', x.receivedAt ?? '', v => set({ receivedAt: at(v) }))}{input('Gültig ab (ISO)', x.validFrom ?? '', v => set({ validFrom: at(v) }))}{input('Auswirkung', x.impact, v => set({ impact: v }))}{choose(sources.consultations, 'Beratung wählen', x.counselingSessionId, v => set({ counselingSessionId: v }))}{choose(sources.tasks, 'Folgeauftrag wählen', x.followUpTaskId, v => set({ followUpTaskId: v }))}{input('Historische Abrechnung bleibt unverändert', x.historicalBillingBoundary, v => set({ historicalBillingBoundary: v }))}</SectionPanel>;
} if (step === 'therapy') {
    const x = entry.therapy, set = (v: Partial<typeof x>) => patch('therapy', { ...x, ...v });
    return <SectionPanel title="O-07 Therapien und minimale Datenfreigabe">{choose(sources.prescriptions, 'Therapieverordnung wählen', x.prescriptionId, v => set({ prescriptionId: v }))}{choose(sources.appointments, 'Explizit verknüpften Termin wählen', x.appointmentId, v => set({ appointmentId: v }))}{choose(sources.contacts, 'Therapieanbieter wählen', x.providerContactId, v => set({ providerContactId: v }))}{choose(sources.communications, 'Kontakt/Rückmeldung wählen', x.communicationId, v => set({ communicationId: v }))}{input('Rückmeldung', x.response, v => set({ response: v }))}{choose(sources.consents, 'Einwilligungsquelle wählen', x.consentId, v => set({ consentId: v }))}{input('Freigegebener Umfang', x.approvedScope, v => set({ approvedScope: v }))}{input('Tatsächlich geteilte Felder', x.sharedFields, v => set({ sharedFields: v }))}{input('Erforderlichkeitsbegründung', x.minimumNecessaryReason, v => set({ minimumNecessaryReason: v }))}</SectionPanel>;
} if (step === 'doctorCommunication') {
    const x = entry.doctorCommunication, set = (v: Partial<typeof x>) => patch('doctorCommunication', { ...x, ...v });
    return <SectionPanel title="O-08 Arztkommunikation — Antwort ist keine signierte Verordnung">{input('Anlass', x.reason, v => set({ reason: v }))}{choose(sources.communications, 'Kommunikationsoriginal wählen', x.communicationId, v => set({ communicationId: v }))}{input('Kontaktiert (ISO)', x.contactedAt ?? '', v => set({ contactedAt: at(v) }))}{input('Antwort', x.response, v => set({ response: v }))}{choose(sources.orders, 'Ärztliche Anordnung wählen', x.medicalOrderId, v => set({ medicalOrderId: v }))}{choose(sources.documents, 'Bestätigungsdokument wählen', x.confirmationDocumentId, v => set({ confirmationDocumentId: v }))}{input('Bestätigt (ISO)', x.confirmedAt ?? '', v => set({ confirmedAt: at(v) }))}{input('Warum Identität/Signatur weiter ungeprüft sind', x.verificationBoundary, v => set({ verificationBoundary: v }))}<InfoBanner variant="warning" message="Der technische Verifikationsstatus bleibt ausdrücklich ungeprüft; Telefonnotiz und Textantwort erzeugen keine signierte Verordnung."/></SectionPanel>;
} const x = entry.review, set = (v: Partial<typeof x>) => patch('review', { ...x, ...v }); return <SectionPanel title="Gemeinsame Prüfung, Rückgabe, Freigabe und Korrektur">{input('Rückgabegrund', x.returnReason, v => set({ returnReason: v }))}{choose(sources.paths, 'Historisches Korrekturziel wählen', x.correctionTargetId, v => set({ correctionTargetId: v }))}{input('Korrekturgrund', x.correctionReason, v => set({ correctionReason: v }))}</SectionPanel>; }
