-- ==========================================================================
-- CareSuite+ — Migration 0250: platform_list_tenants ORDER BY fix (live)
-- jsonb_agg ORDER BY must use subquery alias "createdAt", not created_at
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.platform_list_tenants(
  p_search TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_billing_status TEXT DEFAULT NULL,
  p_plan_key TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.platform_has_capability('tenants.read') THEN
    RAISE EXCEPTION 'platform_forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t."createdAt" DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      pt.id,
      pt.tenant_id AS "tenantId",
      pt.tenant_name AS "tenantName",
      pt.legal_name AS "legalName",
      pt.slug,
      pt.status,
      pt.lifecycle_status AS "lifecycleStatus",
      pt.billing_status AS "billingStatus",
      pt.plan_key AS "planKey",
      pt.trial_ends_at AS "trialEndsAt",
      pt.created_at AS "createdAt",
      pt.updated_at AS "updatedAt",
      (
        SELECT COUNT(*)::integer
        FROM public.platform_tenant_modules ptm
        WHERE ptm.tenant_id = pt.tenant_id AND ptm.status IN ('enabled', 'beta_enabled', 'trial')
      ) AS "activeModuleCount"
    FROM public.platform_tenants pt
    WHERE (p_status IS NULL OR pt.status = p_status)
      AND (p_billing_status IS NULL OR pt.billing_status = p_billing_status)
      AND (p_plan_key IS NULL OR pt.plan_key = p_plan_key)
      AND (
        p_search IS NULL OR p_search = '' OR
        pt.tenant_name ILIKE '%' || p_search || '%' OR
        pt.slug ILIKE '%' || p_search || '%' OR
        pt.primary_contact_email ILIKE '%' || p_search || '%' OR
        pt.tenant_id::text ILIKE '%' || p_search || '%'
      )
    ORDER BY pt.created_at DESC
    LIMIT GREATEST(1, LEAST(p_limit, 200))
    OFFSET GREATEST(0, p_offset)
  ) t;

  RETURN jsonb_build_object('items', v_result, 'limit', p_limit, 'offset', p_offset);
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_list_tenants(TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
