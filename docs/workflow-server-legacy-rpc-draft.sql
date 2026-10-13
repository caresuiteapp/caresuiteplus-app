-- REVIEW DRAFT ONLY. Do not apply automatically or to production.
-- Source: read-only pg_get_functiondef/EXECUTE metadata captured 2026-10-11.
-- Four legacy writers have no src/app/Edge caller. Remove all browser/API
-- execution rights while retaining explicitly trusted service operations.
-- Client-core initialization is used by authenticated reads, so preserve that
-- call only for a same-tenant Business/legacy Business actor with clients read
-- or edit permission. Apply alongside the reviewed identity/permission guards.
-- No customer rows, existing access codes, template amounts or defaults change.
BEGIN;

REVOKE EXECUTE ON FUNCTION public.create_access_code_for_employee(uuid,uuid,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_access_code_for_employee(uuid,uuid,integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.create_access_code_for_client(uuid,uuid,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_access_code_for_client(uuid,uuid,integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.seed_tenant_assist_service_catalog(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_tenant_assist_service_catalog(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.backfill_client_care_entitlement_from_legacy(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_client_care_entitlement_from_legacy(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.seed_tenant_client_core_templates(p_tenant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_type_id UUID;
  v_year_id UUID;
  v_budget_type_id UUID;
BEGIN
  -- Only the trusted service role may initialize an arbitrary tenant. The
  -- SECURITY DEFINER owner is not evidence that the caller is trusted.
  IF current_setting('role', true) IS DISTINCT FROM 'service_role' THEN
    IF auth.uid() IS NULL
      OR p_tenant_id IS NULL
      OR p_tenant_id IS DISTINCT FROM public.current_tenant_id()
      OR COALESCE(public.current_portal_type(), 'business') <> 'business'
      OR NOT COALESCE(
        public.has_permission('office.clients.view')
        OR public.has_permission('office.clients.edit')
        OR public.is_tenant_admin(), FALSE
      ) THEN
      RAISE EXCEPTION 'Client template initialization requires an authorized business actor in the same tenant.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_client_service_types WHERE tenant_id = p_tenant_id
  ) THEN
    INSERT INTO public.tenant_client_service_types (
      tenant_id, service_type_key, care_context_key, name, description,
      module_keys, is_system_template, sort_order
    ) VALUES
      (p_tenant_id, 'alltagsbegleitung', 'daily_assistance',
       'Alltagsbegleitung', 'Individuelle Alltagsbegleitung im häuslichen Umfeld',
       ARRAY['assist', 'office'], TRUE, 10),
      (p_tenant_id, 'betreuung', 'support_care',
       'Betreuung', 'Betreuungsleistungen und Entlastung',
       ARRAY['assist', 'office'], TRUE, 20),
      (p_tenant_id, 'begleitung', 'companionship',
       'Begleitung', 'Begleitung zu Terminen und Aktivitäten',
       ARRAY['assist', 'office'], TRUE, 30),
      (p_tenant_id, 'ambulante_pflege', 'ambulatory_care',
       'Ambulante Pflege', 'Pflegefachliche Leistungen im häuslichen Umfeld',
       ARRAY['pflege', 'assist', 'office'], TRUE, 40),
      (p_tenant_id, 'stationaere_pflege', 'stationary_care',
       'Stationäre Pflege', 'Pflege in stationärer Einrichtung',
       ARRAY['stationaer', 'pflege', 'office'], TRUE, 50),
      (p_tenant_id, 'beratung', 'consulting',
       'Beratung', 'Pflegeberatung und Fallsteuerung',
       ARRAY['beratung', 'office'], TRUE, 60)
    ON CONFLICT (tenant_id, service_type_key) DO NOTHING;
  END IF;

  -- Intake sections per service type (only when missing for that type)
  FOR v_type_id IN
    SELECT id FROM public.tenant_client_service_types WHERE tenant_id = p_tenant_id
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.tenant_service_intake_sections
      WHERE tenant_id = p_tenant_id AND service_type_id = v_type_id
    ) THEN
      INSERT INTO public.tenant_service_intake_sections (
        tenant_id, service_type_id, section_key, is_required, is_visible, sort_order
      ) VALUES
        (p_tenant_id, v_type_id, 'leistungsart', TRUE, TRUE, 10),
        (p_tenant_id, v_type_id, 'stammdaten', TRUE, TRUE, 20),
        (p_tenant_id, v_type_id, 'adresse_kontakt', TRUE, TRUE, 30),
        (p_tenant_id, v_type_id, 'kostentraeger', FALSE, TRUE, 40),
        (p_tenant_id, v_type_id, 'angehoerige', FALSE, TRUE, 50),
        (p_tenant_id, v_type_id, 'notfall_zugang', FALSE, TRUE, 60),
        (p_tenant_id, v_type_id, 'vertraege_einwilligungen', TRUE, TRUE, 70),
        (p_tenant_id, v_type_id, 'dokumente', FALSE, TRUE, 80),
        (p_tenant_id, v_type_id, 'module', FALSE, TRUE, 90),
        (p_tenant_id, v_type_id, 'pruefung', TRUE, TRUE, 100)
      ON CONFLICT (tenant_id, service_type_id, section_key) DO NOTHING;
    END IF;
  END LOOP;

  -- Portal defaults (conservative — not all visible)
  INSERT INTO public.tenant_client_portal_defaults (
    tenant_id, portal_enabled, show_appointments, show_messages,
    show_documents, show_proofs, show_budget, show_visit_tracking, allow_access_requests
  ) VALUES (
    p_tenant_id, FALSE, FALSE, TRUE, FALSE, FALSE, FALSE, FALSE, TRUE
  )
  ON CONFLICT (tenant_id) DO NOTHING;

  -- Budget year 2026
  INSERT INTO public.tenant_budget_years (tenant_id, budget_year, label, is_active)
  VALUES (p_tenant_id, 2026, 'Budgetjahr 2026', TRUE)
  ON CONFLICT (tenant_id, budget_year) DO NOTHING;

  SELECT id INTO v_year_id
  FROM public.tenant_budget_years
  WHERE tenant_id = p_tenant_id AND budget_year = 2026;

  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_budget_types WHERE tenant_id = p_tenant_id
  ) THEN
    INSERT INTO public.tenant_budget_types (
      tenant_id, budget_type_key, name, description, period, sort_order
    ) VALUES
      (p_tenant_id, 'entlastung_45b', 'Entlastungsbudget § 45b SGB XI',
       'Monatliches Entlastungsbudget nach § 45b SGB XI', 'monthly', 10),
      (p_tenant_id, 'verhinderungspflege_39', 'Verhinderungspflege § 39 SGB XI',
       'Jährliches Verhinderungspflege-Budget', 'yearly', 20)
    ON CONFLICT (tenant_id, budget_type_key) DO NOTHING;
  END IF;

  SELECT id INTO v_budget_type_id
  FROM public.tenant_budget_types
  WHERE tenant_id = p_tenant_id AND budget_type_key = 'entlastung_45b';

  IF v_year_id IS NOT NULL AND v_budget_type_id IS NOT NULL THEN
    INSERT INTO public.tenant_budget_defaults (
      tenant_id, budget_year_id, budget_type_id,
      amount_cents, conversion_rate_pct, monthly_amount_cents, yearly_amount_cents,
      notes
    ) VALUES (
      p_tenant_id, v_year_id, v_budget_type_id,
      353900, 40.00, 13100, 353900,
      'Vorlage 2026: 131 EUR monatlich, 40% Umrechnung, 3539 EUR jährlich — editierbar'
    )
    ON CONFLICT (tenant_id, budget_year_id, budget_type_id) DO NOTHING;
  END IF;

  -- Link support service types to entlastung budget
  FOR v_type_id IN
    SELECT id FROM public.tenant_client_service_types
    WHERE tenant_id = p_tenant_id
      AND service_type_key IN ('alltagsbegleitung', 'betreuung', 'begleitung')
  LOOP
    IF v_budget_type_id IS NOT NULL THEN
      INSERT INTO public.tenant_service_type_budget_rules (
        tenant_id, service_type_id, budget_type_id, is_default
      ) VALUES (p_tenant_id, v_type_id, v_budget_type_id, TRUE)
      ON CONFLICT (tenant_id, service_type_id, budget_type_id) DO NOTHING;
    END IF;
  END LOOP;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.seed_tenant_client_core_templates(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_tenant_client_core_templates(uuid) TO authenticated, service_role;

COMMIT;
