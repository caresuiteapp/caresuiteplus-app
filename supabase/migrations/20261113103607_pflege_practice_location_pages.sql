-- The original RPCs retain their result and signature for existing releases.
-- Read-only keyset pages expose the rest of the same tenant-scoped catalog.
create function public.search_pflege_osm_practice_locations_page(
  p_tenant uuid, p_query text, p_state text default null, p_after uuid default null
) returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare words tsquery; after_name text; result jsonb;
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
  if p_after is not null then
    select p.display_name into after_name from pflege_catalog.osm_practice_locations p
    where p.tenant_id = p_tenant and p.id = p_after and p.search_document @@ words
      and (p_state is null or p.state_code = p_state);
    if not found then raise exception 'Suchposition ist nicht mehr gültig.' using errcode = '22023'; end if;
  end if;

  with page as (
    select p.id, p.source, p.source_version, p.source_updated_at, p.display_name, p.practice_name, p.specialty,
      p.postal_code, p.city, p.street, p.phone, p.state_code, p.state_name
    from pflege_catalog.osm_practice_locations p
    where p.tenant_id = p_tenant and p.search_document @@ words and (p_state is null or p.state_code = p_state)
      and (p_after is null or (p.display_name, p.id) > (after_name, p_after))
    order by p.display_name, p.id limit 31
  ), numbered as (
    select p.*, row_number() over (order by p.display_name, p.id) as position from page p
  )
  select jsonb_build_object('rows', coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'source', p.source, 'sourceVersion', p.source_version, 'sourceUpdatedAt', to_char(p.source_updated_at, 'YYYY-MM-DD'),
    'displayName', p.display_name, 'practiceName', p.practice_name, 'specialty', p.specialty,
    'postalCode', p.postal_code, 'city', p.city, 'street', p.street, 'phone', p.phone,
    'stateCode', p.state_code, 'stateName', p.state_name
  ) order by p.position) filter (where p.position <= 30), '[]'::jsonb),
    'nextCursor', case when count(*) > 30 then (array_agg(p.id order by p.position))[30] end)
  into result from numbered p;
  return result;
end $$;

create function public.search_pflege_practice_locations_page(
  p_tenant uuid, p_query text, p_after uuid default null
) returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare words tsquery; after_name text; result jsonb;
begin
  if not pflege_catalog.actor_allowed(p_tenant, 'read') then
    raise exception 'Leseberechtigung fehlt.' using errcode = '42501';
  end if;
  words := pflege_catalog.prefix_query(p_query);
  if p_after is not null then
    select p.display_name into after_name from pflege_catalog.practice_locations p
    where p.tenant_id = p_tenant and p.id = p_after and p.search_document @@ words;
    if not found then raise exception 'Suchposition ist nicht mehr gültig.' using errcode = '22023'; end if;
  end if;

  with page as (
    select p.id, p.source, p.source_version, p.source_updated_at, p.display_name, p.practice_name, p.specialty,
      p.postal_code, p.city, p.street, p.phone
    from pflege_catalog.practice_locations p
    where p.tenant_id = p_tenant and p.search_document @@ words
      and (p_after is null or (p.display_name, p.id) > (after_name, p_after))
    order by p.display_name, p.id limit 31
  ), numbered as (
    select p.*, row_number() over (order by p.display_name, p.id) as position from page p
  )
  select jsonb_build_object('rows', coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'source', p.source, 'sourceVersion', p.source_version, 'sourceUpdatedAt', to_char(p.source_updated_at, 'YYYY-MM-DD'),
    'displayName', p.display_name, 'practiceName', p.practice_name, 'specialty', p.specialty,
    'postalCode', p.postal_code, 'city', p.city, 'street', p.street, 'phone', p.phone
  ) order by p.position) filter (where p.position <= 30), '[]'::jsonb),
    'nextCursor', case when count(*) > 30 then (array_agg(p.id order by p.position))[30] end)
  into result from numbered p;
  return result;
end $$;

revoke all on function public.search_pflege_osm_practice_locations_page(uuid,text,text,uuid),
  public.search_pflege_practice_locations_page(uuid,text,uuid) from public, anon, authenticated, service_role;
grant execute on function public.search_pflege_osm_practice_locations_page(uuid,text,text,uuid),
  public.search_pflege_practice_locations_page(uuid,text,uuid) to authenticated;
notify pgrst, 'reload schema';
