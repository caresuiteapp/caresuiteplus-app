BEGIN;
-- Company organization: no linked company/partner record grants access to another tenant.
-- Requires the company_access migration.
CREATE UNIQUE INDEX IF NOT EXISTS company_employee_tenant_id_key ON public.employees(tenant_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS company_cost_center_tenant_id_key ON public.tenant_cost_centers(tenant_id,id);

CREATE TABLE public.company_legal_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200), code text,
  legal_form text, registration_number text, tax_number text, vat_id text,
  parent_entity_id uuid, leader_employee_id uuid, website text,
  contact_name text, email text, phone text, street text, postal_code text, city text, country text NOT NULL DEFAULT 'DE' CHECK(country ~ '^[A-Za-z]{2}$'), notes text,
  status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive','archived')),
  version integer NOT NULL DEFAULT 1 CHECK(version>0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,id), FOREIGN KEY(tenant_id,parent_entity_id) REFERENCES public.company_legal_entities(tenant_id,id),
  FOREIGN KEY(tenant_id,leader_employee_id) REFERENCES public.employees(tenant_id,id), CHECK(parent_entity_id IS DISTINCT FROM id)
);
CREATE TABLE public.company_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 200), code text, entity_id uuid,
  kind text NOT NULL CHECK(kind IN ('headquarters','branch','office','service','warehouse','other')),
  leader_employee_id uuid, cost_center_id uuid, opening_hours text,
  contact_name text, email text, phone text, street text, postal_code text, city text, country text NOT NULL DEFAULT 'DE' CHECK(country ~ '^[A-Za-z]{2}$'), notes text,
  status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive','archived')),
  version integer NOT NULL DEFAULT 1 CHECK(version>0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,id), FOREIGN KEY(tenant_id,entity_id) REFERENCES public.company_legal_entities(tenant_id,id),
  FOREIGN KEY(tenant_id,leader_employee_id) REFERENCES public.employees(tenant_id,id),
  FOREIGN KEY(tenant_id,cost_center_id) REFERENCES public.tenant_cost_centers(tenant_id,id)
);
CREATE TABLE public.company_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 200), code text, entity_id uuid, site_id uuid, parent_department_id uuid,
  leader_employee_id uuid, cost_center_id uuid, contact_name text, email text, phone text, notes text,
  status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive','archived')),
  version integer NOT NULL DEFAULT 1 CHECK(version>0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,id), FOREIGN KEY(tenant_id,entity_id) REFERENCES public.company_legal_entities(tenant_id,id),
  FOREIGN KEY(tenant_id,site_id) REFERENCES public.company_sites(tenant_id,id),
  FOREIGN KEY(tenant_id,parent_department_id) REFERENCES public.company_departments(tenant_id,id),
  FOREIGN KEY(tenant_id,leader_employee_id) REFERENCES public.employees(tenant_id,id),
  FOREIGN KEY(tenant_id,cost_center_id) REFERENCES public.tenant_cost_centers(tenant_id,id), CHECK(parent_department_id IS DISTINCT FROM id)
);
CREATE TABLE public.company_employee_placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  employee_id uuid NOT NULL, entity_id uuid, site_id uuid, department_id uuid, role_title text,
  starts_on date NOT NULL, ends_on date, is_primary boolean NOT NULL DEFAULT false,
  allocation_percent numeric(5,2) CHECK(allocation_percent BETWEEN 0 AND 100), notes text,
  status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive','archived')),
  version integer NOT NULL DEFAULT 1 CHECK(version>0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,id), FOREIGN KEY(tenant_id,employee_id) REFERENCES public.employees(tenant_id,id),
  FOREIGN KEY(tenant_id,entity_id) REFERENCES public.company_legal_entities(tenant_id,id),
  FOREIGN KEY(tenant_id,site_id) REFERENCES public.company_sites(tenant_id,id),
  FOREIGN KEY(tenant_id,department_id) REFERENCES public.company_departments(tenant_id,id), CHECK(ends_on IS NULL OR ends_on>=starts_on)
);
CREATE TABLE public.company_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  kind text NOT NULL CHECK(kind IN ('subsidiary','holding','franchise','cooperation')), entity_id uuid, partner_entity_id uuid,
  partner_name text NOT NULL CHECK(length(btrim(partner_name)) BETWEEN 1 AND 200), territory text,
  ownership_percent numeric(5,2) CHECK(ownership_percent BETWEEN 0 AND 100), starts_on date, ends_on date,
  contract_reference text, responsibilities text, contact_name text, email text, phone text, notes text,
  status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive','archived')),
  version integer NOT NULL DEFAULT 1 CHECK(version>0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,id), FOREIGN KEY(tenant_id,entity_id) REFERENCES public.company_legal_entities(tenant_id,id),
  FOREIGN KEY(tenant_id,partner_entity_id) REFERENCES public.company_legal_entities(tenant_id,id),
  CHECK(partner_entity_id IS NULL OR partner_entity_id IS DISTINCT FROM entity_id), CHECK(ends_on IS NULL OR starts_on IS NULL OR ends_on>=starts_on)
);
CREATE TABLE public.company_organization_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  record_kind text NOT NULL CHECK(record_kind IN ('entity','site','department','placement','relationship')),
  record_id uuid NOT NULL, action text NOT NULL CHECK(action IN ('created','updated','archived','restored')),
  actor_id uuid NOT NULL, version integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX company_org_audit_scope ON public.company_organization_audit(tenant_id,created_at DESC);
CREATE INDEX company_placements_employee ON public.company_employee_placements(tenant_id,employee_id,starts_on,ends_on) WHERE status='active';
CREATE UNIQUE INDEX company_entity_code ON public.company_legal_entities(tenant_id,lower(code)) WHERE code IS NOT NULL AND status<>'archived';
CREATE UNIQUE INDEX company_site_code ON public.company_sites(tenant_id,lower(code)) WHERE code IS NOT NULL AND status<>'archived';
CREATE UNIQUE INDEX company_department_code ON public.company_departments(tenant_id,lower(code)) WHERE code IS NOT NULL AND status<>'archived';
CREATE UNIQUE INDEX company_main_site ON public.company_sites(tenant_id,coalesce(entity_id,'00000000-0000-0000-0000-000000000000'::uuid)) WHERE kind='headquarters' AND status='active';

DO $body$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['company_legal_entities','company_sites','company_departments','company_employee_placements','company_relationships','company_organization_audit'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
    EXECUTE format('CREATE POLICY company_read ON public.%I FOR SELECT TO authenticated USING (%s)',t,
      CASE t
        WHEN 'company_legal_entities' THEN 'care_security.company_record_access(tenant_id,''business.tenant.manage'',id,NULL,NULL)'
        WHEN 'company_sites' THEN 'care_security.company_record_access(tenant_id,''business.tenant.manage'',entity_id,id,NULL)'
        WHEN 'company_departments' THEN 'care_security.company_record_access(tenant_id,''business.tenant.manage'',entity_id,site_id,id)'
        WHEN 'company_employee_placements' THEN 'care_security.company_record_access(tenant_id,''business.tenant.manage'',entity_id,site_id,department_id) AND care_security.company_record_access(tenant_id,''office.employees.view'',entity_id,site_id,department_id)'
        WHEN 'company_relationships' THEN 'care_security.company_record_access(tenant_id,''business.tenant.manage'',entity_id,NULL,NULL) AND (partner_entity_id IS NULL OR care_security.company_record_access(tenant_id,''business.tenant.manage'',partner_entity_id,NULL,NULL))'
        ELSE 'care_security.company_actor(tenant_id,''business.tenant.manage'')' END);
  END LOOP;
END $body$;

CREATE OR REPLACE FUNCTION care_security.company_organization_employee_access(p_tenant_id uuid,p_employee_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
  SELECT (care_security.company_actor(p_tenant_id,'business.tenant.manage') AND care_security.company_actor(p_tenant_id,'office.employees.view'))
    OR EXISTS(SELECT 1 FROM public.company_employee_placements p WHERE p.tenant_id=p_tenant_id AND p.employee_id=p_employee_id AND p.status='active'
      AND p.starts_on<=CURRENT_DATE AND (p.ends_on IS NULL OR p.ends_on>=CURRENT_DATE)
      AND care_security.company_record_access(p_tenant_id,'business.tenant.manage',p.entity_id,p.site_id,p.department_id)
      AND care_security.company_record_access(p_tenant_id,'office.employees.view',p.entity_id,p.site_id,p.department_id))
$body$;
REVOKE ALL ON FUNCTION care_security.company_organization_employee_access(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION care_security.company_organization_employee_access(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION care_security.company_organization_choices(p_tenant_id uuid,p_kind text,p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE result jsonb;
BEGIN
  IF NOT coalesce(care_security.company_can_read(p_tenant_id,'business.tenant.manage'),false) OR p_offset<0 THEN RAISE EXCEPTION 'Keine Berechtigung für diese Unternehmensdaten' USING ERRCODE='42501'; END IF;
  IF p_kind='employees' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) INTO result FROM (
      SELECT e.id,e.first_name,e.last_name,e.status FROM public.employees e WHERE e.tenant_id=p_tenant_id
        AND care_security.company_organization_employee_access(p_tenant_id,e.id) ORDER BY e.id LIMIT 500 OFFSET p_offset) t;
  ELSIF p_kind='cost_centers' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) INTO result FROM (
      SELECT c.id,c.code,c.name,c.is_active FROM public.tenant_cost_centers c WHERE c.tenant_id=p_tenant_id AND (
        care_security.company_actor(p_tenant_id,'business.tenant.manage') OR
        EXISTS(SELECT 1 FROM public.company_sites s WHERE s.tenant_id=p_tenant_id AND s.cost_center_id=c.id AND s.status='active' AND care_security.company_record_access(p_tenant_id,'business.tenant.manage',s.entity_id,s.id,NULL)) OR
        EXISTS(SELECT 1 FROM public.company_departments d WHERE d.tenant_id=p_tenant_id AND d.cost_center_id=c.id AND d.status='active' AND care_security.company_record_access(p_tenant_id,'business.tenant.manage',d.entity_id,d.site_id,d.id)))
      ORDER BY c.id LIMIT 500 OFFSET p_offset) t;
  ELSE RAISE EXCEPTION 'Unbekannte Auswahlliste' USING ERRCODE='22023'; END IF;
  RETURN result;
END $body$;
REVOKE ALL ON FUNCTION care_security.company_organization_choices(uuid,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION care_security.company_organization_choices(uuid,text,integer) TO authenticated;
CREATE OR REPLACE FUNCTION public.company_organization_choices(p_tenant_id uuid,p_kind text,p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $body$
  SELECT care_security.company_organization_choices(p_tenant_id,p_kind,p_offset)
$body$;
REVOKE ALL ON FUNCTION public.company_organization_choices(uuid,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.company_organization_choices(uuid,text,integer) TO authenticated;

CREATE OR REPLACE FUNCTION care_security.company_organization_record_access(p_tenant_id uuid,p_kind text,p_record jsonb)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $body$
 SELECT CASE p_kind
   WHEN 'entity' THEN care_security.company_actor(p_tenant_id,'business.tenant.manage')
   WHEN 'site' THEN care_security.company_record_access(p_tenant_id,'business.tenant.manage',(p_record->>'entity_id')::uuid,(p_record->>'id')::uuid,NULL)
   WHEN 'department' THEN care_security.company_record_access(p_tenant_id,'business.tenant.manage',(p_record->>'entity_id')::uuid,(p_record->>'site_id')::uuid,(p_record->>'id')::uuid)
   WHEN 'placement' THEN care_security.company_record_access(p_tenant_id,'business.tenant.manage',(p_record->>'entity_id')::uuid,(p_record->>'site_id')::uuid,(p_record->>'department_id')::uuid)
     AND care_security.company_record_access(p_tenant_id,'office.employees.view',(p_record->>'entity_id')::uuid,(p_record->>'site_id')::uuid,(p_record->>'department_id')::uuid)
   WHEN 'relationship' THEN care_security.company_record_access(p_tenant_id,'business.tenant.manage',(p_record->>'entity_id')::uuid,NULL,NULL)
     AND (p_record->>'partner_entity_id' IS NULL OR care_security.company_record_access(p_tenant_id,'business.tenant.manage',(p_record->>'partner_entity_id')::uuid,NULL,NULL))
   ELSE false END
$body$;
REVOKE ALL ON FUNCTION care_security.company_organization_record_access(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;

-- Called by the single write transaction, also protects maintenance writes from invalid links.
CREATE OR REPLACE FUNCTION care_security.company_organization_validate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE v jsonb:=to_jsonb(NEW); v_parent uuid; v_site public.company_sites; v_department public.company_departments; v_cycle boolean; k text; item jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('company-org:'||NEW.tenant_id::text,0));
  IF TG_OP='UPDATE' AND (NEW.id<>OLD.id OR NEW.tenant_id<>OLD.tenant_id OR NEW.created_at<>OLD.created_at) THEN
    RAISE EXCEPTION 'Die Identität des Eintrags darf nicht geändert werden' USING ERRCODE='23514';
  END IF;
  FOR k,item IN SELECT key,value FROM jsonb_each(v) LOOP
    IF jsonb_typeof(item)='string' AND length(item#>>'{}')>(CASE WHEN k IN ('notes','responsibilities','opening_hours') THEN 4000 ELSE 500 END) THEN
      RAISE EXCEPTION 'Eingabefeld zu lang' USING ERRCODE='23514';
    END IF;
  END LOOP;
  IF v->>'email' IS NOT NULL AND v->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Ungültige E-Mail-Adresse' USING ERRCODE='23514'; END IF;
  IF v->>'website' IS NOT NULL AND v->>'website' !~* '^https?://[^[:space:]/]+(/[^[:space:]]*)?$' THEN RAISE EXCEPTION 'Ungültige Internetadresse' USING ERRCODE='23514'; END IF;
  IF v->>'leader_employee_id' IS NOT NULL AND (TG_OP='INSERT' OR v->>'leader_employee_id' IS DISTINCT FROM to_jsonb(OLD)->>'leader_employee_id') THEN
    IF NOT coalesce(care_security.company_organization_employee_access(NEW.tenant_id,(v->>'leader_employee_id')::uuid),false) THEN RAISE EXCEPTION 'Personalzugriff fehlt' USING ERRCODE='42501'; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.employees e WHERE e.tenant_id=NEW.tenant_id AND e.id=(v->>'leader_employee_id')::uuid AND e.status::text IN ('aktiv','active')) THEN RAISE EXCEPTION 'Die ausgewählte Leitung ist nicht aktiv' USING ERRCODE='23514'; END IF;
  END IF;
  IF NEW.status='active' THEN
    IF v->>'entity_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.company_legal_entities e WHERE e.tenant_id=NEW.tenant_id AND e.id=(v->>'entity_id')::uuid AND e.status='active') THEN RAISE EXCEPTION 'Die Gesellschaft ist nicht aktiv' USING ERRCODE='23514'; END IF;
    IF v->>'partner_entity_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.company_legal_entities e WHERE e.tenant_id=NEW.tenant_id AND e.id=(v->>'partner_entity_id')::uuid AND e.status='active') THEN RAISE EXCEPTION 'Das Partnerunternehmen ist nicht aktiv' USING ERRCODE='23514'; END IF;
    IF v->>'site_id' IS NOT NULL THEN
      SELECT * INTO v_site FROM public.company_sites WHERE tenant_id=NEW.tenant_id AND id=(v->>'site_id')::uuid;
      IF NOT FOUND OR v_site.status<>'active' OR v_site.entity_id IS DISTINCT FROM (v->>'entity_id')::uuid THEN RAISE EXCEPTION 'Standort und Gesellschaft passen nicht zusammen' USING ERRCODE='23514'; END IF;
    END IF;
    IF v->>'department_id' IS NOT NULL THEN
      SELECT * INTO v_department FROM public.company_departments WHERE tenant_id=NEW.tenant_id AND id=(v->>'department_id')::uuid;
      IF NOT FOUND OR v_department.status<>'active' OR v_department.entity_id IS DISTINCT FROM (v->>'entity_id')::uuid OR (v_department.site_id IS NOT NULL AND v_department.site_id IS DISTINCT FROM (v->>'site_id')::uuid) THEN RAISE EXCEPTION 'Abteilung und Standort passen nicht zusammen' USING ERRCODE='23514'; END IF;
    END IF;
    IF v->>'cost_center_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.tenant_cost_centers c WHERE c.tenant_id=NEW.tenant_id AND c.id=(v->>'cost_center_id')::uuid AND c.is_active) THEN RAISE EXCEPTION 'Die Kostenstelle ist nicht aktiv' USING ERRCODE='23514'; END IF;
  END IF;
  IF TG_TABLE_NAME='company_legal_entities' AND (v->>'parent_entity_id')::uuid IS NOT NULL THEN
    IF NEW.status='active' AND NOT EXISTS(SELECT 1 FROM public.company_legal_entities p WHERE p.tenant_id=NEW.tenant_id AND p.id=(v->>'parent_entity_id')::uuid AND p.status='active') THEN RAISE EXCEPTION 'Die übergeordnete Gesellschaft ist nicht aktiv' USING ERRCODE='23514'; END IF;
    WITH RECURSIVE parents AS (SELECT id,parent_entity_id FROM public.company_legal_entities WHERE tenant_id=NEW.tenant_id AND id=(v->>'parent_entity_id')::uuid UNION SELECT e.id,e.parent_entity_id FROM public.company_legal_entities e JOIN parents p ON p.parent_entity_id=e.id WHERE e.tenant_id=NEW.tenant_id)
      SELECT EXISTS(SELECT 1 FROM parents WHERE id=NEW.id) INTO v_cycle;
    IF v_cycle OR (v->>'parent_entity_id')::uuid=NEW.id THEN RAISE EXCEPTION 'Diese Zuordnung würde einen Kreis in der Unternehmensstruktur erzeugen' USING ERRCODE='23514'; END IF;
  END IF;
  IF TG_TABLE_NAME='company_departments' AND (v->>'parent_department_id')::uuid IS NOT NULL THEN
    SELECT * INTO v_department FROM public.company_departments WHERE tenant_id=NEW.tenant_id AND id=(v->>'parent_department_id')::uuid;
    IF NEW.status='active' AND (NOT FOUND OR v_department.status<>'active' OR v_department.entity_id IS DISTINCT FROM (v->>'entity_id')::uuid OR (v_department.site_id IS NOT NULL AND v_department.site_id IS DISTINCT FROM (v->>'site_id')::uuid)) THEN RAISE EXCEPTION 'Die übergeordnete Abteilung passt nicht zur Gesellschaft oder zum Standort' USING ERRCODE='23514'; END IF;
    WITH RECURSIVE parents AS (SELECT id,parent_department_id FROM public.company_departments WHERE tenant_id=NEW.tenant_id AND id=(v->>'parent_department_id')::uuid UNION SELECT d.id,d.parent_department_id FROM public.company_departments d JOIN parents p ON p.parent_department_id=d.id WHERE d.tenant_id=NEW.tenant_id)
      SELECT EXISTS(SELECT 1 FROM parents WHERE id=NEW.id) INTO v_cycle;
    IF v_cycle OR (v->>'parent_department_id')::uuid=NEW.id THEN RAISE EXCEPTION 'Diese Zuordnung würde einen Kreis in der Abteilungsstruktur erzeugen' USING ERRCODE='23514'; END IF;
  END IF;
  IF TG_TABLE_NAME='company_employee_placements' AND NEW.status='active' THEN
    IF NOT coalesce(care_security.company_organization_employee_access(NEW.tenant_id,(v->>'employee_id')::uuid),false) THEN RAISE EXCEPTION 'Personalzugriff fehlt' USING ERRCODE='42501'; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.employees e WHERE e.tenant_id=NEW.tenant_id AND e.id=(v->>'employee_id')::uuid AND e.status::text IN ('aktiv','active')) THEN RAISE EXCEPTION 'Die Person ist nicht aktiv' USING ERRCODE='23514'; END IF;
    IF (v->>'is_primary')::boolean AND EXISTS(SELECT 1 FROM public.company_employee_placements p WHERE p.tenant_id=NEW.tenant_id AND p.employee_id=(v->>'employee_id')::uuid AND p.id<>NEW.id AND p.status='active' AND p.is_primary AND daterange(p.starts_on,p.ends_on,'[]')&&daterange((v->>'starts_on')::date,(v->>'ends_on')::date,'[]')) THEN RAISE EXCEPTION 'Für diesen Zeitraum besteht bereits eine Hauptzuordnung' USING ERRCODE='23514'; END IF;
  END IF;
  IF TG_OP='UPDATE' THEN
    IF TG_TABLE_NAME='company_legal_entities' AND OLD.status='active' AND NEW.status<>'active' AND (
      EXISTS(SELECT 1 FROM public.company_legal_entities WHERE tenant_id=NEW.tenant_id AND parent_entity_id=NEW.id AND status='active') OR
      EXISTS(SELECT 1 FROM public.company_sites WHERE tenant_id=NEW.tenant_id AND entity_id=NEW.id AND status='active') OR
      EXISTS(SELECT 1 FROM public.company_departments WHERE tenant_id=NEW.tenant_id AND entity_id=NEW.id AND status='active') OR
      EXISTS(SELECT 1 FROM public.company_employee_placements WHERE tenant_id=NEW.tenant_id AND entity_id=NEW.id AND status='active') OR
      EXISTS(SELECT 1 FROM public.company_relationships WHERE tenant_id=NEW.tenant_id AND (entity_id=NEW.id OR partner_entity_id=NEW.id) AND status='active')) THEN RAISE EXCEPTION 'Die Gesellschaft hat noch aktive Zuordnungen' USING ERRCODE='23514'; END IF;
    IF TG_TABLE_NAME='company_sites' AND (OLD.status='active' AND NEW.status<>'active' OR (to_jsonb(OLD)->>'entity_id')::uuid IS DISTINCT FROM (v->>'entity_id')::uuid) AND (
      EXISTS(SELECT 1 FROM public.company_departments WHERE tenant_id=NEW.tenant_id AND site_id=NEW.id AND status='active') OR
      EXISTS(SELECT 1 FROM public.company_employee_placements WHERE tenant_id=NEW.tenant_id AND site_id=NEW.id AND status='active')) THEN RAISE EXCEPTION 'Der Standort hat noch aktive Zuordnungen' USING ERRCODE='23514'; END IF;
    IF TG_TABLE_NAME='company_departments' AND (OLD.status='active' AND NEW.status<>'active' OR (to_jsonb(OLD)->>'entity_id')::uuid IS DISTINCT FROM (v->>'entity_id')::uuid OR (to_jsonb(OLD)->>'site_id')::uuid IS DISTINCT FROM (v->>'site_id')::uuid) AND (
      EXISTS(SELECT 1 FROM public.company_departments WHERE tenant_id=NEW.tenant_id AND parent_department_id=NEW.id AND status='active') OR
      EXISTS(SELECT 1 FROM public.company_employee_placements WHERE tenant_id=NEW.tenant_id AND department_id=NEW.id AND status='active')) THEN RAISE EXCEPTION 'Die Abteilung hat noch aktive Zuordnungen' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END $body$;
REVOKE ALL ON FUNCTION care_security.company_organization_validate() FROM PUBLIC,anon,authenticated;

DO $body$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['company_legal_entities','company_sites','company_departments','company_employee_placements','company_relationships'] LOOP
    EXECUTE format('CREATE TRIGGER company_organization_validate BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION care_security.company_organization_validate()',t);
  END LOOP;
END $body$;

CREATE OR REPLACE FUNCTION care_security.company_organization_save(p_tenant_id uuid,p_kind text,p_id uuid,p_expected_version integer,p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE t text; allowed text[]; existing jsonb; merged jsonb; result jsonb; key text; columns_sql text; values_sql text; saved_id uuid; action_name text;
BEGIN
  IF NOT coalesce(care_security.company_can_read(p_tenant_id,'business.tenant.manage'),false) THEN RAISE EXCEPTION 'Keine Berechtigung für diese Unternehmensdaten' USING ERRCODE='42501'; END IF;
  IF p_data IS NULL OR jsonb_typeof(p_data)<>'object' THEN RAISE EXCEPTION 'Ungültige Unternehmensdaten' USING ERRCODE='22023'; END IF;
  CASE p_kind
    WHEN 'entity' THEN t:='company_legal_entities'; allowed:=ARRAY['name','code','legal_form','registration_number','tax_number','vat_id','parent_entity_id','leader_employee_id','website','contact_name','email','phone','street','postal_code','city','country','notes','status'];
    WHEN 'site' THEN t:='company_sites'; allowed:=ARRAY['name','code','entity_id','kind','leader_employee_id','cost_center_id','opening_hours','contact_name','email','phone','street','postal_code','city','country','notes','status'];
    WHEN 'department' THEN t:='company_departments'; allowed:=ARRAY['name','code','entity_id','site_id','parent_department_id','leader_employee_id','cost_center_id','contact_name','email','phone','notes','status'];
    WHEN 'placement' THEN t:='company_employee_placements'; allowed:=ARRAY['employee_id','entity_id','site_id','department_id','role_title','starts_on','ends_on','is_primary','allocation_percent','notes','status'];
    WHEN 'relationship' THEN t:='company_relationships'; allowed:=ARRAY['kind','entity_id','partner_entity_id','partner_name','territory','ownership_percent','starts_on','ends_on','contract_reference','responsibilities','contact_name','email','phone','notes','status'];
    ELSE RAISE EXCEPTION 'Unbekannter Organisationsbereich' USING ERRCODE='22023';
  END CASE;
  FOR key IN SELECT jsonb_object_keys(p_data) LOOP
    IF NOT key=ANY(allowed) THEN RAISE EXCEPTION 'Unzulässiges Eingabefeld' USING ERRCODE='22023'; END IF;
    IF jsonb_typeof(p_data->key)='string' THEN p_data:=jsonb_set(p_data,ARRAY[key],coalesce(to_jsonb(nullif(btrim(p_data->>key),'')),'null'::jsonb)); END IF;
  END LOOP;
  PERFORM pg_advisory_xact_lock(hashtextextended('company-org:'||p_tenant_id::text,0));
  IF p_id IS NOT NULL THEN
    EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE tenant_id=$1 AND id=$2 FOR UPDATE',t) INTO existing USING p_tenant_id,p_id;
    IF existing IS NULL OR p_expected_version IS NULL OR (existing->>'version')::integer<>p_expected_version THEN RAISE EXCEPTION 'Der Eintrag wurde geändert oder ist nicht verfügbar' USING ERRCODE='40001'; END IF;
    merged:=existing||p_data||jsonb_build_object('version',p_expected_version+1,'updated_at',clock_timestamp());
    IF NOT coalesce(care_security.company_organization_record_access(p_tenant_id,p_kind,existing),false) OR NOT coalesce(care_security.company_organization_record_access(p_tenant_id,p_kind,merged),false) THEN RAISE EXCEPTION 'Der Eintrag liegt außerhalb Ihres Zuständigkeitsbereichs' USING ERRCODE='42501'; END IF;
    IF NOT coalesce(care_security.company_actor(p_tenant_id,'business.tenant.manage'),false) AND (
      (p_kind='site' AND existing->'entity_id' IS DISTINCT FROM merged->'entity_id') OR
      (p_kind='department' AND (existing->'entity_id' IS DISTINCT FROM merged->'entity_id' OR existing->'site_id' IS DISTINCT FROM merged->'site_id' OR existing->'parent_department_id' IS DISTINCT FROM merged->'parent_department_id')))
    THEN RAISE EXCEPTION 'Die übergeordnete Organisationszuordnung wird durch die zentrale Verwaltung geändert' USING ERRCODE='42501'; END IF;
    SELECT string_agg(format('%I=r.%I',a,a),',') INTO columns_sql FROM unnest(allowed||ARRAY['version','updated_at']) a;
    EXECUTE format('UPDATE public.%I t SET %s FROM jsonb_populate_record(NULL::public.%I,$1) r WHERE t.tenant_id=$2 AND t.id=$3 RETURNING to_jsonb(t)',t,columns_sql,t) INTO result USING merged,p_tenant_id,p_id;
    action_name:=CASE WHEN existing->>'status'<>'archived' AND result->>'status'='archived' THEN 'archived' WHEN existing->>'status'='archived' AND result->>'status'<>'archived' THEN 'restored' ELSE 'updated' END;
  ELSE
    IF p_expected_version IS NOT NULL THEN RAISE EXCEPTION 'Für neue Einträge darf keine Vorversion angegeben werden' USING ERRCODE='22023'; END IF;
    saved_id:=gen_random_uuid();
    merged:=jsonb_build_object('status','active','country','DE','is_primary',false)||p_data||jsonb_build_object('id',saved_id,'tenant_id',p_tenant_id,'version',1,'created_at',clock_timestamp(),'updated_at',clock_timestamp());
    IF NOT coalesce(care_security.company_organization_record_access(p_tenant_id,p_kind,merged),false) THEN RAISE EXCEPTION 'Der Eintrag liegt außerhalb Ihres Zuständigkeitsbereichs' USING ERRCODE='42501'; END IF;
    EXECUTE format('INSERT INTO public.%I SELECT (jsonb_populate_record(NULL::public.%I,$1)).* RETURNING to_jsonb(%I)',t,t,t) INTO result USING merged;
    action_name:='created';
  END IF;
  INSERT INTO public.company_organization_audit(tenant_id,record_kind,record_id,action,actor_id,version)
    VALUES(p_tenant_id,p_kind,(result->>'id')::uuid,action_name,auth.uid(),(result->>'version')::integer);
  RETURN result;
END $body$;
REVOKE ALL ON FUNCTION care_security.company_organization_save(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION care_security.company_organization_save(uuid,text,uuid,integer,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.company_organization_save(p_tenant_id uuid,p_kind text,p_id uuid,p_expected_version integer,p_data jsonb)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $body$
  SELECT care_security.company_organization_save(p_tenant_id,p_kind,p_id,p_expected_version,p_data)
$body$;
REVOKE ALL ON FUNCTION public.company_organization_save(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.company_organization_save(uuid,text,uuid,integer,jsonb) TO authenticated;

COMMIT;
