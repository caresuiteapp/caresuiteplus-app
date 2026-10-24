// Generated native presentation from src/lib/clients/clientFinancingWorkspaceReviewRepository.supabase.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import { getSupabaseClient } from "../supabase/client.ts";
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import { clientFinancingReviewInstantMicros, clientFinancingReviewOriginalIssue, clientFinancingReviewPacketIssue, clientFinancingReviewStable, type ClientFinancingReviewOriginal, type ClientFinancingReviewPacket } from "./clientFinancingWorkspaceReview.native.ts";
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
const unavailable = 'Der vollständige Vertrags- und Finanzierungsprüfbestand konnte nicht bestätigt werden.';
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
function decode(v: unknown, c: Pick<Context, 'tenantId' | 'clientId'>): ClientFinancingReviewOriginal { const issue = clientFinancingReviewOriginalIssue(v, c); if (issue)
    throw Error(issue); return structuredClone(v as ClientFinancingReviewOriginal); }
export async function readClientFinancingReviewPage(c: Context): Promise<Result<ClientFinancingReviewOriginal[]>> { try {
    const guard = await authority(c), rows: ClientFinancingReviewOriginal[] = [], cursors = new Set<string>();
    let at: string | null = null, id: string | null = null;
    for (let page = 0; page < 100; page++) {
        await guard.check();
        const response: {
            data: unknown;
            error: unknown;
            status?: number;
        } = await withServiceQueryTimeout(guard.db.rpc('web_read_client_financing_review_page', { p_tenant_id: c.tenantId, p_client_id: c.clientId, p_actor_profile_id: c.actorId, p_cursor_recorded_at: at, p_cursor_id: id, p_page_size: 100 }), 'Vertrags- und Finanzierungsfachprüfungen vollständig laden', 20000);
        await guard.check();
        if (response.error || !object(response.data) || !Array.isArray(response.data.rows) || response.data.rows.length > 100)
            throw Error(unavailable);
        if (!response.data.rows.length)
            return { ok: true, data: rows };
        const nextAt = response.data.nextCursorRecordedAt, nextId = response.data.nextCursorId;
        if (typeof nextAt !== 'string' || clientFinancingReviewInstantMicros(nextAt) === null || !uuid(nextId) || cursors.has(`${nextAt}:${nextId}`) || at !== null && (clientFinancingReviewInstantMicros(nextAt)! > clientFinancingReviewInstantMicros(at)! || clientFinancingReviewInstantMicros(nextAt) === clientFinancingReviewInstantMicros(at) && nextId >= id!))
            throw Error(unavailable);
        for (const raw of response.data.rows) {
            const row = decode(raw, c);
            if (rows.some(o => o.rootId === row.rootId))
                throw Error(unavailable);
            rows.push(row);
        }
        cursors.add(`${nextAt}:${nextId}`);
        at = nextAt;
        id = nextId;
    }
    throw Error('Der Vertrags- und Finanzierungsprüfbestand überschreitet die sicher vollständig lesbare Grenze.');
}
catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : unavailable };
} }
function receipt(v: unknown, p: ClientFinancingReviewPacket): ClientFinancingReviewOriginal | null { if (!object(v) || v.requestId !== p.requestId || clientFinancingReviewStable(v.packet) !== clientFinancingReviewStable(p))
    return null; try {
    const o = decode(v.original, p), e = o.history.at(-1)!;
    return o.revision === p.expectedRevision + 1 && o.financingHeadId === p.financingOriginal.history.headId && e.requestId === p.requestId && e.actorId === p.actorId && e.action === p.action && e.reason === p.reason && e.requiredChange === p.requiredChange && e.rationale === p.rationale && (p.reviewOriginal === null || o.rootId === p.reviewOriginal.rootId && clientFinancingReviewStable(o.history.slice(0, -1)) === clientFinancingReviewStable(p.reviewOriginal.history)) ? o : null;
}
catch {
    return null;
} }
async function operation(input: ClientFinancingReviewPacket, isCurrent: () => boolean, confirm: boolean): Promise<Result<ClientFinancingReviewOriginal>> { const p = structuredClone(input); if (!confirm) {
    const issue = clientFinancingReviewPacketIssue(p);
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
    } = await withServiceQueryTimeout(guard.db.rpc(confirm ? 'web_confirm_client_financing_review' : 'web_commit_client_financing_review', confirm ? { p_tenant_id: p.tenantId, p_client_id: p.clientId, p_actor_profile_id: p.actorId, p_request_id: p.requestId, p_packet: p } : { p_packet: p }), 'Vertrags- und Finanzierungsfachprüfung transaktional sichern oder Quittung lesen', 20000);
    await guard.check();
    if (response.error) {
        const code = object(response.error) ? String(response.error.code ?? '') : '';
        return { ok: false, error: toGermanSupabaseError(response.error as Parameters<typeof toGermanSupabaseError>[0]), ...(!confirm && response.data === null && ['22007', '22008', '22023', '22P02', '23505', '23514', '42501', 'P0S01'].includes(code) ? { rejected: true } : { uncertain: true }) };
    }
    const saved = receipt(response.data, p);
    return saved ? { ok: true, data: saved } : { ok: false, error: unavailable, uncertain: true };
}
catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : unavailable, ...(dispatched || confirm ? { uncertain: true } : { rejected: true }) };
} }
export const commitClientFinancingReview = (p: ClientFinancingReviewPacket, current: () => boolean) => operation(p, current, false);
export const confirmClientFinancingReview = (p: ClientFinancingReviewPacket, current: () => boolean) => operation(p, current, true);
async function authority(c: Context) { const db = dbClient(); if (!db || !c.isCurrent())
    throw Error(unavailable); let token: string | null = null, userId: string | null = null; const check = async () => { if (!c.isCurrent() || dbClient() !== db)
    throw Error(unavailable); const session = await db.auth.getSession(), s = session.data.session; if (!c.isCurrent() || dbClient() !== db || session.error || !s || !uuid(s.user.id) || userId !== null && s.user.id !== userId || !s.access_token || s.expires_at !== undefined && s.expires_at * 1000 <= Date.now() || token !== null && s.access_token !== token)
    throw Error(unavailable); token = s.access_token; userId = s.user.id; const user = await db.auth.getUser(token); if (!c.isCurrent() || dbClient() !== db || user.error || user.data.user?.id !== userId)
    throw Error(unavailable); const profile = await withServiceQueryTimeout(db.rpc('resolve_current_profile_id', {}), 'Aktuelles internes Profil bestätigen', 20000); if (!c.isCurrent() || dbClient() !== db || profile.error || profile.data !== c.actorId)
    throw Error(unavailable); const after = await db.auth.getSession(); if (!c.isCurrent() || dbClient() !== db || after.error || after.data.session?.access_token !== token || after.data.session?.user.id !== userId || after.data.session.expires_at !== undefined && after.data.session.expires_at * 1000 <= Date.now())
    throw Error(unavailable); }; await check(); return { db, check }; }
