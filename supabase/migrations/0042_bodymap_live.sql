-- ==========================================================================
-- CareSuite+ — Migration 0042: BodyMap Live-Marker (Pflege)
-- Persistente 2D-BodyMap-Marker mit Mandanten-RLS.
-- Keine destruktiven Befehle (DROP/TRUNCATE/DELETE).
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.body_map_markers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  wound_id UUID NULL,
  gender TEXT NOT NULL CHECK (gender IN ('weiblich','maennlich','neutral')),
  view TEXT NOT NULL CHECK (view IN ('vorderseite','rueckseite')),
  region TEXT NOT NULL,
  marker_type TEXT NOT NULL,
  x_percent NUMERIC(5,2) NOT NULL CHECK (x_percent >= 0 AND x_percent <= 100),
  y_percent NUMERIC(5,2) NOT NULL CHECK (y_percent >= 0 AND y_percent <= 100),
  note TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.body_map_markers ENABLE ROW LEVEL SECURITY;

CREATE POLICY body_map_markers_tenant_policy
ON public.body_map_markers
FOR ALL
USING (tenant_id = public.current_tenant_id())
WITH CHECK (tenant_id = public.current_tenant_id());

CREATE INDEX IF NOT EXISTS idx_body_map_markers_client
ON public.body_map_markers (tenant_id, client_id, view, gender);

COMMENT ON TABLE public.body_map_markers IS 'Pflege BodyMap — klinische Marker (2D/SVG MVP)';
