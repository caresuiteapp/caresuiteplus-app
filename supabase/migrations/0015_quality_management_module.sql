-- ==========================================================================
-- CareSuite+ â€” Migration 0015: Office Quality Management Module
-- QM handbook, documents, compliance, MD audit packages, export jobs
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.qm_handbooks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  version     TEXT        NOT NULL DEFAULT '1.0',
  status      TEXT        NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'draft', 'archived')),
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.qm_handbook_chapters (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  handbook_id      UUID        NOT NULL REFERENCES public.qm_handbooks(id) ON DELETE CASCADE,
  parent_id        UUID        REFERENCES public.qm_handbook_chapters(id) ON DELETE SET NULL,
  sort_order       INT         NOT NULL DEFAULT 0,
  title            TEXT        NOT NULL,
  content          TEXT        NOT NULL DEFAULT '',
  version          TEXT        NOT NULL DEFAULT '1.0',
  status           TEXT        NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','in_review','approved','published','archived','superseded')),
  last_reviewed_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.qm_documents (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_number    TEXT        NOT NULL,
  title              TEXT        NOT NULL,
  document_type      TEXT        NOT NULL DEFAULT 'procedure'
                     CHECK (document_type IN ('procedure','work_instruction','checklist','protocol','policy','form','handbook_chapter')),
  status             TEXT        NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','in_review','approved','published','archived','superseded')),
  current_version_id UUID,
  chapter_id         UUID        REFERENCES public.qm_handbook_chapters(id) ON DELETE SET NULL,
  owner_role         TEXT        NOT NULL DEFAULT 'QMB',
  review_due_at      TIMESTAMPTZ,
  tags               TEXT[]      NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.qm_document_versions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_id     UUID        NOT NULL REFERENCES public.qm_documents(id) ON DELETE CASCADE,
  version_number  TEXT        NOT NULL DEFAULT '1.0',
  content         TEXT        NOT NULL DEFAULT '',
  change_summary  TEXT        NOT NULL DEFAULT '',
  status          TEXT        NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','in_review','approved','published','archived','superseded')),
  approved_at     TIMESTAMPTZ,
  approved_by     TEXT,
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.qm_document_relations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source_doc_id   UUID        NOT NULL REFERENCES public.qm_documents(id) ON DELETE CASCADE,
  target_doc_id   UUID        NOT NULL REFERENCES public.qm_documents(id) ON DELETE CASCADE,
  relation_type   TEXT        NOT NULL DEFAULT 'references',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.qm_legal_references (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title           TEXT        NOT NULL,
  source          TEXT        NOT NULL DEFAULT '',
  reference_code  TEXT        NOT NULL DEFAULT '',
  summary         TEXT        NOT NULL DEFAULT '',
  effective_from  TIMESTAMPTZ,
  document_ids    UUID[]      NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.qm_compliance_requirements (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title                 TEXT        NOT NULL,
  legal_reference_id    UUID        REFERENCES public.qm_legal_references(id) ON DELETE SET NULL,
  status                TEXT        NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open','in_progress','fulfilled','overdue','waived')),
  due_at                TIMESTAMPTZ,
  responsible_role      TEXT        NOT NULL DEFAULT 'QMB',
  evidence_document_ids UUID[]      NOT NULL DEFAULT '{}',
  notes                 TEXT        NOT NULL DEFAULT '',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.qm_changes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title         TEXT        NOT NULL,
  change_type   TEXT        NOT NULL DEFAULT 'improvement'
                CHECK (change_type IN ('correction','improvement','legal_update','audit_finding')),
  status        TEXT        NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','in_progress','completed','cancelled')),
  document_id   UUID        REFERENCES public.qm_documents(id) ON DELETE SET NULL,
  description   TEXT        NOT NULL DEFAULT '',
  requested_by  TEXT        NOT NULL DEFAULT '',
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.qm_change_tasks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  change_id   UUID        NOT NULL REFERENCES public.qm_changes(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'open',
  assigned_to TEXT,
  due_at      TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.qm_audits (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title           TEXT        NOT NULL,
  audit_type      TEXT        NOT NULL DEFAULT 'internal'
                  CHECK (audit_type IN ('internal','external','md_inspection')),
  status          TEXT        NOT NULL DEFAULT 'planned'
                  CHECK (status IN ('planned','in_progress','completed','follow_up')),
  scheduled_at    TIMESTAMPTZ NOT NULL,
  completed_at    TIMESTAMPTZ,
  auditor_name    TEXT        NOT NULL DEFAULT '',
  findings_count  INT         NOT NULL DEFAULT 0,
  summary         TEXT        NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.qm_audit_questions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  audit_id    UUID        NOT NULL REFERENCES public.qm_audits(id) ON DELETE CASCADE,
  question    TEXT        NOT NULL,
  sort_order  INT         NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.qm_audit_findings (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  audit_id    UUID        NOT NULL REFERENCES public.qm_audits(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  severity    TEXT        NOT NULL DEFAULT 'medium',
  status      TEXT        NOT NULL DEFAULT 'open',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.qm_measures (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title         TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','in_progress','completed','overdue')),
  audit_id      UUID        REFERENCES public.qm_audits(id) ON DELETE SET NULL,
  due_at        TIMESTAMPTZ NOT NULL,
  assigned_to   TEXT        NOT NULL DEFAULT '',
  description   TEXT        NOT NULL DEFAULT '',
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.qm_read_confirmations (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_id         UUID        NOT NULL REFERENCES public.qm_documents(id) ON DELETE CASCADE,
  document_version_id UUID        NOT NULL REFERENCES public.qm_document_versions(id) ON DELETE CASCADE,
  user_id             TEXT        NOT NULL,
  user_display_name   TEXT        NOT NULL DEFAULT '',
  confirmed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.qm_approval_workflows (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_id UUID        NOT NULL REFERENCES public.qm_documents(id) ON DELETE CASCADE,
  step        INT         NOT NULL DEFAULT 1,
  role_key    TEXT        NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'pending',
  acted_at    TIMESTAMPTZ,
  acted_by    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.qm_ai_drafts (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  action              TEXT        NOT NULL,
  status              TEXT        NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','accepted','rejected')),
  target_document_id  UUID        REFERENCES public.qm_documents(id) ON DELETE SET NULL,
  target_chapter_id   UUID        REFERENCES public.qm_handbook_chapters(id) ON DELETE SET NULL,
  prompt_summary      TEXT        NOT NULL DEFAULT '',
  suggested_content   TEXT        NOT NULL DEFAULT '',
  disclaimer          TEXT        NOT NULL DEFAULT '',
  reviewed_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.md_audit_packages (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title                 TEXT        NOT NULL,
  status                TEXT        NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','in_preparation','pending_approval','approved','exported','shared','revoked')),
  inspection_year       INT         NOT NULL,
  datenschutz_confirmed BOOLEAN     NOT NULL DEFAULT FALSE,
  approved_at           TIMESTAMPTZ,
  approved_by           TEXT,
  export_job_id         UUID,
  share_token_id        UUID,
  notes                 TEXT        NOT NULL DEFAULT '',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.md_audit_package_items (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  package_id            UUID        NOT NULL REFERENCES public.md_audit_packages(id) ON DELETE CASCADE,
  document_id           UUID        NOT NULL REFERENCES public.qm_documents(id) ON DELETE CASCADE,
  sort_order            INT         NOT NULL DEFAULT 0,
  included_version_id   UUID        REFERENCES public.qm_document_versions(id) ON DELETE SET NULL,
  notes                 TEXT        NOT NULL DEFAULT '',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.md_audit_share_tokens (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  package_id   UUID        NOT NULL REFERENCES public.md_audit_packages(id) ON DELETE CASCADE,
  token        TEXT        NOT NULL UNIQUE,
  expires_at   TIMESTAMPTZ NOT NULL,
  revoked_at   TIMESTAMPTZ,
  access_count INT         NOT NULL DEFAULT 0,
  share_url    TEXT        NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.md_audit_access_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  token_id    UUID        NOT NULL REFERENCES public.md_audit_share_tokens(id) ON DELETE CASCADE,
  package_id  UUID        NOT NULL REFERENCES public.md_audit_packages(id) ON DELETE CASCADE,
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address  TEXT,
  user_agent  TEXT,
  success     BOOLEAN     NOT NULL DEFAULT TRUE,
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.qm_export_jobs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  package_id    UUID        REFERENCES public.md_audit_packages(id) ON DELETE SET NULL,
  document_ids  UUID[]      NOT NULL DEFAULT '{}',
  status        TEXT        NOT NULL DEFAULT 'in_preparation'
                CHECK (status IN ('in_preparation','generated','failed','expired')),
  format        TEXT        NOT NULL DEFAULT 'pdf'
                CHECK (format IN ('pdf','zip')),
  prepared_only BOOLEAN     NOT NULL DEFAULT TRUE,
  download_url  TEXT,
  error_message TEXT,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.qm_templates (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        REFERENCES public.tenants(id) ON DELETE CASCADE,
  title         TEXT        NOT NULL,
  document_type TEXT        NOT NULL DEFAULT 'procedure',
  content       TEXT        NOT NULL DEFAULT '',
  tags          TEXT[]      NOT NULL DEFAULT '{}',
  scope         TEXT        NOT NULL DEFAULT 'system'
                CHECK (scope IN ('system','tenant')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- updated_at triggers
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'qm_handbooks','qm_handbook_chapters','qm_documents','qm_document_versions',
    'qm_document_relations','qm_legal_references','qm_compliance_requirements',
    'qm_changes','qm_change_tasks','qm_audits','qm_audit_questions','qm_audit_findings',
    'qm_measures','qm_read_confirmations','qm_approval_workflows','qm_ai_drafts',
    'md_audit_packages','md_audit_package_items','md_audit_share_tokens',
    'md_audit_access_logs','qm_export_jobs','qm_templates'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_%I_updated_at ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE TRIGGER set_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      tbl, tbl
    );
  END LOOP;
END $$;

-- RLS
ALTER TABLE public.qm_handbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qm_handbook_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qm_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qm_document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qm_document_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qm_legal_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qm_compliance_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qm_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qm_change_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qm_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qm_audit_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qm_audit_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qm_measures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qm_read_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qm_approval_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qm_ai_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.md_audit_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.md_audit_package_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.md_audit_share_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.md_audit_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qm_export_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qm_templates ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'qm_handbooks','qm_handbook_chapters','qm_documents','qm_document_versions',
    'qm_document_relations','qm_legal_references','qm_compliance_requirements',
    'qm_changes','qm_change_tasks','qm_audits','qm_audit_questions','qm_audit_findings',
    'qm_measures','qm_read_confirmations','qm_approval_workflows','qm_ai_drafts',
    'md_audit_packages','md_audit_package_items','md_audit_share_tokens',
    'md_audit_access_logs','qm_export_jobs','qm_templates'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_tenant ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY %I_tenant ON public.%I FOR ALL USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id())',
      tbl, tbl
    );
  END LOOP;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_qm_documents_tenant ON public.qm_documents(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_qm_chapters_tenant ON public.qm_handbook_chapters(tenant_id, handbook_id);
CREATE INDEX IF NOT EXISTS idx_md_packages_tenant ON public.md_audit_packages(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_md_tokens_token ON public.md_audit_share_tokens(token);

GRANT SELECT, INSERT, UPDATE ON public.qm_handbooks TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.qm_handbook_chapters TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.qm_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.qm_document_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.qm_document_relations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.qm_legal_references TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.qm_compliance_requirements TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.qm_changes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.qm_change_tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.qm_audits TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.qm_audit_questions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.qm_audit_findings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.qm_measures TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.qm_read_confirmations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.qm_approval_workflows TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.qm_ai_drafts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.md_audit_packages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.md_audit_package_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.md_audit_share_tokens TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.md_audit_access_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.qm_export_jobs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.qm_templates TO authenticated;
