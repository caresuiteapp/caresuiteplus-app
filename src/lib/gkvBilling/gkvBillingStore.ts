import type {
  GkvBillingAuditEvent,
  GkvBillingProfile,
  GkvCostCarrier,
  GkvExportBatch,
  GkvExportItem,
  GkvRejectionCase,
  GkvSubmissionRecord,
  GkvValidationReport,
} from '@/types/gkvBilling';

type TenantGkvStore = {
  billingProfile: GkvBillingProfile | null;
  costCarriers: GkvCostCarrier[];
  validationReports: GkvValidationReport[];
  exportBatches: GkvExportBatch[];
  exportItems: GkvExportItem[];
  submissionRecords: GkvSubmissionRecord[];
  rejectionCases: GkvRejectionCase[];
  auditLog: GkvBillingAuditEvent[];
};

const stores = new Map<string, TenantGkvStore>();

function emptyStore(): TenantGkvStore {
  return {
    billingProfile: null,
    costCarriers: [],
    validationReports: [],
    exportBatches: [],
    exportItems: [],
    submissionRecords: [],
    rejectionCases: [],
    auditLog: [],
  };
}

function getStore(tenantId: string): TenantGkvStore {
  let store = stores.get(tenantId);
  if (!store) {
    store = emptyStore();
    stores.set(tenantId, store);
  }
  return store;
}

export function resetGkvBillingStore(tenantId?: string): void {
  if (tenantId) {
    stores.delete(tenantId);
    return;
  }
  stores.clear();
}

export function getGkvBillingStoreSnapshot(tenantId: string): Readonly<TenantGkvStore> {
  return getStore(tenantId);
}

export function readGkvBillingProfile(tenantId: string): GkvBillingProfile | null {
  return getStore(tenantId).billingProfile;
}

export function writeGkvBillingProfile(tenantId: string, profile: GkvBillingProfile): GkvBillingProfile {
  getStore(tenantId).billingProfile = profile;
  return profile;
}

export function listGkvCostCarriers(tenantId: string): GkvCostCarrier[] {
  return [...getStore(tenantId).costCarriers];
}

export function upsertGkvCostCarrier(tenantId: string, carrier: GkvCostCarrier): GkvCostCarrier {
  const store = getStore(tenantId);
  const index = store.costCarriers.findIndex((e) => e.costCarrierId === carrier.costCarrierId);
  if (index >= 0) {
    store.costCarriers[index] = carrier;
  } else {
    store.costCarriers.push(carrier);
  }
  return carrier;
}

export function findGkvCostCarrierById(tenantId: string, costCarrierId: string): GkvCostCarrier | null {
  return getStore(tenantId).costCarriers.find((e) => e.costCarrierId === costCarrierId) ?? null;
}

export function searchGkvCostCarriersStore(tenantId: string, query: string): GkvCostCarrier[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return listGkvCostCarriers(tenantId);
  return listGkvCostCarriers(tenantId).filter(
    (e) =>
      e.name.toLowerCase().includes(normalized) ||
      e.costCarrierId.toLowerCase().includes(normalized) ||
      (e.ikNumber?.toLowerCase().includes(normalized) ?? false),
  );
}

export function saveGkvValidationReport(tenantId: string, report: GkvValidationReport): void {
  getStore(tenantId).validationReports.push(report);
}

export function listGkvValidationReports(tenantId: string): GkvValidationReport[] {
  return [...getStore(tenantId).validationReports];
}

export function saveGkvExportBatch(tenantId: string, batch: GkvExportBatch): void {
  getStore(tenantId).exportBatches.push(batch);
}

export function listGkvExportBatches(tenantId: string): GkvExportBatch[] {
  return [...getStore(tenantId).exportBatches];
}

export function updateGkvExportBatch(tenantId: string, batch: GkvExportBatch): void {
  const store = getStore(tenantId);
  const index = store.exportBatches.findIndex((e) => e.id === batch.id);
  if (index >= 0) store.exportBatches[index] = batch;
}

export function saveGkvExportItems(tenantId: string, items: GkvExportItem[]): void {
  getStore(tenantId).exportItems.push(...items);
}

export function listGkvExportItems(tenantId: string, batchId: string): GkvExportItem[] {
  return getStore(tenantId).exportItems.filter((e) => e.batchId === batchId);
}

export function saveGkvSubmissionRecord(tenantId: string, record: GkvSubmissionRecord): void {
  getStore(tenantId).submissionRecords.push(record);
}

export function listGkvSubmissionRecords(tenantId: string): GkvSubmissionRecord[] {
  return [...getStore(tenantId).submissionRecords];
}

export function saveGkvRejectionCase(tenantId: string, rejectionCase: GkvRejectionCase): void {
  const store = getStore(tenantId);
  const index = store.rejectionCases.findIndex((e) => e.id === rejectionCase.id);
  if (index >= 0) {
    store.rejectionCases[index] = rejectionCase;
  } else {
    store.rejectionCases.push(rejectionCase);
  }
}

export function listGkvRejectionCases(tenantId: string): GkvRejectionCase[] {
  return [...getStore(tenantId).rejectionCases];
}

export function appendGkvBillingAudit(entry: GkvBillingAuditEvent): void {
  getStore(entry.tenantId).auditLog.push(entry);
}

export function listGkvBillingAudit(tenantId: string): GkvBillingAuditEvent[] {
  return [...getStore(tenantId).auditLog];
}

export function getGkvAuditTrail(tenantId: string): GkvBillingAuditEvent[] {
  return listGkvBillingAudit(tenantId);
}
