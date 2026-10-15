-- Apply after access, organization, scope access, resources.
-- Add restrictive ceilings to legacy inventory; portal policies remain in charge
-- of portal sessions. No inventory rows or saved widget records are rewritten.
BEGIN;
CREATE OR REPLACE FUNCTION care_security.company_business_session()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
  SELECT auth.uid() IS NOT NULL
    AND lower(coalesce(auth.jwt()->'app_metadata'->>'role_key','')) NOT IN ('employee_portal','client_portal','family_portal','employee','client','family','relative','caregiver','nurse')
    AND lower(coalesce(auth.jwt()->'app_metadata'->>'portal','')) NOT IN ('employee','client','family')
    AND lower(coalesce(auth.jwt()->'app_metadata'->>'portal_type','')) NOT IN ('employee','client','family')
    AND EXISTS(SELECT 1 FROM public.profiles p JOIN public.roles r ON r.id=p.role_id
      WHERE (p.auth_user_id=auth.uid() OR (p.auth_user_id IS NULL AND p.id=auth.uid()))
        AND lower(r.key) NOT IN ('employee_portal','client_portal','family_portal','employee','client','family','relative','caregiver','nurse'))
$body$;
CREATE OR REPLACE FUNCTION care_security.company_inventory_item_access(p_tenant uuid,p_item uuid,p_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
  SELECT care_security.company_actor(p_tenant,p_permission) OR EXISTS(
    SELECT 1 FROM public.company_asset_links a WHERE a.tenant_id=p_tenant AND a.inventory_item_id=p_item AND a.status='active'
      AND care_security.company_record_access(p_tenant,p_permission,a.entity_id,a.site_id,a.department_id))
$body$;
CREATE OR REPLACE FUNCTION care_security.company_inventory_employee_access(p_tenant uuid,p_employee uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
  SELECT EXISTS(SELECT 1 FROM public.employees e WHERE e.tenant_id=p_tenant AND e.id=p_employee
    AND ((care_security.company_actor(p_tenant,'inventory.view') AND care_security.company_actor(p_tenant,'office.employees.view'))
      OR EXISTS(SELECT 1 FROM public.company_employee_placements p WHERE p.tenant_id=p_tenant AND p.employee_id=e.id AND p.status='active'
        AND p.starts_on<=CURRENT_DATE AND (p.ends_on IS NULL OR p.ends_on>=CURRENT_DATE)
        AND care_security.company_record_access(p_tenant,'inventory.view',p.entity_id,p.site_id,p.department_id)
        AND care_security.company_record_access(p_tenant,'office.employees.view',p.entity_id,p.site_id,p.department_id))))
$body$;
CREATE OR REPLACE FUNCTION care_security.company_inventory_employee_choices(p_tenant uuid,p_offset integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
BEGIN
  IF NOT (care_security.company_can_read(p_tenant,'inventory.view') AND care_security.company_can_read(p_tenant,'office.employees.view')) THEN
    RAISE EXCEPTION 'Personalzuordnung ist nicht freigegeben' USING ERRCODE='42501'; END IF;
  IF p_offset IS NULL OR p_offset<0 THEN RAISE EXCEPTION 'Ungültiger Listenbeginn' USING ERRCODE='22023'; END IF;
  RETURN (SELECT coalesce(jsonb_agg(to_jsonb(e)),'[]'::jsonb) FROM (SELECT id,first_name,last_name,status FROM public.employees
    WHERE tenant_id=p_tenant AND care_security.company_inventory_employee_access(p_tenant,id) ORDER BY id OFFSET p_offset LIMIT 500)e);
END $body$;
CREATE OR REPLACE FUNCTION public.company_inventory_employee_choices(p_tenant_id uuid,p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $body$ SELECT care_security.company_inventory_employee_choices(p_tenant_id,p_offset) $body$;

CREATE OR REPLACE FUNCTION care_security.company_inventory_audit_item(p_tenant uuid,p_kind text,p_record uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE v_item uuid;
BEGIN
  CASE p_kind
    WHEN 'inventory_item' THEN SELECT id INTO v_item FROM public.inventory_items WHERE tenant_id=p_tenant AND id=p_record;
    WHEN 'inventory_assignment' THEN SELECT item_id INTO v_item FROM public.inventory_assignments WHERE tenant_id=p_tenant AND id=p_record;
    WHEN 'inventory_return' THEN SELECT item_id INTO v_item FROM public.inventory_return_records WHERE tenant_id=p_tenant AND id=p_record;
    WHEN 'inventory_damage' THEN SELECT item_id INTO v_item FROM public.inventory_damage_reports WHERE tenant_id=p_tenant AND id=p_record;
    ELSE v_item:=NULL;
  END CASE;
  RETURN v_item;
END $body$;

DO $body$
DECLARE v_table text; v_read text; v_write text; v_insert text; v_delete text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['inventory_items','inventory_assignments','inventory_return_records','inventory_damage_reports','inventory_categories','inventory_locations','inventory_return_protocols','device_management_profiles','inventory_audit_events'] LOOP
    CASE v_table
      WHEN 'inventory_items' THEN
        v_read:='care_security.company_inventory_item_access(tenant_id,id,''inventory.view'')';
        v_write:='(care_security.company_inventory_item_access(tenant_id,id,''inventory.manage_items'') OR care_security.company_inventory_item_access(tenant_id,id,''inventory.issue'') OR care_security.company_inventory_item_access(tenant_id,id,''inventory.return_manage'') OR care_security.company_inventory_item_access(tenant_id,id,''inventory.report_damage''))';
        v_insert:='care_security.company_actor(tenant_id,''inventory.manage_items'')';
        v_delete:='care_security.company_actor(tenant_id,''inventory.manage_items'')';
      WHEN 'inventory_assignments' THEN
        v_read:='care_security.company_inventory_item_access(tenant_id,item_id,''inventory.view'')';
        v_write:='(care_security.company_inventory_item_access(tenant_id,item_id,''inventory.issue'') OR care_security.company_inventory_item_access(tenant_id,item_id,''inventory.return_manage'') OR care_security.company_inventory_item_access(tenant_id,item_id,''inventory.report_damage'') OR care_security.company_inventory_item_access(tenant_id,item_id,''inventory.offboarding''))';
        v_insert:='care_security.company_inventory_item_access(tenant_id,item_id,''inventory.issue'') AND care_security.company_inventory_employee_access(tenant_id,recipient_employee_id)';
        v_delete:='care_security.company_actor(tenant_id,''inventory.manage_items'')';
      WHEN 'inventory_return_records' THEN
        v_read:='care_security.company_inventory_item_access(tenant_id,item_id,''inventory.view'')';
        v_write:='care_security.company_inventory_item_access(tenant_id,item_id,''inventory.return_manage'')'; v_insert:=v_write; v_delete:='false';
      WHEN 'inventory_damage_reports' THEN
        v_read:='care_security.company_inventory_item_access(tenant_id,item_id,''inventory.view'')';
        v_write:='care_security.company_inventory_item_access(tenant_id,item_id,''inventory.report_damage'')'; v_insert:=v_write; v_delete:='false';
      WHEN 'inventory_categories' THEN
        v_read:='care_security.company_actor(tenant_id,''inventory.view'') OR EXISTS(SELECT 1 FROM public.inventory_items i WHERE i.tenant_id=inventory_categories.tenant_id AND i.category_id=inventory_categories.id AND care_security.company_inventory_item_access(i.tenant_id,i.id,''inventory.view''))';
        v_write:='care_security.company_actor(tenant_id,''inventory.manage_items'')'; v_insert:=v_write; v_delete:=v_write;
      WHEN 'inventory_locations' THEN
        v_read:='care_security.company_actor(tenant_id,''inventory.view'') OR EXISTS(SELECT 1 FROM public.inventory_items i WHERE i.tenant_id=inventory_locations.tenant_id AND i.location_id=inventory_locations.id AND care_security.company_inventory_item_access(i.tenant_id,i.id,''inventory.view''))';
        v_write:='care_security.company_actor(tenant_id,''inventory.manage_items'')'; v_insert:=v_write; v_delete:=v_write;
      WHEN 'inventory_return_protocols' THEN
        v_read:='care_security.company_actor(tenant_id,''inventory.view'')';
        v_write:='care_security.company_actor(tenant_id,''inventory.offboarding'')'; v_insert:=v_write; v_delete:='false';
      WHEN 'device_management_profiles' THEN
        v_read:='care_security.company_inventory_item_access(tenant_id,item_id,''inventory.view'')';
        v_write:='care_security.company_actor(tenant_id,''inventory.manage_items'')'; v_insert:=v_write; v_delete:=v_write;
      WHEN 'inventory_audit_events' THEN
        -- Mutations insert and select their audit receipt even without global audit access.
        v_read:='care_security.company_actor(tenant_id,''inventory.audit_view'') OR (actor_profile_id=care_security.company_profile(tenant_id) AND care_security.company_inventory_item_access(tenant_id,care_security.company_inventory_audit_item(tenant_id,entity_type,entity_id),''inventory.view''))';
        v_insert:='actor_profile_id=care_security.company_profile(tenant_id) AND (care_security.company_inventory_item_access(tenant_id,care_security.company_inventory_audit_item(tenant_id,entity_type,entity_id),''inventory.manage_items'') OR care_security.company_inventory_item_access(tenant_id,care_security.company_inventory_audit_item(tenant_id,entity_type,entity_id),''inventory.issue'') OR care_security.company_inventory_item_access(tenant_id,care_security.company_inventory_audit_item(tenant_id,entity_type,entity_id),''inventory.return_manage'') OR care_security.company_inventory_item_access(tenant_id,care_security.company_inventory_audit_item(tenant_id,entity_type,entity_id),''inventory.report_damage'') OR care_security.company_actor(tenant_id,''inventory.offboarding''))';
        v_write:='false'; v_delete:='false';
    END CASE;
    EXECUTE format('DROP POLICY IF EXISTS company_inventory_read_ceiling ON public.%I',v_table);
    EXECUTE format('CREATE POLICY company_inventory_read_ceiling ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING(NOT care_security.company_business_session() OR (%s))',v_table,v_read);
    EXECUTE format('DROP POLICY IF EXISTS company_inventory_insert_ceiling ON public.%I',v_table);
    EXECUTE format('CREATE POLICY company_inventory_insert_ceiling ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(NOT care_security.company_business_session() OR (%s))',v_table,v_insert);
    EXECUTE format('DROP POLICY IF EXISTS company_inventory_update_ceiling ON public.%I',v_table);
    EXECUTE format('CREATE POLICY company_inventory_update_ceiling ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING(NOT care_security.company_business_session() OR (%s)) WITH CHECK(NOT care_security.company_business_session() OR (%s))',v_table,v_write,v_write);
    EXECUTE format('DROP POLICY IF EXISTS company_inventory_delete_ceiling ON public.%I',v_table);
    EXECUTE format('CREATE POLICY company_inventory_delete_ceiling ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING(NOT care_security.company_business_session() OR (%s))',v_table,v_delete);
  END LOOP;
END $body$;
CREATE OR REPLACE FUNCTION care_security.company_inventory_link_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE v jsonb:=to_jsonb(NEW); o jsonb; v_assignment public.inventory_assignments; v_employee uuid; v_key text;
BEGIN
  IF TG_OP='UPDATE' THEN o:=to_jsonb(OLD); END IF;
  IF TG_OP='UPDATE' AND (NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.id IS DISTINCT FROM OLD.id) THEN
    RAISE EXCEPTION 'Inventaridentität darf nicht geändert werden' USING ERRCODE='23514'; END IF;
  IF TG_TABLE_NAME='inventory_items' THEN
    IF NOT EXISTS(SELECT 1 FROM public.inventory_categories c WHERE c.tenant_id=NEW.tenant_id AND c.id=(v->>'category_id')::uuid)
      OR ((v->>'location_id') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.inventory_locations l WHERE l.tenant_id=NEW.tenant_id AND l.id=(v->>'location_id')::uuid)) THEN
      RAISE EXCEPTION 'Kategorie oder Lagerort gehört zu einem anderen Unternehmen' USING ERRCODE='23514'; END IF;
  ELSE
    IF NOT EXISTS(SELECT 1 FROM public.inventory_items i WHERE i.tenant_id=NEW.tenant_id AND i.id=(v->>'item_id')::uuid) THEN
      RAISE EXCEPTION 'Inventargegenstand gehört zu einem anderen Unternehmen' USING ERRCODE='23514'; END IF;
  END IF;
  IF TG_TABLE_NAME='inventory_assignments' THEN
    FOREACH v_key IN ARRAY ARRAY['recipient_employee_id','responsible_employee_id'] LOOP
      v_employee:=(v->>v_key)::uuid;
      IF v_employee IS NOT NULL AND (NOT EXISTS(SELECT 1 FROM public.employees e WHERE e.tenant_id=NEW.tenant_id AND e.id=v_employee)
        OR (care_security.company_business_session() AND (TG_OP='INSERT' OR v->>v_key IS DISTINCT FROM o->>v_key)
          AND NOT care_security.company_inventory_employee_access(NEW.tenant_id,v_employee))) THEN
        RAISE EXCEPTION 'Die Personalzuordnung liegt außerhalb Ihres Zugriffsbereichs' USING ERRCODE='42501'; END IF;
    END LOOP;
  END IF;
  IF TG_TABLE_NAME IN ('inventory_return_records','inventory_damage_reports') AND v->>'assignment_id' IS NOT NULL THEN
    SELECT * INTO v_assignment FROM public.inventory_assignments WHERE tenant_id=NEW.tenant_id AND id=(v->>'assignment_id')::uuid;
    IF NOT FOUND OR v_assignment.item_id<>(v->>'item_id')::uuid
      OR (TG_TABLE_NAME='inventory_return_records' AND v_assignment.recipient_employee_id IS DISTINCT FROM (v->>'employee_id')::uuid) THEN
      RAISE EXCEPTION 'Ausgabe, Inventargegenstand und Rückgabe gehören nicht zusammen' USING ERRCODE='23514'; END IF;
  END IF;
  IF TG_TABLE_NAME='inventory_damage_reports' AND v->>'employee_id' IS NOT NULL THEN
    v_employee:=(v->>'employee_id')::uuid;
    IF NOT EXISTS(SELECT 1 FROM public.employees e WHERE e.tenant_id=NEW.tenant_id AND e.id=v_employee)
      OR (care_security.company_business_session() AND (TG_OP='INSERT' OR v->>'employee_id' IS DISTINCT FROM o->>'employee_id')
        AND NOT care_security.company_inventory_employee_access(NEW.tenant_id,v_employee)) THEN
      RAISE EXCEPTION 'Die Personalzuordnung liegt außerhalb Ihres Zugriffsbereichs' USING ERRCODE='42501'; END IF;
  END IF;
  RETURN NEW;
END $body$;
REVOKE ALL ON FUNCTION care_security.company_inventory_link_guard() FROM PUBLIC,anon,authenticated;
DO $body$
DECLARE v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['inventory_items','inventory_assignments','inventory_return_records','inventory_damage_reports'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS company_inventory_link_guard ON public.%I',v_table);
    EXECUTE format('CREATE TRIGGER company_inventory_link_guard BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION care_security.company_inventory_link_guard()',v_table);
  END LOOP;
END $body$;
DO $body$
BEGIN
  IF to_regclass('public.employee_equipment_summary') IS NOT NULL THEN
    ALTER VIEW public.employee_equipment_summary SET (security_invoker=true);
  END IF;
END $body$;
REVOKE ALL ON FUNCTION care_security.company_business_session(),care_security.company_inventory_item_access(uuid,uuid,text),care_security.company_inventory_employee_access(uuid,uuid),
  care_security.company_inventory_employee_choices(uuid,integer),public.company_inventory_employee_choices(uuid,integer),care_security.company_inventory_audit_item(uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION care_security.company_business_session(),care_security.company_inventory_item_access(uuid,uuid,text),care_security.company_inventory_employee_access(uuid,uuid),
  care_security.company_inventory_employee_choices(uuid,integer),public.company_inventory_employee_choices(uuid,integer),care_security.company_inventory_audit_item(uuid,text,uuid) TO authenticated;
COMMIT;
