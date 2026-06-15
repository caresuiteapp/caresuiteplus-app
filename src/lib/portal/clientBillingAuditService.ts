import { createBillingAuditTrail } from '@/lib/shared/billingAudit';

/** WP356 */
export function getClientPortalBillingAudit() {
  return createBillingAuditTrail(356, 'client-portal');
}
