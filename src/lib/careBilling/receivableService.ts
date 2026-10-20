import type { PaymentAllocation, Receivable, ReceivableDunningStatus } from '@/types/careBilling/billingCycle';
import {
  appendBillingAuditEvent,
  getCareBillingInvoice,
  getReceivable,
  listPaymentAllocations,
  listReceivables,
  nextBillingCycleId,
  savePaymentAllocation,
  saveReceivable,
} from './billingCycleStore';

export type CreateReceivableResult =
  | { ok: true; receivable: Receivable }
  | { ok: false; error: string };

function computeInitialDunningStatus(dueDate: string): ReceivableDunningStatus {
  const today = new Date().toISOString().slice(0, 10);
  if (dueDate > today) return 'not_due';
  if (dueDate === today) return 'due';
  return 'overdue';
}

export function createReceivableFromInvoice(
  tenantId: string,
  invoiceId: string,
): CreateReceivableResult {
  const invoice = getCareBillingInvoice(tenantId, invoiceId);
  if (!invoice) {
    return { ok: false, error: 'Rechnung nicht gefunden.' };
  }

  const existing = listReceivables(tenantId).find((r) => r.invoiceId === invoiceId);
  if (existing) {
    return { ok: false, error: 'Forderung für diese Rechnung existiert bereits.' };
  }

  const now = new Date().toISOString();
  const receivable: Receivable = {
    id: nextBillingCycleId('recv'),
    tenantId,
    clientId: invoice.clientId,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber ?? invoice.id,
    grossTotalCents: invoice.grossTotalCents,
    openAmountCents: invoice.grossTotalCents,
    paidAmountCents: 0,
    dueDate: invoice.dueDate,
    dunningStatus: computeInitialDunningStatus(invoice.dueDate),
    lastDunningAt: null,
    createdAt: now,
    updatedAt: now,
  };

  saveReceivable(tenantId, receivable);

  appendBillingAuditEvent({
    tenantId,
    action: 'billing_cycle.receivable_created',
    entityType: 'receivables',
    entityId: receivable.id,
    summary: `Forderung ${receivable.invoiceNumber}: ${(receivable.openAmountCents / 100).toFixed(2)} EUR offen.`,
    actorId: null,
  });

  return { ok: true, receivable };
}

export function refreshReceivableDunningStatus(tenantId: string, receivableId: string): Receivable | null {
  const receivable = getReceivable(tenantId, receivableId);
  if (!receivable) return null;

  if (receivable.openAmountCents <= 0) {
    const paid: Receivable = {
      ...receivable,
      dunningStatus: 'paid',
      updatedAt: new Date().toISOString(),
    };
    saveReceivable(tenantId, paid);
    return paid;
  }

  const terminal = new Set<ReceivableDunningStatus>([
    'reminder_sent',
    'first_dunning_sent',
    'final_dunning_sent',
    'collection_prepared',
    'disputed',
    'written_off',
  ]);

  if (terminal.has(receivable.dunningStatus)) {
    return receivable;
  }

  const nextStatus = computeInitialDunningStatus(receivable.dueDate);
  if (nextStatus === receivable.dunningStatus) return receivable;

  const updated: Receivable = {
    ...receivable,
    dunningStatus: nextStatus,
    updatedAt: new Date().toISOString(),
  };
  saveReceivable(tenantId, updated);
  return updated;
}

export function listOpenDueReceivables(tenantId: string): Receivable[] {
  return listReceivables(tenantId)
    .map((r) => refreshReceivableDunningStatus(tenantId, r.id) ?? r)
    .filter(
      (r) =>
        r.openAmountCents > 0 &&
        (r.dunningStatus === 'due' || r.dunningStatus === 'overdue' ||
          r.dunningStatus === 'reminder_sent' || r.dunningStatus === 'first_dunning_sent'),
    );
}

export function isReceivableEligibleForDunning(receivable: Receivable): boolean {
  return (
    receivable.openAmountCents > 0 &&
    (receivable.dunningStatus === 'due' || receivable.dunningStatus === 'overdue')
  );
}

export function allocatePaymentToReceivable(input: {
  tenantId: string;
  receivableId: string;
  amountCents: number;
  paymentReference: string;
}): { ok: true; receivable: Receivable; allocation: PaymentAllocation } | { ok: false; error: string } {
  const receivable = getReceivable(input.tenantId, input.receivableId);
  if (!receivable) {
    return { ok: false, error: 'Forderung nicht gefunden.' };
  }

  if (input.amountCents <= 0) {
    return { ok: false, error: 'Zahlungsbetrag muss positiv sein.' };
  }

  if (input.amountCents > receivable.openAmountCents) {
    return { ok: false, error: 'Zahlungsbetrag übersteigt offenen Betrag.' };
  }

  const now = new Date().toISOString();
  const allocation: PaymentAllocation = {
    id: nextBillingCycleId('pay-alloc'),
    tenantId: input.tenantId,
    receivableId: receivable.id,
    invoiceId: receivable.invoiceId,
    amountCents: input.amountCents,
    paymentReference: input.paymentReference,
    allocatedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  savePaymentAllocation(input.tenantId, allocation);

  const openAmountCents = receivable.openAmountCents - input.amountCents;
  const paidAmountCents = receivable.paidAmountCents + input.amountCents;

  const updated: Receivable = {
    ...receivable,
    openAmountCents,
    paidAmountCents,
    dunningStatus: openAmountCents <= 0 ? 'paid' : receivable.dunningStatus,
    updatedAt: now,
  };

  saveReceivable(input.tenantId, updated);

  appendBillingAuditEvent({
    tenantId: input.tenantId,
    action: 'billing_cycle.payment_allocated',
    entityType: 'payment_allocations',
    entityId: allocation.id,
    summary: `Zahlung ${(input.amountCents / 100).toFixed(2)} EUR auf ${receivable.invoiceNumber} verbucht.`,
    actorId: null,
  });

  return { ok: true, receivable: updated, allocation };
}

export { listReceivables, listPaymentAllocations, getReceivable };
