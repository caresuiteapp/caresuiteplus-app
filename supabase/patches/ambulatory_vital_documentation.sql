-- LOCAL REVIEW ONLY. Requires existing vital_signs_live_final schema.
-- No production application. Existing native RPC remains unchanged.
begin;
create schema if not exists care_private;
revoke all on schema care_private from public,anon;
grant usage on schema care_private to authenticated;
alter table public.vital_sign_measurements
 add column if not exists occurred_at timestamptz,
 add column if not exists creation_request_id uuid,
 add column if not exists creation_payload jsonb,
 add column if not exists catalog_snapshot jsonb,
 add column if not exists configuration_snapshot jsonb;
-- Historical measured_at values may be capture times; no invented actual-time backfill.
create unique index if not exists vital_measurement_request on public.vital_sign_measurements(tenant_id,creation_request_id) where creation_request_id is not null;
create or replace function care_private.assert_vital_actor(permission_name text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.resolve_current_profile_id();
begin
 if auth.uid() is null or public.current_tenant_id() is null or public.has_permission(permission_name) is not true or not exists(select 1 from public.profiles p where p.id=actor and p.tenant_id=public.current_tenant_id() and p.is_active) then raise exception 'Keine Berechtigung oder kein aktives Profil.' using errcode='42501';end if;
 return actor;
end $$;
revoke all on function care_private.assert_vital_actor(text) from public,anon,authenticated;
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
 subject:=(payload->>'clientId')::uuid; kind:=payload->>'type';
 -- Serialize by client so concurrent exact retries cannot both insert.
 perform 1 from public.clients c where c.id=subject and c.tenant_id=tenant for update;
 if not found or public.is_active_pfleger_client(subject) is not true then raise exception 'Kein aktiver zugänglicher Pflegefall.' using errcode='42501';end if;
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
 occurred:=(payload->>'occurredAt')::timestamptz;
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
   if number_value<>trunc(number_value) or number_value<1 or number_value>case component when 'eyes' then 4 when 'verbal' then 5 else 6 end then raise exception 'GCS-Komponente prüfen.' using errcode='23514';end if;
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
grant execute on function care_private.record_vital_measurement(uuid,jsonb),public.record_ambulatory_vital_measurement(uuid,jsonb) to authenticated;
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
grant select on public.vital_measurement_follow_ups to authenticated;
drop policy if exists vital_follow_ups_read on public.vital_measurement_follow_ups;
create policy vital_follow_ups_read on public.vital_measurement_follow_ups for select to authenticated using(
 tenant_id=public.current_tenant_id() and public.has_permission('pflege.vitals.view') and public.is_active_pfleger_client(client_id)
 and exists(select 1 from public.profiles p where p.id=public.resolve_current_profile_id() and p.tenant_id=vital_measurement_follow_ups.tenant_id and p.is_active)
 and exists(select 1 from public.vital_sign_measurements m where m.id=measurement_id and m.tenant_id=vital_measurement_follow_ups.tenant_id and m.client_id=vital_measurement_follow_ups.client_id)
);
create or replace function care_private.record_vital_follow_up(request_id uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=care_private.assert_vital_actor('pflege.vitals.manage');tenant uuid:=public.current_tenant_id();m public.vital_sign_measurements%rowtype;previous public.vital_measurement_follow_ups%rowtype;observed timestamptz;next_review timestamptz;actor_name text;result_id uuid;
begin
 perform care_private.assert_vital_actor('pflege.vitals.view');
 if request_id is null or jsonb_typeof(payload) is distinct from 'object' or length(payload::text)>12000 then raise exception 'Ungültige Anfrage.' using errcode='23514';end if;
 select * into m from public.vital_sign_measurements v where v.id=(payload->>'measurementId')::uuid and v.tenant_id=tenant for update;
 if m.id is null or public.is_active_pfleger_client(m.client_id) is not true then raise exception 'Messung nicht zugänglich.' using errcode='42501';end if;
 select * into previous from public.vital_measurement_follow_ups f where f.tenant_id=tenant and f.request_id=record_vital_follow_up.request_id;
 if previous.id is not null then
  if previous.measurement_id<>m.id or previous.recorded_by<>actor or previous.creation_payload<>payload then raise exception 'Anfrage mit anderen Daten verwendet.' using errcode='23514';end if;return previous.id;
 end if;
 if coalesce(payload->>'observedAt','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.][0-9]{1,3})?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$' then raise exception 'Kontrollzeit mit Zeitzone fehlt.' using errcode='23514';end if;
 observed:=(payload->>'observedAt')::timestamptz;
 if observed>clock_timestamp() or (m.occurred_at is not null and observed<m.occurred_at) then raise exception 'Kontrollzeitpunkt prüfen.' using errcode='23514';end if;
 if payload->>'outcome'='ongoing' then
  if coalesce(payload->>'nextReviewAt','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.][0-9]{1,3})?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$' then raise exception 'Nächster Kontrolltermin fehlt.' using errcode='23514';end if;
  next_review:=(payload->>'nextReviewAt')::timestamptz;if next_review<=observed then raise exception 'Kontrolltermin muss nach Beobachtung liegen.' using errcode='23514';end if;
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
grant execute on function care_private.record_vital_follow_up(uuid,jsonb),public.record_ambulatory_vital_follow_up(uuid,jsonb) to authenticated;
commit;
