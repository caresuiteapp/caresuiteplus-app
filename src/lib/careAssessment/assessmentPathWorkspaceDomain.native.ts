// Generated native presentation from src/lib/careAssessment/assessmentPathWorkspaceDomain.web.ts. Update through scripts/port-native-workspaces.mjs.
import { cloneClientNativeOriginal, freezeClientNativeOriginal, sameClientNativeOriginal } from "../clients/clientRecordNativeOriginal.native.ts";
export const assessmentPathVersion = 'assessment-path-workspace-v2' as const;
export const assessmentPathKinds = ["model_version_review", "person_perspective_observation", "cognition_assessment", "mobility_assessment", "disease_demands_assessment", "self_care_assessment", "household_assessment", "social_relationships_assessment", "risk_screening", "risk_deep_assessment", "instrument_selection", "measure_plan_revision", "execution_observation", "effect_evaluation", "review_request", "review_return", "release_decision", "reassessment_trigger", "reassessment_start", "correction"] as const;
export type AssessmentPathKind = (typeof assessmentPathKinds)[number];
export type AssessmentPathSource = {
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
};
export type AssessmentPathDefinition = {
    group: string;
    label: string;
    right: string;
    extraRights?: readonly string[];
    sources: readonly Source[];
    fields: readonly Field[];
};
const f = (key: string, label: string, type: Field['type'] = 'text', values?: readonly string[]): Field => ({ key, label, type, ...(values ? { values } : {}) });
const s = (key: string, label: string, ...kinds: string[]): Source => ({ key, label, kinds });
export const assessmentPathDefinitions: Record<AssessmentPathKind, AssessmentPathDefinition> = {
    model_version_review: { group: 'Modell & Originale', label: 'Dokumentationsmodell und Fassung prüfen', right: 'pflege.assessments.manage', sources: [s('assessment', 'Assessmentoriginal', 'care_assessment'), s('model', 'Modelloriginal', 'assessment_model'), s('catalog', 'Instrumentenkatalog', 'assessment_instrument_catalog')], fields: [f('modelName', 'Modellbezeichnung'), f('modelVersion', 'Freigegebene Fassung'), f('usageState', 'Nutzungsstand', 'enum', ['own_model', 'licensed_reference', 'unverified']), f('termsSha256', 'Nutzungsbeleg', 'sha256')] },
    person_perspective_observation: { group: 'Person & Themenfelder', label: 'Personenperspektive und Beobachtung getrennt erfassen', right: 'pflege.assessments.manage', sources: [s('assessment', 'Assessmentoriginal', 'care_assessment'), s('statement', 'Originalaussage der Person', 'person_statement'), s('observation', 'Beobachtungsoriginal', 'care_observation')], fields: [f('perspective', 'Personenperspektive'), f('observedFinding', 'Wertfreie Beobachtung'), f('context', 'Erhebungskontext')] },
    cognition_assessment: { group: 'Person & Themenfelder', label: 'Kognition und Kommunikation einschätzen', right: 'pflege.assessments.manage', sources: [s('assessment', 'Assessmentoriginal', 'care_assessment'), s('topic', 'Themenfeldoriginal', 'assessment_topic'), s('observation', 'Beobachtungsoriginal', 'care_observation')], fields: [f('finding', 'Pflegefachliche Einschätzung'), f('resources', 'Ressourcen'), f('supportNeed', 'Unterstützungsbedarf')] },
    mobility_assessment: { group: 'Person & Themenfelder', label: 'Mobilität und Bewegung einschätzen', right: 'pflege.assessments.manage', sources: [s('assessment', 'Assessmentoriginal', 'care_assessment'), s('topic', 'Themenfeldoriginal', 'assessment_topic'), s('observation', 'Beobachtungsoriginal', 'care_observation')], fields: [f('finding', 'Pflegefachliche Einschätzung'), f('resources', 'Ressourcen'), f('supportNeed', 'Unterstützungsbedarf')] },
    disease_demands_assessment: { group: 'Person & Themenfelder', label: 'Krankheitsbezogene Anforderungen einschätzen', right: 'pflege.assessments.manage', extraRights: ['pflege.orders.view'], sources: [s('assessment', 'Assessmentoriginal', 'care_assessment'), s('topic', 'Themenfeldoriginal', 'assessment_topic'), s('clinical', 'Diagnose-/Verordnungsoriginal', 'client_diagnosis', 'medication_order', 'treatment_order')], fields: [f('finding', 'Pflegefachliche Einschätzung'), f('resources', 'Ressourcen'), f('supportNeed', 'Unterstützungsbedarf')] },
    self_care_assessment: { group: 'Person & Themenfelder', label: 'Selbstversorgung einschätzen', right: 'pflege.assessments.manage', sources: [s('assessment', 'Assessmentoriginal', 'care_assessment'), s('topic', 'Themenfeldoriginal', 'assessment_topic'), s('observation', 'Beobachtungsoriginal', 'care_observation')], fields: [f('finding', 'Pflegefachliche Einschätzung'), f('resources', 'Ressourcen'), f('supportNeed', 'Unterstützungsbedarf')] },
    household_assessment: { group: 'Person & Themenfelder', label: 'Haushaltsführung einschätzen', right: 'pflege.assessments.manage', sources: [s('assessment', 'Assessmentoriginal', 'care_assessment'), s('topic', 'Themenfeldoriginal', 'assessment_topic'), s('observation', 'Beobachtungsoriginal', 'care_observation')], fields: [f('finding', 'Pflegefachliche Einschätzung'), f('resources', 'Ressourcen'), f('supportNeed', 'Unterstützungsbedarf')] },
    social_relationships_assessment: { group: 'Person & Themenfelder', label: 'Soziale Beziehungen und Alltag einschätzen', right: 'pflege.assessments.manage', sources: [s('assessment', 'Assessmentoriginal', 'care_assessment'), s('topic', 'Themenfeldoriginal', 'assessment_topic'), s('statement', 'Originalaussage der Person', 'person_statement')], fields: [f('finding', 'Pflegefachliche Einschätzung'), f('resources', 'Ressourcen'), f('supportNeed', 'Unterstützungsbedarf')] },
    risk_screening: { group: 'Risiken & Instrumente', label: 'Risiko als Screening dokumentieren', right: 'pflege.risks.manage', sources: [s('assessment', 'Assessmentoriginal', 'care_assessment'), s('observation', 'Beobachtungsoriginal', 'care_observation'), s('risk', 'Risiko-/Phänomenoriginal', 'assessment_risk')], fields: [f('riskCode', 'Risiko/Phänomen'), f('screeningResult', 'Screeningergebnis', 'enum', ['no_indication', 'indication', 'unclear']), f('rationale', 'Begründung')] },
    risk_deep_assessment: { group: 'Risiken & Instrumente', label: 'Vertiefte Risikoeinschätzung getrennt erfassen', right: 'pflege.risks.manage', sources: [s('screening', 'Screeningvorgang', 'assessment_path_event'), s('risk', 'Risiko-/Phänomenoriginal', 'assessment_risk'), s('instrument', 'Instrumentenoriginal', 'assessment_instrument')], fields: [f('outcome', 'Ergebnis'), f('limitations', 'Grenzen'), f('nextReviewAt', 'Nächste Prüfung', 'instant')] },
    instrument_selection: { group: 'Risiken & Instrumente', label: 'Instrumentenfassung ausdrücklich auswählen', right: 'pflege.risks.manage', sources: [s('model', 'Modellprüfung', 'assessment_path_event'), s('instrument', 'Instrumentenoriginal', 'assessment_instrument'), s('risk', 'Risikobezug', 'assessment_risk', 'assessment_path_event')], fields: [f('decision', 'Auswahlentscheidung', 'enum', ['selected', 'blocked', 'withdrawn']), f('rationale', 'Fachliche Begründung'), f('instrumentSha256', 'Fassungsbeleg', 'sha256')] },
    measure_plan_revision: { group: 'Planung', label: 'Ziel und Maßnahme als Planfassung verbinden', right: 'pflege.assessments.manage', sources: [s('assessment', 'Assessmentoriginal', 'care_assessment'), s('risk', 'Risikoeinschätzung', 'assessment_risk', 'assessment_path_event'), s('measure', 'Maßnahmenoriginal', 'assessment_measure')], fields: [f('goal', 'Individuelles Ziel'), f('action', 'Geplante Maßnahme'), f('frequency', 'Häufigkeit'), f('responsibility', 'Verantwortliche Rolle'), f('dueAt', 'Planfrist', 'instant')] },
    execution_observation: { group: 'Durchführung', label: 'Tatsächliche Durchführung oder Nichtdurchführung erfassen', right: 'pflege.assessments.manage', sources: [s('plan', 'Planfassung', 'assessment_path_event'), s('execution', 'Einsatz-/Durchführungsoriginal', 'care_visit', 'care_execution')], fields: [f('executionState', 'Tatsächliches Ergebnis', 'enum', ['not_performed', 'partly_performed', 'performed']), f('observation', 'Tatsächliche Beobachtung'), f('deviation', 'Abweichung und Grund')] },
    effect_evaluation: { group: 'Wirkung & Prüfung', label: 'Wirkung getrennt evaluieren', right: 'pflege.assessments.manage', sources: [s('execution', 'Durchführungsvorgang', 'assessment_path_event'), s('evaluation', 'Evaluationsoriginal', 'assessment_evaluation')], fields: [f('effectState', 'Wirkung', 'enum', ['effective', 'partly_effective', 'not_effective', 'not_assessable']), f('observedEffect', 'Beobachtete Wirkung'), f('personFeedback', 'Rückmeldung der Person'), f('conclusion', 'Pflegefachliche Schlussfolgerung')] },
    review_request: { group: 'Wirkung & Prüfung', label: 'Vollständige Fassung zur Prüfung geben', right: 'pflege.assessments.manage', sources: [s('assessment', 'Assessmentoriginal', 'care_assessment'), s('model', 'Modellprüfung', 'assessment_path_event'), s('plan', 'Planfassung', 'assessment_path_event'), s('evaluation', 'Evaluationsvorgang', 'assessment_path_event')], fields: [f('reason', 'Prüfanlass'), f('packetSha256', 'Prüfpaketbeleg', 'sha256')] },
    review_return: { group: 'Wirkung & Prüfung', label: 'Prüffassung begründet zurückgeben', right: 'pflege.audit.view', sources: [s('review', 'Prüfanfrage', 'assessment_path_event'), s('assessment', 'Assessmentoriginal', 'care_assessment')], fields: [f('reason', 'Rückgabegrund'), f('requiredChange', 'Erforderliche Berichtigung')] },
    release_decision: { group: 'Wirkung & Prüfung', label: 'Freigabe getrennt entscheiden', right: 'pflege.audit.view', sources: [s('review', 'Prüfanfrage', 'assessment_path_event'), s('assessment', 'Assessmentoriginal', 'care_assessment'), s('reviewer', 'Prüfpersonenoriginal', 'employee_profile')], fields: [f('decision', 'Freigabeentscheidung', 'enum', ['approved', 'returned']), f('rationale', 'Entscheidungsbegründung'), f('releaseSha256', 'Freigabebeleg', 'sha256')] },
    reassessment_trigger: { group: 'Wiederholung', label: 'Neueinschätzungsanlass erfassen', right: 'pflege.assessments.manage', sources: [s('released', 'Freigegebene Assessmentfassung', 'care_assessment', 'assessment_path_event'), s('trigger', 'Änderungs-/Beobachtungsoriginal', 'care_observation', 'care_event', 'assessment_evaluation')], fields: [f('triggerCode', 'Anlasscode'), f('rationale', 'Konkreter Anlass'), f('dueAt', 'Erneute Erhebung bis', 'instant')] },
    reassessment_start: { group: 'Wiederholung', label: 'Erneute Erhebung ausdrücklich starten', right: 'pflege.assessments.manage', sources: [s('trigger', 'Neueinschätzungsanlass', 'assessment_path_event'), s('previous', 'Bisherige Assessmentfassung', 'care_assessment'), s('next', 'Neue Assessmentfassung', 'care_assessment')], fields: [f('relationshipSha256', 'Fassungsbezug', 'sha256'), f('scope', 'Umfang der erneuten Erhebung'), f('state', 'Startstand', 'enum', ['prepared', 'started', 'blocked'])] },
    correction: { group: 'Berichtigung', label: 'Unveränderlichen Assessmentpfadvorgang berichtigen', right: 'pflege.assessments.manage', sources: [], fields: [f('targetId', 'Zu berichtigender Vorgang', 'uuid'), f('reason', 'Berichtigungsgrund'), f('evidenceSha256', 'Berichtigungsbeleg', 'sha256')] }
};
export const assessmentPathReadRights = ['pflege.plans.view'] as const;
export const assessmentPathWorkspaceDefinitions = assessmentPathDefinitions;
export const assessmentPathWorkspaceReadRights = assessmentPathReadRights;
export type AssessmentPathWorkspaceKind = AssessmentPathKind;
export type AssessmentPathCommand = {
    version: typeof assessmentPathVersion;
    requestId: string;
    eventId: string;
    tenantId: string;
    assessmentId: string;
    actorId: string;
    expectedHeadId: string | null;
    kind: AssessmentPathKind;
    occurredAt: string;
    note: string;
    payload: Record<string, unknown>;
};
export type AssessmentPathEvent = {
    id: string;
    sequence: number;
    previousId: string | null;
    tenantId: string;
    assessmentId: string;
    actorId: string;
    actorName: string;
    recordedAt: string;
    command: AssessmentPathCommand;
};
export type AssessmentPathHistory = {
    version: typeof assessmentPathVersion;
    tenantId: string;
    assessmentId: string;
    count: number;
    headId: string | null;
    events: AssessmentPathEvent[];
};
export type AssessmentPathContext = {
    version: typeof assessmentPathVersion;
    tenantId: string;
    assessmentId: string;
    actorId: string;
    loadedAt: string;
    stateFingerprint: string;
    supportedWriteKinds: AssessmentPathKind[];
    sources: {
        count: number;
        rows: AssessmentPathSource[];
    };
    history: AssessmentPathHistory;
};
export type AssessmentPathReceipt = {
    version: typeof assessmentPathVersion;
    requestId: string;
    command: AssessmentPathCommand;
    event: AssessmentPathEvent;
};
export type AssessmentPathState = {
    headId: string | null;
    events: AssessmentPathEvent[];
    corrected: string[];
};
/** Technical capability policy only; historical commands remain separately readable. */
export const assessmentPathSupportedWriteKinds = ['measure_plan_revision', 'correction'] as const;
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
export function assessmentPathInstantMicros(value: unknown): bigint | null {
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
const time = (v: unknown, label: string): string => { if (assessmentPathInstantMicros(v) === null)
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
function sourceInternal(v: unknown, label: string): asserts v is AssessmentPathSource {
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
    const c = v.command as AssessmentPathCommand;
    if (!exact(v, eventKeys) || !exact(c, commandKeys) || !object(c) || c.version !== (kind === 'assessment_path_event' ? assessmentPathVersion : null))
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
    if (kind !== 'assessment_path_event')
        throw Error('Unbekanntes historisches Assessmentpfadoriginal.');
    validateCommand(c);
    eventHeader(v, c);
}
export function assessmentPathSource(v: unknown, label = 'Originalquelle'): asserts v is AssessmentPathSource { sourceInternal(capture(v), label); }
function validateField(value: unknown, rule: Field): void {
    const x = text(value, rule.label);
    if (rule.type === 'uuid')
        id(x, rule.label);
    if (rule.type === 'instant')
        time(x, rule.label);
    if (rule.type === 'date' && (x.length !== 10 || assessmentPathInstantMicros(x + 'T00:00:00Z') === null))
        throw Error(`${rule.label} ist ungültig.`);
    if (rule.type === 'sha256' && (x.length !== 64 || !sha.test(x)))
        throw Error(`${rule.label} ist ungültig.`);
    if (rule.type === 'enum' && !rule.values?.includes(x))
        throw Error(`${rule.label} hat einen unbekannten Wert.`);
}
function validateCommand(c: AssessmentPathCommand): void {
    if (!exact(c, commandKeys) || c.version !== assessmentPathVersion)
        throw Error('Assessmentpfadvorgang oder Version ist ungültig.');
    for (const key of ['requestId', 'eventId', 'tenantId', 'assessmentId', 'actorId'] as const)
        id(c[key], key);
    if (c.expectedHeadId !== null)
        id(c.expectedHeadId, 'Erwarteter Verlaufskopf');
    if (!assessmentPathKinds.includes(c.kind))
        throw Error('Assessmentpfadvorgang ist unbekannt.');
    time(c.occurredAt, 'Tatsächlicher Vorgangszeitpunkt');
    text(c.note, 'Nachvollziehbarer Anlass', 4000);
    if (!object(c.payload))
        throw Error('Vorgangsangaben fehlen.');
    const definition = assessmentPathDefinitions[c.kind], keys = [...definition.sources.map(rule => rule.key), ...definition.fields.map(rule => rule.key)];
    if (!exact(c.payload, keys))
        throw Error('Vorgangsfelder sind unvollständig oder enthalten Fremdfelder.');
    for (const rule of definition.sources) {
        const source = c.payload[rule.key];
        sourceInternal(source, rule.label);
        if (!rule.kinds.includes(source.kind))
            throw Error(`${rule.label} hat die falsche Originalart.`);
        sourceScope(source.snapshot, c);
    }
    for (const rule of definition.fields)
        validateField(c.payload[rule.key], rule);
}
export function validateAssessmentPathCommand(value: AssessmentPathCommand): void { validateCommand(capture(value)); }
function eventHeader(value: unknown, command: AssessmentPathCommand): asserts value is AssessmentPathEvent {
    if (!exact(value, eventKeys) || !object(value) || value.id !== command.eventId || value.tenantId !== command.tenantId || value.assessmentId !== command.assessmentId || value.actorId !== command.actorId || value.previousId !== command.expectedHeadId || !Number.isSafeInteger(value.sequence) || Number(value.sequence) < 1 || Number(value.sequence) > 1000 || command.expectedHeadId === null && value.sequence !== 1 || command.expectedHeadId !== null && Number(value.sequence) < 2 || !sameClientNativeOriginal(value.command, command))
        throw Error('Das historische Ereignis oder die native Quittung ist nicht an dieselbe Anfrage gebunden.');
    id(value.id, 'Ereignis-ID');
    id(value.actorId, 'Ereignisakteur');
    text(value.actorName, 'Erfasster Akteursname', 500);
    time(value.recordedAt, 'Speicherzeitpunkt');
    if (assessmentPathInstantMicros(value.recordedAt)! < assessmentPathInstantMicros(command.occurredAt)!)
        throw Error('Der Speicherzeitpunkt liegt vor dem tatsächlichen Vorgang.');
}
export const emptyAssessmentPathState = (): AssessmentPathState => ({ headId: null, events: [], corrected: [] });
function applyCommand(state: AssessmentPathState, c: AssessmentPathCommand): AssessmentPathState {
    if (c.expectedHeadId !== state.headId)
        throw Error('Der Assessmentpfadverlauf wurde zwischenzeitlich geändert.');
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
    history: AssessmentPathHistory;
    state: AssessmentPathState;
} {
    if (!exact(value, historyKeys) || !object(value) || value.version !== assessmentPathVersion || value.tenantId !== scope.tenantId || value.assessmentId !== scope.assessmentId || !Array.isArray(value.events) || value.events.length > 1000 || !Number.isSafeInteger(value.count) || value.count !== value.events.length)
        throw Error('Der Assessmentpfadverlauf ist unvollständig.');
    let state = emptyAssessmentPathState(), last: bigint | null = null;
    for (let index = 0; index < value.events.length; index++) {
        const raw = value.events[index] as AssessmentPathEvent, c = raw?.command;
        validateCommand(c);
        eventHeader(raw, c);
        const recorded = assessmentPathInstantMicros(raw.recordedAt)!;
        if (raw.sequence !== index + 1 || raw.previousId !== state.headId || c.tenantId !== scope.tenantId || c.assessmentId !== scope.assessmentId || last !== null && recorded < last)
            throw Error('Der Assessmentpfadverlauf ist abgeschnitten oder falsch zugeordnet.');
        state = applyCommand(state, c);
        state.events.push(raw);
        last = recorded;
    }
    if (value.headId !== state.headId)
        throw Error('Der Assessmentpfadverlauf hat keinen eindeutigen Kopf.');
    return { history: value as unknown as AssessmentPathHistory, state };
}
export function applyAssessmentPathCommand(value: AssessmentPathState, input: AssessmentPathCommand): AssessmentPathState {
    const state = capture(value), command = capture(input);
    validateCommand(command);
    if (!exact(state, ['headId', 'events', 'corrected']) || !Array.isArray(state.events) || !Array.isArray(state.corrected))
        throw Error('Der vollständige bisherige Verlauf fehlt.');
    const original = decodeHistory({ version: assessmentPathVersion, tenantId: command.tenantId, assessmentId: command.assessmentId, count: state.events.length, headId: state.headId, events: state.events }, command).state;
    if (!sameClientNativeOriginal(state.corrected, original.corrected))
        throw Error('Der Berichtigungsstand widerspricht dem vollständigen Verlauf.');
    return applyCommand(original, command);
}
export function decodeAssessmentPathHistory(value: unknown, scope: {
    tenantId: string;
    assessmentId: string;
}): {
    history: AssessmentPathHistory;
    state: AssessmentPathState;
} { return freezeClientNativeOriginal(decodeHistory(capture(value), scopeOf(scope))); }
export function decodeAssessmentPathContext(value: unknown, expected: {
    tenantId: string;
    assessmentId: string;
    actorId: string;
}): AssessmentPathContext {
    const v = capture(value), scope = scopeOf(expected, true);
    if (!exact(v, contextKeys) || !object(v) || v.version !== assessmentPathVersion || v.tenantId !== scope.tenantId || v.assessmentId !== scope.assessmentId || v.actorId !== scope.actorId || typeof v.stateFingerprint !== 'string' || v.stateFingerprint.length !== 71 || !/^sha256:[0-9a-f]{64}$/.test(v.stateFingerprint) || !sameClientNativeOriginal(v.supportedWriteKinds, [...assessmentPathSupportedWriteKinds]) || !exact(v.sources, ['count', 'rows']) || !object(v.sources) || !Array.isArray(v.sources.rows) || v.sources.rows.length > 3000 || !Number.isSafeInteger(v.sources.count) || v.sources.count !== v.sources.rows.length)
        throw Error('Vollständige Assessmentpfadoriginale konnten nicht bestätigt werden.');
    time(v.loadedAt, 'Lesezeitpunkt');
    const loaded = assessmentPathInstantMicros(v.loadedAt)!, seen = new Set<string>();
    for (const row of v.sources.rows) {
        sourceInternal(row, 'Originalquelle');
        const key = `${row.kind}:${row.id.toLowerCase()}`;
        if (seen.has(key))
            throw Error('Originalquelle ist doppelt.');
        seen.add(key);
        sourceScope(row.snapshot, scope);
        if (row.kind.endsWith('_path_event') && assessmentPathInstantMicros(row.snapshot.recordedAt)! > loaded)
            throw Error('Das Pfadoriginal wurde nach dem Lesezeitpunkt erfasst.');
    }
    const history = decodeHistory(v.history, scope);
    if (history.state.events.some(event => assessmentPathInstantMicros(event.recordedAt)! > loaded))
        throw Error('Der Verlauf wurde nach dem Lesezeitpunkt erfasst.');
    const ownSources = v.sources.rows.filter(row => row.kind === 'assessment_path_event');
    if (ownSources.length !== history.history.events.length || history.history.events.some(event => !ownSources.some(source => source.id === event.id && sameClientNativeOriginal(source.snapshot, event))))
        throw Error('Die vollständigen Assessmentpfadquellen widersprechen dem unveränderten eigenen Verlauf.');
    return freezeClientNativeOriginal(v as unknown as AssessmentPathContext);
}
export function assertAssessmentPathSelectionCurrent(input: AssessmentPathCommand, value: AssessmentPathContext): void {
    const command = capture(input);
    validateCommand(command);
    const context = decodeAssessmentPathContext(value, command);
    if (command.expectedHeadId !== context.history.headId)
        throw Error('Der Assessmentpfadverlauf wurde zwischenzeitlich geändert.');
    for (const rule of assessmentPathDefinitions[command.kind].sources) {
        const source = command.payload[rule.key] as AssessmentPathSource;
        if (!context.sources.rows.some(row => sameClientNativeOriginal(row, source)))
            throw Error('Eine ausgewählte Assessmentpfadgrundlage ist nicht mehr aktuell.');
    }
}
export function decodeAssessmentPathReceipt(value: unknown, input: AssessmentPathCommand): AssessmentPathReceipt {
    const command = capture(input), receipt = capture(value);
    validateCommand(command);
    if (!exact(receipt, ['version', 'requestId', 'command', 'event']) || !object(receipt) || receipt.version !== assessmentPathVersion || receipt.requestId !== command.requestId || !sameClientNativeOriginal(receipt.command, command))
        throw Error('Die native Assessmentpfadquittung stimmt nicht mit der gesicherten Anfrage überein.');
    eventHeader(receipt.event, command);
    return freezeClientNativeOriginal(receipt as unknown as AssessmentPathReceipt);
}
/** New technical writes require native relationships; historical readers retain their original schema. */
export function validateAssessmentPathWriteCommand(input: AssessmentPathCommand): void {
    const command = capture(input);
    validateCommand(command);
    if (!assessmentPathSupportedWriteKinds.some(kind => kind === command.kind))
        throw Error('Diese Vorgangsart bleibt für neue Schreibvorgänge gesperrt.');
    if (command.kind === 'measure_plan_revision') {
        const assessment = command.payload.assessment as AssessmentPathSource, risk = command.payload.risk as AssessmentPathSource, measure = command.payload.measure as AssessmentPathSource;
        if (assessment.id !== command.assessmentId || risk.kind !== 'assessment_risk' || measure.kind !== 'assessment_measure' || typeof risk.snapshot.risk_key !== 'string' || !risk.snapshot.risk_key.trim() || measure.snapshot.related_risk_key !== risk.snapshot.risk_key)
            throw Error('Ausdrücklich ausgewähltes natives Risiko und Maßnahmenoriginal sind nicht verbunden.');
    }
}
