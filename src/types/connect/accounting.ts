import type { TenantScopedEntity } from '../core/base';
import type {
  AccountingExportFormat,
  AccountingExportStatus,
  AccountingProviderKey,
} from '../accounting';

export type AccountingExportBatchStatus = AccountingExportStatus;

export type AccountingExportBatch = TenantScopedEntity & {
  batchNumber: string;
  providerKey: AccountingProviderKey;
  exportType: 'invoice' | 'batch' | 'belegpaket' | 'steuerberater_package' | 'archive';
  exportFormat: AccountingExportFormat | null;
  status: AccountingExportBatchStatus;
  externalTransfer: boolean;
  itemCount: number;
  errorSummary: string | null;
  packageLabel: string | null;
  preparedAt: string;
  preparedBy: string | null;
  finishedAt: string | null;
};

export type AccountingExportBatchItem = TenantScopedEntity & {
  batchId: string;
  invoiceId: string;
  invoiceNumber: string | null;
  itemStatus: 'pending' | 'prepared' | 'blocked' | 'failed' | 'skipped';
  errorMessage: string | null;
};

export type TaxAdvisorPackage = TenantScopedEntity & {
  packageLabel: string;
  formats: AccountingExportFormat[];
  status: 'prepared' | 'blocked' | 'failed' | 'cancelled';
  itemCount: number;
  zipReference: string | null;
  externalTransfer: boolean;
  errorSummary: string | null;
  preparedAt: string;
  preparedBy: string | null;
};

export type BankTransactionImportStatus =
  | 'prepared'
  | 'parsed'
  | 'blocked'
  | 'failed'
  | 'cancelled';

export type BankTransactionImport = TenantScopedEntity & {
  fileName: string;
  importFormat: 'csv' | 'camt' | 'mt940';
  status: BankTransactionImportStatus;
  rowCount: number;
  errorSummary: string | null;
  importedBy: string | null;
};

export type BankTransactionMatchStatus =
  | 'unmatched'
  | 'suggested'
  | 'match_blocked'
  | 'confirmed_blocked'
  | 'reconciled_prepared';

export type BankTransaction = TenantScopedEntity & {
  importId: string;
  bookingDate: string;
  amountCents: number;
  counterparty: string | null;
  referenceText: string | null;
  matchStatus: BankTransactionMatchStatus;
};

export type PaymentMatchingSuggestionStatus =
  | 'prepared'
  | 'accepted_prepared'
  | 'rejected'
  | 'blocked';

export type PaymentMatchingSuggestion = TenantScopedEntity & {
  bankTransactionId: string;
  invoiceId: string;
  confidenceScore: number;
  status: PaymentMatchingSuggestionStatus;
  requiresReceipt: boolean;
  receiptReference: string | null;
  errorMessage: string | null;
};

export type AccountingAuditEventType =
  | 'export_prepared'
  | 'export_blocked'
  | 'belegpaket_prepared'
  | 'steuerberater_package_prepared'
  | 'payment_import_prepared'
  | 'payment_import_blocked'
  | 'bank_reconciliation_prepared'
  | 'payment_match_suggested'
  | 'payment_confirm_blocked'
  | 'status_changed'
  | 'error_logged';

export type AccountingAuditEvent = TenantScopedEntity & {
  invoiceId: string | null;
  exportId: string | null;
  importId: string | null;
  eventType: AccountingAuditEventType;
  summary: string;
  createdAt: string;
};

export type AccountingConnectDashboard = {
  exportBatches: AccountingExportBatch[];
  exportErrors: AccountingExportBatch[];
  taxAdvisorPackages: TaxAdvisorPackage[];
  bankImports: BankTransactionImport[];
  bankTransactions: BankTransaction[];
  paymentSuggestions: PaymentMatchingSuggestion[];
  auditEvents: AccountingAuditEvent[];
};

export const ACCOUNTING_AUDIT_EVENT_LABELS: Record<AccountingAuditEventType, string> = {
  export_prepared: 'Export vorbereitet',
  export_blocked: 'Export blockiert',
  belegpaket_prepared: 'Belegpaket vorbereitet',
  steuerberater_package_prepared: 'Steuerberater-Paket vorbereitet',
  payment_import_prepared: 'Zahlungsimport vorbereitet',
  payment_import_blocked: 'Zahlungsimport blockiert',
  bank_reconciliation_prepared: 'Bankabgleich vorbereitet',
  payment_match_suggested: 'Abgleichsvorschlag',
  payment_confirm_blocked: 'Zahlungsbestätigung blockiert',
  status_changed: 'Status geändert',
  error_logged: 'Fehler protokolliert',
};
