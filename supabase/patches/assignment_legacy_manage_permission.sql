-- Restore legacy assignment view/manage grants in the existing private role resolver.
-- Tenant replacements, explicit employee denials, active identity and record scope
-- remain enforced by the unchanged company_permission/company_actor helpers.
-- No role, account, assignment, budget or other business rows are modified.
BEGIN;

DO $guard$
BEGIN
  IF pg_catalog.to_regprocedure('care_security.company_role_permission(uuid,uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'Existing company access permission resolver is required.';
  END IF;
END $guard$;

CREATE OR REPLACE FUNCTION care_security.company_role_permission(p_tenant uuid,p_role uuid,p_permission text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE v_role public.roles%ROWTYPE;
BEGIN
  SELECT * INTO v_role FROM public.roles WHERE id=p_role;
  IF NOT FOUND OR (to_jsonb(v_role)->>'tenant_id' IS NOT NULL AND to_jsonb(v_role)->>'tenant_id'<>p_tenant::text)
    OR lower(v_role.key) IN ('employee_portal','client_portal','family_portal','employee','client','family','relative','caregiver','nurse') THEN RETURN false; END IF;
  IF EXISTS(SELECT 1 FROM public.role_permission_sets s WHERE s.tenant_id=p_tenant AND s.role_key=v_role.key) THEN
    RETURN EXISTS(SELECT 1 FROM public.role_permission_sets s WHERE s.tenant_id=p_tenant AND s.role_key=v_role.key AND s.permission_key=p_permission);
  END IF;
  IF EXISTS(SELECT 1 FROM public.role_permissions rp WHERE rp.role_id=p_role
    AND (to_jsonb(rp)->>'tenant_id' IS NULL OR to_jsonb(rp)->>'tenant_id'=p_tenant::text)) THEN
    -- Exact keys are grants in the established runtime contract. Legacy
    -- can_view defaults to false even on seeded exact management keys; those
    -- flags belong to coarse legacy modules, not removal of an exact grant.
    -- Preserve the established legacy assignment contract: manage uses
    -- can_update, while can_delete alone never grants management authority.
    RETURN EXISTS(SELECT 1 FROM public.role_permissions rp WHERE rp.role_id=p_role
      AND (rp.permission_key=p_permission OR (
        rp.permission_key='assignments' AND (
          (p_permission='assist.assignments.view' AND coalesce(rp.can_view,false))
          OR (p_permission='assist.assignments.manage' AND coalesce(rp.can_update,false))
        )
      ))
      AND (to_jsonb(rp)->>'tenant_id' IS NULL OR to_jsonb(rp)->>'tenant_id'=p_tenant::text));
  END IF;
  RETURN coalesce((to_jsonb(v_role)->>'is_admin_role')::boolean,false)
    OR lower(v_role.key) IN ('owner','admin','management','geschaeftsfuehrung','business_admin');
END $body$;

COMMIT;
