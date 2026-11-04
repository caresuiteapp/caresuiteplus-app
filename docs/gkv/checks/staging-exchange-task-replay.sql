-- Native staging replay with generated synthetic IDs. No accounts, files, external services or commit.
-- The real tables, iteration functions, FKs and triggers remain active. All inserts roll back.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';
SET LOCAL search_path=pg_catalog,public;
DO $replay$
DECLARE t uuid:=gen_random_uuid(); client uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); v uuid:=gen_random_uuid();
 oldtask uuid:=gen_random_uuid(); newtask uuid:=gen_random_uuid(); oldlist jsonb; newlist jsonb;
BEGIN
 INSERT INTO public.tenants(id,name) VALUES(t,'GKV-Prüfung (Rollback)');
 INSERT INTO public.clients(id,tenant_id,first_name,last_name) VALUES(client,t,'Synthetisch','Rollback');
 INSERT INTO public.assignments(id,tenant_id,title) VALUES(a,t,'Prüfeinsatz');
 INSERT INTO public.assist_visits(id,tenant_id,client_id,legacy_assignment_id,title,assignment_date,planned_start_at,planned_end_at,planning_status)
 VALUES(v,t,client,a,'Aufgabenprüfung',CURRENT_DATE,CURRENT_DATE,CURRENT_DATE+interval '1 hour','draft');
 IF public.workflow_tasks_match('[]',t,v,a,false) IS NOT TRUE THEN RAISE EXCEPTION 'Empty real visit did not match'; END IF;
 INSERT INTO public.assignment_tasks(id,tenant_id,assignment_id,title,status,not_done_reason) VALUES(oldtask,t,a,'Aufgabe A','not_requested','Grund');
 oldlist:=jsonb_build_array(jsonb_build_object('id',oldtask,'title','Aufgabe A','status','not_requested','completionNote','Grund'));
 IF public.workflow_tasks_match(oldlist,t,v,a,true) IS NOT TRUE OR public.workflow_tasks_match('[]',t,v,a,false) IS NOT FALSE THEN
   RAISE EXCEPTION 'Legacy-only visit failed'; END IF;
 INSERT INTO public.assist_visit_tasks(id,tenant_id,visit_id,title,status) VALUES(newtask,t,v,'Aufgabe B','done');
 newlist:=jsonb_build_array(jsonb_build_object('id',newtask,'title','Aufgabe B','status','done'));
 IF public.workflow_tasks_match(newlist,t,v,a,false) IS NOT TRUE OR public.workflow_tasks_match(oldlist,t,v,a,true) IS NOT FALSE
   OR public.workflow_tasks_match(newlist||newlist,t,v,a,false) IS NOT FALSE
   OR public.workflow_tasks_match(newlist,gen_random_uuid(),v,a,false) IS NOT FALSE
   OR public.workflow_tasks_match('[]',t,gen_random_uuid(),a,true) IS NOT FALSE
   OR public.workflow_tasks_match('null',t,v,a,false) IS NOT FALSE THEN RAISE EXCEPTION 'Task source, cardinality, type or tenant scope failed'; END IF;
END $replay$;
SELECT 'passed' AS staging_task_sources_rolled_back;
ROLLBACK;
