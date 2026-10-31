-- Staging only. Synthetic fixtures are rolled back and cleanup is asserted.
-- Staging only. Synthetic JWT claims and database session; no Auth HTTP login.
-- All synthetic data is rolled back inside the anonymous block.
DO $test$ DECLARE t uuid:=gen_random_uuid();u uuid:=gen_random_uuid();s uuid:=gen_random_uuid();r uuid:=gen_random_uuid();e uuid:=gen_random_uuid();c uuid:=gen_random_uuid();tr uuid:=gen_random_uuid();st uuid:=gen_random_uuid();v jsonb;p jsonb;receipt jsonb;replay jsonb;revised jsonb;old_packet jsonb;guard_key text;passed boolean:=false;BEGIN BEGIN
INSERT INTO public.tenants(id,name) VALUES(t,'CP365 medication page test');
INSERT INTO public.roles(id,key,name) VALUES(r,'cp365_'||r::text,'CP365 isolated test');
INSERT INTO public.role_permissions(role_id,permission_key) SELECT r,unnest(ARRAY['pflege.medications.view','pflege.medications.manage','pflege.medications.administer','office.clients.view','office.clients.edit']);
INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data) VALUES(u,u::text||'@example.invalid','{}','{}');
UPDATE public.profiles SET tenant_id=t,role_id=r,role_key='pfleger',is_active=true,status='active',display_name='CP365 Test' WHERE id=u;
INSERT INTO auth.sessions(id,user_id,not_after) VALUES(s,u,clock_timestamp()+interval '1 hour');
INSERT INTO public.clients(id,tenant_id,first_name,last_name,status) VALUES(c,t,'CP365','Test','aktiv');
INSERT INTO public.client_module_assignments(tenant_id,client_id,module_key,status,is_active) VALUES(t,c,'pflege','active',true);
INSERT INTO public.medications(id,tenant_id,client_id,name,status,is_prn,active_ingredient,strength,form,prescribed_dose,dose_unit,route,prescribed_by,start_date,indication) VALUES(tr,t,c,'Metamizol','active',false,'Metamizol-Natrium','500 mg','Tablette','1','Tablette','oral','Ärztliche Verordnung','2026-10-01','Dokumentierte Schmerzindikation');
PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','session_id',s,'exp',extract(epoch from clock_timestamp()+interval '1 hour')::bigint)::text,true);

EXECUTE 'SET LOCAL ROLE authenticated';
UPDATE public.medications SET dosage='Synthetic legacy presentation' WHERE id=tr;
IF NOT FOUND THEN RAISE EXCEPTION 'Legacy client write was not reachable; guard proof invalid';END IF;
FOR guard_key IN SELECT unnest(ARRAY['prescribed_dose','dose_unit','minimum_interval_minutes','maximum_dose','maximum_dose_unit','maximum_period_hours']) LOOP
 BEGIN
  EXECUTE format('UPDATE public.medications SET %I=$1 WHERE id=$2',guard_key) USING '2',tr;
  RAISE EXCEPTION 'Direct structured field update accepted: %',guard_key;
 EXCEPTION WHEN insufficient_privilege THEN
  IF SQLERRM NOT LIKE 'Strukturierte Verordnungsangaben benötigen%' THEN RAISE;END IF;
 END;
END LOOP;
BEGIN UPDATE public.medications SET prescribed_dose=null WHERE id=tr;RAISE EXCEPTION 'Direct clearing of native dose accepted';EXCEPTION WHEN insufficient_privilege THEN IF SQLERRM NOT LIKE 'Strukturierte Verordnungsangaben benötigen%' THEN RAISE;END IF;END;
BEGIN INSERT INTO public.medications(id,tenant_id,client_id,name,prescribed_dose,dose_unit) VALUES(gen_random_uuid(),t,c,'Direct synthetic claim','1','Tablette');RAISE EXCEPTION 'Direct structured insert accepted';EXCEPTION WHEN insufficient_privilege THEN IF SQLERRM NOT LIKE 'Strukturierte Verordnungsangaben benötigen%' THEN RAISE;END IF;END;
EXECUTE 'RESET ROLE';
passed:=true;RAISE EXCEPTION USING ERRCODE='Z0001';
EXCEPTION WHEN SQLSTATE 'Z0001' THEN NULL;END;
IF NOT passed OR EXISTS(SELECT 1 FROM public.tenants WHERE id=t) OR EXISTS(SELECT 1 FROM auth.users WHERE id=u) THEN RAISE EXCEPTION 'Test or cleanup failed';END IF;
END $test$;


