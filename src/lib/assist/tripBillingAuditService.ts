import { createBillingAuditTrail } from '@/lib/shared/billingAudit';

/** WP316 */
export function getTripBillingAudit() {
  return createBillingAuditTrail(316, 'trips');
}
