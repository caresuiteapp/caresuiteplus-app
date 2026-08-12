-- CareSuite HealthOS — produktive Medikation für ambulante Pflege und Intensivpflege
-- Verordnungen bleiben fachlich änderbar; Gabennachweise sind append-only.
begin;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'medication_status') then
    create type public.medication_status as enum ('active','paused','stopped','archived');
  end if;
end $$;

alter table public.medications
  add column if not exists active_ingredient text,
  add column if not exists strength text,
  add column if not exists form text,
  add column if not exists schedule text,
  add column if not exists status public.medication_status not null default 'active',
  add column if not exists is_prn boolean not null default false,
  add column if not exists prescribed_by text,
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists morning_dose text,
  add column if not exists noon_dose text,
  add column if not exists evening_dose text,
  add column if not exists night_dose text,
  add column if not exists prn_reason text,
  add column if not exists indication text,
  add column if not exists notes text,
  add column if not exists interaction_notes text,
  add column if not exists side_effect_notes text,
  add column if not exists storage_notes text,
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null,
  add column if not exists route text,
  add column if not exists is_high_alert boolean not null default false,
  add column if not exists is_controlled_substance boolean not null default false,
  add column if not exists intensive_care_relevant boolean not null default false,
  add column if not exists infusion_rate text,
  add column if not exists dilution text,
  add column if not exists pump_required boolean not null default false;

comment on column public.medications.is_high_alert is 'Hochrisikomedikament; erfordert hervorgehobene Prüfung vor Gabe.';
comment on column public.medications.is_controlled_substance is 'Betäubungsmittel; Gabe erfordert Gegenkontrolle.';
comment on column public.medications.intensive_care_relevant is 'Verordnung für außerklinische Intensivpflege.';

create table if not exists public.medication_administrations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  medication_id uuid not null references public.medications(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  scheduled_at timestamptz,
  administered_at timestamptz,
  status text not null check (status in ('scheduled','administered','omitted','refused','held','late')),
  administered_dose text,
  route text,
  deviation_reason text,
  prn_reason text,
  effect_evaluation text,
  pain_score_before smallint check (pain_score_before between 0 and 10),
  pain_score_after smallint check (pain_score_after between 0 and 10),
  vital_context jsonb not null default '{}'::jsonb,
  notes text,
  administered_by uuid references public.profiles(id) on delete restrict,
  witnessed_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint medication_administration_time_required check (
    status = 'scheduled' or administered_at is not null
  ),
  constraint medication_administration_deviation_reason check (
    status in ('scheduled','administered') or nullif(btrim(deviation_reason), '') is not null
  ),
  constraint medication_administration_distinct_witness check (
    witnessed_by is null or administered_by is null or witnessed_by <> administered_by
  )
);

comment on table public.medication_administrations is
  'Unveränderbare Gaben- und Abweichungsdokumentation für ambulante Pflege und außerklinische Intensivpflege.';

create index if not exists idx_medication_administrations_tenant_client_time
  on public.medication_administrations (tenant_id, client_id, administered_at desc);
create index if not exists idx_medication_administrations_medication_time
  on public.medication_administrations (medication_id, created_at desc);
create index if not exists idx_medications_tenant_status_updated
  on public.medications (tenant_id, status, updated_at desc);

-- Verhindert fachlich falsche Fremdzuordnung trotz gültiger Einzel-FKs.
create or replace function public.enforce_medication_administration_scope()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  medication_row public.medications%rowtype;
begin
  if new.status <> 'scheduled' then
    new.administered_at := clock_timestamp();
  end if;

  select * into medication_row
  from public.medications
  where id = new.medication_id;

  if medication_row.id is null
     or medication_row.tenant_id <> new.tenant_id
     or medication_row.client_id <> new.client_id then
    raise exception 'Verordnung, Mandant und Klient:in stimmen nicht überein.' using errcode = '23514';
  end if;

  if medication_row.status <> 'active' then
    raise exception 'Nur aktive Verordnungen dürfen dokumentiert werden.' using errcode = '23514';
  end if;

  if medication_row.is_prn is true
     and new.status = 'administered'
     and nullif(btrim(new.prn_reason), '') is null then
    raise exception 'Bedarfsindikation fehlt.' using errcode = '23514';
  end if;

  if medication_row.is_controlled_substance is true
     and new.status = 'administered'
     and new.witnessed_by is null then
    raise exception 'BtM-Gabe erfordert Gegenkontrolle.' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_medication_administration_scope on public.medication_administrations;
create trigger enforce_medication_administration_scope
before insert on public.medication_administrations
for each row execute function public.enforce_medication_administration_scope();

alter table public.medications enable row level security;
alter table public.medication_administrations enable row level security;

drop policy if exists medications_select on public.medications;
create policy medications_select on public.medications for select to authenticated using (
  tenant_id = public.current_tenant_id()
  and public.has_permission('pflege.medications.view')
  and public.is_active_pfleger_client(client_id)
);

drop policy if exists medications_write on public.medications;
create policy medications_write on public.medications for all to authenticated using (
  tenant_id = public.current_tenant_id()
  and public.has_permission('pflege.medications.manage')
  and public.is_active_pfleger_client(client_id)
) with check (
  tenant_id = public.current_tenant_id()
  and public.has_permission('pflege.medications.manage')
  and public.is_active_pfleger_client(client_id)
);

drop policy if exists medication_administrations_select on public.medication_administrations;
create policy medication_administrations_select on public.medication_administrations for select to authenticated using (
  tenant_id = public.current_tenant_id()
  and public.has_permission('pflege.medications.view')
  and public.is_active_pfleger_client(client_id)
);

drop policy if exists medication_administrations_insert on public.medication_administrations;
create policy medication_administrations_insert on public.medication_administrations for insert to authenticated with check (
  tenant_id = public.current_tenant_id()
  and public.has_permission('pflege.medications.administer')
  and public.is_active_pfleger_client(client_id)
  and administered_by = public.resolve_current_profile_id()
);

grant select, insert, update on public.medications to authenticated;
grant select, insert on public.medication_administrations to authenticated;
revoke update, delete on public.medication_administrations from authenticated;

-- Gibt nur die für eine Gegenkontrolle erforderlichen Namen zurück, nicht das gesamte Profil.
create or replace function public.medication_witness_options()
returns table (id uuid, label text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, coalesce(nullif(p.display_name, ''), p.email, 'Pflegefachkraft')
  from public.profiles p
  where auth.uid() is not null
    and p.tenant_id = public.current_tenant_id()
    and p.is_active is true
    and p.id <> public.resolve_current_profile_id()
    and public.has_permission('pflege.medications.administer')
  order by p.display_name, p.email;
$$;

revoke all on function public.medication_witness_options() from public, anon;
grant execute on function public.medication_witness_options() to authenticated;

commit;
