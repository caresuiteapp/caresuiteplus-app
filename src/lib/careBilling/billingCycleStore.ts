import type {
  BillingAuditEvent,
  BillingRun,
  BillingRunItem,
  CareBillingInvoice,
  CareBillingInvoiceItem,
  DunningLetter,
  DunningRun,
  PaymentAllocation,
  Receivable,
} from '@/types/careBilling/billingCycle';

export type BillingCycleStoreState = {
  billingRuns: BillingRun[];
  billingRunItems: BillingRunItem[];
  invoices: CareBillingInvoice[];
  invoiceItems: CareBillingInvoiceItem[];
  receivables: Receivable[];
  dunningRuns: DunningRun[];
  dunningLetters: DunningLetter[];
  paymentAllocations: PaymentAllocation[];
  auditEvents: BillingAuditEvent[];
};

const stores = new Map<string, BillingCycleStoreState>();

function emptyStore(): BillingCycleStoreState {
  return {
    billingRuns: [],
    billingRunItems: [],
    invoices: [],
    invoiceItems: [],
    receivables: [],
    dunningRuns: [],
    dunningLetters: [],
    paymentAllocations: [],
    auditEvents: [],
  };
}

export function getBillingCycleStore(tenantId: string): BillingCycleStoreState {
  let store = stores.get(tenantId);
  if (!store) {
    store = emptyStore();
    stores.set(tenantId, store);
  }
  return store;
}

export function resetBillingCycleStore(tenantId?: string): void {
  if (tenantId) {
    stores.delete(tenantId);
    return;
  }
  stores.clear();
}

let idCounter = 0;

export function nextBillingCycleId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

export function appendBillingAuditEvent(
  event: Omit<BillingAuditEvent, 'id' | 'createdAt' | 'updatedAt'>,
): BillingAuditEvent {
  const full: BillingAuditEvent = {
    ...event,
    id: nextBillingCycleId('bc-audit'),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  getBillingCycleStore(event.tenantId).auditEvents.unshift(full);
  return full;
}

export function listBillingAuditEvents(tenantId: string): BillingAuditEvent[] {
  return [...getBillingCycleStore(tenantId).auditEvents];
}

export function saveBillingRun(tenantId: string, run: BillingRun): BillingRun {
  const store = getBillingCycleStore(tenantId);
  const idx = store.billingRuns.findIndex((r) => r.id === run.id);
  if (idx >= 0) store.billingRuns[idx] = run;
  else store.billingRuns.push(run);
  return run;
}

export function getBillingRun(tenantId: string, runId: string): BillingRun | null {
  return getBillingCycleStore(tenantId).billingRuns.find((r) => r.id === runId) ?? null;
}

export function listBillingRuns(tenantId: string): BillingRun[] {
  return [...getBillingCycleStore(tenantId).billingRuns].sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt),
  );
}

export function saveBillingRunItem(tenantId: string, item: BillingRunItem): BillingRunItem {
  const store = getBillingCycleStore(tenantId);
  const idx = store.billingRunItems.findIndex((i) => i.id === item.id);
  if (idx >= 0) store.billingRunItems[idx] = item;
  else store.billingRunItems.push(item);
  return item;
}

export function listBillingRunItems(tenantId: string, runId: string): BillingRunItem[] {
  return getBillingCycleStore(tenantId).billingRunItems.filter((i) => i.billingRunId === runId);
}

export function saveCareBillingInvoice(tenantId: string, invoice: CareBillingInvoice): CareBillingInvoice {
  const store = getBillingCycleStore(tenantId);
  const idx = store.invoices.findIndex((i) => i.id === invoice.id);
  if (idx >= 0) store.invoices[idx] = invoice;
  else store.invoices.push(invoice);
  return invoice;
}

export function getCareBillingInvoice(tenantId: string, invoiceId: string): CareBillingInvoice | null {
  return getBillingCycleStore(tenantId).invoices.find((i) => i.id === invoiceId) ?? null;
}

export function listCareBillingInvoices(tenantId: string): CareBillingInvoice[] {
  return [...getBillingCycleStore(tenantId).invoices];
}

export function saveCareBillingInvoiceItem(
  tenantId: string,
  item: CareBillingInvoiceItem,
): CareBillingInvoiceItem {
  const store = getBillingCycleStore(tenantId);
  const idx = store.invoiceItems.findIndex((i) => i.id === item.id);
  if (idx >= 0) store.invoiceItems[idx] = item;
  else store.invoiceItems.push(item);
  return item;
}

export function listCareBillingInvoiceItems(tenantId: string, invoiceId: string): CareBillingInvoiceItem[] {
  return getBillingCycleStore(tenantId).invoiceItems.filter((i) => i.invoiceId === invoiceId);
}

export function saveReceivable(tenantId: string, receivable: Receivable): Receivable {
  const store = getBillingCycleStore(tenantId);
  const idx = store.receivables.findIndex((r) => r.id === receivable.id);
  if (idx >= 0) store.receivables[idx] = receivable;
  else store.receivables.push(receivable);
  return receivable;
}

export function getReceivable(tenantId: string, receivableId: string): Receivable | null {
  return getBillingCycleStore(tenantId).receivables.find((r) => r.id === receivableId) ?? null;
}

export function listReceivables(tenantId: string, clientId?: string): Receivable[] {
  const items = getBillingCycleStore(tenantId).receivables;
  return clientId ? items.filter((r) => r.clientId === clientId) : [...items];
}

export function saveDunningRun(tenantId: string, run: DunningRun): DunningRun {
  const store = getBillingCycleStore(tenantId);
  const idx = store.dunningRuns.findIndex((r) => r.id === run.id);
  if (idx >= 0) store.dunningRuns[idx] = run;
  else store.dunningRuns.push(run);
  return run;
}

export function listDunningRuns(tenantId: string): DunningRun[] {
  return [...getBillingCycleStore(tenantId).dunningRuns];
}

export function saveDunningLetter(tenantId: string, letter: DunningLetter): DunningLetter {
  const store = getBillingCycleStore(tenantId);
  const idx = store.dunningLetters.findIndex((l) => l.id === letter.id);
  if (idx >= 0) store.dunningLetters[idx] = letter;
  else store.dunningLetters.push(letter);
  return letter;
}

export function listDunningLetters(tenantId: string, runId?: string): DunningLetter[] {
  const letters = getBillingCycleStore(tenantId).dunningLetters;
  return runId ? letters.filter((l) => l.dunningRunId === runId) : [...letters];
}

export function savePaymentAllocation(tenantId: string, allocation: PaymentAllocation): PaymentAllocation {
  getBillingCycleStore(tenantId).paymentAllocations.push(allocation);
  return allocation;
}

export function listPaymentAllocations(tenantId: string, receivableId?: string): PaymentAllocation[] {
  const items = getBillingCycleStore(tenantId).paymentAllocations;
  return receivableId ? items.filter((a) => a.receivableId === receivableId) : [...items];
}

/** Live-Modus: Supabase-Migration 0054 muss angewendet sein. */
export function isBillingCycleLiveReady(): boolean {
  return false;
}

export const BILLING_CYCLE_PREPARED_MESSAGE =
  'Monatsabschluss/Rechnungslauf ist vorbereitet — Live-Anbindung folgt nach Migration 0054.';
