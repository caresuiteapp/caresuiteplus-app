-- Searchable tenant-owned master data, separate from patient prescriptions.
-- No feed records are seeded; ingest only data licensed for the relevant tenant.
create schema pflege_catalog;
revoke all on schema pflege_catalog from public, anon;
grant usage on schema pflege_catalog to authenticated;

create function pflege_catalog.valid_pzn(pzn text)
returns boolean language sql immutable strict set search_path = '' as $$
  select case when pzn ~ '^[0-9]{8}$' and pzn <> '00000000' then
    (select sum(substr(pzn,n,1)::int * n) from generate_series(1,7) n) % 11 = right(pzn,1)::int
    else false end
$$;

create function pflege_catalog.valid_text(value text, max_length integer)
returns boolean language sql immutable set search_path = '' as $$
  select value is null or (value = btrim(value) and value <> '' and char_length(value) <= max_length and value !~ '[[:cntrl:]]')
$$;

-- Existing confirmed workspace identity plus granular role permissions.
-- Never infer a role from user_metadata or let a portal actor reuse a profile.
-- Internal boolean predicate reads the entire own role/deny configuration, even
-- where personnel tables are not readable by a clinical account.
create function pflege_catalog.actor_allowed(p_tenant uuid, action text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    auth.uid() is not null
    and p_tenant = public.current_tenant_id()
    and coalesce(public.current_portal_type(), 'business') = 'business'
    and exists (
      select 1 from public.profiles p join public.roles r on r.id=p.role_id
      where p.id = public.resolve_current_profile_id() and p.tenant_id = p_tenant
        and p.is_active is true and p.status::text = 'active'
        and coalesce(p.auth_user_id, p.id) = auth.uid()
        and (to_jsonb(r)->>'tenant_id' is null or to_jsonb(r)->>'tenant_id'=p_tenant::text)
        and not exists (
          select 1 from unnest(array['pflege.access','pflege.medications.view'] || case action
            when 'read' then array[]::text[]
            when 'manual' then array['pflege.medications.manage']
            else array['pflege.medications.manage','business.tenant.manage'] end) needed(key)
          where (
            not exists (select 1 from public.role_permissions g where g.role_id=r.id and g.permission_key=needed.key
              and (to_jsonb(g)->>'tenant_id' is null or to_jsonb(g)->>'tenant_id'=p_tenant::text)
              and coalesce(nullif(to_jsonb(g)->'restrictions','null'::jsonb),'{}'::jsonb)='{}'::jsonb)
            and not (needed.key='business.tenant.manage' and (r.key in ('owner','admin','business_admin')
              or coalesce(to_jsonb(r)->>'is_admin_role','false')='true'))
          ) or exists (
            select 1 from public.role_permission_sets s
            where s.tenant_id=p_tenant and s.role_key in (r.key,case
              when r.key in ('owner','admin','system','support','developer_admin') then 'business_admin'
              when r.key in ('management','office','quality_management') then 'business_manager'
              when r.key='planning' then 'dispatch' when r.key='consultant' then 'counselor' else r.key end)
              and not exists (select 1 from public.role_permission_sets allowed
                where allowed.tenant_id=s.tenant_id and allowed.role_key=s.role_key and allowed.permission_key=needed.key)
          ) or exists (
            select 1 from public.employee_permission_overrides o join public.employees e
              on e.id=o.employee_id and e.tenant_id=o.tenant_id
            where e.profile_id=p.id and o.tenant_id=p_tenant and o.permission_key=needed.key and o.allowed is false
              and (o.valid_from is null or o.valid_from<=now()) and (o.valid_until is null or o.valid_until>=now())
          )
        )
    )
    and public.has_permission('pflege.access') is true
    and public.has_permission('pflege.medications.view') is true
    and case action
      when 'read' then true
      when 'manual' then public.has_permission('pflege.medications.manage') is true
      when 'import' then public.has_permission('pflege.medications.manage') is true
        and public.has_permission('business.tenant.manage') is true
      else false end,
  false)
$$;

create table pflege_catalog.medication_packages (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  source text not null check (source ~ '^[a-z0-9][a-z0-9._-]{0,63}$' and source <> 'manual'),
  source_version text not null check (pflege_catalog.valid_text(source_version, 120)),
  pzn text not null check (pflege_catalog.valid_text(pzn, 8)),
  name text not null check (pflege_catalog.valid_text(name, 400)),
  ingredient text check (pflege_catalog.valid_text(ingredient, 2000)),
  strength text check (pflege_catalog.valid_text(strength, 500)),
  dosage_form text check (pflege_catalog.valid_text(dosage_form, 200)),
  brand text check (pflege_catalog.valid_text(brand, 160)),
  manufacturer text check (pflege_catalog.valid_text(manufacturer, 240)),
  package_size text check (pflege_catalog.valid_text(package_size, 120)),
  search_document tsvector generated always as (to_tsvector('simple'::regconfig, coalesce(pzn,'') || ' ' || coalesce(name,'') || ' ' || coalesce(ingredient,'') || ' ' || coalesce(strength,'') || ' ' || coalesce(dosage_form,'') || ' ' || coalesce(brand,'') || ' ' || coalesce(manufacturer,'') || ' ' || coalesce(package_size,''))) stored,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, source, pzn),
  check (pflege_catalog.valid_pzn(pzn))
);
create index pflege_catalog_package_search on pflege_catalog.medication_packages using gin(search_document);
create index pflege_catalog_package_pzn on pflege_catalog.medication_packages(tenant_id, pzn text_pattern_ops);

create table pflege_catalog.physicians (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  source text not null check (source ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  source_version text not null check (pflege_catalog.valid_text(source_version, 120)),
  external_id text not null check (pflege_catalog.valid_text(external_id, 160)),
  display_name text not null check (pflege_catalog.valid_text(display_name, 180)),
  practice_name text check (pflege_catalog.valid_text(practice_name, 240)),
  specialty text check (pflege_catalog.valid_text(specialty, 160)),
  postal_code text check (pflege_catalog.valid_text(postal_code, 5)),
  city text check (pflege_catalog.valid_text(city, 120)),
  street text check (pflege_catalog.valid_text(street, 200)),
  phone text check (pflege_catalog.valid_text(phone, 60)),
  lanr text check (pflege_catalog.valid_text(lanr, 9)),
  bsnr text check (pflege_catalog.valid_text(bsnr, 9)),
  search_document tsvector generated always as (to_tsvector('simple'::regconfig, coalesce(display_name,'') || ' ' || coalesce(practice_name,'') || ' ' || coalesce(specialty,'') || ' ' || coalesce(postal_code,'') || ' ' || coalesce(city,'') || ' ' || coalesce(street,'') || ' ' || coalesce(lanr,'') || ' ' || coalesce(bsnr,''))) stored,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id),
  unique (tenant_id, source, external_id),
  check (postal_code is null or postal_code ~ '^[0-9]{5}$'),
  check (lanr is null or lanr ~ '^[0-9]{9}$'),
  check (bsnr is null or bsnr ~ '^[0-9]{9}$'),
  check (source <> 'manual' or source_version = 'local')
);
create index pflege_catalog_physician_search on pflege_catalog.physicians using gin(search_document);

create table pflege_catalog.change_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  actor_id uuid not null,
  operation text not null check (operation in ('medication_packages', 'physicians', 'manual_physician')),
  source text not null check (source ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  source_version text not null check (pflege_catalog.valid_text(source_version, 120)),
  row_count integer not null check (row_count between 1 and 500),
  created_at timestamptz not null default now()
);
create index pflege_catalog_change_log_tenant on pflege_catalog.change_log(tenant_id, created_at);

alter table pflege_catalog.medication_packages enable row level security;
alter table pflege_catalog.physicians enable row level security;
alter table pflege_catalog.change_log enable row level security;
revoke all on all tables in schema pflege_catalog from public, anon, authenticated;
-- Private schema is not exposed by PostgREST. RPCs use invoker rights plus RLS.
grant select, insert on pflege_catalog.medication_packages, pflege_catalog.physicians to authenticated;
grant update(source_version,name,ingredient,strength,dosage_form,brand,manufacturer,package_size,updated_at)
  on pflege_catalog.medication_packages to authenticated;
grant update(source_version,display_name,practice_name,specialty,postal_code,city,street,phone,lanr,bsnr,updated_at)
  on pflege_catalog.physicians to authenticated;
grant insert on pflege_catalog.change_log to authenticated;

create policy medication_catalog_read on pflege_catalog.medication_packages for select to authenticated
  using (tenant_id = (select public.current_tenant_id()) and (select pflege_catalog.actor_allowed(public.current_tenant_id(), 'read')));
create policy medication_catalog_insert on pflege_catalog.medication_packages for insert to authenticated
  with check (tenant_id = (select public.current_tenant_id()) and (select pflege_catalog.actor_allowed(public.current_tenant_id(), 'import')));
create policy medication_catalog_update on pflege_catalog.medication_packages for update to authenticated
  using (tenant_id = (select public.current_tenant_id()) and (select pflege_catalog.actor_allowed(public.current_tenant_id(), 'import')))
  with check (tenant_id = (select public.current_tenant_id()) and (select pflege_catalog.actor_allowed(public.current_tenant_id(), 'import')));
create policy physician_catalog_read on pflege_catalog.physicians for select to authenticated
  using (tenant_id = (select public.current_tenant_id()) and (select pflege_catalog.actor_allowed(public.current_tenant_id(), 'read')));
create policy physician_catalog_insert on pflege_catalog.physicians for insert to authenticated
  with check (tenant_id = (select public.current_tenant_id()) and (
    (source = 'manual' and (select pflege_catalog.actor_allowed(public.current_tenant_id(), 'manual'))) or
    (source <> 'manual' and (select pflege_catalog.actor_allowed(public.current_tenant_id(), 'import')))));
create policy physician_catalog_update on pflege_catalog.physicians for update to authenticated
  using (tenant_id = (select public.current_tenant_id()) and source <> 'manual' and (select pflege_catalog.actor_allowed(public.current_tenant_id(), 'import')))
  with check (tenant_id = (select public.current_tenant_id()) and source <> 'manual' and (select pflege_catalog.actor_allowed(public.current_tenant_id(), 'import')));
create policy catalog_audit_insert on pflege_catalog.change_log for insert to authenticated
  with check (tenant_id = (select public.current_tenant_id()) and actor_id = (select public.resolve_current_profile_id()) and (
    (operation = 'manual_physician' and source = 'manual' and row_count = 1 and (select pflege_catalog.actor_allowed(public.current_tenant_id(), 'manual'))) or
    (operation <> 'manual_physician' and source <> 'manual' and (select pflege_catalog.actor_allowed(public.current_tenant_id(), 'import')))));

-- Optional historical catalogue references; never rewrite previously stored orders.
alter table public.medications
  add column product_pzn text,
  add column product_brand text check (pflege_catalog.valid_text(product_brand,160)),
  add column product_manufacturer text check (pflege_catalog.valid_text(product_manufacturer,240)),
  add column product_catalog_source text,
  add column product_catalog_version text check (pflege_catalog.valid_text(product_catalog_version,120)),
  add column prescriber_directory_id uuid,
  add constraint medications_catalog_provenance check (
    (product_pzn is null and product_catalog_source is null and product_catalog_version is null and product_brand is null and product_manufacturer is null)
    or (product_pzn is not null and pflege_catalog.valid_pzn(product_pzn) and product_catalog_source is not null and product_catalog_version is not null)),
  add constraint medications_catalog_package_fk
    foreign key (tenant_id, product_catalog_source, product_pzn)
    references pflege_catalog.medication_packages(tenant_id, source, pzn),
  add constraint medications_catalog_prescriber_fk
    foreign key (tenant_id, prescriber_directory_id) references pflege_catalog.physicians(tenant_id, id);
create index medications_catalog_package_lookup on public.medications(tenant_id, product_catalog_source, product_pzn) where product_pzn is not null;
create index medications_catalog_prescriber_lookup on public.medications(tenant_id, prescriber_directory_id) where prescriber_directory_id is not null;

-- An order revision must not retain a catalogue identity after changing its
-- selected product or prescriber text. Unrelated dose/schedule edits retain it.
create function pflege_catalog.confirm_order_references()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare check_product boolean := true; check_physician boolean := true;
begin
  if tg_op = 'UPDATE' then
    if (new.name,new.active_ingredient,new.strength,new.form) is distinct from (old.name,old.active_ingredient,old.strength,old.form) then
      new.product_pzn := null; new.product_brand := null; new.product_manufacturer := null;
      new.product_catalog_source := null; new.product_catalog_version := null;
    end if;
    if new.prescribed_by is distinct from old.prescribed_by then new.prescriber_directory_id := null; end if;
    check_product := (new.tenant_id,new.product_pzn,new.product_brand,new.product_manufacturer,new.product_catalog_source,new.product_catalog_version)
      is distinct from (old.tenant_id,old.product_pzn,old.product_brand,old.product_manufacturer,old.product_catalog_source,old.product_catalog_version);
    check_physician := (new.tenant_id,new.prescriber_directory_id) is distinct from (old.tenant_id,old.prescriber_directory_id);
  end if;
  if check_product and new.product_pzn is not null and not exists (
    select 1 from pflege_catalog.medication_packages p where p.tenant_id=new.tenant_id and p.pzn=new.product_pzn
      and p.source=new.product_catalog_source and p.source_version=new.product_catalog_version
      and (p.name,p.ingredient,p.strength,p.dosage_form,p.brand,p.manufacturer) is not distinct from
        (new.name,new.active_ingredient,new.strength,new.form,new.product_brand,new.product_manufacturer)
  ) then raise exception 'Bitte das Präparat erneut aus dem aktuellen Katalog auswählen.' using errcode = '23514'; end if;
  if check_physician and new.prescriber_directory_id is not null and not exists (
    select 1 from pflege_catalog.physicians p where p.tenant_id=new.tenant_id and p.id=new.prescriber_directory_id
      and p.display_name=new.prescribed_by
  ) then raise exception 'Bitte die verordnende Person erneut aus dem Verzeichnis auswählen.' using errcode = '23514'; end if;
  return new;
end $$;
create trigger confirm_medication_catalog_references before insert or update of tenant_id,name,active_ingredient,strength,form,prescribed_by,
  product_pzn,product_brand,product_manufacturer,product_catalog_source,product_catalog_version,prescriber_directory_id
  on public.medications for each row execute function pflege_catalog.confirm_order_references();

-- No dynamic SQL. Split on punctuation; allow an indexed AND-prefix query.
create function pflege_catalog.prefix_query(value text)
returns tsquery language plpgsql stable set search_path = '' as $$
declare tokens text; token_count integer;
begin
  if value is null or char_length(btrim(value)) not between 2 and 120 or value ~ '[[:cntrl:]]' then
    raise exception 'Ungültige Suche.' using errcode = '22023';
  end if;
  select count(*), string_agg(quote_literal(term) || ':*', ' & ') into token_count, tokens
  from (select distinct term from regexp_split_to_table(lower(value), '[^[:alnum:]]+') term where term <> '') words;
  if token_count = 0 then return null; end if;
  if token_count > 12 then raise exception 'Zu viele Suchbegriffe.' using errcode = '22023'; end if;
  return to_tsquery('simple'::regconfig, tokens);
end $$;

create function pflege_catalog.package_option(p pflege_catalog.medication_packages)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object('source', p.source,
    'sourceVersion', p.source_version,
    'pzn', p.pzn,
    'name', p.name,
    'ingredient', p.ingredient,
    'strength', p.strength,
    'dosageForm', p.dosage_form,
    'brand', p.brand,
    'manufacturer', p.manufacturer,
    'packageSize', p.package_size)
$$;
create function pflege_catalog.physician_option(p pflege_catalog.physicians)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object('source', p.source,
    'sourceVersion', p.source_version,
    'id', p.id,
    'displayName', p.display_name,
    'practiceName', p.practice_name,
    'specialty', p.specialty,
    'postalCode', p.postal_code,
    'city', p.city,
    'street', p.street,
    'phone', p.phone,
    'lanr', p.lanr,
    'bsnr', p.bsnr)
$$;

create function public.search_pflege_medication_packages(p_tenant uuid, p_query text)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare words tsquery; digits text; result jsonb;
begin
  if not pflege_catalog.actor_allowed(p_tenant, 'read') then
    raise exception 'Leseberechtigung fehlt.' using errcode = '42501';
  end if;
  words := pflege_catalog.prefix_query(p_query);
  digits := regexp_replace(btrim(p_query), '^PZN[[:space:]-]*', '', 'i');
  if digits ~ '^[0-9]{2,8}$' then
    select coalesce(jsonb_agg(pflege_catalog.package_option(p) order by p.pzn, p.source), '[]'::jsonb)
    into result from (select * from pflege_catalog.medication_packages
      where tenant_id=p_tenant and pzn like digits || '%' order by pzn, source limit 30) p;
  else
    select coalesce(jsonb_agg(pflege_catalog.package_option(p) order by p.name, p.pzn, p.source), '[]'::jsonb)
    into result from (select * from pflege_catalog.medication_packages
      where tenant_id=p_tenant and search_document @@ words order by name, pzn, source limit 30) p;
  end if;
  return result;
end $$;

create function public.search_pflege_physicians(p_tenant uuid, p_query text)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare words tsquery; result jsonb;
begin
  if not pflege_catalog.actor_allowed(p_tenant, 'read') then
    raise exception 'Leseberechtigung fehlt.' using errcode = '42501';
  end if;
  words := pflege_catalog.prefix_query(p_query);
  select coalesce(jsonb_agg(pflege_catalog.physician_option(p) order by p.display_name, p.id), '[]'::jsonb)
  into result from (select * from pflege_catalog.physicians
    where tenant_id=p_tenant and search_document @@ words order by display_name, id limit 30) p;
  return result;
end $$;

create function pflege_catalog.require_rows(rows jsonb, keys text[], max_rows integer)
returns void language plpgsql immutable set search_path = '' as $$
begin
  if jsonb_typeof(rows) is distinct from 'array' then
    raise exception 'Datensatzliste erwartet.' using errcode = '22023';
  end if;
  if jsonb_array_length(rows) not between 1 and max_rows or pg_column_size(rows) > 4000000 then
    raise exception 'Datensatzliste überschreitet die Verarbeitungsgrenze.' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(rows) e where jsonb_typeof(e) <> 'object') then
    raise exception 'Ungültige Datensatzform.' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(rows) e cross join lateral jsonb_each(e) f
    where not (f.key = any(keys)) or jsonb_typeof(f.value) not in ('string','null')) then
    raise exception 'Ungültiges Stammdatenfeld.' using errcode = '22023';
  end if;
end $$;
create function pflege_catalog.require_feed(p_source text, p_version text)
returns void language plpgsql immutable set search_path = '' as $$
begin
  if p_source is null or p_source !~ '^[a-z0-9][a-z0-9._-]{0,63}$' or p_source = 'manual'
    or p_version is null or not pflege_catalog.valid_text(btrim(p_version), 120) then
    raise exception 'Quelle und Version erforderlich.' using errcode = '22023';
  end if;
end $$;

create function public.import_pflege_medication_packages(p_tenant uuid, p_source text, p_version text, p_rows jsonb)
returns integer language plpgsql security invoker set search_path = '' as $$
declare written integer;
begin
  if not pflege_catalog.actor_allowed(p_tenant, 'import') then
    raise exception 'Importberechtigung fehlt.' using errcode = '42501';
  end if;
  perform pflege_catalog.require_feed(p_source, p_version);
  perform pflege_catalog.require_rows(p_rows, array['pzn','name','ingredient','strength','dosageForm','brand','manufacturer','packageSize'], 500);
  if exists (select 1 from jsonb_array_elements(p_rows) as e(row)
    group by btrim(e.row->>'pzn') having count(*) > 1) then
    raise exception 'Doppelte Datensatzkennung.' using errcode = '22023';
  end if;
  insert into pflege_catalog.medication_packages as saved
    (tenant_id, source, source_version, pzn, name, ingredient, strength, dosage_form, brand, manufacturer, package_size)
  select p_tenant, p_source, btrim(p_version), nullif(btrim(e.row->>'pzn'), ''), nullif(btrim(e.row->>'name'), ''), nullif(btrim(e.row->>'ingredient'), ''), nullif(btrim(e.row->>'strength'), ''), nullif(btrim(e.row->>'dosageForm'), ''), nullif(btrim(e.row->>'brand'), ''), nullif(btrim(e.row->>'manufacturer'), ''), nullif(btrim(e.row->>'packageSize'), '')
  from jsonb_array_elements(p_rows) as e(row)
  on conflict (tenant_id, source, pzn) do update set source_version=excluded.source_version,
    name=excluded.name, ingredient=excluded.ingredient, strength=excluded.strength, dosage_form=excluded.dosage_form, brand=excluded.brand, manufacturer=excluded.manufacturer, package_size=excluded.package_size,
    updated_at=case when saved.source_version=excluded.source_version then saved.updated_at else now() end
  where saved.source_version <> excluded.source_version or
    (saved.name, saved.ingredient, saved.strength, saved.dosage_form, saved.brand, saved.manufacturer, saved.package_size) is not distinct from (excluded.name, excluded.ingredient, excluded.strength, excluded.dosage_form, excluded.brand, excluded.manufacturer, excluded.package_size);
  get diagnostics written = row_count;
  if written <> jsonb_array_length(p_rows) then
    raise exception 'Abweichender Inhalt bei gleichem Versionsstand.' using errcode = '23505';
  end if;
  insert into pflege_catalog.change_log(tenant_id, actor_id, operation, source, source_version, row_count)
  values (p_tenant, public.resolve_current_profile_id(), 'medication_packages', p_source, btrim(p_version), written);
  return written;
exception when check_violation or not_null_violation or invalid_text_representation then
  raise exception 'Ungültige Stammdaten.' using errcode = '22023';
end $$;

create function public.import_pflege_physicians(p_tenant uuid, p_source text, p_version text, p_rows jsonb)
returns integer language plpgsql security invoker set search_path = '' as $$
declare written integer;
begin
  if not pflege_catalog.actor_allowed(p_tenant, 'import') then
    raise exception 'Importberechtigung fehlt.' using errcode = '42501';
  end if;
  perform pflege_catalog.require_feed(p_source, p_version);
  perform pflege_catalog.require_rows(p_rows, array['externalId','displayName','practiceName','specialty','postalCode','city','street','phone','lanr','bsnr'], 500);
  if exists (select 1 from jsonb_array_elements(p_rows) as e(row)
    group by btrim(e.row->>'externalId') having count(*) > 1) then
    raise exception 'Doppelte Datensatzkennung.' using errcode = '22023';
  end if;
  insert into pflege_catalog.physicians as saved
    (tenant_id, source, source_version, external_id, display_name, practice_name, specialty, postal_code, city, street, phone, lanr, bsnr)
  select p_tenant, p_source, btrim(p_version), nullif(btrim(e.row->>'externalId'), ''), nullif(btrim(e.row->>'displayName'), ''), nullif(btrim(e.row->>'practiceName'), ''), nullif(btrim(e.row->>'specialty'), ''), nullif(btrim(e.row->>'postalCode'), ''), nullif(btrim(e.row->>'city'), ''), nullif(btrim(e.row->>'street'), ''), nullif(btrim(e.row->>'phone'), ''), nullif(btrim(e.row->>'lanr'), ''), nullif(btrim(e.row->>'bsnr'), '')
  from jsonb_array_elements(p_rows) as e(row)
  on conflict (tenant_id, source, external_id) do update set source_version=excluded.source_version,
    display_name=excluded.display_name, practice_name=excluded.practice_name, specialty=excluded.specialty, postal_code=excluded.postal_code, city=excluded.city, street=excluded.street, phone=excluded.phone, lanr=excluded.lanr, bsnr=excluded.bsnr,
    updated_at=case when saved.source_version=excluded.source_version then saved.updated_at else now() end
  where saved.source_version <> excluded.source_version or
    (saved.display_name, saved.practice_name, saved.specialty, saved.postal_code, saved.city, saved.street, saved.phone, saved.lanr, saved.bsnr) is not distinct from (excluded.display_name, excluded.practice_name, excluded.specialty, excluded.postal_code, excluded.city, excluded.street, excluded.phone, excluded.lanr, excluded.bsnr);
  get diagnostics written = row_count;
  if written <> jsonb_array_length(p_rows) then
    raise exception 'Abweichender Inhalt bei gleichem Versionsstand.' using errcode = '23505';
  end if;
  insert into pflege_catalog.change_log(tenant_id, actor_id, operation, source, source_version, row_count)
  values (p_tenant, public.resolve_current_profile_id(), 'physicians', p_source, btrim(p_version), written);
  return written;
exception when check_violation or not_null_violation or invalid_text_representation then
  raise exception 'Ungültige Stammdaten.' using errcode = '22023';
end $$;

create function public.save_pflege_manual_physician(p_tenant uuid, p_row jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare saved pflege_catalog.physicians%rowtype; manual_key text;
begin
  if not pflege_catalog.actor_allowed(p_tenant, 'manual') then
    raise exception 'Speicherberechtigung fehlt.' using errcode = '42501';
  end if;
  perform pflege_catalog.require_rows(jsonb_build_array(p_row), array['displayName','practiceName','specialty','postalCode','city','street','phone','lanr','bsnr'], 1);
  -- Exact normalized contact identity; never merge different locations on a name alone.
  manual_key := encode(sha256(convert_to(lower(jsonb_build_array(nullif(btrim(p_row->>'displayName'), ''), nullif(btrim(p_row->>'practiceName'), ''), nullif(btrim(p_row->>'specialty'), ''), nullif(btrim(p_row->>'postalCode'), ''), nullif(btrim(p_row->>'city'), ''), nullif(btrim(p_row->>'street'), ''), nullif(btrim(p_row->>'phone'), ''), nullif(btrim(p_row->>'lanr'), ''), nullif(btrim(p_row->>'bsnr'), ''))::text), 'UTF8')), 'hex');
  insert into pflege_catalog.physicians(tenant_id, source, source_version, external_id, display_name, practice_name, specialty, postal_code, city, street, phone, lanr, bsnr)
  values (p_tenant, 'manual', 'local', manual_key, nullif(btrim(p_row->>'displayName'), ''), nullif(btrim(p_row->>'practiceName'), ''), nullif(btrim(p_row->>'specialty'), ''), nullif(btrim(p_row->>'postalCode'), ''), nullif(btrim(p_row->>'city'), ''), nullif(btrim(p_row->>'street'), ''), nullif(btrim(p_row->>'phone'), ''), nullif(btrim(p_row->>'lanr'), ''), nullif(btrim(p_row->>'bsnr'), ''))
  on conflict (tenant_id, source, external_id) do nothing returning * into saved;
  if found then
    insert into pflege_catalog.change_log(tenant_id, actor_id, operation, source, source_version, row_count)
    values (p_tenant, public.resolve_current_profile_id(), 'manual_physician', 'manual', 'local', 1);
  else
    select * into strict saved from pflege_catalog.physicians where tenant_id=p_tenant and source='manual' and external_id=manual_key;
  end if;
  return pflege_catalog.physician_option(saved);
exception when check_violation or not_null_violation or invalid_text_representation then
  raise exception 'Ungültige Praxisdaten.' using errcode = '22023';
end $$;

revoke all on all functions in schema pflege_catalog from public, anon, authenticated;
grant execute on function pflege_catalog.valid_pzn(text),
  pflege_catalog.valid_text(text, integer),
  pflege_catalog.actor_allowed(uuid, text),
  pflege_catalog.prefix_query(text),
  pflege_catalog.require_rows(jsonb, text[], integer),
  pflege_catalog.require_feed(text, text),
  pflege_catalog.package_option(pflege_catalog.medication_packages),
  pflege_catalog.physician_option(pflege_catalog.physicians) to authenticated;
revoke all on function public.search_pflege_medication_packages(uuid,text), public.search_pflege_physicians(uuid,text),
  public.import_pflege_medication_packages(uuid,text,text,jsonb), public.import_pflege_physicians(uuid,text,text,jsonb),
  public.save_pflege_manual_physician(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.search_pflege_medication_packages(uuid,text), public.search_pflege_physicians(uuid,text),
  public.import_pflege_medication_packages(uuid,text,text,jsonb), public.import_pflege_physicians(uuid,text,text,jsonb),
  public.save_pflege_manual_physician(uuid,jsonb) to authenticated;
