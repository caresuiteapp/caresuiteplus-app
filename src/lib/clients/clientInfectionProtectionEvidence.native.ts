// Generated native presentation from src/lib/clients/clientInfectionProtectionEvidence.web.ts. Update through scripts/port-native-workspaces.mjs.
import { captureClientNativePage, freezeClientNativeOriginal, type ClientNativeRow, type ClientNativeScope, } from "./clientRecordNativeOriginal.native.ts";
export type ClientInfectionProtectionFieldWeb = Readonly<{
    state: 'missing' | 'undefined' | 'null' | 'empty' | 'value' | 'unresolved';
    value: string | null;
}>;
export type ClientInfectionProtectionEntryWeb = Readonly<{
    nativeId: string;
    infectionNotes: ClientInfectionProtectionFieldWeb;
    hygieneNotes: ClientInfectionProtectionFieldWeb;
    createdAt: ClientInfectionProtectionFieldWeb;
    updatedAt: ClientInfectionProtectionFieldWeb;
    suspectedStatus: 'not_provided';
    confirmedStatus: 'not_provided';
    statusSeparation: 'not_possible_from_current_schema';
    sourceRelation: 'not_provided';
    protectionMeasuresRelation: 'not_provided';
    clinicalFreshness: 'not_inferred';
    accessEvidence: 'current_sensitive_read_only';
}>;
export type ClientInfectionProtectionEvidenceWeb = Readonly<{
    originals: readonly ClientNativeRow[];
    entries: readonly ClientInfectionProtectionEntryWeb[];
    snapshot: 'non_atomic_delivered_rows';
}>;
function field(row: ClientNativeRow, key: string): ClientInfectionProtectionFieldWeb {
    if (!Object.hasOwn(row, key))
        return { state: 'missing', value: null };
    const descriptor = Object.getOwnPropertyDescriptor(row, key);
    if (!descriptor || !('value' in descriptor))
        return { state: 'unresolved', value: null };
    const value = descriptor.value;
    if (value === undefined)
        return { state: 'undefined', value: null };
    if (value === null)
        return { state: 'null', value: null };
    if (value === '')
        return { state: 'empty', value: '' };
    return typeof value === 'string'
        ? { state: 'value', value }
        : { state: 'unresolved', value: null };
}
/**
 * Lossless projection of the complete delivered ambulatory-detail row.
 * Free text and general row timestamps never become infection status, source,
 * protection-measure confirmation or clinical freshness.
 */
export function captureClientInfectionProtectionEvidenceWeb(input: unknown, scope: ClientNativeScope): ClientInfectionProtectionEvidenceWeb {
    const originals = captureClientNativePage(input, scope, null);
    if (originals.length > 1) {
        throw Error('Mehrere native ambulante Detailzeilen sind für dieselbe Akte nicht eindeutig.');
    }
    const entries = freezeClientNativeOriginal(originals.map((row) => ({
        nativeId: row.id as string,
        infectionNotes: field(row, 'infection_notes'),
        hygieneNotes: field(row, 'hygiene_notes'),
        createdAt: field(row, 'created_at'),
        updatedAt: field(row, 'updated_at'),
        suspectedStatus: 'not_provided' as const,
        confirmedStatus: 'not_provided' as const,
        statusSeparation: 'not_possible_from_current_schema' as const,
        sourceRelation: 'not_provided' as const,
        protectionMeasuresRelation: 'not_provided' as const,
        clinicalFreshness: 'not_inferred' as const,
        accessEvidence: 'current_sensitive_read_only' as const,
    })));
    return freezeClientNativeOriginal({
        originals,
        entries,
        snapshot: 'non_atomic_delivered_rows' as const,
    });
}
