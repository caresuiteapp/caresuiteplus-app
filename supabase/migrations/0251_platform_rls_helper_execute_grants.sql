-- ==========================================================================
-- CareSuite+ — Migration 0251: RLS helper EXECUTE grants (live)
-- Migration 0249 entzog authenticated EXECUTE auf RBAC-Hilfsfunktionen.
-- RLS-Policies (z. B. platform_modules_select) rufen diese Funktionen auf;
-- ohne EXECUTE schlägt direkter Tabellenzugriff fehl:
--   permission denied for function is_platform_user
--
-- Lösung: EXECUTE nur für SECURITY DEFINER RBAC-Helfer (RLS-Evaluation).
-- platform_write_audit_log bleibt ohne authenticated EXECUTE (nur intern via RPCs).
-- ==========================================================================

-- platform_current_user_id()
REVOKE EXECUTE ON FUNCTION public.platform_current_user_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_current_user_id() FROM anon;
GRANT EXECUTE ON FUNCTION public.platform_current_user_id() TO authenticated;

-- platform_current_role()
REVOKE EXECUTE ON FUNCTION public.platform_current_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_current_role() FROM anon;
GRANT EXECUTE ON FUNCTION public.platform_current_role() TO authenticated;

-- is_platform_user()
REVOKE EXECUTE ON FUNCTION public.is_platform_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_platform_user() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_platform_user() TO authenticated;

-- platform_has_capability(text)
REVOKE EXECUTE ON FUNCTION public.platform_has_capability(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_has_capability(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.platform_has_capability(TEXT) TO authenticated;

-- platform_write_audit_log: nicht direkt für authenticated ausführbar
REVOKE EXECUTE ON FUNCTION public.platform_write_audit_log(
  TEXT, TEXT, UUID, UUID, JSONB, JSONB, TEXT, TEXT, TEXT
) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_write_audit_log(
  TEXT, TEXT, UUID, UUID, JSONB, JSONB, TEXT, TEXT, TEXT
) FROM anon;
REVOKE EXECUTE ON FUNCTION public.platform_write_audit_log(
  TEXT, TEXT, UUID, UUID, JSONB, JSONB, TEXT, TEXT, TEXT
) FROM authenticated;
