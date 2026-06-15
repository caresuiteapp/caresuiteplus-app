-- ==========================================================================
-- CareSuite+ — Migration 0043: Klient:innen Production Stabilization
-- Aligns local schema with remote production columns (non-destructive).
-- ==========================================================================

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS cost_bearer TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS insurance_number TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS insurance_name TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS internal_notes TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clients_cost_bearer
  ON public.clients (tenant_id, cost_bearer);

CREATE INDEX IF NOT EXISTS idx_clients_lifecycle
  ON public.clients (tenant_id, status, archived_at);

COMMENT ON COLUMN public.clients.archived_at IS 'Soft-archive timestamp for Klient:innen lifecycle';
COMMENT ON COLUMN public.clients.cost_bearer IS 'Kostenträger / Pflegekasse (production alias for cost_bearer)';
