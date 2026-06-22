-- Permission-Audit append-only: 0050 aktivierte RLS ohne Policies/Grants

DROP POLICY IF EXISTS permission_audit_events_tenant_select ON public.permission_audit_events;
CREATE POLICY permission_audit_events_tenant_select ON public.permission_audit_events
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS permission_audit_events_tenant_insert ON public.permission_audit_events;
CREATE POLICY permission_audit_events_tenant_insert ON public.permission_audit_events
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

GRANT SELECT, INSERT ON public.permission_audit_events TO authenticated;

COMMENT ON TABLE public.permission_audit_events IS
  'Rechteänderungs-Audit — append-only (SELECT/INSERT), kein DELETE für authenticated';
