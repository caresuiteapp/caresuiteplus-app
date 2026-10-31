// Generated native presentation from src/lib/pflege/tourPlanningWorkspaceForm.web.ts. Update through scripts/port-native-workspaces.mjs.
import { tourPlanningLabels, tourPlanningVersion, validateTourPlanningCommand, type TourPlanningCommand, type TourPlanningContext, type TourPlanningKind, type TourPlanningRow, type TourPlanningSourceKind, type TourPlanningState } from "./tourPlanningWorkspaceDomain.native.ts";
import { buildPlanningPacket } from "./tourPlanningWorkspaceRules.native.ts";
import { supplyLocalTime, supplyTimeCandidates, supplyTimeFromInput } from "./supplyWorkspaceForm.native.ts";
import { woundInstant } from './woundCareDomain.ts';
import type { TourPlanningDraft } from "./tourPlanningWorkspaceDraft.native.ts";
export type TourPlanningField = {
    key: string;
    label: string;
    type: 'text' | 'date' | 'time' | 'number' | 'choice' | 'source' | 'person' | 'people' | 'event';
    optional?: boolean;
    sourceKinds?: TourPlanningSourceKind[];
    eventKinds?: TourPlanningKind[];
    options?: {
        key: string;
        label: string;
    }[];
};
export type TourPlanningOption = {
    id: string;
    label: string;
    value: unknown;
};
const field = (key: string, label: string, type: TourPlanningField['type'] = 'text', optional = false): TourPlanningField => ({ key, label, type, optional });
const source = (key: string, label: string, ...sourceKinds: TourPlanningSourceKind[]): TourPlanningField => ({ key, label, type: 'source', sourceKinds });
const person = (key: string, label: string, optional = false): TourPlanningField => ({ key, label, type: 'person', optional });
const event = (key: string, label: string, eventKinds: TourPlanningKind[], optional = false): TourPlanningField => ({ key, label, type: 'event', eventKinds, optional });
const labels: Record<string, string> = { compliant: 'Regelkonform geprüft', exception_required: 'Ausnahme muss geklärt werden', rejected: 'Zurückgewiesen', active: 'Versorgung aktiv', interrupted: 'Unterbrochen', ended: 'Beendet', planned: 'Einplanen', blocked: 'Gesperrt lassen', honored: 'Berücksichtigt', deviation: 'Begründete Abweichung', required: 'Verbindlich', high: 'Hohe Priorität', normal: 'Normale Priorität', keep: 'Beibehalten', reschedule: 'Einzeltermin verschieben', cancel: 'Einzeltermin absagen', due: 'Prüfung fällig', out_of_service: 'Fahrzeug sperren', completed: 'Prüfung durchgeführt', cleared: 'Ausdrückliche befristete Freigabe', alarm: 'Hausnotruf', support: 'Weitere Unterstützung', other: 'Andere Zusatzleistung', accepted: 'Anbieter hat zugesagt', stopped: 'Anbieter hat Beendigung bestätigt', delivered: 'Offene Menge vollständig geliefert', partial: 'Teilmenge geliefert', not_delivered: 'Nicht geliefert' };
const choice = (key: string, label: string, values: string[]): TourPlanningField => ({ key, label, type: 'choice', options: values.map(value => ({ key: value, label: labels[value] ?? value })) });
export const tourPlanningGroups = [
    { key: 'plan', label: 'Plan und Besuche', kinds: ['plan_version', 'rule_review', 'visit_binding', 'preference_exception', 'series_exception'] },
    { key: 'people', label: 'Zuordnung und Umplanung', kinds: ['assignment', 'replan'] },
    { key: 'release', label: 'Freigabe und Empfang', kinds: ['publish', 'acknowledge'] },
    { key: 'fleet', label: 'Fahrten und Fahrzeuge', kinds: ['maintenance', 'trip_start', 'trip_finish'] },
    { key: 'extra', label: 'Zusatzleistungen und Essen', kinds: ['additional_request', 'additional_response', 'meal_request', 'meal_delivery'] },
    { key: 'correction', label: 'Berichtigung', kinds: ['correct'] },
] as const;
export function tourPlanningFields(kind: TourPlanningKind): TourPlanningField[] {
    const vehicle = (): TourPlanningField => ({ ...source('vehicle', 'Fahrzeug', 'vehicle'), optional: true });
    switch (kind) {
        case 'plan_version': return [source('tour', 'Aktuelle Tourfassung', 'tour'), field('versionLabel', 'Bezeichnung der neuen Planfassung'), field('validFrom', 'Gültig ab', 'date'), field('validUntil', 'Gültig bis', 'date'), field('decision', 'Verantwortliche Planentscheidung')];
        case 'rule_review': return [source('rule', 'Schichtvorgaben zur Prüfung', 'work_rule'), source('shift', 'Geprüfte Schicht', 'shift'), field('startedAt', 'Geplanter Beginn', 'time'), field('endedAt', 'Geplantes Ende', 'time'), field('breakMinutes', 'Pause in Minuten', 'number'), choice('result', 'Prüfergebnis', ['compliant', 'exception_required', 'rejected']), field('exceptionReason', 'Geprüfte Regelgrundlage und gegebenenfalls offene Ausnahme')];
        case 'visit_binding': return [source('tour', 'Tourfassung', 'tour'), source('stop', 'Konkreter Besuch', 'stop'), source('admission', 'Aktive Aufnahme', 'admission'), source('carePlan', 'Geltender Pflege- oder Leistungsplan', 'care_plan'), field('frequency', 'Bedarf und Frequenz'), field('serviceType', 'Konkrete Leistungsart'), field('windowStart', 'Zeitfenster Beginn', 'time'), field('windowEnd', 'Zeitfenster Ende', 'time'), choice('continuity', 'Versorgungsstand', ['active', 'interrupted', 'ended']), choice('decision', 'Planungsentscheidung', ['planned', 'blocked'])];
        case 'assignment': return [event('planVersionEventId', 'Aktuelle geprüfte Planfassung', ['plan_version']), source('tour', 'Tourfassung', 'tour'), person('primary', 'Erste Person'), source('primaryPersonnel', 'Aktueller Personalentscheidungsbestand der ersten Person', 'personnel'), source('primaryQualification', 'Genau geprüfte Qualifikation der ersten Person', 'qualification'), source('shift', 'Schicht der ersten Person', 'shift'), person('secondary', 'Zweite Person bei Doppelbesetzung', true), { ...source('secondaryPersonnel', 'Personalentscheidungsbestand der zweiten Person', 'personnel'), optional: true }, { ...source('secondaryQualification', 'Eigene Qualifikation der zweiten Person', 'qualification'), optional: true }, field('activity', 'Konkrete Tätigkeit wie in der Personalprüfung'), field('startedAt', 'Zuordnung ab', 'time'), field('endedAt', 'Zuordnung bis', 'time'), vehicle(), event('maintenanceEventId', 'Ausdrückliche Fahrzeugfreigabe', ['maintenance'], true), field('capacityMinutes', 'Geprüfte Kapazität in Minuten', 'number'), field('travelMinutes', 'Geplante Fahrtzeit in Minuten', 'number'), field('accessSummary', 'Zugangsvoraussetzungen ohne Zugangscodes'), field('decision', 'Zuordnungsentscheidung')];
        case 'preference_exception': return [source('stop', 'Konkreter Besuch', 'stop'), source('preference', 'Zugehörige Vereinbarung oder Präferenz', 'preference'), choice('outcome', 'Ergebnis', ['honored', 'deviation']), choice('priority', 'Vereinbarte Priorität', ['required', 'high', 'normal']), field('reason', 'Begründung der Entscheidung')];
        case 'replan': return [source('tour', 'Tourfassung', 'tour'), source('stop', 'Noch nicht begonnener Besuch', 'stop'), event('previousAssignmentEventId', 'Aktuelle betroffene Zuordnung', ['assignment']), source('cause', 'Ausfall oder Abwesenheit der bisher zugeordneten Person', 'absence'), person('replacement', 'Geprüfte Ersatzperson'), source('replacementPersonnel', 'Aktuelle Personalentscheidungen der Ersatzperson', 'personnel'), source('replacementQualification', 'Passende Qualifikation der Ersatzperson', 'qualification'), field('activity', 'Dieselbe konkrete Tätigkeit'), field('startedAt', 'Vertretung ab', 'time'), field('endedAt', 'Vertretung bis', 'time'), field('notification', 'Dokumentierte Benachrichtigung und offene Rückmeldungen'), field('decision', 'Umplanungsentscheidung')];
        case 'series_exception': return [source('series', 'Versionierte Serienregel', 'series'), source('occurrence', 'Ausdrücklich zugeordneter Einzelbesuch', 'stop'), source('carePlan', 'Pflegeplan desselben Pflegefalls', 'care_plan'), field('originalDate', 'Ursprüngliches Datum', 'date'), field('newDate', 'Neues Datum nur bei Verschiebung', 'date', true), field('holidayCalendarVersion', 'Tatsächlich geprüfte Feiertagskalenderfassung'), choice('action', 'Einzelentscheidung', ['keep', 'reschedule', 'cancel']), field('reason', 'Ausnahmegrund')];
        case 'publish': return [source('tour', 'Freizugebende Tourfassung', 'tour'), event('planVersionEventId', 'Aktuelle unveränderliche Planfassung', ['plan_version']), field('versionLabel', 'Dieselbe Planbezeichnung'), field('validFrom', 'Gültig ab', 'date'), field('validUntil', 'Gültig bis', 'date'), field('recipients', 'Verknüpfte Empfänger hinzufügen', 'people'), field('decision', 'Freigabeentscheidung zum angezeigten Planinhalt')];
        case 'acknowledge': return [event('publishEventId', 'Eigene aktuelle Veröffentlichung', ['publish']), person('recipient', 'Eigene empfangende Person'), field('channel', 'Empfangskanal'), field('decision', 'Persönliche Bestätigung des angezeigten Planinhalts')];
        case 'trip_start': return [source('tour', 'Tourfassung', 'tour'), source('vehicle', 'Übernommenes Fahrzeug', 'vehicle'), event('maintenanceEventId', 'Aktuelle ausdrückliche Fahrzeugfreigabe', ['maintenance']), person('driver', 'Eigene fahrende Person'), field('startedAt', 'Tatsächlicher Fahrtbeginn', 'time'), field('startKm', 'Tatsächlicher Kilometerstand bei Übernahme', 'number'), field('purpose', 'Fahrtzweck'), field('handover', 'Übernahme und tatsächlicher Zustand')];
        case 'trip_finish': return [event('tripStartEventId', 'Eigene offene Fahrt', ['trip_start']), field('endedAt', 'Tatsächliches Fahrtende', 'time'), field('endKm', 'Tatsächlicher Kilometerstand bei Rückgabe', 'number'), field('returnNotes', 'Rückgabe und tatsächliche Auffälligkeiten')];
        case 'maintenance': return [source('vehicle', 'Fahrzeug', 'vehicle'), field('dueAt', 'Nächste Prüffrist oder dokumentierter Fälligkeitstermin', 'time'), choice('status', 'Eigenes dokumentiertes Ergebnis', ['due', 'out_of_service', 'completed', 'cleared']), field('outcome', 'Tatsächlicher Prüf- oder Wartungsbeleg und Ergebnis'), { ...source('replacement', 'Anderes Ersatzfahrzeug', 'vehicle'), optional: true }, field('decision', 'Verantwortliche Entscheidung über Sperre oder Freigabe')];
        case 'additional_request': return [source('stop', 'Zugehöriger Besuch', 'stop'), source('admission', 'Zugehörige Aufnahme', 'admission'), choice('category', 'Zusatzleistung', ['alarm', 'support', 'other']), field('provider', 'Anbieter'), field('contact', 'Kontakt und vereinbarte Notfallkette'), field('contractReference', 'Tatsächliche Vertrags- oder Anfragereferenz'), field('requestText', 'Anfrage, Zuständigkeit und offene Schritte')];
        case 'additional_response': return [event('requestEventId', 'Ursprüngliche Zusatzleistungsanfrage', ['additional_request']), field('receivedAt', 'Tatsächlicher Eingang der Antwort', 'time'), choice('result', 'Belegtes Antwortergebnis', ['accepted', 'rejected', 'stopped']), field('evidenceReference', 'Originalreferenz der Anbieterantwort'), field('decision', 'Konsequenz und noch offene Schritte')];
        case 'meal_request': return [source('stop', 'Zugehöriger Besuch', 'stop'), source('admission', 'Zugehörige Aufnahme', 'admission'), field('provider', 'Essensanbieter'), field('serviceDate', 'Konkreter Liefertag', 'date'), field('portions', 'Angefragte Portionen', 'number'), field('dietNotes', 'Vereinbarte Kost oder ausdrücklich fehlende Angaben'), field('requestReference', 'Originalreferenz der Anfrage')];
        case 'meal_delivery': return [event('requestEventId', 'Ursprüngliche Essensanfrage', ['meal_request']), field('deliveredAt', 'Tatsächlicher Lieferzeitpunkt', 'time'), field('portions', 'Tatsächlich gelieferte Portionen', 'number'), choice('result', 'Tatsächliches Ergebnis', ['delivered', 'partial', 'not_delivered']), field('receivedBy', 'Tatsächlich annehmende Person oder Grund fehlender Annahme'), field('deviation', 'Abweichung oder ausdrücklicher Vermerk ohne Auffälligkeit')];
        case 'correct': return [event('targetId', 'Zu berichtigendes Original', []), field('reason', 'Berichtigungsgrund; das Original bleibt erhalten')];
    }
}
const name = (snapshot: TourPlanningRow) => [snapshot.title ?? snapshot.name ?? snapshot.plate ?? snapshot.client_name_snapshot ?? snapshot.first_name, snapshot.last_name, snapshot.tour_date ?? snapshot.shift_date].filter(v => typeof v === 'string' && v).join(' · ');
export function tourPlanningOptions(f: TourPlanningField, state: TourPlanningState, context: TourPlanningContext, selected: TourPlanningDraft['selected'] = {}, kind?: TourPlanningKind): TourPlanningOption[] {
    const picked = (key: string) => selected[key]?.value as TourPlanningRow | undefined;
    const personKey = !f.sourceKinds?.some(k => k === 'personnel' || k === 'qualification') ? null : f.key.startsWith('primary') ? 'primary' : f.key.startsWith('secondary') ? 'secondary' : f.key.startsWith('replacement') ? 'replacement' : null;
    if (f.type === 'person' || f.type === 'people')
        return context.people.rows.filter(p => (f.type !== 'people' || p.profileId !== null) && (!['driver', 'recipient'].includes(f.key) || p.profileId === context.actorId)).map(p => ({ id: p.id, label: p.name + (p.profileId === null ? ' · noch ohne Kontoverknüpfung' : ''), value: p }));
    if (f.type === 'source')
        return context.sources.rows.filter(s => f.sourceKinds?.includes(s.kind) && (!personKey || !picked(personKey) || (s.kind === 'personnel' ? s.id : s.snapshot.employee_id) === picked(personKey)!.id) && (f.key !== 'shift' || !picked('primary') || s.snapshot.employee_id === picked('primary')!.id) && (f.key !== 'preference' || !picked('stop') || s.snapshot.client_id === (picked('stop')!.snapshot as TourPlanningRow).client_id)).map(s => ({ id: s.id, label: name(s.snapshot) || (s.kind === 'personnel' ? 'Personalentscheidungen · ' + (context.people.rows.find(p => p.id === s.id)?.name ?? 'Person') : 'Original ohne Bezeichnung · ' + s.kind), value: s }));
    if (f.type === 'event') {
        let events = state.events.filter(e => e.command.kind !== 'correct' && !state.corrected.includes(e.id) && (!f.eventKinds?.length || f.eventKinds.includes(e.command.kind)));
        if (['planVersionEventId', 'previousAssignmentEventId'].includes(f.key))
            events = events.slice(-1);
        if (f.key === 'maintenanceEventId')
            events = events.filter(e => e.command.version === tourPlanningVersion && e.command.payload.status === 'cleared' && (!picked('vehicle') || (e.command.payload.vehicle as TourPlanningRow).id === picked('vehicle')!.id) && !state.events.some(later => later.sequence > e.sequence && later.command.kind === 'maintenance' && !state.corrected.includes(later.id) && (later.command.payload.vehicle as TourPlanningRow).id === (e.command.payload.vehicle as TourPlanningRow).id));
        if (f.key === 'tripStartEventId')
            events = events.filter(e => (e.command.payload.driver as TourPlanningRow).profileId === context.actorId && !state.events.some(a => a.command.kind === 'trip_finish' && !state.corrected.includes(a.id) && a.command.payload.tripStartEventId === e.id));
        if (kind === 'acknowledge' && f.key === 'publishEventId')
            events = events.filter(e => e.command.version === tourPlanningVersion && (e.command.payload.recipients as TourPlanningRow[]).some(p => p.profileId === context.actorId));
        return events.map(e => ({ id: e.id, label: tourPlanningLabels[e.command.kind] + ' · ' + e.command.occurredAt + ' · ' + e.actorName, value: e.id }));
    }
    return [];
}
const selectedValue = (d: TourPlanningDraft, key: string) => d.selected[key]?.value;
const value = (d: TourPlanningDraft, key: string) => d.values[key] ?? '';
const numberValue = (d: TourPlanningDraft, key: string) => /^\d+$/.test(value(d, key)) ? Number(value(d, key)) : NaN;
const timeValue = (d: TourPlanningDraft, key: string) => tourPlanningTimeFromInput(value(d, key));
function maintenance(d: TourPlanningDraft) { const vehicle = selectedValue(d, 'vehicle') as TourPlanningRow | undefined; return vehicle ? { ...vehicle, kind: 'maintenance' } : null; }
export function buildTourPlanningCommand(d: TourPlanningDraft, state: TourPlanningState, requestId: string, eventId: string): TourPlanningCommand {
    const p: TourPlanningRow = {};
    for (const f of tourPlanningFields(d.kind)) {
        if (f.type === 'people') {
            p.recipients = Object.entries(d.selected).filter(([k]) => k.startsWith('recipient:')).map(([, v]) => v.value);
            continue;
        }
        p[f.key] = ['source', 'person', 'event'].includes(f.type) ? selectedValue(d, f.key) ?? null : f.type === 'number' ? numberValue(d, f.key) : f.type === 'time' ? timeValue(d, f.key) : f.optional && value(d, f.key) === '' ? null : value(d, f.key);
    }
    if (['assignment', 'trip_start', 'maintenance'].includes(d.kind))
        p.maintenance = maintenance(d);
    if (d.kind === 'series_exception')
        p.occurrenceId = (p.occurrence as TourPlanningRow | null)?.id;
    if (d.kind === 'publish')
        p.packet = buildPlanningPacket(state);
    const command = { version: tourPlanningVersion, requestId, eventId, ...d.scope, expectedHeadId: state.headId, kind: d.kind, occurredAt: tourPlanningTimeFromInput(d.occurredAt), note: d.note, payload: p };
    validateTourPlanningCommand(command);
    return command;
}
export const tourPlanningLocalTime = supplyLocalTime;
export const tourPlanningTimeCandidates = supplyTimeCandidates;
export function tourPlanningTimeFromInput(value: string) {
    const normalized = supplyTimeFromInput(value);
    if (woundInstant(normalized) === null)
        throw Error(supplyTimeCandidates(value).length > 1 ? 'Diese Ortszeit kommt zweimal vor. Den tatsächlichen UTC-Abstand auswählen.' : 'Zeitpunkt mit Datum und gültiger Uhrzeit vollständig angeben. Eine nicht vorhandene Ortszeit wird nicht verschoben.');
    return normalized;
}
