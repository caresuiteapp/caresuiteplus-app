// Generated native presentation from src/lib/pflege/treatmentCareRepository.supabase.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import { cloneClientNativeOriginal } from "../clients/clientRecordNativeOriginal.native.ts";
import { requireCareWorkspaceAuthorityWeb } from "./careWorkspaceAuthority.native.ts";
import { getSupabaseClient } from "../supabase/client.ts";
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import { treatmentCareOriginalIssue, treatmentCarePacketIssue, treatmentCareSourcesIssue, type TreatmentCareOriginal, type TreatmentCarePacket, type TreatmentCareSources } from "./treatmentCarePacket.native.ts";
import { treatmentReviewInstantMicros } from "./treatmentCareReview.native.ts";
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
const unavailable = 'Der vollständige Verordnungs-, Kostenträger-, Behandlungs-, Mess-, Infusions-, Personen- und Korrekturbezug konnte nicht bestätigt werden.';
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
const stable = (v: unknown) => JSON.stringify(v, (_key, item: unknown) => object(item) ? Object.fromEntries(Object.keys(item).sort().map(k => [k, item[k]])) : item);
async function authority(context: Context) { return requireCareWorkspaceAuthorityWeb(context, dbClient, (request, operation) => withServiceQueryTimeout(Promise.resolve(request), operation, 20000), unavailable); }
async function readAuthority(context: Context) {
    const db = dbClient(), owner = { tenantId: context.tenantId, clientId: context.clientId, actorId: context.actorId, current: context.isCurrent };
    let sessionOwner: string | null = null;
    if (!db)
        throw Error(unavailable);
    const current = () => { if (context.tenantId !== owner.tenantId || context.clientId !== owner.clientId || context.actorId !== owner.actorId || context.isCurrent !== owner.current || owner.current() !== true || dbClient() !== db)
        throw Error(unavailable); };
    const scope = { tenantId: owner.tenantId, clientId: owner.clientId, actorId: owner.actorId, isCurrent: () => { try {
            current();
            return true;
        }
        catch {
            return false;
        } } };
    const session = async () => { const result = cloneClientNativeOriginal(await db.auth.getSession()); current(); const value = result.data.session; if (result.error || !value || !uuid(value.user.id) || !value.access_token || typeof value.expires_at !== 'number' || !Number.isFinite(value.expires_at) || value.expires_at * 1000 <= Date.now())
        throw Error(unavailable); return JSON.stringify([value.user.id, value.access_token, value.expires_at]); };
    const check = async () => { current(); const before = await session(); if (sessionOwner !== null && before !== sessionOwner)
        throw Error(unavailable); if (await authority(scope) !== db)
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
function decodeOriginal(v: unknown, c: {
    tenantId: string;
    clientId: string;
    orderId: string;
}) { const issue = treatmentCareOriginalIssue(v, c); if (issue)
    throw Error(issue); return structuredClone(v as TreatmentCareOriginal); }
export async function readTreatmentCareSources(c: Context): Promise<Result<TreatmentCareSources>> { try {
    const db = await authority(c);
    const response: {
        data: unknown;
        error: unknown;
        status?: number;
    } = cloneClientNativeOriginal(await withServiceQueryTimeout(db.rpc('web_read_treatment_care_context', { p_tenant_id: c.tenantId, p_client_id: c.clientId, p_actor_profile_id: c.actorId }), 'Behandlungspflegequellen vollständig laden', 20000));
    if (!c.isCurrent() || dbClient() !== db || response.error || treatmentCareSourcesIssue(response.data))
        return { ok: false, error: unavailable };
    return { ok: true, data: structuredClone(response.data as TreatmentCareSources) };
}
catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : unavailable };
} }
export async function readTreatmentCarePage(c: Context): Promise<Result<TreatmentCareOriginal[]>> {
    try {
        const guard = await readAuthority(c), rows: TreatmentCareOriginal[] = [], roots = new Set<string>();
        let recorded: string | null = null, id: string | null = null, stateFingerprint = '', head: unknown = null;
        const read = async (at: string | null, cursor: string | null) => { await guard.check(); const response = cloneClientNativeOriginal(await withServiceQueryTimeout(guard.db.rpc('web_read_treatment_care_page', { p_tenant_id: guard.scope.tenantId, p_client_id: guard.scope.clientId, p_actor_profile_id: guard.scope.actorId, p_cursor_recorded_at: at, p_cursor_id: cursor, p_page_size: 100 }), 'Behandlungspflegeverlauf vollständig laden', 20000)); await guard.check(); if (response.error)
            throw Error(unavailable); return historyPage(response.data); };
        for (let page = 0; page < 100; page++) {
            const data = await read(recorded, id);
            if (stateFingerprint && data.stateFingerprint !== stateFingerprint)
                throw Error('Behandlungspflege oder native Quellen wurden während des Ladens geändert. Neu laden.');
            stateFingerprint = data.stateFingerprint;
            if (head === null)
                head = structuredClone(data);
            if (data.rows.length === 0) {
                if (data.nextCursorRecordedAt !== null || data.nextCursorId !== null)
                    throw Error(unavailable);
                const latest = await read(null, null);
                if (stable(latest) !== stable(head))
                    throw Error('Der vollständige Behandlungspflegestand wurde während des Ladens geändert. Neu laden.');
                return { ok: true, data: rows };
            }
            let previous = recorded === null ? null : { at: treatmentReviewInstantMicros(recorded)!, id: id!.toLowerCase() };
            for (const raw of data.rows) {
                if (!object(raw) || !uuid(raw.orderId))
                    throw Error(unavailable);
                const row = decodeOriginal(raw, { tenantId: guard.scope.tenantId, clientId: guard.scope.clientId, orderId: raw.orderId }), instant = treatmentReviewInstantMicros(row.recordedAt);
                if (instant === null)
                    throw Error(unavailable);
                const position = { at: instant, id: row.id.toLowerCase() };
                if (roots.has(row.rootId.toLowerCase()) || previous && (position.at > previous.at || position.at === previous.at && position.id >= previous.id))
                    throw Error(unavailable);
                roots.add(row.rootId.toLowerCase());
                rows.push(row);
                previous = position;
            }
            if (!previous || !uuid(data.nextCursorId) || typeof data.nextCursorRecordedAt !== 'string' || treatmentReviewInstantMicros(data.nextCursorRecordedAt) !== previous.at || data.nextCursorId.toLowerCase() !== previous.id)
                throw Error(unavailable);
            recorded = data.nextCursorRecordedAt;
            id = data.nextCursorId;
        }
        throw Error('Der Behandlungspflegeverlauf überschreitet die sicher vollständig lesbare Grenze.');
    }
    catch (cause) {
        return { ok: false, error: cause instanceof Error ? cause.message : unavailable };
    }
}
function receipt(value: unknown, p: TreatmentCarePacket): TreatmentCareOriginal | null {
    try {
        const v = cloneClientNativeOriginal(value);
        if (!object(v) || v.requestId !== p.requestId || stable(v.packet) !== stable(p))
            return null;
        const saved = decodeOriginal(v.original, p), last = saved.history.at(-1)!;
        if (saved.voided || saved.revision !== p.expectedRevision + 1 || last.previousId !== p.expectedHeadId || last.recordedBy !== p.actorId || last.reason !== p.reason || stable(last.payload) !== stable(p.entry))
            return null;
        if (p.original) {
            if (saved.rootId !== p.original.rootId || stable(saved.history.slice(0, -1)) !== stable(p.original.history))
                return null;
        }
        else if (saved.rootId !== saved.headId || saved.history.length !== 1)
            return null;
        return saved;
    }
    catch {
        return null;
    }
}
export async function commitTreatmentCarePacket(p: TreatmentCarePacket, isCurrent: () => boolean): Promise<Result<TreatmentCareOriginal>> { const captured = structuredClone(p), issue = treatmentCarePacketIssue(captured); if (issue)
    return { ok: false, error: issue, rejected: true }; let dispatched = false; try {
    const c = { tenantId: captured.tenantId, clientId: captured.clientId, actorId: captured.actorId, isCurrent };
    const db = await authority(c);
    dispatched = true;
    const response: {
        data: unknown;
        error: unknown;
        status?: number;
    } = cloneClientNativeOriginal(await withServiceQueryTimeout(db.rpc('web_commit_treatment_care_packet', { p_packet: captured }), 'Behandlungspflegepaket transaktional speichern', 20000));
    if (!isCurrent() || dbClient() !== db)
        return { ok: false, error: unavailable, uncertain: true };
    if (response.error) {
        const code = object(response.error) ? String(response.error.code ?? '') : '';
        return { ok: false, error: toGermanSupabaseError(response.error as Parameters<typeof toGermanSupabaseError>[0]), ...(response.data === null && ['22007', '22008', '22023', '22P02', '23514', '40001', '42501', 'P0H01', 'P0H02'].includes(code) ? { rejected: true } : { uncertain: true }) };
    }
    const saved = receipt(response.data, captured);
    return saved ? { ok: true, data: saved } : { ok: false, error: unavailable, uncertain: true };
}
catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : unavailable, uncertain: dispatched };
} }
export async function confirmTreatmentCarePacket(p: TreatmentCarePacket, isCurrent: () => boolean): Promise<Result<TreatmentCareOriginal>> { const captured = structuredClone(p), issue = treatmentCarePacketIssue(captured); if (issue)
    return { ok: false, error: issue, rejected: true }; try {
    const c = { tenantId: captured.tenantId, clientId: captured.clientId, actorId: captured.actorId, isCurrent };
    const db = await authority(c);
    const response: {
        data: unknown;
        error: unknown;
        status?: number;
    } = cloneClientNativeOriginal(await withServiceQueryTimeout(db.rpc('web_confirm_treatment_care_packet', { p_tenant_id: captured.tenantId, p_client_id: captured.clientId, p_order_id: captured.orderId, p_actor_profile_id: captured.actorId, p_request_id: captured.requestId, p_packet: captured }), 'Unklaren Behandlungspflegeausgang anhand nativer Quittung prüfen', 20000));
    if (!c.isCurrent() || dbClient() !== db || response.error)
        return { ok: false, error: unavailable };
    const saved = receipt(response.data, captured);
    return saved ? { ok: true, data: saved } : { ok: false, error: unavailable };
}
catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : unavailable };
} }
