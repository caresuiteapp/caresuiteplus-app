-- Dedicated source set: the ODbL practice directory stays independent of RVR,
-- verified prescribers, patient data and medication order references.
create table pflege_catalog.osm_practice_locations (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  source text not null check (source = 'osm-de-praxis'),
  source_version text not null check (pflege_catalog.valid_text(source_version, 120)),
  source_updated_at date check (source_updated_at between date '1900-01-01' and date '9999-12-31'),
  external_id text not null check (external_id ~ '^[nwr]:[1-9][0-9]{0,19}$'),
  display_name text not null check (pflege_catalog.valid_text(display_name, 180)),
  practice_name text check (pflege_catalog.valid_text(practice_name, 240)),
  specialty text check (pflege_catalog.valid_text(specialty, 160)),
  postal_code text check (postal_code is null or postal_code ~ '^[0-9]{5}$'),
  city text check (pflege_catalog.valid_text(city, 120)),
  street text check (pflege_catalog.valid_text(street, 200)),
  phone text check (pflege_catalog.valid_text(phone, 60)),
  state_code text,
  state_name text,
  search_document tsvector generated always as (to_tsvector('simple'::regconfig,
    display_name || ' ' || coalesce(practice_name,'') || ' ' || coalesce(specialty,'') || ' ' ||
    coalesce(postal_code,'') || ' ' || coalesce(city,'') || ' ' || coalesce(street,''))) stored,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id),
  unique (tenant_id, source, external_id),
  check ((state_code is null and state_name is null) or
    (state_code is not null and state_name is not null and (state_code, state_name) in (
      ('DE-BW','Baden-Württemberg'), ('DE-BY','Bayern'), ('DE-BE','Berlin'), ('DE-BB','Brandenburg'),
      ('DE-HB','Bremen'), ('DE-HH','Hamburg'), ('DE-HE','Hessen'), ('DE-MV','Mecklenburg-Vorpommern'),
      ('DE-NI','Niedersachsen'), ('DE-NW','Nordrhein-Westfalen'), ('DE-RP','Rheinland-Pfalz'), ('DE-SL','Saarland'),
      ('DE-SN','Sachsen'), ('DE-ST','Sachsen-Anhalt'), ('DE-SH','Schleswig-Holstein'), ('DE-TH','Thüringen')
    )))
);
create index pflege_catalog_osm_practice_location_search on pflege_catalog.osm_practice_locations using gin(search_document);
create index pflege_catalog_osm_practice_location_state on pflege_catalog.osm_practice_locations(tenant_id, state_code);

alter table pflege_catalog.osm_practice_locations enable row level security;
revoke all on table pflege_catalog.osm_practice_locations from public, anon, authenticated, service_role;
grant select on table pflege_catalog.osm_practice_locations to authenticated;
create policy osm_practice_location_read on pflege_catalog.osm_practice_locations for select to authenticated
  using (tenant_id = (select public.current_tenant_id()) and (select pflege_catalog.actor_allowed(public.current_tenant_id(), 'read')));

create function public.search_pflege_osm_practice_locations(p_tenant uuid, p_query text, p_state text default null)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare words tsquery; result jsonb;
begin
  if not pflege_catalog.actor_allowed(p_tenant, 'read') then
    raise exception 'Leseberechtigung fehlt.' using errcode = '42501';
  end if;
  if p_state is not null and p_state not in (
    'DE-BW','DE-BY','DE-BE','DE-BB','DE-HB','DE-HH','DE-HE','DE-MV','DE-NI','DE-NW','DE-RP','DE-SL','DE-SN','DE-ST','DE-SH','DE-TH'
  ) then
    raise exception 'Ungültiger Bundeslandfilter.' using errcode = '22023';
  end if;
  words := pflege_catalog.prefix_query(p_query);
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'source', p.source, 'sourceVersion', p.source_version, 'sourceUpdatedAt', to_char(p.source_updated_at, 'YYYY-MM-DD'),
    'displayName', p.display_name, 'practiceName', p.practice_name, 'specialty', p.specialty,
    'postalCode', p.postal_code, 'city', p.city, 'street', p.street, 'phone', p.phone,
    'stateCode', p.state_code, 'stateName', p.state_name
  ) order by p.display_name, p.id), '[]'::jsonb)
  into result from (select * from pflege_catalog.osm_practice_locations
    where tenant_id = p_tenant and search_document @@ words and (p_state is null or state_code = p_state)
    order by display_name, id limit 30) p;
  return result;
end $$;

revoke all on function public.search_pflege_osm_practice_locations(uuid,text,text) from public, anon, authenticated, service_role;
grant execute on function public.search_pflege_osm_practice_locations(uuid,text,text) to authenticated;
notify pgrst, 'reload schema';
