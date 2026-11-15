-- Enable the existing ambulatory Vitalwerte capture, receipt, follow-up and correction
-- contracts against the live tables. The separate device, review and care-path
-- workspace remains covered by its own release and qualification requirements.
create schema if not exists vital_workspace;
revoke all on schema vital_workspace from public, anon, authenticated, service_role;
grant usage on schema vital_workspace to authenticated;

alter table public.vital_sign_measurements
  add column if not exists occurred_at timestamptz,
  add column if not exists creation_request_id uuid,
  add column if not exists creation_payload jsonb,
  add column if not exists catalog_snapshot jsonb,
  add column if not exists configuration_snapshot jsonb;

-- Existing capture timestamps do not establish the historical time of measurement.
create unique index if not exists vital_measurement_request
  on public.vital_sign_measurements (tenant_id, creation_request_id) where creation_request_id is not null;

alter table public.client_vital_sign_settings
  add column if not exists source_kind text,
  add column if not exists approved_by uuid references public.profiles(id),
  add column if not exists valid_from timestamptz,
  add column if not exists valid_to timestamptz,
  add column if not exists active boolean not null default true,
  add column if not exists revision integer not null default 1,
  alter column active set default true,
  alter column revision set default 1;

create index if not exists vital_measurements_case_order
  on public.vital_sign_measurements (tenant_id, client_id, id);
create index if not exists vital_follow_ups_case_order
  on public.vital_measurement_follow_ups (tenant_id, client_id, id);
create index if not exists vital_follow_ups_measurement_order
  on public.vital_measurement_follow_ups (tenant_id, client_id, measurement_id, id);
create index if not exists vital_invalidations_case_order
  on public.vital_measurement_invalidations (tenant_id, client_id, id);

create or replace function vital_workspace.current_actor(p_manage boolean default false)
returns uuid language sql stable security definer set search_path = '' as $$
  select profile.id
  from public.profiles profile
  join public.roles role on role.id = profile.role_id
  where profile.id = public.resolve_current_profile_id()
    and profile.tenant_id = public.current_tenant_id()
    and profile.status::text = 'active'
    and profile.is_active is true
    and (profile.auth_user_id = auth.uid() or (profile.auth_user_id is null and profile.id = auth.uid()))
    and (to_jsonb(role)->>'tenant_id' is null or to_jsonb(role)->>'tenant_id' = profile.tenant_id::text)
    and role.key not in ('employee_portal', 'client_portal', 'family_portal', 'relative_portal')
    and coalesce(public.current_portal_type(), 'business') = 'business'
    and auth.jwt()->>'role' = 'authenticated'
    and case when auth.jwt()->>'exp' ~ '^[0-9]{1,12}$'
      then (auth.jwt()->>'exp')::bigint > extract(epoch from statement_timestamp())
      else false end
    and account_security.allowed_session() is true
    and exists (
      select 1 from public.role_permissions rp
      where rp.role_id = role.id
        and (to_jsonb(rp)->>'tenant_id' is null or to_jsonb(rp)->>'tenant_id' = profile.tenant_id::text)
        and (rp.permission_key = 'pflege.vitals.view' or (rp.permission_key = 'vitals' and rp.can_view is true))
    )
    and (not p_manage or exists (
      select 1 from public.role_permissions rp
      where rp.role_id = role.id
        and (to_jsonb(rp)->>'tenant_id' is null or to_jsonb(rp)->>'tenant_id' = profile.tenant_id::text)
        and (rp.permission_key = 'pflege.vitals.manage' or (rp.permission_key = 'vitals' and rp.can_update is true))
    ));
$$;

create or replace function vital_workspace.assert_vital_actor(permission_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := vital_workspace.current_actor(permission_name = 'pflege.vitals.manage');
  selected_role uuid;
begin
  if permission_name not in ('pflege.vitals.view', 'pflege.vitals.manage') or actor is null then
    raise exception 'Eine aktive Sitzung mit Vitalwertberechtigung ist erforderlich.' using errcode = '42501';
  end if;

  -- Keep the authenticated session, profile and own role stable during a write or receipt.
  perform 1 from auth.sessions s
  where s.user_id = auth.uid() and s.id = account_security.session_id()
    and (s.not_after is null or s.not_after > clock_timestamp())
  for share;
  if not found then raise exception 'Die Sitzung wurde beendet.' using errcode = '42501'; end if;

  select profile.role_id into selected_role from public.profiles profile
  where profile.id = actor for share;
  perform 1 from public.roles role where role.id = selected_role for share;
  perform 1 from public.role_permissions rp where rp.role_id = selected_role
    and rp.permission_key in ('pflege.vitals.view', 'pflege.vitals.manage', 'vitals') for share;
  if vital_workspace.current_actor(permission_name = 'pflege.vitals.manage') is distinct from actor then
    raise exception 'Die Vitalwertberechtigung wurde geändert.' using errcode = '42501';
  end if;
  return actor;
end $$;

create or replace function vital_workspace.active_client(c public.clients)
returns boolean language sql stable set search_path = '' as $$
  select c.status::text in ('active', 'aktiv')
    and c.deleted_at is null
    and to_jsonb(c)->>'archived_at' is null
    and coalesce(to_jsonb(c)->>'lifecycle_status', 'active') in ('active', 'aktiv');
$$;

create or replace function vital_workspace.is_active_case(p_tenant uuid, p_client uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.clients c
    join public.client_module_assignments a on a.tenant_id = c.tenant_id and a.client_id = c.id
    where c.tenant_id = p_tenant and c.id = p_client and vital_workspace.active_client(c)
      and a.module_key = 'pflege' and a.is_active and a.status in ('active', 'aktiv')
  );
$$;

create or replace function vital_workspace.vital_client_active(p_client uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  tenant uuid := public.current_tenant_id();
begin
  perform 1 from public.clients c
  where c.id = p_client and c.tenant_id = tenant and vital_workspace.active_client(c)
  for share;
  if not found then return false; end if;

  perform 1 from public.client_module_assignments a
  where a.tenant_id = tenant and a.client_id = p_client and a.module_key = 'pflege'
    and a.is_active and a.status in ('active', 'aktiv')
  for share;
  return found;
end $$;

create or replace function vital_workspace.can_read_case(p_tenant uuid, p_client uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_tenant = public.current_tenant_id()
    and vital_workspace.current_actor(false) is not null
    and vital_workspace.is_active_case(p_tenant, p_client);
$$;

create or replace function vital_workspace.list_cases(p_after_id uuid, p_page_size integer)
returns table (id uuid, tenant_id uuid, first_name text, last_name text, client_number text)
language plpgsql stable security definer set search_path = '' as $$
declare
  tenant uuid := public.current_tenant_id();
begin
  if vital_workspace.current_actor(false) is null then
    raise exception 'Leseberechtigung für Vitalwerte fehlt.' using errcode = '42501';
  end if;
  if p_page_size is null or p_page_size not between 1 and 200 then
    raise exception 'Die Seitengröße muss zwischen 1 und 200 liegen.' using errcode = '22023';
  end if;

  return query
  select c.id, c.tenant_id, coalesce(c.first_name, ''), coalesce(c.last_name, ''), c.client_number
  from public.clients c
  where c.tenant_id = tenant and (p_after_id is null or c.id > p_after_id)
    and vital_workspace.active_client(c)
    and exists (
      select 1 from public.client_module_assignments a
      where a.tenant_id = tenant and a.client_id = c.id and a.module_key = 'pflege'
        and a.is_active and a.status in ('active', 'aktiv')
    )
  order by c.id
  limit p_page_size;
end $$;

create or replace function public.list_ambulatory_vital_cases(p_after_id uuid, p_page_size integer)
returns table (id uuid, tenant_id uuid, first_name text, last_name text, client_number text)
language sql stable security invoker set search_path = '' as $$
  select * from vital_workspace.list_cases(p_after_id, p_page_size);
$$;

create or replace function vital_workspace.has_public_functions(p_names text[])
returns boolean language sql stable set search_path = '' as $$
  select not exists (
    select 1 from unnest(p_names) name
    where not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = name
        and has_function_privilege('authenticated', p.oid, 'execute')
    )
  );
$$;

create or replace function vital_workspace.case_identity(p_client_id uuid)
returns table (id uuid, tenant_id uuid, first_name text, last_name text, client_number text,
  vital_path boolean, respiratory_path boolean)
language sql stable security definer set search_path = '' as $$
  select c.id, c.tenant_id, coalesce(c.first_name, ''), coalesce(c.last_name, ''), c.client_number,
    vital_workspace.has_public_functions(array['web_read_vital_care_path_context','web_read_vital_care_path_page',
      'web_commit_vital_care_path_packet','web_confirm_vital_care_path_packet',
      'web_read_vital_care_review_page','web_commit_vital_care_review','web_confirm_vital_care_review']),
    vital_workspace.has_public_functions(array['web_read_respiratory_intensive_care_path_context',
      'web_read_respiratory_intensive_care_path_page','web_commit_respiratory_intensive_care_path_packet',
      'web_confirm_respiratory_intensive_care_path_packet','web_read_respiratory_care_review_page',
      'web_commit_respiratory_care_review','web_confirm_respiratory_care_review'])
  from public.clients c
  where c.id = p_client_id and vital_workspace.can_read_case(c.tenant_id, c.id);
$$;

create or replace function public.get_ambulatory_vital_case(p_client_id uuid)
returns table (id uuid, tenant_id uuid, first_name text, last_name text, client_number text,
  vital_path boolean, respiratory_path boolean)
language sql stable security invoker set search_path = '' as $$
  select * from vital_workspace.case_identity(p_client_id);
$$;

create or replace function vital_workspace.can_view_catalog()
returns boolean language sql stable security definer set search_path = '' as $$
  select vital_workspace.current_actor(false) is not null;
$$;


create or replace function vital_workspace.vital_keys(p jsonb,keys text[]) returns boolean language sql immutable set search_path='' as $$select coalesce(jsonb_typeof(p)='object' and p?&keys and p-keys='{}'::jsonb,false)$$;

create or replace function vital_workspace.vital_text(p jsonb,minimum integer,maximum integer) returns boolean language sql immutable set search_path='' as $$select coalesce(jsonb_typeof(p)='string' and length(btrim(p#>>'{}'))>=minimum and length(p#>>'{}')<=maximum,false)$$;

create or replace function vital_workspace.vital_time(p jsonb) returns timestamptz language plpgsql immutable set search_path='' as $$declare result timestamptz;begin
 if jsonb_typeof(p) is distinct from 'string' or p#>>'{}' !~ '^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.][0-9]{1,6})?(Z|[+-]((0[0-9]|1[0-3]):[0-5][0-9]|14:00))$' then raise exception 'Ausdrücklicher tatsächlicher Zeitpunkt mit Zeitzone fehlt.' using errcode='23514';end if;
 result:=(p#>>'{}')::timestamptz;if not isfinite(result) then raise exception 'Endlicher Zeitpunkt fehlt.' using errcode='23514';end if;return result;
 exception when datetime_field_overflow or invalid_datetime_format then raise exception 'Kalenderzeitpunkt ist ungültig.' using errcode='23514';end$$;

create or replace function vital_workspace.vital_uuid(p jsonb) returns boolean language sql immutable set search_path='' as $$select coalesce(jsonb_typeof(p)='string' and p#>>'{}'~'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',false)$$;

create or replace function vital_workspace.vital_assess_limits(vals jsonb,limits jsonb) returns text language plpgsql immutable set search_path='' as $$
declare item record;bound jsonb;full_limits boolean:=true;outside boolean:=false;lo numeric;hi numeric;v numeric;
begin
 if jsonb_typeof(vals) is distinct from 'object' or vals='{}'::jsonb or jsonb_typeof(limits) is distinct from 'object' then return 'unrated';end if;
 for item in select key,value from jsonb_each(vals) loop
  if jsonb_typeof(item.value)<>'number' then return 'unrated';end if;bound:=limits->item.key;
  if jsonb_typeof(bound) is distinct from 'object' or not(bound?'min' or bound?'max') then full_limits:=false;continue;end if;
  if bound-array['min','max']<>'{}'::jsonb or bound?'min' and jsonb_typeof(bound->'min')<>'number' or bound?'max' and jsonb_typeof(bound->'max')<>'number' then return 'unrated';end if;
  lo:=(bound->>'min')::numeric;hi:=(bound->>'max')::numeric;v:=item.value::text::numeric;
  if abs(lo)>1000000000 or abs(hi)>1000000000 or lo>hi then return 'unrated';end if;
  if v<lo or v>hi then outside:=true;end if;
 end loop;
 return case when outside then 'outside_configured_range' when full_limits then 'within_configured_range' else 'unrated' end;
end$$;

create or replace function vital_workspace.record_vital_measurement(request_id uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=vital_workspace.assert_vital_actor('pflege.vitals.manage'); tenant uuid:=public.current_tenant_id();
 subject uuid; kind text; occurred timestamptz; previous public.vital_sign_measurements%rowtype;
 catalog public.vital_sign_catalog%rowtype; setting public.client_vital_sign_settings%rowtype;
 vals jsonb; ctx jsonb; item record; required text[]; component text; number_value numeric;
 flag text:='unrated'; display text; actor_name text; result_id uuid;
begin
 if request_id is null or jsonb_typeof(payload) is distinct from 'object' or length(payload::text)>20000 then raise exception 'Ungültige Anfrage.' using errcode='23514';end if;
 if not vital_workspace.vital_keys(payload,array['clientId','type','occurredAt','valuesJson','contextJson','note','catalogVersion','configurationVersion']) or not vital_workspace.vital_uuid(payload->'clientId') or not vital_workspace.vital_text(payload->'type',1,100) or not vital_workspace.vital_text(payload->'valuesJson',1,4096) or not vital_workspace.vital_text(payload->'contextJson',1,8192) or not vital_workspace.vital_text(payload->'note',0,4000) or not vital_workspace.vital_text(payload->'catalogVersion',1,100) or not vital_workspace.vital_text(payload->'configurationVersion',1,100) then raise exception 'Vollständiger ursprünglicher Messauftrag fehlt.' using errcode='23514';end if;
 subject:=(payload->>'clientId')::uuid; kind:=payload->>'type';
 -- Serialize identical request IDs, including retries that arrive with a different case.
 perform pg_advisory_xact_lock(hashtextextended(tenant::text||':vital:measurement:'||request_id::text,0));
 if vital_workspace.vital_client_active(subject) is not true then raise exception 'Kein aktiver zugänglicher Pflegefall.' using errcode='42501';end if;
 select * into previous from public.vital_sign_measurements v where v.tenant_id=tenant and v.creation_request_id=request_id;
 if previous.id is not null then
  if previous.client_id<>subject or previous.recorded_by<>actor or previous.creation_payload is distinct from payload then raise exception 'Anfrage mit anderen Daten verwendet.' using errcode='23514';end if;
  return previous.id;
 end if;
 select * into catalog from public.vital_sign_catalog c where c.key=kind and c.is_active for share;
 if catalog.key is null or (payload->>'catalogVersion')::timestamptz is distinct from catalog.updated_at then raise exception 'Messkatalog geändert. Neu laden.' using errcode='40001';end if;
 select * into setting from public.client_vital_sign_settings s where s.tenant_id=tenant and s.client_id=subject and s.vital_key=kind for share;
 if (setting.id is null and payload->>'configurationVersion' is distinct from 'none') or (setting.id is not null and (payload->>'configurationVersion')::timestamptz is distinct from setting.updated_at) then raise exception 'Messkonfiguration geändert. Neu laden.' using errcode='40001';end if;
 if (case when setting.id is null then catalog.default_enabled else setting.enabled and setting.active end) is not true then raise exception 'Messart ist deaktiviert.' using errcode='23514';end if;
 if coalesce(payload->>'occurredAt','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.][0-9]{1,3})?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$' then raise exception 'Tatsächlicher Messzeitpunkt mit Zeitzone fehlt.' using errcode='23514';end if;
 occurred:=vital_workspace.vital_time(payload->'occurredAt');
 if occurred>clock_timestamp() then raise exception 'Messzeitpunkt liegt in der Zukunft.' using errcode='23514';end if;
 if length(coalesce(payload->>'valuesJson',''))>4096 or length(coalesce(payload->>'contextJson',''))>8192 or length(coalesce(payload->>'note',''))>4000 then raise exception 'Messangaben zu umfangreich.' using errcode='23514';end if;
 vals:=(payload->>'valuesJson')::jsonb;ctx:=(payload->>'contextJson')::jsonb;
 if jsonb_typeof(vals) is distinct from 'object' or vals='{}'::jsonb or jsonb_typeof(ctx) is distinct from 'object' then raise exception 'Strukturierte Messwerte erforderlich.' using errcode='23514';end if;
 required:=case when kind in ('blood_pressure','arterial_pressure') then array['systolic','diastolic'] when kind='gcs' then array['eyes','verbal','motor','total'] when kind='fluid_balance' then array['intake','output','balance'] else array(select jsonb_array_elements_text(catalog.components)) end;
 foreach component in array required loop
  if not vals?component then raise exception 'Messkomponente fehlt.' using errcode='23514';end if;
 end loop;
 for item in select key,value from jsonb_each(vals) loop
  if not catalog.components?item.key or jsonb_typeof(item.value)<>'number' then raise exception 'Ungültige Messkomponente.' using errcode='23514';end if;
  number_value:=item.value::text::numeric;
  if abs(number_value)>1000000000 then raise exception 'Messwert überschreitet technische Zahlengrenze.' using errcode='23514';end if;
  if kind in ('weight','height','bmi','body_surface_area','head_circumference','blood_glucose','blood_ketones','capillary_refill','urine_output','pupils','pulse','respiratory_rate','oxygen_flow','tidal_volume','minute_ventilation','ventilator_rate','lactate') and number_value<0 then raise exception 'Negative Messgröße nicht zulässig.' using errcode='23514';end if;
 end loop;
 if (select count(*) from jsonb_each(ctx))>20 then raise exception 'Zu viele Kontextangaben.' using errcode='23514';end if;
 for item in select key,value from jsonb_each(ctx) loop
  if nullif(btrim(item.key),'') is null or length(item.key)>80 or jsonb_typeof(item.value)<>'string' or length(item.value#>>'{}')>500 then raise exception 'Ungültiger Messkontext.' using errcode='23514';end if;
 end loop;
 if kind in ('blood_pressure','arterial_pressure') and ((vals->>'systolic')::numeric<0 or (vals->>'diastolic')::numeric<0 or (vals->>'systolic')::numeric<(vals->>'diastolic')::numeric) then raise exception 'Blutdruckkomponenten prüfen.' using errcode='23514';end if;
 if kind in ('oxygen','fio2','svv') and (vals->>'value')::numeric not between 0 and 100 then raise exception 'Prozentangabe prüfen.' using errcode='23514';end if;
 if kind='pain_score' and ((vals->>'value')::numeric not between 0 and 10 or (vals->>'value')::numeric<>trunc((vals->>'value')::numeric) or ctx->>'scale' is distinct from 'NRS') then raise exception 'NRS 0–10 ausdrücklich erforderlich.' using errcode='23514';end if;
 if kind='rass' and ((vals->>'value')::numeric not between -5 and 4 or (vals->>'value')::numeric<>trunc((vals->>'value')::numeric)) then raise exception 'RASS-Skala prüfen.' using errcode='23514';end if;
 if kind='gcs' then
  foreach component in array array['eyes','verbal','motor'] loop
   number_value:=(vals->>component)::numeric;
   if number_value<>trunc(number_value) or number_value<1 or number_value>(case component when 'eyes' then 4 when 'verbal' then 5 else 6 end) then raise exception 'GCS-Komponente prüfen.' using errcode='23514';end if;
  end loop;
  if (vals->>'total')::numeric<> (vals->>'eyes')::numeric+(vals->>'verbal')::numeric+(vals->>'motor')::numeric then raise exception 'GCS-Summe prüfen.' using errcode='23514';end if;
 end if;
 if kind='fluid_balance' and (nullif(btrim(ctx->>'period'),'') is null or coalesce(ctx->>'completeness','') not in ('complete','incomplete','unknown') or (ctx->>'completeness'<>'complete' and nullif(btrim(ctx->>'incompleteReason'),'') is null)) then raise exception 'Bilanzzeitraum und Erfassungsumfang fehlen.' using errcode='23514';end if;
 if kind='urine_output' and nullif(btrim(ctx->>'period'),'') is null then raise exception 'Ausscheidungszeitraum fehlt.' using errcode='23514';end if;
 if kind='fluid_balance' and ((vals->>'intake')::numeric<0 or (vals->>'output')::numeric<0 or (vals->>'balance')::double precision<>(vals->>'intake')::double precision-(vals->>'output')::double precision) then raise exception 'Flüssigkeitsbilanz prüfen.' using errcode='23514';end if;
 -- An older configuration with no approval evidence leaves the measurement unrated.
 if setting.active is true and setting.source_kind in ('physician_order','care_plan','individual_configuration')
   and setting.approved_by is not null and setting.valid_from<=occurred
   and (setting.valid_to is null or setting.valid_to>=occurred) then
  flag:=vital_workspace.vital_assess_limits(vals,setting.limits);
 end if;
 display:=case when kind in ('blood_pressure','arterial_pressure') then (vals->>'systolic')||'/'||(vals->>'diastolic') when kind='gcs' then 'GCS '||(vals->>'total')||' (E'||(vals->>'eyes')||' V'||(vals->>'verbal')||' M'||(vals->>'motor')||')' when kind='fluid_balance' then vals->>'balance' when kind='pupils' then 'L '||(vals->>'leftSize')||' / R '||(vals->>'rightSize') else vals->>'value' end;
 select coalesce(nullif(p.display_name,''),p.email,'Pflegekraft') into actor_name from public.profiles p where p.id=actor and p.tenant_id=tenant and p.is_active;
 insert into public.vital_sign_measurements(tenant_id,client_id,vital_key,values,display_value,unit,context,note,source,flag_status,recorded_by,recorded_by_name,measured_at,occurred_at,creation_request_id,creation_payload,catalog_snapshot,configuration_snapshot)
 values(tenant,subject,kind,vals,display,catalog.default_unit,ctx,nullif(btrim(payload->>'note'),''),'manual',flag,actor,actor_name,occurred,occurred,request_id,payload,to_jsonb(catalog),case when setting.id is null then jsonb_build_object('enabled',catalog.default_enabled,'limits','{}'::jsonb,'version','none') else to_jsonb(setting)-'created_by'-'updated_by' end) returning id into result_id;
 insert into public.client_timeline_events(tenant_id,client_id,event_type,icon,title,subtitle,status,actor_name,is_internal,metadata)
 values(tenant,subject,'pflegeplan','💓',catalog.label||' erfasst',display||' '||catalog.default_unit,case when flag='outside_configured_range' then 'fehlerhaft' else 'aktiv' end,actor_name,true,jsonb_build_object('measurementId',result_id,'occurredAt',occurred,'flagStatus',flag));
 if flag='outside_configured_range' then
  insert into public.vital_sign_events(tenant_id,client_id,measurement_id,summary,payload,created_by)
  values(tenant,subject,result_id,catalog.label||': außerhalb konfigurierter Grenzen',jsonb_build_object('values',vals,'limits',setting.limits,'requiresProfessionalReview',true),actor);
 end if;
 return result_id;
end $$;

create or replace function public.record_ambulatory_vital_measurement(request_id uuid,payload jsonb)
returns uuid language sql security invoker set search_path='' as $$select vital_workspace.record_vital_measurement(request_id,payload)$$;

create or replace function vital_workspace.record_vital_follow_up(request_id uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=vital_workspace.assert_vital_actor('pflege.vitals.manage');tenant uuid:=public.current_tenant_id();m public.vital_sign_measurements%rowtype;previous public.vital_measurement_follow_ups%rowtype;observed timestamptz;next_review timestamptz;actor_name text;result_id uuid;
begin
 if request_id is null or jsonb_typeof(payload) is distinct from 'object' or length(payload::text)>12000 then raise exception 'Ungültige Anfrage.' using errcode='23514';end if;
 if not vital_workspace.vital_keys(payload,array['measurementId','observedAt','observation','action','responsiblePerson','outcome','nextReviewAt']) or not vital_workspace.vital_uuid(payload->'measurementId') or not vital_workspace.vital_text(payload->'observation',1,2000) or not vital_workspace.vital_text(payload->'action',1,2000) or not vital_workspace.vital_text(payload->'responsiblePerson',1,200) or not vital_workspace.vital_text(payload->'outcome',1,40) or not vital_workspace.vital_text(payload->'nextReviewAt',0,100) then raise exception 'Vollständiger tatsächlicher Kontrollauftrag fehlt.' using errcode='23514';end if;
 perform pg_advisory_xact_lock(hashtextextended(tenant::text||':vital:record_vital_follow_up:'||request_id::text,0));
 select * into m from public.vital_sign_measurements v where v.id=(payload->>'measurementId')::uuid and v.tenant_id=tenant for update;
 if m.id is null or vital_workspace.vital_client_active(m.client_id) is not true then raise exception 'Messung nicht zugänglich.' using errcode='42501';end if;
 select * into previous from public.vital_measurement_follow_ups f where f.tenant_id=tenant and f.request_id=record_vital_follow_up.request_id;
 if previous.id is not null then
  if previous.measurement_id<>m.id or previous.recorded_by<>actor or previous.creation_payload is distinct from payload then raise exception 'Anfrage mit anderen Daten verwendet.' using errcode='23514';end if;return previous.id;
 end if;
 if coalesce(payload->>'observedAt','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.][0-9]{1,3})?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$' then raise exception 'Kontrollzeit mit Zeitzone fehlt.' using errcode='23514';end if;
 if m.occurred_at is null or exists(select 1 from public.vital_measurement_invalidations i where i.measurement_id=m.id) then raise exception 'Unverändertes gültiges Messoriginal mit tatsächlichem Zeitpunkt fehlt.' using errcode='23514';end if;
 observed:=vital_workspace.vital_time(payload->'observedAt');
 if observed>clock_timestamp() or (m.occurred_at is not null and observed<m.occurred_at) then raise exception 'Kontrollzeitpunkt prüfen.' using errcode='23514';end if;
 if payload->>'outcome'='ongoing' then
  if coalesce(payload->>'nextReviewAt','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.][0-9]{1,3})?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$' then raise exception 'Nächster Kontrolltermin fehlt.' using errcode='23514';end if;
  next_review:=vital_workspace.vital_time(payload->'nextReviewAt');if next_review<=observed then raise exception 'Kontrolltermin muss nach Beobachtung liegen.' using errcode='23514';end if;
 elsif payload->>'outcome'='resolved' and coalesce(payload->>'nextReviewAt','')='' then next_review:=null;
 else raise exception 'Ergebnis und Kontrollbedarf prüfen.' using errcode='23514';end if;
 select coalesce(nullif(p.display_name,''),p.email,'Pflegekraft') into actor_name from public.profiles p where p.id=actor and p.tenant_id=tenant and p.is_active;
 insert into public.vital_measurement_follow_ups(tenant_id,client_id,measurement_id,request_id,creation_payload,observed_at,observation,action,responsible_person,outcome,next_review_at,recorded_by,recorded_by_name)
 values(tenant,m.client_id,m.id,request_id,payload,observed,btrim(payload->>'observation'),btrim(payload->>'action'),btrim(payload->>'responsiblePerson'),payload->>'outcome',next_review,actor,actor_name) returning id into result_id;
 return result_id;
end $$;

create or replace function vital_workspace.invalidate_vital_measurement(request_id uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=vital_workspace.assert_vital_actor('pflege.vitals.manage');tenant uuid:=public.current_tenant_id();
 m public.vital_sign_measurements%rowtype;previous public.vital_measurement_invalidations%rowtype;actor_name text;result_id uuid;
begin
 if request_id is null or jsonb_typeof(payload) is distinct from 'object' or length(payload::text)>16000
 or (payload-array['measurementId','reason'])<>'{}'::jsonb or jsonb_typeof(payload->'measurementId') is distinct from 'string'
 or jsonb_typeof(payload->'reason') is distinct from 'string' then raise exception 'Ungültiger Korrekturvermerk.' using errcode='23514';end if;
 perform pg_advisory_xact_lock(hashtextextended(tenant::text||':vital:invalidate_vital_measurement:'||request_id::text,0));
 select * into m from public.vital_sign_measurements v where v.id=(payload->>'measurementId')::uuid and v.tenant_id=tenant for update;
 if m.id is null or vital_workspace.vital_client_active(m.client_id) is not true then raise exception 'Messung nicht zugänglich.' using errcode='42501';end if;
 select * into previous from public.vital_measurement_invalidations i where i.tenant_id=tenant and i.request_id=invalidate_vital_measurement.request_id;
 if previous.id is not null then
  if previous.measurement_id<>m.id or previous.recorded_by<>actor or previous.creation_payload is distinct from payload then raise exception 'Anfrage mit anderen Daten verwendet.' using errcode='23514';end if;
  return previous.id;
 end if;
 if exists(select 1 from public.vital_measurement_invalidations i where i.measurement_id=m.id) then raise exception 'Messung ist bereits als ungültig gekennzeichnet. Neu laden.' using errcode='40001';end if;
 if nullif(btrim(payload->>'reason'),'') is null or length(payload->>'reason')>2000 then raise exception 'Tatsächlichen Korrekturgrund angeben.' using errcode='23514';end if;
 select coalesce(nullif(p.display_name,''),p.email,'Pflegekraft') into actor_name from public.profiles p where p.id=actor and p.tenant_id=tenant and p.is_active;
 insert into public.vital_measurement_invalidations(tenant_id,client_id,measurement_id,request_id,creation_payload,reason,recorded_by,recorded_by_name)
 values(tenant,m.client_id,m.id,request_id,payload,btrim(payload->>'reason'),actor,actor_name) returning id into result_id;
 insert into public.client_timeline_events(tenant_id,client_id,event_type,icon,title,subtitle,status,actor_name,is_internal,metadata)
 values(tenant,m.client_id,'pflegeplan','💓','Vitalmessung als ungültig gekennzeichnet',btrim(payload->>'reason'),'fehlerhaft',actor_name,true,jsonb_build_object('measurementId',m.id,'invalidationId',result_id));
 -- Existing reactions/events remain evidence. This does not resolve an alert or clinical follow-up.
 return result_id;
end $$;

create or replace function public.record_ambulatory_vital_follow_up(request_id uuid,payload jsonb)
returns uuid language sql security invoker set search_path='' as $$select vital_workspace.record_vital_follow_up(request_id,payload)$$;

create or replace function public.invalidate_ambulatory_vital_measurement(request_id uuid,payload jsonb)
returns uuid language sql security invoker set search_path='' as $$select vital_workspace.invalidate_vital_measurement(request_id,payload)$$;

create or replace function vital_workspace.confirm_vital_native_write(p_kind text,p_id uuid,p_request uuid,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare tenant uuid:=public.current_tenant_id();actor uuid:=vital_workspace.assert_vital_actor('pflege.vitals.view');original jsonb;client uuid;measurement uuid;
begin
 if p_kind='measurement' then select to_jsonb(m),m.client_id,m.id into original,client,measurement from public.vital_sign_measurements m where m.id=p_id and m.tenant_id=tenant and m.creation_request_id=p_request and m.recorded_by=actor and m.creation_payload=p_payload for share;
 elsif p_kind='follow_up' then select to_jsonb(f),f.client_id,f.measurement_id into original,client,measurement from public.vital_measurement_follow_ups f where f.id=p_id and f.tenant_id=tenant and f.request_id=p_request and f.recorded_by=actor and f.creation_payload=p_payload for share;
 elsif p_kind='invalidation' then select to_jsonb(i),i.client_id,i.measurement_id into original,client,measurement from public.vital_measurement_invalidations i where i.id=p_id and i.tenant_id=tenant and i.request_id=p_request and i.recorded_by=actor and i.creation_payload=p_payload for share;
 else raise exception 'Unbekannte Messquittungsart.' using errcode='23514';end if;
 if original is null then raise exception 'Eigene unveränderte Originalquittung fehlt.' using errcode='P0V01';end if;
 if vital_workspace.vital_client_active(client) is not true then
  raise exception 'Die Messung gehört zu keinem aktiven Pflegefall.' using errcode='42501';
 end if;
 perform 1 from public.vital_sign_measurements m
 where m.id=measurement and m.tenant_id=tenant and m.client_id=client for share;
 if not found then raise exception 'Die Messung konnte nicht bestätigt werden.' using errcode='P0V01'; end if;
 return original;
end$$;

create or replace function public.confirm_ambulatory_vital_measurement(measurement_id uuid,request_id uuid,payload jsonb) returns jsonb language sql security invoker set search_path='' as $$select vital_workspace.confirm_vital_native_write('measurement',measurement_id,request_id,payload)$$;

create or replace function public.confirm_ambulatory_vital_follow_up(follow_up_id uuid,request_id uuid,payload jsonb) returns jsonb language sql security invoker set search_path='' as $$select vital_workspace.confirm_vital_native_write('follow_up',follow_up_id,request_id,payload)$$;

create or replace function public.confirm_ambulatory_vital_invalidation(invalidation_id uuid,request_id uuid,payload jsonb) returns jsonb language sql security invoker set search_path='' as $$select vital_workspace.confirm_vital_native_write('invalidation',invalidation_id,request_id,payload)$$;

create or replace function vital_workspace.stamp_configuration()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := clock_timestamp();
  if tg_table_name = 'client_vital_sign_settings' then
    new.revision := old.revision + 1;
    -- Legacy administration edits may change a configuration without an approval.
    if new.limits is distinct from old.limits or new.schedule is distinct from old.schedule
      or new.enabled is distinct from old.enabled or new.active is distinct from old.active then
      new.source_kind := null;
      new.approved_by := null;
      new.valid_from := null;
      new.valid_to := null;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists vital_workspace_catalog_version on public.vital_sign_catalog;
create trigger vital_workspace_catalog_version before update on public.vital_sign_catalog
  for each row execute function vital_workspace.stamp_configuration();
drop trigger if exists vital_workspace_settings_version on public.client_vital_sign_settings;
create trigger vital_workspace_settings_version before update on public.client_vital_sign_settings
  for each row execute function vital_workspace.stamp_configuration();

create or replace function vital_workspace.keep_original()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'vital_sign_measurements' then
    if old.creation_request_id is null then
      if tg_op = 'DELETE' then return old; end if;
      return new;
    end if;
  end if;
  raise exception 'Das gespeicherte Original bleibt erhalten. Verwenden Sie einen Korrekturvermerk.' using errcode = '42501';
end $$;

drop trigger if exists vital_workspace_measurement_immutable on public.vital_sign_measurements;
create trigger vital_workspace_measurement_immutable before update or delete on public.vital_sign_measurements
  for each row execute function vital_workspace.keep_original();
drop trigger if exists vital_workspace_follow_up_immutable on public.vital_measurement_follow_ups;
create trigger vital_workspace_follow_up_immutable before update or delete on public.vital_measurement_follow_ups
  for each row execute function vital_workspace.keep_original();
drop trigger if exists vital_workspace_invalidation_immutable on public.vital_measurement_invalidations;
create trigger vital_workspace_invalidation_immutable before update or delete on public.vital_measurement_invalidations
  for each row execute function vital_workspace.keep_original();

alter table public.vital_sign_catalog enable row level security;
alter table public.client_vital_sign_settings enable row level security;
alter table public.vital_sign_measurements enable row level security;
alter table public.vital_measurement_follow_ups enable row level security;
alter table public.vital_measurement_invalidations enable row level security;

-- Keep the existing legacy policies. Add a case-scoped read path for Pflege staff.
-- Application clients only SELECT the originals. All clinical writes use the RPCs.
drop policy if exists vital_workspace_catalog_read on public.vital_sign_catalog;
create policy vital_workspace_catalog_read on public.vital_sign_catalog for select to authenticated
  using (is_active and (select vital_workspace.can_view_catalog()));
drop policy if exists vital_workspace_settings_read on public.client_vital_sign_settings;
create policy vital_workspace_settings_read on public.client_vital_sign_settings for select to authenticated
  using (vital_workspace.can_read_case(tenant_id, client_id));
drop policy if exists vital_workspace_measurements_read on public.vital_sign_measurements;
create policy vital_workspace_measurements_read on public.vital_sign_measurements for select to authenticated
  using (vital_workspace.can_read_case(tenant_id, client_id));
drop policy if exists vital_workspace_follow_ups_read on public.vital_measurement_follow_ups;
create policy vital_workspace_follow_ups_read on public.vital_measurement_follow_ups for select to authenticated
  using (vital_workspace.can_read_case(tenant_id, client_id)
    and exists (select 1 from public.vital_sign_measurements m where m.id = measurement_id
      and m.tenant_id = vital_measurement_follow_ups.tenant_id and m.client_id = vital_measurement_follow_ups.client_id));
drop policy if exists vital_workspace_invalidations_read on public.vital_measurement_invalidations;
create policy vital_workspace_invalidations_read on public.vital_measurement_invalidations for select to authenticated
  using (vital_workspace.can_read_case(tenant_id, client_id)
    and exists (select 1 from public.vital_sign_measurements m where m.id = measurement_id
      and m.tenant_id = vital_measurement_invalidations.tenant_id and m.client_id = vital_measurement_invalidations.client_id));
grant select on public.vital_sign_catalog, public.client_vital_sign_settings, public.vital_sign_measurements,
  public.vital_measurement_follow_ups, public.vital_measurement_invalidations to authenticated;

revoke all on all functions in schema vital_workspace from public, anon, authenticated, service_role;
grant execute on function vital_workspace.can_read_case(uuid, uuid), vital_workspace.can_view_catalog(),
  vital_workspace.list_cases(uuid, integer), vital_workspace.case_identity(uuid),
  vital_workspace.record_vital_measurement(uuid, jsonb), vital_workspace.record_vital_follow_up(uuid, jsonb),
  vital_workspace.invalidate_vital_measurement(uuid, jsonb), vital_workspace.confirm_vital_native_write(text, uuid, uuid, jsonb)
  to authenticated;

revoke all on function public.list_ambulatory_vital_cases(uuid, integer), public.get_ambulatory_vital_case(uuid),
  public.record_ambulatory_vital_measurement(uuid, jsonb), public.confirm_ambulatory_vital_measurement(uuid, uuid, jsonb),
  public.record_ambulatory_vital_follow_up(uuid, jsonb), public.confirm_ambulatory_vital_follow_up(uuid, uuid, jsonb),
  public.invalidate_ambulatory_vital_measurement(uuid, jsonb), public.confirm_ambulatory_vital_invalidation(uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.list_ambulatory_vital_cases(uuid, integer), public.get_ambulatory_vital_case(uuid),
  public.record_ambulatory_vital_measurement(uuid, jsonb), public.confirm_ambulatory_vital_measurement(uuid, uuid, jsonb),
  public.record_ambulatory_vital_follow_up(uuid, jsonb), public.confirm_ambulatory_vital_follow_up(uuid, uuid, jsonb),
  public.invalidate_ambulatory_vital_measurement(uuid, jsonb), public.confirm_ambulatory_vital_invalidation(uuid, uuid, jsonb)
  to authenticated;

notify pgrst, 'reload schema';
