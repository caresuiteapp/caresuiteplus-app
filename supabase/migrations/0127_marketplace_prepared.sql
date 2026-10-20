-- ==========================================================================
-- CareSuite+ — Migration 0047: Partner-Marktplatz (prepared)
-- Kategorien, Partner, Weiterleitungen, Einwilligungen, Provisionen, Audit.
-- Keine echten Partner als aktiv ohne Freigabe. Keine Provision ohne Abschluss.
-- Keine Kundendatenübertragung ohne Einwilligung. Nicht produktiv pushen.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- Hilfsfunktion: Marktplatz-Admin (Plattform-Freigabe von Partnern)
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_marketplace_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_role_key() = 'business_admin'
$$;

GRANT EXECUTE ON FUNCTION public.is_marketplace_platform_admin() TO authenticated;

-- --------------------------------------------------------------------------
-- 1. marketplace_categories — globale Partner-Kategorien
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketplace_categories (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  category_key    TEXT        NOT NULL,
  label           TEXT        NOT NULL,
  description     TEXT        NOT NULL DEFAULT '',
  icon            TEXT        NOT NULL DEFAULT '🏪',
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (category_key)
);

CREATE INDEX IF NOT EXISTS idx_marketplace_categories_sort
  ON public.marketplace_categories (sort_order, label);

-- --------------------------------------------------------------------------
-- 2. marketplace_partners — Partner-Stammdaten (global, kein tenant_id)
-- status = draft|pending_review|approved|active|paused|rejected|archived
-- Nur status = 'active' ist für Mandanten-Anfragen nutzbar.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketplace_partners (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_key           TEXT        NOT NULL,
  name                  TEXT        NOT NULL,
  category_id           UUID        NOT NULL REFERENCES public.marketplace_categories(id) ON DELETE RESTRICT,
  status                TEXT        NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft', 'pending_review', 'approved', 'active', 'paused', 'rejected', 'archived'
    )),
  short_description     TEXT        NOT NULL DEFAULT '',
  long_description      TEXT        NOT NULL DEFAULT '',
  website_url           TEXT,
  logo_url              TEXT,
  contact_email         TEXT,
  is_demo               BOOLEAN     NOT NULL DEFAULT FALSE,
  agreement_signed_at   TIMESTAMPTZ,
  agreement_reference   TEXT,
  approved_by           UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at           TIMESTAMPTZ,
  onboarding_status     TEXT        NOT NULL DEFAULT 'not_started'
    CHECK (onboarding_status IN (
      'not_started', 'documents_pending', 'review', 'ready', 'completed'
    )),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (partner_key)
);

CREATE INDEX IF NOT EXISTS idx_marketplace_partners_category_status
  ON public.marketplace_partners (category_id, status);

CREATE INDEX IF NOT EXISTS idx_marketplace_partners_status
  ON public.marketplace_partners (status);

-- --------------------------------------------------------------------------
-- 3. marketplace_partner_services — Leistungen je Partner
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketplace_partner_services (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id      UUID        NOT NULL REFERENCES public.marketplace_partners(id) ON DELETE CASCADE,
  service_key     TEXT        NOT NULL,
  label           TEXT        NOT NULL,
  description     TEXT        NOT NULL DEFAULT '',
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (partner_id, service_key)
);

CREATE INDEX IF NOT EXISTS idx_marketplace_partner_services_partner
  ON public.marketplace_partner_services (partner_id, is_active);

-- --------------------------------------------------------------------------
-- 4. marketplace_partner_regions — Einsatzgebiete je Partner
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketplace_partner_regions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id      UUID        NOT NULL REFERENCES public.marketplace_partners(id) ON DELETE CASCADE,
  region_code     TEXT        NOT NULL,
  region_label    TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (partner_id, region_code)
);

CREATE INDEX IF NOT EXISTS idx_marketplace_partner_regions_partner
  ON public.marketplace_partner_regions (partner_id);

-- --------------------------------------------------------------------------
-- 5. marketplace_referral_requests — mandantenspezifische Anfragen
-- referral_status = draft|consent_required|ready|sent|accepted|rejected|completed|cancelled
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketplace_referral_requests (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  partner_id            UUID        NOT NULL REFERENCES public.marketplace_partners(id) ON DELETE RESTRICT,
  referral_status       TEXT        NOT NULL DEFAULT 'draft'
    CHECK (referral_status IN (
      'draft', 'consent_required', 'ready', 'sent', 'accepted',
      'rejected', 'completed', 'cancelled'
    )),
  request_subject       TEXT        NOT NULL DEFAULT '',
  request_message       TEXT        NOT NULL DEFAULT '',
  data_sharing_scope    JSONB       NOT NULL DEFAULT '[]'::jsonb,
  client_reference      TEXT,
  requested_by          UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  requested_at          TIMESTAMPTZ,
  sent_at               TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  cancelled_at          TIMESTAMPTZ,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_referral_requests_tenant
  ON public.marketplace_referral_requests (tenant_id, referral_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_marketplace_referral_requests_partner
  ON public.marketplace_referral_requests (tenant_id, partner_id);

-- --------------------------------------------------------------------------
-- 6. marketplace_referral_consents — Einwilligung je Anfrage (mandantenspezifisch)
-- Keine Datenübertragung ohne consent_given_at IS NOT NULL AND revoked_at IS NULL
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketplace_referral_consents (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  referral_request_id   UUID        NOT NULL REFERENCES public.marketplace_referral_requests(id) ON DELETE CASCADE,
  data_categories       JSONB       NOT NULL DEFAULT '[]'::jsonb,
  scope_description     TEXT        NOT NULL DEFAULT '',
  consent_text_version  TEXT        NOT NULL DEFAULT 'v1',
  consent_given         BOOLEAN     NOT NULL DEFAULT FALSE,
  consent_given_at      TIMESTAMPTZ,
  consent_given_by      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  revoked_at            TIMESTAMPTZ,
  revoked_by            UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (referral_request_id)
);

CREATE INDEX IF NOT EXISTS idx_marketplace_referral_consents_tenant
  ON public.marketplace_referral_consents (tenant_id, referral_request_id);

-- --------------------------------------------------------------------------
-- 7. marketplace_commission_rules — Provisionsregeln (vorbereitet, nicht aktiv)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketplace_commission_rules (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id            UUID        NOT NULL REFERENCES public.marketplace_partners(id) ON DELETE CASCADE,
  rule_key              TEXT        NOT NULL,
  label                 TEXT        NOT NULL,
  commission_type       TEXT        NOT NULL DEFAULT 'percentage'
    CHECK (commission_type IN ('percentage', 'fixed', 'none')),
  rate_value            NUMERIC(10, 4),
  currency              TEXT        NOT NULL DEFAULT 'EUR',
  is_active             BOOLEAN     NOT NULL DEFAULT FALSE,
  requires_completed    BOOLEAN     NOT NULL DEFAULT TRUE,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (partner_id, rule_key)
);

CREATE INDEX IF NOT EXISTS idx_marketplace_commission_rules_partner
  ON public.marketplace_commission_rules (partner_id, is_active);

-- --------------------------------------------------------------------------
-- 8. marketplace_commission_events — Provisionsereignisse (nur bei Abschluss)
-- booking_status = prepared|pending|booked|cancelled — booked nur nach completed
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketplace_commission_events (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  referral_request_id   UUID        NOT NULL REFERENCES public.marketplace_referral_requests(id) ON DELETE RESTRICT,
  commission_rule_id    UUID        REFERENCES public.marketplace_commission_rules(id) ON DELETE SET NULL,
  booking_status        TEXT        NOT NULL DEFAULT 'prepared'
    CHECK (booking_status IN ('prepared', 'pending', 'booked', 'cancelled')),
  amount_cents          INTEGER,
  currency              TEXT        NOT NULL DEFAULT 'EUR',
  booked_at             TIMESTAMPTZ,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_commission_events_tenant
  ON public.marketplace_commission_events (tenant_id, booking_status, created_at DESC);

-- --------------------------------------------------------------------------
-- 9. marketplace_audit_events — mandantenspezifisches Audit
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketplace_audit_events (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type            TEXT        NOT NULL,
  entity_type           TEXT        NOT NULL,
  entity_id             UUID,
  summary               TEXT        NOT NULL,
  metadata              JSONB       NOT NULL DEFAULT '{}'::jsonb,
  actor_id              UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_audit_events_tenant
  ON public.marketplace_audit_events (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_marketplace_audit_events_entity
  ON public.marketplace_audit_events (tenant_id, entity_type, entity_id);

-- --------------------------------------------------------------------------
-- updated_at Trigger
-- --------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'marketplace_categories',
    'marketplace_partners',
    'marketplace_partner_services',
    'marketplace_partner_regions',
    'marketplace_referral_requests',
    'marketplace_referral_consents',
    'marketplace_commission_rules',
    'marketplace_commission_events'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_%I_updated_at ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER set_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      t, t
    );
  END LOOP;
END $$;

-- --------------------------------------------------------------------------
-- Seed: Kategorien (keine aktiven Partner)
-- --------------------------------------------------------------------------
INSERT INTO public.marketplace_categories (category_key, label, description, icon, sort_order)
VALUES
  ('pflegehilfsmittel', 'Pflegehilfsmittelboxen', 'Lieferung und Beratung zu Pflegehilfsmittelboxen', '📦', 10),
  ('sanitaetshaus', 'Sanitätshäuser', 'Hilfsmittel, Orthopädie und Sanitätshaus-Services', '🦽', 20),
  ('apotheke', 'Apotheken', 'Apotheken- und Medikamentenversorgung', '💊', 30),
  ('wundversorgung', 'Wundversorgung', 'Wundmanagement und Versorgungsprodukte', '🩹', 40),
  ('hausnotruf', 'Hausnotruf', 'Notruf- und Telecare-Dienste', '🚨', 50),
  ('essensdienst', 'Menü-/Essensdienste', 'Essenslieferung und Menüplanung', '🍽️', 60),
  ('fahrdienst', 'Fahrdienste', 'Fahrdienste und Mobilität', '🚗', 70),
  ('reinigungsdienst', 'Reinigungsdienste', 'Haushalts- und Reinigungsdienste', '🧹', 80),
  ('alltagshilfe', 'Alltagshilfe-Anbieter', 'Alltagsbegleitung und haushaltsnahe Hilfe', '🤝', 90),
  ('schulungsanbieter', 'Schulungsanbieter', 'Pflege-Schulungen und Fortbildungen', '🎓', 100),
  ('abrechnungszentrum', 'Abrechnungszentren', 'Abrechnungsdienstleister und Clearing', '🧾', 110),
  ('steuerberater', 'Steuerberater', 'Steuerberatung für Pflegedienste', '📒', 120),
  ('versicherung_beratung', 'Versicherungs-/Beratungspartner', 'Versicherungs- und Beratungspartner', '🛡️', 130)
ON CONFLICT (category_key) DO NOTHING;

-- --------------------------------------------------------------------------
-- RLS aktivieren
-- --------------------------------------------------------------------------
ALTER TABLE public.marketplace_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_partner_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_partner_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_referral_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_referral_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_commission_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_audit_events ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- RLS: marketplace_categories — lesbar für authenticated
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS marketplace_categories_select ON public.marketplace_categories;
CREATE POLICY marketplace_categories_select ON public.marketplace_categories
  FOR SELECT TO authenticated USING (is_active = TRUE);

DROP POLICY IF EXISTS marketplace_categories_write ON public.marketplace_categories;
CREATE POLICY marketplace_categories_write ON public.marketplace_categories
  FOR ALL TO authenticated
  USING (public.is_marketplace_platform_admin())
  WITH CHECK (public.is_marketplace_platform_admin());

-- --------------------------------------------------------------------------
-- RLS: marketplace_partners — nur active für Mandanten sichtbar; Admin schreibt
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS marketplace_partners_select ON public.marketplace_partners;
CREATE POLICY marketplace_partners_select ON public.marketplace_partners
  FOR SELECT TO authenticated
  USING (
    status = 'active'
    OR public.is_marketplace_platform_admin()
  );

DROP POLICY IF EXISTS marketplace_partners_write ON public.marketplace_partners;
CREATE POLICY marketplace_partners_write ON public.marketplace_partners
  FOR ALL TO authenticated
  USING (public.is_marketplace_platform_admin())
  WITH CHECK (public.is_marketplace_platform_admin());

-- --------------------------------------------------------------------------
-- RLS: marketplace_partner_services / regions — lesbar wenn Partner sichtbar
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS marketplace_partner_services_select ON public.marketplace_partner_services;
CREATE POLICY marketplace_partner_services_select ON public.marketplace_partner_services
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.marketplace_partners p
      WHERE p.id = partner_id
        AND (p.status = 'active' OR public.is_marketplace_platform_admin())
    )
  );

DROP POLICY IF EXISTS marketplace_partner_services_write ON public.marketplace_partner_services;
CREATE POLICY marketplace_partner_services_write ON public.marketplace_partner_services
  FOR ALL TO authenticated
  USING (public.is_marketplace_platform_admin())
  WITH CHECK (public.is_marketplace_platform_admin());

DROP POLICY IF EXISTS marketplace_partner_regions_select ON public.marketplace_partner_regions;
CREATE POLICY marketplace_partner_regions_select ON public.marketplace_partner_regions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.marketplace_partners p
      WHERE p.id = partner_id
        AND (p.status = 'active' OR public.is_marketplace_platform_admin())
    )
  );

DROP POLICY IF EXISTS marketplace_partner_regions_write ON public.marketplace_partner_regions;
CREATE POLICY marketplace_partner_regions_write ON public.marketplace_partner_regions
  FOR ALL TO authenticated
  USING (public.is_marketplace_platform_admin())
  WITH CHECK (public.is_marketplace_platform_admin());

-- --------------------------------------------------------------------------
-- RLS: marketplace_referral_requests — mandantenspezifisch
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS marketplace_referral_requests_tenant ON public.marketplace_referral_requests;
CREATE POLICY marketplace_referral_requests_tenant ON public.marketplace_referral_requests
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- --------------------------------------------------------------------------
-- RLS: marketplace_referral_consents — mandantenspezifisch
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS marketplace_referral_consents_tenant ON public.marketplace_referral_consents;
CREATE POLICY marketplace_referral_consents_tenant ON public.marketplace_referral_consents
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- --------------------------------------------------------------------------
-- RLS: marketplace_commission_rules — lesbar; Schreiben nur Admin
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS marketplace_commission_rules_select ON public.marketplace_commission_rules;
CREATE POLICY marketplace_commission_rules_select ON public.marketplace_commission_rules
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS marketplace_commission_rules_write ON public.marketplace_commission_rules;
CREATE POLICY marketplace_commission_rules_write ON public.marketplace_commission_rules
  FOR ALL TO authenticated
  USING (public.is_marketplace_platform_admin())
  WITH CHECK (public.is_marketplace_platform_admin());

-- --------------------------------------------------------------------------
-- RLS: marketplace_commission_events — mandantenspezifisch, lesen für Tenant
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS marketplace_commission_events_tenant ON public.marketplace_commission_events;
CREATE POLICY marketplace_commission_events_tenant ON public.marketplace_commission_events
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- --------------------------------------------------------------------------
-- RLS: marketplace_audit_events — mandantenspezifisch
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS marketplace_audit_events_tenant ON public.marketplace_audit_events;
CREATE POLICY marketplace_audit_events_tenant ON public.marketplace_audit_events
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- --------------------------------------------------------------------------
-- Grants
-- --------------------------------------------------------------------------
GRANT SELECT ON public.marketplace_categories TO authenticated;
GRANT SELECT ON public.marketplace_partners TO authenticated;
GRANT SELECT ON public.marketplace_partner_services TO authenticated;
GRANT SELECT ON public.marketplace_partner_regions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.marketplace_referral_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.marketplace_referral_consents TO authenticated;
GRANT SELECT ON public.marketplace_commission_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.marketplace_commission_events TO authenticated;
GRANT SELECT, INSERT ON public.marketplace_audit_events TO authenticated;

GRANT ALL ON public.marketplace_categories TO service_role;
GRANT ALL ON public.marketplace_partners TO service_role;
GRANT ALL ON public.marketplace_partner_services TO service_role;
GRANT ALL ON public.marketplace_partner_regions TO service_role;
GRANT ALL ON public.marketplace_referral_requests TO service_role;
GRANT ALL ON public.marketplace_referral_consents TO service_role;
GRANT ALL ON public.marketplace_commission_rules TO service_role;
GRANT ALL ON public.marketplace_commission_events TO service_role;
GRANT ALL ON public.marketplace_audit_events TO service_role;

COMMENT ON TABLE public.marketplace_partners IS 'Partner-Marktplatz — nur status=active nach Vereinbarung sichtbar';
COMMENT ON TABLE public.marketplace_referral_consents IS 'Einwilligung erforderlich vor jeder Datenübertragung an Partner';
COMMENT ON TABLE public.marketplace_commission_events IS 'Provision nur bei booking_status=booked nach completed-Referral';
