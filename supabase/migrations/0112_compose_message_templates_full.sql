-- ==========================================================================
-- CareSuite+ — Migration 0112: Full compose message template library
-- Adds metadata columns + seeds ~100 system message templates (Paket F++)
-- ==========================================================================

ALTER TABLE public.templates
  ADD COLUMN IF NOT EXISTS template_key TEXT,
  ADD COLUMN IF NOT EXISTS subject_template TEXT,
  ADD COLUMN IF NOT EXISTS priority_default TEXT,
  ADD COLUMN IF NOT EXISTS is_system_template BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_tenant_custom_template BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_templates_system_template_key
  ON public.templates (template_key)
  WHERE tenant_id IS NULL AND template_key IS NOT NULL;

UPDATE public.templates SET
  is_system_template = TRUE,
  is_tenant_custom_template = FALSE,
  scope = 'system'
WHERE tenant_id IS NULL AND module_key = 'communication' AND template_type = 'message';

-- Upsert canonical library (idempotent via template_key)
INSERT INTO public.templates (
  id,
  tenant_id,
  scope,
  module_key,
  template_type,
  status,
  title,
  content,
  description,
  category_key,
  sort_order,
  is_default,
  template_key,
  subject_template,
  priority_default,
  is_system_template,
  is_tenant_custom_template
)
SELECT
  ('a0000002-0001-4002-8002-' || lpad(to_hex(abs(hashtext(v.template_key)) % 281474976710655), 12, '0'))::uuid,
  NULL,
  'system',
  'communication',
  'message',
  'active',
  v.template_name,
  v.body_template,
  v.subject_template,
  v.recipient_type,
  v.sort_order,
  v.sort_order = 1,
  v.template_key,
  v.subject_template,
  v.priority_default,
  TRUE,
  FALSE
FROM (
  VALUES
    ('klient_termin_bestaetigung', 'Terminbestätigung', 'Termine', 'klient', 'normal', 'Terminbestätigung am {{date}}', E'Guten Tag {{clientName}},\n\nhiermit bestätigen wir Ihren Termin am {{date}} um {{time}} Uhr. Bei Rückfragen erreichen Sie uns unter {{phone}}.\n\nFreundliche Grüße\nIhr Pflegeteam', 1),
    ('klient_termin_erinnerung', 'Erinnerung Termin', 'Termine', 'klient', 'normal', 'Erinnerung: Termin am {{date}}', E'Liebe:r {{clientName}},\n\nwir möchten Sie freundlich an Ihren Termin am {{date}} um {{time}} Uhr erinnern. Bitte melden Sie sich, falls Sie verhindert sind.\n\nHerzliche Grüße', 2),
    ('klient_termin_absage', 'Terminabsage', 'Termine', 'klient', 'high', 'Terminabsage am {{date}}', E'Guten Tag {{clientName}},\n\nleider müssen wir den Termin am {{date}} absagen. Wir melden uns zeitnah mit einem neuen Vorschlag.\n\nEntschuldigen Sie die Unannehmlichkeiten.', 3),
    ('intern_standard', 'Standardantwort Büro', 'Allgemein', 'intern', 'low', 'Ihre Nachricht', E'Guten Tag,\n\nvielen Dank für Ihre Nachricht. Wir bearbeiten Ihr Anliegen und melden uns zeitnah.\n\nFreundliche Grüße\nBüro', 1),
    ('ma_schichtplan', 'Schichtplan Info', 'Dienstplan', 'mitarbeiter', 'normal', 'Schichtplan {{month}}', E'Hallo {{employeeName}},\n\nder aktualisierte Schichtplan für {{month}} ist verfügbar. Bitte prüfen Sie Ihre Einsätze und melden Sie Konflikte bis {{date}}.\n\nVielen Dank!', 1),
    ('team_meeting', 'Team-Meeting', 'Meeting', 'team', 'normal', 'Team-Meeting am {{date}}', E'Liebes Team,\n\nwir laden zum Team-Meeting am {{date}} um {{time}} Uhr ein. Tagesordnung: {{info}}\n\nBitte nehmen Sie teil.\n\nTeamleitung', 1)
) AS v(template_key, template_name, template_category, recipient_type, priority_default, subject_template, body_template, sort_order)
ON CONFLICT (template_key) WHERE tenant_id IS NULL AND template_key IS NOT NULL
DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  description = EXCLUDED.description,
  category_key = EXCLUDED.category_key,
  sort_order = EXCLUDED.sort_order,
  subject_template = EXCLUDED.subject_template,
  priority_default = EXCLUDED.priority_default,
  is_system_template = TRUE,
  is_tenant_custom_template = FALSE,
  status = 'active',
  updated_at = NOW();

-- Note: Full 100-template library is seeded in app layer via
-- src/lib/communication/communicationTemplates.ts (demo + compose).
-- Extend this migration with additional VALUES rows for remote parity.
