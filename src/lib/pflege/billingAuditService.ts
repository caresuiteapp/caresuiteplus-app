import { createBillingAuditTrail } from '@/lib/shared/billingAudit';
export function getPflegeBillingAudit() { return createBillingAuditTrail(376, 'pflege'); }
