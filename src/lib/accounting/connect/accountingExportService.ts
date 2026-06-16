import type { ServiceResult } from '@/types';
import type { AccountingProviderKey } from '@/types/accounting';
import type {
  AccountingAuditEvent,
  AccountingAuditEventType,
  AccountingExportBatch,
  AccountingExportBatchItem,
} from '@/types/connect/accounting';
import { guardLiveDemoFeature } from '@/lib/services/liveServiceGuard';
import { isAccountingProviderConfigured } from '../accountingProviderConfigService';
import { resolveExportFormat } from './accountingFormat';
import {
  appendAccountingAuditEvent,
  listExportBatches,
  listExportErrors,
  saveExportBatch,
  saveExportItems,
} from './accountingConnectStore';

function newBatchNumber(): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `BUCH-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function audit(
  tenantId: string,
  eventType: AccountingAuditEventType,
  summary: string,
  extra: Partial<AccountingAuditEvent> = {},
): AccountingAuditEvent {
  return appendAccountingAuditEvent(tenantId, {
    id: newId('audit'),
    tenantId,
    invoiceId: extra.invoiceId ?? null,
    exportId: extra.exportId ?? null,
    importId: extra.importId ?? null,
    eventType,
    summary,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...extra,
  });
}

export type PrepareInvoiceExportInput = {
  tenantId: string;
  invoiceId: string;
  invoiceNumber: string;
  providerKey: AccountingProviderKey;
  preparedBy?: string | null;
};

export function prepareInvoiceExportBatch(
  input: PrepareInvoiceExportInput,
): ServiceResult<{ batch: AccountingExportBatch; items: AccountingExportBatchItem[] }> {
  const liveBlock = guardLiveDemoFeature<{ batch: AccountingExportBatch; items: AccountingExportBatchItem[] }>(
    input.tenantId,
    'Buchhaltungs-Export',
  );
  if (liveBlock) return liveBlock;

  const now = new Date().toISOString();
  const batchId = newId('batch');
  const batch: AccountingExportBatch = {
    id: batchId,
    tenantId: input.tenantId,
    batchNumber: newBatchNumber(),
    providerKey: input.providerKey,
    exportType: 'invoice',
    exportFormat: resolveExportFormat(input.providerKey),
    status: 'prepared',
    externalTransfer: false,
    itemCount: 1,
    errorSummary: null,
    packageLabel: null,
    preparedAt: now,
    preparedBy: input.preparedBy ?? null,
    finishedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  const items: AccountingExportBatchItem[] = [
    {
      id: `${batchId}-item-1`,
      tenantId: input.tenantId,
      batchId,
      invoiceId: input.invoiceId,
      invoiceNumber: input.invoiceNumber,
      itemStatus: 'prepared',
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    },
  ];

  saveExportBatch(input.tenantId, batch);
  saveExportItems(input.tenantId, items);
  audit(input.tenantId, 'export_prepared', `Rechnungsexport vorbereitet (${input.providerKey}) — kein externer Transfer.`, {
    invoiceId: input.invoiceId,
    exportId: batchId,
  });

  return { ok: true, data: { batch, items } };
}

export type PrepareBelegpaketInput = {
  tenantId: string;
  invoiceIds: string[];
  providerKey: AccountingProviderKey;
  preparedBy?: string | null;
};

export function prepareBelegpaket(
  input: PrepareBelegpaketInput,
): ServiceResult<{ batch: AccountingExportBatch; items: AccountingExportBatchItem[] }> {
  const liveBlock = guardLiveDemoFeature<{ batch: AccountingExportBatch; items: AccountingExportBatchItem[] }>(
    input.tenantId,
    'Belegpaket',
  );
  if (liveBlock) return liveBlock;

  if (input.invoiceIds.length === 0) {
    return { ok: false, error: 'Belegpaket erfordert mindestens eine Rechnung.' };
  }

  const now = new Date().toISOString();
  const batchId = newId('batch');
  const batch: AccountingExportBatch = {
    id: batchId,
    tenantId: input.tenantId,
    batchNumber: newBatchNumber(),
    providerKey: input.providerKey,
    exportType: 'belegpaket',
    exportFormat: 'pdf',
    status: 'prepared',
    externalTransfer: false,
    itemCount: input.invoiceIds.length,
    errorSummary: null,
    packageLabel: `Belegpaket ${input.invoiceIds.length} Rechnung(en)`,
    preparedAt: now,
    preparedBy: input.preparedBy ?? null,
    finishedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  const items: AccountingExportBatchItem[] = input.invoiceIds.map((invoiceId, index) => ({
    id: `${batchId}-item-${index + 1}`,
    tenantId: input.tenantId,
    batchId,
    invoiceId,
    invoiceNumber: null,
    itemStatus: 'prepared',
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
  }));

  saveExportBatch(input.tenantId, batch);
  saveExportItems(input.tenantId, items);
  audit(input.tenantId, 'belegpaket_prepared', batch.packageLabel ?? 'Belegpaket vorbereitet — Archivreferenz folgt bei GoBD-Anbindung.', {
    exportId: batchId,
  });

  return { ok: true, data: { batch, items } };
}

export async function executeInvoiceExportTransfer(
  input: PrepareInvoiceExportInput,
): Promise<ServiceResult<AccountingExportBatch>> {
  const liveBlock = guardLiveDemoFeature<AccountingExportBatch>(input.tenantId, 'Buchhaltungs-Transfer');
  if (liveBlock) return liveBlock;

  const configured = await isAccountingProviderConfigured(input.tenantId, input.providerKey);
  const now = new Date().toISOString();
  const batchId = newId('batch');
  const message = configured
    ? 'Anbieter konfiguriert — externer Transfer dennoch blockiert (Connector coming_soon).'
    : 'Anbieter nicht konfiguriert — kein externer Transfer.';

  const batch: AccountingExportBatch = {
    id: batchId,
    tenantId: input.tenantId,
    batchNumber: newBatchNumber(),
    providerKey: input.providerKey,
    exportType: 'invoice',
    exportFormat: resolveExportFormat(input.providerKey),
    status: configured ? 'blocked' : 'failed',
    externalTransfer: false,
    itemCount: 1,
    errorSummary: message,
    packageLabel: null,
    preparedAt: now,
    preparedBy: input.preparedBy ?? null,
    finishedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  saveExportBatch(input.tenantId, batch);
  audit(input.tenantId, 'export_blocked', message, {
    invoiceId: input.invoiceId,
    exportId: batchId,
  });
  audit(input.tenantId, 'error_logged', message, { exportId: batchId });

  return { ok: false, error: message };
}

export function listTenantExportBatches(tenantId: string): AccountingExportBatch[] {
  return listExportBatches(tenantId);
}

export function listTenantExportErrors(tenantId: string): AccountingExportBatch[] {
  return listExportErrors(tenantId);
}

export { audit as appendAccountingConnectAudit };
