// Generated native presentation from src/lib/careAssessment/counselingCoordinationRepository.supabase.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import { getSupabaseClient } from "../supabase/client.ts";
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import { counselingCoordinationOriginalIssue, counselingCoordinationPacketIssue, counselingCoordinationSourcesIssue, type CounselingCoordinationOriginal, type CounselingCoordinationPacket, type CounselingCoordinationSources } from "./counselingCoordinationPath.native.ts";
type Row = Record<string, unknown>;
type Context = {
    tenantId: string;
    clientId: string;
    assessmentId: string;
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
const unavailable = 'Der vollständige aktuelle Beratungs-, Dokument-, Einwilligungs-, Verordnungs-, Kontakt-, Kommunikations- und Versorgungsbezug konnte nicht bestätigt werden.';
const object = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v);
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const stable = (v: unknown) => JSON.stringify(v, (_k, item: unknown) => object(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
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
    throw Error(unavailable); const session = await db.auth.getSession(); if (!c.isCurrent() || session.error || !session.data.session || session.data.session.user.id !== c.actorId || session.data.session.expires_at !== undefined && session.data.session.expires_at * 1000 <= Date.now())
    throw Error(unavailable); const user = await db.auth.getUser(session.data.session.access_token); if (!c.isCurrent() || user.error || user.data.user?.id !== c.actorId || dbClient() !== db)
    throw Error(unavailable); return db; }
const decode = (v: unknown, c: Pick<Context, 'tenantId' | 'clientId' | 'assessmentId'>) => { const issue = counselingCoordinationOriginalIssue(v, c); if (issue)
    throw Error(issue); return structuredClone(v as CounselingCoordinationOriginal); };
export async function readCounselingCoordinationSources(c: Context): Promise<Result<CounselingCoordinationSources>> { try {
    const db = await authority(c), response: {
        data: unknown;
        error: unknown;
        status?: number;
    } = await withServiceQueryTimeout(db.rpc('web_read_counseling_coordination_path_context', { p_tenant_id: c.tenantId, p_client_id: c.clientId, p_assessment_id: c.assessmentId, p_actor_profile_id: c.actorId }), 'Beratungs- und Koordinationsquellen vollständig laden', 20000);
    if (!c.isCurrent() || dbClient() !== db || response.error || counselingCoordinationSourcesIssue(response.data))
        return { ok: false, error: unavailable };
    return { ok: true, data: structuredClone(response.data as CounselingCoordinationSources) };
}
catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : unavailable };
} }
export async function readCounselingCoordinationPage(c: Context): Promise<Result<CounselingCoordinationOriginal[]>> { try {
    const db = await authority(c), rows: CounselingCoordinationOriginal[] = [];
    let recorded: string | null = null, id: string | null = null;
    for (let page = 0; page < 100; page++) {
        const response: {
            data: unknown;
            error: unknown;
            status?: number;
        } = await withServiceQueryTimeout(db.rpc('web_read_counseling_coordination_path_page', { p_tenant_id: c.tenantId, p_client_id: c.clientId, p_assessment_id: c.assessmentId, p_actor_profile_id: c.actorId, p_cursor_recorded_at: recorded, p_cursor_id: id, p_page_size: 100 }), 'Beratungs- und Koordinationsverlauf vollständig laden', 20000);
        if (!c.isCurrent() || dbClient() !== db || response.error || !object(response.data) || !Array.isArray(response.data.rows) || response.data.rows.length > 100)
            return { ok: false, error: unavailable };
        if (response.data.rows.length === 0)
            return { ok: true, data: rows };
        if (typeof response.data.nextCursorRecordedAt !== 'string' || !uuid(response.data.nextCursorId) || response.data.nextCursorRecordedAt === recorded && response.data.nextCursorId === id)
            return { ok: false, error: unavailable };
        for (const raw of response.data.rows) {
            const row = decode(raw, c);
            if (rows.some(x => x.id === row.id))
                throw Error(unavailable);
            rows.push(row);
        }
        recorded = response.data.nextCursorRecordedAt;
        id = response.data.nextCursorId;
    }
    return { ok: false, error: 'Der Verlauf überschreitet die sicher vollständig lesbare Grenze.' };
}
catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : unavailable };
} }
function receipt(v: unknown, p: CounselingCoordinationPacket) { if (!object(v) || v.requestId !== p.requestId || stable(v.packet) !== stable(p))
    return null; try {
    return decode(v.original, p);
}
catch {
    return null;
} }
export async function commitCounselingCoordinationPacket(p: CounselingCoordinationPacket, isCurrent: () => boolean): Promise<Result<CounselingCoordinationOriginal>> { const captured = structuredClone(p), issue = counselingCoordinationPacketIssue(captured); if (issue)
    return { ok: false, error: issue, rejected: true }; let dispatched = false; try {
    const c = { tenantId: p.tenantId, clientId: p.clientId, assessmentId: p.assessmentId, actorId: p.actorId, isCurrent }, db = await authority(c);
    dispatched = true;
    const response: {
        data: unknown;
        error: unknown;
        status?: number;
    } = await withServiceQueryTimeout(db.rpc('web_commit_counseling_coordination_path_packet', { p_packet: captured }), 'Beratungs- und Koordinationspaket transaktional speichern', 20000);
    if (!isCurrent() || dbClient() !== db)
        return { ok: false, error: unavailable, uncertain: true };
    if (response.error) {
        const code = object(response.error) ? String(response.error.code ?? '') : '';
        return { ok: false, error: toGermanSupabaseError(response.error as Parameters<typeof toGermanSupabaseError>[0]), ...(response.data === null && ['22007', '22008', '22023', '22P02', '23514', '40001', '42501'].includes(code) ? { rejected: true } : { uncertain: true }) };
    }
    const saved = receipt(response.data, captured);
    return saved ? { ok: true, data: saved } : { ok: false, error: unavailable, uncertain: true };
}
catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : unavailable, uncertain: dispatched };
} }
export async function confirmCounselingCoordinationPacket(p: CounselingCoordinationPacket, isCurrent: () => boolean): Promise<Result<CounselingCoordinationOriginal>> { const captured = structuredClone(p), issue = counselingCoordinationPacketIssue(captured); if (issue)
    return { ok: false, error: issue, rejected: true }; try {
    const c = { tenantId: p.tenantId, clientId: p.clientId, assessmentId: p.assessmentId, actorId: p.actorId, isCurrent }, db = await authority(c), response: {
        data: unknown;
        error: unknown;
        status?: number;
    } = await withServiceQueryTimeout(db.rpc('web_confirm_counseling_coordination_path_packet', { p_tenant_id: p.tenantId, p_client_id: p.clientId, p_assessment_id: p.assessmentId, p_actor_profile_id: p.actorId, p_request_id: p.requestId, p_packet: captured }), 'Unklaren Ausgang anhand nativer Quittung prüfen', 20000);
    if (!c.isCurrent() || dbClient() !== db || response.error)
        return { ok: false, error: unavailable };
    const saved = receipt(response.data, captured);
    return saved ? { ok: true, data: saved } : { ok: false, error: unavailable };
}
catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : unavailable };
} }
