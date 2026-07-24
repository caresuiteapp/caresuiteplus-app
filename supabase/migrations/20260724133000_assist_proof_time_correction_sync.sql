-- P0 2026-07-24: administrative Assist-Zeitkorrekturen müssen in vorhandenen
-- Leistungsnachweisen erscheinen. Signatur und Dokumentation bleiben erhalten;
-- ein vorher erzeugtes PDF wird als veraltet entfernt und bei der nächsten
-- Freigabe/Erzeugung aus den korrigierten kanonischen Daten neu aufgebaut.

CREATE OR REPLACE FUNCTION public.sync_assist_time_correction_to_proofs(
  p_tenant_id UUID,
  p_visit_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_visit public.assist_visits%ROWTYPE;
  v_drive_seconds INTEGER;
  v_gross_service_seconds INTEGER;
  v_service_seconds INTEGER;
  v_pause_seconds INTEGER;
  v_visit_times JSONB;
BEGIN
  SELECT *
  INTO v_visit
  FROM public.assist_visits
  WHERE tenant_id = p_tenant_id
    AND id = p_visit_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_drive_seconds := CASE
    WHEN v_visit.on_the_way_at IS NOT NULL AND v_visit.arrived_at IS NOT NULL
      THEN greatest(
        0,
        round(extract(epoch FROM (v_visit.arrived_at - v_visit.on_the_way_at)))::INTEGER
      )
    ELSE NULL
  END;
  v_gross_service_seconds := CASE
    WHEN v_visit.actual_start_at IS NOT NULL AND v_visit.actual_end_at IS NOT NULL
      THEN greatest(
        0,
        round(extract(epoch FROM (v_visit.actual_end_at - v_visit.actual_start_at)))::INTEGER
      )
    ELSE NULL
  END;
  v_service_seconds := CASE
    WHEN v_visit.duration_minutes IS NOT NULL
      THEN greatest(0, v_visit.duration_minutes * 60)
    ELSE v_gross_service_seconds
  END;
  v_pause_seconds := CASE
    WHEN v_gross_service_seconds IS NOT NULL AND v_service_seconds IS NOT NULL
      THEN greatest(0, v_gross_service_seconds - v_service_seconds)
    ELSE NULL
  END;

  UPDATE public.assist_visit_proofs proof
  SET
    payload_snapshot =
      coalesce(proof.payload_snapshot, '{}'::JSONB)
      || jsonb_build_object(
        'actualStartAt', v_visit.actual_start_at,
        'actualEndAt', v_visit.actual_end_at,
        'durationMinutes', v_visit.duration_minutes,
        'visitTimes',
          coalesce(proof.payload_snapshot -> 'visitTimes', '{}'::JSONB)
          || jsonb_build_object(
            'driveSeconds', v_drive_seconds,
            'serviceSeconds', v_service_seconds,
            'pauseSeconds', CASE WHEN v_pause_seconds > 0 THEN v_pause_seconds ELSE NULL END,
            'totalSeconds',
              CASE
                WHEN v_service_seconds IS NULL AND v_drive_seconds IS NULL THEN NULL
                ELSE coalesce(v_service_seconds, 0) + coalesce(v_drive_seconds, 0)
              END,
            'driveStartedAt', v_visit.on_the_way_at,
            'arrivedAt', v_visit.arrived_at,
            'serviceStartedAt', v_visit.actual_start_at,
            'serviceEndedAt', v_visit.actual_end_at,
            'pauseStartedAt', NULL,
            'activeTimer', NULL
          )
      ),
    payload_hash = NULL,
    pdf_storage_path = NULL,
    pdf_hash = NULL,
    metadata =
      coalesce(proof.metadata, '{}'::JSONB)
      || jsonb_build_object(
        'timeCorrectionApplied', TRUE,
        'timeCorrectionAppliedAt', NOW(),
        'pdfRegenerationRequired', TRUE
      ),
    updated_at = NOW()
  WHERE proof.tenant_id = p_tenant_id
    AND proof.visit_id = p_visit_id;

  UPDATE public.assist_visit_signature_requests request
  SET
    actual_start_at = v_visit.actual_start_at,
    actual_end_at = v_visit.actual_end_at,
    proof_preview =
      coalesce(request.proof_preview, '{}'::JSONB)
      || jsonb_build_object(
        'actual_start_at', v_visit.actual_start_at,
        'actual_end_at', v_visit.actual_end_at,
        'duration_minutes', v_visit.duration_minutes
      )
  WHERE request.tenant_id = p_tenant_id
    AND request.visit_id = p_visit_id;

  -- A mirrored portal document must not keep serving an obsolete PDF. The
  -- dynamic proof detail remains available and a new PDF is generated on the
  -- next release/export.
  UPDATE public.client_documents document
  SET
    storage_path = NULL,
    portal_visible = FALSE,
    updated_at = NOW()
  WHERE document.tenant_id = p_tenant_id
    AND document.id IN (
      SELECT proof.id
      FROM public.assist_visit_proofs proof
      WHERE proof.tenant_id = p_tenant_id
        AND proof.visit_id = p_visit_id
    )
    AND document.category = 'leistungsnachweis';
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_administrative_time_event_to_proof()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.event_type = 'service_end'
     AND coalesce(NEW.metadata ->> 'source', '') = 'administrative_follow_up' THEN
    PERFORM public.sync_assist_time_correction_to_proofs(NEW.tenant_id, NEW.visit_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_administrative_time_event_to_proof_trigger
  ON public.assist_time_events;
CREATE TRIGGER sync_administrative_time_event_to_proof_trigger
AFTER INSERT ON public.assist_time_events
FOR EACH ROW
EXECUTE FUNCTION public.sync_administrative_time_event_to_proof();

-- Rückwirkende Reparatur für bereits heute/zuletzt administrativ korrigierte
-- Einsätze. Die Audit-Tabelle ist die belastbare Auswahl, nicht ein Zeitfenster.
DO $$
DECLARE
  v_row RECORD;
BEGIN
  FOR v_row IN
    SELECT DISTINCT audit.tenant_id, audit.visit_id
    FROM public.assist_visit_admin_audit audit
    WHERE audit.action = 'times_corrected'
  LOOP
    PERFORM public.sync_assist_time_correction_to_proofs(
      v_row.tenant_id,
      v_row.visit_id
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_assist_time_correction_to_proofs(UUID, UUID)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sync_administrative_time_event_to_proof()
  FROM PUBLIC, anon;

NOTIFY pgrst, 'reload schema';
