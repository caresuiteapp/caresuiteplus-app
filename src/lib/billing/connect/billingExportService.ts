import type { ServiceResult } from '@/types';
import type {
  BillingExportBatch,
  BillingExportItem,
  ConnectBillingMode,
  ConnectBillingProviderKey,
} from '@/types/connect/billing';
import { runService } from '@/lib/services/serviceRunner';
import { getBillingModeDefinition } from './billingModes';
import {
  canMarkExportAsSubmitted,
  isProviderConfiguredForExport,
} from './billingProviders';
import type { BillingValidationReport } from '@/types/connect/billing';
import {
  appendBillingAudit,
  listExportBatches,
  listProviderConfigs,
  saveExportBatch,
  saveExportItems,
} from './connectBillingStore';

export type CreateExportPackageInput = {
  tenantId: string;
  billingMode: ConnectBillingMode;
  providerKey?: ConnectBillingProviderKey | null;
  validationReport: BillingValidationReport;
  clientId?: string | null;
  invoiceId?: string | null;
  preparedBy?: string | null;
};

function newBatchNumber(): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `EXP-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export function createExportPackage(input: CreateExportPackageInput): ServiceResult<{
  batch: BillingExportBatch;
  items: BillingExportItem[];
}> {
  const { tenantId, billingMode, validationReport } = input;
  if (!validationReport.passed) {
    return {
      ok: false,
      error: validationReport.blockedReason ?? 'Export blockiert — Validierung fehlgeschlagen.',
    };
  }

  const modeDef = getBillingModeDefinition(billingMode);
  if (modeDef.key === 'direktabrechnung_spaeter') {
    return {
      ok: false,
      error: 'Direktabrechnung an Pflegekassen ist derzeit nicht freigeschaltet.',
    };
  }

  const providerKey = input.providerKey ?? null;
  const providerConfig = providerKey
    ? listProviderConfigs(tenantId).find((entry) => entry.providerKey === providerKey) ?? null
    : null;

  if (modeDef.requiresBillingCenter && !isProviderConfiguredForExport(providerConfig)) {
    return {
      ok: false,
      error: 'Abrechnungszentrum ist nicht konfiguriert — Export nur als Vorbereitung möglich.',
    };
  }

  const now = new Date().toISOString();
  const batchId = `batch-${Date.now()}`;
  const batch: BillingExportBatch = {
    id: batchId,
    tenantId,
    batchNumber: newBatchNumber(),
    billingMode,
    providerKey,
    status: 'prepared',
    exportFormat: modeDef.allowsDtaPreparation ? 'preparation_package_with_dta_stub' : 'preparation_package',
    itemCount: 0,
    preparedAt: now,
    preparedBy: input.preparedBy ?? null,
    submittedAt: null,
    notes: 'Vorbereitung — kein produktiver DTA-Versand. Nicht als eingereicht markiert.',
    createdAt: now,
    updatedAt: now,
  };

  const items: BillingExportItem[] = [];
  if (input.clientId || input.invoiceId) {
    items.push({
      id: `${batchId}-ln-1`,
      tenantId,
      batchId,
      clientId: input.clientId ?? null,
      invoiceId: input.invoiceId ?? null,
      itemType: 'leistungsnachweis',
      payloadReference: `preparation://${batch.batchNumber}/leistungsnachweis`,
      status: 'prepared',
      createdAt: now,
      updatedAt: now,
    });
  }

  if (modeDef.allowsDtaPreparation) {
    items.push({
      id: `${batchId}-dta-1`,
      tenantId,
      batchId,
      clientId: input.clientId ?? null,
      invoiceId: input.invoiceId ?? null,
      itemType: 'dta_vorbereitung',
      payloadReference: `preparation://${batch.batchNumber}/dta_stub_unvalidated`,
      status: 'prepared',
      createdAt: now,
      updatedAt: now,
    });
  }

  batch.itemCount = items.length;
  saveExportBatch(tenantId, batch);
  saveExportItems(tenantId, items);

  appendBillingAudit({
    id: `audit-${batch.id}`,
    tenantId,
    action: 'billing.export_package_created',
    entityType: 'billing_export_batches',
    entityId: batch.id,
    summary: `Exportpaket ${batch.batchNumber} vorbereitet (${items.length} Positionen).`,
    createdAt: now,
  });

  return { ok: true, data: { batch, items } };
}

export async function createExportPackageAsync(
  input: CreateExportPackageInput,
): Promise<ServiceResult<{ batch: BillingExportBatch; items: BillingExportItem[] }>> {
  return runService(async () => createExportPackage(input), { delayMs: 150 });
}

export function markExportAsSubmitted(
  tenantId: string,
  batchId: string,
): ServiceResult<BillingExportBatch> {
  const batch = listExportBatches(tenantId).find((entry) => entry.id === batchId);
  if (!batch) {
    return { ok: false, error: 'Exportpaket nicht gefunden.' };
  }

  const providerConfig = batch.providerKey
    ? listProviderConfigs(tenantId).find((entry) => entry.providerKey === batch.providerKey) ?? null
    : null;

  if (!canMarkExportAsSubmitted(providerConfig)) {
    return {
      ok: false,
      error: 'Einreichung blockiert — kein konfigurierter Abrechnungsanbieter. Export bleibt vorbereitet.',
    };
  }

  return { ok: false, error: 'Produktive Einreichung ist derzeit nicht freigeschaltet.' };
}

export function listTenantExportBatches(tenantId: string): BillingExportBatch[] {
  return listExportBatches(tenantId);
}
