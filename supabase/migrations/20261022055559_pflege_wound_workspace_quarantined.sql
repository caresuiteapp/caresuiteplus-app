-- Consolidated quarantined Wound Staging API. Native Android/shared legacy writers are untouched.
-- Technical documentation preserves unknown observations; no clinical defaults or broad grants.
-- Requires existing native clinical tables and care_private.require_workspace_session(uuid,uuid).
create schema if not exists care_private;

create or replace function care_private.wound_has_permission(required text)
returns boolean language plpgsql security definer set search_path='' as $$
declare tenant uuid:=public.current_tenant_id();actor uuid:=public.resolve_current_profile_id();own_role uuid;
begin
 perform care_private.require_workspace_session(tenant,actor);
 select p.role_id into own_role from public.profiles p where p.id=actor and p.tenant_id=tenant and p.is_active and p.status='active' for share;
 perform 1 from public.role_permissions rp where rp.role_id=own_role for share;
 return exists(select 1 from public.role_permissions rp where rp.role_id=own_role and (rp.permission_key=required or(rp.permission_key=split_part(required,'.',2) and((required like '%.view' and coalesce(rp.can_view,false))or(required like '%.manage' and coalesce(rp.can_update,false))))));
end$$;
create or replace function care_private.wound_active_client(subject uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare tenant uuid:=public.current_tenant_id();actor uuid:=public.resolve_current_profile_id();
begin
 perform care_private.require_workspace_session(tenant,actor);
 perform 1 from public.clients c where c.id=subject and c.tenant_id=tenant and c.status::text in('active','aktiv') and c.lifecycle_status::text in('active','aktiv') and to_jsonb(c)->>'deleted_at' is null for share;
 if not found then return false;end if;
 perform 1 from public.client_module_assignments a where a.tenant_id=tenant and a.client_id=subject and a.module_key='pflege' and a.is_active and a.status in('active','aktiv') for share;
 return found;
end$$;


-- Source: ambulatory_wound_documentation.sql (quarantined, with final hardening below).
-- LOCAL REVIEW ONLY. Existing clinical tables required. No native writer changed.

create schema if not exists care_private;

alter table public.clinical_wound_cases add column if not exists documentation_details jsonb;
alter table public.clinical_wound_assessments add column if not exists observed_at timestamptz,add column if not exists documentation_details jsonb;
-- Do not relabel historical assessed_at (capture) as an actual observation time.
create table if not exists care_private.wound_requests(
 tenant_id uuid not null,request_id uuid not null,actor_id uuid not null,payload jsonb not null,result_id uuid not null,
 created_at timestamptz not null default clock_timestamp(),primary key(tenant_id,request_id)
);
alter table care_private.wound_requests enable row level security;
revoke all on care_private.wound_requests from public,anon,authenticated;
create or replace function care_private.write_wound_documentation(request_id uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare tenant uuid:=public.current_tenant_id();actor uuid:=public.resolve_current_profile_id();person_name text;
 subject uuid;w public.clinical_wound_cases%rowtype;receipt care_private.wound_requests%rowtype;d jsonb;keys text[];field text;result_id uuid;
 review_time timestamptz;observed_time timestamptz;length_value numeric;width_value numeric;depth_value numeric;pain_value integer;v numeric;
begin
 if auth.uid() is null or tenant is null or care_private.wound_has_permission('pflege.wounds.manage') is not true or care_private.wound_has_permission('pflege.wounds.view') is not true
 or not exists(select 1 from public.profiles p where p.id=actor and p.tenant_id=tenant and p.is_active) then raise exception 'Keine Berechtigung oder kein aktives Profil.' using errcode='42501';end if;
 if request_id is null or jsonb_typeof(payload) is distinct from 'object' or not(payload ?& array['action','subjectId','dataJson']) or length(payload::text)>150000
 or (payload-array['action','subjectId','dataJson'])<>'{}'::jsonb or coalesce(payload->>'action','') not in ('create','assessment')
 or jsonb_typeof(payload->'dataJson') is distinct from 'string' or length(payload->>'dataJson')>40000 then raise exception 'Ungültige Wundanfrage.' using errcode='23514';end if;
 perform pg_advisory_xact_lock(hashtextextended(tenant||':wound-documentation-request:'||request_id,0));
 if payload->>'action'='create' then subject:=(payload->>'subjectId')::uuid;
 else select * into w from public.clinical_wound_cases c where c.id=(payload->>'subjectId')::uuid and c.tenant_id=tenant;subject:=w.client_id;end if;
 perform pg_advisory_xact_lock(hashtextextended('wound-client:'||tenant||':'||subject,0));
 perform 1 from public.clients c where c.id=subject and c.tenant_id=tenant for update;
 if not found or care_private.wound_active_client(subject) is not true then raise exception 'Kein aktiver zugänglicher Pflegefall.' using errcode='42501';end if;
 select * into receipt from care_private.wound_requests r where r.tenant_id=tenant and r.request_id=write_wound_documentation.request_id;
 if receipt.result_id is not null then
  if receipt.actor_id<>actor or receipt.payload<>payload then raise exception 'Anfrage mit anderen Daten verwendet.' using errcode='23514';end if;return receipt.result_id;
 end if;
 d:=(payload->>'dataJson')::jsonb;
 keys:=case when payload->>'action'='create' then array['bodyLocation','side','woundType','etiology','onsetDate','onsetUnknownReason','acquiredWhere','description','basisStatus','basisReference','physician','carePlan','nextReviewAt','reviewStatus','reviewPendingReason']
 else array['observedAt','measurementMethod','lengthState','lengthCm','lengthReason','widthState','widthCm','widthReason','depthState','depthCm','depthReason','woundBed','exudate','odor','woundEdge','surroundingSkin','painState','painScore','painReason','infectionObservation','personalImpact','preferences','selfManagement','actualAction','response','nextReviewAt','reviewStatus','reviewPendingReason'] end;
 if jsonb_typeof(d) is distinct from 'object' or (d-keys)<>'{}'::jsonb then raise exception 'Ungültige Wundangaben.' using errcode='23514';end if;
 foreach field in array keys loop
  if jsonb_typeof(d->field) is distinct from 'string' or length(d->>field)>2000 then raise exception 'Wundangabe fehlt oder ist zu umfangreich.' using errcode='23514';end if;
 end loop;
 if d->>'reviewStatus'='scheduled' then
  if coalesce(d->>'nextReviewAt','') !~ '^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.][0-9]{1,3})?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$' or nullif(btrim(d->>'reviewPendingReason'),'') is not null then raise exception 'Vereinbarten Kontrolltermin prüfen.' using errcode='23514';end if;
  review_time:=(d->>'nextReviewAt')::timestamptz;if review_time<=clock_timestamp() then raise exception 'Kontrolltermin liegt nicht in der Zukunft.' using errcode='23514';end if;
 elsif d->>'reviewStatus'='pending' and d->>'nextReviewAt'='' and nullif(btrim(d->>'reviewPendingReason'),'') is not null then review_time:=null;
 else raise exception 'Kontrolltermin oder offene Terminabstimmung dokumentieren.' using errcode='23514';end if;
 select coalesce(nullif(p.display_name,''),p.email,'Pflegekraft') into person_name from public.profiles p where p.id=actor and p.tenant_id=tenant and p.is_active;
 if payload->>'action'='create' then
  foreach field in array array['bodyLocation','woundType','etiology','acquiredWhere','description','basisReference'] loop
   if nullif(btrim(d->>field),'') is null then raise exception 'Wundbeschreibung und Grundlage fehlen.' using errcode='23514';end if;
  end loop;
  if d->>'side' not in ('left','right','midline','bilateral','not_applicable') or d->>'basisStatus' not in ('documented','pending','not_required')
  or (d->>'basisStatus'='documented' and nullif(btrim(d->>'physician'),'') is null) then raise exception 'Körperseite und ärztliche Grundlage ausdrücklich dokumentieren.' using errcode='23514';end if;
  if d->>'onsetDate'='' then
   if nullif(btrim(d->>'onsetUnknownReason'),'') is null then raise exception 'Unbekanntes Entstehungsdatum begründen.' using errcode='23514';end if;
  elsif (d->>'onsetDate') !~ '^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}$' or (d->>'onsetDate')::date>(clock_timestamp() at time zone 'Europe/Berlin')::date or nullif(btrim(d->>'onsetUnknownReason'),'') is not null then raise exception 'Entstehungsdatum prüfen.' using errcode='23514';end if;
 perform care_private.require_workspace_session(tenant,actor);
  insert into public.clinical_wound_cases(tenant_id,client_id,body_location,wound_type,etiology,onset_date,acquired_where,treatment_plan,physician_involved,ordering_physician,status,next_review_at,recorded_by,recorded_by_name,documentation_details)
  values(tenant,subject,btrim(d->>'bodyLocation'),btrim(d->>'woundType'),btrim(d->>'etiology'),nullif(d->>'onsetDate','')::date,btrim(d->>'acquiredWhere'),btrim(d->>'carePlan'),d->>'basisStatus'='documented',btrim(d->>'physician'),'draft',review_time,actor,person_name,d) returning id into result_id;
  -- No invented initial assessment, measurement, bodymap marker or executed treatment.
 else
  select * into w from public.clinical_wound_cases c where c.id=(payload->>'subjectId')::uuid and c.tenant_id=tenant and c.client_id=subject for update;
  if w.id is null or w.status not in ('draft','active','healing','deteriorated') then raise exception 'Wundfall für Assessment nicht offen.' using errcode='40001';end if;
  if coalesce(d->>'observedAt','') !~ '^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.][0-9]{1,3})?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$' then raise exception 'Assessmentzeitpunkt fehlt.' using errcode='23514';end if;
  observed_time:=(d->>'observedAt')::timestamptz;if observed_time>clock_timestamp() then raise exception 'Assessmentzeitpunkt liegt in der Zukunft.' using errcode='23514';end if;
  foreach field in array array['length','width','depth'] loop
   if d->>(field||'State')='measured' then
    if (d->>(field||'Cm')) !~ '^[ ]*[0-9]+([.,][0-9]+)?[ ]*$' or nullif(btrim(d->>(field||'Reason')),'') is not null then raise exception 'Größe in cm prüfen.' using errcode='23514';end if;
    v:=replace(btrim(d->>(field||'Cm')),',','.')::numeric;if v>1000000 then raise exception 'Technische Zahlengrenze überschritten.' using errcode='23514';end if;
   elsif d->>(field||'State')='not_measurable' and nullif(btrim(d->>(field||'Cm')),'') is null and nullif(btrim(d->>(field||'Reason')),'') is not null then v:=null;
   else raise exception 'Messbarkeit und tatsächlichen Grund dokumentieren.' using errcode='23514';end if;
   if field='length' then length_value:=v;elsif field='width' then width_value:=v;else depth_value:=v;end if;
  end loop;
  foreach field in array array['measurementMethod','woundBed','exudate','odor','woundEdge','surroundingSkin','infectionObservation','personalImpact','preferences','selfManagement','actualAction','response'] loop
   if nullif(btrim(d->>field),'') is null then raise exception 'Wundassessment unvollständig.' using errcode='23514';end if;
  end loop;
  if d->>'painState'='NRS' then
   if d->>'painScore' !~ '^[0-9]{1,2}$' or (d->>'painScore')::integer>10 or nullif(btrim(d->>'painReason'),'') is not null then raise exception 'NRS 0–10 prüfen.' using errcode='23514';end if;pain_value:=(d->>'painScore')::integer;
  elsif d->>'painState'='not_assessable' and nullif(btrim(d->>'painScore'),'') is null and nullif(btrim(d->>'painReason'),'') is not null then pain_value:=null;
  else raise exception 'Schmerzerhebung dokumentieren.' using errcode='23514';end if;
 perform care_private.require_workspace_session(tenant,actor);
  insert into public.clinical_wound_assessments(tenant_id,client_id,wound_case_id,length_cm,width_cm,depth_cm,wound_bed,exudate,odor,wound_edge,surrounding_skin,pain_score,infection_signs,intervention,response,recorded_by,recorded_by_name,observed_at,documentation_details)
  values(tenant,subject,w.id,length_value,width_value,depth_value,d->>'woundBed',d->>'exudate',d->>'odor',d->>'woundEdge',d->>'surroundingSkin',pain_value,d->>'infectionObservation',d->>'actualAction',d->>'response',actor,person_name,observed_time,d) returning id into result_id;
  update public.clinical_wound_cases set updated_at=clock_timestamp() where id=w.id and tenant_id=tenant;
  -- Assessment advances only the technical version, not status, clinical plan or review completion.
 end if;
 insert into care_private.wound_requests(tenant_id,request_id,actor_id,payload,result_id) values(tenant,request_id,actor,payload,result_id);
 insert into public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name)
 values(tenant,subject,case when payload->>'action'='create' then 'wound_case' else 'wound_assessment' end,result_id,'created','Wunddokumentation gespeichert',d,actor,person_name);
 return result_id;
end $$;
create or replace function public.write_ambulatory_wound_documentation(request_id uuid,payload jsonb)
returns uuid language sql security invoker set search_path='' as $$select care_private.write_wound_documentation(request_id,payload)$$;
revoke all on function care_private.write_wound_documentation(uuid,jsonb),public.write_ambulatory_wound_documentation(uuid,jsonb) from public,anon;


-- Source: ambulatory_wound_lifecycle.sql (quarantined, with final hardening below).
-- LOCAL REVIEW ONLY. Apply after ambulatory_wound_documentation.sql in an approved test database.
-- Existing native writers remain unchanged; their concurrency/compatibility must be tested before release.

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

drop policy if exists wound_lifecycle_read on public.ambulatory_wound_lifecycle_events;
create policy wound_lifecycle_read on public.ambulatory_wound_lifecycle_events for select to authenticated using(true);
drop policy if exists wound_lifecycle_scope on public.ambulatory_wound_lifecycle_events;
create policy wound_lifecycle_scope on public.ambulatory_wound_lifecycle_events as restrictive for select to authenticated using(
 auth.uid() is not null and tenant_id=public.current_tenant_id() and care_private.wound_has_permission('pflege.wounds.view')
 and care_private.wound_active_client(client_id)
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
 if auth.uid() is null or tenant is null or care_private.wound_has_permission('pflege.wounds.view') is not true or care_private.wound_has_permission('pflege.wounds.manage') is not true
 or not exists(select 1 from public.profiles p where p.id=actor and p.tenant_id=tenant and p.is_active) then raise exception 'Keine Berechtigung oder kein aktives Profil.' using errcode='42501';end if;
 if request_id is null or jsonb_typeof(payload) is distinct from 'object' or (payload-array['woundId','dataJson'])<>'{}'::jsonb
 or jsonb_typeof(payload->'woundId') is distinct from 'string' or jsonb_typeof(payload->'dataJson') is distinct from 'string'
 or length(payload->>'dataJson')>16000 then raise exception 'Ungültige Fallstatusanfrage.' using errcode='23514';end if;
 -- Serializes reuse of one request ID even when the submitted case differs.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(tenant::text||':wound-lifecycle:'||request_id::text,0));
 select * into w from public.clinical_wound_cases c where c.id=(payload->>'woundId')::uuid and c.tenant_id=tenant;subject:=w.client_id;
 perform pg_advisory_xact_lock(hashtextextended('wound-client:'||tenant||':'||subject,0));
 perform 1 from public.clients c where c.id=subject and c.tenant_id=tenant for update;
 if not found or care_private.wound_active_client(subject) is not true then raise exception 'Kein aktiver zugänglicher Pflegefall.' using errcode='42501';end if;
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
 perform care_private.require_workspace_session(tenant,actor);
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


-- Source: ambulatory_wound_care.sql (quarantined, with final hardening below).
-- LOCAL REVIEW ONLY; requires wound_documentation, wound_lifecycle and existing care_medical_orders.
-- Documents plans and actual events. Does not issue prescriptions, certify qualification or create billing proofs.

create table if not exists public.ambulatory_wound_plan_versions(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),
 client_id uuid not null references public.clients(id),wound_case_id uuid not null references public.clinical_wound_cases(id),
 version integer not null check(version>0),previous_id uuid references public.ambulatory_wound_plan_versions(id),
 effective_from timestamptz not null,effective_until timestamptz,basis_state text not null check(basis_state in ('linked','pending','not_required')),
 medical_order_id uuid references public.care_medical_orders(id),order_snapshot jsonb,details jsonb not null,
 recorded_by uuid not null,recorded_by_name text not null,created_at timestamptz not null default clock_timestamp(),
 unique(tenant_id,wound_case_id,version),unique(tenant_id,wound_case_id,effective_from),check(effective_until is null or effective_until>effective_from)
);
create table if not exists public.ambulatory_wound_dressings(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),
 client_id uuid not null references public.clients(id),wound_case_id uuid not null references public.clinical_wound_cases(id),
 plan_id uuid references public.ambulatory_wound_plan_versions(id),plan_snapshot jsonb,
 execution_id uuid not null unique references public.clinical_treatment_executions(id),
 occurred_at timestamptz not null,outcome text not null check(outcome in ('performed','partial','omitted','refused','failed')),
 basis_state text not null check(basis_state in ('linked','unconfirmed')),details jsonb not null,
 recorded_by uuid not null,recorded_by_name text not null,created_at timestamptz not null default clock_timestamp()
);
create index if not exists wound_plan_history on public.ambulatory_wound_plan_versions(tenant_id,wound_case_id,created_at desc,id desc);
create index if not exists wound_dressing_history on public.ambulatory_wound_dressings(tenant_id,wound_case_id,created_at desc,id desc);
do $$declare tbl text;extra text;begin
 foreach tbl in array array['ambulatory_wound_plan_versions','ambulatory_wound_dressings'] loop
  execute format('alter table public.%I enable row level security',tbl);
  execute format('revoke all on public.%I from public,anon,authenticated',tbl);

  execute format('drop policy if exists wound_care_read on public.%I',tbl);
  execute format('create policy wound_care_read on public.%I for select to authenticated using(true)',tbl);
  execute format('drop policy if exists wound_care_scope on public.%I',tbl);
  extra:=case when tbl='ambulatory_wound_dressings' then ' and care_private.wound_has_permission(''pflege.treatment.view'')' else '' end;
  execute format('create policy wound_care_scope on public.%1$I as restrictive for select to authenticated using(
   auth.uid() is not null and tenant_id=public.current_tenant_id() and care_private.wound_has_permission(''pflege.wounds.view'') and care_private.wound_has_permission(''pflege.orders.view'')
   and care_private.wound_active_client(client_id)
   and exists(select 1 from public.profiles p where p.id=public.resolve_current_profile_id() and p.tenant_id=%1$I.tenant_id and p.is_active)
   and exists(select 1 from public.clinical_wound_cases w where w.id=%1$I.wound_case_id and w.tenant_id=%1$I.tenant_id and w.client_id=%1$I.client_id)%2$s)',tbl,extra);
 end loop;
end $$;
create table if not exists care_private.wound_care_requests(
 tenant_id uuid not null,request_id uuid not null,actor_id uuid not null,payload jsonb not null,result_id uuid not null,
 created_at timestamptz not null default clock_timestamp(),primary key(tenant_id,request_id)
);
alter table care_private.wound_care_requests enable row level security;
revoke all on care_private.wound_care_requests from public,anon,authenticated;
create or replace function care_private.check_wound_order(o public.care_medical_orders,tenant uuid,subject uuid,from_time timestamptz,until_time timestamptz)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if o.id is null or o.tenant_id<>tenant or o.client_id<>subject or o.status<>'active' or o.valid_from is null or o.ordered_at is null
 or nullif(btrim(o.description),'') is null or nullif(btrim(o.ordering_physician),'') is null
 or (from_time at time zone 'Europe/Berlin')::date<o.valid_from or (from_time at time zone 'Europe/Berlin')::date<o.ordered_at
 or (o.valid_until is not null and (coalesce(until_time,from_time) at time zone 'Europe/Berlin')::date>o.valid_until)
 then raise exception 'Anordnung gehört nicht zur Akte oder deckt den angegebenen Zeitraum nicht ab.' using errcode='23514';end if;
 -- Insurer status is retained independently, not treated as professional permission or automatically approved.
end $$;
revoke all on function care_private.check_wound_order(public.care_medical_orders,uuid,uuid,timestamptz,timestamptz) from public,anon,authenticated;
create or replace function care_private.write_wound_care(request_id uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare tenant uuid:=public.current_tenant_id();actor uuid:=public.resolve_current_profile_id();actor_name text;subject uuid;
 w public.clinical_wound_cases%rowtype;previous public.ambulatory_wound_plan_versions%rowtype;p public.ambulatory_wound_plan_versions%rowtype;
 o public.care_medical_orders%rowtype;receipt care_private.wound_care_requests%rowtype;
 d jsonb;keys text[];field text;at_time timestamptz;until_time timestamptz;review_time timestamptz;result_id uuid;execution uuid;materials jsonb;m jsonb;value numeric;
begin
 if auth.uid() is null or tenant is null or care_private.wound_has_permission('pflege.wounds.view') is not true or care_private.wound_has_permission('pflege.wounds.manage') is not true
 or care_private.wound_has_permission('pflege.orders.view') is not true or not exists(select 1 from public.profiles x where x.id=actor and x.tenant_id=tenant and x.is_active)
 then raise exception 'Keine Berechtigung oder kein aktives Profil.' using errcode='42501';end if;
 if request_id is null or jsonb_typeof(payload) is distinct from 'object' or (payload-array['action','woundId','dataJson'])<>'{}'::jsonb
 or payload->>'action' not in ('plan','dressing') or jsonb_typeof(payload->'action') is distinct from 'string'
 or jsonb_typeof(payload->'woundId') is distinct from 'string' or jsonb_typeof(payload->'dataJson') is distinct from 'string' or length(payload->>'dataJson')>120000
 then raise exception 'Ungültige Wundversorgungsanfrage.' using errcode='23514';end if;
 if payload->>'action'='dressing' and (care_private.wound_has_permission('pflege.treatment.view') is not true or care_private.wound_has_permission('pflege.treatment.manage') is not true) then raise exception 'Behandlungspflegeberechtigung fehlt.' using errcode='42501';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(tenant::text||':wound-care:'||request_id::text,0));
 select * into w from public.clinical_wound_cases c where c.id=(payload->>'woundId')::uuid and c.tenant_id=tenant;subject:=w.client_id;
 perform pg_advisory_xact_lock(hashtextextended('wound-client:'||tenant||':'||subject,0));
 perform 1 from public.clients c where c.id=subject and c.tenant_id=tenant for no key update;
 if not found or care_private.wound_active_client(subject) is not true then raise exception 'Kein aktiver zugänglicher Pflegefall.' using errcode='42501';end if;
 select * into receipt from care_private.wound_care_requests r where r.tenant_id=tenant and r.request_id=write_wound_care.request_id;
 if receipt.result_id is not null then
  if receipt.actor_id<>actor or receipt.payload<>payload then raise exception 'Anfrage mit anderen Daten verwendet.' using errcode='23514';end if;return receipt.result_id;
 end if;
 select * into w from public.clinical_wound_cases c where c.id=(payload->>'woundId')::uuid and c.tenant_id=tenant and c.client_id=subject for update;
 if w.id is null then raise exception 'Wundfall geändert oder nicht zugänglich.' using errcode='40001';end if;
 d:=(payload->>'dataJson')::jsonb;
 keys:=case when payload->>'action'='plan' then array['expectedPreviousId','effectiveFrom','effectiveUntil','basisState','medicalOrderId','expectedOrderJson','basisReason','professionalBasis','changeReason','goal','plannedCare','plannedMaterials','frequency','hygienePlan','painPlan','warningSigns','escalationPath','personDecision','reviewStatus','nextReviewAt','reviewPendingReason']
 else array['occurredAt','outcome','basisState','planId','basisReason','actualCleaning','actualTechnique','hygiene','materialsJson','noMaterialReason','painBeforeState','painBeforeScore','painBeforeReason','painAfterState','painAfterScore','painAfterReason','response','deviation','contact','personDecision','qualificationBasis','reviewStatus','nextReviewAt','reviewPendingReason'] end;
 if jsonb_typeof(d) is distinct from 'object' or (d-keys)<>'{}'::jsonb then raise exception 'Wundversorgungsangaben ungültig.' using errcode='23514';end if;
 foreach field in array keys loop
  if jsonb_typeof(d->field) is distinct from 'string' or length(d->>field)>(case field when 'expectedOrderJson' then 80000 when 'materialsJson' then 20000 else 2000 end) then raise exception 'Angaben fehlen oder sind zu umfangreich.' using errcode='23514';end if;
 end loop;
 if d->>'reviewStatus'='scheduled' then
  if d->>'nextReviewAt' !~ '^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.][0-9]{1,6})?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$' or nullif(btrim(d->>'reviewPendingReason'),'') is not null then raise exception 'Kontrolltermin prüfen.' using errcode='23514';end if;
  review_time:=(d->>'nextReviewAt')::timestamptz;if review_time<=clock_timestamp() then raise exception 'Kontrolltermin liegt nicht in der Zukunft.' using errcode='23514';end if;
 elsif d->>'reviewStatus'='pending' and d->>'nextReviewAt'='' and nullif(btrim(d->>'reviewPendingReason'),'') is not null then review_time:=null;
 else raise exception 'Kontrolle oder offene Abstimmung dokumentieren.' using errcode='23514';end if;
 field:=case when payload->>'action'='plan' then 'effectiveFrom' else 'occurredAt' end;
 if d->>field !~ '^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.][0-9]{1,6})?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$' then raise exception 'Tatsächlichen Zeitpunkt prüfen.' using errcode='23514';end if;at_time:=(d->>field)::timestamptz;
 select coalesce(nullif(x.display_name,''),x.email,'Pflegekraft') into actor_name from public.profiles x where x.id=actor and x.tenant_id=tenant and x.is_active;
 if payload->>'action'='plan' then
  if w.status not in ('draft','active','healing','deteriorated') then raise exception 'Planänderung benötigt einen offenen Wundfall.' using errcode='40001';end if;
  foreach field in array array['professionalBasis','changeReason','goal','plannedCare','plannedMaterials','frequency','hygienePlan','painPlan','warningSigns','escalationPath','personDecision','basisReason'] loop
   if nullif(btrim(d->>field),'') is null then raise exception 'Plan und fachliche Grundlage unvollständig.' using errcode='23514';end if;
  end loop;
  if d->>'effectiveUntil'<>'' then
   if d->>'effectiveUntil' !~ '^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.][0-9]{1,6})?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$' then raise exception 'Planende prüfen.' using errcode='23514';end if;
   until_time:=(d->>'effectiveUntil')::timestamptz;if until_time<=at_time then raise exception 'Planende liegt nicht nach Beginn.' using errcode='23514';end if;
  end if;
  select * into previous from public.ambulatory_wound_plan_versions x where x.tenant_id=tenant and x.wound_case_id=w.id and x.client_id=subject order by version desc limit 1;
  if coalesce(previous.id::text,'')<>coalesce(nullif(d->>'expectedPreviousId','')::uuid::text,'') or (previous.id is not null and at_time<=previous.effective_from) then raise exception 'Planfassung geändert oder Beginn nicht nach vorheriger Fassung.' using errcode='40001';end if;
  if exists(select 1 from public.ambulatory_wound_dressings x where x.tenant_id=tenant and x.wound_case_id=w.id and x.client_id=subject and x.plan_id is not null and x.occurred_at>=at_time) then raise exception 'Neue Planung darf bereits dokumentierte planbezogene Versorgung nicht rückwirkend ersetzen.' using errcode='40001';end if;
  if d->>'basisState'='linked' then
   select * into o from public.care_medical_orders x where x.id=nullif(d->>'medicalOrderId','')::uuid and x.tenant_id=tenant and x.client_id=subject for share;
   perform care_private.check_wound_order(o,tenant,subject,at_time,until_time);
   if o.valid_until is not null and until_time is null then raise exception 'Endliche Anordnung benötigt ein ausdrückliches Planende innerhalb ihrer Gültigkeit.' using errcode='23514';end if;
   if to_jsonb(o) is distinct from (d->>'expectedOrderJson')::jsonb then raise exception 'Anordnung seit dem Laden geändert. Grundlage erneut prüfen.' using errcode='40001';end if;
  elsif d->>'basisState' in ('pending','not_required') and d->>'medicalOrderId'='' and d->>'expectedOrderJson'='' then o:=null;
  else raise exception 'Ärztliche Grundlage ausdrücklich und widerspruchsfrei dokumentieren.' using errcode='23514';end if;
 perform care_private.require_workspace_session(tenant,actor);
  insert into public.ambulatory_wound_plan_versions(tenant_id,client_id,wound_case_id,version,previous_id,effective_from,effective_until,basis_state,medical_order_id,order_snapshot,details,recorded_by,recorded_by_name)
  values(tenant,subject,w.id,coalesce(previous.version,0)+1,previous.id,at_time,until_time,d->>'basisState',o.id,case when o.id is not null then to_jsonb(o) else null end,d-'expectedOrderJson',actor,actor_name) returning id into result_id;
 else
  if at_time>clock_timestamp() or d->>'outcome' not in ('performed','partial','omitted','refused','failed') then raise exception 'Tatsächlichen Zeitpunkt und Ergebnis prüfen.' using errcode='23514';end if;
  foreach field in array array['actualCleaning','actualTechnique','hygiene','response','contact','personDecision','qualificationBasis'] loop
   if nullif(btrim(d->>field),'') is null then raise exception 'Tatsächliche Durchführung oder begründete Nichtdurchführung unvollständig.' using errcode='23514';end if;
  end loop;
  if d->>'outcome'<>'performed' and nullif(btrim(d->>'deviation'),'') is null then raise exception 'Abweichung von vollständiger Durchführung begründen.' using errcode='23514';end if;
  if d->>'basisState'='linked' then
   if w.status in ('healed','archived') and coalesce(at_time>(select e.occurred_at from public.ambulatory_wound_lifecycle_events e where e.tenant_id=tenant and e.client_id=subject and e.wound_case_id=w.id and e.action='close' order by e.created_at desc,e.id desc limit 1),true) then raise exception 'Versorgung nach Fallabschluss mit tatsächlichem Klärungsbedarf dokumentieren oder Fall begründet wiederöffnen.' using errcode='40001';end if;
   select * into p from public.ambulatory_wound_plan_versions x where x.tenant_id=tenant and x.client_id=subject and x.wound_case_id=w.id and x.effective_from<=at_time order by effective_from desc limit 1;
   if p.id is null or p.id is distinct from nullif(d->>'planId','')::uuid or (p.effective_until is not null and at_time>=p.effective_until) or p.basis_state<>'linked' or nullif(btrim(d->>'basisReason'),'') is not null then raise exception 'Passende Planfassung mit zugeordneter Anordnung fehlt.' using errcode='40001';end if;
   if exists(select 1 from public.ambulatory_wound_lifecycle_events e where e.tenant_id=tenant and e.client_id=subject and e.wound_case_id=w.id and e.action='reopen' and e.occurred_at<=at_time and e.created_at>p.created_at) then raise exception 'Nach Wiederöffnung Versorgung erneut beurteilen und neue Planfassung dokumentieren.' using errcode='40001';end if;
   select * into o from public.care_medical_orders x where x.id=p.medical_order_id and x.tenant_id=tenant and x.client_id=subject for share;
   perform care_private.check_wound_order(o,tenant,subject,at_time,null);
   if to_jsonb(o) is distinct from p.order_snapshot then raise exception 'Anordnung geändert. Aktuelle Planung prüfen oder tatsächliche ungeklärte Grundlage dokumentieren.' using errcode='40001';end if;
  elsif d->>'basisState'='unconfirmed' and d->>'planId'='' and nullif(btrim(d->>'basisReason'),'') is not null and nullif(btrim(d->>'deviation'),'') is not null then p:=null;
  else raise exception 'Planbezug oder tatsächliche ungeklärte Grundlage mit Abweichung dokumentieren.' using errcode='23514';end if;
  materials:=(d->>'materialsJson')::jsonb;
  if jsonb_typeof(materials) is distinct from 'array' or jsonb_array_length(materials)>20 then raise exception 'Materialliste ungültig.' using errcode='23514';end if;
  for m in select item from jsonb_array_elements(materials) as entries(item) loop
   if jsonb_typeof(m) is distinct from 'object' or (m-array['name','quantity','unit','purpose'])<>'{}'::jsonb then raise exception 'Materialposition ungültig.' using errcode='23514';end if;
   foreach field in array array['name','quantity','unit','purpose'] loop
    if jsonb_typeof(m->field) is distinct from 'string' or length(m->>field)>200 or nullif(btrim(m->>field),'') is null then raise exception 'Materialposition unvollständig.' using errcode='23514';end if;
   end loop;
   if m->>'quantity' !~ '^[0-9]+([.,][0-9]+)?$' or m->>'purpose' not in ('wound','preparation','waste') then raise exception 'Tatsächliche Materialmenge und Verwendung prüfen.' using errcode='23514';end if;
   value:=replace(m->>'quantity',',','.')::numeric;if value<=0 or value>1000000 then raise exception 'Materialmenge ungültig.' using errcode='23514';end if;
  end loop;
  if (jsonb_array_length(materials)=0 and nullif(btrim(d->>'noMaterialReason'),'') is null) or (jsonb_array_length(materials)>0 and nullif(btrim(d->>'noMaterialReason'),'') is not null) then raise exception 'Fehlenden tatsächlichen Verbrauch ausdrücklich und widerspruchsfrei begründen.' using errcode='23514';end if;
  foreach field in array array['painBefore','painAfter'] loop
   if d->>(field||'State')='NRS' then
    if d->>(field||'Score') !~ '^[0-9]{1,2}$' or (d->>(field||'Score'))::integer>10 or nullif(btrim(d->>(field||'Reason')),'') is not null then raise exception 'Erhobene NRS 0–10 prüfen.' using errcode='23514';end if;
   elsif d->>(field||'State')='not_assessable' and nullif(btrim(d->>(field||'Score')),'') is null and nullif(btrim(d->>(field||'Reason')),'') is not null then null;
   else raise exception 'Schmerz vor und nach der Versorgung ausdrücklich dokumentieren.' using errcode='23514';end if;
  end loop;
 perform care_private.require_workspace_session(tenant,actor);
  insert into public.clinical_treatment_executions(tenant_id,client_id,medical_order_id,treatment_type,title,performed_at,outcome,details,deviation_reason,escalation,qualification_snapshot,recorded_by,recorded_by_name)
  values(tenant,subject,p.medical_order_id,'wound_dressing','Wundversorgung / Verbandwechsel',at_time,d->>'outcome',d::text,d->>'deviation',d->>'contact',d->>'qualificationBasis',actor,actor_name) returning id into execution;
  insert into public.ambulatory_wound_dressings(tenant_id,client_id,wound_case_id,plan_id,plan_snapshot,execution_id,occurred_at,outcome,basis_state,details,recorded_by,recorded_by_name)
  values(tenant,subject,w.id,p.id,case when p.id is not null then to_jsonb(p) else null end,execution,at_time,d->>'outcome',d->>'basisState',d,actor,actor_name) returning id into result_id;
  -- Actual events remain documentable without verified source. No plan/status/alert/billing mutation.
 end if;
 update public.clinical_wound_cases set updated_at=clock_timestamp() where id=w.id and tenant_id=tenant;
 insert into care_private.wound_care_requests(tenant_id,request_id,actor_id,payload,result_id) values(tenant,request_id,actor,payload,result_id);
 insert into public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name)
 values(tenant,subject,case when payload->>'action'='plan' then 'wound_plan_version' else 'wound_dressing' end,result_id,'created','Wundplanung / tatsächliche Versorgung dokumentiert',d-'expectedOrderJson',actor,actor_name);
 return result_id;
end $$;
create or replace function public.write_ambulatory_wound_care(request_id uuid,payload jsonb)
returns uuid language sql security invoker set search_path='' as $$select care_private.write_wound_care(request_id,payload)$$;
revoke all on function care_private.write_wound_care(uuid,jsonb),public.write_ambulatory_wound_care(uuid,jsonb) from public,anon;

-- Cross-workflow concurrency: new care records advance the parent technical revision.
-- Status decisions are parent-locked by wound_lifecycle; do not close before documented actual care.
create or replace function care_private.guard_wound_care_closure()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.action='close' and exists(select 1 from public.ambulatory_wound_dressings d where d.tenant_id=new.tenant_id and d.client_id=new.client_id and d.wound_case_id=new.wound_case_id and d.occurred_at>new.occurred_at)
 then raise exception 'Abschluss darf nicht vor einer dokumentierten tatsächlichen Versorgung liegen.' using errcode='23514';end if;
 return new;
end $$;
revoke all on function care_private.guard_wound_care_closure() from public,anon,authenticated;
drop trigger if exists guard_wound_care_closure on public.ambulatory_wound_lifecycle_events;
create trigger guard_wound_care_closure before insert on public.ambulatory_wound_lifecycle_events for each row execute function care_private.guard_wound_care_closure();


-- Source: ambulatory_wound_assessment_corrections.sql (quarantined, with final hardening below).
-- LOCAL REVIEW ONLY. Requires wound_documentation and wound_lifecycle.
-- Narrative errata retain the original; they are not new observations or replacement measurements.

create table if not exists public.ambulatory_wound_assessment_corrections(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),
 client_id uuid not null references public.clients(id),wound_case_id uuid not null references public.clinical_wound_cases(id),
 assessment_id uuid not null references public.clinical_wound_assessments(id),version integer not null check(version>0),
 previous_id uuid references public.ambulatory_wound_assessment_corrections(id),
 section text not null check(section in ('observation','measurement','appearance','pain','infection','person','action','review')),
 original_snapshot jsonb not null,original_section jsonb not null,
 corrected_statement text not null,reason text not null,evidence_basis text not null,clinical_impact text not null,communication text not null,person_decision text not null,
 recorded_by uuid not null references public.profiles(id),recorded_by_name text not null,created_at timestamptz not null default clock_timestamp(),
 unique(tenant_id,assessment_id,version),
 check(length(btrim(corrected_statement))>0 and length(corrected_statement)<=2000),
 check(length(btrim(reason))>0 and length(reason)<=2000),check(length(btrim(evidence_basis))>0 and length(evidence_basis)<=2000),
 check(length(btrim(clinical_impact))>0 and length(clinical_impact)<=2000),check(length(btrim(communication))>0 and length(communication)<=2000),
 check(length(btrim(person_decision))>0 and length(person_decision)<=2000)
);
create index if not exists wound_correction_history on public.ambulatory_wound_assessment_corrections(tenant_id,wound_case_id,created_at desc,id desc);
alter table public.ambulatory_wound_assessment_corrections enable row level security;
revoke all on public.ambulatory_wound_assessment_corrections from public,anon,authenticated;

drop policy if exists wound_correction_read on public.ambulatory_wound_assessment_corrections;
create policy wound_correction_read on public.ambulatory_wound_assessment_corrections for select to authenticated using(true);
drop policy if exists wound_correction_scope on public.ambulatory_wound_assessment_corrections;
create policy wound_correction_scope on public.ambulatory_wound_assessment_corrections as restrictive for select to authenticated using(
 auth.uid() is not null and tenant_id=public.current_tenant_id() and care_private.wound_has_permission('pflege.wounds.view') and care_private.wound_active_client(client_id)
 and exists(select 1 from public.profiles p where p.id=public.resolve_current_profile_id() and p.tenant_id=ambulatory_wound_assessment_corrections.tenant_id and p.is_active)
 and exists(select 1 from public.clinical_wound_cases w where w.id=ambulatory_wound_assessment_corrections.wound_case_id and w.tenant_id=ambulatory_wound_assessment_corrections.tenant_id and w.client_id=ambulatory_wound_assessment_corrections.client_id)
 and exists(select 1 from public.clinical_wound_assessments a where a.id=ambulatory_wound_assessment_corrections.assessment_id and a.tenant_id=ambulatory_wound_assessment_corrections.tenant_id and a.client_id=ambulatory_wound_assessment_corrections.client_id and a.wound_case_id=ambulatory_wound_assessment_corrections.wound_case_id)
);
create table if not exists care_private.wound_correction_requests(
 tenant_id uuid not null,request_id uuid not null,actor_id uuid not null,payload jsonb not null,result_id uuid not null,
 created_at timestamptz not null default clock_timestamp(),primary key(tenant_id,request_id)
);
alter table care_private.wound_correction_requests enable row level security;
revoke all on care_private.wound_correction_requests from public,anon,authenticated;
create or replace function care_private.wound_assessment_section(s jsonb,section_name text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare keys text[];result jsonb:='{}'::jsonb;field text;
begin
 case section_name
 when 'observation' then return jsonb_build_object('observed_at',s->'observed_at','wound_case_id',s->'wound_case_id','client_id',s->'client_id');
 when 'measurement' then keys:=array['measurementMethod','lengthState','lengthCm','lengthReason','widthState','widthCm','widthReason','depthState','depthCm','depthReason'];result:=jsonb_build_object('length_cm',s->'length_cm','width_cm',s->'width_cm','depth_cm',s->'depth_cm','unit','cm');
 when 'appearance' then keys:=array['woundBed','exudate','odor','woundEdge','surroundingSkin'];result:=jsonb_build_object('wound_bed',s->'wound_bed','legacy_exudate',s->'exudate','legacy_odor',s->'odor','wound_edge',s->'wound_edge','surrounding_skin',s->'surrounding_skin');
 when 'pain' then keys:=array['painState','painScore','painReason'];result:=jsonb_build_object('pain_score',s->'pain_score');
 when 'infection' then keys:=array['infectionObservation'];result:=jsonb_build_object('infection_signs',s->'infection_signs');
 when 'person' then keys:=array['personalImpact','preferences','selfManagement'];
 when 'action' then keys:=array['actualAction','response'];result:=jsonb_build_object('intervention',s->'intervention','legacy_response',s->'response');
 when 'review' then keys:=array['nextReviewAt','reviewStatus','reviewPendingReason'];
 else raise exception 'Betroffenen Inhalt ausdrücklich wählen.' using errcode='23514';
 end case;
 foreach field in array keys loop result:=result||jsonb_build_object(field,coalesce(s->'documentation_details'->field,'null'::jsonb));end loop;
 return result;
end $$;
revoke all on function care_private.wound_assessment_section(jsonb,text) from public,anon,authenticated;
create or replace function care_private.write_wound_assessment_correction(request_id uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare tenant uuid:=public.current_tenant_id();actor uuid:=public.resolve_current_profile_id();actor_name text;
 w public.clinical_wound_cases%rowtype;a public.clinical_wound_assessments%rowtype;head public.ambulatory_wound_assessment_corrections%rowtype;
 receipt care_private.wound_correction_requests%rowtype;keys text[]:=array['woundId','assessmentId','expectedSourceJson','expectedHeadJson','section','correctedStatement','reason','evidenceBasis','clinicalImpact','communication','personDecision'];
 field text;original jsonb;expected_head jsonb;result_id uuid;
begin
 if auth.uid() is null or tenant is null or actor is null or care_private.wound_has_permission('pflege.wounds.view') is not true or care_private.wound_has_permission('pflege.wounds.manage') is not true
 or not exists(select 1 from public.profiles p where p.id=actor and p.tenant_id=tenant and p.is_active)
 then raise exception 'Keine Berechtigung oder kein aktives Profil.' using errcode='42501';end if;
 if request_id is null or jsonb_typeof(payload) is distinct from 'object' or (payload-keys)<>'{}'::jsonb or length(payload::text)>300000 then raise exception 'Ungültige Berichtigungsanfrage.' using errcode='23514';end if;
 foreach field in array keys loop
  if jsonb_typeof(payload->field) is distinct from 'string' or length(payload->>field)>(case field when 'expectedSourceJson' then 80000 when 'expectedHeadJson' then 120000 else 2000 end) then raise exception 'Berichtigungsangaben fehlen oder sind zu umfangreich.' using errcode='23514';end if;
 end loop;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(tenant::text||':wound-correction:'||request_id::text,0));
 select * into w from public.clinical_wound_cases c where c.id=(payload->>'woundId')::uuid and c.tenant_id=tenant;
 perform pg_advisory_xact_lock(hashtextextended('wound-client:'||tenant||':'||w.client_id,0));
 perform 1 from public.clients c where c.id=w.client_id and c.tenant_id=tenant for no key update;
 if not found or care_private.wound_active_client(w.client_id) is not true then raise exception 'Kein aktiver zugänglicher Pflegefall.' using errcode='42501';end if;
 select * into receipt from care_private.wound_correction_requests r where r.tenant_id=tenant and r.request_id=write_wound_assessment_correction.request_id;
 if receipt.result_id is not null then
  if receipt.actor_id<>actor or receipt.payload<>payload then raise exception 'Anfrage mit anderen Daten verwendet.' using errcode='23514';end if;
  return receipt.result_id;
 end if;
 select * into w from public.clinical_wound_cases c where c.id=(payload->>'woundId')::uuid and c.tenant_id=tenant for update;
 if w.id is null or care_private.wound_active_client(w.client_id) is not true then raise exception 'Wundfall nicht zugänglich.' using errcode='42501';end if;
 select * into a from public.clinical_wound_assessments x where x.id=(payload->>'assessmentId')::uuid and x.tenant_id=tenant and x.client_id=w.client_id and x.wound_case_id=w.id for update;
 if a.id is null then raise exception 'Originalassessment gehört nicht zu dieser Akte.' using errcode='42501';end if;
 original:=(payload->>'expectedSourceJson')::jsonb;
 if to_jsonb(a) is distinct from original then raise exception 'Originalbefund seit Bearbeitungsbeginn geändert. Neu prüfen.' using errcode='40001';end if;
 select * into head from public.ambulatory_wound_assessment_corrections c where c.tenant_id=tenant and c.assessment_id=a.id order by c.version desc limit 1 for update;
 expected_head:=case when payload->>'expectedHeadJson'='' then null else (payload->>'expectedHeadJson')::jsonb end;
 if (case when head.id is null then null else to_jsonb(head) end) is distinct from expected_head then raise exception 'Berichtigungsstand inzwischen geändert. Neu prüfen.' using errcode='40001';end if;
 foreach field in array array['correctedStatement','reason','evidenceBasis','clinicalImpact','communication','personDecision'] loop
  if nullif(btrim(payload->>field),'') is null then raise exception 'Aussage, Grund, Grundlage, Auswirkungen, Rücksprache und Personenbezug erforderlich.' using errcode='23514';end if;
 end loop;
 -- Closed cases remain documentable. This does not reopen a case or change a previous decision.
 select coalesce(nullif(p.display_name,''),p.email,'Pflegekraft') into actor_name from public.profiles p where p.id=actor and p.tenant_id=tenant and p.is_active;
 perform care_private.require_workspace_session(tenant,actor);
 insert into public.ambulatory_wound_assessment_corrections(tenant_id,client_id,wound_case_id,assessment_id,version,previous_id,section,original_snapshot,original_section,corrected_statement,reason,evidence_basis,clinical_impact,communication,person_decision,recorded_by,recorded_by_name)
 values(tenant,w.client_id,w.id,a.id,coalesce(head.version,0)+1,head.id,payload->>'section',original,care_private.wound_assessment_section(original,payload->>'section'),btrim(payload->>'correctedStatement'),btrim(payload->>'reason'),btrim(payload->>'evidenceBasis'),btrim(payload->>'clinicalImpact'),btrim(payload->>'communication'),btrim(payload->>'personDecision'),actor,actor_name) returning id into result_id;
 update public.clinical_wound_cases set updated_at=clock_timestamp() where id=w.id and tenant_id=tenant;
 insert into care_private.wound_correction_requests(tenant_id,request_id,actor_id,payload,result_id) values(tenant,request_id,actor,payload,result_id);
 insert into public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name)
 values(tenant,w.client_id,'wound_assessment_correction',result_id,'created','Begründete Assessmentberichtigung dokumentiert',payload-array['expectedSourceJson','expectedHeadJson'],actor,actor_name);
 return result_id;
end $$;
create or replace function public.write_ambulatory_wound_assessment_correction(request_id uuid,payload jsonb)
returns uuid language sql security invoker set search_path='' as $$select care_private.write_wound_assessment_correction(request_id,payload)$$;
revoke all on function care_private.write_wound_assessment_correction(uuid,jsonb),public.write_ambulatory_wound_assessment_correction(uuid,jsonb) from public,anon;

create or replace function care_private.require_uncorrected_healing_assessment()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.action='close' and new.closure_kind='healed' and exists(select 1 from public.ambulatory_wound_assessment_corrections c where c.tenant_id=new.tenant_id and c.wound_case_id=new.wound_case_id and c.assessment_id=new.assessment_id) then
  raise exception 'Befund besitzt Berichtigungsvermerke. Abheilung fachlich neu beurteilen und eigenes tatsächliches Assessment dokumentieren.' using errcode='40001';
 end if;
 return new;
end $$;
revoke all on function care_private.require_uncorrected_healing_assessment() from public,anon,authenticated;
drop trigger if exists require_uncorrected_healing_assessment on public.ambulatory_wound_lifecycle_events;
create trigger require_uncorrected_healing_assessment before insert on public.ambulatory_wound_lifecycle_events for each row execute function care_private.require_uncorrected_healing_assessment();


-- Source: ambulatory_wound_path_packet.sql (quarantined, with final hardening below).
-- LOCAL REVIEW ONLY. Apply only after the wound documentation, care, lifecycle and correction patches
-- in an approved test database. This proposal is intentionally not executed by the checkpoint build.
-- It joins the J-01..J-08 read, append-only escalation, rights-change, receipt and resume contract.

create table if not exists public.ambulatory_wound_photo_links(
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id),
 client_id uuid not null references public.clients(id), wound_case_id uuid not null references public.clinical_wound_cases(id),
 assessment_id uuid not null references public.clinical_wound_assessments(id), consent_id uuid not null references public.client_consents(id),
 storage_path text not null, file_name text not null, content_sha256 text not null check(content_sha256 ~ '^[0-9a-f]{64}$'),
 captured_at timestamptz not null, recorded_by uuid not null, recorded_by_name text not null,
 created_at timestamptz not null default clock_timestamp(),
 unique(tenant_id,wound_case_id,storage_path), unique(tenant_id,wound_case_id,content_sha256)
);

create table if not exists public.ambulatory_wound_path_events(
 id uuid primary key, tenant_id uuid not null references public.tenants(id), client_id uuid not null references public.clients(id),
 wound_case_id uuid not null references public.clinical_wound_cases(id), root_id uuid not null,
 revision integer not null check(revision>0), previous_id uuid references public.ambulatory_wound_path_events(id),
 kind text not null check(kind in ('infection_suspicion','clinical_contact','clinical_response','escalation_resolution','reopen_escalation','correction')),
 observed_at timestamptz not null, payload jsonb not null, reason text not null default '', content_fingerprint text not null,
 recorded_by uuid not null, recorded_by_name text not null, created_at timestamptz not null default clock_timestamp(),
 unique(tenant_id,wound_case_id,root_id,revision), unique(tenant_id,wound_case_id,previous_id),
 check(content_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
 check((revision=1 and previous_id is null and root_id=id) or (revision>1 and previous_id is not null))
);

create index if not exists wound_photo_links_scope on public.ambulatory_wound_photo_links(tenant_id,wound_case_id,captured_at,id);
create index if not exists wound_path_event_scope on public.ambulatory_wound_path_events(tenant_id,wound_case_id,root_id,revision);
create index if not exists wound_path_event_page on public.ambulatory_wound_path_events(tenant_id,wound_case_id,created_at desc,id desc);

do $$declare tbl text;begin
 foreach tbl in array array['ambulatory_wound_photo_links','ambulatory_wound_path_events'] loop
  execute format('alter table public.%I enable row level security',tbl);
  execute format('revoke all on public.%I from public,anon,authenticated',tbl);

  execute format('drop policy if exists wound_path_read on public.%I',tbl);
  execute format('create policy wound_path_read on public.%I for select to authenticated using(true)',tbl);
  execute format('drop policy if exists wound_path_scope on public.%I',tbl);
  execute format('create policy wound_path_scope on public.%1$I as restrictive for select to authenticated using(
   auth.uid() is not null and tenant_id=public.current_tenant_id() and care_private.wound_has_permission(''pflege.wounds.view'')
   and care_private.wound_active_client(client_id)
   and exists(select 1 from public.profiles p where p.id=public.resolve_current_profile_id() and p.tenant_id=%1$I.tenant_id and p.is_active)
   and exists(select 1 from public.clinical_wound_cases w where w.id=%1$I.wound_case_id and w.tenant_id=%1$I.tenant_id and w.client_id=%1$I.client_id))',tbl);
 end loop;
end $$;
revoke all on public.ambulatory_wound_photo_links from public,anon,authenticated;
revoke all on public.ambulatory_wound_path_events from public,anon,authenticated;

create table if not exists care_private.wound_path_requests(
 tenant_id uuid not null, request_id uuid not null, client_id uuid not null, wound_case_id uuid not null,
 actor_id uuid not null, packet jsonb not null, result_root_id uuid not null, result_head_id uuid not null,
 result_revision integer not null, created_at timestamptz not null default clock_timestamp(),
 primary key(tenant_id,request_id)
);
alter table care_private.wound_path_requests add column if not exists retained_original jsonb;
alter table care_private.wound_path_requests enable row level security;
revoke all on care_private.wound_path_requests from public,anon,authenticated;

create or replace function care_private.wound_path_fingerprint(value jsonb)
returns text language sql immutable security invoker set search_path='' as $$
 select 'sha256:'||encode(extensions.digest(pg_catalog.convert_to(value::text,'UTF8'),'sha256'),'hex')
$$;

create or replace function care_private.guard_wound_path_original()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 raise exception 'Gebundene Wundpfad- und Fotooriginale sind append-only.' using errcode='42501';
end $$;
revoke all on function care_private.guard_wound_path_original() from public,anon,authenticated;
drop trigger if exists guard_wound_path_event_original on public.ambulatory_wound_path_events;
create trigger guard_wound_path_event_original before update or delete on public.ambulatory_wound_path_events for each row execute function care_private.guard_wound_path_original();
drop trigger if exists guard_wound_photo_original on public.ambulatory_wound_photo_links;
create trigger guard_wound_photo_original before update or delete on public.ambulatory_wound_photo_links for each row execute function care_private.guard_wound_path_original();

create or replace function care_private.assert_wound_path_authority(requested_tenant uuid,requested_client uuid,requested_wound uuid,requested_actor uuid,write_required boolean,contact_required boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or requested_tenant is null or requested_tenant<>public.current_tenant_id()
 or requested_actor is null or requested_actor<>public.resolve_current_profile_id()
 or not exists(select 1 from public.profiles p where p.id=requested_actor and p.tenant_id=requested_tenant and p.is_active)
 or care_private.wound_has_permission('pflege.wounds.view') is not true
 or (write_required and care_private.wound_has_permission('pflege.wounds.manage') is not true)
 or (contact_required and care_private.wound_has_permission('pflege.treatment.manage') is not true)
 or care_private.wound_active_client(requested_client) is not true
 or not exists(select 1 from public.clinical_wound_cases w where w.id=requested_wound and w.tenant_id=requested_tenant and w.client_id=requested_client)
 then raise exception 'Wundfall, Sitzung, Profil oder aktuelle Rechte nicht bestätigt.' using errcode='42501';end if;
end $$;
revoke all on function care_private.assert_wound_path_authority(uuid,uuid,uuid,uuid,boolean,boolean) from public,anon,authenticated;

create or replace function care_private.wound_path_ref(row_id uuid,client_id uuid,wound_id uuid,revision integer,recorded_at timestamptz,payload jsonb)
returns jsonb language sql immutable security invoker set search_path='' as $$
 select jsonb_build_object('id',row_id,'clientId',client_id,'woundId',wound_id,'revision',revision,'recordedAt',recorded_at,
  'fingerprint',care_private.wound_path_fingerprint(payload),'payload',payload)
$$;

create or replace function care_private.read_wound_path_context_impl(requested_tenant uuid,requested_client uuid,requested_wound uuid,requested_actor uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;begin
 perform care_private.assert_wound_path_authority(requested_tenant,requested_client,requested_wound,requested_actor,false,false);
 perform 1 from public.clinical_wound_assessments a where a.tenant_id=requested_tenant and a.client_id=requested_client and a.wound_case_id=requested_wound for share;
 perform 1 from public.ambulatory_wound_plan_versions a where a.tenant_id=requested_tenant and a.client_id=requested_client and a.wound_case_id=requested_wound for share;
 perform 1 from public.ambulatory_wound_dressings a where a.tenant_id=requested_tenant and a.client_id=requested_client and a.wound_case_id=requested_wound for share;
 perform 1 from public.ambulatory_wound_photo_links a where a.tenant_id=requested_tenant and a.client_id=requested_client and a.wound_case_id=requested_wound for share;
 perform 1 from public.client_consents a where a.tenant_id=requested_tenant and a.client_id=requested_client and exists(select 1 from public.ambulatory_wound_photo_links x where x.consent_id=a.id and x.tenant_id=requested_tenant and x.wound_case_id=requested_wound) for share;
 perform 1 from public.profiles a where a.tenant_id=requested_tenant for share;
 select jsonb_build_object(
  'wounds',coalesce((select jsonb_agg(care_private.wound_path_ref(w.id,w.client_id,w.id,1,w.updated_at,to_jsonb(w)) order by w.updated_at,w.id) from public.clinical_wound_cases w where w.id=requested_wound and w.tenant_id=requested_tenant and w.client_id=requested_client),'[]'::jsonb),
  'assessments',coalesce((select jsonb_agg(care_private.wound_path_ref(a.id,a.client_id,a.wound_case_id,1,coalesce(a.observed_at,a.assessed_at,a.created_at),to_jsonb(a)) order by coalesce(a.observed_at,a.assessed_at,a.created_at),a.id) from public.clinical_wound_assessments a where a.tenant_id=requested_tenant and a.client_id=requested_client and a.wound_case_id=requested_wound),'[]'::jsonb),
  'photos',coalesce((select jsonb_agg(care_private.wound_path_ref(x.id,x.client_id,x.wound_case_id,1,x.captured_at,to_jsonb(x)||jsonb_build_object('assessment_id',x.assessment_id,'consent_id',x.consent_id)) order by x.captured_at,x.id) from public.ambulatory_wound_photo_links x where x.tenant_id=requested_tenant and x.client_id=requested_client and x.wound_case_id=requested_wound),'[]'::jsonb),
  'photoConsents',coalesce((select jsonb_agg(care_private.wound_path_ref(c.id,c.client_id,requested_wound,1,c.created_at,to_jsonb(c)||jsonb_build_object('status',case when c.granted and (c.expires_at is null or c.expires_at>clock_timestamp()) then 'active' else 'inactive' end)) order by c.created_at,c.id) from public.client_consents c where c.tenant_id=requested_tenant and c.client_id=requested_client and exists(select 1 from public.ambulatory_wound_photo_links x where x.consent_id=c.id and x.wound_case_id=requested_wound)),'[]'::jsonb),
  'plans',coalesce((select jsonb_agg(care_private.wound_path_ref(p.id,p.client_id,p.wound_case_id,p.version,p.created_at,to_jsonb(p)) order by p.version,p.id) from public.ambulatory_wound_plan_versions p where p.tenant_id=requested_tenant and p.client_id=requested_client and p.wound_case_id=requested_wound),'[]'::jsonb),
  'dressings',coalesce((select jsonb_agg(care_private.wound_path_ref(d.id,d.client_id,d.wound_case_id,1,d.created_at,to_jsonb(d)||jsonb_build_object('plan_id',d.plan_id,'occurred_at',d.occurred_at,'outcome',d.outcome,'action',coalesce(d.details->>'action',''),'reason',coalesce(d.details->>'reason',d.details->>'deviation',''))) order by d.created_at,d.id) from public.ambulatory_wound_dressings d where d.tenant_id=requested_tenant and d.client_id=requested_client and d.wound_case_id=requested_wound),'[]'::jsonb),
  'contacts',coalesce((select jsonb_agg(care_private.wound_path_ref(e.id,e.client_id,e.wound_case_id,e.revision,e.observed_at,e.payload->'contact') order by e.observed_at,e.id) from public.ambulatory_wound_path_events e where e.tenant_id=requested_tenant and e.client_id=requested_client and e.wound_case_id=requested_wound and e.kind in ('clinical_contact','clinical_response','escalation_resolution')),'[]'::jsonb),
  'lifecycle',coalesce((select jsonb_agg(care_private.wound_path_ref(l.id,l.client_id,l.wound_case_id,1,l.occurred_at,to_jsonb(l)) order by l.occurred_at,l.id) from public.ambulatory_wound_lifecycle_events l where l.tenant_id=requested_tenant and l.client_id=requested_client and l.wound_case_id=requested_wound),'[]'::jsonb),
  'people',coalesce((select jsonb_agg(care_private.wound_path_ref(p.id,requested_client,requested_wound,1,coalesce(p.updated_at,p.created_at),jsonb_build_object('display_name',coalesce(nullif(p.display_name,''),p.email),'active',p.is_active)) order by p.id) from public.profiles p where p.tenant_id=requested_tenant),'[]'::jsonb),
  'corrections',coalesce((select jsonb_agg(care_private.wound_path_ref(c.id,c.client_id,c.wound_case_id,c.version,c.created_at,to_jsonb(c)) order by c.version,c.id) from public.ambulatory_wound_assessment_corrections c where c.tenant_id=requested_tenant and c.client_id=requested_client and c.wound_case_id=requested_wound),'[]'::jsonb),
  'escalations',coalesce((select jsonb_agg(care_private.wound_path_ref(e.id,e.client_id,e.wound_case_id,e.revision,e.observed_at,e.payload||jsonb_build_object('resolution_state',e.payload#>>'{resolution,state}')) order by e.created_at,e.id) from public.ambulatory_wound_path_events e where e.tenant_id=requested_tenant and e.client_id=requested_client and e.wound_case_id=requested_wound),'[]'::jsonb)
 ) into result;
 return result;
end $$;

create or replace function public.web_read_wound_path_context(p_tenant_id uuid,p_client_id uuid,p_wound_id uuid,p_actor_profile_id uuid)
returns jsonb language sql security invoker set search_path='' as $$select care_private.read_wound_path_context_impl(p_tenant_id,p_client_id,p_wound_id,p_actor_profile_id)$$;

create or replace function care_private.wound_path_original(root uuid,requested_tenant uuid,requested_client uuid,requested_wound uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 with rows as (select e.* from public.ambulatory_wound_path_events e where e.root_id=root and e.tenant_id=requested_tenant and e.client_id=requested_client and e.wound_case_id=requested_wound order by e.revision),
 head as (select * from rows order by revision desc limit 1)
 select jsonb_build_object('id',h.id,'tenantId',h.tenant_id,'clientId',h.client_id,'woundId',h.wound_case_id,'rootId',h.root_id,'headId',h.id,'revision',h.revision,'kind',h.kind,'recordedAt',h.observed_at,'recordedBy',h.recorded_by,'recordedByName',h.recorded_by_name,'payload',h.payload,'contentFingerprint',h.content_fingerprint,
  'history',(select jsonb_agg(jsonb_build_object('id',r.id,'revision',r.revision,'previousId',r.previous_id,'recordedAt',r.observed_at,'recordedBy',r.recorded_by,'recordedByName',r.recorded_by_name,'reason',r.reason,'payload',r.payload,'contentFingerprint',r.content_fingerprint) order by r.revision) from rows r)) from head h
$$;
revoke all on function care_private.wound_path_original(uuid,uuid,uuid,uuid) from public,anon,authenticated;

create or replace function care_private.read_wound_path_page_impl(requested_tenant uuid,requested_client uuid,requested_wound uuid,requested_actor uuid,cursor_recorded timestamptz,cursor_id uuid,page_size integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare rows jsonb;last_time timestamptz;last_id uuid;begin
 perform care_private.assert_wound_path_authority(requested_tenant,requested_client,requested_wound,requested_actor,false,false);
 if page_size is null or page_size<1 or page_size>100 then raise exception 'Ungültige Seitengröße.' using errcode='22023';end if;
 with heads as (select distinct on(e.root_id) e.* from public.ambulatory_wound_path_events e where e.tenant_id=requested_tenant and e.client_id=requested_client and e.wound_case_id=requested_wound order by e.root_id,e.revision desc),
 page as (select h.* from heads h where cursor_recorded is null or (h.created_at,h.id)<(cursor_recorded,cursor_id) order by h.created_at desc,h.id desc limit page_size)
 select coalesce(jsonb_agg(care_private.wound_path_original(p.root_id,requested_tenant,requested_client,requested_wound) order by p.created_at desc,p.id desc),'[]'::jsonb) into rows from page p;
 select p.created_at,p.id into last_time,last_id from page p order by p.created_at,p.id limit 1;
 return jsonb_build_object('rows',rows,'nextCursorRecordedAt',case when jsonb_array_length(rows)>0 then last_time end,'nextCursorId',case when jsonb_array_length(rows)>0 then last_id end);
end $$;

create or replace function public.web_read_wound_path_page(p_tenant_id uuid,p_client_id uuid,p_wound_id uuid,p_actor_profile_id uuid,p_cursor_recorded_at timestamptz,p_cursor_id uuid,p_page_size integer)
returns jsonb language sql security invoker set search_path='' as $$select care_private.read_wound_path_page_impl(p_tenant_id,p_client_id,p_wound_id,p_actor_profile_id,p_cursor_recorded_at,p_cursor_id,p_page_size)$$;

create or replace function care_private.commit_wound_path_packet_impl(packet jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare tenant uuid;subject uuid;wound uuid;actor uuid;request uuid;entry jsonb;kind text;action text;receipt care_private.wound_path_requests%rowtype;head public.ambulatory_wound_path_events%rowtype;result_id uuid;root_id uuid;revision integer;fingerprint text;actor_name text;current_sources jsonb;contact_required boolean;begin
 perform care_private.validate_wound_path_packet_shape(packet);
 if jsonb_typeof(packet) is distinct from 'object' or packet->>'schemaVersion'<>'1' then raise exception 'Ungültiges Wundpfadpaket.' using errcode='23514';end if;
 tenant:=(packet->>'tenantId')::uuid;subject:=(packet->>'clientId')::uuid;wound:=(packet->>'woundId')::uuid;actor:=(packet->>'actorId')::uuid;request:=(packet->>'requestId')::uuid;entry:=packet->'entry';kind:=entry->>'kind';action:=packet->>'action';
 contact_required:=kind in ('clinical_contact','clinical_response','escalation_resolution');
 perform care_private.assert_wound_path_authority(tenant,subject,wound,actor,true,contact_required);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(tenant::text||':wound-path-request:'||request::text,0));
 select * into receipt from care_private.wound_path_requests r where r.tenant_id=tenant and r.request_id=request;
 if receipt.request_id is not null then
  if receipt.actor_id<>actor or receipt.client_id<>subject or receipt.wound_case_id<>wound or receipt.packet<>packet then raise exception 'Anfragekennung wurde mit anderen Originalen verwendet.' using errcode='23514';end if;
  if receipt.retained_original is null then raise exception 'Historische unveränderte Wundpfadquittung fehlt.' using errcode='P0H03';end if;
  return jsonb_build_object('requestId',request,'packet',packet,'original',receipt.retained_original);
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(tenant::text||':wound-path:'||wound::text,0));
 perform 1 from public.clinical_wound_cases w where w.id=wound and w.tenant_id=tenant and w.client_id=subject for update;
 if not found then raise exception 'Wundfall wurde geändert oder ist nicht zugänglich.' using errcode='40001';end if;
 perform care_private.validate_wound_path_entry(packet);
 current_sources:=care_private.read_wound_path_context_impl(tenant,subject,wound,actor);
 if current_sources is distinct from packet->'sources' then raise exception 'Wund-, Befund-, Bild-, Plan-, Versorgungs-, Personen- oder Statusbestand hat sich geändert.' using errcode='40001';end if;
 if kind not in ('infection_suspicion','clinical_contact','clinical_response','escalation_resolution','reopen_escalation','correction') or entry->>'tenantId'<>tenant::text or entry->>'clientId'<>subject::text or entry->>'woundId'<>wound::text then raise exception 'Vorgangsart oder Wundbindung ungültig.' using errcode='23514';end if;
 if nullif(btrim(entry->>'title'),'') is null or nullif(btrim(entry#>>'{observation,narrative}'),'') is null or nullif(btrim(entry#>>'{contact,nextStep}'),'') is null or nullif(btrim(entry#>>'{person,decision}'),'') is null then raise exception 'Beobachtung, nächster Schritt und Personenentscheidung fehlen.' using errcode='23514';end if;
 if kind='infection_suspicion' and (entry#>>'{observation,state}'<>'suspected' or jsonb_array_length(entry#>'{observation,signs}')=0) then raise exception 'Verdacht benötigt tatsächlich beobachtete Zeichen; keine Diagnose wird abgeleitet.' using errcode='23514';end if;
 if entry#>>'{observation,photoId}' is not null and (entry#>>'{person,photoDecision}'<>'consented' or not exists(select 1 from public.ambulatory_wound_photo_links x join public.client_consents c on c.id=x.consent_id and c.tenant_id=x.tenant_id and c.client_id=x.client_id where x.id=(entry#>>'{observation,photoId}')::uuid and x.tenant_id=tenant and x.client_id=subject and x.wound_case_id=wound and c.id=(entry#>>'{observation,photoConsentId}')::uuid and c.granted and (c.expires_at is null or c.expires_at>clock_timestamp()))) then raise exception 'Foto und aktive Einwilligung sind nicht unverändert gebunden.' using errcode='23514';end if;
 if kind='clinical_response' and (entry#>>'{contact,state}'<>'responded' or nullif(btrim(entry#>>'{contact,response}'),'') is null) then raise exception 'Tatsächliche Rückmeldung fehlt.' using errcode='23514';end if;
 if kind='escalation_resolution' and (entry#>>'{resolution,state}'<>'resolved' or entry#>>'{contact,state}'<>'responded' or nullif(btrim(entry#>>'{resolution,result}'),'') is null) then raise exception 'Abschluss benötigt tatsächliche Rückmeldung und Ergebnis.' using errcode='23514';end if;
 if kind='reopen_escalation' and (entry#>>'{resolution,state}'<>'reopened' or not exists(select 1 from public.ambulatory_wound_path_events e where e.tenant_id=tenant and e.client_id=subject and e.wound_case_id=wound and e.payload#>>'{resolution,state}'='resolved')) then raise exception 'Wiederöffnung benötigt einen abgeschlossenen Originalverlauf.' using errcode='23514';end if;
 if action='create' then
  if packet->'original'<>'null'::jsonb or packet->'expectedHeadId'<>'null'::jsonb or (packet->>'expectedRevision')::integer<>0 or packet->>'reason'<>'' then raise exception 'Neuanlage enthält fremden historischen Kopf.' using errcode='23514';end if;
  result_id:=request;root_id:=request;revision:=1;
 elsif action='revise' then
  select * into head from public.ambulatory_wound_path_events e where e.id=(packet->>'expectedHeadId')::uuid and e.tenant_id=tenant and e.client_id=subject and e.wound_case_id=wound for update;
  if head.id is null or head.revision<>(packet->>'expectedRevision')::integer or care_private.wound_path_original(head.root_id,tenant,subject,wound) is distinct from packet->'original' or exists(select 1 from public.ambulatory_wound_path_events x where x.root_id=head.root_id and x.revision>head.revision) then raise exception 'Eskalationsverlauf hat einen neueren Kopf.' using errcode='40001';end if;
  if length(btrim(packet->>'reason'))<10 or entry is not distinct from head.payload then raise exception 'Konkreter Fortschreibungsgrund fehlt.' using errcode='23514';end if;
  result_id:=request;root_id:=head.root_id;revision:=head.revision+1;
 else raise exception 'Paketaktion ungültig.' using errcode='23514';end if;
 if kind='correction' and (entry#>>'{correction,targetId}')::uuid not in(select e.id from public.ambulatory_wound_path_events e where e.tenant_id=tenant and e.client_id=subject and e.wound_case_id=wound) then raise exception 'Korrekturoriginal fehlt.' using errcode='23514';end if;
 select coalesce(nullif(p.display_name,''),p.email,'Pflegekraft') into actor_name from public.profiles p where p.id=actor and p.tenant_id=tenant and p.is_active;
 fingerprint:=care_private.wound_path_fingerprint(entry);
 perform care_private.assert_wound_path_authority(tenant,subject,wound,actor,true,contact_required);
 perform care_private.assert_wound_photo_current(entry,tenant,subject,wound);
 insert into public.ambulatory_wound_path_events(id,tenant_id,client_id,wound_case_id,root_id,revision,previous_id,kind,observed_at,payload,reason,content_fingerprint,recorded_by,recorded_by_name)
 values(result_id,tenant,subject,wound,root_id,revision,head.id,kind,(entry->>'observedAt')::timestamptz,entry,case when revision=1 then '' else btrim(packet->>'reason') end,fingerprint,actor,actor_name);
 insert into care_private.wound_path_requests(tenant_id,request_id,client_id,wound_case_id,actor_id,packet,result_root_id,result_head_id,result_revision,retained_original)
 values(tenant,request,subject,wound,actor,packet,root_id,result_id,revision,care_private.wound_path_original(root_id,tenant,subject,wound));
 insert into public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name)
 values(tenant,subject,'wound_path',result_id,kind,'Wund-/Eskalationsverlauf append-only dokumentiert',jsonb_build_object('rootId',root_id,'revision',revision,'kind',kind,'observedAt',entry->>'observedAt'),actor,actor_name);
 return jsonb_build_object('requestId',request,'packet',packet,'original',care_private.wound_path_original(root_id,tenant,subject,wound));
end $$;

create or replace function public.web_commit_wound_path_packet(p_packet jsonb)
returns jsonb language sql security invoker set search_path='' as $$select care_private.commit_wound_path_packet_impl(p_packet)$$;

create or replace function care_private.confirm_wound_path_packet_impl(requested_tenant uuid,requested_client uuid,requested_wound uuid,requested_actor uuid,requested_id uuid,packet jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare receipt care_private.wound_path_requests%rowtype;begin
 perform care_private.assert_wound_path_authority(requested_tenant,requested_client,requested_wound,requested_actor,false,false);
 select * into receipt from care_private.wound_path_requests r where r.tenant_id=requested_tenant and r.request_id=requested_id and r.client_id=requested_client and r.wound_case_id=requested_wound;
 if receipt.request_id is null or receipt.actor_id<>requested_actor or receipt.packet<>packet then return null;end if;
 if receipt.retained_original is null then raise exception 'Historische unveränderte Wundpfadquittung fehlt.' using errcode='P0H03';end if;
 return jsonb_build_object('requestId',requested_id,'packet',packet,'original',receipt.retained_original);
end $$;

create or replace function public.web_confirm_wound_path_packet(p_tenant_id uuid,p_client_id uuid,p_wound_id uuid,p_actor_profile_id uuid,p_request_id uuid,p_packet jsonb)
returns jsonb language sql security invoker set search_path='' as $$select care_private.confirm_wound_path_packet_impl(p_tenant_id,p_client_id,p_wound_id,p_actor_profile_id,p_request_id,p_packet)$$;

revoke all on function public.web_read_wound_path_context(uuid,uuid,uuid,uuid),public.web_read_wound_path_page(uuid,uuid,uuid,uuid,timestamptz,uuid,integer),public.web_commit_wound_path_packet(jsonb),public.web_confirm_wound_path_packet(uuid,uuid,uuid,uuid,uuid,jsonb) from public,anon;
revoke all on function care_private.read_wound_path_context_impl(uuid,uuid,uuid,uuid),care_private.read_wound_path_page_impl(uuid,uuid,uuid,uuid,timestamptz,uuid,integer),care_private.commit_wound_path_packet_impl(jsonb),care_private.confirm_wound_path_packet_impl(uuid,uuid,uuid,uuid,uuid,jsonb),care_private.wound_path_ref(uuid,uuid,uuid,integer,timestamptz,jsonb),care_private.wound_path_fingerprint(jsonb) from public,anon,authenticated;


-- Source: ambulatory_wound_path_review.sql (quarantined, with final hardening below).
-- PREPARED ONLY. Requires ambulatory_wound_path_packet.sql.
-- No production execution, no inferred wound administration and no automatic clinical acceptance.

create schema if not exists care_private;

create table if not exists care_private.wound_path_review_scopes(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),
 employee_id uuid not null references public.employees(id),qualification_id uuid not null references public.employee_qualifications(id),
 kind text not null check(kind='wound_care_review'),
 qualification_fingerprint text not null check(qualification_fingerprint~'^sha256:[0-9a-f]{64}$'),
 document_fingerprint text not null check(document_fingerprint~'^sha256:[0-9a-f]{64}$'),
 approved_by uuid not null references public.profiles(id),approved_at timestamptz not null,valid_until timestamptz not null,revoked_at timestamptz,
 check(valid_until>approved_at)
);
create table if not exists public.wound_path_review_roots(
 id uuid primary key,tenant_id uuid not null,client_id uuid not null,wound_case_id uuid not null,
 wound_root_id uuid not null,wound_head_id uuid not null references public.ambulatory_wound_path_events(id),
 wound_fingerprint text not null,wound_kind text not null,created_at timestamptz not null,
 unique(id,tenant_id,client_id,wound_case_id),unique(tenant_id,client_id,wound_case_id,wound_head_id)
);
create table if not exists public.wound_path_review_events(
 id uuid primary key,tenant_id uuid not null,client_id uuid not null,wound_case_id uuid not null,root_id uuid not null,
 revision integer not null check(revision in(1,2)),previous_id uuid,request_id uuid not null unique,
 action text not null check(action in('request','return','accept')),actor_id uuid not null references public.profiles(id),actor_name text not null,
 recorded_at timestamptz not null,reason text not null,required_change text not null,rationale text not null,
 wound_head_id uuid not null,wound_fingerprint text not null,qualification_original jsonb,fingerprint text not null,packet jsonb not null,
 unique(root_id,revision),unique(id,root_id),foreign key(root_id,tenant_id,client_id,wound_case_id) references public.wound_path_review_roots(id,tenant_id,client_id,wound_case_id),
 foreign key(previous_id,root_id) references public.wound_path_review_events(id,root_id),
 check((revision=1)=(previous_id is null)),check((action='request')=(revision=1)),check((action='request')=(qualification_original is null))
);
create table if not exists public.wound_path_review_receipts(
 request_id uuid primary key,tenant_id uuid not null,client_id uuid not null,wound_case_id uuid not null,actor_id uuid not null,
 root_id uuid not null,event_id uuid not null,packet jsonb not null,original jsonb not null,recorded_at timestamptz not null,
 foreign key(event_id,root_id) references public.wound_path_review_events(id,root_id)
);
create index if not exists wound_path_review_page on public.wound_path_review_roots(tenant_id,client_id,wound_case_id,created_at desc,id desc);
alter table care_private.wound_path_review_scopes enable row level security;
alter table public.wound_path_review_roots enable row level security;
alter table public.wound_path_review_events enable row level security;
alter table public.wound_path_review_receipts enable row level security;
revoke all on care_private.wound_path_review_scopes,public.wound_path_review_roots,public.wound_path_review_events,public.wound_path_review_receipts from public,anon,authenticated;

create or replace function care_private.wound_path_review_immutable()
returns trigger language plpgsql security invoker set search_path='' as $$begin raise exception 'Wundversorgungprüforiginale und Quittungen sind unveränderlich.' using errcode='23514';end$$;
do $$declare tab text;begin foreach tab in array array['wound_path_review_roots','wound_path_review_events','wound_path_review_receipts'] loop execute format('drop trigger if exists wound_path_review_immutable on public.%I',tab);execute format('create trigger wound_path_review_immutable before update or delete on public.%I for each row execute function care_private.wound_path_review_immutable()',tab);end loop;end$$;

create or replace function care_private.wound_path_review_original(root_ref uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',h.id::text,'tenantId',r.tenant_id::text,'clientId',r.client_id::text,'woundId',r.wound_case_id::text,'rootId',r.id::text,'headId',h.id::text,'revision',h.revision,
 'woundRootId',r.wound_root_id::text,'woundHeadId',r.wound_head_id::text,'woundFingerprint',r.wound_fingerprint,'woundKind',r.wound_kind,
 'status',case h.action when 'request' then 'requested' when 'return' then 'returned' else 'accepted' end,
 'history',(select jsonb_agg(jsonb_build_object('id',e.id::text,'revision',e.revision,'previousId',e.previous_id::text,'requestId',e.request_id::text,
 'action',e.action,'recordedAt',to_char(e.recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'actorId',e.actor_id::text,'actorName',e.actor_name,
 'reason',e.reason,'requiredChange',e.required_change,'rationale',e.rationale,'woundHeadId',e.wound_head_id::text,'woundFingerprint',e.wound_fingerprint,
 'qualification',e.qualification_original,'fingerprint',e.fingerprint) order by e.revision) from public.wound_path_review_events e where e.root_id=r.id))
 from public.wound_path_review_roots r join lateral(select e.* from public.wound_path_review_events e where e.root_id=r.id order by e.revision desc limit 1)h on true where r.id=root_ref
$$;
create or replace function care_private.read_wound_path_review_page(t uuid,c uuid,o uuid,actor uuid,at_cursor timestamptz,id_cursor uuid,page_size integer)
returns jsonb language plpgsql security definer set search_path='' as $$declare result jsonb;before_fingerprint text;after_fingerprint text;begin
 perform care_private.assert_wound_path_authority(t,c,o,actor,false,false);
 before_fingerprint:=care_private.wound_workspace_ledger_fingerprint(t,c,o,actor);
 if page_size is null or page_size<1 or page_size>100 or(at_cursor is null)<>(id_cursor is null) then raise exception 'Ungültige Cursorbindung.' using errcode='22023';end if;
 if at_cursor is not null and(not isfinite(at_cursor) or not exists(select 1 from public.wound_path_review_roots r where r.id=id_cursor and r.created_at=at_cursor and r.tenant_id=t and r.client_id=c and r.wound_case_id=o)) then raise exception 'Prüfcursor gehört nicht zu dieser Wundakte.' using errcode='23514';end if;
 with page as materialized(select r.* from public.wound_path_review_roots r where r.tenant_id=t and r.client_id=c and r.wound_case_id=o and(at_cursor is null or(r.created_at,r.id)<(at_cursor,id_cursor)) order by r.created_at desc,r.id desc limit page_size)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(care_private.wound_path_review_original(p.id) order by p.created_at desc,p.id desc) from page p),'[]'::jsonb),
 'nextCursorRecordedAt',(select to_char(p.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') from page p order by p.created_at,p.id limit 1),
 'nextCursorId',(select p.id::text from page p order by p.created_at,p.id limit 1)) into result;after_fingerprint:=care_private.wound_workspace_ledger_fingerprint(t,c,o,actor);perform care_private.wound_require(before_fingerprint=after_fingerprint,'Vollständiger Wundprüfbestand wurde während des Lesens geändert.');return result||jsonb_build_object('stateFingerprint',after_fingerprint);
end$$;

create or replace function care_private.commit_wound_path_review(p jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t uuid:=(p->>'tenantId')::uuid;c uuid:=(p->>'clientId')::uuid;m uuid:=(p->>'woundId')::uuid;actor uuid:=(p->>'actorId')::uuid;req uuid:=(p->>'requestId')::uuid;action_value text:=p->>'action';
 wound_root uuid:=(p#>>'{woundOriginal,rootId}')::uuid;wound_head uuid:=(p#>>'{woundOriginal,headId}')::uuid;wound jsonb;latest public.ambulatory_wound_path_events;
 review_root uuid;event_ref uuid:=gen_random_uuid();prior public.wound_path_review_events;receipt public.wound_path_review_receipts;
 now_at timestamptz:=clock_timestamp();today date:=(clock_timestamp() at time zone 'Europe/Berlin')::date;expected integer:=(p->>'expectedRevision')::integer;name text;qualification jsonb:=null;fingerprint text;original jsonb;
begin
 perform care_private.wound_require(care_private.wound_json_keys(p,array['schemaVersion','action','requestId','tenantId','clientId','woundId','actorId','expectedHeadId','expectedRevision','woundOriginal','sources','reviewOriginal','reason','requiredChange','rationale']) and p->'schemaVersion'='"1"'::jsonb and jsonb_typeof(p->'expectedRevision')='number' and p->>'expectedRevision' in('0','1'),'Vollständige typisierte Wundfachprüfanfrage fehlt.');
 perform care_private.assert_wound_path_authority(t,c,m,actor,false,false);
 if jsonb_typeof(p) is distinct from 'object' or not(p ?& array['schemaVersion','action','requestId','tenantId','clientId','woundId','actorId','expectedHeadId','expectedRevision','woundOriginal','sources','reviewOriginal','reason','requiredChange','rationale'])
 or exists(select 1 from jsonb_object_keys(p) k where k not in('schemaVersion','action','requestId','tenantId','clientId','woundId','actorId','expectedHeadId','expectedRevision','woundOriginal','sources','reviewOriginal','reason','requiredChange','rationale'))
 or p->>'schemaVersion' is distinct from '1' or action_value not in('request','return','accept') or t is null or c is null or m is null or actor is null or req is null or expected is null
 or jsonb_typeof(p->'reason') is distinct from 'string' or jsonb_typeof(p->'requiredChange') is distinct from 'string' or jsonb_typeof(p->'rationale') is distinct from 'string'
 or length(p->>'reason')>2000 or length(p->>'requiredChange')>4000 or length(p->>'rationale')>4000 then raise exception 'Wundversorgungprüfpaket ist unvollständig.' using errcode='23514';end if;
 perform pg_advisory_xact_lock(hashtextextended('wound-review-request:'||t||':'||req,0));
 perform pg_advisory_xact_lock(hashtextextended(t::text||':'||c::text||':'||m::text,0));
 select * into receipt from public.wound_path_review_receipts r where r.request_id=req for update;
 if found then if receipt.tenant_id<>t or receipt.client_id<>c or receipt.wound_case_id<>m or receipt.actor_id<>actor or receipt.packet<>p then raise exception 'Anfragekennung ist anders gebunden.' using errcode='40001';end if;return jsonb_build_object('requestId',req::text,'packet',p,'original',receipt.original);end if;
 select * into latest from public.ambulatory_wound_path_events e where e.tenant_id=t and e.client_id=c and e.wound_case_id=m and e.root_id=wound_root order by e.revision desc limit 1 for update;
 if not found or latest.id<>wound_head then raise exception 'Aktuelle unveränderte Wundversorgungfassung fehlt.' using errcode='40001';end if;
 wound:=care_private.wound_path_original(wound_root,t,c,m);
 if wound is distinct from p->'woundOriginal' or wound->>'contentFingerprint' is distinct from latest.content_fingerprint then raise exception 'Unverändertes abgeschlossenes Wundpfadoriginal fehlt.' using errcode='40001';end if;
 if care_private.read_wound_path_context_impl(t,c,m,actor) is distinct from p->'sources' then raise exception 'Vollständige aktuelle Wundquellen wurden verändert.' using errcode='40001';end if;
 perform care_private.validate_wound_path_entry(jsonb_build_object('entry',wound->'payload','tenantId',t,'clientId',c,'woundId',m,'actorId',wound->'recordedBy','requestId',wound->'headId'));
 if wound->>'kind' not in('escalation_resolution','correction') or wound#>>'{payload,resolution,state}'<>'resolved' or wound#>>'{payload,contact,state}'<>'responded' or wound#>>'{payload,care,outcome}' not in('performed','partial','omitted','refused','failed') or wound#>>'{payload,care,planId}' is null or wound#>>'{payload,care,dressingId}' is null then raise exception 'Planung, Bild oder Auswahl belegt keinen abgeschlossenen tatsächlichen Wundpfad.' using errcode='23514';end if;
 if action_value='request' then perform care_private.assert_wound_path_authority(t,c,m,actor,true,false);elsif not care_private.wound_has_permission('pflege.documentation.sign') then raise exception 'Wundfachprüfrecht fehlt.' using errcode='42501';end if;
 select coalesce(pr.display_name,pr.email) into name from public.profiles pr where pr.id=actor and pr.tenant_id=t and pr.is_active=true;if btrim(coalesce(name,''))='' then raise exception 'Aktiver Akteur fehlt.' using errcode='42501';end if;
 if action_value='request' then
  if expected<>0 or p->'expectedHeadId' is distinct from 'null'::jsonb or p->'reviewOriginal' is distinct from 'null'::jsonb or length(btrim(p->>'reason'))<10 or p->>'requiredChange'<>'' or p->>'rationale'<>'' then raise exception 'Prüfanfrage darf keine Entscheidung enthalten.' using errcode='23514';end if;
  perform care_private.assert_wound_path_authority(t,c,m,actor,true,false);
  perform care_private.assert_wound_photo_current(wound->'payload',t,c,m);
  now_at:=clock_timestamp();
  review_root:=event_ref;insert into public.wound_path_review_roots(id,tenant_id,client_id,wound_case_id,wound_root_id,wound_head_id,wound_fingerprint,wound_kind,created_at) values(review_root,t,c,m,wound_root,wound_head,wound->>'contentFingerprint',wound->>'kind',now_at);
 else
  review_root:=(p#>>'{reviewOriginal,rootId}')::uuid;
  perform 1 from public.wound_path_review_roots r where r.id=review_root and r.tenant_id=t and r.client_id=c and r.wound_case_id=m and r.wound_root_id=wound_root and r.wound_head_id=wound_head for update;if not found then raise exception 'Passende Wundversorgungprüfanfrage fehlt.' using errcode='40001';end if;
  select * into prior from public.wound_path_review_events e where e.root_id=review_root order by e.revision desc limit 1 for update;
  if not found or expected<>1 or prior.revision<>expected or prior.action<>'request' or prior.id::text is distinct from p->>'expectedHeadId' or care_private.wound_path_review_original(review_root) is distinct from p->'reviewOriginal' then raise exception 'Wundversorgungprüfanfrage hat sich geändert.' using errcode='40001';end if;
  if actor=prior.actor_id or exists(select 1 from jsonb_array_elements(wound->'history') h where h->>'recordedBy'=actor::text or actor::text in(h#>>'{payload,contact,responsibleBy}',h#>>'{payload,resolution,responsibleBy}',h#>>'{payload,correction,approvedBy}')) or exists(select 1 from public.ambulatory_wound_dressings d where d.id=(wound#>>'{payload,care,dressingId}')::uuid and d.recorded_by=actor) then raise exception 'Anfragende, dokumentierende, versorgende, kontaktierende oder freigebende Person darf nicht selbst entscheiden.' using errcode='42501';end if;
  if exists(
   select 1 from public.profiles profile join(
    select prior.actor_id id
    union select (h->>'recordedBy')::uuid from jsonb_array_elements(wound->'history')h
    union select (h#>>'{payload,contact,responsibleBy}')::uuid from jsonb_array_elements(wound->'history')h where h#>>'{payload,contact,responsibleBy}' is not null
    union select (h#>>'{payload,resolution,responsibleBy}')::uuid from jsonb_array_elements(wound->'history')h where h#>>'{payload,resolution,responsibleBy}' is not null
    union select (h#>>'{payload,correction,approvedBy}')::uuid from jsonb_array_elements(wound->'history')h where h#>>'{payload,correction,approvedBy}' is not null
    union select a.recorded_by from public.clinical_wound_assessments a where a.id=(wound#>>'{payload,observation,assessmentId}')::uuid and a.tenant_id=t and a.client_id=c and a.wound_case_id=m
    union select a.recorded_by from public.ambulatory_wound_photo_links a where a.id=(wound#>>'{payload,observation,photoId}')::uuid and a.tenant_id=t and a.client_id=c and a.wound_case_id=m
    union select a.recorded_by from public.ambulatory_wound_plan_versions a where a.id=(wound#>>'{payload,care,planId}')::uuid and a.tenant_id=t and a.client_id=c and a.wound_case_id=m
    union select a.recorded_by from public.ambulatory_wound_dressings a where a.id=(wound#>>'{payload,care,dressingId}')::uuid and a.tenant_id=t and a.client_id=c and a.wound_case_id=m
   )involved on involved.id=profile.id where profile.tenant_id=t and coalesce(profile.auth_user_id,profile.id)=auth.uid()
  ) then raise exception 'Dieselbe angemeldete Person darf auch über ein anderes Profil ihre eigene Wundfassung nicht prüfen.' using errcode='42501';end if;
  lock table public.employees,public.employee_employment_details,public.employee_qualifications,public.employee_documents,care_private.wound_path_review_scopes in share mode;
  now_at:=clock_timestamp();today:=(now_at at time zone 'Europe/Berlin')::date;
  select jsonb_build_object('id',q.id::text,'employeeId',e.id::text,'profileId',e.profile_id::text,'qualificationType',q.qualification_type,'title',q.title,'status',q.status,
   'issuedAt',to_char(q.issued_at,'YYYY-MM-DD'),'validUntil',to_char(q.valid_until,'YYYY-MM-DD'),'verifiedAt',to_char(q.verified_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'updatedAt',to_char(q.updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
   'documentId',d.id::text,'documentFingerprint',scope.document_fingerprint,'sourceFingerprint',scope.qualification_fingerprint,'employmentStart',to_char(coalesce(e.entry_date,e.start_date),'YYYY-MM-DD'),'employmentEnd',to_char(e.exit_date,'YYYY-MM-DD'),
   'employeeFingerprint','sha256:'||encode(extensions.digest(convert_to(jsonb_build_object('employee',to_jsonb(e),'employment',to_jsonb(ed))::text,'UTF8'),'sha256'),'hex'),
   'scopeId',scope.id::text,'scopeKind','wound_care_review','scopeFingerprint','sha256:'||encode(extensions.digest(convert_to(to_jsonb(scope)::text,'UTF8'),'sha256'),'hex')) into qualification
  from public.employees e join public.employee_employment_details ed on ed.employee_id=e.id and ed.tenant_id=e.tenant_id join public.employee_qualifications q on q.employee_id=e.id and q.tenant_id=e.tenant_id join public.employee_documents d on d.id=q.document_id and d.employee_id=e.id and d.tenant_id=e.tenant_id
  join care_private.wound_path_review_scopes scope on scope.employee_id=e.id and scope.qualification_id=q.id and scope.tenant_id=e.tenant_id and scope.kind='wound_care_review'
  where e.tenant_id=t and e.profile_id=actor and e.status='aktiv' and ed.employment_status='active' and coalesce(e.entry_date,e.start_date)<=today and(e.entry_date is null or e.entry_date<=today) and(e.start_date is null or e.start_date<=today) and(e.exit_date is null or e.exit_date>=today)
   and q.status in('valid','expires_soon') and q.verified_at<=now_at and q.updated_at<=now_at and(q.issued_at is null or q.issued_at<=today) and(q.valid_until is null or q.valid_until>=today) and(d.valid_until is null or d.valid_until>=today) and btrim(coalesce(d.storage_path,''))<>''
   and scope.approved_at<=now_at and scope.valid_until>now_at and scope.revoked_at is null and scope.qualification_fingerprint='sha256:'||encode(extensions.digest(convert_to(to_jsonb(q)::text,'UTF8'),'sha256'),'hex') and scope.document_fingerprint='sha256:'||encode(extensions.digest(convert_to(to_jsonb(d)::text,'UTF8'),'sha256'),'hex')
  order by scope.approved_at desc,scope.id desc limit 1;
  if qualification is null then raise exception 'Aktuelle Beschäftigung, Qualifikation, Dokument und Wundversorgungprüfbereich fehlen.' using errcode='42501';end if;
  if not exists(select 1 from care_private.wound_path_review_scopes scope where scope.id=(qualification->>'scopeId')::uuid and scope.valid_until>clock_timestamp() and scope.revoked_at is null) or today<>(clock_timestamp() at time zone 'Europe/Berlin')::date then raise exception 'Wundfachprüfbereich ist während der Prüfung abgelaufen; aktuelle Grundlage neu lesen.' using errcode='42501';end if;
  if action_value='return' then if length(btrim(p->>'reason'))<10 or length(btrim(p->>'requiredChange'))<10 or p->>'rationale'<>'' then raise exception 'Rückgabe benötigt Grund und konkrete Änderung.' using errcode='23514';end if;
  else if p->>'reason'<>'' or p->>'requiredChange'<>'' or length(btrim(p->>'rationale'))<10 then raise exception 'Fachliche Annahme benötigt eine konkrete Begründung ohne Rückgabeinhalt.' using errcode='23514';end if;end if;
 end if;
 fingerprint:='sha256:'||encode(extensions.digest(convert_to(jsonb_build_object('packet',p,'qualification',qualification)::text,'UTF8'),'sha256'),'hex');
 perform care_private.assert_wound_path_authority(t,c,m,actor,action_value='request',false);
 perform care_private.assert_wound_photo_current(wound->'payload',t,c,m);
 if action_value<>'request' then
  if care_private.wound_has_permission('pflege.documentation.sign') is not true or not exists(select 1 from care_private.wound_path_review_scopes scope where scope.id=(qualification->>'scopeId')::uuid and scope.valid_until>clock_timestamp() and scope.revoked_at is null) or today<>(clock_timestamp() at time zone 'Europe/Berlin')::date then raise exception 'Aktuelle eigene Sitzung, Fachprüfrechte oder Gültigkeit wurden während der Prüfung beendet.' using errcode='42501';end if;
  now_at:=clock_timestamp();
 end if;
 insert into public.wound_path_review_events(id,tenant_id,client_id,wound_case_id,root_id,revision,previous_id,request_id,action,actor_id,actor_name,recorded_at,reason,required_change,rationale,wound_head_id,wound_fingerprint,qualification_original,fingerprint,packet)
 values(event_ref,t,c,m,review_root,expected+1,case when expected=0 then null else prior.id end,req,action_value,actor,name,now_at,p->>'reason',p->>'requiredChange',p->>'rationale',wound_head,wound->>'contentFingerprint',qualification,fingerprint,p);
 original:=care_private.wound_path_review_original(review_root);insert into public.wound_path_review_receipts(request_id,tenant_id,client_id,wound_case_id,actor_id,root_id,event_id,packet,original,recorded_at) values(req,t,c,m,actor,review_root,event_ref,p,original,now_at);
 return jsonb_build_object('requestId',req::text,'packet',p,'original',original);
end$$;
create or replace function care_private.confirm_wound_path_review(t uuid,c uuid,m uuid,actor uuid,req uuid,p jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$declare r public.wound_path_review_receipts;begin perform care_private.assert_wound_path_authority(t,c,m,actor,false,false);select * into r from public.wound_path_review_receipts x where x.request_id=req and x.tenant_id=t and x.client_id=c and x.wound_case_id=m and x.actor_id=actor;if not found or r.packet is distinct from p then raise exception 'Keine passende unveränderliche Wundfachprüfquittung.' using errcode='P0H03';end if;return jsonb_build_object('requestId',req::text,'packet',r.packet,'original',r.original);end$$;
create or replace function public.web_read_wound_path_review_page(p_tenant_id uuid,p_client_id uuid,p_wound_id uuid,p_actor_profile_id uuid,p_cursor_recorded_at timestamptz,p_cursor_id uuid,p_page_size integer)returns jsonb language sql security invoker set search_path='' as $$select care_private.read_wound_path_review_page(p_tenant_id,p_client_id,p_wound_id,p_actor_profile_id,p_cursor_recorded_at,p_cursor_id,p_page_size)$$;
create or replace function public.web_commit_wound_path_review(p_packet jsonb)returns jsonb language sql security invoker set search_path='' as $$select care_private.commit_wound_path_review(p_packet)$$;
create or replace function public.web_confirm_wound_path_review(p_tenant_id uuid,p_client_id uuid,p_wound_id uuid,p_actor_profile_id uuid,p_request_id uuid,p_packet jsonb)returns jsonb language sql security invoker set search_path='' as $$select care_private.confirm_wound_path_review(p_tenant_id,p_client_id,p_wound_id,p_actor_profile_id,p_request_id,p_packet)$$;
revoke all on function care_private.wound_path_review_immutable(),care_private.wound_path_review_original(uuid),care_private.read_wound_path_review_page(uuid,uuid,uuid,uuid,timestamptz,uuid,integer),care_private.commit_wound_path_review(jsonb),care_private.confirm_wound_path_review(uuid,uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.web_read_wound_path_review_page(uuid,uuid,uuid,uuid,timestamptz,uuid,integer),public.web_commit_wound_path_review(jsonb),public.web_confirm_wound_path_review(uuid,uuid,uuid,uuid,uuid,jsonb) from public,anon;


-- Final API security and consistency. Original source proposal files are left unchanged.
create or replace function care_private.wound_require(p_condition boolean,p_message text)
returns void language plpgsql immutable set search_path='' as $$begin if p_condition is distinct from true then raise exception '%',p_message using errcode='23514';end if;end$$;
create or replace function care_private.wound_json_keys(value jsonb,expected text[])
returns boolean language sql immutable set search_path='' as $$select case when jsonb_typeof(value)='object' then value ?& expected and value-expected='{}'::jsonb else false end$$;
create or replace function care_private.wound_json_uuid(value jsonb)
returns boolean language sql immutable set search_path='' as $$select coalesce(jsonb_typeof(value)='string' and value#>>'{}' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',false)$$;
create or replace function care_private.wound_json_text(value jsonb,minimum integer default 0,maximum integer default 8000)
returns boolean language sql immutable set search_path='' as $$select coalesce(jsonb_typeof(value)='string' and length(btrim(value#>>'{}'))>=minimum and length(value#>>'{}')<=maximum,false)$$;
create or replace function care_private.wound_json_time(value jsonb)
returns timestamptz language plpgsql immutable set search_path='' as $$declare result timestamptz;begin
 perform care_private.wound_require(jsonb_typeof(value)='string' and value#>>'{}' ~ '^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.][0-9]{1,6})?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$','Tatsächlicher Originalzeitpunkt fehlt.');
 result:=(value#>>'{}')::timestamptz;perform care_private.wound_require(isfinite(result),'Originalzeitpunkt muss endlich sein.');return result;
end$$;
create or replace function care_private.assert_wound_path_authority(requested_tenant uuid,requested_client uuid,requested_wound uuid,requested_actor uuid,write_required boolean,contact_required boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform care_private.require_workspace_session(requested_tenant,requested_actor);
 if requested_tenant is distinct from public.current_tenant_id() or requested_actor is distinct from public.resolve_current_profile_id() or requested_client is null or requested_wound is null then raise exception 'Eigener Wundfallbezug fehlt.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('wound-client:'||requested_tenant||':'||requested_client,0));
 if care_private.wound_has_permission('pflege.wounds.view') is not true or care_private.wound_has_permission('pflege.orders.view') is not true or care_private.wound_has_permission('pflege.treatment.view') is not true or(write_required and care_private.wound_has_permission('pflege.wounds.manage') is not true) or(contact_required and care_private.wound_has_permission('pflege.treatment.manage') is not true) or care_private.wound_active_client(requested_client) is not true then raise exception 'Aktuelle eigene Wund-, Anordnungs-, Behandlungsrechte oder Pflegezuordnung fehlen.' using errcode='42501';end if;
 perform 1 from public.clinical_wound_cases w where w.id=requested_wound and w.tenant_id=requested_tenant and w.client_id=requested_client for share;
 if not found then raise exception 'Eigener Wundfall fehlt.' using errcode='42501';end if;
end$$;

create or replace function care_private.validate_wound_path_packet_shape(p jsonb)
returns void language plpgsql immutable set search_path='' as $$declare field text;begin
 perform care_private.wound_require(care_private.wound_json_keys(p,array['schemaVersion','action','requestId','tenantId','clientId','woundId','actorId','expectedHeadId','expectedRevision','entry','reason','original','sources']) and p->'schemaVersion'='"1"'::jsonb and p->>'action' in('create','revise') and jsonb_typeof(p->'expectedRevision')='number' and p->>'expectedRevision' ~ '^(0|[1-9][0-9]{0,3})$' and(p->>'expectedRevision')::integer<2000 and care_private.wound_json_text(p->'reason',0,8000) and jsonb_typeof(p->'sources')='object','Vollständige eigene Wundpfadanfrage fehlt.');
 foreach field in array array['requestId','tenantId','clientId','woundId','actorId'] loop perform care_private.wound_require(care_private.wound_json_uuid(p->field),'Wundpfadanfrage enthält ungültige Kennungen.');end loop;
 perform care_private.wound_require(p->'expectedHeadId'='null'::jsonb or care_private.wound_json_uuid(p->'expectedHeadId'),'Ungültiger ursprünglicher Wundpfadkopf.');
end$$;

create or replace function care_private.validate_wound_path_entry(p jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare e jsonb:=p->'entry';o jsonb;c jsonb;d jsonb;person jsonb;r jsonb;x jsonb;field text;sign jsonb;seen text[]:=array[]::text[];v text;at_time timestamptz;contact_time timestamptz;response_time timestamptz;now_at timestamptz:=clock_timestamp();t uuid:=(p->>'tenantId')::uuid;cl uuid:=(p->>'clientId')::uuid;w uuid:=(p->>'woundId')::uuid;actor uuid:=(p->>'actorId')::uuid;actual public.ambulatory_wound_dressings%rowtype;execution public.clinical_treatment_executions%rowtype;
begin
 perform care_private.wound_require(care_private.wound_json_keys(e,array['kind','title','tenantId','clientId','woundId','observedAt','observation','contact','care','person','resolution','correction']) and e->>'kind' in('infection_suspicion','clinical_contact','clinical_response','escalation_resolution','reopen_escalation','correction') and care_private.wound_json_text(e->'title',3,300) and e->'tenantId'=p->'tenantId' and e->'clientId'=p->'clientId' and e->'woundId'=p->'woundId','Vorgangsart, tatsächlicher Titel oder vollständige Wundbindung fehlt.');
 at_time:=care_private.wound_json_time(e->'observedAt');perform care_private.wound_require(at_time<=now_at,'Wundbeobachtung liegt in der Zukunft.');
 o:=e->'observation';c:=e->'contact';d:=e->'care';person:=e->'person';r:=e->'resolution';x:=e->'correction';
 perform care_private.wound_require(care_private.wound_json_keys(o,array['state','signs','narrative','assessmentId','photoId','photoConsentId']) and o->>'state' in('suspected','ruled_out','unclear') and care_private.wound_json_text(o->'narrative',3,8000) and jsonb_typeof(o->'signs')='array','Vollständige ausdrückliche Beobachtung fehlt.');
 perform care_private.wound_require(jsonb_array_length(o->'signs')<=30,'Zu viele Beobachtungszeichen.');
 for sign in select value from jsonb_array_elements(o->'signs') loop
  perform care_private.wound_require(care_private.wound_json_text(sign,1,200),'Beobachtetes Zeichen fehlt.');v:=lower(btrim(sign#>>'{}'));perform care_private.wound_require(not v=any(seen),'Doppelte Beobachtungszeichen.');seen:=array_append(seen,v);
 end loop;
 perform care_private.wound_require(o->>'state'<>'suspected' or cardinality(seen)>0,'Verdacht benötigt tatsächliche Zeichen; keine Diagnose wird abgeleitet.');
 foreach field in array array['assessmentId','photoId','photoConsentId'] loop perform care_private.wound_require(o->field='null'::jsonb or care_private.wound_json_uuid(o->field),'Ungültiger Beobachtungsbezug.');end loop;
 if o->>'assessmentId' is not null then
  perform 1 from public.clinical_wound_assessments a where a.id=(o->>'assessmentId')::uuid and a.tenant_id=t and a.client_id=cl and a.wound_case_id=w for share;if not found then raise exception 'Assessmentoriginal fehlt in dieser Wunde.' using errcode='23514';end if;
 end if;
 perform care_private.wound_require(care_private.wound_json_keys(c,array['state','channel','contactedAt','contactName','responseAt','response','nextStep','responsibleBy']) and c->>'state' in('pending','attempted','reached','responded') and care_private.wound_json_text(c->'nextStep',3,8000) and care_private.wound_json_text(c->'channel',0,8000) and care_private.wound_json_text(c->'contactName',0,8000) and care_private.wound_json_text(c->'response',0,8000) and(c->'responsibleBy'='null'::jsonb or care_private.wound_json_uuid(c->'responsibleBy')),'Kontaktstatus und vollständige Verantwortungsangaben fehlen.');
 if c->>'state'='pending' then
  perform care_private.wound_require(c->'contactedAt'='null'::jsonb and c->'responseAt'='null'::jsonb and c->>'channel'='' and c->>'contactName'='' and c->>'response'='','Offener Kontakt darf keine tatsächliche Durchführung vortäuschen.');
 else
  contact_time:=care_private.wound_json_time(c->'contactedAt');perform care_private.wound_require(contact_time<=now_at and care_private.wound_json_text(c->'channel',1,8000) and care_private.wound_json_text(c->'contactName',1,8000) and care_private.wound_json_uuid(c->'responsibleBy'),'Tatsächlicher Kontakt benötigt Zeit, Kanal, Gegenstelle und Verantwortung.');
 end if;
 if c->>'state'='responded' then
  response_time:=care_private.wound_json_time(c->'responseAt');perform care_private.wound_require(response_time>=contact_time and response_time<=now_at and care_private.wound_json_text(c->'response',3,8000),'Tatsächliche Rückmeldung benötigt Inhalt und eine passende eigene Zeit.');
 else perform care_private.wound_require(c->'responseAt'='null'::jsonb and c->>'response'='','Ohne Rückmeldung dürfen Antwortzeit und Antwortinhalt nicht gesetzt sein.');end if;
 perform care_private.wound_require(care_private.wound_json_keys(d,array['planId','dressingId','outcome','occurredAt','action','reason']) and d->>'outcome' in('none','performed','partial','omitted','refused','failed') and care_private.wound_json_text(d->'action',0,8000) and care_private.wound_json_text(d->'reason',0,8000) and(d->'planId'='null'::jsonb or care_private.wound_json_uuid(d->'planId')) and(d->'dressingId'='null'::jsonb or care_private.wound_json_uuid(d->'dressingId')),'Versorgungsbezug ist unvollständig.');
 if d->>'planId' is not null then perform 1 from public.ambulatory_wound_plan_versions a where a.id=(d->>'planId')::uuid and a.tenant_id=t and a.client_id=cl and a.wound_case_id=w for share;if not found then raise exception 'Planoriginal fehlt in dieser Wunde.' using errcode='23514';end if;end if;
 if d->>'outcome'='none' then perform care_private.wound_require(d->'occurredAt'='null'::jsonb and d->'dressingId'='null'::jsonb and d->>'action'='','Beobachtung oder Planung darf keine tatsächliche Versorgung vortäuschen.');
 else
  perform care_private.wound_require(care_private.wound_json_uuid(d->'dressingId') and care_private.wound_json_time(d->'occurredAt')<=now_at and care_private.wound_json_text(d->'action',3,8000) and care_private.wound_json_text(d->'reason',3,8000),'Tatsächliche Versorgung oder Nichtversorgung benötigt Original, Zeitpunkt und Grund.');
  select * into actual from public.ambulatory_wound_dressings a where a.id=(d->>'dressingId')::uuid and a.tenant_id=t and a.client_id=cl and a.wound_case_id=w for share;
  perform care_private.wound_require(actual.id is not null and coalesce(to_jsonb(actual.plan_id),'null'::jsonb)=d->'planId' and actual.outcome=d->>'outcome' and actual.occurred_at=care_private.wound_json_time(d->'occurredAt'),'Versorgungsoriginal, Planbezug, Ergebnis oder tatsächliche Zeit widersprechen sich.');
  select * into execution from public.clinical_treatment_executions a where a.id=actual.execution_id and a.tenant_id=t and a.client_id=cl for share;
  perform care_private.wound_require(execution.id is not null and execution.treatment_type='wound_dressing' and execution.performed_at=actual.occurred_at and execution.outcome=actual.outcome and execution.details::jsonb is not distinct from actual.details and execution.recorded_by=actual.recorded_by and execution.recorded_by_name=actual.recorded_by_name and execution.medical_order_id is not distinct from (actual.plan_snapshot->>'medical_order_id')::uuid and execution.deviation_reason=actual.details->>'deviation' and execution.escalation=actual.details->>'contact' and execution.qualification_snapshot=actual.details->>'qualificationBasis','Zugehöriger Behandlungspflegenachweis fehlt oder widerspricht dem tatsächlichen Wundversorgungsoriginal.');
 end if;
 perform care_private.wound_require(care_private.wound_json_keys(person,array['decision','informedAt','photoDecision']) and care_private.wound_json_text(person->'decision',3,8000) and person->>'photoDecision' in('not_applicable','pending','consented','declined'),'Ausdrückliche Personen- und Bildentscheidung fehlt.');
 if person->'informedAt'<>'null'::jsonb then perform care_private.wound_require(care_private.wound_json_time(person->'informedAt')<=now_at,'Personeninformation liegt in der Zukunft.');end if;
 if o->>'photoId' is not null then
  perform care_private.wound_require(person->>'photoDecision'='consented' and care_private.wound_json_uuid(o->'photoConsentId') and care_private.wound_json_uuid(o->'assessmentId'),'Bildverwendung benötigt ausdrückliche Entscheidung, Befund und Einwilligungsoriginal.');
  perform 1 from public.ambulatory_wound_photo_links a join public.client_consents b on b.id=a.consent_id and b.tenant_id=a.tenant_id and b.client_id=a.client_id where a.id=(o->>'photoId')::uuid and a.tenant_id=t and a.client_id=cl and a.wound_case_id=w and a.assessment_id=(o->>'assessmentId')::uuid and a.consent_id=(o->>'photoConsentId')::uuid and b.granted and(b.expires_at is null or b.expires_at>clock_timestamp()) for share of a,b;
  if not found then raise exception 'Bild-, Befund- oder aktives Einwilligungsoriginal fehlt.' using errcode='23514';end if;
 end if;
 perform care_private.wound_require(care_private.wound_json_keys(r,array['state','resolvedAt','result','followUpAt','responsibleBy']) and r->>'state' in('open','monitoring','resolved','reopened') and care_private.wound_json_text(r->'result',0,8000) and(r->'responsibleBy'='null'::jsonb or care_private.wound_json_uuid(r->'responsibleBy')),'Eskalationsstand und vollständige Verantwortung fehlen.');
 if r->'followUpAt'<>'null'::jsonb then perform care_private.wound_json_time(r->'followUpAt');end if;
 if r->>'state'='resolved' then perform care_private.wound_require(c->>'state'='responded' and care_private.wound_json_time(r->'resolvedAt')>=response_time and care_private.wound_json_time(r->'resolvedAt')<=now_at and care_private.wound_json_text(r->'result',3,8000) and care_private.wound_json_uuid(r->'responsibleBy'),'Abschluss benötigt tatsächliche Rückmeldung, nachfolgendes Ergebnis und Verantwortung.');
 else perform care_private.wound_require(r->'resolvedAt'='null'::jsonb and r->>'result'='','Offene Eskalation darf keinen tatsächlichen Abschluss vortäuschen.');end if;
 if r->>'state'='monitoring' then perform care_private.wound_require(r->'followUpAt'<>'null'::jsonb and care_private.wound_json_uuid(r->'responsibleBy'),'Kontrolle benötigt ausdrücklichen Termin und Verantwortung.');end if;
 foreach v in array array[c->>'responsibleBy',r->>'responsibleBy'] loop
  if v is not null then perform 1 from public.profiles q where q.id=v::uuid and q.tenant_id=t and q.is_active and q.status='active' for share;if not found then raise exception 'Aktive eigene verantwortliche Person fehlt.' using errcode='23514';end if;end if;
 end loop;
 perform care_private.wound_require(care_private.wound_json_keys(x,array['targetId','reason','replacementId','approvedBy','approvedAt']) and care_private.wound_json_text(x->'reason',0,8000),'Berichtigungsfelder fehlen.');
 if e->>'kind'='correction' then
  perform care_private.wound_require(care_private.wound_json_uuid(x->'targetId') and x->'replacementId'=p->'requestId' and x->'targetId'<>x->'replacementId' and x->'approvedBy'=p->'actorId' and care_private.wound_json_text(x->'reason',10,8000) and care_private.wound_json_time(x->'approvedAt')<=now_at,'Berichtigung ist nicht an Original, eigene technische Dokumentation und Anfrage gebunden.');
  perform 1 from public.ambulatory_wound_path_events a where a.id=(x->>'targetId')::uuid and a.tenant_id=t and a.client_id=cl and a.wound_case_id=w for share;if not found then raise exception 'Berichtigungsoriginal fehlt.' using errcode='23514';end if;
 else perform care_private.wound_require(x='{"targetId":null,"reason":"","replacementId":null,"approvedBy":null,"approvedAt":null}'::jsonb,'Nur eine Berichtigung darf Berichtigungsfelder setzen.');end if;
 perform care_private.wound_require(not(e->>'kind'='infection_suspicion' and o->>'state'<>'suspected' or e->>'kind'='clinical_contact' and c->>'state'='pending' or e->>'kind'='clinical_response' and c->>'state'<>'responded' or e->>'kind'='escalation_resolution' and r->>'state'<>'resolved' or e->>'kind'='reopen_escalation' and r->>'state'<>'reopened'),'Vorgangsart und tatsächlicher Status widersprechen sich.');
end$$;

-- A page uses one CTE scope for both originals and cursor; the cursor belongs to this exact case.
create or replace function care_private.read_wound_path_page_impl(requested_tenant uuid,requested_client uuid,requested_wound uuid,requested_actor uuid,cursor_recorded timestamptz,cursor_id uuid,page_size integer)
returns jsonb language plpgsql security definer set search_path='' as $$declare result jsonb;before_fingerprint text;after_fingerprint text;begin
 perform care_private.assert_wound_path_authority(requested_tenant,requested_client,requested_wound,requested_actor,false,false);
 before_fingerprint:=care_private.wound_workspace_ledger_fingerprint(requested_tenant,requested_client,requested_wound,requested_actor);
 perform care_private.wound_require(page_size between 1 and 100 and(cursor_recorded is null)=(cursor_id is null) and(cursor_recorded is null or isfinite(cursor_recorded)),'Ungültige Wundpfadseite.');
 if cursor_id is not null and not exists(select 1 from public.ambulatory_wound_path_events e where e.id=cursor_id and e.created_at=cursor_recorded and e.tenant_id=requested_tenant and e.client_id=requested_client and e.wound_case_id=requested_wound and not exists(select 1 from public.ambulatory_wound_path_events newer where newer.root_id=e.root_id and newer.revision>e.revision)) then raise exception 'Wundpfadcursor gehört nicht zu dieser Akte.' using errcode='23514';end if;
 with heads as(select distinct on(e.root_id)e.* from public.ambulatory_wound_path_events e where e.tenant_id=requested_tenant and e.client_id=requested_client and e.wound_case_id=requested_wound order by e.root_id,e.revision desc),
 page as materialized(select h.* from heads h where cursor_recorded is null or(h.created_at,h.id)<(cursor_recorded,cursor_id) order by h.created_at desc,h.id desc limit page_size)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(care_private.wound_path_original(p.root_id,requested_tenant,requested_client,requested_wound) order by p.created_at desc,p.id desc) from page p),'[]'::jsonb),'nextCursorRecordedAt',(select p.created_at from page p order by p.created_at,p.id limit 1),'nextCursorId',(select p.id from page p order by p.created_at,p.id limit 1)) into result;
 after_fingerprint:=care_private.wound_workspace_ledger_fingerprint(requested_tenant,requested_client,requested_wound,requested_actor);perform care_private.wound_require(before_fingerprint=after_fingerprint,'Vollständiger Wundbestand wurde während des Lesens geändert.');
 return result||jsonb_build_object('stateFingerprint',after_fingerprint);
end$$;

-- Prepared native originals and request receipts are immutable; unrelated legacy assessments remain writable under their original contracts.
create or replace function care_private.guard_prepared_wound_assessment()
returns trigger language plpgsql security definer set search_path='' as $$begin
 if exists(select 1 from care_private.wound_requests r where r.tenant_id=old.tenant_id and r.result_id=old.id and r.payload->>'action'='assessment') then raise exception 'Bestätigter Originalbefund ist unveränderlich; eigenen Nachtrag dokumentieren.' using errcode='42501';end if;
 if tg_op='DELETE' then return old;end if;return new;
end$$;
drop trigger if exists prepared_wound_assessment_immutable on public.clinical_wound_assessments;
create trigger prepared_wound_assessment_immutable before update or delete on public.clinical_wound_assessments for each row execute function care_private.guard_prepared_wound_assessment();
create or replace function care_private.guard_wound_workspace_original()
returns trigger language plpgsql security invoker set search_path='' as $$begin raise exception 'Bestätigte Wundoriginale und Quittungen sind unveränderlich.' using errcode='42501';end$$;
do $$declare name text;begin
 foreach name in array array['ambulatory_wound_plan_versions','ambulatory_wound_dressings','ambulatory_wound_lifecycle_events','ambulatory_wound_assessment_corrections'] loop
  execute format('drop trigger if exists wound_workspace_original on public.%I',name);execute format('create trigger wound_workspace_original before update or delete on public.%I for each row execute function care_private.guard_wound_workspace_original()',name);
 end loop;
 foreach name in array array['wound_requests','wound_care_requests','wound_lifecycle_requests','wound_correction_requests','wound_path_requests'] loop
  execute format('drop trigger if exists wound_workspace_receipt on care_private.%I',name);execute format('create trigger wound_workspace_receipt before update or delete on care_private.%I for each row execute function care_private.guard_wound_workspace_original()',name);
 end loop;
end$$;

-- No active exposure is part of this migration. Do not infer activation from function presence.
do $quarantine$declare fn record;begin
 for fn in select p.oid::regprocedure identity from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname||'.'||p.proname in('care_private.assert_wound_path_authority','care_private.check_wound_order','care_private.commit_wound_path_packet_impl','care_private.commit_wound_path_review','care_private.confirm_wound_path_packet_impl','care_private.confirm_wound_path_review','care_private.guard_prepared_wound_assessment','care_private.guard_wound_care_closure','care_private.guard_wound_path_original','care_private.guard_wound_workspace_original','care_private.read_wound_path_context_impl','care_private.read_wound_path_page_impl','care_private.read_wound_path_review_page','care_private.require_uncorrected_healing_assessment','care_private.validate_wound_path_entry','care_private.validate_wound_path_packet_shape','care_private.wound_active_client','care_private.wound_assessment_section','care_private.wound_has_permission','care_private.wound_json_keys','care_private.wound_json_text','care_private.wound_json_time','care_private.wound_json_uuid','care_private.wound_path_fingerprint','care_private.wound_path_original','care_private.wound_path_ref','care_private.wound_path_review_immutable','care_private.wound_path_review_original','care_private.wound_require','care_private.write_wound_assessment_correction','care_private.write_wound_care','care_private.write_wound_documentation','care_private.write_wound_lifecycle','public.web_commit_wound_path_packet','public.web_commit_wound_path_review','public.web_confirm_wound_path_packet','public.web_confirm_wound_path_review','public.web_read_wound_path_context','public.web_read_wound_path_page','public.web_read_wound_path_review_page','public.write_ambulatory_wound_assessment_correction','public.write_ambulatory_wound_care','public.write_ambulatory_wound_documentation','public.write_ambulatory_wound_lifecycle') loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',fn.identity);
 end loop;
end$quarantine$;
revoke all on care_private.wound_requests from public,anon,authenticated,service_role;
revoke all on care_private.wound_care_requests from public,anon,authenticated,service_role;
revoke all on care_private.wound_lifecycle_requests from public,anon,authenticated,service_role;
revoke all on care_private.wound_correction_requests from public,anon,authenticated,service_role;
revoke all on care_private.wound_path_requests from public,anon,authenticated,service_role;
revoke all on care_private.wound_path_review_scopes from public,anon,authenticated,service_role;
revoke all on public.ambulatory_wound_plan_versions from public,anon,authenticated,service_role;
revoke all on public.ambulatory_wound_dressings from public,anon,authenticated,service_role;
revoke all on public.ambulatory_wound_lifecycle_events from public,anon,authenticated,service_role;
revoke all on public.ambulatory_wound_assessment_corrections from public,anon,authenticated,service_role;
revoke all on public.ambulatory_wound_photo_links from public,anon,authenticated,service_role;
revoke all on public.ambulatory_wound_path_events from public,anon,authenticated,service_role;
revoke all on public.wound_path_review_roots from public,anon,authenticated,service_role;
revoke all on public.wound_path_review_events from public,anon,authenticated,service_role;
revoke all on public.wound_path_review_receipts from public,anon,authenticated,service_role;

-- Scoped native history indexes; no performance benchmark is implied.
create index if not exists wound_case_scope_history on public.clinical_wound_cases(tenant_id,client_id,updated_at desc,id desc);
create index if not exists wound_assessment_scope_history on public.clinical_wound_assessments(tenant_id,client_id,wound_case_id,created_at desc,id desc);
create index if not exists wound_plan_scope_version on public.ambulatory_wound_plan_versions(tenant_id,client_id,wound_case_id,version desc);
create index if not exists wound_dressing_scope_actual on public.ambulatory_wound_dressings(tenant_id,client_id,wound_case_id,occurred_at,id);
create index if not exists wound_lifecycle_scope_history on public.ambulatory_wound_lifecycle_events(tenant_id,client_id,wound_case_id,created_at desc,id desc);
create index if not exists wound_correction_scope_history on public.ambulatory_wound_assessment_corrections(tenant_id,client_id,wound_case_id,created_at desc,id desc);
create index if not exists wound_native_receipt_result on care_private.wound_requests(tenant_id,result_id);

create or replace function care_private.guard_prepared_wound_execution()
returns trigger language plpgsql security definer set search_path='' as $$begin
 if exists(select 1 from public.ambulatory_wound_dressings d join care_private.wound_care_requests r on r.result_id=d.id and r.tenant_id=d.tenant_id and r.payload->>'action'='dressing' where d.execution_id=old.id and d.tenant_id=old.tenant_id) then raise exception 'Bestätigte Behandlungspflege zur Wundversorgung bleibt als Original erhalten.' using errcode='42501';end if;
 if tg_op='DELETE' then return old;end if;return new;
end$$;
revoke all on function care_private.guard_prepared_wound_execution() from public,anon,authenticated,service_role;
drop trigger if exists prepared_wound_execution_immutable on public.clinical_treatment_executions;
create trigger prepared_wound_execution_immutable before update or delete on public.clinical_treatment_executions for each row execute function care_private.guard_prepared_wound_execution();


create or replace function care_private.wound_workspace_ledger_fingerprint(t uuid,c uuid,w uuid,actor uuid)
returns text language plpgsql security definer set search_path='' as $$declare sources jsonb;paths jsonb;reviews jsonb;begin
 perform care_private.assert_wound_path_authority(t,c,w,actor,false,false);
 sources:=care_private.read_wound_path_context_impl(t,c,w,actor);
 select coalesce(jsonb_agg(to_jsonb(e) order by e.root_id,e.revision),'[]'::jsonb) into paths from public.ambulatory_wound_path_events e where e.tenant_id=t and e.client_id=c and e.wound_case_id=w;
 select coalesce(jsonb_agg(jsonb_build_object('root',to_jsonb(r),'event',to_jsonb(e)) order by r.created_at,r.id,e.revision),'[]'::jsonb) into reviews from public.wound_path_review_roots r join public.wound_path_review_events e on e.root_id=r.id where r.tenant_id=t and r.client_id=c and r.wound_case_id=w;
 return care_private.wound_path_fingerprint(jsonb_build_object('sources',sources,'paths',paths,'reviews',reviews));
end$$;
revoke all on function care_private.wound_workspace_ledger_fingerprint(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
create or replace function care_private.assert_wound_photo_current(e jsonb,t uuid,c uuid,w uuid)
returns void language plpgsql security definer set search_path='' as $$begin
 if e#>>'{observation,photoId}' is not null and not exists(select 1 from public.ambulatory_wound_photo_links x join public.client_consents consent on consent.id=x.consent_id and consent.tenant_id=x.tenant_id and consent.client_id=x.client_id where x.id=(e#>>'{observation,photoId}')::uuid and x.tenant_id=t and x.client_id=c and x.wound_case_id=w and x.assessment_id=(e#>>'{observation,assessmentId}')::uuid and x.consent_id=(e#>>'{observation,photoConsentId}')::uuid and consent.granted and(consent.expires_at is null or consent.expires_at>clock_timestamp())) then raise exception 'Bildverwendung besitzt keine aktuell unveränderte Einwilligung mehr.' using errcode='42501';end if;
end$$;
revoke all on function care_private.assert_wound_photo_current(jsonb,uuid,uuid,uuid) from public,anon,authenticated,service_role;
