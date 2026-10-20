-- Portal profile: allow portal actors to read own access row and emergency contacts.

DROP POLICY IF EXISTS client_portal_access_portal_self_select ON public.client_portal_access;
CREATE POLICY client_portal_access_portal_self_select ON public.client_portal_access
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND client_id = public.current_client_id()
    AND public.current_client_id() IS NOT NULL
    AND auth_user_id = auth.uid()
  );

DROP POLICY IF EXISTS client_contacts_portal_self_select ON public.client_contacts;
CREATE POLICY client_contacts_portal_self_select ON public.client_contacts
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND client_id = public.current_client_id()
    AND public.current_client_id() IS NOT NULL
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type
    WHERE typname = 'care_plan_status' AND typnamespace = 'public'::regnamespace
  ) THEN
    DROP POLICY IF EXISTS care_plans_portal_self_select ON public.care_plans;
    CREATE POLICY care_plans_portal_self_select ON public.care_plans
      FOR SELECT TO authenticated
      USING (
        tenant_id = public.current_tenant_id()
        AND client_id = public.current_client_id()
        AND public.current_client_id() IS NOT NULL
        AND status = 'active'::public.care_plan_status
      );
  ELSE
    DROP POLICY IF EXISTS care_plans_portal_self_select ON public.care_plans;
    CREATE POLICY care_plans_portal_self_select ON public.care_plans
      FOR SELECT TO authenticated
      USING (
        tenant_id = public.current_tenant_id()
        AND client_id = public.current_client_id()
        AND public.current_client_id() IS NOT NULL
        AND status = 'aktiv'
      );
  END IF;
END $$;
