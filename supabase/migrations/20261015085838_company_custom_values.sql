BEGIN;
-- Apply after company_access.sql. Existing values stay in the established table.
-- A definition and its value must belong to the same tenant; no cross-tenant FK link.
DROP POLICY IF EXISTS tenant_custom_field_values_select_tenant ON public.tenant_custom_field_values;
DROP POLICY IF EXISTS tenant_custom_field_values_insert_manage ON public.tenant_custom_field_values;
DROP POLICY IF EXISTS tenant_custom_field_values_update_manage ON public.tenant_custom_field_values;
DROP POLICY IF EXISTS tenant_custom_field_values_delete_manage ON public.tenant_custom_field_values;
CREATE POLICY tenant_custom_field_values_select_tenant ON public.tenant_custom_field_values FOR SELECT TO authenticated
USING (care_security.company_actor(tenant_id, 'business.tenant.manage') AND EXISTS (
  SELECT 1 FROM public.tenant_custom_field_definitions d
  WHERE d.id = definition_id AND d.tenant_id = tenant_custom_field_values.tenant_id
    AND d.is_active AND d.visibility->>'office' = 'true'
    AND COALESCE(d.visibility->>'protected','false') <> 'true'
    AND COALESCE(d.visibility->>'private','false') <> 'true'
    AND COALESCE(d.visibility->>'sensitive','false') <> 'true'
));
CREATE POLICY tenant_custom_field_values_insert_manage ON public.tenant_custom_field_values FOR INSERT TO authenticated
WITH CHECK (care_security.company_actor(tenant_id, 'business.tenant.manage') AND EXISTS (
  SELECT 1 FROM public.tenant_custom_field_definitions d
  WHERE d.id = definition_id AND d.tenant_id = tenant_custom_field_values.tenant_id
    AND d.is_active AND d.visibility->>'office' = 'true'
    AND COALESCE(d.visibility->>'protected','false') <> 'true'
    AND COALESCE(d.visibility->>'private','false') <> 'true'
    AND COALESCE(d.visibility->>'sensitive','false') <> 'true'
));
CREATE POLICY tenant_custom_field_values_update_manage ON public.tenant_custom_field_values FOR UPDATE TO authenticated
USING (care_security.company_actor(tenant_id, 'business.tenant.manage') AND EXISTS (
  SELECT 1 FROM public.tenant_custom_field_definitions d
  WHERE d.id = definition_id AND d.tenant_id = tenant_custom_field_values.tenant_id
    AND d.is_active AND d.visibility->>'office' = 'true'
    AND COALESCE(d.visibility->>'protected','false') <> 'true'
    AND COALESCE(d.visibility->>'private','false') <> 'true'
    AND COALESCE(d.visibility->>'sensitive','false') <> 'true'
))
WITH CHECK (care_security.company_actor(tenant_id, 'business.tenant.manage') AND EXISTS (
  SELECT 1 FROM public.tenant_custom_field_definitions d
  WHERE d.id = definition_id AND d.tenant_id = tenant_custom_field_values.tenant_id
    AND d.is_active AND d.visibility->>'office' = 'true'
    AND COALESCE(d.visibility->>'protected','false') <> 'true'
    AND COALESCE(d.visibility->>'private','false') <> 'true'
    AND COALESCE(d.visibility->>'sensitive','false') <> 'true'
));
CREATE POLICY tenant_custom_field_values_delete_manage ON public.tenant_custom_field_values FOR DELETE TO authenticated
USING (care_security.company_actor(tenant_id, 'business.tenant.manage') AND EXISTS (
  SELECT 1 FROM public.tenant_custom_field_definitions d
  WHERE d.id = definition_id AND d.tenant_id = tenant_custom_field_values.tenant_id
    AND d.is_active AND d.visibility->>'office' = 'true'
    AND COALESCE(d.visibility->>'protected','false') <> 'true'
    AND COALESCE(d.visibility->>'private','false') <> 'true'
    AND COALESCE(d.visibility->>'sensitive','false') <> 'true'
));

COMMIT;
