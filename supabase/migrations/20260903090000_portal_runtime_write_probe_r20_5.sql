-- R20.5: authenticated, rollback-only production probe for the two P0 portal writes.
-- The function performs the real permission checks and then rolls every test
-- mutation back inside a PL/pgSQL subtransaction. No chat, time event or status
-- change remains in production.

CREATE OR REPLACE FUNCTION public.portal_runtime_write_probe(
  p_capability TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id UUID := public.current_tenant_id();
  v_employee_id UUID := public.resolve_current_employee_id();
  v_portal_type TEXT := public.current_portal_type();
  v_audience TEXT;
  v_visit_id UUID;
  v_message_ok BOOLEAN := FALSE;
  v_workflow_ok BOOLEAN := FALSE;
  v_error TEXT;
  v_rows INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'Anmeldung erforderlich.');
  END IF;
  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'Mandant der Portalsitzung fehlt. Bitte erneut anmelden.');
  END IF;
  IF p_capability NOT IN ('messages', 'workflow') THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'Unbekannte Produktionsprüfung.');
  END IF;

  IF p_capability = 'messages' THEN
    v_audience := CASE v_portal_type
      WHEN 'employee' THEN 'employee'
      WHEN 'client' THEN 'client'
      ELSE NULL
    END;
    IF v_audience IS NULL THEN
      RETURN jsonb_build_object('ok', FALSE, 'error', 'Portaltyp der Sitzung ist nicht schreibberechtigt.');
    END IF;

    BEGIN
      PERFORM public.portal_create_office_thread(
        v_tenant_id,
        v_audience,
        '[Systemprüfung – wird nicht gespeichert]',
        NULL,
        'Automatische Schreibprüfung'
      );
      v_message_ok := TRUE;
      RAISE EXCEPTION '__CARESUITE_ROLLBACK_PROBE__';
    EXCEPTION
      WHEN RAISE_EXCEPTION THEN
        IF SQLERRM <> '__CARESUITE_ROLLBACK_PROBE__' THEN
          v_message_ok := FALSE;
          v_error := SQLERRM;
        END IF;
      WHEN OTHERS THEN
        v_message_ok := FALSE;
        v_error := SQLERRM;
    END;

    RETURN jsonb_build_object(
      'ok', v_message_ok,
      'capability', 'messages',
      'error', CASE WHEN v_message_ok THEN NULL ELSE COALESCE(v_error, 'Nachrichten-Schreibtest fehlgeschlagen.') END
    );
  END IF;

  IF v_portal_type <> 'employee' OR v_employee_id IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'Kein Mitarbeitendenkonto mit dieser Sitzung verknüpft.');
  END IF;

  SELECT av.id
  INTO v_visit_id
  FROM public.assist_visits av
  WHERE av.tenant_id = v_tenant_id
    AND av.employee_id = v_employee_id
    AND av.planning_status <> 'draft'
  ORDER BY
    CASE WHEN av.assignment_date >= CURRENT_DATE THEN 0 ELSE 1 END,
    ABS(av.assignment_date - CURRENT_DATE),
    av.planned_start_at
  LIMIT 1;

  IF v_visit_id IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'Kein freigegebener Einsatz für die Produktionsprüfung gefunden.');
  END IF;

  BEGIN
    UPDATE public.assist_visits
    SET execution_status = execution_status
    WHERE id = v_visit_id
      AND tenant_id = v_tenant_id
      AND employee_id = v_employee_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
      RAISE EXCEPTION 'Der Einsatz ist nicht schreibbar.';
    END IF;

    INSERT INTO public.assist_time_events (
      tenant_id,
      visit_id,
      event_type,
      occurred_at,
      metadata
    ) VALUES (
      v_tenant_id,
      v_visit_id,
      'depart',
      NOW(),
      jsonb_build_object('runtime_probe', TRUE)
    );

    v_workflow_ok := TRUE;
    RAISE EXCEPTION '__CARESUITE_ROLLBACK_PROBE__';
  EXCEPTION
    WHEN RAISE_EXCEPTION THEN
      IF SQLERRM <> '__CARESUITE_ROLLBACK_PROBE__' THEN
        v_workflow_ok := FALSE;
        v_error := SQLERRM;
      END IF;
    WHEN OTHERS THEN
      v_workflow_ok := FALSE;
      v_error := SQLERRM;
  END;

  RETURN jsonb_build_object(
    'ok', v_workflow_ok,
    'capability', 'workflow',
    'error', CASE WHEN v_workflow_ok THEN NULL ELSE COALESCE(v_error, 'Einsatz-Schreibtest fehlgeschlagen.') END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.portal_runtime_write_probe(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_runtime_write_probe(TEXT) TO authenticated;

COMMENT ON FUNCTION public.portal_runtime_write_probe(TEXT)
  IS 'R20.5 rollback-only live permission probe for portal messages and employee workflow writes.';
