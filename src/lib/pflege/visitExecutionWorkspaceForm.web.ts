import { visitExecutionVersion, visitId, type VisitCommand, type VisitContext, type VisitExecutionKind, type VisitPerson, type VisitRow, type VisitSource, type VisitSourceKind, type VisitState } from './visitExecutionWorkspaceDomain.web.ts';

export type VisitField = { key: string; label: string; type: 'source' | 'sources' | 'person' | 'events' | 'text' | 'time' | 'number' | 'choice' | 'json'; sourceKind?: VisitSourceKind; eventKind?: VisitExecutionKind; options?: { key: string; label: string }[]; optional?: boolean };
const field = (key: string, label: string, type: VisitField['type'] = 'text', extra: Partial<VisitField> = {}): VisitField => ({ key, label, type, ...extra });
const choice = (key: string, label: string, values: string[]) => field(key, label, 'choice', { options: values.map(value => ({ key: value, label: value })) });
const source = (key: string, label: string, sourceKind: VisitSourceKind) => field(key, label, 'source', { sourceKind });
const events = (key: string, label: string, eventKind: VisitExecutionKind) => field(key, label, 'events', { eventKind });
const open = () => field('openEventId', 'Aktuelle Einsatzöffnung', 'events', { eventKind: 'open' });

export function visitFields(kind: VisitExecutionKind): VisitField[] {
  switch (kind) {
    case 'open': return [source('stop', 'Nativer Einsatz / Stopp', 'stop'), source('tour', 'Veröffentlichte Tourfassung', 'tour'), source('admission', 'Aktive Aufnahmefassung', 'admission'), source('carePlan', 'Geltende Pflege-/Leistungsplanfassung', 'care_plan'), field('tasks', 'Geplante Aufgaben-Originale', 'sources', { sourceKind: 'task' }), field('openedAt', 'Tatsächlicher Öffnungszeitpunkt', 'time'), field('planSummary', 'Geprüfter Planhinweis'), field('openLimitations', 'Offene Angaben / Prüfbedarf')];
    case 'time': return [open(), choice('action', 'Zeitereignis', ['start', 'pause', 'resume', 'end']), field('actualAt', 'Tatsächlicher Zeitpunkt', 'time'), field('locationContext', 'Freiwilliger Standortkontext als JSON', 'json')];
    case 'task': return [open(), source('task', 'Geplante Einzelaufgabe', 'task'), choice('outcome', 'Tatsächliches Ergebnis', ['done', 'partial', 'not_done']), field('actualAt', 'Tatsächlicher Zeitpunkt', 'time'), field('documentation', 'Fachliche Detaildokumentation'), field('deviation', 'Abweichung oder ausdrücklich keine')];
    case 'unreachable': return [open(), field('attempts', 'Kontaktversuche als JSON-Liste', 'json'), source('risk', 'Aktueller Risikobezug', 'risk'), choice('decision', 'Entscheidung', ['retry', 'wait', 'no_visit']), field('report', 'Nichtbesuchsbericht'), field('followUp', 'Folgeauftrag als JSON', 'json')];
    case 'proof': return [open(), events('taskEventIds', 'Aktuelle Aufgabenergebnisse', 'task'), source('service', 'Leistungsposition', 'service'), source('tariff', 'Tarifgrundlage', 'tariff'), choice('legalBasis', 'Rechtsgrundlage', ['sgb_v', 'sgb_xi', 'private']), choice('unit', 'Einheit', ['visit', 'minute', 'hour', 'unit']), field('quantity', 'Tatsächliche Menge', 'number'), field('performedAt', 'Tatsächlicher Leistungszeitpunkt', 'time'), field('details', 'Positionsbezogene Dokumentation')];
    case 'confirm': return [events('proofEventIds', 'Zu bestätigende Nachweisfassungen', 'proof'), field('confirmer', 'Bestätigende Person / Vertretung als JSON', 'json'), choice('capacity', 'Bestätigungsrolle', ['client', 'representative', 'unable']), field('confirmedAt', 'Tatsächlicher Bestätigungszeitpunkt', 'time'), field('contentSha256', 'SHA-256 der bestätigten Inhalte'), field('statement', 'Bestätigungserklärung')];
    case 'correct': return [field('targetId', 'Zu berichtigendes Ereignis', 'events'), field('reason', 'Begründung der append-only Berichtigung')];
    case 'complete': return [open(), field('timeEndEventId', 'Tatsächliches Endereignis', 'events', { eventKind: 'time' }), events('taskEventIds', 'Aktuelle Aufgabenergebnisse', 'task'), events('proofEventIds', 'Aktuelle Nachweise (bei Nichtbesuch leer lassen)', 'proof'), choice('decision', 'Abschlussentscheidung', ['completed', 'not_delivered']), field('openItems', 'Offene Angaben / Folgebedarf oder ausdrücklich keine')];
    case 'emergency': return [open(), choice('stage', 'Notfallphase', ['open', 'measure', 'contact', 'handover', 'close']), field('observedAt', 'Tatsächlicher Beobachtungszeitpunkt', 'time'), field('facts', 'Beobachtete Tatsachen'), field('measures', 'Tatsächliche Maßnahmen'), field('contact', 'Kontaktversuch und Ergebnis als JSON', 'json'), field('responsibility', 'Bestätigter Zuständigkeitswechsel als JSON', 'json'), field('followUp', 'Folgeauftrag / Abschlussbeleg als JSON', 'json')];
  }
}

export const visitLocalTime = (iso: string) => { const date = new Date(iso); const offset = date.getTimezoneOffset() * 60_000; return new Date(date.getTime() - offset).toISOString().slice(0, 16); };
export const visitTimeFromInput = (value: string) => { const date = new Date(value); if (!Number.isFinite(date.getTime())) throw Error('Der tatsächliche Zeitpunkt ist ungültig.'); return date.toISOString(); };
const parseJson = (raw: string, label: string) => { try { return JSON.parse(raw); } catch { throw Error(`${label} enthält kein gültiges JSON.`); } };
const split = (raw: string) => raw.split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
const requireSelected = (selected: Record<string, unknown>, key: string) => { const value = selected[key]; if (!value) throw Error(`Das Original „${key}“ fehlt.`); return structuredClone(value); };

export function buildVisitCommand(input: { scope: { tenantId: string; stopId: string; actorId: string }; headId: string | null; kind: VisitExecutionKind; occurredAt: string; note: string; values: Record<string, string>; selected: Record<string, unknown> }, context: VisitContext, state: VisitState, requestId: string, eventId: string): VisitCommand {
  const value = (key: string) => input.values[key] ?? '';
  const ids = (key: string, kind?: VisitExecutionKind) => split(value(key)).map(id => { if (!visitId(id) || kind && !state.events.some(e => e.id === id && e.command.kind === kind && !state.corrected.includes(e.id))) throw Error(`Der Ereignisbezug „${key}“ ist nicht aktuell.`); return id; });
  const sources = (key: string, kind: VisitSourceKind) => split(value(key)).map(id => { const row = context.sources.rows.find(source => source.kind === kind && source.id === id); if (!row) throw Error(`Ein Original für „${key}“ fehlt im aktuellen Bestand.`); return structuredClone(row); });
  const eventIdValue = (key: string, kind?: VisitExecutionKind) => { const id = value(key) || String((input.selected[key] as VisitRow | undefined)?.id ?? ''); if (!visitId(id) || kind && !state.events.some(e => e.id === id && e.command.kind === kind && !state.corrected.includes(e.id))) throw Error(`Das Ereignis „${key}“ fehlt oder ist nicht aktuell.`); return id; };
  let payload: VisitRow;
  switch (input.kind) {
    case 'open': payload = { stop: requireSelected(input.selected, 'stop'), tour: requireSelected(input.selected, 'tour'), admission: requireSelected(input.selected, 'admission'), carePlan: requireSelected(input.selected, 'carePlan'), tasks: sources('tasks', 'task'), openedAt: visitTimeFromInput(value('openedAt')), planSummary: value('planSummary'), openLimitations: value('openLimitations') }; break;
    case 'time': payload = { openEventId: eventIdValue('openEventId', 'open'), action: value('action'), actualAt: visitTimeFromInput(value('actualAt')), locationContext: parseJson(value('locationContext') || '{}', 'Standortkontext') }; break;
    case 'task': payload = { openEventId: eventIdValue('openEventId', 'open'), task: requireSelected(input.selected, 'task'), outcome: value('outcome'), actualAt: visitTimeFromInput(value('actualAt')), documentation: value('documentation'), deviation: value('deviation') }; break;
    case 'unreachable': payload = { openEventId: eventIdValue('openEventId', 'open'), attempts: parseJson(value('attempts'), 'Kontaktversuche'), risk: requireSelected(input.selected, 'risk'), decision: value('decision'), report: value('report'), followUp: parseJson(value('followUp'), 'Folgeauftrag') }; break;
    case 'proof': payload = { openEventId: eventIdValue('openEventId', 'open'), taskEventIds: ids('taskEventIds', 'task'), service: requireSelected(input.selected, 'service'), tariff: requireSelected(input.selected, 'tariff'), legalBasis: value('legalBasis'), unit: value('unit'), quantity: Number(value('quantity')), performedAt: visitTimeFromInput(value('performedAt')), details: value('details') }; break;
    case 'confirm': payload = { proofEventIds: ids('proofEventIds', 'proof'), confirmer: parseJson(value('confirmer'), 'Bestätigende Person'), capacity: value('capacity'), confirmedAt: visitTimeFromInput(value('confirmedAt')), contentSha256: value('contentSha256'), statement: value('statement') }; break;
    case 'correct': payload = { targetId: eventIdValue('targetId'), reason: value('reason') }; break;
    case 'complete': payload = { openEventId: eventIdValue('openEventId', 'open'), timeEndEventId: eventIdValue('timeEndEventId', 'time'), taskEventIds: ids('taskEventIds', 'task'), proofEventIds: value('proofEventIds').trim() ? ids('proofEventIds', 'proof') : [], decision: value('decision'), openItems: value('openItems') }; break;
    case 'emergency': payload = { openEventId: eventIdValue('openEventId', 'open'), stage: value('stage'), observedAt: visitTimeFromInput(value('observedAt')), facts: value('facts'), measures: value('measures'), contact: parseJson(value('contact') || '{}', 'Kontakt'), responsibility: parseJson(value('responsibility') || '{}', 'Zuständigkeit'), followUp: parseJson(value('followUp') || '{}', 'Folgeauftrag') }; break;
  }
  return { version: visitExecutionVersion, requestId, eventId, ...input.scope, expectedHeadId: input.headId, kind: input.kind, occurredAt: visitTimeFromInput(input.occurredAt), note: input.note, payload };
}

export function visitSourceOptions(field: VisitField, context: VisitContext, state: VisitState) {
  if (field.type === 'source' || field.type === 'sources') return context.sources.rows.filter(row => row.kind === field.sourceKind).map(row => ({ id: row.id, label: `${row.kind} · ${String(row.snapshot.title ?? row.snapshot.name ?? row.snapshot.service_label ?? row.snapshot.description ?? row.id)}`, value: row as VisitSource }));
  if (field.type === 'person') return context.people.rows.map(row => ({ id: row.id, label: `${row.name} · ${row.roleKey}`, value: row as VisitPerson }));
  if (field.type === 'events') return state.events.filter(e => !state.corrected.includes(e.id) && (!field.eventKind || e.command.kind === field.eventKind)).map(e => ({ id: e.id, label: `#${e.sequence} · ${e.command.kind} · ${e.command.note}`, value: e }));
  return [];
}
