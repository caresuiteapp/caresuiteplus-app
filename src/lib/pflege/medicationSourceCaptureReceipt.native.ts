// Generated native presentation from src/lib/pflege/medicationSourceCaptureReceipt.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import type { MedicationSourceDocument, MedicationSourcePayload } from './medicationSourceDomain';
import { validateMedicationSource } from './medicationSourceDomain.ts';
import { sameWoundJson, woundInstant, woundUuid } from './woundCareDomain.ts';
type Row = Record<string, unknown>;
type OrderScope = {
    id: string;
    tenantId: string;
    clientId: string;
    updatedAt: string;
};
export type MedicationSourceCaptureAttempt = {
    order: OrderScope;
    document: MedicationSourceDocument;
    actorId: string;
    requestId: string;
    payload: MedicationSourcePayload;
};
type CaptureResult = {
    ok: true;
    data: {
        id: string;
    };
} | {
    ok: false;
    error: string;
    uncertain?: boolean;
};
const uncertainResult: CaptureResult = { ok: false, uncertain: true, error: 'Die gespeicherte Quellenzuordnung konnte nicht vollständig bestätigt werden. Dieselbe unveränderte Anfrage erneut prüfen.' };
const row = (value: unknown): Row | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Row : null;
const sourceInstant = (value: unknown) => typeof value === 'string' ? woundInstant(value.replace(' ', 'T')) : null;
const sameVersion = (a: unknown, b: unknown) => sourceInstant(a) !== null && sourceInstant(a) === sourceInstant(b);
function assertAttempt(attempt: MedicationSourceCaptureAttempt) {
    if (!attempt || !attempt.order || !attempt.document || !attempt.payload || ![attempt.order.id, attempt.order.tenantId, attempt.order.clientId, attempt.actorId, attempt.requestId].every(woundUuid)
        || Object.keys(attempt.payload).length !== 6 || !['documentId', 'documentUpdatedAt', 'expectedUpdatedAt', 'reason', 'contentSha256', 'contentSize'].every(key => Object.hasOwn(attempt.payload, key))
        || [attempt.document.title, attempt.document.fileName, attempt.document.mimeType].some(value => typeof value !== 'string' || !value.trim())
        || typeof attempt.document.storagePath !== 'string' || /[\\%?#\u0000-\u001f]/.test(attempt.document.storagePath)
        || validateMedicationSource(attempt.order, attempt.document, attempt.payload))
        throw Error('Der ursprüngliche eigene Quellenauftrag ist nicht vollständig.');
}
/** Confirm only the explicit returned source ID. This binds a capture receipt, never medical approval or server-verified file bytes. */
export function assertMedicationSourceCaptureReceipt(raw: unknown, returnedId: string, attempt: MedicationSourceCaptureAttempt): Row {
    assertAttempt(attempt);
    const source = row(raw), doc = row(source?.document_snapshot), order = row(source?.order_snapshot), payload = attempt.payload;
    if (!woundUuid(returnedId) || !source || !doc || !order || source.id !== returnedId || source.tenant_id !== attempt.order.tenantId
        || source.client_id !== attempt.order.clientId || source.medication_id !== attempt.order.id || source.document_id !== attempt.document.id
        || source.request_id !== attempt.requestId || source.recorded_by !== attempt.actorId || !sameWoundJson(source.payload, payload)
        || source.reason !== payload.reason.trim() || typeof source.recorded_by_name !== 'string' || !source.recorded_by_name.trim()
        || sourceInstant(source.created_at) === null)
        throw Error('Die gespeicherte Quelle bestätigt den eigenen ursprünglichen Auftrag nicht vollständig.');
    if (doc.id !== attempt.document.id || doc.title !== attempt.document.title || doc.file_name !== attempt.document.fileName
        || doc.mime_type !== attempt.document.mimeType || doc.storage_path !== attempt.document.storagePath || doc.status !== 'aktiv'
        || !sameVersion(doc.updated_at, payload.documentUpdatedAt) || doc.content_sha256 !== payload.contentSha256 || doc.content_size !== payload.contentSize
        || doc.content_fingerprint_origin !== 'client_observed')
        throw Error('Der erfasste Dokumentstand stimmt nicht vollständig mit dem eigenen Quellenauftrag überein.');
    if (order.id !== attempt.order.id || order.tenant_id !== attempt.order.tenantId || order.client_id !== attempt.order.clientId
        || !sameVersion(order.updated_at, payload.expectedUpdatedAt))
        throw Error('Der Verordnungsstand der gespeicherten Quelle gehört nicht zum ursprünglichen Auftrag.');
    return structuredClone(source);
}
/** A UUID response alone is not a capture receipt. No content search or new request ID is used after an uncertain write. */
export async function submitMedicationSourceCapture(attempt: MedicationSourceCaptureAttempt, gateway: {
    write(): Promise<CaptureResult>;
    readReturned(id: string): Promise<unknown>;
    isCurrent(): boolean;
}): Promise<CaptureResult> {
    try {
        assertAttempt(attempt);
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Quellenauftrag prüfen.' };
    }
    if (!gateway.isCurrent())
        return { ok: false, error: 'Die eigene aktive Medikationsakte hat sich geändert.' };
    // Preserve the original facts even if a gateway or caller later mutates a shared object.
    const original = structuredClone(attempt);
    try {
        const result = await gateway.write();
        if (!gateway.isCurrent())
            return uncertainResult;
        if (!result.ok)
            return result;
        if (!woundUuid(result.data?.id))
            return uncertainResult;
        const retained = await gateway.readReturned(result.data.id);
        if (!gateway.isCurrent())
            return uncertainResult;
        assertMedicationSourceCaptureReceipt(retained, result.data.id, original);
        return { ok: true, data: { id: result.data.id } };
    }
    catch {
        return uncertainResult;
    }
}
