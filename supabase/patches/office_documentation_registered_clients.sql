-- Only registered client records belong in documentation selectors.
-- Keep historical documentation readable; reject draft associations on new writes.
BEGIN;
CREATE OR REPLACE FUNCTION care_security.documentation_workspace(p_tenant_id uuid,p_filters jsonb DEFAULT '{}')
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
 WHERE c.tenant_id=p_tenant_id AND c.deleted_at IS NULL AND c.status::text IN ('active','paused','inactive','archived','deceased','blocked')),'[]'),
 'employees',coalesce((SELECT jsonb_agg(jsonb_build_object('id',e.id,'name',concat_ws(' ',e.first_name,e.last_name))
 ORDER BY e.last_name,e.first_name,e.id) FROM public.employees e
 WHERE e.tenant_id=p_tenant_id AND e.deleted_at IS NULL AND e.status::text<>'deleted'),'[]'));
END $$;

CREATE OR REPLACE FUNCTION care_security.documentation_create(p_tenant_id uuid,p_id uuid,p_draft jsonb)
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
 OR (v_client IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients WHERE id=v_client AND tenant_id=p_tenant_id AND deleted_at IS NULL AND status::text IN ('active','paused','inactive','archived','deceased','blocked')))
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

NOTIFY pgrst,'reload schema';
COMMIT;
