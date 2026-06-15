import { createBillingAuditTrail } from '@/lib/shared/billingAudit';

/** WP176 */
export function getClientBillingAudit() {
  return createBillingAuditTrail(176, 'clients');
}
