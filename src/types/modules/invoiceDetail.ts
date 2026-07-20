import type { AuditEntry } from '../detail';
import type { InvoiceLineItem, InvoiceListItem, InvoiceStatus } from './billing';

export type InvoiceDetail = InvoiceListItem & {
  createdAt: string;
  issuedDate: string | null;
  servicePeriodStart?: string | null;
  servicePeriodEnd?: string | null;
  notes: string | null;
  lineItems: InvoiceLineItem[];
  auditEntries: AuditEntry[];
  allowedStatusActions: InvoiceStatus[];
  nextActionHint: string;
};
