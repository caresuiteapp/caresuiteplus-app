-- Staging only. Synthetic fixtures are rolled back and cleanup is asserted.
DO $test$ DECLARE t uuid:=gen_random_uuid();c uuid:=gen_random_uuid();m uuid:=gen_random_uuid();a uuid:=gen_random_uuid();v jsonb;passed boolean:=false;BEGIN BEGIN
INSERT INTO public.tenants(id,name) VALUES(t,'CP365 medication read rollback');
INSERT INTO public.clients(id,tenant_id,first_name,last_name) VALUES(c,t,'CP365','Test');
INSERT INTO public.medications(id,tenant_id,client_id,name,dosage) VALUES(m,t,c,'Synthetic medication','1');
INSERT INTO public.medication_administrations(id,tenant_id,medication_id,client_id,status,administered_at,administered_dose,route) VALUES(a,t,m,c,'administered',clock_timestamp()-interval '1 hour','1','oral');
v:=care_private.medication_source_snapshot(t,c,m);
IF v#>>'{order,id}' IS DISTINCT FROM m::text OR v#>'{order,status}' IS DISTINCT FROM 'null'::jsonb OR jsonb_array_length(v->'administrations')<>1 OR v#>'{administrations,0,occurredAt}' IS DISTINCT FROM 'null'::jsonb OR v#>'{administrations,0,unit}' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'Source fabricated or lost native evidence';END IF;
passed:=true;RAISE EXCEPTION USING ERRCODE='Z0001';EXCEPTION WHEN SQLSTATE 'Z0001' THEN NULL;END;
IF NOT passed OR EXISTS(SELECT 1 FROM public.tenants WHERE id=t) OR EXISTS(SELECT 1 FROM public.medications WHERE id=m) THEN RAISE EXCEPTION 'Source test or rollback failed';END IF;
END $test$;

