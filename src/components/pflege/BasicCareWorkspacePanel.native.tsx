// Generated native presentation from src/components/pflege/BasicCareWorkspacePanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone,nativeCrypto as crypto} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { ErrorState, FilterChipGroup, InfoBanner, LoadingState, PremiumButton, PremiumInput, SectionPanel, SuccessState } from '@/components/ui';
import { useUnsavedWebChanges } from "../../hooks/useUnsavedWebChanges.native.ts";
import { blankBasicCareEntry, basicCareEntryIssue, makeBasicCarePacket, makeBasicCareReviewPacket, type BasicCareEntry, type BasicCareKind, type BasicCareOriginal, type BasicCareReviewAction, type BasicCareReviewOriginal } from "../../lib/pflege/basicCarePacket.native.ts";
import { readBasicCarePage, readBasicCarePrerequisites, readBasicCareReviewPage, type BasicCarePrerequisites } from "../../lib/pflege/basicCareRepository.supabase.native.ts";
import { recoverBasicCare, recoverBasicCareReview, saveBasicCareDurably, saveBasicCareReviewDurably } from "../../lib/pflege/basicCareWorkflow.native.ts";
import { spacing, typography } from '@/theme';
const kindLabels: Record<BasicCareKind, string> = { body_care: 'Körperpflege', oral_care: 'Mund- und Zahnpflege', dressing: 'An- und Auskleiden', transfer_positioning: 'Transfer und Lagerung', pressure_prevention: 'Dekubitusprävention', fall_prevention: 'Sturzprävention', contracture_prevention: 'Kontrakturprävention', individual_prevention: 'Individuelle Prophylaxe' };
const outcomes = [{ key: 'planned', label: 'Geplant' }, { key: 'offered', label: 'Angeboten' }, { key: 'performed', label: 'Durchgeführt' }, { key: 'partial', label: 'Teilweise' }, { key: 'refused', label: 'Abgelehnt' }, { key: 'not_performed', label: 'Nicht durchgeführt' }];
const levels = [{ key: 'independent', label: 'Selbstständig' }, { key: 'prompting', label: 'Anleitung' }, { key: 'partial_assist', label: 'Teilhilfe' }, { key: 'full_assist', label: 'Vollhilfe' }, { key: 'two_person_assist', label: 'Zwei Personen' }];
const split = (value: string) => value.split(/[;,\n]/).map(item => item.trim()).filter(Boolean);
const join = (value: readonly string[]) => value.join(', ');
const patch = <K extends keyof BasicCareEntry>(entry: BasicCareEntry, key: K, value: BasicCareEntry[K]): BasicCareEntry => ({ ...entry, [key]: value });
export function BasicCareWorkspacePanel({ tenantId, clientId, actorId, actorName, canView, canCreate, canReview, onSaved }: {
    tenantId: string;
    clientId: string;
    actorId: string;
    actorName: string;
    canView: boolean;
    canCreate: boolean;
    canReview: boolean;
    onSaved?: (value: BasicCareOriginal) => void;
}) {
    const identity = `${tenantId}:${clientId}:${actorId}`, alive = useRef(true), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [success, setSuccess] = useState<string | null>(null), [uncertain, setUncertain] = useState(false), [reviewUncertain, setReviewUncertain] = useState(false);
    const [prerequisites, setPrerequisites] = useState<BasicCarePrerequisites | null>(null), [originals, setOriginals] = useState<BasicCareOriginal[]>([]), [reviews, setReviews] = useState<BasicCareReviewOriginal[]>([]), [selectedPlan, setSelectedPlan] = useState(''), [selectedOriginal, setSelectedOriginal] = useState('');
    const [entry, setEntry] = useState<BasicCareEntry>(() => blankBasicCareEntry('body_care')), [reason, setReason] = useState(''), initial = useRef('');
    const [reviewAction, setReviewAction] = useState<BasicCareReviewAction>('request'), [reviewReason, setReviewReason] = useState(''), [requiredChange, setRequiredChange] = useState(''), [reviewRationale, setReviewRationale] = useState('');
    const contextCurrent = () => alive.current && canView && identity === `${tenantId}:${clientId}:${actorId}`;
    const load = async () => { setLoading(true); setError(null); const context = { tenantId, clientId, actorId, isCurrent: contextCurrent }; const [requirements, records, reviewRecords] = await Promise.all([readBasicCarePrerequisites(context), readBasicCarePage(context), readBasicCareReviewPage(context)]); if (!contextCurrent())
        return; if (!requirements.ok || !records.ok || !reviewRecords.ok) {
        setError(!requirements.ok ? requirements.error : !records.ok ? records.error : reviewRecords.ok ? '' : reviewRecords.error);
        setLoading(false);
        return;
    } setPrerequisites(requirements.data); setOriginals(records.data); setReviews(reviewRecords.data); setLoading(false); };
    useEffect(() => { alive.current = true; let active = true; setLoading(true); void Promise.all([recoverBasicCare({ tenantId, clientId, actorId }, () => active && contextCurrent()), recoverBasicCareReview({ tenantId, clientId, actorId }, () => active && contextCurrent())]).then(([careResult, reviewResult]) => { if (!active)
        return; if (careResult?.ok) {
        setSuccess('Der zuvor unklare Grundpflegevorgang wurde anhand seiner vollständigen nativen Quittung bestätigt.');
        onSaved?.(careResult.data);
    }
    else if (careResult) {
        setError(careResult.error);
        setUncertain(careResult.uncertain === true);
    } if (reviewResult?.ok) {
        setSuccess('Die zuvor unklare Grundpflegeprüfung wurde anhand ihrer vollständigen nativen Quittung bestätigt.');
        setReviewUncertain(false);
    }
    else if (reviewResult) {
        setError(reviewResult.error);
        setReviewUncertain(reviewResult.uncertain === true);
    } return load(); }); return () => { active = false; alive.current = false; }; }, [identity, canView]);
    const choosePlan = (key: string) => { const plan = prerequisites?.plans.find(item => `${item.planVersionId}:${item.measureId}:${item.visitId}` === key); if (!plan)
        return; setSelectedPlan(key); setSelectedOriginal(''); const next: BasicCareEntry = { ...blankBasicCareEntry(plan.kind, plan.plannedAt), title: plan.title, planVersionId: plan.planVersionId, measureId: plan.measureId, visitId: plan.visitId, planSnapshotSha256: plan.planSnapshotSha256, assistance: { ...blankBasicCareEntry(plan.kind).assistance, secondPersonRequired: plan.secondPersonRequired, level: plan.secondPersonRequired ? 'two_person_assist' : 'independent' } }; setEntry(next); initial.current = JSON.stringify(next); setReason(''); setError(null); setSuccess(null); };
    const chooseOriginal = (id: string) => { const original = originals.find(item => item.headId === id); if (!original)
        return; setSelectedOriginal(id); setSelectedPlan(''); const next = structuredClone(original.payload); setEntry(next); initial.current = JSON.stringify(next); setReason(''); setReviewAction('request'); setReviewReason(''); setRequiredChange(''); setReviewRationale(''); setError(null); setSuccess(null); };
    const original = originals.find(item => item.headId === selectedOriginal) ?? null, currentReview = reviews.find(item => item.careHeadId === original?.headId) ?? null, effectiveReviewAction: BasicCareReviewAction = currentReview && reviewAction === 'request' ? 'return' : reviewAction, dirty = JSON.stringify(entry) !== initial.current || !!reason.trim() || !!reviewReason.trim() || !!requiredChange.trim() || !!reviewRationale.trim();
    useUnsavedWebChanges(dirty || uncertain || reviewUncertain, busy || uncertain || reviewUncertain);
    const issue = useMemo(() => basicCareEntryIssue(entry), [entry]);
    const change = <K extends keyof BasicCareEntry>(key: K, value: BasicCareEntry[K]) => setEntry(current => patch(current, key, value));
    const save = async () => { if (busy || uncertain || !canCreate || (!selectedPlan && !original))
        return; setBusy(true); setError(null); setSuccess(null); try {
        const plan = prerequisites?.plans.find(item => item.planVersionId === entry.planVersionId && item.measureId === entry.measureId && item.visitId === entry.visitId);
        if (!plan)
            throw Error('Die unveränderte aktuelle Planbindung ist nicht mehr vollständig verfügbar.');
        const packet = makeBasicCarePacket({ action: original ? 'revise' : 'create', requestId: crypto.randomUUID(), tenantId, clientId, actorId, expectedHeadId: original?.headId ?? null, expectedRevision: original?.revision ?? 0, entry: structuredClone(entry), reason: original ? reason.trim() : '', original: original ? structuredClone(original) : null, pressureOriginals: plan.pressureOriginals, fallOriginals: plan.fallOriginals });
        const result = await saveBasicCareDurably(packet, contextCurrent);
        if (!contextCurrent())
            return;
        if (!result.ok) {
            setError(result.error);
            setUncertain(result.uncertain === true);
            return;
        }
        setSuccess(original ? 'Die neue Fassung wurde append-only bestätigt; die vollständige Originalhistorie bleibt erhalten.' : 'Grundpflegepaket wurde mit Planfassung und tatsächlichem Ergebnis bestätigt gespeichert.');
        setUncertain(false);
        setOriginals(values => [result.data, ...values.filter(value => value.rootId !== result.data.rootId)]);
        setSelectedOriginal(result.data.headId);
        setSelectedPlan('');
        initial.current = JSON.stringify(result.data.payload);
        setReason('');
        onSaved?.(result.data);
    }
    catch (cause) {
        if (contextCurrent())
            setError(cause instanceof Error ? cause.message : 'Grundpflege konnte nicht gespeichert werden.');
    }
    finally {
        if (alive.current)
            setBusy(false);
    } };
    const retry = async () => { setBusy(true); setError(null); const result = await recoverBasicCare({ tenantId, clientId, actorId }, contextCurrent); if (contextCurrent()) {
        setBusy(false);
        if (result?.ok) {
            setUncertain(false);
            setSuccess('Die unveränderte ursprüngliche Anfrage wurde anhand ihrer nativen Quittung bestätigt.');
            setOriginals(values => [result.data, ...values.filter(value => value.rootId !== result.data.rootId)]);
            onSaved?.(result.data);
        }
        else
            setError(result?.error ?? 'Keine passende vollständige Quittung gefunden.');
    } };
    const saveReview = async () => { const action = effectiveReviewAction; if (busy || reviewUncertain || !original || action === 'request' && !canCreate || action !== 'request' && !canReview)
        return; setBusy(true); setError(null); setSuccess(null); try {
        const packet = makeBasicCareReviewPacket({ action, requestId: crypto.randomUUID(), tenantId, clientId, actorId, occurredAt: new Date().toISOString(), expectedReviewHeadId: currentReview?.headId ?? null, expectedReviewRevision: currentReview?.revision ?? 0, careOriginal: structuredClone(original), reviewOriginal: currentReview ? structuredClone(currentReview) : null, reason: action === 'accept' ? '' : reviewReason.trim(), requiredChange: action === 'return' ? requiredChange.trim() : '', rationale: action === 'accept' ? reviewRationale.trim() : '' });
        const result = await saveBasicCareReviewDurably(packet, contextCurrent);
        if (!contextCurrent())
            return;
        if (!result.ok) {
            setError(result.error);
            setReviewUncertain(result.uncertain === true);
            return;
        }
        setReviewUncertain(false);
        setReviews(values => [result.data, ...values.filter(value => value.rootId !== result.data.rootId)]);
        setReviewReason('');
        setRequiredChange('');
        setReviewRationale('');
        setSuccess(action === 'request' ? 'Die getrennte Prüfanfrage wurde bestätigt gespeichert.' : action === 'return' ? 'Die begründete Rückgabe wurde append-only bestätigt.' : 'Die qualifizierte Annahme wurde append-only bestätigt.');
    }
    catch (cause) {
        if (contextCurrent())
            setError(cause instanceof Error ? cause.message : 'Grundpflegeprüfung konnte nicht gespeichert werden.');
    }
    finally {
        if (alive.current)
            setBusy(false);
    } };
    const retryReview = async () => { setBusy(true); setError(null); const result = await recoverBasicCareReview({ tenantId, clientId, actorId }, contextCurrent); if (contextCurrent()) {
        setBusy(false);
        if (result?.ok) {
            setReviewUncertain(false);
            setSuccess('Die unveränderte ursprüngliche Prüfanfrage wurde anhand ihrer nativen Quittung bestätigt.');
            setReviews(values => [result.data, ...values.filter(value => value.rootId !== result.data.rootId)]);
        }
        else
            setError(result?.error ?? 'Keine passende vollständige Prüfquittung gefunden.');
    } };
    if (!canView)
        return <ErrorState message="Das aktuelle Leserecht für Pflegeplanung und Grundpflegedokumentation fehlt."/>;
    if (loading)
        return <SectionPanel title="Grundpflege und Prophylaxen"><LoadingState message="Planbindungen, vollständige Originale und ein mögliches Versandjournal werden geladen…"/></SectionPanel>;
    const helpers = entry.assistance.helpers, performed = entry.execution.performedBy;
    return <SectionPanel title="Grundpflege und Prophylaxen" subtitle="Planung, tatsächliche Durchführung, Beobachtung, Abweichung und Folgeauftrag in einem Verlauf">
  <InfoBanner variant="info" title="Plan ist nicht Durchführung" message="Die gewählte Planfassung bleibt unverändert gebunden. Erst ein eigener Ereigniszeitpunkt, Einwilligungsstand, ausführende Personen, Maßnahmen und Ergebnis belegen eine tatsächliche Durchführung."/>
  {prerequisites?.plans.length ? <><Text style={{ ...typography.label }}>Aktuelle, serverseitig gelesene Planmaßnahme</Text><FilterChipGroup wrap options={prerequisites.plans.map(plan => ({ key: `${plan.planVersionId}:${plan.measureId}:${plan.visitId}`, label: `${kindLabels[plan.kind]} · ${plan.title}` }))} value={selectedPlan} onChange={choosePlan}/></> : <InfoBanner variant="warning" message="Keine vollständig lesbare passende Planmaßnahme. Daraus folgt weder fehlender Pflegebedarf noch eine Nichtdurchführung."/>}
  {originals.length ? <><Text style={{ ...typography.label }}>Bestehende vollständige Fassung fortschreiben</Text><FilterChipGroup wrap options={originals.map(item => ({ key: item.headId, label: `${kindLabels[item.kind]} · Rev. ${item.revision} · ${item.payload.lifecycle === 'completed' ? 'abgeschlossen' : 'offen'}` }))} value={selectedOriginal} onChange={chooseOriginal}/></> : null}
  {selectedPlan || original ? <View style={{ gap: spacing.sm }}>
   <SectionPanel title={`${kindLabels[entry.kind]} · Planbindung`}><PremiumInput label="Titel" value={entry.title} onChangeText={value => change('title', value)} editable={!busy && !uncertain}/><PremiumInput label="Plantermin (ISO mit Zeitzone)" value={entry.plannedAt} editable={false}/><InfoBanner variant="info" message={`Planfassung ${entry.planVersionId} · Maßnahme ${entry.measureId} · Einsatz ${entry.visitId} · ${entry.planSnapshotSha256}`}/></SectionPanel>
   <SectionPanel title="Einwilligung und tatsächliches Ereignis"><FilterChipGroup wrap options={[{ key: 'not_asked', label: 'Nicht erhoben' }, { key: 'consented', label: 'Eingewilligt' }, { key: 'refused', label: 'Abgelehnt' }, { key: 'withdrawn', label: 'Widerrufen' }]} value={entry.consent.state} onChange={value => change('consent', { ...entry.consent, state: value as BasicCareEntry['consent']['state'], recordedAt: value === 'not_asked' ? null : new Date().toISOString() })}/><PremiumInput label="Tatsächlicher Ereigniszeitpunkt (leer bei Planung)" value={entry.occurredAt ?? ''} onChangeText={value => change('occurredAt', value.trim() || null)}/><PremiumInput label="Geäußerter Ablehnungsgrund" value={entry.consent.statedReason} onChangeText={value => change('consent', { ...entry.consent, statedReason: value })} multiline/><PremiumInput label="Tatsächlich erfolgte Beratung" value={entry.consent.consultation} onChangeText={value => change('consent', { ...entry.consent, consultation: value })} multiline/></SectionPanel>
   <SectionPanel title="Hilfe, Hilfsmittel und Ausführende"><FilterChipGroup wrap options={levels} value={entry.assistance.level} onChange={value => change('assistance', { ...entry.assistance, level: value as BasicCareEntry['assistance']['level'], secondPersonRequired: value === 'two_person_assist' })}/><PremiumInput label="Vorgesehene Helfer-Profil-IDs" value={join(helpers)} onChangeText={value => change('assistance', { ...entry.assistance, helpers: split(value) })}/><PremiumInput label="Tatsächlich ausführende Profil-IDs" value={join(performed)} onChangeText={value => change('execution', { ...entry.execution, performedBy: split(value) })}/><PremiumInput label="Hilfsmittel" value={join(entry.assistance.aids)} onChangeText={value => change('assistance', { ...entry.assistance, aids: split(value) })}/><PremiumInput label="Konkrete Technik / Unterstützung" value={entry.assistance.technique} onChangeText={value => change('assistance', { ...entry.assistance, technique: value })} multiline/></SectionPanel>
   <SectionPanel title="Beobachtung und Durchführung"><PremiumInput label="Ausgangslage" value={entry.observation.baseline} onChangeText={value => change('observation', { ...entry.observation, baseline: value })} multiline/><PremiumInput label="Hautbeobachtung" value={entry.observation.skin} onChangeText={value => change('observation', { ...entry.observation, skin: value })} multiline/><PremiumInput label="Mobilität" value={entry.observation.mobility} onChangeText={value => change('observation', { ...entry.observation, mobility: value })} multiline/><PremiumInput label="Mund-/Zahnbefund" value={entry.observation.oral} onChangeText={value => change('observation', { ...entry.observation, oral: value })} multiline/><PremiumInput label="Verträglichkeit / Reaktion" value={entry.observation.tolerance} onChangeText={value => change('observation', { ...entry.observation, tolerance: value })} multiline/><FilterChipGroup wrap options={outcomes} value={entry.execution.outcome} onChange={value => change('execution', { ...entry.execution, outcome: value as BasicCareEntry['execution']['outcome'] })}/>{entry.kind === 'body_care' ? <FilterChipGroup wrap options={[{ key: 'partial', label: 'Teilkörperpflege' }, { key: 'full', label: 'Ganzkörperpflege' }]} value={entry.execution.bodyScope} onChange={value => change('execution', { ...entry.execution, bodyScope: value as 'partial' | 'full' })}/> : null}<PremiumInput label="Tatsächliche Maßnahmen" value={join(entry.execution.interventions)} onChangeText={value => change('execution', { ...entry.execution, interventions: split(value) })}/><PremiumInput label="Tatsächliches Ergebnis" value={entry.execution.result} onChangeText={value => change('execution', { ...entry.execution, result: value })} multiline/><PremiumInput label="Abweichung / Nichtdurchführungsgrund" value={entry.execution.deviation} onChangeText={value => change('execution', { ...entry.execution, deviation: value })} multiline/></SectionPanel>
   {['pressure_prevention', 'fall_prevention', 'individual_prevention'].includes(entry.kind) ? <SectionPanel title="Individuelle Prophylaxe"><PremiumInput label="Individuelles Risiko" value={entry.prevention.risk} onChangeText={value => change('prevention', { ...entry.prevention, risk: value })} multiline/><PremiumInput label="Fachliche Grundlage" value={entry.prevention.professionalBasis} onChangeText={value => change('prevention', { ...entry.prevention, professionalBasis: value })} multiline/><PremiumInput label="Individuelle Maßnahme" value={entry.prevention.individualMeasure} onChangeText={value => change('prevention', { ...entry.prevention, individualMeasure: value })} multiline/><PremiumInput label="Geplanter Prüftermin (ISO, optional)" value={entry.prevention.reviewAt ?? ''} onChangeText={value => change('prevention', { ...entry.prevention, reviewAt: value.trim() || null })}/>{entry.kind === 'fall_prevention' ? <><FilterChipGroup wrap options={[{ key: 'no', label: 'Kein Sturzereignis dokumentiert' }, { key: 'yes', label: 'Sturzereignis verknüpfen' }]} value={entry.prevention.fallOccurred ? 'yes' : 'no'} onChange={value => change('prevention', { ...entry.prevention, fallOccurred: value === 'yes' })}/><PremiumInput label="Ereignis-ID" value={entry.prevention.incidentId ?? ''} onChangeText={value => change('prevention', { ...entry.prevention, incidentId: value.trim() || null })}/><PremiumInput label="Neubewertungs-ID" value={entry.prevention.reassessmentId ?? ''} onChangeText={value => change('prevention', { ...entry.prevention, reassessmentId: value.trim() || null })}/></> : null}</SectionPanel> : null}
   <SectionPanel title="Folgeauftrag und Abschluss"><FilterChipGroup wrap options={[{ key: 'none', label: 'Kein Folgeauftrag' }, { key: 'open', label: 'Folgeauftrag offen' }, { key: 'closed', label: 'Folgeauftrag abgeschlossen' }]} value={entry.followUp.required ? entry.followUp.state : 'none'} onChange={value => change('followUp', value === 'none' ? { required: false, reason: '', responsibleProfileId: null, dueAt: null, taskId: null, state: 'not_required', closureEvidence: '' } : { ...entry.followUp, required: true, state: value as 'open' | 'closed' })}/><PremiumInput label="Anlass" value={entry.followUp.reason} onChangeText={value => change('followUp', { ...entry.followUp, reason: value })}/><PremiumInput label="Verantwortliches Profil" value={entry.followUp.responsibleProfileId ?? ''} onChangeText={value => change('followUp', { ...entry.followUp, responsibleProfileId: value.trim() || null })}/><PremiumInput label="Fällig am (ISO mit Zeitzone)" value={entry.followUp.dueAt ?? ''} onChangeText={value => change('followUp', { ...entry.followUp, dueAt: value.trim() || null })}/><PremiumInput label="Auftrags-ID" value={entry.followUp.taskId ?? ''} onChangeText={value => change('followUp', { ...entry.followUp, taskId: value.trim() || null })}/><PremiumInput label="Unveränderter Abschlussbeleg" value={entry.followUp.closureEvidence} onChangeText={value => change('followUp', { ...entry.followUp, closureEvidence: value })} multiline/><FilterChipGroup wrap options={[{ key: 'open', label: 'Vorgang offen' }, { key: 'completed', label: 'Vorgang abgeschlossen' }]} value={entry.lifecycle} onChange={value => change('lifecycle', value as 'open' | 'completed')}/></SectionPanel>
   {original ? <PremiumInput label="Konkreter Grund der Fortschreibung" value={reason} onChangeText={setReason} multiline/> : null}
  </View> : null}
  {original ? <SectionPanel title="Getrennte fachliche Prüfung" subtitle="Prüfanfrage, Rückgabe und qualifizierte Annahme bleiben an genau diese unveränderte Pflegefassung gebunden">
   {currentReview ? <><InfoBanner variant={currentReview.status === 'accepted' ? 'success' : currentReview.status === 'returned' ? 'warning' : 'info'} title={`Prüfstatus: ${currentReview.status === 'requested' ? 'angefragt' : currentReview.status === 'returned' ? 'zurückgegeben' : 'qualifiziert angenommen'}`} message={`Prüfrevision ${currentReview.revision} · Pflegekopf ${currentReview.careHeadId} · ${currentReview.careContentFingerprint}`}/>{currentReview.history.map(item => <View key={item.id} style={{ gap: spacing.xs }}><Text style={{ ...typography.label }}>{item.kind === 'review_request' ? 'Prüfanfrage' : item.kind === 'review_return' ? 'Begründete Rückgabe' : 'Qualifizierte Annahme'} · {item.recordedAt} · {item.actorName}</Text><Text>{item.kind === 'review_acceptance' ? item.rationale : item.kind === 'review_return' ? `${item.reason} · ${item.requiredChange}` : item.reason}</Text>{item.qualificationOriginal ? <Text>Qualifikation: {item.qualificationOriginal.title} · {item.qualificationOriginal.status} · gültig bis {item.qualificationOriginal.validUntil ?? 'unbefristet'}</Text> : null}</View>)}</> : <InfoBanner variant="info" message="Für diese aktuelle Pflegefassung liegt noch keine getrennte Prüfhistorie vor."/>}
   {!currentReview ? <><PremiumInput label="Konkreter Anlass der Prüfanfrage" value={reviewReason} onChangeText={setReviewReason} multiline editable={!busy && !reviewUncertain}/><PremiumButton title="Unveränderte Pflegefassung zur Prüfung anfragen" fullWidth loading={busy} disabled={busy || reviewUncertain || !canCreate || reviewReason.trim().length < 10} onPress={saveReview}/></> : currentReview.status === 'requested' ? <><FilterChipGroup wrap options={[{ key: 'return', label: 'Begründet zurückgeben' }, { key: 'accept', label: 'Qualifiziert annehmen' }]} value={effectiveReviewAction} onChange={value => setReviewAction(value as BasicCareReviewAction)}/>{effectiveReviewAction === 'accept' ? <PremiumInput label="Fachliche Annahmebegründung" value={reviewRationale} onChangeText={setReviewRationale} multiline editable={!busy && !reviewUncertain}/> : <><PremiumInput label="Konkreter Rückgabegrund" value={reviewReason} onChangeText={setReviewReason} multiline editable={!busy && !reviewUncertain}/><PremiumInput label="Erforderliche Änderung" value={requiredChange} onChangeText={setRequiredChange} multiline editable={!busy && !reviewUncertain}/></>}<PremiumButton title={effectiveReviewAction === 'accept' ? 'Qualifizierte Annahme speichern' : 'Begründete Rückgabe speichern'} fullWidth loading={busy} disabled={busy || reviewUncertain || !canReview || (effectiveReviewAction === 'accept' ? reviewRationale.trim().length < 10 : reviewReason.trim().length < 10 || requiredChange.trim().length < 10)} onPress={saveReview}/></> : null}
   {reviewUncertain ? <><InfoBanner variant="warning" title="Prüfausgang ungeklärt" message="Die unveränderte ursprüngliche Prüfanfrage bleibt gesperrt. Es wird weder eine zweite Anfrage noch eine Entscheidung erzeugt."/><PremiumButton title="Genau diese native Prüfquittung erneut prüfen" loading={busy} onPress={retryReview}/></> : null}
   <InfoBanner variant="warning" message="Prüfanfrage oder Annahme beweist keine Pflegehandlung, Kommunikation, Abrechnung oder externe qualifizierte Abnahme."/>
  </SectionPanel> : null}
  {issue && (selectedPlan || original) ? <InfoBanner variant="danger" title="Noch nicht speicherbar" message={issue}/> : null}{error ? <ErrorState message={error}/> : null}{success ? <SuccessState message={success}/> : null}
  {uncertain ? <><InfoBanner variant="warning" title="Speicherausgang ungeklärt" message="Die unveränderte ursprüngliche Anfrage bleibt gesperrt. Es wird weder ein Ersatzwrite noch eine neue Durchführung erzeugt."/><PremiumButton title="Genau diese native Quittung erneut prüfen" loading={busy} onPress={retry}/></> : <View style={{ gap: spacing.sm }}><PremiumButton title={original ? 'Grundpflege append-only fortschreiben' : 'Grundpflegepaket vollständig speichern'} fullWidth loading={busy} disabled={busy || !canCreate || (!selectedPlan && !original) || !!issue} onPress={save}/><PremiumButton title="Planbindungen und vollständige Originale neu laden" variant="secondary" disabled={busy} onPress={load}/></View>}
  <InfoBanner variant="warning" message={`Aktueller Akteur: ${actorName}. Lokale Prüfungen bestätigen keine pflegefachliche Durchführung, Einwilligungswirksamkeit oder rechtliche Freigabe.`}/>
 </SectionPanel>;
}
