-- Shared staff documentation. Existing visit originals remain authoritative.
BEGIN;
CREATE TABLE care_security.office_documentation_entries (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 area text NOT NULL CHECK(area IN ('client','employee','administration')),
 client_id uuid REFERENCES public.clients(id), employee_id uuid REFERENCES public.employees(id),
 category text NOT NULL CHECK(category IN ('general','care','health','communication','organisation','personnel','incident')),
 priority text NOT NULL CHECK(priority IN ('normal','important','urgent')),
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 1 AND 180),
 body text NOT NULL CHECK(length(btrim(body)) BETWEEN 1 AND 20000),
 occurred_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 author_user_id uuid NOT NULL, author_name text NOT NULL,
 CHECK(area <> 'client' OR client_id IS NOT NULL),
 CHECK(area <> 'employee' OR employee_id IS NOT NULL)
);
ALTER TABLE care_security.office_documentation_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON care_security.office_documentation_entries FROM PUBLIC,anon,authenticated;
CREATE INDEX office_documentation_tenant_date ON care_security.office_documentation_entries(tenant_id,occurred_at DESC,id);
CREATE INDEX office_documentation_client ON care_security.office_documentation_entries(tenant_id,client_id,occurred_at DESC);
CREATE INDEX office_documentation_employee ON care_security.office_documentation_entries(tenant_id,employee_id,occurred_at DESC);

CREATE FUNCTION care_security.documentation_profile(p_tenant uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_id uuid; v_count integer;
BEGIN
 IF auth.uid() IS NULL OR p_tenant IS DISTINCT FROM public.current_tenant_id() THEN RETURN NULL; END IF;
 IF to_regprocedure('care_security.company_profile(uuid)') IS NOT NULL THEN
  EXECUTE 'SELECT care_security.company_profile($1)' INTO v_id USING p_tenant; RETURN v_id;
 END IF;
 -- Compatibility for older staging schemas: active, unique business profiles only.
 IF coalesce(public.current_portal_type(),'business')<>'business'
 OR lower(coalesce(auth.jwt()->'app_metadata'->>'portal_type','business'))<>'business' THEN RETURN NULL; END IF;
 SELECT count(*),(array_agg(p.id))[1] INTO v_count,v_id FROM public.profiles p JOIN public.roles r ON r.id=p.role_id
 WHERE (p.auth_user_id=auth.uid() OR (p.auth_user_id IS NULL AND p.id=auth.uid()))
 AND p.tenant_id=p_tenant AND p.is_active IS TRUE AND p.status::text='active'
 AND lower(r.key) NOT IN ('employee_portal','client_portal','family_portal','employee','client','family','relative','caregiver','nurse');
 IF v_count<>1 THEN RETURN NULL; END IF;
 RETURN v_id;
END $$;

CREATE FUNCTION care_security.documentation_employee(p_tenant uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT e.id FROM public.employee_portal_accounts a JOIN public.employees e ON e.id=a.employee_id AND e.tenant_id=a.tenant_id
 WHERE p_tenant=public.current_tenant_id() AND public.current_portal_type()='employee'
 AND a.id=public.current_portal_account_id() AND a.auth_user_id=auth.uid() AND a.tenant_id=p_tenant
 AND a.status::text='active' AND a.blocked_at IS NULL
 AND e.id=public.resolve_current_employee_id() AND e.status::text IN ('active','aktiv') AND e.deleted_at IS NULL
 AND (e.profile_id IS NULL OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=e.profile_id
 AND p.tenant_id=p_tenant AND p.status::text='active' AND p.is_active IS TRUE))
 AND NOT EXISTS(SELECT 1 FROM public.employee_portal_accounts b WHERE b.id<>a.id AND b.status::text='active'
 AND (b.auth_user_id=a.auth_user_id OR b.employee_id=e.id))
$$;

CREATE FUNCTION care_security.documentation_actor(p_tenant uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_allowed boolean;
BEGIN
 IF auth.uid() IS NULL OR p_tenant IS DISTINCT FROM public.current_tenant_id()
 OR NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=auth.uid() AND u.deleted_at IS NULL
 AND (u.banned_until IS NULL OR u.banned_until<=now())) THEN RETURN false; END IF;
 IF care_security.documentation_employee(p_tenant) IS NOT NULL THEN RETURN true; END IF;
 IF care_security.documentation_profile(p_tenant) IS NULL THEN RETURN false; END IF;
 IF to_regprocedure('care_security.company_actor(uuid,text)') IS NOT NULL THEN
  EXECUTE 'SELECT care_security.company_actor($1,$2)' INTO v_allowed USING p_tenant,'office.access'; RETURN coalesce(v_allowed,false);
 END IF;
 RETURN coalesce(public.has_permission('office.access'),false);
END $$;

CREATE VIEW care_security.office_documentation_feed WITH (security_invoker=true) AS
 SELECT n.id,n.tenant_id,'manual'::text AS source,n.area,n.client_id,n.employee_id,
 n.category,n.priority,n.title,n.body,n.occurred_at,n.created_at,n.author_user_id,n.author_name,
 NULL::uuid AS visit_id,
 coalesce(nullif(concat_ws(' ',c.first_name,c.last_name),''),'') AS client_name,
 coalesce(nullif(concat_ws(' ',e.first_name,e.last_name),''),'') AS employee_name
 FROM care_security.office_documentation_entries n
 LEFT JOIN public.clients c ON c.id=n.client_id AND c.tenant_id=n.tenant_id
 LEFT JOIN public.employees e ON e.id=n.employee_id AND e.tenant_id=n.tenant_id
 UNION ALL
 SELECT d.id,d.tenant_id,'visit','client',v.client_id,v.employee_id,
 CASE WHEN d.emergency_or_problem THEN 'incident' ELSE 'care' END,
 CASE WHEN d.emergency_or_problem THEN 'urgent' ELSE 'normal' END,
 coalesce(nullif(v.title,''),nullif(v.service_name,''),'Einsatzdokumentation'),
 concat_ws(E'\n\n',nullif(d.short_description,''),
 CASE WHEN nullif(d.special_notes,'') IS NOT NULL THEN 'Besonderheiten: '||d.special_notes END,
 CASE WHEN nullif(d.deviations,'') IS NOT NULL THEN 'Abweichungen: '||d.deviations END,
 CASE WHEN nullif(d.deviation_justification,'') IS NOT NULL THEN 'Begründung: '||d.deviation_justification END,
 CASE WHEN d.referral_required THEN 'Rückmeldung an die Verwaltung erforderlich.' END,
 CASE WHEN d.emergency_or_problem THEN 'Notfall oder Problem gemeldet.' END,
 CASE WHEN nullif(d.sis_notes,'') IS NOT NULL THEN 'SIS: '||d.sis_notes END,
 CASE WHEN nullif(d.vitals_summary,'') IS NOT NULL THEN 'Vitalwerte: '||d.vitals_summary END,
 CASE WHEN nullif(d.body_map_notes,'') IS NOT NULL THEN 'Körperbeobachtung: '||d.body_map_notes END,
 CASE WHEN nullif(d.medication_notes,'') IS NOT NULL THEN 'Medikation: '||d.medication_notes END,
 CASE WHEN nullif(d.care_report_notes,'') IS NOT NULL THEN 'Pflegebericht: '||d.care_report_notes END),
 coalesce(v.actual_end_at,d.submitted_at,d.created_at),d.created_at,NULL::uuid,
 coalesce(nullif(p.display_name,''),nullif(concat_ws(' ',e.first_name,e.last_name),''),'Mitarbeitende'),
 v.id,concat_ws(' ',c.first_name,c.last_name),concat_ws(' ',e.first_name,e.last_name)
 FROM public.assist_visit_documentation d
 JOIN public.assist_visits v ON v.id=d.visit_id AND v.tenant_id=d.tenant_id
 LEFT JOIN public.clients c ON c.id=v.client_id AND c.tenant_id=v.tenant_id
 LEFT JOIN public.employees e ON e.id=v.employee_id AND e.tenant_id=v.tenant_id
 LEFT JOIN public.profiles p ON p.id=d.submitted_by AND p.tenant_id=d.tenant_id
 WHERE v.execution_status='completed'
 AND v.canonical_status NOT IN ('cancelled','draft')
 AND d.submitted_at IS NOT NULL AND length(btrim(coalesce(d.short_description,'')))>0;
REVOKE ALL ON care_security.office_documentation_feed FROM PUBLIC,anon,authenticated;

CREATE FUNCTION care_security.documentation_workspace(p_tenant_id uuid,p_filters jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_filters jsonb:=coalesce(p_filters,'{}'); v_offset integer; v_month text;
 v_client uuid; v_employee uuid; v_items jsonb; v_total bigint; v_months jsonb;
 v_start timestamptz; v_end timestamptz;
BEGIN
 IF NOT coalesce(care_security.documentation_actor(p_tenant_id),false) THEN
  RAISE EXCEPTION 'Active staff access required' USING ERRCODE='42501'; END IF;
 v_offset:=coalesce((v_filters->>'offset')::integer,0);
 IF v_offset<0 OR v_offset>1000000 OR length(coalesce(v_filters->>'query',''))>200 THEN
  RAISE EXCEPTION 'Invalid filter' USING ERRCODE='22023'; END IF;
 v_month:=nullif(v_filters->>'month','');
 IF v_month IS NOT NULL THEN
  IF v_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
   RAISE EXCEPTION 'Invalid month' USING ERRCODE='22023'; END IF;
  v_start:=(v_month||'-01')::timestamp AT TIME ZONE 'Europe/Berlin';
  v_end:=((v_month||'-01')::date+interval '1 month')::timestamp AT TIME ZONE 'Europe/Berlin';
 END IF;
 v_client:=nullif(v_filters->>'clientId','')::uuid;
 v_employee:=nullif(v_filters->>'employeeId','')::uuid;
 WITH filtered AS (
 SELECT f.* FROM care_security.office_documentation_feed f
 WHERE f.tenant_id=p_tenant_id
 AND (v_month IS NULL OR (f.occurred_at>=v_start AND f.occurred_at<v_end))
 AND (nullif(v_filters->>'area','') IS NULL OR f.area=v_filters->>'area')
 AND (v_client IS NULL OR f.client_id=v_client)
 AND (v_employee IS NULL OR f.employee_id=v_employee)
 AND (nullif(v_filters->>'category','') IS NULL OR f.category=v_filters->>'category')
 AND (nullif(v_filters->>'source','') IS NULL OR f.source=v_filters->>'source')
 AND (nullif(v_filters->>'priority','') IS NULL OR f.priority=v_filters->>'priority')
 AND (nullif(btrim(v_filters->>'query'),'') IS NULL OR
  strpos(lower(concat_ws(' ',f.title,f.body,f.author_name,f.client_name,f.employee_name)),
         lower(btrim(v_filters->>'query')))>0)
 ), paged AS (SELECT * FROM filtered ORDER BY occurred_at DESC,source,id LIMIT 50 OFFSET v_offset)
 SELECT (SELECT count(*) FROM filtered),
 coalesce((SELECT jsonb_agg(to_jsonb(paged) ORDER BY occurred_at DESC,source,id) FROM paged),'[]')
 INTO v_total,v_items;
 SELECT coalesce(jsonb_agg(m.entry_month ORDER BY m.entry_month DESC),'[]') INTO v_months
 FROM (SELECT DISTINCT to_char(occurred_at AT TIME ZONE 'Europe/Berlin','YYYY-MM') AS entry_month
 FROM care_security.office_documentation_feed WHERE tenant_id=p_tenant_id) m;
 RETURN jsonb_build_object('items',v_items,'total',v_total,'months',v_months,
 'clients',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'name',concat_ws(' ',c.first_name,c.last_name))
 ORDER BY c.last_name,c.first_name,c.id) FROM public.clients c
 WHERE c.tenant_id=p_tenant_id AND c.deleted_at IS NULL AND c.status::text<>'deleted'),'[]'),
 'employees',coalesce((SELECT jsonb_agg(jsonb_build_object('id',e.id,'name',concat_ws(' ',e.first_name,e.last_name))
 ORDER BY e.last_name,e.first_name,e.id) FROM public.employees e
 WHERE e.tenant_id=p_tenant_id AND e.deleted_at IS NULL AND e.status::text<>'deleted'),'[]'));
END $$;

CREATE FUNCTION care_security.documentation_create(p_tenant_id uuid,p_id uuid,p_draft jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_client uuid; v_employee uuid; v_existing care_security.office_documentation_entries;
 v_created care_security.office_documentation_entries; v_name text; v_at timestamptz; v_payload jsonb;
BEGIN
 IF NOT coalesce(care_security.documentation_actor(p_tenant_id),false) THEN
  RAISE EXCEPTION 'Active staff access required' USING ERRCODE='42501'; END IF;
 IF p_id IS NULL OR p_draft IS NULL OR jsonb_typeof(p_draft)<>'object' THEN
  RAISE EXCEPTION 'Invalid entry' USING ERRCODE='22023'; END IF;
 v_client:=nullif(p_draft->>'clientId','')::uuid;
 v_employee:=nullif(p_draft->>'employeeId','')::uuid;
 v_at:=(p_draft->>'occurredAt')::timestamptz;
 IF v_at IS NULL OR NOT isfinite(v_at) OR v_at>now()+interval '5 minutes'
 OR length(btrim(coalesce(p_draft->>'title',''))) NOT BETWEEN 1 AND 180
 OR length(btrim(coalesce(p_draft->>'body',''))) NOT BETWEEN 1 AND 20000
 OR coalesce(p_draft->>'area','') NOT IN ('client','employee','administration')
 OR coalesce(p_draft->>'category','') NOT IN ('general','care','health','communication','organisation','personnel','incident')
 OR coalesce(p_draft->>'priority','') NOT IN ('normal','important','urgent') THEN
  RAISE EXCEPTION 'Invalid documentation content' USING ERRCODE='22023'; END IF;
 IF (p_draft->>'area'='client' AND v_client IS NULL) OR (p_draft->>'area'='employee' AND v_employee IS NULL)
 OR (v_client IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients WHERE id=v_client AND tenant_id=p_tenant_id AND deleted_at IS NULL))
 OR (v_employee IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.employees WHERE id=v_employee AND tenant_id=p_tenant_id AND deleted_at IS NULL)) THEN
  RAISE EXCEPTION 'Invalid tenant entity' USING ERRCODE='22023'; END IF;
 SELECT coalesce(nullif(p.display_name,''),nullif(concat_ws(' ',p.first_name,p.last_name),''),'Verwaltung') INTO v_name
 FROM public.profiles p WHERE p.id=care_security.documentation_profile(p_tenant_id);
 IF v_name IS NULL THEN
  SELECT concat_ws(' ',e.first_name,e.last_name) INTO v_name FROM public.employees e
  WHERE e.tenant_id=p_tenant_id AND e.id=care_security.documentation_employee(p_tenant_id);
 END IF;
 INSERT INTO care_security.office_documentation_entries(id,tenant_id,area,client_id,employee_id,category,priority,title,body,occurred_at,author_user_id,author_name)
 VALUES(p_id,p_tenant_id,p_draft->>'area',v_client,v_employee,p_draft->>'category',p_draft->>'priority',
 btrim(p_draft->>'title'),btrim(p_draft->>'body'),v_at,auth.uid(),coalesce(nullif(v_name,''),'Team'))
 ON CONFLICT(id) DO NOTHING RETURNING * INTO v_created;
 IF v_created.id IS NULL THEN
  SELECT * INTO v_existing FROM care_security.office_documentation_entries WHERE id=p_id;
  IF v_existing.tenant_id IS DISTINCT FROM p_tenant_id OR v_existing.author_user_id IS DISTINCT FROM auth.uid()
  OR v_existing.area IS DISTINCT FROM p_draft->>'area' OR v_existing.client_id IS DISTINCT FROM v_client
  OR v_existing.employee_id IS DISTINCT FROM v_employee OR v_existing.category IS DISTINCT FROM p_draft->>'category'
  OR v_existing.priority IS DISTINCT FROM p_draft->>'priority' OR v_existing.title IS DISTINCT FROM btrim(p_draft->>'title')
  OR v_existing.body IS DISTINCT FROM btrim(p_draft->>'body') OR v_existing.occurred_at IS DISTINCT FROM v_at THEN
   RAISE EXCEPTION 'Request identifier already used' USING ERRCODE='40001'; END IF;
  v_created:=v_existing;
 END IF;
 RETURN jsonb_build_object('id',v_created.id,'tenant_id',v_created.tenant_id,'created_at',v_created.created_at);
END $$;

-- Public entry points are invokers; authorization and privileged reads live in the private schema.
CREATE FUNCTION public.office_documentation_workspace(p_tenant_id uuid,p_filters jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
 SELECT care_security.documentation_workspace(p_tenant_id,p_filters)
$$;
CREATE FUNCTION public.office_documentation_create(p_tenant_id uuid,p_id uuid,p_draft jsonb)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path=pg_catalog AS $$
 SELECT care_security.documentation_create(p_tenant_id,p_id,p_draft)
$$;
REVOKE ALL ON FUNCTION care_security.documentation_profile(uuid),care_security.documentation_employee(uuid),care_security.documentation_actor(uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION care_security.documentation_workspace(uuid,jsonb),care_security.documentation_create(uuid,uuid,jsonb),
 public.office_documentation_workspace(uuid,jsonb),public.office_documentation_create(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA care_security TO authenticated;
GRANT EXECUTE ON FUNCTION care_security.documentation_workspace(uuid,jsonb),care_security.documentation_create(uuid,uuid,jsonb),
 public.office_documentation_workspace(uuid,jsonb),public.office_documentation_create(uuid,uuid,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
