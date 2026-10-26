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
    and p_employee is not null
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

commit;
