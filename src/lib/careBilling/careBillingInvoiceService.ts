import type { CareBillingInvoice, CareBillingInvoiceItem } from '@/types/careBilling/billingCycle';
import {
  getInvoiceDraft,
  getBillableItem,
  listInvoiceDraftItems,
  saveInvoiceDraft,
} from './careBillingStore';
import {
  appendBillingAuditEvent,
  nextBillingCycleId,
  saveCareBillingInvoice,
  saveCareBillingInvoiceItem,
} from './billingCycleStore';
import { createCareBillingValidationReport } from './careBillingValidationService';

export type CreateCareBillingInvoiceInput = {
  tenantId: string;
  invoiceDraftId: string;
  billingRunId: string | null;
  previewConfirmed: boolean;
  dueDays?: number;
};

export type CreateCareBillingInvoiceResult =
  | { ok: true; invoice: CareBillingInvoice }
  | { ok: false; error: string };

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Gesetzliche Kassenabrechnung nur als vorbereitet — kein produktiver Versand. */
function isStatutoryPreparedOnly(recipientType: string, costCarrierIk: string | null): boolean {
  if (recipientType === 'pflegekasse' || recipientType === 'legal_guardian') {
    return true;
  }
  return !!costCarrierIk?.trim();
}

export function createCareBillingInvoiceFromDraft(
  input: CreateCareBillingInvoiceInput,
): CreateCareBillingInvoiceResult {
  const draft = getInvoiceDraft(input.tenantId, input.invoiceDraftId);
  if (!draft) {
    return { ok: false, error: 'Rechnungsentwurf nicht gefunden.' };
  }

  if (draft.status === 'finalized') {
    return { ok: false, error: 'Rechnungsentwurf bereits finalisiert.' };
  }

  if (!input.previewConfirmed) {
    return { ok: false, error: 'PDF-Vorschau muss bestätigt sein.' };
  }

  const lineItems = listInvoiceDraftItems(input.tenantId, input.invoiceDraftId);
  if (lineItems.length === 0) {
    return { ok: false, error: 'Keine Positionen im Entwurf.' };
  }

  const firstBillable = getBillableItem(input.tenantId, lineItems[0].billableItemId);

  const validation = createCareBillingValidationReport({
    tenantId: input.tenantId,
    clientId: draft.clientId,
    careGrade: firstBillable?.careGrade ?? null,
    hasServiceProof: true,
    serviceProofApproved: true,
    serviceAreaKey: firstBillable?.serviceAreaKey ?? 'betreuung',
    servicePeriodFrom: draft.servicePeriodFrom,
    servicePeriodTo: draft.servicePeriodTo,
    hourlyRateNetCents: lineItems[0]?.unitPriceNetCents ?? 0,
    costCarrierProfileId: draft.costCarrierIk ? 'cc-from-draft' : null,
    recipientType: draft.recipientType,
    recipientResolved: !!draft.recipientName?.trim(),
    amountCents: draft.netTotalCents,
    taxMode: draft.taxMode,
    taxConsistent: true,
  });

  if (!validation.passed) {
    return { ok: false, error: validation.blockedReason ?? 'Pflichtvalidierung fehlgeschlagen.' };
  }

  const now = new Date().toISOString();
  const invoiceId = nextBillingCycleId('cinv');
  const invoiceNumber = `RE-${draft.servicePeriodTo.slice(0, 7).replace('-', '')}-${invoiceId.slice(-6).toUpperCase()}`;
  const statutoryPrepared = isStatutoryPreparedOnly(draft.recipientType, draft.costCarrierIk);

  const invoice: CareBillingInvoice = {
    id: invoiceId,
    tenantId: input.tenantId,
    clientId: draft.clientId,
    invoiceDraftId: draft.id,
    invoiceNumber,
    status: statutoryPrepared ? 'sent_prepared' : 'finalized',
    taxMode: draft.taxMode,
    servicePeriodFrom: draft.servicePeriodFrom,
    servicePeriodTo: draft.servicePeriodTo,
    recipientType: draft.recipientType,
    recipientName: draft.recipientName,
    costCarrierName: draft.costCarrierName,
    costCarrierIk: draft.costCarrierIk,
    netTotalCents: draft.netTotalCents,
    taxTotalCents: draft.taxTotalCents,
    grossTotalCents: draft.grossTotalCents,
    validationRunId: draft.validationRunId ?? validation.validationRunId,
    dueDate: addDays(now, input.dueDays ?? 14),
    sentPreparedAt: statutoryPrepared ? now : null,
    isStatutoryPreparedOnly: statutoryPrepared,
    billingRunId: input.billingRunId,
    createdAt: now,
    updatedAt: now,
  };

  saveCareBillingInvoice(input.tenantId, invoice);

  for (const line of lineItems) {
    const item: CareBillingInvoiceItem = {
      id: nextBillingCycleId('cinv-item'),
      tenantId: input.tenantId,
      invoiceId,
      billableItemId: line.billableItemId,
      description: line.description,
      netTotalCents: line.netTotalCents,
      taxTotalCents: line.taxTotalCents,
      grossTotalCents: line.grossTotalCents,
      createdAt: now,
      updatedAt: now,
    };
    saveCareBillingInvoiceItem(input.tenantId, item);
  }

  saveInvoiceDraft(input.tenantId, {
    ...draft,
    status: 'finalized',
    draftNumber: draft.draftNumber ?? invoiceNumber,
    finalizedInvoiceId: invoiceId,
    previewConfirmed: true,
    updatedAt: now,
  });

  appendBillingAuditEvent({
    tenantId: input.tenantId,
    action: statutoryPrepared
      ? 'billing_cycle.invoice_sent_prepared'
      : 'billing_cycle.invoice_finalized',
    entityType: 'invoices',
    entityId: invoiceId,
    summary: statutoryPrepared
      ? `Rechnung ${invoiceNumber} — Kassenabrechnung nur vorbereitet (kein produktiver Versand).`
      : `Rechnung ${invoiceNumber} finalisiert.`,
    actorId: null,
  });

  return { ok: true, invoice };
}
