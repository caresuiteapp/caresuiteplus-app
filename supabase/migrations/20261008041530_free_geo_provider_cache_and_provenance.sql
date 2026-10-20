create table if not exists public.free_geo_cache (
 tenant_id uuid not null references public.tenants(id) on delete cascade,
 cache_key text not null check(length(cache_key)=64), payload jsonb not null, expires_at timestamptz not null,
 primary key(tenant_id,cache_key)
);
alter table public.free_geo_cache enable row level security;
revoke all on public.free_geo_cache from public,anon,authenticated;
grant select,insert,update,delete on public.free_geo_cache to service_role;
create index if not exists free_geo_cache_expiry on public.free_geo_cache(expires_at);
create table if not exists public.free_geo_provider_limits (
 provider text primary key check(provider in ('photon','osrm')), next_at timestamptz not null default now(), day date not null default current_date, request_count integer not null default 0
);
alter table public.free_geo_provider_limits enable row level security;
revoke all on public.free_geo_provider_limits from public,anon,authenticated;
grant select,insert,update on public.free_geo_provider_limits to service_role;
create or replace function public.reserve_free_geo_request(p_provider text) returns integer
language plpgsql security invoker set search_path=public,pg_temp as $$
declare state public.free_geo_provider_limits%rowtype; moment timestamptz:=clock_timestamp(); slot timestamptz;
begin
 if p_provider not in ('photon','osrm') then return null; end if;
 insert into public.free_geo_provider_limits(provider) values(p_provider) on conflict do nothing;
 select * into state from public.free_geo_provider_limits where provider=p_provider for update;
 moment:=clock_timestamp(); slot:=greatest(state.next_at,moment);
 if slot>moment+interval '2200 milliseconds' or (state.day=current_date and state.request_count>=2500) then return null; end if;
 update public.free_geo_provider_limits set next_at=slot+interval '1100 milliseconds',day=current_date,request_count=case when state.day=current_date then state.request_count+1 else 1 end where provider=p_provider;
 delete from public.free_geo_cache where (tenant_id,cache_key) in (select tenant_id,cache_key from public.free_geo_cache where expires_at<moment limit 50);
 return ceil(greatest(0,extract(epoch from(slot-moment))*1000))::integer;
end $$;
revoke all on function public.reserve_free_geo_request(text) from public,anon,authenticated;
grant execute on function public.reserve_free_geo_request(text) to service_role;
alter table public.employee_logbook_trips add column if not exists route_calculation_provider text;
alter table public.employee_logbook_trips drop constraint if exists employee_logbook_trips_distance_source_check;
alter table public.employee_logbook_trips add constraint employee_logbook_trips_distance_source_check check(distance_source in ('gps','google_fallback','osm_fallback','manual','office_corrected'));
comment on column public.employee_logbook_trips.route_calculation_provider is 'Provider of calculated planned distance, separate from actual GPS distance. Historical Google records remain unchanged.';
