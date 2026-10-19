-- Reviewed change proposal; the base change was applied to staging via SQL Editor.
-- No production rollout or formal migration-history record is implied.
-- Generate the migration filename with the installed Supabase CLI before release.
-- See docs/data-request-workspace-rollout.md. No production test fixtures.
BEGIN;

CREATE SCHEMA IF NOT EXISTS data_request_private;
REVOKE ALL ON SCHEMA data_request_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA data_request_private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION data_request_private.actor_profile_id()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_tenant uuid := public.current_tenant_id();
  v_profile uuid;
BEGIN
  IF v_uid IS NULL OR v_tenant IS NULL THEN
    RAISE EXCEPTION 'data_request_identity_unavailable' USING ERRCODE = '42501';
  END IF;
  SELECT p.id INTO v_profile
  FROM public.profiles p
  WHERE p.tenant_id = v_tenant
    AND (p.auth_user_id = v_uid OR (p.id = v_uid AND (p.auth_user_id IS NULL OR p.auth_user_id = v_uid)))
    AND p.is_active IS TRUE
    AND p.status::text IN ('active', 'invited')
  ORDER BY (p.id = v_uid) DESC, p.created_at, p.id
  LIMIT 1;
  IF v_profile IS NULL THEN
    RAISE EXCEPTION 'data_request_identity_unavailable' USING ERRCODE = '42501';
  END IF;
  RETURN v_profile;
END;
$function$;
REVOKE ALL ON FUNCTION data_request_private.actor_profile_id() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION data_request_private.actor_profile_id() TO authenticated;

CREATE OR REPLACE FUNCTION data_request_private.admin_allowed(p_tenant_id uuid, p_permission text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_profile uuid;
  v_internal boolean;
  v_role_key text;
BEGIN
  IF auth.uid() IS NULL OR p_tenant_id IS NULL
    OR p_tenant_id IS DISTINCT FROM public.current_tenant_id()
    OR COALESCE(public.current_portal_type(), 'business') <> 'business'
    OR p_permission IS NULL
    OR p_permission NOT IN ('security.view', 'security.manage') THEN
    RETURN false;
  END IF;
  -- Retain the additional live portal/platform guard. Legacy staging does not have it.
  IF to_regprocedure('public.is_internal_tenant_actor(uuid)') IS NOT NULL THEN
    EXECUTE 'SELECT public.is_internal_tenant_actor($1)' INTO v_internal USING p_tenant_id;
    IF v_internal IS DISTINCT FROM true THEN RETURN false; END IF;
  END IF;
  IF to_regprocedure('public.current_role_key()') IS NOT NULL THEN
    EXECUTE 'SELECT public.current_role_key()' INTO v_role_key;
    IF v_role_key IN ('employee_portal','client_portal','family_portal') THEN RETURN false; END IF;
  END IF;
  v_profile := data_request_private.actor_profile_id();
  RETURN EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.roles r ON r.id = p.role_id
    WHERE p.id = v_profile AND p.tenant_id = p_tenant_id
      AND p.is_active IS TRUE AND p.status::text = 'active'
      AND r.key NOT IN ('employee_portal', 'client_portal', 'family_portal')
      -- Live has tenant-scoped roles; staging also supports legacy global roles.
      AND (to_jsonb(r)->>'tenant_id' IS NULL OR to_jsonb(r)->>'tenant_id'=p.tenant_id::text)
      AND (
        -- Preserve existing, deployed tenant-admin access on this exact role.
        COALESCE(r.is_admin_role, false)
        OR r.key IN ('owner', 'admin', 'management', 'geschaeftsfuehrung', 'business_admin')
        OR EXISTS (
          SELECT 1 FROM public.role_permissions rp WHERE rp.role_id = p.role_id
          AND (to_jsonb(rp)->>'tenant_id' IS NULL OR to_jsonb(rp)->>'tenant_id'=p.tenant_id::text)
          AND (
            rp.permission_key = p_permission
            OR (rp.permission_key = 'security' AND
              ((p_permission = 'security.view' AND rp.can_view)
               OR (p_permission = 'security.manage' AND rp.can_update)))
          )
        )
      )
  );
EXCEPTION WHEN insufficient_privilege THEN
  RETURN false;
END;
$function$;
REVOKE ALL ON FUNCTION data_request_private.admin_allowed(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION data_request_private.admin_allowed(uuid,text) TO authenticated;

-- Private, immutable input fingerprint: no applicant or administrator text returned to callers.
CREATE TABLE IF NOT EXISTS data_request_private.submissions (
  request_id uuid PRIMARY KEY REFERENCES public.data_subject_requests(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS data_request_submissions_tenant_id_idx
  ON data_request_private.submissions (tenant_id);
CREATE INDEX IF NOT EXISTS data_request_submissions_profile_id_idx
  ON data_request_private.submissions (profile_id);
ALTER TABLE data_request_private.submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON data_request_private.submissions FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS data_request_private.admin_notifications (
  request_id uuid PRIMARY KEY REFERENCES public.data_subject_requests(id) ON DELETE CASCADE,
  claim_token uuid NOT NULL DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'claimed' CHECK (status IN ('claimed', 'sent', 'failed')),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
ALTER TABLE data_request_private.admin_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON data_request_private.admin_notifications FROM PUBLIC, anon, authenticated, service_role;

-- PostgreSQL policies are permissive by default: replace, do not add another OR policy.
DO $block$
DECLARE v_policy record; v_columns text;
BEGIN
  FOR v_policy IN SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'data_subject_requests'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.data_subject_requests', v_policy.policyname);
  END LOOP;
  SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum) INTO v_columns
    FROM pg_attribute WHERE attrelid = 'public.data_subject_requests'::regclass
      AND attnum > 0 AND NOT attisdropped;
  EXECUTE format(
    'REVOKE SELECT (%1$s), INSERT (%1$s), UPDATE (%1$s), REFERENCES (%1$s) ON public.data_subject_requests FROM PUBLIC, anon, authenticated',
    v_columns
  );
END;
$block$;
REVOKE ALL ON public.data_subject_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.data_subject_requests TO authenticated;
-- Canonical request lookup for the existing service-side notification handler.
GRANT SELECT (id,tenant_id,profile_id,request_type,requester_name,requester_email,received_at,created_at)
  ON public.data_subject_requests TO service_role;
GRANT INSERT (id, tenant_id, profile_id, request_type, status, requester_name, requester_email,
  verification_notes, metadata, received_at) ON public.data_subject_requests TO authenticated;
GRANT UPDATE (status, updated_at, completed_at) ON public.data_subject_requests TO authenticated;
ALTER TABLE public.data_subject_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY data_request_internal_read ON public.data_subject_requests
FOR SELECT TO authenticated USING (
  data_request_private.admin_allowed(tenant_id, 'security.view')
  OR data_request_private.admin_allowed(tenant_id, 'security.manage')
);
CREATE POLICY data_request_internal_insert ON public.data_subject_requests
FOR INSERT TO authenticated WITH CHECK (
  data_request_private.admin_allowed(tenant_id, 'security.manage')
  AND status = 'queued' AND completed_at IS NULL AND due_at IS NULL
  AND export_document_id IS NULL AND result_summary IS NULL
  AND client_id IS NULL AND employee_id IS NULL
  AND (profile_id IS NULL OR EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = data_subject_requests.profile_id
      AND p.tenant_id = data_subject_requests.tenant_id
  ))
);
CREATE POLICY data_request_internal_update ON public.data_subject_requests
FOR UPDATE TO authenticated
USING (data_request_private.admin_allowed(tenant_id, 'security.manage'))
WITH CHECK (data_request_private.admin_allowed(tenant_id, 'security.manage'));

-- Production audit triggers store old_data/new_data. Protect those copies when
-- the existing audit table is present; do not create audit infrastructure here.
DO $audit_policy$
BEGIN
  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS data_request_audit_visibility ON public.audit_logs';
    EXECUTE $policy$
      CREATE POLICY data_request_audit_visibility ON public.audit_logs AS RESTRICTIVE
      FOR SELECT TO authenticated USING (
        table_name IS DISTINCT FROM 'data_subject_requests'
        OR data_request_private.admin_allowed(tenant_id,'security.view')
        OR data_request_private.admin_allowed(tenant_id,'security.manage')
      )
    $policy$;
  ELSE
    RAISE NOTICE 'public.audit_logs is absent: audit-copy policy was not installed; audit-copy protection remains unverified in this environment';
  END IF;
END;
$audit_policy$;

CREATE OR REPLACE FUNCTION data_request_private.set_server_timestamps()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.status := 'queued';
    NEW.received_at := statement_timestamp();
    NEW.created_at := NEW.received_at;
    NEW.updated_at := NEW.received_at;
    NEW.completed_at := NULL;
    NEW.due_at := NULL;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.completed_at := CASE WHEN NEW.status = 'completed' THEN statement_timestamp() ELSE NULL END;
  ELSIF NEW.status = 'completed' THEN
    NEW.completed_at := OLD.completed_at;
  ELSE
    NEW.completed_at := NULL;
  END IF;
  IF TG_OP = 'UPDATE' THEN NEW.updated_at := statement_timestamp(); END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION data_request_private.set_server_timestamps() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS data_request_server_timestamps ON public.data_subject_requests;
CREATE TRIGGER data_request_server_timestamps
BEFORE INSERT OR UPDATE ON public.data_subject_requests
FOR EACH ROW EXECUTE FUNCTION data_request_private.set_server_timestamps();

CREATE OR REPLACE FUNCTION data_request_private.workspace_v1(p_action text, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_request public.data_subject_requests%ROWTYPE;
  v_payload jsonb := COALESCE(p_payload, '{}'::jsonb);
  v_id uuid;
  v_type text;
  v_name text;
  v_email text;
  v_message text;
  v_fingerprint text;
  v_inserted boolean;
  v_limit integer := 20;
  v_offset integer := 0;
  v_items jsonb;
  v_more boolean;
  v_expected_updated timestamptz;
  v_new_status text;
  v_expected_status text;
BEGIN
  SELECT * INTO STRICT v_profile FROM public.profiles
    WHERE id = data_request_private.actor_profile_id();

  IF jsonb_typeof(v_payload) <> 'object'
    OR octet_length(v_payload::text) > 30000 THEN
    RAISE EXCEPTION 'data_request_invalid_payload' USING ERRCODE = '22023';
  END IF;
  -- Expected values are equality checks only. Never use them to select the actor.
  IF v_payload->>'expected_auth_user_id' IS DISTINCT FROM v_uid::text
    OR v_payload->>'expected_tenant_id' IS DISTINCT FROM v_profile.tenant_id::text
    OR v_payload->>'expected_profile_id' IS DISTINCT FROM v_profile.id::text THEN
    RAISE EXCEPTION 'data_request_identity_changed' USING ERRCODE = '42501';
  END IF;
  IF p_action = 'capabilities' THEN
    RETURN jsonb_build_object('version',1,'capabilities',jsonb_build_object(
      'self_service',true,
      'admin_view',data_request_private.admin_allowed(v_profile.tenant_id,'security.view')
        OR data_request_private.admin_allowed(v_profile.tenant_id,'security.manage'),
      'admin_manage',data_request_private.admin_allowed(v_profile.tenant_id,'security.manage')
    ));
  ELSIF p_action = 'admin_update' THEN
    IF NOT data_request_private.admin_allowed(v_profile.tenant_id,'security.manage') THEN
      RAISE EXCEPTION 'data_request_admin_forbidden' USING ERRCODE='42501';
    END IF;
    IF jsonb_typeof(v_payload->'request_id') IS DISTINCT FROM 'string'
      OR jsonb_typeof(v_payload->'expected_updated_at') IS DISTINCT FROM 'string'
      OR jsonb_typeof(v_payload->'expected_status') IS DISTINCT FROM 'string'
      OR jsonb_typeof(v_payload->'new_status') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'data_request_invalid_update' USING ERRCODE='22023';
    END IF;
    BEGIN
      v_id := (v_payload->>'request_id')::uuid;
      v_expected_updated := (v_payload->>'expected_updated_at')::timestamptz;
    EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN
      RAISE EXCEPTION 'data_request_invalid_update' USING ERRCODE='22023';
    END;
    v_new_status := v_payload->>'new_status';
    v_expected_status := v_payload->>'expected_status';
    IF v_id IS NULL OR v_expected_updated IS NULL OR NOT isfinite(v_expected_updated)
      OR v_new_status NOT IN ('queued','running','completed','failed','cancelled')
      OR v_expected_status NOT IN ('queued','running','completed','failed','cancelled') THEN
      RAISE EXCEPTION 'data_request_invalid_update' USING ERRCODE='22023';
    END IF;
    UPDATE public.data_subject_requests r SET status=v_new_status::public.job_status
      WHERE r.tenant_id=v_profile.tenant_id AND r.id=v_id
        AND r.status::text=v_expected_status AND r.updated_at=v_expected_updated
      RETURNING * INTO v_request;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'data_request_update_conflict' USING ERRCODE='40001';
    END IF;
    RETURN jsonb_build_object('version',1,'item',jsonb_build_object(
      'id',v_request.id,'tenant_id',v_request.tenant_id,'profile_id',v_request.profile_id,
      'request_type',v_request.request_type,'status',v_request.status,
      'requester_name',v_request.requester_name,'requester_email',v_request.requester_email,
      'verification_notes',v_request.verification_notes,'request_number',v_request.request_number,
      'received_at',v_request.received_at,'due_at',v_request.due_at,'completed_at',v_request.completed_at,
      'created_at',v_request.created_at,'updated_at',v_request.updated_at
    ));
  ELSIF p_action = 'account_export' THEN
    RETURN jsonb_build_object('version',1,'generated_at',statement_timestamp(),'account',
      jsonb_build_object(
        'first_name',v_profile.first_name,'last_name',v_profile.last_name,
        'display_name',v_profile.display_name,'email',v_profile.email,'phone',v_profile.phone,
        'created_at',v_profile.created_at,'updated_at',v_profile.updated_at
      ));
  ELSIF p_action = 'list' THEN
    IF COALESCE(v_payload->>'limit','20') !~ '^[0-9]{1,3}$'
      OR COALESCE(v_payload->>'offset','0') !~ '^[0-9]{1,6}$' THEN
      RAISE EXCEPTION 'data_request_invalid_pagination' USING ERRCODE = '22023';
    END IF;
    v_limit := COALESCE((v_payload->>'limit')::integer,20);
    v_offset := COALESCE((v_payload->>'offset')::integer,0);
    IF v_limit < 1 OR v_limit > 100 OR v_offset < 0 OR v_offset > 100000 THEN
      RAISE EXCEPTION 'data_request_invalid_pagination' USING ERRCODE = '22023';
    END IF;
    WITH page AS (
      SELECT r.id,r.request_type,r.status,r.request_number,r.received_at,r.created_at,r.updated_at,
        row_number() OVER (ORDER BY r.created_at DESC,r.id DESC) AS n
      FROM public.data_subject_requests r
      WHERE r.tenant_id=v_profile.tenant_id AND r.profile_id=v_profile.id
      ORDER BY r.created_at DESC,r.id DESC LIMIT v_limit+1 OFFSET v_offset
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id',id,'request_type',request_type,'status',status,'request_number',request_number,
        'received_at',received_at,'created_at',created_at,'updated_at',updated_at
      ) ORDER BY created_at DESC,id DESC) FILTER (WHERE n <= v_offset+v_limit),'[]'::jsonb),
      count(*) > v_limit INTO v_items,v_more FROM page;
    RETURN jsonb_build_object('version',1,'items',v_items,'has_more',v_more);
  ELSIF p_action = 'submit' THEN
    IF jsonb_typeof(v_payload->'request_type') IS DISTINCT FROM 'string'
      OR jsonb_typeof(v_payload->'requester_name') IS DISTINCT FROM 'string'
      OR jsonb_typeof(v_payload->'requester_email') IS DISTINCT FROM 'string'
      OR (v_payload ? 'message' AND jsonb_typeof(v_payload->'message') IS DISTINCT FROM 'string')
      OR jsonb_typeof(v_payload->'idempotency_key') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'data_request_invalid_payload' USING ERRCODE = '22023';
    END IF;
    BEGIN
      v_id := (v_payload->>'idempotency_key')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'data_request_invalid_idempotency_key' USING ERRCODE = '22023';
    END;
    v_type := v_payload->>'request_type';
    v_name := btrim(v_payload->>'requester_name');
    v_email := btrim(v_payload->>'requester_email');
    v_message := btrim(COALESCE(v_payload->>'message',''));
    IF v_id IS NULL OR v_type NOT IN ('access','portability','correction','restriction','objection')
      OR char_length(v_name) NOT BETWEEN 1 AND 160
      OR char_length(v_email) NOT BETWEEN 1 AND 254
      OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      OR v_name ~ '[[:cntrl:]]' OR v_email ~ '[[:cntrl:]]'
      OR v_name ~ ('['||chr(127)||'-'||chr(159)||']')
      OR v_email ~ ('['||chr(127)||'-'||chr(159)||']')
      OR char_length(v_message) > 4000
      OR translate(v_message, chr(9)||chr(10)||chr(13),'') ~ '[[:cntrl:]]'
      OR v_message ~ ('['||chr(127)||'-'||chr(159)||']') THEN
      RAISE EXCEPTION 'data_request_invalid_input' USING ERRCODE = '22023';
    END IF;
    v_fingerprint := encode(sha256(convert_to(jsonb_build_object(
      'type',v_type,'name',v_name,'email',v_email,'message',v_message
    )::text,'UTF8')),'hex');
    INSERT INTO public.data_subject_requests
      (id,tenant_id,profile_id,request_type,status,requester_name,requester_email,verification_notes,metadata)
    VALUES (v_id,v_profile.tenant_id,v_profile.id,v_type::public.data_request_type,'queued',
      v_name,v_email,NULLIF(v_message,''),jsonb_build_object('source','caresuite_app','channel','settings'))
    ON CONFLICT (id) DO NOTHING RETURNING * INTO v_request;
    v_inserted := FOUND;
    IF v_inserted THEN
      INSERT INTO data_request_private.submissions(request_id,tenant_id,profile_id,fingerprint)
        VALUES(v_id,v_profile.tenant_id,v_profile.id,v_fingerprint);
    ELSE
      IF NOT EXISTS (
        SELECT 1 FROM data_request_private.submissions s
        WHERE s.request_id=v_id AND s.tenant_id=v_profile.tenant_id AND s.profile_id=v_profile.id
          AND s.fingerprint=v_fingerprint
      ) THEN
        RAISE EXCEPTION 'data_request_idempotency_conflict' USING ERRCODE = '23505';
      END IF;
      SELECT * INTO STRICT v_request FROM public.data_subject_requests r
        WHERE r.id=v_id AND r.tenant_id=v_profile.tenant_id AND r.profile_id=v_profile.id;
    END IF;
    RETURN jsonb_build_object('version',1,'replayed',NOT v_inserted,'item',jsonb_build_object(
      'id',v_request.id,'request_type',v_request.request_type,'status',v_request.status,
      'request_number',v_request.request_number,'received_at',v_request.received_at,
      'created_at',v_request.created_at,'updated_at',v_request.updated_at
    ));
  END IF;
  RAISE EXCEPTION 'data_request_unknown_action' USING ERRCODE = '22023';
END;
$function$;
REVOKE ALL ON FUNCTION data_request_private.workspace_v1(text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION data_request_private.workspace_v1(text,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.data_request_workspace_v1(p_action text,p_payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $function$
  SELECT data_request_private.workspace_v1(p_action,p_payload);
$function$;
REVOKE ALL ON FUNCTION public.data_request_workspace_v1(text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.data_request_workspace_v1(text,jsonb) TO authenticated;

-- At-most-once notification claim. Unknown provider outcomes require human review.
CREATE OR REPLACE FUNCTION data_request_private.admin_notification_v1(p_action text,p_request_id uuid,p_claim_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE v_token uuid; v_updated boolean;
BEGIN
  IF p_action = 'claim' THEN
    INSERT INTO data_request_private.admin_notifications(request_id)
      VALUES(p_request_id) ON CONFLICT(request_id) DO NOTHING RETURNING claim_token INTO v_token;
    RETURN CASE WHEN v_token IS NULL THEN jsonb_build_object('claimed',false)
      ELSE jsonb_build_object('claimed',true,'claim_token',v_token) END;
  ELSIF p_action IN ('finish_sent','finish_failed') THEN
    UPDATE data_request_private.admin_notifications
      SET status=CASE WHEN p_action='finish_sent' THEN 'sent' ELSE 'failed' END,finished_at=statement_timestamp()
      WHERE request_id=p_request_id AND claim_token=p_claim_token AND status='claimed';
    v_updated := FOUND;
    RETURN jsonb_build_object('recorded',v_updated);
  END IF;
  RAISE EXCEPTION 'data_request_unknown_notification_action' USING ERRCODE='22023';
END;
$function$;
REVOKE ALL ON FUNCTION data_request_private.admin_notification_v1(text,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION data_request_private.admin_notification_v1(text,uuid,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.data_request_admin_notification_v1(p_action text,p_request_id uuid,p_claim_token uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $function$
  SELECT data_request_private.admin_notification_v1(p_action,p_request_id,p_claim_token);
$function$;
REVOKE ALL ON FUNCTION public.data_request_admin_notification_v1(text,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.data_request_admin_notification_v1(text,uuid,uuid) TO service_role;

COMMENT ON FUNCTION public.data_request_workspace_v1(text,jsonb) IS
  'Own-account request receipts and limited account export. Not a complete Article 15 response.';
COMMENT ON SCHEMA data_request_private IS
  'Unexposed implementation schema for scoped data-request functions. Do not expose via Data API.';
NOTIFY pgrst, 'reload schema';
COMMIT;

