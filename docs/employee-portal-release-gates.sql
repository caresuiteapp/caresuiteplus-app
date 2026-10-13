-- REVIEW DRAFT ONLY. Never applied to a Supabase project.
-- Based on read-only production policy/grant metadata, 2026-10-11.
-- These restrictive ceilings constrain existing PERMISSIVE tenant-wide grants.
-- Create/review a real migration with the supported CLI before deployment.
-- This is deliberately not a complete personnel/Storage authorization repair:
--   * other personnel tables and raw portal/signatures paths need their own audit;
--   * permission-bearing profiles role_id/identity fields are still writable by
--     own-row authenticated actors in the installed metadata; protect those too;
--   * legacy signature archive writes employee_documents directly today. Replace
--     that path with an authenticated atomic, fixed-field completion RPC first;
--   * own work-days need a limited server projection; no broad contract grant here;
--   * validate caregiver/nurse legacy JWTs: the own-read helper here currently
--     recognizes employee_portal only; no legacy-role release is asserted;
--   * verify first-login Edge service-role writes and Office permissions separately.
-- No personal data is modified by this draft.
BEGIN;

DROP POLICY IF EXISTS employee_documents_release_read_ceiling ON public.employee_documents;
CREATE POLICY employee_documents_release_read_ceiling ON public.employee_documents
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.current_tenant_id())
    AND (
      (
        (SELECT public.is_internal_tenant_actor(public.current_tenant_id()))
        AND ((SELECT public.has_permission('office.employees.view')) OR (SELECT public.is_tenant_admin()))
        AND (
          (sensitive IS FALSE AND lower(coalesce(category, '')) NOT IN ('background_check','warning','termination','confidentiality'))
          OR (SELECT public.current_role_key()) IN ('business_admin','business_manager')
        )
      )
      OR (
        (SELECT public.is_employee_portal_rls_context(public.current_tenant_id()))
        AND employee_id = (SELECT public.resolve_current_employee_id())
        AND released_to_portal IS TRUE
        AND sensitive IS FALSE
        AND lower(coalesce(category, '')) NOT IN ('background_check','warning','termination','confidentiality')
      )
    )
  );

DROP POLICY IF EXISTS employee_documents_insert_ceiling ON public.employee_documents;
CREATE POLICY employee_documents_insert_ceiling ON public.employee_documents
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (SELECT public.current_tenant_id())
    AND (SELECT public.is_internal_tenant_actor(public.current_tenant_id()))
    AND ((SELECT public.has_permission('office.employees.edit')) OR (SELECT public.is_tenant_admin()))
  );
DROP POLICY IF EXISTS employee_documents_update_ceiling ON public.employee_documents;
CREATE POLICY employee_documents_update_ceiling ON public.employee_documents
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    tenant_id = (SELECT public.current_tenant_id())
    AND (SELECT public.is_internal_tenant_actor(public.current_tenant_id()))
    AND ((SELECT public.has_permission('office.employees.edit')) OR (SELECT public.is_tenant_admin()))
  )
  WITH CHECK (
    tenant_id = (SELECT public.current_tenant_id())
    AND (SELECT public.is_internal_tenant_actor(public.current_tenant_id()))
    AND ((SELECT public.has_permission('office.employees.edit')) OR (SELECT public.is_tenant_admin()))
  );
DROP POLICY IF EXISTS employee_documents_delete_ceiling ON public.employee_documents;
CREATE POLICY employee_documents_delete_ceiling ON public.employee_documents
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (
    tenant_id = (SELECT public.current_tenant_id())
    AND (SELECT public.is_internal_tenant_actor(public.current_tenant_id()))
    AND ((SELECT public.has_permission('office.employees.edit')) OR (SELECT public.is_tenant_admin()))
  );

DROP POLICY IF EXISTS employee_portal_accounts_insert_ceiling ON public.employee_portal_accounts;
CREATE POLICY employee_portal_accounts_insert_ceiling ON public.employee_portal_accounts
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (SELECT public.current_tenant_id())
    AND (SELECT public.is_internal_tenant_actor(public.current_tenant_id()))
    AND ((SELECT public.has_permission('office.employees.edit')) OR (SELECT public.is_tenant_admin()))
  );
DROP POLICY IF EXISTS employee_portal_accounts_update_ceiling ON public.employee_portal_accounts;
CREATE POLICY employee_portal_accounts_update_ceiling ON public.employee_portal_accounts
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    tenant_id = (SELECT public.current_tenant_id())
    AND (SELECT public.is_internal_tenant_actor(public.current_tenant_id()))
    AND ((SELECT public.has_permission('office.employees.edit')) OR (SELECT public.is_tenant_admin()))
  )
  WITH CHECK (
    tenant_id = (SELECT public.current_tenant_id())
    AND (SELECT public.is_internal_tenant_actor(public.current_tenant_id()))
    AND ((SELECT public.has_permission('office.employees.edit')) OR (SELECT public.is_tenant_admin()))
  );

-- Protect personal files under tenant/{tenant}/employees/{employee}/... even
-- when office_docs_select/update otherwise permits the whole tenant directory.
-- Other buckets and path families are unchanged and are NOT declared secure.
DROP POLICY IF EXISTS employee_private_storage_select_ceiling ON storage.objects;
CREATE POLICY employee_private_storage_select_ceiling ON storage.objects
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    NOT (
      bucket_id = 'office-documents'
      AND (storage.foldername(name))[1] = 'tenant'
      AND (storage.foldername(name))[3] = 'employees'
    )
    OR (
      (storage.foldername(name))[2] = (SELECT public.current_tenant_id())::text
      AND (
        (
          (storage.foldername(name))[5] = 'portal-uploads'
          AND (
            (
              (SELECT public.is_employee_portal_rls_context(public.current_tenant_id()))
              AND (storage.foldername(name))[4] = (SELECT public.resolve_current_employee_id())::text
            )
            OR (
              (SELECT public.is_internal_tenant_actor(public.current_tenant_id()))
              AND ((SELECT public.has_permission('office.employees.view')) OR (SELECT public.is_tenant_admin()))
            )
          )
        )
        OR EXISTS (
          SELECT 1 FROM public.employee_documents document
          WHERE document.tenant_id = (SELECT public.current_tenant_id())
            AND document.storage_path = objects.name
        )
      )
    )
  );
DROP POLICY IF EXISTS employee_private_storage_insert_ceiling ON storage.objects;
CREATE POLICY employee_private_storage_insert_ceiling ON storage.objects
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    NOT (
      bucket_id = 'office-documents'
      AND (storage.foldername(name))[1] = 'tenant'
      AND (storage.foldername(name))[3] = 'employees'
    )
    OR (
      (storage.foldername(name))[2] = (SELECT public.current_tenant_id())::text
      AND (
        (SELECT public.is_internal_tenant_actor(public.current_tenant_id()))
        OR (
          (SELECT public.is_employee_portal_rls_context(public.current_tenant_id()))
          AND (storage.foldername(name))[4] = (SELECT public.resolve_current_employee_id())::text
          AND (storage.foldername(name))[5] = 'portal-uploads'
        )
      )
    )
  );
DROP POLICY IF EXISTS employee_private_storage_update_ceiling ON storage.objects;
CREATE POLICY employee_private_storage_update_ceiling ON storage.objects
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    NOT (bucket_id = 'office-documents' AND (storage.foldername(name))[1] = 'tenant' AND (storage.foldername(name))[3] = 'employees')
    OR (
      (storage.foldername(name))[2] = (SELECT public.current_tenant_id())::text
      AND (SELECT public.is_internal_tenant_actor(public.current_tenant_id()))
      AND ((SELECT public.has_permission('office.employees.edit')) OR (SELECT public.is_tenant_admin()))
    )
  )
  WITH CHECK (
    NOT (bucket_id = 'office-documents' AND (storage.foldername(name))[1] = 'tenant' AND (storage.foldername(name))[3] = 'employees')
    OR (
      (storage.foldername(name))[2] = (SELECT public.current_tenant_id())::text
      AND (SELECT public.is_internal_tenant_actor(public.current_tenant_id()))
      AND ((SELECT public.has_permission('office.employees.edit')) OR (SELECT public.is_tenant_admin()))
    )
  );
COMMIT;
