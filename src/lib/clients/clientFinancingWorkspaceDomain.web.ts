export const clientFinancingWorkspaceVersion = '2026-10-16.1' as const;

export const clientFinancingKinds = [
  'contract_basis', 'financing_path', 'approval_application', 'approval_decision',
  'tariff_position', 'calculation', 'budget_basis', 'budget_consumption',
  'estimate_version', 'estimate_decision', 'contract_change', 'contract_closure',
  'combination_review', 'entitlement_version', 'correction',
] as const;
export type ClientFinancingKind = (typeof clientFinancingKinds)[number];

export const clientFinancingLabels: Record<ClientFinancingKind, string> = {
  contract_basis: 'Versorgungsvertragsfassung', financing_path: 'Finanzierungsweg',
  approval_application: 'Antrag / Folgeverordnung', approval_decision: 'Genehmigungsentscheidung',
  tariff_position: 'Tarif- und Leistungsposition', calculation: 'Mengen- und Geldberechnung',
  budget_basis: 'Budget-/Anspruchsgrundlage', budget_consumption: 'Verbrauch / Storno',
  estimate_version: 'Kostenvoranschlagsfassung', estimate_decision: 'Annahme / Ablehnung',
  contract_change: 'Vertragsänderung', contract_closure: 'Vertragsschließung',
  combination_review: 'Leistungskombinationsprüfung', entitlement_version: 'Veränderlicher Leistungsanspruch',
  correction: 'Berichtigung eines Vorgangs',
};

export const clientFinancingBaseRights = ['office.clients.view', 'office.clients.view_sensitive', 'office.documents.view'] as const;
export const clientFinancingWriteRights = ['office.clients.edit', 'office.clients.view_sensitive', 'office.documents.view'] as const;

export type ClientFinancingSource = { kind: string; id: string; snapshot: Record<string, unknown> };
export type ClientFinancingEvent = {
  id: string; sequence: number; previousId: string | null; tenantId: string; clientId: string;
  actorId: string; actorName: string; recordedAt: string; command: ClientFinancingCommand;
};
export type ClientFinancingCommand = {
  version: typeof clientFinancingWorkspaceVersion; requestId: string; eventId: string;
  tenantId: string; clientId: string; actorId: string; expectedHeadId: string | null;
  kind: ClientFinancingKind; occurredAt: string; note: string;
  payload: Record<string, unknown>;
};
export type ClientFinancingHistory = {
  version: typeof clientFinancingWorkspaceVersion; tenantId: string; clientId: string;
  count: number; headId: string | null; events: ClientFinancingEvent[];
};
export type ClientFinancingContext = {
  version: typeof clientFinancingWorkspaceVersion; tenantId: string; clientId: string; actorId: string;
  loadedAt: string; client: Record<string, unknown>;
  sources: { count: number; rows: ClientFinancingSource[] };
  history: ClientFinancingHistory;
};
export type ClientFinancingReceipt = {
  version: typeof clientFinancingWorkspaceVersion; requestId: string;
  command: ClientFinancingCommand; event: ClientFinancingEvent;
};
export type ClientFinancingState = { headId: string | null; events: ClientFinancingEvent[]; corrected: string[] };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const date = /^\d{4}-\d{2}-\d{2}$/;
const instant = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
const money = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;
const quantity = /^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/;
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const required = (value: unknown, label: string): string => { if (typeof value !== 'string' || !value.trim()) throw Error(`${label} fehlt.`); return value; };
const validId = (value: unknown, label: string): string => { const text = required(value, label); if (!uuid.test(text) || text !== text.toLowerCase()) throw Error(`${label} ist ungültig.`); return text; };
const validDate = (value: unknown, label: string): string => { const text = required(value, label); if (!date.test(text) || new Date(`${text}T00:00:00Z`).toISOString().slice(0, 10) !== text) throw Error(`${label} ist ungültig.`); return text; };
const validInstant = (value: unknown, label: string): string => { const text = required(value, label); if (!instant.test(text) || Number.isNaN(Date.parse(text))) throw Error(`${label} ist ungültig.`); return text; };

export function clientFinancingSource(value: unknown, label = 'Originalquelle'): asserts value is ClientFinancingSource {
  if (!object(value) || Object.keys(value).sort().join(',') !== 'id,kind,snapshot') throw Error(`${label} ist unvollständig.`);
  validId(value.id, `${label}-ID`); required(value.kind, `${label}-Art`);
  if (!object(value.snapshot) || value.snapshot.id !== value.id) throw Error(`${label} stimmt nicht mit dem nativen Original überein.`);
}

const source = (payload: Record<string, unknown>, key: string, kinds: string[]): ClientFinancingSource => {
  const value = payload[key]; clientFinancingSource(value, key);
  if (!kinds.includes(value.kind)) throw Error(`${key} hat die falsche Originalart.`);
  return value;
};
const field = (payload: Record<string, unknown>, key: string, label: string) => required(payload[key], label);
const dated = (payload: Record<string, unknown>, key: string, label: string) => validDate(payload[key], label);
const amount = (payload: Record<string, unknown>, key: string, label: string, pattern = money) => { const value = field(payload, key, label); if (!pattern.test(value)) throw Error(`${label} ist ungültig.`); return value; };

export function validateClientFinancingCommand(command: ClientFinancingCommand): void {
  if (!object(command)) throw Error('Finanzierungsvorgang fehlt.');
  if (command.version !== clientFinancingWorkspaceVersion) throw Error('Finanzierungsversion ist nicht aktuell.');
  validId(command.requestId, 'Anfrage-ID'); validId(command.eventId, 'Ereignis-ID'); validId(command.tenantId, 'Mandant'); validId(command.clientId, 'Pflegefall'); validId(command.actorId, 'Akteur');
  if (command.expectedHeadId !== null) validId(command.expectedHeadId, 'Erwarteter Verlaufskopf');
  if (!clientFinancingKinds.includes(command.kind)) throw Error('Finanzierungsvorgang ist unbekannt.');
  validInstant(command.occurredAt, 'Tatsächlicher Vorgangszeitpunkt');
  if (required(command.note, 'Nachvollziehbarer Anlass').length > 4000) throw Error('Anlass ist zu lang.');
  if (!object(command.payload)) throw Error('Vorgangsangaben fehlen.');
  const p = command.payload;
  switch (command.kind) {
    case 'contract_basis': source(p, 'contract', ['contract']); source(p, 'document', ['document']); field(p, 'partner', 'Vertragspartner'); field(p, 'serviceBasis', 'Leistungsgrundlage'); dated(p, 'validFrom', 'Vertragsbeginn'); field(p, 'versionLabel', 'Vertragsfassung'); break;
    case 'financing_path': source(p, 'basis', ['contract', 'document', 'decision']); field(p, 'financingKind', 'Finanzierungsart'); field(p, 'payer', 'Kostenträger'); dated(p, 'validFrom', 'Finanzierungsbeginn'); field(p, 'status', 'Finanzierungsstatus'); break;
    case 'approval_application': source(p, 'path', ['financing_path']); source(p, 'document', ['document', 'decision']); dated(p, 'applicationOn', 'Antragsdatum'); dated(p, 'requestedFrom', 'Beantragter Beginn'); dated(p, 'requestedUntil', 'Beantragtes Ende'); field(p, 'reference', 'Antragsreferenz'); break;
    case 'approval_decision': source(p, 'path', ['financing_path']); source(p, 'application', ['approval']); source(p, 'document', ['document', 'decision']); field(p, 'decision', 'Entscheidung'); dated(p, 'decidedOn', 'Entscheidungsdatum'); dated(p, 'approvedFrom', 'Genehmigter Beginn'); dated(p, 'approvedUntil', 'Genehmigtes Ende'); break;
    case 'tariff_position': source(p, 'path', ['financing_path']); source(p, 'agreement', ['contract', 'document', 'tariff']); field(p, 'serviceCode', 'Leistungscode'); field(p, 'unit', 'Einheit'); amount(p, 'unitPrice', 'Einzelpreis'); dated(p, 'validFrom', 'Tarifbeginn'); field(p, 'roundingRule', 'Rundungsregel'); break;
    case 'calculation': source(p, 'path', ['financing_path']); source(p, 'tariff', ['tariff']); amount(p, 'quantity', 'Menge', quantity); amount(p, 'baseAmount', 'Grundbetrag'); amount(p, 'surcharge', 'Zuschlag'); amount(p, 'totalAmount', 'Gesamtbetrag'); field(p, 'calculationRule', 'Berechnungsregel'); break;
    case 'budget_basis': source(p, 'path', ['financing_path']); source(p, 'decision', ['document', 'decision']); field(p, 'serviceType', 'Leistungsart'); amount(p, 'allocatedAmount', 'Anspruchsbetrag'); dated(p, 'validFrom', 'Anspruchsbeginn'); dated(p, 'validUntil', 'Anspruchsende'); break;
    case 'budget_consumption': source(p, 'budget', ['budget']); source(p, 'service', ['service', 'proof', 'visit']); field(p, 'eventKind', 'Verbrauchsart'); amount(p, 'amount', 'Verbrauchsbetrag'); dated(p, 'serviceOn', 'Leistungsdatum'); field(p, 'evidence', 'Verbrauchsbeleg'); break;
    case 'estimate_version': source(p, 'path', ['financing_path']); source(p, 'tariff', ['tariff']); source(p, 'document', ['document']); field(p, 'versionLabel', 'Angebotsfassung'); amount(p, 'payerAmount', 'Kostenträgeranteil'); amount(p, 'selfPayAmount', 'Eigenanteil'); dated(p, 'serviceFrom', 'Leistungsbeginn'); dated(p, 'serviceUntil', 'Leistungsende'); field(p, 'fingerprint', 'Inhaltsfingerabdruck'); break;
    case 'estimate_decision': source(p, 'estimate', ['estimate']); source(p, 'document', ['document']); field(p, 'decision', 'Angebotsentscheidung'); field(p, 'decidingPerson', 'Entscheidende Person'); validInstant(p.decidedAt, 'Entscheidungszeitpunkt'); field(p, 'evidence', 'Entscheidungsbeleg'); break;
    case 'contract_change': source(p, 'contract', ['contract']); source(p, 'document', ['document']); dated(p, 'effectiveOn', 'Wirksamkeit'); field(p, 'reason', 'Änderungsgrund'); field(p, 'consequences', 'Änderungsfolgen'); field(p, 'versionLabel', 'Folgefassung'); break;
    case 'contract_closure': source(p, 'contract', ['contract']); source(p, 'document', ['document']); dated(p, 'effectiveOn', 'Schließungsdatum'); field(p, 'reason', 'Schließungsgrund'); field(p, 'consequences', 'Schließungsfolgen'); break;
    case 'combination_review': source(p, 'path', ['financing_path']); source(p, 'rule', ['combination_rule']); field(p, 'serviceA', 'Erste Leistungsart'); field(p, 'serviceB', 'Zweite Leistungsart'); dated(p, 'serviceOn', 'Leistungsdatum'); field(p, 'outcome', 'Prüfergebnis'); field(p, 'ruleReference', 'Regelreferenz'); break;
    case 'entitlement_version': source(p, 'path', ['financing_path']); source(p, 'decision', ['document', 'decision']); field(p, 'entitlementKind', 'Anspruchsart'); field(p, 'unit', 'Anspruchseinheit'); amount(p, 'quantity', 'Anspruchsmenge', quantity); dated(p, 'validFrom', 'Anspruchsbeginn'); dated(p, 'validUntil', 'Anspruchsende'); field(p, 'fingerprint', 'Grundlagenfingerabdruck'); break;
    case 'correction': validId(p.targetId, 'Berichtigtes Ereignis'); field(p, 'reason', 'Berichtigungsgrund'); break;
  }
}

export function emptyClientFinancingState(): ClientFinancingState { return { headId: null, events: [], corrected: [] }; }

export function applyClientFinancingCommand(state: ClientFinancingState, command: ClientFinancingCommand): ClientFinancingState {
  validateClientFinancingCommand(command);
  if (command.expectedHeadId !== state.headId) throw Error('Der Finanzierungsverlauf wurde zwischenzeitlich geändert.');
  if (state.events.some((event) => event.command.requestId === command.requestId || event.id === command.eventId)) throw Error('Anfrage oder Ereignis ist bereits vorhanden.');
  const corrected = [...state.corrected];
  if (command.kind === 'correction') {
    const target = String(command.payload.targetId);
    if (!state.events.some((event) => event.id === target) || corrected.includes(target)) throw Error('Nur ein vorhandener noch nicht berichtigter Vorgang kann berichtigt werden.');
    corrected.push(target);
  }
  return { headId: command.eventId, events: [...state.events], corrected };
}

export function decodeClientFinancingHistory(value: unknown, scope: { tenantId: string; clientId: string }): { history: ClientFinancingHistory; state: ClientFinancingState } {
  if (!object(value) || value.version !== clientFinancingWorkspaceVersion || value.tenantId !== scope.tenantId || value.clientId !== scope.clientId || !Array.isArray(value.events) || value.count !== value.events.length) throw Error('Der Finanzierungsverlauf ist unvollständig.');
  let state = emptyClientFinancingState();
  const ids = new Set<string>();
  for (let index = 0; index < value.events.length; index += 1) {
    const raw = value.events[index];
    if (!object(raw) || raw.sequence !== index + 1 || raw.previousId !== state.headId || raw.tenantId !== scope.tenantId || raw.clientId !== scope.clientId || !object(raw.command)) throw Error('Der Finanzierungsverlauf ist abgeschnitten oder falsch zugeordnet.');
    const command = structuredClone(raw.command) as ClientFinancingCommand; validateClientFinancingCommand(command);
    if (command.tenantId !== scope.tenantId || command.clientId !== scope.clientId || raw.id !== command.eventId || ids.has(raw.id as string)) throw Error('Der Finanzierungsverlauf enthält fremde oder doppelte Originale.');
    ids.add(raw.id as string); state = applyClientFinancingCommand(state, command);
    state.events.push(structuredClone(raw) as ClientFinancingEvent);
  }
  if (value.headId !== state.headId) throw Error('Der Finanzierungsverlauf hat keinen eindeutigen Kopf.');
  return { history: structuredClone(value) as ClientFinancingHistory, state };
}

export function decodeClientFinancingContext(value: unknown, expected: { tenantId: string; clientId: string; actorId: string }): ClientFinancingContext {
  if (!object(value) || Object.keys(value).sort().join(',') !== 'actorId,client,clientId,history,loadedAt,sources,tenantId,version' || value.version !== clientFinancingWorkspaceVersion || value.tenantId !== expected.tenantId || value.clientId !== expected.clientId || value.actorId !== expected.actorId || !object(value.client) || !object(value.sources) || !Array.isArray(value.sources.rows) || value.sources.count !== value.sources.rows.length) throw Error('Vollständige Vertrags- und Finanzierungsoriginale konnten nicht bestätigt werden.');
  validInstant(value.loadedAt, 'Lesezeitpunkt'); const ids = new Set<string>();
  for (const raw of value.sources.rows) { clientFinancingSource(raw); if (ids.has(`${raw.kind}:${raw.id}`)) throw Error('Originalquelle ist doppelt.'); ids.add(`${raw.kind}:${raw.id}`); const tenant = raw.snapshot.tenant_id; const client = raw.snapshot.client_id; if (tenant !== undefined && tenant !== expected.tenantId || client !== undefined && client !== expected.clientId) throw Error('Originalquelle gehört zu einem anderen Mandanten oder Pflegefall.'); }
  decodeClientFinancingHistory(value.history, expected);
  return structuredClone(value) as ClientFinancingContext;
}

export function assertClientFinancingSelectionCurrent(command: ClientFinancingCommand, context: ClientFinancingContext): void {
  validateClientFinancingCommand(command);
  const inspect = (value: unknown): void => { if (Array.isArray(value)) value.forEach(inspect); else if (object(value)) { if (Object.keys(value).sort().join(',') === 'id,kind,snapshot') { clientFinancingSource(value); const found = context.sources.rows.find((row) => row.kind === value.kind && row.id === value.id); if (!found || JSON.stringify(found) !== JSON.stringify(value)) throw Error('Eine ausgewählte Originalgrundlage ist nicht mehr aktuell.'); } else Object.values(value).forEach(inspect); } };
  inspect(command.payload);
}

export function decodeClientFinancingReceipt(value: unknown, command: ClientFinancingCommand): ClientFinancingReceipt {
  if (!object(value) || value.version !== clientFinancingWorkspaceVersion || value.requestId !== command.requestId || !object(value.command) || JSON.stringify(value.command) !== JSON.stringify(command) || !object(value.event) || value.event.id !== command.eventId || JSON.stringify(value.event.command) !== JSON.stringify(command)) throw Error('Die native Finanzierungsquittung stimmt nicht mit der gesicherten Anfrage überein.');
  return structuredClone(value) as ClientFinancingReceipt;
}
