-- Remove role-forced Authenticator enrollment. Accounts that deliberately
-- verified a factor keep their existing second-factor protection.
CREATE OR REPLACE FUNCTION account_security.requires_mfa() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,account_security AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS (
   SELECT 1 FROM auth.mfa_factors f WHERE f.user_id=auth.uid() AND f.status::text='verified'
 )
$$;
REVOKE ALL ON FUNCTION account_security.requires_mfa() FROM PUBLIC,anon,authenticated;

-- Restore the existing assigned-client operational read contract, lost in
-- production. No anonymous access and no client-side write grant are added.
ALTER TABLE public.client_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS portal_employee_assigned_operational_select ON public.client_preferences;
CREATE POLICY portal_employee_assigned_operational_select ON public.client_preferences
 FOR SELECT TO authenticated USING (
  account_security.allowed_session()
  AND tenant_id=public.current_tenant_id()
  AND public.is_employee_portal_rls_context(tenant_id)
  AND client_id IN (
   SELECT v.client_id FROM public.assist_visits v
    WHERE v.tenant_id=public.current_tenant_id()
      AND v.employee_id=public.resolve_current_employee_id() AND v.planning_status<>'draft'
   UNION
   SELECT a.client_id FROM public.assignments a
    WHERE a.tenant_id=public.current_tenant_id() AND a.employee_id=public.resolve_current_employee_id()
  )
 );
GRANT SELECT ON public.client_preferences TO authenticated;

-- Push registration is performed by the authenticated edge backend, which
-- already validates recipient ownership. Browser/device clients stay read-only.
GRANT SELECT,INSERT,UPDATE ON public.portal_push_devices TO service_role;

-- Older app versions passed an employee ID into a profile foreign key. Bind
-- audit attribution to the actual authenticated actor, including those clients.
CREATE OR REPLACE FUNCTION account_security.bind_assignment_audit_actor() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,account_security AS $$
DECLARE actor_id uuid; actor_label text;
BEGIN
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 IF NOT account_security.allowed_session() OR NEW.tenant_id IS DISTINCT FROM public.current_tenant_id() THEN
  RAISE EXCEPTION 'Active own tenant session required' USING ERRCODE='42501';
 END IF;
 SELECT p.id,coalesce(nullif(btrim(p.full_name),''),nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),''))
  INTO actor_id,actor_label FROM public.profiles p
  WHERE p.tenant_id=NEW.tenant_id AND (p.auth_user_id=auth.uid() OR (p.auth_user_id IS NULL AND p.id=auth.uid()))
    AND p.status::text='active' AND p.is_active IS TRUE
  ORDER BY p.created_at,p.id LIMIT 1;
 IF actor_id IS NULL AND public.is_employee_portal_rls_context(NEW.tenant_id) THEN
  SELECT nullif(btrim(concat_ws(' ',e.first_name,e.last_name)),'') INTO actor_label
   FROM public.employees e WHERE e.tenant_id=NEW.tenant_id AND e.id=public.resolve_current_employee_id();
 END IF;
 NEW.actor_profile_id:=actor_id;
 NEW.actor_name:=coalesce(actor_label,'Angemeldetes Konto');
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION account_security.bind_assignment_audit_actor() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS assignment_audit_bind_authenticated_actor ON public.assignment_audit_events;
CREATE TRIGGER assignment_audit_bind_authenticated_actor BEFORE INSERT ON public.assignment_audit_events
 FOR EACH ROW EXECUTE FUNCTION account_security.bind_assignment_audit_actor();
