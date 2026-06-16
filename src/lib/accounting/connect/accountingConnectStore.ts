import type {
  AccountingAuditEvent,
  AccountingExportBatch,
  AccountingExportBatchItem,
  BankTransaction,
  BankTransactionImport,
  PaymentMatchingSuggestion,
  TaxAdvisorPackage,
} from '@/types/connect/accounting';

type TenantStore = {
  exportBatches: AccountingExportBatch[];
  exportItems: AccountingExportBatchItem[];
  taxAdvisorPackages: TaxAdvisorPackage[];
  bankImports: BankTransactionImport[];
  bankTransactions: BankTransaction[];
  paymentSuggestions: PaymentMatchingSuggestion[];
  auditEvents: AccountingAuditEvent[];
};

const stores = new Map<string, TenantStore>();

function emptyStore(): TenantStore {
  return {
    exportBatches: [],
    exportItems: [],
    taxAdvisorPackages: [],
    bankImports: [],
    bankTransactions: [],
    paymentSuggestions: [],
    auditEvents: [],
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

export function resetAccountingConnectStore(tenantId?: string): void {
  if (tenantId) {
    stores.delete(tenantId);
    return;
  }
  stores.clear();
}

export function getAccountingConnectStoreSnapshot(tenantId: string): Readonly<TenantStore> {
  return getStore(tenantId);
}

export function listExportBatches(tenantId: string): AccountingExportBatch[] {
  return [...getStore(tenantId).exportBatches].sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt),
  );
}

export function listExportErrors(tenantId: string): AccountingExportBatch[] {
  return listExportBatches(tenantId).filter(
    (batch) => batch.status === 'failed' || batch.status === 'blocked',
  );
}

export function saveExportBatch(tenantId: string, batch: AccountingExportBatch): AccountingExportBatch {
  getStore(tenantId).exportBatches.unshift(batch);
  return batch;
}

export function saveExportItems(tenantId: string, items: AccountingExportBatchItem[]): void {
  getStore(tenantId).exportItems.push(...items);
}

export function listExportItems(tenantId: string, batchId: string): AccountingExportBatchItem[] {
  return getStore(tenantId).exportItems.filter((item) => item.batchId === batchId);
}

export function saveTaxAdvisorPackage(tenantId: string, pkg: TaxAdvisorPackage): TaxAdvisorPackage {
  getStore(tenantId).taxAdvisorPackages.unshift(pkg);
  return pkg;
}

export function listTaxAdvisorPackages(tenantId: string): TaxAdvisorPackage[] {
  return [...getStore(tenantId).taxAdvisorPackages];
}

export function saveBankImport(tenantId: string, record: BankTransactionImport): BankTransactionImport {
  getStore(tenantId).bankImports.unshift(record);
  return record;
}

export function listBankImports(tenantId: string): BankTransactionImport[] {
  return [...getStore(tenantId).bankImports];
}

export function saveBankTransactions(tenantId: string, rows: BankTransaction[]): void {
  getStore(tenantId).bankTransactions.push(...rows);
}

export function listBankTransactions(tenantId: string, importId?: string): BankTransaction[] {
  const rows = getStore(tenantId).bankTransactions;
  if (!importId) return [...rows];
  return rows.filter((row) => row.importId === importId);
}

export function savePaymentSuggestion(
  tenantId: string,
  suggestion: PaymentMatchingSuggestion,
): PaymentMatchingSuggestion {
  getStore(tenantId).paymentSuggestions.unshift(suggestion);
  return suggestion;
}

export function listPaymentSuggestions(tenantId: string): PaymentMatchingSuggestion[] {
  return [...getStore(tenantId).paymentSuggestions];
}

export function appendAccountingAuditEvent(
  tenantId: string,
  event: AccountingAuditEvent,
): AccountingAuditEvent {
  getStore(tenantId).auditEvents.unshift(event);
  return event;
}

export function listAccountingAuditEvents(tenantId: string): AccountingAuditEvent[] {
  return [...getStore(tenantId).auditEvents];
}

export function updateBankTransaction(
  tenantId: string,
  transactionId: string,
  patch: Partial<Pick<BankTransaction, 'matchStatus'>>,
): BankTransaction | null {
  const store = getStore(tenantId);
  const row = store.bankTransactions.find((entry) => entry.id === transactionId);
  if (!row) return null;
  Object.assign(row, patch);
  return { ...row };
}

export function updatePaymentSuggestion(
  tenantId: string,
  suggestionId: string,
  patch: Partial<PaymentMatchingSuggestion>,
): PaymentMatchingSuggestion | null {
  const store = getStore(tenantId);
  const row = store.paymentSuggestions.find((entry) => entry.id === suggestionId);
  if (!row) return null;
  Object.assign(row, patch, { updatedAt: new Date().toISOString() });
  return { ...row };
}
