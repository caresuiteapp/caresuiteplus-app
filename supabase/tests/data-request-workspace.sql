-- DML-only isolated fixture verification; no schema or function creation.
-- NOT RUN at authoring time. Production execution is prohibited.
-- On the SAME connection, opt in: caresuite.allow_data_request_fixture_tests = yes.
-- The complete script must execute as one transaction and must finish with ROLLBACK.
BEGIN;
DO $test$
DECLARE
  v_scope jsonb; v_input jsonb; v_a jsonb; v_b jsonb;
  v_state text; v_count bigint; v_time timestamptz; v_claim uuid;
BEGIN
  IF current_setting('caresuite.allow_data_request_fixture_tests',true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION 'Explicit isolated-fixture test opt-in required; never run in production';
  END IF;
  IF EXISTS(SELECT 1 FROM auth.users WHERE id::text LIKE 'd1710000-%')
    OR EXISTS(SELECT 1 FROM public.tenants WHERE id::text LIKE 'd1710000-%')
    OR EXISTS(SELECT 1 FROM public.roles WHERE key LIKE 'data_request_fixture_%') THEN
    RAISE EXCEPTION 'Fixture namespace already exists; existing rows must not be modified';
  END IF;
INSERT INTO public.tenants(id,name) VALUES
('d1710000-0000-4000-8000-000000000001','Data request fixture A'),
('d1710000-0000-4000-8000-000000000002','Data request fixture B');
INSERT INTO public.roles(id,key,name,is_admin_role) VALUES
('d1710000-0000-4000-8000-000000000011','data_request_fixture_member','Fixture member',false),
('d1710000-0000-4000-8000-000000000012','data_request_fixture_admin','Fixture admin',true),
('d1710000-0000-4000-8000-000000000013','data_request_fixture_reviewer','Fixture reviewer',false);
INSERT INTO public.role_permissions(role_id,permission_key,can_view) VALUES
('d1710000-0000-4000-8000-000000000013','security.view',true);
INSERT INTO auth.users(id,email,role,aud,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
SELECT id::uuid, label || '@example.invalid','authenticated','authenticated','{}'::jsonb,'{}'::jsonb,now(),now()
FROM (VALUES
('d1710000-0000-4000-8000-000000000101','data-request-member-a'),
('d1710000-0000-4000-8000-000000000102','data-request-member-b'),
('d1710000-0000-4000-8000-000000000103','data-request-admin-a'),
('d1710000-0000-4000-8000-000000000104','data-request-reviewer-a'),
('d1710000-0000-4000-8000-000000000105','data-request-legacy-auth'),
('d1710000-0000-4000-8000-000000000106','data-request-legacy-profile'),
('d1710000-0000-4000-8000-000000000107','data-request-secondary-role')
) v(id,label);
-- Only fixture profiles possibly created by auth triggers are upserted.
INSERT INTO public.profiles(id,auth_user_id,tenant_id,role_id,status,is_active,email,first_name,last_name,display_name)
SELECT id::uuid,auth_id::uuid,tenant::uuid,role_id::uuid,'active',true,label||'@example.invalid','Fixture',label,label
FROM (VALUES
('d1710000-0000-4000-8000-000000000101','d1710000-0000-4000-8000-000000000101','d1710000-0000-4000-8000-000000000001','d1710000-0000-4000-8000-000000000011','member-a'),
('d1710000-0000-4000-8000-000000000102','d1710000-0000-4000-8000-000000000102','d1710000-0000-4000-8000-000000000002','d1710000-0000-4000-8000-000000000011','member-b'),
('d1710000-0000-4000-8000-000000000103','d1710000-0000-4000-8000-000000000103','d1710000-0000-4000-8000-000000000001','d1710000-0000-4000-8000-000000000012','admin-a'),
('d1710000-0000-4000-8000-000000000104','d1710000-0000-4000-8000-000000000104','d1710000-0000-4000-8000-000000000001','d1710000-0000-4000-8000-000000000013','reviewer-a'),
('d1710000-0000-4000-8000-000000000106','d1710000-0000-4000-8000-000000000105','d1710000-0000-4000-8000-000000000001','d1710000-0000-4000-8000-000000000011','legacy'),
('d1710000-0000-4000-8000-000000000107','d1710000-0000-4000-8000-000000000101','d1710000-0000-4000-8000-000000000002','d1710000-0000-4000-8000-000000000012','secondary-admin')
) v(id,auth_id,tenant,role_id,label)
ON CONFLICT(id) DO UPDATE SET auth_user_id=excluded.auth_user_id,tenant_id=excluded.tenant_id,
role_id=excluded.role_id,status='active',is_active=true,email=excluded.email,
first_name=excluded.first_name,last_name=excluded.last_name,display_name=excluded.display_name;
DELETE FROM public.profiles WHERE id='d1710000-0000-4000-8000-000000000105';



  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub','',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub','d1710000-0000-4000-8000-000000000101','role','authenticated',
    'app_metadata',jsonb_build_object('portal_type','business'))::text,true);
  v_scope := jsonb_build_object('expected_auth_user_id','d1710000-0000-4000-8000-000000000101','expected_tenant_id','d1710000-0000-4000-8000-000000000001','expected_profile_id','d1710000-0000-4000-8000-000000000101');
  EXECUTE 'SET LOCAL ROLE authenticated';

  v_a:=public.data_request_workspace_v1('capabilities',v_scope);
  IF (v_a->'capabilities'->>'self_service'='true') IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: member selfservice'; END IF;

  IF (v_a->'capabilities'->>'admin_view'='false') IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: other-tenant role must not add current rights'; END IF;

  v_input:=v_scope||jsonb_build_object('idempotency_key','d1710000-0000-4000-8000-000000000201','request_type','access',
    'requester_name','Fixture Applicant','requester_email','fixture@example.invalid','message','Applicant note');
  v_a:=public.data_request_workspace_v1('submit',v_input);
  v_b:=public.data_request_workspace_v1('submit',v_input);
  IF (v_a->>'replayed'='false' AND v_b->>'replayed'='true') IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: idempotent retry'; END IF;

  IF (v_a->'item'->>'id'=v_b->'item'->>'id') IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: same receipt'; END IF;

  IF (v_a->'item'->>'status'='queued') IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: queued initial state'; END IF;

  IF ((v_a->'item'->>'received_at')::timestamptz>=transaction_timestamp()) IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: server receipt timestamp'; END IF;

  IF (NOT(v_a->'item' ?| ARRAY['verification_notes','result_summary','metadata','requester_email'])) IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: safe receipt DTO'; END IF;

  v_a:=public.data_request_workspace_v1('account_export',v_scope);
  IF (v_a->'account'->>'email'='member-a@example.invalid') IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: fresh own profile'; END IF;

  SELECT count(*) INTO v_count FROM jsonb_object_keys(v_a->'account');
  IF (v_count=7) IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: exact account fields'; END IF;

  SELECT count(*) INTO v_count FROM public.data_subject_requests;
  IF (v_count=0) IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: member raw table access denied'; END IF;


  v_state := NULL;
  BEGIN
    PERFORM public.data_request_workspace_v1('submit',v_input||'{"requester_name":"Changed"}'::jsonb);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state=RETURNED_SQLSTATE;
  END;
  IF v_state IS DISTINCT FROM '23505' THEN
    RAISE EXCEPTION 'Expected SQLSTATE 23505, got %',COALESCE(v_state,'success');
  END IF;


  v_state := NULL;
  BEGIN
    PERFORM public.data_request_workspace_v1('list',v_scope||jsonb_build_object('expected_auth_user_id','d1710000-0000-4000-8000-000000000102'));
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state=RETURNED_SQLSTATE;
  END;
  IF v_state IS DISTINCT FROM '42501' THEN
    RAISE EXCEPTION 'Expected SQLSTATE 42501, got %',COALESCE(v_state,'success');
  END IF;


  v_state := NULL;
  BEGIN
    PERFORM public.data_request_workspace_v1('submit',v_input||'{"request_type":"deletion"}'::jsonb);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state=RETURNED_SQLSTATE;
  END;
  IF v_state IS DISTINCT FROM '22023' THEN
    RAISE EXCEPTION 'Expected SQLSTATE 22023, got %',COALESCE(v_state,'success');
  END IF;


  v_state := NULL;
  BEGIN
    PERFORM public.data_request_workspace_v1('admin_update',v_scope);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state=RETURNED_SQLSTATE;
  END;
  IF v_state IS DISTINCT FROM '42501' THEN
    RAISE EXCEPTION 'Expected SQLSTATE 42501, got %',COALESCE(v_state,'success');
  END IF;


  v_state := NULL;
  BEGIN
    DELETE FROM public.data_subject_requests WHERE id='d1710000-0000-4000-8000-000000000201';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state=RETURNED_SQLSTATE;
  END;
  IF v_state IS DISTINCT FROM '42501' THEN
    RAISE EXCEPTION 'Expected SQLSTATE 42501, got %',COALESCE(v_state,'success');
  END IF;


  IF has_table_privilege('authenticated','public.data_subject_requests','TRUNCATE') THEN
    RAISE EXCEPTION 'FAIL: authenticated must not have TRUNCATE privilege';
  END IF;
  UPDATE public.data_subject_requests SET status='completed' WHERE id='d1710000-0000-4000-8000-000000000201';
  GET DIAGNOSTICS v_count=ROW_COUNT;
  IF (v_count=0) IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: member status mutation denied'; END IF;

  EXECUTE 'RESET ROLE';
  INSERT INTO public.data_subject_requests(id,tenant_id,profile_id,request_type,verification_notes,result_summary,metadata) VALUES
    ('d1710000-0000-4000-8000-000000000203','d1710000-0000-4000-8000-000000000001','d1710000-0000-4000-8000-000000000101','access','INTERNAL_PRIVATE_NOTE','INTERNAL_PRIVATE_RESULT','{"private":"INTERNAL_PRIVATE_METADATA"}'),
    ('d1710000-0000-4000-8000-000000000204','d1710000-0000-4000-8000-000000000001','d1710000-0000-4000-8000-000000000101','portability','INTERNAL_PRIVATE_NOTE',NULL,'{}'),
    ('d1710000-0000-4000-8000-000000000205','d1710000-0000-4000-8000-000000000002','d1710000-0000-4000-8000-000000000102','access','OTHER_TENANT_NOTE',NULL,'{}');

  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub','',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub','d1710000-0000-4000-8000-000000000101','role','authenticated',
    'app_metadata',jsonb_build_object('portal_type','business'))::text,true);
  v_scope := jsonb_build_object('expected_auth_user_id','d1710000-0000-4000-8000-000000000101','expected_tenant_id','d1710000-0000-4000-8000-000000000001','expected_profile_id','d1710000-0000-4000-8000-000000000101');
  EXECUTE 'SET LOCAL ROLE authenticated';

  v_a:=public.data_request_workspace_v1('list',v_scope||'{"limit":2,"offset":0}'::jsonb);
  v_b:=public.data_request_workspace_v1('list',v_scope||'{"limit":2,"offset":2}'::jsonb);
  IF (jsonb_array_length(v_a->'items')=2 AND v_a->>'has_more'='true') IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: first page'; END IF;

  IF (jsonb_array_length(v_b->'items')=1 AND v_b->>'has_more'='false') IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: last page'; END IF;

  IF (v_a::text NOT LIKE '%INTERNAL_PRIVATE%' AND v_b::text NOT LIKE '%INTERNAL_PRIVATE%') IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: no internal fields'; END IF;

  SELECT count(*) INTO v_count FROM jsonb_array_elements(v_a->'items') x
    JOIN jsonb_array_elements(v_b->'items') y ON x->>'id'=y->>'id';
  IF (v_count=0) IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: pages do not overlap'; END IF;


  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub','',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub','d1710000-0000-4000-8000-000000000102','role','authenticated',
    'app_metadata',jsonb_build_object('portal_type','business'))::text,true);
  v_scope := jsonb_build_object('expected_auth_user_id','d1710000-0000-4000-8000-000000000102','expected_tenant_id','d1710000-0000-4000-8000-000000000002','expected_profile_id','d1710000-0000-4000-8000-000000000102');
  EXECUTE 'SET LOCAL ROLE authenticated';

  v_a:=public.data_request_workspace_v1('list',v_scope);
  IF (jsonb_array_length(v_a->'items')=1 AND v_a->'items'->0->>'id'='d1710000-0000-4000-8000-000000000205') IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: other tenant own receipts'; END IF;


  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub','',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub','d1710000-0000-4000-8000-000000000105','role','authenticated',
    'app_metadata',jsonb_build_object('portal_type','business'))::text,true);
  v_scope := jsonb_build_object('expected_auth_user_id','d1710000-0000-4000-8000-000000000105','expected_tenant_id','d1710000-0000-4000-8000-000000000001','expected_profile_id','d1710000-0000-4000-8000-000000000106');
  EXECUTE 'SET LOCAL ROLE authenticated';

  v_a:=public.data_request_workspace_v1('account_export',v_scope);
  IF (v_a->'account'->>'email'='legacy@example.invalid') IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: legacy identity resolution'; END IF;

  v_a:=public.data_request_workspace_v1('submit',v_scope||
    '{"idempotency_key":"d1710000-0000-4000-8000-000000000207","request_type":"correction","requester_name":"Legacy","requester_email":"legacy@example.invalid","message":""}'::jsonb);
  IF (v_a->'item'->>'status'='queued') IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: legacy submit through existing audit trigger'; END IF;


  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub','',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub','d1710000-0000-4000-8000-000000000104','role','authenticated',
    'app_metadata',jsonb_build_object('portal_type','business'))::text,true);
  v_scope := jsonb_build_object('expected_auth_user_id','d1710000-0000-4000-8000-000000000104','expected_tenant_id','d1710000-0000-4000-8000-000000000001','expected_profile_id','d1710000-0000-4000-8000-000000000104');
  EXECUTE 'SET LOCAL ROLE authenticated';

  SELECT count(*) INTO v_count FROM public.data_subject_requests;
  IF (v_count=4) IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: reviewer sees only own tenant'; END IF;

  UPDATE public.data_subject_requests SET status='running' WHERE id='d1710000-0000-4000-8000-000000000201';
  GET DIAGNOSTICS v_count=ROW_COUNT;
  IF (v_count=0) IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: reviewer cannot mutate'; END IF;


  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub','',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub','d1710000-0000-4000-8000-000000000103','role','authenticated',
    'app_metadata',jsonb_build_object('portal_type','business'))::text,true);
  v_scope := jsonb_build_object('expected_auth_user_id','d1710000-0000-4000-8000-000000000103','expected_tenant_id','d1710000-0000-4000-8000-000000000001','expected_profile_id','d1710000-0000-4000-8000-000000000103');
  EXECUTE 'SET LOCAL ROLE authenticated';

  SELECT v_scope||jsonb_build_object('request_id',id,'expected_status',status,'expected_updated_at',updated_at,'new_status','running')
    INTO v_input FROM public.data_subject_requests WHERE id='d1710000-0000-4000-8000-000000000201';
  v_a:=public.data_request_workspace_v1('admin_update',v_input);
  IF (v_a->'item'->>'status'='running') IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: atomic admin update'; END IF;


  v_state := NULL;
  BEGIN
    PERFORM public.data_request_workspace_v1('admin_update',v_input||'{"new_status":"completed"}'::jsonb);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state=RETURNED_SQLSTATE;
  END;
  IF v_state IS DISTINCT FROM '40001' THEN
    RAISE EXCEPTION 'Expected SQLSTATE 40001, got %',COALESCE(v_state,'success');
  END IF;


  v_state := NULL;
  BEGIN
    PERFORM public.data_request_workspace_v1('admin_update',v_input||jsonb_build_object('expected_auth_user_id','d1710000-0000-4000-8000-000000000101'));
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state=RETURNED_SQLSTATE;
  END;
  IF v_state IS DISTINCT FROM '42501' THEN
    RAISE EXCEPTION 'Expected SQLSTATE 42501, got %',COALESCE(v_state,'success');
  END IF;

  UPDATE public.data_subject_requests SET status='completed',completed_at='2000-01-01' WHERE id='d1710000-0000-4000-8000-000000000201';
  SELECT completed_at INTO v_time FROM public.data_subject_requests WHERE id='d1710000-0000-4000-8000-000000000201';
  IF (v_time>=transaction_timestamp()) IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: server completion timestamp'; END IF;

  UPDATE public.data_subject_requests SET status='running' WHERE id='d1710000-0000-4000-8000-000000000201';
  SELECT completed_at INTO v_time FROM public.data_subject_requests WHERE id='d1710000-0000-4000-8000-000000000201';
  IF (v_time IS NULL) IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: reopening clears completion'; END IF;


  v_state := NULL;
  BEGIN
    UPDATE public.data_subject_requests SET tenant_id='d1710000-0000-4000-8000-000000000002' WHERE id='d1710000-0000-4000-8000-000000000201';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state=RETURNED_SQLSTATE;
  END;
  IF v_state IS DISTINCT FROM '42501' THEN
    RAISE EXCEPTION 'Expected SQLSTATE 42501, got %',COALESCE(v_state,'success');
  END IF;

  INSERT INTO public.data_subject_requests(id,tenant_id,profile_id,request_type,status,requester_name,requester_email,received_at,metadata)
    VALUES('d1710000-0000-4000-8000-000000000206','d1710000-0000-4000-8000-000000000001','d1710000-0000-4000-8000-000000000103','deletion','completed','Admin',
      'admin@example.invalid','2000-01-01','{"source":"caresuite_app","channel":"settings"}') RETURNING to_jsonb(data_subject_requests) INTO v_a;
  IF (v_a->>'status'='queued' AND (v_a->>'received_at')::timestamptz>=transaction_timestamp()) IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: native administrative receipt compatibility'; END IF;


  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub','',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub','d1710000-0000-4000-8000-000000000103','role','authenticated',
    'app_metadata',jsonb_build_object('portal_type','employee'))::text,true);
  v_scope := jsonb_build_object('expected_auth_user_id','d1710000-0000-4000-8000-000000000103','expected_tenant_id','d1710000-0000-4000-8000-000000000001','expected_profile_id','d1710000-0000-4000-8000-000000000103');
  EXECUTE 'SET LOCAL ROLE authenticated';

  SELECT count(*) INTO v_count FROM public.data_subject_requests;
  IF (v_count=0) IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: portal token is not internal admin'; END IF;

  SELECT count(*) INTO v_count FROM public.audit_logs WHERE table_name='data_subject_requests';
  IF (v_count=0) IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: portal cannot read audit copies'; END IF;

  EXECUTE 'RESET ROLE';
  UPDATE public.profiles SET is_active=false WHERE id='d1710000-0000-4000-8000-000000000103';

  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub','',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub','d1710000-0000-4000-8000-000000000103','role','authenticated',
    'app_metadata',jsonb_build_object('portal_type','business'))::text,true);
  v_scope := jsonb_build_object('expected_auth_user_id','d1710000-0000-4000-8000-000000000103','expected_tenant_id','d1710000-0000-4000-8000-000000000001','expected_profile_id','d1710000-0000-4000-8000-000000000103');
  EXECUTE 'SET LOCAL ROLE authenticated';


  v_state := NULL;
  BEGIN
    PERFORM public.data_request_workspace_v1('capabilities',v_scope);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state=RETURNED_SQLSTATE;
  END;
  IF v_state IS DISTINCT FROM '42501' THEN
    RAISE EXCEPTION 'Expected SQLSTATE 42501, got %',COALESCE(v_state,'success');
  END IF;

  EXECUTE 'RESET ROLE';
  EXECUTE 'SET LOCAL ROLE anon';

  v_state := NULL;
  BEGIN
    PERFORM public.data_request_workspace_v1('list','{}'::jsonb);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state=RETURNED_SQLSTATE;
  END;
  IF v_state IS DISTINCT FROM '42501' THEN
    RAISE EXCEPTION 'Expected SQLSTATE 42501, got %',COALESCE(v_state,'success');
  END IF;

  EXECUTE 'RESET ROLE';
  EXECUTE 'SET LOCAL ROLE authenticated';

  v_state := NULL;
  BEGIN
    PERFORM public.data_request_admin_notification_v1('claim','d1710000-0000-4000-8000-000000000201');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state=RETURNED_SQLSTATE;
  END;
  IF v_state IS DISTINCT FROM '42501' THEN
    RAISE EXCEPTION 'Expected SQLSTATE 42501, got %',COALESCE(v_state,'success');
  END IF;

  EXECUTE 'RESET ROLE';
  EXECUTE 'SET LOCAL ROLE service_role';
  v_a:=public.data_request_admin_notification_v1('claim','d1710000-0000-4000-8000-000000000201');
  v_b:=public.data_request_admin_notification_v1('claim','d1710000-0000-4000-8000-000000000201');
  IF (v_a->>'claimed'='true' AND v_b->>'claimed'='false') IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: single notification claim'; END IF;

  v_claim:=(v_a->>'claim_token')::uuid;
  v_b:=public.data_request_admin_notification_v1('finish_sent','d1710000-0000-4000-8000-000000000201',v_claim);
  IF (v_b->>'recorded'='true') IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: notification finalization'; END IF;

  EXECUTE 'RESET ROLE';
  RAISE NOTICE 'All data-request fixture assertions passed; transaction will roll back';
END;
$test$;
ROLLBACK;
