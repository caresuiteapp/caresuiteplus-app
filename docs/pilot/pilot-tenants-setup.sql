-- =============================================================================
-- CareSuite+ — Pilot-Mandanten Setup (3 ambulante Pflegedienste NRW)
-- Ausführen NACH Migrationen 0001–0012 auf der Remote-DB
-- Kein TRUNCATE/DROP — nur INSERT mit ON CONFLICT
-- =============================================================================

-- Mandanten anlegen
INSERT INTO public.tenants (id, name, slug, legal_form, industry, phone, email)
VALUES
  ('11111111-1111-1111-1111-111111111101', 'SonnenPflege Ambulant Köln', 'sonnenpflege-koeln', 'GmbH', 'Ambulanter Pflegedienst', '+49 221 1000001', 'kontakt@sonnenpflege-koeln.de'),
  ('11111111-1111-1111-1111-111111111102', 'Herzlich Zuhause Pflege Düsseldorf', 'herzlich-duesseldorf', 'GmbH', 'Ambulanter Pflegedienst', '+49 211 1000002', 'kontakt@herzlich-duesseldorf.de'),
  ('11111111-1111-1111-1111-111111111103', 'PflegeEngel Bonn', 'pflegeengel-bonn', 'GmbH', 'Ambulanter Pflegedienst', '+49 228 1000003', 'kontakt@pflegeengel-bonn.de')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  updated_at = NOW();

-- Communication Settings je Mandant (Defaults)
INSERT INTO public.communication_settings (tenant_id, center_enabled, client_portal_enabled, employee_portal_enabled)
SELECT id, true, true, true FROM public.tenants
WHERE id IN (
  '11111111-1111-1111-1111-111111111101',
  '11111111-1111-1111-1111-111111111102',
  '11111111-1111-1111-1111-111111111103'
)
ON CONFLICT (tenant_id) DO NOTHING;

-- Hinweis: Auth-User + profiles.tenant_id manuell im Supabase Dashboard anlegen
-- oder via supabase auth admin (service_role nur serverseitig, NICHT in der App)
--
-- Deployment:
--   supabase link --project-ref <ref>
--   supabase db push
--
-- ENV für Live-Pilot (.env):
--   EXPO_PUBLIC_DEMO_MODE=false
--   EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
--   EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
