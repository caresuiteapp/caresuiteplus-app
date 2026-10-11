-- REVIEW DRAFT ONLY: not deployed. Requires reviewed identity + personnel drafts.
-- Actual permissive policies/grants: workflow-server-core-rls-metadata-20261011.json.
-- Restrictive policies AND the captured permissive OR; no new CRUD grants.
-- assist_visits/team-calendar and assist_visit_tasks row policies remain unchanged.
-- Does not establish original bytes, content hashes, Storage ACLs, or atomic client
-- proof completion. Client direct proof writes deliberately fail closed.
BEGIN;
CREATE OR REPLACE FUNCTION public.workflow_core_office(p_tenant uuid,p_permission text)
RETURNS boolean LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
 SELECT p_tenant=public.current_tenant_id() AND auth.uid() IS NOT NULL
 AND COALESCE(public.current_portal_type(),'business')='business'
 AND (public.is_tenant_admin() OR public.has_permission(p_permission))
$$;
CREATE OR REPLACE FUNCTION public.workflow_core_own_visit(p_tenant uuid,p_visit uuid,p_actor text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT p_tenant=public.current_tenant_id() AND EXISTS (
 SELECT 1 FROM public.assist_visits v WHERE v.id=p_visit AND v.tenant_id=p_tenant
 AND CASE p_actor
 WHEN 'employee' THEN public.workflow_is_employee_actor(p_tenant)
   AND v.employee_id=public.resolve_current_employee_id()
   AND v.employee_portal_visible IS TRUE AND v.planning_status<>'draft'
 WHEN 'client' THEN public.is_client_portal_rls_context(p_tenant)
   AND public.current_client_id() IS NOT NULL AND v.client_id=public.current_client_id()
   AND v.planning_status<>'draft'
 ELSE false END)
$$;
CREATE OR REPLACE FUNCTION public.workflow_core_client_pending(p_tenant uuid,p_visit uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT public.workflow_core_own_visit(p_tenant,p_visit,'client') AND EXISTS (
 SELECT 1 FROM public.assist_visit_proofs p WHERE p.tenant_id=p_tenant AND p.visit_id=p_visit
 AND p.portal_visible IS TRUE AND p.portal_release_status='pending_client_signature'
 AND p.signature_id IS NULL)
$$;
CREATE OR REPLACE FUNCTION public.workflow_core_client_row(p_tenant uuid,p_client uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT p_tenant=public.current_tenant_id() AND (
 (public.is_client_portal_rls_context(p_tenant) AND p_client=public.current_client_id())
 OR (public.workflow_is_employee_actor(p_tenant) AND EXISTS (
 SELECT 1 FROM public.assignments a WHERE a.tenant_id=p_tenant AND a.client_id=p_client
 AND a.employee_id=public.resolve_current_employee_id()) )
 OR (public.workflow_is_employee_actor(p_tenant) AND EXISTS (
 SELECT 1 FROM public.assist_visits v WHERE v.tenant_id=p_tenant AND v.client_id=p_client
 AND public.workflow_core_own_visit(p_tenant,v.id,'employee'))))
$$;
CREATE OR REPLACE FUNCTION public.workflow_core_record_read(p_tenant uuid,p_client uuid,p_employee uuid,p_status text)
RETURNS boolean LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
 SELECT p_tenant=public.current_tenant_id() AND (
 public.workflow_core_office(p_tenant,'office.clients.view')
 OR public.workflow_core_office(p_tenant,'assist.execution.view')
 OR (public.workflow_is_employee_actor(p_tenant) AND p_employee=public.resolve_current_employee_id())
 OR (public.is_client_portal_rls_context(p_tenant) AND p_client=public.current_client_id()
 AND p_status IN ('signature_required','signed','approved','billable','billed')))
$$;
CREATE OR REPLACE FUNCTION public.workflow_core_item_read(p_tenant uuid,p_record uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS (SELECT 1 FROM public.service_records r WHERE r.id=p_record AND r.tenant_id=p_tenant
 AND public.workflow_core_record_read(r.tenant_id,r.client_id,r.employee_id,r.status::text))
$$;
DO $$ DECLARE f regprocedure; BEGIN
 FOREACH f IN ARRAY ARRAY[
 'public.workflow_core_office(uuid,text)'::regprocedure,
 'public.workflow_core_own_visit(uuid,uuid,text)'::regprocedure,
 'public.workflow_core_client_pending(uuid,uuid)'::regprocedure,
 'public.workflow_core_client_row(uuid,uuid)'::regprocedure,
 'public.workflow_core_record_read(uuid,uuid,uuid,text)'::regprocedure,
 'public.workflow_core_item_read(uuid,uuid)'::regprocedure] LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon',f);
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated,service_role',f);
 END LOOP;
END $$;
DROP POLICY IF EXISTS workflow_core_read_ceiling ON public.clients;
CREATE POLICY workflow_core_read_ceiling ON public.clients AS RESTRICTIVE FOR SELECT TO authenticated
 USING(tenant_id=public.current_tenant_id() AND (public.workflow_core_office(tenant_id,'office.clients.view')
 OR (status::text<>'deleted' AND deleted_at IS NULL AND public.workflow_core_client_row(tenant_id,id))));
DROP POLICY IF EXISTS workflow_core_read_ceiling ON public.assignments;
CREATE POLICY workflow_core_read_ceiling ON public.assignments AS RESTRICTIVE FOR SELECT TO authenticated
 USING(tenant_id=public.current_tenant_id() AND (
 public.workflow_core_office(tenant_id,'assist.assignments.view') OR public.workflow_core_office(tenant_id,'office.clients.view')
 OR (public.workflow_is_employee_actor(tenant_id) AND employee_id=public.resolve_current_employee_id())
 OR (public.is_client_portal_rls_context(tenant_id) AND client_id=public.current_client_id())));
DROP POLICY IF EXISTS workflow_core_read_ceiling ON public.service_records;
CREATE POLICY workflow_core_read_ceiling ON public.service_records AS RESTRICTIVE FOR SELECT TO authenticated
 USING(public.workflow_core_record_read(tenant_id,client_id,employee_id,status::text));
DROP POLICY IF EXISTS workflow_core_read_ceiling ON public.service_record_items;
CREATE POLICY workflow_core_read_ceiling ON public.service_record_items AS RESTRICTIVE FOR SELECT TO authenticated
 USING(public.workflow_core_item_read(tenant_id,service_record_id));
DO $$ DECLARE t text; op text; read_pred text; write_pred text; insert_pred text; BEGIN
 FOREACH t IN ARRAY ARRAY['assist_visit_documentation','assist_visit_signatures','assist_visit_proofs'] LOOP
 read_pred := 'tenant_id=public.current_tenant_id() AND (public.workflow_core_office(tenant_id,''assist.execution.view'') OR public.workflow_core_own_visit(tenant_id,visit_id,''employee'')';
 IF t='assist_visit_signatures' THEN read_pred:=read_pred||' OR public.workflow_core_own_visit(tenant_id,visit_id,''client'')'; END IF;
 IF t='assist_visit_proofs' THEN read_pred:=read_pred||' OR (portal_visible IS TRUE AND portal_release_status IN (''released'',''pending_client_signature'') AND public.workflow_core_own_visit(tenant_id,visit_id,''client''))'; END IF;
 read_pred:=read_pred||')';
 write_pred:='tenant_id=public.current_tenant_id() AND (public.workflow_core_office(tenant_id,''assist.execution.manage'') OR public.workflow_core_own_visit(tenant_id,visit_id,''employee''))';
 insert_pred:=write_pred;
 IF t='assist_visit_signatures' THEN insert_pred:='('||write_pred||') OR (public.workflow_core_client_pending(tenant_id,visit_id) AND signer_role IN (''client'',''assignment'',''service_proof'') AND signed_by_profile_id=public.resolve_current_profile_id())'; END IF;
 EXECUTE format('DROP POLICY IF EXISTS workflow_core_read_ceiling ON public.%I',t);
 EXECUTE format('CREATE POLICY workflow_core_read_ceiling ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (%s)',t,read_pred);
 FOREACH op IN ARRAY ARRAY['INSERT','UPDATE','DELETE'] LOOP
 EXECUTE format('DROP POLICY IF EXISTS workflow_core_%s_ceiling ON public.%I',lower(op),t);
 EXECUTE format('CREATE POLICY workflow_core_%s_ceiling ON public.%I AS RESTRICTIVE FOR %s TO authenticated %s %s',lower(op),t,op,
 CASE WHEN op='INSERT' THEN '' ELSE format('USING (%s)',write_pred) END,
 CASE WHEN op='DELETE' THEN '' ELSE format('WITH CHECK (%s)',CASE WHEN op='INSERT' THEN insert_pred ELSE write_pred END) END);
 END LOOP;
 END LOOP;
END $$;
-- Immutable identities/actor attribution complement, without replacing, the
-- separately reviewed bound-proof/version guard in service-record-draft.sql.
CREATE OR REPLACE FUNCTION public.workflow_core_guard_scope() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE field text; after_row jsonb:=to_jsonb(NEW); before_row jsonb; actor uuid:=public.resolve_current_profile_id(); BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.assist_visits v WHERE v.id=NEW.visit_id AND v.tenant_id=NEW.tenant_id)
 THEN RAISE EXCEPTION 'Visit tenant mismatch' USING ERRCODE='42501'; END IF;
 IF TG_OP='UPDATE' THEN
 before_row:=to_jsonb(OLD);
 FOREACH field IN ARRAY ARRAY['id','tenant_id','visit_id'] LOOP
 IF after_row->field IS DISTINCT FROM before_row->field THEN RAISE EXCEPTION 'Immutable visit scope: %',field USING ERRCODE='42501'; END IF;
 END LOOP;
 IF TG_TABLE_NAME='assist_visit_signatures' THEN
 FOREACH field IN ARRAY ARRAY['signer_name','signer_role','storage_path','payload_hash','signature_hash','signed_at','signed_by_profile_id'] LOOP
 IF after_row->field IS DISTINCT FROM before_row->field THEN RAISE EXCEPTION 'Immutable signature content: %',field USING ERRCODE='42501'; END IF;
 END LOOP;
 END IF;
 END IF;
 FOREACH field IN ARRAY ARRAY['created_by','submitted_by','signed_by_profile_id','generated_by','approved_by','updated_by'] LOOP
 IF TG_OP='UPDATE' AND field<>'updated_by' AND before_row->>field IS NOT NULL
 AND after_row->field IS DISTINCT FROM before_row->field
 THEN RAISE EXCEPTION 'Immutable original actor: %',field USING ERRCODE='42501'; END IF;
 IF after_row ? field AND after_row->>field IS NOT NULL THEN
 IF (TG_OP='INSERT' OR after_row->field IS DISTINCT FROM before_row->field) AND (after_row->>field)::uuid IS DISTINCT FROM actor
 THEN RAISE EXCEPTION 'Actor must be verified profile: %',field USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(after_row->>field)::uuid AND p.tenant_id=NEW.tenant_id)
 THEN RAISE EXCEPTION 'Actor profile tenant mismatch' USING ERRCODE='42501'; END IF;
 END IF;
 END LOOP;
 IF TG_TABLE_NAME='assist_visit_signatures' AND (after_row->>'signed_by_profile_id' IS NULL OR (after_row->>'signed_by_profile_id')::uuid IS DISTINCT FROM actor) AND TG_OP='INSERT'
 THEN RAISE EXCEPTION 'Signature requires actual profile FK' USING ERRCODE='42501'; END IF;
 IF TG_TABLE_NAME='assist_visit_proofs' THEN
 IF NEW.signature_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.assist_visit_signatures s WHERE s.id=NEW.signature_id AND s.tenant_id=NEW.tenant_id AND s.visit_id=NEW.visit_id AND s.is_valid)
 THEN RAISE EXCEPTION 'Proof signature visit mismatch' USING ERRCODE='42501'; END IF;
 IF NOT public.workflow_core_office(NEW.tenant_id,'assist.execution.manage') AND (
 (TG_OP='INSERT' AND (NEW.status NOT IN ('draft','pending_review') OR NEW.portal_visible OR NEW.portal_release_status<>'none' OR NEW.billing_released OR NEW.approved_by IS NOT NULL OR NEW.approved_at IS NOT NULL))
 OR (TG_OP='UPDATE' AND (to_jsonb(NEW)->'status' IS DISTINCT FROM before_row->'status' AND NEW.status IN ('approved','exported')
 OR after_row->'portal_visible' IS DISTINCT FROM before_row->'portal_visible' OR after_row->'portal_release_status' IS DISTINCT FROM before_row->'portal_release_status'
 OR after_row->'approved_by' IS DISTINCT FROM before_row->'approved_by' OR after_row->'approved_at' IS DISTINCT FROM before_row->'approved_at'
 OR after_row->'billing_released' IS DISTINCT FROM before_row->'billing_released')))
 THEN RAISE EXCEPTION 'Proof approval/release requires Office permission' USING ERRCODE='42501'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.workflow_core_guard_scope() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['assist_visit_documentation','assist_visit_signatures','assist_visit_proofs'] LOOP
 EXECUTE format('DROP TRIGGER IF EXISTS workflow_core_guard_scope ON public.%I',t);
 EXECUTE format('CREATE TRIGGER workflow_core_guard_scope BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.workflow_core_guard_scope()',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['clients','assignments','service_records','service_record_items','assist_visit_documentation','assist_visit_signatures','assist_visit_proofs','assist_visits','assist_visit_tasks'] LOOP
 EXECUTE format('REVOKE TRUNCATE,REFERENCES,TRIGGER ON public.%I FROM anon,authenticated',t);
 END LOOP;
END $$;
COMMIT;
