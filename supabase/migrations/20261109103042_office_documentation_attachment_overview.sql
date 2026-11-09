-- Return only the types of attachments visible in the reader, for the current page.
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
 coalesce((
  SELECT jsonb_agg(to_jsonb(p) || jsonb_build_object(
   'attachment_mime_types',
   coalesce((
    SELECT jsonb_agg(a.mime_type ORDER BY a.created_at,a.id)
    FROM care_security.documentation_files a
    WHERE a.tenant_id=p.tenant_id AND a.entry_id=p.id AND a.source=p.source AND a.state='ready'
   ),'[]'::jsonb) ||
   CASE WHEN p.source='visit' THEN coalesce((
    SELECT jsonb_agg(original.file->>'mime_type' ORDER BY original.position)
    FROM jsonb_array_elements(care_security.documentation_visit_files(p.tenant_id,p.id))
     WITH ORDINALITY AS original(file,position)
   ),'[]'::jsonb) ELSE '[]'::jsonb END
  ) ORDER BY p.occurred_at DESC,p.source,p.id)
  FROM paged p
 ),'[]'::jsonb)
 INTO v_total,v_items;
 SELECT coalesce(jsonb_agg(m.entry_month ORDER BY m.entry_month DESC),'[]') INTO v_months
 FROM (SELECT DISTINCT to_char(occurred_at AT TIME ZONE 'Europe/Berlin','YYYY-MM') AS entry_month
 FROM care_security.office_documentation_feed WHERE tenant_id=p_tenant_id) m;
 RETURN jsonb_build_object('items',v_items,'total',v_total,'months',v_months,
 'clients',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'name',concat_ws(', ',nullif(btrim(c.last_name),''),nullif(btrim(c.first_name),'')))
 ORDER BY c.last_name,c.first_name,c.id) FROM public.clients c
 WHERE c.tenant_id=p_tenant_id AND c.deleted_at IS NULL AND c.status::text IN ('active','paused','inactive','archived','deceased','blocked')),'[]'),
 'employees',coalesce((SELECT jsonb_agg(jsonb_build_object('id',e.id,'name',concat_ws(', ',nullif(btrim(e.last_name),''),nullif(btrim(e.first_name),'')))
 ORDER BY e.last_name,e.first_name,e.id) FROM public.employees e
 WHERE e.tenant_id=p_tenant_id AND e.deleted_at IS NULL AND e.status::text<>'deleted'),'[]'));
END $$;

NOTIFY pgrst,'reload schema';
COMMIT;
