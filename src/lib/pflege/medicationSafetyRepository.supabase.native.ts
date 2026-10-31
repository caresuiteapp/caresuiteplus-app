// Generated native presentation from src/lib/pflege/medicationSafetyRepository.supabase.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import { requireCareWorkspaceAuthorityWeb } from "./careWorkspaceAuthority.native.ts";
import { getSupabaseClient } from "../supabase/client.ts";
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import { medicationSafetyOriginalIssue, medicationSafetyPacketIssue, medicationSafetySourcesIssue, type MedicationSafetyEntry, type MedicationSafetyOriginal, type MedicationSafetyPacket, type MedicationSafetySources } from "./medicationSafetyPacket.native.ts";
type Row = Record<string, unknown>;
type Context = {
    tenantId: string;
    clientId: string;
    medicationId: string;
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
export type MedicationSafetyPrerequisites = Readonly<{
    sources: MedicationSafetySources;
    orderDefaults: MedicationSafetyEntry['order'];
}>;
const unavailable = 'Der vollständige Medikations-, Quellen-, Personen- und Bestandsbezug konnte nicht bestätigt werden.';
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
const stable = (v: unknown): string => JSON.stringify(v, (_key, item: unknown) => object(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const text = (v: unknown, min = 0): v is string => typeof v === 'string' && v.trim().length >= min;
async function authority(context: Context) { return requireCareWorkspaceAuthorityWeb(context, dbClient, (request, operation) => withServiceQueryTimeout(Promise.resolve(request), operation, 20000), unavailable); }
function decodeOriginal(v: unknown, c: Pick<Context, 'tenantId' | 'clientId' | 'medicationId'>): MedicationSafetyOriginal { const issue = medicationSafetyOriginalIssue(v, c); if (issue)
    throw Error(issue); return structuredClone(v as MedicationSafetyOriginal); }
function decodeOrderDefaults(v: unknown): MedicationSafetyEntry['order'] { if (!object(v) || !['medicationName', 'activeIngredient', 'strength', 'form', 'dose', 'unit', 'route', 'prescriber', 'validFrom', 'indication', 'maximumDoseUnit'].every(key => typeof v[key] === 'string') || !(v.validUntil === null || typeof v.validUntil === 'string') || typeof v.isPrn !== 'boolean' || !['minimumIntervalMinutes', 'maximumDose', 'maximumPeriodHours'].every(key => v[key] === null || typeof v[key] === 'string'))
    throw Error(unavailable); return structuredClone(v as unknown as MedicationSafetyEntry['order']); }
export async function readMedicationSafetyPrerequisites(c: Context): Promise<Result<MedicationSafetyPrerequisites>> { try {
    const db = await authority(c);
    const response: {
        data: unknown;
        error: unknown;
        status?: number;
    } = await withServiceQueryTimeout(db.rpc('web_read_medication_safety_context', { p_tenant_id: c.tenantId, p_client_id: c.clientId, p_medication_id: c.medicationId, p_actor_profile_id: c.actorId }), 'Medikations-, Quellen-, Personen- und Bestandsbezug vollständig laden', 20000);
    if (!c.isCurrent() || dbClient() !== db || response.error || !object(response.data) || medicationSafetySourcesIssue(response.data.sources))
        return { ok: false, error: unavailable };
    const sources = structuredClone(response.data.sources as MedicationSafetySources), orderDefaults = decodeOrderDefaults(response.data.orderDefaults);
    return { ok: true, data: { sources, orderDefaults } };
}
catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : unavailable };
} }
export async function readMedicationSafetyPage(c: Context): Promise<Result<MedicationSafetyOriginal[]>> { try {
    const db = await authority(c), rows: MedicationSafetyOriginal[] = [];
    let cursorRecorded: string | null = null, cursorId: string | null = null;
    for (let page = 0; page < 100; page++) {
        const response: {
            data: unknown;
            error: unknown;
            status?: number;
        } = await withServiceQueryTimeout(db.rpc('web_read_medication_safety_page', { p_tenant_id: c.tenantId, p_client_id: c.clientId, p_medication_id: c.medicationId, p_actor_profile_id: c.actorId, p_cursor_recorded_at: cursorRecorded, p_cursor_id: cursorId, p_page_size: 100 }), 'Medikationssicherheitsverlauf vollständig laden', 20000);
        if (!c.isCurrent() || dbClient() !== db || response.error || !object(response.data) || !Array.isArray(response.data.rows) || response.data.rows.length > 100)
            return { ok: false, error: unavailable };
        if (response.data.rows.length === 0)
            return { ok: true, data: rows };
        if (typeof response.data.nextCursorRecordedAt !== 'string' || !uuid(response.data.nextCursorId) || response.data.nextCursorRecordedAt === cursorRecorded && response.data.nextCursorId === cursorId)
            return { ok: false, error: unavailable };
        for (const raw of response.data.rows) {
            const row = decodeOriginal(raw, c);
            if (rows.some(existing => existing.id === row.id))
                throw Error(unavailable);
            rows.push(row);
        }
        cursorRecorded = response.data.nextCursorRecordedAt;
        cursorId = response.data.nextCursorId;
    }
    return { ok: false, error: 'Der Medikationsverlauf überschreitet die sicher vollständig lesbare Grenze.' };
}
catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : unavailable };
} }
function receipt(v: unknown, p: MedicationSafetyPacket): MedicationSafetyOriginal | null { if (!object(v) || v.requestId !== p.requestId || stable(v.packet) !== stable(p))
    return null; try {
    return decodeOriginal(v.original, { tenantId: p.tenantId, clientId: p.clientId, medicationId: p.medicationId });
}
catch {
    return null;
} }
export async function commitMedicationSafetyPacket(p: MedicationSafetyPacket, isCurrent: () => boolean): Promise<Result<MedicationSafetyOriginal>> { const captured = structuredClone(p), issue = medicationSafetyPacketIssue(captured); if (issue)
    return { ok: false, error: issue, rejected: true }; let dispatched = false; try {
    const c = { tenantId: captured.tenantId, clientId: captured.clientId, medicationId: captured.medicationId, actorId: captured.actorId, isCurrent };
    const db = await authority(c);
    dispatched = true;
    const response: {
        data: unknown;
        error: unknown;
        status?: number;
    } = await withServiceQueryTimeout(db.rpc('web_commit_medication_safety_packet', { p_packet: captured }), 'Medikationssicherheitspaket transaktional speichern', 20000);
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
export async function confirmMedicationSafetyPacket(p: MedicationSafetyPacket, isCurrent: () => boolean): Promise<Result<MedicationSafetyOriginal>> { const captured = structuredClone(p), issue = medicationSafetyPacketIssue(captured); if (issue)
    return { ok: false, error: issue, rejected: true }; try {
    const c = { tenantId: captured.tenantId, clientId: captured.clientId, medicationId: captured.medicationId, actorId: captured.actorId, isCurrent };
    const db = await authority(c);
    const response: {
        data: unknown;
        error: unknown;
        status?: number;
    } = await withServiceQueryTimeout(db.rpc('web_confirm_medication_safety_packet', { p_tenant_id: captured.tenantId, p_client_id: captured.clientId, p_medication_id: captured.medicationId, p_actor_profile_id: captured.actorId, p_request_id: captured.requestId, p_packet: captured }), 'Unklaren Medikationsausgang anhand nativer Quittung prüfen', 20000);
    if (!isCurrent() || dbClient() !== db || response.error)
        return { ok: false, error: unavailable };
    const saved = receipt(response.data, captured);
    return saved ? { ok: true, data: saved } : { ok: false, error: unavailable };
}
catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : unavailable };
} }
