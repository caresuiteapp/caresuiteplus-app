import { createBillingAuditTrail } from '@/lib/shared/billingAudit';

/** WP496 — Abrechnung & Audit (Integrationen) */
export function getIntegrationsBillingAudit() {
  return createBillingAuditTrail(496, 'integrations');
}
