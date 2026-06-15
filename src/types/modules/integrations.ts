import type { TenantScopedEntity, WorkflowStatus } from '../core/base';

export type IntegrationCategory =
  | 'accounting'
  | 'payment'
  | 'hr'
  | 'messaging'
  | 'telephony'
  | 'storage'
  | 'other';

export type IntegrationStatus = 'active' | 'inactive' | 'error' | 'pending_setup';

export type IntegrationProvider = TenantScopedEntity & {
  name: string;
  category: IntegrationCategory;
  status: IntegrationStatus;
  /** Kein echter Secret-Wert — nur Referenz auf Vault/Edge Function */
  secretReference: string | null;
  webhookUrl: string | null;
  configuredAt: string | null;
  lastSyncAt: string | null;
  notes: string | null;
};

export type OutboxStatus = 'pending' | 'sent' | 'failed' | 'cancelled';
export type OutboxType = 'email' | 'sms' | 'push' | 'webhook';

export type OutboxEntry = TenantScopedEntity & {
  type: OutboxType;
  recipient: string;
  subject: string | null;
  body: string;
  status: OutboxStatus;
  attempts: number;
  lastAttemptAt: string | null;
  workflowStatus: WorkflowStatus;
};

export type IntegrationProviderListItem = Pick<
  IntegrationProvider,
  | 'id'
  | 'tenantId'
  | 'name'
  | 'category'
  | 'status'
  | 'secretReference'
  | 'webhookUrl'
  | 'configuredAt'
  | 'lastSyncAt'
  | 'notes'
  | 'updatedAt'
> & {
  providerKey: string;
};

export type OutboxEntryListItem = Pick<
  OutboxEntry,
  | 'id'
  | 'tenantId'
  | 'type'
  | 'recipient'
  | 'subject'
  | 'body'
  | 'status'
  | 'attempts'
  | 'lastAttemptAt'
  | 'workflowStatus'
  | 'createdAt'
  | 'updatedAt'
>;

export const INTEGRATION_CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  accounting: 'Buchhaltung',
  payment: 'Zahlung',
  hr: 'Personal',
  messaging: 'Nachrichten',
  telephony: 'Telefonie',
  storage: 'Speicher/OCR',
  other: 'Sonstiges',
};

export const INTEGRATION_STATUS_LABELS: Record<IntegrationStatus, string> = {
  active: 'Aktiv',
  inactive: 'Inaktiv',
  error: 'Fehler',
  pending_setup: 'Einrichtung ausstehend',
};

export const OUTBOX_STATUS_LABELS: Record<OutboxStatus, string> = {
  pending: 'Ausstehend',
  sent: 'Gesendet',
  failed: 'Fehler',
  cancelled: 'Abgebrochen',
};
