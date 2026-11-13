-- Package and authorization pages stay separate and keep the existing RPCs compatible.
create function public.search_pflege_medication_packages_page(
  p_tenant uuid, p_query text, p_after text default null
) returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare words tsquery; digits text; numeric_search boolean; after_pzn text; after_source text; after_name text;
  page_rows pflege_catalog.medication_packages[]; result jsonb;
begin
  if not pflege_catalog.actor_allowed(p_tenant, 'read') then
    raise exception 'Leseberechtigung fehlt.' using errcode = '42501';
  end if;
  words := pflege_catalog.prefix_query(p_query);
  digits := regexp_replace(btrim(p_query), '^PZN[[:space:]-]*', '', 'i');
  numeric_search := digits ~ '^[0-9]{2,8}$';

  if p_after is not null then
    if p_after !~ '^[a-z0-9][a-z0-9._-]{0,63}:[0-9]{8}$' then
      raise exception 'Suchposition ist nicht mehr gültig.' using errcode = '22023';
    end if;
    after_source := split_part(p_after, ':', 1);
    after_pzn := split_part(p_after, ':', 2);
    select p.name into after_name from pflege_catalog.medication_packages p
    where p.tenant_id = p_tenant and p.pzn = after_pzn and p.source = after_source
      and (case when numeric_search then p.pzn like digits || '%' else p.search_document @@ words end);
    if not found then raise exception 'Suchposition ist nicht mehr gültig.' using errcode = '22023'; end if;
  end if;

  if numeric_search then
    select array(select p from pflege_catalog.medication_packages p
      where p.tenant_id = p_tenant and p.pzn like digits || '%'
        and (p_after is null or (p.pzn, p.source) > (after_pzn, after_source))
      order by p.pzn, p.source limit 31) into page_rows;
  else
    select array(select p from pflege_catalog.medication_packages p
      where p.tenant_id = p_tenant and p.search_document @@ words
        and (p_after is null or (p.name, p.pzn, p.source) > (after_name, after_pzn, after_source))
      order by p.name, p.pzn, p.source limit 31) into page_rows;
  end if;

  select jsonb_build_object('rows', coalesce(jsonb_agg(pflege_catalog.package_option(page_rows[i]) order by i)
    filter (where i <= 30), '[]'::jsonb),
    'nextCursor', case when cardinality(page_rows) > 30 then (page_rows[30]).source || ':' || (page_rows[30]).pzn end)
  into result from generate_subscripts(page_rows, 1) i;
  return result;
end $$;

create function public.search_pflege_authorized_medicines_page(
  p_tenant uuid, p_query text, p_after uuid default null
) returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare words tsquery; after_name text; after_scope text; result jsonb;
begin
  if not pflege_catalog.actor_allowed(p_tenant, 'read') then
    raise exception 'Leseberechtigung fehlt.' using errcode = '42501';
  end if;
  words := pflege_catalog.prefix_query(p_query);
  if p_after is not null then
    select p.name,p.authorization_scope into after_name,after_scope from pflege_catalog.authorized_medicines p
    where p.tenant_id = p_tenant and p.id = p_after and p.search_document @@ words;
    if not found then raise exception 'Suchposition ist nicht mehr gültig.' using errcode = '22023'; end if;
  end if;

  with page as (
    select p.id, p.source, p.source_version, p.name, p.active_substance, p.authorization_holder, p.authorization_scope
    from pflege_catalog.authorized_medicines p
    where p.tenant_id = p_tenant and p.search_document @@ words
      and (p_after is null or (p.name, p.authorization_scope, p.id) > (after_name, after_scope, p_after))
    order by p.name, p.authorization_scope, p.id limit 31
  ), numbered as (
    select p.*, row_number() over (order by p.name, p.authorization_scope, p.id) as position from page p
  )
  select jsonb_build_object('rows', coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'source', p.source, 'sourceVersion', p.source_version,
    'name', p.name, 'activeSubstance', p.active_substance,
    'authorizationHolder', p.authorization_holder, 'authorizationScope', p.authorization_scope
  ) order by p.position) filter (where p.position <= 30), '[]'::jsonb),
    'nextCursor', case when count(*) > 30 then (array_agg(p.id order by p.position))[30] end)
  into result from numbered p;
  return result;
end $$;

revoke all on function public.search_pflege_medication_packages_page(uuid,text,text),
  public.search_pflege_authorized_medicines_page(uuid,text,uuid) from public, anon, authenticated, service_role;
grant execute on function public.search_pflege_medication_packages_page(uuid,text,text),
  public.search_pflege_authorized_medicines_page(uuid,text,uuid) to authenticated;
notify pgrst, 'reload schema';
