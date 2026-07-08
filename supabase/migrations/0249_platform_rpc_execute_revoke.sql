-- ==========================================================================
-- CareSuite+ — Migration 0249: Platform RPC EXECUTE hardening (live)
-- REVOKE anon/PUBLIC auf platform_* und interne Hilfsfunktionen.
-- GRANT authenticated nur für bewusst externe RPCs.
-- ==========================================================================

-- Alle platform_* Funktionen: anon + PUBLIC entziehen
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS function_name,
      pg_get_function_identity_arguments(p.oid) AS function_args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname LIKE 'platform\_%'
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC',
      r.schema_name,
      r.function_name,
      r.function_args
    );
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %I.%I(%s) FROM anon',
      r.schema_name,
      r.function_name,
      r.function_args
    );
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %I.%I(%s) FROM authenticated',
      r.schema_name,
      r.function_name,
      r.function_args
    );
  END LOOP;
END $$;

-- Tenant-Modul-RPCs: anon + PUBLIC entziehen (kein platform_-Prefix)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS function_name,
      pg_get_function_identity_arguments(p.oid) AS function_args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('tenant_list_platform_modules', 'tenant_has_platform_module')
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC',
      r.schema_name,
      r.function_name,
      r.function_args
    );
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %I.%I(%s) FROM anon',
      r.schema_name,
      r.function_name,
      r.function_args
    );
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %I.%I(%s) FROM authenticated',
      r.schema_name,
      r.function_name,
      r.function_args
    );
  END LOOP;
END $$;

-- Externe Platform-RPCs: nur authenticated (Capability-Check intern)
GRANT EXECUTE ON FUNCTION public.platform_get_current_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_get_dashboard_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_list_tenants(TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_get_tenant_detail(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_update_tenant_status(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_set_tenant_module(UUID, TEXT, TEXT, TEXT, BOOLEAN, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_assign_plan(UUID, TEXT, TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_assign_discount(UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_remove_discount(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_update_invoice_status(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_record_manual_payment(UUID, UUID, INTEGER, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_set_feature_flag(TEXT, BOOLEAN, TEXT, TEXT, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_start_support_session(UUID, TEXT, TIMESTAMPTZ, BOOLEAN, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_end_support_session(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_update_system_setting(TEXT, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_list_audit_log(UUID, TEXT, INTEGER, INTEGER) TO authenticated;

-- Tenant-App: Modul-Lesefunktionen
GRANT EXECUTE ON FUNCTION public.tenant_list_platform_modules(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_has_platform_module(TEXT, UUID) TO authenticated;

-- Intern: platform_write_audit_log, RBAC-Hilfsfunktionen bleiben ohne authenticated/anon EXECUTE
REVOKE ALL ON FUNCTION public.platform_current_user_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.platform_current_role() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_platform_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.platform_has_capability(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.platform_write_audit_log(TEXT, TEXT, UUID, UUID, JSONB, JSONB, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
