// Generated native presentation from src/lib/pflege/woundPathReviewRepository.supabase.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import { cloneClientNativeOriginal } from "../clients/clientRecordNativeOriginal.native.ts";
import { getSupabaseClient } from "../supabase/client.ts";
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import { woundPathReviewInstantMicros, woundPathReviewStable, woundPathReviewOriginalIssue, woundPathReviewPacketIssue, type WoundPathReviewOriginal, type WoundPathReviewPacket } from "./woundPathReview.native.ts";
type Row = Record<string, unknown>;
type Context = {
    tenantId: string;
    clientId: string;
    woundId: string;
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
const unavailable = 'Der vollständige Wundversorgungprüfbestand konnte nicht bestätigt werden.';
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
    throw Error(unavailable); const session = await db.auth.getSession(), s = session.data.session; if (!c.isCurrent() || dbClient() !== db || session.error || !s || !uuid(s.user.id) || authUserId !== null && s.user.id !== authUserId || !s.access_token || s.expires_at !== undefined && s.expires_at * 1000 <= Date.now() || token !== null && s.access_token !== token)
    throw Error(unavailable); token = s.access_token; authUserId = s.user.id; const user = await db.auth.getUser(token); if (!c.isCurrent() || dbClient() !== db || user.error || user.data.user?.id !== authUserId)
    throw Error(unavailable); const profile = await withServiceQueryTimeout(db.rpc('resolve_current_profile_id', {}), 'Aktuelles internes Profil bestätigen', 20000); if (!c.isCurrent() || dbClient() !== db || profile.error || profile.data !== c.actorId)
    throw Error(unavailable); const after = await db.auth.getSession(); if (!c.isCurrent() || dbClient() !== db || after.error || after.data.session?.access_token !== token || after.data.session?.user.id !== authUserId || after.data.session.expires_at !== undefined && after.data.session.expires_at * 1000 <= Date.now())
    throw Error(unavailable); }; await check(); return { db, check }; }
function decode(v: unknown, c: Pick<Context, 'tenantId' | 'clientId' | 'woundId'>): WoundPathReviewOriginal { const issue = woundPathReviewOriginalIssue(v, c); if (issue)
    throw Error(issue); return structuredClone(v as WoundPathReviewOriginal); }
/** A live decision on any older root invalidates the complete paginated read. */
export async function readWoundPathReviewPage(c: Context): Promise<Result<WoundPathReviewOriginal[]>> {
    try {
        const guard = await authority(c), rows: WoundPathReviewOriginal[] = [], cursors = new Set<string>();
        let at: string | null = null, id: string | null = null, stateFingerprint: string | null = null, firstPage: string | null = null;
        const read = async (cursorAt: string | null, cursorId: string | null) => {
            await guard.check();
            const response: {
                data: unknown;
                error: unknown;
                status?: number;
            } = await withServiceQueryTimeout(guard.db.rpc('web_read_wound_path_review_page', { p_tenant_id: c.tenantId, p_client_id: c.clientId, p_wound_id: c.woundId, p_actor_profile_id: c.actorId, p_cursor_recorded_at: cursorAt, p_cursor_id: cursorId, p_page_size: 100 }), 'Wundfachprüfungen vollständig laden', 20000);
            await guard.check();
            const data = response.data;
            if (response.error || !object(data) || !Array.isArray(data.rows) || data.rows.length > 100 || typeof data.stateFingerprint !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(data.stateFingerprint) || stateFingerprint !== null && data.stateFingerprint !== stateFingerprint)
                throw Error(unavailable);
            stateFingerprint = data.stateFingerprint;
            if (data.rows.length === 0) {
                if (data.nextCursorRecordedAt !== null || data.nextCursorId !== null)
                    throw Error(unavailable);
            }
            else if (woundPathReviewInstantMicros(data.nextCursorRecordedAt) === null || !uuid(data.nextCursorId))
                throw Error(unavailable);
            return data;
        };
        for (let page = 0; page < 100; page++) {
            const data = await read(at, id);
            if (firstPage === null)
                firstPage = woundPathReviewStable(data);
            if ((data.rows as unknown[]).length === 0) {
                if (woundPathReviewStable(await read(null, null)) !== firstPage)
                    throw Error(unavailable);
                return { ok: true, data: rows };
            }
            const nextAt = data.nextCursorRecordedAt as string, nextId = data.nextCursorId as string, key = `${nextAt}:${nextId}`;
            if (cursors.has(key) || at !== null && (woundPathReviewInstantMicros(nextAt)! > woundPathReviewInstantMicros(at)! || woundPathReviewInstantMicros(nextAt) === woundPathReviewInstantMicros(at) && nextId >= id!))
                throw Error(unavailable);
            for (const raw of data.rows as unknown[]) {
                const row = decode(raw, c);
                if (rows.some(o => o.rootId === row.rootId))
                    throw Error(unavailable);
                rows.push(row);
            }
            cursors.add(key);
            at = nextAt;
            id = nextId;
        }
        throw Error('Der Wundfachprüfbestand überschreitet die sicher vollständig lesbare Grenze.');
    }
    catch (cause) {
        return { ok: false, error: cause instanceof Error ? cause.message : unavailable };
    }
}
function receipt(v: unknown, p: WoundPathReviewPacket): WoundPathReviewOriginal | null { if (!object(v) || v.requestId !== p.requestId || woundPathReviewStable(v.packet) !== woundPathReviewStable(p))
    return null; try {
    const o = decode(v.original, p), e = o.history.at(-1)!;
    return o.revision === p.expectedRevision + 1 && o.woundRootId === p.woundOriginal.rootId && o.woundHeadId === p.woundOriginal.headId && o.woundFingerprint === p.woundOriginal.contentFingerprint && o.woundKind === p.woundOriginal.kind && e.requestId === p.requestId && e.actorId === p.actorId && e.action === p.action && e.reason === p.reason && e.requiredChange === p.requiredChange && e.rationale === p.rationale && (p.reviewOriginal === null || o.rootId === p.reviewOriginal.rootId && woundPathReviewStable(o.history.slice(0, -1)) === woundPathReviewStable(p.reviewOriginal.history)) ? o : null;
}
catch {
    return null;
} }
async function operation(input: WoundPathReviewPacket, isCurrent: () => boolean, confirm: boolean): Promise<Result<WoundPathReviewOriginal>> { const p = structuredClone(input); if (!confirm) {
    const issue = woundPathReviewPacketIssue(p);
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
    } = cloneClientNativeOriginal(await withServiceQueryTimeout(guard.db.rpc(confirm ? 'web_confirm_wound_path_review' : 'web_commit_wound_path_review', confirm ? { p_tenant_id: p.tenantId, p_client_id: p.clientId, p_wound_id: p.woundId, p_actor_profile_id: p.actorId, p_request_id: p.requestId, p_packet: p } : { p_packet: p }), 'Wundfachprüfung transaktional sichern oder Quittung lesen', 20000));
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
export const commitWoundPathReview = (p: WoundPathReviewPacket, isCurrent: () => boolean) => operation(p, isCurrent, false);
export const confirmWoundPathReview = (p: WoundPathReviewPacket, isCurrent: () => boolean) => operation(p, isCurrent, true);
