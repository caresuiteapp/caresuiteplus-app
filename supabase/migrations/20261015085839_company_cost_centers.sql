BEGIN;
-- Existing time-tracking cost centers become the shared company catalog.
-- Apply after company_access, organization and scope access migrations.
-- Existing time-tracking RLS policies and grants remain unchanged.
-- Only these company entry points require unrestricted company-management access.

CREATE OR REPLACE FUNCTION care_security.company_cost_center_timestamp()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $body$
BEGIN
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END $body$;
REVOKE ALL ON FUNCTION care_security.company_cost_center_timestamp() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS company_cost_center_timestamp ON public.tenant_cost_centers;
CREATE TRIGGER company_cost_center_timestamp BEFORE UPDATE ON public.tenant_cost_centers
FOR EACH ROW EXECUTE FUNCTION care_security.company_cost_center_timestamp();

CREATE OR REPLACE FUNCTION care_security.company_cost_centers_read(p_tenant_id uuid,p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
BEGIN
  IF NOT coalesce(care_security.company_actor(p_tenant_id,'business.tenant.manage'),false) THEN RAISE EXCEPTION 'Keine Berechtigung für die unternehmensweiten Kostenstellen' USING ERRCODE='42501'; END IF;
  IF p_offset < 0 OR p_offset IS NULL THEN RAISE EXCEPTION 'Ungültige Seite' USING ERRCODE='22023'; END IF;
  RETURN jsonb_build_object(
    'costCenters',coalesce((SELECT jsonb_agg(to_jsonb(c)) FROM (SELECT id,tenant_id,organization_id,code,name,is_active,updated_at FROM public.tenant_cost_centers WHERE tenant_id=p_tenant_id ORDER BY id LIMIT 200 OFFSET p_offset) c),'[]'::jsonb),
    'organizations',coalesce((SELECT jsonb_agg(to_jsonb(o)) FROM (SELECT id,code,name,is_active FROM public.tenant_work_organizations WHERE tenant_id=p_tenant_id ORDER BY id LIMIT 200 OFFSET p_offset) o),'[]'::jsonb)
  );
END $body$;
CREATE OR REPLACE FUNCTION public.company_cost_centers_read(p_tenant_id uuid,p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $body$
  SELECT care_security.company_cost_centers_read(p_tenant_id,p_offset)
$body$;

CREATE OR REPLACE FUNCTION care_security.company_cost_center_save(p_tenant_id uuid,p_id uuid,p_expected_updated_at timestamptz,p_code text,p_name text,p_organization_id uuid,p_is_active boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE previous public.tenant_cost_centers; saved public.tenant_cost_centers; normalized_code text:=upper(btrim(p_code)); normalized_name text:=btrim(p_name);
BEGIN
  IF NOT coalesce(care_security.company_actor(p_tenant_id,'business.tenant.manage'),false) THEN RAISE EXCEPTION 'Keine Berechtigung für die unternehmensweiten Kostenstellen' USING ERRCODE='42501'; END IF;
  IF normalized_code IS NULL OR normalized_code !~ '^[A-Z0-9][A-Z0-9._/-]{0,39}$' OR normalized_name IS NULL OR length(normalized_name) NOT BETWEEN 1 AND 160 OR p_is_active IS NULL THEN RAISE EXCEPTION 'Bitte Kürzel, Bezeichnung und Status vollständig prüfen' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('company-cost-centers:'||p_tenant_id::text,0));
  IF p_id IS NOT NULL THEN
    SELECT * INTO previous FROM public.tenant_cost_centers WHERE tenant_id=p_tenant_id AND id=p_id FOR UPDATE;
    IF previous.id IS NULL OR p_expected_updated_at IS NULL OR previous.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'Die Kostenstelle wurde geändert oder ist nicht verfügbar. Bitte neu laden.' USING ERRCODE='40001'; END IF;
  ELSIF p_expected_updated_at IS NOT NULL THEN RAISE EXCEPTION 'Neue Kostenstellen haben keinen vorherigen Speicherstand' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM public.tenant_cost_centers c WHERE c.tenant_id=p_tenant_id AND lower(c.code)=lower(normalized_code) AND c.id IS DISTINCT FROM p_id) THEN RAISE EXCEPTION 'Dieses Kostenstellenkürzel ist bereits vergeben' USING ERRCODE='23505'; END IF;
  IF p_organization_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.tenant_work_organizations o WHERE o.tenant_id=p_tenant_id AND o.id=p_organization_id AND (o.is_active OR previous.organization_id=o.id)) THEN RAISE EXCEPTION 'Der gewählte Arbeitsbereich gehört nicht zum Unternehmen oder ist inaktiv' USING ERRCODE='23514'; END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.tenant_cost_centers(tenant_id,code,name,organization_id,is_active)
      VALUES(p_tenant_id,normalized_code,normalized_name,p_organization_id,p_is_active) RETURNING * INTO saved;
  ELSE
    UPDATE public.tenant_cost_centers SET code=normalized_code,name=normalized_name,organization_id=p_organization_id,is_active=p_is_active,updated_at=clock_timestamp()
      WHERE tenant_id=p_tenant_id AND id=p_id RETURNING * INTO saved;
  END IF;
  RETURN jsonb_build_object('id',saved.id,'tenant_id',saved.tenant_id,'code',saved.code,'name',saved.name,'organization_id',saved.organization_id,'is_active',saved.is_active,'updated_at',saved.updated_at);
END $body$;
CREATE OR REPLACE FUNCTION public.company_cost_center_save(p_tenant_id uuid,p_id uuid,p_expected_updated_at timestamptz,p_code text,p_name text,p_organization_id uuid,p_is_active boolean)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $body$
  SELECT care_security.company_cost_center_save(p_tenant_id,p_id,p_expected_updated_at,p_code,p_name,p_organization_id,p_is_active)
$body$;
REVOKE ALL ON FUNCTION care_security.company_cost_centers_read(uuid,integer),public.company_cost_centers_read(uuid,integer),care_security.company_cost_center_save(uuid,uuid,timestamptz,text,text,uuid,boolean),public.company_cost_center_save(uuid,uuid,timestamptz,text,text,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION care_security.company_cost_centers_read(uuid,integer),public.company_cost_centers_read(uuid,integer),care_security.company_cost_center_save(uuid,uuid,timestamptz,text,text,uuid,boolean),public.company_cost_center_save(uuid,uuid,timestamptz,text,text,uuid,boolean) TO authenticated;

COMMIT;
