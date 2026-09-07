CREATE OR REPLACE FUNCTION public.platform_list_companies(
  p_search TEXT DEFAULT NULL, p_status TEXT DEFAULT NULL, p_billing_status TEXT DEFAULT NULL,
  p_plan_key TEXT DEFAULT NULL, p_limit INTEGER DEFAULT 50, p_offset INTEGER DEFAULT 0, p_environment TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_result JSONB;
BEGIN
  PERFORM public.platform_assert_capability('tenants.read');
  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x."createdAt" DESC,x.id), '[]'::jsonb) INTO v_result
  FROM (
    SELECT pt.id, pt.tenant_id AS "tenantId", pt.tenant_name AS "tenantName", pt.legal_name AS "legalName",
      pt.slug, pt.status, pt.lifecycle_status AS "lifecycleStatus", pt.billing_status AS "billingStatus",
      pt.plan_key AS "planKey", pt.trial_ends_at AS "trialEndsAt", pt.created_at AS "createdAt",
      pt.updated_at AS "updatedAt", COALESCE(tes.mode, 'unclassified') AS "environmentMode",
      COALESCE(tes.is_pilot_tenant, false) AS "isPilotTenant",
      (EXISTS (SELECT 1 FROM public.demo_data_sets ds WHERE ds.tenant_id = pt.tenant_id AND ds.is_synthetic) OR pt.tenant_id IN (
        'a0000000-0000-4000-8000-000000000001'::uuid,
        '11111111-1111-1111-1111-111111111101'::uuid,
        '11111111-1111-1111-1111-111111111102'::uuid,
        '11111111-1111-1111-1111-111111111103'::uuid
      )) AS "isSynthetic", tes.notes AS "environmentNotes",
      (SELECT COUNT(*)::integer FROM public.platform_tenant_modules m
       WHERE m.tenant_id = pt.tenant_id AND m.status IN ('enabled', 'beta_enabled', 'trial')) AS "activeModuleCount"
    FROM public.platform_tenants pt
    LEFT JOIN public.tenant_environment_settings tes ON tes.tenant_id = pt.tenant_id
    WHERE (p_status IS NULL OR pt.status = p_status)
      AND (p_billing_status IS NULL OR pt.billing_status = p_billing_status)
      AND (p_plan_key IS NULL OR pt.plan_key = p_plan_key)
      AND (p_environment IS NULL OR COALESCE(tes.mode,'unclassified') = p_environment)
      AND (p_search IS NULL OR p_search = '' OR pt.tenant_name ILIKE '%' || p_search || '%'
        OR COALESCE(pt.slug, '') ILIKE '%' || p_search || '%'
        OR COALESCE(pt.primary_contact_email, '') ILIKE '%' || p_search || '%'
        OR pt.tenant_id::text ILIKE '%' || p_search || '%')
    ORDER BY pt.created_at DESC,pt.id LIMIT GREATEST(1, LEAST(p_limit, 200)) OFFSET GREATEST(0, p_offset)
  ) x;
  RETURN jsonb_build_object('items', v_result, 'limit', p_limit, 'offset', p_offset);
END;
$$;

REVOKE ALL ON FUNCTION public.platform_list_companies(text,text,text,text,integer,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_list_companies(text,text,text,text,integer,integer,text) TO authenticated;
