-- REVIEW DRAFT ONLY. Never applied to production; not a migration.
-- Catalog contracts: workflow-server-assignment-status-metadata-20261011.json
-- and workflow-server-write-rpc-metadata-20261011.json. Review together with
-- workflow-server-identity-draft.sql and the canonical Visit completion gates.
-- The app does not call this legacy RPC; linked canonical Visits must use the
-- existing Visit pipeline. This function must not become an alternative finish.
BEGIN;

CREATE OR REPLACE FUNCTION public.set_assignment_status(
  input_assignment_id uuid, input_status public.assignment_status,
  input_employee_id uuid DEFAULT NULL, input_latitude numeric DEFAULT NULL,
  input_longitude numeric DEFAULT NULL, input_note text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  a public.assignments%ROWTYPE;
  d public.documentation_entries%ROWTYPE;
  v_tenant uuid := public.current_tenant_id();
  v_employee uuid;
  v_portal boolean;
  v_event public.time_entry_type;
  v_time timestamptz := clock_timestamp();
  v_allowed boolean;
BEGIN
  IF auth.uid() IS NULL OR v_tenant IS NULL THEN
    RAISE EXCEPTION 'Anmeldung und Mandant erforderlich.' USING ERRCODE='42501';
  END IF;
  v_portal := COALESCE(public.current_portal_type(),'') = 'employee';
  IF v_portal THEN
    v_employee := public.resolve_current_employee_id();
    IF v_employee IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.employee_portal_accounts e
      WHERE e.id=public.current_portal_account_id() AND e.auth_user_id=auth.uid()
        AND e.tenant_id=v_tenant AND e.employee_id=v_employee AND e.status='active'
    ) THEN RAISE EXCEPTION 'Aktives Mitarbeitendenkonto erforderlich.' USING ERRCODE='42501'; END IF;
  ELSIF COALESCE(public.current_portal_type(),'business') <> 'business'
    OR NOT COALESCE(public.is_internal_tenant_actor(v_tenant),FALSE)
    OR NOT COALESCE(public.has_permission('assist.execution.manage'),FALSE) THEN
    RAISE EXCEPTION 'Keine Berechtigung zur Einsatzdurchführung.' USING ERRCODE='42501';
  END IF;
  IF input_status IS NULL OR input_assignment_id IS NULL THEN
    RAISE EXCEPTION 'Einsatz und Status erforderlich.' USING ERRCODE='22023';
  END IF;
  IF (input_latitude IS NULL) <> (input_longitude IS NULL)
    OR (input_latitude IS NOT NULL AND NOT (input_latitude BETWEEN -90 AND 90))
    OR (input_longitude IS NOT NULL AND NOT (input_longitude BETWEEN -180 AND 180))
    OR length(COALESCE(input_note,'')) > 4000 THEN
    RAISE EXCEPTION 'Ungültige Koordinaten oder Notiz.' USING ERRCODE='22023';
  END IF;
  SELECT * INTO a FROM public.assignments
    WHERE id=input_assignment_id AND tenant_id=v_tenant FOR UPDATE;
  IF NOT FOUND OR (v_portal AND a.employee_id IS DISTINCT FROM v_employee)
    OR (input_employee_id IS NOT NULL AND input_employee_id IS DISTINCT FROM a.employee_id) THEN
    RAISE EXCEPTION 'Einsatz nicht verfügbar oder nicht zugeordnet.' USING ERRCODE='42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.assist_visits v WHERE v.tenant_id=a.tenant_id
    AND (v.id=a.id OR v.legacy_assignment_id=a.id)) THEN
    RAISE EXCEPTION 'Kanonischer Einsatz: abgesicherte Visit-Durchführung verwenden.' USING ERRCODE='55000';
  END IF;
  -- A lost HTTP response may be retried without another time event.
  IF a.status=input_status THEN RETURN a.id; END IF;
  IF a.status::text IN ('completed','cancelled','no_show') THEN
    RAISE EXCEPTION 'Abgeschlossener Einsatz ist gesperrt.' USING ERRCODE='55000';
  END IF;
  v_allowed := CASE a.status::text
    WHEN 'planned' THEN input_status::text IN ('confirmed','on_the_way','cancelled','no_show')
    WHEN 'confirmed' THEN input_status::text IN ('on_the_way','cancelled','no_show')
    WHEN 'on_the_way' THEN input_status::text IN ('arrived','cancelled')
    WHEN 'arrived' THEN input_status::text IN ('started','cancelled')
    WHEN 'started' THEN input_status::text IN ('paused','finished','cancelled')
    WHEN 'paused' THEN input_status::text IN ('started','finished','cancelled')
    WHEN 'finished' THEN input_status::text IN ('documentation_open','cancelled')
    WHEN 'documentation_open' THEN input_status::text IN ('signature_open','completed','cancelled')
    WHEN 'signature_open' THEN input_status::text IN ('completed','cancelled')
    ELSE FALSE END;
  IF NOT v_allowed OR (v_portal AND input_status::text IN ('confirmed','cancelled')) THEN
    RAISE EXCEPTION 'Statuswechsel nicht erlaubt.' USING ERRCODE='22023';
  END IF;
  IF input_status::text IN ('cancelled','no_show') AND length(trim(COALESCE(input_note,''))) < 3 THEN
    RAISE EXCEPTION 'Begründung erforderlich.' USING ERRCODE='22023';
  END IF;
  IF input_status::text NOT IN ('cancelled','no_show','confirmed') AND a.employee_id IS NULL THEN
    RAISE EXCEPTION 'Mitarbeitendenzuordnung erforderlich.' USING ERRCODE='22023';
  END IF;
  IF input_status::text IN ('started','paused','finished') AND a.actual_end_at IS NOT NULL THEN
    RAISE EXCEPTION 'Leistungszeit bereits beendet.' USING ERRCODE='55000';
  END IF;
  IF input_status::text IN ('paused','finished') AND
    (a.actual_start_at IS NULL OR a.actual_start_at>v_time) THEN
    RAISE EXCEPTION 'Bestätigter tatsächlicher Start erforderlich.' USING ERRCODE='22023';
  END IF;
  IF input_status::text IN ('documentation_open','signature_open','completed') AND
    (a.actual_start_at IS NULL OR a.actual_end_at IS NULL
      OR a.actual_end_at<a.actual_start_at OR a.actual_end_at>v_time) THEN
    RAISE EXCEPTION 'Bestätigte tatsächliche Leistungszeit erforderlich.' USING ERRCODE='22023';
  END IF;
  IF input_status::text IN ('signature_open','completed') THEN
    SELECT * INTO d FROM public.documentation_entries
      WHERE tenant_id=a.tenant_id AND assignment_id=a.id AND client_id=a.client_id
        AND employee_id=a.employee_id AND status::text IN ('saved','signature_required','completed','approved')
        AND length(trim(COALESCE(free_text,'')))>0 FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Passende Dokumentation fehlt.' USING ERRCODE='22023'; END IF;
    IF input_status::text='completed' AND NOT EXISTS (
      SELECT 1 FROM public.signatures s WHERE s.tenant_id=a.tenant_id
        AND s.assignment_id=a.id AND s.client_id=a.client_id AND s.employee_id=a.employee_id
        AND s.documentation_entry_id=d.id AND s.status::text='signed'
        AND length(trim(COALESCE(s.signer_name,'')))>=2
        AND length(trim(COALESCE(s.signature_data,'')))>0
        AND s.signed_at IS NOT NULL AND s.signed_at>=d.updated_at
        AND s.signed_at>=a.actual_end_at AND s.signed_at<=v_time
    ) THEN RAISE EXCEPTION 'Aktuelle passende Unterschrift fehlt.' USING ERRCODE='22023'; END IF;
  END IF;
  v_event := CASE input_status::text
    WHEN 'on_the_way' THEN 'on_the_way'::public.time_entry_type
    WHEN 'arrived' THEN 'arrived'::public.time_entry_type
    WHEN 'started' THEN CASE WHEN a.status::text='paused' THEN 'resumed'::public.time_entry_type ELSE 'started'::public.time_entry_type END
    WHEN 'paused' THEN 'paused'::public.time_entry_type
    WHEN 'finished' THEN 'finished'::public.time_entry_type
    ELSE 'system'::public.time_entry_type END;
  UPDATE public.assignments SET status=input_status,
    on_the_way_at=CASE WHEN input_status::text='on_the_way' THEN v_time ELSE on_the_way_at END,
    arrived_at=CASE WHEN input_status::text='arrived' THEN v_time ELSE arrived_at END,
    actual_start_at=CASE WHEN input_status::text='started' THEN COALESCE(actual_start_at,v_time) ELSE actual_start_at END,
    actual_end_at=CASE WHEN input_status::text='finished' THEN v_time ELSE actual_end_at END,
    finished_at=CASE WHEN input_status::text='finished' THEN v_time ELSE finished_at END,
    updated_at=v_time WHERE id=a.id AND tenant_id=a.tenant_id;
  INSERT INTO public.time_entries(tenant_id,assignment_id,employee_id,entry_type,event_at,latitude,longitude,source,note)
    VALUES(a.tenant_id,a.id,a.employee_id,v_event,v_time,input_latitude,input_longitude,'rpc',input_note);
  RETURN a.id;
END $$;
REVOKE ALL ON FUNCTION public.set_assignment_status(uuid,public.assignment_status,uuid,numeric,numeric,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_assignment_status(uuid,public.assignment_status,uuid,numeric,numeric,text) TO authenticated,service_role;

-- No executable app/Edge caller exists for these legacy bypasses (types only).
-- Retain trusted service access, but do not invent new client billing endpoints.
REVOKE ALL ON FUNCTION public.create_service_record_from_assignment(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.create_invoice_from_service_record(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.book_payment_for_invoice(uuid,numeric,public.payment_method,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.add_live_tracking_event(uuid,public.live_tracking_event_type,numeric,numeric,numeric,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_service_record_from_assignment(uuid),
  public.create_invoice_from_service_record(uuid),
  public.book_payment_for_invoice(uuid,numeric,public.payment_method,text),
  public.add_live_tracking_event(uuid,public.live_tracking_event_type,numeric,numeric,numeric,boolean) TO service_role;
COMMIT;
