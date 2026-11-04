-- Keep the existing read predicates and roles. Evaluate only row-independent
-- authentication helpers once per statement instead of once per source row.
-- The payroll revision still hashes the complete existing source/history scope.
BEGIN;
DO $body$
DECLARE
  v_policy record;
  v_before text;
  v_after text;
  v_helper text;
BEGIN
  FOR v_policy IN SELECT * FROM (VALUES
    ('employee_expense_claims', 'payroll_expenses_select'),
    ('payroll_month_statements', 'payroll_statements_select'),
    ('workforce_work_sessions', 'wfm_sessions_select'),
    ('workforce_time_events', 'wfm_events_select'),
    ('workforce_time_entry_reviews', 'wfm_entry_reviews_select'),
    ('workforce_time_accounts', 'wfm_accounts_select')
  ) AS policies(table_name, policy_name)
  LOOP
    SELECT qual INTO v_before FROM pg_policies
      WHERE schemaname = 'public' AND tablename = v_policy.table_name
        AND policyname = v_policy.policy_name AND cmd = 'SELECT'
        AND roles = ARRAY['authenticated']::name[];
    IF v_before IS NULL THEN
      RAISE EXCEPTION 'Required payroll read policy is missing: %.%', v_policy.table_name, v_policy.policy_name;
    END IF;
    v_after := v_before;
    FOREACH v_helper IN ARRAY ARRAY['current_tenant_id', 'resolve_current_employee_id', 'is_tenant_admin']
    LOOP
      v_after := regexp_replace(v_after,
        '(public\.)?' || v_helper || '\(\)',
        '(SELECT public.' || v_helper || '())', 'g');
    END LOOP;
    -- Match literal permission keys only. Row-dependent checks stay untouched.
    v_after := regexp_replace(v_after,
      '(public\.)?has_permission\((''[^'']+''(::text)?)\)',
      '(SELECT public.has_permission(\2))', 'g');
    EXECUTE format('ALTER POLICY %I ON public.%I USING (%s)',
      v_policy.policy_name, v_policy.table_name, v_after);
  END LOOP;
END
$body$;
COMMIT;
