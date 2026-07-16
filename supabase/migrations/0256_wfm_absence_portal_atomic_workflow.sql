-- WFM Urlaub/Abwesenheit: mandantensicherer Portalzugriff für Mehrrollen-Konten.
-- Antrag + Genehmigung sowie Rückzug werden jeweils atomar ausgeführt.

CREATE OR REPLACE FUNCTION public.resolve_employee_id_for_tenant(p_tenant_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT epa.employee_id
      FROM public.employee_portal_accounts epa
      WHERE epa.auth_user_id = auth.uid()
        AND epa.tenant_id = p_tenant_id
        AND epa.status IN ('active', 'pending_first_login')
        AND epa.blocked_at IS NULL
      LIMIT 1
    ),
    (
      SELECT e.id
      FROM public.employees e
      JOIN public.profiles p ON p.id = e.profile_id
      WHERE e.tenant_id = p_tenant_id
        AND (p.id = auth.uid() OR p.auth_user_id = auth.uid())
      LIMIT 1
    )
  );
$$;

REVOKE ALL ON FUNCTION public.resolve_employee_id_for_tenant(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_employee_id_for_tenant(UUID) TO authenticated;

DROP POLICY IF EXISTS wfm_absences_select ON public.workforce_absences;
CREATE POLICY wfm_absences_select ON public.workforce_absences
  FOR SELECT TO authenticated
  USING (
    (
      public.is_active_employee_portal_actor(tenant_id)
      AND employee_id = public.resolve_employee_id_for_tenant(tenant_id)
    )
    OR (
      tenant_id = public.current_tenant_id()
      AND (
        public.has_permission('office.employees.absences.view')
        OR public.has_permission('office.employees.absences.manage')
        OR public.has_permission('office.employees.absences.approve')
        OR public.is_tenant_admin()
      )
    )
  );

DROP POLICY IF EXISTS wfm_absences_insert ON public.workforce_absences;
CREATE POLICY wfm_absences_insert ON public.workforce_absences
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      public.is_active_employee_portal_actor(tenant_id)
      AND employee_id = public.resolve_employee_id_for_tenant(tenant_id)
    )
    OR (
      tenant_id = public.current_tenant_id()
      AND (
        public.has_permission('office.employees.absences.manage')
        OR public.is_tenant_admin()
      )
    )
  );

DROP POLICY IF EXISTS wfm_absences_update ON public.workforce_absences;
CREATE POLICY wfm_absences_update ON public.workforce_absences
  FOR UPDATE TO authenticated
  USING (
    (
      public.is_active_employee_portal_actor(tenant_id)
      AND employee_id = public.resolve_employee_id_for_tenant(tenant_id)
      AND status = 'requested'
    )
    OR (
      tenant_id = public.current_tenant_id()
      AND (
        public.has_permission('office.employees.absences.manage')
        OR public.has_permission('office.employees.absences.approve')
        OR public.is_tenant_admin()
      )
    )
  )
  WITH CHECK (
    (
      public.is_active_employee_portal_actor(tenant_id)
      AND employee_id = public.resolve_employee_id_for_tenant(tenant_id)
      AND status = 'cancelled'
    )
    OR (
      tenant_id = public.current_tenant_id()
      AND (
        public.has_permission('office.employees.absences.manage')
        OR public.has_permission('office.employees.absences.approve')
        OR public.is_tenant_admin()
      )
    )
  );

DROP POLICY IF EXISTS wfm_approvals_insert ON public.workforce_approvals;
CREATE POLICY wfm_approvals_insert ON public.workforce_approvals
  FOR INSERT TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    AND (
      (
        public.is_active_employee_portal_actor(tenant_id)
        AND employee_id = public.resolve_employee_id_for_tenant(tenant_id)
      )
      OR (
        tenant_id = public.current_tenant_id()
        AND (
          public.has_permission('office.employees.absences.manage')
          OR public.is_tenant_admin()
        )
      )
    )
  );

DROP POLICY IF EXISTS wfm_approvals_select ON public.workforce_approvals;
CREATE POLICY wfm_approvals_select ON public.workforce_approvals
  FOR SELECT TO authenticated
  USING (
    (
      public.is_active_employee_portal_actor(tenant_id)
      AND employee_id = public.resolve_employee_id_for_tenant(tenant_id)
    )
    OR (
      tenant_id = public.current_tenant_id()
      AND (
        requested_by = auth.uid()
        OR public.has_permission('office.employees.absences.approve')
        OR public.has_permission('time.tracking.admin.view')
        OR public.is_tenant_admin()
      )
    )
  );

CREATE OR REPLACE FUNCTION public.employee_portal_request_wfm_absence(
  p_tenant_id UUID,
  p_absence_type TEXT,
  p_starts_at TIMESTAMPTZ,
  p_ends_at TIMESTAMPTZ,
  p_all_day BOOLEAN DEFAULT TRUE,
  p_requested_days NUMERIC DEFAULT NULL,
  p_employee_note TEXT DEFAULT ''
)
RETURNS SETOF public.workforce_absences
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_id UUID;
  v_absence public.workforce_absences;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Nicht angemeldet.' USING ERRCODE = '42501';
  END IF;
  IF p_tenant_id IS NULL OR p_starts_at IS NULL OR p_ends_at IS NULL OR p_ends_at < p_starts_at THEN
    RAISE EXCEPTION 'Ungültiger Abwesenheitszeitraum.' USING ERRCODE = '22023';
  END IF;

  v_employee_id := public.resolve_employee_id_for_tenant(p_tenant_id);
  IF v_employee_id IS NULL OR NOT public.is_active_employee_portal_actor(p_tenant_id) THEN
    RAISE EXCEPTION 'Portalzugang ist keinem aktiven Mitarbeitenden zugeordnet.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.workforce_absences (
    tenant_id, employee_id, absence_type, status, starts_at, ends_at,
    all_day, requested_days, employee_note, internal_note, created_by
  ) VALUES (
    p_tenant_id, v_employee_id, p_absence_type, 'requested', p_starts_at, p_ends_at,
    COALESCE(p_all_day, TRUE), p_requested_days, COALESCE(p_employee_note, ''), '', auth.uid()
  ) RETURNING * INTO v_absence;

  INSERT INTO public.workforce_approvals (
    tenant_id, employee_id, approval_type, status, reference_type,
    reference_id, requested_by, payload
  ) VALUES (
    p_tenant_id,
    v_employee_id,
    CASE WHEN p_absence_type = 'vacation' THEN 'vacation' ELSE 'absence' END,
    'pending',
    'workforce_absence',
    v_absence.id,
    auth.uid(),
    jsonb_build_object(
      'absenceType', p_absence_type,
      'startsAt', p_starts_at,
      'endsAt', p_ends_at
    )
  );

  RETURN NEXT v_absence;
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.employee_portal_withdraw_wfm_absence(
  p_tenant_id UUID,
  p_absence_id UUID
)
RETURNS SETOF public.workforce_absences
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_id UUID;
  v_absence public.workforce_absences;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Nicht angemeldet.' USING ERRCODE = '42501';
  END IF;
  v_employee_id := public.resolve_employee_id_for_tenant(p_tenant_id);
  IF v_employee_id IS NULL OR NOT public.is_active_employee_portal_actor(p_tenant_id) THEN
    RAISE EXCEPTION 'Portalzugang ist keinem aktiven Mitarbeitenden zugeordnet.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.workforce_absences
  SET status = 'cancelled', updated_at = NOW()
  WHERE id = p_absence_id
    AND tenant_id = p_tenant_id
    AND employee_id = v_employee_id
    AND status = 'requested'
  RETURNING * INTO v_absence;

  IF v_absence.id IS NULL THEN
    RAISE EXCEPTION 'Antrag nicht gefunden oder bereits bearbeitet.' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.workforce_approvals
  SET status = 'cancelled', updated_at = NOW()
  WHERE tenant_id = p_tenant_id
    AND employee_id = v_employee_id
    AND reference_type = 'workforce_absence'
    AND reference_id = p_absence_id
    AND status = 'pending';

  RETURN NEXT v_absence;
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.employee_portal_request_wfm_absence(UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.employee_portal_request_wfm_absence(UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN, NUMERIC, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.employee_portal_withdraw_wfm_absence(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.employee_portal_withdraw_wfm_absence(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.employee_portal_request_wfm_absence(UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN, NUMERIC, TEXT) IS
  'Atomarer, mandantensicherer Urlaubs-/Abwesenheitsantrag für aktive Mitarbeitenden-Portale.';
COMMENT ON FUNCTION public.employee_portal_withdraw_wfm_absence(UUID, UUID) IS
  'Atomarer Rückzug eines eigenen, noch ausstehenden Urlaubs-/Abwesenheitsantrags.';
