// Generated native presentation from src/lib/pflege/careQualityVisitTemporalEvidence.web.ts. Update through scripts/port-native-workspaces.mjs.
import { cloneClientNativeOriginal, freezeClientNativeOriginal, type ClientNativeRow } from "../clients/clientRecordNativeOriginal.native.ts";
import { woundUuid } from './woundCareDomain.ts';
import { medicationTimeDisplay } from "./medicationTimeDisplay.native.ts";
export type VisitTimeFieldStateWeb = 'not_supplied' | 'undefined' | 'null' | 'empty' | 'valid' | 'invalid';
export type VisitTimeEvidenceWeb = Readonly<{
    role: 'scheduled_plan' | 'documented_event' | 'next_visit_reference';
    state: VisitTimeFieldStateWeb;
    raw: string | null;
    display: string | null;
}>;
export type VisitStoredStatusWeb = Readonly<{
    state: 'not_supplied' | 'undefined' | 'null' | 'empty' | 'known' | 'unknown';
    value: 'planned' | 'completed' | 'cancelled' | null;
}>;
export type CareQualityVisitTemporalEvidenceWeb = Readonly<{
    provenance: 'supplied_unverified_excerpt';
    freshness: 'not_verified';
    completeness: 'not_verified';
    entries: readonly Readonly<{
        original: ClientNativeRow;
        storedStatus: VisitStoredStatusWeb;
        scheduled: VisitTimeEvidenceWeb;
        event: VisitTimeEvidenceWeb;
        nextVisit: VisitTimeEvidenceWeb;
    }>[];
    originals: readonly ClientNativeRow[];
}>;
export type CareQualityVisitTemporalResultWeb = Readonly<{
    ok: true;
    data: CareQualityVisitTemporalEvidenceWeb;
} | {
    ok: false;
    error: string;
}>;
const plain = (v: unknown): v is ClientNativeRow => !!v && typeof v === 'object' && !Array.isArray(v) && [Object.prototype, null].includes(Object.getPrototypeOf(v));
const invalid = () => Error('Der gelieferte Visitenauszug ist im eigenen Mandanten- oder Klientenbezug nicht verlustfrei prüfbar.');
function nativeId(row: ClientNativeRow, key: string): string { if (!Object.hasOwn(row, key) || !woundUuid(row[key]))
    throw invalid(); return row[key].toLowerCase(); }
function time(row: ClientNativeRow, key: string, role: VisitTimeEvidenceWeb['role']): VisitTimeEvidenceWeb {
    if (!Object.hasOwn(row, key))
        return { role, state: 'not_supplied', raw: null, display: null };
    const value = row[key];
    if (value === undefined)
        return { role, state: 'undefined', raw: null, display: null };
    if (value === null)
        return { role, state: 'null', raw: null, display: null };
    if (value === '')
        return { role, state: 'empty', raw: '', display: null };
    if (typeof value !== 'string')
        return { role, state: 'invalid', raw: null, display: null };
    // Reuse the private historical TIMESTAMPTZ display, including native space/offset/µs.
    // Calendar-only, malformed and unzoned values remain private originals, never event fallbacks.
    const formatted = medicationTimeDisplay(value);
    return { role, state: formatted.state === 'valid' ? 'valid' : 'invalid', raw: value, display: formatted.state === 'valid' ? formatted.display : null };
}
function storedStatus(row: ClientNativeRow): VisitStoredStatusWeb {
    if (!Object.hasOwn(row, 'status'))
        return { state: 'not_supplied', value: null };
    const value = row.status;
    if (value === undefined)
        return { state: 'undefined', value: null };
    if (value === null)
        return { state: 'null', value: null };
    if (value === '')
        return { state: 'empty', value: null };
    if (value === 'planned' || value === 'completed' || value === 'cancelled')
        return { state: 'known', value };
    return { state: 'unknown', value: null };
}
/** Pure supplied DTO evidence only: no permission receipt, complete SQL history, active case or clinical performance grant.
 * A stored status, narrative finding, plan date or event timestamp never supplies another field's meaning. */
export function projectCareQualityVisitTemporalEvidenceWeb(input: unknown, scope: unknown): CareQualityVisitTemporalResultWeb {
    try {
        const ownScope = cloneClientNativeOriginal(scope), whole = cloneClientNativeOriginal(input);
        if (!plain(ownScope) || !Array.isArray(whole))
            throw invalid();
        const tenant = nativeId(ownScope, 'tenantId');
        const client = Object.hasOwn(ownScope, 'clientId') ? nativeId(ownScope, 'clientId') : null;
        const ids = new Set<string>();
        // Every delivered row is checked before projecting any visible or selected evidence.
        for (const row of whole) {
            if (!plain(row))
                throw invalid();
            const id = nativeId(row, 'id'), rowClient = nativeId(row, 'clientId');
            if (ids.has(id) || nativeId(row, 'tenantId') !== tenant || client !== null && rowClient !== client)
                throw invalid();
            if (!Object.hasOwn(row, 'carePlanId') || row.carePlanId !== null && !woundUuid(row.carePlanId))
                throw invalid();
            ids.add(id);
        }
        const entries = whole.map(row => ({ original: row, storedStatus: storedStatus(row), scheduled: time(row, 'scheduledAt', 'scheduled_plan'), event: time(row, 'conductedAt', 'documented_event'), nextVisit: time(row, 'nextVisitAt', 'next_visit_reference') }));
        return freezeClientNativeOriginal({ ok: true, data: { provenance: 'supplied_unverified_excerpt', freshness: 'not_verified', completeness: 'not_verified', entries, originals: whole } });
    }
    catch {
        return { ok: false, error: invalid().message };
    }
}
