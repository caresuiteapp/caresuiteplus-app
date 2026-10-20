import { createBillingAuditTrail } from '@/lib/shared/billingAudit';

/** WP236 — Abrechnung & Audit (Rechnungen) */
export function getInvoiceBillingAudit() {
  return createBillingAuditTrail(236, 'office/invoices');
}
