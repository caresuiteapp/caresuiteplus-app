import type { TenantScopedEntity } from '../core/base';
import type { GkvBillingMode, GkvStatutorySector } from './billingProfile';

export type GkvExportBatchStatus =
  | 'draft'
  | 'validation_pending'
  | 'validation_failed'
  | 'validation_passed'
  | 'export_ready'
  | 'exported'
  | 'submitted_prepared'
  | 'rejected'
  | 'corrected'
  | 'archived';

export const GKV_EXPORT_BATCH_STATUS_LABELS: Record<GkvExportBatchStatus, string> = {
  draft: 'Entwurf',
  validation_pending: 'Validierung ausstehend',
  validation_failed: 'Validierung fehlgeschlagen',
  validation_passed: 'Validierung bestanden',
  export_ready: 'Export bereit',
  exported: 'Exportiert (vorbereitet)',
  submitted_prepared: 'Einreichung vorbereitet (nicht produktiv)',
  rejected: 'Abgelehnt/Rückläufer',
  corrected: 'Korrigiert',
  archived: 'Archiviert',
};

export type GkvExportItemType =
  | 'leistungsnachweis'
  | 'rechnung'
  | 'dta_vorbereitung'
  | 'pruefprotokoll'
  | 'kostentraeger_stamm'
  | 'other';

export const GKV_EXPORT_ITEM_TYPE_LABELS: Record<GkvExportItemType, string> = {
  leistungsnachweis: 'Leistungsnachweis',
  rechnung: 'Rechnung',
  dta_vorbereitung: 'DTA-Vorbereitung (nicht validiert)',
  pruefprotokoll: 'Prüfprotokoll',
  kostentraeger_stamm: 'Kostenträger-Stammdaten',
  other: 'Sonstiges',
};

export type GkvExportItemStatus = 'prepared' | 'included' | 'excluded' | 'error';

/** Export-Batch — gkv_export_batches */
export type GkvExportBatch = TenantScopedEntity & {
  batchNumber: string;
  billingMode: GkvBillingMode;
  statutorySector: GkvStatutorySector | null;
  status: GkvExportBatchStatus;
  exportFormat: string;
  itemCount: number;
  dtaValidated: boolean;
  preparedAt: string;
  preparedBy: string | null;
  exportedAt: string | null;
  notes: string;
};

/** Export-Position — gkv_export_items */
export type GkvExportItem = TenantScopedEntity & {
  batchId: string;
  clientId: string | null;
  billableItemId: string | null;
  invoiceId: string | null;
  itemType: GkvExportItemType;
  payloadReference: string | null;
  status: GkvExportItemStatus;
};

export type GkvSubmissionStatus =
  | 'prepared'
  | 'blocked_no_provider'
  | 'blocked_no_validator'
  | 'blocked_not_enabled';

export const GKV_SUBMISSION_STATUS_LABELS: Record<GkvSubmissionStatus, string> = {
  prepared: 'Vorbereitet (kein Versand)',
  blocked_no_provider: 'Blockiert — kein Anbieter',
  blocked_no_validator: 'Blockiert — DTA nicht validiert',
  blocked_not_enabled: 'Blockiert — Einreichung nicht freigeschaltet',
};

/** Einreichungsprotokoll — gkv_submission_records (nur Vorbereitung) */
export type GkvSubmissionRecord = TenantScopedEntity & {
  batchId: string;
  status: GkvSubmissionStatus;
  providerKey: string | null;
  submittedAt: string | null;
  blockedReason: string | null;
  notes: string;
};
