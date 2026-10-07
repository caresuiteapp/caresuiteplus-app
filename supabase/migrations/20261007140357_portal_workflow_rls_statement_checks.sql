SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
-- Portal visit reads timed out (57014) while evaluating the same identity
-- helpers in each row and again in nested visit/task policies. Keep every
-- existing policy, role, command and business predicate; turn request-constant
-- checks into initPlans. Do not increase statement_timeout or disable RLS.
DO $migration$
DECLARE
  policy_row record;
  expression_text text;
  rewritten text;
  using_text text;
  check_text text;
  clause text;
  tenant_pinned boolean;
BEGIN
  FOR policy_row IN
    SELECT tablename, policyname, qual, with_check
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'assist_visits', 'assignments', 'assist_visit_tasks',
        'assist_visit_execution_state', 'assist_time_events',
        'clients', 'employees', 'client_ambulatory_details'
      ])
  LOOP
    using_text := NULL;
    check_text := NULL;
    FOR clause, expression_text IN
      SELECT 'USING', policy_row.qual
      UNION ALL SELECT 'WITH CHECK', policy_row.with_check
    LOOP
      IF expression_text IS NULL THEN CONTINUE; END IF;
      -- The argument of a row-dependent actor check may only be replaced when
      -- this policy already requires the row's tenant to be the current tenant.
      tenant_pinned := expression_text ~
        '^\(\(tenant_id = (public\.)?current_tenant_id\(\)\) AND ';
      -- pg_policies deparses existing initPlans as SELECT helper() AS helper.
      -- Leave those calls alone when this repair is run a second time.
      rewritten := regexp_replace(expression_text,
        '(?<!SELECT )(?<![[:alnum:]_.])(public\.)?(current_tenant_id|current_role_key|current_client_id|resolve_current_employee_id|current_employee_id|current_portal_type|current_portal_account_id|is_tenant_admin|can_manage_clients_for_current_tenant)\(\)',
        '(SELECT public.\2())', 'g');
      rewritten := regexp_replace(rewritten,
        '(?<!SELECT )(?<![[:alnum:]_.])(public\.)?has_permission\((''[^'']+''::text)\)',
        '(SELECT public.has_permission(\2))', 'g');
      IF tenant_pinned THEN
        rewritten := regexp_replace(rewritten,
          '\m(public\.)?(is_internal_tenant_actor|is_employee_portal_rls_context|is_client_portal_rls_context)\(tenant_id\)',
          '(SELECT public.\2((SELECT public.current_tenant_id())))', 'g');
        rewritten := regexp_replace(rewritten,
          '\m(public\.)?portal_employee_assigned_visit_ids\(' || policy_row.tablename || '\.tenant_id\)',
          'public.portal_employee_assigned_visit_ids((SELECT public.current_tenant_id()))', 'g');
      END IF;
      IF rewritten IS DISTINCT FROM expression_text THEN
        IF clause = 'USING' THEN using_text := rewritten;
        ELSE check_text := rewritten;
        END IF;
      END IF;
    END LOOP;
    IF using_text IS NOT NULL OR check_text IS NOT NULL THEN
      EXECUTE format('ALTER POLICY %I ON public.%I%s%s',
        policy_row.policyname, policy_row.tablename,
        CASE WHEN using_text IS NULL THEN '' ELSE format(' USING (%s)', using_text) END,
        CASE WHEN check_text IS NULL THEN '' ELSE format(' WITH CHECK (%s)', check_text) END);
    END IF;
  END LOOP;
END;
$migration$;

NOTIFY pgrst, 'reload schema';
