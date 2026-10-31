// Generated native presentation from src/lib/pflege/treatmentCareReviewRepository.supabase.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import { getSupabaseClient } from "../supabase/client.ts";
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import { treatmentReviewInstantMicros, treatmentReviewStable, treatmentCareReviewOriginalIssue, treatmentCareReviewPacketIssue, type TreatmentCareReviewOriginal, type TreatmentCareReviewPacket } from "./treatmentCareReview.native.ts";
import { cloneClientNativeOriginal } from "../clients/clientRecordNativeOriginal.native.ts";
import { requireCareWorkspaceAuthorityWeb } from "./careWorkspaceAuthority.native.ts";
type Row = Record<string, unknown>;
type Context = {
    tenantId: string;
    clientId: string;
    orderId: string;
    actorId: string;
    isCurrent(): boolean;
};
type Result<T> = {
    ok: true;
    data: T;
} | {
    ok: false;
    error: string;
    uncertain?: boolean;
    rejected?: boolean;
};
const unavailable = 'Der vollständige Behandlungspflegeprüfbestand konnte nicht bestätigt werden.';
const object = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v);
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
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
async function authority(c: Context) { const db = dbClient(); if (!db || !c.isCurrent())
    throw Error(unavailable); let token: string | null = null, authUserId: string | null = null; const check = async () => { if (!c.isCurrent() || dbClient() !== db)
    throw Error(unavailable); const session = cloneClientNativeOriginal(await db.auth.getSession()), s = session.data.session; if (!c.isCurrent() || dbClient() !== db || session.error || !s || !uuid(s.user.id) || authUserId !== null && s.user.id !== authUserId || !s.access_token || s.expires_at !== undefined && s.expires_at * 1000 <= Date.now() || token !== null && s.access_token !== token)
    throw Error(unavailable); token = s.access_token; authUserId = s.user.id; const user = cloneClientNativeOriginal(await db.auth.getUser(token)); if (!c.isCurrent() || dbClient() !== db || user.error || user.data.user?.id !== authUserId)
    throw Error(unavailable); const profile = cloneClientNativeOriginal(await withServiceQueryTimeout(db.rpc('resolve_current_profile_id', {}), 'Aktuelles internes Profil bestätigen', 20000)); if (!c.isCurrent() || dbClient() !== db || profile.error || profile.data !== c.actorId)
    throw Error(unavailable); const after = cloneClientNativeOriginal(await db.auth.getSession()); if (!c.isCurrent() || dbClient() !== db || after.error || after.data.session?.access_token !== token || after.data.session?.user.id !== authUserId || after.data.session.expires_at !== undefined && after.data.session.expires_at * 1000 <= Date.now())
    throw Error(unavailable); }; await check(); return { db, check }; }
async function readAuthority(context: Context) {
    const db = dbClient(), owner = { tenantId: context.tenantId, clientId: context.clientId, orderId: context.orderId, actorId: context.actorId, current: context.isCurrent };
    let sessionOwner: string | null = null;
    if (!db)
        throw Error(unavailable);
    const current = () => { if (context.tenantId !== owner.tenantId || context.clientId !== owner.clientId || context.orderId !== owner.orderId || context.actorId !== owner.actorId || context.isCurrent !== owner.current || owner.current() !== true || dbClient() !== db)
        throw Error(unavailable); };
    const scope = { tenantId: owner.tenantId, clientId: owner.clientId, orderId: owner.orderId, actorId: owner.actorId, isCurrent: () => { try {
            current();
            return true;
        }
        catch {
            return false;
        } } };
    const session = async () => { const result = cloneClientNativeOriginal(await db.auth.getSession()); current(); const value = result.data.session; if (result.error || !value || !uuid(value.user.id) || !value.access_token || typeof value.expires_at !== 'number' || !Number.isFinite(value.expires_at) || value.expires_at * 1000 <= Date.now())
        throw Error(unavailable); return JSON.stringify([value.user.id, value.access_token, value.expires_at]); };
    const check = async () => { current(); const before = await session(); if (sessionOwner !== null && before !== sessionOwner)
        throw Error(unavailable); const verified = await requireCareWorkspaceAuthorityWeb(scope, dbClient, (request, operation) => withServiceQueryTimeout(Promise.resolve(request), operation, 20000), unavailable); if (verified !== db)
        throw Error(unavailable); current(); if (await session() !== before)
        throw Error(unavailable); sessionOwner = before; };
    await check();
    return { db, scope, check };
}
function historyPage(value: unknown) { if (!object(value) || Object.keys(value).length !== 4 || !Array.isArray(value.rows) || value.rows.length > 100 || !Object.hasOwn(value, 'nextCursorRecordedAt') || !Object.hasOwn(value, 'nextCursorId') || typeof value.stateFingerprint !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(value.stateFingerprint))
    throw Error(unavailable); return value as Row & {
    rows: unknown[];
    stateFingerprint: string;
}; }
function decode(v: unknown, c: Pick<Context, 'tenantId' | 'clientId' | 'orderId'>): TreatmentCareReviewOriginal { const issue = treatmentCareReviewOriginalIssue(v, c); if (issue)
    throw Error(issue); return structuredClone(v as TreatmentCareReviewOriginal); }
export async function readTreatmentCareReviewPage(c: Context): Promise<Result<TreatmentCareReviewOriginal[]>> {
    try {
        const guard = await readAuthority(c), rows: TreatmentCareReviewOriginal[] = [], roots = new Set<string>();
        let at: string | null = null, id: string | null = null, stateFingerprint = '', head: unknown = null;
        const read = async (recorded: string | null, cursor: string | null) => { await guard.check(); const response = cloneClientNativeOriginal(await withServiceQueryTimeout(guard.db.rpc('web_read_treatment_care_review_page', { p_tenant_id: guard.scope.tenantId, p_client_id: guard.scope.clientId, p_order_id: guard.scope.orderId, p_actor_profile_id: guard.scope.actorId, p_cursor_recorded_at: recorded, p_cursor_id: cursor, p_page_size: 100 }), 'Behandlungspflegefachprüfungen vollständig laden', 20000)); await guard.check(); if (response.error)
            throw Error(unavailable); return historyPage(response.data); };
        for (let page = 0; page < 100; page++) {
            const data = await read(at, id);
            if (stateFingerprint && data.stateFingerprint !== stateFingerprint)
                throw Error('Ein älterer Behandlungspflegeprüfstand oder native Quellen wurden während des Ladens geändert. Neu laden.');
            stateFingerprint = data.stateFingerprint;
            if (head === null)
                head = structuredClone(data);
            if (data.rows.length === 0) {
                if (data.nextCursorRecordedAt !== null || data.nextCursorId !== null)
                    throw Error(unavailable);
                const latest = await read(null, null);
                if (treatmentReviewStable(latest) !== treatmentReviewStable(head))
                    throw Error('Der vollständige Behandlungspflegeprüfstand wurde während des Ladens geändert. Neu laden.');
                return { ok: true, data: rows };
            }
            let previous = at === null ? null : { at: treatmentReviewInstantMicros(at)!, id: id!.toLowerCase() };
            for (const raw of data.rows) {
                const row = decode(raw, guard.scope), position = { at: treatmentReviewInstantMicros(row.history[0].recordedAt)!, id: row.rootId.toLowerCase() };
                if (roots.has(position.id) || previous && (position.at > previous.at || position.at === previous.at && position.id >= previous.id))
                    throw Error(unavailable);
                roots.add(position.id);
                rows.push(row);
                previous = position;
            }
            if (!previous || !uuid(data.nextCursorId) || typeof data.nextCursorRecordedAt !== 'string' || treatmentReviewInstantMicros(data.nextCursorRecordedAt) !== previous.at || data.nextCursorId.toLowerCase() !== previous.id)
                throw Error(unavailable);
            at = data.nextCursorRecordedAt;
            id = data.nextCursorId;
        }
        throw Error('Der Behandlungspflegeprüfbestand überschreitet die sicher vollständig lesbare Grenze.');
    }
    catch (cause) {
        return { ok: false, error: cause instanceof Error ? cause.message : unavailable };
    }
}
function receipt(v: unknown, p: TreatmentCareReviewPacket): TreatmentCareReviewOriginal | null { if (!object(v) || v.requestId !== p.requestId || treatmentReviewStable(v.packet) !== treatmentReviewStable(p))
    return null; try {
    const o = decode(v.original, p), e = o.history.at(-1)!;
    return o.revision === p.expectedRevision + 1 && o.treatmentRootId === p.treatmentOriginal.rootId && o.treatmentHeadId === p.treatmentOriginal.headId && o.treatmentFingerprint === p.treatmentOriginal.contentFingerprint && o.treatmentKind === p.treatmentOriginal.kind && e.requestId === p.requestId && e.actorId === p.actorId && e.action === p.action && e.reason === p.reason && e.requiredChange === p.requiredChange && e.rationale === p.rationale && (p.reviewOriginal === null || o.rootId === p.reviewOriginal.rootId && treatmentReviewStable(o.history.slice(0, -1)) === treatmentReviewStable(p.reviewOriginal.history)) ? o : null;
}
catch {
    return null;
} }
async function operation(input: TreatmentCareReviewPacket, isCurrent: () => boolean, confirm: boolean): Promise<Result<TreatmentCareReviewOriginal>> { const p = structuredClone(input); if (!confirm) {
    const issue = treatmentCareReviewPacketIssue(p);
    if (issue)
        return { ok: false, error: issue, rejected: true };
} let dispatched = false; try {
    const guard = await authority({ ...p, isCurrent });
    await guard.check();
    dispatched = !confirm;
    const response: {
        data: unknown;
        error: unknown;
        status?: number;
    } = cloneClientNativeOriginal(await withServiceQueryTimeout(guard.db.rpc(confirm ? 'web_confirm_treatment_care_review' : 'web_commit_treatment_care_review', confirm ? { p_tenant_id: p.tenantId, p_client_id: p.clientId, p_order_id: p.orderId, p_actor_profile_id: p.actorId, p_request_id: p.requestId, p_packet: p } : { p_packet: p }), 'Behandlungspflegefachprüfung transaktional sichern oder Quittung lesen', 20000));
    await guard.check();
    if (response.error) {
        const code = object(response.error) ? String(response.error.code ?? '') : '';
        return { ok: false, error: toGermanSupabaseError(response.error as Parameters<typeof toGermanSupabaseError>[0]), ...(!confirm && response.data === null && ['22007', '22008', '22023', '22P02', '23514', '40001', '42501'].includes(code) ? { rejected: true } : { uncertain: true }) };
    }
    const saved = receipt(response.data, p);
    return saved ? { ok: true, data: saved } : { ok: false, error: unavailable, uncertain: true };
}
catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : unavailable, ...(dispatched || confirm ? { uncertain: true } : { rejected: true }) };
} }
export const commitTreatmentCareReview = (p: TreatmentCareReviewPacket, isCurrent: () => boolean) => operation(p, isCurrent, false);
export const confirmTreatmentCareReview = (p: TreatmentCareReviewPacket, isCurrent: () => boolean) => operation(p, isCurrent, true);
