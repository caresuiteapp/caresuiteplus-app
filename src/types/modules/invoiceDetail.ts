import type { WorkflowStatus } from '../core/base';
import type { AuditEntry } from '../detail';
import type { InvoiceLineItem, InvoiceListItem } from './billing';

export type InvoiceDetail = InvoiceListItem & {
  createdAt: string;
  issuedDate: string | null;
  notes: string | null;
  lineItems: InvoiceLineItem[];
  auditEntries: AuditEntry[];
  allowedStatusActions: WorkflowStatus[];
  nextActionHint: string;
};
