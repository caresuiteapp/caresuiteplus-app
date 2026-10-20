-- ==========================================================================
-- CareSuite+ — Migration 0029: reporting_pdl_cockpit Live-Snapshot
-- Mandantenbezogener PDL-Cockpit-Snapshot (Sprint 36 Live-Mapping).
-- Keine destruktiven Befehle (DROP/TRUNCATE/DELETE).
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.reporting_pdl_cockpit (
  tenant_id    UUID        PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  kpis         JSONB       NOT NULL DEFAULT '[]'::jsonb,
  open_tasks   JSONB       NOT NULL DEFAULT '[]'::jsonb,
  risks        JSONB       NOT NULL DEFAULT '[]'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.reporting_pdl_cockpit ENABLE ROW LEVEL SECURITY;

CREATE POLICY reporting_pdl_cockpit_tenant_isolation ON public.reporting_pdl_cockpit
  FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

COMMENT ON TABLE public.reporting_pdl_cockpit IS 'PDL-Cockpit Live-Snapshot pro Mandant (Sprint 36)';
COMMENT ON COLUMN public.reporting_pdl_cockpit.kpis IS 'KPI-Array für PDL-Dashboard';
COMMENT ON COLUMN public.reporting_pdl_cockpit.open_tasks IS 'Offene PDL-Aufgaben als JSON-Array';
COMMENT ON COLUMN public.reporting_pdl_cockpit.risks IS 'Risiken & Hinweise als JSON-Array';
