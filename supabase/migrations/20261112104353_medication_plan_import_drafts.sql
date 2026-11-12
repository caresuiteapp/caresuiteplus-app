-- Import evidence and individual review only. No medication, administration,
-- portal document, or clinical authorization is created by these operations.
create schema if not exists medication_plan_import_private;
revoke all on schema medication_plan_import_private from public, anon, authenticated, service_role;
grant usage on schema medication_plan_import_private to authenticated;
create table medication_plan_import_private.medication_plan_imports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  client_id uuid not null references public.clients(id),
  actor_id uuid not null references public.profiles(id),
  request_id uuid not null,
  assignment text not null check (assignment in ('exact','manual')),
  reason text not null,
  file_name text not null,
  mime_type text not null,
  source_content bytea not null check (octet_length(source_content) between 1 and 3145728),
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  plan jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  unique (tenant_id, request_id),
  unique (tenant_id, source_sha256)
);
create index medication_plan_import_case_latest
  on medication_plan_import_private.medication_plan_imports (tenant_id, client_id, created_at desc, id desc);

create table medication_plan_import_private.medication_plan_import_confirmations (
  import_id uuid not null references medication_plan_import_private.medication_plan_imports(id),
  row_index integer not null check (row_index between 0 and 199),
  actor_id uuid not null references public.profiles(id),
  confirmed_at timestamptz not null default clock_timestamp(),
  primary key (import_id, row_index)
);
alter table medication_plan_import_private.medication_plan_imports enable row level security;
alter table medication_plan_import_private.medication_plan_import_confirmations enable row level security;
create policy medication_plan_imports_deny on medication_plan_import_private.medication_plan_imports
  for all to public using (false) with check (false);
create policy medication_plan_import_confirmations_deny on medication_plan_import_private.medication_plan_import_confirmations
  for all to public using (false) with check (false);
revoke all on medication_plan_import_private.medication_plan_imports, medication_plan_import_private.medication_plan_import_confirmations from public, anon, authenticated, service_role;

create function medication_plan_import_private.medication_plan_import_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Importoriginal und Prüfvermerk dürfen nicht überschrieben werden.' using errcode = '42501';
end;
$$;
create trigger medication_plan_import_immutable before update or delete on medication_plan_import_private.medication_plan_imports
  for each row execute function medication_plan_import_private.medication_plan_import_immutable();
create trigger medication_plan_confirmation_immutable before update or delete on medication_plan_import_private.medication_plan_import_confirmations
  for each row execute function medication_plan_import_private.medication_plan_import_immutable();

create function medication_plan_import_private.guard_medication_plan_import(p_tenant uuid, p_actor uuid, p_client uuid, p_write boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  claims jsonb := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  sid uuid;
  auth_user uuid := auth.uid();
  bound_role_id uuid;
  bound_role_key text;
  normalized_role text;
begin
  -- Use only the server-validated session claims, not fields supplied to the RPC.
  if coalesce(claims->>'session_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or coalesce(claims->>'exp', '') !~ '^[0-9]{1,12}$'
    or claims->>'role' is distinct from 'authenticated'
    or claims->>'is_anonymous' = 'true'
    or coalesce(claims#>>'{app_metadata,portal_type}', '') not in ('', 'business') then
    raise exception 'Aktueller Pflegebezug oder erforderliche Berechtigung fehlt.' using errcode = '42501';
  end if;
  sid := (claims->>'session_id')::uuid;
  if (claims->>'exp')::numeric <= extract(epoch from clock_timestamp())
    or not exists(select 1 from auth.sessions s where s.id = sid and s.user_id = auth_user
      and (s.not_after is null or s.not_after > clock_timestamp()))
    or auth_user is null or p_tenant is null or p_tenant is distinct from public.current_tenant_id()
    or p_actor is null or p_actor is distinct from public.resolve_current_profile_id()
    or coalesce(public.current_portal_type(), 'business') <> 'business'
    or public.platform_tenant_access_allowed(p_tenant, false) is not true then
    raise exception 'Aktueller Pflegebezug oder erforderliche Berechtigung fehlt.' using errcode = '42501';
  end if;
  select r.id, r.key into bound_role_id, bound_role_key from public.profiles p join public.roles r on r.id = p.role_id
  where p.id = p_actor and p.tenant_id = p_tenant and p.is_active and p.status::text = 'active'
    and coalesce(p.auth_user_id, p.id) = auth_user and (r.tenant_id is null or r.tenant_id = p_tenant)
  for share of p, r;
  if not found then
    raise exception 'Aktueller Pflegebezug oder erforderliche Berechtigung fehlt.' using errcode = '42501';
  end if;
  normalized_role := case
    when bound_role_key in ('owner','admin','system','support','developer_admin') then 'business_admin'
    when bound_role_key in ('management','office','quality_management') then 'business_manager'
    when bound_role_key = 'planning' then 'dispatch' when bound_role_key = 'consultant' then 'counselor' else bound_role_key end;
  -- The generic permission helper may use any profile of the login. Use the
  -- exact profile's grants and respect both tenant role sets and employee denies.
  if exists(
    select 1 from unnest(array['pflege.access','pflege.medications.view','office.clients.view','office.clients.view_sensitive'] ||
      case when p_write then array['pflege.medications.manage'] else array[]::text[] end) needed(key)
    where not exists(
      select 1 from public.role_permissions g where g.role_id = bound_role_id and g.permission_key = needed.key
        and (to_jsonb(g)->>'tenant_id' is null or to_jsonb(g)->>'tenant_id' = p_tenant::text)
        and coalesce(nullif(to_jsonb(g)->'restrictions', 'null'::jsonb), '{}'::jsonb) = '{}'::jsonb
    ) or exists(
      select 1 from public.role_permission_sets s where s.tenant_id = p_tenant and s.role_key in (bound_role_key, normalized_role)
      and not exists(select 1 from public.role_permission_sets granted where granted.tenant_id = s.tenant_id
        and granted.role_key = s.role_key and granted.permission_key = needed.key)
    ) or exists(
      select 1 from public.employee_permission_overrides o join public.employees e on e.id = o.employee_id and e.tenant_id = o.tenant_id
      where e.profile_id = p_actor and o.tenant_id = p_tenant and o.permission_key = needed.key and o.allowed is false
        and (o.valid_from is null or o.valid_from <= clock_timestamp()) and (o.valid_until is null or o.valid_until >= clock_timestamp())
    )
  ) then
    raise exception 'Aktueller Pflegebezug oder erforderliche Berechtigung fehlt.' using errcode = '42501';
  end if;
  if p_client is not null then
    perform 1 from public.clients c where c.id = p_client and c.tenant_id = p_tenant and c.deleted_at is null
      and c.status::text in ('active','aktiv') and coalesce(to_jsonb(c)->>'lifecycle_status', c.status::text) in ('active','aktiv') for share;
    if not found then
      raise exception 'Aktueller Pflegebezug oder erforderliche Berechtigung fehlt.' using errcode = '42501';
    end if;
    perform 1 from public.client_module_assignments a where a.tenant_id = p_tenant and a.client_id = p_client
      and a.module_key = 'pflege' and a.is_active and a.status in ('active','aktiv') for share;
    if not found then
      raise exception 'Aktueller Pflegebezug oder erforderliche Berechtigung fehlt.' using errcode = '42501';
    end if;
  end if;
end;
$$;

-- Check duplicates across all active cases in the tenant, including cases not
-- eligible for Pflege. Return only the single eligible identity, never a
-- different patient's identity or an otherwise inaccessible case.
create function medication_plan_import_private.exact_medication_plan_client(p_tenant uuid, p_identity jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  given_name text := btrim(p_identity->>'firstName');
  family_name text := btrim(p_identity->>'lastName');
  supplied_birth_date text := p_identity->>'birthDate';
  insurance_id text := nullif(upper(btrim(p_identity->>'insuranceId')), '');
  parsed_birth_date date;
  candidate uuid;
  candidate_insurance text;
  candidate_ids uuid[];
begin
  if jsonb_typeof(p_identity) is distinct from 'object'
     or coalesce(length(given_name), 0) not between 1 and 120
     or coalesce(length(family_name), 0) not between 1 and 120
     or coalesce(supplied_birth_date, '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
     or (insurance_id is not null and insurance_id !~ '^[A-Z][0-9]{9}$') then
    return null;
  end if;
  begin
    parsed_birth_date := supplied_birth_date::date;
  exception when datetime_field_overflow or invalid_datetime_format then return null;
  end;
  select array_agg(c.id) into candidate_ids from (
    select c.id from public.clients c where c.tenant_id = p_tenant and c.deleted_at is null
      and c.status::text in ('active','aktiv') and coalesce(to_jsonb(c)->>'lifecycle_status', c.status::text) in ('active','aktiv')
      and lower(btrim(c.first_name)) = lower(given_name) and lower(btrim(c.last_name)) = lower(family_name)
      and c.date_of_birth = parsed_birth_date
    order by c.id limit 2 for share
  ) c;
  if cardinality(candidate_ids) is distinct from 1 then return null; end if;
  candidate := candidate_ids[1];
  select nullif(upper(btrim(c.insurance_number)), '') into candidate_insurance
  from public.clients c where c.tenant_id = p_tenant and c.id = candidate;
  if insurance_id is not null and candidate_insurance is not null and candidate_insurance is distinct from insurance_id then
    return null;
  end if;
  if not exists(select 1 from public.client_module_assignments a where a.tenant_id = p_tenant and a.client_id = candidate
      and a.module_key = 'pflege' and a.is_active and a.status in ('active','aktiv')) then
    return null;
  end if;
  return candidate;
end;
$$;

create function medication_plan_import_private.find_medication_plan_clients(p_tenant uuid, p_actor uuid, p_search text, p_identity jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  search_text text := lower(btrim(coalesce(p_search, '')));
  matched_id uuid;
  rows jsonb := '[]'::jsonb;
begin
  perform medication_plan_import_private.guard_medication_plan_import(p_tenant, p_actor, null, true);
  if p_identity is not null then
    if octet_length(p_identity::text) > 2000 then raise exception 'Ungültige Suchangaben.' using errcode = '22023'; end if;
    matched_id := medication_plan_import_private.exact_medication_plan_client(p_tenant, p_identity);
    if matched_id is not null then
      perform medication_plan_import_private.guard_medication_plan_import(p_tenant, p_actor, matched_id, true);
      select jsonb_build_array(jsonb_build_object('id', c.id, 'firstName', c.first_name,
        'lastName', c.last_name, 'birthDate', c.date_of_birth)) into rows
      from public.clients c where c.tenant_id = p_tenant and c.id = matched_id;
    end if;
    return jsonb_build_object('exact', matched_id is not null, 'clients', rows);
  end if;
  if length(search_text) not between 2 and 120 then
    return jsonb_build_object('exact', false, 'clients', rows);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'firstName', x.first_name,
    'lastName', x.last_name, 'birthDate', x.date_of_birth) order by x.last_name, x.first_name, x.id), '[]'::jsonb)
  into rows from (
    select c.id, c.first_name, c.last_name, c.date_of_birth from public.clients c
    where c.tenant_id = p_tenant and c.deleted_at is null and c.status::text in ('active','aktiv')
      and coalesce(to_jsonb(c)->>'lifecycle_status', c.status::text) in ('active','aktiv')
      and (strpos(lower(concat_ws(' ', c.first_name, c.last_name)), search_text) > 0
        or strpos(lower(concat_ws(' ', c.last_name, c.first_name)), search_text) > 0)
      and exists(select 1 from public.client_module_assignments a where a.tenant_id = p_tenant and a.client_id = c.id
        and a.module_key = 'pflege' and a.is_active and a.status in ('active','aktiv'))
    order by c.last_name, c.first_name, c.id limit 20
  ) x;
  return jsonb_build_object('exact', false, 'clients', rows);
end;
$$;

create function medication_plan_import_private.get_medication_plan_import(p_tenant uuid, p_actor uuid, p_import uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  draft medication_plan_import_private.medication_plan_imports%rowtype;
  reviews jsonb;
begin
  perform medication_plan_import_private.guard_medication_plan_import(p_tenant, p_actor, null, false);
  -- Explicit columns keep the binary source out of ordinary draft reads.
  select i.id, i.client_id, i.file_name, i.created_at, i.plan, i.source_sha256
    into draft.id, draft.client_id, draft.file_name, draft.created_at, draft.plan, draft.source_sha256
    from medication_plan_import_private.medication_plan_imports i where i.tenant_id = p_tenant and i.id = p_import;
  if draft.id is null then raise exception 'Entwurf nicht verfügbar.' using errcode = '42501'; end if;
  perform medication_plan_import_private.guard_medication_plan_import(p_tenant, p_actor, draft.client_id, false);
  select coalesce(jsonb_agg(jsonb_build_object('rowIndex', r.row_index, 'confirmedAt', r.confirmed_at,
    'actorId', r.actor_id) order by r.row_index), '[]'::jsonb) into reviews
  from medication_plan_import_private.medication_plan_import_confirmations r where r.import_id = draft.id;
  return jsonb_build_object('id', draft.id, 'clientId', draft.client_id, 'fileName', draft.file_name,
    'createdAt', draft.created_at, 'plan', draft.plan, 'sourceSha256', draft.source_sha256, 'confirmed', reviews);
end;
$$;

create function medication_plan_import_private.save_medication_plan_import(
  p_tenant uuid, p_actor uuid, p_request uuid, p_client uuid, p_assignment text, p_reason text,
  p_file_name text, p_mime_type text, p_source_base64 text, p_plan jsonb
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  draft medication_plan_import_private.medication_plan_imports%rowtype;
  source_bytes bytea;
  source_sha text;
  identity jsonb := p_plan->'patient';
  reason_text text := btrim(coalesce(p_reason, ''));
  matched_id uuid;
  header text;
  source_birth_date date;
  source_insurance text := nullif(upper(btrim(identity->>'insuranceId')), '');
begin
  perform medication_plan_import_private.guard_medication_plan_import(p_tenant, p_actor, p_client, true);
  if p_request is null or p_client is null or coalesce(p_assignment, '') not in ('exact','manual')
    or (p_assignment = 'manual' and length(reason_text) not between 10 and 500)
    or (p_assignment = 'exact' and reason_text <> '')
    or coalesce(length(btrim(p_file_name)), 0) not between 1 and 180
    or p_file_name ~ '[[:cntrl:]/\\]'
    or coalesce(p_mime_type, '') not in ('application/xml','text/xml','application/pdf','image/jpeg','image/png','image/webp')
    or coalesce(length(p_source_base64), 0) not between 4 and 4194304
    or p_source_base64 !~ '^[A-Za-z0-9+/]+={0,2}$'
    or jsonb_typeof(p_plan) is distinct from 'object'
    or octet_length(p_plan::text) > 262144
    or coalesce(p_plan->>'version', '') not in ('026','027','028')
    or jsonb_typeof(identity) is distinct from 'object'
    or coalesce(length(btrim(identity->>'firstName')), 0) not between 1 and 120
    or coalesce(length(btrim(identity->>'lastName')), 0) not between 1 and 120
    or ((identity->>'birthDate') is not null and (identity->>'birthDate') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
    or (source_insurance is not null and source_insurance !~ '^[A-Z][0-9]{9}$')
    or jsonb_typeof(p_plan->'rows') is distinct from 'array' then
    raise exception 'Datei oder Importangaben ungültig.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_plan->'rows') not between 1 and 200 or exists(
    select 1 from jsonb_array_elements(p_plan->'rows') r
    where jsonb_typeof(r) <> 'object' or coalesce(r->>'kind', '') not in ('medication','formulation','note')
  ) then
    raise exception 'Der Entwurf muss 1 bis 200 gültige Positionen enthalten.' using errcode = '22023';
  end if;
  begin
    source_birth_date := (identity->>'birthDate')::date;
  exception when datetime_field_overflow or invalid_datetime_format then
    raise exception 'Datei oder Importangaben ungültig.' using errcode = '22023';
  end;
  begin
    source_bytes := decode(p_source_base64, 'base64');
  exception when invalid_parameter_value or invalid_text_representation then
    raise exception 'Datei oder Importangaben ungültig.' using errcode = '22023';
  end;
  if octet_length(source_bytes) not between 1 and 3145728 then
    raise exception 'Datei oder Importangaben ungültig.' using errcode = '22023';
  end if;
  header := encode(substring(source_bytes from 1 for 12), 'hex');
  if (p_mime_type = 'application/pdf' and header not like '255044462d%')
    or (p_mime_type = 'image/jpeg' and header not like 'ffd8ff%')
    or (p_mime_type = 'image/png' and header not like '89504e470d0a1a0a%')
    or (p_mime_type = 'image/webp' and header not like '52494646________57454250') then
    raise exception 'Datei oder Importangaben ungültig.' using errcode = '22023';
  end if;
  source_sha := encode(extensions.digest(source_bytes, 'sha256'), 'hex');
  -- Same source cannot create another plan in the tenant or change its case.
  perform pg_advisory_xact_lock(hashtextextended('medication-plan-source:' || p_tenant::text || ':' || source_sha, 0));
  perform pg_advisory_xact_lock(hashtextextended('medication-plan-request:' || p_tenant::text || ':' || p_request::text, 0));
  select * into draft from medication_plan_import_private.medication_plan_imports where tenant_id = p_tenant
    and (request_id = p_request or source_sha256 = source_sha)
    order by (request_id = p_request) desc limit 1;
  if found then
    if draft.actor_id is distinct from p_actor or draft.client_id is distinct from p_client
      or draft.request_id is distinct from p_request or draft.source_content is distinct from source_bytes
      or draft.plan is distinct from p_plan or draft.assignment is distinct from p_assignment
      or draft.reason is distinct from reason_text or draft.file_name is distinct from btrim(p_file_name)
      or draft.mime_type is distinct from p_mime_type then
      raise exception 'Der Import konnte nicht erneut angelegt werden. Bitte vorhandene Entwürfe prüfen.' using errcode = '23505';
    end if;
    return medication_plan_import_private.get_medication_plan_import(p_tenant, p_actor, draft.id);
  end if;
  matched_id := medication_plan_import_private.exact_medication_plan_client(p_tenant, identity);
  if (p_assignment = 'exact' and matched_id is distinct from p_client)
    or (matched_id is not null and matched_id <> p_client) then
    raise exception 'Die Klientenzuordnung konnte nicht bestätigt werden.' using errcode = '22023';
  end if;
  if exists(
    select 1 from public.clients c where c.id = p_client and c.tenant_id = p_tenant
      and ((source_birth_date is not null and c.date_of_birth is not null and c.date_of_birth <> source_birth_date)
      or (source_insurance is not null and nullif(btrim(c.insurance_number), '') is not null
        and upper(btrim(c.insurance_number)) <> source_insurance))
  ) then
    raise exception 'Die Klientenzuordnung konnte nicht bestätigt werden.' using errcode = '22023';
  end if;
  insert into medication_plan_import_private.medication_plan_imports
    (tenant_id, client_id, actor_id, request_id, assignment, reason, file_name, mime_type, source_content, source_sha256, plan)
  values (p_tenant, p_client, p_actor, p_request, p_assignment, reason_text, btrim(p_file_name),
    p_mime_type, source_bytes, source_sha, p_plan) returning id into draft.id;
  return medication_plan_import_private.get_medication_plan_import(p_tenant, p_actor, draft.id);
end;
$$;

create function medication_plan_import_private.list_medication_plan_imports(p_tenant uuid, p_actor uuid, p_client uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if p_client is null then raise exception 'Pflegeakte auswählen.' using errcode = '22023'; end if;
  perform medication_plan_import_private.guard_medication_plan_import(p_tenant, p_actor, p_client, false);
  select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'clientId', i.client_id, 'fileName', i.file_name,
    'createdAt', i.created_at, 'positionCount', i.positions, 'confirmedCount',
    (select count(*) from medication_plan_import_private.medication_plan_import_confirmations r where r.import_id = i.id))
    order by i.created_at desc, i.id desc), '[]'::jsonb) into result
  from (select d.id, d.client_id, d.file_name, d.created_at, jsonb_array_length(d.plan->'rows') as positions
    from medication_plan_import_private.medication_plan_imports d where d.tenant_id = p_tenant and d.client_id = p_client
    order by d.created_at desc, d.id desc limit 50) i;
  return result;
end;
$$;

create function medication_plan_import_private.confirm_medication_plan_import_position(
  p_tenant uuid, p_actor uuid, p_import uuid, p_row_index integer
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  client uuid;
  positions integer;
  review medication_plan_import_private.medication_plan_import_confirmations%rowtype;
begin
  perform medication_plan_import_private.guard_medication_plan_import(p_tenant, p_actor, null, true);
  select d.client_id, jsonb_array_length(d.plan->'rows') into client, positions
  from medication_plan_import_private.medication_plan_imports d where d.tenant_id = p_tenant and d.id = p_import;
  if client is null then raise exception 'Entwurf nicht verfügbar.' using errcode = '42501'; end if;
  perform medication_plan_import_private.guard_medication_plan_import(p_tenant, p_actor, client, true);
  if p_row_index is null or p_row_index < 0 or p_row_index >= positions then
    raise exception 'Ungültige Position.' using errcode = '22023';
  end if;
  insert into medication_plan_import_private.medication_plan_import_confirmations (import_id, row_index, actor_id)
  values (p_import, p_row_index, p_actor) on conflict (import_id, row_index) do nothing;
  select * into strict review from medication_plan_import_private.medication_plan_import_confirmations r
  where r.import_id = p_import and r.row_index = p_row_index;
  return jsonb_build_object('rowIndex', review.row_index, 'confirmedAt', review.confirmed_at, 'actorId', review.actor_id);
end;
$$;

create function medication_plan_import_private.get_medication_plan_source(p_tenant uuid, p_actor uuid, p_import uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare client uuid;
begin
  perform medication_plan_import_private.guard_medication_plan_import(p_tenant, p_actor, null, false);
  select i.client_id into client from medication_plan_import_private.medication_plan_imports i where i.tenant_id = p_tenant and i.id = p_import;
  if client is null then raise exception 'Entwurf nicht verfügbar.' using errcode = '42501'; end if;
  perform medication_plan_import_private.guard_medication_plan_import(p_tenant, p_actor, client, false);
  return (select jsonb_build_object('fileName', i.file_name, 'mimeType', i.mime_type,
    'sourceBase64', replace(encode(i.source_content, 'base64'), chr(10), ''), 'sourceSha256', i.source_sha256)
    from medication_plan_import_private.medication_plan_imports i where i.tenant_id = p_tenant and i.id = p_import);
end;
$$;

create function public.find_medication_plan_clients(p_tenant uuid, p_actor uuid, p_search text, p_identity jsonb)
returns jsonb language sql security invoker set search_path = '' as $$
  select medication_plan_import_private.find_medication_plan_clients(p_tenant, p_actor, p_search, p_identity)
$$;
create function public.get_medication_plan_import(p_tenant uuid, p_actor uuid, p_import uuid)
returns jsonb language sql security invoker set search_path = '' as $$
  select medication_plan_import_private.get_medication_plan_import(p_tenant, p_actor, p_import)
$$;
create function public.save_medication_plan_import(
  p_tenant uuid, p_actor uuid, p_request uuid, p_client uuid, p_assignment text, p_reason text,
  p_file_name text, p_mime_type text, p_source_base64 text, p_plan jsonb
)
returns jsonb language sql security invoker set search_path = '' as $$
  select medication_plan_import_private.save_medication_plan_import(p_tenant,p_actor,p_request,p_client,p_assignment,p_reason,
    p_file_name,p_mime_type,p_source_base64,p_plan)
$$;
create function public.list_medication_plan_imports(p_tenant uuid, p_actor uuid, p_client uuid)
returns jsonb language sql security invoker set search_path = '' as $$
  select medication_plan_import_private.list_medication_plan_imports(p_tenant, p_actor, p_client)
$$;
create function public.confirm_medication_plan_import_position(p_tenant uuid, p_actor uuid, p_import uuid, p_row_index integer)
returns jsonb language sql security invoker set search_path = '' as $$
  select medication_plan_import_private.confirm_medication_plan_import_position(p_tenant, p_actor, p_import, p_row_index)
$$;
create function public.get_medication_plan_source(p_tenant uuid, p_actor uuid, p_import uuid)
returns jsonb language sql security invoker set search_path = '' as $$
  select medication_plan_import_private.get_medication_plan_source(p_tenant, p_actor, p_import)
$$;

revoke all on function medication_plan_import_private.medication_plan_import_immutable(),
  medication_plan_import_private.guard_medication_plan_import(uuid,uuid,uuid,boolean), medication_plan_import_private.exact_medication_plan_client(uuid,jsonb),
  medication_plan_import_private.find_medication_plan_clients(uuid,uuid,text,jsonb), public.find_medication_plan_clients(uuid,uuid,text,jsonb),
  medication_plan_import_private.get_medication_plan_import(uuid,uuid,uuid), public.get_medication_plan_import(uuid,uuid,uuid),
  medication_plan_import_private.save_medication_plan_import(uuid,uuid,uuid,uuid,text,text,text,text,text,jsonb),
  public.save_medication_plan_import(uuid,uuid,uuid,uuid,text,text,text,text,text,jsonb),
  medication_plan_import_private.list_medication_plan_imports(uuid,uuid,uuid), public.list_medication_plan_imports(uuid,uuid,uuid),
  medication_plan_import_private.confirm_medication_plan_import_position(uuid,uuid,uuid,integer),
  public.confirm_medication_plan_import_position(uuid,uuid,uuid,integer),
  medication_plan_import_private.get_medication_plan_source(uuid,uuid,uuid), public.get_medication_plan_source(uuid,uuid,uuid)
from public, anon, authenticated, service_role;
grant execute on function medication_plan_import_private.find_medication_plan_clients(uuid,uuid,text,jsonb), public.find_medication_plan_clients(uuid,uuid,text,jsonb),
  medication_plan_import_private.get_medication_plan_import(uuid,uuid,uuid), public.get_medication_plan_import(uuid,uuid,uuid),
  medication_plan_import_private.save_medication_plan_import(uuid,uuid,uuid,uuid,text,text,text,text,text,jsonb),
  public.save_medication_plan_import(uuid,uuid,uuid,uuid,text,text,text,text,text,jsonb),
  medication_plan_import_private.list_medication_plan_imports(uuid,uuid,uuid), public.list_medication_plan_imports(uuid,uuid,uuid),
  medication_plan_import_private.confirm_medication_plan_import_position(uuid,uuid,uuid,integer),
  public.confirm_medication_plan_import_position(uuid,uuid,uuid,integer),
  medication_plan_import_private.get_medication_plan_source(uuid,uuid,uuid), public.get_medication_plan_source(uuid,uuid,uuid)
to authenticated;
