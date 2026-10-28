// Generated native presentation from src/lib/careAssessment/planLifecyclePacket.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import type { CareAssessmentMeasure, CareAssessmentTopicKey } from '@/types/modules/careAssessment';
export type PlanDayRoutine = {
    id: string;
    sequence: number;
    label: string;
    timeWindow: string;
    ritual: string;
    preference: string;
    dependency: string;
    responsibleRole: string;
    status: 'planned' | 'active' | 'paused';
};
export type PlanSupportBoundary = {
    id: string;
    topicKey: CareAssessmentTopicKey;
    ownContribution: string;
    guidance: string;
    partialSupport: string;
    fullSupport: string;
    stopBoundary: string;
    responsibleRole: string;
};
export type PlanQualityVisit = {
    id: string;
    plannedAt: string;
    participants: string;
    checkpoints: string;
    deviations: string;
    decision: string;
    implementationDueAt: string;
    followUpAt: string;
    state: 'planned' | 'documented';
};
export type PlanLifecycleSnapshot = {
    tenantId: string;
    assessmentId: string;
    subjectId: string;
    actorId: string;
    packetRevision: number;
    packetUpdatedAt: string | null;
    planVersion: number;
    measureOriginals: CareAssessmentMeasure[];
    dayRoutines: PlanDayRoutine[];
    supportBoundaries: PlanSupportBoundary[];
    qualityVisit: PlanQualityVisit | null;
};
export type PlanLifecyclePacket = {
    schemaVersion: '1';
    tenantId: string;
    assessmentId: string;
    subjectId: string;
    actorId: string;
    packetRevision: number;
    packetUpdatedAt: string | null;
    planVersion: number;
    measureOriginals: CareAssessmentMeasure[];
    plannedMeasures: CareAssessmentMeasure[];
    dayRoutines: PlanDayRoutine[];
    supportBoundaries: PlanSupportBoundary[];
    qualityVisit: PlanQualityVisit | null;
    changeReason: string;
};
const uuid = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const instant = (v: unknown) => typeof v === 'string' && v.includes('T') && !Number.isNaN(Date.parse(v));
const text = (v: unknown, max = 4000) => typeof v === 'string' && v.length <= max;
const topics = new Set<CareAssessmentTopicKey>(['cognition_communication', 'mobility', 'disease_demands', 'self_care', 'social_relationships', 'living_environment']);
function measureIssue(value: unknown, allowMissingId = false) {
    const m = value as CareAssessmentMeasure;
    if (!m || typeof m !== 'object' || (!allowMissingId && !uuid(m.id)) || (m.id != null && !uuid(m.id)))
        return 'Maßnahmenoriginal ist nicht eindeutig.';
    for (const key of ['title', 'personalGoal', 'intervention', 'timing', 'frequency', 'responsibleRole', 'personContribution', 'relativesContribution', 'warningSigns', 'escalationPath', 'evaluationCriteria'] as const)
        if (!text(m[key]))
            return 'Maßnahmeninhalt ist ungültig.';
    if (m.relatedTopicKey !== null && !topics.has(m.relatedTopicKey) || typeof m.relatedRiskKey !== 'string' && m.relatedRiskKey !== null || m.nextEvaluationAt !== null && !instant(m.nextEvaluationAt) || !['planned', 'active', 'paused', 'completed', 'cancelled'].includes(m.status))
        return 'Maßnahmenbezug oder -status ist ungültig.';
    return null;
}
function routineIssue(value: unknown) { const r = value as PlanDayRoutine; if (!r || !uuid(r.id) || !Number.isSafeInteger(r.sequence) || r.sequence < 0 || !['planned', 'active', 'paused'].includes(r.status))
    return 'Tagesstruktureintrag ist nicht eindeutig.'; for (const key of ['label', 'timeWindow', 'ritual', 'preference', 'dependency', 'responsibleRole'] as const)
    if (!text(r[key]))
        return 'Tagesstruktureintrag ist ungültig.'; return null; }
function supportIssue(value: unknown) { const s = value as PlanSupportBoundary; if (!s || !uuid(s.id) || !topics.has(s.topicKey))
    return 'Unterstützungsgrenze ist nicht eindeutig.'; for (const key of ['ownContribution', 'guidance', 'partialSupport', 'fullSupport', 'stopBoundary', 'responsibleRole'] as const)
    if (!text(s[key]))
        return 'Unterstützungsgrenze ist ungültig.'; return null; }
function visitIssue(value: unknown) { if (value === null)
    return null; const v = value as PlanQualityVisit; if (!v || !uuid(v.id) || !instant(v.plannedAt) || !['planned', 'documented'].includes(v.state))
    return 'Pflegevisitenbezug ist ungültig.'; for (const key of ['participants', 'checkpoints', 'deviations', 'decision'] as const)
    if (!text(v[key]))
        return 'Pflegevisiteninhalt ist ungültig.'; for (const key of ['implementationDueAt', 'followUpAt'] as const)
    if (v[key] && !instant(v[key]))
        return 'Pflegevisitentermin ist ungültig.'; return null; }
function unique(values: {
    id?: string;
}[]) { return values.every((item, index) => !!item.id && values.findIndex(other => other.id === item.id) === index); }
export function validatePlanLifecycleSnapshot(value: unknown, context: {
    tenantId: string;
    assessmentId: string;
    subjectId: string;
    actorId: string;
}): string | null {
    const s = value as PlanLifecycleSnapshot;
    if (!s || typeof s !== 'object' || s.tenantId !== context.tenantId || s.assessmentId !== context.assessmentId || s.subjectId !== context.subjectId || s.actorId !== context.actorId)
        return 'Planlebenszyklus gehört nicht zum aktuellen Benutzer-, Mandanten- oder Pflegefallbezug.';
    if (![s.tenantId, s.assessmentId, s.subjectId, s.actorId].every(uuid) || !Number.isSafeInteger(s.packetRevision) || s.packetRevision < 0 || !Number.isSafeInteger(s.planVersion) || s.planVersion < 1 || (s.packetUpdatedAt !== null && !instant(s.packetUpdatedAt)))
        return 'Planlebenszyklus ist unvollständig.';
    if (!Array.isArray(s.measureOriginals) || !Array.isArray(s.dayRoutines) || !Array.isArray(s.supportBoundaries) || s.measureOriginals.length > 200 || s.dayRoutines.length > 200 || s.supportBoundaries.length > 200)
        return 'Planlebenszyklus ist zu umfangreich.';
    if (!unique(s.measureOriginals) || !unique(s.dayRoutines) || !unique(s.supportBoundaries) || s.measureOriginals.some(item => measureIssue(item)) || s.dayRoutines.some(item => routineIssue(item)) || s.supportBoundaries.some(item => supportIssue(item)) || visitIssue(s.qualityVisit))
        return 'Planlebenszyklus enthält ungültige oder doppelte Originale.';
    return null;
}
export function makePlanLifecyclePacket(snapshot: PlanLifecycleSnapshot, plannedMeasures: CareAssessmentMeasure[], dayRoutines: PlanDayRoutine[], supportBoundaries: PlanSupportBoundary[], qualityVisit: PlanQualityVisit | null, changeReason: string): PlanLifecyclePacket {
    const issue = validatePlanLifecycleSnapshot(snapshot, { tenantId: snapshot.tenantId, assessmentId: snapshot.assessmentId, subjectId: snapshot.subjectId, actorId: snapshot.actorId });
    if (issue)
        throw Error(issue);
    const packet: PlanLifecyclePacket = { schemaVersion: '1', tenantId: snapshot.tenantId, assessmentId: snapshot.assessmentId, subjectId: snapshot.subjectId, actorId: snapshot.actorId, packetRevision: snapshot.packetRevision, packetUpdatedAt: snapshot.packetUpdatedAt, planVersion: snapshot.planVersion, measureOriginals: structuredClone(snapshot.measureOriginals), plannedMeasures: structuredClone(plannedMeasures), dayRoutines: structuredClone(dayRoutines), supportBoundaries: structuredClone(supportBoundaries), qualityVisit: qualityVisit ? structuredClone(qualityVisit) : null, changeReason: changeReason.trim() };
    const packetIssue = validatePlanLifecyclePacket(packet);
    if (packetIssue)
        throw Error(packetIssue);
    return packet;
}
export function validatePlanLifecyclePacket(value: unknown): string | null {
    const p = value as PlanLifecyclePacket;
    if (!p || typeof p !== 'object' || p.schemaVersion !== '1' || ![p.tenantId, p.assessmentId, p.subjectId, p.actorId].every(uuid) || !Number.isSafeInteger(p.packetRevision) || p.packetRevision < 0 || !Number.isSafeInteger(p.planVersion) || p.planVersion < 1 || (p.packetUpdatedAt !== null && !instant(p.packetUpdatedAt)) || !text(p.changeReason, 4000))
        return 'Planlebenszykluspaket ist unvollständig.';
    if (!Array.isArray(p.measureOriginals) || !Array.isArray(p.plannedMeasures) || !Array.isArray(p.dayRoutines) || !Array.isArray(p.supportBoundaries) || [p.measureOriginals, p.plannedMeasures, p.dayRoutines, p.supportBoundaries].some(v => v.length > 200))
        return 'Planlebenszykluspaket ist zu umfangreich.';
    if (!unique(p.measureOriginals) || p.measureOriginals.some(item => measureIssue(item)) || p.plannedMeasures.some(item => measureIssue(item, true)) || !unique(p.dayRoutines) || p.dayRoutines.some(item => routineIssue(item)) || !unique(p.supportBoundaries) || p.supportBoundaries.some(item => supportIssue(item)) || visitIssue(p.qualityVisit))
        return 'Planlebenszykluspaket enthält ungültige oder doppelte Datensätze.';
    return null;
}
export function planLifecyclePacketIssue(packet: PlanLifecyclePacket | null, measures: CareAssessmentMeasure[], review = false): string | null {
    if (!packet)
        return 'Tagesstruktur, Unterstützungsgrenzen und Pflegevisitenstand vollständig laden.';
    const issue = validatePlanLifecyclePacket(packet);
    if (issue)
        return issue;
    if (JSON.stringify(packet.plannedMeasures) !== JSON.stringify(measures))
        return 'Maßnahmenplanung und Planlebenszyklus haben unterschiedliche Formularstände.';
    if (!review)
        return null;
    if (!packet.changeReason.trim())
        return 'Änderungs- oder Freigabegrund des Pflegeplans ergänzen.';
    if (!packet.plannedMeasures.length)
        return 'Mindestens eine individuelle Maßnahme ist für die Prüfweitergabe erforderlich.';
    for (const m of packet.plannedMeasures)
        if (!m.title.trim() || !m.personalGoal.trim() || !m.intervention.trim() || !m.timing.trim() || !m.frequency.trim() || !m.responsibleRole.trim() || !m.evaluationCriteria.trim() || !m.nextEvaluationAt)
            return 'Ziel, Durchführung, Zeitpunkt, Häufigkeit, Rolle, Prüfkriterium und Evaluationstermin jeder Maßnahme vervollständigen.';
    if (!packet.dayRoutines.length || packet.dayRoutines.some(r => !r.label.trim() || !r.timeWindow.trim() || !r.preference.trim() || !r.responsibleRole.trim()))
        return 'Individuelle Tagesstruktur mit Zeitfenster, Präferenz und Zuständigkeit vervollständigen.';
    if (!packet.supportBoundaries.length || packet.supportBoundaries.some(s => !s.ownContribution.trim() || !s.stopBoundary.trim() || !s.responsibleRole.trim()))
        return 'Eigenleistung, Unterstützungsgrenze und Zuständigkeit vervollständigen.';
    if (!packet.qualityVisit || !packet.qualityVisit.participants.trim() || !packet.qualityVisit.checkpoints.trim() || !packet.qualityVisit.followUpAt)
        return 'Pflegevisite mit Beteiligten, Prüfpunkten und Folgetermin planen.';
    return null;
}
