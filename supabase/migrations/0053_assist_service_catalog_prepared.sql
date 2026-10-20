-- ==========================================================================
-- CareSuite+ — Migration 0053: Assist Leistungskatalog (vorbereitet)
-- Leistungen, Aufgabenpakete, versionierte Stundensätze, Abrechnungsregeln,
-- Dokumentationspflichten, Audit. Erweitert tenant_service_rates (0050).
-- NICHT pushen.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. assist_service_catalog_items — Leistungskatalog Assist (10 Bereiche)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assist_service_catalog_items (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  service_key                 TEXT        NOT NULL,
  title                       TEXT        NOT NULL,
  description                 TEXT        NOT NULL DEFAULT '',
  category                    TEXT        NOT NULL
                              CHECK (category IN (
                                'alltagsbegleitung', 'betreuung', 'hauswirtschaft',
                                'begleitung_ausser_haus', 'einkaufen', 'aktivierung',
                                'entlastung_angehoeriger', 'organisation_alltag',
                                'besuchsdienst', 'sonstige_unterstuetzung'
                              )),
  billable                    BOOLEAN     NOT NULL DEFAULT TRUE,
  requires_signature          BOOLEAN     NOT NULL DEFAULT FALSE,
  requires_documentation      BOOLEAN     NOT NULL DEFAULT TRUE,
  default_duration_minutes    INTEGER     NOT NULL DEFAULT 60,
  allowed_modules             TEXT[]      NOT NULL DEFAULT ARRAY['assist']::TEXT[],
  tax_mode                    TEXT        NOT NULL DEFAULT 'ustg_4_16_exempt'
                              CHECK (tax_mode IN (
                                'ustg_4_16_exempt', 'standard_vat_19', 'kleinunternehmer_19'
                              )),
  budget_eligible             BOOLEAN     NOT NULL DEFAULT TRUE,
  status                      TEXT        NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, service_key)
);

CREATE INDEX IF NOT EXISTS idx_assist_service_catalog_tenant
  ON public.assist_service_catalog_items (tenant_id, category, status);

-- --------------------------------------------------------------------------
-- 2. assist_service_task_templates — Aufgabenpakete je Leistung
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assist_service_task_templates (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  service_catalog_item_id UUID        NOT NULL REFERENCES public.assist_service_catalog_items(id) ON DELETE CASCADE,
  task_key                TEXT        NOT NULL,
  title                   TEXT        NOT NULL,
  description             TEXT        NOT NULL DEFAULT '',
  sort_order              INTEGER     NOT NULL DEFAULT 0,
  is_required             BOOLEAN     NOT NULL DEFAULT TRUE,
  estimated_minutes       INTEGER,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, service_catalog_item_id, task_key)
);

CREATE INDEX IF NOT EXISTS idx_assist_service_task_templates_service
  ON public.assist_service_task_templates (tenant_id, service_catalog_item_id, sort_order);

-- --------------------------------------------------------------------------
-- 3. assist_service_rate_versions — Versionierte Stundensätze je Leistung
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assist_service_rate_versions (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  service_catalog_item_id UUID        NOT NULL REFERENCES public.assist_service_catalog_items(id) ON DELETE CASCADE,
  version_label           TEXT        NOT NULL,
  hourly_rate_net_cents   INTEGER     NOT NULL DEFAULT 0,
  hourly_rate_gross_cents INTEGER     NOT NULL DEFAULT 0,
  tax_mode                TEXT        NOT NULL DEFAULT 'ustg_4_16_exempt',
  tax_rate_percent        NUMERIC(5,2) NOT NULL DEFAULT 0,
  billing_unit            TEXT        NOT NULL DEFAULT 'hour'
                          CHECK (billing_unit IN ('hour', 'visit', 'flat', 'minute')),
  valid_from              DATE        NOT NULL,
  valid_to                DATE,
  is_active               BOOLEAN     NOT NULL DEFAULT TRUE,
  tenant_service_rate_id  UUID        REFERENCES public.tenant_service_rates(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assist_service_rate_versions_lookup
  ON public.assist_service_rate_versions (tenant_id, service_catalog_item_id, valid_from DESC);

-- --------------------------------------------------------------------------
-- 4. assist_service_billing_rules — Abrechnungsregeln je Leistung
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assist_service_billing_rules (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  service_catalog_item_id UUID        NOT NULL REFERENCES public.assist_service_catalog_items(id) ON DELETE CASCADE,
  budget_type             TEXT
                          CHECK (budget_type IS NULL OR budget_type IN (
                            'paragraph_45b', 'umwandlungsanspruch',
                            'jahres_sonderbudget', 'selbstzahler'
                          )),
  max_minutes_per_visit   INTEGER,
  min_billable_minutes    INTEGER     NOT NULL DEFAULT 30,
  rounding_minutes        INTEGER     NOT NULL DEFAULT 15,
  requires_service_proof  BOOLEAN     NOT NULL DEFAULT TRUE,
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, service_catalog_item_id)
);

-- --------------------------------------------------------------------------
-- 5. assist_service_documentation_requirements — Dokumentations-/Signaturpflichten
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assist_service_documentation_requirements (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  service_catalog_item_id UUID        NOT NULL REFERENCES public.assist_service_catalog_items(id) ON DELETE CASCADE,
  requirement_key         TEXT        NOT NULL,
  kind                    TEXT        NOT NULL
                          CHECK (kind IN (
                            'free_text', 'checklist', 'signature', 'photo', 'time_confirmation'
                          )),
  label                   TEXT        NOT NULL,
  is_mandatory            BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order              INTEGER     NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, service_catalog_item_id, requirement_key)
);

-- --------------------------------------------------------------------------
-- 6. assist_service_catalog_audit_events — Auditierbare Katalogänderungen
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assist_service_catalog_audit_events (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  service_catalog_item_id UUID        REFERENCES public.assist_service_catalog_items(id) ON DELETE SET NULL,
  action                  TEXT        NOT NULL
                          CHECK (action IN (
                            'service_created', 'service_updated', 'task_template_added',
                            'rate_version_set', 'billing_rule_set', 'documentation_requirement_set',
                            'assignment_template_generated'
                          )),
  summary                 TEXT        NOT NULL,
  payload                 JSONB       NOT NULL DEFAULT '{}'::JSONB,
  actor_user_id           UUID,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assist_service_catalog_audit_tenant
  ON public.assist_service_catalog_audit_events (tenant_id, created_at DESC);

-- --------------------------------------------------------------------------
-- RLS aktivieren
-- --------------------------------------------------------------------------
ALTER TABLE public.assist_service_catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assist_service_task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assist_service_rate_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assist_service_billing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assist_service_documentation_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assist_service_catalog_audit_events ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'assist_service_catalog_items', 'assist_service_task_templates',
    'assist_service_rate_versions', 'assist_service_billing_rules',
    'assist_service_documentation_requirements', 'assist_service_catalog_audit_events'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_tenant ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_tenant ON public.%I FOR ALL TO authenticated USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id())',
      t, t
    );
  END LOOP;
END $$;

COMMENT ON TABLE public.assist_service_catalog_items IS
  'Assist Leistungskatalog — 10 Leistungsbereiche, mandantenscharf, auditierbar';

COMMENT ON TABLE public.assist_service_rate_versions IS
  'Assist Leistungskatalog — versionierte Stundensätze; optional verknüpft mit tenant_service_rates';

COMMENT ON TABLE public.assist_service_catalog_audit_events IS
  'Assist Leistungskatalog — Audit-Trail für Leistungs- und Preisänderungen';
