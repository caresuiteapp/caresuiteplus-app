-- ==========================================================================
-- CareSuite+ — Migration 0247: Platform Tenant Module Access (live)
-- Tenant-seitiges Lesen von platform_tenant_modules ohne RLS-Aufweichung.
-- Audit-Log Immutability verstärken.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- Tenant darf eigene Modulfreischaltungen lesen (SECURITY DEFINER)
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tenant_list_platform_modules(
  p_tenant_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  v_tenant_id := COALESCE(p_tenant_id, public.current_tenant_id());

  IF v_tenant_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_platform_user() THEN
    IF public.current_tenant_id() IS DISTINCT FROM v_tenant_id THEN
      RAISE EXCEPTION 'tenant_forbidden' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'moduleKey', ptm.module_key,
          'status', ptm.status,
          'isTrial', ptm.is_trial,
          'trialEndsAt', ptm.trial_ends_at,
          'startsAt', ptm.starts_at,
          'endsAt', ptm.ends_at,
          'manualOverride', ptm.manual_override
        )
        ORDER BY ptm.module_key
      )
      FROM public.platform_tenant_modules ptm
      WHERE ptm.tenant_id = v_tenant_id
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.tenant_list_platform_modules(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.tenant_has_platform_module(
  p_module_key TEXT,
  p_tenant_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_row public.platform_tenant_modules%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  v_tenant_id := COALESCE(p_tenant_id, public.current_tenant_id());
  IF v_tenant_id IS NULL OR p_module_key IS NULL OR trim(p_module_key) = '' THEN
    RETURN FALSE;
  END IF;

  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  IF NOT public.is_platform_user() THEN
    IF public.current_tenant_id() IS DISTINCT FROM v_tenant_id THEN
      RETURN FALSE;
    END IF;
  END IF;

  SELECT * INTO v_row
  FROM public.platform_tenant_modules
  WHERE tenant_id = v_tenant_id AND module_key = p_module_key;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_row.status IN ('disabled', 'locked', 'expired') THEN
    RETURN FALSE;
  END IF;

  IF v_row.starts_at IS NOT NULL AND v_row.starts_at > v_now THEN
    RETURN FALSE;
  END IF;

  IF v_row.ends_at IS NOT NULL AND v_row.ends_at <= v_now THEN
    RETURN FALSE;
  END IF;

  IF v_row.is_trial AND v_row.trial_ends_at IS NOT NULL AND v_row.trial_ends_at <= v_now THEN
    RETURN FALSE;
  END IF;

  IF v_row.status IN ('enabled', 'beta_enabled', 'trial') THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tenant_has_platform_module(TEXT, UUID) TO authenticated;

-- --------------------------------------------------------------------------
-- platform_audit_log: explizit UPDATE/DELETE verbieten
-- --------------------------------------------------------------------------
REVOKE UPDATE, DELETE ON public.platform_audit_log FROM authenticated;
REVOKE UPDATE, DELETE ON public.platform_audit_log FROM anon;

-- --------------------------------------------------------------------------
-- platform_tenant_modules: Mandanten dürfen eigene Zeilen nicht direkt lesen
-- (nur über SECURITY DEFINER RPCs oben — RLS bleibt platform-only)
-- --------------------------------------------------------------------------
