// Generated native presentation from src/lib/clients/clientTimelineOriginals.web.ts. Update through scripts/port-native-workspaces.mjs.
import { woundInstant, woundUuid } from '../pflege/woundCareDomain.ts';
import { captureClientNativePage, cloneClientNativeOriginal, freezeClientNativeOriginal, type ClientNativeRow, type ClientNativeScope, } from "./clientRecordNativeOriginal.native.ts";
export const CLIENT_TIMELINE_ORIGINAL_POOLS = {
    timeline: 'client_timeline_events', audit: 'client_audit_entries', document: 'client_document_events',
} as const;
export type ClientTimelineOriginalKind = keyof typeof CLIENT_TIMELINE_ORIGINAL_POOLS;
export type ClientTimelineField = {
    state: 'missing' | 'null' | 'empty' | 'present' | 'invalid';
    value: unknown;
};
export type ClientTimelineTime = {
    state: 'missing' | 'null' | 'empty' | 'valid' | 'invalid';
    value: unknown;
    microseconds: bigint | null;
};
export type ClientTimelineOriginalEntry = {
    kind: ClientTimelineOriginalKind;
    key: string;
    nativeId: string;
    tenantId: string;
    clientId: string;
    title: ClientTimelineField;
    subtitle: ClientTimelineField;
    eventType: ClientTimelineField;
    status: ClientTimelineField;
    originalActorName: ClientTimelineField;
    actorProfileId: ClientTimelineField;
    documentId: ClientTimelineField;
    metadata: ClientTimelineField;
    timestamp: ClientTimelineTime;
    original: ClientNativeRow;
};
export type ClientTimelineOriginalCollection = {
    pools: Record<ClientTimelineOriginalKind, ClientNativeRow[]>;
    entries: ClientTimelineOriginalEntry[];
};
function field(row: ClientNativeRow, key: string, type?: 'text' | 'uuid'): ClientTimelineField {
    if (!Object.hasOwn(row, key))
        return { state: 'missing', value: undefined };
    const value = row[key];
    if (value === null)
        return { state: 'null', value };
    if (value === undefined)
        return { state: 'invalid', value };
    if (value === '' || type === 'text' && typeof value === 'string' && !value.trim())
        return { state: 'empty', value };
    if (type === 'text' && typeof value !== 'string' || type === 'uuid' && !woundUuid(value))
        return { state: 'invalid', value };
    return { state: 'present', value };
}
function time(row: ClientNativeRow): ClientTimelineTime {
    const value = field(row, 'created_at', 'text');
    if (value.state !== 'present')
        return { state: value.state, value: value.value, microseconds: null };
    // Only a private metadata comparison uses normalized grammar. Never modify the supplied raw timestamp.
    const micros = woundInstant((value.value as string).replace(' ', 'T'));
    return { state: micros === null ? 'invalid' : 'valid', value: value.value, microseconds: micros };
}
/** Whole supplied pools before projection. Stored event/status/signature words never infer clinical performance or approval. */
export function captureClientTimelineOriginals(input: unknown, scope: ClientNativeScope): ClientTimelineOriginalCollection {
    const whole = cloneClientNativeOriginal(input);
    if (!whole || typeof whole !== 'object' || Array.isArray(whole))
        throw Error('Die drei nativen Verlaufsquellen wurden nicht vollständig geliefert.');
    if (Object.keys(whole).length !== 3 || Object.keys(whole).some(key => !Object.hasOwn(CLIENT_TIMELINE_ORIGINAL_POOLS, key))) {
        throw Error('Der native Verlaufsbestand enthält Quellen außerhalb des geprüften Drei-Quellen-Vertrags.');
    }
    const pools = {} as Record<ClientTimelineOriginalKind, ClientNativeRow[]>;
    const entries: ClientTimelineOriginalEntry[] = [];
    for (const kind of Object.keys(CLIENT_TIMELINE_ORIGINAL_POOLS) as ClientTimelineOriginalKind[]) {
        if (!Object.hasOwn(whole, kind))
            throw Error('Eine native Verlaufsquelle fehlt; eine vollständige Projektion ist nicht bestätigt.');
        pools[kind] = captureClientNativePage((whole as Record<string, unknown>)[kind], scope, null);
        for (const row of pools[kind]) {
            entries.push({
                kind, key: `${kind}:${(row.id as string).toLowerCase()}`, nativeId: row.id as string,
                tenantId: row.tenant_id as string, clientId: row.client_id as string,
                title: field(row, kind === 'audit' ? 'action' : kind === 'document' ? 'summary' : 'title', 'text'),
                subtitle: field(row, kind === 'audit' ? 'details' : 'subtitle', 'text'),
                eventType: field(row, 'event_type', 'text'), status: field(row, 'status', 'text'),
                // Names remain names. No profile lookup or synthetic 'System' author; genuine supplied 'System' stays literal.
                originalActorName: field(row, 'actor_name', 'text'), actorProfileId: field(row, 'actor_profile_id', 'uuid'),
                documentId: field(row, 'document_id', 'uuid'), metadata: field(row, kind === 'document' ? 'metadata_json' : 'metadata'),
                timestamp: time(row), original: row,
            });
        }
    }
    entries.sort((left, right) => {
        const a = left.timestamp.microseconds, b = right.timestamp.microseconds;
        if (a !== null && b !== null && a !== b)
            return a > b ? -1 : 1;
        if (a === null && b !== null)
            return 1;
        if (a !== null && b === null)
            return -1;
        // A deterministic display tie, not a native sequence, revision, or deduplication rule.
        return left.key < right.key ? -1 : left.key > right.key ? 1 : 0;
    });
    return freezeClientNativeOriginal({ pools, entries });
}
