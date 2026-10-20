import { createBillingAuditTrail } from '@/lib/shared/billingAudit';
export function getCatalogBillingAudit() { return createBillingAuditTrail(456, 'catalog'); }
