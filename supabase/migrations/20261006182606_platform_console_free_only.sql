-- CareSuite is fully free. Premium has no current booking flow.
CREATE OR REPLACE FUNCTION public.platform_has_capability(p_capability text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role TEXT;
BEGIN
  v_role := public.platform_current_role();
  IF v_role IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Current product policy: no platform tariffs, add-ons or paid subscriptions.
  IF p_capability IN (
    'plans.read', 'plans.write', 'discounts.read', 'discounts.write',
    'billing.read', 'billing.write', 'payments.read', 'payments.write'
  ) THEN
    RETURN FALSE;
  END IF;

  IF v_role = 'platform_owner' THEN
    RETURN TRUE;
  END IF;

  CASE p_capability
    WHEN 'tenants.read' THEN
      RETURN v_role IN (
        'platform_admin', 'platform_billing', 'platform_support',
        'platform_developer', 'platform_readonly'
      );
    WHEN 'tenants.write', 'tenants.suspend' THEN
      RETURN v_role = 'platform_admin';
    WHEN 'modules.read' THEN
      RETURN v_role IN (
        'platform_admin', 'platform_support', 'platform_developer', 'platform_readonly'
      );
    WHEN 'modules.write' THEN
      RETURN v_role = 'platform_admin';
    WHEN 'plans.read', 'discounts.read' THEN
      RETURN v_role IN (
        'platform_admin', 'platform_billing', 'platform_readonly'
      );
    WHEN 'plans.write', 'discounts.write' THEN
      RETURN v_role IN ('platform_admin', 'platform_billing');
    WHEN 'billing.read', 'payments.read' THEN
      RETURN v_role IN (
        'platform_admin', 'platform_billing', 'platform_readonly'
      );
    WHEN 'billing.write', 'payments.write' THEN
      RETURN v_role IN ('platform_owner', 'platform_billing');
    WHEN 'flags.read' THEN
      RETURN v_role IN (
        'platform_admin', 'platform_developer', 'platform_readonly'
      );
    WHEN 'flags.write' THEN
      RETURN v_role IN ('platform_owner', 'platform_developer');
    WHEN 'support.read', 'support.write' THEN
      RETURN v_role IN ('platform_owner', 'platform_admin', 'platform_support');
    WHEN 'audit.read' THEN
      RETURN v_role IN (
        'platform_admin', 'platform_billing', 'platform_support',
        'platform_developer', 'platform_readonly'
      );
    WHEN 'system.read', 'releases.read' THEN
      RETURN v_role IN (
        'platform_admin', 'platform_developer', 'platform_readonly'
      );
    WHEN 'system.write' THEN
      RETURN v_role = 'platform_owner';
    WHEN 'users.read' THEN
      RETURN v_role IN ('platform_owner', 'platform_admin', 'platform_readonly');
    WHEN 'users.write' THEN
      RETURN v_role = 'platform_owner';
    ELSE
      RETURN FALSE;
  END CASE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.platform_update_system_setting(p_setting_key text, p_value jsonb, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_before public.platform_system_settings%ROWTYPE;v_after public.platform_system_settings%ROWTYPE;
BEGIN
  PERFORM public.platform_assert_capability('system.write');PERFORM public.platform_assert_reason(p_reason);
  IF p_setting_key IN ('free_platform_enabled','default_trial_days','invoice_due_days') THEN
    RAISE EXCEPTION 'free_usage_policy_locked' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_before FROM public.platform_system_settings WHERE setting_key=p_setting_key FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'setting_not_found' USING ERRCODE='P0002';END IF;
  IF v_before.is_sensitive OR p_setting_key ~* '(secret|token|password|api[_-]?key|private|credential)'
    OR public.platform_redact_console_value(v_before.value) IS DISTINCT FROM v_before.value THEN
    RAISE EXCEPTION 'protected_setting' USING ERRCODE='42501';
  END IF;
  IF p_value IS NULL OR jsonb_typeof(p_value)<>jsonb_typeof(v_before.value) THEN
    RAISE EXCEPTION 'setting_type_mismatch' USING ERRCODE='22023';
  END IF;
  IF p_setting_key IN ('default_trial_days','support_session_minutes','invoice_due_days')
     AND (jsonb_typeof(p_value)<>'number' OR (p_value#>>'{}')::numeric<0 OR (p_value#>>'{}')::numeric<>trunc((p_value#>>'{}')::numeric)) THEN
    RAISE EXCEPTION 'invalid_setting_value' USING ERRCODE='22023';
  END IF;
  UPDATE public.platform_system_settings SET value=p_value,updated_by=auth.uid(),updated_at=now()
    WHERE id=v_before.id RETURNING * INTO v_after;
  PERFORM public.platform_write_audit_log('system_setting.changed','platform_system_setting',v_after.id,NULL,to_jsonb(v_before),to_jsonb(v_after),trim(p_reason));
  RETURN to_jsonb(v_after);
END $function$;


-- Correct only the administrative 0-Euro catalog entry created in this session.
-- Company metadata and every pre-existing catalog record remain intact.
WITH candidate AS (
  SELECT p.id,to_jsonb(p) AS before_value
  FROM public.platform_plans p
  WHERE p.plan_key='free_platform'
    AND p.plan_name='CareSuite kostenlos'
    AND p.monthly_price_cents=0 AND p.yearly_price_cents=0
    AND p.status='active'
    AND NOT EXISTS (SELECT 1 FROM public.platform_tenant_plans t WHERE t.plan_key=p.plan_key)
    AND EXISTS (
      SELECT 1 FROM public.platform_audit_log a
      WHERE a.target_id=p.id AND a.target_type='platform_plan' AND a.action='plan.created'
        AND a.actor_user_id IS NULL
        AND a.user_agent='CareSuite-Konfigurationsabgleich'
        AND a.reason LIKE 'Produktiver Konfigurationsabgleich zur freigegebenen Mandantenverwaltung vom 06.10.2026:%'
    )
  FOR UPDATE OF p
), changed AS (
  UPDATE public.platform_plans p SET status='archived',is_public=false,updated_at=now()
  FROM candidate c WHERE p.id=c.id
  RETURNING p.id,c.before_value,to_jsonb(p) AS after_value
)
INSERT INTO public.platform_audit_log(action,target_type,target_id,before,after,reason,user_agent)
SELECT 'plan.archived','platform_plan',id,before_value,after_value,
  'Korrektur gemäß Produktvorgabe vom 06.10.2026: CareSuite ist vollständig kostenlos, ohne Tarife oder Zusatzpakete. Der irrtümlich ergänzte 0-Euro-Katalogeintrag wird archiviert. Premium ist für später vorgesehen und derzeit nicht verfügbar.',
  'CareSuite-Konfigurationskorrektur'
FROM changed;
