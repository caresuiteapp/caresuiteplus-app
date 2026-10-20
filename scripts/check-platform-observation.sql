-- Verification of the new observation functions only.
-- Synthetic observation rows are enclosed in a subtransaction and rolled back.
-- No customer row, account, mail queue or audit record is changed.
DO $verification$
DECLARE
  v_session uuid := gen_random_uuid();
  v_attempt uuid := gen_random_uuid();
  v_owner uuid;
  v_event jsonb;
  v_count bigint;
  v_denied integer := 0;
  v_name text;
  v_summary jsonb;
BEGIN
  SELECT user_id INTO v_owner FROM public.platform_users WHERE role='platform_owner' AND status='active' LIMIT 1;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'verification_owner_missing'; END IF;
  SELECT count(*) INTO v_count FROM platform_observation_private.sessions;
  BEGIN
    EXECUTE 'SET LOCAL ROLE service_role';
    v_event := jsonb_build_object('kind','heartbeat','sessionId',v_session,'sessionSecret',repeat('a',64),
      'surface','software','area','other','active',true);
    IF public.platform_collect_observation(v_event,NULL,repeat('f',64)) IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'verification_heartbeat_failed'; END IF;
    IF NOT EXISTS(SELECT 1 FROM platform_observation_private.sessions WHERE id=v_session AND surface='website' AND auth_user_id IS NULL AND tenant_id IS NULL) THEN
      RAISE EXCEPTION 'verification_unverified_identity_accepted'; END IF;
    IF public.platform_collect_observation(v_event||jsonb_build_object('sessionSecret',repeat('b',64)),NULL,repeat('f',64)) IS DISTINCT FROM false THEN
      RAISE EXCEPTION 'verification_wrong_secret_accepted'; END IF;
    v_event := v_event||jsonb_build_object('kind','registration','surface','registration','area','registration',
      'attemptId',v_attempt,'eventId',gen_random_uuid(),'stage',0,'state','progress');
    IF public.platform_collect_observation(v_event,NULL,repeat('f',64)) IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'verification_registration_failed'; END IF;
    BEGIN
      PERFORM public.platform_collect_observation(v_event||jsonb_build_object('state','completed'),NULL,repeat('f',64));
      RAISE EXCEPTION 'verification_client_completion_accepted';
    EXCEPTION WHEN SQLSTATE '22023' THEN v_denied:=v_denied+1; END;
    IF public.platform_confirm_registration_observation(v_session,repeat('a',64),v_attempt,gen_random_uuid(),gen_random_uuid(),201) IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'verification_unconfirmed_result_missing'; END IF;
    IF NOT EXISTS(SELECT 1 FROM platform_observation_private.registration_attempts WHERE id=v_attempt AND state='failed' AND issue='server_unconfirmed' AND tenant_id IS NULL AND completed_at IS NULL) THEN
      RAISE EXCEPTION 'verification_unconfirmed_registration_completed'; END IF;
    v_event := jsonb_build_object('kind','error','sessionId',v_session,'sessionSecret',repeat('a',64),
      'surface','website','area','other','active',true,'category','unexpected','operation','function','httpStatus',599);
    PERFORM public.platform_collect_observation(v_event,NULL,repeat('f',64));
    PERFORM public.platform_collect_observation(v_event,NULL,repeat('f',64));
    IF NOT EXISTS(SELECT 1 FROM platform_observation_private.incidents WHERE area='other' AND category='unexpected' AND operation='function' AND http_status=599 AND occurrences>=2) THEN
      RAISE EXCEPTION 'verification_error_grouping_failed'; END IF;
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config('request.jwt.claim.sub',v_owner::text,true);
    v_summary:=public.platform_get_operations_summary();
    IF v_summary->'telemetry' IS NULL OR v_summary->'telemetry'='null'::jsonb THEN
      RAISE EXCEPTION 'verification_owner_summary_missing'; END IF;
    IF jsonb_array_length(public.platform_list_registration_activity('',0)->'items')<1
      OR jsonb_array_length(public.platform_list_runtime_incidents('open',0)->'items')<1 THEN
      RAISE EXCEPTION 'verification_owner_lists_missing'; END IF;
    PERFORM set_config('request.jwt.claim.sub','',true);
    FOREACH v_name IN ARRAY ARRAY['platform_get_operations_summary','platform_list_registration_activity','platform_list_runtime_incidents'] LOOP
      BEGIN
        EXECUTE format('SELECT public.%I()',v_name);
        RAISE EXCEPTION 'verification_missing_identity_accepted';
      EXCEPTION WHEN insufficient_privilege THEN v_denied:=v_denied+1; END;
    END LOOP;
    PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
    BEGIN
      PERFORM public.platform_get_operations_summary();
      RAISE EXCEPTION 'verification_unknown_identity_accepted';
    EXCEPTION WHEN insufficient_privilege THEN v_denied:=v_denied+1; END;
    BEGIN
      PERFORM public.platform_collect_observation(v_event,NULL,repeat('f',64));
      RAISE EXCEPTION 'verification_client_collector_access_accepted';
    EXCEPTION WHEN insufficient_privilege THEN v_denied:=v_denied+1; END;
    EXECUTE 'SET LOCAL ROLE anon';
    BEGIN
      PERFORM 1 FROM platform_observation_private.sessions;
      RAISE EXCEPTION 'verification_public_private_table_access_accepted';
    EXCEPTION WHEN insufficient_privilege THEN v_denied:=v_denied+1; END;
    IF v_denied<>7 THEN RAISE EXCEPTION 'verification_denials_incomplete'; END IF;
    RAISE EXCEPTION 'caresuite_verification_rollback';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'caresuite_verification_rollback' THEN RAISE; END IF;
  END;
  IF (SELECT count(*) FROM platform_observation_private.sessions)<>v_count THEN
    RAISE EXCEPTION 'verification_observations_not_rolled_back'; END IF;
END;
$verification$;
SELECT jsonb_build_object('verification','passed','synthetic_rows_persisted',false,
  'checked_at',clock_timestamp(),'session_count',(SELECT count(*) FROM platform_observation_private.sessions),
  'attempt_count',(SELECT count(*) FROM platform_observation_private.registration_attempts),
  'incident_count',(SELECT count(*) FROM platform_observation_private.incidents)) AS result;
