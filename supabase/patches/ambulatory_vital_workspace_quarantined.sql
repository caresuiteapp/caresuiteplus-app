-- Grounded Staging preparation against audited native schema, 2026-10-22.
-- No catalog seeds, clinical limits, role grants, execution grants, or production activation.
-- Existing shared/native Android writers and historical measured_at remain unchanged.
begin;
do $$begin if exists(select 1 from (values('anon'),('authenticated'),('service_role')) role_name(name) where has_table_privilege(role_name.name,'public.vital_sign_measurements','SELECT,INSERT,UPDATE,DELETE')) then raise exception 'Vorhandene native Vitaldatenrechte zuerst gesondert prüfen; dieses Paket aktiviert oder verändert keinen laufenden Altzugriff.' using errcode='42501';end if;end$$;
create schema if not exists care_private;
create table if not exists public.vital_sign_catalog(
 key text primary key,category text not null check(category in('basis','koerper','pflege','haemodynamik','beatmung','blutgas')),
 label text not null,short_label text not null,default_unit text not null,
 components jsonb not null check(jsonb_typeof(components)='array' and jsonb_array_length(components)>0),
 default_enabled boolean not null,is_active boolean not null,sort_order integer not null default 0,
 created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp()
);
create table if not exists public.client_vital_sign_settings(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),client_id uuid not null references public.clients(id),
 vital_key text not null references public.vital_sign_catalog(key),enabled boolean not null,limits jsonb not null check(jsonb_typeof(limits)='object'),schedule jsonb not null check(jsonb_typeof(schedule)='object'),
 created_by uuid not null references public.profiles(id),updated_by uuid not null references public.profiles(id),
 source_kind text check(source_kind in('physician_order','care_plan','individual_configuration')),approved_by uuid references public.profiles(id),
 valid_from timestamptz,valid_to timestamptz,active boolean not null,revision integer not null check(revision>0),
 created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),
 unique(tenant_id,client_id,vital_key),check(valid_to is null or valid_from is not null and valid_to>=valid_from)
);
create table if not exists public.vital_sign_events(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),client_id uuid not null references public.clients(id),
 measurement_id uuid not null references public.vital_sign_measurements(id) on delete restrict,event_type text not null default 'vital.out_of_range',
 summary text not null,payload jsonb not null,created_by uuid not null references public.profiles(id),created_at timestamptz not null default clock_timestamp(),unique(measurement_id,event_type)
);
-- Own profile role only, fresh actual auth session. No linked other-profile permissions.
create or replace function care_private.vital_actor(permission_name text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.resolve_current_profile_id();tenant uuid:=public.current_tenant_id();own_role uuid;
begin
 perform care_private.require_workspace_session(tenant,actor);
 if permission_name not in('pflege.vitals.view','pflege.vitals.manage','pflege.documentation.sign') then raise exception 'Unbekanntes Vitalrecht.' using errcode='42501';end if;
 select p.role_id into own_role from public.profiles p where p.id=actor and p.tenant_id=tenant and p.is_active and p.status='active' for share;
 perform 1 from public.role_permissions rp where rp.role_id=own_role for share;
 if not exists(select 1 from public.role_permissions rp where rp.role_id=own_role and (rp.permission_key=permission_name or (rp.permission_key='vitals' and ((permission_name='pflege.vitals.view' and coalesce(rp.can_view,false)) or(permission_name='pflege.vitals.manage' and coalesce(rp.can_update,false)))))) then raise exception 'Aktuelles eigenes Vitalrecht fehlt.' using errcode='42501';end if;
 return actor;
end$$;
create or replace function care_private.vital_client_active(p_client uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare tenant uuid:=public.current_tenant_id();actor uuid:=care_private.vital_actor('pflege.vitals.view');
begin
 perform 1 from public.clients c where c.id=p_client and c.tenant_id=tenant and c.status in('active','aktiv') and c.lifecycle_status in('active','aktiv') and c.deleted_at is null and c.archived_at is null for share;
 if not found then return false;end if;
 perform 1 from public.client_module_assignments a where a.tenant_id=tenant and a.client_id=p_client and a.module_key='pflege' and a.is_active and a.status in('active','aktiv') for share;
 return found;
end$$;

-- Prepared implementation from ambulatory_vital_documentation.sql; grants/policies intentionally removed.
-- LOCAL REVIEW ONLY. Requires existing vital_signs_live_final schema.
-- No production application. Existing native RPC remains unchanged.
create schema if not exists care_private;
revoke all on schema care_private from public,anon;
alter table public.vital_sign_measurements
 add column if not exists occurred_at timestamptz,
 add column if not exists creation_request_id uuid,
 add column if not exists creation_payload jsonb,
 add column if not exists catalog_snapshot jsonb,
 add column if not exists configuration_snapshot jsonb;
-- Historical measured_at values may be capture times; no invented actual-time backfill.
create unique index if not exists vital_measurement_request on public.vital_sign_measurements(tenant_id,creation_request_id) where creation_request_id is not null;

create or replace function care_private.record_vital_measurement(request_id uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=care_private.assert_vital_actor('pflege.vitals.manage'); tenant uuid:=public.current_tenant_id();
 subject uuid; kind text; occurred timestamptz; previous public.vital_sign_measurements%rowtype;
 catalog public.vital_sign_catalog%rowtype; setting public.client_vital_sign_settings%rowtype;
 vals jsonb; ctx jsonb; item record; required text[]; component text; number_value numeric; lo numeric; hi numeric;
 full_limits boolean:=true; flag text:='unrated'; display text; actor_name text; result_id uuid;
begin
 perform care_private.assert_vital_actor('pflege.vitals.view');
 if request_id is null or jsonb_typeof(payload) is distinct from 'object' or length(payload::text)>20000 then raise exception 'Ungültige Anfrage.' using errcode='23514';end if;
 if not care_private.vital_keys(payload,array['clientId','type','occurredAt','valuesJson','contextJson','note','catalogVersion','configurationVersion']) or not care_private.vital_uuid(payload->'clientId') or not care_private.vital_text(payload->'type',1,100) or not care_private.vital_text(payload->'valuesJson',1,4096) or not care_private.vital_text(payload->'contextJson',1,8192) or not care_private.vital_text(payload->'note',0,4000) or not care_private.vital_text(payload->'catalogVersion',1,100) or not care_private.vital_text(payload->'configurationVersion',1,100) then raise exception 'Vollständiger ursprünglicher Messauftrag fehlt.' using errcode='23514';end if;
 subject:=(payload->>'clientId')::uuid; kind:=payload->>'type';
 -- Serialize by client so concurrent exact retries cannot both insert.
 perform 1 from public.clients c where c.id=subject and c.tenant_id=tenant for update;
 if not found or care_private.vital_client_active(subject) is not true then raise exception 'Kein aktiver zugänglicher Pflegefall.' using errcode='42501';end if;
 select * into previous from public.vital_sign_measurements v where v.tenant_id=tenant and v.creation_request_id=request_id;
 if previous.id is not null then
  if previous.client_id<>subject or previous.recorded_by<>actor or previous.creation_payload<>payload then raise exception 'Anfrage mit anderen Daten verwendet.' using errcode='23514';end if;
  return previous.id;
 end if;
 select * into catalog from public.vital_sign_catalog c where c.key=kind and c.is_active for share;
 if catalog.key is null or (payload->>'catalogVersion')::timestamptz is distinct from catalog.updated_at then raise exception 'Messkatalog geändert. Neu laden.' using errcode='40001';end if;
 select * into setting from public.client_vital_sign_settings s where s.tenant_id=tenant and s.client_id=subject and s.vital_key=kind for share;
 if (setting.id is null and payload->>'configurationVersion' is distinct from 'none') or (setting.id is not null and (payload->>'configurationVersion')::timestamptz is distinct from setting.updated_at) then raise exception 'Messkonfiguration geändert. Neu laden.' using errcode='40001';end if;
 if coalesce(setting.enabled,catalog.default_enabled) is not true then raise exception 'Messart ist deaktiviert.' using errcode='23514';end if;
 if coalesce(payload->>'occurredAt','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.][0-9]{1,3})?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$' then raise exception 'Tatsächlicher Messzeitpunkt mit Zeitzone fehlt.' using errcode='23514';end if;
 occurred:=care_private.vital_time(payload->'occurredAt');
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
 if kind='fluid_balance' and ((vals->>'intake')::numeric<0 or (vals->>'output')::numeric<0 or (vals->>'balance')::numeric<>(vals->>'intake')::numeric-(vals->>'output')::numeric) then raise exception 'Flüssigkeitsbilanz prüfen.' using errcode='23514';end if;
 -- Invalid/partial limits never silently mean a fully assessed normal measurement.
 for item in select key,value from jsonb_each(vals) loop
  if setting.limits->item.key is null or jsonb_typeof(setting.limits->item.key)<>'object' or not ((setting.limits->item.key)?'min' or (setting.limits->item.key)?'max') then full_limits:=false;continue;end if;
  if ((setting.limits->item.key)?'min' and jsonb_typeof(setting.limits->item.key->'min')<>'number') or ((setting.limits->item.key)?'max' and jsonb_typeof(setting.limits->item.key->'max')<>'number') then raise exception 'Konfigurierte Grenzen sind ungültig.' using errcode='23514';end if;
  lo:=(setting.limits->item.key->>'min')::numeric;hi:=(setting.limits->item.key->>'max')::numeric;
  if lo>hi then raise exception 'Grenzen sind vertauscht.' using errcode='23514';end if;
  number_value:=item.value::text::numeric;
  if number_value<lo or number_value>hi then flag:='outside_configured_range';end if;
 end loop;
 if flag<>'outside_configured_range' and full_limits then flag:='within_configured_range';end if;
 if setting.id is null or setting.active is not true or setting.source_kind is null or setting.valid_from is null or setting.valid_from>occurred or setting.valid_to<occurred or not exists(select 1 from public.profiles a where a.id=setting.approved_by and a.tenant_id=tenant and a.is_active and a.status='active') then flag:='unrated';else flag:=care_private.vital_assess_limits(vals,setting.limits);end if;
 display:=case when kind in ('blood_pressure','arterial_pressure') then (vals->>'systolic')||'/'||(vals->>'diastolic') when kind='gcs' then 'GCS '||(vals->>'total')||' (E'||(vals->>'eyes')||' V'||(vals->>'verbal')||' M'||(vals->>'motor')||')' when kind='fluid_balance' then vals->>'balance' when kind='pupils' then 'L '||(vals->>'leftSize')||' / R '||(vals->>'rightSize') else vals->>'value' end;
 select coalesce(nullif(p.display_name,''),p.email,'Pflegekraft') into actor_name from public.profiles p where p.id=actor and p.tenant_id=tenant and p.is_active;
 insert into public.vital_sign_measurements(tenant_id,client_id,vital_key,values,display_value,unit,context,note,source,flag_status,recorded_by,recorded_by_name,occurred_at,creation_request_id,creation_payload,catalog_snapshot,configuration_snapshot)
 values(tenant,subject,kind,vals,display,catalog.default_unit,ctx,nullif(btrim(payload->>'note'),''),'manual',flag,actor,actor_name,occurred,request_id,payload,to_jsonb(catalog),case when setting.id is null then jsonb_build_object('enabled',catalog.default_enabled,'limits','{}'::jsonb,'version','none') else to_jsonb(setting)-'created_by'-'updated_by' end) returning id into result_id;
 insert into public.client_timeline_events(tenant_id,client_id,event_type,icon,title,subtitle,status,actor_name,is_internal,metadata)
 values(tenant,subject,'pflegeplan','💓',catalog.label||' erfasst',display||' '||catalog.default_unit,case when flag='outside_configured_range' then 'fehlerhaft' else 'aktiv' end,actor_name,true,jsonb_build_object('measurementId',result_id,'occurredAt',occurred,'flagStatus',flag));
 if flag='outside_configured_range' then
  insert into public.vital_sign_events(tenant_id,client_id,measurement_id,summary,payload,created_by)
  values(tenant,subject,result_id,catalog.label||': außerhalb konfigurierter Grenzen',jsonb_build_object('values',vals,'limits',setting.limits,'requiresProfessionalReview',true),actor);
 end if;
 return result_id;
end $$;
create or replace function public.record_ambulatory_vital_measurement(request_id uuid,payload jsonb)
returns uuid language sql security invoker set search_path='' as $$select care_private.record_vital_measurement(request_id,payload)$$;
revoke all on function care_private.record_vital_measurement(uuid,jsonb),public.record_ambulatory_vital_measurement(uuid,jsonb) from public,anon;
create table if not exists public.vital_measurement_follow_ups(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),
 client_id uuid not null references public.clients(id),measurement_id uuid not null references public.vital_sign_measurements(id) on delete restrict,
 request_id uuid not null,creation_payload jsonb not null,observed_at timestamptz not null,
 observation text not null check(length(btrim(observation))>0 and length(observation)<=2000),
 action text not null check(length(btrim(action))>0 and length(action)<=2000),
 responsible_person text not null check(length(btrim(responsible_person))>0 and length(responsible_person)<=200),
 outcome text not null check(outcome in ('ongoing','resolved')),next_review_at timestamptz,
 recorded_by uuid not null references public.profiles(id),recorded_by_name text not null,created_at timestamptz not null default clock_timestamp(),
 unique(tenant_id,request_id),check((outcome='ongoing' and next_review_at is not null and next_review_at>observed_at) or (outcome='resolved' and next_review_at is null))
);
alter table public.vital_measurement_follow_ups enable row level security;
revoke all on public.vital_measurement_follow_ups from authenticated,anon;
drop policy if exists vital_follow_ups_read on public.vital_measurement_follow_ups;
create or replace function care_private.record_vital_follow_up(request_id uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=care_private.assert_vital_actor('pflege.vitals.manage');tenant uuid:=public.current_tenant_id();m public.vital_sign_measurements%rowtype;previous public.vital_measurement_follow_ups%rowtype;observed timestamptz;next_review timestamptz;actor_name text;result_id uuid;
begin
 perform care_private.assert_vital_actor('pflege.vitals.view');
 if request_id is null or jsonb_typeof(payload) is distinct from 'object' or length(payload::text)>12000 then raise exception 'Ungültige Anfrage.' using errcode='23514';end if;
 if not care_private.vital_keys(payload,array['measurementId','observedAt','observation','action','responsiblePerson','outcome','nextReviewAt']) or not care_private.vital_uuid(payload->'measurementId') or not care_private.vital_text(payload->'observation',1,2000) or not care_private.vital_text(payload->'action',1,2000) or not care_private.vital_text(payload->'responsiblePerson',1,200) or not care_private.vital_text(payload->'outcome',1,40) or not care_private.vital_text(payload->'nextReviewAt',0,100) then raise exception 'Vollständiger tatsächlicher Kontrollauftrag fehlt.' using errcode='23514';end if;
 select * into m from public.vital_sign_measurements v where v.id=(payload->>'measurementId')::uuid and v.tenant_id=tenant for update;
 if m.id is null or care_private.vital_client_active(m.client_id) is not true then raise exception 'Messung nicht zugänglich.' using errcode='42501';end if;
 select * into previous from public.vital_measurement_follow_ups f where f.tenant_id=tenant and f.request_id=record_vital_follow_up.request_id;
 if previous.id is not null then
  if previous.measurement_id<>m.id or previous.recorded_by<>actor or previous.creation_payload<>payload then raise exception 'Anfrage mit anderen Daten verwendet.' using errcode='23514';end if;return previous.id;
 end if;
 if coalesce(payload->>'observedAt','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.][0-9]{1,3})?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$' then raise exception 'Kontrollzeit mit Zeitzone fehlt.' using errcode='23514';end if;
 if m.occurred_at is null or exists(select 1 from public.vital_measurement_invalidations i where i.measurement_id=m.id) then raise exception 'Unverändertes gültiges Messoriginal mit tatsächlichem Zeitpunkt fehlt.' using errcode='23514';end if;
 observed:=care_private.vital_time(payload->'observedAt');
 if observed>clock_timestamp() or (m.occurred_at is not null and observed<m.occurred_at) then raise exception 'Kontrollzeitpunkt prüfen.' using errcode='23514';end if;
 if payload->>'outcome'='ongoing' then
  if coalesce(payload->>'nextReviewAt','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.][0-9]{1,3})?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$' then raise exception 'Nächster Kontrolltermin fehlt.' using errcode='23514';end if;
  next_review:=care_private.vital_time(payload->'nextReviewAt');if next_review<=observed then raise exception 'Kontrolltermin muss nach Beobachtung liegen.' using errcode='23514';end if;
 elsif payload->>'outcome'='resolved' and coalesce(payload->>'nextReviewAt','')='' then next_review:=null;
 else raise exception 'Ergebnis und Kontrollbedarf prüfen.' using errcode='23514';end if;
 select coalesce(nullif(p.display_name,''),p.email,'Pflegekraft') into actor_name from public.profiles p where p.id=actor and p.tenant_id=tenant and p.is_active;
 insert into public.vital_measurement_follow_ups(tenant_id,client_id,measurement_id,request_id,creation_payload,observed_at,observation,action,responsible_person,outcome,next_review_at,recorded_by,recorded_by_name)
 values(tenant,m.client_id,m.id,request_id,payload,observed,btrim(payload->>'observation'),btrim(payload->>'action'),btrim(payload->>'responsiblePerson'),payload->>'outcome',next_review,actor,actor_name) returning id into result_id;
 return result_id;
end $$;
create or replace function public.record_ambulatory_vital_follow_up(request_id uuid,payload jsonb)
returns uuid language sql security invoker set search_path='' as $$select care_private.record_vital_follow_up(request_id,payload)$$;
revoke all on function care_private.record_vital_follow_up(uuid,jsonb),public.record_ambulatory_vital_follow_up(uuid,jsonb) from public,anon;

-- Prepared implementation from ambulatory_vital_invalidations.sql; grants/policies intentionally removed.
-- LOCAL REVIEW ONLY. Apply after ambulatory_vital_documentation.sql.
-- Invalidates a documented measurement; never overwrites its original values.
create table if not exists public.vital_measurement_invalidations(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),
 client_id uuid not null references public.clients(id),measurement_id uuid not null references public.vital_sign_measurements(id) on delete restrict,
 request_id uuid not null,creation_payload jsonb not null,
 reason text not null check(length(btrim(reason))>0 and length(reason)<=2000),
 recorded_by uuid not null references public.profiles(id),recorded_by_name text not null,
 created_at timestamptz not null default clock_timestamp(),
 unique(tenant_id,request_id),unique(measurement_id)
);
alter table public.vital_measurement_invalidations enable row level security;
revoke all on public.vital_measurement_invalidations from public,anon,authenticated;
drop policy if exists vital_invalidations_read on public.vital_measurement_invalidations;
create index if not exists vital_invalidations_history on public.vital_measurement_invalidations(tenant_id,client_id,created_at desc,id desc);
create or replace function care_private.invalidate_vital_measurement(request_id uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=care_private.assert_vital_actor('pflege.vitals.manage');tenant uuid:=public.current_tenant_id();
 m public.vital_sign_measurements%rowtype;previous public.vital_measurement_invalidations%rowtype;actor_name text;result_id uuid;
begin
 perform care_private.assert_vital_actor('pflege.vitals.view');
 if request_id is null or jsonb_typeof(payload) is distinct from 'object' or length(payload::text)>16000
 or (payload-array['measurementId','reason'])<>'{}'::jsonb or jsonb_typeof(payload->'measurementId') is distinct from 'string'
 or jsonb_typeof(payload->'reason') is distinct from 'string' then raise exception 'Ungültiger Korrekturvermerk.' using errcode='23514';end if;
 select * into m from public.vital_sign_measurements v where v.id=(payload->>'measurementId')::uuid and v.tenant_id=tenant for update;
 if m.id is null or care_private.vital_client_active(m.client_id) is not true then raise exception 'Messung nicht zugänglich.' using errcode='42501';end if;
 select * into previous from public.vital_measurement_invalidations i where i.tenant_id=tenant and i.request_id=invalidate_vital_measurement.request_id;
 if previous.id is not null then
  if previous.measurement_id<>m.id or previous.recorded_by<>actor or previous.creation_payload<>payload then raise exception 'Anfrage mit anderen Daten verwendet.' using errcode='23514';end if;
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
create or replace function public.invalidate_ambulatory_vital_measurement(request_id uuid,payload jsonb)
returns uuid language sql security invoker set search_path='' as $$select care_private.invalidate_vital_measurement(request_id,payload)$$;
revoke all on function care_private.invalidate_vital_measurement(uuid,jsonb),public.invalidate_ambulatory_vital_measurement(uuid,jsonb) from public,anon;

-- Prepared implementation from ambulatory_vital_care_path_packet.sql; grants/policies intentionally removed.
-- PREPARED CONTRACT ONLY. DO NOT APPLY TO PRODUCTION FROM THIS CHECKPOINT.
-- Requires ambulatory_vital_documentation.sql and ambulatory_vital_invalidations.sql.
create schema if not exists care_private;
revoke all on schema care_private from public,anon;
alter table public.client_vital_sign_settings
 add column if not exists source_kind text not null default 'individual_configuration' check(source_kind in ('physician_order','care_plan','individual_configuration')),
 add column if not exists approved_by uuid references public.profiles(id),
 add column if not exists valid_from timestamptz not null default clock_timestamp(),
 add column if not exists valid_to timestamptz,
 add column if not exists active boolean not null default true,
 add column if not exists revision integer not null default 1 check(revision>0);

create table if not exists public.vital_measurement_devices(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),client_id uuid references public.clients(id),
 name text not null,serial_number text,method text not null,active boolean not null default true,revision integer not null default 1 check(revision>0),
 recorded_by uuid not null references public.profiles(id),created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp()
);
create table if not exists public.vital_device_calibrations(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),device_id uuid not null references public.vital_measurement_devices(id) on delete restrict,
 status text not null check(status in ('valid','limited','expired','unknown')),performed_at timestamptz not null,valid_until timestamptz,limitation text,
 revision integer not null default 1 check(revision>0),recorded_by uuid not null references public.profiles(id),created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp()
);
create table if not exists public.vital_care_paths(
 id uuid primary key,tenant_id uuid not null references public.tenants(id),client_id uuid not null references public.clients(id),measurement_id uuid not null references public.vital_sign_measurements(id) on delete restrict,
 root_id uuid not null,previous_id uuid references public.vital_care_paths(id) on delete restrict,revision integer not null check(revision>0),kind text not null check(kind in ('measurement_review','anomaly_response','control_review','case_resolution','correction')),
 payload jsonb not null,reason text not null default '',recorded_by uuid not null references public.profiles(id),recorded_by_name text not null,recorded_at timestamptz not null default clock_timestamp(),content_fingerprint text not null,
 unique(root_id,revision)
);
create index if not exists vital_care_path_page on public.vital_care_paths(tenant_id,client_id,measurement_id,recorded_at desc,id desc);

create table if not exists care_private.vital_care_path_receipts(
 tenant_id uuid not null,request_id uuid not null,client_id uuid not null,measurement_id uuid not null,actor_id uuid not null,packet jsonb not null,path_id uuid not null references public.vital_care_paths(id),created_at timestamptz not null default clock_timestamp(),primary key(tenant_id,request_id)
);
create or replace function care_private.reject_vital_care_original_change()
returns trigger language plpgsql security definer set search_path='' as $$begin raise exception 'Vitalpfad-Originale und Quittungen sind append-only.' using errcode='42501';end$$;
revoke all on function care_private.reject_vital_care_original_change() from public,anon,authenticated;
drop trigger if exists protect_vital_care_path_original on public.vital_care_paths;
create trigger protect_vital_care_path_original before update or delete on public.vital_care_paths for each row execute function care_private.reject_vital_care_original_change();
drop trigger if exists protect_vital_care_receipt_original on care_private.vital_care_path_receipts;
create trigger protect_vital_care_receipt_original before update or delete on care_private.vital_care_path_receipts for each row execute function care_private.reject_vital_care_original_change();
alter table public.vital_measurement_devices enable row level security;
alter table public.vital_device_calibrations enable row level security;
alter table public.vital_care_paths enable row level security;
alter table care_private.vital_care_path_receipts enable row level security;
revoke all on public.vital_measurement_devices,public.vital_device_calibrations,public.vital_care_paths,care_private.vital_care_path_receipts from public,anon,authenticated;
drop policy if exists vital_devices_read on public.vital_measurement_devices;
drop policy if exists vital_calibrations_read on public.vital_device_calibrations;
drop policy if exists vital_care_paths_read on public.vital_care_paths;


create or replace function care_private.vital_ref(p_id uuid,p_revision integer,p_recorded timestamptz,p_tenant uuid,p_client uuid,p_measurement uuid,p_payload jsonb)
returns jsonb language sql immutable strict set search_path='' as $$select jsonb_build_object('id',p_id,'revision',p_revision,'recordedAt',to_char(p_recorded at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'fingerprint','sha256:'||encode(extensions.digest(convert_to(p_payload::text,'UTF8'),'sha256'),'hex'),'tenantId',p_tenant,'clientId',p_client,'measurementId',p_measurement,'payload',p_payload)$$;
revoke all on function care_private.vital_ref(uuid,integer,timestamptz,uuid,uuid,uuid,jsonb) from public,anon,authenticated;

create or replace function care_private.vital_path_original(p_path uuid)
returns jsonb language sql security definer set search_path='' as $$
with selected as(select * from public.vital_care_paths where id=p_path),root as(select s.* from selected s),history as(
 select h.* from public.vital_care_paths h join root r on r.root_id=h.root_id where h.revision<=r.revision order by h.revision
),items as(select jsonb_agg(jsonb_build_object('id',id,'revision',revision,'previousId',previous_id,'recordedAt',to_char(recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'recordedBy',recorded_by,'recordedByName',recorded_by_name,'reason',reason,'payload',payload,'contentFingerprint',content_fingerprint) order by revision) value from history)
select jsonb_build_object('id',r.id,'tenantId',r.tenant_id,'clientId',r.client_id,'measurementId',r.measurement_id,'rootId',r.root_id,'headId',r.id,'revision',r.revision,'kind',r.kind,'recordedAt',to_char(r.recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'recordedBy',r.recorded_by,'recordedByName',r.recorded_by_name,'payload',r.payload,'contentFingerprint',r.content_fingerprint,'history',i.value) from root r cross join items i$$;
revoke all on function care_private.vital_path_original(uuid) from public,anon,authenticated;

create or replace function care_private.read_vital_care_path_context(p_tenant_id uuid,p_client_id uuid,p_measurement_id uuid,p_actor_profile_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.vital_sign_measurements%rowtype;result jsonb;
begin
 perform care_private.lock_vital_measurement_scope(p_tenant_id,p_client_id,p_measurement_id,p_actor_profile_id,false);
 lock table public.client_vital_sign_settings,public.vital_measurement_devices,public.vital_device_calibrations,public.vital_measurement_follow_ups,public.vital_measurement_invalidations,public.vital_sign_events,public.vital_care_paths in share row exclusive mode;
 perform 1 from public.profiles p where p.tenant_id=p_tenant_id and p.is_active and p.status='active' for share;
 select * into m from public.vital_sign_measurements x where x.id=p_measurement_id and x.tenant_id=p_tenant_id and x.client_id=p_client_id;
 if m.id is null or care_private.vital_client_active(p_client_id) is not true then raise exception 'Messung oder aktiver Pflegefall fehlt.' using errcode='42501';end if;
 select jsonb_build_object(
 'measurements',jsonb_build_array(care_private.vital_ref(m.id,1,m.created_at,p_tenant_id,p_client_id,m.id,to_jsonb(m))),
 'settings',coalesce((select jsonb_agg(care_private.vital_ref(s.id,s.revision,s.updated_at,p_tenant_id,p_client_id,m.id,to_jsonb(s)-'tenant_id'-'client_id') order by s.updated_at,s.id) from public.client_vital_sign_settings s where s.tenant_id=p_tenant_id and s.client_id=p_client_id and s.vital_key=m.vital_key),'[]'::jsonb),
 'devices',coalesce((select jsonb_agg(care_private.vital_ref(d.id,d.revision,d.updated_at,p_tenant_id,p_client_id,m.id,to_jsonb(d)-'tenant_id'-'client_id') order by d.updated_at,d.id) from public.vital_measurement_devices d where d.tenant_id=p_tenant_id and d.active and (d.client_id is null or d.client_id=p_client_id)),'[]'::jsonb),
 'calibrations',coalesce((select jsonb_agg(care_private.vital_ref(c.id,c.revision,c.updated_at,p_tenant_id,p_client_id,m.id,to_jsonb(c)-'tenant_id') order by c.updated_at,c.id) from public.vital_device_calibrations c join public.vital_measurement_devices d on d.id=c.device_id where c.tenant_id=p_tenant_id and d.tenant_id=p_tenant_id and (d.client_id is null or d.client_id=p_client_id)),'[]'::jsonb),
 'followUps',coalesce((select jsonb_agg(care_private.vital_ref(f.id,1,f.created_at,p_tenant_id,p_client_id,m.id,to_jsonb(f)-'tenant_id'-'client_id'-'measurement_id') order by f.created_at,f.id) from public.vital_measurement_follow_ups f where f.tenant_id=p_tenant_id and f.client_id=p_client_id and f.measurement_id=m.id),'[]'::jsonb),
 'invalidations',coalesce((select jsonb_agg(care_private.vital_ref(i.id,1,i.created_at,p_tenant_id,p_client_id,m.id,to_jsonb(i)-'tenant_id'-'client_id'-'measurement_id') order by i.created_at,i.id) from public.vital_measurement_invalidations i where i.tenant_id=p_tenant_id and i.client_id=p_client_id and i.measurement_id=m.id),'[]'::jsonb),
 'events',coalesce((select jsonb_agg(care_private.vital_ref(e.id,1,e.created_at,p_tenant_id,p_client_id,m.id,to_jsonb(e)-'tenant_id'-'client_id'-'measurement_id') order by e.created_at,e.id) from public.vital_sign_events e where e.tenant_id=p_tenant_id and e.client_id=p_client_id and e.measurement_id=m.id),'[]'::jsonb),
 'people',coalesce((select jsonb_agg(care_private.vital_ref(p.id,1,coalesce(p.updated_at,p.created_at),p_tenant_id,p_client_id,m.id,jsonb_build_object('display_name',coalesce(nullif(p.display_name,''),p.email),'active',p.is_active)) order by p.id) from public.profiles p where p.tenant_id=p_tenant_id and p.is_active and p.status='active'),'[]'::jsonb),
 'paths',coalesce((select jsonb_agg(care_private.vital_ref(v.id,v.revision,v.recorded_at,p_tenant_id,p_client_id,m.id,jsonb_build_object('title',v.payload->>'title','kind',v.kind,'control_state',v.payload#>>'{control,state}'))||jsonb_build_object('fingerprint',v.content_fingerprint) order by v.recorded_at,v.id) from public.vital_care_paths v where v.tenant_id=p_tenant_id and v.client_id=p_client_id and v.measurement_id=m.id),'[]'::jsonb)
 ) into result;
 return result;
end $$;
revoke all on function care_private.read_vital_care_path_context(uuid,uuid,uuid,uuid) from public,anon,authenticated;
create or replace function public.web_read_vital_care_path_context(p_tenant_id uuid,p_client_id uuid,p_measurement_id uuid,p_actor_profile_id uuid)
returns jsonb language sql security invoker set search_path='' as $$select care_private.read_vital_care_path_context(p_tenant_id,p_client_id,p_measurement_id,p_actor_profile_id)$$;
revoke all on function public.web_read_vital_care_path_context(uuid,uuid,uuid,uuid) from public,anon;
create or replace function care_private.read_vital_care_path_page(p_tenant_id uuid,p_client_id uuid,p_measurement_id uuid,p_actor_profile_id uuid,p_cursor_recorded_at timestamptz,p_cursor_id uuid,p_page_size integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare rows jsonb;last_at timestamptz;last_id uuid;
begin
 perform care_private.lock_vital_measurement_scope(p_tenant_id,p_client_id,p_measurement_id,p_actor_profile_id,false);if p_page_size is null or (p_cursor_recorded_at is null)<>(p_cursor_id is null) or p_page_size not between 1 and 100 or care_private.vital_client_active(p_client_id) is not true then raise exception 'Ungültige Verlaufsauswahl.' using errcode='42501';end if;
 with heads as(select distinct on(root_id) * from public.vital_care_paths where tenant_id=p_tenant_id and client_id=p_client_id and measurement_id=p_measurement_id order by root_id,revision desc),page as(select * from heads where p_cursor_recorded_at is null or (recorded_at,id)<(p_cursor_recorded_at,p_cursor_id) order by recorded_at desc,id desc limit p_page_size)
 select coalesce(jsonb_agg(care_private.vital_path_original(id) order by recorded_at desc,id desc),'[]'::jsonb),(array_agg(recorded_at order by recorded_at desc,id desc))[count(*)],(array_agg(id order by recorded_at desc,id desc))[count(*)] into rows,last_at,last_id from page;
 return jsonb_build_object('rows',rows,'nextCursorRecordedAt',case when last_at is null then null else to_char(last_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') end,'nextCursorId',last_id);
end $$;
revoke all on function care_private.read_vital_care_path_page(uuid,uuid,uuid,uuid,timestamptz,uuid,integer) from public,anon,authenticated;
create or replace function public.web_read_vital_care_path_page(p_tenant_id uuid,p_client_id uuid,p_measurement_id uuid,p_actor_profile_id uuid,p_cursor_recorded_at timestamptz,p_cursor_id uuid,p_page_size integer)
returns jsonb language sql security invoker set search_path='' as $$select care_private.read_vital_care_path_page(p_tenant_id,p_client_id,p_measurement_id,p_actor_profile_id,p_cursor_recorded_at,p_cursor_id,p_page_size)$$;
revoke all on function public.web_read_vital_care_path_page(uuid,uuid,uuid,uuid,timestamptz,uuid,integer) from public,anon;
create or replace function care_private.commit_vital_care_path_packet(p_packet jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare tenant uuid:=(p_packet->>'tenantId')::uuid;client uuid:=(p_packet->>'clientId')::uuid;measurement uuid:=(p_packet->>'measurementId')::uuid;actor uuid:=(p_packet->>'actorId')::uuid;request uuid:=(p_packet->>'requestId')::uuid;entry jsonb:=p_packet->'entry';prior care_private.vital_care_path_receipts%rowtype;head public.vital_care_paths%rowtype;m public.vital_sign_measurements%rowtype;next_id uuid:=gen_random_uuid();next_root uuid;next_revision integer;actor_name text;fingerprint text;current_sources jsonb;observed timestamptz;response_at timestamptz;control_due timestamptz;control_at timestamptz;approval_at timestamptz;configured_limit uuid;device uuid;calibration uuid;response_person uuid;control_person uuid;kind text;response_state text;control_state text;
begin
 if jsonb_typeof(p_packet) is distinct from 'object' or length(p_packet::text)>2000000 or p_packet->>'schemaVersion'<>'1' or p_packet->>'action' not in ('create','revise') then raise exception 'Ungültiges Vitalpfadpaket.' using errcode='23514';end if;
 perform care_private.assert_vital_path_actor(tenant,actor,true);perform care_private.validate_vital_path_packet(p_packet);perform pg_advisory_xact_lock(hashtextextended(tenant::text||':'||client::text||':'||measurement::text,0));
 select * into m from public.vital_sign_measurements x where x.id=measurement and x.tenant_id=tenant and x.client_id=client for update;if m.id is null or care_private.vital_client_active(client) is not true then raise exception 'Messung oder Pflegefall nicht zugänglich.' using errcode='42501';end if;
 select * into prior from care_private.vital_care_path_receipts r where r.tenant_id=tenant and r.request_id=request for update;
 if prior.request_id is not null then if prior.client_id<>client or prior.measurement_id<>measurement or prior.actor_id<>actor or prior.packet<>p_packet then raise exception 'Anfrage mit anderen Originalen verwendet.' using errcode='23514';end if;return jsonb_build_object('requestId',request,'packet',prior.packet,'original',care_private.vital_path_original(prior.path_id));end if;
 kind:=entry->>'kind';response_state:=entry#>>'{response,state}';control_state:=entry#>>'{control,state}';observed:=(entry->>'observedAt')::timestamptz;
 if entry->>'tenantId' is distinct from tenant::text or entry->>'clientId' is distinct from client::text or entry->>'measurementId' is distinct from measurement::text or coalesce(kind,'') not in ('measurement_review','anomaly_response','control_review','case_resolution','correction') or length(btrim(coalesce(entry->>'title',''))) not between 3 and 300 or length(btrim(coalesce(entry#>>'{interpretation,summary}','')))<3 then raise exception 'Vitalpfadidentität oder Einordnung fehlt.' using errcode='23514';end if;
 if observed is distinct from m.occurred_at or entry#>>'{interpretation,measurementType}' is distinct from m.vital_key or entry#>>'{interpretation,unit}' is distinct from m.unit or entry#>'{interpretation,values}' is distinct from m.values or entry#>'{interpretation,context}' is distinct from m.context then raise exception 'Messwert, Zeitpunkt, Einheit oder Messsituation weichen vom Original ab.' using errcode='23514';end if;
 if coalesce(entry#>>'{interpretation,state}','') not in ('unrated','within_configured_range','outside_configured_range','measurement_uncertain') then raise exception 'Fachliche Einordnung fehlt.' using errcode='23514';end if;
 if kind<>'correction' and exists(select 1 from public.vital_measurement_invalidations i where i.measurement_id=m.id) then raise exception 'Ungültige Messung benötigt einen ausdrücklichen Korrekturpfad.' using errcode='23514';end if;
 configured_limit:=nullif(entry#>>'{interpretation,configuredLimitId}','')::uuid;
 if configured_limit is not null and not exists(select 1 from public.client_vital_sign_settings s join public.profiles a on a.id=s.approved_by and a.tenant_id=tenant and a.is_active and a.status='active' where s.id=configured_limit and s.tenant_id=tenant and s.client_id=client and s.vital_key=m.vital_key and s.active and s.source_kind in ('physician_order','care_plan','individual_configuration') and s.valid_from<=observed and (s.valid_to is null or s.valid_to>=observed)) then raise exception 'Patientenspezifische Grenze ist nicht aktuell und verantwortlich freigegeben.' using errcode='23514';end if;
 if entry#>>'{interpretation,state}' in('within_configured_range','outside_configured_range') and (configured_limit is null or entry#>>'{interpretation,state}' is distinct from (select care_private.vital_assess_limits(m.values,s.limits) from public.client_vital_sign_settings s where s.id=configured_limit and s.tenant_id=tenant and s.client_id=client)) then raise exception 'Einordnung widerspricht den tatsächlichen Werten und individuell freigegebenen Grenzen.' using errcode='23514';end if;
 device:=nullif(entry#>>'{device,deviceId}','')::uuid;calibration:=nullif(entry#>>'{device,calibrationId}','')::uuid;
 if coalesce(entry#>>'{device,suitability}','') not in ('confirmed','limited','unknown','not_applicable') or (calibration is not null and device is null) or (device is not null and not exists(select 1 from public.vital_measurement_devices d where d.id=device and d.tenant_id=tenant and d.active and (d.client_id is null or d.client_id=client))) or (calibration is not null and not exists(select 1 from public.vital_device_calibrations c where c.id=calibration and c.tenant_id=tenant and c.device_id=device and c.status='valid' and c.performed_at<=observed and (c.valid_until is null or c.valid_until>=observed))) then raise exception 'Messgerät oder Kalibrierungsoriginal ist nicht aktuell gebunden.' using errcode='23514';end if;
 if (entry#>>'{device,suitability}'<>'not_applicable' and length(btrim(coalesce(entry#>>'{device,method}','')))<1) or (entry#>>'{device,suitability}' in ('limited','unknown') and length(btrim(coalesce(entry#>>'{device,limitation}','')))<3) then raise exception 'Messverfahren oder Einschränkung fehlt.' using errcode='23514';end if;
 if coalesce(response_state,'') not in ('not_required','pending','performed','declined','failed') then raise exception 'Reaktionsstatus fehlt.' using errcode='23514';end if;
 response_at:=nullif(entry#>>'{response,occurredAt}','')::timestamptz;response_person:=nullif(entry#>>'{response,responsibleBy}','')::uuid;
 if response_state in ('performed','declined','failed') and (response_at is null or response_at<observed or length(btrim(coalesce(entry#>>'{response,action}','')))<3 or length(btrim(coalesce(entry#>>'{response,reason}','')))<3 or response_person is null or not exists(select 1 from public.profiles p where p.id=response_person and p.tenant_id=tenant and p.is_active)) then raise exception 'Tatsächliche Reaktion oder Nichtdurchführung ist nicht vollständig belegt.' using errcode='23514';end if;
 if response_state='performed' and length(btrim(coalesce(entry#>>'{response,contactName}','')))<1 then raise exception 'Tatsächliche Reaktion benötigt die erreichte Gegenstelle.' using errcode='23514';end if;
 if response_state in ('pending','not_required') and (response_at is not null or length(coalesce(entry#>>'{response,action}',''))>0 or length(coalesce(entry#>>'{response,contactName}',''))>0 or response_person is not null) then raise exception 'Aus Messwert oder Plan darf keine Reaktion abgeleitet werden.' using errcode='23514';end if;
 if response_state='not_required' and length(btrim(coalesce(entry#>>'{response,reason}','')))<3 then raise exception 'Nicht erforderliche Reaktion benötigt eine Begründung.' using errcode='23514';end if;
 if coalesce(control_state,'') not in ('none','scheduled','performed','resolved') then raise exception 'Kontrollstatus fehlt.' using errcode='23514';end if;
 control_due:=nullif(entry#>>'{control,dueAt}','')::timestamptz;control_at:=nullif(entry#>>'{control,performedAt}','')::timestamptz;control_person:=nullif(entry#>>'{control,responsibleBy}','')::uuid;
 if (control_due is not null and control_due<observed) or (control_at is not null and control_at<observed) then raise exception 'Kontrollzeitpunkt liegt vor der Messung.' using errcode='23514';end if;
 if (control_state='none' and (control_due is not null or control_at is not null or length(coalesce(entry#>>'{control,result}',''))>0 or control_person is not null)) or (control_state='scheduled' and (control_due is null or control_at is not null or length(coalesce(entry#>>'{control,result}',''))>0 or control_person is null)) or (control_state in ('performed','resolved') and (control_at is null or length(btrim(coalesce(entry#>>'{control,result}','')))<3 or control_person is null)) then raise exception 'Kontrollphase ist nicht vollständig und widerspruchsfrei.' using errcode='23514';end if;
 if control_person is not null and not exists(select 1 from public.profiles p where p.id=control_person and p.tenant_id=tenant and p.is_active) then raise exception 'Kontrollverantwortung ist nicht aktuell.' using errcode='23514';end if;
 if (control_state='resolved' and response_state not in ('performed','not_required')) or (kind='anomaly_response' and (entry#>>'{interpretation,state}' not in ('outside_configured_range','measurement_uncertain') or response_state not in ('performed','declined','failed'))) or (kind='control_review' and control_state not in ('performed','resolved')) or (kind='case_resolution' and control_state<>'resolved') then raise exception 'Vorgangsart, Reaktion und Kontrollphase widersprechen sich.' using errcode='23514';end if;
 if kind='correction' then approval_at:=(entry#>>'{correction,approvedAt}')::timestamptz;if nullif(entry#>>'{correction,targetId}','')::uuid is null or not exists(select 1 from public.vital_care_paths v where v.id=(entry#>>'{correction,targetId}')::uuid and v.tenant_id=tenant and v.client_id=client and v.measurement_id=measurement) or length(btrim(coalesce(entry#>>'{correction,reason}','')))<10 or (entry#>>'{correction,replacementId}')::uuid is distinct from request or (entry#>>'{correction,approvedBy}')::uuid is distinct from actor or approval_at is null or approval_at<observed then raise exception 'Append-only Korrektur ist nicht an Original, Anfrage und aktuelle Freigabe gebunden.' using errcode='23514';end if;
 elsif coalesce(entry#>'correction','{}'::jsonb) is distinct from '{"targetId":null,"reason":"","replacementId":null,"approvedBy":null,"approvedAt":null}'::jsonb then raise exception 'Nur ein Korrekturvorgang darf Korrekturfelder setzen.' using errcode='23514';end if;
 current_sources:=care_private.read_vital_care_path_context(tenant,client,measurement,actor);if current_sources is distinct from p_packet->'sources' then raise exception 'Vitalpfadquellen wurden verändert. Neu laden.' using errcode='40001';end if;
 if p_packet->>'action'='create' then if p_packet->'original'<>'null'::jsonb or p_packet->'expectedHeadId'<>'null'::jsonb or (p_packet->>'expectedRevision')::integer<>0 or coalesce(p_packet->>'reason','')<>'' then raise exception 'Neuanlage enthält historischen Kopf.' using errcode='23514';end if;next_root:=next_id;next_revision:=1;
 else select * into head from public.vital_care_paths v where v.id=(p_packet->>'expectedHeadId')::uuid and v.tenant_id=tenant and v.client_id=client and v.measurement_id=measurement for update;if head.id is null or exists(select 1 from public.vital_care_paths newer where newer.root_id=head.root_id and newer.revision>head.revision) or head.revision<>(p_packet->>'expectedRevision')::integer or care_private.vital_path_original(head.id) is distinct from p_packet->'original' or length(btrim(coalesce(p_packet->>'reason','')))<10 or head.payload=entry then raise exception 'Vitalpfadkopf, Historie oder Fortschreibungsgrund wurde verändert.' using errcode='40001';end if;next_root:=head.root_id;next_revision:=head.revision+1;end if;
 select coalesce(nullif(p.display_name,''),p.email,'Pflegekraft') into actor_name from public.profiles p where p.id=actor and p.tenant_id=tenant and p.is_active;fingerprint:='sha256:'||encode(extensions.digest(convert_to(entry::text,'UTF8'),'sha256'),'hex');
 insert into public.vital_care_paths(id,tenant_id,client_id,measurement_id,root_id,previous_id,revision,kind,payload,reason,recorded_by,recorded_by_name,content_fingerprint) values(next_id,tenant,client,measurement,next_root,head.id,next_revision,kind,entry,coalesce(p_packet->>'reason',''),actor,actor_name,fingerprint);
 insert into care_private.vital_care_path_receipts(tenant_id,request_id,client_id,measurement_id,actor_id,packet,path_id) values(tenant,request,client,measurement,actor,p_packet,next_id);
 return jsonb_build_object('requestId',request,'packet',p_packet,'original',care_private.vital_path_original(next_id));
end $$;
revoke all on function care_private.commit_vital_care_path_packet(jsonb) from public,anon,authenticated;
create or replace function public.web_commit_vital_care_path_packet(p_packet jsonb) returns jsonb language sql security invoker set search_path='' as $$select care_private.commit_vital_care_path_packet(p_packet)$$;
revoke all on function public.web_commit_vital_care_path_packet(jsonb) from public,anon;
create or replace function care_private.confirm_vital_care_path_packet(p_tenant_id uuid,p_client_id uuid,p_measurement_id uuid,p_actor_profile_id uuid,p_request_id uuid,p_packet jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$declare r care_private.vital_care_path_receipts%rowtype;begin perform care_private.lock_vital_measurement_scope(p_tenant_id,p_client_id,p_measurement_id,p_actor_profile_id,false);select * into r from care_private.vital_care_path_receipts x where x.tenant_id=p_tenant_id and x.request_id=p_request_id;if r.request_id is null or r.client_id<>p_client_id or r.measurement_id<>p_measurement_id or r.actor_id<>p_actor_profile_id or r.packet<>p_packet then return null;end if;return jsonb_build_object('requestId',p_request_id,'packet',r.packet,'original',care_private.vital_path_original(r.path_id));end $$;
revoke all on function care_private.confirm_vital_care_path_packet(uuid,uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated;
create or replace function public.web_confirm_vital_care_path_packet(p_tenant_id uuid,p_client_id uuid,p_measurement_id uuid,p_actor_profile_id uuid,p_request_id uuid,p_packet jsonb)
returns jsonb language sql security invoker set search_path='' as $$select care_private.confirm_vital_care_path_packet(p_tenant_id,p_client_id,p_measurement_id,p_actor_profile_id,p_request_id,p_packet)$$;
revoke all on function public.web_confirm_vital_care_path_packet(uuid,uuid,uuid,uuid,uuid,jsonb) from public,anon;

-- Prepared implementation from ambulatory_vital_care_review.sql; grants/policies intentionally removed.
-- PREPARED ONLY. Requires ambulatory_vital_care_path_packet.sql.
-- No production execution, no inferred reaction and no automatic clinical acceptance.
create schema if not exists care_private;
revoke all on schema care_private from public,anon;
create table if not exists care_private.vital_care_review_scopes(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),
 employee_id uuid not null references public.employees(id),qualification_id uuid not null references public.employee_qualifications(id),
 kind text not null check(kind='vital_care_review'),qualification_fingerprint text not null check(qualification_fingerprint~'^sha256:[0-9a-f]{64}$'),
 document_fingerprint text not null check(document_fingerprint~'^sha256:[0-9a-f]{64}$'),approved_by uuid not null references public.profiles(id),
 approved_at timestamptz not null,valid_until timestamptz not null,revoked_at timestamptz,check(valid_until>approved_at)
);
create table if not exists public.vital_care_review_roots(
 id uuid primary key,tenant_id uuid not null,client_id uuid not null,measurement_id uuid not null,
 care_root_id uuid not null,care_head_id uuid not null references public.vital_care_paths(id),care_fingerprint text not null,care_kind text not null,created_at timestamptz not null,
 unique(id,tenant_id,client_id,measurement_id),unique(tenant_id,client_id,measurement_id,care_head_id)
);
create table if not exists public.vital_care_review_events(
 id uuid primary key,tenant_id uuid not null,client_id uuid not null,measurement_id uuid not null,root_id uuid not null,
 revision integer not null check(revision in(1,2)),previous_id uuid,request_id uuid not null unique,action text not null check(action in('request','return','accept')),
 actor_id uuid not null references public.profiles(id),actor_name text not null,recorded_at timestamptz not null,reason text not null,required_change text not null,rationale text not null,
 care_head_id uuid not null,care_fingerprint text not null,qualification_original jsonb,fingerprint text not null,packet jsonb not null,
 unique(root_id,revision),unique(id,root_id),foreign key(root_id,tenant_id,client_id,measurement_id) references public.vital_care_review_roots(id,tenant_id,client_id,measurement_id),
 foreign key(previous_id,root_id) references public.vital_care_review_events(id,root_id),check((revision=1)=(previous_id is null)),check((action='request')=(revision=1)),check((action='request')=(qualification_original is null))
);
create table if not exists public.vital_care_review_receipts(
 request_id uuid primary key,tenant_id uuid not null,client_id uuid not null,measurement_id uuid not null,actor_id uuid not null,
 root_id uuid not null,event_id uuid not null,packet jsonb not null,original jsonb not null,recorded_at timestamptz not null,
 foreign key(event_id,root_id) references public.vital_care_review_events(id,root_id)
);
create index if not exists vital_care_review_page on public.vital_care_review_roots(tenant_id,client_id,measurement_id,created_at desc,id desc);
alter table care_private.vital_care_review_scopes enable row level security;
alter table public.vital_care_review_roots enable row level security;
alter table public.vital_care_review_events enable row level security;
alter table public.vital_care_review_receipts enable row level security;
revoke all on care_private.vital_care_review_scopes,public.vital_care_review_roots,public.vital_care_review_events,public.vital_care_review_receipts from public,anon,authenticated;

create or replace function care_private.vital_care_review_immutable()
returns trigger language plpgsql security invoker set search_path='' as $$begin raise exception 'Vitalfachprueforiginale und Quittungen sind unveraenderlich.' using errcode='23514';end$$;
do $$declare tab text;begin foreach tab in array array['vital_care_review_roots','vital_care_review_events','vital_care_review_receipts'] loop execute format('drop trigger if exists vital_care_review_immutable on public.%I',tab);execute format('create trigger vital_care_review_immutable before update or delete on public.%I for each row execute function care_private.vital_care_review_immutable()',tab);end loop;end$$;

create or replace function care_private.vital_care_review_original(root_ref uuid)
returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('id',h.id::text,'tenantId',r.tenant_id::text,'clientId',r.client_id::text,'measurementId',r.measurement_id::text,'rootId',r.id::text,'headId',h.id::text,'revision',h.revision,
 'careRootId',r.care_root_id::text,'careHeadId',r.care_head_id::text,'careFingerprint',r.care_fingerprint,'careKind',r.care_kind,
 'status',case h.action when 'request' then 'requested' when 'return' then 'returned' else 'accepted' end,
 'history',(select jsonb_agg(jsonb_build_object('id',e.id::text,'revision',e.revision,'previousId',e.previous_id::text,'requestId',e.request_id::text,
 'action',e.action,'recordedAt',to_char(e.recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'actorId',e.actor_id::text,'actorName',e.actor_name,
 'reason',e.reason,'requiredChange',e.required_change,'rationale',e.rationale,'careHeadId',e.care_head_id::text,'careFingerprint',e.care_fingerprint,
 'qualification',e.qualification_original,'fingerprint',e.fingerprint) order by e.revision) from public.vital_care_review_events e where e.root_id=r.id))
 from public.vital_care_review_roots r join lateral(select e.* from public.vital_care_review_events e where e.root_id=r.id order by e.revision desc limit 1)h on true where r.id=root_ref
$$;
create or replace function care_private.read_vital_care_review_page(t uuid,c uuid,m uuid,actor uuid,at_cursor timestamptz,id_cursor uuid,page_size integer)
returns jsonb language plpgsql security definer set search_path='' as $$declare result jsonb;begin
 perform care_private.lock_vital_measurement_scope(t,c,m,actor,false);
 if care_private.vital_client_active(c) is not true or page_size is null or page_size<1 or page_size>100 or(at_cursor is null)<>(id_cursor is null) then raise exception 'Ungueltige Cursor- oder Pflegefallbindung.' using errcode='22023';end if;
 with page as materialized(select r.* from public.vital_care_review_roots r where r.tenant_id=t and r.client_id=c and r.measurement_id=m and(at_cursor is null or(r.created_at,r.id)<(at_cursor,id_cursor)) order by r.created_at desc,r.id desc limit page_size)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(care_private.vital_care_review_original(p.id) order by p.created_at desc,p.id desc) from page p),'[]'::jsonb),
 'nextCursorRecordedAt',(select to_char(p.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') from page p order by p.created_at,p.id limit 1),
 'nextCursorId',(select p.id::text from page p order by p.created_at,p.id limit 1)) into result;return result;
end$$;

create or replace function care_private.commit_vital_care_review(p jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t uuid:=(p->>'tenantId')::uuid;c uuid:=(p->>'clientId')::uuid;m uuid:=(p->>'measurementId')::uuid;actor uuid:=(p->>'actorId')::uuid;req uuid:=(p->>'requestId')::uuid;action_value text:=p->>'action';
 care_root uuid:=(p#>>'{careOriginal,rootId}')::uuid;care_head uuid:=(p#>>'{careOriginal,headId}')::uuid;care jsonb;latest public.vital_care_paths;
 review_root uuid;event_ref uuid:=gen_random_uuid();prior public.vital_care_review_events;receipt public.vital_care_review_receipts;
 now_at timestamptz:=clock_timestamp();today date:=(clock_timestamp() at time zone 'Europe/Berlin')::date;expected integer:=(p->>'expectedRevision')::integer;name text;qualification jsonb:=null;fingerprint text;original jsonb;
begin
 perform care_private.lock_vital_measurement_scope(t,c,m,actor,false);
 if action_value='request' then perform care_private.vital_actor('pflege.vitals.manage');else perform care_private.vital_actor('pflege.documentation.sign');end if;
 if jsonb_typeof(p) is distinct from 'object' or length(p::text)>4000000 or not(p ?& array['schemaVersion','action','requestId','tenantId','clientId','measurementId','actorId','expectedHeadId','expectedRevision','careOriginal','sources','reviewOriginal','reason','requiredChange','rationale'])
 or exists(select 1 from jsonb_object_keys(p) k where k not in('schemaVersion','action','requestId','tenantId','clientId','measurementId','actorId','expectedHeadId','expectedRevision','careOriginal','sources','reviewOriginal','reason','requiredChange','rationale'))
 or p->'schemaVersion' is distinct from '"1"'::jsonb or action_value not in('request','return','accept') or t is null or c is null or m is null or actor is null or req is null or expected is null
 or jsonb_typeof(p->'reason') is distinct from 'string' or jsonb_typeof(p->'requiredChange') is distinct from 'string' or jsonb_typeof(p->'rationale') is distinct from 'string'
 or length(p->>'reason')>2000 or length(p->>'requiredChange')>4000 or length(p->>'rationale')>4000 then raise exception 'Vitalfachpruefpaket ist unvollstaendig.' using errcode='23514';end if;
 perform pg_advisory_xact_lock(hashtextextended(t::text||':'||c::text||':'||m::text,0));
 select * into receipt from public.vital_care_review_receipts r where r.request_id=req for update;
 if found then if receipt.tenant_id<>t or receipt.client_id<>c or receipt.measurement_id<>m or receipt.actor_id<>actor or receipt.packet<>p then raise exception 'Anfragekennung ist anders gebunden.' using errcode='40001';end if;return jsonb_build_object('requestId',req::text,'packet',p,'original',receipt.original);end if;
 select * into latest from public.vital_care_paths e where e.tenant_id=t and e.client_id=c and e.measurement_id=m and e.root_id=care_root order by e.revision desc limit 1 for update;
 if not found or latest.id<>care_head then raise exception 'Aktuelle unveraenderte Vitalpfadfassung fehlt.' using errcode='40001';end if;
 care:=care_private.vital_path_original(care_head);
 if care is distinct from p->'careOriginal' or care->>'contentFingerprint' is distinct from latest.content_fingerprint then raise exception 'Unveraendertes abgeschlossenes Vitalpfadoriginal fehlt.' using errcode='40001';end if;
 if care_private.read_vital_care_path_context(t,c,m,actor) is distinct from p->'sources' then raise exception 'Vollstaendige aktuelle Vitalquellen wurden veraendert.' using errcode='40001';end if;
 if exists(select 1 from public.vital_measurement_invalidations vi where vi.measurement_id=m) and care->>'kind'<>'correction' then raise exception 'Ungültiges Messoriginal ist ohne ausdrücklichen Korrekturpfad nicht fachlich annehmbar.' using errcode='23514';end if;
 if care->>'kind' not in('case_resolution','correction') or care#>>'{payload,control,state}'<>'resolved' or care#>>'{payload,response,state}' not in('performed','not_required') or care#>>'{payload,interpretation,state}'='unrated'
 or care#>>'{payload,device,suitability}' not in('confirmed','limited','not_applicable') or(care#>>'{payload,device,deviceId}' is not null and care#>>'{payload,device,calibrationId}' is null)
 then raise exception 'Messwert, Grenze oder Auswahl belegt keinen abgeschlossenen tatsaechlichen Vitalpfad.' using errcode='23514';end if;
 if action_value='request' then perform care_private.assert_vital_path_actor(t,actor,true);else perform care_private.vital_actor('pflege.documentation.sign');end if;
 select coalesce(pr.display_name,pr.email) into name from public.profiles pr where pr.id=actor and pr.tenant_id=t and pr.is_active=true;if btrim(coalesce(name,''))='' then raise exception 'Aktiver Akteur fehlt.' using errcode='42501';end if;
 if action_value='request' then
  if expected<>0 or p->'expectedHeadId' is distinct from 'null'::jsonb or p->'reviewOriginal' is distinct from 'null'::jsonb or length(btrim(p->>'reason'))<10 or p->>'requiredChange'<>'' or p->>'rationale'<>'' then raise exception 'Pruefanfrage darf keine Entscheidung enthalten.' using errcode='23514';end if;
  review_root:=event_ref;insert into public.vital_care_review_roots(id,tenant_id,client_id,measurement_id,care_root_id,care_head_id,care_fingerprint,care_kind,created_at) values(review_root,t,c,m,care_root,care_head,care->>'contentFingerprint',care->>'kind',now_at);
 else
  review_root:=(p#>>'{reviewOriginal,rootId}')::uuid;
  perform 1 from public.vital_care_review_roots r where r.id=review_root and r.tenant_id=t and r.client_id=c and r.measurement_id=m and r.care_root_id=care_root and r.care_head_id=care_head for update;if not found then raise exception 'Passende Vitalfachpruefanfrage fehlt.' using errcode='40001';end if;
  select * into prior from public.vital_care_review_events e where e.root_id=review_root order by e.revision desc limit 1 for update;
  if not found or expected<>1 or prior.revision<>expected or prior.action<>'request' or prior.id::text is distinct from p->>'expectedHeadId' or care_private.vital_care_review_original(review_root) is distinct from p->'reviewOriginal' then raise exception 'Vitalfachpruefanfrage hat sich geaendert.' using errcode='40001';end if;
  if actor=prior.actor_id or exists(select 1 from jsonb_array_elements(care->'history') h where h->>'recordedBy'=actor::text or actor::text in(h#>>'{payload,response,responsibleBy}',h#>>'{payload,control,responsibleBy}',h#>>'{payload,correction,approvedBy}'))
   or exists(select 1 from public.vital_sign_measurements vm where vm.id=m and vm.recorded_by=actor)
   or exists(select 1 from jsonb_array_elements(p#>'{sources,settings}') s where s#>>'{payload,approved_by}'=actor::text)
   or exists(select 1 from jsonb_array_elements(p#>'{sources,devices}') d where d#>>'{payload,recorded_by}'=actor::text)
   or exists(select 1 from jsonb_array_elements(p#>'{sources,calibrations}') k where k#>>'{payload,recorded_by}'=actor::text)
  then raise exception 'Anfragende, messende, dokumentierende, reagierende, kontrollierende oder freigebende Person darf nicht selbst entscheiden.' using errcode='42501';end if;
  lock table public.employees,public.employee_employment_details,public.employee_qualifications,public.employee_documents,care_private.vital_care_review_scopes in share mode;
  select jsonb_build_object('id',q.id::text,'employeeId',e.id::text,'profileId',e.profile_id::text,'qualificationType',q.qualification_type,'title',q.title,'status',q.status,
   'issuedAt',to_char(q.issued_at,'YYYY-MM-DD'),'validUntil',to_char(q.valid_until,'YYYY-MM-DD'),'verifiedAt',to_char(q.verified_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'updatedAt',to_char(q.updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
   'documentId',d.id::text,'documentFingerprint',scope.document_fingerprint,'sourceFingerprint',scope.qualification_fingerprint,'employmentStart',to_char(coalesce(e.entry_date,e.start_date),'YYYY-MM-DD'),'employmentEnd',to_char(e.exit_date,'YYYY-MM-DD'),
   'employeeFingerprint','sha256:'||encode(extensions.digest(convert_to(jsonb_build_object('employee',to_jsonb(e),'employment',to_jsonb(ed))::text,'UTF8'),'sha256'),'hex'),
   'scopeId',scope.id::text,'scopeKind','vital_care_review','scopeFingerprint','sha256:'||encode(extensions.digest(convert_to(to_jsonb(scope)::text,'UTF8'),'sha256'),'hex')) into qualification
  from public.employees e join public.employee_employment_details ed on ed.employee_id=e.id and ed.tenant_id=e.tenant_id join public.employee_qualifications q on q.employee_id=e.id and q.tenant_id=e.tenant_id join public.employee_documents d on d.id=q.document_id and d.employee_id=e.id and d.tenant_id=e.tenant_id
  join care_private.vital_care_review_scopes scope on scope.employee_id=e.id and scope.qualification_id=q.id and scope.tenant_id=e.tenant_id and scope.kind='vital_care_review'
  where e.tenant_id=t and e.profile_id=actor and e.status='aktiv' and ed.employment_status='active' and coalesce(e.entry_date,e.start_date)<=today and(e.entry_date is null or e.entry_date<=today) and(e.start_date is null or e.start_date<=today) and(e.exit_date is null or e.exit_date>=today)
   and q.status in('valid','expires_soon') and q.verified_at<=now_at and q.updated_at<=now_at and(q.issued_at is null or q.issued_at<=today) and(q.valid_until is null or q.valid_until>=today) and(d.valid_until is null or d.valid_until>=today) and btrim(coalesce(d.storage_path,''))<>''
   and scope.approved_by<>actor and exists(select 1 from public.profiles scope_approver where scope_approver.id=scope.approved_by and scope_approver.tenant_id=t and scope_approver.is_active and scope_approver.status='active') and scope.approved_at<=now_at and scope.valid_until>now_at and scope.revoked_at is null and scope.qualification_fingerprint='sha256:'||encode(extensions.digest(convert_to(to_jsonb(q)::text,'UTF8'),'sha256'),'hex') and scope.document_fingerprint='sha256:'||encode(extensions.digest(convert_to(to_jsonb(d)::text,'UTF8'),'sha256'),'hex')
  order by scope.approved_at desc,scope.id desc limit 1;
  if qualification is null then raise exception 'Aktuelle Beschaeftigung, Qualifikation, Dokument und Vitalpruefbereich fehlen.' using errcode='42501';end if;
  if action_value='return' then if length(btrim(p->>'reason'))<10 or length(btrim(p->>'requiredChange'))<10 or p->>'rationale'<>'' then raise exception 'Rueckgabe benoetigt Grund und konkrete Aenderung.' using errcode='23514';end if;
  else if p->>'reason'<>'' or p->>'requiredChange'<>'' or length(btrim(p->>'rationale'))<10 then raise exception 'Fachliche Annahme benoetigt eine konkrete Begruendung ohne Rueckgabeinhalt.' using errcode='23514';end if;end if;
 end if;
 fingerprint:='sha256:'||encode(extensions.digest(convert_to(jsonb_build_object('packet',p,'qualification',qualification)::text,'UTF8'),'sha256'),'hex');
 insert into public.vital_care_review_events(id,tenant_id,client_id,measurement_id,root_id,revision,previous_id,request_id,action,actor_id,actor_name,recorded_at,reason,required_change,rationale,care_head_id,care_fingerprint,qualification_original,fingerprint,packet)
 values(event_ref,t,c,m,review_root,expected+1,case when expected=0 then null else prior.id end,req,action_value,actor,name,now_at,p->>'reason',p->>'requiredChange',p->>'rationale',care_head,care->>'contentFingerprint',qualification,fingerprint,p);
 original:=care_private.vital_care_review_original(review_root);insert into public.vital_care_review_receipts(request_id,tenant_id,client_id,measurement_id,actor_id,root_id,event_id,packet,original,recorded_at) values(req,t,c,m,actor,review_root,event_ref,p,original,now_at);
 return jsonb_build_object('requestId',req::text,'packet',p,'original',original);
end$$;
create or replace function care_private.confirm_vital_care_review(t uuid,c uuid,m uuid,actor uuid,req uuid,p jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$declare r public.vital_care_review_receipts;begin perform care_private.lock_vital_measurement_scope(t,c,m,actor,false);if care_private.vital_client_active(c) is not true then raise exception 'Aktiver Pflegefall fehlt.' using errcode='42501';end if;select * into r from public.vital_care_review_receipts x where x.request_id=req and x.tenant_id=t and x.client_id=c and x.measurement_id=m and x.actor_id=actor;if not found or r.packet is distinct from p then raise exception 'Keine passende unveraenderliche Vitalfachpruefquittung.' using errcode='P0H03';end if;return jsonb_build_object('requestId',req::text,'packet',r.packet,'original',r.original);end$$;
create or replace function public.web_read_vital_care_review_page(p_tenant_id uuid,p_client_id uuid,p_measurement_id uuid,p_actor_profile_id uuid,p_cursor_recorded_at timestamptz,p_cursor_id uuid,p_page_size integer)returns jsonb language sql security invoker set search_path='' as $$select care_private.read_vital_care_review_page(p_tenant_id,p_client_id,p_measurement_id,p_actor_profile_id,p_cursor_recorded_at,p_cursor_id,p_page_size)$$;
create or replace function public.web_commit_vital_care_review(p_packet jsonb)returns jsonb language sql security invoker set search_path='' as $$select care_private.commit_vital_care_review(p_packet)$$;
create or replace function public.web_confirm_vital_care_review(p_tenant_id uuid,p_client_id uuid,p_measurement_id uuid,p_actor_profile_id uuid,p_request_id uuid,p_packet jsonb)returns jsonb language sql security invoker set search_path='' as $$select care_private.confirm_vital_care_review(p_tenant_id,p_client_id,p_measurement_id,p_actor_profile_id,p_request_id,p_packet)$$;
revoke all on function care_private.vital_care_review_immutable(),care_private.vital_care_review_original(uuid),care_private.read_vital_care_review_page(uuid,uuid,uuid,uuid,timestamptz,uuid,integer),care_private.commit_vital_care_review(jsonb),care_private.confirm_vital_care_review(uuid,uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.web_read_vital_care_review_page(uuid,uuid,uuid,uuid,timestamptz,uuid,integer),public.web_commit_vital_care_review(jsonb),public.web_confirm_vital_care_review(uuid,uuid,uuid,uuid,uuid,jsonb) from public,anon;

-- Hardened actor/scope, packet validators and final quarantine follow below.

-- Strict technical packet grammar. No text timestamp or missing value can imply an event.
create or replace function care_private.vital_keys(p jsonb,keys text[]) returns boolean language sql immutable set search_path='' as $$select coalesce(jsonb_typeof(p)='object' and p?&keys and p-keys='{}'::jsonb,false)$$;
create or replace function care_private.vital_text(p jsonb,minimum integer,maximum integer) returns boolean language sql immutable set search_path='' as $$select coalesce(jsonb_typeof(p)='string' and length(btrim(p#>>'{}'))>=minimum and length(p#>>'{}')<=maximum,false)$$;
create or replace function care_private.vital_time(p jsonb) returns timestamptz language plpgsql immutable set search_path='' as $$declare result timestamptz;begin
 if jsonb_typeof(p) is distinct from 'string' or p#>>'{}' !~ '^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.][0-9]{1,6})?(Z|[+-]((0[0-9]|1[0-3]):[0-5][0-9]|14:00))$' then raise exception 'Ausdrücklicher tatsächlicher Zeitpunkt mit Zeitzone fehlt.' using errcode='23514';end if;
 result:=(p#>>'{}')::timestamptz;if not isfinite(result) then raise exception 'Endlicher Zeitpunkt fehlt.' using errcode='23514';end if;return result;
 exception when datetime_field_overflow or invalid_datetime_format then raise exception 'Kalenderzeitpunkt ist ungültig.' using errcode='23514';end$$;
create or replace function care_private.assert_vital_actor(permission_name text) returns uuid language sql security definer set search_path='' as $$select care_private.vital_actor(permission_name)$$;
create or replace function care_private.assert_vital_path_actor(p_tenant uuid,p_actor uuid,p_manage boolean default false) returns void language plpgsql security definer set search_path='' as $$begin
 perform care_private.require_workspace_session(p_tenant,p_actor);perform care_private.vital_actor('pflege.vitals.view');if p_manage then perform care_private.vital_actor('pflege.vitals.manage');end if;
end$$;
create or replace function care_private.lock_vital_measurement_scope(t uuid,c uuid,m uuid,a uuid,write_required boolean default false) returns void language plpgsql security definer set search_path='' as $$begin
 perform care_private.assert_vital_path_actor(t,a,write_required);
 if care_private.vital_client_active(c) is not true then raise exception 'Aktiver eigener Pflegefall fehlt.' using errcode='42501';end if;
 perform 1 from public.vital_sign_measurements x where x.id=m and x.tenant_id=t and x.client_id=c for share;if not found then raise exception 'Eigene vollständige Messung fehlt.' using errcode='42501';end if;
end$$;
-- Catalog/configuration versions change on each mutation; no stale same-version rewrite.
create or replace function care_private.vital_configuration_version() returns trigger language plpgsql security definer set search_path='' as $$begin new.updated_at:=clock_timestamp();if tg_table_name='client_vital_sign_settings' then new.revision:=old.revision+1;end if;return new;end$$;
drop trigger if exists vital_catalog_version on public.vital_sign_catalog;
create trigger vital_catalog_version before update on public.vital_sign_catalog for each row execute function care_private.vital_configuration_version();
drop trigger if exists vital_settings_version on public.client_vital_sign_settings;
create trigger vital_settings_version before update on public.client_vital_sign_settings for each row execute function care_private.vital_configuration_version();
-- Captured originals remain immutable. Historical native rows without request metadata
-- retain their existing legacy writer behavior; no invented actual-time backfill.
create or replace function care_private.keep_captured_vital_measurement() returns trigger language plpgsql security definer set search_path='' as $$begin if old.creation_request_id is not null then raise exception 'Erfasstes Messoriginal bleibt unverändert.' using errcode='42501';end if;if tg_op='DELETE' then return old;end if;return new;end$$;
drop trigger if exists captured_vital_measurement_immutable on public.vital_sign_measurements;
create trigger captured_vital_measurement_immutable before update or delete on public.vital_sign_measurements for each row execute function care_private.keep_captured_vital_measurement();
drop trigger if exists vital_follow_up_immutable on public.vital_measurement_follow_ups;
create trigger vital_follow_up_immutable before update or delete on public.vital_measurement_follow_ups for each row execute function care_private.reject_vital_care_original_change();
drop trigger if exists vital_invalidation_immutable on public.vital_measurement_invalidations;
create trigger vital_invalidation_immutable before update or delete on public.vital_measurement_invalidations for each row execute function care_private.reject_vital_care_original_change();
drop trigger if exists vital_event_original_immutable on public.vital_sign_events;
create trigger vital_event_original_immutable before update or delete on public.vital_sign_events for each row execute function care_private.reject_vital_care_original_change();
-- UUID replies alone are not a complete own-write receipt. These confirmation RPCs
-- return the retained row after fresh current own session/role/client checks.
create or replace function care_private.confirm_vital_native_write(p_kind text,p_id uuid,p_request uuid,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare tenant uuid:=public.current_tenant_id();actor uuid:=care_private.vital_actor('pflege.vitals.view');original jsonb;client uuid;measurement uuid;
begin
 if p_kind='measurement' then select to_jsonb(m),m.client_id,m.id into original,client,measurement from public.vital_sign_measurements m where m.id=p_id and m.tenant_id=tenant and m.creation_request_id=p_request and m.recorded_by=actor and m.creation_payload=p_payload for share;
 elsif p_kind='follow_up' then select to_jsonb(f),f.client_id,f.measurement_id into original,client,measurement from public.vital_measurement_follow_ups f where f.id=p_id and f.tenant_id=tenant and f.request_id=p_request and f.recorded_by=actor and f.creation_payload=p_payload for share;
 elsif p_kind='invalidation' then select to_jsonb(i),i.client_id,i.measurement_id into original,client,measurement from public.vital_measurement_invalidations i where i.id=p_id and i.tenant_id=tenant and i.request_id=p_request and i.recorded_by=actor and i.creation_payload=p_payload for share;
 else raise exception 'Unbekannte Messquittungsart.' using errcode='23514';end if;
 if original is null then raise exception 'Eigene unveränderte Originalquittung fehlt.' using errcode='P0V01';end if;
 perform care_private.lock_vital_measurement_scope(tenant,client,measurement,actor,false);return original;
end$$;
create or replace function public.confirm_ambulatory_vital_measurement(measurement_id uuid,request_id uuid,payload jsonb) returns jsonb language sql security invoker set search_path='' as $$select care_private.confirm_vital_native_write('measurement',measurement_id,request_id,payload)$$;
create or replace function public.confirm_ambulatory_vital_follow_up(follow_up_id uuid,request_id uuid,payload jsonb) returns jsonb language sql security invoker set search_path='' as $$select care_private.confirm_vital_native_write('follow_up',follow_up_id,request_id,payload)$$;
create or replace function public.confirm_ambulatory_vital_invalidation(invalidation_id uuid,request_id uuid,payload jsonb) returns jsonb language sql security invoker set search_path='' as $$select care_private.confirm_vital_native_write('invalidation',invalidation_id,request_id,payload)$$;
create or replace function care_private.vital_uuid(p jsonb) returns boolean language sql immutable set search_path='' as $$select coalesce(jsonb_typeof(p)='string' and p#>>'{}'~'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',false)$$;
create or replace function care_private.validate_vital_path_packet(p jsonb) returns void language plpgsql security definer set search_path='' as $$
declare e jsonb:=p->'entry';i jsonb:=e->'interpretation';d jsonb:=e->'device';r jsonb:=e->'response';c jsonb:=e->'control';cor jsonb:=e->'correction';k text;now_at timestamptz:=clock_timestamp();
begin
 if not care_private.vital_keys(p,array['schemaVersion','action','requestId','tenantId','clientId','measurementId','actorId','expectedHeadId','expectedRevision','entry','reason','original','sources']) or p->'schemaVersion' is distinct from '"1"'::jsonb or not care_private.vital_keys(e,array['kind','title','tenantId','clientId','measurementId','observedAt','interpretation','device','response','control','correction'])
 or not care_private.vital_keys(i,array['state','summary','measurementType','values','unit','context','configuredLimitId']) or not care_private.vital_keys(d,array['deviceId','calibrationId','suitability','method','limitation']) or not care_private.vital_keys(r,array['state','occurredAt','action','reason','contactName','responsibleBy']) or not care_private.vital_keys(c,array['state','dueAt','performedAt','result','responsibleBy']) or not care_private.vital_keys(cor,array['targetId','reason','replacementId','approvedBy','approvedAt'])
 or jsonb_typeof(p->'expectedRevision') is distinct from 'number' or p->>'expectedRevision'!~'^(0|[1-9][0-9]{0,3})$' or (p->>'expectedRevision')::integer>=2000 or not care_private.vital_text(p->'reason',0,8000)
 or not care_private.vital_text(e->'title',3,300) or not care_private.vital_text(i->'summary',3,8000) or not care_private.vital_text(i->'measurementType',1,100) or not care_private.vital_text(i->'unit',1,40) or jsonb_typeof(i->'values') is distinct from 'object' or jsonb_typeof(i->'context') is distinct from 'object'
 or not care_private.vital_text(d->'method',0,500) or not care_private.vital_text(d->'limitation',0,1000) or not care_private.vital_text(r->'action',0,8000) or not care_private.vital_text(r->'reason',0,8000) or not care_private.vital_text(r->'contactName',0,8000) or not care_private.vital_text(c->'result',0,8000) or not care_private.vital_text(cor->'reason',0,8000)
 then raise exception 'Vollständiges unverändertes Vitalpfadpaket mit bekannter Feldstruktur fehlt.' using errcode='23514';end if;
 foreach k in array array['requestId','tenantId','clientId','measurementId','actorId'] loop if not care_private.vital_uuid(p->k) then raise exception 'Vitalpfadidentität fehlt.' using errcode='23514';end if;end loop;
 if p->'expectedHeadId'<>'null'::jsonb and not care_private.vital_uuid(p->'expectedHeadId') then raise exception 'Ursprünglicher Vitalpfadkopf fehlt.' using errcode='23514';end if;
 if i->'configuredLimitId'<>'null'::jsonb and not care_private.vital_uuid(i->'configuredLimitId') or d->'deviceId'<>'null'::jsonb and not care_private.vital_uuid(d->'deviceId') or d->'calibrationId'<>'null'::jsonb and not care_private.vital_uuid(d->'calibrationId') or r->'responsibleBy'<>'null'::jsonb and not care_private.vital_uuid(r->'responsibleBy') or c->'responsibleBy'<>'null'::jsonb and not care_private.vital_uuid(c->'responsibleBy') then raise exception 'Originalbezug ist nicht ausdrücklich gewählt.' using errcode='23514';end if;
 if care_private.vital_time(e->'observedAt')>now_at then raise exception 'Tatsächliche Messzeit liegt in der Zukunft.' using errcode='23514';end if;
 if r->'occurredAt'<>'null'::jsonb and care_private.vital_time(r->'occurredAt')>now_at or c->'performedAt'<>'null'::jsonb and care_private.vital_time(c->'performedAt')>now_at or cor->'approvedAt'<>'null'::jsonb and care_private.vital_time(cor->'approvedAt')>now_at then raise exception 'Tatsächliche Reaktion, Kontrolle oder Korrekturfreigabe liegt in der Zukunft.' using errcode='23514';end if;
 if c->'dueAt'<>'null'::jsonb then perform care_private.vital_time(c->'dueAt');end if;
 if d->>'suitability'='not_applicable' and (d->'deviceId'<>'null'::jsonb or d->'calibrationId'<>'null'::jsonb) then raise exception 'Nicht anwendbarer Gerätebezug darf kein Messgerät bestätigen.' using errcode='23514';end if;
end$$;
create or replace function care_private.vital_assess_limits(vals jsonb,limits jsonb) returns text language plpgsql immutable set search_path='' as $$
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
-- Quarantine every prepared Vital object, including SECURITY DEFINER helpers.
-- Do not change any shared legacy Android table, function, role or permission grant.
do $$declare r record;begin
 for r in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in('r','p') and (n.nspname='public' and c.relname in('vital_sign_catalog','client_vital_sign_settings','vital_sign_events','vital_sign_measurements','vital_measurement_follow_ups','vital_measurement_invalidations','vital_measurement_devices','vital_device_calibrations','vital_care_paths','vital_care_review_roots','vital_care_review_events','vital_care_review_receipts') or n.nspname='care_private' and c.relname in('vital_care_path_receipts','vital_care_review_scopes')) loop
  execute format('alter table %I.%I enable row level security',r.nspname,r.relname);execute format('revoke all on table %I.%I from public,anon,authenticated,service_role',r.nspname,r.relname);
 end loop;
 for r in select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','care_private') and p.proname=any(array['assert_vital_actor','assert_vital_path_actor','commit_vital_care_path_packet','commit_vital_care_review','confirm_ambulatory_vital_follow_up','confirm_ambulatory_vital_invalidation','confirm_ambulatory_vital_measurement','confirm_vital_care_path_packet','confirm_vital_care_review','confirm_vital_native_write','invalidate_ambulatory_vital_measurement','invalidate_vital_measurement','keep_captured_vital_measurement','lock_vital_measurement_scope','read_vital_care_path_context','read_vital_care_path_page','read_vital_care_review_page','record_ambulatory_vital_follow_up','record_ambulatory_vital_measurement','record_vital_follow_up','record_vital_measurement','reject_vital_care_original_change','validate_vital_path_packet','vital_actor','vital_assess_limits','vital_care_review_immutable','vital_care_review_original','vital_client_active','vital_configuration_version','vital_keys','vital_path_original','vital_ref','vital_text','vital_time','vital_uuid','web_commit_vital_care_path_packet','web_commit_vital_care_review','web_confirm_vital_care_path_packet','web_confirm_vital_care_review','web_read_vital_care_path_context','web_read_vital_care_path_page','web_read_vital_care_review_page']) loop execute format('revoke all on function %I.%I(%s) from public,anon,authenticated,service_role',r.nspname,r.proname,r.args);end loop;
end$$;
commit;
