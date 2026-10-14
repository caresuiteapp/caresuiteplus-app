-- PREPARED, NOT EXECUTED. Staging only: shwpweerzsfkqaivmaoc.
-- Never run against production. The independently verified staging connection
-- must expose app.settings.project_ref = shwpweerzsfkqaivmaoc. This file does not
-- set or manufacture that identity; an absent marker deliberately fails closed.
-- Known staging prerequisites still outstanding at preparation time:
--   public.care_level (enum)
--   public.is_internal_tenant_actor(uuid)
--   public.platform_tenant_access_allowed(uuid,boolean)
--   public.platform_account_access_states
-- Apply/review the real prerequisite migrations separately. No helper or access
-- gate is replaced, disabled or mocked here. All fixtures and writes roll back.
-- Direct auth.users fixtures + request.jwt.claims exercise SQL contracts only.
-- They are NOT real JWTs, an authenticated Edge request, or an Auth/Edge E2E test.
-- Synthetic HTML/PNG originals test the SQL verifier handoff, not the renderer.

BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '90s';
SET LOCAL idle_in_transaction_session_timeout = '120s';

DO $preflight$
DECLARE dependency text;
BEGIN
 IF current_setting('app.settings.project_ref',true) IS DISTINCT FROM 'shwpweerzsfkqaivmaoc' THEN
  RAISE EXCEPTION 'Prepared smoke blocked: independently verified staging project identity is absent or differs';
 END IF;
 IF to_regtype('public.care_level') IS NULL THEN RAISE EXCEPTION 'Missing real prerequisite: public.care_level enum'; END IF;
 FOREACH dependency IN ARRAY ARRAY[
  'auth.uid()','public.current_tenant_id()','public.current_role_key()',
  'public.is_internal_tenant_actor(uuid)','public.has_permission(text)',
  'public.platform_tenant_access_allowed(uuid,boolean)',
  'public.seed_tenant_client_core_templates(uuid)',
  'public.client_intake_save_draft(uuid,uuid,jsonb,bigint,uuid)',
  'public.client_intake_load_draft(uuid,uuid)',
  'public.client_intake_commit_completion(uuid,uuid,uuid,uuid,bigint,text,jsonb)'
 ] LOOP
  IF to_regprocedure(dependency) IS NULL THEN RAISE EXCEPTION 'Missing real prerequisite: %',dependency; END IF;
 END LOOP;
 FOREACH dependency IN ARRAY ARRAY[
  'auth.users','public.tenants','public.roles','public.role_permissions','public.profiles',
  'public.tenant_users','public.platform_tenants','public.platform_account_access_states',
  'public.clients','public.intake_document_system_templates','public.client_intake_drafts',
  'client_intake_private.client_intake_operations','client_intake_private.client_intake_completions',
  'client_intake_private.client_intake_originals'
 ] LOOP
  IF to_regclass(dependency) IS NULL THEN RAISE EXCEPTION 'Missing real prerequisite: %',dependency; END IF;
 END LOOP;
 IF NOT has_function_privilege('authenticated','public.client_intake_save_draft(uuid,uuid,jsonb,bigint,uuid)','EXECUTE')
  OR NOT has_function_privilege('service_role','public.client_intake_commit_completion(uuid,uuid,uuid,uuid,bigint,text,jsonb)','EXECUTE')
  OR has_function_privilege('authenticated','public.client_intake_commit_completion(uuid,uuid,uuid,uuid,bigint,text,jsonb)','EXECUTE') THEN
  RAISE EXCEPTION 'Intake RPC grants do not match the reviewed contract';
 END IF;
END $preflight$;

CREATE TEMP TABLE intake_smoke_state(
 tenant_id uuid NOT NULL,auth_id uuid NOT NULL,role_id uuid NOT NULL,tenant_user_id uuid NOT NULL,
 client_id uuid NOT NULL,operation_id uuid NOT NULL,form_json jsonb NOT NULL,documents jsonb NOT NULL,
 saved jsonb,completed jsonb,replayed jsonb
) ON COMMIT DROP;
GRANT SELECT,UPDATE ON intake_smoke_state TO authenticated,service_role;

DO $fixtures$
DECLARE
 v_tenant_id uuid:=gen_random_uuid(); v_actor_id uuid:=gen_random_uuid(); v_role_id uuid:=gen_random_uuid();
 v_account_id uuid:=gen_random_uuid(); v_client_id uuid:=gen_random_uuid(); v_operation_id uuid:=gen_random_uuid();
 v_role_key text:='intake_smoke_'||replace(v_role_id::text,'-','');
 v_company_snapshot jsonb; v_template public.intake_document_system_templates%ROWTYPE;
 v_originals jsonb:='[]'; v_verified jsonb:='[]'; v_signatures jsonb; v_signature_role text; v_roles text[];
 v_html text; v_entry jsonb; v_f jsonb; v_stamp text:=to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 v_png text:='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9WQAAAAASUVORK5CYII=';
BEGIN
 -- No ON CONFLICT overwrite of real tenant, role, user or client records.
 INSERT INTO auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
 VALUES(v_actor_id,'authenticated','authenticated','intake-smoke-'||v_actor_id||'@example.invalid',clock_timestamp(),
  '{"provider":"email","providers":["email"]}','{"display_name":"Synthetic intake SQL smoke"}',clock_timestamp(),clock_timestamp());
 INSERT INTO public.tenants(id,name,status,street,house_number,postal_code,city)
 VALUES(v_tenant_id,'SYNTHETIC intake SQL smoke','active','Teststraße','1','10115','Berlin');
 INSERT INTO public.roles(id,tenant_id,key,name,is_admin_role)
 VALUES(v_role_id,v_tenant_id,v_role_key,'Synthetic intake SQL smoke',false);
 INSERT INTO public.role_permissions(tenant_id,role_id,permission_key)
 SELECT v_tenant_id,v_role_id,required.permission FROM unnest(ARRAY['office.clients.create','office.clients.view','office.clients.view_sensitive']) AS required(permission);
 -- A real auth.users trigger may already have created this same synthetic profile.
 INSERT INTO public.profiles(id,tenant_id,auth_user_id,role_id,display_name,status,is_active)
 VALUES(v_actor_id,v_tenant_id,v_actor_id,v_role_id,'Synthetic SQL smoke actor','active',true)
 ON CONFLICT(id) DO UPDATE SET tenant_id=EXCLUDED.tenant_id,auth_user_id=EXCLUDED.auth_user_id,
  role_id=EXCLUDED.role_id,display_name=EXCLUDED.display_name,status='active',is_active=true;
 INSERT INTO public.tenant_users(id,tenant_id,auth_user_id,display_name,first_name,last_name,email,username,role_key,status,first_login_completed,must_change_password)
 VALUES(v_account_id,v_tenant_id,v_actor_id,'Synthetic SQL smoke actor','Synthetic','Actor',
  'intake-smoke-'||v_actor_id||'@example.invalid','intake-smoke-'||v_actor_id,v_role_key,'active',true,false);
 INSERT INTO public.platform_account_access_states(tenant_user_id,tenant_id,state) VALUES(v_account_id,v_tenant_id,'active');
 INSERT INTO public.clients(id,tenant_id,first_name,last_name,status,created_by,updated_by)
 VALUES(v_client_id,v_tenant_id,'Synthetic','Intake smoke','lead',v_actor_id,v_actor_id);
 SELECT jsonb_build_object('name',t.name,'street',t.street,'house_number',t.house_number,'postal_code',t.postal_code,'city',t.city)
 INTO v_company_snapshot FROM public.tenants t WHERE t.id=v_tenant_id;
 FOR v_template IN SELECT * FROM public.intake_document_system_templates
  WHERE template_key IN ('privacy_consent_default','client_contract_assist') AND is_active ORDER BY template_key FOR SHARE LOOP
  v_roles:=ARRAY(SELECT DISTINCT signature_slot->>'role' FROM jsonb_array_elements(coalesce(v_template.signature_slots,'[]')) AS slots(signature_slot));
  IF v_template.requires_client_signature THEN v_roles:=array_append(v_roles,'client'); END IF;
  IF v_template.requires_employee_signature THEN v_roles:=array_append(v_roles,'employee'); END IF;
  IF v_template.requires_representative_signature THEN v_roles:=array_append(v_roles,'legal_representative'); END IF;
  v_roles:=ARRAY(SELECT DISTINCT r FROM unnest(v_roles) AS names(r) ORDER BY r);
  v_signatures:='{}'; v_html:='<h1>SYNTHETIC SQL CONTRACT FIXTURE</h1><p>No real consent or signature.</p>';
  FOREACH v_signature_role IN ARRAY v_roles LOOP
   IF v_signature_role NOT IN ('client','employee','legal_representative') THEN RAISE EXCEPTION 'Unsupported real signature role'; END IF;
   v_signatures:=v_signatures||jsonb_build_object(v_signature_role,jsonb_build_object('role',v_signature_role,'dataUrl',v_png,'signedAt',v_stamp,'signerName','SYNTHETIC SQL TEST'));
   v_html:=v_html||'<img alt="Synthetic test signature" src="'||v_png||'"/>';
  END LOOP;
  v_entry:=jsonb_build_object('templateKey',v_template.template_key,'documentType',v_template.document_type,'title',v_template.title,
   'isRequired',true,'status','finalized','source','system','tenantTemplateId',NULL,'version',v_template.version,
   'missingPlaceholders','[]'::jsonb,'unresolvedKeys','[]'::jsonb,'previewHtml',v_html,'finalizedHtml',v_html,
   'renderedPdfPath',NULL,'previewOpenedAt',v_stamp,'finalizedAt',v_stamp,'renderVersion','intake-html-v1','renderedAt',v_stamp,'signatures',v_signatures);
  v_originals:=v_originals||jsonb_build_array(v_entry);
  v_verified:=v_verified||jsonb_build_array(v_entry||jsonb_build_object('contentHash','sha256:'||encode(sha256(convert_to(v_html,'UTF8')),'hex'),
   'templateUpdatedAt',v_template.updated_at,'systemTemplateUpdatedAt',v_template.updated_at,'systemTemplateSnapshot',to_jsonb(v_template),
   'tenantTemplateSnapshot',NULL,'tenantDisplaySnapshot',v_company_snapshot));
 END LOOP;
 IF jsonb_array_length(v_originals)<>2 THEN RAISE EXCEPTION 'Two active real required templates must exist'; END IF;
 v_f:=jsonb_build_object('careContexts',jsonb_build_array('daily_assistance'),'firstName','Synthetic','lastName','Intake smoke',
  'dateOfBirth','1950-03-14','status','in_aufnahme','gender','female','salutation','frau',
  'street','Teststraße','houseNumber','1','zip','10115','city','Berlin','admissionDate',current_date::text,'serviceStart',current_date::text,
  'careLevel','kein','careLevelValidFrom',current_date::text,'fundingSources',jsonb_build_array('selbstzahler'),
  'billingTypes',jsonb_build_array('selbstzahler'),'costBearerTypes',jsonb_build_array('selbstzahler'),
  'selbstzahlerName','Synthetic Intake smoke','selbstzahlerStreet','Teststraße 1','selbstzahlerZip','10115','selbstzahlerCity','Berlin',
  'costBearerTemplateIds','{}'::jsonb,'assignedModules',jsonb_build_array('office','assist'),'hourlyRate','38.50',
  'elevatorAvailable',false,'smokerHousehold',false,'intakeContractType','assist','intakeAssignmentEnabled',false,
  'intakeOptionalConsents','[]'::jsonb,'intakeDocuments',v_originals);
 INSERT INTO pg_temp.intake_smoke_state VALUES(v_tenant_id,v_actor_id,v_role_id,v_account_id,v_client_id,v_operation_id,v_f,v_verified,NULL,NULL,NULL);
END $fixtures$;

SELECT set_config('request.jwt.claims',jsonb_build_object('sub',auth_id,'role','authenticated')::text,true),
 set_config('request.jwt.claim.sub',auth_id::text,true),set_config('request.jwt.claim.role','authenticated',true)
FROM pg_temp.intake_smoke_state;
SET LOCAL ROLE authenticated;
DO $draft_contract$
DECLARE s pg_temp.intake_smoke_state%ROWTYPE; v_saved jsonb; loaded jsonb; replay jsonb; denied boolean:=false;
BEGIN
 SELECT * INTO STRICT s FROM pg_temp.intake_smoke_state;
 IF auth.uid() IS DISTINCT FROM s.auth_id OR public.current_tenant_id() IS DISTINCT FROM s.tenant_id
  OR public.is_internal_tenant_actor(s.tenant_id) IS NOT TRUE
  OR public.platform_tenant_access_allowed(s.tenant_id,false) IS NOT TRUE THEN
  RAISE EXCEPTION 'Real auth/tenant/platform helpers do not resolve the synthetic actor';
 END IF;
 v_saved:=public.client_intake_save_draft(s.tenant_id,s.client_id,s.form_json,0,s.operation_id);
 loaded:=public.client_intake_load_draft(s.tenant_id,s.client_id);
 IF v_saved->>'contract' IS DISTINCT FROM 'client-intake-draft-v1' OR v_saved->>'revision' IS DISTINCT FROM '1'
  OR v_saved->>'clientId' IS DISTINCT FROM s.client_id::text OR v_saved->>'operationId' IS DISTINCT FROM s.operation_id::text
  OR loaded->'form' IS DISTINCT FROM s.form_json OR loaded->>'status' IS DISTINCT FROM 'draft'
  OR loaded->>'formHash' IS DISTINCT FROM v_saved->>'formHash' THEN RAISE EXCEPTION 'Draft save/load contract failed'; END IF;
 replay:=public.client_intake_save_draft(s.tenant_id,s.client_id,s.form_json,0,s.operation_id);
 IF replay->>'replayed' IS DISTINCT FROM 'true' OR replay-'replayed' IS DISTINCT FROM v_saved-'replayed' THEN
  RAISE EXCEPTION 'Identical draft request did not return its original receipt'; END IF;
 UPDATE pg_temp.intake_smoke_state SET saved=v_saved;
 BEGIN
  PERFORM public.client_intake_commit_completion(s.tenant_id,s.client_id,s.auth_id,s.auth_id,1,v_saved->>'formHash',s.documents);
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Authenticated role unexpectedly executed the service-only completion'; END IF;
END $draft_contract$;
RESET ROLE;

SET LOCAL ROLE service_role;
DO $rollback_probe$
DECLARE s pg_temp.intake_smoke_state%ROWTYPE; receipt jsonb;
BEGIN
 SELECT * INTO STRICT s FROM pg_temp.intake_smoke_state;
 BEGIN
  receipt:=public.client_intake_commit_completion(s.tenant_id,s.client_id,s.auth_id,s.auth_id,1,s.saved->>'formHash',s.documents);
  IF receipt->>'confirmed' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Completion did not confirm before rollback'; END IF;
  RAISE EXCEPTION 'Intentional synthetic completion rollback' USING ERRCODE='P7001';
 EXCEPTION WHEN SQLSTATE 'P7001' THEN NULL;
 END;
END $rollback_probe$;
RESET ROLE;
DO $rollback_assertions$
DECLARE s pg_temp.intake_smoke_state%ROWTYPE; relation text; n bigint;
BEGIN
 SELECT * INTO STRICT s FROM pg_temp.intake_smoke_state;
 FOREACH relation IN ARRAY ARRAY['client_intake_private.client_intake_completions','client_intake_private.client_intake_originals',
  'public.client_intake_documents','public.client_document_signatures','public.client_documents','public.client_consent_status',
  'public.client_care_contexts','public.client_service_profiles','public.client_funding_selections','public.client_module_assignments',
  'public.client_timeline_events'] LOOP
  EXECUTE format('SELECT count(*) FROM %s WHERE tenant_id=$1 AND client_id=$2',relation) INTO n USING s.tenant_id,s.client_id;
  IF n<>0 THEN RAISE EXCEPTION 'Subtransaction rollback left evidence in %',relation; END IF;
 END LOOP;
 IF (SELECT status::text FROM public.clients WHERE id=s.client_id AND tenant_id=s.tenant_id) IS DISTINCT FROM 'lead'
  OR (SELECT status FROM public.client_intake_drafts WHERE client_id=s.client_id AND tenant_id=s.tenant_id) IS DISTINCT FROM 'draft' THEN
  RAISE EXCEPTION 'Rollback left client or draft completed'; END IF;
END $rollback_assertions$;

SET LOCAL ROLE service_role;
UPDATE pg_temp.intake_smoke_state s SET completed=public.client_intake_commit_completion(
 s.tenant_id,s.client_id,s.auth_id,s.auth_id,1,s.saved->>'formHash',s.documents);
UPDATE pg_temp.intake_smoke_state s SET replayed=public.client_intake_commit_completion(
 s.tenant_id,s.client_id,s.auth_id,s.auth_id,1,s.saved->>'formHash',s.documents);
RESET ROLE;
DO $completion_assertions$
DECLARE s pg_temp.intake_smoke_state%ROWTYPE; expected_signatures bigint;
BEGIN
 SELECT * INTO STRICT s FROM pg_temp.intake_smoke_state;
 IF s.completed->>'contract' IS DISTINCT FROM 'client-intake-completion-v1' OR s.completed->>'confirmed' IS DISTINCT FROM 'true'
  OR s.completed->>'status' IS DISTINCT FROM 'active' OR s.completed->>'revision' IS DISTINCT FROM '1'
  OR s.completed->>'clientId' IS DISTINCT FROM s.client_id::text OR s.replayed->>'replayed' IS DISTINCT FROM 'true'
  OR s.completed-'replayed' IS DISTINCT FROM s.replayed-'replayed' THEN RAISE EXCEPTION 'Completion/replay receipt contract failed'; END IF;
 SELECT count(*) INTO expected_signatures FROM jsonb_array_elements(s.documents) AS docs(document)
 CROSS JOIN LATERAL jsonb_object_keys(document->'signatures') AS roles(role_key);
 IF (SELECT status::text FROM public.clients WHERE id=s.client_id AND tenant_id=s.tenant_id) IS DISTINCT FROM 'active'
  OR (SELECT count(*) FROM client_intake_private.client_intake_completions WHERE client_id=s.client_id AND tenant_id=s.tenant_id)<>1
  OR (SELECT count(*) FROM client_intake_private.client_intake_originals WHERE client_id=s.client_id AND tenant_id=s.tenant_id)<>2
  OR (SELECT count(*) FROM public.client_documents WHERE client_id=s.client_id AND tenant_id=s.tenant_id)<>2
  OR (SELECT count(*) FROM public.client_document_signatures WHERE client_id=s.client_id AND tenant_id=s.tenant_id)<>expected_signatures
  OR (SELECT count(*) FROM public.client_consent_status WHERE client_id=s.client_id AND tenant_id=s.tenant_id AND privacy_status='finalized' AND contract_status='finalized')<>1 THEN
  RAISE EXCEPTION 'Atomic completion evidence or idempotent cardinality failed'; END IF;
 RAISE NOTICE 'Synthetic SQL contract assertions passed inside transaction; all fixtures now roll back. Auth/Edge E2E remains untested.';
END $completion_assertions$;

-- Mandatory final statement: no fixture, Auth row, receipt or projection persists.
ROLLBACK;
