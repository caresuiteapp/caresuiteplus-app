-- Central operations for Web/Desktop. No customer records are changed.
-- Write endpoints are server-only; the public collector verifies identities.
-- Exact migration version is taken from the server after deployment.
CREATE SCHEMA platform_observation_private;
REVOKE ALL ON SCHEMA platform_observation_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA platform_observation_private TO service_role;

CREATE TABLE platform_observation_private.collection (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  installed_at timestamptz NOT NULL DEFAULT now(),
  first_event_at timestamptz,
  last_event_at timestamptz,
  last_prune_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO platform_observation_private.collection(singleton) VALUES (true);
CREATE TABLE platform_observation_private.sessions (
  id uuid PRIMARY KEY,
  secret_hash text NOT NULL,
  surface text NOT NULL CHECK (surface IN ('website','registration','software','platform')),
  area text NOT NULL,
  auth_user_id uuid,
  tenant_id uuid,
  active boolean NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX observation_sessions_recent ON platform_observation_private.sessions(last_seen_at DESC) WHERE active;
CREATE INDEX observation_sessions_prune ON platform_observation_private.sessions(last_seen_at);
CREATE TABLE platform_observation_private.registration_attempts (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES platform_observation_private.sessions(id) ON DELETE CASCADE,
  stage integer NOT NULL CHECK (stage BETWEEN 0 AND 4),
  furthest_stage integer NOT NULL CHECK (furthest_stage BETWEEN 0 AND 4),
  state text NOT NULL CHECK (state IN ('progress','submitting','left','failed','completed')),
  issue text,
  tenant_id uuid,
  owner_id uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX observation_registration_recent ON platform_observation_private.registration_attempts(started_at DESC,id DESC);
CREATE TABLE platform_observation_private.registration_events (
  id uuid PRIMARY KEY,
  attempt_id uuid NOT NULL REFERENCES platform_observation_private.registration_attempts(id) ON DELETE CASCADE,
  stage integer NOT NULL,
  state text NOT NULL,
  issue text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX observation_registration_events ON platform_observation_private.registration_events(attempt_id,created_at);
CREATE TABLE platform_observation_private.incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text NOT NULL UNIQUE,
  surface text NOT NULL,
  area text NOT NULL,
  category text NOT NULL,
  operation text NOT NULL,
  http_status integer,
  tenant_id uuid,
  occurrences integer NOT NULL DEFAULT 1,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  resolved boolean NOT NULL DEFAULT false,
  resolution text,
  resolved_at timestamptz
);
CREATE INDEX observation_incidents_recent ON platform_observation_private.incidents(last_seen_at DESC,id DESC);
CREATE TABLE platform_observation_private.request_limits (
  key text NOT NULL,
  window_start timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 1,
  PRIMARY KEY(key,window_start)
);
CREATE INDEX observation_request_limits_prune ON platform_observation_private.request_limits(window_start);
ALTER TABLE platform_observation_private.collection ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_observation_private.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_observation_private.registration_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_observation_private.registration_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_observation_private.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_observation_private.request_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA platform_observation_private FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA platform_observation_private TO service_role;

CREATE FUNCTION public.platform_collect_observation(p_event jsonb,p_auth_user_id uuid,p_ip_hash text)
RETURNS boolean LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_id uuid; v_secret text; v_hash text; v_surface text; v_area text; v_kind text;
  v_tenant uuid; v_platform boolean; v_session platform_observation_private.sessions%ROWTYPE;
  v_window timestamptz := date_trunc('minute',now()); v_count integer;
  v_attempt uuid; v_stage integer; v_state text; v_issue text;
  v_before platform_observation_private.registration_attempts%ROWTYPE;
  v_category text; v_operation text; v_status integer; v_fingerprint text;
BEGIN
  IF jsonb_typeof(p_event) IS DISTINCT FROM 'object' OR p_ip_hash IS NULL OR p_ip_hash !~ '^[a-f0-9]{64}$'
    OR coalesce(p_event->>'kind','') NOT IN ('heartbeat','registration','error')
    OR coalesce(p_event->>'sessionSecret','') !~ '^[a-f0-9]{64}$'
    OR coalesce(p_event->>'surface','') NOT IN ('website','registration','software','platform')
    OR coalesce(p_event->>'area','') NOT IN ('website','registration','login','office','assist','care','employee','client','relative','platform','other')
    OR jsonb_typeof(p_event->'active') IS DISTINCT FROM 'boolean' THEN
    RAISE EXCEPTION 'observation_invalid' USING ERRCODE='22023';
  END IF;
  v_id := (p_event->>'sessionId')::uuid;
  IF v_id IS NULL THEN RAISE EXCEPTION 'observation_invalid' USING ERRCODE='22023'; END IF;
  v_secret := p_event->>'sessionSecret';
  v_hash := encode(sha256(convert_to(v_secret,'UTF8')),'hex');
  v_surface := p_event->>'surface'; v_area := p_event->>'area'; v_kind := p_event->>'kind';
  SELECT EXISTS(SELECT 1 FROM public.platform_users WHERE user_id=p_auth_user_id AND status='active') INTO v_platform;
  SELECT p.tenant_id INTO v_tenant FROM public.profiles p
    WHERE p.auth_user_id=p_auth_user_id AND p.status='active' AND p.is_active
      AND EXISTS(SELECT 1 FROM public.platform_tenants t WHERE t.tenant_id=p.tenant_id AND t.status='active')
    LIMIT 1;
  IF v_surface='platform' AND NOT v_platform THEN v_surface:='website'; END IF;
  IF v_surface='software' AND v_tenant IS NULL THEN v_surface:='website'; END IF;

  INSERT INTO platform_observation_private.request_limits(key,window_start)
    VALUES('ip:'||p_ip_hash,v_window) ON CONFLICT(key,window_start)
    DO UPDATE SET attempts=platform_observation_private.request_limits.attempts+1 RETURNING attempts INTO v_count;
  IF v_count>240 THEN RETURN false; END IF;
  INSERT INTO platform_observation_private.request_limits(key,window_start)
    VALUES('session:'||v_id::text,v_window) ON CONFLICT(key,window_start)
    DO UPDATE SET attempts=platform_observation_private.request_limits.attempts+1 RETURNING attempts INTO v_count;
  IF v_count>12 THEN RETURN false; END IF;

  -- Serialize requests for this tab, including registration completion races.
  PERFORM pg_advisory_xact_lock(hashtextextended('platform-observation:'||v_id::text,0));
  SELECT * INTO v_session FROM platform_observation_private.sessions WHERE id=v_id FOR UPDATE;
  IF FOUND AND v_session.secret_hash<>v_hash THEN RETURN false; END IF;
  INSERT INTO platform_observation_private.sessions(id,secret_hash,surface,area,auth_user_id,tenant_id,active)
    VALUES(v_id,v_hash,v_surface,v_area,p_auth_user_id,v_tenant,(p_event->>'active')::boolean)
    ON CONFLICT(id) DO UPDATE SET surface=EXCLUDED.surface,area=EXCLUDED.area,auth_user_id=EXCLUDED.auth_user_id,
      tenant_id=EXCLUDED.tenant_id,active=EXCLUDED.active,last_seen_at=now();

  IF v_kind='registration' THEN
    v_attempt:=(p_event->>'attemptId')::uuid; v_stage:=(p_event->>'stage')::integer;
    v_state:=p_event->>'state'; v_issue:=p_event->>'issue';
    IF v_attempt IS NULL OR v_stage IS NULL OR v_stage NOT BETWEEN 0 AND 4
      OR coalesce(v_state,'') NOT IN ('progress','submitting','left','failed')
      OR (v_issue IS NOT NULL AND v_issue NOT IN ('validation','connection','permission','timeout','server','unknown')) THEN
      RAISE EXCEPTION 'observation_invalid' USING ERRCODE='22023'; END IF;
    SELECT * INTO v_before FROM platform_observation_private.registration_attempts WHERE id=v_attempt FOR UPDATE;
    IF FOUND AND v_before.session_id<>v_id THEN RETURN false; END IF;
    IF v_before.state='failed' AND v_state='failed' AND v_issue='unknown' THEN v_issue:=v_before.issue; END IF;
    IF NOT FOUND OR v_before.state<>'completed' THEN
      INSERT INTO platform_observation_private.registration_attempts(id,session_id,stage,furthest_stage,state,issue)
        VALUES(v_attempt,v_id,v_stage,v_stage,v_state,v_issue)
        ON CONFLICT(id) DO UPDATE SET stage=EXCLUDED.stage,furthest_stage=greatest(platform_observation_private.registration_attempts.furthest_stage,EXCLUDED.stage),
          state=EXCLUDED.state,issue=EXCLUDED.issue,last_seen_at=now();
      IF v_before.id IS NULL OR v_before.stage<>v_stage OR v_before.state<>v_state OR v_before.issue IS DISTINCT FROM v_issue THEN
        IF (SELECT count(*) FROM platform_observation_private.registration_events WHERE attempt_id=v_attempt)<50 THEN
          INSERT INTO platform_observation_private.registration_events(id,attempt_id,stage,state,issue)
            VALUES((p_event->>'eventId')::uuid,v_attempt,v_stage,v_state,v_issue) ON CONFLICT(id) DO NOTHING;
        END IF;
      END IF;
    END IF;
  ELSIF v_kind='error' THEN
    v_category:=p_event->>'category'; v_operation:=p_event->>'operation'; v_status:=(p_event->>'httpStatus')::integer;
    IF coalesce(v_category,'') NOT IN ('connection','permission','timeout','validation','server','render','unexpected')
      OR coalesce(v_operation,'') NOT IN ('database','login','storage','registration','function','page')
      OR (v_status IS NOT NULL AND v_status NOT BETWEEN 400 AND 599) THEN
      RAISE EXCEPTION 'observation_invalid' USING ERRCODE='22023'; END IF;
    v_fingerprint:=encode(sha256(convert_to(concat_ws(':',v_surface,v_area,v_category,v_operation,v_status,v_tenant),'UTF8')),'hex');
    INSERT INTO platform_observation_private.incidents(fingerprint,surface,area,category,operation,http_status,tenant_id)
      VALUES(v_fingerprint,v_surface,v_area,v_category,v_operation,v_status,v_tenant)
      ON CONFLICT(fingerprint) DO UPDATE SET occurrences=platform_observation_private.incidents.occurrences+1,
        last_seen_at=now(),resolved=false,resolved_at=NULL;
  END IF;
  UPDATE platform_observation_private.collection SET first_event_at=coalesce(first_event_at,now()),last_event_at=now();
  UPDATE platform_observation_private.collection SET last_prune_at=now() WHERE last_prune_at<now()-interval '5 minutes';
  IF FOUND THEN
    DELETE FROM platform_observation_private.registration_attempts WHERE started_at<now()-interval '14 days';
    -- Keep linked registration sessions for the same retention window.
    DELETE FROM platform_observation_private.sessions s WHERE last_seen_at<now()-interval '1 day'
      AND NOT EXISTS(SELECT 1 FROM platform_observation_private.registration_attempts a WHERE a.session_id=s.id);
    DELETE FROM platform_observation_private.incidents WHERE last_seen_at<now()-interval '30 days';
    DELETE FROM platform_observation_private.request_limits WHERE window_start<now()-interval '1 hour';
  END IF;
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.platform_collect_observation(jsonb,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_collect_observation(jsonb,uuid,text) TO service_role;

-- Only the registration handler can confirm a completed company creation.
CREATE FUNCTION public.platform_confirm_registration_observation(p_session_id uuid,p_session_secret text,p_attempt_id uuid,p_tenant_id uuid,p_owner_id uuid,p_http_status integer)
RETURNS boolean LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_row platform_observation_private.registration_attempts%ROWTYPE; v_issue text;
BEGIN
  IF p_session_id IS NULL OR p_attempt_id IS NULL OR coalesce(p_session_secret,'') !~ '^[a-f0-9]{64}$'
    OR p_http_status IS NULL OR p_http_status NOT BETWEEN 200 AND 599 THEN RETURN false; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('platform-observation:'||p_session_id::text,0));
  IF NOT EXISTS(SELECT 1 FROM platform_observation_private.sessions WHERE id=p_session_id
    AND secret_hash=encode(sha256(convert_to(p_session_secret,'UTF8')),'hex')) THEN RETURN false; END IF;
  SELECT * INTO v_row FROM platform_observation_private.registration_attempts WHERE id=p_attempt_id AND session_id=p_session_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_row.state='completed' THEN RETURN v_row.tenant_id IS NOT DISTINCT FROM p_tenant_id; END IF;
  IF p_http_status=201 AND p_tenant_id IS NOT NULL AND p_owner_id IS NOT NULL
    AND EXISTS(SELECT 1 FROM public.tenant_users WHERE id=p_owner_id AND tenant_id=p_tenant_id AND role_key='owner') THEN
    UPDATE platform_observation_private.registration_attempts SET state='completed',stage=4,furthest_stage=4,issue=NULL,
      tenant_id=p_tenant_id,owner_id=p_owner_id,completed_at=now(),last_seen_at=now() WHERE id=p_attempt_id;
    INSERT INTO platform_observation_private.registration_events(id,attempt_id,stage,state) VALUES(gen_random_uuid(),p_attempt_id,4,'completed');
  ELSE
    v_issue:=CASE WHEN p_http_status=400 THEN 'validation' WHEN p_http_status IN (401,403) THEN 'permission'
      WHEN p_http_status=409 THEN 'account_exists' ELSE 'server_unconfirmed' END;
    UPDATE platform_observation_private.registration_attempts SET state='failed',issue=v_issue,last_seen_at=now() WHERE id=p_attempt_id;
    INSERT INTO platform_observation_private.registration_events(id,attempt_id,stage,state,issue) VALUES(gen_random_uuid(),p_attempt_id,v_row.stage,'failed',v_issue);
  END IF;
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.platform_confirm_registration_observation(uuid,text,uuid,uuid,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_confirm_registration_observation(uuid,text,uuid,uuid,uuid,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.platform_get_operations_summary()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_environments jsonb; v_telemetry jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'platform_forbidden' USING ERRCODE='42501'; END IF;
  PERFORM public.platform_assert_capability('tenants.read');
  SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.mode),'[]') INTO v_environments FROM (
    SELECT coalesce(e.mode,'unclassified') AS mode,count(*) AS companies,
      sum((SELECT count(*) FROM public.clients c WHERE c.tenant_id=t.id AND c.deleted_at IS NULL)) AS clients,
      sum((SELECT count(*) FROM public.employees m WHERE m.tenant_id=t.id AND m.deleted_at IS NULL)) AS employees
    FROM public.tenants t LEFT JOIN public.tenant_environment_settings e ON e.tenant_id=t.id GROUP BY coalesce(e.mode,'unclassified')
  ) q;
  IF public.platform_has_capability('system.read') THEN
    SELECT jsonb_build_object('firstEventAt',h.first_event_at,'lastEventAt',h.last_event_at,
      'websiteViews',(SELECT count(*) FROM platform_observation_private.sessions WHERE active AND last_seen_at>=now()-interval '90 seconds' AND surface IN ('website','registration')),
      'softwareAccounts',(SELECT count(DISTINCT auth_user_id) FROM platform_observation_private.sessions WHERE active AND last_seen_at>=now()-interval '90 seconds' AND surface='software' AND tenant_id IS NOT NULL AND auth_user_id IS NOT NULL),
      'softwareCompanies',(SELECT count(DISTINCT tenant_id) FROM platform_observation_private.sessions WHERE active AND last_seen_at>=now()-interval '90 seconds' AND surface='software' AND tenant_id IS NOT NULL),
      'platformAccounts',(SELECT count(DISTINCT auth_user_id) FROM platform_observation_private.sessions WHERE active AND last_seen_at>=now()-interval '90 seconds' AND surface='platform' AND auth_user_id IS NOT NULL),
      'registrationsLive',(SELECT count(*) FROM platform_observation_private.registration_attempts a JOIN platform_observation_private.sessions s ON s.id=a.session_id WHERE a.state NOT IN ('completed','left') AND s.active AND s.surface='registration' AND s.last_seen_at>=now()-interval '90 seconds'),
      'registrationsToday',(SELECT count(*) FROM platform_observation_private.registration_attempts WHERE started_at>=now()-interval '24 hours'),
      'registrationsCompletedToday',(SELECT count(*) FROM platform_observation_private.registration_attempts WHERE completed_at>=now()-interval '24 hours'),
      'registrationsWithIssue',(SELECT count(*) FROM platform_observation_private.registration_attempts WHERE issue IS NOT NULL AND state<>'completed' AND started_at>=now()-interval '24 hours'),
      'openIncidents',(SELECT count(*) FROM platform_observation_private.incidents WHERE NOT resolved AND last_seen_at>=now()-interval '30 days'),
      'latestIncidentAt',(SELECT max(last_seen_at) FROM platform_observation_private.incidents WHERE last_seen_at>=now()-interval '30 days'),
      'heartbeatSeconds',30,'liveWindowSeconds',90,'registrationRetentionDays',14,'incidentRetentionDays',30)
      INTO v_telemetry FROM platform_observation_private.collection h;
  END IF;
  RETURN jsonb_build_object('release','caresuite-platform-operations-20261007','checkedAt',now(),
    'inventory',jsonb_build_object(
      'companies',(SELECT count(*) FROM public.platform_tenants),
      'activeCompanies',(SELECT count(*) FROM public.platform_tenants WHERE status='active'),
      'suspendedCompanies',(SELECT count(*) FROM public.platform_tenants WHERE status IN ('suspended','locked')),
      'deactivatedCompanies',(SELECT count(*) FROM public.platform_tenants WHERE status='terminated'),
      'deletedCompanies',(SELECT count(*) FROM public.platform_tenants WHERE status='deleted_soft'),
      'clients',(SELECT count(*) FROM public.clients WHERE deleted_at IS NULL),
      'deletedClients',(SELECT count(*) FROM public.clients WHERE deleted_at IS NOT NULL),
      'employees',(SELECT count(*) FROM public.employees WHERE deleted_at IS NULL),
      'deletedEmployees',(SELECT count(*) FROM public.employees WHERE deleted_at IS NOT NULL),
      'administrationAccounts',(SELECT count(*) FROM public.tenant_users WHERE status='active'),
      'environments',v_environments),
    'operations',jsonb_build_object(
      'openSupportTickets',CASE WHEN public.platform_has_capability('support.read') THEN (SELECT count(*) FROM public.support_workspace_tickets WHERE status NOT IN ('resolved','closed')) ELSE NULL END,
      'approvedSupportAccess',CASE WHEN public.platform_has_capability('support.read') THEN (SELECT count(*) FROM public.support_access_requests r JOIN public.support_workspace_tickets t ON t.id=r.ticket_id WHERE r.status='approved' AND r.expires_at>now() AND t.status NOT IN ('resolved','closed')) ELSE NULL END,
      'welcomePending',(SELECT count(*) FROM public.registration_welcome_outbox WHERE state IN ('pending','sending')),
      'welcomeNeedsReview',(SELECT count(*) FROM public.registration_welcome_outbox WHERE state NOT IN ('pending','sending','sent')),
      'accountOperationsNeedReview',(SELECT count(*) FROM public.platform_account_operations WHERE state='needs_review')),
    'telemetry',v_telemetry);
END; $$;
REVOKE ALL ON FUNCTION public.platform_get_operations_summary() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_get_operations_summary() TO authenticated;

CREATE FUNCTION public.platform_list_registration_activity(p_state text DEFAULT '',p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_items jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'platform_forbidden' USING ERRCODE='42501'; END IF;
  PERFORM public.platform_assert_capability('system.read');
  IF coalesce(p_state,'') NOT IN ('','active','recent','completed','failed','left','inactive','uncertain') THEN RAISE EXCEPTION 'observation_filter_invalid' USING ERRCODE='22023'; END IF;
  WITH classified AS (
    SELECT a.*,CASE WHEN a.state='completed' THEN 'completed'
      WHEN a.state='submitting' AND a.last_seen_at<now()-interval '15 minutes' THEN 'uncertain'
      WHEN a.state='left' THEN 'left'
      WHEN s.active AND s.surface='registration' AND s.last_seen_at>=now()-interval '90 seconds' THEN 'active'
      WHEN a.state='failed' THEN 'failed'
      WHEN a.last_seen_at<now()-interval '10 minutes' THEN 'inactive' ELSE 'recent' END AS display_state
      FROM platform_observation_private.registration_attempts a JOIN platform_observation_private.sessions s ON s.id=a.session_id
  )
  SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.started_at DESC,q.id DESC),'[]') INTO v_items FROM (
    SELECT a.id,a.stage,a.furthest_stage,a.display_state AS state,a.issue,a.started_at,a.last_seen_at,a.completed_at,
      a.tenant_id,t.tenant_name AS company_name,u.display_name AS owner_name,
      (SELECT coalesce(jsonb_agg(jsonb_build_object('stage',e.stage,'state',e.state,'issue',e.issue,'created_at',e.created_at) ORDER BY e.created_at),'[]') FROM platform_observation_private.registration_events e WHERE e.attempt_id=a.id) AS events
    FROM classified a LEFT JOIN public.platform_tenants t ON t.tenant_id=a.tenant_id LEFT JOIN public.tenant_users u ON u.id=a.owner_id
    WHERE a.started_at>=now()-interval '14 days' AND (coalesce(p_state,'')='' OR a.display_state=p_state) ORDER BY a.started_at DESC,a.id DESC
    LIMIT 51 OFFSET greatest(0,least(coalesce(p_offset,0),100000))
  ) q;
  RETURN jsonb_build_object('items',v_items);
END; $$;
REVOKE ALL ON FUNCTION public.platform_list_registration_activity(text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_list_registration_activity(text,integer) TO authenticated;

CREATE FUNCTION public.platform_list_runtime_incidents(p_status text DEFAULT 'open',p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_items jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'platform_forbidden' USING ERRCODE='42501'; END IF;
  PERFORM public.platform_assert_capability('system.read');
  IF coalesce(p_status,'') NOT IN ('','open','resolved') THEN RAISE EXCEPTION 'observation_filter_invalid' USING ERRCODE='22023'; END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.last_seen_at DESC,q.id DESC),'[]') INTO v_items FROM (
    SELECT i.id,i.surface,i.area,i.category,i.operation,i.http_status,i.tenant_id,t.tenant_name AS company_name,
      i.occurrences,i.first_seen_at,i.last_seen_at,i.resolved,i.resolution,i.resolved_at
    FROM platform_observation_private.incidents i LEFT JOIN public.platform_tenants t ON t.tenant_id=i.tenant_id
    WHERE i.last_seen_at>=now()-interval '30 days' AND (coalesce(p_status,'')='' OR (p_status='open' AND NOT i.resolved) OR (p_status='resolved' AND i.resolved))
    ORDER BY i.last_seen_at DESC,i.id DESC LIMIT 51 OFFSET greatest(0,least(coalesce(p_offset,0),100000))
  ) q;
  RETURN jsonb_build_object('items',v_items);
END; $$;
REVOKE ALL ON FUNCTION public.platform_list_runtime_incidents(text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_list_runtime_incidents(text,integer) TO authenticated;

CREATE FUNCTION public.platform_set_incident_resolution(p_id uuid,p_expected_last_seen_at timestamptz,p_resolved boolean,p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_before platform_observation_private.incidents%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'platform_forbidden' USING ERRCODE='42501'; END IF;
  PERFORM public.platform_assert_capability('system.write');
  PERFORM public.platform_assert_reason(p_reason);
  IF length(p_reason)>1000 OR p_resolved IS NULL THEN RAISE EXCEPTION 'observation_invalid' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_before FROM platform_observation_private.incidents WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR p_expected_last_seen_at IS NULL OR v_before.last_seen_at<>p_expected_last_seen_at THEN
    RAISE EXCEPTION 'access_record_changed' USING ERRCODE='40001'; END IF;
  UPDATE platform_observation_private.incidents SET resolved=p_resolved,resolution=trim(p_reason),
    resolved_at=CASE WHEN p_resolved THEN now() ELSE NULL END WHERE id=p_id;
  PERFORM public.platform_write_audit_log('runtime.incident_status_changed','platform_runtime_incident',p_id,v_before.tenant_id,
    jsonb_build_object('resolved',v_before.resolved),jsonb_build_object('resolved',p_resolved),trim(p_reason));
END; $$;
REVOKE ALL ON FUNCTION public.platform_set_incident_resolution(uuid,timestamptz,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_set_incident_resolution(uuid,timestamptz,boolean,text) TO authenticated;

-- Preserve the dashboard contract while removing obsolete paid-product queries.
CREATE OR REPLACE FUNCTION public.platform_get_dashboard_summary()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'platform_forbidden' USING ERRCODE='42501'; END IF;
  PERFORM public.platform_assert_capability('tenants.read');
  RETURN jsonb_build_object(
    'tenants',jsonb_build_object(
      'active',(SELECT count(*) FROM public.platform_tenants WHERE status='active'),
      'suspended',(SELECT count(*) FROM public.platform_tenants WHERE status IN ('suspended','locked')),
      'onboarding',(SELECT count(*) FROM public.platform_tenants WHERE status='active' AND lifecycle_status='onboarding'),
      'trial',0,'pastDue',0,'cancelled',0),
    'billing',jsonb_build_object('openInvoices',0,'pastDueInvoices',0,'failedPayments',0,'activeDiscounts',0),
    'modules',jsonb_build_object('betaActive',(SELECT count(*) FROM public.platform_tenant_modules WHERE status='beta_enabled'),'trialExpiring',0),
    'system',jsonb_build_object(
      'activeFeatureFlags',(SELECT count(*) FROM public.platform_feature_flags WHERE enabled),
      'activeSupportSessions',CASE WHEN public.platform_has_capability('support.read') THEN (SELECT count(*) FROM public.support_access_requests r JOIN public.support_workspace_tickets t ON t.id=r.ticket_id WHERE r.status='approved' AND r.expires_at>now() AND t.status NOT IN ('resolved','closed')) ELSE 0 END,
      'maintenanceMode',coalesce((SELECT value='true'::jsonb FROM public.platform_system_settings WHERE setting_key='maintenance_mode'),false)));
END; $$;

CREATE OR REPLACE FUNCTION public.platform_operations_release_status()
RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT jsonb_build_object('release','caresuite-platform-operations-20261007','ready',true,'inventoryReady',true,'observationReady',true);
$$;
REVOKE ALL ON FUNCTION public.platform_operations_release_status() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_operations_release_status() TO anon,authenticated;
