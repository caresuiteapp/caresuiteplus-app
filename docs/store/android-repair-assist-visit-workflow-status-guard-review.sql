-- REVIEW ONLY, NOT APPLIED. Read-only Production catalog captured 2026-10-26.
-- Narrow authorization repair; no business rows, RLS policies, triggers, proof
-- attestations or historical workflow drafts are activated here.
-- Original pg_get_functiondef SHA-256: 78dce54682adb1a1037b8f3eb7943b06e7f623d2b40e5a297232c04743725278
-- Existing function signature, runtime body and ACL stay in place except the
-- explicitly scoped actor/tenant checks below. Changed source aborts this file.
BEGIN;
DO $review$
BEGIN
 IF encode(sha256(convert_to(pg_get_functiondef('public.repair_assist_visit_workflow_status(uuid,uuid,text,text,uuid,boolean)'::regprocedure),'UTF8')),'hex')
    IS DISTINCT FROM '78dce54682adb1a1037b8f3eb7943b06e7f623d2b40e5a297232c04743725278' THEN
   RAISE EXCEPTION 'Reviewed function source changed: repair_assist_visit_workflow_status' USING ERRCODE='55000';
 END IF;
END;
$review$;
CREATE OR REPLACE FUNCTION public.repair_assist_visit_workflow_status(p_tenant_id uuid, p_assignment_id uuid, p_target_status text, p_reason text DEFAULT 'workflow_repair'::text, p_actor_employee_id uuid DEFAULT NULL::uuid, p_allow_service_without_timestamp boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_status           RECORD;
  v_from_status      TEXT;
  v_visit_id         UUID;
  v_service_started  TIMESTAMPTZ;
  v_execution_status TEXT;
  v_actor_profile_id UUID;
  v_actor_name       TEXT;
  v_session_tenant   UUID := public.current_tenant_id();
  v_own_employee     UUID := public.resolve_current_employee_id();
  v_employee_portal  BOOLEAN := COALESCE(public.current_portal_type()='employee', FALSE);
  v_bound_profile    UUID;
  v_bound_employee   UUID;
  v_trusted_service  BOOLEAN := COALESCE(auth.jwt()->>'role','')='service_role';
BEGIN
  -- Existing service_role EXECUTE remains a trusted machine path. This is the
  -- verified top-level JWT role, never user_metadata or an actor argument.
  IF NOT v_trusted_service THEN
  -- The endpoint runs as DEFINER: table RLS cannot authorize these writes.
  IF auth.uid() IS NULL OR v_session_tenant IS NULL
     OR p_tenant_id IS DISTINCT FROM v_session_tenant THEN
    RAISE EXCEPTION 'Anmeldung und aktueller Sitzungsmandant erforderlich.' USING ERRCODE='42501';
  END IF;
  BEGIN
    SELECT p.id INTO STRICT v_bound_profile FROM public.profiles p
    WHERE p.tenant_id=v_session_tenant AND p.status::text='active' AND p.is_active IS TRUE
      AND (p.auth_user_id=auth.uid() OR (p.auth_user_id IS NULL AND p.id=auth.uid()))
      AND NOT EXISTS (SELECT 1 FROM public.tenant_users u
        WHERE u.tenant_id=p.tenant_id AND u.auth_user_id=auth.uid()
          AND (u.status::text<>'active' OR u.must_change_password OR NOT u.first_login_completed));
  EXCEPTION WHEN NO_DATA_FOUND OR TOO_MANY_ROWS THEN
    RAISE EXCEPTION 'Ein eindeutig zugeordnetes aktives Authprofil ist erforderlich.' USING ERRCODE='42501';
  END;
  IF v_employee_portal THEN
    IF v_own_employee IS NULL OR COALESCE(p_allow_service_without_timestamp,FALSE)
       OR NOT EXISTS (SELECT 1 FROM public.employee_portal_accounts e
         WHERE e.id=public.current_portal_account_id() AND e.auth_user_id=auth.uid()
           AND e.tenant_id=v_session_tenant AND e.employee_id=v_own_employee AND e.status='active'
           AND e.must_change_password IS FALSE AND e.first_login_completed IS TRUE)
       OR NOT EXISTS (SELECT 1 FROM public.employees e
         WHERE e.tenant_id=v_session_tenant AND e.id=v_own_employee
           AND e.deleted_at IS NULL AND e.portal_enabled IS TRUE) THEN
      RAISE EXCEPTION 'Aktive eigene Mitarbeitendenzuordnung erforderlich.' USING ERRCODE='42501';
    END IF;
  ELSIF COALESCE(public.current_portal_type(),'business')<>'business'
     OR NOT COALESCE(public.is_internal_tenant_actor(v_session_tenant),FALSE)
     OR NOT COALESCE(care_security.company_actor(v_session_tenant,'assist.execution.manage'),FALSE) THEN
    RAISE EXCEPTION 'Keine Berechtigung zur Einsatzreparatur.' USING ERRCODE='42501';
  END IF;
  SELECT a.employee_id INTO v_bound_employee FROM public.assignments a
  WHERE a.tenant_id=v_session_tenant AND a.id=p_assignment_id FOR UPDATE;
  IF NOT FOUND OR (v_employee_portal AND v_bound_employee IS DISTINCT FROM v_own_employee)
     OR (p_actor_employee_id IS NOT NULL AND p_actor_employee_id IS DISTINCT FROM v_bound_profile
       AND p_actor_employee_id IS DISTINCT FROM v_bound_employee)
     OR (v_employee_portal AND EXISTS (SELECT 1 FROM public.assist_visits av
       WHERE av.tenant_id=v_session_tenant AND (av.legacy_assignment_id=p_assignment_id OR av.id=p_assignment_id)
         AND av.employee_id IS DISTINCT FROM v_own_employee)) THEN
    RAISE EXCEPTION 'Einsatz oder Akteur ist nicht Ihrem Zugang zugeordnet.' USING ERRCODE='42501';
  END IF;
  -- Existing callers send either their profile ID or legacy employee ID.
  -- Keep that API compatible; the stored audit actor always comes from Auth.
  p_actor_employee_id := v_bound_profile;
  END IF;
  IF p_tenant_id IS NULL OR p_assignment_id IS NULL OR p_target_status IS NULL THEN
    RAISE EXCEPTION 'repair_assist_visit_workflow_status: missing required parameters';
  END IF;

  SELECT a.status::TEXT
  INTO v_from_status
  FROM public.assignments a
  WHERE a.tenant_id = p_tenant_id
    AND a.id = p_assignment_id;

  IF v_from_status IS NULL THEN
    RAISE EXCEPTION 'Assignment not found';
  END IF;

  SELECT *
  INTO v_status
  FROM public.normalize_assist_workflow_repair_status(p_target_status);

  IF v_status.is_in_service AND NOT p_allow_service_without_timestamp THEN
    SELECT av.id, es.service_started_at
    INTO v_visit_id, v_service_started
    FROM public.assist_visits av
    LEFT JOIN public.assist_visit_execution_state es
      ON es.tenant_id = av.tenant_id AND es.visit_id = av.id
    WHERE av.tenant_id = p_tenant_id
      AND (av.legacy_assignment_id = p_assignment_id OR av.id = p_assignment_id)
    ORDER BY av.created_at DESC
    LIMIT 1;

    IF v_service_started IS NULL THEN
      RAISE EXCEPTION
        'Cannot repair to in-service status (%) without service_started_at; set p_allow_service_without_timestamp for explicit admin time correction',
        p_target_status;
    END IF;
  END IF;

  v_execution_status := CASE v_status.german_status
    WHEN 'unterwegs' THEN 'on_way'
    WHEN 'angekommen' THEN 'arrived'
    WHEN 'gestartet' THEN 'in_progress'
    WHEN 'pausiert' THEN 'paused'
    WHEN 'beendet' THEN 'completed'
    WHEN 'dokumentation_offen' THEN 'completed'
    WHEN 'unterschrift_offen' THEN 'completed'
    WHEN 'abgeschlossen' THEN 'completed'
    WHEN 'nicht_erschienen' THEN 'no_show'
    WHEN 'storniert' THEN 'cancelled'
    ELSE 'pending'
  END;

  v_actor_profile_id := NULL;
  IF p_actor_employee_id IS NOT NULL THEN
    SELECT p.id, COALESCE(NULLIF(trim(p.display_name), ''), NULLIF(trim(p.full_name), ''), 'Portal')
    INTO v_actor_profile_id, v_actor_name
    FROM public.profiles p
    WHERE p.id = p_actor_employee_id;
  END IF;

  IF v_actor_name IS NULL THEN
    v_actor_name := CASE
      WHEN p_reason = 'portal_execution_status_mirror' THEN 'Portal Mirror'
      ELSE 'Workflow Repair'
    END;
  END IF;

  IF v_from_status IS DISTINCT FROM v_status.visit_status THEN
    UPDATE public.assignments
    SET
      status     = v_status.assignment_enum,
      updated_at = NOW(),
      updated_by = v_actor_profile_id
    WHERE tenant_id = p_tenant_id
      AND id = p_assignment_id;
  END IF;

  UPDATE public.assist_visits
  SET
    execution_status = v_execution_status,
    canonical_status = v_status.visit_status,
    updated_at       = NOW(),
    updated_by       = v_actor_profile_id
  WHERE tenant_id = p_tenant_id
    AND (legacy_assignment_id = p_assignment_id OR id = p_assignment_id);

  UPDATE public.assist_visit_execution_state es
  SET
    assignment_status           = v_status.german_status,
    workflow_consistency_status = 'consistent',
    last_auto_repair_at         = NOW(),
    last_repair_reason          = p_reason,
    updated_at                  = NOW()
  FROM public.assist_visits av
  WHERE av.tenant_id = p_tenant_id
    AND (av.legacy_assignment_id = p_assignment_id OR av.id = p_assignment_id)
    AND es.tenant_id = av.tenant_id
    AND es.visit_id = av.id;

  INSERT INTO public.assignment_audit_events (
    tenant_id,
    assignment_id,
    action,
    actor_profile_id,
    actor_name,
    from_status,
    to_status,
    details,
    created_at
  )
  VALUES (
    p_tenant_id,
    p_assignment_id,
    'workflow_repair',
    v_actor_profile_id,
    v_actor_name,
    v_from_status,
    v_status.visit_status,
    p_reason,
    NOW()
  );
END;
$function$;
COMMIT;
