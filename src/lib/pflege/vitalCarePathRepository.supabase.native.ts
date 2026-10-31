// Generated native presentation from src/lib/pflege/vitalCarePathRepository.supabase.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import { cloneClientNativeOriginal } from "../clients/clientRecordNativeOriginal.native.ts";
import { readCompleteVitalHistoryWeb, readVitalSourcesWithProofWeb } from "./vitalWorkspaceReadProof.native.ts";
import { requireCareWorkspaceAuthorityWeb } from "./careWorkspaceAuthority.native.ts";
import { getSupabaseClient } from "../supabase/client.ts";
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import { vitalCareOriginalIssue, vitalCarePacketIssue, vitalCareSourcesIssue, type VitalCareOriginal, type VitalCarePacket, type VitalCareSources } from "./vitalCarePathPacket.native.ts";
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
const unavailable = 'Der vollständige Messungs-, Grenz-, Geräte-, Kalibrierungs-, Reaktions-, Korrektur-, Personen- und Vitalpfadbezug konnte nicht bestätigt werden.';
const object = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v);
const stable = (v: unknown) => JSON.stringify(v, (_key, item: unknown) => object(item) ? Object.fromEntries(Object.keys(item).sort().map(k => [k, item[k]])) : item);
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
async function authority(context: Context) { return requireCareWorkspaceAuthorityWeb(context, dbClient, (request, operation) => withServiceQueryTimeout(Promise.resolve(request), operation, 20000), unavailable); }
function decode(v: unknown, c: Pick<Context, 'tenantId' | 'clientId' | 'measurementId'>) { const issue = vitalCareOriginalIssue(v, c); if (issue)
    throw Error(issue); return structuredClone(v as VitalCareOriginal); }
async function loadRead(c: Context, db: NonNullable<ReturnType<typeof dbClient>>, name: string, args: Row): Promise<unknown> {
    if (await authority(c) !== db)
        throw Error(unavailable);
    const response = cloneClientNativeOriginal(await withServiceQueryTimeout(db.rpc(name, args), 'Vollständigen aktuellen Vitalbestand laden', 20000));
    if (await authority(c) !== db || response.error)
        throw Error(unavailable);
    return response.data;
}
function sourcesIssue(v: unknown, c: Context): string | null { if (!object(v) || Object.keys(v).sort().join(',') !== 'calibrations,devices,events,followUps,invalidations,measurements,paths,people,settings')
    return unavailable; const issue = vitalCareSourcesIssue(v); if (issue)
    return issue; const sources = v as VitalCareSources; return sources.measurements[0].id !== c.measurementId || Object.values(sources).some(pool => pool.some(ref => ref.tenantId !== c.tenantId || ref.clientId !== c.clientId || ref.measurementId !== c.measurementId)) ? unavailable : null; }
const scopeArgs = (c: Context) => ({ p_tenant_id: c.tenantId, p_client_id: c.clientId, p_measurement_id: c.measurementId, p_actor_profile_id: c.actorId });
export async function readVitalCareSources(input: Context): Promise<Result<VitalCareSources>> {
    const c = { ...input };
    try {
        const db = await authority(c), data = await readVitalSourcesWithProofWeb<VitalCareSources, VitalCareOriginal>(c, () => loadRead(c, db, 'web_read_vital_care_path_page', { ...scopeArgs(c), p_cursor_recorded_at: null, p_cursor_id: null, p_page_size: 1 }), () => loadRead(c, db, 'web_read_vital_care_path_context', scopeArgs(c)), v => decode(v, c), row => ({ at: row.recordedAt, id: row.headId }), v => sourcesIssue(v, c));
        return { ok: true, data };
    }
    catch (cause) {
        return { ok: false, error: cause instanceof Error ? cause.message : unavailable };
    }
}
export async function readVitalCarePage(input: Context): Promise<Result<VitalCareOriginal[]>> {
    const c = { ...input };
    try {
        const db = await authority(c), data = await readCompleteVitalHistoryWeb(c, (at, id) => loadRead(c, db, 'web_read_vital_care_path_page', { ...scopeArgs(c), p_cursor_recorded_at: at, p_cursor_id: id, p_page_size: 100 }), v => decode(v, c), row => ({ at: row.recordedAt, id: row.headId }), row => row.rootId);
        return { ok: true, data };
    }
    catch (cause) {
        return { ok: false, error: cause instanceof Error ? cause.message : unavailable };
    }
}
function receipt(value: unknown, p: VitalCarePacket): VitalCareOriginal | null { try {
    const v = cloneClientNativeOriginal(value);
    if (!object(v) || v.requestId !== p.requestId || stable(v.packet) !== stable(p))
        return null;
    const o = decode(v.original, p), last = o.history.at(-1)!;
    return o.revision === p.expectedRevision + 1 && o.recordedBy === p.actorId && o.kind === p.entry.kind && stable(o.payload) === stable(p.entry) && last.reason === p.reason && (p.original === null ? o.rootId === o.headId : o.rootId === p.original.rootId && last.previousId === p.expectedHeadId && stable(o.history.slice(0, -1)) === stable(p.original.history)) ? o : null;
}
catch {
    return null;
} }
export async function commitVitalCarePacket(p: VitalCarePacket, isCurrent: () => boolean): Promise<Result<VitalCareOriginal>> { const captured = structuredClone(p), issue = vitalCarePacketIssue(captured); if (issue)
    return { ok: false, error: issue, rejected: true }; let dispatched = false; try {
    const c = { tenantId: captured.tenantId, clientId: captured.clientId, measurementId: captured.measurementId, actorId: captured.actorId, isCurrent };
    const db = await authority(c);
    dispatched = true;
    const response: {
        data: unknown;
        error: unknown;
        status?: number;
    } = cloneClientNativeOriginal(await withServiceQueryTimeout(db.rpc('web_commit_vital_care_path_packet', { p_packet: captured }), 'Vitalpfadpaket transaktional speichern', 20000));
    if (!isCurrent() || dbClient() !== db)
        return { ok: false, error: unavailable, uncertain: true };
    if (response.error) {
        const code = object(response.error) ? String(response.error.code ?? '') : '';
        return { ok: false, error: toGermanSupabaseError(response.error as Parameters<typeof toGermanSupabaseError>[0]), ...(response.data === null && ['22007', '22008', '22023', '22P02', '23514', '40001', '42501', 'P0K01', 'P0K02'].includes(code) ? { rejected: true } : { uncertain: true }) };
    }
    const saved = receipt(response.data, captured);
    return saved ? { ok: true, data: saved } : { ok: false, error: unavailable, uncertain: true };
}
catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : unavailable, uncertain: dispatched };
} }
export async function confirmVitalCarePacket(p: VitalCarePacket, isCurrent: () => boolean): Promise<Result<VitalCareOriginal>> { const captured = structuredClone(p), issue = vitalCarePacketIssue(captured); if (issue)
    return { ok: false, error: issue, rejected: true }; try {
    const c = { tenantId: captured.tenantId, clientId: captured.clientId, measurementId: captured.measurementId, actorId: captured.actorId, isCurrent };
    const db = await authority(c), response: {
        data: unknown;
        error: unknown;
        status?: number;
    } = cloneClientNativeOriginal(await withServiceQueryTimeout(db.rpc('web_confirm_vital_care_path_packet', { p_tenant_id: captured.tenantId, p_client_id: captured.clientId, p_measurement_id: captured.measurementId, p_actor_profile_id: captured.actorId, p_request_id: captured.requestId, p_packet: captured }), 'Unklaren Vitalpfadausgang anhand nativer Quittung prüfen', 20000));
    if (!c.isCurrent() || dbClient() !== db || response.error)
        return { ok: false, error: unavailable };
    const saved = receipt(response.data, captured);
    return saved ? { ok: true, data: saved } : { ok: false, error: unavailable };
}
catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : unavailable };
} }
