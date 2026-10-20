-- Live patch: calendar_event_templates RLS + grants (project euagyyztvmemuaiumvxm)

-- Root cause: missing GRANT to authenticated + write policy blocked system template reads/seeds.



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

