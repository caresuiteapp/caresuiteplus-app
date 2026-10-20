-- ==========================================================================
-- CareSuite+ — Migration 0036: Module Extension Live Prep (Stationär + Akademie)
-- Wohnbereiche, Übergaben, Einschreibungen, Zertifikate — preparedOnly Schema.
-- Keine destruktiven Befehle. Extension Live-Flip bleibt false bis Backfill.
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.stationaer_living_areas (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  wing         TEXT,
  capacity     INTEGER     NOT NULL DEFAULT 2,
  occupied_beds INTEGER    NOT NULL DEFAULT 0,
  status       TEXT        NOT NULL DEFAULT 'prepared',
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.stationaer_handovers (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  shift_label       TEXT        NOT NULL,
  author_profile_id UUID,
  wing              TEXT,
  content           TEXT        NOT NULL,
  handover_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status            TEXT        NOT NULL DEFAULT 'prepared',
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.akademie_enrollments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  course_id       UUID,
  profile_id      UUID,
  progress_percent INTEGER    NOT NULL DEFAULT 0,
  enrolled_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  status          TEXT        NOT NULL DEFAULT 'prepared',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.akademie_certificates (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  course_id   UUID,
  profile_id  UUID,
  issued_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ,
  status      TEXT        NOT NULL DEFAULT 'prepared',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stationaer_living_areas_tenant
  ON public.stationaer_living_areas (tenant_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_stationaer_handovers_tenant
  ON public.stationaer_handovers (tenant_id, handover_at DESC);

CREATE INDEX IF NOT EXISTS idx_akademie_enrollments_tenant
  ON public.akademie_enrollments (tenant_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_akademie_certificates_tenant
  ON public.akademie_certificates (tenant_id, issued_at DESC);

ALTER TABLE public.stationaer_living_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stationaer_handovers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.akademie_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.akademie_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY stationaer_living_areas_tenant ON public.stationaer_living_areas
  FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY stationaer_handovers_tenant ON public.stationaer_handovers
  FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY akademie_enrollments_tenant ON public.akademie_enrollments
  FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY akademie_certificates_tenant ON public.akademie_certificates
  FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

COMMENT ON TABLE public.stationaer_living_areas IS 'Stationär Wohnbereiche Extension — preparedOnly (Sprint 101–102)';
COMMENT ON TABLE public.akademie_enrollments IS 'Akademie Teilnahmen Extension — preparedOnly (Sprint 101–102)';
