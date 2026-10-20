-- ==========================================================================
-- CareSuite+ — Migration 0177: Budget transaction lifecycle + care entitlement backfill
-- Extends 0175 client_budget_transactions for Einsatz/Nachweis lifecycle.
-- ==========================================================================

ALTER TABLE public.client_budget_transactions
  ADD COLUMN IF NOT EXISTS lifecycle_status TEXT,
  ADD COLUMN IF NOT EXISTS invoice_id UUID;

ALTER TABLE public.client_budget_transactions
  DROP CONSTRAINT IF EXISTS client_budget_transactions_lifecycle_check;

ALTER TABLE public.client_budget_transactions
  ADD CONSTRAINT client_budget_transactions_lifecycle_check
  CHECK (
    lifecycle_status IS NULL
    OR lifecycle_status IN (
      'geplant',
      'durchgefuehrt',
      'nachgewiesen',
      'freigegeben',
      'abgerechnet',
      'storniert'
    )
  );

CREATE INDEX IF NOT EXISTS idx_client_budget_transactions_lifecycle
  ON public.client_budget_transactions (tenant_id, reference_type, reference_id, lifecycle_status)
  WHERE reference_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_budget_tx_visit_reservation_active
  ON public.client_budget_transactions (tenant_id, reference_type, reference_id)
  WHERE reference_type = 'assist_visit'
    AND transaction_type = 'reservation'
    AND COALESCE(lifecycle_status, 'geplant') NOT IN ('storniert', 'nachgewiesen', 'freigegeben', 'abgerechnet');

COMMENT ON COLUMN public.client_budget_transactions.lifecycle_status IS
  'Einsatz/Nachweis lifecycle: geplant → durchgefuehrt → nachgewiesen/freigegeben/abgerechnet';

-- One-time backfill: sync client_care_entitlement from legacy client_care_levels / clients.care_level
CREATE OR REPLACE FUNCTION public.backfill_client_care_entitlement_from_legacy(p_tenant_id UUID DEFAULT NULL)
RETURNS TABLE (tenant_id UUID, client_id UUID, action TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  v_grade TEXT;
  v_valid_from DATE;
  v_existing UUID;
BEGIN
  FOR rec IN
    SELECT
      c.tenant_id,
      c.id AS client_id,
      COALESCE(
        (
          SELECT cl.grade
          FROM public.client_care_levels cl
          WHERE cl.client_id = c.id
            AND cl.tenant_id = c.tenant_id
          ORDER BY cl.valid_from DESC NULLS LAST, cl.created_at DESC
          LIMIT 1
        ),
        CASE c.care_level
          WHEN 'none' THEN 'kein'
          WHEN 'unknown' THEN 'kein'
          ELSE c.care_level::TEXT
        END
      ) AS resolved_grade,
      COALESCE(
        (
          SELECT cl.valid_from
          FROM public.client_care_levels cl
          WHERE cl.client_id = c.id
            AND cl.tenant_id = c.tenant_id
          ORDER BY cl.valid_from DESC NULLS LAST, cl.created_at DESC
          LIMIT 1
        ),
        CURRENT_DATE
      ) AS resolved_valid_from,
      (
        SELECT cl.care_fund_name
        FROM public.client_care_levels cl
        WHERE cl.client_id = c.id
          AND cl.tenant_id = c.tenant_id
        ORDER BY cl.valid_from DESC NULLS LAST
        LIMIT 1
      ) AS care_fund_name,
      (
        SELECT cl.care_fund_member_id
        FROM public.client_care_levels cl
        WHERE cl.client_id = c.id
          AND cl.tenant_id = c.tenant_id
        ORDER BY cl.valid_from DESC NULLS LAST
        LIMIT 1
      ) AS care_fund_member_id,
      (
        SELECT cl.md_assessment_date
        FROM public.client_care_levels cl
        WHERE cl.client_id = c.id
          AND cl.tenant_id = c.tenant_id
        ORDER BY cl.valid_from DESC NULLS LAST
        LIMIT 1
      ) AS md_assessment_date
    FROM public.clients c
    WHERE (p_tenant_id IS NULL OR c.tenant_id = p_tenant_id)
  LOOP
    v_grade := LOWER(TRIM(rec.resolved_grade));
    IF v_grade IN ('none', 'unknown', '') THEN
      v_grade := 'kein';
    ELSIF v_grade NOT IN ('kein', 'pg1', 'pg2', 'pg3', 'pg4', 'pg5', 'hospiz') THEN
      CONTINUE;
    END IF;

    v_valid_from := rec.resolved_valid_from;

    SELECT e.id INTO v_existing
    FROM public.client_care_entitlement e
    WHERE e.tenant_id = rec.tenant_id
      AND e.client_id = rec.client_id
      AND e.care_grade = v_grade
      AND e.valid_from = v_valid_from
      AND e.valid_until IS NULL
    LIMIT 1;

    IF v_existing IS NOT NULL THEN
      tenant_id := rec.tenant_id;
      client_id := rec.client_id;
      action := 'skipped';
      RETURN NEXT;
      CONTINUE;
    END IF;

    UPDATE public.client_care_entitlement e
    SET valid_until = (v_valid_from - INTERVAL '1 day')::DATE,
        updated_at = NOW()
    WHERE e.tenant_id = rec.tenant_id
      AND e.client_id = rec.client_id
      AND e.valid_until IS NULL
      AND (e.care_grade <> v_grade OR e.valid_from <> v_valid_from);

    INSERT INTO public.client_care_entitlement (
      tenant_id,
      client_id,
      care_grade,
      valid_from,
      conversion_enabled,
      care_fund_name,
      care_fund_member_id,
      md_assessment_date,
      source,
      metadata
    ) VALUES (
      rec.tenant_id,
      rec.client_id,
      v_grade,
      v_valid_from,
      v_grade IN ('pg2', 'pg3', 'pg4', 'pg5'),
      rec.care_fund_name,
      rec.care_fund_member_id,
      rec.md_assessment_date,
      'legacy_backfill',
      jsonb_build_object('backfill_migration', '0177')
    );

    tenant_id := rec.tenant_id;
    client_id := rec.client_id;
    action := 'inserted';
    RETURN NEXT;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.backfill_client_care_entitlement_from_legacy IS
  'Backfill client_care_entitlement from client_care_levels and clients.care_level (Migration 0177)';
