set local lock_timeout = '5s';

alter table public.clinical_treatment_corrections enable row level security;

create policy ambulatory_treatment_correction_history_read
on public.clinical_treatment_corrections
for select to authenticated
using (
  (select account_security.allowed_session())
  and coalesce((select public.current_portal_type()), 'business') = 'business'
  and tenant_id = (select public.current_tenant_id())
  and public.is_active_pfleger_client(client_id)
  and exists (
    select 1
    from public.profiles as actor
    join public.roles as actor_role on actor_role.id = actor.role_id
    join public.role_permissions as permission on permission.role_id = actor_role.id
    where actor.id = (select public.resolve_current_profile_id())
      and actor.tenant_id = clinical_treatment_corrections.tenant_id
      and actor.is_active
      and actor.status = 'active'
      and actor_role.key not in ('employee_portal', 'client_portal', 'family_portal')
      and coalesce(to_jsonb(actor_role)->>'tenant_id', actor.tenant_id::text) = actor.tenant_id::text
      and (actor.auth_user_id = (select auth.uid()) or (actor.auth_user_id is null and actor.id = (select auth.uid())))
      and (permission.permission_key = 'pflege.treatment.view'
        or (permission.permission_key = 'treatment' and permission.can_view))
  )
  and exists (
    select 1
    from public.clinical_treatment_executions as original
    join public.clients as client on client.id = original.client_id and client.tenant_id = original.tenant_id
    where original.id = clinical_treatment_corrections.execution_id
      and original.tenant_id = clinical_treatment_corrections.tenant_id
      and original.client_id = clinical_treatment_corrections.client_id
      and client.deleted_at is null
      and clinical_treatment_corrections.execution_snapshot @> jsonb_build_object(
        'id', original.id, 'tenant_id', original.tenant_id, 'client_id', original.client_id
      )
  )
  and (wound_case_id is null or exists (
    select 1
    from public.ambulatory_wound_dressings as dressing
    where dressing.id = clinical_treatment_corrections.dressing_id
      and dressing.wound_case_id = clinical_treatment_corrections.wound_case_id
      and dressing.execution_id = clinical_treatment_corrections.execution_id
      and dressing.client_id = clinical_treatment_corrections.client_id
      and dressing.tenant_id = clinical_treatment_corrections.tenant_id
  ))
);

grant select on public.clinical_treatment_corrections to authenticated;

