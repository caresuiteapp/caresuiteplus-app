-- Company resources. Requires company access, organization and scope access migrations.
-- No data seeding, no fabricated reminders, no automatic identification by matching plates.
BEGIN;
CREATE UNIQUE INDEX IF NOT EXISTS employees_tenant_id_company_resources_uidx ON public.employees(tenant_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS inventory_items_tenant_id_company_resources_uidx ON public.inventory_items(tenant_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS central_documents_tenant_id_company_resources_uidx ON public.central_document_records(tenant_id,id);
CREATE TABLE public.company_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  version integer NOT NULL DEFAULT 1 CHECK(version > 0),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  entity_id uuid, site_id uuid, department_id uuid, title text NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 500), contract_type text NOT NULL CHECK(length(trim(contract_type)) BETWEEN 1 AND 150),
  counterparty text NOT NULL CHECK(length(trim(counterparty)) BETWEEN 1 AND 500), reference text, status text NOT NULL DEFAULT 'active' CHECK(status IN ('draft','active','ended','archived')),
  starts_on date, ends_on date, notice_on date, notice_rule text, renewal_rule text, review_on date,
  responsible_employee_id uuid, cost_cents bigint CHECK(cost_cents BETWEEN 0 AND 9000000000000), payment_interval text NOT NULL DEFAULT 'yearly' CHECK(payment_interval IN ('once','monthly','quarterly','half_yearly','yearly')), currency text NOT NULL DEFAULT 'EUR' CHECK(currency='EUR'), document_id uuid, notes text,
  CHECK(ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on), FOREIGN KEY(tenant_id,entity_id) REFERENCES public.company_legal_entities(tenant_id,id),
  FOREIGN KEY(tenant_id,site_id) REFERENCES public.company_sites(tenant_id,id),
  FOREIGN KEY(tenant_id,department_id) REFERENCES public.company_departments(tenant_id,id),
  FOREIGN KEY(tenant_id,responsible_employee_id) REFERENCES public.employees(tenant_id,id),
  FOREIGN KEY(tenant_id,document_id) REFERENCES public.central_document_records(tenant_id,id), UNIQUE(tenant_id,id)
);
CREATE TABLE public.company_insurance_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  version integer NOT NULL DEFAULT 1 CHECK(version > 0),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  entity_id uuid, site_id uuid, department_id uuid, title text NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 500), insurance_type text NOT NULL CHECK(length(trim(insurance_type)) BETWEEN 1 AND 150),
  provider text NOT NULL CHECK(length(trim(provider)) BETWEEN 1 AND 500), policy_number text NOT NULL CHECK(length(trim(policy_number)) BETWEEN 1 AND 150), status text NOT NULL DEFAULT 'active' CHECK(status IN ('draft','active','ended','archived')),
  starts_on date, ends_on date, notice_on date, review_on date,
  coverage_cents bigint CHECK(coverage_cents BETWEEN 0 AND 9000000000000), excess_cents bigint CHECK(excess_cents BETWEEN 0 AND 9000000000000), premium_cents bigint CHECK(premium_cents BETWEEN 0 AND 9000000000000), payment_interval text NOT NULL DEFAULT 'yearly' CHECK(payment_interval IN ('once','monthly','quarterly','half_yearly','yearly')), currency text NOT NULL DEFAULT 'EUR' CHECK(currency='EUR'), coverage_description text,
  contract_id uuid, responsible_employee_id uuid, document_id uuid, notes text,
  CHECK(ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on), FOREIGN KEY(tenant_id,entity_id) REFERENCES public.company_legal_entities(tenant_id,id),
  FOREIGN KEY(tenant_id,site_id) REFERENCES public.company_sites(tenant_id,id),
  FOREIGN KEY(tenant_id,department_id) REFERENCES public.company_departments(tenant_id,id),
  FOREIGN KEY(tenant_id,responsible_employee_id) REFERENCES public.employees(tenant_id,id),
  FOREIGN KEY(tenant_id,contract_id) REFERENCES public.company_contracts(tenant_id,id),
  FOREIGN KEY(tenant_id,document_id) REFERENCES public.central_document_records(tenant_id,id), UNIQUE(tenant_id,id)
);
CREATE TABLE public.company_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  version integer NOT NULL DEFAULT 1 CHECK(version > 0),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  entity_id uuid, site_id uuid, department_id uuid, plate text NOT NULL CHECK(length(trim(plate)) BETWEEN 2 AND 30),
  vin text CHECK(vin IS NULL OR vin ~ '^[A-HJ-NPR-Z0-9]{17}$'), make text, model text, vehicle_type text NOT NULL,
  ownership text NOT NULL CHECK(ownership IN ('owned','leased','rented')),
  status text NOT NULL DEFAULT 'available' CHECK(status IN ('available','maintenance','unavailable','archived')),
  mileage numeric(12,2) NOT NULL DEFAULT 0 CHECK(mileage BETWEEN 0 AND 10000000), first_registration_on date,
  purchased_on date, lease_ends_on date, hu_due_on date, service_due_on date, service_due_mileage numeric(12,2) CHECK(service_due_mileage BETWEEN 0 AND 10000000),
  insurance_policy_id uuid, contract_id uuid, inventory_item_id uuid, document_id uuid, notes text, FOREIGN KEY(tenant_id,entity_id) REFERENCES public.company_legal_entities(tenant_id,id),
  FOREIGN KEY(tenant_id,site_id) REFERENCES public.company_sites(tenant_id,id),
  FOREIGN KEY(tenant_id,department_id) REFERENCES public.company_departments(tenant_id,id),
  FOREIGN KEY(tenant_id,insurance_policy_id) REFERENCES public.company_insurance_policies(tenant_id,id),
  FOREIGN KEY(tenant_id,contract_id) REFERENCES public.company_contracts(tenant_id,id),
  FOREIGN KEY(tenant_id,inventory_item_id) REFERENCES public.inventory_items(tenant_id,id),
  FOREIGN KEY(tenant_id,document_id) REFERENCES public.central_document_records(tenant_id,id), UNIQUE(tenant_id,id)
);
CREATE TABLE public.company_vehicle_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  version integer NOT NULL DEFAULT 1 CHECK(version > 0),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  vehicle_id uuid NOT NULL, employee_id uuid NOT NULL, starts_at timestamptz NOT NULL, ends_at timestamptz,
  status text NOT NULL CHECK(status IN ('planned','active','returned','cancelled')),
  issue_mileage numeric(12,2) NOT NULL CHECK(issue_mileage BETWEEN 0 AND 10000000), issue_condition text NOT NULL CHECK(length(trim(issue_condition)) BETWEEN 1 AND 2000),
  returned_at timestamptz, return_mileage numeric(12,2), return_condition text, notes text,
  CHECK(ends_at IS NULL OR ends_at > starts_at), CHECK(returned_at IS NULL OR returned_at >= starts_at),
  CHECK((status='returned') = (returned_at IS NOT NULL AND return_mileage IS NOT NULL AND return_condition IS NOT NULL)),
  CHECK(return_mileage IS NULL OR return_mileage BETWEEN issue_mileage AND 10000000),
  FOREIGN KEY(tenant_id,vehicle_id) REFERENCES public.company_vehicles(tenant_id,id),
  FOREIGN KEY(tenant_id,employee_id) REFERENCES public.employees(tenant_id,id), UNIQUE(tenant_id,id)
);
CREATE TABLE public.company_asset_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  version integer NOT NULL DEFAULT 1 CHECK(version > 0),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  entity_id uuid, site_id uuid, department_id uuid, inventory_item_id uuid NOT NULL, vehicle_id uuid,
  status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')), notes text, FOREIGN KEY(tenant_id,entity_id) REFERENCES public.company_legal_entities(tenant_id,id),
  FOREIGN KEY(tenant_id,site_id) REFERENCES public.company_sites(tenant_id,id),
  FOREIGN KEY(tenant_id,department_id) REFERENCES public.company_departments(tenant_id,id),
  FOREIGN KEY(tenant_id,inventory_item_id) REFERENCES public.inventory_items(tenant_id,id),
  FOREIGN KEY(tenant_id,vehicle_id) REFERENCES public.company_vehicles(tenant_id,id), UNIQUE(tenant_id,id)
);
CREATE UNIQUE INDEX company_vehicle_plate_unique ON public.company_vehicles(tenant_id,regexp_replace(upper(plate),'[^A-Z0-9ÄÖÜ]','','g')) WHERE status <> 'archived';
CREATE UNIQUE INDEX company_vehicle_vin_unique ON public.company_vehicles(tenant_id,vin) WHERE vin IS NOT NULL AND status <> 'archived';
CREATE UNIQUE INDEX company_vehicle_inventory_unique ON public.company_vehicles(tenant_id,inventory_item_id) WHERE inventory_item_id IS NOT NULL AND status <> 'archived';
CREATE UNIQUE INDEX company_asset_inventory_unique ON public.company_asset_links(tenant_id,inventory_item_id) WHERE status='active';
CREATE INDEX company_vehicle_allocation_period ON public.company_vehicle_allocations(tenant_id,vehicle_id,starts_at);
CREATE INDEX company_contract_due ON public.company_contracts(tenant_id,status,notice_on);
CREATE INDEX company_policy_due ON public.company_insurance_policies(tenant_id,status,ends_on);
ALTER TABLE public.employee_logbook_vehicles ADD COLUMN company_vehicle_id uuid;
ALTER TABLE public.employee_logbook_vehicles ADD CONSTRAINT employee_logbook_central_vehicle_fk FOREIGN KEY(tenant_id,company_vehicle_id) REFERENCES public.company_vehicles(tenant_id,id);
CREATE INDEX employee_logbook_central_vehicle ON public.employee_logbook_vehicles(tenant_id,company_vehicle_id) WHERE company_vehicle_id IS NOT NULL;
CREATE TABLE public.company_resource_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 resource_kind text NOT NULL CHECK(resource_kind IN ('contract','insurance','vehicle','allocation','asset')),
 resource_id uuid NOT NULL, action text NOT NULL, actor_id uuid NOT NULL,
 label text NOT NULL, before_data jsonb, after_data jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX company_resource_audit_tenant ON public.company_resource_audit(tenant_id,created_at DESC);
ALTER TABLE public.company_contracts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_contracts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.company_contracts TO authenticated;
CREATE POLICY company_contracts_read ON public.company_contracts FOR SELECT TO authenticated USING(care_security.company_record_access(tenant_id,'business.tenant.manage',entity_id,site_id,department_id));
ALTER TABLE public.company_insurance_policies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_insurance_policies FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.company_insurance_policies TO authenticated;
CREATE POLICY company_insurance_policies_read ON public.company_insurance_policies FOR SELECT TO authenticated USING(care_security.company_record_access(tenant_id,'business.tenant.manage',entity_id,site_id,department_id));
ALTER TABLE public.company_vehicles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_vehicles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.company_vehicles TO authenticated;
CREATE POLICY company_vehicles_read ON public.company_vehicles FOR SELECT TO authenticated USING(care_security.company_record_access(tenant_id,'business.tenant.manage',entity_id,site_id,department_id));
ALTER TABLE public.company_vehicle_allocations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_vehicle_allocations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.company_vehicle_allocations TO authenticated;
CREATE POLICY company_vehicle_allocations_read ON public.company_vehicle_allocations FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.company_vehicles v WHERE v.tenant_id=company_vehicle_allocations.tenant_id AND v.id=company_vehicle_allocations.vehicle_id AND care_security.company_record_access(v.tenant_id,'business.tenant.manage',v.entity_id,v.site_id,v.department_id)) AND care_security.company_organization_employee_access(tenant_id,employee_id));
ALTER TABLE public.company_asset_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_asset_links FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.company_asset_links TO authenticated;
CREATE POLICY company_asset_links_read ON public.company_asset_links FOR SELECT TO authenticated USING(care_security.company_record_access(tenant_id,'business.tenant.manage',entity_id,site_id,department_id) AND care_security.company_record_access(tenant_id,'inventory.view',entity_id,site_id,department_id));
ALTER TABLE public.company_resource_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_resource_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.company_resource_audit TO authenticated;
CREATE POLICY company_resource_audit_read ON public.company_resource_audit FOR SELECT TO authenticated USING(care_security.company_actor(tenant_id,'business.tenant.manage'));

CREATE OR REPLACE FUNCTION care_security.company_resource_placement(p_tenant uuid,p_data jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE v_entity uuid := (p_data->>'entity_id')::uuid; v_site uuid := (p_data->>'site_id')::uuid; v_department uuid := (p_data->>'department_id')::uuid; v_row record;
BEGIN
 IF v_entity IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.company_legal_entities WHERE tenant_id=p_tenant AND id=v_entity AND status='active') THEN RAISE EXCEPTION 'Die Gesellschaft ist nicht aktiv.'; END IF;
 IF v_site IS NOT NULL THEN
   SELECT * INTO v_row FROM public.company_sites WHERE tenant_id=p_tenant AND id=v_site AND status='active';
   IF NOT FOUND OR v_row.entity_id IS DISTINCT FROM v_entity THEN RAISE EXCEPTION 'Der Standort gehört nicht zur ausgewählten Gesellschaft oder ist nicht aktiv.'; END IF;
 END IF;
 IF v_department IS NOT NULL THEN
   SELECT * INTO v_row FROM public.company_departments WHERE tenant_id=p_tenant AND id=v_department AND status='active';
   IF NOT FOUND OR v_row.entity_id IS DISTINCT FROM v_entity OR (v_row.site_id IS NOT NULL AND v_row.site_id IS DISTINCT FROM v_site) THEN RAISE EXCEPTION 'Die Abteilung gehört nicht zur ausgewählten Organisation oder ist nicht aktiv.'; END IF;
 END IF;
END $$;
REVOKE ALL ON FUNCTION care_security.company_resource_placement(uuid,jsonb) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION care_security.company_resources_save(p_tenant uuid,p_kind text,p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE
 v_table text; v_allowed text[]; v_id uuid := coalesce((p_input->>'id')::uuid,gen_random_uuid());
 v_expected integer := (p_input->>'expected_version')::integer; v_old jsonb; v_data jsonb; v_result jsonb;
 v_archive boolean := coalesce((p_input->>'archive')::boolean,false); v_label text; v_vehicle public.company_vehicles; v_employee uuid;
BEGIN
 IF NOT care_security.company_can_read(p_tenant,'business.tenant.manage') THEN RAISE EXCEPTION 'Berechtigung fehlt.' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_input)<>'object' OR length(p_input::text)>100000 THEN RAISE EXCEPTION 'Ungültige Eingabe.' USING ERRCODE='22023'; END IF;
 -- One transaction-wide tenant lock serializes every resource write, including return/link operations.
 -- This closes check-then-write races without installing extensions. Vehicle locks below document the allocation invariant.
 PERFORM pg_advisory_xact_lock(hashtextextended('company-resources:'||p_tenant::text,0));
 CASE p_kind
 WHEN 'contract' THEN
  v_table:='company_contracts'; v_allowed:=ARRAY['title','contract_type','counterparty','reference','status','starts_on','ends_on','notice_on','notice_rule','renewal_rule','review_on','responsible_employee_id','cost_cents','payment_interval','currency','document_id','notes','entity_id','site_id','department_id'];
 WHEN 'insurance' THEN
  v_table:='company_insurance_policies'; v_allowed:=ARRAY['title','insurance_type','provider','policy_number','status','starts_on','ends_on','notice_on','review_on','coverage_cents','excess_cents','premium_cents','payment_interval','currency','coverage_description','contract_id','responsible_employee_id','document_id','notes','entity_id','site_id','department_id'];
 WHEN 'vehicle' THEN
  v_table:='company_vehicles'; v_allowed:=ARRAY['plate','vin','make','model','vehicle_type','ownership','status','mileage','first_registration_on','purchased_on','lease_ends_on','hu_due_on','service_due_on','service_due_mileage','insurance_policy_id','contract_id','inventory_item_id','document_id','notes','entity_id','site_id','department_id'];
 WHEN 'allocation' THEN
  v_table:='company_vehicle_allocations'; v_allowed:=ARRAY['vehicle_id','employee_id','starts_at','ends_at','status','issue_mileage','issue_condition','notes'];
 WHEN 'asset' THEN
  v_table:='company_asset_links'; v_allowed:=ARRAY['inventory_item_id','vehicle_id','status','notes','entity_id','site_id','department_id'];
 ELSE RAISE EXCEPTION 'Unbekannter Bereich.' USING ERRCODE='22023';
 END CASE;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_input) k WHERE NOT k=ANY(v_allowed||ARRAY['id','expected_version','archive'])) THEN RAISE EXCEPTION 'Unbekannte Eingabefelder.' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_each_text(p_input) x WHERE length(x.value)>12000) THEN RAISE EXCEPTION 'Ein Eingabetext ist zu lang.' USING ERRCODE='22023'; END IF;
 EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE tenant_id=$1 AND id=$2 FOR UPDATE',v_table) INTO v_old USING p_tenant,v_id;
 IF v_old IS NOT NULL THEN
  IF p_kind='allocation' THEN
   IF NOT EXISTS(SELECT 1 FROM public.company_vehicles v WHERE v.tenant_id=p_tenant AND v.id=(v_old->>'vehicle_id')::uuid AND care_security.company_record_access(p_tenant,'business.tenant.manage',v.entity_id,v.site_id,v.department_id)) THEN RAISE EXCEPTION 'Die Ausgabe liegt außerhalb Ihres Zugriffsbereichs.' USING ERRCODE='42501'; END IF;
  ELSIF NOT care_security.company_record_access(p_tenant,'business.tenant.manage',(v_old->>'entity_id')::uuid,(v_old->>'site_id')::uuid,(v_old->>'department_id')::uuid) THEN RAISE EXCEPTION 'Der Eintrag liegt außerhalb Ihres Zugriffsbereichs.' USING ERRCODE='42501'; END IF;
 END IF;
 IF p_input ? 'id' AND (v_old IS NULL OR v_expected IS NULL OR v_expected<>(v_old->>'version')::integer) THEN RAISE EXCEPTION 'Der Eintrag wurde inzwischen geändert.' USING ERRCODE='40001'; END IF;
 IF v_old IS NOT NULL AND v_old->>'status'='archived' THEN RAISE EXCEPTION 'Archivierte Einträge können nicht bearbeitet werden.'; END IF;
 IF v_archive AND v_old IS NULL THEN RAISE EXCEPTION 'Der Eintrag existiert nicht.'; END IF;
 IF v_archive THEN
  IF p_kind='allocation' THEN RAISE EXCEPTION 'Fahrzeugausgaben bitte zurücknehmen oder eine Planung stornieren.'; END IF;
  v_data:=v_old||jsonb_build_object('status','archived');
 ELSE
  v_data:=coalesce(v_old,jsonb_build_object('status',CASE WHEN p_kind='vehicle' THEN 'available' WHEN p_kind='allocation' THEN 'planned' ELSE 'active' END,'created_at',now(),'payment_interval','yearly','currency','EUR','mileage',0))||(p_input-ARRAY['id','expected_version','archive']);
  IF v_data->>'status'='archived' THEN RAISE EXCEPTION 'Zum Archivieren die Archivfunktion verwenden.'; END IF;
  IF p_kind<>'allocation' THEN
   IF NOT care_security.company_record_access(p_tenant,'business.tenant.manage',(v_data->>'entity_id')::uuid,(v_data->>'site_id')::uuid,(v_data->>'department_id')::uuid) THEN RAISE EXCEPTION 'Die Zielzuordnung liegt außerhalb Ihres Zugriffsbereichs.' USING ERRCODE='42501'; END IF;
   IF v_old IS NULL OR (v_data->>'entity_id',v_data->>'site_id',v_data->>'department_id') IS DISTINCT FROM (v_old->>'entity_id',v_old->>'site_id',v_old->>'department_id') OR (v_data->>'status'='active' AND v_old->>'status' IS DISTINCT FROM 'active') THEN PERFORM care_security.company_resource_placement(p_tenant,v_data); END IF;
  END IF;
  IF p_kind='allocation' OR (v_data->>'responsible_employee_id' IS DISTINCT FROM v_old->>'responsible_employee_id') THEN
   v_employee:=CASE WHEN p_kind='allocation' THEN (v_data->>'employee_id')::uuid ELSE (v_data->>'responsible_employee_id')::uuid END;
   IF v_employee IS NOT NULL AND (NOT care_security.company_organization_employee_access(p_tenant,v_employee) OR NOT EXISTS(SELECT 1 FROM public.employees WHERE tenant_id=p_tenant AND id=v_employee AND status::text IN ('active','aktiv') AND deleted_at IS NULL)) THEN RAISE EXCEPTION 'Die ausgewählte Person ist nicht verfügbar.' USING ERRCODE='42501'; END IF;
  END IF;
  IF v_data->>'document_id' IS DISTINCT FROM v_old->>'document_id' AND v_data->>'document_id' IS NOT NULL THEN
   IF NOT care_security.company_actor(p_tenant,'office.documents.view') OR NOT EXISTS(SELECT 1 FROM public.central_document_records d WHERE d.tenant_id=p_tenant AND d.id=(v_data->>'document_id')::uuid AND d.target='company' AND d.entity_id=p_tenant AND (NOT coalesce((d.snapshot_json#>>'{definition,clinicalReviewRequired}')::boolean,false) OR care_security.company_actor(p_tenant,'office.clients.view_sensitive'))) THEN RAISE EXCEPTION 'Das Unternehmensdokument ist nicht verfügbar.' USING ERRCODE='42501'; END IF;
  END IF;
  IF v_data->>'contract_id' IS NOT NULL AND (v_data->>'contract_id' IS DISTINCT FROM v_old->>'contract_id' OR (v_data->>'status'='active' AND v_old->>'status' IS DISTINCT FROM 'active')) AND NOT EXISTS(SELECT 1 FROM public.company_contracts WHERE tenant_id=p_tenant AND id=(v_data->>'contract_id')::uuid AND status<>'archived' AND care_security.company_record_access(p_tenant,'business.tenant.manage',entity_id,site_id,department_id)) THEN RAISE EXCEPTION 'Der Vertrag ist nicht verfügbar.'; END IF;
  IF v_data->>'insurance_policy_id' IS NOT NULL AND v_data->>'insurance_policy_id' IS DISTINCT FROM v_old->>'insurance_policy_id' AND NOT EXISTS(SELECT 1 FROM public.company_insurance_policies WHERE tenant_id=p_tenant AND id=(v_data->>'insurance_policy_id')::uuid AND status<>'archived' AND care_security.company_record_access(p_tenant,'business.tenant.manage',entity_id,site_id,department_id)) THEN RAISE EXCEPTION 'Die Versicherung ist nicht verfügbar.'; END IF;
  IF v_data->>'inventory_item_id' IS NOT NULL AND (v_data->>'inventory_item_id' IS DISTINCT FROM v_old->>'inventory_item_id' OR (p_kind='asset' AND (v_data->>'vehicle_id',v_data->>'entity_id',v_data->>'site_id',v_data->>'department_id') IS DISTINCT FROM (v_old->>'vehicle_id',v_old->>'entity_id',v_old->>'site_id',v_old->>'department_id'))) THEN
   IF NOT care_security.company_can_read(p_tenant,'inventory.view') OR NOT EXISTS(SELECT 1 FROM public.inventory_items i JOIN public.inventory_categories c ON c.id=i.category_id AND c.tenant_id=i.tenant_id WHERE i.tenant_id=p_tenant AND i.id=(v_data->>'inventory_item_id')::uuid AND i.status NOT IN ('archived','decommissioned') AND (care_security.company_actor(p_tenant,'inventory.view') OR EXISTS(SELECT 1 FROM public.company_asset_links a WHERE a.tenant_id=p_tenant AND a.inventory_item_id=i.id AND a.status='active' AND care_security.company_record_access(p_tenant,'inventory.view',a.entity_id,a.site_id,a.department_id))) AND (p_kind<>'vehicle' OR c.group_key='vehicles')) THEN RAISE EXCEPTION 'Der Inventargegenstand ist nicht verfügbar oder gehört nicht zur Fahrzeugkategorie.' USING ERRCODE='42501'; END IF;
  END IF;
 END IF;
 IF p_kind='vehicle' THEN
  v_data:=v_data||jsonb_build_object('plate',upper(trim(v_data->>'plate')),'vin',nullif(upper(trim(v_data->>'vin')),''));
  IF v_old IS NOT NULL AND (v_data->>'mileage')::numeric<(v_old->>'mileage')::numeric THEN RAISE EXCEPTION 'Der Kilometerstand darf nicht sinken.'; END IF;
  IF v_archive AND EXISTS(SELECT 1 FROM public.company_asset_links WHERE tenant_id=p_tenant AND vehicle_id=v_id AND status='active') THEN RAISE EXCEPTION 'Aktive Inventarzuordnungen müssen zuerst gelöst werden.'; END IF;
  IF v_archive AND EXISTS(SELECT 1 FROM public.company_vehicle_allocations WHERE tenant_id=p_tenant AND vehicle_id=v_id AND status IN ('planned','active')) THEN RAISE EXCEPTION 'Offene Fahrzeugausgaben müssen zuerst abgeschlossen werden.'; END IF;
  IF NOT v_archive AND v_old IS NOT NULL AND (v_data->>'inventory_item_id' IS DISTINCT FROM v_old->>'inventory_item_id') AND EXISTS(SELECT 1 FROM public.company_vehicle_allocations WHERE tenant_id=p_tenant AND vehicle_id=v_id AND status='active') THEN RAISE EXCEPTION 'Die Inventarverknüpfung kann während einer Ausgabe nicht geändert werden.'; END IF;
 END IF;
 IF p_kind='allocation' THEN
  SELECT * INTO v_vehicle FROM public.company_vehicles WHERE tenant_id=p_tenant AND id=(v_data->>'vehicle_id')::uuid FOR UPDATE;
  IF NOT FOUND OR NOT care_security.company_record_access(p_tenant,'business.tenant.manage',v_vehicle.entity_id,v_vehicle.site_id,v_vehicle.department_id) OR (v_data->>'status'<>'cancelled' AND v_vehicle.status<>'available') THEN RAISE EXCEPTION 'Das Fahrzeug ist nicht verfügbar.'; END IF;
  IF v_old->>'status' IN ('returned','cancelled') THEN RAISE EXCEPTION 'Abgeschlossene Ausgaben bleiben unverändert.'; END IF;
  IF v_data->>'status' NOT IN ('planned','active','cancelled') THEN RAISE EXCEPTION 'Ungültiger Ausgabestatus.'; END IF;
  IF v_old->>'status'='active' AND ((v_data->>'status')<>'active' OR (v_data-ARRAY['ends_at','notes']) IS DISTINCT FROM (v_old-ARRAY['ends_at','notes'])) THEN RAISE EXCEPTION 'Eine laufende Ausgabe kann nur verlängert oder zurückgenommen werden.'; END IF;
  IF v_data->>'status'='active' AND ((v_data->>'starts_at')::timestamptz>now()+interval '5 minutes' OR (v_data->>'ends_at')::timestamptz<=now() OR (v_old->>'status' IS DISTINCT FROM 'active' AND (v_data->>'issue_mileage')::numeric<v_vehicle.mileage)) THEN RAISE EXCEPTION 'Ausgabezeit oder Kilometerstand ist ungültig.'; END IF;
  IF v_data->>'status' IN ('active','planned') AND EXISTS(
   SELECT 1 FROM public.company_vehicle_allocations a WHERE a.tenant_id=p_tenant AND a.vehicle_id=v_vehicle.id AND a.id<>v_id AND a.status IN ('active','planned')
    AND tstzrange(a.starts_at,CASE WHEN a.status='active' AND a.ends_at<=now() THEN NULL ELSE a.ends_at END,'[)') && tstzrange((v_data->>'starts_at')::timestamptz,CASE WHEN v_data->>'status'='active' AND (v_data->>'ends_at')::timestamptz<=now() THEN NULL ELSE (v_data->>'ends_at')::timestamptz END,'[)')
  ) THEN RAISE EXCEPTION 'Das Fahrzeug ist in diesem Zeitraum bereits vergeben.' USING ERRCODE='23P01'; END IF;
 END IF;
 IF p_kind='asset' AND v_data->>'vehicle_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.company_vehicles WHERE tenant_id=p_tenant AND id=(v_data->>'vehicle_id')::uuid AND status<>'archived' AND care_security.company_record_access(p_tenant,'business.tenant.manage',entity_id,site_id,department_id)) THEN RAISE EXCEPTION 'Das Fahrzeug ist nicht verfügbar.'; END IF;
 IF v_archive AND p_kind='contract' AND (EXISTS(SELECT 1 FROM public.company_insurance_policies WHERE tenant_id=p_tenant AND contract_id=v_id AND status='active') OR EXISTS(SELECT 1 FROM public.company_vehicles WHERE tenant_id=p_tenant AND contract_id=v_id AND status<>'archived')) THEN RAISE EXCEPTION 'Der Vertrag ist noch mit aktiven Versicherungen oder Fahrzeugen verbunden.'; END IF;
 IF v_archive AND p_kind='insurance' AND EXISTS(SELECT 1 FROM public.company_vehicles WHERE tenant_id=p_tenant AND insurance_policy_id=v_id AND status<>'archived') THEN RAISE EXCEPTION 'Die Versicherung ist noch einem aktiven Fahrzeug zugeordnet.'; END IF;
 v_data:=v_data||jsonb_build_object('id',v_id,'tenant_id',p_tenant,'version',coalesce((v_old->>'version')::integer,0)+1,'updated_at',now());
 IF v_old IS NULL THEN
  EXECUTE format('INSERT INTO public.%I SELECT (jsonb_populate_record(NULL::public.%I,$1)).* RETURNING to_jsonb(%I.*)',v_table,v_table,v_table) INTO v_result USING v_data;
 ELSE
  -- Columns are a constant per-kind whitelist, never caller-provided identifiers.
  EXECUTE format('UPDATE public.%I AS t SET (%s)=(SELECT %s FROM jsonb_populate_record(NULL::public.%I,$1)) WHERE t.tenant_id=$2 AND t.id=$3 RETURNING to_jsonb(t)',v_table,array_to_string(v_allowed||ARRAY['version','updated_at'],','),array_to_string(v_allowed||ARRAY['version','updated_at'],','),v_table) INTO v_result USING v_data,p_tenant,v_id;
 END IF;
 IF p_kind='vehicle' THEN
  UPDATE public.employee_logbook_vehicles SET plate=v_result->>'plate',make=v_result->>'make',model=v_result->>'model',active=CASE WHEN v_archive THEN false ELSE active END,updated_at=now() WHERE tenant_id=p_tenant AND company_vehicle_id=v_id;
 END IF;
 IF p_kind='allocation' AND v_result->>'status'='active' AND v_old->>'status' IS DISTINCT FROM 'active' THEN UPDATE public.company_vehicles SET mileage=greatest(mileage,(v_result->>'issue_mileage')::numeric),version=version+1,updated_at=now() WHERE tenant_id=p_tenant AND id=v_vehicle.id; END IF;
 v_label:=coalesce(v_result->>'title',v_result->>'plate',CASE WHEN p_kind='allocation' THEN 'Fahrzeugausgabe' ELSE 'Inventarzuordnung' END);
 INSERT INTO public.company_resource_audit(tenant_id,resource_kind,resource_id,action,actor_id,label,before_data,after_data) VALUES(p_tenant,p_kind,v_id,CASE WHEN v_archive THEN 'archived' WHEN v_old IS NULL THEN 'created' ELSE 'updated' END,auth.uid(),v_label,v_old,v_result);
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION care_security.company_resources_save(uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION care_security.company_resources_save(uuid,text,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.company_resources_save(p_tenant uuid,p_kind text,p_input jsonb) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $$ SELECT care_security.company_resources_save(p_tenant,p_kind,p_input) $$;
REVOKE ALL ON FUNCTION public.company_resources_save(uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.company_resources_save(uuid,text,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION care_security.company_resources_return_vehicle(p_tenant uuid,p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_old public.company_vehicle_allocations; v_new public.company_vehicle_allocations; v_vehicle public.company_vehicles; v_returned timestamptz := (p_input->>'returned_at')::timestamptz; v_mileage numeric := (p_input->>'return_mileage')::numeric;
BEGIN
 IF NOT care_security.company_can_read(p_tenant,'business.tenant.manage') OR NOT care_security.company_can_read(p_tenant,'office.employees.view') THEN RAISE EXCEPTION 'Berechtigung fehlt.' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_input)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_input) k WHERE NOT k=ANY(ARRAY['id','expected_version','returned_at','return_mileage','return_condition','notes'])) THEN RAISE EXCEPTION 'Ungültige Eingabe.' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('company-resources:'||p_tenant::text,0));
 SELECT * INTO v_old FROM public.company_vehicle_allocations WHERE tenant_id=p_tenant AND id=(p_input->>'id')::uuid FOR UPDATE;
 IF NOT FOUND OR (p_input->>'expected_version')::integer IS DISTINCT FROM v_old.version THEN RAISE EXCEPTION 'Die Ausgabe wurde inzwischen geändert.' USING ERRCODE='40001'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.company_vehicles v WHERE v.tenant_id=p_tenant AND v.id=v_old.vehicle_id AND care_security.company_record_access(p_tenant,'business.tenant.manage',v.entity_id,v.site_id,v.department_id)) THEN RAISE EXCEPTION 'Die Ausgabe liegt außerhalb Ihres Zugriffsbereichs.' USING ERRCODE='42501'; END IF;
 IF NOT care_security.company_organization_employee_access(p_tenant,v_old.employee_id) THEN RAISE EXCEPTION 'Die Person liegt außerhalb Ihres Zugriffsbereichs.' USING ERRCODE='42501'; END IF;
 IF v_old.status<>'active' THEN RAISE EXCEPTION 'Nur laufende Ausgaben können zurückgenommen werden.'; END IF;
 SELECT * INTO v_vehicle FROM public.company_vehicles WHERE tenant_id=p_tenant AND id=v_old.vehicle_id FOR UPDATE;
 IF v_returned IS NULL OR v_returned<v_old.starts_at OR v_returned>now()+interval '5 minutes' OR v_mileage IS NULL OR v_mileage<greatest(v_old.issue_mileage,v_vehicle.mileage) OR v_mileage>10000000 OR coalesce(length(trim(p_input->>'return_condition')),0) NOT BETWEEN 1 AND 2000 OR length(coalesce(p_input->>'notes',''))>12000 THEN RAISE EXCEPTION 'Bitte Rückgabezeit, Zustand und Kilometerstand prüfen.'; END IF;
 UPDATE public.company_vehicle_allocations SET status='returned',returned_at=v_returned,return_mileage=v_mileage,return_condition=trim(p_input->>'return_condition'),notes=CASE WHEN p_input ? 'notes' THEN p_input->>'notes' ELSE notes END,version=version+1,updated_at=now() WHERE tenant_id=p_tenant AND id=v_old.id RETURNING * INTO v_new;
 UPDATE public.company_vehicles SET mileage=v_mileage,version=version+1,updated_at=now() WHERE tenant_id=p_tenant AND id=v_old.vehicle_id;
 INSERT INTO public.company_resource_audit(tenant_id,resource_kind,resource_id,action,actor_id,label,before_data,after_data) VALUES(p_tenant,'allocation',v_old.id,'returned',auth.uid(),v_vehicle.plate,to_jsonb(v_old),to_jsonb(v_new));
 RETURN to_jsonb(v_new);
END $$;
REVOKE ALL ON FUNCTION care_security.company_resources_return_vehicle(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION care_security.company_resources_return_vehicle(uuid,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.company_resources_return_vehicle(p_tenant uuid,p_input jsonb) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $$ SELECT care_security.company_resources_return_vehicle(p_tenant,p_input) $$;
REVOKE ALL ON FUNCTION public.company_resources_return_vehicle(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.company_resources_return_vehicle(uuid,jsonb) TO authenticated;

-- A company vehicle remains one identity across historic employee logbook rows.
-- Existing private vehicles are never relabelled or auto-linked by matching plates.
CREATE OR REPLACE FUNCTION care_security.company_logbook_identity_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v public.company_vehicles;
BEGIN
 IF TG_OP='UPDATE' AND NEW.company_vehicle_id IS DISTINCT FROM OLD.company_vehicle_id AND NOT EXISTS(SELECT 1 FROM public.company_vehicles cv WHERE cv.tenant_id=NEW.tenant_id AND cv.id=NEW.company_vehicle_id AND care_security.company_record_access(NEW.tenant_id,'business.tenant.manage',cv.entity_id,cv.site_id,cv.department_id)) THEN RAISE EXCEPTION 'Die zentrale Fahrzeugzuordnung darf nur die Unternehmensverwaltung ändern.' USING ERRCODE='42501'; END IF;
 IF TG_OP='INSERT' AND NEW.company_vehicle_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.company_vehicles cv WHERE cv.tenant_id=NEW.tenant_id AND cv.id=NEW.company_vehicle_id AND care_security.company_record_access(NEW.tenant_id,'business.tenant.manage',cv.entity_id,cv.site_id,cv.department_id)) THEN RAISE EXCEPTION 'Die zentrale Fahrzeugzuordnung darf nur die Unternehmensverwaltung ändern.' USING ERRCODE='42501'; END IF;
 IF NEW.company_vehicle_id IS NOT NULL THEN
  SELECT * INTO v FROM public.company_vehicles WHERE tenant_id=NEW.tenant_id AND id=NEW.company_vehicle_id;
  IF NOT FOUND OR NEW.ownership<>'company' OR NEW.plate IS DISTINCT FROM v.plate OR NEW.make IS DISTINCT FROM v.make OR NEW.model IS DISTINCT FROM v.model OR (v.status='archived' AND NEW.active) THEN RAISE EXCEPTION 'Die Fahrzeugdaten werden zentral im Unternehmen verwaltet.'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION care_security.company_logbook_identity_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER company_logbook_identity_guard BEFORE INSERT OR UPDATE ON public.employee_logbook_vehicles FOR EACH ROW EXECUTE FUNCTION care_security.company_logbook_identity_guard();

CREATE OR REPLACE FUNCTION care_security.company_resources_link_logbook(p_tenant uuid,p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v public.company_vehicles; l public.employee_logbook_vehicles; v_old jsonb;
BEGIN
 IF NOT care_security.company_can_read(p_tenant,'business.tenant.manage') OR NOT care_security.company_can_read(p_tenant,'office.employees.view') THEN RAISE EXCEPTION 'Berechtigung fehlt.' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_input)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_input) k WHERE NOT k=ANY(ARRAY['vehicle_id','logbook_vehicle_id','expected_version'])) THEN RAISE EXCEPTION 'Ungültige Eingabe.' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('company-resources:'||p_tenant::text,0));
 SELECT * INTO v FROM public.company_vehicles WHERE tenant_id=p_tenant AND id=(p_input->>'vehicle_id')::uuid FOR UPDATE;
 IF NOT FOUND OR v.version IS DISTINCT FROM (p_input->>'expected_version')::integer THEN RAISE EXCEPTION 'Das Fahrzeug wurde inzwischen geändert.' USING ERRCODE='40001'; END IF;
 IF NOT care_security.company_record_access(p_tenant,'business.tenant.manage',v.entity_id,v.site_id,v.department_id) THEN RAISE EXCEPTION 'Das Fahrzeug liegt außerhalb Ihres Zugriffsbereichs.' USING ERRCODE='42501'; END IF;
 IF v.status='archived' THEN RAISE EXCEPTION 'Das Fahrzeug ist archiviert.'; END IF;
 SELECT * INTO l FROM public.employee_logbook_vehicles WHERE tenant_id=p_tenant AND id=(p_input->>'logbook_vehicle_id')::uuid FOR UPDATE;
 IF NOT FOUND OR l.ownership<>'company' OR NOT l.active OR l.company_vehicle_id IS NOT NULL OR NOT care_security.company_organization_employee_access(p_tenant,l.employee_id) OR NOT EXISTS(SELECT 1 FROM public.employees WHERE tenant_id=p_tenant AND id=l.employee_id AND status::text IN ('active','aktiv') AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Das Fahrtenbuchfahrzeug kann nicht verknüpft werden.'; END IF;
 -- A user explicitly selects an existing company vehicle. Historical trips retain their own row id.
 v_old:=to_jsonb(l);
 UPDATE public.employee_logbook_vehicles SET company_vehicle_id=v.id,plate=v.plate,make=v.make,model=v.model,updated_at=now() WHERE tenant_id=p_tenant AND id=l.id RETURNING * INTO l;
 UPDATE public.company_vehicles SET version=version+1,updated_at=now() WHERE tenant_id=p_tenant AND id=v.id RETURNING * INTO v;
 INSERT INTO public.company_resource_audit(tenant_id,resource_kind,resource_id,action,actor_id,label,before_data,after_data) VALUES(p_tenant,'vehicle',v.id,'logbook_linked',auth.uid(),v.plate,v_old,to_jsonb(l));
 RETURN to_jsonb(v);
END $$;
REVOKE ALL ON FUNCTION care_security.company_resources_link_logbook(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION care_security.company_resources_link_logbook(uuid,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.company_resources_link_logbook(p_tenant uuid,p_input jsonb) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $$ SELECT care_security.company_resources_link_logbook(p_tenant,p_input) $$;
REVOKE ALL ON FUNCTION public.company_resources_link_logbook(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.company_resources_link_logbook(uuid,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION care_security.company_resources_snapshot(p_tenant uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result jsonb; v_employees boolean; v_documents boolean; v_inventory boolean; v_unrestricted boolean;
BEGIN
 IF NOT care_security.company_can_read(p_tenant,'business.tenant.manage') THEN RAISE EXCEPTION 'Berechtigung fehlt.' USING ERRCODE='42501'; END IF;
 v_employees:=care_security.company_can_read(p_tenant,'office.employees.view');
 v_documents:=care_security.company_actor(p_tenant,'business.tenant.manage') AND care_security.company_actor(p_tenant,'office.documents.view');
 v_inventory:=care_security.company_can_read(p_tenant,'inventory.view');
 v_unrestricted:=care_security.company_actor(p_tenant,'business.tenant.manage');
 result:=jsonb_build_object(
  'contracts',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.title) FROM public.company_contracts t WHERE t.tenant_id=p_tenant AND care_security.company_record_access(p_tenant,'business.tenant.manage',t.entity_id,t.site_id,t.department_id)),'[]'::jsonb),
  'policies',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.title) FROM public.company_insurance_policies t WHERE t.tenant_id=p_tenant AND care_security.company_record_access(p_tenant,'business.tenant.manage',t.entity_id,t.site_id,t.department_id)),'[]'::jsonb),
  'vehicles',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.plate) FROM public.company_vehicles t WHERE t.tenant_id=p_tenant AND care_security.company_record_access(p_tenant,'business.tenant.manage',t.entity_id,t.site_id,t.department_id)),'[]'::jsonb),
  'allocations',coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.starts_at DESC) FROM public.company_vehicle_allocations a JOIN public.company_vehicles v ON v.tenant_id=a.tenant_id AND v.id=a.vehicle_id WHERE a.tenant_id=p_tenant AND v_employees AND care_security.company_record_access(p_tenant,'business.tenant.manage',v.entity_id,v.site_id,v.department_id) AND care_security.company_organization_employee_access(p_tenant,a.employee_id)),'[]'::jsonb),
  'asset_links',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC) FROM public.company_asset_links t WHERE t.tenant_id=p_tenant AND v_inventory AND care_security.company_record_access(p_tenant,'business.tenant.manage',t.entity_id,t.site_id,t.department_id)),'[]'::jsonb),
  'employees_visible',v_employees,
  'employees',coalesce((SELECT jsonb_agg(jsonb_build_object('id',e.id,'first_name',e.first_name,'last_name',e.last_name,'status',e.status) ORDER BY e.last_name,e.first_name) FROM public.employees e WHERE e.tenant_id=p_tenant AND e.deleted_at IS NULL AND v_employees AND care_security.company_organization_employee_access(p_tenant,e.id)),'[]'::jsonb),
  'entities',coalesce((SELECT jsonb_agg(jsonb_build_object('id',e.id,'label',e.name,'status',e.status) ORDER BY e.name) FROM public.company_legal_entities e WHERE e.tenant_id=p_tenant AND (care_security.company_record_access(p_tenant,'business.tenant.manage',e.id,NULL,NULL) OR EXISTS(SELECT 1 FROM public.company_sites s WHERE s.tenant_id=p_tenant AND s.entity_id=e.id AND care_security.company_record_access(p_tenant,'business.tenant.manage',s.entity_id,s.id,NULL)) OR EXISTS(SELECT 1 FROM public.company_departments d WHERE d.tenant_id=p_tenant AND d.entity_id=e.id AND care_security.company_record_access(p_tenant,'business.tenant.manage',d.entity_id,d.site_id,d.id)))),'[]'::jsonb),
  'sites',coalesce((SELECT jsonb_agg(jsonb_build_object('id',s.id,'label',s.name,'status',s.status,'entity_id',s.entity_id) ORDER BY s.name) FROM public.company_sites s WHERE s.tenant_id=p_tenant AND (care_security.company_record_access(p_tenant,'business.tenant.manage',s.entity_id,s.id,NULL) OR EXISTS(SELECT 1 FROM public.company_departments d WHERE d.tenant_id=p_tenant AND d.site_id=s.id AND care_security.company_record_access(p_tenant,'business.tenant.manage',d.entity_id,d.site_id,d.id)))),'[]'::jsonb),
  'departments',coalesce((SELECT jsonb_agg(jsonb_build_object('id',d.id,'label',d.name,'status',d.status,'entity_id',d.entity_id,'site_id',d.site_id) ORDER BY d.name) FROM public.company_departments d WHERE d.tenant_id=p_tenant AND care_security.company_record_access(p_tenant,'business.tenant.manage',d.entity_id,d.site_id,d.id)),'[]'::jsonb),
  'inventory_items',coalesce((SELECT jsonb_agg(jsonb_build_object('id',i.id,'label',i.name,'status',i.status,'group_key',c.group_key) ORDER BY i.name) FROM public.inventory_items i JOIN public.inventory_categories c ON c.tenant_id=i.tenant_id AND c.id=i.category_id WHERE i.tenant_id=p_tenant AND v_inventory AND (care_security.company_actor(p_tenant,'inventory.view') OR EXISTS(SELECT 1 FROM public.company_asset_links a WHERE a.tenant_id=p_tenant AND a.inventory_item_id=i.id AND a.status='active' AND care_security.company_record_access(p_tenant,'inventory.view',a.entity_id,a.site_id,a.department_id)))),'[]'::jsonb),
  'logbook_vehicles',coalesce((SELECT jsonb_agg(jsonb_build_object('id',l.id,'employee_id',l.employee_id,'plate',l.plate,'make',l.make,'model',l.model,'active',l.active,'ownership',l.ownership,'company_vehicle_id',l.company_vehicle_id) ORDER BY l.plate) FROM public.employee_logbook_vehicles l WHERE l.tenant_id=p_tenant AND l.ownership='company' AND v_employees AND care_security.company_organization_employee_access(p_tenant,l.employee_id) AND (l.company_vehicle_id IS NULL OR EXISTS(SELECT 1 FROM public.company_vehicles v WHERE v.tenant_id=p_tenant AND v.id=l.company_vehicle_id AND care_security.company_record_access(p_tenant,'business.tenant.manage',v.entity_id,v.site_id,v.department_id)))),'[]'::jsonb),
  'documents',coalesce((SELECT jsonb_agg(jsonb_build_object('id',d.id,'label',d.title||' · Fassung '||d.revision::text,'status',d.state) ORDER BY d.created_at DESC) FROM public.central_document_records d WHERE d.tenant_id=p_tenant AND d.target='company' AND d.entity_id=p_tenant AND v_documents AND (NOT coalesce((d.snapshot_json#>>'{definition,clinicalReviewRequired}')::boolean,false) OR care_security.company_actor(p_tenant,'office.clients.view_sensitive'))),'[]'::jsonb),
  'audit',coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.created_at DESC) FROM (SELECT id,resource_kind,resource_id,action,actor_id,label,created_at FROM public.company_resource_audit WHERE tenant_id=p_tenant AND v_unrestricted ORDER BY created_at DESC LIMIT 200) a),'[]'::jsonb),
  'scope_limited',NOT v_unrestricted,'can_manage_scopes',false,
  'permissions',coalesce((SELECT jsonb_agg(k) FROM unnest(ARRAY['business.tenant.manage','office.employees.view','inventory.view','office.documents.view']) k WHERE care_security.company_can_read(p_tenant,k) AND (k<>'office.documents.view' OR v_documents)),'[]'::jsonb)
 );
 RETURN (result-ARRAY['permissions','scope_limited','can_manage_scopes']) || public.company_access_permissions(p_tenant);
END $$;
REVOKE ALL ON FUNCTION care_security.company_resources_snapshot(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION care_security.company_resources_snapshot(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.company_resources_snapshot(p_tenant uuid) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $$ SELECT care_security.company_resources_snapshot(p_tenant) $$;
REVOKE ALL ON FUNCTION public.company_resources_snapshot(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.company_resources_snapshot(uuid) TO authenticated;

-- Reject organization moves that would silently detach active contracts, policies or assets.
CREATE OR REPLACE FUNCTION care_security.company_resource_org_dependency_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_column text; v_table text; v_found boolean;
BEGIN
 IF NEW.status='active' AND (to_jsonb(NEW)->>'entity_id') IS NOT DISTINCT FROM (to_jsonb(OLD)->>'entity_id') AND (to_jsonb(NEW)->>'site_id') IS NOT DISTINCT FROM (to_jsonb(OLD)->>'site_id') THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('company-resources:'||OLD.tenant_id::text,0));
 v_column:=CASE TG_TABLE_NAME WHEN 'company_legal_entities' THEN 'entity_id' WHEN 'company_sites' THEN 'site_id' ELSE 'department_id' END;
 FOREACH v_table IN ARRAY ARRAY['company_contracts','company_insurance_policies','company_vehicles','company_asset_links'] LOOP
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE tenant_id=$1 AND %I=$2 AND status NOT IN (''archived'',''ended''))',v_table,v_column) INTO v_found USING OLD.tenant_id,OLD.id;
  IF v_found THEN RAISE EXCEPTION 'Dieser Organisationsbereich besitzt noch aktive Verträge, Versicherungen, Fahrzeuge oder Inventarzuordnungen. Bitte diese zuerst neu zuordnen oder abschließen.'; END IF;
 END LOOP;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION care_security.company_resource_org_dependency_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER company_entity_resource_dependencies BEFORE UPDATE ON public.company_legal_entities FOR EACH ROW EXECUTE FUNCTION care_security.company_resource_org_dependency_guard();
CREATE TRIGGER company_site_resource_dependencies BEFORE UPDATE ON public.company_sites FOR EACH ROW EXECUTE FUNCTION care_security.company_resource_org_dependency_guard();
CREATE TRIGGER company_department_resource_dependencies BEFORE UPDATE ON public.company_departments FOR EACH ROW EXECUTE FUNCTION care_security.company_resource_org_dependency_guard();

CREATE OR REPLACE FUNCTION care_security.company_inventory_resource_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NEW.status IN ('archived','decommissioned') AND OLD.status NOT IN ('archived','decommissioned') THEN PERFORM pg_advisory_xact_lock(hashtextextended('company-resources:'||OLD.tenant_id::text,0)); END IF;
 IF NEW.status IN ('archived','decommissioned') AND OLD.status NOT IN ('archived','decommissioned') AND (
   EXISTS(SELECT 1 FROM public.company_asset_links WHERE tenant_id=OLD.tenant_id AND inventory_item_id=OLD.id AND status='active')
   OR EXISTS(SELECT 1 FROM public.company_vehicles WHERE tenant_id=OLD.tenant_id AND inventory_item_id=OLD.id AND status<>'archived')
 ) THEN RAISE EXCEPTION 'Der Gegenstand ist noch einer Organisation oder einem aktiven Fahrzeug zugeordnet. Bitte diese Zuordnung zuerst abschließen.'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION care_security.company_inventory_resource_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER company_inventory_resource_dependencies BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION care_security.company_inventory_resource_guard();

COMMIT;
