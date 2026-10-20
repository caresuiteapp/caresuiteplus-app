import fs from 'node:fs';
import path from 'node:path';

const supplied = process.argv.slice(2).find(arg => !arg.startsWith('--'));
const installed = process.argv.includes('--installed') || process.argv.includes('--for-migration');
const forMigration = process.argv.includes('--for-migration');
const sourcePath = supplied ?? fs.readdirSync('supabase/migrations').map(name => path.join('supabase/migrations',name)).find(name => name.endsWith('_employee_optional_visit_tasks.sql'));
if (!sourcePath) throw new Error('Die Aufgabenänderung fehlt.');
const source = fs.readFileSync(sourcePath,'utf8');
let definition = source.slice(source.indexOf('CREATE OR REPLACE FUNCTION caresuite_private.employee_add_optional_visit_tasks('),source.indexOf('REVOKE ALL ON FUNCTION caresuite_private.employee_add_optional_visit_tasks'));
if (!definition.includes('RETURNS jsonb') || !definition.endsWith('$function$;\n')) throw new Error('Die begrenzte Aufgabenfunktion konnte nicht gelesen werden.');
definition = definition.replaceAll('caresuite_private.employee_add_optional_visit_tasks','pg_temp.employee_add_optional_visit_tasks').replaceAll('auth.uid()','pg_temp.fixture_user()');
for (const table of ['assignments','assist_visits','assignment_tasks','assist_visit_tasks','assist_visit_audit_logs']) definition = definition.replaceAll('public.'+table,'pg_temp.'+table);
for (const name of ['resolve_current_employee_id','current_tenant_id','is_employee_portal_rls_context','platform_tenant_access_allowed']) definition=definition.replaceAll('public.'+name,'pg_temp.'+name);
if (installed) definition = `DO $clone$ DECLARE definition text; name text; BEGIN
  definition:=pg_catalog.pg_get_functiondef('caresuite_private.employee_add_optional_visit_tasks(uuid,text,uuid,jsonb)'::regprocedure);
  definition:=replace(replace(definition,'caresuite_private.employee_add_optional_visit_tasks','pg_temp.employee_add_optional_visit_tasks'),'auth.uid()','pg_temp.fixture_user()');
  FOREACH name IN ARRAY ARRAY['assignments','assist_visits','assignment_tasks','assist_visit_tasks','assist_visit_audit_logs','resolve_current_employee_id','current_tenant_id','is_employee_portal_rls_context','platform_tenant_access_allowed'] LOOP definition:=replace(definition,'public.'||name,'pg_temp.'||name); END LOOP;
  EXECUTE definition;
END $clone$;`;
process.stdout.write(`${forMigration ? '' : 'BEGIN;'}
CREATE TEMP TABLE optional_task_check_results(denials integer NOT NULL DEFAULT 0);
INSERT INTO optional_task_check_results DEFAULT VALUES;
CREATE TEMP TABLE assignments(id uuid PRIMARY KEY,tenant_id uuid,employee_id uuid,status text);
CREATE TEMP TABLE assist_visits(id uuid PRIMARY KEY,tenant_id uuid,employee_id uuid,employee_portal_visible boolean,planning_status text,canonical_status text,proof_status text,billing_status text,legacy_assignment_id uuid);
CREATE TEMP TABLE assist_visit_tasks(id uuid PRIMARY KEY,tenant_id uuid,visit_id uuid,title text,status text,is_required boolean,is_optional boolean,requires_note_if_not_done boolean,sort_order integer,payload_json jsonb,not_done_reason text);
CREATE TEMP TABLE assignment_tasks(id uuid PRIMARY KEY,tenant_id uuid,assignment_id uuid,title text,status text,is_required boolean,requires_note_if_not_done boolean,sort_order integer,not_done_reason text);
CREATE TEMP TABLE assist_visit_audit_logs(tenant_id uuid,visit_id uuid,action text,details text,metadata jsonb);
CREATE FUNCTION pg_temp.fixture_user() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('fixture.optional_user',true),'')::uuid $$;
CREATE FUNCTION pg_temp.resolve_current_employee_id() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('fixture.optional_employee',true),'')::uuid $$;
CREATE FUNCTION pg_temp.current_tenant_id() RETURNS uuid LANGUAGE sql AS $$ SELECT '10000000-0000-4000-8000-000000000001'::uuid $$;
CREATE FUNCTION pg_temp.is_employee_portal_rls_context(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('fixture.optional_role',true)='employee_portal' $$;
CREATE FUNCTION pg_temp.platform_tenant_access_allowed(uuid,boolean) RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('fixture.optional_blocked',true) IS DISTINCT FROM 'true' $$;
SELECT set_config('fixture.optional_user','10000000-0000-4000-8000-000000000002',true),set_config('fixture.optional_employee','10000000-0000-4000-8000-000000000003',true),set_config('fixture.optional_role','employee_portal',true);
${definition}
CREATE FUNCTION pg_temp.assert_optional(ok boolean,message text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'Prüfung fehlgeschlagen: %',message; END IF; END $$;
CREATE FUNCTION pg_temp.expect_optional_denial(statement text,expected text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE denied boolean:=false; BEGIN
  BEGIN EXECUTE statement; EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE<>expected THEN RAISE; END IF; denied:=true;
  END;
  PERFORM pg_temp.assert_optional(denied,'erwartete Verweigerung '||expected);
  UPDATE optional_task_check_results SET denials=denials+1;
END $$;
INSERT INTO assignments VALUES('10000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','started'),('10000000-0000-4000-8000-000000000012','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','started');
INSERT INTO assist_visits VALUES('10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003',true,'confirmed','started','none','none','10000000-0000-4000-8000-000000000011');
DO $$ DECLARE result jsonb; statement text; base text:= 'SELECT pg_temp.employee_add_optional_visit_tasks(''10000000-0000-4000-8000-000000000001'',''assist_visits'',''10000000-0000-4000-8000-000000000010'','; BEGIN
 result:=pg_temp.employee_add_optional_visit_tasks('10000000-0000-4000-8000-000000000001','assist_visits','10000000-0000-4000-8000-000000000010','[{"id":"10000000-0000-4000-8000-000000000021","title":"Spaziergang","catalogId":"assist-task-sp-001"},{"id":"10000000-0000-4000-8000-000000000022","title":"Briefkasten leeren"}]');
 PERFORM pg_temp.assert_optional((result->>'inserted')::int=2,'Vorlage und manuelle Aufgabe');
 PERFORM pg_temp.assert_optional((SELECT count(*)=2 AND bool_and(NOT is_required AND is_optional) FROM assist_visit_tasks),'optional statt verpflichtend');
 PERFORM pg_temp.assert_optional((SELECT count(*)=2 AND bool_and(NOT is_required) FROM assignment_tasks),'bestehende Einsatzansicht verbunden');
 PERFORM pg_temp.assert_optional((SELECT count(*)=1 FROM assist_visit_audit_logs),'Anlage protokolliert');
 result:=pg_temp.employee_add_optional_visit_tasks('10000000-0000-4000-8000-000000000001','assist_visits','10000000-0000-4000-8000-000000000010','[{"id":"10000000-0000-4000-8000-000000000021","title":"Spaziergang"}]');
 PERFORM pg_temp.assert_optional((result->>'inserted')::int=0 AND (SELECT count(*)=2 FROM assist_visit_tasks),'Wiederholung ohne Doppelanlage');
 UPDATE assist_visit_tasks SET status='done',not_done_reason='Vorherige Notiz' WHERE id='10000000-0000-4000-8000-000000000021';
 result:=pg_temp.employee_add_optional_visit_tasks('10000000-0000-4000-8000-000000000001','assist_visits','10000000-0000-4000-8000-000000000010','[{"id":"10000000-0000-4000-8000-000000000023","title":"  spaziergang  "}]');
 PERFORM pg_temp.assert_optional((result->>'inserted')::int=0 AND result#>>'{tasks,0,status}'='done' AND result#>>'{tasks,0,completionNote}'='Vorherige Notiz','vorhandener Status und Notiz erhalten');
 INSERT INTO assist_visit_tasks(id,tenant_id,visit_id,title,status,is_required,sort_order) VALUES('10000000-0000-4000-8000-000000000024','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000010','Vorhandene Pflichtaufgabe','open',true,9);
 result:=pg_temp.employee_add_optional_visit_tasks('10000000-0000-4000-8000-000000000001','assist_visits','10000000-0000-4000-8000-000000000010','[{"id":"10000000-0000-4000-8000-000000000025","title":"Vorhandene Pflichtaufgabe"}]');
 PERFORM pg_temp.assert_optional((result->>'inserted')::int=0 AND (result#>>'{tasks,0,required}')::boolean,'Pflichtaufgabe unverändert');
 result:=pg_temp.employee_add_optional_visit_tasks('10000000-0000-4000-8000-000000000001','assignments','10000000-0000-4000-8000-000000000012','[{"id":"10000000-0000-4000-8000-000000000026","title":"Post sortieren"}]');
 PERFORM pg_temp.assert_optional((result->>'inserted')::int=1,'älterer einzelner Einsatz');
 statement:=base||'''[{"id":"10000000-0000-4000-8000-000000000027","title":"Einkaufsliste"}]''::jsonb)';
 PERFORM set_config('fixture.optional_role','client_portal',true); PERFORM pg_temp.expect_optional_denial(statement,'42501'); PERFORM set_config('fixture.optional_role','employee_portal',true);
 PERFORM set_config('fixture.optional_user','',true); PERFORM pg_temp.expect_optional_denial(statement,'42501'); PERFORM set_config('fixture.optional_user','10000000-0000-4000-8000-000000000002',true);
 PERFORM set_config('fixture.optional_employee','10000000-0000-4000-8000-000000000099',true); PERFORM pg_temp.expect_optional_denial(statement,'42501'); PERFORM set_config('fixture.optional_employee','10000000-0000-4000-8000-000000000003',true);
 PERFORM set_config('fixture.optional_blocked','true',true); PERFORM pg_temp.expect_optional_denial(statement,'42501'); PERFORM set_config('fixture.optional_blocked','false',true);
 PERFORM pg_temp.expect_optional_denial(replace(statement,'''10000000-0000-4000-8000-000000000001''','''10000000-0000-4000-8000-000000000099'''),'42501');
 UPDATE assist_visits SET canonical_status='completed'; PERFORM pg_temp.expect_optional_denial(statement,'55000'); UPDATE assist_visits SET canonical_status='started';
 UPDATE assist_visits SET proof_status='signed'; PERFORM pg_temp.expect_optional_denial(statement,'55000'); UPDATE assist_visits SET proof_status='none';
 UPDATE assignments SET status='completed' WHERE id='10000000-0000-4000-8000-000000000011'; PERFORM pg_temp.expect_optional_denial(statement,'55000'); UPDATE assignments SET status='started' WHERE id='10000000-0000-4000-8000-000000000011';
 PERFORM pg_temp.expect_optional_denial('SELECT pg_temp.employee_add_optional_visit_tasks(''10000000-0000-4000-8000-000000000001'',''assignments'',''10000000-0000-4000-8000-000000000011'',''[{"id":"10000000-0000-4000-8000-000000000027","title":"Einkaufsliste"}]'')','55000');
 PERFORM pg_temp.expect_optional_denial(base||'''[{"id":"10000000-0000-4000-8000-000000000027","title":"Medikamentengabe"}]''::jsonb)','22023');
 PERFORM pg_temp.expect_optional_denial(base||'''[{"id":"10000000-0000-4000-8000-000000000027","title":""}]''::jsonb)','22023');
 PERFORM pg_temp.expect_optional_denial(base||quote_literal(jsonb_build_array(jsonb_build_object('id','10000000-0000-4000-8000-000000000027','title',repeat('x',301)))::text)||'::jsonb)','22023');
 PERFORM pg_temp.expect_optional_denial(base||'''[{"id":"10000000-0000-4000-8000-000000000027","title":"Neue erste Aufgabe"},{"id":"10000000-0000-4000-8000-000000000028","title":""}]''::jsonb)','22023');
 PERFORM pg_temp.assert_optional(NOT EXISTS(SELECT 1 FROM assist_visit_tasks WHERE title='Neue erste Aufgabe') AND NOT EXISTS(SELECT 1 FROM assignment_tasks WHERE title='Neue erste Aufgabe'),'fehlgeschlagener Stapel vollständig zurückgerollt');
 PERFORM pg_temp.expect_optional_denial(base||'''[{"id":"10000000-0000-4000-8000-000000000021","title":"Abweichender Titel"}]''::jsonb)','22023');
 PERFORM pg_temp.expect_optional_denial(base||'''[{"id":"10000000-0000-4000-8000-000000000027","title":"Neue erste Aufgabe"},{"id":"10000000-0000-4000-8000-000000000027","title":"Neue zweite Aufgabe"}]''::jsonb)','22023');
 PERFORM pg_temp.assert_optional((SELECT denials=15 FROM optional_task_check_results),'15 erwartete Verweigerungen');
END $$;
SELECT jsonb_build_object('verification','passed','expectedDenials',denials,'temporaryOnly',true) AS verification FROM optional_task_check_results;
${forMigration ? `DROP FUNCTION pg_temp.employee_add_optional_visit_tasks(uuid,text,uuid,jsonb);
DROP FUNCTION pg_temp.expect_optional_denial(text,text),pg_temp.assert_optional(boolean,text),pg_temp.fixture_user(),pg_temp.resolve_current_employee_id(),pg_temp.current_tenant_id(),pg_temp.is_employee_portal_rls_context(uuid),pg_temp.platform_tenant_access_allowed(uuid,boolean);
DROP TABLE pg_temp.optional_task_check_results,pg_temp.assignments,pg_temp.assist_visits,pg_temp.assist_visit_tasks,pg_temp.assignment_tasks,pg_temp.assist_visit_audit_logs;
RESET fixture.optional_user; RESET fixture.optional_employee; RESET fixture.optional_role; RESET fixture.optional_blocked;` : 'ROLLBACK;'}
SELECT jsonb_build_object('temporaryFixturesRemoved',NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class WHERE relnamespace=pg_my_temp_schema() AND relname='optional_task_check_results'),'verification','passed; 15 expected denials') AS verification;
`);
