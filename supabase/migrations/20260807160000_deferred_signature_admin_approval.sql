-- R17 — Employee deferred signature requests require an explicit administrative approval.
-- The employee can only create a tenant-scoped approval request. Portal publication remains
-- restricted to Assist administration and is performed only after approval.

ALTER TABLE public.assist_visit_signature_requests
  ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS request_reason text,
  ADD COLUMN IF NOT EXISTS decision_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS decision_at timestamptz,
  ADD COLUMN IF NOT EXISTS decision_reason text;

ALTER TABLE public.assist_visit_signature_requests
  DROP CONSTRAINT IF EXISTS assist_visit_signature_requests_status_check;
ALTER TABLE public.assist_visit_signature_requests
  ADD CONSTRAINT assist_visit_signature_requests_status_check
  CHECK (status IN (
    'pending_admin_approval', 'approved', 'rejected',
    'open', 'signed', 'revoked', 'expired'
  ));

DROP INDEX IF EXISTS public.assist_visit_signature_requests_one_open;
CREATE UNIQUE INDEX assist_visit_signature_requests_one_pending
  ON public.assist_visit_signature_requests(tenant_id, visit_id)
  WHERE status IN ('pending_admin_approval', 'open');

DROP POLICY IF EXISTS signature_requests_employee_own_select
  ON public.assist_visit_signature_requests;
CREATE POLICY signature_requests_employee_own_select
  ON public.assist_visit_signature_requests FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND employee_id = public.resolve_current_employee_id()
    AND status IN ('pending_admin_approval', 'approved', 'rejected')
  );

CREATE OR REPLACE FUNCTION public.employee_request_deferred_signature_admin_approval(
  p_tenant_id uuid,
  p_visit_id uuid,
  p_employee_id uuid,
  p_reason text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v public.assist_visits%ROWTYPE;
  v_current_employee uuid;
  v_request_id uuid;
  v_client_name text;
  v_employee_name text;
  v_documentation text;
BEGIN
  IF p_tenant_id IS DISTINCT FROM public.current_tenant_id() THEN
    RAISE EXCEPTION 'Mandantenzugriff verweigert';
  END IF;

  v_current_employee := public.resolve_current_employee_id();
  IF v_current_employee IS NULL OR v_current_employee IS DISTINCT FROM p_employee_id THEN
    RAISE EXCEPTION 'Mitarbeitenden-Zuordnung ungültig';
  END IF;
  IF length(trim(coalesce(p_reason, ''))) < 10 THEN
    RAISE EXCEPTION 'Bitte begründen Sie die Weiterleitung mit mindestens 10 Zeichen';
  END IF;

  SELECT * INTO v
    FROM public.assist_visits
   WHERE id = p_visit_id
     AND tenant_id = p_tenant_id
     AND employee_id = p_employee_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Einsatz nicht gefunden'; END IF;
  IF v.actual_end_at IS NULL THEN RAISE EXCEPTION 'Der Einsatz ist noch nicht beendet'; END IF;
  IF coalesce(v.documentation_status, '') <> 'complete' THEN
    RAISE EXCEPTION 'Dokumentation ist noch nicht vollständig';
  END IF;

  SELECT id INTO v_request_id
    FROM public.assist_visit_signature_requests
   WHERE tenant_id = p_tenant_id
     AND visit_id = p_visit_id
     AND status = 'pending_admin_approval';
  IF v_request_id IS NOT NULL THEN RETURN v_request_id; END IF;

  SELECT trim(concat_ws(' ', first_name, last_name)) INTO v_client_name
    FROM public.clients WHERE id = v.client_id AND tenant_id = p_tenant_id;
  SELECT trim(concat_ws(' ', first_name, last_name)) INTO v_employee_name
    FROM public.employees WHERE id = p_employee_id AND tenant_id = p_tenant_id;
  SELECT coalesce(nullif(trim(short_description), ''), nullif(trim(special_notes), ''))
    INTO v_documentation
    FROM public.assist_visit_documentation
   WHERE tenant_id = p_tenant_id AND visit_id = p_visit_id;

  INSERT INTO public.assist_visit_signature_requests(
    tenant_id, visit_id, client_id, employee_id, request_reason, status, service_date, service_name,
    planned_start_at, planned_end_at, actual_start_at, actual_end_at, proof_preview
  ) VALUES (
    p_tenant_id, p_visit_id, v.client_id, p_employee_id, trim(p_reason), 'pending_admin_approval',
    v.assignment_date, coalesce(nullif(v.service_name, ''), v.title),
    v.planned_start_at, v.planned_end_at, v.actual_start_at, v.actual_end_at,
    jsonb_build_object(
      'visit_id', v.id,
      'service_date', v.assignment_date,
      'service', coalesce(nullif(v.service_name, ''), v.title),
      'client_name', coalesce(nullif(v_client_name, ''), 'Klient:in'),
      'employee_name', coalesce(nullif(v_employee_name, ''), 'Mitarbeiter:in'),
      'request_reason', trim(p_reason),
      'planned_start_at', v.planned_start_at,
      'planned_end_at', v.planned_end_at,
      'actual_start_at', v.actual_start_at,
      'actual_end_at', v.actual_end_at,
      'documentation', coalesce(v_documentation, '')
    )
  ) RETURNING id INTO v_request_id;

  INSERT INTO public.assist_visit_admin_audit(tenant_id, visit_id, action, new_value, reason)
  VALUES (
    p_tenant_id, p_visit_id, 'deferred_signature_approval_requested',
    jsonb_build_object('request_id', v_request_id, 'employee_id', p_employee_id),
    'Mitarbeitende Person beantragt Portal-Unterschrift'
  );
  RETURN v_request_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_decide_deferred_signature_approval(
  p_request_id uuid,
  p_decision text,
  p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.assist_visit_signature_requests%ROWTYPE;
  v_profile_id uuid;
  v_status text;
BEGIN
  IF NOT public.has_permission('assist.execution.manage') THEN
    RAISE EXCEPTION 'Keine Berechtigung';
  END IF;
  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Ungültige Entscheidung';
  END IF;
  IF p_decision = 'rejected' AND length(trim(coalesce(p_reason, ''))) = 0 THEN
    RAISE EXCEPTION 'Bei Ablehnung ist eine Begründung erforderlich';
  END IF;

  SELECT * INTO r
    FROM public.assist_visit_signature_requests
   WHERE id = p_request_id AND tenant_id = public.current_tenant_id()
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Freigabeanfrage nicht gefunden'; END IF;
  IF r.status IN ('approved', 'rejected') THEN
    RETURN jsonb_build_object('request_id', r.id, 'visit_id', r.visit_id, 'status', r.status);
  END IF;
  IF r.status <> 'pending_admin_approval' THEN RAISE EXCEPTION 'Anfrage ist nicht entscheidbar'; END IF;

  IF p_decision = 'approved' AND NOT EXISTS (
    SELECT 1 FROM public.assist_visit_proofs p
     WHERE p.tenant_id = r.tenant_id AND p.visit_id = r.visit_id
       AND p.portal_visible = true
       AND p.portal_release_status = 'pending_client_signature'
  ) THEN
    RAISE EXCEPTION 'Portal-Veröffentlichung wurde noch nicht bestätigt';
  END IF;

  v_profile_id := public.resolve_current_profile_id();
  v_status := p_decision;
  UPDATE public.assist_visit_signature_requests
     SET status = v_status,
         decision_by_profile_id = v_profile_id,
         decision_at = now(),
         decision_reason = nullif(trim(coalesce(p_reason, '')), '')
   WHERE id = r.id;

  IF p_decision = 'approved' THEN
    UPDATE public.assist_visits
       SET execution_status = 'completed', canonical_status = 'completed',
           proof_status = 'pending', billing_status = 'blocked',
           finished_at = coalesce(finished_at, actual_end_at),
           updated_by = v_profile_id, updated_at = now()
     WHERE id = r.visit_id AND tenant_id = r.tenant_id;
    UPDATE public.assignments
       SET status = 'completed', updated_at = now()
     WHERE id = coalesce(
       (SELECT legacy_assignment_id FROM public.assist_visits
         WHERE id = r.visit_id AND tenant_id = r.tenant_id),
       r.visit_id
     ) AND tenant_id = r.tenant_id;
    UPDATE public.assist_visit_execution_state
       SET current_step = 'completed', assignment_status = 'abgeschlossen',
           documentation_complete = true, signature_complete = false,
           proof_generated = false, finalized_at = now(), updated_at = now(),
           metadata = metadata || jsonb_build_object('signature_deferred_to_client_portal', true)
     WHERE visit_id = r.visit_id AND tenant_id = r.tenant_id;
  END IF;

  INSERT INTO public.assist_visit_admin_audit(tenant_id, visit_id, action, previous_value, new_value, reason)
  VALUES (
    r.tenant_id, r.visit_id,
    CASE WHEN p_decision = 'approved'
      THEN 'deferred_signature_approval_approved'
      ELSE 'deferred_signature_approval_rejected' END,
    jsonb_build_object('status', r.status),
    jsonb_build_object('status', v_status, 'request_id', r.id),
    coalesce(nullif(trim(coalesce(p_reason, '')), ''), 'Durch Verwaltung genehmigt')
  );
  RETURN jsonb_build_object('request_id', r.id, 'visit_id', r.visit_id, 'status', v_status);
END $$;

-- Hard security boundary: employees cannot directly publish deferred signatures anymore.
DROP POLICY IF EXISTS client_documents_portal_employee_deferred_signature_insert ON public.client_documents;
DROP POLICY IF EXISTS client_documents_portal_employee_deferred_signature_update ON public.client_documents;
DROP POLICY IF EXISTS assist_visit_proofs_portal_employee_update ON public.assist_visit_proofs;
REVOKE EXECUTE ON FUNCTION public.employee_portal_upsert_deferred_signature_client_document(uuid,uuid,uuid,text,uuid)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.employee_request_deferred_signature_admin_approval(uuid,uuid,uuid,text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_decide_deferred_signature_approval(uuid,text,text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.employee_request_deferred_signature_admin_approval(uuid,uuid,uuid,text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_decide_deferred_signature_approval(uuid,text,text)
  TO authenticated;
