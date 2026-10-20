-- ==========================================================================
-- CareSuite+ — Migration 0008: Ops-Module (WP 521–600)
-- release_packages, security_findings, qa_items, roadmap_milestones
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.release_packages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  env         TEXT        NOT NULL DEFAULT 'staging'
              CHECK (env IN ('development', 'staging', 'production')),
  status      TEXT        NOT NULL DEFAULT 'entwurf'
              CHECK (status IN (
                'entwurf','aktiv','in_bearbeitung','abgeschlossen',
                'archiviert','fehlerhaft','gesperrt'
              )),
  checklist   JSONB       NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.security_findings (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  category    TEXT        NOT NULL DEFAULT 'dsgvo'
              CHECK (category IN ('dsgvo', 'access', 'performance', 'audit')),
  status      TEXT        NOT NULL DEFAULT 'entwurf'
              CHECK (status IN (
                'entwurf','aktiv','in_bearbeitung','abgeschlossen',
                'archiviert','fehlerhaft','gesperrt'
              )),
  severity    TEXT        NOT NULL DEFAULT 'medium'
              CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.qa_items (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  kind        TEXT        NOT NULL DEFAULT 'bug'
              CHECK (kind IN ('pilot', 'bug', 'coverage')),
  status      TEXT        NOT NULL DEFAULT 'entwurf'
              CHECK (status IN (
                'entwurf','aktiv','in_bearbeitung','abgeschlossen',
                'archiviert','fehlerhaft','gesperrt'
              )),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.roadmap_milestones (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  phase       TEXT        NOT NULL DEFAULT 'discovery'
              CHECK (phase IN ('discovery', 'pilot', 'launch', 'scale')),
  quarter     TEXT,
  status      TEXT        NOT NULL DEFAULT 'entwurf'
              CHECK (status IN (
                'entwurf','aktiv','in_bearbeitung','abgeschlossen',
                'archiviert','fehlerhaft','gesperrt'
              )),
  summary     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- updated_at triggers
DROP TRIGGER IF EXISTS set_release_packages_updated_at ON public.release_packages;
CREATE TRIGGER set_release_packages_updated_at
  BEFORE UPDATE ON public.release_packages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_security_findings_updated_at ON public.security_findings;
CREATE TRIGGER set_security_findings_updated_at
  BEFORE UPDATE ON public.security_findings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_qa_items_updated_at ON public.qa_items;
CREATE TRIGGER set_qa_items_updated_at
  BEFORE UPDATE ON public.qa_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_roadmap_milestones_updated_at ON public.roadmap_milestones;
CREATE TRIGGER set_roadmap_milestones_updated_at
  BEFORE UPDATE ON public.roadmap_milestones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.release_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roadmap_milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "release_packages_tenant" ON public.release_packages;
CREATE POLICY "release_packages_tenant"
  ON public.release_packages FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "security_findings_tenant" ON public.security_findings;
CREATE POLICY "security_findings_tenant"
  ON public.security_findings FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "qa_items_tenant" ON public.qa_items;
CREATE POLICY "qa_items_tenant"
  ON public.qa_items FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "roadmap_milestones_tenant" ON public.roadmap_milestones;
CREATE POLICY "roadmap_milestones_tenant"
  ON public.roadmap_milestones FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

GRANT SELECT, INSERT, UPDATE ON public.release_packages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.security_findings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.qa_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.roadmap_milestones TO authenticated;

CREATE INDEX IF NOT EXISTS idx_release_packages_tenant ON public.release_packages(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_security_findings_tenant ON public.security_findings(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_qa_items_tenant ON public.qa_items(tenant_id, kind);
CREATE INDEX IF NOT EXISTS idx_roadmap_milestones_tenant ON public.roadmap_milestones(tenant_id, phase);

-- Pilot-Meilenstein rm-001 (Seed für Demo, idempotent via external ref)
INSERT INTO public.roadmap_milestones (id, tenant_id, title, phase, quarter, status, summary)
SELECT
  '00000000-0000-4000-a001-000000000001'::uuid,
  t.id,
  'Version 1.0 — Pilotstart Ambulant',
  'pilot',
  'Q2 2026',
  'in_bearbeitung',
  'Pilot mit 3 ambulanten Pflegediensten in NRW.'
FROM public.tenants t
WHERE t.slug = 'demo'
ON CONFLICT (id) DO NOTHING;
