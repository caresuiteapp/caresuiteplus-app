import { createBillingAuditTrail } from '@/lib/shared/billingAudit';
export function getAssistBillingAudit() { return createBillingAuditTrail(256, 'assist'); }
