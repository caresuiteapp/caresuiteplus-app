import type { BillableItem, ServiceProofBillingInput } from '@/types/careBilling';
import { isCareServiceAreaPreparedOnly } from '@/types/careBilling';
import { isDemoMode } from '@/lib/supabase/config';
import {
  allocateBudgetForAmount,
  parseCareGrade,
} from './budgetAllocationService';
import {
  appendCareBillingAudit,
  listBillableItems,
  listBillingRecipientProfiles,
  listBudgetPeriods,
  listCostCarrierProfiles,
  saveBillableItem,
} from './careBillingStore';
import { resolveBillingRecipient, validateRecipientForBilling } from './billingRecipientService';
import { createCareBillingValidationReport } from './careBillingValidationService';
import { calculateCareBillingTax } from './careBillingTaxService';
import {
  assertServiceRateAvailable,
  calculateAmountFromRate,
  resolveTaxModeForService,
  roundBillableMinutes,
} from './serviceRateService';

function newBillableItemId(): string {
  return `bi-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const APPROVED_PROOF_STATUSES = new Set(['signed', 'finalized']);

export function createBillableItemFromServiceProof(
  input: ServiceProofBillingInput,
): { ok: true; item: BillableItem } | { ok: false; error: string; item?: BillableItem } {
  const now = new Date().toISOString();

  if (!input.clientId?.trim()) {
    return { ok: false, error: 'Klient fehlt.' };
  }

  if (!input.serviceProofId?.trim()) {
    return { ok: false, error: 'Leistungsnachweis fehlt — keine Abrechnungsposition.' };
  }

  if (!APPROVED_PROOF_STATUSES.has(input.proofStatus)) {
    return { ok: false, error: 'Leistungsnachweis ist nicht freigegeben.' };
  }

  if (isCareServiceAreaPreparedOnly(input.serviceAreaKey)) {
    return {
      ok: false,
      error: `Leistungsart „${input.serviceAreaKey}" ist nur vorbereitet.`,
    };
  }

  const rateResult = assertServiceRateAvailable(
    input.tenantId,
    input.serviceAreaKey,
    input.servicePeriodFrom,
  );
  if (!rateResult.ok) {
    return { ok: false, error: rateResult.error };
  }

  const rate = rateResult.rate;
  const billableMinutes = roundBillableMinutes(input.durationMinutes, rate);
  const netAmountCents = calculateAmountFromRate(billableMinutes, rate.hourlyRateNetCents);
  const careGrade = parseCareGrade(input.careGrade);

  const budgets = listBudgetPeriods(input.tenantId, input.clientId);
  const allocation = allocateBudgetForAmount(
    input.tenantId,
    budgets,
    netAmountCents,
    careGrade,
  );

  const primaryBudget = allocation.allocations[0] ?? null;
  const isSelfPayer = allocation.selfPayerAmountCents > 0 || input.serviceAreaKey === 'selbstzahlerleistungen';
  const taxMode = resolveTaxModeForService(input.tenantId, input.serviceAreaKey, isSelfPayer);
  const tax = calculateCareBillingTax(
    taxMode,
    netAmountCents,
    input.description ?? input.serviceAreaKey,
  );

  const recipientProfiles = listBillingRecipientProfiles(input.tenantId, input.clientId);
  const costCarriers = listCostCarrierProfiles(input.tenantId, input.clientId);
  const recipientResolution = resolveBillingRecipient(recipientProfiles, costCarriers, {
    billingType: isSelfPayer ? 'selbstzahler' : 'pflegekasse',
    preferredRecipientId: input.billingRecipientProfileId,
    hasSelfPayerPortion: allocation.selfPayerAmountCents > 0,
  });

  const totalBudgetAvailable = budgets.reduce(
    (sum, b) => sum + Math.max(0, b.totalAmountCents - b.usedAmountCents - b.reservedAmountCents),
    0,
  );

  const validation = createCareBillingValidationReport({
    tenantId: input.tenantId,
    clientId: input.clientId,
    careGrade: input.careGrade,
    hasServiceProof: true,
    serviceProofApproved: true,
    serviceAreaKey: input.serviceAreaKey,
    servicePeriodFrom: input.servicePeriodFrom,
    servicePeriodTo: input.servicePeriodTo,
    hourlyRateNetCents: rate.hourlyRateNetCents,
    costCarrierProfileId: input.costCarrierProfileId ?? costCarriers[0]?.id ?? null,
    isSelfPayer,
    recipientType: recipientResolution.recipientType,
    recipientResolved: recipientResolution.resolved,
    budgetAvailableCents: totalBudgetAvailable,
    amountCents: netAmountCents,
    selfPayerAmountCents: allocation.selfPayerAmountCents,
    budgetType: primaryBudget?.budgetType ?? null,
    taxMode,
    taxConsistent: tax.taxConsistent,
  });

  const recipientError = validateRecipientForBilling(recipientResolution);
  const missingData =
    !validation.passed ||
    recipientError != null ||
    (!input.costCarrierProfileId && !isSelfPayer && costCarriers.length === 0);

  let status: BillableItem['status'] = 'ready';
  if (!validation.passed) {
    status = 'missing_data';
  } else if (recipientError) {
    status = 'missing_data';
  }

  const item: BillableItem = {
    id: newBillableItemId(),
    tenantId: input.tenantId,
    clientId: input.clientId,
    serviceProofId: input.serviceProofId,
    serviceRecordId: input.serviceRecordId ?? null,
    serviceAreaKey: input.serviceAreaKey,
    servicePeriodFrom: input.servicePeriodFrom,
    servicePeriodTo: input.servicePeriodTo,
    durationMinutes: input.durationMinutes,
    billableMinutes,
    hourlyRateNetCents: rate.hourlyRateNetCents,
    netAmountCents,
    taxMode,
    taxAmountCents: tax.taxAmountCents,
    grossAmountCents: tax.grossAmountCents,
    budgetType: primaryBudget?.budgetType ?? (isSelfPayer ? 'selbstzahler' : null),
    budgetPeriodId: primaryBudget?.budgetPeriodId ?? null,
    selfPayerAmountCents: allocation.selfPayerAmountCents,
    costCarrierProfileId: input.costCarrierProfileId ?? costCarriers[0]?.id ?? null,
    billingRecipientProfileId: recipientResolution.profile?.id ?? null,
    invoiceDraftId: null,
    invoiceId: null,
    status,
    validationRunId: validation.validationRunId,
    description: input.description ?? `${input.serviceAreaKey} ${input.servicePeriodFrom}`,
    careGrade: input.careGrade,
    createdAt: now,
    updatedAt: now,
  };

  saveBillableItem(input.tenantId, item);

  appendCareBillingAudit({
    id: `cb-audit-bi-${item.id}`,
    tenantId: input.tenantId,
    action: 'care_billing.billable_item_created',
    entityType: 'billable_items',
    entityId: item.id,
    summary: missingData
      ? `Abrechnungsposition erstellt — Status: ${status}`
      : `Abrechnungsposition bereit (${(netAmountCents / 100).toFixed(2)} EUR netto)`,
    createdAt: now,
  });

  if (missingData && !isDemoMode()) {
    return {
      ok: false,
      error: validation.blockedReason ?? recipientError ?? 'Pflichtdaten fehlen.',
      item,
    };
  }

  if (!validation.passed) {
    return { ok: false, error: validation.blockedReason ?? 'Validierung fehlgeschlagen.', item };
  }

  return { ok: true, item };
}

export function getBillableItemsReadyForBilling(
  tenantId: string,
  clientId?: string,
): BillableItem[] {
  return listBillableItems(tenantId, clientId).filter((i) => i.status === 'ready');
}
