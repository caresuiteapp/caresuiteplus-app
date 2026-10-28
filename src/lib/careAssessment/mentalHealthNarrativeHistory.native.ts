// Generated native presentation from src/lib/careAssessment/mentalHealthNarrativeHistory.web.ts. Update through scripts/port-native-workspaces.mjs.
import { MentalHealthOriginalReader, currentMentalHealthOriginalsWeb, type MentalHealthReceipt, type MentalHealthRawOriginals } from "./mentalHealthOriginals.native.ts";
import { freezeClientNativeOriginal, type ClientNativeRow } from "../clients/clientRecordNativeOriginal.native.ts";
import { treatmentRecordedTimeDisplay } from "../pflege/treatmentTimeDisplay.native.ts";
import { woundInstant, woundUuid } from '../pflege/woundCareDomain';
export type MentalHistoryField = Readonly<{
    state: 'missing' | 'null' | 'empty' | 'value' | 'unresolved';
    value?: string | number | boolean | null;
}>;
export type MentalHistoryTime = Readonly<{
    purpose: 'actual_event' | 'actual_evaluation' | 'recorded' | 'updated' | 'review_agreement' | 'recorded_effective_start' | 'recorded_resolution';
    state: 'valid' | 'missing' | 'null' | 'empty' | 'unresolved';
    raw: string | null;
    display: string;
}>;
export type MentalHistoryTexts = Readonly<{
    state: MentalHistoryField['state'];
    values: readonly string[] | null;
}>;
export type MentalHistoryPerson = Readonly<{
    fields: Readonly<Record<string, MentalHistoryField>>;
    participants: MentalHistoryTexts;
    actors: Readonly<Record<string, MentalHistoryField>>;
    recordedAt: MentalHistoryTime;
    updatedAt: MentalHistoryTime;
    reviewAgreement: MentalHistoryTime;
    effectiveStartRecord: MentalHistoryTime;
}>;
export type MentalHistoryTopic = Readonly<{
    id: string;
    fields: Readonly<Record<string, MentalHistoryField>>;
    informationSources: MentalHistoryTexts;
    recordedAt: MentalHistoryTime;
    updatedAt: MentalHistoryTime;
}>;
export type MentalHistoryRisk = Readonly<{
    id: string;
    fields: Readonly<Record<string, MentalHistoryField>>;
    storedRefusal: MentalHistoryField;
    focusedResultState: 'missing' | 'null' | 'empty' | 'unprojected_unknown';
    recordedAt: MentalHistoryTime;
    updatedAt: MentalHistoryTime;
    reviewAgreement: MentalHistoryTime;
}>;
export type MentalHistoryMeasure = Readonly<{
    id: string;
    fields: Readonly<Record<string, MentalHistoryField>>;
    recordedAt: MentalHistoryTime;
    updatedAt: MentalHistoryTime;
    reviewAgreement: MentalHistoryTime;
}>;
export type MentalHistoryEvent = Readonly<{
    id: string;
    fields: Readonly<Record<string, MentalHistoryField>>;
    author: MentalHistoryField;
    storedReassessment: MentalHistoryField;
    payloadState: 'missing' | 'null' | 'empty' | 'unprojected_unknown';
    occurredAt: MentalHistoryTime;
    recordedAt: MentalHistoryTime;
    resolutionRecord: MentalHistoryTime;
}>;
export type MentalHistoryEvaluation = Readonly<{
    id: string;
    fields: Readonly<Record<string, MentalHistoryField>>;
    author: MentalHistoryField;
    evaluatedAt: MentalHistoryTime;
    recordedAt: MentalHistoryTime;
}>;
export type MentalHistoryCollection<T> = Readonly<{
    state: 'missing' | 'null' | 'empty' | 'supplied_native' | 'unprojected_unknown';
    values: readonly T[] | null;
}>;
export type MentalHistoryVersion = Readonly<{
    id: string;
    version: MentalHistoryField;
    transitionFrom: MentalHistoryField;
    transitionTo: MentalHistoryField;
    author: MentalHistoryField;
    authorName: MentalHistoryField;
    recordedAt: MentalHistoryTime;
    snapshot: Readonly<{
        state: 'supplied_native' | 'unprojected_unknown';
        person: MentalHistoryPerson | null;
        topics: MentalHistoryCollection<MentalHistoryTopic>;
        risks: MentalHistoryCollection<MentalHistoryRisk>;
        measures: MentalHistoryCollection<MentalHistoryMeasure>;
    }>;
}>;
export type MentalHealthNarrativeHistory = Readonly<{
    kind: 'mental_health_narrative_history';
    assessmentId: string;
    clientId: string;
    person: MentalHistoryPerson;
    topics: readonly MentalHistoryTopic[];
    risks: readonly MentalHistoryRisk[];
    measures: readonly MentalHistoryMeasure[];
    events: readonly MentalHistoryEvent[];
    evaluations: readonly MentalHistoryEvaluation[];
    links: readonly Readonly<{
        id: string;
        fields: Readonly<Record<string, MentalHistoryField>>;
        author: MentalHistoryField;
        recordedAt: MentalHistoryTime;
    }>[];
    versions: readonly MentalHistoryVersion[];
}>;
type Binding = {
    reader: MentalHealthOriginalReader;
    receipt: MentalHealthReceipt;
    originals: MentalHealthRawOriginals;
};
const views = new WeakMap<MentalHealthNarrativeHistory, Binding>();
const plain = (v: unknown): v is ClientNativeRow => !!v && typeof v === 'object' && !Array.isArray(v) && [Object.prototype, null].includes(Object.getPrototypeOf(v));
function field(row: ClientNativeRow, key: string, kind: 'text' | 'number' | 'boolean' | 'uuid' = 'text'): MentalHistoryField {
    if (!Object.hasOwn(row, key))
        return { state: 'missing' };
    const value = row[key];
    if (value === null)
        return { state: 'null', value: null };
    if (value === undefined)
        return { state: 'unresolved' };
    if (typeof value === 'string' && !value.trim())
        return { state: 'empty', value };
    if (kind === 'text' && typeof value === 'string' || kind === 'number' && typeof value === 'number' && Number.isFinite(value) || kind === 'boolean' && typeof value === 'boolean' || kind === 'uuid' && woundUuid(value))
        return { state: 'value', value: value as string | number | boolean };
    return { state: 'unresolved' };
}
const fields = (row: ClientNativeRow, keys: readonly string[]) => Object.fromEntries(keys.map(key => [key, field(row, key)]));
function texts(row: ClientNativeRow, key: string): MentalHistoryTexts {
    if (!Object.hasOwn(row, key))
        return { state: 'missing', values: null };
    const v = row[key];
    if (v === null)
        return { state: 'null', values: null };
    if (v === '')
        return { state: 'empty', values: null };
    return Array.isArray(v) && v.every(x => typeof x === 'string') ? { state: v.length ? 'value' : 'empty', values: [...v] } : { state: 'unresolved', values: null };
}
function unknownState(row: ClientNativeRow, key: string): MentalHistoryEvent['payloadState'] { if (!Object.hasOwn(row, key))
    return 'missing'; const v = row[key]; return v === null ? 'null' : v === '' || plain(v) && Object.keys(v).length === 0 ? 'empty' : 'unprojected_unknown'; }
function time(row: ClientNativeRow, key: string, purpose: MentalHistoryTime['purpose']): MentalHistoryTime {
    if (!Object.hasOwn(row, key))
        return { purpose, state: 'missing', raw: null, display: 'Originalzeit fehlt' };
    const raw = row[key], state = raw === null ? 'null' : raw === '' ? 'empty' : raw === undefined ? 'unresolved' : null;
    if (state)
        return { purpose, state, raw: typeof raw === 'string' ? raw : null, display: 'Originalzeit nicht bestätigt' };
    const shown = treatmentRecordedTimeDisplay(raw);
    return { purpose, state: shown.state === 'valid' ? 'valid' : 'unresolved', raw: shown.raw, display: shown.display };
}
function person(row: ClientNativeRow): MentalHistoryPerson { return { fields: fields(row, ['person_statement', 'statement_source', 'statement_source_name', 'communication_support', 'information_source_summary', 'professional_summary', 'change_summary', 'destabilization_summary', 'status']), participants: texts(row, 'conversation_participants'), actors: Object.fromEntries(['assessor_profile_id', 'approver_profile_id', 'created_by', 'updated_by'].map(key => [key, field(row, key, 'uuid')])), recordedAt: time(row, 'created_at', 'recorded'), updatedAt: time(row, 'updated_at', 'updated'), reviewAgreement: time(row, 'next_review_at', 'review_agreement'), effectiveStartRecord: time(row, 'effective_at', 'recorded_effective_start') }; }
function topic(row: ClientNativeRow): MentalHistoryTopic { return { id: String(row.id), fields: fields(row, ['topic_key', 'person_perspective', 'resources', 'impairments', 'wishes', 'habits_biography', 'professional_assessment', 'action_needed']), informationSources: texts(row, 'information_sources'), recordedAt: time(row, 'created_at', 'recorded'), updatedAt: time(row, 'updated_at', 'updated') }; }
function risk(row: ClientNativeRow): MentalHistoryRisk { return { id: String(row.id), fields: fields(row, ['risk_key', 'risk_state', 'urgency', 'evidence', 'protective_factors', 'professional_rationale', 'counseling_provided', 'person_decision', 'focused_assessment_key']), storedRefusal: field(row, 'refusal_documented', 'boolean'), focusedResultState: unknownState(row, 'focused_assessment_result'), recordedAt: time(row, 'created_at', 'recorded'), updatedAt: time(row, 'updated_at', 'updated'), reviewAgreement: time(row, 'next_review_at', 'review_agreement') }; }
function measure(row: ClientNativeRow): MentalHistoryMeasure { return { id: String(row.id), fields: fields(row, ['title', 'related_topic_key', 'related_risk_key', 'personal_goal', 'intervention', 'timing', 'frequency', 'responsible_role', 'person_contribution', 'relatives_contribution', 'warning_signs', 'escalation_path', 'evaluation_criteria', 'status']), recordedAt: time(row, 'created_at', 'recorded'), updatedAt: time(row, 'updated_at', 'updated'), reviewAgreement: time(row, 'next_evaluation_at', 'review_agreement') }; }
function event(row: ClientNativeRow): MentalHistoryEvent { return { id: String(row.id), fields: fields(row, ['event_type', 'severity', 'summary']), author: field(row, 'created_by', 'uuid'), storedReassessment: field(row, 'requires_reassessment', 'boolean'), payloadState: unknownState(row, 'event_payload'), occurredAt: time(row, 'occurred_at', 'actual_event'), recordedAt: time(row, 'created_at', 'recorded'), resolutionRecord: time(row, 'resolved_at', 'recorded_resolution') }; }
function evaluation(row: ClientNativeRow): MentalHistoryEvaluation { return { id: String(row.id), fields: fields(row, ['outcome', 'observed_effect', 'person_feedback', 'professional_conclusion', 'changes_required', 'evaluator_name_snapshot']), author: field(row, 'evaluator_profile_id', 'uuid'), evaluatedAt: time(row, 'evaluated_at', 'actual_evaluation'), recordedAt: time(row, 'created_at', 'recorded') }; }
function knownRows<T>(snapshot: ClientNativeRow, key: string, originals: MentalHealthRawOriginals, project: (row: ClientNativeRow) => T): MentalHistoryCollection<T> {
    if (!Object.hasOwn(snapshot, key))
        return { state: 'missing', values: null };
    const items = snapshot[key];
    if (items === null)
        return { state: 'null', values: null };
    if (!Array.isArray(items))
        return { state: 'unprojected_unknown', values: null };
    if (items.some(row => !plain(row) || !['id', 'tenant_id', 'assessment_id'].every(key => Object.hasOwn(row, key)) || !woundUuid(row.id) || row.tenant_id !== originals.assessment.tenant_id || row.assessment_id !== originals.assessment.id))
        return { state: 'unprojected_unknown', values: null };
    return { state: items.length ? 'supplied_native' : 'empty', values: items.map(project) };
}
function version(row: ClientNativeRow, originals: MentalHealthRawOriginals): MentalHistoryVersion {
    const raw = Object.hasOwn(row, 'snapshot') ? row.snapshot : undefined, root = plain(raw) && Object.hasOwn(raw, 'assessment') ? raw.assessment : null, known = plain(root) && ['id', 'tenant_id', 'subject_type', 'subject_id'].every(key => Object.hasOwn(root, key)) && root.id === originals.assessment.id && root.tenant_id === originals.assessment.tenant_id && root.subject_type === 'client' && root.subject_id === originals.assessment.subject_id;
    const unknown = { state: 'unprojected_unknown' as const, values: null };
    return { id: String(row.id), version: field(row, 'version', 'number'), transitionFrom: field(row, 'transition_from'), transitionTo: field(row, 'transition_to'), author: field(row, 'created_by', 'uuid'), authorName: field(row, 'actor_name'), recordedAt: time(row, 'created_at', 'recorded'), snapshot: known ? { state: 'supplied_native', person: person(root), topics: knownRows(raw as ClientNativeRow, 'topics', originals, topic), risks: knownRows(raw as ClientNativeRow, 'risks', originals, risk), measures: knownRows(raw as ClientNativeRow, 'measures', originals, measure) } : { state: 'unprojected_unknown', person: null, topics: unknown, risks: unknown, measures: unknown } };
}
function compareActual(a: MentalHistoryTime, b: MentalHistoryTime): number { const l = a.state === 'valid' && a.raw !== null ? woundInstant(a.raw.replace(' ', 'T')) : null, r = b.state === 'valid' && b.raw !== null ? woundInstant(b.raw.replace(' ', 'T')) : null; return l === null ? (r === null ? 0 : 1) : r === null ? -1 : l > r ? -1 : l < r ? 1 : 0; }
/** Fixed narrative metadata only. Unknown screening/event JSON stays in the private original, never serialized
 * into this view. Explicit saved risk/topic keys are not native FK or proof of diagnosis/conduct/intervention. */
export function captureMentalHealthNarrativeHistory(reader: MentalHealthOriginalReader, receipt: MentalHealthReceipt): MentalHealthNarrativeHistory | null {
    if (!(reader instanceof MentalHealthOriginalReader))
        return null;
    const originals = currentMentalHealthOriginalsWeb(reader, receipt);
    if (!originals)
        return null;
    const p = originals.pools;
    const events = p.events.map(event), evaluations = p.evaluations.map(evaluation);
    events.sort((a, b) => compareActual(a.occurredAt, b.occurredAt));
    evaluations.sort((a, b) => compareActual(a.evaluatedAt, b.evaluatedAt));
    const view = freezeClientNativeOriginal({ kind: 'mental_health_narrative_history' as const, assessmentId: String(originals.assessment.id), clientId: String(originals.assessment.subject_id), person: person(originals.assessment), topics: p.topics.map(topic), risks: p.risks.map(risk), measures: p.measures.map(measure), events, evaluations, links: p.links.map(row => ({ id: String(row.id), fields: { ...fields(row, ['entity_type', 'relation', 'label']), entity_id: field(row, 'entity_id', 'uuid') }, author: field(row, 'created_by', 'uuid'), recordedAt: time(row, 'created_at', 'recorded') })), versions: p.versions.map(row => version(row, originals)) });
    if (currentMentalHealthOriginalsWeb(reader, receipt) !== originals)
        return null;
    views.set(view, { reader, receipt, originals });
    return view;
}
export function currentMentalHealthNarrativeHistory(view: MentalHealthNarrativeHistory, reader: MentalHealthOriginalReader): boolean { const own = views.get(view); return !!own && own.reader === reader && currentMentalHealthOriginalsWeb(reader, own.receipt) === own.originals; }
/** Exact original selection at invocation; retained callbacks must repeat this after any await. */
export function currentMentalHealthNarrativeEvent(view: MentalHealthNarrativeHistory, reader: MentalHealthOriginalReader, id: string): MentalHistoryEvent | null { if (!currentMentalHealthNarrativeHistory(view, reader) || !woundUuid(id))
    return null; return view.events.find(row => row.id === id) ?? null; }
export function currentMentalHealthNarrativeVersion(view: MentalHealthNarrativeHistory, reader: MentalHealthOriginalReader, id: string): MentalHistoryVersion | null { if (!currentMentalHealthNarrativeHistory(view, reader) || !woundUuid(id))
    return null; return view.versions.find(row => row.id === id) ?? null; }
