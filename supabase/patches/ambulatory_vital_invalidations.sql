-- LOCAL REVIEW ONLY. Apply after ambulatory_vital_documentation.sql.
-- Invalidates a documented measurement; never overwrites its original values.
begin;
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
grant select on public.vital_measurement_invalidations to authenticated;
drop policy if exists vital_invalidations_read on public.vital_measurement_invalidations;
create policy vital_invalidations_read on public.vital_measurement_invalidations for select to authenticated using(
 tenant_id=public.current_tenant_id() and public.has_permission('pflege.vitals.view') and public.is_active_pfleger_client(client_id)
 and exists(select 1 from public.profiles p where p.id=public.resolve_current_profile_id() and p.tenant_id=vital_measurement_invalidations.tenant_id and p.is_active)
 and exists(select 1 from public.vital_sign_measurements m where m.id=measurement_id and m.tenant_id=vital_measurement_invalidations.tenant_id and m.client_id=vital_measurement_invalidations.client_id)
);
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
 if m.id is null or public.is_active_pfleger_client(m.client_id) is not true then raise exception 'Messung nicht zugänglich.' using errcode='42501';end if;
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
grant execute on function care_private.invalidate_vital_measurement(uuid,jsonb),public.invalidate_ambulatory_vital_measurement(uuid,jsonb) to authenticated;
commit;
