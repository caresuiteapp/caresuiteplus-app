// Generated native presentation from src/lib/pflege/nutritionEliminationRepository.supabase.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import { getSupabaseClient } from "../supabase/client.ts";
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import { nutritionEliminationOriginalIssue, nutritionEliminationPacketIssue, nutritionEliminationSourcesIssue, nutritionReviewOriginalIssue, nutritionReviewPacketIssue, nutritionStable, nutritionInstantMicros, type NutritionReviewOriginal, type NutritionReviewPacket, type NutritionEliminationKind, type NutritionEliminationOriginal, type NutritionEliminationPacket, type NutritionEliminationSources } from "./nutritionEliminationPacket.native.ts";
type Row = Record<string, unknown>;
type Context = {
    tenantId: string;
    clientId: string;
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
export type NutritionEliminationPrerequisites = Readonly<{
    plans: readonly Readonly<{
        planVersionId: string;
        measureId: string;
        visitId: string;
        assessmentId: string;
        planSnapshotSha256: string;
        kind: NutritionEliminationKind;
        title: string;
        plannedAt: string;
        sources: NutritionEliminationSources;
    }>[];
}>;
const unavailable = 'Der vollständige Ernährungs- und Ausscheidungsbestand konnte nicht bestätigt werden.';
const object = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v);
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
const stable = (v: unknown): string => JSON.stringify(v, (_k, item: unknown) => object(item) ? Object.fromEntries(Object.keys(item).sort().map(k => [k, item[k]])) : item);
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const instant = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:?\d{2})$/.test(v) && Number.isFinite(Date.parse(v));
const kinds = new Set<NutritionEliminationKind>(['nutrition_assessment', 'meal_support', 'drink_protocol', 'swallowing_support', 'enteral_nutrition', 'fluid_balance', 'continence_support', 'stool_protocol', 'catheter_care', 'stoma_care', 'tube_observation', 'weight_followup']);
function decodeReview(v: unknown, c: Pick<Context, 'tenantId' | 'clientId'>): NutritionReviewOriginal {
    const issue = nutritionReviewOriginalIssue(v, c);
    if (issue)
        throw Error(issue);
    return structuredClone(v as NutritionReviewOriginal);
}
export async function readNutritionReviewPage(c: Context): Promise<Result<NutritionReviewOriginal[]>> {
    try {
        const guard = await authority(c), rows: NutritionReviewOriginal[] = [], cursors = new Set<string>();
        let at: string | null = null, id: string | null = null;
        for (let page = 0; page < 100; page++) {
            await guard.check();
            const response: {
                data: unknown;
                error: unknown;
                status?: number;
            } = await withServiceQueryTimeout(guard.db.rpc('web_read_nutrition_review_page', { p_tenant_id: c.tenantId, p_client_id: c.clientId, p_actor_profile_id: c.actorId, p_cursor_recorded_at: at, p_cursor_id: id, p_page_size: 100 }), 'Fachprüfungen vollständig laden', 20000);
            await guard.check();
            if (response.error || !object(response.data) || !Array.isArray(response.data.rows) || response.data.rows.length > 100)
                throw Error(unavailable);
            if (response.data.rows.length === 0)
                return { ok: true, data: rows };
            const nextAt = response.data.nextCursorRecordedAt, nextId = response.data.nextCursorId;
            if (!instant(nextAt) || !uuid(nextId) || cursors.has(`${nextAt}:${nextId}`) || at !== null && (nutritionInstantMicros(nextAt)! > nutritionInstantMicros(at)! || nutritionInstantMicros(nextAt) === nutritionInstantMicros(at) && nextId >= id!))
                throw Error(unavailable);
            for (const raw of response.data.rows) {
                const row = decodeReview(raw, c);
                if (rows.some(o => o.rootId === row.rootId))
                    throw Error(unavailable);
                rows.push(row);
            }
            cursors.add(`${nextAt}:${nextId}`);
            at = nextAt;
            id = nextId;
        }
        throw Error('Der Prüfbestand überschreitet die sicher vollständig lesbare Grenze.');
    }
    catch (cause) {
        return { ok: false, error: cause instanceof Error ? cause.message : unavailable };
    }
}
function nutritionReviewReceipt(v: unknown, p: NutritionReviewPacket): NutritionReviewOriginal | null {
    if (!object(v) || v.requestId !== p.requestId || nutritionStable(v.packet) !== nutritionStable(p))
        return null;
    try {
        const o = decodeReview(v.original, p), e = o.history.at(-1)!;
        return o.revision === p.expectedRevision + 1 && o.careRootId === p.careOriginal.rootId && o.careHeadId === p.careOriginal.headId && o.careFingerprint === p.careOriginal.contentFingerprint && o.careKind === p.careOriginal.kind && e.requestId === p.requestId && e.actorId === p.actorId && e.action === p.action && e.reason === p.reason && e.requiredChange === p.requiredChange && e.rationale === p.rationale && (p.reviewOriginal === null || o.rootId === p.reviewOriginal.rootId && nutritionStable(o.history.slice(0, -1)) === nutritionStable(p.reviewOriginal.history)) ? o : null;
    }
    catch {
        return null;
    }
}
async function reviewOperation(input: NutritionReviewPacket, isCurrent: () => boolean, confirm: boolean): Promise<Result<NutritionReviewOriginal>> {
    const p = structuredClone(input);
    if (!confirm) {
        const issue = nutritionReviewPacketIssue(p);
        if (issue)
            return { ok: false, error: issue, rejected: true };
    }
    let dispatched = false;
    try {
        const guard = await authority({ ...p, isCurrent });
        await guard.check();
        dispatched = !confirm;
        const response: {
            data: unknown;
            error: unknown;
            status?: number;
        } = await withServiceQueryTimeout(guard.db.rpc(confirm ? 'web_confirm_nutrition_review' : 'web_commit_nutrition_review', confirm ? { p_tenant_id: p.tenantId, p_client_id: p.clientId, p_actor_profile_id: p.actorId, p_request_id: p.requestId, p_packet: p } : { p_packet: p }), 'Fachprüfung transaktional sichern oder Quittung lesen', 20000);
        await guard.check();
        if (response.error) {
            const code = object(response.error) ? String(response.error.code ?? '') : '';
            return { ok: false, error: toGermanSupabaseError(response.error as Parameters<typeof toGermanSupabaseError>[0]), ...(!confirm && response.data === null && ['22007', '22008', '22023', '22P02', '23514', '40001', '42501'].includes(code) ? { rejected: true } : { uncertain: true }) };
        }
        const saved = nutritionReviewReceipt(response.data, p);
        return saved ? { ok: true, data: saved } : { ok: false, error: unavailable, uncertain: true };
    }
    catch (cause) {
        return { ok: false, error: cause instanceof Error ? cause.message : unavailable, ...(dispatched || confirm ? { uncertain: true } : { rejected: true }) };
    }
}
export const commitNutritionReview = (p: NutritionReviewPacket, isCurrent: () => boolean) => reviewOperation(p, isCurrent, false);
export const confirmNutritionReview = (p: NutritionReviewPacket, isCurrent: () => boolean) => reviewOperation(p, isCurrent, true);
async function authority(c: Context) {
    const db = dbClient();
    if (!db || !c.isCurrent())
        throw Error(unavailable);
    let token: string | null = null, authUserId: string | null = null;
    const check = async () => {
        if (!c.isCurrent() || dbClient() !== db)
            throw Error(unavailable);
        const session = await db.auth.getSession(), s = session.data.session;
        if (!c.isCurrent() || dbClient() !== db || session.error || !s || !uuid(s.user.id) || authUserId !== null && s.user.id !== authUserId || !s.access_token || s.expires_at !== undefined && s.expires_at * 1000 <= Date.now() || token !== null && s.access_token !== token)
            throw Error(unavailable);
        token = s.access_token;
        authUserId = s.user.id;
        const user = await db.auth.getUser(token);
        if (!c.isCurrent() || dbClient() !== db || user.error || user.data.user?.id !== authUserId)
            throw Error(unavailable);
        const profile = await withServiceQueryTimeout(db.rpc('resolve_current_profile_id', {}), 'Aktuelles internes Profil bestätigen', 20000);
        if (!c.isCurrent() || dbClient() !== db || profile.error || profile.data !== c.actorId)
            throw Error(unavailable);
        const after = await db.auth.getSession();
        if (!c.isCurrent() || dbClient() !== db || after.error || after.data.session?.access_token !== token || after.data.session?.user.id !== authUserId || after.data.session.expires_at !== undefined && after.data.session.expires_at * 1000 <= Date.now())
            throw Error(unavailable);
    };
    await check();
    return { db, check };
}
function decode(v: unknown, c: Pick<Context, 'tenantId' | 'clientId'>): NutritionEliminationOriginal { const issue = nutritionEliminationOriginalIssue(v, c); if (issue)
    throw Error(issue); return structuredClone(v as NutritionEliminationOriginal); }
export async function readNutritionEliminationPrerequisites(c: Context): Promise<Result<NutritionEliminationPrerequisites>> { try {
    const guard = await authority(c);
    const db = guard.db;
    const response: {
        data: unknown;
        error: unknown;
        status?: number;
    } = await withServiceQueryTimeout(db.rpc('web_read_nutrition_elimination_prerequisites', { p_tenant_id: c.tenantId, p_client_id: c.clientId, p_actor_profile_id: c.actorId }), 'Ernährungs- und Ausscheidungsbezüge vollständig laden', 20000);
    await guard.check();
    if (!c.isCurrent() || dbClient() !== db || response.error || !object(response.data) || !Array.isArray(response.data.plans) || response.data.plans.length > 500)
        return { ok: false, error: unavailable };
    const plans = response.data.plans;
    if (plans.some(v => !object(v) || !uuid(v.planVersionId) || !uuid(v.measureId) || !uuid(v.visitId) || !uuid(v.assessmentId) || typeof v.planSnapshotSha256 !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(v.planSnapshotSha256) || !kinds.has(v.kind as NutritionEliminationKind) || typeof v.title !== 'string' || v.title.trim().length < 3 || !instant(v.plannedAt) || nutritionEliminationSourcesIssue(v.sources) || object(v.sources) && object(v.sources.assessment) && v.sources.assessment.id !== v.assessmentId) || new Set(plans.map(v => `${v.planVersionId}:${v.measureId}:${v.visitId}:${v.kind}`)).size !== plans.length)
        return { ok: false, error: unavailable };
    return { ok: true, data: structuredClone({ plans } as NutritionEliminationPrerequisites) };
}
catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : unavailable };
} }
export async function readNutritionEliminationPage(c: Context): Promise<Result<NutritionEliminationOriginal[]>> { try {
    const guard = await authority(c), db = guard.db, rows: NutritionEliminationOriginal[] = [];
    let cursorRecorded: string | null = null, cursorId: string | null = null;
    for (let page = 0; page < 100; page++) {
        const response: {
            data: unknown;
            error: unknown;
            status?: number;
        } = await withServiceQueryTimeout(db.rpc('web_read_nutrition_elimination_page', { p_tenant_id: c.tenantId, p_client_id: c.clientId, p_actor_profile_id: c.actorId, p_cursor_recorded_at: cursorRecorded, p_cursor_id: cursorId, p_page_size: 100 }), 'Ernährungs- und Ausscheidungsverlauf vollständig laden', 20000);
        await guard.check();
        if (!c.isCurrent() || dbClient() !== db || response.error || !object(response.data) || !Array.isArray(response.data.rows) || response.data.rows.length > 100)
            return { ok: false, error: unavailable };
        if (response.data.rows.length === 0)
            return { ok: true, data: rows };
        if (!instant(response.data.nextCursorRecordedAt) || !uuid(response.data.nextCursorId) || cursorRecorded !== null && (nutritionInstantMicros(response.data.nextCursorRecordedAt)! > nutritionInstantMicros(cursorRecorded)! || nutritionInstantMicros(response.data.nextCursorRecordedAt) === nutritionInstantMicros(cursorRecorded) && response.data.nextCursorId >= cursorId!))
            return { ok: false, error: unavailable };
        for (const raw of response.data.rows) {
            const row = decode(raw, c);
            if (rows.some(existing => existing.rootId === row.rootId))
                throw Error(unavailable);
            rows.push(row);
        }
        cursorRecorded = response.data.nextCursorRecordedAt;
        cursorId = response.data.nextCursorId;
    }
    return { ok: false, error: 'Der Verlauf überschreitet die sicher vollständig lesbare Grenze.' };
}
catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : unavailable };
} }
function receipt(v: unknown, p: NutritionEliminationPacket): NutritionEliminationOriginal | null { if (!object(v) || v.requestId !== p.requestId || stable(v.packet) !== stable(p))
    return null; try {
    const o = decode(v.original, p);
    return o.revision === p.expectedRevision + 1 && o.recordedBy === p.actorId && nutritionStable(o.payload) === nutritionStable(p.entry) && (p.original === null || o.rootId === p.original.rootId && nutritionStable(o.history.slice(0, -1)) === nutritionStable(p.original.history)) ? o : null;
}
catch {
    return null;
} }
export async function commitNutritionEliminationPacket(input: NutritionEliminationPacket, isCurrent: () => boolean): Promise<Result<NutritionEliminationOriginal>> { const p = structuredClone(input); const issue = nutritionEliminationPacketIssue(p); if (issue)
    return { ok: false, error: issue, rejected: true }; let dispatched = false; try {
    const c = { tenantId: p.tenantId, clientId: p.clientId, actorId: p.actorId, isCurrent };
    const guard = await authority(c);
    const db = guard.db;
    dispatched = true;
    const response: {
        data: unknown;
        error: unknown;
        status?: number;
    } = await withServiceQueryTimeout(db.rpc('web_commit_nutrition_elimination_packet', { p_packet: structuredClone(p) }), 'Ernährungs- und Ausscheidungspaket transaktional speichern', 20000);
    await guard.check();
    if (!isCurrent() || dbClient() !== db)
        return { ok: false, error: unavailable, uncertain: true };
    if (response.error) {
        const code = object(response.error) ? String(response.error.code ?? '') : '';
        return { ok: false, error: toGermanSupabaseError(response.error as Parameters<typeof toGermanSupabaseError>[0]), ...(response.data === null && ['22007', '22008', '22023', '22P02', '23514', '40001', '42501', 'P0G01', 'P0G02'].includes(code) ? { rejected: true } : { uncertain: true }) };
    }
    const saved = receipt(response.data, p);
    return saved ? { ok: true, data: saved } : { ok: false, error: unavailable, uncertain: true };
}
catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : unavailable, ...(dispatched ? { uncertain: true } : { rejected: true }) };
} }
export async function confirmNutritionEliminationPacket(input: NutritionEliminationPacket, isCurrent: () => boolean): Promise<Result<NutritionEliminationOriginal>> { const p = structuredClone(input); try {
    const c = { tenantId: p.tenantId, clientId: p.clientId, actorId: p.actorId, isCurrent };
    const guard = await authority(c);
    const db = guard.db;
    const response: {
        data: unknown;
        error: unknown;
        status?: number;
    } = await withServiceQueryTimeout(db.rpc('web_confirm_nutrition_elimination_packet', { p_tenant_id: p.tenantId, p_client_id: p.clientId, p_actor_profile_id: p.actorId, p_request_id: p.requestId, p_packet: structuredClone(p) }), 'Unklaren Ausgang anhand nativer Quittung prüfen', 20000);
    await guard.check();
    if (!isCurrent() || dbClient() !== db || response.error)
        return { ok: false, error: unavailable };
    const saved = receipt(response.data, p);
    return saved ? { ok: true, data: saved } : { ok: false, error: unavailable };
}
catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : unavailable };
} }
