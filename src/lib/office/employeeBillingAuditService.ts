import { createBillingAuditTrail } from '@/lib/shared/billingAudit';

/** WP196 */
export function getEmployeeBillingAudit() {
  return createBillingAuditTrail(196, 'employees');
}
