-- ==========================================================================
-- CareSuite+ — Migration 0053: Dokumenteneingang (prepared)
-- Upload, Scan, Zuordnung, OCR-Vorbereitung, Prüfaufträge, Audit
-- Kein externer OCR-Transfer, keine Gesundheitsdaten ohne Freigabe.
-- NICHT auf Remote pushen — nur lokale Migration vorbereiten.
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.document_inbox_items (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  file_name               TEXT        NOT NULL,
  mime_type               TEXT        NOT NULL DEFAULT 'application/octet-stream',
  file_size_bytes         BIGINT      NOT NULL DEFAULT 0,
  storage_reference       TEXT,
  source                  TEXT        NOT NULL
    CHECK (source IN (
      'upload', 'scan_prepared', 'email_kim_prepared', 'employee_portal',
      'client_portal', 'admin_upload', 'connect_prepared'
    )),
  status                  TEXT        NOT NULL DEFAULT 'uploaded'
    CHECK (status IN (
      'uploaded', 'classification_pending', 'ocr_pending', 'review_required',
      'linked', 'archived', 'rejected', 'deleted'
    )),
  category                TEXT
    CHECK (category IS NULL OR category IN (
      'general', 'invoice', 'contract', 'care_plan', 'consent',
      'personnel', 'correspondence', 'other'
    )),
  contains_health_data    BOOLEAN     NOT NULL DEFAULT FALSE,
  uploaded_by             UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  title                   TEXT,
  notes                   TEXT,
  archived_at             TIMESTAMPTZ,
  rejected_at             TIMESTAMPTZ,
  deleted_at              TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_inbox_items_tenant
  ON public.document_inbox_items (tenant_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.document_inbox_classification_results (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  inbox_item_id           UUID        NOT NULL REFERENCES public.document_inbox_items(id) ON DELETE CASCADE,
  suggested_category      TEXT,
  suggested_entity_type   TEXT
    CHECK (suggested_entity_type IS NULL OR suggested_entity_type IN (
      'client', 'assignment', 'invoice', 'personnel'
    )),
  suggested_entity_id     UUID,
  confidence              TEXT        NOT NULL DEFAULT 'unknown'
    CHECK (confidence IN ('high', 'medium', 'low', 'unknown')),
  requires_review         BOOLEAN     NOT NULL DEFAULT TRUE,
  model_version           TEXT,
  raw_hints_json          JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_inbox_classification_item
  ON public.document_inbox_classification_results (tenant_id, inbox_item_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.document_inbox_ocr_jobs (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  inbox_item_id           UUID        NOT NULL REFERENCES public.document_inbox_items(id) ON DELETE CASCADE,
  provider_key            TEXT        NOT NULL
    CHECK (provider_key IN (
      'google_vision', 'azure_document_intelligence', 'aws_textract',
      'abbyy', 'klippa', 'mindee', 'internal'
    )),
  status                  TEXT        NOT NULL DEFAULT 'prepared'
    CHECK (status IN (
      'prepared', 'blocked', 'pending_approval', 'queued', 'processing',
      'completed', 'failed', 'cancelled'
    )),
  contains_health_data    BOOLEAN     NOT NULL DEFAULT FALSE,
  external_transfer       BOOLEAN     NOT NULL DEFAULT FALSE,
  approval_required       BOOLEAN     NOT NULL DEFAULT FALSE,
  approved_by             UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at             TIMESTAMPTZ,
  result_json             JSONB       NOT NULL DEFAULT '{}'::jsonb,
  error_summary           TEXT,
  initiated_by            UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_inbox_ocr_jobs_tenant
  ON public.document_inbox_ocr_jobs (tenant_id, inbox_item_id, status);

CREATE TABLE IF NOT EXISTS public.document_inbox_entity_links (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  inbox_item_id           UUID        NOT NULL REFERENCES public.document_inbox_items(id) ON DELETE CASCADE,
  entity_type             TEXT        NOT NULL
    CHECK (entity_type IN ('client', 'assignment', 'invoice', 'personnel')),
  entity_id               UUID        NOT NULL,
  linked_by               UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_confirmed            BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_inbox_entity_links_item
  ON public.document_inbox_entity_links (tenant_id, inbox_item_id);

CREATE TABLE IF NOT EXISTS public.document_inbox_review_tasks (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  inbox_item_id           UUID        NOT NULL REFERENCES public.document_inbox_items(id) ON DELETE CASCADE,
  status                  TEXT        NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved', 'rejected')),
  title                   TEXT        NOT NULL,
  description             TEXT        NOT NULL DEFAULT '',
  assigned_to             UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at             TIMESTAMPTZ,
  resolution_note         TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_inbox_review_tasks_tenant
  ON public.document_inbox_review_tasks (tenant_id, inbox_item_id, status);

CREATE TABLE IF NOT EXISTS public.document_inbox_audit_events (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  inbox_item_id           UUID        NOT NULL REFERENCES public.document_inbox_items(id) ON DELETE CASCADE,
  actor_user_id           UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type              TEXT        NOT NULL
    CHECK (event_type IN (
      'item_uploaded', 'category_set', 'classification_completed', 'review_task_created',
      'ocr_prepared', 'ocr_blocked', 'entity_linked', 'auto_link_skipped',
      'archived', 'rejected', 'deleted', 'status_changed'
    )),
  summary                 TEXT        NOT NULL,
  old_status              TEXT,
  new_status              TEXT,
  metadata_json           JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_inbox_audit_events_tenant
  ON public.document_inbox_audit_events (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_document_inbox_audit_events_item
  ON public.document_inbox_audit_events (tenant_id, inbox_item_id, created_at DESC);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'document_inbox_items',
    'document_inbox_classification_results',
    'document_inbox_ocr_jobs',
    'document_inbox_entity_links',
    'document_inbox_review_tasks'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_%I_updated_at ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER set_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      t, t
    );
  END LOOP;
END $$;

ALTER TABLE public.document_inbox_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_inbox_classification_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_inbox_ocr_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_inbox_entity_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_inbox_review_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_inbox_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS document_inbox_items_tenant_select ON public.document_inbox_items;
CREATE POLICY document_inbox_items_tenant_select ON public.document_inbox_items
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS document_inbox_items_tenant_write ON public.document_inbox_items;
CREATE POLICY document_inbox_items_tenant_write ON public.document_inbox_items
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS document_inbox_audit_events_tenant_select ON public.document_inbox_audit_events;
CREATE POLICY document_inbox_audit_events_tenant_select ON public.document_inbox_audit_events
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS document_inbox_audit_events_tenant_insert ON public.document_inbox_audit_events;
CREATE POLICY document_inbox_audit_events_tenant_insert ON public.document_inbox_audit_events
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

GRANT SELECT, INSERT, UPDATE ON public.document_inbox_items TO authenticated;
GRANT SELECT, INSERT ON public.document_inbox_classification_results TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.document_inbox_ocr_jobs TO authenticated;
GRANT SELECT, INSERT ON public.document_inbox_entity_links TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.document_inbox_review_tasks TO authenticated;
GRANT SELECT, INSERT ON public.document_inbox_audit_events TO authenticated;

COMMENT ON TABLE public.document_inbox_items IS
  'Dokumenteneingang — mandantengebunden, alle Quellen auditierbar';

COMMENT ON TABLE public.document_inbox_ocr_jobs IS
  'OCR-Jobs für Eingang — external_transfer=false ohne Freigabe';

COMMENT ON TABLE public.document_inbox_audit_events IS
  'Audit-Trail Dokumenteneingang — append-only';
