-- Internal proof checks. No function here issues or attests a service record.
CREATE FUNCTION public.workflow_record_actor_allowed(t uuid, employee uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT COALESCE(auth.uid() IS NOT NULL AND t=public.current_tenant_id() AND (
   (public.current_portal_type()='employee' AND employee=public.resolve_current_employee_id()
    AND EXISTS(SELECT FROM public.employee_portal_accounts e WHERE e.id=public.current_portal_account_id()
     AND e.tenant_id=t AND e.employee_id=employee AND e.auth_user_id=auth.uid() AND e.status='active'))
   OR (COALESCE(public.current_portal_type(),'business')='business' AND EXISTS(
    SELECT FROM public.profiles p JOIN public.roles r ON r.id=p.role_id
    JOIN public.role_permissions rp ON rp.role_id=r.id
    WHERE (p.auth_user_id=auth.uid() OR (p.auth_user_id IS NULL AND p.id=auth.uid()))
      AND p.tenant_id=t AND p.is_active IS TRUE AND p.status::text='active'
      AND (to_jsonb(r)->>'tenant_id' IS NULL OR to_jsonb(r)->>'tenant_id'=t::text)
      AND (to_jsonb(rp)->>'tenant_id' IS NULL OR to_jsonb(rp)->>'tenant_id'=t::text)
      AND lower(r.key) NOT IN ('employee_portal','client_portal','family_portal','client','family','relative')
      AND ((rp.permission_key='assist.records.create' AND (rp.can_view IS TRUE OR rp.can_create IS TRUE))
        OR (rp.permission_key='records' AND rp.can_create IS TRUE))
   ))),false)
$$;

-- Match only known portal/assignment statuses. An unknown string is not evidence
-- that a task was recorded as "not done".
CREATE FUNCTION public.workflow_task_state(s text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT SECURITY INVOKER SET search_path=pg_catalog AS $$
 SELECT CASE WHEN s IN ('done','open','cancelled') THEN s
   WHEN s IN ('not_requested','not_wanted','skipped') THEN 'not_requested'
   WHEN s IN ('not_done','partial','not_possible','deferred','requires_follow_up') THEN 'not_done' END
$$;

CREATE FUNCTION public.workflow_tasks_match(tasks jsonb,t uuid,v uuid,a uuid,legacy boolean)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE linked uuid; has_visit_tasks boolean; has_assignment boolean; matches boolean;
BEGIN
 IF jsonb_typeof(tasks) IS DISTINCT FROM 'array' OR t IS NULL OR v IS NULL OR legacy IS NULL THEN RETURN false; END IF;
 SELECT legacy_assignment_id INTO linked FROM public.assist_visits WHERE tenant_id=t AND id=v;
 IF NOT FOUND OR linked IS DISTINCT FROM a THEN RETURN false; END IF;
 SELECT EXISTS(SELECT FROM public.assist_visit_tasks WHERE tenant_id=t AND visit_id=v) INTO has_visit_tasks;
 SELECT EXISTS(SELECT FROM public.assignments WHERE tenant_id=t AND id=COALESCE(linked,v)) INTO has_assignment;
 -- Prefer the canonical visit when it has tasks (a stale legacy snapshot must not win).
 -- With legacy tasks only, an empty canonical list must not satisfy the caller's OR.
 IF legacy AND (has_visit_tasks OR NOT has_assignment) THEN RETURN false; END IF;
 IF NOT legacy AND NOT has_visit_tasks AND has_assignment AND
   EXISTS(SELECT FROM public.assignment_tasks WHERE tenant_id=t AND assignment_id=COALESCE(linked,v)) THEN RETURN false; END IF;
 IF EXISTS(SELECT FROM jsonb_array_elements(tasks) x WHERE jsonb_typeof(x) IS DISTINCT FROM 'object'
     OR jsonb_typeof(x->'id') IS DISTINCT FROM 'string' OR jsonb_typeof(x->'title') IS DISTINCT FROM 'string'
     OR jsonb_typeof(x->'status') IS DISTINCT FROM 'string' OR public.workflow_task_state(x->>'status') IS NULL
     OR (x ? 'note' AND jsonb_typeof(x->'note') NOT IN ('string','null'))
     OR (x ? 'completionNote' AND jsonb_typeof(x->'completionNote') NOT IN ('string','null'))) THEN RETURN false; END IF;
 WITH expected AS (
   SELECT x->>'id' id,x->>'title' title,public.workflow_task_state(x->>'status') status,
    COALESCE(NULLIF(btrim(x->>'completionNote'),''),NULLIF(btrim(x->>'note'),''),'') note FROM jsonb_array_elements(tasks) x
 ), actual AS (
   SELECT id::text,title,public.workflow_task_state(status::text) status,COALESCE(NULLIF(btrim(not_done_reason),''),'') note
   FROM public.assist_visit_tasks WHERE NOT legacy AND tenant_id=t AND visit_id=v
   UNION ALL SELECT id::text,title,public.workflow_task_state(status::text),COALESCE(NULLIF(btrim(not_done_reason),''),'')
   FROM public.assignment_tasks WHERE legacy AND tenant_id=t AND assignment_id=COALESCE(linked,v)
 )
 SELECT NOT EXISTS((SELECT * FROM expected EXCEPT ALL SELECT * FROM actual)
   UNION ALL (SELECT * FROM actual EXCEPT ALL SELECT * FROM expected)) INTO matches;
 RETURN matches;
END $$;
