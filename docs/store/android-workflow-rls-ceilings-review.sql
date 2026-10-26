-- REVIEW ONLY, NOT APPLIED. Current catalog captured read-only on 2026-10-26.
-- Two tables only. Restrictive policies AND the existing permissive policy OR;
-- they grant no CRUD privileges and do not activate historical workflow drafts.
-- The employee portal retains own execution updates/upserts; the client portal
-- retains own assignment status reads, not direct execution-state writes.
-- Existing SECURITY DEFINER RPCs require their separate reviewed actor guards.
-- Catalog + isolated synthetic PostgreSQL proof:
-- android-workflow-rls-catalog-20261026.json / workflow_current_rls_authorization.test.mjs.
BEGIN;

-- Refuse stale catalogs before replacing any reviewed object. Owned ceiling
-- names are excluded so an identical repeat remains valid; original policy
-- definitions and effective table privileges must still match the capture.
DO $review$
DECLARE v_actual jsonb; v_expected record;
BEGIN
 SELECT jsonb_agg(jsonb_build_object('tablename',tablename,'policyname',policyname,
   'permissive',permissive,'roles',roles::text,'cmd',cmd,'qual',qual,'with_check',with_check)
   ORDER BY tablename,policyname) INTO v_actual
 FROM pg_policies WHERE schemaname='public' AND tablename IN ('assignments','assist_visit_execution_state')
   AND policyname NOT IN ('android_workflow_read_ceiling','android_workflow_insert_ceiling',
     'android_workflow_update_ceiling','android_workflow_delete_ceiling','android_workflow_actor_ceiling');
 IF v_actual IS DISTINCT FROM $policies$[{"tablename":"assignments","policyname":"assignments_admin_manage_own_tenant","permissive":"PERMISSIVE","roles":"{authenticated}","cmd":"ALL","qual":"((tenant_id = ( SELECT current_tenant_id() AS current_tenant_id)) AND ( SELECT is_tenant_admin() AS is_tenant_admin))","with_check":"((tenant_id = ( SELECT current_tenant_id() AS current_tenant_id)) AND ( SELECT is_tenant_admin() AS is_tenant_admin))"},{"tablename":"assignments","policyname":"assignments_portal_client_select","permissive":"PERMISSIVE","roles":"{authenticated}","cmd":"SELECT","qual":"((tenant_id = ( SELECT current_tenant_id() AS current_tenant_id)) AND (client_id = ( SELECT current_client_id() AS current_client_id)) AND (( SELECT current_client_id() AS current_client_id) IS NOT NULL))","with_check":null},{"tablename":"assignments","policyname":"assignments_portal_employee_select","permissive":"PERMISSIVE","roles":"{authenticated}","cmd":"SELECT","qual":"((tenant_id = ( SELECT current_tenant_id() AS current_tenant_id)) AND (employee_id = ( SELECT resolve_current_employee_id() AS resolve_current_employee_id)))","with_check":null},{"tablename":"assignments","policyname":"assignments_portal_employee_update","permissive":"PERMISSIVE","roles":"{authenticated}","cmd":"UPDATE","qual":"((tenant_id = ( SELECT current_tenant_id() AS current_tenant_id)) AND (employee_id = ( SELECT resolve_current_employee_id() AS resolve_current_employee_id)) AND ( SELECT is_employee_portal_rls_context(( SELECT current_tenant_id() AS current_tenant_id)) AS is_employee_portal_rls_context))","with_check":"((tenant_id = ( SELECT current_tenant_id() AS current_tenant_id)) AND (employee_id = ( SELECT resolve_current_employee_id() AS resolve_current_employee_id)))"},{"tablename":"assignments","policyname":"assignments_select_own_tenant","permissive":"PERMISSIVE","roles":"{authenticated}","cmd":"SELECT","qual":"(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))","with_check":null},{"tablename":"assignments","policyname":"assignments_tenant","permissive":"PERMISSIVE","roles":"{authenticated}","cmd":"ALL","qual":"((tenant_id = ( SELECT current_tenant_id() AS current_tenant_id)) AND ( SELECT is_internal_tenant_actor(( SELECT current_tenant_id() AS current_tenant_id)) AS is_internal_tenant_actor))","with_check":"((tenant_id = ( SELECT current_tenant_id() AS current_tenant_id)) AND ( SELECT is_internal_tenant_actor(( SELECT current_tenant_id() AS current_tenant_id)) AS is_internal_tenant_actor))"},{"tablename":"assist_visit_execution_state","policyname":"assist_visit_execution_state_portal_employee","permissive":"PERMISSIVE","roles":"{authenticated}","cmd":"ALL","qual":"((tenant_id = ( SELECT current_tenant_id() AS current_tenant_id)) AND ( SELECT is_employee_portal_rls_context(( SELECT current_tenant_id() AS current_tenant_id)) AS is_employee_portal_rls_context) AND (visit_id IN ( SELECT portal_employee_assigned_visit_ids(( SELECT current_tenant_id() AS current_tenant_id)) AS portal_employee_assigned_visit_ids)))","with_check":"((tenant_id = ( SELECT current_tenant_id() AS current_tenant_id)) AND ( SELECT is_employee_portal_rls_context(( SELECT current_tenant_id() AS current_tenant_id)) AS is_employee_portal_rls_context) AND (visit_id IN ( SELECT portal_employee_assigned_visit_ids(( SELECT current_tenant_id() AS current_tenant_id)) AS portal_employee_assigned_visit_ids)))"},{"tablename":"assist_visit_execution_state","policyname":"assist_visit_execution_state_tenant","permissive":"PERMISSIVE","roles":"{authenticated}","cmd":"ALL","qual":"is_tenant_member(tenant_id)","with_check":"is_tenant_member(tenant_id)"}]$policies$::jsonb THEN
   RAISE EXCEPTION 'Reviewed assignment/execution policies changed.' USING ERRCODE='55000';
 END IF;
 SELECT jsonb_agg(jsonb_build_object('relation',g.relation,'role',g.actor,
   'sel',has_table_privilege(g.actor,'public.'||g.relation,'SELECT'),
   'ins',has_table_privilege(g.actor,'public.'||g.relation,'INSERT'),
   'upd',has_table_privilege(g.actor,'public.'||g.relation,'UPDATE'),
   'del',has_table_privilege(g.actor,'public.'||g.relation,'DELETE')) ORDER BY g.relation,g.actor) INTO v_actual
 FROM (VALUES ('assignments'),('assist_visit_execution_state')) r(relation)
 CROSS JOIN (VALUES ('anon'),('authenticated'),('service_role')) a(actor)
 CROSS JOIN LATERAL (SELECT r.relation,a.actor) g;
 IF v_actual IS DISTINCT FROM $grants$[{"relation":"assignments","role":"anon","sel":false,"ins":false,"upd":false,"del":false},{"relation":"assignments","role":"authenticated","sel":true,"ins":true,"upd":true,"del":true},{"relation":"assignments","role":"service_role","sel":true,"ins":true,"upd":true,"del":false},{"relation":"assist_visit_execution_state","role":"anon","sel":false,"ins":false,"upd":false,"del":false},{"relation":"assist_visit_execution_state","role":"authenticated","sel":true,"ins":true,"upd":true,"del":false},{"relation":"assist_visit_execution_state","role":"service_role","sel":false,"ins":false,"upd":false,"del":false}]$grants$::jsonb THEN
   RAISE EXCEPTION 'Reviewed assignment/execution privileges changed.' USING ERRCODE='55000';
 END IF;
 FOR v_expected IN SELECT * FROM jsonb_to_recordset($helpers$[{"signature":"public.current_portal_account_id()","sha256":"7977fea6427a2b3d146b912cbc7d69cefc3c3b033d01cf890fbb50c918172df6"},{"signature":"public.current_employee_id()","sha256":"3c17296724d9f088e3e7362f48cf2ef462a5764662eac7f2ea141ce0eb002304"},{"signature":"public.current_employee_id_from_profile()","sha256":"530ddd7e2cd3d2689900f7b5d4cf3bcd2c47de154e5521708dce89082a1cad87"},{"signature":"public.current_portal_type()","sha256":"0fb99f15f806cfa1e1dce0121d7e14458695a8e2fb9aefa7213868c232142dcb"},{"signature":"public.current_role_key()","sha256":"5e7fcd624f863a64cbec0212445b40413c13825eec4aaf225609cbc6daf32d89"},{"signature":"public.current_tenant_id()","sha256":"cf997112462db94cd9851c65b5ff141bdc4e41ee480031a7e6c578d98d464073"},{"signature":"public.is_employee_portal_rls_context(uuid)","sha256":"58d9f8aa3778b7e1df166161146d5cd8360c10f36dec74f2d3a4f4fcd0a3d576"},{"signature":"public.is_internal_tenant_actor(uuid)","sha256":"b34cfd8764cabc87a61714393df55de8cdbe362b5e13ef99d64f70c79e3b5d37"},{"signature":"public.is_tenant_admin()","sha256":"1db39d8635deadbf8b63ab583a74931d9ab0313c7b17a355ba731197f93039a9"},{"signature":"public.current_client_id()","sha256":"425f2f7de56f496fb9264f75a890877b771ba9b383776d1f2b4b6a32fb432f29"},{"signature":"public.is_active_employee_portal_actor(uuid)","sha256":"ea4e8c09db484728ca7046648bee565a0890a70815560037ff5269cbad95aa7e"},{"signature":"public.is_client_portal_rls_context(uuid)","sha256":"3f4039cf02e6692ef790563a1c9f5790ed16bae1d7a10a5d5d6a230ba5b0b6cb"},{"signature":"public.is_tenant_member(uuid)","sha256":"23bd97e89beacde836bbfca08149ecb6695c15fc33a5062c32f494fd187a42d7"},{"signature":"public.portal_employee_assigned_visit_ids(uuid)","sha256":"6de7d2c760a9dc839bbcd90a844c84c3a1d3d95823eb815ac203f70441ac227c"},{"signature":"public.resolve_current_employee_id()","sha256":"320b128270c5c9124c089f699e8435ebadb41811604b22a98ec227fe806d1bc6"},{"signature":"care_security.company_profile(uuid)","sha256":"9cc519787ac09db634cd1b8754e02e0eac95350aa5939a6f0dede9ce5758d145"}]$helpers$::jsonb) AS f(signature text,sha256 text) LOOP
   IF encode(sha256(convert_to(pg_get_functiondef(to_regprocedure(v_expected.signature)),'UTF8')),'hex')
      IS DISTINCT FROM v_expected.sha256 THEN
     RAISE EXCEPTION 'Reviewed actor helper changed: %',v_expected.signature USING ERRCODE='55000';
   END IF;
 END LOOP;
END;
$review$;

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
       AND e.status::text IN ('active','aktiv')
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
         AND a.created_at<=now() AND (a.expires_at IS NULL OR a.expires_at>now())
         AND COALESCE((SELECT p.can_view_appointments FROM public.portal_access_permissions p
           WHERE p.tenant_id=a.tenant_id AND p.portal_type='relative' AND p.portal_account_id=a.id
           ORDER BY p.updated_at DESC,p.id DESC LIMIT 1),FALSE)))),FALSE)
$$;

CREATE OR REPLACE FUNCTION care_security.android_workflow_execution(p_tenant uuid,p_visit uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT COALESCE(p_tenant=public.current_tenant_id() AND EXISTS (
   SELECT 1 FROM public.assist_visits v
   WHERE v.tenant_id=p_tenant AND v.id=p_visit
     AND (care_security.android_workflow_business(p_tenant)
       OR (v.planning_status<>'draft'
         AND care_security.android_workflow_employee(p_tenant,public.resolve_current_employee_id())
         AND (v.employee_id=public.resolve_current_employee_id()
           OR (v.employee_id IS NULL AND EXISTS (SELECT 1 FROM public.assignments a
             WHERE a.tenant_id=v.tenant_id AND (v.legacy_assignment_id=a.id OR v.id=a.id)
               AND a.client_id=v.client_id AND a.employee_id=public.resolve_current_employee_id())))))),FALSE)
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
