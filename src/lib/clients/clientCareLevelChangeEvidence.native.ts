// Generated native presentation from src/lib/clients/clientCareLevelChangeEvidence.web.ts. Update through scripts/port-native-workspaces.mjs.
import { captureClientNativePage, cloneClientNativeOriginal, freezeClientNativeOriginal, type ClientNativeRow, type ClientNativeScope, } from "./clientRecordNativeOriginal.native.ts";
import { woundUuid } from '../pflege/woundCareDomain.ts';
export type ClientCareLevelChangeFieldWeb = Readonly<{
    state: 'missing' | 'undefined' | 'null' | 'empty' | 'value' | 'invalid';
    text: string | null;
}>;
export type ClientCareLevelChangeEvidenceEntryWeb = Readonly<{
    nativeEventId: string;
    previousCareLevel: ClientCareLevelChangeFieldWeb;
    nextCareLevel: ClientCareLevelChangeFieldWeb;
    successorDocumentId: ClientCareLevelChangeFieldWeb;
    replacedDocumentId: ClientCareLevelChangeFieldWeb;
    canonicalDocumentId: ClientCareLevelChangeFieldWeb;
    actorProfileId: ClientCareLevelChangeFieldWeb;
    createdAt: ClientCareLevelChangeFieldWeb;
    successorVersion: ClientCareLevelChangeFieldWeb;
    successorStatus: ClientCareLevelChangeFieldWeb;
    relationState: 'complete_native_chain' | 'partial_native_chain' | 'unresolved_native_chain';
    careLevelRowRelation: 'not_provided';
    consultationRelation: 'not_provided';
    followUpTaskRelation: 'not_provided';
}>;
export type ClientCareLevelChangeEvidenceWeb = Readonly<{
    kind: 'unbound_care_level_document_change_evidence';
    authority: 'inspection_only';
    tenantId: string;
    clientId: string;
    entries: readonly ClientCareLevelChangeEvidenceEntryWeb[];
    careLevelRowsAreUnbound: true;
    taskPoolWasNotCorrelated: true;
}>;
type OriginalPools = Readonly<{
    careLevels: readonly ClientNativeRow[];
    intakeDocuments: readonly ClientNativeRow[];
    documents: readonly ClientNativeRow[];
    documentEvents: readonly ClientNativeRow[];
    tasks: readonly ClientNativeRow[];
}>;
const originals = new WeakMap<object, OriginalPools>();
const empty = (state: ClientCareLevelChangeFieldWeb['state']): ClientCareLevelChangeFieldWeb => ({ state, text: null });
function own(row: ClientNativeRow, key: string, uuid = false): ClientCareLevelChangeFieldWeb {
    if (!Object.hasOwn(row, key))
        return empty('missing');
    const value = Object.getOwnPropertyDescriptor(row, key)!.value;
    if (value === undefined)
        return empty('undefined');
    if (value === null)
        return empty('null');
    if (value === '')
        return { state: 'empty', text: '' };
    if (typeof value !== 'string' || uuid && !woundUuid(value))
        return empty('invalid');
    return { state: 'value', text: value };
}
function metadata(row: ClientNativeRow, key: string, uuid = false): ClientCareLevelChangeFieldWeb {
    if (!Object.hasOwn(row, 'metadata_json'))
        return empty('missing');
    const value = Object.getOwnPropertyDescriptor(row, 'metadata_json')!.value;
    if (!value || typeof value !== 'object' || Array.isArray(value)
        || ![Object.prototype, null].includes(Object.getPrototypeOf(value)))
        return empty('invalid');
    return own(value as ClientNativeRow, key, uuid);
}
function version(row: ClientNativeRow | undefined): ClientCareLevelChangeFieldWeb {
    if (!row)
        return empty('missing');
    if (!Object.hasOwn(row, 'version'))
        return empty('missing');
    const value = Object.getOwnPropertyDescriptor(row, 'version')!.value;
    return Number.isSafeInteger(value) && Number(value) >= 0
        ? { state: 'value', text: String(value) }
        : empty(value === undefined ? 'undefined' : value === null ? 'null' : 'invalid');
}
function exactOne(rows: readonly ClientNativeRow[], key: string, id: string | null): ClientNativeRow | undefined {
    if (!id)
        return undefined;
    const matches = rows.filter(row => Object.hasOwn(row, key) && Object.getOwnPropertyDescriptor(row, key)!.value === id);
    return matches.length === 1 ? matches[0] : undefined;
}
/**
 * Projects only native document-event foreign keys. Care-level rows, counselling and
 * tasks deliberately remain unbound because the delivered schema has no such key.
 */
export function captureClientCareLevelChangeEvidenceWeb(input: unknown, scope: ClientNativeScope): ClientCareLevelChangeEvidenceWeb | null {
    try {
        const supplied = cloneClientNativeOriginal(input);
        if (!supplied || typeof supplied !== 'object' || Array.isArray(supplied)
            || Object.keys(supplied).length !== 5
            || !['careLevels', 'intakeDocuments', 'documents', 'documentEvents', 'tasks'].every(key => Object.hasOwn(supplied, key)))
            return null;
        const raw = supplied as Record<string, unknown>;
        const pools = freezeClientNativeOriginal({
            careLevels: captureClientNativePage(raw.careLevels, scope, null),
            intakeDocuments: captureClientNativePage(raw.intakeDocuments, scope, null),
            documents: captureClientNativePage(raw.documents, scope, null),
            documentEvents: captureClientNativePage(raw.documentEvents, scope, null),
            tasks: captureClientNativePage(raw.tasks, scope, null),
        });
        const entries = pools.documentEvents
            .filter(row => own(row, 'event_type').text === 'care_level_successor_generated')
            .map(row => {
            const successorDocumentId = own(row, 'document_id', true);
            const replacedDocumentId = metadata(row, 'replacedDocumentId', true);
            const successorId = successorDocumentId.state === 'value' ? successorDocumentId.text : null;
            const replacedId = replacedDocumentId.state === 'value' ? replacedDocumentId.text : null;
            const successor = exactOne(pools.intakeDocuments, 'id', successorId);
            const replaced = successorId !== replacedId ? exactOne(pools.intakeDocuments, 'id', replacedId) : undefined;
            const canonical = exactOne(pools.documents, 'intake_document_id', successorId);
            const canonicalDocumentId = canonical ? own(canonical, 'id', true) : empty('missing');
            const linked = Number(Boolean(successor)) + Number(Boolean(replaced)) + Number(Boolean(canonical));
            return {
                nativeEventId: row.id as string,
                previousCareLevel: metadata(row, 'previousCareLevel'),
                nextCareLevel: metadata(row, 'nextCareLevel'),
                successorDocumentId,
                replacedDocumentId,
                canonicalDocumentId,
                actorProfileId: own(row, 'actor_profile_id', true),
                createdAt: own(row, 'created_at'),
                successorVersion: version(successor),
                successorStatus: successor ? own(successor, 'status') : empty('missing'),
                relationState: linked === 3 ? 'complete_native_chain' as const
                    : linked > 0 ? 'partial_native_chain' as const : 'unresolved_native_chain' as const,
                careLevelRowRelation: 'not_provided' as const,
                consultationRelation: 'not_provided' as const,
                followUpTaskRelation: 'not_provided' as const,
            };
        });
        const model = freezeClientNativeOriginal({
            kind: 'unbound_care_level_document_change_evidence' as const,
            authority: 'inspection_only' as const,
            tenantId: scope.tenantId,
            clientId: scope.clientId,
            entries,
            careLevelRowsAreUnbound: true as const,
            taskPoolWasNotCorrelated: true as const,
        });
        originals.set(model, pools);
        return model;
    }
    catch {
        return null;
    }
}
/** Private preservation only; never a current care-level, task or counselling relation. */
export function clientCareLevelChangeOriginalsWeb(model: unknown): OriginalPools | null {
    return model && typeof model === 'object' ? originals.get(model) ?? null : null;
}
