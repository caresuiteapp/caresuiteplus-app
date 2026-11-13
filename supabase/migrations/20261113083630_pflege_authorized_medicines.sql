-- EMA Article 57 reference, for lookup only. A regulatory entry is not a
-- selectable package, a manufacturer, a market-availability assertion or a dose.
create table pflege_catalog.authorized_medicines (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  source text not null check (source = 'ema-article57'),
  source_version text not null check (pflege_catalog.valid_text(source_version, 120)),
  external_id text not null check (pflege_catalog.valid_text(external_id, 160)),
  name text not null check (pflege_catalog.valid_text(name, 400)),
  active_substance text check (pflege_catalog.valid_text(active_substance, 2000)),
  authorization_holder text check (pflege_catalog.valid_text(authorization_holder, 500)),
  authorization_scope text not null check (authorization_scope in ('DE', 'EU')),
  search_document tsvector generated always as (to_tsvector('simple'::regconfig,
    name || ' ' || coalesce(active_substance,'') || ' ' || coalesce(authorization_holder,''))) stored,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id),
  unique (tenant_id, source, external_id)
);
create index pflege_catalog_authorized_medicines_search on pflege_catalog.authorized_medicines using gin(search_document);

alter table pflege_catalog.authorized_medicines enable row level security;
revoke all on table pflege_catalog.authorized_medicines from public, anon, authenticated, service_role;
grant select on table pflege_catalog.authorized_medicines to authenticated;
create policy authorized_medicine_read on pflege_catalog.authorized_medicines for select to authenticated
  using (tenant_id = (select public.current_tenant_id()) and (select pflege_catalog.actor_allowed(public.current_tenant_id(), 'read')));

create function public.search_pflege_authorized_medicines(p_tenant uuid, p_query text)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare words tsquery; result jsonb;
begin
  if not pflege_catalog.actor_allowed(p_tenant, 'read') then
    raise exception 'Leseberechtigung fehlt.' using errcode = '42501';
  end if;
  words := pflege_catalog.prefix_query(p_query);
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'source', p.source, 'sourceVersion', p.source_version,
    'name', p.name, 'activeSubstance', p.active_substance,
    'authorizationHolder', p.authorization_holder, 'authorizationScope', p.authorization_scope
  ) order by p.name, p.authorization_scope, p.id), '[]'::jsonb)
  into result from (select * from pflege_catalog.authorized_medicines
    where tenant_id = p_tenant and search_document @@ words
    order by name, authorization_scope, id limit 30) p;
  return result;
end $$;

revoke all on function public.search_pflege_authorized_medicines(uuid,text) from public, anon, authenticated, service_role;
grant execute on function public.search_pflege_authorized_medicines(uuid,text) to authenticated;
notify pgrst, 'reload schema';
