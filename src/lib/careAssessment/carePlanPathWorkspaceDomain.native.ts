// Generated native presentation from src/lib/careAssessment/carePlanPathWorkspaceDomain.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
export const carePlanPathVersion = '2026-10-16.4' as const;
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
    goal_plan: { group: 'Ziele & Maßnahmen', label: 'Individuelles Pflegeziel als Planfassung erfassen', right: 'pflege.assessments.manage', sources: [s('assessment', 'Assessmentfassung', 'care_assessment'), a('finding', 'Einschätzungsoriginal', 'cognition_assessment', 'mobility_assessment', 'disease_demands_assessment', 'self_care_assessment', 'household_assessment', 'social_relationships_assessment', 'risk_screening', 'risk_deep_assessment'), s('goal', 'Zieloriginal', 'assessment_measure')], fields: [f('outcome', 'Beobachtbares Ergebnis'), f('baseline', 'Ausgangslage'), f('priority', 'Gemeinsam vereinbarte Priorität'), f('reviewAt', 'Prüftermin', 'instant')] },
    measure_plan: { group: 'Ziele & Maßnahmen', label: 'Maßnahme konkret und ausführbar planen', right: 'pflege.assessments.manage', sources: [e('goal', 'Zielplanung', 'goal_plan'), s('measure', 'Maßnahmenoriginal', 'assessment_measure')], fields: [f('action', 'Was und wie'), f('frequency', 'Wann und wie häufig'), f('aids', 'Hilfsmittel'), f('responsibleRole', 'Verantwortliche Rolle')] },
    daily_routine: { group: 'Ziele & Maßnahmen', label: 'Tagesstruktur und Gewohnheiten ausdrücklich planen', right: 'pflege.assessments.manage', sources: [s('assessment', 'Assessmentfassung', 'care_assessment'), e('plan', 'Planungsoriginal', 'goal_plan', 'measure_plan')], fields: [f('timeWindow', 'Zeitfenster'), f('ritual', 'Ritual oder Gewohnheit'), f('preference', 'Individuelle Präferenz'), f('dependency', 'Abhängigkeit und Konfliktregel')] },
    support_boundary: { group: 'Ressourcen & Verantwortung', label: 'Unterstützungsgrad getrennt festlegen', right: 'pflege.assessments.manage', sources: [e('plan', 'Planungsoriginal', 'goal_plan', 'measure_plan'), a('finding', 'Ressourcenoriginal', 'cognition_assessment', 'mobility_assessment', 'self_care_assessment', 'household_assessment')], fields: [f('supportLevel', 'Geplante Unterstützung', 'enum', ['self', 'guidance', 'partial_assistance', 'full_assistance']), f('ownContribution', 'Eigenleistung'), f('professionalBoundary', 'Pflegefachliche Grenze')] },
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
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const instant = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
const sha = /^[0-9a-f]{64}$/;
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown, label: string) => { if (typeof v !== 'string' || !v.trim())
    throw Error(`${label} fehlt.`); return v; };
const id = (v: unknown, label: string) => { const x = text(v, label); if (!uuid.test(x) || x !== x.toLowerCase())
    throw Error(`${label} ist ungültig.`); return x; };
const time = (v: unknown, label: string) => { const x = text(v, label); if (!instant.test(x) || Number.isNaN(Date.parse(x)))
    throw Error(`${label} ist ungültig.`); return x; };
export function carePlanPathSource(v: unknown, label = 'Originalquelle'): asserts v is CarePlanPathSource { if (!object(v) || Object.keys(v).sort().join(',') !== 'id,kind,snapshot')
    throw Error(`${label} ist unvollständig.`); id(v.id, `${label}-ID`); text(v.kind, `${label}-Art`); if (!object(v.snapshot) || v.snapshot.id !== v.id)
    throw Error(`${label} stimmt nicht mit dem nativen Original überein.`); }
function validateField(value: unknown, rule: Field) { const x = text(value, rule.label); if (rule.type === 'uuid')
    id(x, rule.label); if (rule.type === 'instant')
    time(x, rule.label); if (rule.type === 'sha256' && !sha.test(x))
    throw Error(`${rule.label} ist ungültig.`); if (rule.type === 'enum' && !rule.values?.includes(x))
    throw Error(`${rule.label} hat einen unbekannten Wert.`); }
export function validateCarePlanPathCommand(c: CarePlanPathCommand) { if (!object(c) || c.version !== carePlanPathVersion)
    throw Error('Pflegeplanpfadvorgang oder Version ist ungültig.'); id(c.requestId, 'Anfrage-ID'); id(c.eventId, 'Ereignis-ID'); id(c.tenantId, 'Mandant'); id(c.assessmentId, 'Assessment'); id(c.actorId, 'Akteur'); if (c.expectedHeadId !== null)
    id(c.expectedHeadId, 'Erwarteter Verlaufskopf'); if (!carePlanPathKinds.includes(c.kind))
    throw Error('Pflegeplanpfadvorgang ist unbekannt.'); time(c.occurredAt, 'Tatsächlicher Vorgangszeitpunkt'); if (text(c.note, 'Nachvollziehbarer Anlass').length > 4000)
    throw Error('Anlass ist zu lang.'); if (!object(c.payload))
    throw Error('Vorgangsangaben fehlen.'); const d = carePlanPathDefinitions[c.kind], keys = [...d.sources.map(x => x.key), ...d.fields.map(x => x.key)].sort(); if (Object.keys(c.payload).sort().join(',') !== keys.join(','))
    throw Error('Vorgangsfelder sind unvollständig oder enthalten Fremdfelder.'); const selected: CarePlanPathSource[] = []; for (const rule of d.sources) {
    const value = c.payload[rule.key];
    carePlanPathSource(value, rule.label);
    if (!rule.kinds.includes(value.kind))
        throw Error(`${rule.label} hat die falsche Originalart.`);
    if (rule.eventKinds) {
        const eventKind = object(value.snapshot.command) ? value.snapshot.command.kind : null;
        if (typeof eventKind !== 'string' || !rule.eventKinds.includes(eventKind))
            throw Error(`${rule.label} hat die falsche fachliche Vorgangsart.`);
    }
    selected.push(value);
} for (const source of selected) {
    if (source.snapshot.tenant_id !== undefined && source.snapshot.tenant_id !== c.tenantId)
        throw Error('Ausgewählte Originale gehören nicht zum aktuellen Mandanten.');
    if (source.snapshot.assessment_id !== undefined && source.snapshot.assessment_id !== c.assessmentId)
        throw Error('Ausgewählte Originale gehören nicht zum aktuellen Assessment.');
} for (const rule of d.fields)
    validateField(c.payload[rule.key], rule); }
export const emptyCarePlanPathState = (): CarePlanPathState => ({ headId: null, events: [], corrected: [] });
export function applyCarePlanPathCommand(state: CarePlanPathState, c: CarePlanPathCommand) { validateCarePlanPathCommand(c); if (c.expectedHeadId !== state.headId)
    throw Error('Der  Pflegeplanpfadverlauf wurde zwischenzeitlich geändert.'); if (state.events.some(x => x.id === c.eventId || x.command.requestId === c.requestId))
    throw Error('Anfrage oder Ereignis ist bereits vorhanden.'); const corrected = [...state.corrected]; if (c.kind === 'correction') {
    const target = String(c.payload.targetId);
    if (!state.events.some(x => x.id === target && x.command.kind !== 'correction') || corrected.includes(target))
        throw Error('Nur ein vorhandener noch nicht berichtigter Originalvorgang kann berichtigt werden.');
    corrected.push(target);
} return { headId: c.eventId, events: [...state.events], corrected }; }
export function decodeCarePlanPathHistory(value: unknown, scope: {
    tenantId: string;
    assessmentId: string;
}) { if (!object(value) || value.version !== carePlanPathVersion || value.tenantId !== scope.tenantId || value.assessmentId !== scope.assessmentId || !Array.isArray(value.events) || value.count !== value.events.length)
    throw Error('Der  Pflegeplanpfadverlauf ist unvollständig.'); let state = emptyCarePlanPathState(); for (let i = 0; i < value.events.length; i++) {
    const raw = value.events[i];
    if (!object(raw) || raw.sequence !== i + 1 || raw.previousId !== state.headId || raw.tenantId !== scope.tenantId || raw.assessmentId !== scope.assessmentId || !object(raw.command))
        throw Error('Der  Pflegeplanpfadverlauf ist abgeschnitten oder falsch zugeordnet.');
    const c = structuredClone(raw.command) as CarePlanPathCommand;
    validateCarePlanPathCommand(c);
    if (raw.id !== c.eventId || c.tenantId !== scope.tenantId || c.assessmentId !== scope.assessmentId)
        throw Error('Der  Pflegeplanpfadverlauf enthält ein fremdes Original.');
    state = applyCarePlanPathCommand(state, c);
    state.events.push(structuredClone(raw) as CarePlanPathEvent);
} if (value.headId !== state.headId)
    throw Error('Der  Pflegeplanpfadverlauf hat keinen eindeutigen Kopf.'); return { history: structuredClone(value) as CarePlanPathHistory, state }; }
export function decodeCarePlanPathContext(value: unknown, expected: {
    tenantId: string;
    assessmentId: string;
    actorId: string;
}) { if (!object(value) || Object.keys(value).sort().join(',') !== 'actorId,assessmentId,history,loadedAt,sources,tenantId,version' || value.version !== carePlanPathVersion || value.tenantId !== expected.tenantId || value.assessmentId !== expected.assessmentId || value.actorId !== expected.actorId || !object(value.sources) || !Array.isArray(value.sources.rows) || value.sources.count !== value.sources.rows.length)
    throw Error('Vollständige Pflegeplanoriginale konnten nicht bestätigt werden.'); time(value.loadedAt, 'Lesezeitpunkt'); const seen = new Set<string>(); for (const row of value.sources.rows) {
    carePlanPathSource(row);
    const key = `${row.kind}:${row.id}`;
    if (seen.has(key))
        throw Error('Originalquelle ist doppelt.');
    seen.add(key);
    if (row.snapshot.tenant_id !== undefined && row.snapshot.tenant_id !== expected.tenantId)
        throw Error('Originalquelle gehört zu einem anderen Mandanten.');
    if (row.snapshot.assessment_id !== undefined && row.snapshot.assessment_id !== expected.assessmentId)
        throw Error('Originalquelle gehört zu einem anderen Assessment.');
} decodeCarePlanPathHistory(value.history, expected); return structuredClone(value) as CarePlanPathContext; }
export function assertCarePlanPathSelectionCurrent(c: CarePlanPathCommand, context: CarePlanPathContext) { validateCarePlanPathCommand(c); for (const rule of carePlanPathDefinitions[c.kind].sources) {
    const source = c.payload[rule.key] as CarePlanPathSource;
    if (!context.sources.rows.some(row => JSON.stringify(row) === JSON.stringify(source)))
        throw Error('Eine ausgewählte Pflegeplangrundlage ist nicht mehr aktuell.');
} }
export function decodeCarePlanPathReceipt(value: unknown, c: CarePlanPathCommand) { if (!object(value) || value.version !== carePlanPathVersion || value.requestId !== c.requestId || !object(value.command) || JSON.stringify(value.command) !== JSON.stringify(c) || !object(value.event) || value.event.id !== c.eventId || JSON.stringify(value.event.command) !== JSON.stringify(c))
    throw Error('Die native Pflegeplanquittung stimmt nicht mit der gesicherten Anfrage überein.'); return structuredClone(value) as CarePlanPathReceipt; }
