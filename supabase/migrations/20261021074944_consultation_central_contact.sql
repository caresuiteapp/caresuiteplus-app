-- Prepared release: central intake stays the owner of client master data.
-- Apply through the deployment workflow; no existing signed snapshot is rewritten.
BEGIN;
CREATE FUNCTION care_security.consultation_contact_load(p_tenant uuid,p_employee_view boolean,p_case uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $b$
DECLARE v_base jsonb;
BEGIN
 v_base:=care_security.consultation_extended_load(p_tenant,p_employee_view,p_case);
 RETURN v_base||jsonb_build_object(
  'capabilities',v_base->'capabilities'||jsonb_build_object('centralContact',true),
  'encounters',coalesce((SELECT jsonb_agg(
   CASE WHEN e->>'status' IN ('draft','scheduled') AND c->'client' IS NOT NULL AND c->'client'<>'null'::jsonb
    THEN jsonb_set(e,'{client_snapshot}',c->'client') ELSE e END ORDER BY n)
   FROM jsonb_array_elements(v_base->'encounters') WITH ORDINALITY visit(e,n)
   LEFT JOIN LATERAL (SELECT item AS c FROM jsonb_array_elements(v_base->'cases') item WHERE item->>'id'=e->>'case_id') linked ON true),'[]'));
END $b$;

CREATE FUNCTION care_security.consultation_contact_mutate(p_tenant uuid,p_action text,p_request uuid,p_encounter uuid,p_version integer,p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $b$
DECLARE v_result jsonb; v_replay boolean; v_client uuid; v_snapshot jsonb;
BEGIN
 IF auth.uid() IS NULL OR p_tenant IS DISTINCT FROM public.current_tenant_id() OR p_request IS NULL THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Anmeldung oder Mandant fehlt.';
 END IF;
 -- Same lock as the existing mutation: retry acknowledgements never alter a snapshot.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant::text||auth.uid()::text||p_request::text,0));
 SELECT EXISTS(SELECT 1 FROM public.consultation_requests WHERE tenant_id=p_tenant AND actor_id=auth.uid() AND request_id=p_request) INTO v_replay;
 -- Delegation performs the existing role, tenant, assignment, qualification and CAS checks.
 v_result:=care_security.consultation_extended_mutate(p_tenant,p_action,p_request,p_encounter,p_version,p_data);
 IF NOT v_replay AND p_action IN ('plan','start') THEN
  SELECT c.id INTO v_client FROM public.consultation_encounters e
   JOIN public.consultation_workspaces w ON w.id=e.case_id AND w.tenant_id=e.tenant_id
   JOIN public.clients c ON c.id=w.client_id AND c.tenant_id=w.tenant_id AND c.deleted_at IS NULL
   WHERE e.id=p_encounter AND e.tenant_id=p_tenant FOR SHARE OF c;
  IF v_client IS NULL THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Die verknüpfte Klientenakte ist nicht mehr verfügbar.'; END IF;
  v_snapshot:=care_security.consultation_client(p_tenant,v_client);
  UPDATE public.consultation_encounters SET client_snapshot=v_snapshot WHERE id=p_encounter AND tenant_id=p_tenant;
 END IF;
 RETURN v_result;
END $b$;

REVOKE ALL ON FUNCTION care_security.consultation_contact_load(uuid,boolean,uuid),care_security.consultation_contact_mutate(uuid,text,uuid,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION care_security.consultation_contact_load(uuid,boolean,uuid),care_security.consultation_contact_mutate(uuid,text,uuid,uuid,integer,jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION care_security.consultation_extended_load(uuid,boolean,uuid),care_security.consultation_extended_mutate(uuid,text,uuid,uuid,integer,jsonb) FROM authenticated;
CREATE OR REPLACE FUNCTION public.consultation_workspace_load(p_tenant uuid,p_employee_view boolean DEFAULT false,p_case uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $b$ SELECT care_security.consultation_contact_load(p_tenant,p_employee_view,p_case) $b$;
CREATE OR REPLACE FUNCTION public.consultation_workspace_mutate(p_tenant uuid,p_action text,p_request uuid,p_encounter uuid DEFAULT NULL,p_version integer DEFAULT NULL,p_data jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $b$ SELECT care_security.consultation_contact_mutate(p_tenant,p_action,p_request,p_encounter,p_version,p_data) $b$;
COMMIT;
