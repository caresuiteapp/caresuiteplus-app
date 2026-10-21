-- LOCAL REVIEW ONLY. Requires live_medication_ambulatory_intensive migration.
-- Release gate: existing native/legacy direct writers need compatibility review.
-- Never apply to production as part of verification.
begin;
create schema if not exists care_private;
revoke all on schema care_private from public, anon;
grant usage on schema care_private to authenticated;
alter table public.medication_administrations
 add column if not exists occurred_at timestamptz,
 add column if not exists creation_request_id uuid,
 add column if not exists creation_payload jsonb,
 add column if not exists order_snapshot jsonb,
 add column if not exists recorded_by_name text,
 add column if not exists witnessed_by_name text;
create unique index if not exists medication_administration_request on public.medication_administrations(tenant_id,creation_request_id) where creation_request_id is not null;
-- Historic administered_at values may be server recording times. Do not backfill actual event times.
alter table public.medication_administrations drop constraint if exists medication_administration_time_required;

create or replace function care_private.assert_medication_actor(permission_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.resolve_current_profile_id();
begin
 if auth.uid() is null or public.current_tenant_id() is null or public.has_permission(permission_name) is not true
 or not exists(select 1 from public.profiles p where p.id=actor and p.tenant_id=public.current_tenant_id() and p.is_active) then
 raise exception 'Keine Berechtigung oder kein aktives Benutzerprofil.' using errcode='42501'; end if;
 return actor;
end $$;
revoke all on function care_private.assert_medication_actor(text) from public, anon, authenticated;

create or replace function public.enforce_medication_administration_scope()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare m public.medications%rowtype; actual boolean; event_day date;
begin
 select * into m from public.medications where id=new.medication_id for update;
 if m.id is null or m.tenant_id<>new.tenant_id or m.client_id<>new.client_id then
 raise exception 'Verordnung, Mandant und Klient:in stimmen nicht überein.' using errcode='23514'; end if;
 if m.status<>'active' then raise exception 'Nur aktive Verordnungen dürfen dokumentiert werden.' using errcode='23514'; end if;
 if new.creation_request_id is null or new.creation_payload is null or new.occurred_at is null or new.status not in ('administered','late','omitted','refused','held') then
 raise exception 'Vollständige ereignisbezogene Dokumentation erforderlich.' using errcode='23514'; end if;
 event_day := (new.occurred_at at time zone 'Europe/Berlin')::date;
 if new.occurred_at>clock_timestamp() or (m.start_date is not null and event_day<m.start_date) or (m.end_date is not null and event_day>m.end_date) then
 raise exception 'Ereigniszeitpunkt ist zukünftig oder außerhalb der Verordnungsgültigkeit.' using errcode='23514'; end if;
 actual := new.status in ('administered','late');
 if actual then
  if nullif(btrim(new.administered_dose),'') is null or nullif(btrim(new.route),'') is null then
  raise exception 'Tatsächliche Dosis und Applikation erforderlich.' using errcode='23514'; end if;
  if m.is_prn and nullif(btrim(new.prn_reason),'') is null then raise exception 'Bedarfsindikation fehlt.' using errcode='23514'; end if;
  if m.is_controlled_substance and new.witnessed_by is null then raise exception 'BtM-Gabe erfordert Gegenkontrolle.' using errcode='23514'; end if;
 else
  if new.administered_dose is not null or new.route is not null or new.witnessed_by is not null or new.prn_reason is not null or new.pain_score_before is not null then
  raise exception 'Nichtgabe darf keine tatsächlichen Gabeangaben enthalten.' using errcode='23514'; end if;
 end if;
 if new.witnessed_by is not null and (new.witnessed_by=new.administered_by or not exists(select 1 from public.profiles p where p.id=new.witnessed_by and p.tenant_id=new.tenant_id and p.is_active)) then
 raise exception 'Gegenkontrolle muss durch eine andere aktive Person desselben Mandanten erfolgen.' using errcode='23514'; end if;
 new.created_at:=clock_timestamp();
 new.administered_at:=case when actual then new.occurred_at else null end;
 new.order_snapshot:=to_jsonb(m)-'created_by'-'updated_by';
 select coalesce(nullif(to_jsonb(p)->>'full_name',''),nullif(p.display_name,''),p.email,'Pflegekraft') into new.recorded_by_name from public.profiles p where p.id=new.administered_by;
 select coalesce(nullif(to_jsonb(p)->>'full_name',''),nullif(p.display_name,''),p.email,'Pflegekraft') into new.witnessed_by_name from public.profiles p where p.id=new.witnessed_by;
 return new;
end $$;

create or replace function care_private.record_medication_event(medication_id uuid, request_id uuid, payload jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare m public.medications%rowtype; previous public.medication_administrations%rowtype;
 actor uuid:=care_private.assert_medication_actor('pflege.medications.administer'); result_id uuid; pain numeric;
begin
 if request_id is null or jsonb_typeof(payload) is distinct from 'object' then raise exception 'Anfrage und Daten erforderlich.' using errcode='23514'; end if;
 select * into m from public.medications where id=medication_id and tenant_id=public.current_tenant_id() for update;
 if m.id is null or public.is_active_pfleger_client(m.client_id) is not true then raise exception 'Verordnung nicht zugänglich.' using errcode='42501'; end if;
 select * into previous from public.medication_administrations a where a.tenant_id=m.tenant_id and a.creation_request_id=request_id;
 if previous.id is not null then
  if previous.medication_id<>m.id or previous.administered_by<>actor or previous.creation_payload<>payload then raise exception 'Anfrage wurde mit anderen Daten verwendet.' using errcode='23514'; end if;
  return previous.id;
 end if;
 if payload->>'expectedUpdatedAt' is null or (payload->>'expectedUpdatedAt')::timestamptz is distinct from m.updated_at then raise exception 'Verordnung wurde geändert. Neu laden und prüfen.' using errcode='40001'; end if;
 if coalesce(payload->>'occurredAt','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.][0-9]{1,6})?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$' then
 raise exception 'Ereigniszeitpunkt mit Zeitzone erforderlich.' using errcode='23514'; end if;
 if payload->'painScoreBefore' is not null and payload->'painScoreBefore'<>'null'::jsonb then
  if jsonb_typeof(payload->'painScoreBefore')<>'number' then raise exception 'Ungültige Schmerzskala.' using errcode='23514'; end if;
  pain:=(payload->>'painScoreBefore')::numeric;
  if pain<>trunc(pain) or pain<0 or pain>10 then raise exception 'Ungültige Schmerzskala.' using errcode='23514'; end if;
 end if;
 insert into public.medication_administrations(tenant_id,medication_id,client_id,status,occurred_at,creation_request_id,creation_payload,administered_by,administered_dose,route,deviation_reason,prn_reason,pain_score_before,notes,witnessed_by)
 values(m.tenant_id,m.id,m.client_id,payload->>'status',(payload->>'occurredAt')::timestamptz,request_id,payload,actor,nullif(btrim(payload->>'dose'),''),nullif(btrim(payload->>'route'),''),nullif(btrim(payload->>'deviationReason'),''),nullif(btrim(payload->>'prnReason'),''),pain::smallint,nullif(btrim(payload->>'notes'),''),nullif(payload->>'witnessProfileId','')::uuid) returning id into result_id;
 return result_id;
end $$;
create or replace function public.record_ambulatory_medication_event(medication_id uuid, request_id uuid, payload jsonb)
returns uuid language sql security invoker set search_path = '' as $$select care_private.record_medication_event(medication_id,request_id,payload)$$;
revoke all on function care_private.record_medication_event(uuid,uuid,jsonb),public.record_ambulatory_medication_event(uuid,uuid,jsonb) from public,anon;
grant execute on function care_private.record_medication_event(uuid,uuid,jsonb),public.record_ambulatory_medication_event(uuid,uuid,jsonb) to authenticated;
revoke insert,update,delete on public.medication_administrations from authenticated;

create table if not exists public.medication_administration_followups(
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id),
 administration_id uuid not null references public.medication_administrations(id), request_id uuid not null,
 payload jsonb not null, observed_at timestamptz not null, observation text not null, action text not null,
 pain_score smallint check(pain_score between 0 and 10), recorded_by uuid not null references public.profiles(id),
 recorded_by_name text not null, created_at timestamptz not null default clock_timestamp(), unique(tenant_id,request_id)
);
alter table public.medication_administration_followups enable row level security;
drop policy if exists medication_followups_select on public.medication_administration_followups;
create policy medication_followups_select on public.medication_administration_followups for select to authenticated using(
 tenant_id=public.current_tenant_id() and public.has_permission('pflege.medications.view') and exists(
 select 1 from public.medication_administrations a where a.id=administration_id and a.tenant_id=public.current_tenant_id() and public.is_active_pfleger_client(a.client_id))
);
grant select on public.medication_administration_followups to authenticated;
revoke insert,update,delete on public.medication_administration_followups from authenticated;
create or replace function care_private.record_medication_followup(administration_id uuid,request_id uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare a public.medication_administrations%rowtype; old public.medication_administration_followups%rowtype;
 actor uuid:=care_private.assert_medication_actor('pflege.medications.administer'); result_id uuid; moment timestamptz; pain numeric; actor_name text;
begin
 if request_id is null or jsonb_typeof(payload) is distinct from 'object' then raise exception 'Anfrage und Daten erforderlich.' using errcode='23514'; end if;
 select * into a from public.medication_administrations where id=administration_id and tenant_id=public.current_tenant_id() for update;
 if a.id is null or public.is_active_pfleger_client(a.client_id) is not true then raise exception 'Dokumentation nicht zugänglich.' using errcode='42501'; end if;
 select * into old from public.medication_administration_followups f where f.tenant_id=a.tenant_id and f.request_id=record_medication_followup.request_id;
 if old.id is not null then
 if old.administration_id<>a.id or old.recorded_by<>actor or old.payload<>payload then raise exception 'Anfrage wurde mit anderen Daten verwendet.' using errcode='23514'; end if;
 return old.id; end if;
 if a.status not in ('administered','late') or a.occurred_at is null then raise exception 'Bestätigter tatsächlicher Gabezeitpunkt fehlt.' using errcode='23514'; end if;
 if coalesce(payload->>'observedAt','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.][0-9]{1,6})?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$' then raise exception 'Kontrollzeitpunkt mit Zeitzone erforderlich.' using errcode='23514'; end if;
 moment:=(payload->>'observedAt')::timestamptz;
 if moment<a.occurred_at or moment>clock_timestamp() or nullif(btrim(payload->>'observation'),'') is null or nullif(btrim(payload->>'action'),'') is null then raise exception 'Kontrollzeitpunkt, Beobachtung und Maßnahme prüfen.' using errcode='23514'; end if;
 if payload->'painScore' is not null and payload->'painScore'<>'null'::jsonb then
 if jsonb_typeof(payload->'painScore')<>'number' then raise exception 'Ungültige Schmerzskala.' using errcode='23514'; end if;
 pain:=(payload->>'painScore')::numeric;
 if pain<>trunc(pain) or pain<0 or pain>10 then raise exception 'Ungültige Schmerzskala.' using errcode='23514'; end if; end if;
 select coalesce(nullif(to_jsonb(p)->>'full_name',''),nullif(p.display_name,''),p.email,'Pflegekraft') into actor_name from public.profiles p where p.id=actor;
 insert into public.medication_administration_followups(tenant_id,administration_id,request_id,payload,observed_at,observation,action,pain_score,recorded_by,recorded_by_name)
 values(a.tenant_id,a.id,request_id,payload,moment,btrim(payload->>'observation'),btrim(payload->>'action'),pain::smallint,actor,actor_name) returning id into result_id;
 return result_id;
end $$;
create or replace function public.record_ambulatory_medication_followup(administration_id uuid,request_id uuid,payload jsonb)
returns uuid language sql security invoker set search_path = '' as $$select care_private.record_medication_followup(administration_id,request_id,payload)$$;
revoke all on function care_private.record_medication_followup(uuid,uuid,jsonb),public.record_ambulatory_medication_followup(uuid,uuid,jsonb) from public,anon;
grant execute on function care_private.record_medication_followup(uuid,uuid,jsonb),public.record_ambulatory_medication_followup(uuid,uuid,jsonb) to authenticated;

-- Status transitions are reasoned, version-checked and append-only.
create table if not exists public.medication_order_status_events(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),
 medication_id uuid not null references public.medications(id),request_id uuid not null,payload jsonb not null,
 previous_status text not null,next_status text not null,reason text not null,
 before_data jsonb not null,after_data jsonb not null,recorded_by uuid not null references public.profiles(id),
 recorded_by_name text not null,created_at timestamptz not null default clock_timestamp(),unique(tenant_id,request_id)
);
alter table public.medication_order_status_events enable row level security;
drop policy if exists medication_status_events_select on public.medication_order_status_events;
create policy medication_status_events_select on public.medication_order_status_events for select to authenticated using(
 tenant_id=public.current_tenant_id() and public.has_permission('pflege.medications.view') and exists(
 select 1 from public.medications m where m.id=medication_id and m.tenant_id=public.current_tenant_id() and public.is_active_pfleger_client(m.client_id))
);
grant select on public.medication_order_status_events to authenticated;
revoke insert,update,delete on public.medication_order_status_events from authenticated;
revoke update,delete on public.medications from authenticated;
create or replace function care_private.change_medication_status(medication_id uuid,request_id uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare m public.medications%rowtype; old public.medication_order_status_events%rowtype;
 actor uuid:=care_private.assert_medication_actor('pflege.medications.manage');
 next_value text:=payload->>'status'; result_id uuid; after_value jsonb; actor_name text;
 today date:=(clock_timestamp() at time zone 'Europe/Berlin')::date;
begin
 if request_id is null or jsonb_typeof(payload) is distinct from 'object' then raise exception 'Anfrage und Daten erforderlich.' using errcode='23514'; end if;
 select * into m from public.medications where id=medication_id and tenant_id=public.current_tenant_id() for update;
 if m.id is null or public.is_active_pfleger_client(m.client_id) is not true then raise exception 'Verordnung nicht zugänglich.' using errcode='42501'; end if;
 select * into old from public.medication_order_status_events e where e.tenant_id=m.tenant_id and e.request_id=change_medication_status.request_id;
 if old.id is not null then
 if old.medication_id<>m.id or old.recorded_by<>actor or old.payload<>payload then raise exception 'Anfrage wurde mit anderen Daten verwendet.' using errcode='23514'; end if;
 return old.id; end if;
 if payload->>'expectedUpdatedAt' is null or (payload->>'expectedUpdatedAt')::timestamptz is distinct from m.updated_at then raise exception 'Verordnung wurde geändert. Neu laden und prüfen.' using errcode='40001'; end if;
 if nullif(btrim(payload->>'reason'),'') is null then raise exception 'Begründung der Statusänderung fehlt.' using errcode='23514'; end if;
 if not ((m.status='active' and next_value in ('paused','stopped')) or (m.status='paused' and next_value in ('active','stopped'))) or next_value is null then
 raise exception 'Dieser Statusübergang ist nicht zulässig.' using errcode='23514'; end if;
 if next_value='active' and ((m.start_date is not null and today<m.start_date) or (m.end_date is not null and today>m.end_date)) then raise exception 'Verordnung ist aktuell nicht gültig.' using errcode='23514'; end if;
 update public.medications set status=next_value::public.medication_status,updated_at=clock_timestamp(),updated_by=actor,
 end_date=case when next_value='stopped' then least(coalesce(end_date,today),today) else end_date end where id=m.id returning to_jsonb(medications.*) into after_value;
 select coalesce(nullif(to_jsonb(p)->>'full_name',''),nullif(p.display_name,''),p.email,'Pflegekraft') into actor_name from public.profiles p where p.id=actor;
 insert into public.medication_order_status_events(tenant_id,medication_id,request_id,payload,previous_status,next_status,reason,before_data,after_data,recorded_by,recorded_by_name)
 values(m.tenant_id,m.id,request_id,payload,m.status::text,next_value,btrim(payload->>'reason'),to_jsonb(m),after_value,actor,actor_name) returning id into result_id;
 return result_id;
end $$;
create or replace function public.change_ambulatory_medication_status(medication_id uuid,request_id uuid,payload jsonb)
returns uuid language sql security invoker set search_path = '' as $$select care_private.change_medication_status(medication_id,request_id,payload)$$;
revoke all on function care_private.change_medication_status(uuid,uuid,jsonb),public.change_ambulatory_medication_status(uuid,uuid,jsonb) from public,anon;
grant execute on function care_private.change_medication_status(uuid,uuid,jsonb),public.change_ambulatory_medication_status(uuid,uuid,jsonb) to authenticated;
commit;
