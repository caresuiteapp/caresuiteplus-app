-- ==========================================================================
-- CareSuite+ — Migration 0120: calendar_event_templates
-- System- und Mandanten-Vorlagen für Kalender-Erstellung
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.calendar_event_templates (
  id                          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID          REFERENCES public.tenants(id) ON DELETE CASCADE,
  module_key                  TEXT          NOT NULL
    CHECK (module_key IN ('office','assist','pflege','stationaer','beratung','akademie')),
  template_key                TEXT          NOT NULL,
  label                       TEXT          NOT NULL,
  description                 TEXT,
  source_type                 TEXT          NOT NULL DEFAULT 'custom_event',
  event_type                  TEXT          NOT NULL DEFAULT 'termin',
  default_duration_minutes    INT           NOT NULL DEFAULT 60,
  all_day                     BOOLEAN       NOT NULL DEFAULT FALSE,
  is_system                   BOOLEAN       NOT NULL DEFAULT FALSE,
  is_active                   BOOLEAN       NOT NULL DEFAULT TRUE,
  role_keys                   TEXT[]        NOT NULL DEFAULT '{}',
  field_schema                JSONB         NOT NULL DEFAULT '[]',
  created_at                  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_event_templates_system_key
  ON public.calendar_event_templates (module_key, template_key)
  WHERE tenant_id IS NULL AND is_system = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_event_templates_tenant_key
  ON public.calendar_event_templates (tenant_id, module_key, template_key)
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_event_templates_module
  ON public.calendar_event_templates (module_key, is_active)
  WHERE is_active = TRUE;

ALTER TABLE public.calendar_event_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS calendar_event_templates_tenant_read ON public.calendar_event_templates;
DROP POLICY IF EXISTS calendar_event_templates_tenant_write ON public.calendar_event_templates;
DROP POLICY IF EXISTS calendar_event_templates_select ON public.calendar_event_templates;
DROP POLICY IF EXISTS calendar_event_templates_insert ON public.calendar_event_templates;
DROP POLICY IF EXISTS calendar_event_templates_update ON public.calendar_event_templates;
DROP POLICY IF EXISTS calendar_event_templates_delete ON public.calendar_event_templates;

CREATE POLICY calendar_event_templates_select ON public.calendar_event_templates
  FOR SELECT TO authenticated
  USING (
    (is_system = TRUE AND tenant_id IS NULL)
    OR tenant_id = public.current_tenant_id()
  );

CREATE POLICY calendar_event_templates_insert ON public.calendar_event_templates
  FOR INSERT TO authenticated
  WITH CHECK (
    (is_system = TRUE AND tenant_id IS NULL)
    OR (tenant_id = public.current_tenant_id() AND is_system = FALSE)
  );

CREATE POLICY calendar_event_templates_update ON public.calendar_event_templates
  FOR UPDATE TO authenticated
  USING (
    (is_system = TRUE AND tenant_id IS NULL)
    OR (tenant_id = public.current_tenant_id() AND is_system = FALSE)
  )
  WITH CHECK (
    (is_system = TRUE AND tenant_id IS NULL)
    OR (tenant_id = public.current_tenant_id() AND is_system = FALSE)
  );

CREATE POLICY calendar_event_templates_delete ON public.calendar_event_templates
  FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND is_system = FALSE);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_event_templates TO authenticated;

-- System templates (idempotent seed)
INSERT INTO public.calendar_event_templates
  (id, tenant_id, module_key, template_key, label, description, source_type, event_type, default_duration_minutes, all_day, is_system, field_schema)
VALUES
  ('a1000001-0000-4000-8000-000000000001', NULL, 'office', 'office_termin', 'Termin', 'Allgemeiner Office-Termin', 'appointment', 'termin', 60, FALSE, TRUE, '[{"key":"title","label":"Titel","type":"text","required":true}]'),
  ('a1000001-0000-4000-8000-000000000002', NULL, 'office', 'office_meeting', 'Besprechung', 'Team- oder Klientenbesprechung', 'meeting', 'besprechung', 45, FALSE, TRUE, '[{"key":"title","label":"Titel","type":"text","required":true}]'),
  ('a1000001-0000-4000-8000-000000000003', NULL, 'assist', 'assist_einsatz', 'Einsatz', 'Assist-Einsatz / Hausbesuch', 'assist_visit', 'einsatz', 60, FALSE, TRUE, '[{"key":"title","label":"Titel","type":"text","required":true}]'),
  ('a1000001-0000-4000-8000-000000000004', NULL, 'pflege', 'pflege_visite', 'Pflegevisite', 'Pflegevisite oder Rundgang', 'care_visit', 'pflegevisite', 30, FALSE, TRUE, '[{"key":"title","label":"Titel","type":"text","required":true}]'),
  ('a1000001-0000-4000-8000-000000000005', NULL, 'stationaer', 'stationaer_aktivitaet', 'Aktivität', 'Gruppenaktivität oder Angebot', 'stationary_activity', 'aktivitaet', 90, FALSE, TRUE, '[{"key":"title","label":"Aktivität","type":"text","required":true}]'),
  ('a1000001-0000-4000-8000-000000000006', NULL, 'beratung', 'beratung_termin', 'Beratungstermin', 'Erst- oder Folgeberatung', 'consultation_appointment', 'beratung', 60, FALSE, TRUE, '[{"key":"title","label":"Titel","type":"text","required":true}]'),
  ('a1000001-0000-4000-8000-000000000007', NULL, 'akademie', 'akademie_schulung', 'Schulung', 'Kurs, Lektion oder Pflichtschulung', 'academy_training', 'schulung', 120, FALSE, TRUE, '[{"key":"title","label":"Kurs","type":"text","required":true}]')
ON CONFLICT DO NOTHING;
