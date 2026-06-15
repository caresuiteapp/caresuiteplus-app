import { createBillingAuditTrail } from '@/lib/shared/billingAudit';

/** WP216 */
export function getDocsBillingAudit() {
  return createBillingAuditTrail(216, 'docs');
}
