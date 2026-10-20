import { createBillingAuditTrail } from '@/lib/shared/billingAudit';

/** WP556 — Abrechnung & Audit (security) */
export function getSecurityBillingAudit() {
  return createBillingAuditTrail(556, 'security');
}
