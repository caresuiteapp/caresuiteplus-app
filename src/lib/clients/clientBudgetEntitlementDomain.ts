const MAX_BUDGET_CENTS = 999_999_999;

export type ClientBudgetEntitlementPeriod = {
  id: string;
  tenantId: string;
  clientId: string;
  financingPathId: string;
  serviceTypeKey: string;
  basisReference: string;
  periodStart: string;
  periodEnd: string;
  allocatedCents: number;
  createdAt: string;
};

export type ClientBudgetConsumptionEventKind = 'usage' | 'correction' | 'cancellation';

export type ClientBudgetConsumptionEvent = {
  id: string;
  tenantId: string;
  clientId: string;
  entitlementPeriodId: string;
  financingPathId: string;
  serviceTypeKey: string;
  serviceDate: string;
  amountCents: number;
  eventKind: ClientBudgetConsumptionEventKind;
  supersedesEventId: string | null;
  sourceType: string;
  sourceId: string;
  reason: string | null;
  recordedAt: string;
};

export type ClientBudgetConsumptionProjection = {
  entitlementPeriodId: string;
  allocatedCents: number;
  consumedCents: number;
  remainingCents: number;
  effectiveEvents: ClientBudgetConsumptionEvent[];
  history: ClientBudgetConsumptionEvent[];
};

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function requireIdentity(value: string, label: string): void {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} fehlt.`);
}

function requireCents(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_BUDGET_CENTS) {
    throw new Error(`${label} ist ungültig.`);
  }
}

export function selectClientBudgetEntitlementPeriod(
  periods: readonly ClientBudgetEntitlementPeriod[],
  scope: {
    tenantId: string;
    clientId: string;
    financingPathId: string;
    serviceTypeKey: string;
    serviceDate: string;
  },
): ClientBudgetEntitlementPeriod {
  requireIdentity(scope.tenantId, 'Mandant');
  requireIdentity(scope.clientId, 'Pflegefall');
  requireIdentity(scope.financingPathId, 'Finanzierungsweg');
  requireIdentity(scope.serviceTypeKey, 'Leistungsart');
  if (!isCalendarDate(scope.serviceDate)) throw new Error('Leistungsdatum ist ungültig.');

  const matches = periods.filter((period) => (
    period.tenantId === scope.tenantId
    && period.clientId === scope.clientId
    && period.financingPathId === scope.financingPathId
    && period.serviceTypeKey === scope.serviceTypeKey
    && period.periodStart <= scope.serviceDate
    && period.periodEnd >= scope.serviceDate
  ));
  if (matches.length === 0) throw new Error('Für Leistungsart und Leistungsdatum ist kein dokumentierter Anspruchszeitraum vorhanden.');
  if (matches.length !== 1) throw new Error('Anspruchszeitraum ist mehrdeutig.');
  const selected = matches[0]!;
  validateEntitlementPeriod(selected);
  return selected;
}

export function validateEntitlementPeriod(period: ClientBudgetEntitlementPeriod): void {
  requireIdentity(period.id, 'Anspruchszeitraum-ID');
  requireIdentity(period.tenantId, 'Mandant');
  requireIdentity(period.clientId, 'Pflegefall');
  requireIdentity(period.financingPathId, 'Finanzierungsweg');
  requireIdentity(period.serviceTypeKey, 'Leistungsart');
  requireIdentity(period.basisReference, 'Individuelle Anspruchsgrundlage');
  requireIdentity(period.createdAt, 'Erfassungszeitpunkt');
  if (!isCalendarDate(period.periodStart) || !isCalendarDate(period.periodEnd) || period.periodEnd < period.periodStart) {
    throw new Error('Anspruchszeitraum ist ungültig.');
  }
  requireCents(period.allocatedCents, 'Anspruchsbetrag');
}

function validateEvent(event: ClientBudgetConsumptionEvent, period: ClientBudgetEntitlementPeriod): void {
  requireIdentity(event.id, 'Verbrauchsereignis-ID');
  requireIdentity(event.sourceType, 'Originalbelegart');
  requireIdentity(event.sourceId, 'Originalbeleg-ID');
  requireIdentity(event.recordedAt, 'Erfassungszeitpunkt');
  if (event.tenantId !== period.tenantId || event.clientId !== period.clientId) {
    throw new Error('Verbrauchsereignis gehört nicht zu Mandant und Pflegefall des Anspruchs.');
  }
  if (event.entitlementPeriodId !== period.id || event.financingPathId !== period.financingPathId) {
    throw new Error('Verbrauchsereignis gehört nicht zu Anspruchszeitraum und Finanzierungsweg.');
  }
  if (event.serviceTypeKey !== period.serviceTypeKey) {
    throw new Error('Verbrauchsereignis gehört nicht zur Leistungsart des Anspruchs.');
  }
  if (!isCalendarDate(event.serviceDate)
    || event.serviceDate < period.periodStart
    || event.serviceDate > period.periodEnd) {
    throw new Error('Leistungsdatum liegt außerhalb des Anspruchszeitraums.');
  }
  requireCents(event.amountCents, 'Verbrauchsbetrag');
  if (event.eventKind === 'usage') {
    if (event.supersedesEventId !== null) throw new Error('Erstverbrauch darf keinen Vorgänger ersetzen.');
    if (event.amountCents === 0) throw new Error('Erstverbrauch muss positiv sein.');
  } else {
    if (!event.supersedesEventId) throw new Error('Korrektur oder Storno benötigt den nativen Vorgänger.');
    requireIdentity(event.reason ?? '', 'Korrektur-/Stornogrund');
    if (event.eventKind === 'correction' && event.amountCents === 0) throw new Error('Korrektur muss positiv sein.');
    if (event.eventKind === 'cancellation' && event.amountCents !== 0) throw new Error('Storno muss einen Verbrauch von null ausweisen.');
  }
}

export function projectClientBudgetConsumption(
  period: ClientBudgetEntitlementPeriod,
  events: readonly ClientBudgetConsumptionEvent[],
): ClientBudgetConsumptionProjection {
  validateEntitlementPeriod(period);
  const byId = new Map<string, ClientBudgetConsumptionEvent>();
  for (const event of events) {
    validateEvent(event, period);
    if (byId.has(event.id)) throw new Error('Verbrauchsereignis-ID ist nicht eindeutig.');
    byId.set(event.id, event);
  }

  const successorByPredecessor = new Map<string, string>();
  for (const event of events) {
    const predecessorId = event.supersedesEventId;
    if (!predecessorId) continue;
    const predecessor = byId.get(predecessorId);
    if (!predecessor) throw new Error('Korrektur- oder Stornovorgänger fehlt.');
    if (predecessor.recordedAt >= event.recordedAt) {
      throw new Error('Korrektur oder Storno muss nach dem Vorgänger erfasst sein.');
    }
    if (successorByPredecessor.has(predecessorId)) {
      throw new Error('Vorgänger hat mehrere konkurrierende Nachfolger.');
    }
    successorByPredecessor.set(predecessorId, event.id);
  }

  for (const event of events) {
    const visited = new Set<string>();
    let current: ClientBudgetConsumptionEvent | undefined = event;
    while (current?.supersedesEventId) {
      if (visited.has(current.id)) throw new Error('Verbrauchskorrektur enthält einen Zyklus.');
      visited.add(current.id);
      current = byId.get(current.supersedesEventId);
    }
  }

  const effectiveEvents = events.filter((event) => !successorByPredecessor.has(event.id));
  const consumedCents = effectiveEvents.reduce((sum, event) => {
    if (event.eventKind === 'cancellation') return sum;
    const next = sum + event.amountCents;
    if (!Number.isSafeInteger(next) || next > MAX_BUDGET_CENTS) throw new Error('Gesamtverbrauch überschreitet die zulässige Betragsgrenze.');
    return next;
  }, 0);

  return {
    entitlementPeriodId: period.id,
    allocatedCents: period.allocatedCents,
    consumedCents,
    remainingCents: period.allocatedCents - consumedCents,
    effectiveEvents: [...effectiveEvents].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt) || a.id.localeCompare(b.id)),
    history: [...events].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt) || a.id.localeCompare(b.id)),
  };
}
