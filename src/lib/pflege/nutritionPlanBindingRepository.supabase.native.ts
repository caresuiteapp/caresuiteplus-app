// Generated native presentation from src/lib/pflege/nutritionPlanBindingRepository.supabase.web.ts. Update through scripts/port-native-workspaces.mjs.
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { getSupabaseClient } from "../supabase/client.ts";
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import { cloneClientNativeOriginal, freezeClientNativeOriginal, sameClientNativeOriginal } from "../clients/clientRecordNativeOriginal.native.ts";
import { requireCareWorkspaceAuthorityWeb } from "./careWorkspaceAuthority.native.ts";
import { nutritionPlanBindingUuid, nutritionPlanBindingSha, nutritionPlanBindingSelectionIssue, nutritionPlanBindingContextIssue, nutritionPlanBindingPacketIssue, nutritionPlanBindingReceiptIssue, type NutritionPlanBindingScope, type NutritionPlanBindingSelection, type NutritionPlanBindingContext, type NutritionPlanBindingPacket, type NutritionPlanBindingReceipt } from "./nutritionPlanBindingDomain.native.ts";
type Row = Record<string, unknown>;
type CaptureContext = NutritionPlanBindingScope & {
    isCurrent(): boolean;
};
export type NutritionPlanBindingResult<T> = {
    ok: true;
    data: T;
} | {
    ok: false;
    error: string;
    uncertain?: boolean;
    rejected?: boolean;
};
const object = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v);
const unavailable = 'Die ursprüngliche native Ernährungsbindung konnte nicht bestätigt werden.';
const dbClient = () => getSupabaseClient() as unknown as {
    auth: {
        getSession(): Promise<{
            data: {
                session: null | {
                    user: {
                        id: string;
                    };
                    access_token: string;
                    expires_at?: number;
                };
            };
            error: unknown;
        }>;
        getUser(token?: string): Promise<{
            data: {
                user: null | {
                    id: string;
                    is_anonymous?: boolean;
                };
            };
            error: unknown;
        }>;
    };
    rpc(name: string, args: Row): Promise<{
        data: unknown;
        error: unknown;
        status?: number;
    }>;
} | null;
function contextField(c: unknown, key: string): unknown { if (!object(c) || ![Object.prototype, null].includes(Object.getPrototypeOf(c)))
    throw Error(unavailable); const d = Object.getOwnPropertyDescriptor(c, key); if (!d || !('value' in d) || !d.enumerable)
    throw Error(unavailable); return d.value; }
async function authority(c: CaptureContext) {
    const owner = { tenantId: contextField(c, 'tenantId') as string, clientId: contextField(c, 'clientId') as string, actorId: contextField(c, 'actorId') as string, current: contextField(c, 'isCurrent') as () => boolean }, db = dbClient();
    if (!db || ![owner.tenantId, owner.clientId, owner.actorId].every(nutritionPlanBindingUuid) || typeof owner.current !== 'function')
        throw Error(unavailable);
    const auth = db.auth, getSession = auth.getSession, getUser = auth.getUser, rpc = db.rpc;
    let sessionKey: string | null = null;
    const current = () => { if (contextField(c, 'tenantId') !== owner.tenantId || contextField(c, 'clientId') !== owner.clientId || contextField(c, 'actorId') !== owner.actorId || contextField(c, 'isCurrent') !== owner.current || owner.current() !== true || dbClient() !== db || db.auth !== auth || auth.getSession !== getSession || auth.getUser !== getUser || db.rpc !== rpc || owner.current() !== true)
        throw Error(unavailable); };
    const scope = { tenantId: owner.tenantId, clientId: owner.clientId, actorId: owner.actorId, isCurrent: () => { try {
            current();
            return true;
        }
        catch {
            return false;
        } } };
    const capture = async <T>(request: PromiseLike<T>, operation = 'Eigenen Ernährungskontext bestätigen'): Promise<T> => { const response = cloneClientNativeOriginal(await withServiceQueryTimeout(Promise.resolve(request), operation, 20000)); current(); return response; };
    const facade = { auth: { getSession: async () => { current(); const response = await capture(Reflect.apply(getSession, auth, []) as ReturnType<typeof getSession>), s = response.data.session; if (response.error !== null || !s || !nutritionPlanBindingUuid(s.user.id) || typeof s.access_token !== 'string' || !s.access_token || typeof s.expires_at !== 'number' || !Number.isFinite(s.expires_at) || s.expires_at * 1000 <= Date.now())
                throw Error(unavailable); const key = JSON.stringify([s.user.id, s.access_token, s.expires_at]); if (sessionKey !== null && sessionKey !== key)
                throw Error(unavailable); sessionKey = key; return response; }, getUser: async (token?: string) => { current(); const response = await capture(Reflect.apply(getUser, auth, [token]) as ReturnType<typeof getUser>); if (response.error !== null || response.data.user?.is_anonymous === true)
                throw Error(unavailable); return response; } }, rpc: async (name: string, args: Row) => { current(); if (!['resolve_current_profile_id', 'current_tenant_id'].includes(name))
            throw Error(unavailable); const r = await capture(Reflect.apply(rpc, db, [name, args]) as ReturnType<typeof rpc>); if (r.error !== null)
            throw Error(unavailable); return r; } };
    const check = async () => { current(); await requireCareWorkspaceAuthorityWeb(scope, () => { current(); return facade; }, (request, operation) => withServiceQueryTimeout(Promise.resolve(request), operation, 20000), unavailable); current(); };
    const request = async (name: string, args: Row, operation: string) => { current(); const response = await capture(Reflect.apply(rpc, db, [name, args]) as ReturnType<typeof rpc>, operation); await check(); return response; };
    await check();
    return { scope, current, check, request };
}
const scopeArgs = (c: NutritionPlanBindingScope) => ({ p_tenant_id: c.tenantId, p_client_id: c.clientId, p_actor_profile_id: c.actorId });
/** Explicit native identifiers only; no candidate inventory is inferred. */
export async function readNutritionPlanBindingContext(c: NutritionPlanBindingSelection & {
    isCurrent(): boolean;
}): Promise<NutritionPlanBindingResult<NutritionPlanBindingContext>> {
    try {
        const selected = cloneClientNativeOriginal(Object.fromEntries(['tenantId', 'clientId', 'actorId', 'planVersionId', 'measureId', 'visitId', 'assessmentId'].map(key => [key, contextField(c, key)]))) as NutritionPlanBindingSelection;
        if (nutritionPlanBindingSelectionIssue(selected))
            throw Error(unavailable);
        const guard = await authority(c), current = async () => { await guard.current(); for (const k of ['planVersionId', 'measureId', 'visitId', 'assessmentId'] as const)
            if (contextField(c, k) !== selected[k])
                throw Error(unavailable); }, args = { ...scopeArgs(selected), p_plan_version_id: selected.planVersionId, p_measure_id: selected.measureId, p_visit_id: selected.visitId, p_assessment_id: selected.assessmentId };
        const read = async () => { await current(); const r = await guard.request('web_read_nutrition_elimination_binding_context', args, 'Ausgewählte native Ernährungsplanung bestätigen'); await current(); if (r.error !== null || nutritionPlanBindingContextIssue(r.data, selected))
            throw Error(unavailable); return cloneClientNativeOriginal(r.data as NutritionPlanBindingContext); };
        const first = await read(), last = await read();
        if (!sameClientNativeOriginal(first, last))
            throw Error(unavailable);
        await guard.check();
        await current();
        return { ok: true, data: freezeClientNativeOriginal(last) };
    }
    catch (cause) {
        return { ok: false, error: cause instanceof Error ? cause.message : unavailable };
    }
}
async function operation(input: NutritionPlanBindingPacket, expectedPlanSnapshotSha256: string, isCurrent: () => boolean, confirm: boolean): Promise<NutritionPlanBindingResult<NutritionPlanBindingReceipt>> {
    let p: NutritionPlanBindingPacket;
    try {
        p = freezeClientNativeOriginal(cloneClientNativeOriginal(input));
        const issue = nutritionPlanBindingPacketIssue(p);
        if (issue || !nutritionPlanBindingSha(expectedPlanSnapshotSha256))
            return { ok: false, error: issue ?? unavailable, rejected: true };
    }
    catch {
        return { ok: false, error: unavailable, rejected: true };
    }
    let dispatched = false;
    try {
        const guard = await authority({ ...p, isCurrent });
        await guard.current();
        dispatched = !confirm;
        const r = await guard.request(confirm ? 'web_confirm_nutrition_elimination_plan_binding' : 'web_capture_nutrition_elimination_plan_binding', confirm ? { ...scopeArgs(p), p_request_id: p.requestId, p_packet: p } : { p_packet: p }, confirm ? 'Eigene ursprüngliche Planbindungsquittung bestätigen' : 'Native Ernährungsplanung technisch binden');
        if (r.error !== null) {
            const code = object(r.error) ? String(r.error.code ?? '') : '';
            return { ok: false, error: toGermanSupabaseError(r.error as Parameters<typeof toGermanSupabaseError>[0]), ...(!confirm && r.data === null && ['22007', '22008', '22023', '22P02', '23514', '40001', '42501', 'P0G02'].includes(code) ? { rejected: true } : dispatched ? { uncertain: true } : {}) };
        }
        if (nutritionPlanBindingReceiptIssue(r.data, p, expectedPlanSnapshotSha256))
            return { ok: false, error: unavailable, ...(dispatched ? { uncertain: true } : {}) };
        await guard.current();
        return { ok: true, data: freezeClientNativeOriginal(cloneClientNativeOriginal(r.data as NutritionPlanBindingReceipt)) };
    }
    catch (cause) {
        return { ok: false, error: cause instanceof Error ? cause.message : unavailable, ...(dispatched ? { uncertain: true } : confirm ? {} : { rejected: true }) };
    }
}
export const captureNutritionPlanBinding = (p: NutritionPlanBindingPacket, expectedPlanSnapshotSha256: string, current: () => boolean) => operation(p, expectedPlanSnapshotSha256, current, false);
export const confirmNutritionPlanBinding = (p: NutritionPlanBindingPacket, expectedPlanSnapshotSha256: string, current: () => boolean) => operation(p, expectedPlanSnapshotSha256, current, true);
