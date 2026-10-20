-- ==========================================================================
-- CareSuite+ — Migration 0093: Office Messaging Final Phase
-- Portal auth linkage, full category seeds, notification FK fix, RLS helpers
-- ==========================================================================

-- --------------------------------------------------------------------------
-- Portal auth linkage on legacy code tables (code-based login)
-- --------------------------------------------------------------------------
ALTER TABLE public.client_portal_codes
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_client_portal_codes_auth_user
  ON public.client_portal_codes (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

ALTER TABLE public.relative_portal_codes
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_relative_portal_codes_auth_user
  ON public.relative_portal_codes (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- Unique auth linkage per portal account (one auth user per access record)
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_portal_access_auth_user_unique
  ON public.client_portal_access (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_portal_accounts_auth_user_unique
  ON public.employee_portal_accounts (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- --------------------------------------------------------------------------
-- RLS helpers: tenant/role via auth_user_id (portal + business profiles)
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id
  FROM public.profiles
  WHERE id = auth.uid() OR auth_user_id = auth.uid()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_role_key()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role_key
  FROM public.profiles
  WHERE id = auth.uid() OR auth_user_id = auth.uid()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_client_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT cpa.client_id
      FROM public.client_portal_access cpa
      WHERE cpa.auth_user_id = auth.uid()
        AND cpa.tenant_id = public.current_tenant_id()
      LIMIT 1
    ),
    (
      SELECT cpc.client_id
      FROM public.client_portal_codes cpc
      WHERE cpc.auth_user_id = auth.uid()
        AND cpc.tenant_id = public.current_tenant_id()
      LIMIT 1
    ),
    (
      SELECT rpc.client_id
      FROM public.relative_portal_codes rpc
      WHERE rpc.auth_user_id = auth.uid()
        AND rpc.tenant_id = public.current_tenant_id()
      LIMIT 1
    )
  )
$$;

-- --------------------------------------------------------------------------
-- message_categories: metadata for emergency disclaimers etc.
-- --------------------------------------------------------------------------
ALTER TABLE public.message_categories
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Full client category chips (spec section 4)
INSERT INTO public.message_categories (tenant_id, key, label, audience, sort_order, metadata)
SELECT t.id, v.key, v.label, 'client', v.sort_order, v.metadata::jsonb
FROM public.tenants t
CROSS JOIN (
  VALUES
    ('cancel_assignment', 'Einsatz absagen', 1, '{}'),
    ('extra_assignment', 'Zusätzlicher Einsatz', 2, '{}'),
    ('reschedule_appointment', 'Termin verschieben', 3, '{}'),
    ('complaint', 'Beschwerde', 4, '{}'),
    ('billing_question', 'Rückfrage zur Rechnung', 5, '{}'),
    ('documents_contract', 'Dokumente/Vertrag', 6, '{}'),
    ('personal_data_change', 'Änderung persönlicher Daten', 7, '{}'),
    ('contact_person', 'Angehörige/Kontaktperson', 8, '{}'),
    ('emergency_contact', 'Notfallkontakt ändern', 9, '{"emergency":true,"show_disclaimer":true}'),
    ('general_question', 'Allgemeine Frage', 10, '{}'),
    ('feedback', 'Lob/Feedback', 11, '{}'),
    ('other', 'Sonstiges', 12, '{}')
) AS v(key, label, sort_order, metadata)
ON CONFLICT (tenant_id, key) DO UPDATE SET
  label = EXCLUDED.label,
  audience = EXCLUDED.audience,
  sort_order = EXCLUDED.sort_order,
  metadata = EXCLUDED.metadata,
  is_active = TRUE;

-- Full employee category chips (spec section 5)
INSERT INTO public.message_categories (tenant_id, key, label, audience, sort_order, metadata)
SELECT t.id, v.key, v.label, 'employee', v.sort_order, '{}'::jsonb
FROM public.tenants t
CROSS JOIN (
  VALUES
    ('assignment_problem', 'Einsatzproblem', 1),
    ('client_not_met', 'Klient:in nicht angetroffen', 2),
    ('schedule_change', 'Terminänderung', 3),
    ('sick_leave', 'Krankmeldung', 4),
    ('schedule_question', 'Dienstplanfrage', 5),
    ('documentation_problem', 'Dokumentationsproblem', 6),
    ('app_software_problem', 'App-/Softwareproblem', 7),
    ('service_proof', 'Leistungsnachweis', 8),
    ('travel_logbook', 'Fahrt/Fahrtenbuch', 9),
    ('billing_question', 'Rückfrage Abrechnung', 10),
    ('materials', 'Material/Arbeitsmittel', 11),
    ('general_question', 'Allgemeine Frage', 12),
    ('other', 'Sonstiges', 13)
) AS v(key, label, sort_order)
ON CONFLICT (tenant_id, key) DO UPDATE SET
  label = EXCLUDED.label,
  audience = EXCLUDED.audience,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE;

-- Deactivate legacy placeholder categories superseded by spec chips
UPDATE public.message_categories
SET is_active = FALSE
WHERE key IN ('general', 'appointment', 'billing', 'schedule', 'hr')
  AND audience IN ('client', 'employee');

-- --------------------------------------------------------------------------
-- communication_notifications: office messenger thread FK (fixes insert failures)
-- --------------------------------------------------------------------------
ALTER TABLE public.communication_notifications
  ADD COLUMN IF NOT EXISTS office_thread_id UUID REFERENCES public.message_threads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_comm_notifications_office_thread
  ON public.communication_notifications (office_thread_id)
  WHERE office_thread_id IS NOT NULL;

-- Office messaging notifications: allow insert without communication_threads FK
DROP POLICY IF EXISTS communication_notifications_office_insert ON public.communication_notifications;
CREATE POLICY communication_notifications_office_insert ON public.communication_notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('office.access')
      OR public.has_permission('communication.view_center')
      OR office_thread_id IS NOT NULL
    )
  );

COMMENT ON COLUMN public.message_categories.metadata IS 'Kategorie-Metadaten (z. B. emergency, show_disclaimer)';
COMMENT ON COLUMN public.communication_notifications.office_thread_id IS 'Office-Messenger-Thread (message_threads) — getrennt von communication_threads';
