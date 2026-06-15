import { createBillingAuditTrail } from '@/lib/shared/billingAudit';

/** WP336 */
export function getEmployeePortalBillingAudit() {
  return createBillingAuditTrail(336, 'employee-portal');
}
