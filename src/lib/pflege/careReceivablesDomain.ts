export type CareReceivableInvoice = {
  openItemId: string;
  invoiceApprovalId: string;
  invoiceNumber: string;
  tenantId: string;
  clientId: string;
  claimLineageId: string;
  documentFingerprint: string;
  approvedAt: string;
  dueDate: string;
  receivableAmountCents: number;
};

export type CarePaymentAllocation = {
  openItemId: string;
  invoiceApprovalId: string;
  claimLineageId: string;
  amountCents: number;
};

export type CarePaymentEvent = {
  paymentEventId: string;
  clientRequestId: string;
  tenantId: string;
  clientId: string;
  eventKind: 'payment_received' | 'payment_reversal' | string;
  paymentMethod: 'bank_transfer' | 'cash' | 'direct_debit' | string;
  bankTransactionId: string | null;
  bookingReference: string;
  valueDate: string;
  recordedAt: string;
  amountCents: number;
  allocations: readonly CarePaymentAllocation[];
  reversesPaymentEventId: string | null;
  reversalReason: string | null;
};

export type CareReceivableOpenItem = CareReceivableInvoice & {
  paidAmountCents: number;
  remainingAmountCents: number;
  paymentStatus: 'open' | 'partially_paid' | 'paid';
  dueStatus: 'not_due' | 'due_today' | 'overdue' | 'settled';
  lastPaymentAt: string | null;
  appliedPaymentEventIds: readonly string[];
};

export type CareReceivablesLedger = {
  asOfDate: string;
  openItems: readonly CareReceivableOpenItem[];
  totalReceivableCents: number;
  totalPaidCents: number;
  totalRemainingCents: number;
  paymentEvents: readonly CarePaymentEvent[];
  historyMode: 'append_only';
};

const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
const exactUtcMicros = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}(?:Z|\+00:00)$/;
const fingerprint = /^[0-9a-f]{32}$/;

function required(value: string, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} fehlt.`);
  return value.trim();
}

function cents(value: number, label: string, positive = false): void {
  if (!Number.isSafeInteger(value) || value < 0 || (positive && value === 0)) throw new Error(`${label} ist ungültig.`);
}

function calendarDate(value: string, label: string): void {
  if (!dateOnly.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) throw new Error(`${label} ist ungültig.`);
}

function exactMicros(value: string, label: string): void {
  if (!exactUtcMicros.test(value) || Number.isNaN(Date.parse(value))) throw new Error(`${label} benötigt exakt sechs UTC-Mikrosekundenstellen.`);
}

function normalizedMicros(value: string): string {
  return value.replace('+00:00', 'Z');
}

function validateInvoice(invoice: CareReceivableInvoice): CareReceivableInvoice {
  for (const [value, label] of [
    [invoice.openItemId, 'Offener-Posten-ID'], [invoice.invoiceApprovalId, 'Rechnungsfreigabe'],
    [invoice.invoiceNumber, 'Rechnungsnummer'], [invoice.tenantId, 'Mandant'], [invoice.clientId, 'Pflegefall'],
    [invoice.claimLineageId, 'Forderungshistorie'],
  ] as const) required(value, label);
  if (!fingerprint.test(invoice.documentFingerprint)) throw new Error('Rechnungsfingerprint ist ungültig.');
  exactMicros(invoice.approvedAt, 'Rechnungsfreigabezeit');
  calendarDate(invoice.dueDate, 'Fälligkeit');
  if (invoice.dueDate < invoice.approvedAt.slice(0, 10)) throw new Error('Fälligkeit liegt vor der Rechnungsfreigabe.');
  cents(invoice.receivableAmountCents, 'Forderungsbetrag', true);
  return Object.freeze({ ...invoice });
}

function validateEvent(event: CarePaymentEvent): CarePaymentEvent {
  for (const [value, label] of [
    [event.paymentEventId, 'Zahlungsereignis'], [event.clientRequestId, 'Anforderungs-ID'],
    [event.tenantId, 'Zahlungsmandant'], [event.clientId, 'Zahlungspflegefall'],
    [event.bookingReference, 'Buchungsreferenz'],
  ] as const) required(value, label);
  if (!['payment_received', 'payment_reversal'].includes(event.eventKind)) throw new Error('Zahlungsereignisart ist ungültig.');
  if (!['bank_transfer', 'cash', 'direct_debit'].includes(event.paymentMethod)) throw new Error('Zahlungsart ist ungültig.');
  if (event.paymentMethod !== 'cash') required(event.bankTransactionId ?? '', 'Banktransaktions-ID');
  calendarDate(event.valueDate, 'Wertstellung');
  exactMicros(event.recordedAt, 'Zahlungserfassungszeit');
  if (event.valueDate > event.recordedAt.slice(0, 10)) throw new Error('Wertstellung liegt nach der tatsächlichen Erfassung.');
  cents(event.amountCents, 'Zahlungsbetrag', true);
  if (event.eventKind === 'payment_received') {
    if (event.reversesPaymentEventId || event.reversalReason) throw new Error('Zahlungseingang darf keine Stornoreferenz enthalten.');
    if (!Array.isArray(event.allocations) || !event.allocations.length) throw new Error('Zahlungseingang benötigt eine konkrete Forderungszuordnung.');
  } else {
    required(event.reversesPaymentEventId ?? '', 'Stornierte Zahlungsereignis-ID');
    required(event.reversalReason ?? '', 'Zahlungsstornogrund');
    if (event.allocations.length) throw new Error('Zahlungsstorno übernimmt keine neue Forderungszuordnung.');
  }
  return Object.freeze({ ...event, allocations: Object.freeze(event.allocations.map((allocation) => Object.freeze({ ...allocation }))) });
}

export function buildCareReceivablesLedger(
  sourceInvoices: readonly CareReceivableInvoice[],
  sourceEvents: readonly CarePaymentEvent[],
  asOfDate: string,
): CareReceivablesLedger {
  calendarDate(asOfDate, 'Auswertungsstichtag');
  if (!Array.isArray(sourceInvoices) || !sourceInvoices.length) throw new Error('Freigegebene Forderungen fehlen.');
  const invoices = sourceInvoices.map(validateInvoice);
  const invoiceByOpenItem = new Map<string, CareReceivableInvoice>();
  const invoiceApprovalIds = new Set<string>(); const invoiceNumbers = new Set<string>(); const claimLineages = new Set<string>();
  const tenantId = invoices[0].tenantId; const clientId = invoices[0].clientId;
  for (const invoice of invoices) {
    if (invoice.tenantId !== tenantId || invoice.clientId !== clientId) throw new Error('Offene Posten müssen demselben Mandanten und Pflegefall angehören.');
    if (invoiceByOpenItem.has(invoice.openItemId) || invoiceApprovalIds.has(invoice.invoiceApprovalId) || invoiceNumbers.has(invoice.invoiceNumber) || claimLineages.has(invoice.claimLineageId)) throw new Error('Offene Posten enthalten doppelte native Rechnungs- oder Forderungsidentitäten.');
    invoiceByOpenItem.set(invoice.openItemId, invoice); invoiceApprovalIds.add(invoice.invoiceApprovalId); invoiceNumbers.add(invoice.invoiceNumber); claimLineages.add(invoice.claimLineageId);
  }

  const events = sourceEvents.map(validateEvent).sort((a, b) => normalizedMicros(a.recordedAt).localeCompare(normalizedMicros(b.recordedAt)) || a.paymentEventId.localeCompare(b.paymentEventId));
  const eventIds = new Set<string>(); const requestIds = new Set<string>(); const transactionIds = new Set<string>();
  const received = new Map<string, CarePaymentEvent>(); const reversed = new Set<string>();
  for (const event of events) {
    if (event.tenantId !== tenantId || event.clientId !== clientId) throw new Error('Zahlungsereignis gehört zu einem anderen Mandanten oder Pflegefall.');
    if (eventIds.has(event.paymentEventId) || requestIds.has(event.clientRequestId)) throw new Error('Zahlungshistorie enthält doppelte Ereignis- oder Anforderungsidentitäten.');
    eventIds.add(event.paymentEventId); requestIds.add(event.clientRequestId);
    if (event.bankTransactionId) {
      if (transactionIds.has(event.bankTransactionId)) throw new Error('Banktransaktion ist doppelt dokumentiert.');
      transactionIds.add(event.bankTransactionId);
    }
    if (event.eventKind === 'payment_received') {
      const allocated = new Set<string>(); let allocationTotal = 0;
      for (const allocation of event.allocations) {
        required(allocation.openItemId, 'Zuordnung Offener Posten'); required(allocation.invoiceApprovalId, 'Zuordnung Rechnungsfreigabe'); required(allocation.claimLineageId, 'Zuordnung Forderungshistorie');
        cents(allocation.amountCents, 'Zuordnungsbetrag', true);
        if (allocated.has(allocation.openItemId)) throw new Error('Zahlung ordnet denselben offenen Posten mehrfach zu.');
        allocated.add(allocation.openItemId);
        const invoice = invoiceByOpenItem.get(allocation.openItemId);
        if (!invoice || invoice.invoiceApprovalId !== allocation.invoiceApprovalId || invoice.claimLineageId !== allocation.claimLineageId) throw new Error('Zahlung ist nicht exakt der freigegebenen Forderung zugeordnet.');
        if (event.valueDate < invoice.approvedAt.slice(0, 10) || normalizedMicros(event.recordedAt) <= normalizedMicros(invoice.approvedAt)) throw new Error('Zahlung liegt vor der freigegebenen Forderung.');
        allocationTotal += allocation.amountCents;
      }
      if (allocationTotal !== event.amountCents) throw new Error('Zuordnungen stimmen nicht centgenau mit dem Zahlungsbetrag überein.');
      received.set(event.paymentEventId, event);
    } else {
      const original = received.get(event.reversesPaymentEventId ?? '');
      if (!original || reversed.has(original.paymentEventId)) throw new Error('Zahlungsstorno benötigt genau einen vorhandenen, noch nicht stornierten Zahlungseingang.');
      if (event.amountCents !== original.amountCents || event.paymentMethod !== original.paymentMethod || normalizedMicros(event.recordedAt) <= normalizedMicros(original.recordedAt)) throw new Error('Zahlungsstorno muss Betrag und Zahlungsart vollständig umkehren und später erfasst sein.');
      reversed.add(original.paymentEventId);
    }
  }

  const paid = new Map<string, number>(); const appliedIds = new Map<string, string[]>(); const lastPayment = new Map<string, string>();
  for (const event of received.values()) {
    if (reversed.has(event.paymentEventId)) continue;
    for (const allocation of event.allocations) {
      const invoice = invoiceByOpenItem.get(allocation.openItemId)!;
      const next = (paid.get(invoice.openItemId) ?? 0) + allocation.amountCents;
      if (next > invoice.receivableAmountCents) throw new Error('Zahlungszuordnungen übersteigen den offenen Forderungsbetrag.');
      paid.set(invoice.openItemId, next);
      appliedIds.set(invoice.openItemId, [...(appliedIds.get(invoice.openItemId) ?? []), event.paymentEventId]);
      const prior = lastPayment.get(invoice.openItemId);
      if (!prior || normalizedMicros(event.recordedAt) > normalizedMicros(prior)) lastPayment.set(invoice.openItemId, event.recordedAt);
    }
  }

  const openItems = invoices.map((invoice): CareReceivableOpenItem => {
    const paidAmountCents = paid.get(invoice.openItemId) ?? 0;
    const remainingAmountCents = invoice.receivableAmountCents - paidAmountCents;
    const paymentStatus = remainingAmountCents === 0 ? 'paid' : paidAmountCents > 0 ? 'partially_paid' : 'open';
    const dueStatus = remainingAmountCents === 0 ? 'settled' : invoice.dueDate < asOfDate ? 'overdue' : invoice.dueDate === asOfDate ? 'due_today' : 'not_due';
    return Object.freeze({ ...invoice, paidAmountCents, remainingAmountCents, paymentStatus, dueStatus, lastPaymentAt: lastPayment.get(invoice.openItemId) ?? null, appliedPaymentEventIds: Object.freeze(appliedIds.get(invoice.openItemId) ?? []) });
  });
  const totalReceivableCents = openItems.reduce((sum, item) => sum + item.receivableAmountCents, 0);
  const totalPaidCents = openItems.reduce((sum, item) => sum + item.paidAmountCents, 0);
  const totalRemainingCents = openItems.reduce((sum, item) => sum + item.remainingAmountCents, 0);
  return Object.freeze({ asOfDate, openItems: Object.freeze(openItems), totalReceivableCents, totalPaidCents, totalRemainingCents, paymentEvents: Object.freeze(events), historyMode: 'append_only' });
}
