// Generated native presentation from src/lib/pflege/nativeCarePlanSourceRepository.web.ts. Update through scripts/port-native-workspaces.mjs.
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { createAssessmentWorkspaceTransport, captureAssessmentWorkspaceJson, type AssessmentWorkspaceTransportOptions } from "../careAssessment/assessmentWorkspaceTransport.native.ts";
import { freezeClientNativeOriginal, sameClientNativeOriginal, type ClientNativeRow } from "../clients/clientRecordNativeOriginal.native.ts";
import type { HandoverSdk } from "./caseHandoverRepository.native.ts";
export type NativeCarePlanSourceSelection = Readonly<{
    planId: string;
    clientId: string;
    sourceAssessmentId: string | null;
}>;
export type NativeCarePlanSourceAuthority = Readonly<{
    tenantId: string;
    actorId: string;
    accessToken: string;
    expiresAt: number | null;
    isCurrent(): boolean;
}>;
export type NativeCarePlanSourceSnapshot = Readonly<{
    plan: ClientNativeRow;
    assessment: ClientNativeRow | null;
}>;
export type NativeCarePlanSourceResult = {
    ok: true;
    data: NativeCarePlanSourceSnapshot;
} | {
    ok: false;
    error: string;
};
type Options = AssessmentWorkspaceTransportOptions & {
    readNative(db: HandoverSdk, table: 'care_plans' | 'care_assessments', filters: Readonly<Record<string, string>>): PromiseLike<unknown>;
};
const unavailable = 'Der gespeicherte Pflegeplan- und SIS-Bezug ist nicht bestätigt. Bitte neu laden.';
const uuid = (value: unknown): value is string => typeof value === 'string' && value.length === 36 && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const row = (value: unknown): value is ClientNativeRow => !!value && typeof value === 'object' && !Array.isArray(value);
/** SELECT-only relation check. Two equal delivered reads are not an atomic snapshot,
 * a full assessment/history read, a source assignment, or a clinical approval. */
export function createNativeCarePlanSourceRepository(options: Options) {
    return Object.freeze({
        async read(authority: NativeCarePlanSourceAuthority, selection: NativeCarePlanSourceSelection): Promise<NativeCarePlanSourceResult> {
            try {
                const selected = freezeClientNativeOriginal(captureAssessmentWorkspaceJson(selection));
                if (Object.keys(selected).sort().join(',') !== 'clientId,planId,sourceAssessmentId'
                    || !uuid(selected.planId) || !uuid(selected.clientId)
                    || selected.sourceAssessmentId !== null && !uuid(selected.sourceAssessmentId))
                    throw Error(unavailable);
                const keys = ['tenantId', 'actorId', 'accessToken', 'expiresAt', 'isCurrent'] as const;
                const values = keys.map(key => {
                    const d = Object.getOwnPropertyDescriptor(authority, key);
                    if (!d || !d.enumerable || !('value' in d))
                        throw Error(unavailable);
                    return d.value;
                });
                const [tenantId, actorId, accessToken, expiresAt, isCurrent] = values as [
                    string,
                    string,
                    string,
                    number | null,
                    () => boolean
                ];
                if (typeof isCurrent !== 'function' || typeof accessToken !== 'string' || !accessToken || !Number.isFinite(expiresAt))
                    throw Error(unavailable);
                const current = () => keys.every((key, index) => {
                    const d = Object.getOwnPropertyDescriptor(authority, key);
                    return !!d && d.enumerable && 'value' in d && d.value === values[index];
                }) && sameClientNativeOriginal(captureAssessmentWorkspaceJson(selection), selected) && isCurrent() === true;
                // The transport's record key is local scope only; it never infers an Assessment
                // for an explicitly unlinked plan or invokes a business RPC for that key.
                const guard = await createAssessmentWorkspaceTransport({ tenantId, actorId, accessToken, expiresAt, assessmentId: selected.sourceAssessmentId ?? selected.planId, isCurrent: current }, options);
                const db = options.getSdk();
                if (!db)
                    throw Error(unavailable);
                const readRow = async (table: 'care_plans' | 'care_assessments', filters: Record<string, string>) => {
                    await guard.check();
                    await guard.current();
                    const request = options.readNative(db, table, freezeClientNativeOriginal(filters));
                    await guard.current();
                    const response = captureAssessmentWorkspaceJson(await options.query(Promise.resolve(request), 'Gespeicherten Pflegeplan-/SIS-Bezug lesen'));
                    await guard.check();
                    if (!row(response) || !Object.hasOwn(response, 'error') || response.error !== null || !row(response.data)
                        || Object.hasOwn(response, 'status') && (!Number.isSafeInteger(response.status) || Number(response.status) < 200 || Number(response.status) >= 300))
                        throw Error(unavailable);
                    return freezeClientNativeOriginal(response.data);
                };
                const read = async (): Promise<NativeCarePlanSourceSnapshot> => {
                    const plan = await readRow('care_plans', { id: selected.planId, tenant_id: guard.scope.tenantId, client_id: selected.clientId });
                    if (plan.id !== selected.planId || plan.tenant_id !== guard.scope.tenantId || plan.client_id !== selected.clientId
                        || !Object.hasOwn(plan, 'source_assessment_id') || plan.source_assessment_id !== selected.sourceAssessmentId
                        || !Number.isSafeInteger(plan.version) || Number(plan.version) < 1)
                        throw Error(unavailable);
                    const assessment = selected.sourceAssessmentId === null ? null : await readRow('care_assessments', {
                        id: selected.sourceAssessmentId, tenant_id: guard.scope.tenantId, subject_type: 'client', subject_id: selected.clientId,
                    });
                    if (assessment && (assessment.id !== selected.sourceAssessmentId || assessment.tenant_id !== guard.scope.tenantId
                        || assessment.subject_type !== 'client' || assessment.subject_id !== selected.clientId))
                        throw Error(unavailable);
                    return freezeClientNativeOriginal({ plan, assessment });
                };
                const first = await read(), last = await read();
                if (!sameClientNativeOriginal(first, last))
                    throw Error('Pflegeplan oder SIS wurden während des Ladens geändert. Bitte neu laden.');
                await guard.current();
                return { ok: true, data: last };
            }
            catch {
                return { ok: false, error: unavailable };
            }
        },
    });
}
