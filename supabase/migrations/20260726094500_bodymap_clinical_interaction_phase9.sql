-- ============================================================================
-- CareSuite HealthOS — Bodymap 3D Phase 9
-- Atomarer klinischer Verlauf ohne doppelte Trigger-Einträge.
-- Additiv und bestandsdatenschonend; keine Tabelle und kein Befund wird gelöscht.
-- ============================================================================

ALTER TABLE public.body_map_markers
  ALTER COLUMN client_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS resident_record_id UUID
    REFERENCES public.care_records(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS subject_type TEXT NOT NULL DEFAULT 'client',
  ADD COLUMN IF NOT EXISTS subject_id UUID;

UPDATE public.body_map_markers
SET subject_type = 'client', subject_id = client_id
WHERE subject_id IS NULL AND client_id IS NOT NULL;

ALTER TABLE public.body_map_finding_history
  ALTER COLUMN client_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS resident_record_id UUID
    REFERENCES public.care_records(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS subject_type TEXT NOT NULL DEFAULT 'client',
  ADD COLUMN IF NOT EXISTS subject_id UUID;

ALTER TABLE public.body_map_finding_media
  ALTER COLUMN client_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS resident_record_id UUID
    REFERENCES public.care_records(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS subject_type TEXT NOT NULL DEFAULT 'client',
  ADD COLUMN IF NOT EXISTS subject_id UUID;

ALTER TABLE public.pressure_injury_assessments
  ALTER COLUMN client_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS resident_record_id UUID
    REFERENCES public.care_records(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS subject_type TEXT NOT NULL DEFAULT 'client',
  ADD COLUMN IF NOT EXISTS subject_id UUID;

UPDATE public.body_map_finding_history AS history
SET
  subject_type = marker.subject_type,
  subject_id = marker.subject_id,
  resident_record_id = marker.resident_record_id
FROM public.body_map_markers AS marker
WHERE history.marker_id = marker.id AND history.subject_id IS NULL;

UPDATE public.body_map_finding_media AS media
SET
  subject_type = marker.subject_type,
  subject_id = marker.subject_id,
  resident_record_id = marker.resident_record_id
FROM public.body_map_markers AS marker
WHERE media.marker_id = marker.id AND media.subject_id IS NULL;

UPDATE public.pressure_injury_assessments AS assessment
SET
  subject_type = marker.subject_type,
  subject_id = marker.subject_id,
  resident_record_id = marker.resident_record_id
FROM public.body_map_markers AS marker
WHERE assessment.marker_id = marker.id AND assessment.subject_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'body_map_markers_subject_type_check'
  ) THEN
    ALTER TABLE public.body_map_markers
      ADD CONSTRAINT body_map_markers_subject_type_check
      CHECK (subject_type IN ('client', 'resident'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'body_map_markers_subject_reference_check'
  ) THEN
    ALTER TABLE public.body_map_markers
      ADD CONSTRAINT body_map_markers_subject_reference_check
      CHECK (
        subject_id IS NOT NULL
        AND (
          (subject_type = 'client' AND client_id = subject_id AND resident_record_id IS NULL)
          OR
          (subject_type = 'resident' AND resident_record_id = subject_id AND client_id IS NULL)
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_body_map_markers_subject
  ON public.body_map_markers (
    tenant_id, subject_type, subject_id, finding_status, updated_at DESC
  );

ALTER TABLE public.body_map_finding_history
  ADD CONSTRAINT body_map_finding_history_subject_type_check
    CHECK (subject_type IN ('client', 'resident')),
  ADD CONSTRAINT body_map_finding_history_subject_reference_check
    CHECK (
      subject_id IS NOT NULL
      AND (
        (subject_type = 'client' AND client_id = subject_id AND resident_record_id IS NULL)
        OR
        (subject_type = 'resident' AND resident_record_id = subject_id AND client_id IS NULL)
      )
    );

ALTER TABLE public.body_map_finding_media
  ADD CONSTRAINT body_map_finding_media_subject_type_check
    CHECK (subject_type IN ('client', 'resident')),
  ADD CONSTRAINT body_map_finding_media_subject_reference_check
    CHECK (
      subject_id IS NOT NULL
      AND (
        (subject_type = 'client' AND client_id = subject_id AND resident_record_id IS NULL)
        OR
        (subject_type = 'resident' AND resident_record_id = subject_id AND client_id IS NULL)
      )
    );

ALTER TABLE public.pressure_injury_assessments
  ADD CONSTRAINT pressure_injury_assessments_subject_type_check
    CHECK (subject_type IN ('client', 'resident')),
  ADD CONSTRAINT pressure_injury_assessments_subject_reference_check
    CHECK (
      subject_id IS NOT NULL
      AND (
        (subject_type = 'client' AND client_id = subject_id AND resident_record_id IS NULL)
        OR
        (subject_type = 'resident' AND resident_record_id = subject_id AND client_id IS NULL)
      )
    );

CREATE INDEX IF NOT EXISTS idx_body_map_history_subject
  ON public.body_map_finding_history (
    tenant_id, subject_type, subject_id, created_at DESC
  );
CREATE INDEX IF NOT EXISTS idx_body_map_media_subject
  ON public.body_map_finding_media (
    tenant_id, subject_type, subject_id, created_at DESC
  );
CREATE INDEX IF NOT EXISTS idx_pressure_injury_subject
  ON public.pressure_injury_assessments (
    tenant_id, subject_type, subject_id, assessed_at DESC
  );

CREATE OR REPLACE FUNCTION public.append_body_map_finding_history()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.body_map_finding_history (
      tenant_id, client_id, resident_record_id, subject_type, subject_id,
      marker_id, event_type, snapshot, created_by
    ) VALUES (
      NEW.tenant_id,
      NEW.client_id,
      NEW.resident_record_id,
      NEW.subject_type,
      NEW.subject_id,
      NEW.id,
      'created',
      to_jsonb(NEW),
      NEW.created_by
    );
  ELSIF (
    to_jsonb(NEW) - ARRAY['finding_status', 'closed_at', 'updated_at']
  ) IS DISTINCT FROM (
    to_jsonb(OLD) - ARRAY['finding_status', 'closed_at', 'updated_at']
  ) THEN
    INSERT INTO public.body_map_finding_history (
      tenant_id, client_id, resident_record_id, subject_type, subject_id,
      marker_id, event_type, snapshot, created_by
    ) VALUES (
      NEW.tenant_id,
      NEW.client_id,
      NEW.resident_record_id,
      NEW.subject_type,
      NEW.subject_id,
      NEW.id,
      'updated',
      to_jsonb(NEW),
      NEW.created_by
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_body_map_finding_progress(
  p_tenant_id UUID,
  p_subject_type TEXT,
  p_subject_id UUID,
  p_marker_id UUID,
  p_status TEXT,
  p_note TEXT,
  p_created_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_created_at TIMESTAMPTZ := now();
  v_event_type TEXT;
  v_marker public.body_map_markers%ROWTYPE;
BEGIN
  IF p_tenant_id IS DISTINCT FROM public.current_tenant_id() THEN
    RAISE EXCEPTION 'Mandantenzugriff verweigert.';
  END IF;
  IF p_subject_type NOT IN ('client', 'resident') THEN
    RAISE EXCEPTION 'Ungültiger Bodymap-Subjekttyp.';
  END IF;
  IF p_status NOT IN (
    'verdacht','aktiv','in_behandlung','heilend',
    'abgeheilt','geschlossen','wiedereroeffnet'
  ) THEN
    RAISE EXCEPTION 'Ungültiger Befundstatus.';
  END IF;
  IF btrim(COALESCE(p_note, '')) = '' THEN
    RAISE EXCEPTION 'Eine Verlaufsnotiz ist erforderlich.';
  END IF;

  v_event_type := CASE
    WHEN p_status = 'geschlossen' THEN 'closed'
    WHEN p_status = 'wiedereroeffnet' THEN 'reopened'
    WHEN p_status IN ('heilend', 'abgeheilt') THEN 'healing'
    WHEN p_status = 'in_behandlung' THEN 'treatment'
    ELSE 'updated'
  END;

  UPDATE public.body_map_markers
  SET
    finding_status = p_status,
    closed_at = CASE
      WHEN p_status IN ('geschlossen', 'abgeheilt') THEN v_created_at
      ELSE NULL
    END,
    updated_at = v_created_at
  WHERE tenant_id = p_tenant_id
    AND subject_type = p_subject_type
    AND subject_id = p_subject_id
    AND id = p_marker_id
  RETURNING * INTO v_marker;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bodymap-Befund nicht gefunden.';
  END IF;

  INSERT INTO public.body_map_finding_history (
    tenant_id,
    client_id,
    resident_record_id,
    subject_type,
    subject_id,
    marker_id,
    event_type,
    snapshot,
    note,
    created_by,
    created_at
  ) VALUES (
    p_tenant_id,
    v_marker.client_id,
    v_marker.resident_record_id,
    v_marker.subject_type,
    v_marker.subject_id,
    p_marker_id,
    v_event_type,
    jsonb_build_object(
      'findingStatus', p_status,
      'closedAt', v_marker.closed_at,
      'updatedAt', v_created_at
    ),
    btrim(p_note),
    p_created_by,
    v_created_at
  );

  RETURN jsonb_build_object(
    'status', p_status,
    'createdAt', v_created_at,
    'eventType', v_event_type
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_body_map_finding_progress(
  UUID, TEXT, UUID, UUID, TEXT, TEXT, UUID
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_body_map_finding_progress(
  UUID, TEXT, UUID, UUID, TEXT, TEXT, UUID
) TO authenticated;

COMMENT ON FUNCTION public.record_body_map_finding_progress(
  UUID, TEXT, UUID, UUID, TEXT, TEXT, UUID
) IS 'Speichert Bodymap-Status und append-only Verlaufsnotiz atomar und mandantenisoliert.';

CREATE OR REPLACE FUNCTION public.append_pressure_injury_assessment_history()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.body_map_finding_history (
    tenant_id,
    client_id,
    resident_record_id,
    subject_type,
    subject_id,
    marker_id,
    event_type,
    snapshot,
    note,
    created_by,
    created_at
  ) VALUES (
    NEW.tenant_id,
    NEW.client_id,
    NEW.resident_record_id,
    NEW.subject_type,
    NEW.subject_id,
    NEW.marker_id,
    'classified',
    jsonb_build_object(
      'assessmentId', NEW.id,
      'classification', NEW.classification,
      'deviceRelated', NEW.device_related,
      'measurements', jsonb_build_object(
        'lengthCm', NEW.length_cm,
        'widthCm', NEW.width_cm,
        'depthCm', NEW.depth_cm,
        'areaCm2', NEW.area_cm2
      ),
      'escalationFlags', NEW.escalation_flags,
      'nextReviewAt', NEW.next_review_at
    ),
    'Strukturiertes Dekubitus-/Druckverletzungsassessment gespeichert.',
    NEW.assessed_by,
    NEW.assessed_at
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS append_pressure_injury_assessment_history_trigger
  ON public.pressure_injury_assessments;
CREATE TRIGGER append_pressure_injury_assessment_history_trigger
  AFTER INSERT ON public.pressure_injury_assessments
  FOR EACH ROW EXECUTE FUNCTION public.append_pressure_injury_assessment_history();

DROP POLICY IF EXISTS "bodymap_clinical_media_select_tenant" ON storage.objects;
CREATE POLICY "bodymap_clinical_media_select_tenant"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'bodymap-clinical-media'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
    AND (
      (
        (storage.foldername(name))[3] = 'clients'
        AND (storage.foldername(name))[5] = 'bodymap'
      )
      OR
      (
        (storage.foldername(name))[3] = 'subjects'
        AND (storage.foldername(name))[4] = 'resident'
        AND (storage.foldername(name))[6] = 'bodymap'
      )
    )
  );

DROP POLICY IF EXISTS "bodymap_clinical_media_insert_tenant" ON storage.objects;
CREATE POLICY "bodymap_clinical_media_insert_tenant"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'bodymap-clinical-media'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
    AND (
      (
        (storage.foldername(name))[3] = 'clients'
        AND (storage.foldername(name))[5] = 'bodymap'
      )
      OR
      (
        (storage.foldername(name))[3] = 'subjects'
        AND (storage.foldername(name))[4] = 'resident'
        AND (storage.foldername(name))[6] = 'bodymap'
      )
    )
  );

DROP POLICY IF EXISTS "bodymap_clinical_media_update_tenant" ON storage.objects;
CREATE POLICY "bodymap_clinical_media_update_tenant"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'bodymap-clinical-media'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
  )
  WITH CHECK (
    bucket_id = 'bodymap-clinical-media'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
  );

DROP POLICY IF EXISTS "bodymap_clinical_media_delete_tenant" ON storage.objects;
CREATE POLICY "bodymap_clinical_media_delete_tenant"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'bodymap-clinical-media'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
  );
