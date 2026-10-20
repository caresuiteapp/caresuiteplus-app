-- ==========================================================================
-- CareSuite+ — Migration 0004: Demo-Seed (Arbeitspaket 011)
-- Voraussetzung: 0001, 0002, 0003
-- Nur INSERT/ON CONFLICT — keine DROP/TRUNCATE/DELETE
-- Profile erfordern auth.users — werden in der App per Demo-Login simuliert.
-- UUIDs synchron mit src/data/demo/uuidMap.ts
-- ==========================================================================

INSERT INTO public.tenants (id, name, slug, legal_form, industry, phone, email, website)
VALUES (
  'a0000000-0000-4000-8000-000000000001',
  'CareSuite+ Demo',
  'demo',
  'GmbH',
  'Ambulanter Pflegedienst',
  '+49 30 12345678',
  'kontakt@demo.caresuiteplus.app',
  'https://demo.caresuiteplus.app'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tenant_addresses (id, tenant_id, street, zip, city, state, country)
VALUES (
  'a0000000-0000-4000-8000-000000000002',
  'a0000000-0000-4000-8000-000000000001',
  'Musterstraße 12',
  '10115',
  'Berlin',
  'Berlin',
  'Deutschland'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tenant_contacts (id, tenant_id, first_name, last_name, role, phone, email, is_primary)
VALUES (
  'a0000000-0000-4000-8000-000000000003',
  'a0000000-0000-4000-8000-000000000001',
  'Sabine',
  'Muster',
  'Geschäftsführung',
  '+49 30 12345679',
  'sabine.muster@demo.caresuiteplus.app',
  TRUE
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tenant_subscriptions (
  id, tenant_id, status, plan_key, trial_ends_at, current_period_start, current_period_end
)
VALUES (
  'a0000000-0000-4000-8000-000000000004',
  'a0000000-0000-4000-8000-000000000001',
  'trialing',
  'professional',
  '2026-09-01T00:00:00Z',
  '2026-03-01T00:00:00Z',
  '2026-04-01T00:00:00Z'
)
ON CONFLICT (id) DO NOTHING;

-- Module für Demo-Mandant aktivieren
INSERT INTO public.tenant_products (tenant_id, product_id, is_active)
SELECT
  'a0000000-0000-4000-8000-000000000001',
  p.id,
  p.key != 'stationaer'
FROM public.products p
ON CONFLICT (tenant_id, product_id) DO NOTHING;

-- Klient:innen — alle Workflow-Status (synchron mit src/data/demo/clients.ts)
INSERT INTO public.clients (
  id, tenant_id, first_name, last_name, care_level, status, city, zip, sensitivity, visibility
) VALUES
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Helga',    'Schneider', 'PG 2', 'aktiv',          'Berlin',                '10115', 'care',       'team'),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Werner',   'Müller',    'PG 3', 'aktiv',          'Berlin',                '10437', 'health',     'team'),
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'Maria',    'Wagner',    'PG 1', 'in_bearbeitung', 'Potsdam',               '14467', 'care',       'team'),
  ('b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'Friedrich','Bauer',     NULL,   'entwurf',        'Berlin',                '12043', 'internal',   'team'),
  ('b0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'Ingrid',   'Hoffmann',  'PG 4', 'aktiv',          'Berlin',                '13347', 'health',     'team'),
  ('b0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001', 'Klaus',    'Richter',   'PG 2', 'abgeschlossen',  'Oranienburg',           '16515', 'care',       'team'),
  ('b0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000001', 'Ursula',   'Klein',     'PG 3', 'archiviert',     'Berlin',                '10999', 'care',       'team'),
  ('b0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000001', 'Hans',     'Neumann',   'PG 2', 'fehlerhaft',     'Bernau',                '16321', 'internal',   'team'),
  ('b0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000001', 'Gertrud',  'Scholz',    'PG 5', 'gesperrt',       'Berlin',                '10179', 'restricted', 'own'),
  ('b0000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-000000000001', 'Peter',    'Lang',      'PG 1', 'aktiv',          'Königs Wusterhausen',   '15711', 'care',       'team'),
  ('b0000000-0000-4000-8000-00000000000b', 'a0000000-0000-4000-8000-000000000001', 'Elisabeth','Fischer',   'PG 2', 'aktiv',          'Berlin',                '12203', 'care',       'team'),
  ('b0000000-0000-4000-8000-00000000000c', 'a0000000-0000-4000-8000-000000000001', 'Otto',     'Weber',     'PG 3', 'in_bearbeitung', 'Falkensee',             '14612', 'health',     'team')
ON CONFLICT (id) DO NOTHING;

-- Beispiel-Kontakt & Freigabe für Helga Schneider
INSERT INTO public.client_contacts (tenant_id, client_id, name, relationship, phone, is_emergency)
VALUES (
  'a0000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000001',
  'Karin Schneider',
  'Tochter',
  '+49 170 4567890',
  TRUE
)
ON CONFLICT DO NOTHING;

INSERT INTO public.client_consents (tenant_id, client_id, title, scope, granted, granted_at)
VALUES (
  'a0000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000001',
  'Portal-Zugang Klient:in',
  'own',
  TRUE,
  NOW() - INTERVAL '30 days'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.client_history_entries (tenant_id, client_id, icon, title, status, actor_name)
VALUES
  (
    'a0000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000001',
    '📅',
    'Einsatz dokumentiert',
    'abgeschlossen',
    'Thomas Keller'
  ),
  (
    'a0000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000002',
    '🔄',
    'Status geändert',
    'aktiv',
    'Sabine Muster'
  )
ON CONFLICT DO NOTHING;
