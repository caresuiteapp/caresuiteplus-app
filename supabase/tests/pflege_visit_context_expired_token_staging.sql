-- Staging only. Synthetic fixtures; rollback required and asserted.
DO $test$ DECLARE t uuid:=gen_random_uuid();u uuid:=gen_random_uuid();s uuid:=gen_random_uuid();r uuid:=gen_random_uuid();e uuid:=gen_random_uuid();c uuid:=gen_random_uuid();tr uuid:=gen_random_uuid();st uuid:=gen_random_uuid();v jsonb;passed boolean:=false;BEGIN BEGIN
INSERT INTO public.tenants(id,name) VALUES(t,'CP365 isolated visit test');
INSERT INTO public.roles(id,key,name) VALUES(r,'cp365_'||r::text,'CP365 isolated test');
INSERT INTO public.role_permissions(role_id,permission_key) SELECT r,unnest(ARRAY['pflege.plans.view','pflege.risks.view','pflege.proofs.view','office.clients.view','office.clients.view_sensitive']);
INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data) VALUES(u,u::text||'@example.invalid','{}','{}');
UPDATE public.profiles SET tenant_id=t,role_id=r,role_key='pfleger',is_active=true,status='active',display_name='CP365 Test' WHERE id=u;
INSERT INTO auth.sessions(id,user_id,not_after) VALUES(s,u,clock_timestamp()+interval '1 hour');
INSERT INTO public.employees(id,tenant_id,profile_id,first_name,last_name) VALUES(e,t,u,'CP365','Test');
INSERT INTO public.clients(id,tenant_id,first_name,last_name) VALUES(c,t,'CP365','Test');
INSERT INTO public.care_tours(id,tenant_id,tour_date,name,employee_id) VALUES(tr,t,current_date,'CP365 test',e);
INSERT INTO public.care_tour_stops(id,tenant_id,tour_id,sequence_no,client_id,client_name_snapshot,planned_start,planned_end) VALUES(st,t,tr,1,c,'CP365 Test','10:00','11:00');
INSERT INTO public.care_admissions(tenant_id,client_id,status,starts_on,legal_basis,created_by) VALUES(t,c,'active',current_date-1,'sgb_xi',u);
INSERT INTO public.care_plans(tenant_id,client_id,title,status,valid_from) VALUES(t,c,'CP365 test','active',current_date-1);
PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','session_id',s,'exp',extract(epoch from clock_timestamp()+interval '1 hour')::bigint)::text,true);
EXECUTE 'SET LOCAL ROLE authenticated';
v:=public.web_visit_execution_context(t,u,st);
IF v->>'tenantId' IS DISTINCT FROM t::text OR v->>'stopId' IS DISTINCT FROM st::text OR jsonb_array_length(v#>'{sources,rows}')<4 THEN RAISE EXCEPTION 'Invalid visit context';END IF;
PERFORM set_config('request.jwt.claims',(auth.jwt()||'{"exp":1}'::jsonb)::text,true);BEGIN PERFORM public.web_visit_execution_context(t,u,st);RAISE EXCEPTION 'expired token accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
EXECUTE 'RESET ROLE';passed:=true;RAISE EXCEPTION USING ERRCODE='Z0001';
EXCEPTION WHEN SQLSTATE 'Z0001' THEN NULL;END;
IF NOT passed OR EXISTS(SELECT 1 FROM public.tenants WHERE id=t) OR EXISTS(SELECT 1 FROM auth.users WHERE id=u) THEN RAISE EXCEPTION 'Test or cleanup failed';END IF;
END $test$;
