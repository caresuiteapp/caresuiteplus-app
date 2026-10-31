// Generated native presentation from src/lib/pflege/respiratoryCareReviewRepository.supabase.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import { getSupabaseClient } from "../supabase/client.ts";
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import { respiratoryCareReviewInstantMicros, respiratoryCareReviewStable, respiratoryCareReviewOriginalIssue, respiratoryCareReviewPacketIssue, type RespiratoryCareReviewOriginal, type RespiratoryCareReviewPacket } from "./respiratoryCareReview.native.ts";
type Row = Record<string, unknown>;
type Context = {
    tenantId: string;
    clientId: string;
    measurementId: string;
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
const unavailable = 'Der vollstaendige Atemfachpruefbestand konnte nicht bestaetigt werden.';
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
async function authority(c: Context) {
    const db = dbClient();
    if (!db || !c.isCurrent())
        throw Error(unavailable);
    let token: string | null = null, authUserId: string | null = null;
    const check = async () => { if (!c.isCurrent() || dbClient() !== db)
        throw Error(unavailable); const session = await db.auth.getSession(), s = session.data.session; if (!c.isCurrent() || dbClient() !== db || session.error || !s || !uuid(s.user.id) || authUserId !== null && s.user.id !== authUserId || !s.access_token || s.expires_at !== undefined && s.expires_at * 1000 <= Date.now() || token !== null && s.access_token !== token)
        throw Error(unavailable); token = s.access_token; authUserId = s.user.id; const user = await db.auth.getUser(token); if (!c.isCurrent() || dbClient() !== db || user.error || user.data.user?.id !== authUserId)
        throw Error(unavailable); const profile = await withServiceQueryTimeout(db.rpc('resolve_current_profile_id', {}), 'Aktuelles internes Profil bestaetigen', 20000); if (!c.isCurrent() || dbClient() !== db || profile.error || profile.data !== c.actorId)
        throw Error(unavailable); const after = await db.auth.getSession(); if (!c.isCurrent() || dbClient() !== db || after.error || after.data.session?.access_token !== token || after.data.session?.user.id !== authUserId || after.data.session.expires_at !== undefined && after.data.session.expires_at * 1000 <= Date.now())
        throw Error(unavailable); };
    await check();
    return { db, check };
}
function decode(v: unknown, c: Pick<Context, 'tenantId' | 'clientId' | 'measurementId'>): RespiratoryCareReviewOriginal { const issue = respiratoryCareReviewOriginalIssue(v, c); if (issue)
    throw Error(issue); return structuredClone(v as RespiratoryCareReviewOriginal); }
export async function readRespiratoryCareReviewPage(c: Context): Promise<Result<RespiratoryCareReviewOriginal[]>> {
    try {
        const guard = await authority(c), rows: RespiratoryCareReviewOriginal[] = [], cursors = new Set<string>();
        let at: string | null = null, id: string | null = null;
        for (let page = 0; page < 100; page++) {
            await guard.check();
            const response: {
                data: unknown;
                error: unknown;
                status?: number;
            } = await withServiceQueryTimeout(guard.db.rpc('web_read_respiratory_care_review_page', { p_tenant_id: c.tenantId, p_client_id: c.clientId, p_measurement_id: c.measurementId, p_actor_profile_id: c.actorId, p_cursor_recorded_at: at, p_cursor_id: id, p_page_size: 100 }), 'Atemfachpruefungen vollstaendig laden', 20000);
            await guard.check();
            if (response.error || !object(response.data) || !Array.isArray(response.data.rows) || response.data.rows.length > 100)
                throw Error(unavailable);
            if (response.data.rows.length === 0)
                return { ok: true, data: rows };
            const nextAt = response.data.nextCursorRecordedAt, nextId = response.data.nextCursorId;
            if (respiratoryCareReviewInstantMicros(nextAt) === null || !uuid(nextId) || cursors.has(`${nextAt}:${nextId}`) || at !== null && (respiratoryCareReviewInstantMicros(nextAt)! > respiratoryCareReviewInstantMicros(at)! || respiratoryCareReviewInstantMicros(nextAt) === respiratoryCareReviewInstantMicros(at) && nextId >= id!))
                throw Error(unavailable);
            for (const raw of response.data.rows) {
                const row = decode(raw, c);
                if (rows.some(o => o.rootId === row.rootId))
                    throw Error(unavailable);
                rows.push(row);
            }
            cursors.add(`${nextAt}:${nextId}`);
            at = nextAt as string;
            id = nextId;
        }
        throw Error('Der Atemfachpruefbestand ueberschreitet die sicher vollstaendig lesbare Grenze.');
    }
    catch (cause) {
        return { ok: false, error: cause instanceof Error ? cause.message : unavailable };
    }
}
function receipt(v: unknown, p: RespiratoryCareReviewPacket): RespiratoryCareReviewOriginal | null {
    if (!object(v) || v.requestId !== p.requestId || respiratoryCareReviewStable(v.packet) !== respiratoryCareReviewStable(p))
        return null;
    try {
        const o = decode(v, p), e = o.history.at(-1)!;
        return o.revision === p.expectedRevision + 1 && o.careRootId === p.careOriginal.rootId && o.careHeadId === p.careOriginal.headId && o.careFingerprint === p.careOriginal.contentFingerprint && o.careKind === p.careOriginal.kind && e.requestId === p.requestId && e.actorId === p.actorId && e.action === p.action && e.reason === p.reason && e.requiredChange === p.requiredChange && e.rationale === p.rationale && (p.reviewOriginal === null || o.rootId === p.reviewOriginal.rootId && respiratoryCareReviewStable(o.history.slice(0, -1)) === respiratoryCareReviewStable(p.reviewOriginal.history)) ? o : null;
    }
    catch {
        return null;
    }
}
async function operation(input: RespiratoryCareReviewPacket, isCurrent: () => boolean, confirm: boolean): Promise<Result<RespiratoryCareReviewOriginal>> {
    const p = structuredClone(input);
    if (!confirm) {
        const issue = respiratoryCareReviewPacketIssue(p);
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
        } = await withServiceQueryTimeout(guard.db.rpc(confirm ? 'web_confirm_respiratory_care_review' : 'web_commit_respiratory_care_review', confirm ? { p_tenant_id: p.tenantId, p_client_id: p.clientId, p_measurement_id: p.measurementId, p_actor_profile_id: p.actorId, p_request_id: p.requestId, p_packet: p } : { p_packet: p }), 'Atemfachpruefung transaktional sichern oder Quittung lesen', 20000);
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
    }
}
export const commitRespiratoryCareReview = (p: RespiratoryCareReviewPacket, isCurrent: () => boolean) => operation(p, isCurrent, false);
export const confirmRespiratoryCareReview = (p: RespiratoryCareReviewPacket, isCurrent: () => boolean) => operation(p, isCurrent, true);
