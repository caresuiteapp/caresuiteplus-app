-- Requires company_access.sql and company_organization.sql. Requires the preceding company access and organization migrations.
BEGIN;
CREATE UNIQUE INDEX IF NOT EXISTS company_profiles_tenant_id_key ON public.profiles(tenant_id,id);
CREATE TABLE public.company_scope_profiles (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id), profile_id uuid NOT NULL,
  scope_limited boolean NOT NULL DEFAULT true, version integer NOT NULL DEFAULT 1 CHECK(version>0),
  updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid NOT NULL,
  PRIMARY KEY(tenant_id,profile_id), FOREIGN KEY(tenant_id,profile_id) REFERENCES public.profiles(tenant_id,id),
  FOREIGN KEY(tenant_id,updated_by) REFERENCES public.profiles(tenant_id,id)
);
CREATE TABLE public.company_scope_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, profile_id uuid NOT NULL,
  entity_id uuid, site_id uuid, department_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(), created_by uuid NOT NULL,
  CHECK(num_nonnulls(entity_id,site_id,department_id)=1),
  FOREIGN KEY(tenant_id,profile_id) REFERENCES public.company_scope_profiles(tenant_id,profile_id) ON DELETE CASCADE,
  FOREIGN KEY(tenant_id,entity_id) REFERENCES public.company_legal_entities(tenant_id,id),
  FOREIGN KEY(tenant_id,site_id) REFERENCES public.company_sites(tenant_id,id),
  FOREIGN KEY(tenant_id,department_id) REFERENCES public.company_departments(tenant_id,id),
  FOREIGN KEY(tenant_id,created_by) REFERENCES public.profiles(tenant_id,id)
);
CREATE UNIQUE INDEX company_scope_grant_unique ON public.company_scope_grants(tenant_id,profile_id,
  coalesce(entity_id,'00000000-0000-0000-0000-000000000000'::uuid),coalesce(site_id,'00000000-0000-0000-0000-000000000000'::uuid),coalesce(department_id,'00000000-0000-0000-0000-000000000000'::uuid));
CREATE TABLE public.company_scope_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),profile_id uuid NOT NULL,actor_id uuid NOT NULL,
  before_value jsonb, after_value jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(tenant_id,profile_id) REFERENCES public.profiles(tenant_id,id),FOREIGN KEY(tenant_id,actor_id) REFERENCES public.profiles(tenant_id,id)
);
CREATE INDEX company_scope_audit_tenant_time ON public.company_scope_audit(tenant_id,created_at DESC);
ALTER TABLE public.company_scope_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_scope_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_scope_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_scope_profiles,public.company_scope_grants,public.company_scope_audit FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.company_scope_profiles,public.company_scope_grants,public.company_scope_audit TO authenticated;
GRANT ALL ON public.company_scope_profiles,public.company_scope_grants,public.company_scope_audit TO service_role;

CREATE OR REPLACE FUNCTION care_security.company_legacy_scope_limited(p_tenant uuid,p_profile uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
  SELECT EXISTS(SELECT 1 FROM public.employee_data_scopes s JOIN public.employees e ON e.id=s.employee_id AND e.tenant_id=s.tenant_id
    WHERE s.tenant_id=p_tenant AND e.profile_id=p_profile
    AND lower(btrim(s.module)) IN ('office','business','company','unternehmen','all','*','')
    AND (s.scope_type<>'tenant' OR nullif(btrim(s.scope_value),'') IS NOT NULL AND btrim(s.scope_value)<>p_tenant::text))
$body$;
CREATE OR REPLACE FUNCTION care_security.company_unrestricted_scope(p_tenant uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
  SELECT care_security.company_profile(p_tenant) IS NOT NULL
    AND NOT care_security.company_legacy_scope_limited(p_tenant,care_security.company_profile(p_tenant))
    AND NOT EXISTS(SELECT 1 FROM public.company_scope_profiles s WHERE s.tenant_id=p_tenant AND s.profile_id=care_security.company_profile(p_tenant) AND s.scope_limited)
$body$;
CREATE OR REPLACE FUNCTION care_security.company_rbac_administrator(p_tenant uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
  SELECT care_security.company_unrestricted_scope(p_tenant) AND EXISTS(
    SELECT 1 FROM public.profiles p JOIN public.roles r ON r.id=p.role_id
    WHERE p.id=care_security.company_profile(p_tenant)
      AND (coalesce((to_jsonb(r)->>'is_admin_role')::boolean,false)
        OR coalesce((to_jsonb(r)->>'can_manage_roles')::boolean,false)
        OR lower(r.key) IN ('owner','admin','business_admin')))
$body$;
CREATE OR REPLACE FUNCTION care_security.company_active_scope_grant(p_tenant uuid,p_profile uuid,p_entity uuid,p_site uuid,p_department uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
  SELECT EXISTS(SELECT 1 FROM public.company_scope_grants g
    WHERE g.tenant_id=p_tenant AND g.profile_id=p_profile AND (
      (g.entity_id IS NOT NULL AND g.entity_id=p_entity AND EXISTS(SELECT 1 FROM public.company_legal_entities e WHERE e.tenant_id=p_tenant AND e.id=g.entity_id AND e.status='active'))
      OR (g.site_id IS NOT NULL AND g.site_id=p_site AND EXISTS(SELECT 1 FROM public.company_sites s WHERE s.tenant_id=p_tenant AND s.id=g.site_id AND s.status='active'
        AND (s.entity_id IS NULL OR EXISTS(SELECT 1 FROM public.company_legal_entities e WHERE e.tenant_id=p_tenant AND e.id=s.entity_id AND e.status='active'))))
      OR (g.department_id IS NOT NULL AND g.department_id=p_department AND EXISTS(SELECT 1 FROM public.company_departments d WHERE d.tenant_id=p_tenant AND d.id=g.department_id AND d.status='active'
        AND (d.entity_id IS NULL OR EXISTS(SELECT 1 FROM public.company_legal_entities e WHERE e.tenant_id=p_tenant AND e.id=d.entity_id AND e.status='active'))
        AND (d.site_id IS NULL OR EXISTS(SELECT 1 FROM public.company_sites s WHERE s.tenant_id=p_tenant AND s.id=d.site_id AND s.status='active'))))
    ))
$body$;
CREATE OR REPLACE FUNCTION care_security.company_record_access(p_tenant uuid,p_permission text,p_entity uuid DEFAULT NULL,p_site uuid DEFAULT NULL,p_department uuid DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
  SELECT care_security.company_permission(p_tenant,p_permission) AND (
    care_security.company_unrestricted_scope(p_tenant)
    OR care_security.company_active_scope_grant(p_tenant,care_security.company_profile(p_tenant),p_entity,p_site,p_department))
$body$;
CREATE OR REPLACE FUNCTION care_security.company_can_read(p_tenant uuid,p_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
  SELECT care_security.company_permission(p_tenant,p_permission) AND (care_security.company_unrestricted_scope(p_tenant)
    OR EXISTS(SELECT 1 FROM public.company_scope_grants g WHERE g.tenant_id=p_tenant AND g.profile_id=care_security.company_profile(p_tenant)
      AND care_security.company_active_scope_grant(p_tenant,g.profile_id,g.entity_id,g.site_id,g.department_id)))
$body$;
CREATE POLICY company_scope_profiles_read ON public.company_scope_profiles FOR SELECT TO authenticated
  USING(care_security.company_actor(tenant_id,'business.tenant.manage') AND care_security.company_rbac_administrator(tenant_id));
CREATE POLICY company_scope_grants_read ON public.company_scope_grants FOR SELECT TO authenticated
  USING(care_security.company_actor(tenant_id,'business.tenant.manage') AND care_security.company_rbac_administrator(tenant_id));
CREATE POLICY company_scope_audit_read ON public.company_scope_audit FOR SELECT TO authenticated
  USING(care_security.company_actor(tenant_id,'business.tenant.manage') AND care_security.company_rbac_administrator(tenant_id));

CREATE OR REPLACE FUNCTION care_security.company_scope_people(p_tenant uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE v_people jsonb;
BEGIN
  IF NOT (care_security.company_actor(p_tenant,'business.tenant.manage') AND care_security.company_rbac_administrator(p_tenant)) THEN
    RAISE EXCEPTION 'Zugriffsverwaltung ist nicht freigegeben' USING ERRCODE='42501'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'displayName',coalesce(nullif(to_jsonb(p)->>'display_name',''),nullif(concat_ws(' ',to_jsonb(p)->>'first_name',to_jsonb(p)->>'last_name'),''),'Verwaltungszugang'),
    'roleKey',r.key,'scopeLimited',coalesce(s.scope_limited,false) OR care_security.company_legacy_scope_limited(p_tenant,p.id),
    'version',coalesce(s.version,0),'hasLegacyLimits',care_security.company_legacy_scope_limited(p_tenant,p.id),
    'isCurrentProfile',p.id=care_security.company_profile(p_tenant),
    'grants',coalesce((SELECT jsonb_agg(jsonb_build_object('kind',CASE WHEN g.entity_id IS NOT NULL THEN 'entity' WHEN g.site_id IS NOT NULL THEN 'site' ELSE 'department' END,
      'targetId',coalesce(g.entity_id,g.site_id,g.department_id)) ORDER BY g.id) FROM public.company_scope_grants g WHERE g.tenant_id=p_tenant AND g.profile_id=p.id),'[]'::jsonb)) ORDER BY p.id),'[]'::jsonb) INTO v_people
    FROM public.profiles p JOIN public.roles r ON r.id=p.role_id LEFT JOIN public.company_scope_profiles s ON s.tenant_id=p.tenant_id AND s.profile_id=p.id
    WHERE p.tenant_id=p_tenant AND p.is_active AND p.status::text='active'
      AND (to_jsonb(r)->>'tenant_id' IS NULL OR to_jsonb(r)->>'tenant_id'=p_tenant::text)
      AND lower(r.key) NOT IN ('employee_portal','client_portal','family_portal','employee','client','family','relative','caregiver','nurse');
  RETURN jsonb_build_object('profiles',v_people);
END $body$;
CREATE OR REPLACE FUNCTION public.company_scope_people(p_tenant_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $body$ SELECT care_security.company_scope_people(p_tenant_id) $body$;

CREATE OR REPLACE FUNCTION care_security.company_scope_save(p_tenant uuid,p_profile uuid,p_limited boolean,p_grants jsonb,p_expected_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE v_actor uuid:=care_security.company_profile(p_tenant); v_current public.company_scope_profiles; v_before jsonb; v_next integer; g jsonb; v_kind text; v_target uuid;
BEGIN
  IF NOT (care_security.company_actor(p_tenant,'business.tenant.manage') AND care_security.company_rbac_administrator(p_tenant)) THEN
    RAISE EXCEPTION 'Zugriffsverwaltung ist nicht freigegeben' USING ERRCODE='42501'; END IF;
  IF p_profile=v_actor THEN RAISE EXCEPTION 'Der eigene Verwaltungszugriff kann hier nicht geändert werden' USING ERRCODE='42501'; END IF;
  IF p_limited IS NULL OR p_expected_version IS NULL OR p_expected_version<0 OR jsonb_typeof(p_grants) IS DISTINCT FROM 'array' OR jsonb_array_length(p_grants)>100 THEN
    RAISE EXCEPTION 'Ungültige Zugriffsangaben' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('company-org:'||p_tenant::text,0));
  PERFORM 1 FROM public.profiles p JOIN public.roles r ON r.id=p.role_id WHERE p.id=p_profile AND p.tenant_id=p_tenant AND p.is_active AND p.status::text='active'
    AND (to_jsonb(r)->>'tenant_id' IS NULL OR to_jsonb(r)->>'tenant_id'=p_tenant::text)
    AND lower(r.key) NOT IN ('employee_portal','client_portal','family_portal','employee','client','family','relative','caregiver','nurse') FOR UPDATE OF p;
  IF NOT FOUND THEN RAISE EXCEPTION 'Verwaltungszugang nicht gefunden' USING ERRCODE='23514'; END IF;
  IF NOT p_limited AND care_security.company_legacy_scope_limited(p_tenant,p_profile) THEN
    RAISE EXCEPTION 'In der Personalakte bestehen noch Datenbereichsbeschränkungen. Diese müssen zuerst geprüft werden.' USING ERRCODE='23514'; END IF;
  IF NOT p_limited AND jsonb_array_length(p_grants)>0 THEN RAISE EXCEPTION 'Uneingeschränkter Zugriff benötigt keine Bereichszuordnungen' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_current FROM public.company_scope_profiles WHERE tenant_id=p_tenant AND profile_id=p_profile FOR UPDATE;
  IF coalesce(v_current.version,0)<>p_expected_version THEN RAISE EXCEPTION 'Die Zugriffsrechte wurden inzwischen geändert' USING ERRCODE='40001'; END IF;
  SELECT jsonb_build_object('scopeLimited',coalesce(v_current.scope_limited,false),'grants',coalesce(jsonb_agg(to_jsonb(saved_grant)),'[]'::jsonb)) INTO v_before
    FROM public.company_scope_grants saved_grant WHERE saved_grant.tenant_id=p_tenant AND saved_grant.profile_id=p_profile;
  v_next:=p_expected_version+1;
  INSERT INTO public.company_scope_profiles(tenant_id,profile_id,scope_limited,version,updated_by) VALUES(p_tenant,p_profile,p_limited,v_next,v_actor)
    ON CONFLICT(tenant_id,profile_id) DO UPDATE SET scope_limited=excluded.scope_limited,version=excluded.version,updated_at=now(),updated_by=v_actor;
  DELETE FROM public.company_scope_grants WHERE tenant_id=p_tenant AND profile_id=p_profile;
  FOR g IN SELECT value FROM jsonb_array_elements(p_grants) LOOP
    IF jsonb_typeof(g) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(g))<>2 THEN RAISE EXCEPTION 'Ungültige Bereichszuordnung' USING ERRCODE='22023'; END IF;
    v_kind:=g->>'kind'; v_target:=(g->>'targetId')::uuid;
    IF v_kind='entity' AND EXISTS(SELECT 1 FROM public.company_legal_entities WHERE tenant_id=p_tenant AND id=v_target AND status='active') THEN
      INSERT INTO public.company_scope_grants(tenant_id,profile_id,entity_id,created_by) VALUES(p_tenant,p_profile,v_target,v_actor);
    ELSIF v_kind='site' AND EXISTS(SELECT 1 FROM public.company_sites WHERE tenant_id=p_tenant AND id=v_target AND status='active') THEN
      INSERT INTO public.company_scope_grants(tenant_id,profile_id,site_id,created_by) VALUES(p_tenant,p_profile,v_target,v_actor);
    ELSIF v_kind='department' AND EXISTS(SELECT 1 FROM public.company_departments WHERE tenant_id=p_tenant AND id=v_target AND status='active') THEN
      INSERT INTO public.company_scope_grants(tenant_id,profile_id,department_id,created_by) VALUES(p_tenant,p_profile,v_target,v_actor);
    ELSE RAISE EXCEPTION 'Der zugewiesene Unternehmensbereich ist nicht aktiv oder gehört zu einem anderen Unternehmen' USING ERRCODE='23514'; END IF;
  END LOOP;
  INSERT INTO public.company_scope_audit(tenant_id,profile_id,actor_id,before_value,after_value) VALUES(p_tenant,p_profile,v_actor,v_before,jsonb_build_object('scopeLimited',p_limited,'grants',p_grants,'version',v_next));
  RETURN jsonb_build_object('profileId',p_profile,'scopeLimited',p_limited,'version',v_next);
END $body$;
CREATE OR REPLACE FUNCTION public.company_scope_save(p_tenant_id uuid,p_profile_id uuid,p_scope_limited boolean,p_grants jsonb,p_expected_version integer)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $body$
  SELECT care_security.company_scope_save(p_tenant_id,p_profile_id,p_scope_limited,p_grants,p_expected_version)
$body$;
REVOKE ALL ON FUNCTION care_security.company_legacy_scope_limited(uuid,uuid),care_security.company_active_scope_grant(uuid,uuid,uuid,uuid,uuid),
  care_security.company_scope_people(uuid),public.company_scope_people(uuid),care_security.company_scope_save(uuid,uuid,boolean,jsonb,integer),public.company_scope_save(uuid,uuid,boolean,jsonb,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION care_security.company_scope_people(uuid),public.company_scope_people(uuid),care_security.company_scope_save(uuid,uuid,boolean,jsonb,integer),public.company_scope_save(uuid,uuid,boolean,jsonb,integer) TO authenticated;
COMMIT;
