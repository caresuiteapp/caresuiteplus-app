-- ==========================================================================
-- CareSuite+ — Migration 0163: service_role GRANTs for Content Portal audit
-- GRANTS only — no data changes, no RLS disable, no DDL on tables.
-- ==========================================================================

GRANT USAGE ON SCHEMA public TO service_role;

DO $$
BEGIN
  IF to_regclass('public.clients') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE ON public.clients TO service_role;
  END IF;

  IF to_regclass('public.employees') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE ON public.employees TO service_role;
  END IF;

  IF to_regclass('public.tenants') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE ON public.tenants TO service_role;
  END IF;

  IF to_regclass('public.profiles') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE ON public.profiles TO service_role;
  END IF;

  IF to_regclass('public.tenant_users') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE ON public.tenant_users TO service_role;
  END IF;

  IF to_regclass('public.roles') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE ON public.roles TO service_role;
  END IF;

  IF to_regclass('public.products') IS NOT NULL THEN
    GRANT SELECT ON public.products TO service_role;
  END IF;

  IF to_regclass('public.tenant_products') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE ON public.tenant_products TO service_role;
  END IF;

  IF to_regclass('public.tenant_environment_settings') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE ON public.tenant_environment_settings TO service_role;
  END IF;

  IF to_regclass('public.assist_visits') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE ON public.assist_visits TO service_role;
  END IF;

  IF to_regclass('public.assist_visit_proofs') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE ON public.assist_visit_proofs TO service_role;
  END IF;

  IF to_regclass('public.client_portal_settings') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE ON public.client_portal_settings TO service_role;
  END IF;

  IF to_regclass('public.client_portal_access') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE ON public.client_portal_access TO service_role;
  END IF;

  IF to_regclass('public.employee_portal_accounts') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE ON public.employee_portal_accounts TO service_role;
  END IF;
END $$;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
