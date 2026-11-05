-- Operational data repair, not a global role seed or an API grant.
-- Caller owns BEGIN/COMMIT and SET LOCAL caresuite.pflege_permission_repair_tenant.
-- Only the explicitly selected tenant's already Pflege-managing active owner is eligible.
do $repair$
declare
 target_tenant uuid := nullif(current_setting('caresuite.pflege_permission_repair_tenant',true),'')::uuid;
 target_role uuid;
 before_keys text[];
 after_keys text[];
 inserted_keys text[];
 catalog_added integer;
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
 select array_agg(permission_key order by permission_key) into before_keys
 from public.role_permissions where role_id=target_role and permission_key like 'pflege.%';
 if before_keys is distinct from legacy_keys and before_keys is distinct from expected_keys then
  raise exception 'Owner Pflege baseline differs from the inspected legacy or repaired list.';
 end if;
 if exists(select 1 from public.role_permissions where role_id=target_role and tenant_id is not null and tenant_id<>target_tenant) then
  raise exception 'Owner permission rows have a foreign tenant.';
 end if;
 insert into public.permission_catalog(key,module,category,label,description,risk_level,requires_audit)
 values
 ('pflege.access','pflege','access','Pflege-Modul öffnen','Den freigegebenen Pflege-Arbeitsbereich im eigenen Mandanten öffnen.','high',true),
 ('pflege.vitals.view','pflege','vitals','Vitalwerte ansehen','Klientenbezogene Vitalwertmessungen und Verläufe im eigenen Mandanten lesen.','high',true)
 on conflict(key) do nothing;
 get diagnostics catalog_added=row_count;
 if exists(select 1 from unnest(expected_keys) k where not exists(select 1 from public.permission_catalog c where c.key=k and c.module='pflege')) then
  raise exception 'Complete registered Pflege catalog is required.';
 end if;
 with added as (
  insert into public.role_permissions(tenant_id,role_id,permission_key)
  select target_tenant,target_role,k from unnest(expected_keys) k
  on conflict(role_id,permission_key) do nothing returning permission_key
 ) select coalesce(array_agg(permission_key order by permission_key),array[]::text[]) into inserted_keys from added;
 select array_agg(permission_key order by permission_key) into after_keys
 from public.role_permissions where role_id=target_role and permission_key like 'pflege.%';
 if after_keys is distinct from expected_keys then raise exception 'Owner repair was not complete.';end if;
 if cardinality(inserted_keys)>0 or catalog_added>0 then
  insert into public.permission_audit_log(tenant_id,actor_id,actor_role,action,old_value,new_value,reason)
  values(target_tenant,null,'maintenance','pflege_owner_permission_repair',
   jsonb_build_object('roleId',target_role,'pflege',before_keys),
   jsonb_build_object('roleId',target_role,'pflege',after_keys,'insertedKeys',inserted_keys,'catalogAdded',catalog_added),
   'Explicit user request after Pflege web release: complete inspected owner baseline; no employee/portal grants, tenant replacement, RLS or API grants changed.');
 end if;
end
$repair$;
