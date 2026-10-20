import { sameWoundJson, woundInstant, woundUuid } from './woundCareDomain.ts';
import { decodePersonnelHistory } from '../office/personnelWorkspaceDomain.web.ts';
import type { TourPlanningCommand, TourPlanningContext, TourPlanningEvent, TourPlanningKind, TourPlanningRow, TourPlanningSource, TourPlanningState } from './tourPlanningWorkspaceDomain.web.ts';

function fail(message: string): never { throw Error(message); }
const object = (v: unknown): v is TourPlanningRow => !!v && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
const id = (v: unknown): v is string => woundUuid(v) && v === v.toLowerCase();
const text = (v: unknown, max = 4000): v is string => typeof v === 'string' && !!v.trim() && v.length <= max && !v.includes('\u0000');
const instant = (v: unknown): v is string => typeof v === 'string' && woundInstant(v) !== null;
const at = (v: unknown) => instant(v) ? woundInstant(v)! : fail('Der vollständige Zeitpunkt fehlt.');
const date = (v: unknown): v is string => typeof v === 'string' && /^(?!0000)\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
const integer = (v: unknown, min = 0, max = 1_000_000) => Number.isSafeInteger(v) && Number(v) >= min && Number(v) <= max;
const exact = (v: unknown, keys: readonly string[]): v is TourPlanningRow => object(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const words = (p: TourPlanningRow, ...keys: string[]) => { if (keys.some(k => !text(p[k]))) fail('Anlass, Entscheidung oder Originalbelegreferenz fehlen.'); };
export const legacyPlanningPayloadKeys: Record<string, readonly string[]> = {
  plan_version: ['tour', 'versionLabel', 'validFrom', 'validUntil', 'decision'],
  rule_review: ['rule', 'shift', 'startedAt', 'endedAt', 'breakMinutes', 'result', 'exceptionReason'],
  visit_binding: ['tour', 'stop', 'admission', 'carePlan', 'frequency', 'serviceType', 'windowStart', 'windowEnd', 'continuity', 'decision'],
  assignment: ['tour', 'shift', 'primary', 'primaryQualification', 'secondary', 'secondaryQualification', 'vehicle', 'maintenance', 'capacityMinutes', 'travelMinutes', 'accessSummary', 'decision'],
  preference_exception: ['preference', 'stop', 'outcome', 'priority', 'reason'],
  replan: ['tour', 'stop', 'cause', 'previousAssignmentEventId', 'replacement', 'replacementQualification', 'notification', 'decision'],
  series_exception: ['series', 'occurrenceId', 'originalDate', 'newDate', 'holidayCalendarVersion', 'action', 'reason'],
  publish: ['tour', 'planVersionEventId', 'versionLabel', 'validFrom', 'validUntil', 'recipients', 'decision'],
  acknowledge: ['publishEventId', 'recipient', 'channel', 'decision'],
  trip_start: ['tour', 'vehicle', 'maintenance', 'driver', 'startedAt', 'startKm', 'purpose', 'handover'],
  trip_finish: ['tripStartEventId', 'endedAt', 'endKm', 'returnNotes'],
  maintenance: ['vehicle', 'maintenance', 'dueAt', 'status', 'outcome', 'replacement', 'decision'],
  correct: ['targetId', 'reason'],
};
const additions: Record<string, readonly string[]> = {
  assignment: ['planVersionEventId', 'primaryPersonnel', 'secondaryPersonnel', 'startedAt', 'endedAt', 'activity', 'maintenanceEventId'],
  replan: ['replacementPersonnel', 'startedAt', 'endedAt', 'activity'],
  publish: ['packet'],
  series_exception: ['occurrence', 'carePlan'],
  trip_start: ['maintenanceEventId'],
};
export const planningPayloadKeys: Record<string, readonly string[]> = {
  ...Object.fromEntries(Object.entries(legacyPlanningPayloadKeys).map(([k, keys]) => [k, [...keys, ...(additions[k] ?? [])]])),
  additional_request: ['stop', 'admission', 'category', 'provider', 'contact', 'contractReference', 'requestText'],
  additional_response: ['requestEventId', 'receivedAt', 'result', 'evidenceReference', 'decision'],
  meal_request: ['stop', 'admission', 'provider', 'serviceDate', 'portions', 'dietNotes', 'requestReference'],
  meal_delivery: ['requestEventId', 'deliveredAt', 'portions', 'result', 'receivedBy', 'deviation'],
};

export function planningLegacyProjection(c: TourPlanningCommand) {
  const keys = legacyPlanningPayloadKeys[c.kind];
  return { ...c, version: '2026-10-16.1', kind: keys ? c.kind : 'correct', payload: keys ? Object.fromEntries(keys.map(k => [k, c.payload[k]])) : { targetId: c.planId, reason: c.note } };
}
function source(v: unknown, c: TourPlanningCommand, kind: string): asserts v is TourPlanningSource {
  if (!exact(v, ['kind', 'id', 'snapshot']) || v.kind !== kind || !id(v.id) || !object(v.snapshot) || v.snapshot.id !== v.id || v.snapshot.tenant_id !== c.tenantId) fail('Der vollständige native Originalbezug fehlt.');
}
function visitSources(p: TourPlanningRow, c: TourPlanningCommand) {
  source(p.stop, c, 'stop'); source(p.admission, c, 'admission');
  const s = (p.stop as TourPlanningSource).snapshot, a = (p.admission as TourPlanningSource).snapshot;
  if (s.tour_id !== c.planId || !id(s.client_id) || s.client_id !== a.client_id) fail('Zusatzleistung oder Essen gehört nicht zu demselben nativen Besuch und Pflegefall.');
}
export function planningDay(value: string) {
  if (!instant(value)) fail('Der Planungszeitpunkt ist ungültig.');
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value));
  return ['year', 'month', 'day'].map(k => parts.find(p => p.type === k)!.value).join('-');
}
function interval(p: TourPlanningRow, start = 'startedAt', end = 'endedAt') {
  if (!instant(p[start]) || !instant(p[end]) || at(p[start]) >= at(p[end])) fail('Der Planungszeitraum braucht einen Beginn vor dem Ende.');
}
function withinShift(shift: TourPlanningRow, start: string, end: string) {
  if (!date(shift.shift_date) || !['draft', 'published', 'confirmed', 'in_progress'].includes(String(shift.status))) return false;
  const normalize = (v: unknown) => {
    if (typeof v !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?$/.test(v)) return null;
    const [time, fraction = ''] = v.split('.'); return time + '.' + fraction.padEnd(6, '0');
  };
  const from = normalize(shift.start_time), until = normalize(shift.end_time); if (from === null || until === null) return false;
  const clock = (v: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date(v)) + '.' + String((at(v) % 1_000_000n + 1_000_000n) % 1_000_000n).padStart(6, '0');
  const nextDay = new Date(Date.parse(shift.shift_date) + 86_400_000).toISOString().slice(0, 10);
  const beginning = shift.shift_date + 'T' + from, ending = (until <= from ? nextDay : shift.shift_date) + 'T' + until;
  return planningDay(start) + 'T' + clock(start) >= beginning && planningDay(end) + 'T' + clock(end) <= ending;
}
const active = (s: TourPlanningState) => s.events.filter(e => e.command.kind !== 'correct' && !s.corrected.includes(e.id));
const latest = (s: TourPlanningState, kind: TourPlanningKind, predicate: (p: TourPlanningRow) => boolean = () => true) => active(s).findLast(e => e.command.kind === kind && predicate(e.command.payload));
const live = (s: TourPlanningState, eventId: unknown, kind: TourPlanningKind) => active(s).find(e => e.id === eventId && e.command.kind === kind);

/** A qualification decision is used only for its exact activity, current originals and bounded planning dates. */
export function assertPlanningPersonnel(proof: unknown, person: unknown, qualification: unknown, activity: string, start: string, end: string, c: TourPlanningCommand) {
  source(proof, c, 'personnel'); source(qualification, c, 'qualification');
  if (!object(person) || proof.id !== person.id || qualification.snapshot.employee_id !== person.id) fail('Personalentscheidung, Person und Qualifikation gehören nicht zusammen.');
  const raw = proof.snapshot;
  if (!object(raw.history) || !Array.isArray(raw.qualifications) || !Array.isArray(raw.documents)) fail('Der vollständige aktuelle Personalentscheidungsbestand fehlt.');
  const { state } = decodePersonnelHistory(raw.history, { tenantId: c.tenantId, employeeId: proof.id });
  const events = state.events.filter(e => e.command.kind !== 'correct' && !state.corrected.includes(e.id));
  const firstDay = planningDay(start), lastDay = planningDay(end);
  const employmentEvent = events.findLast(e => e.command.kind === 'employment');
  const employment = employmentEvent?.command.payload;
  if (!employment || !date(employment.validFrom) || employment.validFrom > firstDay || employment.validUntil !== null && String(employment.validUntil) < lastDay) fail('Für den Planungszeitraum fehlt eine gültige Beschäftigungsentscheidung.');
  const exitEvent = events.findLast(e => e.command.kind === 'offboard');
  const exit = exitEvent?.command.payload;
  const renewedEmployment = exit && employmentEvent && exitEvent && employmentEvent.sequence > exitEvent.sequence && String(employment?.validFrom) > String(exit.exitDate);
  if (exit && !renewedEmployment && String(exit.exitDate) <= lastDay) fail('Der dokumentierte Austritt sperrt diesen Planungszeitraum.');
  const q = events.findLast(e => e.command.kind === 'qualification' && object(e.command.payload.qualification) && e.command.payload.qualification.id === qualification.id)?.command.payload;
  if (!q || q.result !== 'verified' || q.activity !== activity || String(q.validFrom) > firstDay || String(q.validUntil) < lastDay) fail('Die konkrete Tätigkeit ist im Planungszeitraum nicht durch die aktuelle Personalprüfung gedeckt.');
  if (!raw.qualifications.some(v => sameWoundJson(v, q.qualification)) || !sameWoundJson(q.qualification, qualification) || !raw.documents.some(v => sameWoundJson(v, q.document))) fail('Qualifikation oder Nachweisdokument wurden nach der Personalprüfung geändert.');
  if (!object(q.document) || qualification.snapshot.document_id !== q.document.id || !['valid', 'expires_soon'].includes(String(qualification.snapshot.status))) fail('Der tatsächliche Qualifikationsnachweis ist nicht passend oder wurde zurückgewiesen.');
  for (const event of events.filter(e => e.command.kind === 'absence')) {
    const p = event.command.payload;
    if (at(p.validFrom) < at(end) && (p.validUntil === null || at(p.validUntil) > at(start))) fail('Eine dokumentierte Abwesenheit überschneidet sich mit der Planung.');

  }
  const sick = events.filter(e => e.command.kind === 'absence' && e.command.payload.category === 'sick' && e.command.payload.validUntil !== null && at(e.command.payload.validUntil) <= at(start)).sort((a, b) => at(a.command.payload.validUntil) < at(b.command.payload.validUntil) ? -1 : at(a.command.payload.validUntil) > at(b.command.payload.validUntil) ? 1 : a.sequence - b.sequence).at(-1);
  if (sick) {
    const absence = sick.command.payload.absence;
    const returned = events.findLast(e => e.command.kind === 'return_decision' && object(e.command.payload.absence) && object(absence) && e.command.payload.absence.id === absence.id)?.command.payload;
    if (!returned || returned.decision !== 'fit' || !sameWoundJson(returned.absence, absence) || at(returned.validFrom) > at(start) || at(returned.validUntil) < at(end)) fail('Nach Krankheit fehlt eine aktuelle uneingeschränkte Rückkehrentscheidung für diesen Zeitraum.');
  }
}

export function validatePlanningPacket(packet: unknown, header: TourPlanningRow) {
    if (!exact(packet, ['versionEventId', 'assignmentEventId', 'versionLabel', 'validFrom', 'validUntil', 'startedAt', 'endedAt', 'activity', 'accessSummary', 'vehicleId', 'stops']) || packet.versionEventId !== header.planVersionEventId || !id(packet.assignmentEventId) || packet.versionLabel !== header.versionLabel || packet.validFrom !== header.validFrom || packet.validUntil !== header.validUntil || !(packet.vehicleId === null || id(packet.vehicleId)) || !Array.isArray(packet.stops) || packet.stops.length === 0 || packet.stops.length > 10_000) fail('Der vollständig adressierte Planinhalt fehlt.');
    interval(packet); words(packet, 'activity', 'accessSummary');
    const ids = new Set<string>();
    for (const stop of packet.stops) {
      if (!exact(stop, ['eventId', 'stopId', 'clientId', 'clientLabel', 'windowStart', 'windowEnd', 'serviceType', 'frequency']) || !['eventId', 'stopId', 'clientId'].every(k => id(stop[k])) || !(stop.clientLabel === null || text(stop.clientLabel, 300)) || ids.has(String(stop.stopId))) fail('Ein Besuch im adressierten Planinhalt fehlt oder ist doppelt vorhanden.');
      interval(stop, 'windowStart', 'windowEnd'); words(stop, 'serviceType', 'frequency'); ids.add(String(stop.stopId));
    }
}

export function validatePlanningPayload(c: TourPlanningCommand) {
  const p = c.payload;
  for (const key of ['validFrom', 'validUntil', 'originalDate', 'newDate', 'serviceDate']) if (Object.hasOwn(p, key) && p[key] !== null && !date(p[key])) fail('Ein vollständiges gültiges Kalenderdatum fehlt.');
  if (!exact(p, planningPayloadKeys[c.kind] ?? [])) fail('Die aktuelle Planungsanfrage ist unvollständig oder enthält fremde Felder.');
  if (['plan_version', 'publish'].includes(c.kind) && (!date(p.validFrom) || !date(p.validUntil) || String((p.tour as TourPlanningSource).snapshot.tour_date) < String(p.validFrom) || String((p.tour as TourPlanningSource).snapshot.tour_date) > String(p.validUntil))) fail('Die Planfassung muss ihren ursprünglichen Tourtag vollständig abdecken.');
  if (c.kind === 'assignment') {
    interval(p); words(p, 'activity');
    if (!id(p.planVersionEventId)) fail('Die genaue aktuelle Planfassung fehlt.');
    assertPlanningPersonnel(p.primaryPersonnel, p.primary, p.primaryQualification, String(p.activity), String(p.startedAt), String(p.endedAt), c);
    if (p.secondary !== null) assertPlanningPersonnel(p.secondaryPersonnel, p.secondary, p.secondaryQualification, String(p.activity), String(p.startedAt), String(p.endedAt), c);
    else if (p.secondaryPersonnel !== null) fail('Ohne zweite Person darf keine zweite Personalentscheidung übertragen werden.');
    if (p.vehicle === null ? p.maintenanceEventId !== null : !id(p.maintenanceEventId)) fail('Für das Fahrzeug fehlt eine ausdrücklich dokumentierte Wartungsfreigabe.');
    const minutes = Number((at(p.endedAt) - at(p.startedAt)) / 60_000_000n);
    if (Number(p.capacityMinutes) > minutes) fail('Die geplante Kapazität überschreitet den tatsächlichen Planungszeitraum.');
  }
  if (c.kind === 'replan') { interval(p); words(p, 'activity'); assertPlanningPersonnel(p.replacementPersonnel, p.replacement, p.replacementQualification, String(p.activity), String(p.startedAt), String(p.endedAt), c); }
  if (c.kind === 'trip_start' && (!id(p.maintenanceEventId) || at(p.startedAt) > at(c.occurredAt))) fail('Die Fahrt benötigt ihre ausdrückliche Freigabe und einen tatsächlichen Beginn.');
  if (c.kind === 'trip_finish' && at(p.endedAt) > at(c.occurredAt)) fail('Das Fahrtende darf nicht nach der dokumentierten tatsächlichen Erfassung liegen.');
  if (c.kind === 'rule_review') {
    interval(p); if (BigInt(Number(p.breakMinutes)) * 60_000_000n >= at(p.endedAt) - at(p.startedAt)) fail('Die Pause muss kürzer als die gesamte Schicht sein.');
    const shift = (p.shift as TourPlanningSource).snapshot;
    if (p.result === 'compliant' && (!sameWoundJson((p.rule as TourPlanningSource).snapshot, shift) || !withinShift(shift, String(p.startedAt), String(p.endedAt)) || !integer(shift.break_minutes, 0, 1440) || Number(p.breakMinutes) < Number(shift.break_minutes))) fail('Eine regelkonforme Prüfung muss dieselben tatsächlichen Schichtvorgaben, Zeiten und Pausen berücksichtigen.');
  }
  if (c.kind === 'visit_binding') {
    interval(p, 'windowStart', 'windowEnd');
    if (!['planned', 'blocked'].includes(String(p.decision))) fail('Die Besuchsentscheidung muss eindeutig geplant oder gesperrt sein.');
    if (p.decision === 'planned' && (!['active', 'admitted'].includes(String((p.admission as TourPlanningSource).snapshot.status)) || !['active', 'approved', 'published'].includes(String((p.carePlan as TourPlanningSource).snapshot.status)))) fail('Eine reguläre Besuchsplanung benötigt aktive Aufnahme und geltenden Pflegeplan.');
  }
  if (c.kind === 'preference_exception' && (p.preference as TourPlanningSource).snapshot.client_id !== (p.stop as TourPlanningSource).snapshot.client_id) fail('Die Präferenz gehört nicht zum selben Pflegefall.');
  if (c.kind === 'series_exception' && (p.action === 'reschedule' ? p.newDate === p.originalDate : p.newDate !== null)) fail('Verschiebung und Beibehaltung benötigen eine eindeutige Datumsentscheidung.');
  if (c.kind === 'series_exception') {
    source(p.occurrence, c, 'stop'); source(p.carePlan, c, 'care_plan');
    if ((p.occurrence as TourPlanningSource).id !== p.occurrenceId || (p.occurrence as TourPlanningSource).snapshot.tour_id !== c.planId || (p.series as TourPlanningSource).snapshot.care_plan_id !== (p.carePlan as TourPlanningSource).id || (p.carePlan as TourPlanningSource).snapshot.client_id !== (p.occurrence as TourPlanningSource).snapshot.client_id) fail('Das ausdrücklich zugeordnete Serienvorkommen gehört nicht zu derselben Tour und demselben Pflegeplan des Pflegefalls.');
  }
  if (c.kind === 'publish') {
    validatePlanningPacket(p.packet, p);
    const profiles = new Set<string>();
    for (const recipient of p.recipients as TourPlanningRow[]) { if (!id(recipient.profileId) || profiles.has(String(recipient.profileId))) fail('Jede empfangende Person braucht ein eigenes eindeutig adressiertes Konto.'); profiles.add(String(recipient.profileId)); }
  }
  if (c.kind === 'maintenance') {
    if ((p.vehicle as TourPlanningSource).id !== (p.maintenance as TourPlanningSource).id || p.replacement !== null && (p.replacement as TourPlanningSource).id === (p.vehicle as TourPlanningSource).id) fail('Wartungsgegenstand und tatsächliches Ersatzfahrzeug müssen eindeutig sein.');
    if (p.status === 'cleared' && (at(p.dueAt) <= at(c.occurredAt) || (p.vehicle as TourPlanningSource).snapshot.active !== true)) fail('Die Fahrzeugfreigabe benötigt einen aktiven Fahrzeugstamm und eine zukünftige Prüffrist.');
  }
  if (c.kind === 'additional_request') { visitSources(p, c); if (!['alarm', 'support', 'other'].includes(String(p.category))) fail('Die Zusatzleistungsart fehlt.'); words(p, 'provider', 'contact', 'contractReference', 'requestText'); }
  if (c.kind === 'additional_response') { if (!id(p.requestEventId) || !instant(p.receivedAt) || at(p.receivedAt) > at(c.occurredAt) || !['accepted', 'rejected', 'stopped'].includes(String(p.result))) fail('Die belegte Anbieterantwort ist unvollständig.'); words(p, 'evidenceReference', 'decision'); }
  if (c.kind === 'meal_request') { visitSources(p, c); if (!date(p.serviceDate) || !integer(p.portions, 1, 1000)) fail('Lieferdatum oder Anzahl der angefragten Portionen fehlen.'); words(p, 'provider', 'dietNotes', 'requestReference'); }
  if (c.kind === 'meal_delivery') { if (!id(p.requestEventId) || !instant(p.deliveredAt) || at(p.deliveredAt) > at(c.occurredAt) || !integer(p.portions, 0, 1000) || !['delivered', 'partial', 'not_delivered'].includes(String(p.result))) fail('Der tatsächliche Lieferbeleg ist unvollständig.'); if ((p.result === 'not_delivered') !== (p.portions === 0)) fail('Nichtlieferung und tatsächlich gelieferte Menge widersprechen sich.'); words(p, 'receivedBy', 'deviation'); }
}

function requireMaintenance(s: TourPlanningState, eventId: unknown, vehicle: TourPlanningSource, start: string, end: string) {
  const event = latest(s, 'maintenance', p => object(p.vehicle) && p.vehicle.id === vehicle.id);
  if (!event || event.command.version !== '2026-10-16.2' || event.id !== eventId || event.command.payload.status !== 'cleared' || !sameWoundJson(event.command.payload.vehicle, vehicle) || at(event.command.payload.dueAt) <= at(end) || at(event.command.occurredAt) > at(start)) fail('Die aktuelle ausdrückliche Wartungsfreigabe fehlt, wurde geändert oder deckt den Zeitraum nicht.');
}
/** Only current, uncorrected prerequisites can authorize new actions. Old immutable events remain readable. */
export function checkPlanningTransition(s: TourPlanningState, c: TourPlanningCommand) {
  const p = c.payload;
  if (c.kind === 'assignment') {
    const version = latest(s, 'plan_version');
    if (!version || version.id !== p.planVersionEventId || !sameWoundJson(version.command.payload.tour, p.tour) || String(version.command.payload.validFrom) > planningDay(String(p.startedAt)) || String(version.command.payload.validUntil) < planningDay(String(p.endedAt))) fail('Die Zuordnung benötigt dieselbe aktuelle und zeitlich gültige Planfassung.');
    const rule = latest(s, 'rule_review', r => object(r.shift) && object(p.shift) && r.shift.id === p.shift.id);
    if (!rule || rule.command.version !== '2026-10-16.2' || rule.command.payload.result !== 'compliant' || !sameWoundJson(rule.command.payload.shift, p.shift) || at(rule.command.payload.startedAt) > at(p.startedAt) || at(rule.command.payload.endedAt) < at(p.endedAt)) fail('Eine aktuelle regelkonforme Prüfung derselben Schicht und desselben Zeitraums fehlt.');
    if (p.vehicle !== null) requireMaintenance(s, p.maintenanceEventId, p.vehicle as TourPlanningSource, String(p.startedAt), String(p.endedAt));
  }
  if (c.kind === 'replan') {
    const assignment = latest(s, 'assignment');
    if (!assignment || assignment.id !== p.previousAssignmentEventId || assignment.command.version !== '2026-10-16.2' || !sameWoundJson(assignment.command.payload.tour, p.tour) || (p.cause as TourPlanningSource).snapshot.employee_id !== (assignment.command.payload.primary as TourPlanningRow).id || (p.replacement as TourPlanningRow).id === (assignment.command.payload.primary as TourPlanningRow).id) fail('Umplanung benötigt die aktuelle betroffene Zuordnung, deren Ausfall und eine andere Ersatzperson.');
    const cause = (p.cause as TourPlanningSource).snapshot;
    if (['rejected', 'cancelled'].includes(String(cause.status)) || !instant(cause.starts_at) || !instant(cause.ends_at) || at(cause.starts_at) >= at(p.endedAt) || at(cause.ends_at) <= at(p.startedAt)) fail('Der ursprüngliche Ausfall deckt den tatsächlichen Vertretungszeitraum nicht.');
    if (at(p.startedAt) < at(assignment.command.payload.startedAt) || at(p.endedAt) > at(assignment.command.payload.endedAt) || p.activity !== assignment.command.payload.activity) fail('Die Ersatzplanung muss innerhalb derselben konkreten Tätigkeit und Planzeit bleiben.');
  }
  if (c.kind === 'publish') {
    const version = latest(s, 'plan_version'), assignment = latest(s, 'assignment');
    if (!version || version.id !== p.planVersionEventId || !sameWoundJson(version.command.payload.tour, p.tour) || version.command.payload.versionLabel !== p.versionLabel || version.command.payload.validFrom !== p.validFrom || version.command.payload.validUntil !== p.validUntil || !assignment || assignment.command.version !== '2026-10-16.2' || assignment.command.payload.planVersionEventId !== version.id) fail('Freigabe benötigt die aktuelle identische Planfassung und eine vollständig geprüfte aktuelle Zuordnung.');
    const byStop = new Map<string, TourPlanningEvent>();
    for (const e of active(s).filter(e => e.command.kind === 'visit_binding')) byStop.set((e.command.payload.stop as TourPlanningSource).id, e);
    if (!byStop.size || [...byStop.values()].some(e => e.command.version !== '2026-10-16.2' || e.command.payload.continuity !== 'active' || e.command.payload.decision !== 'planned')) fail('Jeder erfasste Besuch benötigt seine letzte aktive, ungesperrte Besuchsbindung.');
    if (active(s).some(e => e.sequence > assignment.sequence && ['rule_review', 'visit_binding', 'preference_exception', 'series_exception', 'replan', 'maintenance'].includes(e.command.kind))) fail('Nach geänderten Planungsgrundlagen ist eine neue vollständige Zuordnungsprüfung erforderlich.');
    const bounds = assignment.command.payload;
    const ordered = [...byStop.values()].sort((a, b) => at(a.command.payload.windowStart) < at(b.command.payload.windowStart) ? -1 : 1);
    let duration = BigInt(Number(bounds.travelMinutes)) * 60_000_000n;
    let previousEnd: bigint | null = null;
    for (const event of ordered) {
      const visit = event.command.payload;
      if (at(visit.windowStart) < at(bounds.startedAt) || at(visit.windowEnd) > at(bounds.endedAt) || previousEnd !== null && at(visit.windowStart) < previousEnd) fail('Besuchszeiten überschneiden sich oder liegen außerhalb der geprüften Zuordnungszeit.');
      duration += at(visit.windowEnd) - at(visit.windowStart); previousEnd = at(visit.windowEnd);
    }
    if (duration > BigInt(Number(bounds.capacityMinutes)) * 60_000_000n) fail('Besuche und Fahrtzeit überschreiten die ausdrücklich geprüfte Kapazität.');
    const preferences = new Map<string, TourPlanningEvent>();
    for (const e of active(s).filter(e => e.command.kind === 'preference_exception')) preferences.set((e.command.payload.stop as TourPlanningSource).id, e);
    if ([...preferences.values()].some(e => e.command.payload.priority === 'required' && e.command.payload.outcome === 'deviation')) fail('Eine verbindliche abweichende Vereinbarung muss vor der Freigabe geklärt werden.');
    const assigned = [assignment.command.payload.primary, assignment.command.payload.secondary].filter(object);
    if (!assigned.every(person => (p.recipients as TourPlanningRow[]).some(r => r.id === person.id && r.profileId !== null))) fail('Alle zugeordneten Personen müssen als eigene verknüpfte Empfänger adressiert sein.');
    if (!sameWoundJson(p.packet, buildPlanningPacket(s))) fail('Der freizugebende Planinhalt stimmt nicht mit den aktuellen Originalereignissen überein.');
  }
  if (c.kind === 'acknowledge') {
    const publication = latest(s, 'publish');
    if (!publication || publication.command.version !== '2026-10-16.2' || publication.id !== p.publishEventId || s.events.some(e => e.sequence > publication.sequence && !['acknowledge', 'trip_start', 'trip_finish', 'additional_request', 'additional_response', 'meal_request', 'meal_delivery'].includes(e.command.kind))) fail('Nur die unveränderte aktuelle Veröffentlichung darf empfangen werden.');
    if (!(publication.command.payload.recipients as TourPlanningRow[]).some(r => sameWoundJson(r, p.recipient)) || (p.recipient as TourPlanningRow).profileId !== c.actorId) fail('Nur die tatsächlich adressierte Person kann ihren eigenen Empfang bestätigen.');
    if (active(s).some(e => e.command.kind === 'acknowledge' && e.command.payload.publishEventId === p.publishEventId && (e.command.payload.recipient as TourPlanningRow).id === (p.recipient as TourPlanningRow).id)) fail('Diese persönliche Planfassung wurde bereits empfangen.');
  }
  if (c.kind === 'trip_start') {
    if ((p.driver as TourPlanningRow).profileId !== c.actorId) fail('Nur die eigene aktuell verknüpfte fahrende Person darf die Fahrt beginnen.');
    requireMaintenance(s, p.maintenanceEventId, p.vehicle as TourPlanningSource, String(p.startedAt), String(p.startedAt));
    if (active(s).some(e => e.command.kind === 'trip_start' && (e.command.payload.vehicle as TourPlanningSource).id === (p.vehicle as TourPlanningSource).id && !active(s).some(f => f.command.kind === 'trip_finish' && f.command.payload.tripStartEventId === e.id))) fail('Für dieses Fahrzeug ist bereits eine Fahrt offen.');
    const lastFinish = active(s).findLast(e => e.command.kind === 'trip_finish' && live(s, e.command.payload.tripStartEventId, 'trip_start')?.command.payload.vehicle && (live(s, e.command.payload.tripStartEventId, 'trip_start')!.command.payload.vehicle as TourPlanningSource).id === (p.vehicle as TourPlanningSource).id);
    if (lastFinish && (Number(p.startKm) < Number(lastFinish.command.payload.endKm) || at(p.startedAt) < at(lastFinish.command.payload.endedAt))) fail('Der Fahrtbeginn liegt vor dem letzten tatsächlichen Rückgabe- oder Kilometerstand.');
  }
  if (c.kind === 'trip_finish') {
    const start = live(s, p.tripStartEventId, 'trip_start');
    if (!start || (start.command.payload.driver as TourPlanningRow).profileId !== c.actorId || at(p.endedAt) < at(start.command.payload.startedAt) || Number(p.endKm) < Number(start.command.payload.startKm)) fail('Nur die eigene offene Originalfahrt kann mit passendem Zeitpunkt und Kilometerstand abgeschlossen werden.');
    if (active(s).some(e => e.command.kind === 'trip_finish' && e.command.payload.tripStartEventId === p.tripStartEventId)) fail('Diese Fahrt ist bereits abgeschlossen.');
  }
  if (c.kind === 'additional_response') { if (!live(s, p.requestEventId, 'additional_request')) fail('Die unveränderte Zusatzleistungsanfrage fehlt.'); }
  if (c.kind === 'meal_delivery') {
    const request = live(s, p.requestEventId, 'meal_request');
    if (!request) fail('Die gültige ursprüngliche Essensanfrage fehlt.');
    const delivered = active(s).filter(e => e.command.kind === 'meal_delivery' && e.command.payload.requestEventId === p.requestEventId).reduce((n, e) => n + Number(e.command.payload.portions), 0);
    const remaining = Number(request.command.payload.portions) - delivered;
    if (remaining <= 0 || Number(p.portions) > remaining || p.result === 'delivered' && Number(p.portions) !== remaining || p.result === 'partial' && Number(p.portions) >= remaining) fail('Teilmenge, offene Bestellmenge und Lieferergebnis widersprechen sich.');
  }
  if (c.kind === 'correct') {
    const target = active(s).find(e => e.id === p.targetId);
    if (!target) fail('Nur ein vorhandenes noch nicht berichtigtes Original kann berichtigt werden.');
    if (target.command.kind === 'trip_start' && active(s).some(e => e.command.kind === 'trip_finish' && e.command.payload.tripStartEventId === target.id)) fail('Ein Fahrtbeginn mit abgeschlossenem Original darf nicht vom tatsächlichen Fahrtabschluss gelöst werden.');
    return target.id;
  }
  return undefined;
}

export function planningPublicationStatus(state: TourPlanningState, context?: TourPlanningContext) {
  const publication = latest(state, 'publish');
  if (!publication) return { publication: null, current: false, acknowledged: 0, recipients: 0 };
  let current = publication.command.version === '2026-10-16.2' && !state.events.some(e => e.sequence > publication.sequence && !['acknowledge', 'trip_start', 'trip_finish', 'additional_request', 'additional_response', 'meal_request', 'meal_delivery'].includes(e.command.kind));
  if (current && context) { try { assertPlanningContextPrerequisites(publication.command, context); } catch { current = false; } }
  return { publication, current, acknowledged: active(state).filter(e => e.command.kind === 'acknowledge' && e.command.payload.publishEventId === publication.id).length, recipients: (publication.command.payload.recipients as unknown[]).length };
}

export function assertPlanningContextPrerequisites(c: TourPlanningCommand, context: TourPlanningContext) {
  if (c.kind === 'meal_request' && c.payload.serviceDate !== context.plan.tour_date) fail('Die Essensanfrage muss zum konkreten Tag der gewählten Tour gehören.');
  if (c.version !== '2026-10-16.2') fail('Ältere Planungsvorgänge dürfen nur mit ihrer Originalquittung wiederaufgenommen werden.');
  if (c.kind === 'assignment' || c.kind === 'replan') {
    const p = c.payload;
    if (planningDay(String(p.startedAt)) !== context.plan.tour_date || c.kind === 'assignment' && !withinShift((p.shift as TourPlanningSource).snapshot, String(p.startedAt), String(p.endedAt))) fail('Zuordnungsdatum und Zeitraum passen nicht zur aktuellen Tour und nativen Schicht.');
    const people = (c.kind === 'assignment' ? [p.primary, p.secondary] : [p.replacement]).filter(object);
    for (const person of people) {
      if (!context.sources.rows.some(s => s.kind === 'shift' && s.snapshot.employee_id === person.id && withinShift(s.snapshot, String(p.startedAt), String(p.endedAt))) && !context.sources.rows.some(s => s.kind === 'availability' && s.snapshot.employee_id === person.id && instant(s.snapshot.starts_at) && instant(s.snapshot.ends_at) && at(s.snapshot.starts_at) <= at(p.startedAt) && at(s.snapshot.ends_at) >= at(p.endedAt))) fail('Für eine beteiligte Person fehlt eine native Schicht oder ausdrückliche Verfügbarkeit für den gesamten Zeitraum.');
      for (const absent of context.sources.rows.filter(s => s.kind === 'absence' && s.snapshot.employee_id === person.id)) {
        const a = absent.snapshot;
        if (a.status === 'rejected' || a.status === 'cancelled') continue;
        if (!instant(a.starts_at) || !instant(a.ends_at) || at(a.starts_at) >= at(a.ends_at)) fail('Die ursprüngliche Abwesenheit hat keinen eindeutig prüfbaren Zeitraum.');
        if (at(a.starts_at) < at(p.endedAt) && at(a.ends_at) > at(p.startedAt)) fail('Eine aktuelle native Abwesenheit überschneidet sich mit der Zuordnung.');
      }
    }
    for (const resource of context.sources.rows.filter(s => s.kind === 'resource')) {
      const raw = resource.snapshot, command = raw.command;
      if (!object(command) || !object(command.payload) || !id(raw.plan_id) || raw.tenant_id !== c.tenantId || command.tenantId !== c.tenantId || command.planId !== raw.plan_id || command.eventId !== raw.id || command.kind !== raw.kind || !id(raw.id)) fail('Eine ursprüngliche Ressourcenbelegung ist unvollständig oder widersprüchlich.');
      if (raw.plan_id === c.planId) continue;
      const r = command.payload;
      if (!['assignment', 'replan'].includes(String(command.kind))) continue;
      const occupied = [r.primary, r.secondary, r.replacement].filter(object);
      const samePerson = people.some(p => occupied.some(o => o.id === p.id));
      const sameVehicle = object(p.vehicle) && object(r.vehicle) && p.vehicle.id === r.vehicle.id;
      if (!samePerson && !sameVehicle) continue;
      if (!instant(r.startedAt) || !instant(r.endedAt)) {
        if (raw.tour_date === planningDay(String(p.startedAt))) fail('Eine andere Tour enthält eine zeitlich noch nicht eindeutig abgegrenzte Belegung derselben Person oder desselben Fahrzeugs.');
      } else if (at(r.startedAt) < at(p.endedAt) && at(r.endedAt) > at(p.startedAt)) fail('Person oder Fahrzeug ist im selben Zeitraum bereits einer anderen Tour zugeordnet.');
    }
  }
  if (c.kind === 'series_exception' && c.payload.originalDate !== context.plan.tour_date) fail('Die Einzelentscheidung muss den konkreten ursprünglichen Tourtag bezeichnen.');
  if (c.kind === 'publish') {
    const state = decodePlanningStateForContext(context);
    const assignment = latest(state, 'assignment');
    const check = (value: unknown): void => {
      if (Array.isArray(value)) { value.forEach(check); return; }
      if (!object(value)) return;
      if (Object.hasOwn(value, 'snapshot')) { if (!context.sources.rows.some(s => sameWoundJson(s, value))) fail('Eine Freigabegrundlage wurde seit ihrer Zuordnungsprüfung geändert. Erneut prüfen.'); return; }
      if (Object.hasOwn(value, 'roleKey')) { if (!context.people.rows.some(p => sameWoundJson(p, value))) fail('Eine zugeordnete Person ist seit der Prüfung nicht mehr identisch aktiv.'); return; }
      Object.values(value).forEach(check);
    };
    if (assignment) check(assignment.command.payload);
    const visits = new Map<string, TourPlanningEvent>();
    for (const e of active(state).filter(e => e.command.kind === 'visit_binding')) visits.set((e.command.payload.stop as TourPlanningSource).id, e);
    for (const s of context.sources.rows.filter(s => s.kind === 'stop' && !['cancelled', 'archived'].includes(String(s.snapshot.status)))) {
      const visit = visits.get(s.id);
      if (!visit || !sameWoundJson(visit.command.payload.stop, s)) fail('Mindestens ein aktueller nativer Besuch fehlt im vollständig geprüften freizugebenden Plan.');
      check(visit.command.payload);
    }
  }
  if (c.kind === 'trip_start' && (c.payload.vehicle as TourPlanningSource).snapshot.ownership === 'private' && (c.payload.vehicle as TourPlanningSource).snapshot.employee_id !== (c.payload.driver as TourPlanningRow).id) fail('Ein privates Fahrzeug benötigt seine eigene Personalverknüpfung.');
  if (c.kind === 'trip_start' && context.sources.rows.some(s => s.kind === 'trip' && s.snapshot.vehicle_id === (c.payload.vehicle as TourPlanningSource).id && s.snapshot.status === 'recording')) fail('Im ursprünglichen Fahrtenbuch ist für dieses Fahrzeug noch eine Fahrt offen.');
  if (c.kind === 'trip_start' && context.sources.rows.some(r => r.kind === 'resource' && object(r.snapshot.command) && r.snapshot.command.kind === 'trip_start' && object(r.snapshot.command.payload) && object(r.snapshot.command.payload.vehicle) && (c.payload.vehicle as TourPlanningSource).id === r.snapshot.command.payload.vehicle.id)) fail('Für dieses Fahrzeug ist in einer anderen Tour bereits eine Fahrt offen.');
}

// The context history has already been strictly decoded by the domain entry point.
function decodePlanningStateForContext(context: TourPlanningContext): TourPlanningState {
  return { headId: context.history.headId, events: context.history.events, corrected: context.history.events.filter(e => e.command.kind === 'correct').map(e => String(e.command.payload.targetId)) };
}

export function buildPlanningPacket(s: TourPlanningState) {
  const version = latest(s, 'plan_version'), assignment = latest(s, 'assignment');
  if (!version || !assignment || assignment.command.version !== '2026-10-16.2') fail('Ein vollständiger aktueller Planinhalt ist noch nicht vorhanden.');
  const visits = new Map<string, TourPlanningEvent>();
  for (const e of active(s).filter(e => e.command.kind === 'visit_binding')) visits.set((e.command.payload.stop as TourPlanningSource).id, e);
  return {
    versionEventId: version.id, assignmentEventId: assignment.id,
    versionLabel: version.command.payload.versionLabel,
    validFrom: version.command.payload.validFrom, validUntil: version.command.payload.validUntil,
    startedAt: assignment.command.payload.startedAt, endedAt: assignment.command.payload.endedAt,
    activity: assignment.command.payload.activity, accessSummary: assignment.command.payload.accessSummary,
    vehicleId: object(assignment.command.payload.vehicle) ? assignment.command.payload.vehicle.id : null,
    stops: [...visits.values()].map(e => {
      const p = e.command.payload, stop = p.stop as TourPlanningSource;
      return { eventId: e.id, stopId: stop.id, clientId: stop.snapshot.client_id, clientLabel: typeof stop.snapshot.client_name_snapshot === 'string' && stop.snapshot.client_name_snapshot.trim() ? stop.snapshot.client_name_snapshot : null, windowStart: p.windowStart, windowEnd: p.windowEnd, serviceType: p.serviceType, frequency: p.frequency };
    }).sort((a, b) => String(a.stopId).localeCompare(String(b.stopId))),
  };
}
