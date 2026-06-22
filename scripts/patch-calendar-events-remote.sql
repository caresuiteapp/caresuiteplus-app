-- ==========================================================================
-- CareSuite+ — Migration 0117: calendar_events (zentrale Kalendertabelle)
-- Pattern: tenant-scoped RLS + source dedupe (tenant_id, source_type, source_id)
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.calendar_events (
  id                          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  module_key                  TEXT          NOT NULL DEFAULT 'office'
    CHECK (module_key IN ('office','assist','pflege','stationaer','beratung','akademie','portal','global')),
  source_type                 TEXT          NOT NULL,
  source_id                   UUID,
  event_type                  TEXT          NOT NULL DEFAULT 'termin',
  title                       TEXT          NOT NULL,
  description                 TEXT,
  internal_note               TEXT,
  public_note                 TEXT,
  start_at                    TIMESTAMPTZ   NOT NULL,
  end_at                      TIMESTAMPTZ   NOT NULL,
  all_day                     BOOLEAN       NOT NULL DEFAULT FALSE,
  timezone                    TEXT          NOT NULL DEFAULT 'Europe/Berlin',
  status                      TEXT          NOT NULL DEFAULT 'aktiv',
  priority                    TEXT          NOT NULL DEFAULT 'normal',
  location_type               TEXT,
  location_name               TEXT,
  address                     TEXT,
  room                        TEXT,
  video_url                   TEXT,
  phone_number                TEXT,
  related_client_id           UUID          REFERENCES public.clients(id) ON DELETE SET NULL,
  related_employee_id         UUID          REFERENCES public.employees(id) ON DELETE SET NULL,
  related_team_id             UUID,
  related_ward_id             UUID,
  related_case_id             UUID,
  related_document_id         UUID,
  visibility_scope            TEXT          NOT NULL DEFAULT 'tenant',
  is_office_visible           BOOLEAN       NOT NULL DEFAULT TRUE,
  is_module_visible           BOOLEAN       NOT NULL DEFAULT TRUE,
  is_client_portal_visible    BOOLEAN       NOT NULL DEFAULT FALSE,
  is_employee_portal_visible  BOOLEAN       NOT NULL DEFAULT FALSE,
  is_public_holiday           BOOLEAN       NOT NULL DEFAULT FALSE,
  color_key                   TEXT,
  icon_key                    TEXT,
  recurrence_rule_id          UUID,
  created_at                  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by                  UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by                  UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  archived_at                 TIMESTAMPTZ
);

-- Named constraint für idempotente Backfill-Upserts (NULL source_id erlaubt mehrfach)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'calendar_events_source_unique'
  ) THEN
    ALTER TABLE public.calendar_events
      ADD CONSTRAINT calendar_events_source_unique
      UNIQUE (tenant_id, source_type, source_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_calendar_events_tenant_range
  ON public.calendar_events (tenant_id, start_at, end_at)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_events_tenant_module
  ON public.calendar_events (tenant_id, module_key, start_at)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_events_client_portal
  ON public.calendar_events (tenant_id, related_client_id, start_at)
  WHERE is_client_portal_visible = TRUE AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_events_employee_portal
  ON public.calendar_events (tenant_id, related_employee_id, start_at)
  WHERE is_employee_portal_visible = TRUE AND archived_at IS NULL;

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS calendar_events_tenant_select ON public.calendar_events;
CREATE POLICY calendar_events_tenant_select
  ON public.calendar_events FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND archived_at IS NULL
  );

DROP POLICY IF EXISTS calendar_events_tenant_write ON public.calendar_events;
CREATE POLICY calendar_events_tenant_write
  ON public.calendar_events FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

GRANT SELECT, INSERT, UPDATE ON public.calendar_events TO authenticated;

DROP TRIGGER IF EXISTS set_calendar_events_updated_at ON public.calendar_events;
CREATE TRIGGER set_calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.calendar_events IS 'Zentrale Kalender-Synchronisationsbasis für alle CareSuite+ Module';
