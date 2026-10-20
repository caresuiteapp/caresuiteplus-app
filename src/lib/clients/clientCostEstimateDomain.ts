const MAX_CENTS = 999_999_999;

export type ClientCostEstimateStatus = 'draft' | 'issued' | 'superseded' | 'withdrawn';
export type ClientCostEstimateFrequencyUnit = 'once' | 'week' | 'month' | 'period';

export type ClientCostEstimateVersion = {
  id: string;
  logicalEstimateId: string;
  tenantId: string;
  clientId: string;
  financingPathId: string;
  version: number;
  status: ClientCostEstimateStatus;
  issueDate: string;
  validUntil: string;
  servicePeriodStart: string;
  servicePeriodEnd: string;
  payerContributionCents: number;
  selfPayCents: number;
  currency: 'EUR';
  contentFingerprint: string;
  supersedesEstimateId: string | null;
  createdAt: string;
};

export type ClientCostEstimateLine = {
  id: string;
  tenantId: string;
  clientId: string;
  financingPathId: string;
  estimateVersionId: string;
  tariffPositionId: string;
  serviceCode: string;
  serviceLabel: string;
  billingUnit: string;
  normalizedQuantity: string;
  frequencyCount: number;
  frequencyUnit: ClientCostEstimateFrequencyUnit;
  occurrenceAmountCents: number;
  totalAmountCents: number;
};

export type ClientCostEstimateDecision = {
  id: string;
  tenantId: string;
  clientId: string;
  financingPathId: string;
  estimateVersionId: string;
  logicalEstimateId: string;
  estimateVersion: number;
  contentFingerprint: string;
  decision: 'accepted' | 'declined';
  decidedAt: string;
  decidedByName: string;
  decidedByRole: string;
  evidenceReference: string;
};

export type ClientCostEstimateAssessment = {
  estimate: ClientCostEstimateVersion;
  lines: ClientCostEstimateLine[];
  decision: ClientCostEstimateDecision | null;
  state: 'draft' | 'offered' | 'expired' | 'superseded' | 'withdrawn' | 'accepted' | 'declined';
  totalAmountCents: number;
};

function required(value: string, label: string): void {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} fehlt.`);
}

function calendarDate(value: string, label: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label} ist ungültig.`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error(`${label} ist ungültig.`);
}

function instant(value: string, label: string): void {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new Error(`${label} ist ungültig.`);
  }
}

function cents(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_CENTS) throw new Error(`${label} ist ungültig.`);
}

function validateEstimate(estimate: ClientCostEstimateVersion): void {
  for (const [value, label] of [
    [estimate.id, 'Angebotsversions-ID'], [estimate.logicalEstimateId, 'Logische Angebots-ID'],
    [estimate.tenantId, 'Mandant'], [estimate.clientId, 'Pflegefall'],
    [estimate.financingPathId, 'Finanzierungsweg'], [estimate.contentFingerprint, 'Inhaltsfingerprint'],
    [estimate.createdAt, 'Erfassungszeitpunkt'],
  ] as const) required(value, label);
  instant(estimate.createdAt, 'Erfassungszeitpunkt');
  if (!Number.isInteger(estimate.version) || estimate.version < 1) throw new Error('Angebotsversion ist ungültig.');
  if (!['draft', 'issued', 'superseded', 'withdrawn'].includes(estimate.status)) throw new Error('Angebotsstatus ist ungültig.');
  if (estimate.currency !== 'EUR') throw new Error('Angebotswährung ist ungültig.');
  calendarDate(estimate.issueDate, 'Angebotsdatum');
  calendarDate(estimate.validUntil, 'Angebotsfrist');
  calendarDate(estimate.servicePeriodStart, 'Leistungsbeginn');
  calendarDate(estimate.servicePeriodEnd, 'Leistungsende');
  if (estimate.validUntil < estimate.issueDate) throw new Error('Angebotsfrist liegt vor dem Angebotsdatum.');
  if (estimate.servicePeriodEnd < estimate.servicePeriodStart) throw new Error('Leistungszeitraum ist ungültig.');
  cents(estimate.payerContributionCents, 'Kostenträgeranteil');
  cents(estimate.selfPayCents, 'Eigenanteil');
  if (estimate.version === 1 && estimate.supersedesEstimateId !== null) throw new Error('Erste Angebotsversion darf keinen Vorgänger haben.');
  if (estimate.version > 1 && !estimate.supersedesEstimateId) throw new Error('Folgeversion benötigt den nativen Vorgänger.');
}

function validateLine(line: ClientCostEstimateLine, estimate: ClientCostEstimateVersion): void {
  for (const [value, label] of [
    [line.id, 'Leistungszeilen-ID'], [line.tariffPositionId, 'Tarifpositions-ID'],
    [line.serviceCode, 'Leistungscode'], [line.serviceLabel, 'Leistungsbezeichnung'],
    [line.billingUnit, 'Leistungseinheit'],
  ] as const) required(value, label);
  if (line.tenantId !== estimate.tenantId || line.clientId !== estimate.clientId || line.financingPathId !== estimate.financingPathId) {
    throw new Error('Leistungszeile gehört nicht zum Angebots-Scope.');
  }
  if (line.estimateVersionId !== estimate.id) throw new Error('Leistungszeile gehört nicht zur konkreten Angebotsversion.');
  if (!/^\d{1,5}(?:\.\d{1,3})?$/.test(line.normalizedQuantity) || Number(line.normalizedQuantity) <= 0) throw new Error('Leistungsmenge ist ungültig.');
  if (!Number.isSafeInteger(line.frequencyCount) || line.frequencyCount < 1 || line.frequencyCount > 10000) throw new Error('Leistungshäufigkeit ist ungültig.');
  if (!['once', 'week', 'month', 'period'].includes(line.frequencyUnit)) throw new Error('Häufigkeitseinheit ist ungültig.');
  cents(line.occurrenceAmountCents, 'Einzelbetrag');
  cents(line.totalAmountCents, 'Zeilengesamtbetrag');
  if (line.occurrenceAmountCents === 0 || line.totalAmountCents !== line.occurrenceAmountCents * line.frequencyCount) {
    throw new Error('Zeilengesamt stimmt nicht mit Einzelbetrag und Häufigkeit überein.');
  }
}

function validateDecision(decision: ClientCostEstimateDecision, estimate: ClientCostEstimateVersion): void {
  for (const [value, label] of [
    [decision.id, 'Entscheidungs-ID'], [decision.decidedAt, 'Entscheidungszeit'],
    [decision.decidedByName, 'Entscheidende Person'], [decision.decidedByRole, 'Rolle'],
    [decision.evidenceReference, 'Annahmenachweis'],
  ] as const) required(value, label);
  instant(decision.decidedAt, 'Entscheidungszeit');
  if (decision.tenantId !== estimate.tenantId || decision.clientId !== estimate.clientId || decision.financingPathId !== estimate.financingPathId) {
    throw new Error('Entscheidung gehört nicht zum Angebots-Scope.');
  }
  if (decision.estimateVersionId !== estimate.id
    || decision.logicalEstimateId !== estimate.logicalEstimateId
    || decision.estimateVersion !== estimate.version
    || decision.contentFingerprint !== estimate.contentFingerprint) {
    throw new Error('Entscheidung ist nicht an die unveränderte konkrete Angebotsversion gebunden.');
  }
  if (!['accepted', 'declined'].includes(decision.decision)) throw new Error('Angebotsentscheidung ist ungültig.');
  if (decision.decidedAt < estimate.createdAt) throw new Error('Entscheidung liegt vor der Angebotsversion.');
  if (estimate.status === 'draft') throw new Error('Entwurf darf nicht angenommen oder abgelehnt werden.');
}

export function assessClientCostEstimate(
  estimate: ClientCostEstimateVersion,
  lines: readonly ClientCostEstimateLine[],
  decisions: readonly ClientCostEstimateDecision[],
  referenceDate: string,
): ClientCostEstimateAssessment {
  validateEstimate(estimate);
  calendarDate(referenceDate, 'Prüftag');
  if (lines.length === 0) throw new Error('Angebotsversion enthält keine Leistungszeile.');
  const ids = new Set<string>();
  let totalAmountCents = 0;
  for (const line of lines) {
    validateLine(line, estimate);
    if (ids.has(line.id)) throw new Error('Leistungszeilen-ID ist nicht eindeutig.');
    ids.add(line.id);
    totalAmountCents += line.totalAmountCents;
    if (!Number.isSafeInteger(totalAmountCents) || totalAmountCents > MAX_CENTS) throw new Error('Angebotsgesamtbetrag überschreitet die Betragsgrenze.');
  }
  if (estimate.payerContributionCents + estimate.selfPayCents !== totalAmountCents) {
    throw new Error('Kostenträger- und Eigenanteil stimmen nicht mit dem Angebotsgesamtbetrag überein.');
  }
  if (decisions.length > 1) throw new Error('Angebotsversion besitzt mehrere Entscheidungen.');
  const decision = decisions[0] ?? null;
  if (decision) validateDecision(decision, estimate);
  let state: ClientCostEstimateAssessment['state'];
  if (decision) state = decision.decision;
  else if (estimate.status === 'draft') state = 'draft';
  else if (estimate.status === 'superseded') state = 'superseded';
  else if (estimate.status === 'withdrawn') state = 'withdrawn';
  else state = referenceDate > estimate.validUntil ? 'expired' : 'offered';
  return { estimate, lines: [...lines], decision, state, totalAmountCents };
}
