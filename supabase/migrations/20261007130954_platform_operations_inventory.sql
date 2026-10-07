-- Aggregate existing records only. No telemetry storage, collector, IP or session data.
CREATE OR REPLACE FUNCTION public.platform_get_operations_summary()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_environments jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'platform_forbidden' USING ERRCODE='42501'; END IF;
  PERFORM public.platform_assert_capability('tenants.read');
  SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.mode),'[]') INTO v_environments FROM (
    SELECT coalesce(e.mode,'unclassified') AS mode,count(*) AS companies,
      sum((SELECT count(*) FROM public.clients c WHERE c.tenant_id=t.id AND c.deleted_at IS NULL)) AS clients,
      sum((SELECT count(*) FROM public.employees m WHERE m.tenant_id=t.id AND m.deleted_at IS NULL)) AS employees
    FROM public.tenants t LEFT JOIN public.tenant_environment_settings e ON e.tenant_id=t.id GROUP BY coalesce(e.mode,'unclassified')
  ) q;
  RETURN jsonb_build_object('release','caresuite-platform-operations-20261007','checkedAt',now(),
    'inventory',jsonb_build_object(
      'companies',(SELECT count(*) FROM public.platform_tenants),
      'activeCompanies',(SELECT count(*) FROM public.platform_tenants WHERE status='active'),
      'suspendedCompanies',(SELECT count(*) FROM public.platform_tenants WHERE status IN ('suspended','locked')),
      'deactivatedCompanies',(SELECT count(*) FROM public.platform_tenants WHERE status='terminated'),
      'deletedCompanies',(SELECT count(*) FROM public.platform_tenants WHERE status='deleted_soft'),
      'clients',(SELECT count(*) FROM public.clients WHERE deleted_at IS NULL),
      'deletedClients',(SELECT count(*) FROM public.clients WHERE deleted_at IS NOT NULL),
      'employees',(SELECT count(*) FROM public.employees WHERE deleted_at IS NULL),
      'deletedEmployees',(SELECT count(*) FROM public.employees WHERE deleted_at IS NOT NULL),
      'administrationAccounts',(SELECT count(*) FROM public.tenant_users WHERE status='active'),
      'environments',v_environments),
    'operations',jsonb_build_object(
      'openSupportTickets',CASE WHEN public.platform_has_capability('support.read') THEN (SELECT count(*) FROM public.support_workspace_tickets WHERE status NOT IN ('resolved','closed')) ELSE NULL END,
      'approvedSupportAccess',CASE WHEN public.platform_has_capability('support.read') THEN (SELECT count(*) FROM public.support_access_requests r JOIN public.support_workspace_tickets t ON t.id=r.ticket_id WHERE r.status='approved' AND r.expires_at>now() AND t.status NOT IN ('resolved','closed')) ELSE NULL END,
      'welcomePending',(SELECT count(*) FROM public.registration_welcome_outbox WHERE state IN ('pending','sending')),
      'welcomeNeedsReview',(SELECT count(*) FROM public.registration_welcome_outbox WHERE state NOT IN ('pending','sending','sent')),
      'accountOperationsNeedReview',(SELECT count(*) FROM public.platform_account_operations WHERE state='needs_review')),
    'telemetry',NULL);
END; $$;
REVOKE ALL ON FUNCTION public.platform_get_operations_summary() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_get_operations_summary() TO authenticated;

-- Preserve the dashboard contract while removing obsolete paid-product queries.
CREATE OR REPLACE FUNCTION public.platform_get_dashboard_summary()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'platform_forbidden' USING ERRCODE='42501'; END IF;
  PERFORM public.platform_assert_capability('tenants.read');
  RETURN jsonb_build_object(
    'tenants',jsonb_build_object(
      'active',(SELECT count(*) FROM public.platform_tenants WHERE status='active'),
      'suspended',(SELECT count(*) FROM public.platform_tenants WHERE status IN ('suspended','locked')),
      'onboarding',(SELECT count(*) FROM public.platform_tenants WHERE status='active' AND lifecycle_status='onboarding'),
      'trial',0,'pastDue',0,'cancelled',0),
    'billing',jsonb_build_object('openInvoices',0,'pastDueInvoices',0,'failedPayments',0,'activeDiscounts',0),
    'modules',jsonb_build_object('betaActive',(SELECT count(*) FROM public.platform_tenant_modules WHERE status='beta_enabled'),'trialExpiring',0),
    'system',jsonb_build_object(
      'activeFeatureFlags',(SELECT count(*) FROM public.platform_feature_flags WHERE enabled),
      'activeSupportSessions',CASE WHEN public.platform_has_capability('support.read') THEN (SELECT count(*) FROM public.support_access_requests r JOIN public.support_workspace_tickets t ON t.id=r.ticket_id WHERE r.status='approved' AND r.expires_at>now() AND t.status NOT IN ('resolved','closed')) ELSE 0 END,
      'maintenanceMode',coalesce((SELECT value='true'::jsonb FROM public.platform_system_settings WHERE setting_key='maintenance_mode'),false)));
END; $$;

CREATE OR REPLACE FUNCTION public.platform_operations_release_status()
RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT jsonb_build_object('release','caresuite-platform-operations-20261007','ready',true,'inventoryReady',true,'observationReady',false);
$$;
REVOKE ALL ON FUNCTION public.platform_operations_release_status() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_operations_release_status() TO anon,authenticated;
