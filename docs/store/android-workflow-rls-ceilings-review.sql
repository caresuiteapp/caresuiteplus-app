-- REVIEW ONLY, NOT APPLIED. Current catalog captured read-only on 2026-10-26.
-- Two tables only. Restrictive policies AND the existing permissive policy OR;
-- they grant no CRUD privileges and do not activate historical workflow drafts.
-- The employee portal retains own execution updates/upserts; the client portal
-- retains own assignment status reads, not direct execution-state writes.
-- Existing SECURITY DEFINER RPCs require their separate reviewed actor guards.
-- Catalog + isolated synthetic PostgreSQL proof:
-- android-workflow-rls-catalog-20261026.json / workflow_current_rls_authorization.test.mjs.
BEGIN;

CREATE OR REPLACE FUNCTION care_security.android_workflow_business(p_tenant uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT COALESCE(auth.uid() IS NOT NULL AND p_tenant=public.current_tenant_id()
   AND COALESCE(public.current_portal_type(),'business')='business'
   AND care_security.company_profile(p_tenant) IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.tenant_users u
     WHERE u.tenant_id=p_tenant AND u.auth_user_id=auth.uid()
       AND (u.status::text IS DISTINCT FROM 'active'
         OR u.must_change_password IS DISTINCT FROM FALSE
         OR u.first_login_completed IS DISTINCT FROM TRUE)),FALSE)
$$;

CREATE OR REPLACE FUNCTION care_security.android_workflow_employee(p_tenant uuid,p_employee uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT COALESCE(auth.uid() IS NOT NULL AND p_tenant=public.current_tenant_id()
   AND public.current_portal_type()='employee' AND p_employee IS NOT NULL
   AND p_employee=public.resolve_current_employee_id()
   AND (SELECT count(*) FROM public.profiles p
     WHERE p.tenant_id=p_tenant AND p.status::text='active' AND p.is_active IS TRUE
       AND (p.auth_user_id=auth.uid() OR (p.auth_user_id IS NULL AND p.id=auth.uid())))=1
   AND EXISTS (SELECT 1 FROM public.employee_portal_accounts a
     JOIN public.employees e ON e.id=a.employee_id AND e.tenant_id=a.tenant_id
     WHERE a.id=public.current_portal_account_id() AND a.auth_user_id=auth.uid()
       AND a.tenant_id=p_tenant AND a.employee_id=p_employee AND a.status='active'
       AND a.must_change_password IS FALSE AND a.first_login_completed IS TRUE
       AND e.deleted_at IS NULL AND e.portal_enabled IS TRUE),FALSE)
$$;

CREATE OR REPLACE FUNCTION care_security.android_workflow_client(p_tenant uuid,p_client uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT COALESCE(auth.uid() IS NOT NULL AND p_tenant=public.current_tenant_id()
   AND p_client IS NOT NULL AND p_client=public.current_client_id()
   AND public.current_portal_type() IN ('client','relative')
   AND (SELECT count(*) FROM public.profiles p
     WHERE p.tenant_id=p_tenant AND p.status::text='active' AND p.is_active IS TRUE
       AND (p.auth_user_id=auth.uid() OR (p.auth_user_id IS NULL AND p.id=auth.uid())))=1
   AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id=p_client AND c.tenant_id=p_tenant)
   AND ((public.current_portal_type()='client' AND (
     EXISTS (SELECT 1 FROM public.client_portal_access a
       WHERE a.id=public.current_portal_account_id() AND a.auth_user_id=auth.uid()
         AND a.tenant_id=p_tenant AND a.client_id=p_client AND a.portal_enabled IS TRUE
         AND a.status='aktiv' AND a.account_kind IN ('self','legacy_contact') AND a.access_scope='client')
     OR EXISTS (SELECT 1 FROM public.client_portal_codes a
       WHERE a.id=public.current_portal_account_id() AND a.auth_user_id=auth.uid()
         AND a.tenant_id=p_tenant AND a.client_id=p_client AND a.status='active'
         AND (a.expires_at IS NULL OR a.expires_at>now()))))
   OR (public.current_portal_type()='relative' AND EXISTS (
     SELECT 1 FROM public.relative_portal_codes a
       WHERE a.id=public.current_portal_account_id() AND a.auth_user_id=auth.uid()
         AND a.tenant_id=p_tenant AND a.client_id=p_client AND a.status='active'
         AND (a.expires_at IS NULL OR a.expires_at>now())))),FALSE)
$$;

CREATE OR REPLACE FUNCTION care_security.android_workflow_execution(p_tenant uuid,p_visit uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT care_security.android_workflow_business(p_tenant) OR EXISTS (
   SELECT 1 FROM public.assist_visits v
   WHERE v.tenant_id=p_tenant AND v.id=p_visit AND v.planning_status<>'draft'
     AND care_security.android_workflow_employee(p_tenant,public.resolve_current_employee_id())
     AND (v.employee_id=public.resolve_current_employee_id()
       OR (v.employee_id IS NULL AND EXISTS (SELECT 1 FROM public.assignments a
         WHERE a.tenant_id=v.tenant_id AND (v.legacy_assignment_id=a.id OR v.id=a.id)
           AND a.employee_id=public.resolve_current_employee_id()))))
$$;

REVOKE ALL ON FUNCTION care_security.android_workflow_business(uuid),
 care_security.android_workflow_employee(uuid,uuid),care_security.android_workflow_client(uuid,uuid),
 care_security.android_workflow_execution(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION care_security.android_workflow_business(uuid),
 care_security.android_workflow_employee(uuid,uuid),care_security.android_workflow_client(uuid,uuid),
 care_security.android_workflow_execution(uuid,uuid) TO authenticated;

DROP POLICY IF EXISTS android_workflow_read_ceiling ON public.assignments;
CREATE POLICY android_workflow_read_ceiling ON public.assignments AS RESTRICTIVE FOR SELECT TO authenticated
 USING (care_security.android_workflow_business(tenant_id)
   OR care_security.android_workflow_employee(tenant_id,employee_id)
   OR care_security.android_workflow_client(tenant_id,client_id));
DROP POLICY IF EXISTS android_workflow_insert_ceiling ON public.assignments;
CREATE POLICY android_workflow_insert_ceiling ON public.assignments AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK (care_security.android_workflow_business(tenant_id));
DROP POLICY IF EXISTS android_workflow_update_ceiling ON public.assignments;
CREATE POLICY android_workflow_update_ceiling ON public.assignments AS RESTRICTIVE FOR UPDATE TO authenticated
 USING (care_security.android_workflow_business(tenant_id) OR care_security.android_workflow_employee(tenant_id,employee_id))
 WITH CHECK (care_security.android_workflow_business(tenant_id) OR care_security.android_workflow_employee(tenant_id,employee_id));
DROP POLICY IF EXISTS android_workflow_delete_ceiling ON public.assignments;
CREATE POLICY android_workflow_delete_ceiling ON public.assignments AS RESTRICTIVE FOR DELETE TO authenticated
 USING (care_security.android_workflow_business(tenant_id));
DROP POLICY IF EXISTS android_workflow_actor_ceiling ON public.assist_visit_execution_state;
CREATE POLICY android_workflow_actor_ceiling ON public.assist_visit_execution_state AS RESTRICTIVE FOR ALL TO authenticated
 USING (care_security.android_workflow_execution(tenant_id,visit_id))
 WITH CHECK (care_security.android_workflow_execution(tenant_id,visit_id));

-- The existing employee UPDATE policy also allowed rewriting an assignment's
-- client_id (and other identity fields). RLS checks NEW rows, not OLD identities.
-- Preserve planning edits for Business and prevent portal scope re-parenting.
CREATE OR REPLACE FUNCTION care_security.android_workflow_guard_scope()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND COALESCE(public.current_portal_type(),'business')<>'business' THEN
   IF NEW.id IS DISTINCT FROM OLD.id OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
     RAISE EXCEPTION 'Die Einsatzzuordnung darf im Portal nicht geändert werden.' USING ERRCODE='42501';
   END IF;
   IF TG_TABLE_NAME='assignments' THEN
     IF NEW.employee_id IS DISTINCT FROM OLD.employee_id OR NEW.client_id IS DISTINCT FROM OLD.client_id THEN
       RAISE EXCEPTION 'Die Einsatzzuordnung darf im Portal nicht geändert werden.' USING ERRCODE='42501';
     END IF;
   ELSIF NEW.visit_id IS DISTINCT FROM OLD.visit_id THEN
     RAISE EXCEPTION 'Die Einsatzzuordnung darf im Portal nicht geändert werden.' USING ERRCODE='42501';
   END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION care_security.android_workflow_guard_scope() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS android_workflow_scope_ceiling ON public.assignments;
CREATE TRIGGER android_workflow_scope_ceiling BEFORE UPDATE ON public.assignments
 FOR EACH ROW EXECUTE FUNCTION care_security.android_workflow_guard_scope();
DROP TRIGGER IF EXISTS android_workflow_scope_ceiling ON public.assist_visit_execution_state;
CREATE TRIGGER android_workflow_scope_ceiling BEFORE UPDATE ON public.assist_visit_execution_state
 FOR EACH ROW EXECUTE FUNCTION care_security.android_workflow_guard_scope();
COMMIT;
