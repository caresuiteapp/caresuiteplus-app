/** Audit-Ereignis — gkv_billing_audit_events */
export type GkvBillingAuditEvent = {
  id: string;
  tenantId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  createdAt: string;
};
