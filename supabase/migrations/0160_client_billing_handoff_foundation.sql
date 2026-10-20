-- ==========================================================================
-- CareSuite+ — Migration 0160: Client Core K.5
-- Billing handoff foundation — candidates, budget links, tenant billing rules.
-- Additive only — NO final invoices, invoice numbers, or payment status.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- client_billing_candidates — proof → billing preparation (not final invoice)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_billing_candidates (
  id                          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id                   UUID          NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  client_service_profile_id   UUID          REFERENCES public.client_service_profiles(id) ON DELETE SET NULL,
  service_type_id             UUID          REFERENCES public.tenant_client_service_types(id) ON DELETE SET NULL,
  proof_id                    UUID          NOT NULL,
  visit_id                    UUID          NOT NULL,
  proof_date                  DATE,
  billing_period_start        TIMESTAMPTZ,
  billing_period_end          TIMESTAMPTZ,
  duration_minutes            INT,
  quantity                    NUMERIC(12, 4),
  unit                        TEXT          NOT NULL DEFAULT 'hour',
  rate_amount                 NUMERIC(12, 4),
  amount_preview              BIGINT        NOT NULL DEFAULT 0,
  currency                    TEXT          NOT NULL DEFAULT 'EUR',
  budget_setting_id           UUID          REFERENCES public.client_budget_settings(id) ON DELETE SET NULL,
  budget_type_id              UUID          REFERENCES public.tenant_budget_types(id) ON DELETE SET NULL,
  billing_target_type         TEXT          NOT NULL DEFAULT 'internal',
  billing_target_id           UUID,
  status                      TEXT          NOT NULL DEFAULT 'not_ready',
  blocking_reasons            JSONB         NOT NULL DEFAULT '[]'::jsonb,
  source_snapshot             JSONB         NOT NULL DEFAULT '{}'::jsonb,
  created_at                  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT client_billing_candidates_status_check
    CHECK (status IN ('not_ready', 'ready_for_review', 'blocked', 'draftable')),
  CONSTRAINT client_billing_candidates_target_check
    CHECK (billing_target_type IN ('cost_carrier', 'self_payer', 'mixed', 'internal')),
  UNIQUE (tenant_id, proof_id)
);

CREATE INDEX IF NOT EXISTS idx_client_billing_candidates_client
  ON public.client_billing_candidates (tenant_id, client_id, status, proof_date DESC);

CREATE INDEX IF NOT EXISTS idx_client_billing_candidates_visit
  ON public.client_billing_candidates (tenant_id, visit_id);

COMMENT ON TABLE public.client_billing_candidates IS
  'K.5 Abrechnungskandidaten aus freigegebenen Nachweisen — keine finale Rechnung (Migration 0160)';

-- --------------------------------------------------------------------------
-- client_billing_candidate_budget_movements — link candidate ↔ budget ledger
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_billing_candidate_budget_movements (
  id                          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  billing_candidate_id        UUID          NOT NULL REFERENCES public.client_billing_candidates(id) ON DELETE CASCADE,
  client_budget_setting_id    UUID          NOT NULL REFERENCES public.client_budget_settings(id) ON DELETE CASCADE,
  client_budget_movement_id   UUID          REFERENCES public.client_budget_movements(id) ON DELETE SET NULL,
  movement_type               TEXT          NOT NULL,
  amount_cents                BIGINT        NOT NULL,
  created_at                  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT client_billing_candidate_budget_movements_type_check
    CHECK (movement_type IN ('reserved', 'consumed', 'released', 'adjusted'))
);

CREATE INDEX IF NOT EXISTS idx_client_billing_candidate_budget_movements_candidate
  ON public.client_billing_candidate_budget_movements (tenant_id, billing_candidate_id, created_at DESC);

-- --------------------------------------------------------------------------
-- tenant_client_billing_handoff_settings — K.5 Abrechnungsvorbereitung (separat von tenant_billing_settings / Tenant Center)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_client_billing_handoff_settings (
  id                              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                       UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
  default_currency                TEXT          NOT NULL DEFAULT 'EUR',
  default_unit                    TEXT          NOT NULL DEFAULT 'hour',
  default_tax_mode                TEXT          NOT NULL DEFAULT 'exempt',
  default_payment_terms_days      INT           NOT NULL DEFAULT 14,
  default_invoice_mode            TEXT          NOT NULL DEFAULT 'preview_only',
  require_signature               BOOLEAN       NOT NULL DEFAULT TRUE,
  require_approval                BOOLEAN       NOT NULL DEFAULT TRUE,
  require_assignment_declaration  BOOLEAN       NOT NULL DEFAULT FALSE,
  allow_self_payer_fallback       BOOLEAN       NOT NULL DEFAULT TRUE,
  allow_budget_overrun            BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at                      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT tenant_client_billing_handoff_settings_invoice_mode_check
    CHECK (default_invoice_mode IN ('preview_only', 'draft_only', 'manual_review'))
);

COMMENT ON TABLE public.tenant_client_billing_handoff_settings IS
  'K.5 Mandanten-Abrechnungsvorbereitung — preview/draft only (Migration 0160); getrennt von tenant_billing_settings';

-- --------------------------------------------------------------------------
-- tenant_service_type_billing_rules — Regeln je Leistungsart
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_service_type_billing_rules (
  id                              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                       UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  service_type_id                 UUID          NOT NULL REFERENCES public.tenant_client_service_types(id) ON DELETE CASCADE,
  default_rate_amount             NUMERIC(12, 4),
  default_unit                    TEXT          NOT NULL DEFAULT 'hour',
  default_billing_target_type     TEXT          NOT NULL DEFAULT 'cost_carrier',
  require_budget                  BOOLEAN       NOT NULL DEFAULT TRUE,
  require_signature               BOOLEAN       NOT NULL DEFAULT TRUE,
  require_approval                BOOLEAN       NOT NULL DEFAULT TRUE,
  require_assignment_declaration  BOOLEAN       NOT NULL DEFAULT FALSE,
  allow_self_payer                BOOLEAN       NOT NULL DEFAULT TRUE,
  allow_budget_overrun            BOOLEAN       NOT NULL DEFAULT FALSE,
  is_active                       BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at                      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT tenant_service_type_billing_rules_target_check
    CHECK (default_billing_target_type IN ('cost_carrier', 'self_payer', 'mixed', 'internal')),
  UNIQUE (tenant_id, service_type_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_service_type_billing_rules_tenant
  ON public.tenant_service_type_billing_rules (tenant_id, service_type_id);

-- --------------------------------------------------------------------------
-- updated_at triggers
-- --------------------------------------------------------------------------
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'client_billing_candidates',
    'tenant_client_billing_handoff_settings',
    'tenant_service_type_billing_rules'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_%I_updated_at ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE TRIGGER set_%I_updated_at BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', tbl, tbl
    );
  END LOOP;
END $$;

-- --------------------------------------------------------------------------
-- RLS — office.clients pattern
-- --------------------------------------------------------------------------
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'client_billing_candidates',
    'client_billing_candidate_budget_movements',
    'tenant_client_billing_handoff_settings',
    'tenant_service_type_billing_rules'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    EXECUTE format('DROP POLICY IF EXISTS "%s_select_tenant" ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "%s_select_tenant" ON public.%I FOR SELECT TO authenticated USING (
        tenant_id = public.current_tenant_id()
        AND public.has_permission(''office.clients.view'')
      )', tbl, tbl
    );

    EXECUTE format('DROP POLICY IF EXISTS "%s_write_tenant" ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "%s_write_tenant" ON public.%I FOR ALL TO authenticated USING (
        tenant_id = public.current_tenant_id()
        AND public.has_permission(''office.clients.edit'')
      ) WITH CHECK (
        tenant_id = public.current_tenant_id()
        AND public.has_permission(''office.clients.edit'')
      )', tbl, tbl
    );
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.client_billing_candidates,
  public.client_billing_candidate_budget_movements,
  public.tenant_client_billing_handoff_settings,
  public.tenant_service_type_billing_rules
TO authenticated;

-- Idempotent seed: tenant billing settings + default rules per service type
CREATE OR REPLACE FUNCTION public.seed_tenant_billing_handoff_defaults(p_tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_type_id UUID;
BEGIN
  INSERT INTO public.tenant_client_billing_handoff_settings (
    tenant_id, default_currency, default_unit, default_invoice_mode,
    require_signature, require_approval, allow_self_payer_fallback
  ) VALUES (
    p_tenant_id, 'EUR', 'hour', 'preview_only', TRUE, TRUE, TRUE
  )
  ON CONFLICT (tenant_id) DO NOTHING;

  FOR v_type_id IN
    SELECT id FROM public.tenant_client_service_types WHERE tenant_id = p_tenant_id
  LOOP
    INSERT INTO public.tenant_service_type_billing_rules (
      tenant_id, service_type_id, default_unit, default_billing_target_type,
      require_budget, require_signature, require_approval, is_active
    ) VALUES (
      p_tenant_id, v_type_id, 'hour', 'cost_carrier', TRUE, TRUE, TRUE, TRUE
    )
    ON CONFLICT (tenant_id, service_type_id) DO NOTHING;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_tenant_billing_handoff_defaults(UUID) TO authenticated;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.tenants LOOP
    PERFORM public.seed_tenant_billing_handoff_defaults(r.id);
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.seed_tenant_billing_handoff_defaults IS
  'Idempotente K.5 Abrechnungsvorbereitungs-Defaults je Mandant (Migration 0160)';
