// Generated native presentation from src/lib/clients/clientClinicalHistoryRepository.supabase.web.ts. Update through scripts/port-native-workspaces.mjs.
import { getSupabaseClient } from "../supabase/client.ts";
import type { ServiceResult } from '@/types';
import type { ClientClinicalDateMeaning, ClientClinicalEntryKind, ClientClinicalHistoryEntry, ClientClinicalHistorySummary, ClientClinicalLegacyCandidate, ClientClinicalLegacyOriginKind, ClientClinicalLegacyOriginReference, ClientClinicalRecordState, ClientClinicalVerification, } from '@/types/modules/clientClinicalHistory';
type Row = Record<string, unknown>;
type RpcClient = {
    rpc(name: string, args: Record<string, unknown>): Promise<{
        data: unknown;
        error: {
            message?: string;
            code?: string;
        } | null;
    }>;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const KINDS = new Set<ClientClinicalEntryKind>(['diagnosis', 'allergy', 'intolerance', 'unresolved_hint']);
const DATE_MEANINGS = new Set<ClientClinicalDateMeaning>(['diagnosed_on', 'onset_on', 'reported_on', 'unknown']);
const VERIFICATIONS = new Set<ClientClinicalVerification>(['unconfirmed', 'provisional', 'confirmed', 'refuted']);
const STATES = new Set<ClientClinicalRecordState>(['active', 'resolved', 'entered_in_error']);
const LEGACY_KINDS = new Set<ClientClinicalLegacyOriginKind>(['client_diagnoses', 'client_diagnoses_notes', 'client_allergies', 'care_diagnosis']);
function row(value: unknown): value is Row { return !!value && typeof value === 'object' && !Array.isArray(value); }
function text(value: Row, key: string): string { return typeof value[key] === 'string' ? value[key] as string : ''; }
function nullableText(value: Row, key: string): string | null { return value[key] === null ? null : text(value, key) || null; }
function cloneJson(value: unknown): unknown {
    if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
        return value;
    if (Array.isArray(value))
        return Object.freeze(value.map(cloneJson));
    if (!row(value))
        return undefined;
    const copy: Row = {};
    for (const [key, item] of Object.entries(value)) {
        const cloned = cloneJson(item);
        if (cloned === undefined)
            return undefined;
        copy[key] = cloned;
    }
    return Object.freeze(copy);
}
function equalJson(left: unknown, right: unknown): boolean {
    if (left === right)
        return true;
    if (Array.isArray(left) || Array.isArray(right))
        return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((item, index) => equalJson(item, right[index]));
    if (!row(left) || !row(right))
        return false;
    const leftKeys = Object.keys(left).sort(), rightKeys = Object.keys(right).sort();
    return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index] && equalJson(left[key], right[key]));
}
function sameLegacyOrigin(left: ClientClinicalLegacyOriginReference | null, right: ClientClinicalLegacyOriginReference | null): boolean {
    return left === null || right === null ? left === right : left.originKind === right.originKind && left.originId === right.originId
        && left.originUpdatedAt === right.originUpdatedAt && equalJson(left.original, right.original);
}
function mapLegacyOrigin(value: unknown): ClientClinicalLegacyOriginReference | null {
    if (!row(value))
        return null;
    const originKind = text(value, 'origin_kind') as ClientClinicalLegacyOriginKind;
    const original = cloneJson(value.original);
    if (!LEGACY_KINDS.has(originKind) || !UUID.test(text(value, 'origin_id')) || !INSTANT.test(text(value, 'origin_updated_at')) || !row(original))
        return null;
    return Object.freeze({ originKind, originId: text(value, 'origin_id'), originUpdatedAt: text(value, 'origin_updated_at'), original });
}
function mapLegacyCandidate(value: unknown): ClientClinicalLegacyCandidate | null {
    const origin = mapLegacyOrigin(value);
    if (!origin || !row(value) || !text(value, 'display_label') || !text(value, 'display_text'))
        return null;
    const linkedEntryId = nullableText(value, 'linked_entry_id');
    if (linkedEntryId !== null && !UUID.test(linkedEntryId))
        return null;
    return Object.freeze({ ...origin, displayLabel: text(value, 'display_label'), displayText: text(value, 'display_text'), linkedEntryId });
}
function mapEntry(value: unknown): ClientClinicalHistoryEntry | null {
    if (!row(value))
        return null;
    const kind = text(value, 'kind') as ClientClinicalEntryKind;
    const dateMeaning = text(value, 'date_meaning') as ClientClinicalDateMeaning;
    const verification = text(value, 'verification') as ClientClinicalVerification;
    const recordState = text(value, 'record_state') as ClientClinicalRecordState;
    const revision = Number(value.revision);
    const clinicalDate = nullableText(value, 'clinical_date');
    const supersedesId = nullableText(value, 'supersedes_id');
    const legacyOrigin = value.legacy_origin === null ? null : mapLegacyOrigin(value.legacy_origin);
    if (!['id', 'request_id', 'tenant_id', 'client_id', 'recorded_by_profile_id'].every((key) => UUID.test(text(value, key)))
        || !['created_at', 'updated_at'].every((key) => INSTANT.test(text(value, key)))
        || !KINDS.has(kind) || !DATE_MEANINGS.has(dateMeaning) || !VERIFICATIONS.has(verification) || !STATES.has(recordState)
        || !Number.isSafeInteger(revision) || revision < 1 || !text(value, 'clinical_text').trim()
        || clinicalDate !== null && !DATE.test(clinicalDate) || supersedesId !== null && !UUID.test(supersedesId)
        || dateMeaning === 'unknown' && clinicalDate !== null || dateMeaning !== 'unknown' && clinicalDate === null
        || value.legacy_origin !== null && !legacyOrigin)
        return null;
    return Object.freeze({
        id: text(value, 'id'), requestId: text(value, 'request_id'), tenantId: text(value, 'tenant_id'), clientId: text(value, 'client_id'), kind,
        clinicalCode: nullableText(value, 'clinical_code'), clinicalText: text(value, 'clinical_text'), sourceType: text(value, 'source_type'),
        sourceReference: text(value, 'source_reference'), clinicalDate, dateMeaning, verification, recordState, revision, supersedesId,
        recordedByProfileId: text(value, 'recorded_by_profile_id'), recordedByName: text(value, 'recorded_by_name'),
        createdAt: text(value, 'created_at'), updatedAt: text(value, 'updated_at'), legacyOrigin,
    });
}
function mapSummary(value: unknown, tenantId: string, clientId: string): ClientClinicalHistorySummary | null {
    if (!row(value) || typeof value.client_name !== 'string' || !INSTANT.test(text(value, 'client_updated_at'))
        || !Array.isArray(value.current) || !Array.isArray(value.history) || !Array.isArray(value.legacy_candidates))
        return null;
    const current = value.current.map(mapEntry), history = value.history.map(mapEntry), legacyCandidates = value.legacy_candidates.map(mapLegacyCandidate);
    if ([...current, ...history].some((entry) => !entry || entry.tenantId !== tenantId || entry.clientId !== clientId))
        return null;
    if (legacyCandidates.some((candidate) => !candidate || candidate.originKind !== 'care_diagnosis' && candidate.originId !== clientId))
        return null;
    const currentEntries = current as ClientClinicalHistoryEntry[], historyEntries = history as ClientClinicalHistoryEntry[];
    const candidates = legacyCandidates as ClientClinicalLegacyCandidate[];
    if (new Set(historyEntries.map((entry) => entry.id)).size !== historyEntries.length
        || currentEntries.some((entry) => !historyEntries.some((historyEntry) => historyEntry.id === entry.id))
        || new Set(candidates.map((candidate) => `${candidate.originKind}:${candidate.originId}:${candidate.originUpdatedAt}`)).size !== candidates.length
        || candidates.some((candidate) => candidate.linkedEntryId !== null && !historyEntries.some((entry) => entry.id === candidate.linkedEntryId)))
        return null;
    const diagnosisCount = currentEntries.filter((entry) => entry.kind === 'diagnosis' && entry.recordState === 'active').length;
    const allergyCount = currentEntries.filter((entry) => entry.kind !== 'diagnosis' && entry.recordState === 'active').length;
    return Object.freeze({
        clientName: value.client_name, clientUpdatedAt: text(value, 'client_updated_at'),
        diagnosesState: diagnosisCount ? 'present' : 'unknown', allergiesState: allergyCount ? 'present' : 'unknown',
        current: Object.freeze(currentEntries), history: Object.freeze(historyEntries), legacyCandidates: Object.freeze(candidates),
    });
}
async function call(name: string, args: Record<string, unknown>): Promise<ServiceResult<unknown>> {
    const client = getSupabaseClient();
    if (!client)
        return { ok: false, error: 'Die sichere Live-Datenbank ist nicht verfügbar.' };
    const captured = client;
    const result = await (captured as unknown as RpcClient).rpc(name, args);
    if (captured !== getSupabaseClient())
        return { ok: false, error: 'Die Datenbanksitzung hat während der Anfrage gewechselt.' };
    if (result.error)
        return { ok: false, error: result.error.message ?? 'Der native klinische Verlauf ist fehlgeschlagen.' };
    return { ok: true, data: result.data };
}
export async function readClientClinicalHistory(tenantId: string, clientId: string, actorId: string): Promise<ServiceResult<ClientClinicalHistorySummary>> {
    if (![tenantId, clientId, actorId].every((value) => UUID.test(value)))
        return { ok: false, error: 'Der sichere Aktenbezug fehlt.' };
    const result = await call('web_read_client_clinical_history', { p_tenant_id: tenantId, p_client_id: clientId, p_actor_profile_id: actorId });
    if (!result.ok)
        return result;
    const summary = mapSummary(result.data, tenantId, clientId);
    return summary ? { ok: true, data: summary } : { ok: false, error: 'Der native klinische Verlauf ist unvollständig oder widersprüchlich.' };
}
export type ClientClinicalWriteOriginal = Readonly<{
    tenantId: string;
    clientId: string;
    actorId: string;
    requestId: string;
    expectedClientUpdatedAt: string;
    supersedesId: string | null;
    expectedSupersededUpdatedAt: string | null;
    kind: ClientClinicalEntryKind;
    clinicalCode: string | null;
    clinicalText: string;
    sourceType: string;
    sourceReference: string;
    clinicalDate: string | null;
    dateMeaning: ClientClinicalDateMeaning;
    verification: ClientClinicalVerification;
    recordState: ClientClinicalRecordState;
    recordedByName: string;
    legacyOrigin?: ClientClinicalLegacyOriginReference | null;
}>;
export async function recordClientClinicalHistory(original: ClientClinicalWriteOriginal): Promise<ServiceResult<ClientClinicalHistoryEntry>> {
    const legacyOrigin = original.legacyOrigin == null ? null : mapLegacyOrigin({
        origin_kind: original.legacyOrigin.originKind, origin_id: original.legacyOrigin.originId,
        origin_updated_at: original.legacyOrigin.originUpdatedAt, original: original.legacyOrigin.original,
    });
    const value = Object.freeze({ ...original, clinicalText: original.clinicalText.trim(), sourceType: original.sourceType.trim(),
        sourceReference: original.sourceReference.trim(), recordedByName: original.recordedByName.trim(), legacyOrigin });
    if (![value.tenantId, value.clientId, value.actorId, value.requestId].every((item) => UUID.test(item)) || !INSTANT.test(value.expectedClientUpdatedAt)
        || value.supersedesId !== null && !UUID.test(value.supersedesId)
        || value.expectedSupersededUpdatedAt !== null && !INSTANT.test(value.expectedSupersededUpdatedAt)
        || (value.supersedesId === null) !== (value.expectedSupersededUpdatedAt === null)
        || !KINDS.has(value.kind) || !DATE_MEANINGS.has(value.dateMeaning) || !VERIFICATIONS.has(value.verification) || !STATES.has(value.recordState)
        || value.clinicalText.length < 3 || value.sourceType.length < 3 || value.sourceReference.length < 3 || value.recordedByName.length < 2
        || value.clinicalDate !== null && !DATE.test(value.clinicalDate)
        || value.dateMeaning === 'unknown' && value.clinicalDate !== null || value.dateMeaning !== 'unknown' && value.clinicalDate === null
        || original.legacyOrigin != null && !legacyOrigin || legacyOrigin !== null && value.supersedesId !== null) {
        return { ok: false, error: 'Art, klinischer Originaltext, Quelle, Datumsbedeutung und aktueller Originalstand müssen vollständig bestätigt sein.' };
    }
    const result = await call('web_record_client_clinical_history', {
        p_tenant_id: value.tenantId, p_client_id: value.clientId, p_actor_profile_id: value.actorId, p_request_id: value.requestId,
        p_expected_client_updated_at: value.expectedClientUpdatedAt, p_supersedes_id: value.supersedesId,
        p_expected_superseded_updated_at: value.expectedSupersededUpdatedAt,
        p_payload: { kind: value.kind, clinical_code: value.clinicalCode, clinical_text: value.clinicalText, source_type: value.sourceType,
            source_reference: value.sourceReference, clinical_date: value.clinicalDate, date_meaning: value.dateMeaning,
            verification: value.verification, record_state: value.recordState, recorded_by_name: value.recordedByName,
            legacy_origin: legacyOrigin ? { origin_kind: legacyOrigin.originKind, origin_id: legacyOrigin.originId,
                origin_updated_at: legacyOrigin.originUpdatedAt, original: legacyOrigin.original } : null },
    });
    if (!result.ok)
        return result;
    const entry = mapEntry(result.data);
    return entry && entry.requestId === value.requestId && entry.tenantId === value.tenantId && entry.clientId === value.clientId
        && sameLegacyOrigin(entry.legacyOrigin, value.legacyOrigin)
        ? { ok: true, data: entry } : { ok: false, error: 'Die native Schreibquittung gehört nicht vollständig zu diesem Vorgang.' };
}
export async function confirmClientClinicalHistoryWrite(input: {
    tenantId: string;
    clientId: string;
    actorId: string;
    requestId: string;
    expectedLegacyOrigin?: ClientClinicalLegacyOriginReference | null;
}): Promise<ServiceResult<ClientClinicalHistoryEntry>> {
    if (![input.tenantId, input.clientId, input.actorId, input.requestId].every((value) => UUID.test(value)))
        return { ok: false, error: 'Der sichere Schreibbezug fehlt.' };
    const result = await call('web_confirm_client_clinical_history_write', {
        p_tenant_id: input.tenantId, p_client_id: input.clientId, p_actor_profile_id: input.actorId, p_request_id: input.requestId,
    });
    if (!result.ok)
        return result;
    const entry = mapEntry(result.data);
    return entry && entry.requestId === input.requestId && entry.tenantId === input.tenantId && entry.clientId === input.clientId
        && (input.expectedLegacyOrigin === undefined || sameLegacyOrigin(entry.legacyOrigin, input.expectedLegacyOrigin))
        ? { ok: true, data: entry } : { ok: false, error: 'Der Schreibvorgang ist durch keine vollständige native Quittung bestätigt.' };
}
export const clientClinicalHistoryInternals = Object.freeze({ mapEntry, mapSummary, mapLegacyOrigin, mapLegacyCandidate, equalJson, sameLegacyOrigin });
