import type {
  BillableItem,
  BillingRecipientProfile,
  BudgetTransaction,
  ClientBudgetPeriod,
  CostCarrierProfile,
  InvoiceDraft,
  InvoiceDraftItem,
  TenantBudgetConfig,
  TenantServiceRate,
  TenantTaxConfig,
} from '@/types/careBilling';
import type { CareBillingValidationReport } from '@/types/careBilling/billingValidation';

export type CareBillingAuditEntry = {
  id: string;
  tenantId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  createdAt: string;
};

type TenantCareBillingStore = {
  budgetConfig: TenantBudgetConfig | null;
  taxConfig: TenantTaxConfig | null;
  budgetPeriods: ClientBudgetPeriod[];
  budgetTransactions: BudgetTransaction[];
  serviceRates: TenantServiceRate[];
  costCarrierProfiles: CostCarrierProfile[];
  billingRecipientProfiles: BillingRecipientProfile[];
  billableItems: BillableItem[];
  invoiceDrafts: InvoiceDraft[];
  invoiceDraftItems: InvoiceDraftItem[];
  validationReports: CareBillingValidationReport[];
  auditLog: CareBillingAuditEntry[];
};

const stores = new Map<string, TenantCareBillingStore>();

function emptyStore(): TenantCareBillingStore {
  return {
    budgetConfig: null,
    taxConfig: null,
    budgetPeriods: [],
    budgetTransactions: [],
    serviceRates: [],
    costCarrierProfiles: [],
    billingRecipientProfiles: [],
    billableItems: [],
    invoiceDrafts: [],
    invoiceDraftItems: [],
    validationReports: [],
    auditLog: [],
  };
}

function getStore(tenantId: string): TenantCareBillingStore {
  let store = stores.get(tenantId);
  if (!store) {
    store = emptyStore();
    stores.set(tenantId, store);
  }
  return store;
}

export function resetCareBillingStore(tenantId?: string): void {
  if (tenantId) {
    stores.delete(tenantId);
    return;
  }
  stores.clear();
}

export function getCareBillingStoreSnapshot(tenantId: string): Readonly<TenantCareBillingStore> {
  return getStore(tenantId);
}

export function readBudgetConfig(tenantId: string): TenantBudgetConfig | null {
  return getStore(tenantId).budgetConfig;
}

export function writeBudgetConfig(tenantId: string, config: TenantBudgetConfig): TenantBudgetConfig {
  getStore(tenantId).budgetConfig = config;
  return config;
}

export function readTaxConfig(tenantId: string): TenantTaxConfig | null {
  return getStore(tenantId).taxConfig;
}

export function writeTaxConfig(tenantId: string, config: TenantTaxConfig): TenantTaxConfig {
  getStore(tenantId).taxConfig = config;
  return config;
}

export function listBudgetPeriods(tenantId: string, clientId?: string): ClientBudgetPeriod[] {
  const periods = getStore(tenantId).budgetPeriods;
  return clientId ? periods.filter((p) => p.clientId === clientId) : [...periods];
}

export function saveBudgetPeriod(tenantId: string, period: ClientBudgetPeriod): ClientBudgetPeriod {
  const store = getStore(tenantId);
  const idx = store.budgetPeriods.findIndex((p) => p.id === period.id);
  if (idx >= 0) {
    store.budgetPeriods[idx] = period;
  } else {
    store.budgetPeriods.push(period);
  }
  return period;
}

export function listServiceRates(tenantId: string): TenantServiceRate[] {
  return [...getStore(tenantId).serviceRates];
}

export function saveServiceRate(tenantId: string, rate: TenantServiceRate): TenantServiceRate {
  const store = getStore(tenantId);
  const idx = store.serviceRates.findIndex((r) => r.id === rate.id);
  if (idx >= 0) {
    store.serviceRates[idx] = rate;
  } else {
    store.serviceRates.push(rate);
  }
  return rate;
}

export function listCostCarrierProfiles(tenantId: string, clientId?: string): CostCarrierProfile[] {
  const profiles = getStore(tenantId).costCarrierProfiles;
  return clientId ? profiles.filter((p) => p.clientId === clientId) : [...profiles];
}

export function saveCostCarrierProfile(
  tenantId: string,
  profile: CostCarrierProfile,
): CostCarrierProfile {
  const store = getStore(tenantId);
  const idx = store.costCarrierProfiles.findIndex((p) => p.id === profile.id);
  if (idx >= 0) {
    store.costCarrierProfiles[idx] = profile;
  } else {
    store.costCarrierProfiles.push(profile);
  }
  return profile;
}

export function listBillingRecipientProfiles(
  tenantId: string,
  clientId?: string,
): BillingRecipientProfile[] {
  const profiles = getStore(tenantId).billingRecipientProfiles;
  return clientId ? profiles.filter((p) => p.clientId === clientId) : [...profiles];
}

export function saveBillingRecipientProfile(
  tenantId: string,
  profile: BillingRecipientProfile,
): BillingRecipientProfile {
  const store = getStore(tenantId);
  const idx = store.billingRecipientProfiles.findIndex((p) => p.id === profile.id);
  if (idx >= 0) {
    store.billingRecipientProfiles[idx] = profile;
  } else {
    store.billingRecipientProfiles.push(profile);
  }
  return profile;
}

export function listBillableItems(tenantId: string, clientId?: string): BillableItem[] {
  const items = getStore(tenantId).billableItems;
  return clientId ? items.filter((i) => i.clientId === clientId) : [...items];
}

export function getBillableItem(tenantId: string, itemId: string): BillableItem | null {
  return getStore(tenantId).billableItems.find((i) => i.id === itemId) ?? null;
}

export function saveBillableItem(tenantId: string, item: BillableItem): BillableItem {
  const store = getStore(tenantId);
  const idx = store.billableItems.findIndex((i) => i.id === item.id);
  if (idx >= 0) {
    store.billableItems[idx] = item;
  } else {
    store.billableItems.push(item);
  }
  return item;
}

export function listInvoiceDrafts(tenantId: string, clientId?: string): InvoiceDraft[] {
  const drafts = getStore(tenantId).invoiceDrafts;
  return clientId ? drafts.filter((d) => d.clientId === clientId) : [...drafts];
}

export function getInvoiceDraft(tenantId: string, draftId: string): InvoiceDraft | null {
  return getStore(tenantId).invoiceDrafts.find((d) => d.id === draftId) ?? null;
}

export function saveInvoiceDraft(tenantId: string, draft: InvoiceDraft): InvoiceDraft {
  const store = getStore(tenantId);
  const idx = store.invoiceDrafts.findIndex((d) => d.id === draft.id);
  if (idx >= 0) {
    store.invoiceDrafts[idx] = draft;
  } else {
    store.invoiceDrafts.push(draft);
  }
  return draft;
}

export function listInvoiceDraftItems(tenantId: string, draftId: string): InvoiceDraftItem[] {
  return getStore(tenantId).invoiceDraftItems.filter((i) => i.invoiceDraftId === draftId);
}

export function saveInvoiceDraftItem(tenantId: string, item: InvoiceDraftItem): InvoiceDraftItem {
  const store = getStore(tenantId);
  const idx = store.invoiceDraftItems.findIndex((i) => i.id === item.id);
  if (idx >= 0) {
    store.invoiceDraftItems[idx] = item;
  } else {
    store.invoiceDraftItems.push(item);
  }
  return item;
}

export function saveBudgetTransaction(
  tenantId: string,
  tx: BudgetTransaction,
): BudgetTransaction {
  getStore(tenantId).budgetTransactions.push(tx);
  return tx;
}

export function saveValidationReport(
  tenantId: string,
  report: CareBillingValidationReport,
): CareBillingValidationReport {
  getStore(tenantId).validationReports.push(report);
  return report;
}

export function appendCareBillingAudit(entry: CareBillingAuditEntry): void {
  getStore(entry.tenantId).auditLog.push(entry);
}

export function listCareBillingAudit(tenantId: string): CareBillingAuditEntry[] {
  return [...getStore(tenantId).auditLog];
}
