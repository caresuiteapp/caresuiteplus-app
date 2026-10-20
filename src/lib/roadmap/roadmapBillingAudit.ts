import { createBillingAuditTrail } from '@/lib/shared/billingAudit';

/** WP596 — Abrechnung & Audit (roadmap) */
export function getRoadmapBillingAudit() {
  return createBillingAuditTrail(596, 'roadmap');
}
