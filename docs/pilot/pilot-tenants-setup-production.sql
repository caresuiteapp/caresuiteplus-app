-- =============================================================================
-- CareSuite+ — Pilot-Mandanten für caresuiteplus-production (FlutterFlow-Schema)
-- Ausführen NACH RN-Migrationen (communication_*, ti_*)
-- Kein TRUNCATE/DROP — nur INSERT mit ON CONFLICT
-- =============================================================================

INSERT INTO public.tenants (id, name, legal_form, phone, email, city, country)
VALUES
  ('11111111-1111-1111-1111-111111111101', 'SonnenPflege Ambulant Köln', 'GmbH', '+49 221 1000001', 'kontakt@sonnenpflege-koeln.de', 'Köln', 'Deutschland'),
  ('11111111-1111-1111-1111-111111111102', 'Herzlich Zuhause Pflege Düsseldorf', 'GmbH', '+49 211 1000002', 'kontakt@herzlich-duesseldorf.de', 'Düsseldorf', 'Deutschland'),
  ('11111111-1111-1111-1111-111111111103', 'PflegeEngel Bonn', 'GmbH', '+49 228 1000003', 'kontakt@pflegeengel-bonn.de', 'Bonn', 'Deutschland')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  updated_at = NOW();

INSERT INTO public.communication_settings (tenant_id, center_enabled, client_portal_enabled, employee_portal_enabled)
SELECT id, true, true, true FROM public.tenants
WHERE id IN (
  '11111111-1111-1111-1111-111111111101',
  '11111111-1111-1111-1111-111111111102',
  '11111111-1111-1111-1111-111111111103'
)
ON CONFLICT (tenant_id) DO NOTHING;

-- Auth-User + profiles.tenant_id: Supabase Dashboard → Authentication → Users
-- Dann profiles.auth_user_id = user.id und profiles.tenant_id = Pilot-Mandant
