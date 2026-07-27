-- ==========================================================================
-- CareSuite HealthOS — Assist: atomisches Löschen geplanter Einsätze
-- ==========================================================================
-- Der Browser darf verknüpfte assist_visits/assignments nicht mehr in zwei
-- voneinander unabhängigen Requests löschen. Diese Funktion prüft den
-- Mandanten und entfernt beide Datensätze in einer Transaktion. Bei einem
-- Fehler wird der gesamte Vorgang zurückgerollt.
-- Ein bewusst ausgelöstes Löschen ist unabhängig vom Einsatz-, Nachweis-,
-- Dokumentations- oder Abrechnungsstatus zulässig.

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
    'legacyAssignmentId', v_legacy_assignment_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_assist_visit(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_assist_visit(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.delete_assist_visit(UUID, UUID) IS
  'Löscht einen Assist-Einsatz und seinen Legacy-Datensatz unabhängig vom Bearbeitungsstatus atomar.';
