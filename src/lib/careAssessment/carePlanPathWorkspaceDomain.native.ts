// Generated native presentation from src/lib/careAssessment/carePlanPathWorkspaceDomain.web.ts. Update through scripts/port-native-workspaces.mjs.
import { assessmentPathVersion, validateAssessmentPathCommand } from "./assessmentPathWorkspaceDomain.native.ts";
import { cloneClientNativeOriginal, freezeClientNativeOriginal, sameClientNativeOriginal } from "../clients/clientRecordNativeOriginal.native.ts";
export const carePlanPathVersion = 'care-plan-path-workspace-v2' as const;
export const carePlanPathKinds = ['goal_plan', 'measure_plan', 'daily_routine', 'support_boundary', 'responsibility_assignment', 'schedule_commitment', 'plan_review_request', 'plan_review_return', 'plan_release_decision', 'execution_record', 'non_execution_record', 'deviation_assessment', 'effect_observation', 'regular_evaluation', 'visit_observation', 'visit_decision', 'change_order', 'correction'] as const;
export type CarePlanPathKind = (typeof carePlanPathKinds)[number];
export type CarePlanPathSource = {
    kind: string;
    id: string;
    snapshot: Record<string, unknown>;
};
type Field = {
    key: string;
    label: string;
    type?: 'text' | 'date' | 'instant' | 'uuid' | 'sha256' | 'enum';
    values?: readonly string[];
};
type Source = {
    key: string;
    label: string;
    kinds: readonly string[];
    eventKinds?: readonly string[];
};
export type CarePlanPathDefinition = {
    group: string;
    label: string;
    right: string;
    extraRights?: readonly string[];
    sources: readonly Source[];
    fields: readonly Field[];
};
const f = (key: string, label: string, type: Field['type'] = 'text', values?: readonly string[]): Field => ({ key, label, type, ...(values ? { values } : {}) });
const s = (key: string, label: string, ...kinds: string[]): Source => ({ key, label, kinds });
const e = (key: string, label: string, ...eventKinds: string[]): Source => ({ key, label, kinds: ['care_plan_path_event'], eventKinds });
const a = (key: string, label: string, ...eventKinds: string[]): Source => ({ key, label, kinds: ['assessment_path_event'], eventKinds });
export const carePlanPathDefinitions: Record<CarePlanPathKind, CarePlanPathDefinition> = {
    goal_plan: { group: 'Ziele & Maßnahmen', label: 'Individuelles Pflegeziel als Planfassung erfassen', right: 'pflege.assessments.manage', sources: [s('assessment', 'Assessmentfassung', 'care_assessment'), { ...a('finding', 'Einschätzungsoriginal', 'cognition_assessment', 'mobility_assessment', 'disease_demands_assessment', 'self_care_assessment', 'household_assessment', 'social_relationships_assessment', 'risk_screening', 'risk_deep_assessment'), kinds: ['assessment_path_event', 'assessment_topic', 'assessment_risk'] }, s('goal', 'Zieloriginal', 'assessment_measure')], fields: [f('outcome', 'Beobachtbares Ergebnis'), f('baseline', 'Ausgangslage'), f('priority', 'Gemeinsam vereinbarte Priorität'), f('reviewAt', 'Prüftermin', 'instant')] },
    measure_plan: { group: 'Ziele & Maßnahmen', label: 'Maßnahme konkret und ausführbar planen', right: 'pflege.assessments.manage', sources: [e('goal', 'Zielplanung', 'goal_plan'), s('measure', 'Maßnahmenoriginal', 'assessment_measure')], fields: [f('action', 'Was und wie'), f('frequency', 'Wann und wie häufig'), f('aids', 'Hilfsmittel'), f('responsibleRole', 'Verantwortliche Rolle')] },
    daily_routine: { group: 'Ziele & Maßnahmen', label: 'Tagesstruktur und Gewohnheiten ausdrücklich planen', right: 'pflege.assessments.manage', sources: [s('assessment', 'Assessmentfassung', 'care_assessment'), e('plan', 'Planungsoriginal', 'goal_plan', 'measure_plan')], fields: [f('timeWindow', 'Zeitfenster'), f('ritual', 'Ritual oder Gewohnheit'), f('preference', 'Individuelle Präferenz'), f('dependency', 'Abhängigkeit und Konfliktregel')] },
    support_boundary: { group: 'Ressourcen & Verantwortung', label: 'Unterstützungsgrad getrennt festlegen', right: 'pflege.assessments.manage', sources: [e('plan', 'Planungsoriginal', 'goal_plan', 'measure_plan'), { ...a('finding', 'Ressourcenoriginal', 'cognition_assessment', 'mobility_assessment', 'self_care_assessment', 'household_assessment'), kinds: ['assessment_path_event', 'assessment_topic'] }], fields: [f('supportLevel', 'Geplante Unterstützung', 'enum', ['self', 'guidance', 'partial_assistance', 'full_assistance']), f('ownContribution', 'Eigenleistung'), f('professionalBoundary', 'Pflegefachliche Grenze')] },
    responsibility_assignment: { group: 'Ressourcen & Verantwortung', label: 'Verantwortung und Vertretung zuordnen', right: 'pflege.assessments.manage', sources: [e('measure', 'Maßnahmenplanung', 'measure_plan'), s('employee', 'Personaloriginal', 'employee_profile')], fields: [f('responsibleRole', 'Verantwortliche Rolle'), f('substituteRule', 'Vertretungsregel'), f('qualificationBoundary', 'Qualifikationsgrenze')] },
    schedule_commitment: { group: 'Ressourcen & Verantwortung', label: 'Termin und Häufigkeit verbindlich planen', right: 'pflege.assessments.manage', sources: [e('measure', 'Maßnahmenplanung', 'measure_plan'), e('routine', 'Tagesstruktur', 'daily_routine')], fields: [f('startsAt', 'Planbeginn', 'instant'), f('dueAt', 'Planfrist', 'instant'), f('frequency', 'Häufigkeit'), f('exceptionRule', 'Ausnahme- und Nachholregel')] },
    plan_review_request: { group: 'Fassung & Freigabe', label: 'Vollständige Planfassung zur Prüfung geben', right: 'pflege.assessments.manage', sources: [s('assessment', 'Assessmentfassung', 'care_assessment'), e('goal', 'Zielplanung', 'goal_plan'), e('measure', 'Maßnahmenplanung', 'measure_plan'), e('schedule', 'Terminplanung', 'schedule_commitment')], fields: [f('reason', 'Prüfanlass'), f('packetSha256', 'Prüfpaketbeleg', 'sha256')] },
    plan_review_return: { group: 'Fassung & Freigabe', label: 'Planfassung begründet zurückgeben', right: 'pflege.audit.view', sources: [e('review', 'Prüfanfrage', 'plan_review_request'), s('assessment', 'Assessmentfassung', 'care_assessment')], fields: [f('reason', 'Rückgabegrund'), f('requiredChange', 'Erforderliche Planänderung')] },
    plan_release_decision: { group: 'Fassung & Freigabe', label: 'Planfassung getrennt freigeben oder zurückgeben', right: 'pflege.audit.view', sources: [e('review', 'Prüfanfrage', 'plan_review_request'), s('reviewer', 'Prüfpersonenoriginal', 'employee_profile')], fields: [f('decision', 'Freigabeentscheidung', 'enum', ['approved', 'returned']), f('validFrom', 'Gültig ab', 'instant'), f('rationale', 'Entscheidungsbegründung'), f('releaseSha256', 'Freigabebeleg', 'sha256')] },
    execution_record: { group: 'Durchführung & Abweichung', label: 'Tatsächliche Durchführung dokumentieren', right: 'pflege.assessments.manage', sources: [e('releasedPlan', 'Freigegebene Planfassung', 'plan_release_decision'), s('execution', 'Einsatz-/Durchführungsoriginal', 'care_visit', 'care_execution')], fields: [f('executionState', 'Durchführungsumfang', 'enum', ['partly_performed', 'performed']), f('performedAt', 'Tatsächlicher Zeitpunkt', 'instant'), f('observation', 'Tatsächliche Beobachtung')] },
    non_execution_record: { group: 'Durchführung & Abweichung', label: 'Nichtdurchführung ausdrücklich dokumentieren', right: 'pflege.assessments.manage', sources: [e('releasedPlan', 'Freigegebene Planfassung', 'plan_release_decision'), s('execution', 'Einsatz-/Durchführungsoriginal', 'care_visit', 'care_execution')], fields: [f('reason', 'Konkreter Nichtdurchführungsgrund'), f('observedAt', 'Feststellungszeitpunkt', 'instant'), f('immediateAction', 'Tatsächliche unmittelbare Handlung')] },
    deviation_assessment: { group: 'Durchführung & Abweichung', label: 'Abweichung fachlich prüfen und Folgeauftrag setzen', right: 'pflege.assessments.manage', sources: [e('plan', 'Planfassung', 'plan_release_decision'), e('execution', 'Durchführungs- oder Nichtdurchführungsbeleg', 'execution_record', 'non_execution_record')], fields: [f('deviation', 'Konkrete Abweichung'), f('priority', 'Priorität', 'enum', ['routine', 'urgent', 'immediate']), f('followUp', 'Prüfbarer Folgeauftrag'), f('dueAt', 'Folgefrist', 'instant')] },
    effect_observation: { group: 'Wirkung & Evaluation', label: 'Beobachtete Wirkung getrennt erfassen', right: 'pflege.assessments.manage', sources: [e('execution', 'Durchführungsbeleg', 'execution_record'), s('evaluation', 'Evaluationsoriginal', 'assessment_evaluation')], fields: [f('effectState', 'Beobachtete Wirkung', 'enum', ['effective', 'partly_effective', 'not_effective', 'not_assessable']), f('observedEffect', 'Beobachtete Veränderung'), f('personFeedback', 'Rückmeldung der Person')] },
    regular_evaluation: { group: 'Wirkung & Evaluation', label: 'Regelmäßige Evaluation entscheiden', right: 'pflege.assessments.manage', sources: [e('goal', 'Zielplanung', 'goal_plan'), e('effect', 'Wirkungsbeobachtung', 'effect_observation'), s('evaluation', 'Evaluationsoriginal', 'assessment_evaluation')], fields: [f('decision', 'Evaluationsentscheidung', 'enum', ['continue', 'change', 'close', 'not_assessable']), f('rationale', 'Pflegefachliche Begründung'), f('nextReviewAt', 'Nächster Prüftermin', 'instant')] },
    visit_observation: { group: 'Pflegevisite', label: 'Pflegevisite und Abweichung dokumentieren', right: 'pflege.assessments.manage', sources: [e('releasedPlan', 'Freigegebene Planfassung', 'plan_release_decision'), s('visit', 'Visitenoriginal', 'care_visit'), e('evaluation', 'Evaluationsstand', 'regular_evaluation')], fields: [f('participants', 'Beteiligte'), f('checkpoint', 'Prüfpunkt'), f('finding', 'Tatsächliche Feststellung'), f('deviation', 'Planabweichung')] },
    visit_decision: { group: 'Pflegevisite', label: 'Visitenbeschluss und Nachhalten trennen', right: 'pflege.audit.view', sources: [e('visit', 'Visitenfeststellung', 'visit_observation'), s('reviewer', 'Prüfpersonenoriginal', 'employee_profile')], fields: [f('decision', 'Beschluss'), f('implementationOrder', 'Umsetzungsauftrag'), f('dueAt', 'Nachhaltefrist', 'instant'), f('acceptanceBoundary', 'Abnahmegrenze')] },
    change_order: { group: 'Anpassung', label: 'Anlassbezogene Planänderung beauftragen', right: 'pflege.assessments.manage', sources: [e('currentPlan', 'Aktuelle Planfassung', 'plan_release_decision'), s('trigger', 'Änderungsoriginal', 'care_observation', 'care_event', 'assessment_evaluation', 'care_plan_path_event')], fields: [f('reason', 'Konkreter Änderungsanlass'), f('scope', 'Änderungsumfang'), f('responsibleRole', 'Zuständige Rolle'), f('dueAt', 'Änderungsfrist', 'instant')] },
    correction: { group: 'Berichtigung', label: 'Unveränderlichen Pflegeplanpfadvorgang berichtigen', right: 'pflege.assessments.manage', sources: [], fields: [f('targetId', 'Zu berichtigender Vorgang', 'uuid'), f('reason', 'Berichtigungsgrund'), f('evidenceSha256', 'Berichtigungsbeleg', 'sha256')] }
};
export const carePlanPathReadRights = ['pflege.plans.view'] as const;
export const carePlanPathWorkspaceDefinitions = carePlanPathDefinitions;
export const carePlanPathWorkspaceReadRights = carePlanPathReadRights;
export type CarePlanPathWorkspaceKind = CarePlanPathKind;
export type CarePlanPathCommand = {
    version: typeof carePlanPathVersion;
    requestId: string;
    eventId: string;
    tenantId: string;
    assessmentId: string;
    actorId: string;
    expectedHeadId: string | null;
    kind: CarePlanPathKind;
    occurredAt: string;
    note: string;
    payload: Record<string, unknown>;
};
export type CarePlanPathEvent = {
    id: string;
    sequence: number;
    previousId: string | null;
    tenantId: string;
    assessmentId: string;
    actorId: string;
    actorName: string;
    recordedAt: string;
    command: CarePlanPathCommand;
};
export type CarePlanPathHistory = {
    version: typeof carePlanPathVersion;
    tenantId: string;
    assessmentId: string;
    count: number;
    headId: string | null;
    events: CarePlanPathEvent[];
};
export type CarePlanPathContext = {
    version: typeof carePlanPathVersion;
    tenantId: string;
    assessmentId: string;
    actorId: string;
    loadedAt: string;
    stateFingerprint: string;
    supportedWriteKinds: CarePlanPathKind[];
    sources: {
        count: number;
        rows: CarePlanPathSource[];
    };
    history: CarePlanPathHistory;
};
export type CarePlanPathReceipt = {
    version: typeof carePlanPathVersion;
    requestId: string;
    command: CarePlanPathCommand;
    event: CarePlanPathEvent;
};
export type CarePlanPathState = {
    headId: string | null;
    events: CarePlanPathEvent[];
    corrected: string[];
};
/** Technical capability policy only; historical commands remain separately readable. */
export const carePlanPathSupportedWriteKinds = ['goal_plan', 'measure_plan', 'daily_routine', 'support_boundary', 'schedule_commitment', 'plan_review_request', 'correction'] as const;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const sha = /^[0-9a-f]{64}$/;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: unknown, keys: readonly string[]) => object(v) && Object.keys(v).length === keys.length && keys.every(key => Object.hasOwn(v, key));
const commandKeys = ['version', 'requestId', 'eventId', 'tenantId', 'assessmentId', 'actorId', 'expectedHeadId', 'kind', 'occurredAt', 'note', 'payload'];
const eventKeys = ['id', 'sequence', 'previousId', 'tenantId', 'assessmentId', 'actorId', 'actorName', 'recordedAt', 'command'];
const historyKeys = ['version', 'tenantId', 'assessmentId', 'count', 'headId', 'events'];
const contextKeys = ['version', 'tenantId', 'assessmentId', 'actorId', 'loadedAt', 'stateFingerprint', 'supportedWriteKinds', 'sources', 'history'];
const text = (v: unknown, label: string, max = 8000): string => { if (typeof v !== 'string' || !v.trim() || v.length > max)
    throw Error(`${label} fehlt oder ist zu lang.`); return v; };
const id = (v: unknown, label: string): string => { const x = text(v, label, 36); if (x.length !== 36 || !uuid.test(x))
    throw Error(`${label} ist ungültig.`); return x; };
/** Retain PostgreSQL microseconds, real calendar dates and the explicit original offset. */
export function carePlanPathInstantMicros(value: unknown): bigint | null {
    if (typeof value !== 'string')
        return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
    if (!m || m[0] !== value || Number(m[1]) < 1000 || Number(m[4]) > 23 || Number(m[5]) > 59 || Number(m[6]) > 59)
        return null;
    const day = `${m[1]}-${m[2]}-${m[3]}`, date = Date.parse(`${day}T00:00:00Z`);
    if (!Number.isFinite(date) || new Date(date).toISOString().slice(0, 10) !== day)
        return null;
    if (m[8] !== 'Z') {
        const h = Number(m[8].slice(1, 3)), minute = Number(m[8].slice(4));
        if (h > 14 || minute > 59 || h === 14 && minute !== 0)
            return null;
    }
    const whole = Date.parse(`${day}T${m[4]}:${m[5]}:${m[6]}${m[8]}`);
    return Number.isFinite(whole) ? BigInt(whole) * 1000n + BigInt((m[7] ?? '').padEnd(6, '0')) : null;
}
const time = (v: unknown, label: string): string => { if (carePlanPathInstantMicros(v) === null)
    throw Error(`${label} ist ungültig.`); return v as string; };
function capture<T>(value: T): T {
    const copied = cloneClientNativeOriginal(value);
    let nodes = 0;
    const visit = (v: unknown, depth: number): void => { if (v === undefined || depth > 64 || ++nodes > 500000)
        throw Error('Das vollständige Originalformat ist nicht verlustfrei prüfbar.'); if (v && typeof v === 'object')
        for (const child of Object.values(v))
            visit(child, depth + 1); };
    visit(copied, 0);
    if (new TextEncoder().encode(JSON.stringify(copied)).length > 16777216)
        throw Error('Der vollständige Bestand überschreitet die sicher prüfbare Grenze.');
    return copied;
}
function scopeOf(value: {
    tenantId: string;
    assessmentId: string;
    actorId?: string;
}, actor = false): {
    tenantId: string;
    assessmentId: string;
    actorId?: string;
} {
    const out: Record<string, unknown> = {};
    for (const key of actor ? ['tenantId', 'assessmentId', 'actorId'] : ['tenantId', 'assessmentId']) {
        const d = Object.getOwnPropertyDescriptor(value, key);
        if (!d || !('value' in d) || !d.enumerable)
            throw Error('Ungeklärte Originalzuordnung.');
        out[key] = id(d.value, key);
    }
    return out as {
        tenantId: string;
        assessmentId: string;
        actorId?: string;
    };
}
function sourceScope(value: unknown, scope: {
    tenantId: string;
    assessmentId: string;
}): void {
    if (Array.isArray(value)) {
        for (const child of value)
            sourceScope(child, scope);
        return;
    }
    if (!object(value))
        return;
    for (const key of ['tenant_id', 'tenantId'])
        if (Object.hasOwn(value, key) && value[key] !== scope.tenantId)
            throw Error('Ausgewählte Originale gehören nicht zum aktuellen Mandanten.');
    for (const key of ['assessment_id', 'assessmentId'])
        if (Object.hasOwn(value, key) && value[key] !== scope.assessmentId)
            throw Error('Ausgewählte Originale gehören nicht zum aktuellen Assessment.');
    for (const child of Object.values(value))
        sourceScope(child, scope);
}
function sourceInternal(v: unknown, label: string): asserts v is CarePlanPathSource {
    if (!exact(v, ['id', 'kind', 'snapshot']) || !object(v))
        throw Error(`${label} ist unvollständig.`);
    id(v.id, `${label}-ID`);
    text(v.kind, `${label}-Art`, 200);
    if (!object(v.snapshot) || v.snapshot.id !== v.id)
        throw Error(`${label} stimmt nicht mit dem nativen Original überein.`);
    if (typeof v.kind === 'string' && v.kind.endsWith('_path_event'))
        embeddedEvent(v.snapshot, v.kind);
    else if (v.kind === 'assessment_instrument' && !Object.hasOwn(v.snapshot, 'tenant_id'))
        globalInstrument(v.snapshot);
    else
        id(v.snapshot.tenant_id, 'Nativer Quellenmandant');
}
/** Native global catalog rows have no tenant fields; preserve them without invented ownership. */
function globalInstrument(row: Record<string, unknown>): void {
    for (const key of ['key', 'title', 'instrument_version', 'source_revision'])
        text(row[key], `Globales Instrument: ${key}`);
    if (!['caresuite', 'licensed_external', 'external_reference'].includes(String(row.ownership)) || !['active', 'unavailable', 'retired'].includes(String(row.availability)) || !['owned', 'licensed', 'unverified', 'expired'].includes(String(row.license_state)) || !Array.isArray(row.risk_keys) || row.risk_keys.length > 200 || row.risk_keys.some(key => typeof key !== 'string' || !key.trim() || key.length > 200))
        throw Error('Das globale Instrumentenoriginal ist unvollständig.');
    time(row.updated_at, 'Änderungszeitpunkt des globalen Instruments');
}
/** An embedded historical path event is a complete immutable event, not a kind label. */
function embeddedEvent(v: Record<string, unknown>, kind: string): void {
    const c = v.command as CarePlanPathCommand;
    if (!exact(v, eventKeys) || !exact(c, commandKeys) || !object(c) || c.version !== (kind === 'assessment_path_event' ? assessmentPathVersion : kind === 'care_plan_path_event' ? carePlanPathVersion : null))
        throw Error('Historisches Pfadoriginal ist unvollständig.');
    for (const key of ['requestId', 'eventId', 'tenantId', 'assessmentId', 'actorId'] as const)
        id(c[key], key);
    if (c.expectedHeadId !== null)
        id(c.expectedHeadId, 'Erwarteter Verlaufskopf');
    text(c.kind, 'Vorgangsart', 200);
    text(c.note, 'Anlass', 4000);
    time(c.occurredAt, 'Vorgangszeitpunkt');
    if (!object(c.payload))
        throw Error('Historische Vorgangsangaben fehlen.');
    if (kind === 'assessment_path_event')
        validateAssessmentPathCommand(c as unknown as Parameters<typeof validateAssessmentPathCommand>[0]);
    else if (kind === 'care_plan_path_event')
        validateCommand(c);
    else
        throw Error('Unbekanntes historisches Pfadoriginal.');
    eventHeader(v, c);
}
export function carePlanPathSource(v: unknown, label = 'Originalquelle'): asserts v is CarePlanPathSource { sourceInternal(capture(v), label); }
function validateField(value: unknown, rule: Field): void {
    const x = text(value, rule.label);
    if (rule.type === 'uuid')
        id(x, rule.label);
    if (rule.type === 'instant')
        time(x, rule.label);
    if (rule.type === 'date' && (x.length !== 10 || carePlanPathInstantMicros(x + 'T00:00:00Z') === null))
        throw Error(`${rule.label} ist ungültig.`);
    if (rule.type === 'sha256' && (x.length !== 64 || !sha.test(x)))
        throw Error(`${rule.label} ist ungültig.`);
    if (rule.type === 'enum' && !rule.values?.includes(x))
        throw Error(`${rule.label} hat einen unbekannten Wert.`);
}
function validateCommand(c: CarePlanPathCommand): void {
    if (!exact(c, commandKeys) || c.version !== carePlanPathVersion)
        throw Error('Pflegeplanpfadvorgang oder Version ist ungültig.');
    for (const key of ['requestId', 'eventId', 'tenantId', 'assessmentId', 'actorId'] as const)
        id(c[key], key);
    if (c.expectedHeadId !== null)
        id(c.expectedHeadId, 'Erwarteter Verlaufskopf');
    if (!carePlanPathKinds.includes(c.kind))
        throw Error('Pflegeplanpfadvorgang ist unbekannt.');
    time(c.occurredAt, 'Tatsächlicher Vorgangszeitpunkt');
    text(c.note, 'Nachvollziehbarer Anlass', 4000);
    if (!object(c.payload))
        throw Error('Vorgangsangaben fehlen.');
    const definition = carePlanPathDefinitions[c.kind], keys = [...definition.sources.map(rule => rule.key), ...definition.fields.map(rule => rule.key)];
    if (!exact(c.payload, keys))
        throw Error('Vorgangsfelder sind unvollständig oder enthalten Fremdfelder.');
    for (const rule of definition.sources) {
        const source = c.payload[rule.key];
        sourceInternal(source, rule.label);
        if (!rule.kinds.includes(source.kind))
            throw Error(`${rule.label} hat die falsche Originalart.`);
        if (rule.eventKinds && source.kind.endsWith('_path_event')) {
            const eventKind = object(source.snapshot.command) ? source.snapshot.command.kind : null;
            if (typeof eventKind !== 'string' || !rule.eventKinds.includes(eventKind))
                throw Error(`${rule.label} hat die falsche fachliche Vorgangsart.`);
        }
        sourceScope(source.snapshot, c);
    }
    for (const rule of definition.fields)
        validateField(c.payload[rule.key], rule);
}
export function validateCarePlanPathCommand(value: CarePlanPathCommand): void { validateCommand(capture(value)); }
function eventHeader(value: unknown, command: CarePlanPathCommand): asserts value is CarePlanPathEvent {
    if (!exact(value, eventKeys) || !object(value) || value.id !== command.eventId || value.tenantId !== command.tenantId || value.assessmentId !== command.assessmentId || value.actorId !== command.actorId || value.previousId !== command.expectedHeadId || !Number.isSafeInteger(value.sequence) || Number(value.sequence) < 1 || Number(value.sequence) > 1000 || command.expectedHeadId === null && value.sequence !== 1 || command.expectedHeadId !== null && Number(value.sequence) < 2 || !sameClientNativeOriginal(value.command, command))
        throw Error('Das historische Ereignis oder die native Quittung ist nicht an dieselbe Anfrage gebunden.');
    id(value.id, 'Ereignis-ID');
    id(value.actorId, 'Ereignisakteur');
    text(value.actorName, 'Erfasster Akteursname', 500);
    time(value.recordedAt, 'Speicherzeitpunkt');
    if (carePlanPathInstantMicros(value.recordedAt)! < carePlanPathInstantMicros(command.occurredAt)!)
        throw Error('Der Speicherzeitpunkt liegt vor dem tatsächlichen Vorgang.');
}
export const emptyCarePlanPathState = (): CarePlanPathState => ({ headId: null, events: [], corrected: [] });
function applyCommand(state: CarePlanPathState, c: CarePlanPathCommand): CarePlanPathState {
    if (c.expectedHeadId !== state.headId)
        throw Error('Der Pflegeplanpfadverlauf wurde zwischenzeitlich geändert.');
    if (state.events.length >= 1000)
        throw Error('Der vollständige Verlauf überschreitet die sicher prüfbare Grenze.');
    if (state.events.some(event => event.id.toLowerCase() === c.eventId.toLowerCase() || event.command.requestId.toLowerCase() === c.requestId.toLowerCase()))
        throw Error('Anfrage oder Ereignis ist bereits vorhanden.');
    const corrected = [...state.corrected];
    if (c.kind === 'correction') {
        const target = String(c.payload.targetId);
        if (!state.events.some(event => event.id === target && event.command.kind !== 'correction') || corrected.includes(target))
            throw Error('Nur ein vorhandener noch nicht berichtigter Originalvorgang kann berichtigt werden.');
        corrected.push(target);
    }
    return { headId: c.eventId, events: [...state.events], corrected };
}
function decodeHistory(value: unknown, scope: {
    tenantId: string;
    assessmentId: string;
}): {
    history: CarePlanPathHistory;
    state: CarePlanPathState;
} {
    if (!exact(value, historyKeys) || !object(value) || value.version !== carePlanPathVersion || value.tenantId !== scope.tenantId || value.assessmentId !== scope.assessmentId || !Array.isArray(value.events) || value.events.length > 1000 || !Number.isSafeInteger(value.count) || value.count !== value.events.length)
        throw Error('Der Pflegeplanpfadverlauf ist unvollständig.');
    let state = emptyCarePlanPathState(), last: bigint | null = null;
    for (let index = 0; index < value.events.length; index++) {
        const raw = value.events[index] as CarePlanPathEvent, c = raw?.command;
        validateCommand(c);
        eventHeader(raw, c);
        const recorded = carePlanPathInstantMicros(raw.recordedAt)!;
        if (raw.sequence !== index + 1 || raw.previousId !== state.headId || c.tenantId !== scope.tenantId || c.assessmentId !== scope.assessmentId || last !== null && recorded < last)
            throw Error('Der Pflegeplanpfadverlauf ist abgeschnitten oder falsch zugeordnet.');
        state = applyCommand(state, c);
        state.events.push(raw);
        last = recorded;
    }
    if (value.headId !== state.headId)
        throw Error('Der Pflegeplanpfadverlauf hat keinen eindeutigen Kopf.');
    return { history: value as unknown as CarePlanPathHistory, state };
}
export function applyCarePlanPathCommand(value: CarePlanPathState, input: CarePlanPathCommand): CarePlanPathState {
    const state = capture(value), command = capture(input);
    validateCommand(command);
    if (!exact(state, ['headId', 'events', 'corrected']) || !Array.isArray(state.events) || !Array.isArray(state.corrected))
        throw Error('Der vollständige bisherige Verlauf fehlt.');
    const original = decodeHistory({ version: carePlanPathVersion, tenantId: command.tenantId, assessmentId: command.assessmentId, count: state.events.length, headId: state.headId, events: state.events }, command).state;
    if (!sameClientNativeOriginal(state.corrected, original.corrected))
        throw Error('Der Berichtigungsstand widerspricht dem vollständigen Verlauf.');
    return applyCommand(original, command);
}
export function decodeCarePlanPathHistory(value: unknown, scope: {
    tenantId: string;
    assessmentId: string;
}): {
    history: CarePlanPathHistory;
    state: CarePlanPathState;
} { return freezeClientNativeOriginal(decodeHistory(capture(value), scopeOf(scope))); }
export function decodeCarePlanPathContext(value: unknown, expected: {
    tenantId: string;
    assessmentId: string;
    actorId: string;
}): CarePlanPathContext {
    const v = capture(value), scope = scopeOf(expected, true);
    if (!exact(v, contextKeys) || !object(v) || v.version !== carePlanPathVersion || v.tenantId !== scope.tenantId || v.assessmentId !== scope.assessmentId || v.actorId !== scope.actorId || typeof v.stateFingerprint !== 'string' || v.stateFingerprint.length !== 71 || !/^sha256:[0-9a-f]{64}$/.test(v.stateFingerprint) || !sameClientNativeOriginal(v.supportedWriteKinds, [...carePlanPathSupportedWriteKinds]) || !exact(v.sources, ['count', 'rows']) || !object(v.sources) || !Array.isArray(v.sources.rows) || v.sources.rows.length > 3000 || !Number.isSafeInteger(v.sources.count) || v.sources.count !== v.sources.rows.length)
        throw Error('Vollständige Pflegeplanpfadoriginale konnten nicht bestätigt werden.');
    time(v.loadedAt, 'Lesezeitpunkt');
    const loaded = carePlanPathInstantMicros(v.loadedAt)!, seen = new Set<string>();
    for (const row of v.sources.rows) {
        sourceInternal(row, 'Originalquelle');
        const key = `${row.kind}:${row.id.toLowerCase()}`;
        if (seen.has(key))
            throw Error('Originalquelle ist doppelt.');
        seen.add(key);
        sourceScope(row.snapshot, scope);
        if (row.kind.endsWith('_path_event') && carePlanPathInstantMicros(row.snapshot.recordedAt)! > loaded)
            throw Error('Das Pfadoriginal wurde nach dem Lesezeitpunkt erfasst.');
    }
    const history = decodeHistory(v.history, scope);
    if (history.state.events.some(event => carePlanPathInstantMicros(event.recordedAt)! > loaded))
        throw Error('Der Verlauf wurde nach dem Lesezeitpunkt erfasst.');
    const ownSources = v.sources.rows.filter(row => row.kind === 'care_plan_path_event');
    if (ownSources.length !== history.history.events.length || history.history.events.some(event => !ownSources.some(source => source.id === event.id && sameClientNativeOriginal(source.snapshot, event))))
        throw Error('Die vollständigen Pflegeplanpfadquellen widersprechen dem unveränderten eigenen Verlauf.');
    return freezeClientNativeOriginal(v as unknown as CarePlanPathContext);
}
export function assertCarePlanPathSelectionCurrent(input: CarePlanPathCommand, value: CarePlanPathContext): void {
    const command = capture(input);
    validateCommand(command);
    const context = decodeCarePlanPathContext(value, command);
    if (command.expectedHeadId !== context.history.headId)
        throw Error('Der Pflegeplanpfadverlauf wurde zwischenzeitlich geändert.');
    for (const rule of carePlanPathDefinitions[command.kind].sources) {
        const source = command.payload[rule.key] as CarePlanPathSource;
        if (!context.sources.rows.some(row => sameClientNativeOriginal(row, source)))
            throw Error('Eine ausgewählte Pflegeplanpfadgrundlage ist nicht mehr aktuell.');
    }
}
export function decodeCarePlanPathReceipt(value: unknown, input: CarePlanPathCommand): CarePlanPathReceipt {
    const command = capture(input), receipt = capture(value);
    validateCommand(command);
    if (!exact(receipt, ['version', 'requestId', 'command', 'event']) || !object(receipt) || receipt.version !== carePlanPathVersion || receipt.requestId !== command.requestId || !sameClientNativeOriginal(receipt.command, command))
        throw Error('Die native Pflegeplanpfadquittung stimmt nicht mit der gesicherten Anfrage überein.');
    eventHeader(receipt.event, command);
    return freezeClientNativeOriginal(receipt as unknown as CarePlanPathReceipt);
}
function planningSourcePayload(source: CarePlanPathSource): Record<string, unknown> {
    if (!object(source.snapshot.command) || !object(source.snapshot.command.payload))
        throw Error('Die vollständige ursprüngliche Planungsfassung fehlt.');
    return source.snapshot.command.payload;
}
/** New technical writes bind exact native and retained plan relations, without reinterpreting history. */
export function validateCarePlanPathWriteCommand(input: CarePlanPathCommand): void {
    const command = capture(input);
    validateCommand(command);
    if (!carePlanPathSupportedWriteKinds.some(kind => kind === command.kind))
        throw Error('Diese Vorgangsart bleibt für neue Schreibvorgänge gesperrt.');
    const p = command.payload;
    if (['goal_plan', 'daily_routine', 'plan_review_request'].includes(command.kind) && (p.assessment as CarePlanPathSource).id !== command.assessmentId)
        throw Error('Die neue Planung benötigt das aktuelle native Assessmentoriginal.');
    if (command.kind === 'goal_plan') {
        const finding = p.finding as CarePlanPathSource, goal = p.goal as CarePlanPathSource;
        const key = finding.kind === 'assessment_topic' ? 'topic_key' : finding.kind === 'assessment_risk' ? 'risk_key' : null;
        if (key !== null && (typeof finding.snapshot[key] !== 'string' || !(finding.snapshot[key] as string).trim() || goal.snapshot[key === 'topic_key' ? 'related_topic_key' : 'related_risk_key'] !== finding.snapshot[key]))
            throw Error('Natives Themenfeld oder Risiko ist nicht mit der Zielmaßnahme verbunden.');
    }
    else if (command.kind === 'measure_plan') {
        if (!sameClientNativeOriginal(p.measure, planningSourcePayload(p.goal as CarePlanPathSource).goal))
            throw Error('Zielplanung und Maßnahmenplanung verwenden verschiedene native Maßnahmenoriginale.');
    }
    else if (command.kind === 'support_boundary') {
        const plan = p.plan as CarePlanPathSource, body = planningSourcePayload(plan), goal = object(plan.snapshot.command) && plan.snapshot.command.kind === 'goal_plan' ? body : planningSourcePayload(body.goal as CarePlanPathSource);
        if (!sameClientNativeOriginal(p.finding, goal.finding))
            throw Error('Unterstützungsgrenze und Zielplanung verwenden verschiedene Originalgrundlagen.');
    }
    else if (command.kind === 'schedule_commitment') {
        const measure = p.measure as CarePlanPathSource, routine = planningSourcePayload(p.routine as CarePlanPathSource);
        if (!sameClientNativeOriginal(routine.plan, measure) && !sameClientNativeOriginal(routine.plan, planningSourcePayload(measure).goal))
            throw Error('Terminplanung und Tagesstruktur gehören nicht zur gleichen Planfassung.');
        if (carePlanPathInstantMicros(p.startsAt)! > carePlanPathInstantMicros(p.dueAt)!)
            throw Error('Die Planfrist liegt vor dem Planbeginn.');
    }
    else if (command.kind === 'plan_review_request') {
        if (!sameClientNativeOriginal(p.goal, planningSourcePayload(p.measure as CarePlanPathSource).goal) || !sameClientNativeOriginal(p.measure, planningSourcePayload(p.schedule as CarePlanPathSource).measure))
            throw Error('Die Prüfanfrage verbindet verschiedene Ziel-, Maßnahmen- oder Terminplanungen.');
    }
}
