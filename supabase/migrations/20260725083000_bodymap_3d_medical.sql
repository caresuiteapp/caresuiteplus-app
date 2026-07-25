-- ============================================================================
-- CareSuite HealthOS — Medizinische 3D-Bodymap
-- 15 Grundmodelle + 3 Divers-Anatomiepakete, 3D-Oberflächenanker,
-- Dekubitus-Assessments, klinische Medien und revisionsfähiger Verlauf.
-- Ausschließlich additive Migration; keine Bestandsdaten werden gelöscht.
-- ============================================================================

ALTER TABLE public.body_map_markers
  ADD COLUMN IF NOT EXISTS model_id TEXT,
  ADD COLUMN IF NOT EXISTS anatomy_pack_id TEXT,
  ADD COLUMN IF NOT EXISTS age_group TEXT,
  ADD COLUMN IF NOT EXISTS sex TEXT,
  ADD COLUMN IF NOT EXISTS genital_anatomy TEXT,
  ADD COLUMN IF NOT EXISTS chest_anatomy TEXT,
  ADD COLUMN IF NOT EXISTS skin_tone TEXT,
  ADD COLUMN IF NOT EXISTS anatomical_zone_id TEXT,
  ADD COLUMN IF NOT EXISTS local_position JSONB,
  ADD COLUMN IF NOT EXISTS world_position JSONB,
  ADD COLUMN IF NOT EXISTS surface_normal JSONB,
  ADD COLUMN IF NOT EXISTS surface_uv JSONB,
  ADD COLUMN IF NOT EXISTS mesh_name TEXT,
  ADD COLUMN IF NOT EXISTS primitive_index INTEGER,
  ADD COLUMN IF NOT EXISTS triangle_index INTEGER,
  ADD COLUMN IF NOT EXISTS pressure_classification TEXT,
  ADD COLUMN IF NOT EXISTS finding_status TEXT NOT NULL DEFAULT 'aktiv',
  ADD COLUMN IF NOT EXISTS finding_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'body_map_markers_age_group_check'
  ) THEN
    ALTER TABLE public.body_map_markers
      ADD CONSTRAINT body_map_markers_age_group_check
      CHECK (age_group IS NULL OR age_group IN (
        'baby','kleinkind','kind','junger_erwachsener','erwachsener'
      ));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'body_map_markers_sex_check'
  ) THEN
    ALTER TABLE public.body_map_markers
      ADD CONSTRAINT body_map_markers_sex_check
      CHECK (sex IS NULL OR sex IN ('weiblich','maennlich','divers'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'body_map_markers_genital_anatomy_check'
  ) THEN
    ALTER TABLE public.body_map_markers
      ADD CONSTRAINT body_map_markers_genital_anatomy_check
      CHECK (genital_anatomy IS NULL OR genital_anatomy IN ('penis','vulva','unbekannt'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'body_map_markers_chest_anatomy_check'
  ) THEN
    ALTER TABLE public.body_map_markers
      ADD CONSTRAINT body_map_markers_chest_anatomy_check
      CHECK (chest_anatomy IS NULL OR chest_anatomy IN ('brueste','keine_brueste','unbekannt'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'body_map_markers_finding_status_check'
  ) THEN
    ALTER TABLE public.body_map_markers
      ADD CONSTRAINT body_map_markers_finding_status_check
      CHECK (finding_status IN (
        'verdacht','aktiv','in_behandlung','heilend','abgeheilt','geschlossen','wiedereroeffnet'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_body_map_markers_3d_client
  ON public.body_map_markers (tenant_id, client_id, model_id, finding_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_body_map_markers_zone
  ON public.body_map_markers (tenant_id, anatomical_zone_id, marker_type);
CREATE INDEX IF NOT EXISTS idx_body_map_markers_pressure
  ON public.body_map_markers (tenant_id, pressure_classification)
  WHERE pressure_classification IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.body_map_finding_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  marker_id UUID NOT NULL REFERENCES public.body_map_markers(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'created','updated','classified','treatment','photo','healing','closed','reopened'
  )),
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  note TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_body_map_history_marker
  ON public.body_map_finding_history (tenant_id, marker_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.body_map_finding_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  marker_id UUID NOT NULL REFERENCES public.body_map_markers(id) ON DELETE CASCADE,
  storage_bucket TEXT NOT NULL DEFAULT 'bodymap-clinical-media',
  storage_path TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'photo' CHECK (media_type IN (
    'photo','measurement_photo','document','video'
  )),
  capture_phase TEXT CHECK (capture_phase IS NULL OR capture_phase IN (
    'initial','before_cleaning','after_cleaning','after_debridement',
    'dressing_change','progress','closure','reopening'
  )),
  original_file_name TEXT,
  mime_type TEXT,
  file_size_bytes BIGINT,
  width_px INTEGER,
  height_px INTEGER,
  captured_at TIMESTAMPTZ,
  body_position TEXT,
  camera_distance_cm NUMERIC(8,2),
  measurement_reference_present BOOLEAN NOT NULL DEFAULT false,
  note TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, storage_path)
);

CREATE INDEX IF NOT EXISTS idx_body_map_media_marker
  ON public.body_map_finding_media (tenant_id, marker_id, captured_at DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS public.pressure_injury_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  marker_id UUID NOT NULL REFERENCES public.body_map_markers(id) ON DELETE CASCADE,
  classification TEXT NOT NULL CHECK (classification IN (
    'kategorie_1','kategorie_2','kategorie_3','kategorie_4',
    'nicht_klassifizierbar','tiefe_gewebeschaedigung','schleimhaut','medizinproduktbezogen'
  )),
  present_on_admission BOOLEAN,
  device_related BOOLEAN NOT NULL DEFAULT false,
  medical_device TEXT,
  length_cm NUMERIC(8,2),
  width_cm NUMERIC(8,2),
  depth_cm NUMERIC(8,2),
  area_cm2 NUMERIC(10,2) GENERATED ALWAYS AS (
    CASE
      WHEN length_cm IS NULL OR width_cm IS NULL THEN NULL
      ELSE length_cm * width_cm
    END
  ) STORED,
  undermining_clock_from SMALLINT,
  undermining_clock_to SMALLINT,
  undermining_max_depth_cm NUMERIC(8,2),
  tunneling_present BOOLEAN NOT NULL DEFAULT false,
  tissue_percentages JSONB NOT NULL DEFAULT '{}'::jsonb,
  exudate JSONB NOT NULL DEFAULT '{}'::jsonb,
  wound_edge JSONB NOT NULL DEFAULT '{}'::jsonb,
  surrounding_skin JSONB NOT NULL DEFAULT '{}'::jsonb,
  pain JSONB NOT NULL DEFAULT '{}'::jsonb,
  infection_signs JSONB NOT NULL DEFAULT '{}'::jsonb,
  escalation_flags TEXT[] NOT NULL DEFAULT '{}',
  treatment_plan JSONB NOT NULL DEFAULT '{}'::jsonb,
  pressure_relief_plan JSONB NOT NULL DEFAULT '{}'::jsonb,
  assessed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_review_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pressure_injury_marker
  ON public.pressure_injury_assessments (tenant_id, marker_id, assessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_pressure_injury_review
  ON public.pressure_injury_assessments (tenant_id, next_review_at)
  WHERE next_review_at IS NOT NULL;

ALTER TABLE public.body_map_finding_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.body_map_finding_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pressure_injury_assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS body_map_finding_history_tenant_policy
  ON public.body_map_finding_history;
DROP POLICY IF EXISTS body_map_finding_history_select_tenant
  ON public.body_map_finding_history;
CREATE POLICY body_map_finding_history_select_tenant
  ON public.body_map_finding_history FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());
DROP POLICY IF EXISTS body_map_finding_history_insert_tenant
  ON public.body_map_finding_history;
CREATE POLICY body_map_finding_history_insert_tenant
  ON public.body_map_finding_history FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS body_map_finding_media_tenant_policy
  ON public.body_map_finding_media;
CREATE POLICY body_map_finding_media_tenant_policy
  ON public.body_map_finding_media
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS pressure_injury_assessments_tenant_policy
  ON public.pressure_injury_assessments;
CREATE POLICY pressure_injury_assessments_tenant_policy
  ON public.pressure_injury_assessments
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP TRIGGER IF EXISTS set_pressure_injury_assessments_updated_at
  ON public.pressure_injury_assessments;
CREATE TRIGGER set_pressure_injury_assessments_updated_at
  BEFORE UPDATE ON public.pressure_injury_assessments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.append_body_map_finding_history()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  history_event TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    history_event := 'created';
  ELSIF NEW.finding_status = 'geschlossen' AND OLD.finding_status IS DISTINCT FROM NEW.finding_status THEN
    history_event := 'closed';
  ELSIF NEW.finding_status = 'wiedereroeffnet' AND OLD.finding_status IS DISTINCT FROM NEW.finding_status THEN
    history_event := 'reopened';
  ELSIF NEW.finding_status IN ('heilend', 'abgeheilt') AND OLD.finding_status IS DISTINCT FROM NEW.finding_status THEN
    history_event := 'healing';
  ELSE
    history_event := 'updated';
  END IF;

  INSERT INTO public.body_map_finding_history (
    tenant_id, client_id, marker_id, event_type, snapshot, created_by
  ) VALUES (
    NEW.tenant_id,
    NEW.client_id,
    NEW.id,
    history_event,
    to_jsonb(NEW),
    NEW.created_by
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS append_body_map_finding_history_trigger
  ON public.body_map_markers;
CREATE TRIGGER append_body_map_finding_history_trigger
  AFTER INSERT OR UPDATE ON public.body_map_markers
  FOR EACH ROW EXECUTE FUNCTION public.append_body_map_finding_history();

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bodymap-clinical-media',
  'bodymap-clinical-media',
  false,
  26214400,
  ARRAY['image/jpeg','image/png','image/webp','application/pdf','video/mp4']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Speicherpfad:
-- tenant/{tenant_id}/clients/{client_id}/bodymap/{marker_id}/{uuid}.{ext}
DROP POLICY IF EXISTS "bodymap_clinical_media_select_tenant" ON storage.objects;
CREATE POLICY "bodymap_clinical_media_select_tenant"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'bodymap-clinical-media'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
    AND (storage.foldername(name))[3] = 'clients'
    AND (storage.foldername(name))[5] = 'bodymap'
  );

DROP POLICY IF EXISTS "bodymap_clinical_media_insert_tenant" ON storage.objects;
CREATE POLICY "bodymap_clinical_media_insert_tenant"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'bodymap-clinical-media'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
    AND (storage.foldername(name))[3] = 'clients'
    AND (storage.foldername(name))[5] = 'bodymap'
  );

DROP POLICY IF EXISTS "bodymap_clinical_media_update_tenant" ON storage.objects;
CREATE POLICY "bodymap_clinical_media_update_tenant"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'bodymap-clinical-media'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
    AND (storage.foldername(name))[3] = 'clients'
    AND (storage.foldername(name))[5] = 'bodymap'
  )
  WITH CHECK (
    bucket_id = 'bodymap-clinical-media'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
    AND (storage.foldername(name))[3] = 'clients'
    AND (storage.foldername(name))[5] = 'bodymap'
  );

DROP POLICY IF EXISTS "bodymap_clinical_media_delete_tenant" ON storage.objects;
CREATE POLICY "bodymap_clinical_media_delete_tenant"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'bodymap-clinical-media'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
    AND (storage.foldername(name))[3] = 'clients'
    AND (storage.foldername(name))[5] = 'bodymap'
  );

COMMENT ON TABLE public.body_map_finding_history IS
  'Append-only klinischer Verlauf eines 3D-Bodymap-Befunds.';
COMMENT ON TABLE public.body_map_finding_media IS
  'Mandantenisolierte Original- und Verlaufsmedien eines Bodymap-Befunds.';
COMMENT ON TABLE public.pressure_injury_assessments IS
  'Strukturierte Dekubitus- und Druckverletzungsassessments mit Verlauf.';
