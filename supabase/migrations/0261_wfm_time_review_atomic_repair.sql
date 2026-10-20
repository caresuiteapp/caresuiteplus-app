-- CareSuite+ WFM: atomare Arbeitszeitprüfung und kanonische Mitarbeiter-ID.
-- Behebt FK-Fehler bei Legacy-IDs sowie Teilfehler zwischen Review und Historie.

CREATE OR REPLACE FUNCTION public.wfm_upsert_time_review(
  p_tenant_id UUID,
  p_employee_candidate_id UUID,
  p_work_date DATE,
  p_entry_kind TEXT,
  p_reference_id UUID,
  p_reference_key TEXT,
  p_review_status TEXT,
  p_export_blocking BOOLEAN,
  p_review_note TEXT DEFAULT NULL,
  p_office_comment TEXT DEFAULT NULL,
  p_action_comment TEXT DEFAULT NULL
)
RETURNS SETOF public.workforce_time_entry_reviews
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_employee_id UUID;
  v_previous_status TEXT;
  v_review public.workforce_time_entry_reviews%ROWTYPE;
  v_action TEXT;
  v_is_decision BOOLEAN;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Anmeldung erforderlich' USING ERRCODE = '42501';
  END IF;

  IF p_tenant_id IS DISTINCT FROM public.current_tenant_id() THEN
    RAISE EXCEPTION 'Mandant stimmt nicht mit der Anmeldung überein' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    public.has_permission('time.tracking.admin.correct')
    OR public.is_tenant_admin()
  ) THEN
    RAISE EXCEPTION 'Keine Berechtigung für Arbeitszeitprüfungen' USING ERRCODE = '42501';
  END IF;

  IF p_entry_kind NOT IN ('session', 'visit', 'manual', 'meeting') THEN
    RAISE EXCEPTION 'Ungültige Art des Arbeitszeiteintrags' USING ERRCODE = '22023';
  END IF;

  IF p_review_status NOT IN (
    'open', 'pending_review', 'needs_clarification', 'approved',
    'rejected', 'corrected', 'locked', 'superseded'
  ) THEN
    RAISE EXCEPTION 'Ungültiger Prüfstatus' USING ERRCODE = '22023';
  END IF;

  -- 1. Bereits kanonische employees.id.
  SELECT e.id
    INTO v_employee_id
    FROM public.employees e
   WHERE e.tenant_id = p_tenant_id
     AND e.id = p_employee_candidate_id
   LIMIT 1;

  -- 2. Historische profile/auth-ID.
  IF v_employee_id IS NULL THEN
    SELECT e.id
      INTO v_employee_id
      FROM public.employees e
     WHERE e.tenant_id = p_tenant_id
       AND e.profile_id = p_employee_candidate_id
     ORDER BY e.created_at DESC NULLS LAST
     LIMIT 1;
  END IF;

  -- 3. Geplanter/ausgeführter Einsatz ist die autoritative Zuordnung.
  IF v_employee_id IS NULL AND p_entry_kind = 'visit' THEN
    SELECT a.employee_id
      INTO v_employee_id
      FROM public.assignments a
     WHERE a.tenant_id = p_tenant_id
       AND a.id = p_reference_id
       AND a.employee_id IS NOT NULL
     LIMIT 1;
  END IF;

  -- 4. Workforce-Session ist die autoritative Zuordnung.
  IF v_employee_id IS NULL
     AND p_entry_kind = 'session'
     AND to_regclass('public.workforce_work_sessions') IS NOT NULL THEN
    EXECUTE
      'SELECT employee_id FROM public.workforce_work_sessions '
      'WHERE tenant_id = $1 AND id = $2 LIMIT 1'
      INTO v_employee_id
      USING p_tenant_id, p_reference_id;
  END IF;

  -- 5. Portalzuordnung als letzter Legacy-Fallback (SECURITY DEFINER).
  IF v_employee_id IS NULL AND to_regclass('public.employee_portal_accounts') IS NOT NULL THEN
    SELECT epa.employee_id
      INTO v_employee_id
      FROM public.employee_portal_accounts epa
     WHERE epa.tenant_id = p_tenant_id
       AND (
         epa.id = p_employee_candidate_id
         OR epa.employee_id = p_employee_candidate_id
         OR epa.auth_user_id = p_employee_candidate_id
       )
       AND COALESCE(epa.status, 'active') NOT IN ('blocked', 'archived')
       AND epa.blocked_at IS NULL
     LIMIT 1;
  END IF;

  IF v_employee_id IS NULL OR NOT EXISTS (
    SELECT 1
      FROM public.employees e
     WHERE e.id = v_employee_id
       AND e.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION
      'Arbeitszeiteintrag ist keinem gültigen Mitarbeiterprofil zugeordnet'
      USING ERRCODE = '23503';
  END IF;

  SELECT r.review_status
    INTO v_previous_status
    FROM public.workforce_time_entry_reviews r
   WHERE r.tenant_id = p_tenant_id
     AND r.reference_key = p_reference_key
   FOR UPDATE;

  IF v_previous_status IN ('locked', 'superseded') AND p_review_status <> 'open' THEN
    RAISE EXCEPTION 'Gesperrte Prüfung muss zuerst wieder geöffnet werden' USING ERRCODE = '55000';
  END IF;

  v_is_decision := p_review_status IN (
    'approved', 'rejected', 'needs_clarification', 'corrected', 'locked'
  );

  INSERT INTO public.workforce_time_entry_reviews (
    tenant_id, employee_id, work_date, entry_kind, reference_id, reference_key,
    review_status, export_blocking, review_note, office_comment,
    reviewed_at, reviewed_by, metadata
  ) VALUES (
    p_tenant_id, v_employee_id, p_work_date, p_entry_kind, p_reference_id, p_reference_key,
    p_review_status, p_export_blocking, p_review_note, p_office_comment,
    CASE WHEN v_is_decision THEN NOW() ELSE NULL END,
    CASE WHEN v_is_decision THEN v_actor_id ELSE NULL END,
    jsonb_build_object('source', 'wfm_atomic_review_v261')
  )
  ON CONFLICT ON CONSTRAINT workforce_time_entry_reviews_tenant_reference_key_unique
  DO UPDATE SET
    employee_id = EXCLUDED.employee_id,
    work_date = EXCLUDED.work_date,
    entry_kind = EXCLUDED.entry_kind,
    reference_id = EXCLUDED.reference_id,
    review_status = EXCLUDED.review_status,
    export_blocking = EXCLUDED.export_blocking,
    review_note = COALESCE(EXCLUDED.review_note, workforce_time_entry_reviews.review_note),
    office_comment = COALESCE(EXCLUDED.office_comment, workforce_time_entry_reviews.office_comment),
    reviewed_at = CASE
      WHEN v_is_decision THEN NOW()
      ELSE workforce_time_entry_reviews.reviewed_at
    END,
    reviewed_by = CASE
      WHEN v_is_decision THEN v_actor_id
      ELSE workforce_time_entry_reviews.reviewed_by
    END,
    metadata = COALESCE(workforce_time_entry_reviews.metadata, '{}'::jsonb)
      || jsonb_build_object('source', 'wfm_atomic_review_v261')
  RETURNING * INTO v_review;

  v_action := CASE
    WHEN v_previous_status IS NULL THEN 'created'
    WHEN p_review_status = 'approved' THEN 'review_approved'
    WHEN p_review_status = 'rejected' THEN 'review_rejected'
    WHEN p_review_status = 'corrected' THEN 'review_corrected'
    WHEN p_review_status = 'needs_clarification' THEN 'clarification_requested'
    WHEN p_review_status = 'locked' THEN 'locked'
    WHEN p_review_status = 'superseded' THEN 'superseded'
    WHEN p_review_status = 'open' AND v_previous_status <> 'open' THEN 'review_reopened'
    ELSE 'status_changed'
  END;

  INSERT INTO public.workforce_time_review_actions (
    tenant_id, entry_review_id, action, prev_status, new_status,
    comment, actor_id, source, metadata
  ) VALUES (
    p_tenant_id, v_review.id, v_action, v_previous_status, p_review_status,
    p_action_comment, v_actor_id, 'office',
    jsonb_build_object('source', 'wfm_atomic_review_v261')
  );

  RETURN NEXT v_review;
END;
$$;

REVOKE ALL ON FUNCTION public.wfm_upsert_time_review(
  UUID, UUID, DATE, TEXT, UUID, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.wfm_upsert_time_review(
  UUID, UUID, DATE, TEXT, UUID, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT
) TO authenticated;

COMMENT ON FUNCTION public.wfm_upsert_time_review(
  UUID, UUID, DATE, TEXT, UUID, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT
) IS 'Atomare Office-Arbeitszeitprüfung: kanonisiert employee_id und schreibt Review plus Historie in einer Transaktion.';
