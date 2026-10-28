// Generated native presentation from src/screens/careAssessment/PlanAmendmentEditor.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import type { CareAssessmentPendingRead } from "../../lib/careAssessment/careAssessmentReadBoundary.native.ts";
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { ErrorState, FilterChipGroup, InfoBanner, PremiumButton, PremiumInput, SectionPanel, SuccessState } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';
import { useMedicationSubmission } from "../../hooks/useMedicationSubmission.native.ts";
import { useAuth } from '@/lib/auth/context';
import { woundUuid } from '@/lib/pflege/woundCareDomain';
import type { CareAssessment } from '@/types/modules/careAssessment';
import type { RoleKey } from '@/types';
import { evaluationMeasureFields, type EvaluationMeasure, type EvaluationPlan, type EvaluationRecord } from '@/lib/careAssessment/planEvaluationDomain';
import { assertPlanAmendmentContext, planAmendmentVersion, snapshotPlanAmendment, type PlanAmendmentRequest } from '@/lib/careAssessment/planAmendmentDomain';
import { savePlanAmendment } from "../../lib/careAssessment/planAmendmentService.native.ts";
import { CARE_ASSESSMENT_TOPIC_LABELS, getRiskLabel } from "../../lib/careAssessment/catalog.native.ts";
import { MeasureReviewDetails } from "./PlanEvaluationMeasureReviews.native.tsx";
const body = { ...typography.body, color: colors.textSecondary };
const fields: Partial<Record<keyof EvaluationMeasure, string>> = { title: 'Bezeichnung', personalGoal: 'Persönliches Ziel', intervention: 'Konkrete Durchführung', timing: 'Zeitpunkt oder Situation', frequency: 'Häufigkeit', responsibleRole: 'Verantwortliche Rolle', personContribution: 'Mitwirkung der Person', relativesContribution: 'Mitwirkung von An- und Zugehörigen', warningSigns: 'Warn- und Abbruchkriterien', escalationPath: 'Eskalationsweg', evaluationCriteria: 'Prüfkriterium', nextEvaluationAt: 'Nächste Evaluation mit Zeitzone' };
const statusNames: Record<string, string> = { planned: 'Geplant', active: 'Aktiv', paused: 'Pausiert', completed: 'Abgeschlossen', cancelled: 'Aufgehoben' };
type Props = {
    assessment: CareAssessment;
    source: EvaluationRecord;
    target: EvaluationPlan;
    measureId: string;
    records: EvaluationRecord[];
    role: RoleKey | null;
    blocked: boolean;
    registerLeave: (fn: () => Promise<boolean>) => void;
    onWriteBegin: (requestId: string, target: EvaluationPlan) => CareAssessmentPendingRead;
    onSaved: (provenance: CareAssessmentPendingRead) => Promise<void>;
    onClose: () => void;
};
export function PlanAmendmentEditor({ assessment, source, target, measureId, records, role, blocked, registerLeave, onWriteBegin, onSaved, onClose }: Props) {
    const { profile } = useAuth();
    const alive = useRef(true), originalWrite = useRef<{
        requestId: string;
        provenance: CareAssessmentPendingRead;
    } | null>(null);
    const [captured] = useState(() => ({ source: structuredClone(source), target: structuredClone(target) }));
    const [proposed, setProposed] = useState(() => structuredClone(captured.target.measures[0])), [reason, setReason] = useState(''), [personDecision, setPersonDecision] = useState(''), [error, setError] = useState(''), [saved, setSaved] = useState(false);
    const [ownerContext] = useState(() => ({ tenantId: assessment.tenantId, assessmentId: assessment.id, clientId: assessment.subjectId, subjectType: assessment.subjectType, measureId, sourceRootId: source.root.id, profileId: profile?.id ?? '', role: profile?.roleKey ?? null }));
    const accessState = useRef({ assessment, records, role, measureId, sourceRootId: source.root.id, profileId: profile?.id ?? '', profileRole: profile?.roleKey ?? null, blocked, proposed, reason, personDecision, saved, locked: false });
    function sameReadContext(current: typeof accessState.current) { return alive.current && woundUuid(ownerContext.profileId) && current.profileId === ownerContext.profileId && !!ownerContext.role && current.profileRole === ownerContext.role && current.role === ownerContext.role && current.assessment.tenantId === ownerContext.tenantId && current.assessment.id === ownerContext.assessmentId && current.assessment.subjectId === ownerContext.clientId && ownerContext.subjectType === 'client' && current.assessment.subjectType === ownerContext.subjectType && current.measureId === ownerContext.measureId && current.sourceRootId === ownerContext.sourceRootId; }
    const changed = evaluationMeasureFields.filter(k => proposed[k] !== captured.target.measures[0][k]);
    const dirty = !saved && (changed.length > 0 || reason !== '' || personDecision !== '');
    const write = useMedicationSubmission<PlanAmendmentRequest>(dirty, async (id, payload, replay) => {
        const current = accessState.current;
        if (!sameReadContext(current) || (!replay && (current.blocked || current.saved)) || payload.target.tenantId !== current.assessment.tenantId || payload.target.assessmentId !== current.assessment.id || payload.target.clientId !== current.assessment.subjectId || payload.measureId !== ownerContext.measureId || payload.source.root.id !== ownerContext.sourceRootId)
            return { ok: false, error: 'Aktuellen ursprünglichen Lese- und Schreibbezug zuerst bestätigen.', uncertain: replay };
        if (!replay) {
            try {
                assertPlanAmendmentContext(payload, current.records, current.assessment);
            }
            catch (error) {
                return { ok: false as const, error: error instanceof Error ? error.message : 'Aktuellen Änderungsbezug prüfen.' };
            }
        }
        if (originalWrite.current?.requestId !== id) {
            if (replay)
                return { ok: false, error: 'Der ursprüngliche Lesestand der ungewissen Änderung fehlt.', uncertain: true };
            try {
                originalWrite.current = { requestId: id, provenance: onWriteBegin(id, payload.target) };
            }
            catch (error) {
                return { ok: false, error: error instanceof Error ? error.message : 'Ursprünglichen Änderungsstand prüfen.' };
            }
        }
        return savePlanAmendment(current.assessment.tenantId, id, payload, current.role, replay);
    }, async () => { setSaved(true); const original = originalWrite.current; if (!original)
        throw Error('Ursprünglicher Änderungslesestand fehlt.'); await onSaved(original.provenance); });
    accessState.current = { assessment, records, role, measureId, sourceRootId: source.root.id, profileId: profile?.id ?? '', profileRole: profile?.roleKey ?? null, blocked, proposed, reason, personDecision, saved, locked: write.locked };
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    const closeContext = `${assessment.tenantId}:${assessment.id}:${assessment.subjectId}:${profile?.id}:${role}:${assessment.updatedAt}:${measureId}:${records.find(r => r.root.id === source.root.id)?.headId ?? ''}`;
    const closeState = useRef({ context: closeContext, confirm: write.confirmLeave, busy: write.busy, uncertain: write.uncertain, blocked, proposed, reason, personDecision, saved });
    closeState.current = { context: closeContext, confirm: write.confirmLeave, busy: write.busy, uncertain: write.uncertain, blocked, proposed, reason, personDecision, saved };
    const confirmClose = useCallback(async () => { const before = closeState.current; if (before.busy || before.uncertain || !await before.confirm())
        return false; const current = closeState.current; return alive.current && current.context === before.context && current.confirm === before.confirm && !current.busy && !current.uncertain && current.blocked === before.blocked && current.proposed === before.proposed && current.reason === before.reason && current.personDecision === before.personDecision && current.saved === before.saved; }, []);
    useEffect(() => { registerLeave(confirmClose); return () => registerLeave(async () => true); }, [registerLeave, confirmClose]);
    const locked = blocked || write.locked || saved;
    const entry = captured.source.events.at(-1)!.draft.entry!, review = entry.measureReviews!.find(r => r.measureId === measureId)!;
    const mayEdit = () => { const current = accessState.current; return sameReadContext(current) && !current.blocked && !current.saved && !current.locked; };
    const update = (key: keyof EvaluationMeasure, value: string | null) => { if (mayEdit())
        setProposed(old => ({ ...old, [key]: value })); };
    async function submit() { try {
        setError('');
        const current = accessState.current;
        if (!mayEdit())
            throw Error('Aktuellen zugänglichen Schreibbezug vor neuer Änderung bestätigen.');
        const request = snapshotPlanAmendment({ version: planAmendmentVersion, source: captured.source, target: captured.target, measureId, preparedAt: new Date().toISOString(), proposed: current.proposed, reason: current.reason, personDecision: current.personDecision });
        assertPlanAmendmentContext(request, current.records, current.assessment);
        await write.submit(request);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Änderungsauftrag prüfen.');
    } }
    return <SectionPanel title="Maßnahme aus Einzelbewertung anpassen">
  <InfoBanner variant="info" message="Die Änderung gilt für den bearbeitbaren Entwurf. Sie gibt den Pflegeplan nicht fachlich frei und bestätigt keine durchgeführte Behandlung. Die ursprüngliche Evaluation und die bisherige Maßnahme bleiben im Änderungsbeleg erhalten."/>
  <Text style={body}>Evaluation {captured.source.headId} · Original {captured.source.root.id}</Text><Text style={body}>Maßnahme {measureId} · Planfassung {captured.target.version} · Änderungsstand {captured.target.draftRevision}</Text>
  <MeasureReviewDetails entry={{ ...entry, measureReviews: [review] }} plan={{ ...captured.source.root.snapshot, measures: captured.source.root.snapshot.measures.filter(m => m.id === measureId) }}/>
  <SectionPanel title="Geplante Änderung">{Object.entries(fields).map(([key, label]) => <PremiumInput key={key} label={label!} value={proposed[key as keyof EvaluationMeasure] ?? ''} multiline={key !== 'nextEvaluationAt'} editable={!locked} onChangeText={v => update(key as keyof EvaluationMeasure, key === 'nextEvaluationAt' ? (v || null) : v)}/>)}
   <Text style={body}>Themenfeld</Text><FilterChipGroup wrap options={[{ key: '', label: 'Kein Themenfeld' }, ...assessment.topics.map(t => ({ key: t.topicKey, label: CARE_ASSESSMENT_TOPIC_LABELS[t.topicKey] }))]} value={proposed.relatedTopicKey ?? ''} onChange={locked ? undefined : v => update('relatedTopicKey', v || null)}/>
   <Text style={body}>Risikobezug</Text><FilterChipGroup wrap options={[{ key: '', label: 'Kein Risikobezug' }, ...assessment.risks.map(r => ({ key: r.riskKey, label: getRiskLabel(r.riskKey) }))]} value={proposed.relatedRiskKey ?? ''} onChange={locked ? undefined : v => update('relatedRiskKey', v || null)}/>
   <Text style={body}>Maßnahmenstatus im Entwurf</Text><FilterChipGroup wrap options={Object.entries(statusNames).map(([key, label]) => ({ key, label }))} value={proposed.status!} onChange={locked ? undefined : v => update('status', v)}/>
   <PremiumInput label="Konkrete fachliche Änderungsbegründung" value={reason} multiline editable={!locked} onChangeText={value => { if (mayEdit())
        setReason(value); }}/><PremiumInput label="Tatsächliche Personenentscheidung oder Abstimmungsgrenze" value={personDecision} multiline editable={!locked} onChangeText={value => { if (mayEdit())
        setPersonDecision(value); }}/>
  </SectionPanel>
  <SectionPanel title="Vorher und nachher">{changed.length ? changed.map(k => <View key={k} style={{ gap: spacing.xs }}><Text style={body}>{fields[k] ?? ({ relatedTopicKey: 'Themenfeld', relatedRiskKey: 'Risikobezug', status: 'Maßnahmenstatus' } as Record<string, string>)[k]}</Text><Text style={body}>Bisher: {captured.target.measures[0][k] ?? 'Nicht angegeben'}</Text><Text style={body}>Geändert: {proposed[k] ?? 'Nicht angegeben'}</Text></View>) : <Text style={body}>Noch keine Änderung erfasst.</Text>}</SectionPanel>
  {error || write.error ? <ErrorState message={error || write.error!}/> : null}
  {saved ? <><SuccessState message="Der ursprüngliche Änderungsauftrag wurde bestätigt. Der geänderte Plan ist weiterhin ein Entwurf."/><PremiumButton title="Gespeicherten Planstand erneut laden" variant="secondary" onPress={async () => { try {
        setError('');
        const original = originalWrite.current;
        if (!original)
            throw Error('Ursprünglicher Änderungslesestand fehlt.');
        await onSaved(original.provenance);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Gespeicherten Planstand erneut laden.');
    } }}/></> : write.uncertain ? <><InfoBanner variant="warning" message="Speicherstatus ungewiss. Keine weitere Änderung anlegen; die unveränderte ursprüngliche Anfrage erneut prüfen."/><PremiumButton title="Ursprüngliche Änderungsanfrage erneut prüfen" loading={write.busy} onPress={write.retry}/></> : <PremiumButton title="Diese Änderung im Entwurf speichern" disabled={locked || !changed.length || !reason.trim() || !personDecision.trim()} loading={write.busy} onPress={submit}/>}
  <PremiumButton title={saved ? 'Zurück zum Evaluationsverlauf' : 'Änderung schließen'} variant="secondary" disabled={write.busy || write.uncertain} onPress={async () => { if (await confirmClose())
        onClose(); }}/>
 </SectionPanel>;
}
