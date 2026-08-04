-- CareSuite HealthOS — rebuilt client budget experience
-- Exact 2026 values, §45b carry-over buckets, monthly external Sachleistung input,
-- and narrow own-client portal read policies. Additive and idempotent.

UPDATE public.budget_template_catalog
SET
  default_amount_cents = CASE catalog_key
    WHEN 'paragraph_45b' THEN 13100
    WHEN 'umwandlung_pg2' THEN 31840
    WHEN 'umwandlung_pg3' THEN 59880
    WHEN 'umwandlung_pg4' THEN 74360
    WHEN 'umwandlung_pg5' THEN 91960
    ELSE default_amount_cents
  END,
  period = CASE
    WHEN catalog_key = 'paragraph_45b' OR catalog_key LIKE 'umwandlung_pg%' THEN 'monthly'
    ELSE period
  END,
  updated_at = NOW()
WHERE budget_year = 2026
  AND catalog_key IN (
    'paragraph_45b',
    'umwandlung_pg2',
    'umwandlung_pg3',
    'umwandlung_pg4',
    'umwandlung_pg5'
  );

ALTER TABLE public.client_budget_accounts
  ADD COLUMN IF NOT EXISTS external_sachleistung_cents BIGINT NOT NULL DEFAULT 0;

ALTER TABLE public.client_budget_accounts
  DROP CONSTRAINT IF EXISTS client_budget_accounts_external_sachleistung_nonnegative;
ALTER TABLE public.client_budget_accounts
  ADD CONSTRAINT client_budget_accounts_external_sachleistung_nonnegative
  CHECK (external_sachleistung_cents >= 0);

-- Every monthly §45b allocation is a separate FIFO bucket. It remains usable until
-- 30 June of the following year; only the remainder of that bucket expires then.
UPDATE public.client_budget_accounts
SET
  period_end = make_date(catalog_year + 1, 6, 30),
  updated_at = NOW()
WHERE catalog_key = 'paragraph_45b'
  AND period_end <> make_date(catalog_year + 1, 6, 30);

-- Correct standard/current allocations only when no client-specific override exists.
UPDATE public.client_budget_accounts
SET
  standard_amount_cents = CASE catalog_key
    WHEN 'paragraph_45b' THEN 13100
    WHEN 'umwandlung_pg2' THEN 31840
    WHEN 'umwandlung_pg3' THEN 59880
    WHEN 'umwandlung_pg4' THEN 74360
    WHEN 'umwandlung_pg5' THEN 91960
    ELSE standard_amount_cents
  END,
  allocated_cents = CASE catalog_key
    WHEN 'paragraph_45b' THEN 13100
    WHEN 'umwandlung_pg2' THEN 31840
    WHEN 'umwandlung_pg3' THEN 59880
    WHEN 'umwandlung_pg4' THEN 74360
    WHEN 'umwandlung_pg5' THEN 91960
    ELSE allocated_cents
  END,
  updated_at = NOW()
WHERE catalog_year = 2026
  AND is_individual_override = FALSE
  AND catalog_key IN (
    'paragraph_45b',
    'umwandlung_pg2',
    'umwandlung_pg3',
    'umwandlung_pg4',
    'umwandlung_pg5'
  );

-- The portal may read only the signed-in client's own budget foundation. Writes remain
-- restricted to existing office permissions.
DROP POLICY IF EXISTS client_budget_accounts_portal_own_select ON public.client_budget_accounts;
CREATE POLICY client_budget_accounts_portal_own_select
  ON public.client_budget_accounts
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND client_id = public.current_client_id()
    AND public.current_client_id() IS NOT NULL
  );

DROP POLICY IF EXISTS client_care_entitlement_portal_own_select ON public.client_care_entitlement;
CREATE POLICY client_care_entitlement_portal_own_select
  ON public.client_care_entitlement
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND client_id = public.current_client_id()
    AND public.current_client_id() IS NOT NULL
  );

DROP POLICY IF EXISTS client_service_entitlements_portal_own_select ON public.client_service_entitlements;
CREATE POLICY client_service_entitlements_portal_own_select
  ON public.client_service_entitlements
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND client_id = public.current_client_id()
    AND public.current_client_id() IS NOT NULL
  );

GRANT SELECT ON public.client_budget_accounts TO authenticated;
GRANT SELECT ON public.client_care_entitlement TO authenticated;
GRANT SELECT ON public.client_service_entitlements TO authenticated;

COMMENT ON COLUMN public.client_budget_accounts.external_sachleistung_cents IS
  'Monatlich bestätigte §36-Sachleistungen anderer Anbieter; Basis der Pflegegeldprognose.';

-- A finished assignment must immediately move from "planned" to "used" in every graph.
-- Final proof approval later reconciles the exact billable amount without double booking.
CREATE OR REPLACE FUNCTION public.sync_completed_visit_budget_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.transaction_type = 'reservation'
     AND NEW.lifecycle_status = 'durchgefuehrt'
     AND COALESCE(OLD.lifecycle_status, 'geplant') <> 'durchgefuehrt' THEN
    UPDATE public.client_budget_accounts
    SET
      used_cents = GREATEST(0, used_cents + NEW.amount_cents),
      reserved_cents = GREATEST(0, reserved_cents - NEW.amount_cents),
      updated_at = NOW()
    WHERE id = NEW.budget_account_id
      AND tenant_id = NEW.tenant_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_completed_visit_budget_balance_trigger
  ON public.client_budget_transactions;
CREATE TRIGGER sync_completed_visit_budget_balance_trigger
AFTER UPDATE OF lifecycle_status ON public.client_budget_transactions
FOR EACH ROW
EXECUTE FUNCTION public.sync_completed_visit_budget_balance();

COMMENT ON FUNCTION public.sync_completed_visit_budget_balance() IS
  'Moves a completed assist reservation from reserved to used exactly once.';
