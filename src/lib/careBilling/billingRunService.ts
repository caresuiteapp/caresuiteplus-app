import type {
  BillingRun,
  BillingRunItem,
  FinalizeRunInvoicesInput,
  FinalizeRunInvoicesResult,
  GenerateDraftsFromRunResult,
  PrepareBillingRunInput,
  PrepareBillingRunResult,
} from '@/types/careBilling/billingCycle';
import type { BillableItem } from '@/types/careBilling';
import {
  getBillableItem,
  getInvoiceDraft,
  listBillableItems,
  listInvoiceDraftItems,
  saveBillableItem,
  saveInvoiceDraft,
} from './careBillingStore';
import {
  appendBillingAuditEvent,
  getBillingRun,
  listBillingRunItems,
  listBillingRuns,
  nextBillingCycleId,
  saveBillingRun,
  saveBillingRunItem,
} from './billingCycleStore';
import { assertBillingCycleProductionReady, assertSameTenant } from './billingCycleGuard';
import { createCareInvoiceDraft } from './invoiceDraftService';
import { getBillableItemsReadyForBilling } from './billableItemService';
import { createReceivableFromInvoice } from './receivableService';
import { createCareBillingInvoiceFromDraft } from './careBillingInvoiceService';

const ALREADY_BILLED_STATUSES = new Set(['included_in_invoice_draft', 'invoiced']);

function monthTitle(billingMonth: string): string {
  const [year, month] = billingMonth.split('-');
  const monthNames = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
  ];
  const idx = Number(month) - 1;
  return `Monatsabschluss ${monthNames[idx] ?? billingMonth} ${year}`;
}

function filterItemsForMonth(items: BillableItem[], billingMonth: string): BillableItem[] {
  return items.filter((item) => {
    const from = item.servicePeriodFrom.slice(0, 7);
    const to = item.servicePeriodTo.slice(0, 7);
    return from <= billingMonth && to >= billingMonth;
  });
}

function groupByClient(items: BillableItem[]): Map<string, BillableItem[]> {
  const map = new Map<string, BillableItem[]>();
  for (const item of items) {
    const list = map.get(item.clientId) ?? [];
    list.push(item);
    map.set(item.clientId, list);
  }
  return map;
}

export function prepareBillingRun(input: PrepareBillingRunInput): PrepareBillingRunResult {
  const prodGuard = assertBillingCycleProductionReady();
  if (!prodGuard.allowed) {
    return { ok: false, billingRunId: null, itemCount: 0, blockedReason: prodGuard.reason };
  }

  if (!input.billingMonth?.match(/^\d{4}-\d{2}$/)) {
    return { ok: false, billingRunId: null, itemCount: 0, blockedReason: 'Abrechnungsmonat ungültig (YYYY-MM).' };
  }

  const existing = listBillingRuns(input.tenantId).find(
    (r) => r.billingMonth === input.billingMonth && r.status !== 'cancelled',
  );
  if (existing) {
    return {
      ok: false,
      billingRunId: existing.id,
      itemCount: 0,
      blockedReason: `Monatsabschluss für ${input.billingMonth} existiert bereits.`,
    };
  }

  const readyItems = filterItemsForMonth(
    getBillableItemsReadyForBilling(input.tenantId),
    input.billingMonth,
  );

  if (readyItems.length === 0) {
    return {
      ok: false,
      billingRunId: null,
      itemCount: 0,
      blockedReason: 'Keine abrechnungsbereiten Positionen für den Monat.',
    };
  }

  const now = new Date().toISOString();
  const runId = nextBillingCycleId('brun');
  const run: BillingRun = {
    id: runId,
    tenantId: input.tenantId,
    billingMonth: input.billingMonth,
    title: input.title ?? monthTitle(input.billingMonth),
    status: 'prepared',
    preparedAt: now,
    preparedBy: input.preparedBy ?? null,
    checkedAt: null,
    checkedBy: null,
    completedAt: null,
    completedBy: null,
    serviceRecordsCount: readyItems.length,
    invoicesCount: 0,
    totalAmountCents: readyItems.reduce((sum, i) => sum + i.grossAmountCents, 0),
    notes: null,
    createdAt: now,
    updatedAt: now,
  };

  saveBillingRun(input.tenantId, run);

  for (const item of readyItems) {
    const runItem: BillingRunItem = {
      id: nextBillingCycleId('bri'),
      tenantId: input.tenantId,
      billingRunId: runId,
      billableItemId: item.id,
      clientId: item.clientId,
      status: 'pending',
      invoiceDraftId: null,
      invoiceId: null,
      blockedReason: null,
      createdAt: now,
      updatedAt: now,
    };
    saveBillingRunItem(input.tenantId, runItem);
  }

  appendBillingAuditEvent({
    tenantId: input.tenantId,
    action: 'billing_cycle.run_prepared',
    entityType: 'billing_runs',
    entityId: runId,
    summary: `${run.title}: ${readyItems.length} Position(en) vorbereitet.`,
    actorId: input.preparedBy ?? null,
  });

  return { ok: true, billingRunId: runId, itemCount: readyItems.length, blockedReason: null };
}

export function generateInvoiceDraftsFromRun(
  tenantId: string,
  billingRunId: string,
): GenerateDraftsFromRunResult {
  const prodGuard = assertBillingCycleProductionReady();
  if (!prodGuard.allowed) {
    return { ok: false, billingRunId, draftsCreated: 0, blockedCount: 0, blockedReason: prodGuard.reason };
  }

  const run = getBillingRun(tenantId, billingRunId);
  if (!run) {
    return { ok: false, billingRunId, draftsCreated: 0, blockedCount: 0, blockedReason: 'Rechnungslauf nicht gefunden.' };
  }

  const tenantCheck = assertSameTenant(tenantId, run.tenantId, 'Rechnungslauf');
  if (!tenantCheck.allowed) {
    return { ok: false, billingRunId, draftsCreated: 0, blockedCount: 0, blockedReason: tenantCheck.reason };
  }

  if (run.status === 'completed' || run.status === 'cancelled') {
    return {
      ok: false,
      billingRunId,
      draftsCreated: 0,
      blockedCount: 0,
      blockedReason: `Rechnungslauf ist ${run.status}.`,
    };
  }

  const runItems = listBillingRunItems(tenantId, billingRunId).filter((i) => i.status === 'pending');
  const billableItems: BillableItem[] = [];

  let blockedCount = 0;
  const now = new Date().toISOString();

  for (const runItem of runItems) {
    const billable = getBillableItem(tenantId, runItem.billableItemId);
    if (!billable) {
      saveBillingRunItem(tenantId, {
        ...runItem,
        status: 'blocked',
        blockedReason: 'Abrechnungsposition nicht gefunden.',
        updatedAt: now,
      });
      blockedCount += 1;
      continue;
    }

    if (ALREADY_BILLED_STATUSES.has(billable.status)) {
      saveBillingRunItem(tenantId, {
        ...runItem,
        status: 'blocked',
        blockedReason: 'Doppelabrechnung blockiert — Position bereits verarbeitet.',
        updatedAt: now,
      });
      blockedCount += 1;
      continue;
    }

    if (billable.status !== 'ready') {
      saveBillingRunItem(tenantId, {
        ...runItem,
        status: 'blocked',
        blockedReason: `Position nicht abrechnungsbereit (Status: ${billable.status}).`,
        updatedAt: now,
      });
      blockedCount += 1;
      continue;
    }

    billableItems.push(billable);
  }

  const byClient = groupByClient(billableItems);
  let draftsCreated = 0;

  for (const [clientId, clientItems] of byClient) {
    const periodFrom = clientItems.reduce(
      (min, i) => (i.servicePeriodFrom < min ? i.servicePeriodFrom : min),
      clientItems[0].servicePeriodFrom,
    );
    const periodTo = clientItems.reduce(
      (max, i) => (i.servicePeriodTo > max ? i.servicePeriodTo : max),
      clientItems[0].servicePeriodTo,
    );

    const draftResult = createCareInvoiceDraft({
      tenantId,
      clientId,
      billableItemIds: clientItems.map((i) => i.id),
      servicePeriodFrom: periodFrom,
      servicePeriodTo: periodTo,
    });

    if (!draftResult.ok) {
      for (const item of clientItems) {
        const runItem = runItems.find((ri) => ri.billableItemId === item.id);
        if (runItem) {
          saveBillingRunItem(tenantId, {
            ...runItem,
            status: 'blocked',
            blockedReason: draftResult.error,
            updatedAt: now,
          });
          blockedCount += 1;
        }
      }
      continue;
    }

    draftsCreated += 1;

    for (const item of clientItems) {
      const runItem = runItems.find((ri) => ri.billableItemId === item.id);
      if (runItem) {
        saveBillingRunItem(tenantId, {
          ...runItem,
          status: 'draft_created',
          invoiceDraftId: draftResult.draft.id,
          updatedAt: now,
        });
      }
    }
  }

  saveBillingRun(tenantId, {
    ...run,
    status: 'checked',
    checkedAt: now,
    invoicesCount: draftsCreated,
    updatedAt: now,
  });

  appendBillingAuditEvent({
    tenantId,
    action: 'billing_cycle.drafts_generated',
    entityType: 'billing_runs',
    entityId: billingRunId,
    summary: `${draftsCreated} Rechnungsentwurf/entwürfe erstellt, ${blockedCount} blockiert.`,
    actorId: null,
  });

  return {
    ok: draftsCreated > 0,
    billingRunId,
    draftsCreated,
    blockedCount,
    blockedReason: draftsCreated === 0 ? 'Kein Rechnungsentwurf erstellt.' : null,
  };
}

export function finalizeBillingRunInvoices(
  input: FinalizeRunInvoicesInput,
): FinalizeRunInvoicesResult {
  const prodGuard = assertBillingCycleProductionReady();
  if (!prodGuard.allowed) {
    return {
      ok: false,
      billingRunId: input.billingRunId,
      invoicesFinalized: 0,
      receivablesCreated: 0,
      blockedReason: prodGuard.reason,
    };
  }

  if (!input.previewConfirmed) {
    return {
      ok: false,
      billingRunId: input.billingRunId,
      invoicesFinalized: 0,
      receivablesCreated: 0,
      blockedReason: 'PDF-Vorschau muss bestätigt sein.',
    };
  }

  const run = getBillingRun(input.tenantId, input.billingRunId);
  if (!run) {
    return {
      ok: false,
      billingRunId: input.billingRunId,
      invoicesFinalized: 0,
      receivablesCreated: 0,
      blockedReason: 'Rechnungslauf nicht gefunden.',
    };
  }

  const draftItems = listBillingRunItems(input.tenantId, input.billingRunId).filter(
    (i) => i.status === 'draft_created' && i.invoiceDraftId,
  );

  const draftIds = [...new Set(draftItems.map((i) => i.invoiceDraftId!).filter(Boolean))];
  if (draftIds.length === 0) {
    return {
      ok: false,
      billingRunId: input.billingRunId,
      invoicesFinalized: 0,
      receivablesCreated: 0,
      blockedReason: 'Keine Rechnungsentwürfe im Lauf.',
    };
  }

  const now = new Date().toISOString();
  let invoicesFinalized = 0;
  let receivablesCreated = 0;

  for (const draftId of draftIds) {
    const draft = getInvoiceDraft(input.tenantId, draftId);
    if (!draft) continue;

    if (draft.status !== 'validated' && draft.status !== 'draft') {
      continue;
    }

    saveInvoiceDraft(input.tenantId, { ...draft, previewConfirmed: true, updatedAt: now });

    const invoiceResult = createCareBillingInvoiceFromDraft({
      tenantId: input.tenantId,
      invoiceDraftId: draftId,
      billingRunId: input.billingRunId,
      previewConfirmed: input.previewConfirmed,
    });

    if (!invoiceResult.ok) {
      appendBillingAuditEvent({
        tenantId: input.tenantId,
        action: 'billing_cycle.invoice_finalize_blocked',
        entityType: 'invoice_drafts',
        entityId: draftId,
        summary: invoiceResult.error,
        actorId: input.actorId ?? null,
      });
      continue;
    }

    invoicesFinalized += 1;

    const receivableResult = createReceivableFromInvoice(input.tenantId, invoiceResult.invoice.id);
    if (receivableResult.ok) receivablesCreated += 1;

    const draftLineItems = listInvoiceDraftItems(input.tenantId, draftId);
    for (const line of draftLineItems) {
      const billable = getBillableItem(input.tenantId, line.billableItemId);
      if (billable) {
        saveBillableItem(input.tenantId, {
          ...billable,
          status: 'invoiced',
          invoiceId: invoiceResult.invoice.id,
          updatedAt: now,
        });
      }

      const runItem = draftItems.find((ri) => ri.billableItemId === line.billableItemId);
      if (runItem) {
        saveBillingRunItem(input.tenantId, {
          ...runItem,
          status: 'invoiced',
          invoiceId: invoiceResult.invoice.id,
          updatedAt: now,
        });
      }
    }
  }

  if (invoicesFinalized === 0) {
    return {
      ok: false,
      billingRunId: input.billingRunId,
      invoicesFinalized: 0,
      receivablesCreated: 0,
      blockedReason: 'Keine Rechnung finalisiert — Validierung fehlgeschlagen.',
    };
  }

  saveBillingRun(input.tenantId, {
    ...run,
    status: 'completed',
    completedAt: now,
    completedBy: input.actorId ?? null,
    invoicesCount: invoicesFinalized,
    updatedAt: now,
  });

  appendBillingAuditEvent({
    tenantId: input.tenantId,
    action: 'billing_cycle.run_completed',
    entityType: 'billing_runs',
    entityId: input.billingRunId,
    summary: `${invoicesFinalized} Rechnung(en) finalisiert, ${receivablesCreated} Forderung(en) angelegt.`,
    actorId: input.actorId ?? null,
  });

  return {
    ok: true,
    billingRunId: input.billingRunId,
    invoicesFinalized,
    receivablesCreated,
    blockedReason: null,
  };
}

export { listBillingRuns, getBillingRun, listBillingRunItems };

/** Prüft ob Position bereits in anderem Lauf enthalten ist (Doppelabrechnung). */
export function isBillableItemAlreadyInRun(tenantId: string, billableItemId: string): boolean {
  const item = getBillableItem(tenantId, billableItemId);
  if (!item) return false;
  return ALREADY_BILLED_STATUSES.has(item.status);
}

export function countReadyItemsForMonth(tenantId: string, billingMonth: string): number {
  return filterItemsForMonth(getBillableItemsReadyForBilling(tenantId), billingMonth).length;
}

export function listBillableItemsInRun(tenantId: string, billingRunId: string): BillableItem[] {
  return listBillingRunItems(tenantId, billingRunId)
    .map((ri) => getBillableItem(tenantId, ri.billableItemId))
    .filter((i): i is BillableItem => i != null);
}
