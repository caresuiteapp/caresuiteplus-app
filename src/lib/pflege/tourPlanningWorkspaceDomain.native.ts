// Generated native presentation from src/lib/pflege/tourPlanningWorkspaceDomain.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import { sameWoundJson, woundInstant, woundUuid } from './woundCareDomain.ts';
import { assertPlanningContextPrerequisites, checkPlanningTransition, planningLegacyProjection, validatePlanningPayload } from "./tourPlanningWorkspaceRules.native.ts";
export const tourPlanningVersion = '2026-10-16.2' as const;
export const tourPlanningLegacyVersion = '2026-10-16.1' as const;
export type TourPlanningVersion = typeof tourPlanningVersion | typeof tourPlanningLegacyVersion;
export type TourPlanningRow = Record<string, unknown>;
export type TourPlanningScope = {
    tenantId: string;
    planId: string;
    actorId: string;
};
export const tourPlanningLegacyKinds = [
    'plan_version', 'rule_review', 'visit_binding', 'assignment', 'preference_exception',
    'replan', 'series_exception', 'publish', 'acknowledge', 'trip_start', 'trip_finish',
    'maintenance', 'correct',
] as const;
export const tourPlanningKinds = [...tourPlanningLegacyKinds, 'additional_request', 'additional_response', 'meal_request', 'meal_delivery'] as const;
export type TourPlanningKind = typeof tourPlanningKinds[number];
export type TourPlanningSourceKind = 'tour' | 'stop' | 'shift' | 'availability' | 'absence' | 'qualification' | 'work_rule' | 'preference' | 'admission' | 'care_plan' | 'series' | 'vehicle' | 'maintenance' | 'trip' | 'personnel' | 'resource';
export type TourPlanningSource = {
    kind: TourPlanningSourceKind;
    id: string;
    snapshot: TourPlanningRow;
};
export type TourPlanningPerson = {
    id: string;
    profileId: string | null;
    tenantId: string;
    name: string;
    roleKey: string;
    active: boolean;
    updatedAt: string;
};
export type TourPlanningCommand = TourPlanningScope & {
    version: TourPlanningVersion;
    requestId: string;
    eventId: string;
    expectedHeadId: string | null;
    kind: TourPlanningKind;
    occurredAt: string;
    note: string;
    payload: TourPlanningRow;
};
export type TourPlanningEvent = {
    id: string;
    sequence: number;
    previousId: string | null;
    tenantId: string;
    planId: string;
    actorId: string;
    actorName: string;
    recordedAt: string;
    command: TourPlanningCommand;
};
export type TourPlanningHistory = {
    version: TourPlanningVersion;
    tenantId: string;
    planId: string;
    count: number;
    headId: string | null;
    events: TourPlanningEvent[];
};
export type TourPlanningReceipt = {
    version: TourPlanningVersion;
    requestId: string;
    command: TourPlanningCommand;
    event: TourPlanningEvent;
};
export type TourPlanningContext = TourPlanningScope & {
    version: typeof tourPlanningVersion;
    loadedAt: string;
    plan: TourPlanningRow;
    sources: {
        count: number;
        rows: TourPlanningSource[];
    };
    people: {
        count: number;
        rows: TourPlanningPerson[];
    };
    history: TourPlanningHistory;
};
export type TourPlanningState = {
    headId: string | null;
    events: TourPlanningEvent[];
    corrected: string[];
};
export const tourPlanningLabels: Record<TourPlanningKind, string> = {
    plan_version: 'Dienst- und Tourenplanfassung festhalten',
    rule_review: 'Arbeitszeit- und Ruhezeitregel prüfen',
    visit_binding: 'Besuch mit Bedarf und Planfassung verbinden',
    assignment: 'Tour, Personen, Qualifikation und Fahrzeug zuordnen',
    preference_exception: 'Wunschzeit oder Bezugspflege abgleichen',
    replan: 'Kurzfristige Umplanung dokumentieren',
    series_exception: 'Serienvorkommen oder Feiertagsausnahme entscheiden',
    publish: 'Planfassung freigeben und adressieren',
    acknowledge: 'Persönlichen Empfang derselben Planfassung bestätigen',
    trip_start: 'Fahrt mit Fahrzeug und Kilometerstand eröffnen',
    trip_finish: 'Fahrt mit Rückgabe und Kilometerstand abschließen',
    maintenance: 'Wartung, Sperre oder Freigabe des Fahrzeugs festhalten',
    correct: 'Früheres Planungsereignis berichtigen',
    additional_request: 'Hausnotruf oder Zusatzleistung anfragen',
    additional_response: 'Belegte Anbieterantwort dokumentieren',
    meal_request: 'Essen auf Rädern anfragen',
    meal_delivery: 'Tatsächliche Essenlieferung dokumentieren',
};
export const tourPlanningBaseRights = ['pflege.plans.view'] as const;
export const tourPlanningContextRights = ['pflege.plans.view', 'office.employees.view', 'office.employees.view_sensitive', 'office.clients.view', 'office.clients.view_sensitive', 'office.documents.view', 'pflege.documentation.view'] as const;
export const tourPlanningWriteRights = (kind: TourPlanningKind) => kind === 'acknowledge' ? ['pflege.plans.view'] as const : ['pflege.plans.manage'] as const;
function fail(message: string): never { throw Error(message); }
export const tourPlanningObject = (value: unknown): value is TourPlanningRow => !!value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
export const tourPlanningId = (value: unknown): value is string => woundUuid(value) && value === value.toLowerCase();
const instant = (value: unknown): value is string => typeof value === 'string' && woundInstant(value) !== null;
const at = (value: string) => woundInstant(value)!;
const text = (value: unknown, max = 4000): value is string => typeof value === 'string' && !!value.trim() && value.length <= max && !value.includes('\u0000');
const date = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
const integer = (value: unknown, min = 0, max = 1000000) => Number.isSafeInteger(value) && Number(value) >= min && Number(value) <= max;
function exact(value: unknown, keys: string[]): value is TourPlanningRow { return tourPlanningObject(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key)); }
export function tourPlanningJson(value: unknown, limit = 6000000) {
    const walk = (current: unknown, depth = 0): void => {
        if (depth > 30)
            fail('Die Planungsoriginale sind zu tief verschachtelt.');
        if (current === null || typeof current === 'boolean' || typeof current === 'number' && Number.isFinite(current) || typeof current === 'string' && !current.includes('\u0000'))
            return;
        if (Array.isArray(current)) {
            if (Reflect.ownKeys(current).length !== current.length + 1)
                fail('Eine Originalliste ist unvollständig.');
            for (let index = 0; index < current.length; index += 1) {
                const descriptor = Object.getOwnPropertyDescriptor(current, String(index));
                if (!descriptor || !descriptor.enumerable || !('value' in descriptor))
                    fail('Eine Originalliste ist nicht vollständig lesbar.');
                walk(descriptor.value, depth + 1);
            }
            return;
        }
        if (!tourPlanningObject(current))
            fail('Es werden vollständige einfache JSON-Originale benötigt.');
        for (const key of Reflect.ownKeys(current)) {
            const descriptor = Object.getOwnPropertyDescriptor(current, key);
            if (typeof key !== 'string' || ['__proto__', 'constructor', 'prototype'].includes(key) || !descriptor || !descriptor.enumerable || !('value' in descriptor))
                fail('Ein Original enthält einen unzulässigen Schlüssel.');
            walk(descriptor.value, depth + 1);
        }
    };
    walk(value);
    const raw = JSON.stringify(value);
    if (!raw || raw.length > limit || !sameWoundJson(JSON.parse(raw), value))
        fail('Der vollständige Originalbestand ist nicht darstellbar.');
}
function source(value: unknown, scope: Pick<TourPlanningScope, 'tenantId' | 'planId'>, allowed: TourPlanningSourceKind[]): asserts value is TourPlanningSource {
    if (!exact(value, ['kind', 'id', 'snapshot']) || !allowed.includes(value.kind as TourPlanningSourceKind) || !tourPlanningId(value.id) || !tourPlanningObject(value.snapshot) || value.snapshot.id !== value.id || value.snapshot.tenant_id !== scope.tenantId)
        fail('Der vollständige Planungsoriginalbezug fehlt.');
    if (value.kind === 'tour' && value.id !== scope.planId)
        fail('Die Tourfassung gehört nicht zu diesem Planungsarbeitsplatz.');
    tourPlanningJson(value);
}
function person(value: unknown, tenantId: string): asserts value is TourPlanningPerson {
    if (!exact(value, ['id', 'profileId', 'tenantId', 'name', 'roleKey', 'active', 'updatedAt']) || !tourPlanningId(value.id) || !(value.profileId === null || tourPlanningId(value.profileId)) || value.tenantId !== tenantId || !text(value.name, 300) || !text(value.roleKey, 100) || value.active !== true || !instant(value.updatedAt))
        fail('Eine aktuell aktive beteiligte Person fehlt.');
}
const words = (payload: TourPlanningRow, keys: string[]) => { if (keys.some((key) => !text(payload[key])))
    fail('Begründung, Umfang oder Entscheidung fehlen.'); };
const times = (payload: TourPlanningRow, start: string, end: string) => { if (!instant(payload[start]) || !instant(payload[end]) || at(payload[start] as string) > at(payload[end] as string))
    fail('Der tatsächliche Zeitraum ist ungültig.'); };
const choice = (payload: TourPlanningRow, key: string, values: string[]) => { if (!values.includes(String(payload[key])))
    fail(`Eine eindeutige Auswahl für ${key} fehlt.`); };
const src = (payload: TourPlanningRow, key: string, scope: TourPlanningScope, allowed: TourPlanningSourceKind[]) => source(payload[key], scope, allowed);
const who = (payload: TourPlanningRow, key: string, scope: TourPlanningScope) => person(payload[key], scope.tenantId);
const optionalSource = (payload: TourPlanningRow, key: string, scope: TourPlanningScope, allowed: TourPlanningSourceKind[]) => { if (payload[key] !== null)
    source(payload[key], scope, allowed); };
const optionalPerson = (payload: TourPlanningRow, key: string, scope: TourPlanningScope) => { if (payload[key] !== null)
    person(payload[key], scope.tenantId); };
const sourceStatus = (value: unknown) => tourPlanningObject(value) && tourPlanningObject(value.snapshot) ? String(value.snapshot.status ?? value.snapshot.state ?? '') : '';
function validateLegacyTourPlanningCommand(value: unknown, now = Date.now()): asserts value is TourPlanningCommand {
    if (!exact(value, ['version', 'requestId', 'eventId', 'tenantId', 'planId', 'actorId', 'expectedHeadId', 'kind', 'occurredAt', 'note', 'payload']) || value.version !== tourPlanningLegacyVersion || !['requestId', 'eventId', 'tenantId', 'planId', 'actorId'].every((key) => tourPlanningId(value[key])) || value.requestId === value.eventId || !(value.expectedHeadId === null || tourPlanningId(value.expectedHeadId)) || !tourPlanningLegacyKinds.includes(value.kind as typeof tourPlanningLegacyKinds[number]) || !instant(value.occurredAt) || at(value.occurredAt as string) > BigInt(Math.trunc(now)) * 1000n || !text(value.note) || !tourPlanningObject(value.payload))
        fail('Der Planungsgegenstand ist ungültig. Tatsächliche Zeit und Anlass prüfen.');
    tourPlanningJson(value);
    const payload = value.payload;
    const scope = value as TourPlanningCommand;
    switch (value.kind as TourPlanningKind) {
        case 'plan_version':
            if (!exact(payload, ['tour', 'versionLabel', 'validFrom', 'validUntil', 'decision']))
                fail('Die Planfassung ist unvollständig.');
            src(payload, 'tour', scope, ['tour']);
            words(payload, ['versionLabel', 'decision']);
            if (!date(payload.validFrom) || !date(payload.validUntil) || payload.validFrom > payload.validUntil)
                fail('Der Gültigkeitszeitraum der Planfassung ist ungültig.');
            break;
        case 'rule_review':
            if (!exact(payload, ['rule', 'shift', 'startedAt', 'endedAt', 'breakMinutes', 'result', 'exceptionReason']))
                fail('Die Arbeitszeitprüfung ist unvollständig.');
            src(payload, 'rule', scope, ['work_rule']);
            src(payload, 'shift', scope, ['shift']);
            times(payload, 'startedAt', 'endedAt');
            if (!integer(payload.breakMinutes, 0, 1440))
                fail('Die Pausenzeit ist ungültig.');
            choice(payload, 'result', ['compliant', 'exception_required', 'rejected']);
            words(payload, ['exceptionReason']);
            break;
        case 'visit_binding':
            if (!exact(payload, ['tour', 'stop', 'admission', 'carePlan', 'frequency', 'serviceType', 'windowStart', 'windowEnd', 'continuity', 'decision']))
                fail('Die Besuchsbindung ist unvollständig.');
            src(payload, 'tour', scope, ['tour']);
            src(payload, 'stop', scope, ['stop']);
            src(payload, 'admission', scope, ['admission']);
            src(payload, 'carePlan', scope, ['care_plan']);
            if ((payload.stop as TourPlanningSource).snapshot.tour_id !== (payload.tour as TourPlanningSource).id || (payload.stop as TourPlanningSource).snapshot.client_id !== (payload.admission as TourPlanningSource).snapshot.client_id || (payload.stop as TourPlanningSource).snapshot.client_id !== (payload.carePlan as TourPlanningSource).snapshot.client_id)
                fail('Besuch, Tour, Aufnahme und Pflegeplan gehören nicht zum selben Pflegefall.');
            words(payload, ['frequency', 'serviceType', 'decision']);
            times(payload, 'windowStart', 'windowEnd');
            choice(payload, 'continuity', ['active', 'interrupted', 'ended']);
            if (payload.continuity !== 'active' && payload.decision === 'planned')
                fail('Unterbrochene oder beendete Versorgung darf nicht als regulärer Besuch geplant werden.');
            break;
        case 'assignment':
            if (!exact(payload, ['tour', 'shift', 'primary', 'primaryQualification', 'secondary', 'secondaryQualification', 'vehicle', 'maintenance', 'capacityMinutes', 'travelMinutes', 'accessSummary', 'decision']))
                fail('Die Tourzuordnung ist unvollständig.');
            src(payload, 'tour', scope, ['tour']);
            src(payload, 'shift', scope, ['shift']);
            who(payload, 'primary', scope);
            src(payload, 'primaryQualification', scope, ['qualification']);
            optionalPerson(payload, 'secondary', scope);
            optionalSource(payload, 'secondaryQualification', scope, ['qualification']);
            optionalSource(payload, 'vehicle', scope, ['vehicle']);
            optionalSource(payload, 'maintenance', scope, ['maintenance']);
            if ((payload.shift as TourPlanningSource).snapshot.employee_id !== (payload.primary as TourPlanningPerson).id || (payload.primaryQualification as TourPlanningSource).snapshot.employee_id !== (payload.primary as TourPlanningPerson).id)
                fail('Schicht und aktuelle Qualifikation müssen zur ersten Person gehören.');
            if (payload.secondary !== null && (payload.secondary as TourPlanningPerson).id === (payload.primary as TourPlanningPerson).id)
                fail('Doppelbesetzung benötigt zwei verschiedene aktive Personen.');
            if ((payload.secondary === null) !== (payload.secondaryQualification === null))
                fail('Die zweite Person benötigt eine eigene aktuelle Qualifikationsprüfung.');
            if (payload.secondary !== null && (payload.secondaryQualification as TourPlanningSource).snapshot.employee_id !== (payload.secondary as TourPlanningPerson).id)
                fail('Die zweite Qualifikation gehört nicht zur zweiten Person.');
            if ((payload.vehicle === null) !== (payload.maintenance === null))
                fail('Ein Fahrzeug benötigt seinen aktuellen Wartungsbeleg.');
            if (payload.vehicle !== null && (payload.vehicle as TourPlanningSource).id !== (payload.maintenance as TourPlanningSource).id)
                fail('Der Wartungsbeleg gehört nicht zum ausgewählten Fahrzeug.');
            if (['maintenance', 'damaged', 'decommissioned', 'out_of_service', 'overdue'].includes(sourceStatus(payload.maintenance)))
                fail('Ein gesperrtes oder überfälliges Fahrzeug darf nicht zugeordnet werden.');
            if (!integer(payload.capacityMinutes, 1, 1440) || !integer(payload.travelMinutes, 0, 1440) || Number(payload.travelMinutes) >= Number(payload.capacityMinutes))
                fail('Kapazität und Fahrtzeit sind nicht plausibel.');
            words(payload, ['accessSummary', 'decision']);
            break;
        case 'preference_exception':
            if (!exact(payload, ['preference', 'stop', 'outcome', 'priority', 'reason']))
                fail('Der Präferenzabgleich ist unvollständig.');
            src(payload, 'preference', scope, ['preference']);
            src(payload, 'stop', scope, ['stop']);
            choice(payload, 'outcome', ['honored', 'deviation']);
            choice(payload, 'priority', ['required', 'high', 'normal']);
            words(payload, ['reason']);
            break;
        case 'replan':
            if (!exact(payload, ['tour', 'stop', 'cause', 'previousAssignmentEventId', 'replacement', 'replacementQualification', 'notification', 'decision']))
                fail('Die kurzfristige Umplanung ist unvollständig.');
            src(payload, 'tour', scope, ['tour']);
            src(payload, 'stop', scope, ['stop']);
            src(payload, 'cause', scope, ['absence']);
            if ((payload.stop as TourPlanningSource).snapshot.tour_id !== (payload.tour as TourPlanningSource).id)
                fail('Der Besuch gehört nicht zur umzuplanenden Tour.');
            if (['arrived', 'in_progress', 'completed'].includes(sourceStatus(payload.stop)))
                fail('Ein bereits begonnener oder abgeschlossener Besuch darf nicht still neu zugeordnet werden.');
            if (!tourPlanningId(payload.previousAssignmentEventId))
                fail('Die bisherige Zuordnung fehlt.');
            who(payload, 'replacement', scope);
            src(payload, 'replacementQualification', scope, ['qualification']);
            if ((payload.replacementQualification as TourPlanningSource).snapshot.employee_id !== (payload.replacement as TourPlanningPerson).id)
                fail('Die Ersatzqualifikation gehört nicht zur Ersatzperson.');
            words(payload, ['notification', 'decision']);
            break;
        case 'series_exception':
            if (!exact(payload, ['series', 'occurrenceId', 'originalDate', 'newDate', 'holidayCalendarVersion', 'action', 'reason']))
                fail('Die Serien- oder Feiertagsentscheidung ist unvollständig.');
            src(payload, 'series', scope, ['series']);
            if (!tourPlanningId(payload.occurrenceId) || !date(payload.originalDate) || !(payload.newDate === null || date(payload.newDate)))
                fail('Das konkrete Serienvorkommen ist ungültig.');
            words(payload, ['holidayCalendarVersion', 'reason']);
            choice(payload, 'action', ['keep', 'reschedule', 'cancel']);
            if (payload.action === 'reschedule' && payload.newDate === null)
                fail('Die Verschiebung benötigt ein neues Datum.');
            break;
        case 'publish':
            if (!exact(payload, ['tour', 'planVersionEventId', 'versionLabel', 'validFrom', 'validUntil', 'recipients', 'decision']))
                fail('Die Veröffentlichung ist unvollständig.');
            src(payload, 'tour', scope, ['tour']);
            if (!tourPlanningId(payload.planVersionEventId) || !Array.isArray(payload.recipients) || payload.recipients.length === 0 || payload.recipients.length > 100)
                fail('Planfassung und adressierte Empfänger fehlen.');
            {
                const ids = new Set<string>();
                for (const recipient of payload.recipients) {
                    person(recipient, scope.tenantId);
                    if (ids.has(recipient.id))
                        fail('Empfänger dürfen nicht doppelt adressiert werden.');
                    ids.add(recipient.id);
                }
            }
            words(payload, ['versionLabel', 'decision']);
            if (!date(payload.validFrom) || !date(payload.validUntil) || payload.validFrom > payload.validUntil)
                fail('Die Veröffentlichungsgültigkeit ist ungültig.');
            break;
        case 'acknowledge':
            if (!exact(payload, ['publishEventId', 'recipient', 'channel', 'decision']))
                fail('Die Empfangsbestätigung ist unvollständig.');
            if (!tourPlanningId(payload.publishEventId))
                fail('Die veröffentlichte Planfassung fehlt.');
            who(payload, 'recipient', scope);
            words(payload, ['channel', 'decision']);
            break;
        case 'trip_start':
            if (!exact(payload, ['tour', 'vehicle', 'maintenance', 'driver', 'startedAt', 'startKm', 'purpose', 'handover']))
                fail('Die Fahrteröffnung ist unvollständig.');
            src(payload, 'tour', scope, ['tour']);
            src(payload, 'vehicle', scope, ['vehicle']);
            src(payload, 'maintenance', scope, ['maintenance']);
            who(payload, 'driver', scope);
            if ((payload.vehicle as TourPlanningSource).id !== (payload.maintenance as TourPlanningSource).id)
                fail('Der Wartungsbeleg gehört nicht zum Fahrtfahrzeug.');
            if (!instant(payload.startedAt) || !integer(payload.startKm, 0, 10000000))
                fail('Fahrtbeginn oder Kilometerstand ist ungültig.');
            if (['maintenance', 'damaged', 'decommissioned', 'out_of_service', 'overdue'].includes(sourceStatus(payload.maintenance)))
                fail('Das Fahrzeug ist nicht für eine Fahrt freigegeben.');
            words(payload, ['purpose', 'handover']);
            break;
        case 'trip_finish':
            if (!exact(payload, ['tripStartEventId', 'endedAt', 'endKm', 'returnNotes']))
                fail('Der Fahrtabschluss ist unvollständig.');
            if (!tourPlanningId(payload.tripStartEventId) || !instant(payload.endedAt) || !integer(payload.endKm, 0, 10000000))
                fail('Fahrtbezug, Ende oder Kilometerstand ist ungültig.');
            words(payload, ['returnNotes']);
            break;
        case 'maintenance':
            if (!exact(payload, ['vehicle', 'maintenance', 'dueAt', 'status', 'outcome', 'replacement', 'decision']))
                fail('Der Wartungsvorgang ist unvollständig.');
            src(payload, 'vehicle', scope, ['vehicle']);
            src(payload, 'maintenance', scope, ['maintenance']);
            if (!instant(payload.dueAt))
                fail('Die Wartungsfrist fehlt.');
            choice(payload, 'status', ['due', 'out_of_service', 'completed', 'cleared']);
            words(payload, ['outcome', 'decision']);
            optionalSource(payload, 'replacement', scope, ['vehicle']);
            break;
        case 'correct':
            if (!exact(payload, ['targetId', 'reason']) || !tourPlanningId(payload.targetId))
                fail('Die Berichtigung ist unvollständig.');
            words(payload, ['reason']);
            break;
    }
}
export function validateTourPlanningCommand(value: unknown, now = Date.now()): asserts value is TourPlanningCommand {
    tourPlanningJson(value);
    if (!tourPlanningObject(value))
        fail('Die Planungsanfrage fehlt.');
    if (value.version === tourPlanningLegacyVersion) {
        validateLegacyTourPlanningCommand(value, now);
        return;
    }
    if (value.version !== tourPlanningVersion || !tourPlanningKinds.includes(value.kind as TourPlanningKind) || !tourPlanningObject(value.payload))
        fail('Die aktuelle Planungsversion ist nicht bestätigt.');
    validateLegacyTourPlanningCommand(planningLegacyProjection(value as unknown as TourPlanningCommand), now);
    validatePlanningPayload(value as unknown as TourPlanningCommand);
}
const latest = (events: TourPlanningEvent[], kind: TourPlanningKind, predicate: (payload: TourPlanningRow, event: TourPlanningEvent) => boolean) => events.findLast((event) => event.command.kind === kind && predicate(event.command.payload, event));
function applyLegacyTourPlanningCommand(previous: TourPlanningState, command: TourPlanningCommand, now = Date.now()): TourPlanningState {
    validateTourPlanningCommand(command, now);
    if (command.expectedHeadId !== previous.headId || previous.events.some((event) => event.id === command.eventId || event.command.requestId === command.requestId))
        fail('Der Planungsstand wurde geändert oder die Anfrage ist bereits enthalten. Neu laden.');
    const state = structuredClone(previous);
    const payload = command.payload;
    if (command.kind === 'replan') {
        const assignment = state.events.find((event) => event.id === payload.previousAssignmentEventId && event.command.kind === 'assignment');
        if (!assignment)
            fail('Die kurzfristige Umplanung benötigt die unveränderte bisherige Zuordnung.');
    }
    if (command.kind === 'publish') {
        const version = state.events.find((event) => event.id === payload.planVersionEventId && event.command.kind === 'plan_version');
        const assignment = latest(state.events, 'assignment', (candidate) => (candidate.tour as TourPlanningSource).id === (payload.tour as TourPlanningSource).id);
        const visit = latest(state.events, 'visit_binding', (candidate) => (candidate.tour as TourPlanningSource).id === (payload.tour as TourPlanningSource).id && candidate.continuity === 'active' && candidate.decision !== 'blocked');
        const rejectedRule = latest(state.events, 'rule_review', () => true)?.command.payload.result === 'rejected';
        if (!version || version.command.payload.versionLabel !== payload.versionLabel || version.command.payload.validFrom !== payload.validFrom || version.command.payload.validUntil !== payload.validUntil || !assignment || !visit || rejectedRule)
            fail('Freigabe benötigt dieselbe Planfassung, eine geprüfte Zuordnung, aktive Besuchsbindung und keine zurückgewiesene Regelprüfung.');
    }
    if (command.kind === 'acknowledge') {
        const publication = state.events.find((event) => event.id === payload.publishEventId && event.command.kind === 'publish');
        if (!publication || !(publication.command.payload.recipients as TourPlanningPerson[]).some((recipient) => sameWoundJson(recipient, payload.recipient)))
            fail('Der Empfang gehört nicht zur adressierten veröffentlichten Planfassung.');
        const recipient = payload.recipient as TourPlanningPerson;
        if (recipient.profileId === null || recipient.profileId !== command.actorId)
            fail('Nur die aktuell verknüpfte empfangende Person darf ihre eigene Planfassung bestätigen.');
        if (state.events.some((event) => event.command.kind === 'acknowledge' && event.command.payload.publishEventId === payload.publishEventId && (event.command.payload.recipient as TourPlanningPerson).id === recipient.id))
            fail('Der Empfang dieser Planfassung ist bereits bestätigt.');
    }
    if (command.kind === 'trip_finish') {
        const start = state.events.find((event) => event.id === payload.tripStartEventId && event.command.kind === 'trip_start');
        if (!start || at(start.command.payload.startedAt as string) > at(payload.endedAt as string) || Number(payload.endKm) < Number(start.command.payload.startKm))
            fail('Fahrtende und Kilometer müssen zum ursprünglichen Fahrtbeginn passen.');
        if (state.events.some((event) => event.command.kind === 'trip_finish' && event.command.payload.tripStartEventId === payload.tripStartEventId))
            fail('Diese Fahrt ist bereits abgeschlossen.');
    }
    if (command.kind === 'correct') {
        const target = state.events.find((event) => event.id === payload.targetId);
        if (!target || target.command.kind === 'correct' || state.corrected.includes(target.id))
            fail('Nur ein vorhandenes noch nicht berichtigtes Originalereignis kann korrigiert werden.');
        state.corrected.push(target.id);
    }
    state.headId = command.eventId;
    return state;
}
export function applyTourPlanningCommand(previous: TourPlanningState, command: TourPlanningCommand, now = Date.now()): TourPlanningState {
    if (command.version === tourPlanningLegacyVersion)
        return applyLegacyTourPlanningCommand(previous, command, now);
    validateTourPlanningCommand(command, now);
    if (command.expectedHeadId !== previous.headId || previous.events.some(e => e.id === command.eventId || e.command.requestId === command.requestId))
        fail('Der Planungsstand wurde geändert oder die Anfrage ist bereits enthalten. Neu laden.');
    const next = structuredClone(previous);
    const corrected = checkPlanningTransition(next, command);
    if (corrected)
        next.corrected.push(corrected);
    next.headId = command.eventId;
    return next;
}
export const emptyTourPlanningState = (): TourPlanningState => ({ headId: null, events: [], corrected: [] });
export function decodeTourPlanningHistory(value: unknown, scope: Pick<TourPlanningScope, 'tenantId' | 'planId'>, now = Date.now()) {
    if (!exact(value, ['version', 'tenantId', 'planId', 'count', 'headId', 'events']) || ![tourPlanningVersion, tourPlanningLegacyVersion].includes(value.version as TourPlanningVersion) || value.tenantId !== scope.tenantId || value.planId !== scope.planId || !Array.isArray(value.events) || value.count !== value.events.length || value.events.length > 20000)
        fail('Der vollständige Planungsverlauf fehlt.');
    tourPlanningJson(value, 30000000);
    let state = emptyTourPlanningState();
    const requests = new Set<string>();
    let recorded: bigint | null = null;
    for (const raw of value.events) {
        if (!exact(raw, ['id', 'sequence', 'previousId', 'tenantId', 'planId', 'actorId', 'actorName', 'recordedAt', 'command']) || !tourPlanningId(raw.id) || raw.tenantId !== scope.tenantId || raw.planId !== scope.planId || raw.sequence !== state.events.length + 1 || raw.previousId !== state.headId || !text(raw.actorName, 300) || !instant(raw.recordedAt) || recorded !== null && at(raw.recordedAt as string) < recorded)
            fail('Die Planungsereigniskette ist abgeschnitten oder widersprüchlich.');
        const event = raw as unknown as TourPlanningEvent;
        validateTourPlanningCommand(event.command, Number(at(event.recordedAt) / 1000n) + 1);
        if (event.command.eventId !== event.id || event.command.tenantId !== event.tenantId || event.command.planId !== event.planId || event.command.actorId !== event.actorId || requests.has(event.command.requestId) || at(event.command.occurredAt) > at(event.recordedAt))
            fail('Die Originalanfrage passt nicht zum Planungsereignis.');
        state = applyTourPlanningCommand(state, event.command, Number(at(event.recordedAt) / 1000n) + 1);
        state.events.push(structuredClone(event));
        requests.add(event.command.requestId);
        recorded = at(event.recordedAt);
    }
    if (value.headId !== state.headId)
        fail('Der gemeldete Planungskopf passt nicht zur Originalhistorie.');
    return { history: structuredClone(value) as TourPlanningHistory, state };
}
export function decodeTourPlanningContext(value: unknown, scope: TourPlanningScope, now = Date.now()): TourPlanningContext {
    if (!exact(value, ['version', 'tenantId', 'planId', 'actorId', 'loadedAt', 'plan', 'sources', 'people', 'history']) || value.version !== tourPlanningVersion || !Object.entries(scope).every(([key, expected]) => tourPlanningId(expected) && value[key] === expected) || !instant(value.loadedAt) || at(value.loadedAt as string) > BigInt(Math.trunc(now)) * 1000n || !tourPlanningObject(value.plan) || value.plan.id !== scope.planId || value.plan.tenant_id !== scope.tenantId || !exact(value.sources, ['count', 'rows']) || !Array.isArray(value.sources.rows) || value.sources.count !== value.sources.rows.length || !exact(value.people, ['count', 'rows']) || !Array.isArray(value.people.rows) || value.people.count !== value.people.rows.length)
        fail('Der vollständige aktuelle Planungsstand ist nicht bestätigt.');
    tourPlanningJson(value, 32000000);
    const sourceKeys = new Set<string>();
    for (const row of value.sources.rows) {
        source(row, scope, ['tour', 'stop', 'shift', 'availability', 'absence', 'qualification', 'work_rule', 'preference', 'admission', 'care_plan', 'series', 'vehicle', 'maintenance', 'trip', 'personnel', 'resource']);
        const key = `${row.kind}:${row.id}`;
        if (sourceKeys.has(key))
            fail('Planungsoriginale sind doppelt vorhanden.');
        sourceKeys.add(key);
    }
    if (!value.sources.rows.some((row) => row.kind === 'tour' && row.id === scope.planId && sameWoundJson(row.snapshot, value.plan)))
        fail('Die native Tourfassung fehlt im vollständigen Quellenbestand.');
    const people = new Set<string>();
    for (const row of value.people.rows) {
        person(row, scope.tenantId);
        if (people.has(row.id))
            fail('Aktive Personen sind doppelt vorhanden.');
        people.add(row.id);
    }
    decodeTourPlanningHistory(value.history, scope, now);
    return structuredClone(value) as TourPlanningContext;
}
export function assertTourPlanningSelectionCurrent(command: TourPlanningCommand, context: TourPlanningContext) {
    validateTourPlanningCommand(command);
    if (command.tenantId !== context.tenantId || command.planId !== context.planId || command.actorId !== context.actorId || command.expectedHeadId !== context.history.headId)
        fail('Plan, Konto oder Fassung wurden geändert.');
    const check = (value: unknown): void => {
        if (Array.isArray(value))
            return void value.forEach(check);
        if (tourPlanningObject(value) && Object.hasOwn(value, 'snapshot') && !context.sources.rows.some((row) => sameWoundJson(row, value)))
            fail('Ein Planungsoriginal wurde geändert oder ist nicht mehr aktuell zugänglich.');
        if (tourPlanningObject(value) && Object.hasOwn(value, 'roleKey') && !context.people.rows.some((row) => sameWoundJson(row, value)))
            fail('Eine beteiligte Person wurde geändert oder ist nicht mehr aktiv zugänglich.');
    };
    Object.values(command.payload).forEach(check);
    assertPlanningContextPrerequisites(command, context);
    applyTourPlanningCommand(decodeTourPlanningHistory(context.history, context).state, command);
}
export function decodeTourPlanningReceipt(value: unknown, command: TourPlanningCommand): TourPlanningReceipt {
    if (!exact(value, ['version', 'requestId', 'command', 'event']) || ![tourPlanningVersion, tourPlanningLegacyVersion].includes(value.version as TourPlanningVersion) || value.requestId !== command.requestId || !sameWoundJson(value.command, command) || !exact(value.event, ['id', 'sequence', 'previousId', 'tenantId', 'planId', 'actorId', 'actorName', 'recordedAt', 'command']))
        fail('Die native Planungsquittung passt nicht zur gesicherten Anfrage.');
    const event = value.event;
    if (event.id !== command.eventId || event.previousId !== command.expectedHeadId || event.tenantId !== command.tenantId || event.planId !== command.planId || event.actorId !== command.actorId || !Number.isSafeInteger(event.sequence) || Number(event.sequence) < 1 || !text(event.actorName, 300) || !instant(event.recordedAt) || at(command.occurredAt) > at(event.recordedAt) || !sameWoundJson(event.command, command))
        fail('Die native Planungsereignisquittung ist widersprüchlich.');
    tourPlanningJson(value, 20000000);
    return structuredClone(value) as TourPlanningReceipt;
}
