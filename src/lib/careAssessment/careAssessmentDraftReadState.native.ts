// Generated native presentation from src/lib/careAssessment/careAssessmentDraftReadState.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import type { CareAssessment, CareAssessmentSubjectType } from '../../types/modules/careAssessment.ts';
import { sameWoundJson } from '../pflege/woundCareDomain.ts';
export type CareAssessmentDraftContext = {
    tenantId: string;
    profileId: string;
    roleKey: string;
    assessmentId: string;
    subjectType: CareAssessmentSubjectType;
    subjectId: string;
};
export type CareAssessmentDraftBaseline = {
    context: CareAssessmentDraftContext;
    assessment: CareAssessment;
};
const contextFields = ['tenantId', 'profileId', 'roleKey', 'assessmentId', 'subjectType', 'subjectId'] as const;
function assertContext(captured: CareAssessmentDraftContext, current: CareAssessmentDraftContext): void {
    if (contextFields.some(field => captured[field] !== current[field]))
        throw Error('Der ursprüngliche Assessment-, Personen- oder Benutzerkontext hat sich geändert.');
}
function assertAssessmentContext(assessment: CareAssessment, context: CareAssessmentDraftContext): void {
    if (assessment.tenantId !== context.tenantId || assessment.id !== context.assessmentId || assessment.subjectType !== context.subjectType || assessment.subjectId !== context.subjectId)
        throw Error('Der geladene Assessmentstand gehört nicht zum aktuellen Mandanten und Personenbezug.');
}
/** Capture an explicitly adopted, already decoded own-context read. This helper does not validate backend clinical data or permissions. */
export function captureCareAssessmentDraftBaseline(assessment: CareAssessment, context: CareAssessmentDraftContext): CareAssessmentDraftBaseline {
    assertAssessmentContext(assessment, context);
    return { context: structuredClone(context), assessment: structuredClone(assessment) };
}
/** Local edits compare with the captured baseline, independently of incoming reads and their technical revision. */
export function careAssessmentDraftReadState(baseline: CareAssessmentDraftBaseline | null, editable: CareAssessment | null, incomingFreshRead: CareAssessment | null, currentContext: CareAssessmentDraftContext, pending = false) {
    if (baseline) {
        assertContext(baseline.context, currentContext);
        assertAssessmentContext(baseline.assessment, currentContext);
    }
    if (editable)
        assertAssessmentContext(editable, currentContext);
    if (incomingFreshRead)
        assertAssessmentContext(incomingFreshRead, currentContext);
    const dirty = !!editable && (!baseline || !sameWoundJson(baseline.assessment, editable));
    const diverged = !!baseline && !!incomingFreshRead && !sameWoundJson(baseline.assessment, incomingFreshRead);
    return { dirty, diverged, mayAdoptRead: !!incomingFreshRead && !dirty && !pending, writeBlocked: pending || !baseline || !editable || !incomingFreshRead || diverged };
}
/** Return a separate baseline and editable snapshot only when a fresh read may safely replace the clean form. */
export function adoptCareAssessmentDraftRead(baseline: CareAssessmentDraftBaseline | null, editable: CareAssessment | null, incomingFreshRead: CareAssessment | null, currentContext: CareAssessmentDraftContext, pending = false) {
    if (!careAssessmentDraftReadState(baseline, editable, incomingFreshRead, currentContext, pending).mayAdoptRead)
        return null;
    return { baseline: captureCareAssessmentDraftBaseline(incomingFreshRead!, currentContext), value: structuredClone(incomingFreshRead!) };
}
/** Explicitly called after the caller has confirmed its own write and loaded its decoded result; never infer confirmation from a refresh. */
export function confirmCareAssessmentDraftWrite(confirmedAssessment: CareAssessment, capturedWriteContext: CareAssessmentDraftContext, currentContext: CareAssessmentDraftContext) {
    assertContext(capturedWriteContext, currentContext);
    return { baseline: captureCareAssessmentDraftBaseline(confirmedAssessment, currentContext), value: structuredClone(confirmedAssessment) };
}
