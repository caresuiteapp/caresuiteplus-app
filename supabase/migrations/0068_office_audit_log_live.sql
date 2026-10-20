-- Office Audit-Log live aggregation indexes (client + cost carrier + document events)

CREATE INDEX IF NOT EXISTS idx_client_audit_tenant_created
  ON public.client_audit_entries (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cost_carrier_audit_tenant_created
  ON public.cost_carrier_audit_events (tenant_id, created_at DESC)
  WHERE tenant_id IS NOT NULL;
