-- P0 — Employee portal can mark budget reservation as durchgefuehrt on assignment finalize.
-- Root cause: client_budget_transactions write RLS requires clients.budgets.edit (office only).

CREATE OR REPLACE FUNCTION public.mark_assist_visit_budget_executed(
  p_tenant_id         UUID,
  p_visit_id          UUID,
  p_actor_employee_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER := 0;
  v_employee_id UUID;
BEGIN
  IF p_tenant_id IS NULL OR p_visit_id IS NULL THEN
    RAISE EXCEPTION 'mark_assist_visit_budget_executed: missing required parameters';
  END IF;

  IF p_tenant_id IS DISTINCT FROM public.current_tenant_id() THEN
    RAISE EXCEPTION 'mark_assist_visit_budget_executed: tenant mismatch';
  END IF;

  IF public.is_employee_portal_rls_context(p_tenant_id) THEN
    v_employee_id := public.resolve_current_employee_id();
    IF v_employee_id IS NULL THEN
      RAISE EXCEPTION 'mark_assist_visit_budget_executed: employee portal context without employee link';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.assignments a
      WHERE a.tenant_id = p_tenant_id
        AND a.id = p_visit_id
        AND a.employee_id = v_employee_id
    ) AND NOT EXISTS (
      SELECT 1
      FROM public.assist_visits av
      WHERE av.tenant_id = p_tenant_id
        AND av.id = p_visit_id
        AND av.employee_id = v_employee_id
    ) THEN
      RAISE EXCEPTION 'mark_assist_visit_budget_executed: assignment not assigned to current employee';
    END IF;
  ELSIF NOT (
    public.has_permission('clients.budgets.edit')
    OR public.has_permission('clients.billing_profile.edit')
    OR public.has_permission('office.clients.edit')
  ) THEN
    RAISE EXCEPTION 'mark_assist_visit_budget_executed: insufficient permissions';
  END IF;

  UPDATE public.client_budget_transactions
  SET lifecycle_status = 'durchgefuehrt'
  WHERE tenant_id = p_tenant_id
    AND reference_type = 'assist_visit'
    AND reference_id = p_visit_id
    AND transaction_type = 'reservation'
    AND (
      lifecycle_status IS NULL
      OR lifecycle_status IN ('geplant', 'durchgefuehrt')
    );

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated > 0 THEN
    UPDATE public.assist_visits
    SET
      billing_status = CASE
        WHEN billing_status IN ('none', 'preview') THEN 'reserved'
        ELSE billing_status
      END,
      updated_at = NOW()
    WHERE tenant_id = p_tenant_id
      AND (id = p_visit_id OR legacy_assignment_id = p_visit_id);
  END IF;

  RETURN v_updated;
END;
$$;

COMMENT ON FUNCTION public.mark_assist_visit_budget_executed(UUID, UUID, UUID) IS
  'P0 — Idempotent budget reservation lifecycle → durchgefuehrt after portal assignment finalize.';

GRANT EXECUTE ON FUNCTION public.mark_assist_visit_budget_executed(UUID, UUID, UUID) TO authenticated;
