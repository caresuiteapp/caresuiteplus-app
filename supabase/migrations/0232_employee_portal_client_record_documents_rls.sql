-- Employee portal Klientenakten — freigegebene Dokumente, Kontakte, Intake-Vorschau.

DROP POLICY IF EXISTS client_documents_portal_employee_select ON public.client_documents;
CREATE POLICY client_documents_portal_employee_select ON public.client_documents
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND portal_visible = TRUE
    AND status IN ('aktiv', 'abgeschlossen', 'bestaetigt')
    AND sensitivity NOT IN ('internal', 'restricted')
    AND client_id IN (
      SELECT v.client_id
      FROM public.assist_visits v
      WHERE v.tenant_id = public.current_tenant_id()
        AND v.employee_id = public.resolve_current_employee_id()
        AND v.planning_status <> 'draft'
      UNION
      SELECT a.client_id
      FROM public.assignments a
      WHERE a.tenant_id = public.current_tenant_id()
        AND a.employee_id = public.resolve_current_employee_id()
    )
  );

DROP POLICY IF EXISTS client_contacts_portal_employee_emergency_select ON public.client_contacts;
DROP POLICY IF EXISTS client_contacts_portal_employee_select ON public.client_contacts;
CREATE POLICY client_contacts_portal_employee_select ON public.client_contacts
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND client_id IN (
      SELECT v.client_id
      FROM public.assist_visits v
      WHERE v.tenant_id = public.current_tenant_id()
        AND v.employee_id = public.resolve_current_employee_id()
        AND v.planning_status <> 'draft'
      UNION
      SELECT a.client_id
      FROM public.assignments a
      WHERE a.tenant_id = public.current_tenant_id()
        AND a.employee_id = public.resolve_current_employee_id()
    )
  );

DROP POLICY IF EXISTS client_intake_documents_portal_employee_select ON public.client_intake_documents;
CREATE POLICY client_intake_documents_portal_employee_select ON public.client_intake_documents
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND client_id IN (
      SELECT v.client_id
      FROM public.assist_visits v
      WHERE v.tenant_id = public.current_tenant_id()
        AND v.employee_id = public.resolve_current_employee_id()
        AND v.planning_status <> 'draft'
      UNION
      SELECT a.client_id
      FROM public.assignments a
      WHERE a.tenant_id = public.current_tenant_id()
        AND a.employee_id = public.resolve_current_employee_id()
    )
  );

COMMENT ON POLICY client_documents_portal_employee_select ON public.client_documents IS
  'Employee portal Klientenakten — portal_visible documents for assigned clients.';

COMMENT ON POLICY client_contacts_portal_employee_select ON public.client_contacts IS
  'Employee portal Klientenakten — all contacts for assigned clients.';

COMMENT ON POLICY client_intake_documents_portal_employee_select ON public.client_intake_documents IS
  'Employee portal — intake HTML preview for assigned client documents.';
