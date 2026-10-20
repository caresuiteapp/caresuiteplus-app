import type { ServiceResult } from '@/types';
import type { GkvExportBatch, GkvExportItem, GkvValidationReport } from '@/types/gkvBilling';
import type { GkvBillingMode } from '@/types/gkvBilling';
import {
  appendGkvBillingAudit,
  listGkvExportBatches,
  readGkvBillingProfile,
  saveGkvExportBatch,
  saveGkvExportItems,
  updateGkvExportBatch,
} from './gkvBillingStore';
import { assertDtaNotProductionBillable } from './gkvProductionGuard';

export type BundleGkvServiceRecordsInput = {
  tenantId: string;
  billableItemIds: string[];
  clientId?: string | null;
  invoiceId?: string | null;
};

export function bundleGkvServiceRecords(input: BundleGkvServiceRecordsInput): ServiceResult<{
  billableItemIds: string[];
  itemCount: number;
}> {
  if (input.billableItemIds.length === 0) {
    return { ok: false, error: 'Keine Abrechnungspositionen zum Bündeln vorhanden.' };
  }
  return {
    ok: true,
    data: { billableItemIds: input.billableItemIds, itemCount: input.billableItemIds.length },
  };
}

export type CreateGkvExportBatchInput = {
  tenantId: string;
  billingMode: GkvBillingMode;
  validationReport: GkvValidationReport;
  billableItemIds?: string[];
  clientId?: string | null;
  invoiceId?: string | null;
  preparedBy?: string | null;
};

function newBatchNumber(): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `GKV-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export function prepareGkvExport(input: CreateGkvExportBatchInput): ServiceResult<{
  batch: GkvExportBatch;
  items: GkvExportItem[];
}> {
  const { tenantId, billingMode, validationReport } = input;

  if (!validationReport.passed) {
    return {
      ok: false,
      error: validationReport.blockedReason ?? 'Export blockiert — Validierung fehlgeschlagen.',
    };
  }

  if (billingMode === 'direktabrechnung_spaeter') {
    return {
      ok: false,
      error: 'Direktabrechnung an Pflegekassen ist derzeit nicht freigeschaltet.',
    };
  }

  const profile = readGkvBillingProfile(tenantId);
  const includesDta = billingMode === 'dta_vorbereitung' || billingMode === 'abrechnungszentrum_export';
  const dtaValidated = false;

  if (includesDta) {
    const dtaGuard = assertDtaNotProductionBillable(dtaValidated);
    if (!dtaGuard.allowed) {
      // Export als Vorbereitung erlaubt, aber DTA explizit nicht validiert markiert
    }
  }

  const now = new Date().toISOString();
  const batchId = `gkv-batch-${Date.now()}`;
  const batch: GkvExportBatch = {
    id: batchId,
    tenantId,
    batchNumber: newBatchNumber(),
    billingMode,
    statutorySector: profile?.statutorySector ?? null,
    status: includesDta ? 'export_ready' : 'validation_passed',
    exportFormat: includesDta ? 'dta_preparation_unvalidated' : 'leistungsnachweise_package',
    itemCount: 0,
    dtaValidated: false,
    preparedAt: now,
    preparedBy: input.preparedBy ?? null,
    exportedAt: null,
    notes: includesDta
      ? 'DTA-Vorbereitung — Datei ist nicht validiert und nicht produktiv abrechenbar.'
      : 'Exportpaket vorbereitet — kein produktiver Versand.',
    createdAt: now,
    updatedAt: now,
  };

  const items: GkvExportItem[] = [];
  const billableIds = input.billableItemIds ?? [];

  for (let i = 0; i < billableIds.length; i++) {
    items.push({
      id: `${batchId}-item-${i + 1}`,
      tenantId,
      batchId,
      clientId: input.clientId ?? null,
      billableItemId: billableIds[i],
      invoiceId: input.invoiceId ?? null,
      itemType: 'leistungsnachweis',
      payloadReference: `preparation://${batch.batchNumber}/leistungsnachweis/${billableIds[i]}`,
      status: 'prepared',
      createdAt: now,
      updatedAt: now,
    });
  }

  items.push({
    id: `${batchId}-protocol`,
    tenantId,
    batchId,
    clientId: input.clientId ?? null,
    billableItemId: null,
    invoiceId: input.invoiceId ?? null,
    itemType: 'pruefprotokoll',
    payloadReference: `preparation://${batch.batchNumber}/pruefprotokoll/${validationReport.validationRunId}`,
    status: 'prepared',
    createdAt: now,
    updatedAt: now,
  });

  if (includesDta) {
    items.push({
      id: `${batchId}-dta`,
      tenantId,
      batchId,
      clientId: input.clientId ?? null,
      billableItemId: null,
      invoiceId: input.invoiceId ?? null,
      itemType: 'dta_vorbereitung',
      payloadReference: `preparation://${batch.batchNumber}/dta_stub_unvalidated`,
      status: 'prepared',
      createdAt: now,
      updatedAt: now,
    });
  }

  batch.itemCount = items.length;
  saveGkvExportBatch(tenantId, batch);
  saveGkvExportItems(tenantId, items);

  appendGkvBillingAudit({
    id: `gkv-audit-export-${batch.id}`,
    tenantId,
    action: 'gkv.export_prepared',
    entityType: 'gkv_export_batches',
    entityId: batch.id,
    summary: `GKV-Export ${batch.batchNumber} vorbereitet (${items.length} Positionen, DTA validiert: nein).`,
    createdAt: now,
  });

  return { ok: true, data: { batch, items } };
}

export function markGkvExportAsExported(
  tenantId: string,
  batchId: string,
): ServiceResult<GkvExportBatch> {
  const batch = listGkvExportBatches(tenantId).find((e) => e.id === batchId);
  if (!batch) {
    return { ok: false, error: 'Export-Batch nicht gefunden.' };
  }

  const now = new Date().toISOString();
  const updated: GkvExportBatch = {
    ...batch,
    status: 'exported',
    exportedAt: now,
    notes: `${batch.notes} Status: exportiert (vorbereitet, nicht eingereicht).`,
    updatedAt: now,
  };
  updateGkvExportBatch(tenantId, updated);

  appendGkvBillingAudit({
    id: `gkv-audit-exported-${batchId}`,
    tenantId,
    action: 'gkv.export_marked_exported',
    entityType: 'gkv_export_batches',
    entityId: batchId,
    summary: `Export ${batch.batchNumber} als exportiert markiert (Vorbereitung).`,
    createdAt: now,
  });

  return { ok: true, data: updated };
}
