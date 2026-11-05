-- Operational scope-data repair. Caller owns BEGIN/COMMIT and SET LOCAL
-- caresuite.pflege_permission_repair_tenant. Existing update/audit triggers stay active.
-- No permission keys, action flags, RLS policies or API grants are added or changed.
do $repair$
declare
 target_tenant uuid := nullif(current_setting('caresuite.pflege_permission_repair_tenant',true),'')::uuid;
 target_role uuid;
 before_keys text[];
 missing_scope_keys text[];
 changed_keys text[];
 before_values jsonb;
 after_values jsonb;
 legacy_keys text[] := array[
  'pflege.acceptance.manage','pflege.audit.view','pflege.billing.release','pflege.billing.view',
  'pflege.deviations.manage','pflege.deviations.view','pflege.diagnoses.manage','pflege.diagnoses.view',
  'pflege.evaluations.manage','pflege.evaluations.view','pflege.invoices.manage','pflege.md.readiness',
  'pflege.measures.review','pflege.orders.manage','pflege.orders.view','pflege.plans.manage','pflege.plans.view',
  'pflege.proofs.create','pflege.proofs.review','pflege.proofs.sign','pflege.proofs.view','pflege.quality.view',
  'pflege.risks.manage','pflege.risks.view','pflege.visits.manage','pflege.visits.view'];
 expected_keys text[] := array[
  'pflege.acceptance.manage','pflege.access','pflege.assessments.manage','pflege.audit.view',
  'pflege.billing.release','pflege.billing.view','pflege.deviations.manage','pflege.deviations.view',
  'pflege.diagnoses.manage','pflege.diagnoses.view','pflege.documentation.create','pflege.documentation.sign',
  'pflege.documentation.view','pflege.evaluations.manage','pflege.evaluations.view','pflege.handovers.manage',
  'pflege.handovers.view','pflege.invoices.manage','pflege.md.readiness','pflege.measures.review',
  'pflege.medications.administer','pflege.medications.manage','pflege.medications.view','pflege.orders.manage',
  'pflege.orders.view','pflege.plans.manage','pflege.plans.view','pflege.proofs.create','pflege.proofs.review',
  'pflege.proofs.sign','pflege.proofs.view','pflege.quality.view','pflege.risks.manage','pflege.risks.view',
  'pflege.treatment.manage','pflege.treatment.view','pflege.visits.manage','pflege.visits.view',
  'pflege.vitals.manage','pflege.vitals.view','pflege.wounds.manage','pflege.wounds.view'];
begin
 if target_tenant is null then raise exception 'Explicit repair tenant is required.'; end if;
 lock table public.role_permission_sets in share mode;
 select r.id into strict target_role from public.roles r
 where r.tenant_id=target_tenant and r.key='owner' and r.is_admin_role and r.can_manage_roles
  and 'pflege'=any(r.allowed_products::text[])
  and exists(select 1 from public.profiles p where p.role_id=r.id and p.tenant_id=target_tenant and p.is_active and p.status='active')
  and exists(select 1 from public.role_permissions p where p.role_id=r.id and p.permission_key='pflege.plans.manage')
 for update;
 if exists(select 1 from public.role_permission_sets s where s.tenant_id=target_tenant and s.role_key in('owner','business_admin')) then
  raise exception 'Explicit tenant permission replacement requires individual review.';
 end if;
 lock table public.role_permissions in share row exclusive mode;
 select array_agg(permission_key order by permission_key),
  coalesce(array_agg(permission_key order by permission_key) filter(where tenant_id is null),array[]::text[]),
  jsonb_agg(to_jsonb(p)-'tenant_id'-'updated_at' order by permission_key)
 into before_keys,missing_scope_keys,before_values
 from public.role_permissions p where role_id=target_role and permission_key like 'pflege.%';
 if before_keys is distinct from expected_keys then
  raise exception 'Owner Pflege baseline differs from the complete inspected forty-two keys.';
 end if;
 if exists(select 1 from public.role_permissions where role_id=target_role and tenant_id is not null and tenant_id<>target_tenant) then
  raise exception 'Owner permission rows have a foreign tenant.';
 end if;
 if missing_scope_keys is distinct from legacy_keys and cardinality(missing_scope_keys)<>0 then
  raise exception 'Unscoped owner grants differ from the inspected twenty-six legacy keys.';
 end if;
 if exists(select 1 from unnest(expected_keys) k where not exists(select 1 from public.permission_catalog c where c.key=k and c.module='pflege')) then
  raise exception 'Complete registered Pflege catalog is required.';
 end if;
 with changed as (
  update public.role_permissions set tenant_id=target_tenant
  where role_id=target_role and permission_key like 'pflege.%' and tenant_id is null
  returning permission_key
 ) select coalesce(array_agg(permission_key order by permission_key),array[]::text[]) into changed_keys from changed;
 if changed_keys is distinct from missing_scope_keys then raise exception 'Owner scope repair was not complete.'; end if;
 select jsonb_agg(to_jsonb(p)-'tenant_id'-'updated_at' order by permission_key) into after_values
 from public.role_permissions p where role_id=target_role and permission_key like 'pflege.%';
 if after_values is distinct from before_values or exists(
  select 1 from public.role_permissions where role_id=target_role and permission_key like 'pflege.%' and tenant_id is distinct from target_tenant
 ) then raise exception 'Owner permission data changed beyond its tenant scope and normal update timestamp.'; end if;
 if cardinality(changed_keys)>0 then
  insert into public.permission_audit_log(tenant_id,actor_id,actor_role,action,old_value,new_value,reason)
  values(target_tenant,null,'maintenance','pflege_owner_permission_tenant_repair',
   jsonb_build_object('roleId',target_role,'unscopedKeys',missing_scope_keys),
   jsonb_build_object('roleId',target_role,'pflege',before_keys,'scopeUpdatedKeys',changed_keys,'scopeRowsUpdated',cardinality(changed_keys)),
   'Explicit user report of missing Pflege access: attach the inspected existing owner grants to their existing role tenant. Permission keys and action flags unchanged; normal updated_at and row audit triggers retained. No other role, replacement, RLS policy or API grant changed.');
 end if;
end
$repair$;
