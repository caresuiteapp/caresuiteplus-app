-- Staging only. Synthetic fixtures are rolled back and cleanup is asserted.
-- Staging only. Synthetic JWT claims and database session; no Auth HTTP login.
-- All synthetic data is rolled back inside the anonymous block.
DO $test$ DECLARE t uuid:=gen_random_uuid();u uuid:=gen_random_uuid();s uuid:=gen_random_uuid();r uuid:=gen_random_uuid();e uuid:=gen_random_uuid();c uuid:=gen_random_uuid();tr uuid:=gen_random_uuid();st uuid:=gen_random_uuid();v jsonb;passed boolean:=false;BEGIN BEGIN
INSERT INTO public.tenants(id,name) VALUES(t,'CP365 medication page test');
INSERT INTO public.roles(id,key,name) VALUES(r,'cp365_'||r::text,'CP365 isolated test');
INSERT INTO public.role_permissions(role_id,permission_key) SELECT r,unnest(ARRAY['pflege.medications.view']);
INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data) VALUES(u,u::text||'@example.invalid','{}','{}');
UPDATE public.profiles SET tenant_id=t,role_id=r,role_key='pfleger',is_active=true,status='active',display_name='CP365 Test' WHERE id=u;
INSERT INTO auth.sessions(id,user_id,not_after) VALUES(s,u,clock_timestamp()+interval '1 hour');
INSERT INTO public.clients(id,tenant_id,first_name,last_name,status) VALUES(c,t,'CP365','Test','aktiv');
INSERT INTO public.client_module_assignments(tenant_id,client_id,module_key,status,is_active) VALUES(t,c,'pflege','active',true);
INSERT INTO public.medications(id,tenant_id,client_id,name,status,is_prn) VALUES(tr,t,c,'Synthetic medication','active',false);
PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','session_id',s,'exp',extract(epoch from clock_timestamp()+interval '1 hour')::bigint)::text,true);

v:=care_private.read_medication_safety_context(t,c,tr,u);
IF v#>>'{sources,order,id}' IS DISTINCT FROM tr::text THEN RAISE EXCEPTION 'Native context mismatch';END IF;
v:=care_private.read_medication_safety_page(t,c,tr,u,null,null,1);
IF v->'rows' IS DISTINCT FROM '[]'::jsonb OR v->'nextCursorId' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'Empty page invalid';END IF;
INSERT INTO public.medication_safety_events(id,tenant_id,client_id,medication_id,root_id,revision,kind,payload,source_snapshot,content_fingerprint,recorded_by,recorded_by_name,recorded_at)
SELECT id,t,c,tr,id,1,'reconciliation','{}','{}','sha256:'||repeat('a',64),u,'Synthetic test',now()-interval '1 minute' FROM (VALUES(st),(e)) AS fixture(id);
v:=care_private.read_medication_safety_page(t,c,tr,u,null,null,1);
IF jsonb_array_length(v->'rows')<>1 OR (v->>'nextCursorId')::uuid IS DISTINCT FROM greatest(st,e) THEN RAISE EXCEPTION 'First equal-time page invalid';END IF;
v:=care_private.read_medication_safety_page(t,c,tr,u,(v->>'nextCursorRecordedAt')::timestamptz,(v->>'nextCursorId')::uuid,1);
IF jsonb_array_length(v->'rows')<>1 OR (v->>'nextCursorId')::uuid IS DISTINCT FROM least(st,e) THEN RAISE EXCEPTION 'Second equal-time page invalid';END IF;
v:=care_private.read_medication_safety_page(t,c,tr,u,(v->>'nextCursorRecordedAt')::timestamptz,(v->>'nextCursorId')::uuid,1);
IF v->'rows' IS DISTINCT FROM '[]'::jsonb THEN RAISE EXCEPTION 'End page invalid';END IF;
BEGIN PERFORM care_private.read_medication_safety_page(t,c,tr,u,null,st,1);RAISE EXCEPTION 'Partial cursor accepted';EXCEPTION WHEN check_violation THEN NULL;END;
BEGIN PERFORM care_private.read_medication_safety_page(t,c,tr,u,null,null,null);RAISE EXCEPTION 'Null page size accepted';EXCEPTION WHEN check_violation THEN NULL;END;
passed:=true;RAISE EXCEPTION USING ERRCODE='Z0001';
EXCEPTION WHEN SQLSTATE 'Z0001' THEN NULL;END;
IF NOT passed OR EXISTS(SELECT 1 FROM public.tenants WHERE id=t) OR EXISTS(SELECT 1 FROM auth.users WHERE id=u) THEN RAISE EXCEPTION 'Test or cleanup failed';END IF;
END $test$;


