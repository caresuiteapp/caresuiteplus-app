import { createBillingAuditTrail } from '@/lib/shared/billingAudit';

/** WP296 */
export function getCareRecordBillingAudit() {
  return createBillingAuditTrail(296, 'care-records');
}
