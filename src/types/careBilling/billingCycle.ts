import type { TenantScopedEntity } from '../core/base';
import type { InvoiceTaxMode } from '../documents/invoice';
import type { BillingRecipientType } from './billingRecipient';

/** Monatsabschluss / Rechnungslauf — Status */
export type BillingRunStatus = 'draft' | 'prepared' | 'checked' | 'completed' | 'cancelled';

export const BILLING_RUN_STATUS_LABELS: Record<BillingRunStatus, string> = {
  draft: 'Entwurf',
  prepared: 'Vorbereitet',
  checked: 'Geprüft',
  completed: 'Abgeschlossen',
  cancelled: 'Storniert',
};

export type BillingRunItemStatus =
  | 'pending'
  | 'draft_created'
  | 'blocked'
  | 'skipped'
  | 'invoiced';

export type CareBillingInvoiceStatus =
  | 'draft'
  | 'validated'
  | 'finalized'
  | 'sent_prepared'
  | 'cancelled';

export type ReceivableDunningStatus =
  | 'not_due'
  | 'due'
  | 'overdue'
  | 'reminder_sent'
  | 'first_dunning_sent'
  | 'final_dunning_sent'
  | 'collection_prepared'
  | 'paid'
  | 'disputed'
  | 'written_off';

export const DUNNING_STATUS_LABELS: Record<ReceivableDunningStatus, string> = {
  not_due: 'Noch nicht fällig',
  due: 'Fällig',
  overdue: 'Überfällig',
  reminder_sent: 'Zahlungserinnerung',
  first_dunning_sent: 'Erste Mahnung',
  final_dunning_sent: 'Letzte Mahnung',
  collection_prepared: 'Inkasso vorbereitet',
  paid: 'Bezahlt',
  disputed: 'Bestritten',
  written_off: 'Abgeschrieben',
};

export type DunningRunStatus = 'draft' | 'prepared' | 'completed' | 'cancelled';

export type DunningLetterLevel = 'reminder' | 'first' | 'final' | 'collection';

export type BillingRun = TenantScopedEntity & {
  billingMonth: string;
  title: string;
  status: BillingRunStatus;
  preparedAt: string | null;
  preparedBy: string | null;
  checkedAt: string | null;
  checkedBy: string | null;
  completedAt: string | null;
  completedBy: string | null;
  serviceRecordsCount: number;
  invoicesCount: number;
  totalAmountCents: number;
  notes: string | null;
};

export type BillingRunItem = TenantScopedEntity & {
  billingRunId: string;
  billableItemId: string;
  clientId: string;
  status: BillingRunItemStatus;
  invoiceDraftId: string | null;
  invoiceId: string | null;
  blockedReason: string | null;
};

export type CareBillingInvoice = TenantScopedEntity & {
  clientId: string;
  invoiceDraftId: string;
  invoiceNumber: string | null;
  status: CareBillingInvoiceStatus;
  taxMode: InvoiceTaxMode;
  servicePeriodFrom: string;
  servicePeriodTo: string;
  recipientType: BillingRecipientType;
  recipientName: string;
  costCarrierName: string | null;
  costCarrierIk: string | null;
  netTotalCents: number;
  taxTotalCents: number;
  grossTotalCents: number;
  validationRunId: string | null;
  dueDate: string;
  sentPreparedAt: string | null;
  isStatutoryPreparedOnly: boolean;
  billingRunId: string | null;
};

export type CareBillingInvoiceItem = TenantScopedEntity & {
  invoiceId: string;
  billableItemId: string;
  description: string;
  netTotalCents: number;
  taxTotalCents: number;
  grossTotalCents: number;
};

export type Receivable = TenantScopedEntity & {
  clientId: string;
  invoiceId: string;
  invoiceNumber: string;
  grossTotalCents: number;
  openAmountCents: number;
  paidAmountCents: number;
  dueDate: string;
  dunningStatus: ReceivableDunningStatus;
  lastDunningAt: string | null;
};

export type DunningRun = TenantScopedEntity & {
  status: DunningRunStatus;
  runAt: string;
  receivableCount: number;
  preparedBy: string | null;
  notes: string | null;
};

export type DunningLetter = TenantScopedEntity & {
  dunningRunId: string;
  receivableId: string;
  invoiceId: string;
  letterLevel: DunningLetterLevel;
  openAmountCents: number;
  status: 'prepared' | 'sent_prepared';
  preparedAt: string;
};

export type PaymentAllocation = TenantScopedEntity & {
  receivableId: string;
  invoiceId: string;
  amountCents: number;
  paymentReference: string;
  allocatedAt: string;
};

export type BillingAuditEvent = TenantScopedEntity & {
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  actorId: string | null;
};

export type PrepareBillingRunInput = {
  tenantId: string;
  billingMonth: string;
  title?: string;
  preparedBy?: string | null;
};

export type PrepareBillingRunResult = {
  ok: boolean;
  billingRunId: string | null;
  itemCount: number;
  blockedReason: string | null;
};

export type GenerateDraftsFromRunResult = {
  ok: boolean;
  billingRunId: string;
  draftsCreated: number;
  blockedCount: number;
  blockedReason: string | null;
};

export type FinalizeRunInvoicesInput = {
  tenantId: string;
  billingRunId: string;
  previewConfirmed: boolean;
  actorId?: string | null;
};

export type FinalizeRunInvoicesResult = {
  ok: boolean;
  billingRunId: string;
  invoicesFinalized: number;
  receivablesCreated: number;
  blockedReason: string | null;
};

export type PrepareDunningRunInput = {
  tenantId: string;
  preparedBy?: string | null;
};

export type PrepareDunningRunResult = {
  ok: boolean;
  dunningRunId: string | null;
  receivableCount: number;
  blockedReason: string | null;
};
