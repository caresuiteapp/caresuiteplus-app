import { createBillingAuditTrail } from '@/lib/shared/billingAudit';

/** WP576 — Abrechnung & Audit (qa) */
export function getQaBillingAudit() {
  return createBillingAuditTrail(576, 'qa');
}
