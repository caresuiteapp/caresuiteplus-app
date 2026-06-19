-- Allow client portal actors to read their own client record (greeting name fields).
DROP POLICY IF EXISTS "clients_select_portal_self" ON public.clients;
CREATE POLICY "clients_select_portal_self"
  ON public.clients FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND id = public.current_client_id()
    AND public.current_client_id() IS NOT NULL
  );
