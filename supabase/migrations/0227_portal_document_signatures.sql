-- Portal document signatures: Office → Mitarbeiterportal signing workflow
-- Reuses CareSuite+ signature capture; internal portal signing (no external e-sign provider).

-- --------------------------------------------------------------------------
-- 1. portal_signature_documents
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.portal_signature_documents (
  id                          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title                       TEXT          NOT NULL,
  document_type               TEXT          NOT NULL
    CHECK (document_type IN (
      'arbeitsvertrag', 'zusatzvereinbarung', 'belehrung', 'datenschutz',
      'schweigepflicht', 'dienstanweisung', 'empfangsbestaetigung',
      'schulungsnachweis', 'einwilligung', 'leistungsnachweis',
      'pflegeunterlage', 'kostentraegerformular', 'sonstiges'
    )),
  recipient_type              TEXT          NOT NULL
    CHECK (recipient_type IN ('employee', 'client')),
  employee_id                 UUID          REFERENCES public.employees(id) ON DELETE SET NULL,
  client_id                   UUID          REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name                 TEXT,
  signature_requirement       TEXT          NOT NULL DEFAULT 'employee'
    CHECK (signature_requirement IN ('employee', 'client', 'both_sequential')),
  due_date                    TIMESTAMPTZ,
  priority                    TEXT          NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  required_before_assignment  BOOLEAN       NOT NULL DEFAULT FALSE,
  assignment_id               UUID          REFERENCES public.assignments(id) ON DELETE SET NULL,
  status                      TEXT          NOT NULL DEFAULT 'new'
    CHECK (status IN (
      'new', 'open', 'in_progress', 'partially_signed',
      'fully_signed', 'completed', 'withdrawn', 'expired'
    )),
  source_document_id          UUID,
  storage_path                TEXT,
  preview_html                TEXT,
  version_number              INT           NOT NULL DEFAULT 1,
  employee_signed               BOOLEAN       NOT NULL DEFAULT FALSE,
  client_signed                 BOOLEAN       NOT NULL DEFAULT FALSE,
  next_signer_role            TEXT
    CHECK (next_signer_role IS NULL OR next_signer_role IN ('employee', 'client')),
  allow_download              BOOLEAN       NOT NULL DEFAULT TRUE,
  final_storage_path          TEXT,
  final_pdf_hash              TEXT,
  is_immutable                BOOLEAN       NOT NULL DEFAULT FALSE,
  created_by                  UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  creator_name                TEXT,
  sent_at                     TIMESTAMPTZ,
  completed_at                TIMESTAMPTZ,
  withdrawn_at                TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portal_signature_documents_tenant_employee
  ON public.portal_signature_documents (tenant_id, employee_id, status);

CREATE INDEX IF NOT EXISTS idx_portal_signature_documents_tenant_status
  ON public.portal_signature_documents (tenant_id, status, due_date);

CREATE INDEX IF NOT EXISTS idx_portal_signature_documents_tenant_client
  ON public.portal_signature_documents (tenant_id, client_id, status);

-- --------------------------------------------------------------------------
-- 2. portal_signature_captures — individual signature records
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.portal_signature_captures (
  id                          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_id                 UUID          NOT NULL REFERENCES public.portal_signature_documents(id) ON DELETE CASCADE,
  signer_role                 TEXT          NOT NULL
    CHECK (signer_role IN ('employee', 'client')),
  signer_name                 TEXT          NOT NULL,
  signer_profile_id           UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  storage_path                TEXT          NOT NULL,
  signature_hash              TEXT          NOT NULL,
  payload_hash                TEXT          NOT NULL,
  signed_at                   TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  device_info                 TEXT,
  browser                     TEXT,
  captured_ip                 INET,
  audit_id                    UUID          NOT NULL DEFAULT gen_random_uuid(),
  created_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portal_signature_captures_document
  ON public.portal_signature_captures (tenant_id, document_id, signed_at DESC);

-- --------------------------------------------------------------------------
-- 3. portal_signature_audit_events — append-only audit trail
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.portal_signature_audit_events (
  id                          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_id                 UUID          REFERENCES public.portal_signature_documents(id) ON DELETE SET NULL,
  actor_user_id               UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name                  TEXT,
  event_type                  TEXT          NOT NULL
    CHECK (event_type IN (
      'document_created', 'document_sent', 'document_viewed', 'signature_captured',
      'document_completed', 'document_withdrawn', 'document_resent', 'reminder_sent',
      'document_archived', 'status_changed'
    )),
  summary                     TEXT          NOT NULL,
  metadata_json               JSONB         NOT NULL DEFAULT '{}'::jsonb,
  created_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portal_signature_audit_document
  ON public.portal_signature_audit_events (tenant_id, document_id, created_at DESC);

-- --------------------------------------------------------------------------
-- 4. RLS
-- --------------------------------------------------------------------------
ALTER TABLE public.portal_signature_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_signature_captures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_signature_audit_events ENABLE ROW LEVEL SECURITY;

-- Office / tenant staff: full tenant access
DROP POLICY IF EXISTS portal_signature_documents_tenant_staff ON public.portal_signature_documents;
CREATE POLICY portal_signature_documents_tenant_staff ON public.portal_signature_documents
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() NOT IN ('employee_portal', 'client_portal', 'family_portal')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() NOT IN ('employee_portal', 'client_portal', 'family_portal')
  );

-- Portal employee: read/update own assigned documents
DROP POLICY IF EXISTS portal_signature_documents_employee_select ON public.portal_signature_documents;
CREATE POLICY portal_signature_documents_employee_select ON public.portal_signature_documents
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() = 'employee_portal'
    AND employee_id = public.resolve_current_employee_id()
    AND status NOT IN ('withdrawn')
  );

DROP POLICY IF EXISTS portal_signature_documents_employee_update ON public.portal_signature_documents;
CREATE POLICY portal_signature_documents_employee_update ON public.portal_signature_documents
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() = 'employee_portal'
    AND employee_id = public.resolve_current_employee_id()
    AND status NOT IN ('completed', 'withdrawn', 'expired')
    AND is_immutable = FALSE
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND employee_id = public.resolve_current_employee_id()
  );

-- Captures: employee can insert for own documents
DROP POLICY IF EXISTS portal_signature_captures_employee_insert ON public.portal_signature_captures;
CREATE POLICY portal_signature_captures_employee_insert ON public.portal_signature_captures
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() = 'employee_portal'
    AND document_id IN (
      SELECT d.id FROM public.portal_signature_documents d
      WHERE d.tenant_id = public.current_tenant_id()
        AND d.employee_id = public.resolve_current_employee_id()
    )
  );

DROP POLICY IF EXISTS portal_signature_captures_tenant_read ON public.portal_signature_captures;
CREATE POLICY portal_signature_captures_tenant_read ON public.portal_signature_captures
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

-- Audit: tenant read; employee insert via service
DROP POLICY IF EXISTS portal_signature_audit_tenant_read ON public.portal_signature_audit_events;
CREATE POLICY portal_signature_audit_tenant_read ON public.portal_signature_audit_events
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS portal_signature_audit_employee_insert ON public.portal_signature_audit_events;
CREATE POLICY portal_signature_audit_employee_insert ON public.portal_signature_audit_events
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() = 'employee_portal'
  );

DROP POLICY IF EXISTS portal_signature_audit_staff_insert ON public.portal_signature_audit_events;
CREATE POLICY portal_signature_audit_staff_insert ON public.portal_signature_audit_events
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() NOT IN ('employee_portal', 'client_portal', 'family_portal')
  );

-- --------------------------------------------------------------------------
-- 5. Grants
-- --------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON public.portal_signature_documents TO authenticated;
GRANT SELECT, INSERT ON public.portal_signature_captures TO authenticated;
GRANT SELECT, INSERT ON public.portal_signature_audit_events TO authenticated;

COMMENT ON TABLE public.portal_signature_documents IS
  'Office → Portal document signing requests. Finalized documents are immutable.';

COMMENT ON TABLE public.portal_signature_captures IS
  'Captured signatures for portal document signing workflow.';

COMMENT ON TABLE public.portal_signature_audit_events IS
  'Append-only audit trail for portal document signatures.';
