import type {
  CreateInvoiceDraftInput,
  FinalizeInvoiceDraftResult,
  InvoiceDraft,
  InvoiceDraftItem,
} from '@/types/careBilling';
import { calculateInvoiceTax } from '@/lib/documents/invoiceTaxLogic';
import {
  appendCareBillingAudit,
  getBillableItem,
  getInvoiceDraft,
  listBillingRecipientProfiles,
  listCostCarrierProfiles,
  listInvoiceDraftItems,
  saveBillableItem,
  saveInvoiceDraft,
  saveInvoiceDraftItem,
} from './careBillingStore';
import { createCareBillingValidationReport } from './careBillingValidationService';
import { resolveBillingRecipient, validateRecipientForBilling } from './billingRecipientService';

function newDraftId(): string {
  return `idraft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function newDraftItemId(): string {
  return `idi-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createCareInvoiceDraft(
  input: CreateInvoiceDraftInput,
): { ok: true; draft: InvoiceDraft } | { ok: false; error: string } {
  const now = new Date().toISOString();

  if (!input.clientId?.trim()) {
    return { ok: false, error: 'Klient fehlt.' };
  }
  if (!input.servicePeriodFrom?.trim() || !input.servicePeriodTo?.trim()) {
    return { ok: false, error: 'Leistungszeitraum fehlt.' };
  }
  if (input.billableItemIds.length === 0) {
    return { ok: false, error: 'Keine abrechenbaren Positionen ausgewählt.' };
  }

  const items = input.billableItemIds
    .map((id) => getBillableItem(input.tenantId, id))
    .filter((i): i is NonNullable<typeof i> => i != null);

  if (items.length === 0) {
    return { ok: false, error: 'Abrechnungspositionen nicht gefunden.' };
  }

  const notReady = items.find((i) => i.status !== 'ready');
  if (notReady) {
    return {
      ok: false,
      error: `Position ${notReady.id} ist nicht abrechnungsbereit (Status: ${notReady.status}).`,
    };
  }

  const withoutProof = items.find((i) => !i.serviceProofId);
  if (withoutProof) {
    return { ok: false, error: 'Abrechnung ohne Leistungsnachweis blockiert.' };
  }

  const recipientProfiles = listBillingRecipientProfiles(input.tenantId, input.clientId);
  const costCarriers = listCostCarrierProfiles(input.tenantId, input.clientId);
  const hasSelfPayer = items.some((i) => i.selfPayerAmountCents > 0);
  const recipientResolution = resolveBillingRecipient(recipientProfiles, costCarriers, {
    billingType: hasSelfPayer ? 'kombi' : 'pflegekasse',
    hasSelfPayerPortion: hasSelfPayer,
  });

  const recipientError = validateRecipientForBilling(recipientResolution);
  if (recipientError) {
    return { ok: false, error: recipientError };
  }

  const profile = recipientResolution.profile!;
  const primaryCarrier = costCarriers.find((c) => c.isPrimary) ?? costCarriers[0] ?? null;
  const taxMode = items[0].taxMode;

  const lineItemsForTax = items.map((item) => ({
    id: item.id,
    description: item.description,
    quantity: item.billableMinutes / 60,
    unit: 'Std.',
    unitPriceNetCents: item.hourlyRateNetCents,
    taxRatePercent: 0,
  }));

  const taxResult = calculateInvoiceTax({ taxMode, lineItems: lineItemsForTax });

  const validation = createCareBillingValidationReport({
    tenantId: input.tenantId,
    clientId: input.clientId,
    careGrade: items[0].careGrade,
    hasServiceProof: true,
    serviceProofApproved: true,
    serviceAreaKey: items[0].serviceAreaKey,
    servicePeriodFrom: input.servicePeriodFrom,
    servicePeriodTo: input.servicePeriodTo,
    hourlyRateNetCents: items[0].hourlyRateNetCents,
    costCarrierProfileId: primaryCarrier?.id ?? null,
    isSelfPayer: hasSelfPayer,
    recipientType: recipientResolution.recipientType,
    recipientResolved: true,
    amountCents: taxResult.netTotalCents,
    taxMode,
    taxConsistent: true,
  });

  if (!validation.passed) {
    return { ok: false, error: validation.blockedReason ?? 'Validierung fehlgeschlagen.' };
  }

  const draft: InvoiceDraft = {
    id: newDraftId(),
    tenantId: input.tenantId,
    clientId: input.clientId,
    draftNumber: null,
    status: 'validated',
    taxMode,
    servicePeriodFrom: input.servicePeriodFrom,
    servicePeriodTo: input.servicePeriodTo,
    recipientType: recipientResolution.recipientType,
    recipientName: profile.fullName,
    recipientStreet: profile.street,
    recipientZip: profile.zip,
    recipientCity: profile.city,
    costCarrierName: primaryCarrier?.name ?? null,
    costCarrierIk: primaryCarrier?.ikNumber ?? null,
    netTotalCents: taxResult.netTotalCents,
    taxTotalCents: taxResult.taxTotalCents,
    grossTotalCents: taxResult.grossTotalCents,
    taxNotice: taxResult.taxNotice,
    validationRunId: validation.validationRunId,
    finalizedInvoiceId: null,
    previewConfirmed: input.previewConfirmed ?? false,
    notes: null,
    createdAt: now,
    updatedAt: now,
  };

  saveInvoiceDraft(input.tenantId, draft);

  for (const [idx, item] of items.entries()) {
    const taxLine = taxResult.lineItems[idx];
    const draftItem: InvoiceDraftItem = {
      id: newDraftItemId(),
      tenantId: input.tenantId,
      invoiceDraftId: draft.id,
      billableItemId: item.id,
      description: item.description,
      quantity: item.billableMinutes / 60,
      unit: 'Std.',
      unitPriceNetCents: item.hourlyRateNetCents,
      netTotalCents: taxLine?.netTotalCents ?? item.netAmountCents,
      taxRatePercent: taxLine?.taxRatePercent ?? 0,
      taxTotalCents: taxLine?.taxTotalCents ?? item.taxAmountCents,
      grossTotalCents: taxLine?.grossTotalCents ?? item.grossAmountCents,
      budgetType: item.budgetType,
      selfPayerAmountCents: item.selfPayerAmountCents,
      createdAt: now,
      updatedAt: now,
    };
    saveInvoiceDraftItem(input.tenantId, draftItem);

    saveBillableItem(input.tenantId, {
      ...item,
      status: 'included_in_invoice_draft',
      invoiceDraftId: draft.id,
      updatedAt: now,
    });
  }

  appendCareBillingAudit({
    id: `cb-audit-draft-${draft.id}`,
    tenantId: input.tenantId,
    action: 'care_billing.invoice_draft_created',
    entityType: 'invoice_drafts',
    entityId: draft.id,
    summary: `Rechnungsentwurf mit ${items.length} Position(en) erstellt.`,
    createdAt: now,
  });

  return { ok: true, draft };
}

export function finalizeCareInvoiceDraft(
  tenantId: string,
  draftId: string,
): FinalizeInvoiceDraftResult {
  const draft = getInvoiceDraft(tenantId, draftId);
  if (!draft) {
    return {
      ok: false,
      invoiceDraftId: draftId,
      blockedReason: 'Rechnungsentwurf nicht gefunden.',
      validationRunId: null,
    };
  }

  if (draft.status === 'finalized') {
    return {
      ok: false,
      invoiceDraftId: draftId,
      blockedReason: 'Rechnungsentwurf bereits finalisiert.',
      validationRunId: draft.validationRunId,
    };
  }

  const items = listInvoiceDraftItems(tenantId, draftId);
  if (items.length === 0) {
    return {
      ok: false,
      invoiceDraftId: draftId,
      blockedReason: 'Keine Positionen im Entwurf.',
      validationRunId: draft.validationRunId,
    };
  }

  if (!draft.recipientName?.trim()) {
    return {
      ok: false,
      invoiceDraftId: draftId,
      blockedReason: 'Rechnungsempfänger fehlt.',
      validationRunId: draft.validationRunId,
    };
  }

  if (!draft.servicePeriodFrom || !draft.servicePeriodTo) {
    return {
      ok: false,
      invoiceDraftId: draftId,
      blockedReason: 'Leistungszeitraum fehlt.',
      validationRunId: draft.validationRunId,
    };
  }

  if (!draft.previewConfirmed) {
    return {
      ok: false,
      invoiceDraftId: draftId,
      blockedReason: 'Vorschau muss bestätigt sein.',
      validationRunId: draft.validationRunId,
    };
  }

  const now = new Date().toISOString();
  saveInvoiceDraft(tenantId, {
    ...draft,
    status: 'finalized',
    draftNumber: draft.draftNumber ?? `ENT-${draft.id.slice(-8).toUpperCase()}`,
    updatedAt: now,
  });

  appendCareBillingAudit({
    id: `cb-audit-finalize-${draftId}`,
    tenantId,
    action: 'care_billing.invoice_draft_finalized',
    entityType: 'invoice_drafts',
    entityId: draftId,
    summary: 'Rechnungsentwurf finalisiert (Vorbereitung — kein Kassenversand).',
    createdAt: now,
  });

  return {
    ok: true,
    invoiceDraftId: draftId,
    blockedReason: null,
    validationRunId: draft.validationRunId,
  };
}
