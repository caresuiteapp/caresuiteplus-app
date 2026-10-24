// Generated native presentation from src/lib/pflege/careQualityVisitOriginalHistory.web.ts. Update through scripts/port-native-workspaces.mjs.
import { currentCareQualityVisitOriginalsWeb, type CareQualityVisitOriginalReader, type CareQualityVisitOriginalReceipt } from "./careQualityVisitOriginals.native.ts";
import { freezeClientNativeOriginal, type ClientNativeRow } from "../clients/clientRecordNativeOriginal.native.ts";
import { medicationTimeDisplay } from "./medicationTimeDisplay.native.ts";
import { woundUuid } from './woundCareDomain';
type Field = Readonly<{
    state: 'missing' | 'undefined' | 'null' | 'empty' | 'value' | 'unresolved';
    value: string | null;
}>;
type Time = Readonly<{
    purpose: 'planned_visit' | 'stored_visit_event' | 'next_visit_reference' | 'recorded' | 'updated';
    state: 'missing' | 'undefined' | 'null' | 'empty' | 'valid' | 'invalid' | 'unresolved';
    raw: string | null;
    display: string | null;
}>;
const plain = (value: unknown): value is ClientNativeRow => !!value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
function text(row: ClientNativeRow, key: string): Field {
    if (!Object.hasOwn(row, key))
        return { state: 'missing', value: null };
    const value = row[key];
    if (value === undefined)
        return { state: 'undefined', value: null };
    if (value === null)
        return { state: 'null', value: null };
    if (value === '')
        return { state: 'empty', value: '' };
    return typeof value === 'string' ? { state: 'value', value } : { state: 'unresolved', value: null };
}
function time(row: ClientNativeRow, key: string, purpose: Time['purpose']): Time {
    const f = text(row, key);
    if (f.state !== 'value')
        return { purpose, state: f.state, raw: f.value, display: null };
    const result = medicationTimeDisplay(f.value);
    return { purpose, state: result.state === 'valid' ? 'valid' : 'invalid', raw: f.value, display: result.state === 'valid' ? result.display : null };
}
function nativeId(row: ClientNativeRow, key: string): Field { const f = text(row, key); return f.state === 'value' && !woundUuid(f.value) ? { state: 'unresolved', value: null } : f; }
function calendar(row: ClientNativeRow, key: string): Field {
    const f = text(row, key);
    if (f.state !== 'value')
        return f;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f.value!);
    if (!match)
        return { state: 'unresolved', value: null };
    const y = Number(match[1]), m = Number(match[2]), d = Number(match[3]), days = m === 2 ? 28 + (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 1 : 0) : [4, 6, 9, 11].includes(m) ? 30 : 31;
    return y > 0 && m >= 1 && m <= 12 && d >= 1 && d <= days ? f : { state: 'unresolved', value: null };
}
function visit(row: ClientNativeRow) {
    return {
        id: String(row.id), carePlanId: nativeId(row, 'care_plan_id'), storedStatus: text(row, 'status'), visitType: text(row, 'visit_type'), scope: text(row, 'scope'), findings: text(row, 'findings'), deviations: text(row, 'deviations'),
        agreedActions: text(row, 'agreed_actions'), personFeedback: text(row, 'person_feedback'), visitorId: nativeId(row, 'visitor_profile_id'), visitorName: text(row, 'visitor_name_snapshot'),
        scheduled: time(row, 'scheduled_at', 'planned_visit'), event: time(row, 'conducted_at', 'stored_visit_event'), nextVisit: time(row, 'next_visit_at', 'next_visit_reference'), recorded: time(row, 'created_at', 'recorded'), updated: time(row, 'updated_at', 'updated'),
    };
}
function snapshot(row: ClientNativeRow, key: string, entityId: string | null) {
    if (!Object.hasOwn(row, key))
        return { state: 'missing' as const, value: null };
    const value = row[key];
    if (value === null)
        return { state: 'null' as const, value: null };
    // Snapshot ID is never a fallback link. All mandatory native snapshot identity must be OWN data.
    if (!plain(value) || !['id', 'tenant_id', 'client_id'].every(k => Object.hasOwn(value, k) && woundUuid(value[k])))
        return { state: 'opaque_legacy' as const, value: null };
    // Even an ID matching the native audit entity cannot mint a historical own-source version
    // from incomplete/null legacy scope or a different native tenant/client.
    if (String(value.tenant_id).toLowerCase() !== String(row.tenant_id).toLowerCase() || String(value.client_id).toLowerCase() !== String(row.client_id).toLowerCase())
        return { state: 'opaque_legacy' as const, value: null };
    if (entityId === null)
        return { state: 'unresolved_entity' as const, value: null };
    if (String(value.id).toLowerCase() !== entityId.toLowerCase())
        return { state: 'snapshot_mismatch' as const, value: null };
    return { state: 'supplied_matching_snapshot' as const, value: visit(value) };
}
/** Query-free primitive projection of one native current Visit and its actual audit.entity_id references.
 * Stored snapshots are not as-of revisions; UUID pagination/order is not clinical chronology. */
export function captureCareQualityVisitOriginalHistoryWeb(reader: CareQualityVisitOriginalReader, receipt: CareQualityVisitOriginalReceipt, selectedId: unknown) {
    if (!woundUuid(selectedId))
        return null;
    const originals = currentCareQualityVisitOriginalsWeb(reader, receipt);
    if (!originals)
        return null;
    const current = originals.visits.find(row => String(row.id).toLowerCase() === selectedId.toLowerCase());
    if (!current)
        return null;
    const planId = current.care_plan_id, plan = planId === null ? null : originals.plans.find(row => String(row.id).toLowerCase() === String(planId).toLowerCase());
    const related = originals.audits.filter(row => typeof row.entity_id === 'string' && row.entity_id.toLowerCase() === selectedId.toLowerCase());
    const unlinked = originals.audits.filter(row => row.entity_id === null || !originals.visits.some(visit => String(visit.id).toLowerCase() === String(row.entity_id).toLowerCase()));
    const result = freezeClientNativeOriginal({
        provenance: 'supplied_scoped_originals' as const, atomicSnapshot: false as const, asOfHistory: false as const, current: visit(current),
        currentPlan: { relation: planId === null ? 'no_plan' : plan ? 'supplied_current_plan' : 'not_delivered', id: planId === null ? null : String(planId), title: plan ? text(plan, 'title') : null, storedStatus: plan ? text(plan, 'status') : null, validFrom: plan ? calendar(plan, 'valid_from') : null, validUntil: plan ? calendar(plan, 'valid_until') : null, recorded: plan ? time(plan, 'created_at', 'recorded') : null, updated: plan ? time(plan, 'updated_at', 'updated') : null },
        audits: related.map(row => ({ id: String(row.id), entityId: String(row.entity_id), action: text(row, 'action'), summary: text(row, 'summary'), actorId: nativeId(row, 'actor_id'), actorName: text(row, 'actor_name'), recorded: time(row, 'created_at', 'recorded'), before: snapshot(row, 'before_data', String(row.entity_id)), after: snapshot(row, 'after_data', String(row.entity_id)) })),
        unresolvedAuditReferences: unlinked.map(row => ({ id: String(row.id), entityId: row.entity_id === null ? null : String(row.entity_id), reason: row.entity_id === null ? 'no_native_entity' : 'visit_not_delivered' })),
    });
    // Consumption cannot expose a projection if a getter/runtime callback retired the source meanwhile.
    return currentCareQualityVisitOriginalsWeb(reader, receipt) === originals ? result : null;
}
