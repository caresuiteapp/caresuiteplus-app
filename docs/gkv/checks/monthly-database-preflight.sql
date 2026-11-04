-- Read-only catalog check for the monthly review drafts. Run on the designated
-- CareSuite staging database. No application data, SQL functions under test,
-- DDL, migration history writes or business transactions are executed.
-- A present marker is NOT proof of the correct definition, grants, RLS or rollout.
WITH inventory(category, kind, name, source_ref, expected_return) AS (
  VALUES
    ('prerequisite', 'role', 'anon', NULL, NULL),
    ('prerequisite', 'role', 'authenticated', NULL, NULL),
    ('prerequisite', 'role', 'service_role', NULL, NULL),
    ('prerequisite', 'table', 'auth.sessions', NULL, NULL),
    ('prerequisite', 'table', 'storage.objects', NULL, NULL),
    ('prerequisite', 'table', 'public.tenants', NULL, NULL),
    ('prerequisite', 'table', 'public.assignments', NULL, NULL),
    ('prerequisite', 'table', 'public.assist_visits', NULL, NULL),
    ('prerequisite', 'table', 'public.assist_visit_proofs', NULL, NULL),
    ('prerequisite', 'table', 'public.assist_visit_signatures', NULL, NULL),
    ('prerequisite', 'table', 'public.assist_visit_documentation', NULL, NULL),
    ('prerequisite', 'table', 'public.assist_time_events', NULL, NULL),
    ('prerequisite', 'table', 'public.clients', NULL, NULL),
    ('prerequisite', 'table', 'public.employees', NULL, NULL),
    ('prerequisite', 'table', 'public.employee_portal_accounts', NULL, NULL),
    ('prerequisite', 'table', 'public.profiles', NULL, NULL),
    ('prerequisite', 'table', 'public.service_records', NULL, NULL),
    ('prerequisite', 'function', 'auth.uid()', NULL, NULL),
    ('prerequisite', 'function', 'auth.jwt()', NULL, NULL),
    ('prerequisite', 'function', 'public.current_tenant_id()', NULL, NULL),
    ('prerequisite', 'function', 'public.current_portal_type()', NULL, NULL),
    ('prerequisite', 'function', 'public.current_portal_account_id()', NULL, NULL),
    ('prerequisite', 'function', 'public.resolve_current_employee_id()', NULL, NULL),
    ('prerequisite', 'function', 'public.resolve_current_profile_id()', NULL, NULL),
    ('prerequisite', 'function', 'public.current_client_id()', NULL, NULL),
    ('prerequisite', 'function', 'public.platform_tenant_access_allowed(uuid,boolean)', NULL, NULL),
    ('prerequisite', 'function', 'public.is_client_portal_rls_context(uuid)', NULL, NULL),
    ('prerequisite', 'function', 'public.is_employee_portal_rls_context(uuid)', NULL, NULL),
    ('prerequisite', 'function', 'care_security.office_actor(uuid,text)', NULL, NULL),
    ('prerequisite', 'function', 'extensions.hmac(bytea,bytea,text)', NULL, NULL),
    ('prerequisite', 'function', 'public.employee_portal_release_deferred_signature(uuid,uuid,uuid,text,jsonb,text)', '20260905170000', NULL),
    ('prerequisite', 'function', 'public.client_portal_finalize_assist_proof(uuid,uuid,uuid,text,text,text,text)', '20260911120000', NULL),
    ('prerequisite', 'function', 'public.workflow_record_actor_allowed(uuid,uuid)', '20261013072827', NULL),
    ('prerequisite', 'function', 'public.workflow_tasks_match(jsonb,uuid,uuid,uuid,boolean)', '20261013072827', NULL),
    ('prerequisite', 'function', 'public.workflow_canonical_json(jsonb)', '20261013072827', NULL),
    ('prerequisite', 'function', 'public.workflow_signed_proof_source(uuid,uuid,uuid,boolean,boolean)', '20261013072827', NULL),
    ('prerequisite', 'function', 'care_security.office_invoice_assert_source(public.service_records,boolean)', '20261018075737', 'void'),
    ('prerequisite', 'function', 'care_security.gkv_exchange_actor(uuid,text)', '20261019214752', 'boolean'),
    ('draft_marker', 'table', 'public.gkv_monthly_proofs', 'draft-01', NULL),
    ('draft_marker', 'function', 'public.gkv_monthly_workspace(uuid,uuid,text)', 'draft-02', NULL),
    ('draft_marker', 'table', 'care_security.gkv_monthly_paper_receipts', 'draft-03', NULL),
    ('draft_marker', 'table', 'care_security.gkv_monthly_worker_keys', 'draft-04', NULL),
    ('draft_marker', 'table', 'care_security.gkv_monthly_authorities', 'draft-05', NULL),
    ('draft_marker', 'table', 'care_security.gkv_monthly_fact_profiles', 'draft-06', NULL),
    ('draft_marker', 'table', 'care_security.gkv_employee_registrations', 'draft-07', NULL),
    ('draft_marker', 'table', 'care_security.gkv_assist_originals', 'draft-08', NULL),
    ('draft_marker', 'table', 'care_security.gkv_assist_deferred_sources', 'draft-09', NULL),
    ('draft_marker', 'table', 'care_security.gkv_assist_amendments', 'draft-10', NULL),
    ('draft_marker', 'function', 'public.gkv_assist_amend_description(uuid,uuid,uuid,jsonb)', 'draft-10', NULL)
), observed AS (
  SELECT i.*, CASE i.kind
    WHEN 'role' THEN EXISTS (SELECT 1 FROM pg_catalog.pg_roles r WHERE r.rolname=i.name)
    WHEN 'table' THEN EXISTS (SELECT 1 FROM pg_catalog.pg_class c
      WHERE c.oid=pg_catalog.to_regclass(i.name) AND c.relkind IN ('r','p'))
    WHEN 'function' THEN CASE
      WHEN i.name='care_security.office_invoice_assert_source(public.service_records,boolean)'
        AND pg_catalog.to_regtype('public.service_records') IS NULL THEN false
      ELSE EXISTS (SELECT 1 FROM pg_catalog.pg_proc p
        WHERE p.oid=pg_catalog.to_regprocedure(i.name) AND p.prokind='f'
          AND (i.expected_return IS NULL OR p.prorettype=pg_catalog.to_regtype(i.expected_return))) END
  END AS present
  FROM inventory i
)
SELECT category, kind, name, source_ref, present
FROM observed
ORDER BY CASE category WHEN 'prerequisite' THEN 0 ELSE 1 END, present, source_ref NULLS LAST, name;
