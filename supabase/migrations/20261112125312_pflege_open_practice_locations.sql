-- Open practice locations are not prescriber identities. Keep this read-only
-- directory separate from physicians and from all medication references.
create table pflege_catalog.practice_locations (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  source text not null check (source = 'rvr-ruhr-praxis'),
  source_version text not null check (pflege_catalog.valid_text(source_version, 120)),
  source_updated_at date check (source_updated_at between date '1900-01-01' and date '9999-12-31'),
  external_id text not null check (pflege_catalog.valid_text(external_id, 160)),
  display_name text not null check (pflege_catalog.valid_text(display_name, 180)),
  practice_name text check (pflege_catalog.valid_text(practice_name, 240)),
  specialty text check (pflege_catalog.valid_text(specialty, 160)),
  postal_code text check (postal_code is null or postal_code ~ '^[0-9]{5}$'),
  city text check (pflege_catalog.valid_text(city, 120)),
  street text check (pflege_catalog.valid_text(street, 200)),
  phone text check (pflege_catalog.valid_text(phone, 60)),
  search_document tsvector generated always as (to_tsvector('simple'::regconfig,
    coalesce(display_name,'') || ' ' || coalesce(practice_name,'') || ' ' || coalesce(specialty,'') || ' ' ||
    coalesce(postal_code,'') || ' ' || coalesce(city,'') || ' ' || coalesce(street,''))) stored,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id),
  unique (tenant_id, source, external_id)
);
create index pflege_catalog_practice_location_search on pflege_catalog.practice_locations using gin(search_document);

alter table pflege_catalog.practice_locations enable row level security;
revoke all on table pflege_catalog.practice_locations from public, anon, authenticated, service_role;
grant select on table pflege_catalog.practice_locations to authenticated;
create policy practice_location_read on pflege_catalog.practice_locations for select to authenticated
  using (tenant_id = (select public.current_tenant_id()) and (select pflege_catalog.actor_allowed(public.current_tenant_id(), 'read')));

create function public.search_pflege_practice_locations(p_tenant uuid, p_query text)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare words tsquery; result jsonb;
begin
  if not pflege_catalog.actor_allowed(p_tenant, 'read') then
    raise exception 'Leseberechtigung fehlt.' using errcode = '42501';
  end if;
  words := pflege_catalog.prefix_query(p_query);
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'source', p.source, 'sourceVersion', p.source_version, 'sourceUpdatedAt', to_char(p.source_updated_at, 'YYYY-MM-DD'),
    'displayName', p.display_name, 'practiceName', p.practice_name, 'specialty', p.specialty,
    'postalCode', p.postal_code, 'city', p.city, 'street', p.street, 'phone', p.phone
  ) order by p.display_name, p.id), '[]'::jsonb)
  into result from (select * from pflege_catalog.practice_locations
    where tenant_id = p_tenant and search_document @@ words order by display_name, id limit 30) p;
  return result;
end $$;

revoke all on function public.search_pflege_practice_locations(uuid,text) from public, anon, authenticated, service_role;
grant execute on function public.search_pflege_practice_locations(uuid,text) to authenticated;
notify pgrst, 'reload schema';
