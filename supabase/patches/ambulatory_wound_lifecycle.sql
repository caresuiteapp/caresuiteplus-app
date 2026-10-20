-- LOCAL REVIEW ONLY. Apply after ambulatory_wound_documentation.sql in an approved test database.
-- Existing native writers remain unchanged; their concurrency/compatibility must be tested before release.
begin;
create table if not exists public.ambulatory_wound_lifecycle_events(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),
 client_id uuid not null references public.clients(id),wound_case_id uuid not null references public.clinical_wound_cases(id),
 action text not null check(action in ('close','reopen')),closure_kind text not null,
 previous_status text not null,resulting_status text not null,occurred_at timestamptz not null,
 reason text not null,decision_basis text not null,handover text not null,
 assessment_id uuid references public.clinical_wound_assessments(id),case_snapshot jsonb not null,assessment_snapshot jsonb,
 recorded_by uuid not null,recorded_by_name text not null,created_at timestamptz not null default clock_timestamp(),
 check((action='close' and closure_kind in ('healed','transfer','care_ended','other')) or (action='reopen' and closure_kind=''))
);
create index if not exists ambulatory_wound_lifecycle_scope on public.ambulatory_wound_lifecycle_events(tenant_id,wound_case_id,created_at desc,id desc);
alter table public.ambulatory_wound_lifecycle_events enable row level security;
revoke all on public.ambulatory_wound_lifecycle_events from public,anon,authenticated;
grant select on public.ambulatory_wound_lifecycle_events to authenticated;
drop policy if exists wound_lifecycle_read on public.ambulatory_wound_lifecycle_events;
create policy wound_lifecycle_read on public.ambulatory_wound_lifecycle_events for select to authenticated using(true);
drop policy if exists wound_lifecycle_scope on public.ambulatory_wound_lifecycle_events;
create policy wound_lifecycle_scope on public.ambulatory_wound_lifecycle_events as restrictive for select to authenticated using(
 auth.uid() is not null and tenant_id=public.current_tenant_id() and public.has_permission('pflege.wounds.view')
 and public.is_active_pfleger_client(client_id)
 and exists(select 1 from public.profiles p where p.id=public.resolve_current_profile_id() and p.tenant_id=ambulatory_wound_lifecycle_events.tenant_id and p.is_active)
 and exists(select 1 from public.clinical_wound_cases w where w.id=ambulatory_wound_lifecycle_events.wound_case_id and w.tenant_id=ambulatory_wound_lifecycle_events.tenant_id and w.client_id=ambulatory_wound_lifecycle_events.client_id)
);
create table if not exists care_private.wound_lifecycle_requests(
 tenant_id uuid not null,request_id uuid not null,actor_id uuid not null,payload jsonb not null,result_id uuid not null,
 created_at timestamptz not null default clock_timestamp(),primary key(tenant_id,request_id)
);
alter table care_private.wound_lifecycle_requests enable row level security;
revoke all on care_private.wound_lifecycle_requests from public,anon,authenticated;
create or replace function care_private.write_wound_lifecycle(request_id uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare tenant uuid:=public.current_tenant_id();actor uuid:=public.resolve_current_profile_id();actor_name text;
 w public.clinical_wound_cases%rowtype;a public.clinical_wound_assessments%rowtype;
 previous public.ambulatory_wound_lifecycle_events%rowtype;receipt care_private.wound_lifecycle_requests%rowtype;
 d jsonb;field text;subject uuid;at_time timestamptz;new_status text;result_id uuid;
 keys text[]:=array['action','occurredAt','reason','decisionBasis','handover','closureKind','expectedUpdatedAt','expectedStatus','expectedAssessmentId'];
begin
 if auth.uid() is null or tenant is null or public.has_permission('pflege.wounds.view') is not true or public.has_permission('pflege.wounds.manage') is not true
 or not exists(select 1 from public.profiles p where p.id=actor and p.tenant_id=tenant and p.is_active) then raise exception 'Keine Berechtigung oder kein aktives Profil.' using errcode='42501';end if;
 if request_id is null or jsonb_typeof(payload) is distinct from 'object' or (payload-array['woundId','dataJson'])<>'{}'::jsonb
 or jsonb_typeof(payload->'woundId') is distinct from 'string' or jsonb_typeof(payload->'dataJson') is distinct from 'string'
 or length(payload->>'dataJson')>16000 then raise exception 'Ungültige Fallstatusanfrage.' using errcode='23514';end if;
 -- Serializes reuse of one request ID even when the submitted case differs.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(tenant::text||':wound-lifecycle:'||request_id::text,0));
 select * into w from public.clinical_wound_cases c where c.id=(payload->>'woundId')::uuid and c.tenant_id=tenant;subject:=w.client_id;
 perform 1 from public.clients c where c.id=subject and c.tenant_id=tenant for update;
 if not found or public.is_active_pfleger_client(subject) is not true then raise exception 'Kein aktiver zugänglicher Pflegefall.' using errcode='42501';end if;
 select * into receipt from care_private.wound_lifecycle_requests r where r.tenant_id=tenant and r.request_id=write_wound_lifecycle.request_id;
 if receipt.result_id is not null then
  if receipt.actor_id<>actor or receipt.payload<>payload then raise exception 'Anfrage mit anderen Daten verwendet.' using errcode='23514';end if;return receipt.result_id;
 end if;
 select * into w from public.clinical_wound_cases c where c.id=(payload->>'woundId')::uuid and c.tenant_id=tenant and c.client_id=subject for update;
 if w.id is null then raise exception 'Wundfall geändert oder nicht zugänglich.' using errcode='40001';end if;
 d:=(payload->>'dataJson')::jsonb;
 if jsonb_typeof(d) is distinct from 'object' or (d-keys)<>'{}'::jsonb then raise exception 'Ungültige Fallstatusangaben.' using errcode='23514';end if;
 foreach field in array keys loop
  if jsonb_typeof(d->field) is distinct from 'string' or length(d->>field)>2000 then raise exception 'Fallstatusangaben fehlen oder sind zu umfangreich.' using errcode='23514';end if;
 end loop;
 foreach field in array array['occurredAt','expectedUpdatedAt'] loop
  if d->>field !~ '^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.][0-9]{1,6})?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$' then raise exception 'Fallzeitpunkte prüfen.' using errcode='23514';end if;
 end loop;
 at_time:=(d->>'occurredAt')::timestamptz;
 if at_time>clock_timestamp() then raise exception 'Entscheidung liegt in der Zukunft.' using errcode='23514';end if;
 foreach field in array array['reason','decisionBasis','handover'] loop
  if nullif(btrim(d->>field),'') is null then raise exception 'Grund, Entscheidungsgrundlage und weitere Versorgung / Übergabe fehlen.' using errcode='23514';end if;
 end loop;
 select * into a from public.clinical_wound_assessments x where x.tenant_id=tenant and x.wound_case_id=w.id and x.client_id=subject order by x.created_at desc,x.id desc limit 1;
 if w.updated_at<>(d->>'expectedUpdatedAt')::timestamptz or w.status<>d->>'expectedStatus'
 or coalesce(a.id::text,'')<>coalesce(nullif(d->>'expectedAssessmentId','')::uuid::text,'') then raise exception 'Fall oder Assessment geändert. Entscheidung erneut prüfen.' using errcode='40001';end if;
 select * into previous from public.ambulatory_wound_lifecycle_events e where e.tenant_id=tenant and e.wound_case_id=w.id and e.client_id=subject order by e.created_at desc,e.id desc limit 1;
 if previous.id is not null and at_time<previous.occurred_at then raise exception 'Entscheidung liegt vor dem letzten Fallstatusereignis.' using errcode='23514';end if;
 if d->>'action'='close' then
  if w.status not in ('draft','active','healing','deteriorated') or d->>'closureKind' not in ('healed','transfer','care_ended','other') then raise exception 'Offenen Fall und Abschlussgrund prüfen.' using errcode='40001';end if;
  if d->>'closureKind'='healed' and (a.id is null or a.observed_at is null) then raise exception 'Abheilung benötigt einen zugeordneten tatsächlich erhobenen Befund.' using errcode='23514';end if;
  if exists(select 1 from public.clinical_wound_assessments x where x.tenant_id=tenant and x.client_id=subject and x.wound_case_id=w.id and x.observed_at>at_time) then raise exception 'Abschluss liegt vor einem dokumentierten Befund.' using errcode='23514';end if;
  new_status:=case when d->>'closureKind'='healed' then 'healed' else 'archived' end;
 elsif d->>'action'='reopen' then
  if w.status not in ('healed','archived') or d->>'closureKind'<>'' then raise exception 'Nur abgeschlossene Wundfälle wiederöffnen.' using errcode='40001';end if;
  new_status:='draft';
 else raise exception 'Fallstatusaktion fehlt.' using errcode='23514';end if;
 select coalesce(nullif(p.display_name,''),p.email,'Pflegekraft') into actor_name from public.profiles p where p.id=actor and p.tenant_id=tenant and p.is_active;
 insert into public.ambulatory_wound_lifecycle_events(tenant_id,client_id,wound_case_id,action,closure_kind,previous_status,resulting_status,occurred_at,reason,decision_basis,handover,assessment_id,case_snapshot,assessment_snapshot,recorded_by,recorded_by_name)
 values(tenant,subject,w.id,d->>'action',d->>'closureKind',w.status,new_status,at_time,btrim(d->>'reason'),btrim(d->>'decisionBasis'),btrim(d->>'handover'),a.id,to_jsonb(w),case when a.id is not null then to_jsonb(a) else null end,actor,actor_name) returning id into result_id;
 update public.clinical_wound_cases set status=new_status,updated_at=clock_timestamp() where id=w.id and tenant_id=tenant;
 -- No deletion, invented healing measurements, plan approval or automatic closure of alerts/orders.
 insert into care_private.wound_lifecycle_requests(tenant_id,request_id,actor_id,payload,result_id) values(tenant,request_id,actor,payload,result_id);
 insert into public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,before_data,after_data,actor_id,actor_name)
 values(tenant,subject,'wound_lifecycle',result_id,d->>'action','Wundfallstatus mit Begründung geändert',to_jsonb(w),jsonb_build_object('status',new_status,'eventId',result_id,'decision',d),actor,actor_name);
 return result_id;
end $$;
create or replace function public.write_ambulatory_wound_lifecycle(request_id uuid,payload jsonb)
returns uuid language sql security invoker set search_path='' as $$select care_private.write_wound_lifecycle(request_id,payload)$$;
revoke all on function care_private.write_wound_lifecycle(uuid,jsonb),public.write_ambulatory_wound_lifecycle(uuid,jsonb) from public,anon;
grant execute on function care_private.write_wound_lifecycle(uuid,jsonb),public.write_ambulatory_wound_lifecycle(uuid,jsonb) to authenticated;
commit;
