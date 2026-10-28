// Generated native presentation from src/lib/pflege/medicationAdministrationService.ts. Update through scripts/port-native-workspaces.mjs.
import type { RoleKey, ServiceResult } from '@/types';
import type { MedicationAdministration, MedicationDetail } from '@/types/modules/pflege';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import { getSupabaseClient } from "../supabase/client.ts";
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fetchLiveMedicationDetail } from './medicationLiveService';
import { isMedicationGiven, validateMedicationAdministration, validateMedicationFollowUp, type AdministrationDraft } from './medicationAdministrationDomain';
import { isDefiniteMedicationRejection } from './medicationRequestState';
import { latestActualMedicationInstant } from "./medicationLatestActual.native.ts";
import { loadCompleteMedicationHistory, medicationHistoryFilter } from './medicationHistoryPagination';
import { assessMedicationOrder, type MedicationOrderIntegrity } from './medicationOrderIntegrity';
import { validateMedicationSource, type MedicationSourceDocument, type MedicationSourcePayload } from './medicationSourceDomain';
import { assertMedicationSourceArchive, loadMedicationSourceWithArchive, loadMedicationSourceCandidate, type MedicationSourceDownload, type MedicationSourceFingerprint } from './medicationSourceFile';
import { submitMedicationSourceArchive } from './medicationSourceArchiveRequest';
type Row = Record<string, unknown>;
export type MedicationFollowUp = {
    id: string;
    administrationId: string;
    observedAt: string;
    observation: string;
    action: string;
    painScore: number | null;
    recordedByName: string;
    createdAt: string;
};
export type MedicationEvent = MedicationAdministration & {
    occurredAt: string | null;
    orderSnapshot: Row | null;
    followUps: MedicationFollowUp[];
    recordedById: string | null;
    witnessedById: string | null;
};
export type MedicationStatusEvent = {
    id: string;
    previousStatus: string;
    nextStatus: string;
    reason: string;
    recordedByName: string;
    createdAt: string;
};
export type MedicationDocumentation = Omit<MedicationDetail, 'administrations' | 'status'> & {
    status: MedicationOrderIntegrity['status'];
    integrity: MedicationOrderIntegrity;
    administrations: MedicationEvent[];
    statusEvents: MedicationStatusEvent[];
};
export type MedicationWriteResult = ServiceResult<{
    id: string;
}> & {
    uncertain?: boolean;
};
export type MedicationEventPayload = AdministrationDraft & {
    expectedUpdatedAt: string;
};
export type FollowUpPayload = {
    observedAt: string;
    observation: string;
    action: string;
    painScore: number | null;
};
const text = (v: unknown) => typeof v === 'string' && v.trim() ? v : null;
const score = (v: unknown) => typeof v === 'number' ? v : null;
const unavailable = { ok: false as const, error: 'Die Medikationsdatenbank ist nicht verbunden.' };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// The query is scoped on the server and every returned row is checked again.
type HistoryQuery = ReturnType<ReturnType<typeof fromUnknownTable>['select']>;
async function allRows(client: NonNullable<ReturnType<typeof getSupabaseClient>>, table: string, tenantId: string, scope: (query: HistoryQuery) => HistoryQuery, belongsToScope: (row: Row) => boolean) {
    return loadCompleteMedicationHistory<Row>(async (cursor) => {
        let query = scope(fromUnknownTable(client, table).select('*').eq('tenant_id', tenantId))
            .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(250);
        if (cursor)
            query = query.or(medicationHistoryFilter(cursor));
        const result = await withServiceQueryTimeout(Promise.resolve(query), 'Medikationsverlauf');
        if (result.error)
            throw new Error(toGermanSupabaseError(result.error));
        return result.data;
    }, tenantId, belongsToScope);
}
export async function fetchMedicationDocumentation(id: string, tenantId: string, role?: RoleKey | null): Promise<ServiceResult<MedicationDocumentation>> {
    const denied = enforcePermission<MedicationDocumentation>(role, 'pflege.medications.view') ?? guardServiceTenant(tenantId);
    if (denied)
        return denied;
    const client = getSupabaseClient();
    if (!client || getServiceMode() !== 'supabase')
        return unavailable;
    try {
        const base = await fetchLiveMedicationDetail(id, tenantId, role);
        if (!base.ok)
            return base;
        const raw = await withServiceQueryTimeout(Promise.resolve(fromUnknownTable(client, 'medications').select('*').eq('tenant_id', tenantId).eq('id', id).maybeSingle()), 'Verordnungsgrundlage');
        if (raw.error)
            return { ok: false, error: toGermanSupabaseError(raw.error) };
        if (!raw.data)
            return { ok: false, error: 'Verordnung nicht mehr zugänglich.' };
        const integrity = assessMedicationOrder(raw.data as Row, { id, tenantId, clientId: base.data.clientId, updatedAt: base.data.updatedAt });
        if ((raw.data as Row).tenant_id !== tenantId || (raw.data as Row).client_id !== base.data.clientId || (raw.data as Row).updated_at !== base.data.updatedAt)
            return { ok: false, error: 'Verordnungszuordnung oder Stand geändert. Bitte neu laden.' };
        const [events, statusRows] = await Promise.all([
            allRows(client, 'medication_administrations', tenantId, q => q.eq('medication_id', id), row => row.medication_id === id && row.client_id === base.data.clientId),
            allRows(client, 'medication_order_status_events', tenantId, q => q.eq('medication_id', id), row => row.medication_id === id),
        ]);
        const followUps = new Map<string, MedicationFollowUp[]>();
        for (let i = 0; i < events.length; i += 100) {
            const eventIds = events.slice(i, i + 100).map(e => String(e.id));
            const allowed = new Set(eventIds);
            const rows = await allRows(client, 'medication_administration_followups', tenantId, q => q.in('administration_id', eventIds), row => typeof row.administration_id === 'string' && allowed.has(row.administration_id));
            for (const row of rows) {
                const eventId = String(row.administration_id), values = followUps.get(eventId) ?? [];
                values.push({ id: String(row.id), administrationId: eventId, observedAt: String(row.observed_at), observation: String(row.observation), action: String(row.action), painScore: score(row.pain_score), recordedByName: text(row.recorded_by_name) ?? 'Name nicht verfügbar', createdAt: String(row.created_at) });
                followUps.set(eventId, values);
            }
        }
        const administrations: MedicationEvent[] = events.map(row => ({
            id: String(row.id), tenantId, medicationId: id, clientId: String(row.client_id), status: String(row.status) as MedicationEvent['status'],
            scheduledAt: text(row.scheduled_at), administeredAt: text(row.administered_at), occurredAt: text(row.occurred_at),
            administeredDose: text(row.administered_dose), route: text(row.route), deviationReason: text(row.deviation_reason), prnReason: text(row.prn_reason),
            effectEvaluation: text(row.effect_evaluation), painScoreBefore: score(row.pain_score_before), painScoreAfter: score(row.pain_score_after),
            vitalContext: row.vital_context && typeof row.vital_context === 'object' ? row.vital_context as Row : {}, notes: text(row.notes),
            administeredByName: text(row.recorded_by_name), witnessName: text(row.witnessed_by_name), createdAt: String(row.created_at),
            recordedById: text(row.administered_by), witnessedById: text(row.witnessed_by),
            orderSnapshot: row.order_snapshot && typeof row.order_snapshot === 'object' ? row.order_snapshot as Row : null, followUps: followUps.get(String(row.id)) ?? [],
        }));
        const lastAdministeredAt = latestActualMedicationInstant(administrations);
        return { ok: true, data: { ...base.data, status: integrity.status, route: integrity.route ?? 'Nicht angegeben', integrity, administrations, statusEvents: statusRows.map(row => ({ id: String(row.id), previousStatus: String(row.previous_status), nextStatus: String(row.next_status), reason: String(row.reason), recordedByName: text(row.recorded_by_name) ?? 'Name nicht verfügbar', createdAt: String(row.created_at) })), lastAdministeredAt } };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Medikationsverlauf konnte nicht geladen werden.' };
    }
}
async function write(tenantId: string, role: RoleKey | null | undefined, rpcName: string, args: Record<string, unknown>, permission: 'pflege.medications.administer' | 'pflege.medications.manage' = 'pflege.medications.administer'): Promise<MedicationWriteResult> {
    const denied = enforcePermission<{
        id: string;
    }>(role, permission) ?? guardServiceTenant(tenantId);
    if (denied)
        return denied;
    const client = getSupabaseClient();
    if (!client || getServiceMode() !== 'supabase')
        return unavailable;
    try {
        const rpc = client as unknown as {
            rpc(name: string, args: Record<string, unknown>): Promise<{
                data: unknown;
                error: {
                    code?: string;
                } | null;
                status?: number;
            }>;
        };
        const { data, error, status } = await withServiceQueryTimeout(Promise.resolve(rpc.rpc(rpcName, args)), 'Medikationsdokumentation', 20000);
        if (error)
            return { ok: false, error: toGermanSupabaseError(error), uncertain: !isDefiniteMedicationRejection(error.code, status) };
        if (typeof data !== 'string' || !uuid.test(data))
            return { ok: false, error: 'Das Speicherergebnis ist unklar. Dieselbe Anfrage erneut prüfen.', uncertain: true };
        return { ok: true, data: { id: data } };
    }
    catch {
        return { ok: false, error: 'Die Speicherbestätigung fehlt. Bitte dieselbe unveränderte Anfrage erneut prüfen.', uncertain: true };
    }
}
export async function recordMedicationEvent(order: MedicationDocumentation, tenantId: string, actorId: string, requestId: string, payload: MedicationEventPayload, role?: RoleKey | null, replay = false): Promise<MedicationWriteResult> {
    if (order.tenantId !== tenantId || !uuid.test(requestId))
        return { ok: false, error: 'Ungültige Zuordnung oder Anfrage.' };
    // An uncertain request must reach the server unchanged, even if the order was since paused.
    if (!replay && !order.integrity.canRecord)
        return { ok: false, error: order.integrity.errors.join(' ') };
    if (!replay) {
        const error = validateMedicationAdministration(order, actorId, payload);
        if (error)
            return { ok: false, error };
    }
    return write(tenantId, role, 'record_ambulatory_medication_event', { medication_id: order.id, request_id: requestId, payload });
}
export async function recordMedicationFollowUp(event: MedicationEvent, tenantId: string, requestId: string, payload: FollowUpPayload, role?: RoleKey | null): Promise<MedicationWriteResult> {
    if (event.tenantId !== tenantId || !uuid.test(requestId) || !isMedicationGiven(event.status))
        return { ok: false, error: 'Die Wirkungskontrolle ist dieser Gabe nicht zugeordnet.' };
    const error = validateMedicationFollowUp(event.occurredAt, payload.observedAt, payload.observation, payload.action, payload.painScore);
    if (error)
        return { ok: false, error };
    return write(tenantId, role, 'record_ambulatory_medication_followup', { administration_id: event.id, request_id: requestId, payload });
}
export type MedicationStatusPayload = {
    status: 'active' | 'paused' | 'stopped';
    expectedUpdatedAt: string;
    reason: string;
};
export async function changeMedicationStatus(order: MedicationDocumentation, tenantId: string, requestId: string, payload: MedicationStatusPayload, role?: RoleKey | null): Promise<MedicationWriteResult> {
    if (order.tenantId !== tenantId || !uuid.test(requestId) || !payload.reason.trim())
        return { ok: false, error: 'Zuordnung, Anfrage und Begründung prüfen.' };
    return write(tenantId, role, 'change_ambulatory_medication_status', { medication_id: order.id, request_id: requestId, payload }, 'pflege.medications.manage');
}
export type MedicationSourceLink = {
    id: string;
    documentTitle: string;
    fileName: string;
    documentVersion: string;
    orderVersion: string;
    reason: string;
    recordedByName: string;
    createdAt: string;
    hasFingerprint: boolean;
    archive: {
        id: string;
        finalizedAt: string;
    } | null;
};
export async function fetchMedicationSources(order: MedicationDocumentation, tenantId: string, role?: RoleKey | null): Promise<ServiceResult<{
    documents: MedicationSourceDocument[];
    links: MedicationSourceLink[];
}>> {
    for (const permission of ['pflege.medications.view', 'office.documents.view', 'office.clients.view_sensitive'] as const) {
        const denied = enforcePermission<{
            documents: MedicationSourceDocument[];
            links: MedicationSourceLink[];
        }>(role, permission);
        if (denied)
            return denied;
    }
    const denied = guardServiceTenant(tenantId);
    if (denied)
        return denied;
    if (order.tenantId !== tenantId)
        return { ok: false, error: 'Ungültige Verordnungszuordnung.' };
    const client = getSupabaseClient();
    if (!client || getServiceMode() !== 'supabase')
        return unavailable;
    try {
        const [documents, links, archives] = await Promise.all([
            allRows(client, 'client_documents', tenantId, q => q.eq('client_id', order.clientId).eq('status', 'aktiv'), r => r.client_id === order.clientId),
            allRows(client, 'medication_order_sources', tenantId, q => q.eq('medication_id', order.id), r => r.medication_id === order.id && r.client_id === order.clientId),
            allRows(client, 'medication_source_archives', tenantId, q => q.eq('medication_id', order.id).eq('client_id', order.clientId).eq('status', 'ready'), r => r.medication_id === order.id && r.client_id === order.clientId && r.status === 'ready'),
        ]);
        const sourceById = new Map(links.map(link => [String(link.id), link]));
        const archiveBySource = new Map<string, Row>();
        for (const archive of archives) {
            const source = sourceById.get(String(archive.source_id));
            if (!source || archiveBySource.has(String(archive.source_id)))
                throw Error('Archivstand ist nicht eindeutig einer Quelle zugeordnet.');
            assertMedicationSourceArchive({ tenantId, clientId: order.clientId, medicationId: order.id, linkId: String(source.id) }, archive, source.document_snapshot as Row);
            archiveBySource.set(String(source.id), archive);
        }
        return { ok: true, data: { documents: documents.map(d => ({ id: String(d.id), tenantId, clientId: order.clientId, title: text(d.title) ?? 'Titel fehlt', fileName: text(d.file_name) ?? 'Dateiname fehlt', mimeType: text(d.mime_type) ?? '', updatedAt: String(d.updated_at), storagePath: text(d.storage_path), status: String(d.status) })), links: links.map(l => {
                    const d = l.document_snapshot as Row, m = l.order_snapshot as Row;
                    if (!d || !m)
                        throw Error('Quellennachweis unvollständig.');
                    const archive = archiveBySource.get(String(l.id));
                    return { archive: archive ? { id: String(archive.id), finalizedAt: String(archive.finalized_at) } : null, id: String(l.id), documentTitle: String(d.title), fileName: String(d.file_name), documentVersion: String(d.updated_at), orderVersion: String(m.updated_at), reason: String(l.reason), recordedByName: String(l.recorded_by_name), createdAt: String(l.created_at), hasFingerprint: typeof d.content_sha256 === 'string' && /^[0-9a-f]{64}$/.test(d.content_sha256) && typeof d.content_size === 'number' && Number.isSafeInteger(d.content_size) && d.content_size > 0 };
                }) } };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Quellen konnten nicht geladen werden.' };
    }
}
export async function linkMedicationSource(order: MedicationDocumentation, document: MedicationSourceDocument, tenantId: string, requestId: string, payload: MedicationSourcePayload, role?: RoleKey | null, replay = false): Promise<MedicationWriteResult> {
    for (const permission of ['pflege.medications.view', 'office.documents.view', 'office.clients.view_sensitive'] as const) {
        const denied = enforcePermission<{
            id: string;
        }>(role, permission);
        if (denied)
            return denied;
    }
    if (order.tenantId !== tenantId || !uuid.test(requestId))
        return { ok: false, error: 'Ungültige Zuordnung oder Anfrage.' };
    if (!replay) {
        const error = validateMedicationSource(order, document, payload);
        if (error)
            return { ok: false, error };
    }
    return write(tenantId, role, 'link_ambulatory_medication_source', { medication_id: order.id, request_id: requestId, payload }, 'pflege.medications.manage');
}
export async function fetchMedicationSourceFile(order: MedicationDocumentation, linkId: string, tenantId: string, role: RoleKey | null, isCurrent: () => boolean): Promise<ServiceResult<MedicationSourceDownload>> {
    for (const permission of ['pflege.medications.view', 'office.documents.view', 'office.clients.view_sensitive'] as const) {
        const denied = enforcePermission<MedicationSourceDownload>(role, permission);
        if (denied)
            return denied;
    }
    const denied = guardServiceTenant(tenantId);
    if (denied)
        return denied;
    if (order.tenantId !== tenantId)
        return { ok: false, error: 'Ungültige Verordnungszuordnung.' };
    const client = getSupabaseClient();
    if (!client || getServiceMode() !== 'supabase')
        return unavailable;
    const read = async (table: string, id: string) => {
        let q = fromUnknownTable(client, table).select('*').eq('tenant_id', tenantId).eq('client_id', order.clientId).eq('id', id);
        if (table === 'medication_order_sources')
            q = q.eq('medication_id', order.id);
        const result = await withServiceQueryTimeout(Promise.resolve(q.maybeSingle()), 'Quelldokument', 20000);
        if (result.error)
            throw Error('Quelldokument ist nicht zugänglich. Bitte Dokumentenrechte und Verbindung prüfen.');
        return result.data as Row | null;
    };
    try {
        const data = await loadMedicationSourceWithArchive({ tenantId, clientId: order.clientId, medicationId: order.id, linkId }, {
            readLink: () => read('medication_order_sources', linkId), readDocument: id => read('client_documents', id),
            readArchive: async () => {
                const result = await withServiceQueryTimeout(Promise.resolve(fromUnknownTable(client, 'medication_source_archives').select('*').eq('tenant_id', tenantId).eq('client_id', order.clientId).eq('medication_id', order.id).eq('source_id', linkId).eq('status', 'ready').maybeSingle()), 'Quellenarchiv', 20000);
                if (result.error)
                    throw Error('Archivstand konnte nicht geprüft werden. Bitte Verbindung und Dokumentenrechte prüfen.');
                return result.data as Row | null;
            },
            downloadArchive: async (path) => {
                const result = await withServiceQueryTimeout(client.storage.from('medication-source-archives').download(path), 'Archivkopie', 20000);
                if (result.error || !result.data)
                    throw Error('Die bestätigte Archivkopie konnte nicht geladen werden. Bitte erneut versuchen.');
                return result.data;
            },
            isCurrent: () => isCurrent() && !guardServiceTenant(tenantId),
            download: async (path) => {
                // Use the existing SDK signature; no public URL, signed link, or portal release.
                const result = await withServiceQueryTimeout(client.storage.from('office-documents').download(path), 'Quelldatei', 20000);
                if (result.error || !result.data)
                    throw Error('Quelldatei konnte nicht geladen werden. Bitte erneut versuchen oder die Klientenakte prüfen.');
                return result.data;
            },
        });
        return { ok: true, data };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Quelldatei konnte nicht geladen werden.' };
    }
}
export async function fetchMedicationSourceFingerprint(order: MedicationDocumentation, document: MedicationSourceDocument, tenantId: string, role: RoleKey | null, isCurrent: () => boolean): Promise<ServiceResult<MedicationSourceFingerprint>> {
    for (const permission of ['pflege.medications.view', 'office.documents.view', 'office.clients.view_sensitive'] as const) {
        const denied = enforcePermission<MedicationSourceFingerprint>(role, permission);
        if (denied)
            return denied;
    }
    const denied = guardServiceTenant(tenantId);
    if (denied)
        return denied;
    if (order.tenantId !== tenantId || document.tenantId !== tenantId || document.clientId !== order.clientId)
        return { ok: false, error: 'Ungültige Dokumentzuordnung.' };
    const client = getSupabaseClient();
    if (!client || getServiceMode() !== 'supabase')
        return unavailable;
    try {
        const data = await loadMedicationSourceCandidate({ tenantId, clientId: order.clientId, medicationId: order.id }, { id: document.id, updated_at: document.updatedAt, storage_path: document.storagePath, file_name: document.fileName, mime_type: document.mimeType }, {
            isCurrent: () => isCurrent() && !guardServiceTenant(tenantId),
            readDocument: async (id) => {
                const result = await withServiceQueryTimeout(Promise.resolve(fromUnknownTable(client, 'client_documents').select('*').eq('id', id).eq('tenant_id', tenantId).eq('client_id', order.clientId).maybeSingle()), 'Quelldokument', 20000);
                if (result.error)
                    throw Error('Quelldokument nicht zugänglich. Dokumentenrechte und Verbindung prüfen.');
                return result.data as Row | null;
            },
            download: async (path) => {
                const result = await withServiceQueryTimeout(client.storage.from('office-documents').download(path), 'Quelldatei', 20000);
                if (result.error || !result.data)
                    throw Error('Quelldatei konnte nicht geladen werden. Erfassung erneut versuchen.');
                return result.data;
            },
        });
        return { ok: true, data };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Inhaltsfingerabdruck konnte nicht erfasst werden.' };
    }
}
export async function archiveMedicationSourceCopy(order: MedicationDocumentation, sourceId: string, tenantId: string, requestId: string, role: RoleKey | null): Promise<MedicationWriteResult> {
    for (const permission of ['pflege.medications.manage', 'pflege.medications.view', 'office.documents.view', 'office.clients.view_sensitive'] as const) {
        const denied = enforcePermission<{
            id: string;
        }>(role, permission);
        if (denied)
            return denied;
    }
    const denied = guardServiceTenant(tenantId);
    if (denied)
        return denied;
    if (order.tenantId !== tenantId)
        return { ok: false, error: 'Ungültige Verordnungszuordnung.' };
    const client = getSupabaseClient();
    if (!client || getServiceMode() !== 'supabase')
        return unavailable;
    return submitMedicationSourceArchive({ tenantId, clientId: order.clientId, medicationId: order.id, sourceId }, requestId, {
        isCurrent: () => !guardServiceTenant(tenantId),
        invoke: (sourceId, requestId) => withServiceQueryTimeout(client.functions.invoke('medication-source-archive', { body: { sourceId, requestId } }), 'Quellenarchivierung', 60000),
        readConfirmed: async (id) => {
            const result = await withServiceQueryTimeout(Promise.resolve(fromUnknownTable(client, 'medication_source_archives').select('*').eq('id', id).eq('tenant_id', tenantId).eq('client_id', order.clientId).eq('medication_id', order.id).eq('source_id', sourceId).eq('status', 'ready').maybeSingle()), 'Archivbestätigung', 20000);
            if (result.error)
                throw Error('Archivbestätigung fehlt.');
            const source = await withServiceQueryTimeout(Promise.resolve(fromUnknownTable(client, 'medication_order_sources').select('*').eq('id', sourceId).eq('tenant_id', tenantId).eq('client_id', order.clientId).eq('medication_id', order.id).maybeSingle()), 'Archivquelle', 20000);
            if (source.error || !source.data)
                throw Error('Quellenbestätigung fehlt.');
            assertMedicationSourceArchive({ tenantId, clientId: order.clientId, medicationId: order.id, linkId: sourceId }, result.data as Row | null, (source.data as Row).document_snapshot as Row);
            return result.data as Row | null;
        },
    });
}
