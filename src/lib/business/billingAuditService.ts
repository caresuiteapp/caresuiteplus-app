import { createBillingAuditTrail } from '@/lib/shared/billingAudit';
export function getBusinessBillingAudit() { return createBillingAuditTrail(136, 'business'); }
