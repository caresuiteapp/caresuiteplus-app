begin;

-- Monthly planning declarations; existing workforce leave approval records remain authoritative blockers.
create table public.calendar_employee_month_plans (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  revision integer not null default 1 check (revision > 0),
  slots jsonb not null default '[]'::jsonb check (jsonb_typeof(slots) = 'array'),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (tenant_id, employee_id, month)
);
create index calendar_employee_month_range on public.calendar_employee_month_plans (tenant_id, month);
alter table public.calendar_employee_month_plans enable row level security;
revoke all on public.calendar_employee_month_plans from public, anon, authenticated;
grant select, insert, update on public.calendar_employee_month_plans to authenticated;

create policy calendar_month_read on public.calendar_employee_month_plans for select to authenticated
using (tenant_id = (select public.current_tenant_id()) and (
  public.has_permission('assist.assignments.manage') or public.has_permission('office.employees.absences.view')
  or public.has_permission('office.employees.absences.manage')
));
create policy calendar_month_insert on public.calendar_employee_month_plans for insert to authenticated
with check (tenant_id = (select public.current_tenant_id()) and (
  public.has_permission('assist.assignments.manage') or public.has_permission('office.employees.absences.manage')
) and exists (select 1 from public.employees e where e.id = employee_id and e.tenant_id = calendar_employee_month_plans.tenant_id));
create policy calendar_month_update on public.calendar_employee_month_plans for update to authenticated
using (tenant_id = (select public.current_tenant_id()) and (
  public.has_permission('assist.assignments.manage') or public.has_permission('office.employees.absences.manage')
))
with check (tenant_id = (select public.current_tenant_id()) and (
  public.has_permission('assist.assignments.manage') or public.has_permission('office.employees.absences.manage')
) and exists (select 1 from public.employees e where e.id = employee_id and e.tenant_id = calendar_employee_month_plans.tenant_id));

create or replace function public.calendar_validate_employee_month()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare s jsonb; ids text[] := '{}'; d date; t text; local_stamp timestamp;
begin
  if not exists (select 1 from public.employees e where e.id = new.employee_id and e.tenant_id = new.tenant_id) then
    raise exception 'Mitarbeitende gehören nicht zum Mandanten.' using errcode = '42501';
  end if;
  if jsonb_typeof(new.slots) is distinct from 'array' or jsonb_array_length(new.slots) > 300 then
    raise exception 'Maximal 300 Zeitfenster erlaubt.';
  end if;
  for s in select value from jsonb_array_elements(new.slots) loop
    if jsonb_typeof(s) is distinct from 'object' or coalesce(s->>'id','') = '' or s->>'id' = any(ids)
      or coalesce(s->>'kind','') not in ('available','blocked')
      or jsonb_typeof(s->'label') is distinct from 'string' or length(s->>'label') > 160
      or coalesce(s->>'date','') !~ '^\d{4}-\d{2}-\d{2}$'
      or coalesce(s->>'startTime','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      or coalesce(s->>'endTime','') !~ '^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$'
      or (s->>'startTime') >= (s->>'endTime') then raise exception 'Ungültiges oder unvollständiges Zeitfenster.';
    end if;
    ids := array_append(ids, s->>'id');
    d := (s->>'date')::date;
    if date_trunc('month', d)::date <> new.month then raise exception 'Datum liegt außerhalb des gewählten Monats.'; end if;
    foreach t in array array[s->>'startTime', s->>'endTime'] loop
      local_stamp := d + t::time;
      if (local_stamp at time zone 'Europe/Berlin') at time zone 'Europe/Berlin' <> local_stamp then
        raise exception 'Ortszeit existiert wegen der Zeitumstellung nicht.';
      end if;
    end loop;
  end loop;
  new.revision := case when tg_op = 'UPDATE' then old.revision + 1 else 1 end;
  new.updated_at := now(); new.updated_by := auth.uid();
  return new;
end $$;
revoke all on function public.calendar_validate_employee_month() from public, anon;
create trigger calendar_month_validate before insert or update on public.calendar_employee_month_plans
for each row execute function public.calendar_validate_employee_month();

create or replace function public.calendar_save_employee_month(
  p_tenant_id uuid, p_employee_id uuid, p_month date, p_expected_revision integer, p_slots jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare saved public.calendar_employee_month_plans;
begin
  if auth.uid() is null or p_tenant_id is distinct from public.current_tenant_id()
    or not (public.has_permission('assist.assignments.manage') or public.has_permission('office.employees.absences.manage')) then
    raise exception 'Keine Berechtigung zur Personalplanung.' using errcode = '42501';
  end if;
  if p_expected_revision = 0 then
    insert into public.calendar_employee_month_plans(tenant_id, employee_id, month, slots)
    values(p_tenant_id, p_employee_id, p_month, p_slots)
    on conflict (tenant_id, employee_id, month) do nothing returning * into saved;
  else
    update public.calendar_employee_month_plans set slots = p_slots
    where tenant_id = p_tenant_id and employee_id = p_employee_id and month = p_month and revision = p_expected_revision
    returning * into saved;
  end if;
  if saved.employee_id is null then
    raise exception 'Der Monatsplan wurde zwischenzeitlich geändert. Bitte neu öffnen und Änderungen abgleichen.' using errcode = '40001';
  end if;
  return to_jsonb(saved);
end $$;
revoke all on function public.calendar_save_employee_month(uuid,uuid,date,integer,jsonb) from public, anon;
grant execute on function public.calendar_save_employee_month(uuid,uuid,date,integer,jsonb) to authenticated;
commit;
