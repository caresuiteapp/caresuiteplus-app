-- Licensed BfArM delivery. Full files and derived records are never listable by app actors.
create schema bfarm_reference;
revoke all on schema bfarm_reference from public, anon, authenticated;
grant usage on schema bfarm_reference to authenticated;

create table bfarm_reference.deliveries (
  source_date date primary key,
  archive_sha256 text not null check (archive_sha256 ~ '^[0-9a-f]{64}$'),
  archive_bytes integer not null check (archive_bytes between 1 and 67108864),
  medicinal_count integer not null check (medicinal_count between 1 and 250000),
  component_count integer not null check (component_count between 1 and 1250000),
  substance_count integer not null check (substance_count between 1 and 1250000),
  file_manifest jsonb not null check (jsonb_typeof(file_manifest) = 'array' and jsonb_array_length(file_manifest) = 3),
  imported_at timestamptz not null default now(),
  verified_at timestamptz
);
create table bfarm_reference.archive_chunks (
  source_date date not null references bfarm_reference.deliveries(source_date),
  chunk_no integer not null check (chunk_no >= 0),
  bytes bytea not null check (octet_length(bytes) between 1 and 524288),
  primary key (source_date, chunk_no)
);
create table bfarm_reference.packages (
  source_date date not null references bfarm_reference.deliveries(source_date),
  pzn text not null check (pflege_catalog.valid_pzn(pzn)),
  product jsonb not null check ((jsonb_typeof(product) = 'object' and product->>'pzn' = pzn
    and product->>'source' = 'bfarm-31b' and product->>'sourceVersion' = source_date::text
    and length(product->>'name') between 1 and 400) is true),
  components jsonb not null check (jsonb_typeof(components) = 'array' and jsonb_array_length(components) between 1 and 100),
  primary key (source_date, pzn)
);
create table bfarm_reference.current_delivery (
  singleton boolean primary key default true check (singleton),
  source_date date not null references bfarm_reference.deliveries(source_date)
);
alter table bfarm_reference.deliveries enable row level security;
alter table bfarm_reference.archive_chunks enable row level security;
alter table bfarm_reference.packages enable row level security;
alter table bfarm_reference.current_delivery enable row level security;
revoke all on all tables in schema bfarm_reference from public, anon, authenticated, service_role;

-- Once verified, a delivery is immutable. A later full delivery receives its own date.
create function bfarm_reference.protect_delivery() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare d date;
begin
  d := case when tg_op = 'DELETE' then old.source_date else new.source_date end;
  if exists (select 1 from bfarm_reference.deliveries where source_date=d and verified_at is not null) then
    raise exception 'Eine geprüfte BfArM-Lieferung ist unveränderlich.' using errcode='23514';
  end if;
  if tg_op = 'UPDATE' and old.source_date <> new.source_date then
    raise exception 'Das Lieferdatum ist unveränderlich.' using errcode='23514';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
create trigger bfarm_archive_immutable before insert or update or delete on bfarm_reference.archive_chunks
  for each row execute function bfarm_reference.protect_delivery();
create trigger bfarm_packages_immutable before insert or update or delete on bfarm_reference.packages
  for each row execute function bfarm_reference.protect_delivery();
create trigger bfarm_delivery_immutable before update or delete on bfarm_reference.deliveries
  for each row when (old.verified_at is not null) execute function bfarm_reference.protect_delivery();

-- Administration only. Verifies the unmodified ZIP before switching the complete snapshot.
create function bfarm_reference.activate_delivery(p_date date) returns void
language plpgsql security invoker set search_path = '' as $$
declare delivery bfarm_reference.deliveries; archive bytea; n bigint; components_n bigint; substances_n bigint; previous_date date;
begin
  perform pg_advisory_xact_lock(472693102);
  select * into delivery from bfarm_reference.deliveries where source_date=p_date for update;
  if not found then raise exception 'Lieferung fehlt.' using errcode='23514'; end if;
  if p_date > (now() at time zone 'Europe/Berlin')::date then
    raise exception 'Das Lieferdatum liegt in der Zukunft.' using errcode='23514';
  end if;
  select source_date into previous_date from bfarm_reference.current_delivery where singleton;
  if previous_date > p_date then raise exception 'Ein älterer Stand wird nicht aktiviert.' using errcode='23514'; end if;
  select string_agg(bytes, ''::bytea order by chunk_no) into archive
    from bfarm_reference.archive_chunks where source_date=p_date;
  if archive is null or octet_length(archive) <> delivery.archive_bytes
    or encode(sha256(archive), 'hex') <> delivery.archive_sha256 then
    raise exception 'Der Originalexport ist unvollständig oder verändert.' using errcode='23514';
  end if;
  select count(*), coalesce(sum(jsonb_array_length(p.components)),0),
    coalesce(sum((select coalesce(sum(jsonb_array_length(c->'substances')),0) from jsonb_array_elements(p.components) c)),0)
    into n, components_n, substances_n from bfarm_reference.packages p where source_date=p_date;
  if (n,components_n,substances_n) is distinct from
    (delivery.medicinal_count::bigint,delivery.component_count::bigint,delivery.substance_count::bigint) then
    raise exception 'Die BfArM-Lieferung ist noch nicht vollständig importiert.' using errcode='23514';
  end if;
  if delivery.verified_at is null then
    update bfarm_reference.deliveries set verified_at=now() where source_date=p_date;
  end if;
  insert into bfarm_reference.current_delivery(singleton,source_date) values (true,p_date)
    on conflict (singleton) do update set source_date=excluded.source_date;
end $$;

create function bfarm_reference.lookup_one(p_tenant uuid, p_pzn text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare record bfarm_reference.packages; result jsonb; next_date date;
begin
  if auth.uid() is null or not pflege_catalog.actor_allowed(p_tenant,'read') then
    raise exception 'Leseberechtigung fehlt.' using errcode='42501';
  end if;
  if p_pzn is null or length(p_pzn) <> 8 or not pflege_catalog.valid_pzn(p_pzn) then
    raise exception 'Eine vollständige gültige PZN ist erforderlich.' using errcode='22023';
  end if;
  if not exists (select 1 from bfarm_reference.current_delivery c join bfarm_reference.deliveries d
      on d.source_date=c.source_date where c.singleton and d.verified_at is not null) then
    raise exception 'Keine geprüfte BfArM-Lieferung vorhanden.' using errcode='55000';
  end if;
  select p.* into record from bfarm_reference.packages p join bfarm_reference.current_delivery c
    on c.source_date=p.source_date and c.singleton where p.pzn=p_pzn;
  if not found then return null; end if;
  next_date := case when extract(day from record.source_date) < 15 then date_trunc('month',record.source_date)::date + 14
    else (date_trunc('month',record.source_date) + interval '1 month')::date end;
  result := jsonb_build_object('product',record.product,'components',record.components,'nextExpectedOn',next_date::text,
    'checkedAt',now(),'stale',(now() at time zone 'Europe/Berlin')::date >= next_date);
  return result;
end $$;

create function public.get_pflege_bfarm_reference(p_tenant uuid,p_pzn text) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select bfarm_reference.lookup_one(p_tenant,p_pzn)
$$;

revoke all on all functions in schema bfarm_reference from public,anon,authenticated,service_role;
grant execute on function bfarm_reference.lookup_one(uuid,text) to authenticated;
revoke all on function public.get_pflege_bfarm_reference(uuid,text) from public,anon,service_role;
grant execute on function public.get_pflege_bfarm_reference(uuid,text) to authenticated;
notify pgrst,'reload schema';
