-- Supplementary binding/source validation unit (mapping: reconstructed core native-source/time/kind/replay/immutability assertions).
-- It supplements all existing fixtures; no prior assertion or larger fixture is removed.
-- Privileged synthetic Auth/native sources only; no HTTP, browser, concurrency or clinical approval claim.
-- Requires the applied base+DTO before the binding-intent followup. All writes roll back.
BEGIN;
SET LOCAL statement_timeout='15s';
SET LOCAL lock_timeout='5s';
DO $unit$
DECLARE
 f_t uuid:=gen_random_uuid();f_c uuid:=gen_random_uuid();f_u uuid:=gen_random_uuid();f_r uuid:=gen_random_uuid();f_s uuid:=gen_random_uuid();
 f_plan uuid:=gen_random_uuid();f_version uuid:=gen_random_uuid();f_item uuid:=gen_random_uuid();f_tour uuid:=gen_random_uuid();f_stop uuid:=gen_random_uuid();f_bind_request uuid:=gen_random_uuid();f_care_request uuid:=gen_random_uuid();
 f_day date:=(clock_timestamp()at time zone 'Europe/Berlin')::date-1;f_at text;f_native jsonb;f_issue jsonb;f_binding jsonb;f_entry jsonb;f_packet jsonb;f_receipt jsonb;f_confirmed jsonb;f_finished boolean:=false;f_bad jsonb;f_new_version uuid;f_kind text;f_table text;f_role text;
BEGIN
 BEGIN
  IF to_regclass('care_private.basic_care_binding_intents')IS NOT NULL THEN RAISE EXCEPTION 'Run this supplementary baseline unit before the binding-intent followup';END IF;
  INSERT INTO public.tenants(id,name)VALUES(f_t,'Synthetic isolated BasicCare receipt unit');
  INSERT INTO public.roles(id,key,name)VALUES(f_r,'synthetic_basic_unit_'||f_r,'Synthetic native planning author');
  INSERT INTO public.role_permissions(role_id,permission_key)SELECT f_r,unnest(ARRAY['pflege.plans.view','pflege.plans.manage','pflege.documentation.view','pflege.documentation.create']);
  INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data)VALUES(f_u,f_u||'@example.invalid','{}','{}');
  UPDATE public.profiles SET tenant_id=f_t,role_id=f_r,role_key='pfleger',is_active=true,status='active',display_name='Synthetic isolated receipt author'WHERE id=f_u;
  INSERT INTO auth.sessions(id,user_id,not_after)VALUES(f_s,f_u,clock_timestamp()+interval '1 hour');
  INSERT INTO public.clients(id,tenant_id,first_name,last_name,status,lifecycle_status)VALUES(f_c,f_t,'Synthetic','Receipt unit client','aktiv','aktiv');
  INSERT INTO public.client_module_assignments(tenant_id,client_id,module_key,status,is_active)VALUES(f_t,f_c,'pflege','active',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',f_u,'role','authenticated','session_id',f_s,'exp',extract(epoch from clock_timestamp()+interval '1 hour')::bigint)::text,true);
  IF auth.uid()IS DISTINCT FROM f_u OR public.resolve_current_profile_id()IS DISTINCT FROM f_u OR public.current_tenant_id()IS DISTINCT FROM f_t THEN RAISE EXCEPTION 'Synthetic own Auth/session/profile/tenant was not actually established';END IF;
  PERFORM care_private.basic_care_actor(f_t,f_c,f_u,true);
  INSERT INTO public.care_plans(id,tenant_id,client_id,title,status,valid_from,valid_until)VALUES(f_plan,f_t,f_c,'Synthetic native individual planning unit','aktiv',f_day-1,f_day+7);
  INSERT INTO public.care_plan_items(id,tenant_id,care_plan_id,category,title,intervention,status,sort_order,created_by,updated_by)VALUES(f_item,f_t,f_plan,'body_care','Synthetic explicitly planned partial body care','Synthetic individual planned assistance','active',1,f_u,f_u);
  INSERT INTO public.care_plan_versions(id,tenant_id,care_plan_id,version,snapshot,reason,actor_id,actor_name)
   SELECT f_version,f_t,f_plan,1,jsonb_build_object('plan',to_jsonb(p),'items',(SELECT jsonb_agg(to_jsonb(i)ORDER BY i.id)FROM public.care_plan_items i WHERE i.care_plan_id=f_plan)),'Synthetic full native snapshot authored explicitly',f_u,'Synthetic isolated receipt author'FROM public.care_plans p WHERE p.id=f_plan;
  INSERT INTO public.care_tours(id,tenant_id,tour_date,name,status,created_by,updated_by)VALUES(f_tour,f_t,f_day,'Synthetic published receipt-unit tour','published',f_u,f_u);
  INSERT INTO public.care_tour_stops(id,tenant_id,tour_id,sequence_no,client_id,client_name_snapshot,planned_start,planned_end,status)VALUES(f_stop,f_t,f_tour,1,f_c,'Synthetic client','08:15:30.123456','08:45:30.123456','planned');
  f_native:=care_private.basic_care_native_sources(f_t,f_c,f_version,f_item,f_stop);
  f_at:=to_char(((f_day+time '08:15:30.123456')at time zone 'Europe/Berlin')at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
  f_issue:=jsonb_build_object('schemaVersion','1','requestId',f_bind_request,'tenantId',f_t,'clientId',f_c,'actorId',f_u,'planVersionId',f_version,'measureId',f_item,'visitId',f_stop,'plannedAt',f_at,'timeZone','Europe/Berlin','secondPersonRequired',false,'reason','Synthetic explicit planned selection without an actual care claim','sources',f_native);
  -- Every fresh validation below runs BEFORE any binding exists, so duplicate-source rejection cannot mask the intended guard.
  BEGIN PERFORM public.web_issue_basic_care_binding(f_issue-'secondPersonRequired');RAISE EXCEPTION 'Missing explicit second-person decision inferred';EXCEPTION WHEN check_violation THEN NULL;END;
  BEGIN PERFORM public.web_issue_basic_care_binding(f_issue||jsonb_build_object('timeZone','UTC'));RAISE EXCEPTION 'Native local zone silently inferred';EXCEPTION WHEN check_violation THEN NULL;END;
  BEGIN PERFORM public.web_issue_basic_care_binding(f_issue||jsonb_build_object('plannedAt',to_char((f_at::timestamptz+interval '1 microsecond')at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')));RAISE EXCEPTION 'One-microsecond wrong native plan time accepted';EXCEPTION WHEN check_violation THEN NULL;END;
  BEGIN UPDATE public.care_tour_stops SET notes='Synthetic whole native source drift'WHERE id=f_stop;PERFORM public.web_issue_basic_care_binding(f_issue);RAISE EXCEPTION 'Whole native stop drift ignored';EXCEPTION WHEN serialization_failure THEN NULL;END;
  BEGIN UPDATE public.care_tour_stops SET status='cancelled'WHERE id=f_stop;PERFORM public.web_issue_basic_care_binding(f_issue);RAISE EXCEPTION 'Cancelled native stop remained bindable';EXCEPTION WHEN serialization_failure THEN NULL;END;
  BEGIN UPDATE public.care_tours SET status='draft'WHERE id=f_tour;PERFORM public.web_issue_basic_care_binding(f_issue);RAISE EXCEPTION 'Unpublished native tour remained bindable';EXCEPTION WHEN serialization_failure THEN NULL;END;
  BEGIN UPDATE public.care_plan_items SET intervention='Synthetic changed whole plan item'WHERE id=f_item;PERFORM public.web_issue_basic_care_binding(f_issue);RAISE EXCEPTION 'Stale complete native version snapshot accepted';EXCEPTION WHEN serialization_failure THEN NULL;END;
  FOREACH f_kind IN ARRAY ARRAY['pressure_prevention','fall_prevention','unknown_kind','short_title']LOOP
   BEGIN
    UPDATE public.care_plan_items SET category=CASE WHEN f_kind='short_title'THEN 'body_care'ELSE f_kind END,title=CASE WHEN f_kind='short_title'THEN 'xx'ELSE f_native#>>'{measure,title}'END WHERE id=f_item;
    f_new_version:=gen_random_uuid();INSERT INTO public.care_plan_versions(id,tenant_id,care_plan_id,version,snapshot,reason,actor_id,actor_name)SELECT f_new_version,f_t,f_plan,2,jsonb_build_object('plan',to_jsonb(p),'items',(SELECT jsonb_agg(to_jsonb(i)ORDER BY i.id)FROM public.care_plan_items i WHERE i.care_plan_id=f_plan)),'Synthetic explicitly authored unsupported binding source',f_u,'Synthetic isolated receipt author'FROM public.care_plans p WHERE p.id=f_plan;
    f_bad:=f_issue||jsonb_build_object('planVersionId',f_new_version,'sources',care_private.basic_care_native_sources(f_t,f_c,f_new_version,f_item,f_stop));
    BEGIN PERFORM public.web_issue_basic_care_binding(f_bad);RAISE EXCEPTION 'Unsupported native kind/title inferred from plausible text';EXCEPTION WHEN check_violation THEN NULL;END;
    RAISE EXCEPTION USING ERRCODE='Z0002';EXCEPTION WHEN SQLSTATE 'Z0002'THEN NULL;END;
  END LOOP;
  f_binding:=public.web_issue_basic_care_binding(p_packet=>f_issue);
  IF f_binding->>'requestId'IS DISTINCT FROM f_bind_request::text OR f_binding->'packet'IS DISTINCT FROM f_issue OR care_private.basic_care_uuid(f_binding->'bindingId')IS DISTINCT FROM true OR f_binding#>>'{plan,planVersionId}'IS DISTINCT FROM f_version::text OR f_binding#>>'{plan,measureId}'IS DISTINCT FROM f_item::text OR f_binding#>>'{plan,visitId}'IS DISTINCT FROM f_stop::text OR f_binding#>>'{plan,plannedAt}'IS DISTINCT FROM f_at THEN RAISE EXCEPTION 'Actual native issuer lost exact call/selection';END IF;
  IF public.web_issue_basic_care_binding(f_issue)IS DISTINCT FROM f_binding THEN RAISE EXCEPTION 'Issuer own exact retry changed immutable original';END IF;
  BEGIN PERFORM public.web_issue_basic_care_binding(f_issue||jsonb_build_object('reason','Synthetic changed captured request'));RAISE EXCEPTION 'Captured request rewritten';EXCEPTION WHEN serialization_failure THEN NULL;END;
  BEGIN PERFORM public.web_issue_basic_care_binding(f_issue||jsonb_build_object('requestId',gen_random_uuid()));RAISE EXCEPTION 'Already bound sources bound under fresh request';EXCEPTION WHEN serialization_failure THEN NULL;END;
  BEGIN UPDATE public.basic_care_plan_bindings SET title='Synthetic forbidden mutation'WHERE id=(f_binding->>'bindingId')::uuid;RAISE EXCEPTION 'Native binding mutable';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  BEGIN DELETE FROM care_private.basic_care_binding_requests WHERE request_id=f_bind_request;RAISE EXCEPTION 'Issuer own receipt deletable';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  BEGIN UPDATE public.care_plan_versions SET reason='Synthetic forbidden historical edit'WHERE id=f_version;RAISE EXCEPTION 'Bound native version mutable';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  BEGIN DELETE FROM public.care_plan_versions WHERE id=f_version;RAISE EXCEPTION 'Bound native version deletable';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  FOREACH f_table IN ARRAY ARRAY['public.basic_care_plan_bindings','care_private.basic_care_binding_requests']LOOP
   IF(SELECT c.relrowsecurity FROM pg_class c WHERE c.oid=f_table::regclass)IS DISTINCT FROM true THEN RAISE EXCEPTION 'Binding RLS absent';END IF;
   FOREACH f_role IN ARRAY ARRAY['anon','authenticated','service_role']LOOP IF has_table_privilege(f_role,f_table,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')THEN RAISE EXCEPTION 'Binding table application grant exposed';END IF;END LOOP;
  END LOOP;
  IF(SELECT count(*)FROM public.basic_care_plan_bindings WHERE tenant_id=f_t)IS DISTINCT FROM 1 OR(SELECT count(*)FROM care_private.basic_care_binding_requests WHERE tenant_id=f_t)IS DISTINCT FROM 1 OR EXISTS(SELECT 1 FROM public.basic_care_events WHERE tenant_id=f_t)OR care_private.basic_care_native_sources(f_t,f_c,f_version,f_item,f_stop)IS DISTINCT FROM f_native THEN RAISE EXCEPTION 'Fresh negatives/retries left data or changed native originals';END IF;
  f_finished:=true;RAISE EXCEPTION USING ERRCODE='Z0001';
 EXCEPTION WHEN SQLSTATE 'Z0001'THEN NULL;END;
 IF f_finished IS DISTINCT FROM true OR EXISTS(SELECT 1 FROM public.tenants WHERE id=f_t)OR EXISTS(SELECT 1 FROM auth.users WHERE id=f_u)OR EXISTS(SELECT 1 FROM auth.sessions WHERE id=f_s)OR EXISTS(SELECT 1 FROM public.profiles WHERE id=f_u)OR EXISTS(SELECT 1 FROM public.roles WHERE id=f_r)OR EXISTS(SELECT 1 FROM public.role_permissions WHERE role_id=f_r)OR EXISTS(SELECT 1 FROM public.role_permission_sets WHERE tenant_id=f_t)OR EXISTS(SELECT 1 FROM public.clients WHERE id=f_c)OR EXISTS(SELECT 1 FROM public.client_module_assignments WHERE tenant_id=f_t)OR EXISTS(SELECT 1 FROM public.care_plans WHERE id=f_plan)OR EXISTS(SELECT 1 FROM public.care_plan_versions WHERE id=f_version)OR EXISTS(SELECT 1 FROM public.care_plan_items WHERE id=f_item)OR EXISTS(SELECT 1 FROM public.care_tours WHERE id=f_tour)OR EXISTS(SELECT 1 FROM public.care_tour_stops WHERE id=f_stop)OR EXISTS(SELECT 1 FROM care_private.basic_care_binding_requests WHERE tenant_id=f_t)OR EXISTS(SELECT 1 FROM public.basic_care_plan_bindings WHERE tenant_id=f_t)OR EXISTS(SELECT 1 FROM public.basic_care_roots WHERE tenant_id=f_t)OR EXISTS(SELECT 1 FROM public.basic_care_events WHERE tenant_id=f_t)OR EXISTS(SELECT 1 FROM public.basic_care_receipts WHERE tenant_id=f_t)OR EXISTS(SELECT 1 FROM public.basic_care_review_roots WHERE tenant_id=f_t)OR EXISTS(SELECT 1 FROM public.basic_care_review_events WHERE tenant_id=f_t)OR EXISTS(SELECT 1 FROM public.basic_care_review_receipts WHERE tenant_id=f_t)THEN RAISE EXCEPTION 'Supplementary isolated unit full rollback cleanup failed';END IF;
 PERFORM set_config('cp365.basic_binding_validation_unit',jsonb_build_object('expected',jsonb_build_object('tenantId',f_t,'clientId',f_c,'authorId',f_u,'planVersionId',f_version,'measureId',f_item,'visitId',f_stop,'issueRequestId',f_bind_request),'issuePacket',f_issue,'issueReceipt',f_binding,'bindingValidationUnit',true,'rollbackCleanupPassed',true)::text,true);
END
$unit$;
SELECT current_setting('cp365.basic_binding_validation_unit',true)::jsonb AS synthetic_evidence;
ROLLBACK;
