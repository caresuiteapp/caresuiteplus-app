import type {
  BillingExportBatch,
  BillingExportItem,
  BillingProviderConfig,
  BillingValidationReport,
  ConnectBillingMode,
  CostCarrier,
  RejectionManagementCase,
  TenantIkProfile,
} from '@/types/connect/billing';
import { createDefaultProviderConfig } from './billingProviders';

type TenantStore = {
  ikProfile: TenantIkProfile | null;
  costCarriers: CostCarrier[];
  providerConfigs: BillingProviderConfig[];
  validationReports: BillingValidationReport[];
  exportBatches: BillingExportBatch[];
  exportItems: BillingExportItem[];
  rejectionCases: RejectionManagementCase[];
  auditLog: ConnectBillingAuditEntry[];
};

export type ConnectBillingAuditEntry = {
  id: string;
  tenantId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  createdAt: string;
};

const stores = new Map<string, TenantStore>();

function emptyStore(): TenantStore {
  return {
    ikProfile: null,
    costCarriers: [],
    providerConfigs: [],
    validationReports: [],
    exportBatches: [],
    exportItems: [],
    rejectionCases: [],
    auditLog: [],
  };
}

function getStore(tenantId: string): TenantStore {
  let store = stores.get(tenantId);
  if (!store) {
    store = emptyStore();
    stores.set(tenantId, store);
  }
  return store;
}

export function resetConnectBillingStore(tenantId?: string): void {
  if (tenantId) {
    stores.delete(tenantId);
    return;
  }
  stores.clear();
}

export function getConnectBillingStoreSnapshot(tenantId: string): Readonly<TenantStore> {
  return getStore(tenantId);
}

export function readIkProfile(tenantId: string): TenantIkProfile | null {
  return getStore(tenantId).ikProfile;
}

export function writeIkProfile(tenantId: string, profile: TenantIkProfile): TenantIkProfile {
  getStore(tenantId).ikProfile = profile;
  return profile;
}

export function listCostCarriers(tenantId: string): CostCarrier[] {
  return [...getStore(tenantId).costCarriers];
}

export function upsertCostCarrier(tenantId: string, carrier: CostCarrier): CostCarrier {
  const store = getStore(tenantId);
  const index = store.costCarriers.findIndex(
    (entry) => entry.costCarrierId === carrier.costCarrierId,
  );
  if (index >= 0) {
    store.costCarriers[index] = carrier;
  } else {
    store.costCarriers.push(carrier);
  }
  return carrier;
}

export function findCostCarrierById(tenantId: string, costCarrierId: string): CostCarrier | null {
  return getStore(tenantId).costCarriers.find((entry) => entry.costCarrierId === costCarrierId) ?? null;
}

export function searchCostCarriersStore(
  tenantId: string,
  query: string,
): CostCarrier[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return listCostCarriers(tenantId);
  return listCostCarriers(tenantId).filter(
    (entry) =>
      entry.name.toLowerCase().includes(normalized) ||
      entry.costCarrierId.toLowerCase().includes(normalized) ||
      (entry.ikNumber?.toLowerCase().includes(normalized) ?? false),
  );
}

export function listProviderConfigs(tenantId: string): BillingProviderConfig[] {
  const store = getStore(tenantId);
  if (store.providerConfigs.length === 0) {
    store.providerConfigs = [
      createDefaultProviderConfig(tenantId, 'opta_data'),
      createDefaultProviderConfig(tenantId, 'dmrz'),
      createDefaultProviderConfig(tenantId, 'rzh'),
      createDefaultProviderConfig(tenantId, 'davaso'),
      createDefaultProviderConfig(tenantId, 'generic_export'),
    ];
  }
  return [...store.providerConfigs];
}

export function updateProviderConfig(
  tenantId: string,
  providerKey: BillingProviderConfig['providerKey'],
  patch: Partial<BillingProviderConfig>,
): BillingProviderConfig | null {
  const store = getStore(tenantId);
  listProviderConfigs(tenantId);
  const index = store.providerConfigs.findIndex((entry) => entry.providerKey === providerKey);
  if (index < 0) return null;
  const updated = {
    ...store.providerConfigs[index],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  store.providerConfigs[index] = updated;
  return updated;
}

export function saveValidationReport(tenantId: string, report: BillingValidationReport): void {
  getStore(tenantId).validationReports.push(report);
}

export function listValidationReports(tenantId: string): BillingValidationReport[] {
  return [...getStore(tenantId).validationReports];
}

export function saveExportBatch(tenantId: string, batch: BillingExportBatch): void {
  getStore(tenantId).exportBatches.push(batch);
}

export function listExportBatches(tenantId: string): BillingExportBatch[] {
  return [...getStore(tenantId).exportBatches];
}

export function saveExportItems(tenantId: string, items: BillingExportItem[]): void {
  getStore(tenantId).exportItems.push(...items);
}

export function listExportItems(tenantId: string, batchId: string): BillingExportItem[] {
  return getStore(tenantId).exportItems.filter((entry) => entry.batchId === batchId);
}

export function saveRejectionCase(tenantId: string, rejectionCase: RejectionManagementCase): void {
  getStore(tenantId).rejectionCases.push(rejectionCase);
}

export function listRejectionCases(tenantId: string): RejectionManagementCase[] {
  return [...getStore(tenantId).rejectionCases];
}

export function appendBillingAudit(entry: ConnectBillingAuditEntry): void {
  getStore(entry.tenantId).auditLog.push(entry);
}

export function listBillingAudit(tenantId: string): ConnectBillingAuditEntry[] {
  return [...getStore(tenantId).auditLog];
}

export function setBillingMode(tenantId: string, billingMode: ConnectBillingMode): TenantIkProfile {
  const store = getStore(tenantId);
  const now = new Date().toISOString();
  const profile: TenantIkProfile = store.ikProfile ?? {
    id: `tik-${tenantId}`,
    tenantId,
    ikNumber: null,
    bankAccountHolder: null,
    bankIban: null,
    bankBic: null,
    approvalStatus: 'pending',
    serviceAreas: [],
    billingType: null,
    billingMode,
    verificationStatus: 'unverified',
    verifiedAt: null,
    notes: null,
    createdAt: now,
    updatedAt: now,
  };
  profile.billingMode = billingMode;
  profile.updatedAt = now;
  store.ikProfile = profile;
  return profile;
}
