-- ==========================================================================
-- CareSuite HealthOS — Einsatzplanung und Budgetanzeige konsistent halten
-- ==========================================================================
-- Beim physischen Löschen eines Einsatzes muss die zugehörige Planung in
-- client_budget_accounts in derselben Datenbanktransaktion entfernt werden.
-- Andernfalls bleibt der Betrag "Einsätze geplant" sichtbar, obwohl der
-- Einsatz nicht mehr existiert.

CREATE OR REPLACE FUNCTION public.delete_assist_visit(
  p_tenant_id UUID,
  p_visit_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_visit public.assist_visits%ROWTYPE;
  v_legacy_assignment_id UUID;
  v_deleted_visit_id UUID;
  v_reservation RECORD;
  v_balance_after BIGINT;
  v_released_reservations INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Anmeldung erforderlich.';
  END IF;

  IF p_tenant_id IS NULL OR p_visit_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22004',
      MESSAGE = 'Mandant und Einsatz müssen angegeben werden.';
  END IF;

  IF NOT public.is_tenant_member(p_tenant_id) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Keine Berechtigung für diesen Mandanten.';
  END IF;

  SELECT *
    INTO v_visit
    FROM public.assist_visits
   WHERE tenant_id = p_tenant_id
     AND id = p_visit_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0002',
      MESSAGE = 'Einsatz nicht gefunden.';
  END IF;

  v_legacy_assignment_id := v_visit.legacy_assignment_id;

  FOR v_reservation IN
    SELECT tx.*
      FROM public.client_budget_transactions tx
     WHERE tx.tenant_id = p_tenant_id
       AND tx.reference_type = 'assist_visit'
       AND tx.reference_id = p_visit_id
       AND tx.transaction_type = 'reservation'
       AND COALESCE(tx.lifecycle_status, 'geplant') IN ('geplant', 'durchgefuehrt')
     FOR UPDATE
  LOOP
    IF COALESCE(v_reservation.lifecycle_status, 'geplant') = 'durchgefuehrt' THEN
      UPDATE public.client_budget_accounts
         SET used_cents = GREATEST(0, used_cents - v_reservation.amount_cents),
             updated_at = NOW()
       WHERE tenant_id = p_tenant_id
         AND id = v_reservation.budget_account_id
      RETURNING allocated_cents - used_cents - reserved_cents INTO v_balance_after;
    ELSE
      UPDATE public.client_budget_accounts
         SET reserved_cents = GREATEST(0, reserved_cents - v_reservation.amount_cents),
             updated_at = NOW()
       WHERE tenant_id = p_tenant_id
         AND id = v_reservation.budget_account_id
      RETURNING allocated_cents - used_cents - reserved_cents INTO v_balance_after;
    END IF;

    UPDATE public.client_budget_transactions
       SET lifecycle_status = 'storniert',
           note = COALESCE(note, '') ||
             CASE WHEN COALESCE(note, '') = '' THEN '' ELSE ' · ' END ||
             'Einsatz aus Einsatzplanung gelöscht'
     WHERE id = v_reservation.id;

    INSERT INTO public.client_budget_transactions (
      tenant_id,
      client_id,
      budget_account_id,
      transaction_type,
      amount_cents,
      balance_after_cents,
      reference_type,
      reference_id,
      lifecycle_status,
      note,
      created_by
    ) VALUES (
      p_tenant_id,
      v_reservation.client_id,
      v_reservation.budget_account_id,
      'release',
      v_reservation.amount_cents,
      v_balance_after,
      'assist_visit',
      p_visit_id,
      'storniert',
      'Planbetrag durch Löschen des Einsatzes freigegeben',
      NULL
    );

    v_released_reservations := v_released_reservations + 1;
  END LOOP;

  UPDATE public.assignment_budget_allocations
     SET allocation_status = 'released',
         reserved_amount_cents = 0,
         updated_at = NOW()
   WHERE tenant_id = p_tenant_id
     AND assignment_id = p_visit_id
     AND allocation_status IN ('planned', 'reserved', 'executed');

  DELETE FROM public.assist_visits
   WHERE tenant_id = p_tenant_id
     AND id = p_visit_id
  RETURNING id INTO v_deleted_visit_id;

  IF v_deleted_visit_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0002',
      MESSAGE = 'Einsatz konnte nicht gelöscht werden.';
  END IF;

  IF v_legacy_assignment_id IS NOT NULL THEN
    DELETE FROM public.assignments
     WHERE tenant_id = p_tenant_id
       AND id = v_legacy_assignment_id;
  END IF;

  RETURN jsonb_build_object(
    'deleted', TRUE,
    'visitId', v_deleted_visit_id,
    'legacyAssignmentId', v_legacy_assignment_id,
    'budgetReservationsReleased', v_released_reservations
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_assist_visit(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_assist_visit(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.delete_assist_visit(UUID, UUID) IS
  'Löscht einen Assist-Einsatz samt Legacy-Datensatz und gibt geplante Budgetbeträge atomar frei.';
