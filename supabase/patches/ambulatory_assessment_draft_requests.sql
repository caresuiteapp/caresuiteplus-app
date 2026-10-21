-- LOCAL ONLY. Apply before ambulatory_assessment_review_guard.sql; never production-tested.
-- Existing clinical version remains separate from optimistic draft_revision.
begin;
create schema if not exists care_private;
revoke all on schema care_private from public,anon;
grant usage on schema care_private to authenticated;
alter table public.care_assessments add column if not exists draft_revision integer not null default 0 check(draft_revision>=0);
create table if not exists care_private.assessment_draft_requests(
 tenant_id uuid not null references public.tenants(id),request_id uuid not null,
 assessment_id uuid not null references public.care_assessments(id),actor_id uuid not null references public.profiles(id),
 payload jsonb not null,result jsonb not null,created_at timestamptz not null default clock_timestamp(),primary key(tenant_id,request_id)
);
alter table care_private.assessment_draft_requests enable row level security;
revoke all on care_private.assessment_draft_requests from public,anon,authenticated;
-- A private transaction-bound authorization cannot be forged by a browser session variable.
create table if not exists care_private.assessment_review_authorizations(
 assessment_id uuid not null,transaction_key text not null,actor_id uuid not null,action text not null default 'review' check(action in ('review','return')),
 primary key(assessment_id,transaction_key)
);
alter table care_private.assessment_review_authorizations add column if not exists action text not null default 'review' check(action in ('review','return'));
alter table care_private.assessment_review_authorizations enable row level security;
revoke all on care_private.assessment_review_authorizations from public,anon,authenticated;
create or replace function care_private.guard_ambulatory_assessment_parent()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and (old.subject_type='client' or new.subject_type='client') and (new.tenant_id<>old.tenant_id or new.subject_id<>old.subject_id or new.subject_type<>old.subject_type) then raise exception 'Assessmentbezug ist unveränderbar.' using errcode='23514';end if;
 if new.subject_type<>'client' then return new;end if;
 if auth.uid() is null or public.has_permission('pflege.assessments.manage') is not true or public.has_permission('pflege.plans.view') is not true or new.tenant_id is distinct from public.current_tenant_id() or public.is_active_pfleger_client(new.subject_id) is not true or not exists(select 1 from public.profiles p where p.id=public.resolve_current_profile_id() and p.tenant_id=new.tenant_id and p.is_active) then raise exception 'Kein aktiver berechtigter Pflegezugriff.' using errcode='42501';end if;
 if tg_op='INSERT' and new.status not in ('draft','in_progress') then raise exception 'Neues Assessment muss als Entwurf beginnen.' using errcode='23514';end if;
 if tg_op='UPDATE' then
  if old.status not in ('draft','in_progress') and not (old.status='professional_review' and new.status='in_progress' and new.version=old.version+1 and exists(select 1 from care_private.assessment_review_authorizations a where a.assessment_id=new.id and a.transaction_key=pg_catalog.pg_current_xact_id()::text and a.actor_id=public.resolve_current_profile_id() and a.action='return')) then raise exception 'Übergebenes Assessment ist gegen nachträgliches Überschreiben gesperrt.' using errcode='23514';end if;
  if old.status in ('draft','in_progress') and new.version is distinct from old.version then raise exception 'Fachliche Versionsnummer darf nicht durch Entwurfbearbeitung geändert werden.' using errcode='23514';end if;
  if new.status not in ('draft','in_progress','professional_review') or new.approved_at is not null or new.qpr_rating is distinct from old.qpr_rating then raise exception 'Fachliche Freigabe oder Qualitätsbewertung ist in diesem Pfad gesperrt.' using errcode='23514';end if;
  if new.status='professional_review' and not exists(select 1 from care_private.assessment_review_authorizations a where a.assessment_id=new.id and a.transaction_key=pg_catalog.pg_current_xact_id()::text and a.actor_id=public.resolve_current_profile_id() and a.action='review') then raise exception 'Prüfübergabe verlangt den validierenden Übergabepfad.' using errcode='42501';end if;
  new.draft_revision:=old.draft_revision+1;
 else new.draft_revision:=0;end if;
 return new;
end $$;
revoke all on function care_private.guard_ambulatory_assessment_parent() from public,anon,authenticated;
drop trigger if exists ambulatory_assessment_parent_guard on public.care_assessments;
create trigger ambulatory_assessment_parent_guard before insert or update on public.care_assessments for each row execute function care_private.guard_ambulatory_assessment_parent();
-- Child edits take the SAME parent lock as save/review and advance its revision.
create or replace function care_private.guard_ambulatory_assessment_child()
returns trigger language plpgsql security definer set search_path='' as $$
declare parent public.care_assessments%rowtype;ref uuid;scope uuid;
begin
 if tg_op='DELETE' then ref:=old.assessment_id;scope:=old.tenant_id;else ref:=new.assessment_id;scope:=new.tenant_id;end if;
 if tg_op='UPDATE' and (new.assessment_id<>old.assessment_id or new.tenant_id<>old.tenant_id) then raise exception 'Assessmentkind darf nicht umgehängt werden.' using errcode='23514';end if;
 select * into parent from public.care_assessments a where a.id=ref for update;
 if parent.id is null then raise exception 'Assessment fehlt; Lösch-/Aufbewahrungspfad muss ausdrücklich geprüft werden.' using errcode='23514';end if;
 if parent.subject_type='client' then
  if scope<>parent.tenant_id or parent.status not in ('draft','in_progress') then raise exception 'Assessment ist nicht mehr bearbeitbar oder falsch zugeordnet.' using errcode='23514';end if;
  update public.care_assessments set updated_at=clock_timestamp(),updated_by=auth.uid() where id=parent.id;
 end if;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;
revoke all on function care_private.guard_ambulatory_assessment_child() from public,anon,authenticated;
do $$declare tab text;begin
 foreach tab in array array['care_assessment_topics','care_assessment_risks','care_assessment_measures'] loop
 execute format('drop trigger if exists ambulatory_assessment_child_guard on public.%I',tab);
 execute format('create trigger ambulatory_assessment_child_guard before insert or update or delete on public.%I for each row execute function care_private.guard_ambulatory_assessment_child()',tab);
 end loop;
end $$;
-- Keep stationary behavior behind a checked wrapper. Legacy client transitions are blocked.
do $$begin
 if to_regprocedure('care_private.transition_care_assessment(uuid,text,text)') is null then
  alter function public.transition_care_assessment(uuid,text,text) set schema care_private;
 end if;
end $$;
revoke all on function care_private.transition_care_assessment(uuid,text,text) from public,anon,authenticated;
create or replace function care_private.transition_stationary_assessment(id uuid,status text,actor text)
returns public.care_assessments language plpgsql security definer set search_path='' as $$
declare v public.care_assessments%rowtype;begin
 select * into v from public.care_assessments a where a.id=transition_stationary_assessment.id and a.tenant_id=public.current_tenant_id() for update;
 if auth.uid() is null or v.id is null or v.subject_type<>'resident' then raise exception 'Alter ambulanter Statuspfad ist gesperrt.' using errcode='42501';end if;
 return care_private.transition_care_assessment(id,status,actor);
end $$;
create or replace function public.transition_care_assessment(p_assessment_id uuid,p_new_status text,p_actor_name text default '')
returns public.care_assessments language sql security invoker set search_path='' as $$select care_private.transition_stationary_assessment(p_assessment_id,p_new_status,p_actor_name)$$;
revoke all on function care_private.transition_stationary_assessment(uuid,text,text),public.transition_care_assessment(uuid,text,text) from public,anon;
grant execute on function care_private.transition_stationary_assessment(uuid,text,text),public.transition_care_assessment(uuid,text,text) to authenticated;
-- CP30 own descriptive profile, private validation only; NOT EXECUTED.
create or replace function care_private.validate_continence_profile(p jsonb,complete boolean,server_now timestamptz) returns void language plpgsql set search_path='' as $$
declare fields text[]:=array['version','assessedAt','source','sourceName','urinarySituation','urinaryGoal','bowelSituation','bowelGoal','personPerspective','resources','urgeRecognition','mobilityTransfer','clothingHandling','toiletAccess','dailyHabits','nightSituation','aids','skinSituation','participation','supportNeeded','counseling','personDecision','coordination','reviewTriggers','nextReviewAt'];f text;at_time timestamptz;review_time timestamptz;begin
 if jsonb_typeof(p) is distinct from 'object' or p-fields<>'{}'::jsonb or (select count(*) from jsonb_each(p))<>cardinality(fields) or p->>'version' is distinct from '1' then raise exception 'Kontinenzprofilfelder oder Version ungültig.' using errcode='23514';end if;
 foreach f in array fields loop
  if jsonb_typeof(p->f) is distinct from 'string' or length(p->>f)>4000 or (complete and f not in ('version','sourceName') and nullif(btrim(p->>f),'') is null) then raise exception 'Kontinenzprofilangabe fehlt oder ist ungültig: %',f using errcode='23514';end if;
 end loop;
 if p->>'source' not in ('','person','reported','professional','not_possible') then raise exception 'Kontinenzbefundquelle ungültig.' using errcode='23514';end if;
 if p->>'source' in ('reported','professional') then
  if complete and nullif(btrim(p->>'sourceName'),'') is null then raise exception 'Tatsächliche Auskunfts-/Fachperson fehlt.' using errcode='23514';end if;
 elsif p->>'sourceName'<>'' then raise exception 'Unpassende stellvertretende Quelle entfernen.' using errcode='23514';end if;
 foreach f in array array['assessedAt','nextReviewAt'] loop
  if p->>f<>'' and ((p->>f) !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]{1,6})?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$' or left(p->>f,4)='0000') then raise exception 'Kontinenzzeitpunkt mit Zeitzone ungültig.' using errcode='23514';end if;
 end loop;
 at_time:=nullif(p->>'assessedAt','')::timestamptz;review_time:=nullif(p->>'nextReviewAt','')::timestamptz;
 if at_time>server_now or (at_time is not null and review_time<=at_time) or (complete and (review_time is null or review_time<=server_now)) then raise exception 'Kontinenz-Erhebungs-/Prüfzeitpunkt widersprüchlich oder überfällig.' using errcode='23514';end if;
end $$;
revoke all on function care_private.validate_continence_profile(jsonb,boolean,timestamptz) from public,anon,authenticated;

create or replace function care_private.write_ambulatory_assessment_draft(request_id uuid,payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.care_assessments%rowtype;previous care_private.assessment_draft_requests%rowtype;actor uuid:=public.resolve_current_profile_id();tenant uuid:=public.current_tenant_id();ref uuid;revision integer;body jsonb;receipt jsonb;actor_name text;tab text;r jsonb;
begin
 if auth.uid() is null or tenant is null or public.has_permission('pflege.assessments.manage') is not true or public.has_permission('pflege.plans.view') is not true then raise exception 'Keine Berechtigung.' using errcode='42501';end if;
 select coalesce(nullif(p.display_name,''),p.email,'Pflegefachperson') into actor_name from public.profiles p where p.id=actor and p.tenant_id=tenant and p.is_active;
 if actor_name is null then raise exception 'Kein aktives Profil.' using errcode='42501';end if;
 if request_id is null or jsonb_typeof(payload) is distinct from 'object' or octet_length(payload::text)>300000 or coalesce(payload->>'intent','') not in ('save','review') then raise exception 'Ungültige Speicheranfrage.' using errcode='23514';end if;
 ref:=(payload->>'assessmentId')::uuid;revision:=(payload->>'expectedRevision')::integer;
 select * into v from public.care_assessments a where a.id=ref and a.tenant_id=tenant and a.subject_type='client' for update;
 if v.id is null or public.is_active_pfleger_client(v.subject_id) is not true then raise exception 'Kein zugänglicher aktiver Pflegefall.' using errcode='42501';end if;
 select * into previous from care_private.assessment_draft_requests r where r.tenant_id=tenant and r.request_id=write_ambulatory_assessment_draft.request_id;
 if previous.request_id is not null then
  if previous.assessment_id<>ref or previous.actor_id<>actor or previous.payload<>payload then raise exception 'Anfrage-ID bereits mit anderen Daten verwendet.' using errcode='23514';end if;
  return previous.result;
 end if;
 if revision is null or revision<>v.draft_revision then raise exception 'Zwischenstand geändert. Gespeicherten Stand laden und Änderungen abgleichen.' using errcode='40001';end if;
 if v.status not in ('draft','in_progress') then raise exception 'Assessment ist nicht mehr bearbeitbar.' using errcode='23514';end if;
 if octet_length(coalesce(payload->>'payloadJson',''))>262144 then raise exception 'Assessment ist zu umfangreich.' using errcode='23514';end if;
 body:=(payload->>'payloadJson')::jsonb;
 if jsonb_typeof(body) is distinct from 'object' or jsonb_typeof(body->'assessment') is distinct from 'object' then raise exception 'Assessmentstruktur fehlt.' using errcode='23514';end if;
 foreach tab in array array['topics','risks','measures'] loop
  if jsonb_typeof(body->tab) is distinct from 'array' then raise exception 'Assessmentkindliste fehlt.' using errcode='23514';end if;
  if jsonb_array_length(body->tab)>200 then raise exception 'Assessmentkindliste zu umfangreich.' using errcode='23514';end if;
 end loop;
 for r in select value from jsonb_array_elements(body->'risks') loop
  if r->>'focusedAssessmentKey'='caresuite_continence_v1' then
   if r->>'riskKey' is distinct from 'continence' then raise exception 'Kontinenzprofil benötigt Kontinenzbezug.' using errcode='23514';end if;
   perform care_private.validate_continence_profile(r->'focusedAssessmentResult',false,clock_timestamp());
  end if;
 end loop;
 -- A draft never asserts a clinical quality rating or trusts a supplied actor name.
 body:=jsonb_set(body,'{assessment,assessor_name_snapshot}',to_jsonb(actor_name));
 body:=jsonb_set(body,'{assessment,completeness_percent}','0'::jsonb);
 body:=jsonb_set(body,'{assessment,active_risk_count}',to_jsonb((select count(*) from jsonb_array_elements(body->'risks') r where r->>'state'='present')));
 body:=jsonb_set(body,'{assessment,urgent_risk_count}',to_jsonb((select count(*) from jsonb_array_elements(body->'risks') r where r->>'urgency' in ('urgent','immediate'))));
 body:=jsonb_set(body,'{assessment,open_measure_count}',to_jsonb((select count(*) from jsonb_array_elements(body->'measures') m where m->>'status' in ('planned','active'))));
 -- Existing RPC already saves parent and its three child lists atomically.
 perform public.save_care_assessment(ref,body);
 select * into v from public.care_assessments a where a.id=ref;
 if payload->>'intent'='review' then
  perform care_private.submit_ambulatory_assessment_review(ref,v.version);
  select * into v from public.care_assessments a where a.id=ref;
 end if;
 receipt:=jsonb_build_object('assessmentId',v.id,'draftRevision',v.draft_revision,'status',v.status);
 insert into care_private.assessment_draft_requests(tenant_id,request_id,assessment_id,actor_id,payload,result) values(tenant,request_id,ref,actor,payload,receipt);
 return receipt;
end $$;
create or replace function public.write_ambulatory_assessment_draft(request_id uuid,payload jsonb)
returns jsonb language sql security invoker set search_path='' as $$select care_private.write_ambulatory_assessment_draft(request_id,payload)$$;
revoke all on function care_private.write_ambulatory_assessment_draft(uuid,jsonb),public.write_ambulatory_assessment_draft(uuid,jsonb) from public,anon;
grant execute on function care_private.write_ambulatory_assessment_draft(uuid,jsonb),public.write_ambulatory_assessment_draft(uuid,jsonb) to authenticated;
commit;
