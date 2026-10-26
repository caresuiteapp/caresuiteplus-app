-- Reviewed source patch; not applied to production and not a versioned migration.
-- Preserve existing business membership access. Portal roles must use an
-- explicit active employee scope; client/family sessions never inherit it.
begin;

create or replace function public.employee_logbook_own_employee(p_tenant uuid, p_employee uuid)
returns boolean
language sql stable security definer
set search_path = public
as $function$
  select coalesce(
    p_tenant = public.current_tenant_id()
    and case
      when public.current_role_key() = 'employee_portal' then
        public.is_employee_portal_rls_context(p_tenant)
        and p_employee = public.resolve_current_employee_id()
      when public.current_role_key() in ('client_portal', 'family_portal') then false
      else public.current_role_key() is not null and public.is_tenant_member(p_tenant)
    end,
    false
  );
$function$;

drop policy if exists employee_location_consents_office_assist_select on public.employee_location_consents;
create policy employee_location_consents_office_assist_select
on public.employee_location_consents
for select to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.is_tenant_member(tenant_id)
  and public.current_role_key() not in ('employee_portal', 'client_portal', 'family_portal')
);

-- Restrictive policies also close legacy direct Office branches that do not
-- call the shared helper. Existing permissive status/ownership rules still
-- have to allow the operation; these guards never grant an operation.
do $guard$
declare target_table text;
begin
  foreach target_table in array array[
    'employee_logbook_daily_confirmations',
    'employee_logbook_profiles',
    'employee_logbook_prompt_decisions',
    'employee_logbook_receipts',
    'employee_logbook_segments',
    'employee_logbook_trips',
    'employee_logbook_vehicles',
    'employee_visit_mobility_selections',
    'employee_logbook_points',
    'employee_location_consents'
  ] loop
    execute format('alter table public.%I enable row level security', target_table);
    execute format('drop policy if exists employee_logbook_portal_scope_guard on public.%I', target_table);
    execute format(
      'create policy employee_logbook_portal_scope_guard on public.%I as restrictive for all to authenticated using (public.employee_logbook_own_employee(tenant_id, employee_id)) with check (public.employee_logbook_own_employee(tenant_id, employee_id))',
      target_table
    );
  end loop;
end;
$guard$;

alter table public.employee_logbook_audit_events enable row level security;
drop policy if exists employee_logbook_audit_business_scope_guard on public.employee_logbook_audit_events;
create policy employee_logbook_audit_business_scope_guard
on public.employee_logbook_audit_events as restrictive for all to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.is_tenant_member(tenant_id)
  and public.current_role_key() not in ('employee_portal', 'client_portal', 'family_portal')
)
with check (
  tenant_id = public.current_tenant_id()
  and public.is_tenant_member(tenant_id)
  and public.current_role_key() not in ('employee_portal', 'client_portal', 'family_portal')
);

commit;
