/** Buchhaltungs-Anbieter (Connect-Katalog accounting). */
export type AccountingProviderKey =
  | 'datev'
  | 'lexware_office'
  | 'sevdesk'
  | 'fastbill'
  | 'agenda'
  | 'steuerberater_export'
  | 'gobd_archiv';

/** Buchhaltungsstatus je Rechnung — getrennt vom Workflow-Status. */
export type InvoiceAccountingStatusKey =
  | 'erstellt'
  | 'versendet'
  | 'bezahlt'
  | 'ueberfaellig'
  | 'gemahnt'
  | 'storniert'
  | 'korrigiert'
  | 'export_bereit'
  | 'exportiert'
  | 'export_fehler'
  | 'steuerberater_uebergeben'
  | 'gobd_archiviert';

export type AccountingExportStatus =
  | 'prepared'
  | 'queued'
  | 'running'
  | 'blocked'
  | 'failed'
  | 'cancelled';

export type AccountingExportType = 'invoice' | 'batch' | 'steuerberater_package' | 'archive';

export type AccountingExportFormat = 'csv' | 'xml' | 'pdf' | 'datev' | 'lexware' | 'sevdesk';

export type AccountingProviderConfigStatus =
  | 'not_configured'
  | 'requested'
  | 'configured'
  | 'sandbox'
  | 'production'
  | 'disabled'
  | 'error';

export type GobdAuditEventType =
  | 'archive_created'
  | 'archive_versioned'
  | 'edit_blocked'
  | 'correction_started'
  | 'storno_created'
  | 'korrektur_created'
  | 'export_prepared'
  | 'export_blocked'
  | 'export_failed'
  | 'steuerberater_package_prepared'
  | 'status_changed';

export type AccountingProviderConfig = {
  id: string;
  tenantId: string;
  providerKey: AccountingProviderKey;
  configStatus: AccountingProviderConfigStatus;
  environment: 'sandbox' | 'production' | null;
  hasCredentialReference: boolean;
  configuredAt: string | null;
  notes: string | null;
};

export type InvoiceAccountingStatus = {
  invoiceId: string;
  tenantId: string;
  accountingStatus: InvoiceAccountingStatusKey;
  providerKey: AccountingProviderKey | null;
  archiveVersion: number;
  archivedAt: string | null;
  lastExportId: string | null;
  updatedAt: string;
};

export type AccountingExportRecord = {
  id: string;
  tenantId: string;
  providerKey: AccountingProviderKey;
  exportType: AccountingExportType;
  exportFormat: AccountingExportFormat | null;
  status: AccountingExportStatus;
  externalTransfer: boolean;
  itemCount: number;
  errorSummary: string | null;
  packageLabel: string | null;
  createdAt: string;
  finishedAt: string | null;
};

export type AccountingExportItem = {
  id: string;
  exportId: string;
  invoiceId: string;
  invoiceNumber: string | null;
  itemStatus: 'pending' | 'prepared' | 'blocked' | 'failed' | 'skipped';
  errorMessage: string | null;
};

export type GobdAuditEvent = {
  id: string;
  tenantId: string;
  invoiceId: string | null;
  eventType: GobdAuditEventType;
  summary: string;
  createdAt: string;
};

export type InvoiceAccountingSnapshot = {
  status: InvoiceAccountingStatus;
  exportHistory: AccountingExportRecord[];
  exportErrors: AccountingExportRecord[];
  gobdAuditEvents: GobdAuditEvent[];
  selectedProvider: AccountingProviderKey;
  isGobdArchived: boolean;
  canDirectEdit: boolean;
  canPrepareExport: boolean;
};

export const INVOICE_ACCOUNTING_STATUS_LABELS: Record<InvoiceAccountingStatusKey, string> = {
  erstellt: 'Erstellt',
  versendet: 'Versendet',
  bezahlt: 'Bezahlt',
  ueberfaellig: 'Überfällig',
  gemahnt: 'Gemahnt',
  storniert: 'Storniert',
  korrigiert: 'Korrigiert',
  export_bereit: 'Export bereit',
  exportiert: 'Exportiert',
  export_fehler: 'Export-Fehler',
  steuerberater_uebergeben: 'Steuerberater übergeben',
  gobd_archiviert: 'GoBD archiviert',
};

export const ACCOUNTING_PROVIDER_LABELS: Record<AccountingProviderKey, string> = {
  datev: 'DATEV',
  lexware_office: 'Lexware Office',
  sevdesk: 'sevDesk',
  fastbill: 'FastBill',
  agenda: 'Agenda',
  steuerberater_export: 'Steuerberater-Export',
  gobd_archiv: 'GoBD-Archiv',
};

export const ACCOUNTING_EXPORT_STATUS_LABELS: Record<AccountingExportStatus, string> = {
  prepared: 'Vorbereitet',
  queued: 'Eingereiht',
  running: 'Läuft',
  blocked: 'Blockiert',
  failed: 'Fehlgeschlagen',
  cancelled: 'Abgebrochen',
};
