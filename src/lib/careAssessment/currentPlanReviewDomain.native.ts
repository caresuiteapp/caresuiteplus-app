// Generated native presentation from src/lib/careAssessment/currentPlanReviewDomain.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import { evaluationMeasureFields, type EvaluationPlan, type EvaluationMeasure } from './planEvaluationDomain.ts';
import { controlExact } from '../pflege/clinicalControlShape.ts';
import { woundUuid, woundInstant } from '../pflege/woundCareDomain.ts';
import type { CareAssessment, CareAssessmentStatus } from '../../types/modules/careAssessment.ts';
const readStatuses: CareAssessmentStatus[] = ['draft', 'in_progress', 'professional_review', 'approved', 'superseded', 'archived'];
/** A saved draft may be clinically incomplete. Read structure never certifies evaluation eligibility or approval. */
function validateCurrentPlanReviewMeasures(measures: unknown): asserts measures is EvaluationMeasure[] {
    if (!Array.isArray(measures) || measures.length > 200)
        throw Error('Gespeicherte Maßnahmenliste fehlt oder ist ungültig.');
    const ids = new Set<string>();
    for (const measure of measures) {
        if (!controlExact(measure, [...evaluationMeasureFields]) || !woundUuid(measure.id) || ids.has(measure.id) || !['planned', 'active', 'paused', 'completed', 'cancelled'].includes(measure.status as string))
            throw Error('Gespeicherte Maßnahme fehlt, ist doppelt oder ungültig.');
        ids.add(measure.id);
        for (const key of evaluationMeasureFields) {
            if (['relatedTopicKey', 'relatedRiskKey', 'nextEvaluationAt'].includes(key) && measure[key] === null)
                continue;
            if (typeof measure[key] !== 'string' || (measure[key] as string).length > 4000)
                throw Error('Gespeicherte Maßnahmenangabe ist ungültig.');
        }
        if (measure.nextEvaluationAt !== null && woundInstant(measure.nextEvaluationAt) === null)
            throw Error('Gespeicherten individuellen Plantermin mit Zeitzone prüfen.');
    }
}
/** Saved current Web read only: an explicit empty measures array does not erase historical assessment originals. */
export function decodeCurrentPlanReview(value: unknown, now = Date.now()): EvaluationPlan {
    if (!Number.isSafeInteger(now) || !controlExact(value, ['assessmentId', 'tenantId', 'clientId', 'version', 'draftRevision', 'updatedAt', 'status', 'measures']) || ![value.assessmentId, value.tenantId, value.clientId].every(woundUuid) || !Number.isSafeInteger(value.version) || (value.version as number) < 1 || (value.version as number) > 2147483647 || !Number.isSafeInteger(value.draftRevision) || (value.draftRevision as number) < 0 || (value.draftRevision as number) > 2147483647 || !readStatuses.includes(value.status as CareAssessmentStatus) || woundInstant(value.updatedAt) === null || woundInstant(value.updatedAt)! > BigInt(now) * 1000n || !Array.isArray(value.measures) || value.measures.length > 200)
        throw Error('Gespeicherter aktueller eigener Planstand fehlt oder ist unvollständig.');
    validateCurrentPlanReviewMeasures(value.measures);
    return structuredClone(value) as EvaluationPlan;
}
/** Capture all genuine measures of a decoded stored client read; this creates no writable evaluation snapshot. */
export function captureCurrentPlanReview(assessment: CareAssessment, now = Date.now()): EvaluationPlan {
    if (assessment.subjectType !== 'client' || !Array.isArray(assessment.measures))
        throw Error('Gespeicherten eigenen Pflegeplan vollständig laden.');
    return decodeCurrentPlanReview({ assessmentId: assessment.id, tenantId: assessment.tenantId, clientId: assessment.subjectId, version: assessment.version, draftRevision: assessment.draftRevision, updatedAt: assessment.updatedAt, status: assessment.status, measures: assessment.measures.map(measure => Object.fromEntries(evaluationMeasureFields.map(key => [key, measure[key]]))) }, now);
}
