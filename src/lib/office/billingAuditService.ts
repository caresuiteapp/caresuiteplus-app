import { createBillingAuditTrail } from '@/lib/shared/billingAudit';
export function getOfficeBillingAudit() { return createBillingAuditTrail(156, 'office'); }
