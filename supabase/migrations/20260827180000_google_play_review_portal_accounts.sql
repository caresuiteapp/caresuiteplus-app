-- CareSuite HealthOS R14-D1 — isolated Google Play review tenant and accounts.
-- All records are synthetic. Plain-text credentials are deliberately not stored here.

BEGIN;

-- Stable review tenant; never use the production demo UUID because production blocks it.
INSERT INTO public.tenants (id, name, slug, legal_form, industry, phone, email, website)
VALUES (
  'c5000000-0000-4000-8000-000000000001',
  'CareSuite Prüfzentrum Berlin',
  'google-play-review',
  'Interner Prüfmandant',
  'Alltagsbegleitung und Pflege',
  '+49 30 555 0100',
  'review@caresuite.invalid',
  'https://caresuite.invalid'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  updated_at = NOW();

INSERT INTO public.tenant_environment_settings (
  tenant_id, mode, demo_data_set_key, is_pilot_tenant, show_known_risks,
  feedback_module_prepared, provider_sandbox_only, notes
)
VALUES (
  'c5000000-0000-4000-8000-000000000001', 'internal_test', NULL, FALSE, FALSE,
  FALSE, TRUE, 'Synthetic Google Play review tenant; no real persons or provider calls.'
)
ON CONFLICT (tenant_id) DO UPDATE SET
  mode = 'internal_test',
  demo_data_set_key = NULL,
  provider_sandbox_only = TRUE,
  notes = EXCLUDED.notes,
  updated_at = NOW();

INSERT INTO public.tenant_addresses (id, tenant_id, street, zip, city, state, country)
VALUES (
  'c5000000-0000-4000-8000-000000000002',
  'c5000000-0000-4000-8000-000000000001',
  'Musterweg 12', '10115', 'Berlin', 'Berlin', 'Deutschland'
)
ON CONFLICT (id) DO UPDATE SET street = EXCLUDED.street, zip = EXCLUDED.zip, city = EXCLUDED.city;

-- Review employee.
INSERT INTO public.employees (
  id, tenant_id, first_name, last_name, status
)
VALUES (
  'c5000000-0000-4000-8000-000000000010',
  'c5000000-0000-4000-8000-000000000001',
  'Anna', 'Beispiel', 'aktiv'
)
ON CONFLICT (id) DO UPDATE SET
  first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
  status = 'aktiv', updated_at = NOW();

-- Production has historically divergent employee columns. Populate every
-- extended portal field only when that exact column exists.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'role_title') THEN
    EXECUTE 'UPDATE public.employees SET role_title = $1 WHERE id = $2'
      USING 'Alltagsbegleiterin', 'c5000000-0000-4000-8000-000000000010'::uuid;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'email') THEN
    EXECUTE 'UPDATE public.employees SET email = $1 WHERE id = $2'
      USING 'anna.beispiel@caresuite.invalid', 'c5000000-0000-4000-8000-000000000010'::uuid;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'phone') THEN
    EXECUTE 'UPDATE public.employees SET phone = $1 WHERE id = $2'
      USING '+49 30 555 0110', 'c5000000-0000-4000-8000-000000000010'::uuid;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'mobile') THEN
    EXECUTE 'UPDATE public.employees SET mobile = $1 WHERE id = $2'
      USING '+49 170 555 0110', 'c5000000-0000-4000-8000-000000000010'::uuid;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'department') THEN
    EXECUTE 'UPDATE public.employees SET department = $1 WHERE id = $2'
      USING 'Ambulante Betreuung', 'c5000000-0000-4000-8000-000000000010'::uuid;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'entry_date') THEN
    EXECUTE 'UPDATE public.employees SET entry_date = CURRENT_DATE - 730 WHERE id = $1'
      USING 'c5000000-0000-4000-8000-000000000010'::uuid;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'employee_number') THEN
    EXECUTE 'UPDATE public.employees SET employee_number = $1 WHERE id = $2'
      USING 'GP-1001', 'c5000000-0000-4000-8000-000000000010'::uuid;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'employment_type') THEN
    EXECUTE 'UPDATE public.employees SET employment_type = $1 WHERE id = $2'
      USING 'Teilzeit', 'c5000000-0000-4000-8000-000000000010'::uuid;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'weekly_hours') THEN
    EXECUTE 'UPDATE public.employees SET weekly_hours = $1 WHERE id = $2'
      USING 30.00, 'c5000000-0000-4000-8000-000000000010'::uuid;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'city') THEN
    EXECUTE 'UPDATE public.employees SET city = $1 WHERE id = $2'
      USING 'Berlin', 'c5000000-0000-4000-8000-000000000010'::uuid;
  END IF;
END $$;

INSERT INTO public.employee_profiles (
  id, tenant_id, employee_id, portal_active, role_key, password_configured, two_factor_prepared
)
VALUES (
  'c5000000-0000-4000-8000-000000000011',
  'c5000000-0000-4000-8000-000000000001',
  'c5000000-0000-4000-8000-000000000010', TRUE, 'employee_portal', TRUE, FALSE
)
ON CONFLICT (tenant_id, employee_id) DO UPDATE SET
  portal_active = TRUE, role_key = 'employee_portal', password_configured = TRUE,
  two_factor_prepared = FALSE, updated_at = NOW();

INSERT INTO public.employee_portal_accounts (
  id, tenant_id, employee_id, username, status, must_change_password,
  first_login_completed, temporary_password_hash, temporary_password_created_at,
  temporary_password_expires_at, blocked_at, blocked_by, blocked_reason
)
VALUES (
  'c5000000-0000-4000-8000-000000000101',
  'c5000000-0000-4000-8000-000000000001',
  'c5000000-0000-4000-8000-000000000010',
  'googleplay.mitarbeiter', 'active', FALSE, TRUE,
  'pbkdf2-sha256:310000:8845e9ce7085f1fbcefaa81f8dd8714c:ccb7df664cc01f77c305158267e04c4cbf22d184841b0eb984bb4cd56c03acf1',
  NOW(), NULL, NULL, NULL, NULL
)
ON CONFLICT (tenant_id, username) DO UPDATE SET
  employee_id = EXCLUDED.employee_id, status = 'active', must_change_password = FALSE,
  first_login_completed = TRUE, temporary_password_hash = EXCLUDED.temporary_password_hash,
  temporary_password_expires_at = NULL, blocked_at = NULL, blocked_by = NULL,
  blocked_reason = NULL, updated_at = NOW();

-- Three synthetic clients provide a realistic employee schedule; Maria owns the client login.
INSERT INTO public.clients (
  id, tenant_id, first_name, last_name, date_of_birth, care_level, status,
  street, city, zip, phone, email, notes, primary_contact_phone,
  sensitivity, visibility, client_number, admission_date, service_start,
  language, special_notes
)
VALUES
  ('c5000000-0000-4000-8000-000000000020', 'c5000000-0000-4000-8000-000000000001',
   'Maria', 'Muster', DATE '1948-04-18', 'pg3', 'aktiv', 'Rosenweg 24', 'Berlin', '10119',
   '+49 30 555 0120', 'maria.muster@caresuite.invalid',
   'Synthetische Prüfakte. Bevorzugt Termine am Vormittag.', '+49 170 555 0121',
   'care', 'team', 'GP-K-2001', CURRENT_DATE - 540, CURRENT_DATE - 520, 'de',
   'Bitte klingeln und einen Moment warten.'),
  ('c5000000-0000-4000-8000-000000000021', 'c5000000-0000-4000-8000-000000000001',
   'Karl', 'Testmann', DATE '1952-09-03', 'pg2', 'aktiv', 'Parkstraße 7', 'Berlin', '10178',
   '+49 30 555 0122', 'karl.testmann@caresuite.invalid',
   'Synthetische Prüfakte für den Tourenplan.', '+49 170 555 0123',
   'care', 'team', 'GP-K-2002', CURRENT_DATE - 380, CURRENT_DATE - 360, 'de',
   'Zugang über den Innenhof.'),
  ('c5000000-0000-4000-8000-000000000022', 'c5000000-0000-4000-8000-000000000001',
   'Elisabeth', 'Demo', DATE '1944-12-12', 'pg4', 'aktiv', 'Lindenallee 31', 'Berlin', '10557',
   '+49 30 555 0124', 'elisabeth.demo@caresuite.invalid',
   'Synthetische Prüfakte für Einsatz- und Fahrtenbuchdaten.', '+49 170 555 0125',
   'care', 'team', 'GP-K-2003', CURRENT_DATE - 280, CURRENT_DATE - 260, 'de',
   'Aufzug bis zur dritten Etage.')
ON CONFLICT (id) DO UPDATE SET
  first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
  care_level = EXCLUDED.care_level, status = 'aktiv', street = EXCLUDED.street,
  city = EXCLUDED.city, zip = EXCLUDED.zip, phone = EXCLUDED.phone,
  notes = EXCLUDED.notes, updated_at = NOW();

INSERT INTO public.client_portal_access (
  id, tenant_id, client_id, email, status, modules_enabled, two_factor_enabled,
  portal_username, portal_access_code_hash, portal_enabled, code_created_at,
  code_rotated_at
)
VALUES (
  'c5000000-0000-4000-8000-000000000102',
  'c5000000-0000-4000-8000-000000000001',
  'c5000000-0000-4000-8000-000000000020',
  'maria.muster@caresuite.invalid', 'aktiv',
  ARRAY['appointments','messages','documents','proofs','budget'], FALSE,
  'googleplay.klient',
  'pbkdf2-sha256:310000:b818a636bbab41f61635ea14783846eb:4304208c24e0cf83b71c538f9cd14b8e46335c1c3a243ca4b4cba92f059085b4',
  TRUE, NOW(), NOW()
)
ON CONFLICT (tenant_id, lower(portal_username)) WHERE portal_username IS NOT NULL DO UPDATE SET
  client_id = EXCLUDED.client_id, email = EXCLUDED.email, status = 'aktiv',
  modules_enabled = EXCLUDED.modules_enabled, two_factor_enabled = FALSE,
  portal_access_code_hash = EXCLUDED.portal_access_code_hash, portal_enabled = TRUE,
  code_rotated_at = NOW(), updated_at = NOW();

INSERT INTO public.client_portal_settings (
  id, tenant_id, client_id, portal_enabled, inherit_tenant_defaults,
  show_appointments, show_messages, show_documents, show_proofs, show_budget,
  show_visit_tracking, metadata
)
VALUES (
  'c5000000-0000-4000-8000-000000000103',
  'c5000000-0000-4000-8000-000000000001',
  'c5000000-0000-4000-8000-000000000020', TRUE, FALSE,
  TRUE, TRUE, TRUE, TRUE, TRUE, FALSE,
  '{"reviewAccount":true,"synthetic":true}'::jsonb
)
ON CONFLICT (tenant_id, client_id) DO UPDATE SET
  portal_enabled = TRUE, inherit_tenant_defaults = FALSE,
  show_appointments = TRUE, show_messages = TRUE, show_documents = TRUE,
  show_proofs = TRUE, show_budget = TRUE, show_visit_tracking = FALSE,
  metadata = EXCLUDED.metadata, updated_at = NOW();

-- Relative schedule: completed history plus upcoming appointments for both portals.
INSERT INTO public.assist_visits (
  id, tenant_id, client_id, employee_id, service_key, service_name, title, description,
  assignment_date, planned_start_at, planned_end_at, duration_minutes,
  actual_start_at, actual_end_at, on_the_way_at, arrived_at, finished_at,
  address_snapshot, location_notes, employee_notes, client_visible_notes,
  planning_status, execution_status, documentation_status, proof_status,
  billing_status, portal_status, canonical_status, portal_release_enabled,
  portal_released_at, employee_portal_visible, budget_amount_cents
)
VALUES
  ('c5000000-0000-4000-8000-000000000080', 'c5000000-0000-4000-8000-000000000001',
   'c5000000-0000-4000-8000-000000000020', 'c5000000-0000-4000-8000-000000000010',
   'alltagsbegleitung', 'Alltagsbegleitung', 'Alltagsbegleitung und Spaziergang',
   'Gemeinsamer Spaziergang und Unterstützung im Haushalt.', CURRENT_DATE - 3,
   (CURRENT_DATE - 3) + TIME '09:00', (CURRENT_DATE - 3) + TIME '10:30', 90,
   (CURRENT_DATE - 3) + TIME '09:02', (CURRENT_DATE - 3) + TIME '10:28',
   (CURRENT_DATE - 3) + TIME '08:38', (CURRENT_DATE - 3) + TIME '08:58',
   (CURRENT_DATE - 3) + TIME '10:28', 'Rosenweg 24, 10119 Berlin',
   'Bitte klingeln.', 'Einsatz vollständig dokumentiert.',
   'Vielen Dank – der Einsatz wurde erfolgreich abgeschlossen.',
   'released', 'completed', 'complete', 'approved', 'ready', 'released', 'completed',
   TRUE, NOW() - INTERVAL '3 days', TRUE, 5400),
  ('c5000000-0000-4000-8000-000000000081', 'c5000000-0000-4000-8000-000000000001',
   'c5000000-0000-4000-8000-000000000020', 'c5000000-0000-4000-8000-000000000010',
   'haushalt', 'Haushaltshilfe', 'Haushalt und Einkauf',
   'Unterstützung im Haushalt und kleiner Einkauf.', CURRENT_DATE,
   CURRENT_DATE + TIME '09:30', CURRENT_DATE + TIME '11:00', 90,
   NULL, NULL, NULL, NULL, NULL, 'Rosenweg 24, 10119 Berlin',
   'Einkaufsliste liegt in der Küche.', 'Bitte Einkaufstasche mitnehmen.',
   'Geplant: Haushalt und gemeinsamer Einkauf.',
   'released', 'pending', 'none', 'none', 'none', 'released', 'planned',
   TRUE, NOW(), TRUE, 5400),
  ('c5000000-0000-4000-8000-000000000082', 'c5000000-0000-4000-8000-000000000001',
   'c5000000-0000-4000-8000-000000000021', 'c5000000-0000-4000-8000-000000000010',
   'begleitung', 'Arztbegleitung', 'Begleitung zum Arzttermin',
   'Begleitung zur Hausarztpraxis.', CURRENT_DATE + 1,
   (CURRENT_DATE + 1) + TIME '13:00', (CURRENT_DATE + 1) + TIME '14:30', 90,
   NULL, NULL, NULL, NULL, NULL, 'Parkstraße 7, 10178 Berlin',
   'Unterlagen liegen auf der Kommode.', 'Versichertenkarte prüfen.',
   'Geplanter Begleittermin.', 'released', 'pending', 'none', 'none', 'none',
   'released', 'planned', TRUE, NOW(), TRUE, 7200),
  ('c5000000-0000-4000-8000-000000000083', 'c5000000-0000-4000-8000-000000000001',
   'c5000000-0000-4000-8000-000000000020', 'c5000000-0000-4000-8000-000000000010',
   'alltagsbegleitung', 'Alltagsbegleitung', 'Aktivierung und Gesellschaft',
   'Gespräch, Aktivierung und gemeinsames Kaffeetrinken.', CURRENT_DATE + 3,
   (CURRENT_DATE + 3) + TIME '10:00', (CURRENT_DATE + 3) + TIME '11:30', 90,
   NULL, NULL, NULL, NULL, NULL, 'Rosenweg 24, 10119 Berlin',
   'Bitte klingeln.', 'Material für Gedächtnistraining mitnehmen.',
   'Geplant: Aktivierung und Gesellschaft.', 'released', 'pending', 'none', 'none',
   'none', 'released', 'planned', TRUE, NOW(), TRUE, 5400),
  ('c5000000-0000-4000-8000-000000000084', 'c5000000-0000-4000-8000-000000000001',
   'c5000000-0000-4000-8000-000000000022', 'c5000000-0000-4000-8000-000000000010',
   'haushalt', 'Haushaltshilfe', 'Wohnungsunterstützung',
   'Unterstützung bei Wäsche und Wohnungsordnung.', CURRENT_DATE + 5,
   (CURRENT_DATE + 5) + TIME '08:30', (CURRENT_DATE + 5) + TIME '10:00', 90,
   NULL, NULL, NULL, NULL, NULL, 'Lindenallee 31, 10557 Berlin',
   'Aufzug bis zur dritten Etage.', 'Wäscheplan beachten.',
   'Geplanter Unterstützungstermin.', 'released', 'pending', 'none', 'none',
   'none', 'released', 'planned', TRUE, NOW(), TRUE, 5400),
  ('c5000000-0000-4000-8000-000000000085', 'c5000000-0000-4000-8000-000000000001',
   'c5000000-0000-4000-8000-000000000020', 'c5000000-0000-4000-8000-000000000010',
   'begleitung', 'Alltagsbegleitung', 'Wochenplanung und Einkauf',
   'Wochenplanung, Einkauf und kurzer Spaziergang.', CURRENT_DATE + 8,
   (CURRENT_DATE + 8) + TIME '09:30', (CURRENT_DATE + 8) + TIME '11:30', 120,
   NULL, NULL, NULL, NULL, NULL, 'Rosenweg 24, 10119 Berlin',
   'Bitte klingeln.', 'Einkaufsbudget prüfen.',
   'Geplant: Wochenplanung und Einkauf.', 'released', 'pending', 'none', 'none',
   'none', 'released', 'planned', TRUE, NOW(), TRUE, 7200)
ON CONFLICT (id) DO UPDATE SET
  assignment_date = EXCLUDED.assignment_date,
  planned_start_at = EXCLUDED.planned_start_at,
  planned_end_at = EXCLUDED.planned_end_at,
  actual_start_at = EXCLUDED.actual_start_at,
  actual_end_at = EXCLUDED.actual_end_at,
  employee_id = EXCLUDED.employee_id,
  planning_status = EXCLUDED.planning_status,
  execution_status = EXCLUDED.execution_status,
  canonical_status = EXCLUDED.canonical_status,
  portal_release_enabled = TRUE,
  employee_portal_visible = TRUE,
  updated_at = NOW();

INSERT INTO public.assist_visit_tasks (
  id, tenant_id, visit_id, title, status, is_required, sort_order
)
VALUES
  ('c5000000-0000-4000-8000-000000000086', 'c5000000-0000-4000-8000-000000000001', 'c5000000-0000-4000-8000-000000000081', 'Einkaufsliste abstimmen', 'open', TRUE, 1),
  ('c5000000-0000-4000-8000-000000000087', 'c5000000-0000-4000-8000-000000000001', 'c5000000-0000-4000-8000-000000000081', 'Haushalt unterstützen', 'open', TRUE, 2),
  ('c5000000-0000-4000-8000-000000000088', 'c5000000-0000-4000-8000-000000000001', 'c5000000-0000-4000-8000-000000000080', 'Spaziergang durchführen', 'done', TRUE, 1)
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, updated_at = NOW();

-- Released proof plus readable intake document for the client portal.
INSERT INTO public.assist_visit_proofs (
  id, tenant_id, visit_id, proof_number, status, payload_snapshot, payload_hash,
  generated_at, approved_at, billing_released, metadata, portal_visible,
  released_to_portal_at, portal_release_status, approval_note
)
VALUES (
  'c5000000-0000-4000-8000-000000000090',
  'c5000000-0000-4000-8000-000000000001',
  'c5000000-0000-4000-8000-000000000080', 'LN-GP-2026-001', 'approved',
  '{"clientName":"Maria Muster","employeeName":"Anna Beispiel","service":"Alltagsbegleitung und Spaziergang","durationMinutes":86,"synthetic":true}'::jsonb,
  md5('LN-GP-2026-001'), NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days',
  TRUE, '{"reviewAccount":true}'::jsonb, TRUE, NOW() - INTERVAL '2 days',
  'released', 'Vollständig geprüft und für das Portal freigegeben.'
)
ON CONFLICT (id) DO UPDATE SET
  status = 'approved', portal_visible = TRUE, portal_release_status = 'released',
  released_to_portal_at = NOW(), updated_at = NOW();

INSERT INTO public.client_intake_documents (
  id, tenant_id, client_id, template_key, document_type, title, status,
  is_required, version, source, preview_html, finalized_html, missing_placeholders,
  preview_opened_at, finalized_at
)
VALUES (
  'c5000000-0000-4000-8000-000000000070',
  'c5000000-0000-4000-8000-000000000001',
  'c5000000-0000-4000-8000-000000000020',
  'google-play-betreuungsvertrag', 'vertrag', 'Betreuungsvertrag', 'finalized',
  TRUE, 1, 'tenant',
  '<h1>Betreuungsvertrag</h1><p>Prüfvorschau für Maria Muster.</p>',
  '<h1>Betreuungsvertrag</h1><p><strong>Maria Muster</strong></p><p>Vereinbart sind Alltagsbegleitung, Haushaltshilfe und Begleitdienste.</p><p>Dieses Dokument enthält ausschließlich synthetische Prüfdaten.</p>',
  '[]'::jsonb, NOW() - INTERVAL '60 days', NOW() - INTERVAL '60 days'
)
ON CONFLICT (tenant_id, client_id, template_key) DO UPDATE SET
  title = EXCLUDED.title, status = 'finalized', finalized_html = EXCLUDED.finalized_html,
  finalized_at = EXCLUDED.finalized_at, updated_at = NOW();

INSERT INTO public.client_documents (
  id, tenant_id, client_id, title, file_name, mime_type, category, storage_path,
  status, sensitivity, valid_until, size_bytes, source, module_visibility,
  portal_visible, intake_document_id, signature_required, signed_at, service_month
)
VALUES
  ('c5000000-0000-4000-8000-000000000071', 'c5000000-0000-4000-8000-000000000001',
   'c5000000-0000-4000-8000-000000000020', 'Betreuungsvertrag',
   'google-play-betreuungsvertrag.html', 'text/html', 'vertrag', NULL, 'aktiv',
   'care', CURRENT_DATE + 365, 2048, 'intake', ARRAY['client_portal'], TRUE,
   'c5000000-0000-4000-8000-000000000070', FALSE, NOW() - INTERVAL '60 days', NULL),
  ('c5000000-0000-4000-8000-000000000072', 'c5000000-0000-4000-8000-000000000001',
   'c5000000-0000-4000-8000-000000000020', 'Leistungsnachweis Alltagsbegleitung',
   'leistungsnachweis-gp-2026-001.pdf', 'application/pdf', 'leistungsnachweis', NULL,
   'aktiv', 'care', NULL, 8192, 'assist_visit_proof', ARRAY['client_portal'], TRUE,
   NULL, FALSE, NOW() - INTERVAL '3 days', TO_CHAR(CURRENT_DATE - 3, 'YYYY-MM'))
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, status = 'aktiv', portal_visible = TRUE,
  signature_required = FALSE, signed_at = EXCLUDED.signed_at, updated_at = NOW();

INSERT INTO public.employee_documents (
  id, tenant_id, employee_id, category, title, file_name, storage_path,
  sensitive, released_to_portal, valid_until
)
VALUES
  ('c5000000-0000-4000-8000-000000000073', 'c5000000-0000-4000-8000-000000000001',
   'c5000000-0000-4000-8000-000000000010', 'qualification',
   'Fortbildungsnachweis Alltagsbegleitung', 'fortbildung-alltagsbegleitung.pdf', NULL,
   FALSE, TRUE, CURRENT_DATE + 365),
  ('c5000000-0000-4000-8000-000000000074', 'c5000000-0000-4000-8000-000000000001',
   'c5000000-0000-4000-8000-000000000010', 'contract',
   'Arbeitsvertrag', 'arbeitsvertrag-anna-beispiel.pdf', NULL,
   TRUE, TRUE, NULL)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, released_to_portal = TRUE, updated_at = NOW();

-- Client budget and entitlement for the current review year.
INSERT INTO public.client_care_entitlement (
  id, tenant_id, client_id, care_grade, valid_from, conversion_enabled,
  care_fund_name, care_fund_member_id, notes, source, metadata
)
VALUES (
  'c5000000-0000-4000-8000-000000000091',
  'c5000000-0000-4000-8000-000000000001',
  'c5000000-0000-4000-8000-000000000020', 'pg3',
  DATE_TRUNC('year', CURRENT_DATE)::date, TRUE, 'Beispiel Pflegekasse', 'GP-471100',
  'Synthetischer Pflegegrad für die App-Prüfung.', 'review_seed',
  '{"synthetic":true}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  care_grade = 'pg3', valid_from = EXCLUDED.valid_from, updated_at = NOW();

INSERT INTO public.client_service_entitlements (
  id, tenant_id, client_id, service_type_key, billing_mode, is_active,
  valid_from, hourly_rate_cents, notes, metadata
)
VALUES (
  'c5000000-0000-4000-8000-000000000092',
  'c5000000-0000-4000-8000-000000000001',
  'c5000000-0000-4000-8000-000000000020', 'alltagsbegleitung', 'cost_carrier', TRUE,
  DATE_TRUNC('year', CURRENT_DATE)::date, 3600,
  'Entlastungsbetrag und Umwandlungsanspruch.', '{"synthetic":true}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  is_active = TRUE, valid_from = EXCLUDED.valid_from, hourly_rate_cents = 3600,
  updated_at = NOW();

INSERT INTO public.client_budget_accounts (
  id, tenant_id, client_id, catalog_key, catalog_year, period, period_start,
  period_end, allocated_cents, used_cents, reserved_cents, is_individual_override,
  billing_priority, status, notes, metadata
)
VALUES
  ('c5000000-0000-4000-8000-000000000093', 'c5000000-0000-4000-8000-000000000001',
   'c5000000-0000-4000-8000-000000000020', 'entlastungsbetrag',
   EXTRACT(YEAR FROM CURRENT_DATE)::int, 'monthly', DATE_TRUNC('month', CURRENT_DATE)::date,
   (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::date,
   13100, 5400, 3600, FALSE, 1, 'active', 'Monatlicher Entlastungsbetrag.',
   '{"label":"Entlastungsbetrag","synthetic":true}'::jsonb),
  ('c5000000-0000-4000-8000-000000000094', 'c5000000-0000-4000-8000-000000000001',
   'c5000000-0000-4000-8000-000000000020', 'verhinderungspflege',
   EXTRACT(YEAR FROM CURRENT_DATE)::int, 'yearly', DATE_TRUNC('year', CURRENT_DATE)::date,
   (DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year - 1 day')::date,
   168500, 43200, 7200, FALSE, 2, 'active', 'Jahresbudget Verhinderungspflege.',
   '{"label":"Verhinderungspflege","synthetic":true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  catalog_year = EXCLUDED.catalog_year, period_start = EXCLUDED.period_start,
  period_end = EXCLUDED.period_end, allocated_cents = EXCLUDED.allocated_cents,
  used_cents = EXCLUDED.used_cents, reserved_cents = EXCLUDED.reserved_cents,
  status = 'active', updated_at = NOW();

-- Separate employee and client conversations.
INSERT INTO public.message_threads (
  id, tenant_id, thread_type, status, priority, subject, client_id, employee_id,
  created_by_client_id, created_by_employee_id, last_message_at,
  last_message_preview, portal_unread_count
)
VALUES
  ('c5000000-0000-4000-8000-000000000050', 'c5000000-0000-4000-8000-000000000001',
   'employee', 'open', 'normal', 'Dienstplan und Rückfrage', NULL,
   'c5000000-0000-4000-8000-000000000010', NULL,
   'c5000000-0000-4000-8000-000000000010', NOW() - INTERVAL '2 hours',
   'Danke, der Termin ist bestätigt.', 1),
  ('c5000000-0000-4000-8000-000000000051', 'c5000000-0000-4000-8000-000000000001',
   'client', 'open', 'normal', 'Ihr nächster Betreuungstermin',
   'c5000000-0000-4000-8000-000000000020', NULL,
   'c5000000-0000-4000-8000-000000000020', NULL, NOW() - INTERVAL '3 hours',
   'Wir freuen uns auf den nächsten Termin.', 1)
ON CONFLICT (id) DO UPDATE SET
  status = 'open', last_message_at = EXCLUDED.last_message_at,
  last_message_preview = EXCLUDED.last_message_preview,
  portal_unread_count = EXCLUDED.portal_unread_count, updated_at = NOW();

INSERT INTO public.messages (
  id, tenant_id, thread_id, body, is_internal_note, is_system_message,
  sender_client_id, sender_employee_id, sent_at, read_at, status
)
VALUES
  ('c5000000-0000-4000-8000-000000000060', 'c5000000-0000-4000-8000-000000000001',
   'c5000000-0000-4000-8000-000000000050',
   'Ihr Dienstplan für diese Woche wurde aktualisiert.', FALSE, TRUE, NULL, NULL,
   NOW() - INTERVAL '1 day', NOW() - INTERVAL '20 hours', 'sent'),
  ('c5000000-0000-4000-8000-000000000061', 'c5000000-0000-4000-8000-000000000001',
   'c5000000-0000-4000-8000-000000000050',
   'Danke, der Termin ist bestätigt.', FALSE, FALSE, NULL,
   'c5000000-0000-4000-8000-000000000010', NOW() - INTERVAL '2 hours', NULL, 'sent'),
  ('c5000000-0000-4000-8000-000000000062', 'c5000000-0000-4000-8000-000000000001',
   'c5000000-0000-4000-8000-000000000051',
   'Guten Tag Frau Muster, Anna Beispiel kommt zum vereinbarten Termin.',
   FALSE, TRUE, NULL, NULL, NOW() - INTERVAL '1 day', NOW() - INTERVAL '20 hours', 'sent'),
  ('c5000000-0000-4000-8000-000000000063', 'c5000000-0000-4000-8000-000000000001',
   'c5000000-0000-4000-8000-000000000051',
   'Vielen Dank. Wir freuen uns auf den Termin.', FALSE, FALSE,
   'c5000000-0000-4000-8000-000000000020', NULL, NOW() - INTERVAL '3 hours', NULL, 'sent')
ON CONFLICT (id) DO UPDATE SET body = EXCLUDED.body, sent_at = EXCLUDED.sent_at, updated_at = NOW();

-- Employee time, absence and payroll.
INSERT INTO public.employee_time_entries (
  id, tenant_id, employee_id, entry_type, period_date, started_at, ended_at,
  gross_minutes, pause_minutes, net_minutes, travel_minutes, paid_minutes,
  unpaid_minutes, planned_minutes, deviation_minutes, status,
  plausibility_flags, trace_reference
)
VALUES
  ('c5000000-0000-4000-8000-000000000110', 'c5000000-0000-4000-8000-000000000001',
   'c5000000-0000-4000-8000-000000000010', 'assignment_time', CURRENT_DATE - 3,
   (CURRENT_DATE - 3) + TIME '09:02', (CURRENT_DATE - 3) + TIME '10:28',
   86, 0, 86, 0, 86, 0, 90, -4, 'approved', '[]'::jsonb, 'GP-ASSIGNMENT-001'),
  ('c5000000-0000-4000-8000-000000000111', 'c5000000-0000-4000-8000-000000000001',
   'c5000000-0000-4000-8000-000000000010', 'travel_time', CURRENT_DATE - 3,
   (CURRENT_DATE - 3) + TIME '08:35', (CURRENT_DATE - 3) + TIME '08:58',
   23, 0, 23, 23, 23, 0, 25, -2, 'approved', '[]'::jsonb, 'GP-TRAVEL-001'),
  ('c5000000-0000-4000-8000-000000000112', 'c5000000-0000-4000-8000-000000000001',
   'c5000000-0000-4000-8000-000000000010', 'admin_time', CURRENT_DATE - 2,
   (CURRENT_DATE - 2) + TIME '15:00', (CURRENT_DATE - 2) + TIME '16:00',
   60, 0, 60, 0, 60, 0, 60, 0, 'approved', '[]'::jsonb, 'GP-ADMIN-001')
ON CONFLICT (id) DO UPDATE SET
  period_date = EXCLUDED.period_date, started_at = EXCLUDED.started_at,
  ended_at = EXCLUDED.ended_at, status = 'approved', updated_at = NOW();

INSERT INTO public.workforce_absences (
  id, tenant_id, employee_id, absence_type, status, starts_at, ends_at,
  all_day, requested_days, employee_note, internal_note
)
VALUES
  ('c5000000-0000-4000-8000-000000000113', 'c5000000-0000-4000-8000-000000000001',
   'c5000000-0000-4000-8000-000000000010', 'vacation', 'approved',
   (CURRENT_DATE + 21)::timestamptz, (CURRENT_DATE + 23 + TIME '23:59')::timestamptz,
   TRUE, 3.0, 'Geplanter Kurzurlaub.', 'Für den Prüfzugang freigegeben.'),
  ('c5000000-0000-4000-8000-000000000114', 'c5000000-0000-4000-8000-000000000001',
   'c5000000-0000-4000-8000-000000000010', 'training', 'completed',
   (CURRENT_DATE - 30)::timestamptz, (CURRENT_DATE - 30 + TIME '16:00')::timestamptz,
   TRUE, 1.0, 'Fortbildung Alltagsbegleitung.', 'Erfolgreich abgeschlossen.')
ON CONFLICT (id) DO UPDATE SET
  starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at,
  status = EXCLUDED.status, updated_at = NOW();

INSERT INTO public.employee_payroll_settings (
  id, tenant_id, employee_id, compensation_type, compensation_amount,
  payout_interval, payout_method, bank_name, account_holder,
  max_payout_hours_month, overflow_to_time_account, mileage_rate_cents,
  payroll_notes
)
VALUES (
  'c5000000-0000-4000-8000-000000000115',
  'c5000000-0000-4000-8000-000000000001',
  'c5000000-0000-4000-8000-000000000010',
  'hourly', 18.50, 'monthly', 'transfer', 'Beispielbank', 'Anna Beispiel',
  130.00, TRUE, 30, 'Synthetische Abrechnungsdaten für die App-Prüfung.'
)
ON CONFLICT (tenant_id, employee_id) DO UPDATE SET
  compensation_type = 'hourly', compensation_amount = 18.50,
  max_payout_hours_month = 130.00, mileage_rate_cents = 30,
  payroll_notes = EXCLUDED.payroll_notes, updated_at = NOW();

INSERT INTO public.employee_expense_claims (
  id, tenant_id, employee_id, expense_date, category, description,
  amount_cents, approved_amount_cents, currency, client_id, payment_method,
  receipt_number, business_purpose, tax_treatment, status, office_note,
  submitted_at, reviewed_at
)
VALUES (
  'c5000000-0000-4000-8000-000000000116',
  'c5000000-0000-4000-8000-000000000001',
  'c5000000-0000-4000-8000-000000000010', CURRENT_DATE - 3,
  'parking', 'Parkgebühr während des Betreuungseinsatzes', 450, 450, 'EUR',
  'c5000000-0000-4000-8000-000000000020', 'private_card', 'GP-PARK-001',
  'Betreuungseinsatz bei Maria Muster', 'reimbursement', 'approved',
  'Für die Erstattung freigegeben.', NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days'
)
ON CONFLICT (id) DO UPDATE SET
  expense_date = EXCLUDED.expense_date, status = 'approved',
  approved_amount_cents = 450, updated_at = NOW();

INSERT INTO public.payroll_month_statements (
  id, tenant_id, employee_id, period_year, period_month, version, status,
  snapshot_json, actual_work_minutes, travel_minutes, paid_absence_minutes,
  planned_minutes, payable_minutes, overtime_transfer_minutes,
  earned_gross_cents, projected_gross_cents, approved_expenses_cents,
  projected_payout_cents, published_at
)
VALUES (
  'c5000000-0000-4000-8000-000000000117',
  'c5000000-0000-4000-8000-000000000001',
  'c5000000-0000-4000-8000-000000000010',
  EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM CURRENT_DATE)::int, 1, 'published',
  jsonb_build_object(
    'employeeId', 'c5000000-0000-4000-8000-000000000010',
    'employeeName', 'Anna Beispiel', 'employeeNumber', 'GP-1001',
    'periodYear', EXTRACT(YEAR FROM CURRENT_DATE)::int,
    'periodMonth', EXTRACT(MONTH FROM CURRENT_DATE)::int,
    'compensationType', 'hourly', 'hourlyRateCents', 1850, 'fixedSalaryCents', 0,
    'maxPayoutMinutes', 7800, 'actualWorkMinutes', 5240, 'travelMinutes', 420,
    'vacationMinutes', 0, 'sickMinutes', 0, 'otherPaidAbsenceMinutes', 0,
    'targetWorkMinutes', 7200, 'creditedActualMinutes', 5660,
    'targetActualDifferenceMinutes', -1540, 'monthlyPlannedMinutes', 7200,
    'plannedMinutes', 1540, 'payableMinutes', 5660, 'overtimeTransferMinutes', 0,
    'timeAccountBalanceMinutes', 180, 'earnedGrossCents', 161566,
    'projectedGrossCents', 209050, 'approvedExpensesCents', 450,
    'pendingExpensesCents', 0, 'advancesCents', 0, 'deductionsCents', 0,
    'payoutGrossCents', 162016, 'projectedTotalPayoutCents', 209500,
    'generatedAt', NOW(), 'expenseClaims', '[]'::jsonb
  ),
  5240, 420, 0, 1540, 5660, 0, 161566, 209050, 450, 209500, NOW()
)
ON CONFLICT (tenant_id, employee_id, period_year, period_month, version) DO UPDATE SET
  status = 'published', snapshot_json = EXCLUDED.snapshot_json,
  actual_work_minutes = EXCLUDED.actual_work_minutes,
  travel_minutes = EXCLUDED.travel_minutes,
  planned_minutes = EXCLUDED.planned_minutes,
  payable_minutes = EXCLUDED.payable_minutes,
  earned_gross_cents = EXCLUDED.earned_gross_cents,
  projected_gross_cents = EXCLUDED.projected_gross_cents,
  approved_expenses_cents = EXCLUDED.approved_expenses_cents,
  projected_payout_cents = EXCLUDED.projected_payout_cents,
  published_at = NOW(), updated_at = NOW();

-- GPS/logbook demo history. Only consent is enabled; no background service starts here.
INSERT INTO public.employee_logbook_vehicles (
  id, tenant_id, employee_id, ownership, plate, make, model, active
)
VALUES (
  'c5000000-0000-4000-8000-000000000030',
  'c5000000-0000-4000-8000-000000000001',
  'c5000000-0000-4000-8000-000000000010',
  'private', 'B CS 2026', 'Volkswagen', 'Golf', TRUE
)
ON CONFLICT (id) DO UPDATE SET plate = EXCLUDED.plate, make = EXCLUDED.make,
  model = EXCLUDED.model, active = TRUE, updated_at = NOW();

INSERT INTO public.employee_logbook_profiles (
  id, tenant_id, employee_id, default_vehicle_id, mileage_rate_cents,
  gps_consent, gps_consent_at
)
VALUES (
  'c5000000-0000-4000-8000-000000000031',
  'c5000000-0000-4000-8000-000000000001',
  'c5000000-0000-4000-8000-000000000010',
  'c5000000-0000-4000-8000-000000000030', 30, TRUE, NOW() - INTERVAL '90 days'
)
ON CONFLICT (tenant_id, employee_id) DO UPDATE SET
  default_vehicle_id = EXCLUDED.default_vehicle_id, mileage_rate_cents = 30,
  gps_consent = TRUE, gps_consent_at = EXCLUDED.gps_consent_at, updated_at = NOW();

INSERT INTO public.employee_logbook_trips (
  id, tenant_id, employee_id, client_id, vehicle_id, route_type, purpose,
  manual_reason, status, started_at, ended_at, start_address, end_address,
  start_latitude, start_longitude, end_latitude, end_longitude,
  distance_gps_km, distance_final_km, duration_seconds, counts_as_work_time,
  mileage_rate_cents, mileage_amount_cents, gps_captured, navigation_provider,
  source, notes
)
VALUES
  ('c5000000-0000-4000-8000-000000000040', 'c5000000-0000-4000-8000-000000000001',
   'c5000000-0000-4000-8000-000000000010', 'c5000000-0000-4000-8000-000000000020',
   'c5000000-0000-4000-8000-000000000030', 'home_to_client', 'Anfahrt zu Maria Muster',
   'Google-Play-Prüffahrt', 'confirmed', (CURRENT_DATE - 3) + TIME '08:25',
   (CURRENT_DATE - 3) + TIME '08:55', 'Beispielstraße 8, 10117 Berlin',
   'Rosenweg 24, 10119 Berlin', 52.5201000, 13.3889000, 52.5296000, 13.4012000,
   6.20, 6.20, 1800, TRUE, 30, 186, TRUE, 'google', 'Vollständig synthetische GPS-Prüffahrt.'),
  ('c5000000-0000-4000-8000-000000000041', 'c5000000-0000-4000-8000-000000000001',
   'c5000000-0000-4000-8000-000000000010', 'c5000000-0000-4000-8000-000000000020',
   'c5000000-0000-4000-8000-000000000030', 'with_client', 'Begleitfahrt zum Einkauf',
   'Google-Play-Prüffahrt', 'confirmed', (CURRENT_DATE - 3) + TIME '09:35',
   (CURRENT_DATE - 3) + TIME '09:52', 'Rosenweg 24, 10119 Berlin',
   'Marktplatz 2, 10119 Berlin', 52.5296000, 13.4012000, 52.5320000, 13.4070000,
   2.80, 2.80, 1020, TRUE, 30, 84, TRUE, 'google', 'Begleitfahrt während des Einsatzes.'),
  ('c5000000-0000-4000-8000-000000000042', 'c5000000-0000-4000-8000-000000000001',
   'c5000000-0000-4000-8000-000000000010', 'c5000000-0000-4000-8000-000000000020',
   'c5000000-0000-4000-8000-000000000030', 'client_to_home', 'Rückfahrt nach Einsatzende',
   'Google-Play-Prüffahrt', 'confirmed', (CURRENT_DATE - 3) + TIME '10:32',
   (CURRENT_DATE - 3) + TIME '11:04', 'Rosenweg 24, 10119 Berlin',
   'Beispielstraße 8, 10117 Berlin', 52.5296000, 13.4012000, 52.5201000, 13.3889000,
   6.40, 6.40, 1920, TRUE, 30, 192, TRUE, 'google',
   'Rückfahrt läuft bewusst nach dem Einsatzende weiter.')
ON CONFLICT (id) DO UPDATE SET
  started_at = EXCLUDED.started_at, ended_at = EXCLUDED.ended_at,
  status = 'confirmed', distance_gps_km = EXCLUDED.distance_gps_km,
  distance_final_km = EXCLUDED.distance_final_km,
  mileage_amount_cents = EXCLUDED.mileage_amount_cents,
  gps_captured = TRUE, notes = EXCLUDED.notes, updated_at = NOW();

COMMIT;
