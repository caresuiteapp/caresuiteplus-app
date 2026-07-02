-- P0 audit — service_role SELECT grants for E2E verification scripts.
-- RLS remains enabled; service_role bypasses RLS but requires table-level GRANT.
-- Scope: read-only SELECT for audit/bootstrap scripts only.

DO $$
BEGIN
  IF to_regclass('public.assignments') IS NOT NULL THEN
    GRANT SELECT ON public.assignments TO service_role;
  END IF;

  IF to_regclass('public.assist_time_events') IS NOT NULL THEN
    GRANT SELECT ON public.assist_time_events TO service_role;
  END IF;

  IF to_regclass('public.client_budget_transactions') IS NOT NULL THEN
    GRANT SELECT ON public.client_budget_transactions TO service_role;
  END IF;

  IF to_regclass('public.client_documents') IS NOT NULL THEN
    GRANT SELECT ON public.client_documents TO service_role;
  END IF;

  IF to_regclass('public.employee_consent_bundle') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE ON public.employee_consent_bundle TO service_role;
  END IF;

  IF to_regclass('public.employee_location_consents') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE ON public.employee_location_consents TO service_role;
  END IF;

  IF to_regclass('public.workforce_time_events') IS NOT NULL THEN
    GRANT SELECT ON public.workforce_time_events TO service_role;
  END IF;
END $$;
