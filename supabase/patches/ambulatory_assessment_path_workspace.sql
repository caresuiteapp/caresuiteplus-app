-- PREPARED ONLY: C-01..C-10 connected Web/Desktop assessment, risk, plan, execution, evaluation and release path.
-- Not applied. No legacy writer, native/Android surface, delivery, care proof or billing table is changed.
-- Required runtime gates: PostgreSQL/PostgREST/RLS/grants, two-session CAS/deadlock/rollback,
-- SDK argument names, native writer compatibility, browser/layout and qualified care/privacy/legal acceptance.
begin;
create schema if not exists assessment_path_private;
revoke all on schema assessment_path_private from public,anon,authenticated;

create table if not exists assessment_path_private.roots(
 tenant_id uuid not null,assessment_id uuid not null,head_id uuid,updated_at timestamptz not null default clock_timestamp(),
 primary key(tenant_id,assessment_id));
create table if not exists assessment_path_private.events(
 id uuid primary key,tenant_id uuid not null,assessment_id uuid not null,sequence bigint not null,previous_id uuid,request_id uuid not null,
 actor_id uuid not null,actor_name text not null,occurred_at timestamptz not null,recorded_at timestamptz not null default clock_timestamp(),
 kind text not null,command jsonb not null,unique(tenant_id,assessment_id,sequence),unique(tenant_id,request_id));
alter table assessment_path_private.roots enable row level security;
alter table assessment_path_private.events enable row level security;
revoke all on all tables in schema assessment_path_private from public,anon,authenticated;

create or replace function assessment_path_private.immutable()returns trigger language plpgsql security definer set search_path='' as $$begin raise exception using errcode='P0P01',message='Pflegeassessment- und Evaluationspfadoriginale bleiben unveränderlich.';end$$;
drop trigger if exists assessment_path_roots_delete on assessment_path_private.roots;
create trigger assessment_path_roots_delete before delete on assessment_path_private.roots for each row execute function assessment_path_private.immutable();
drop trigger if exists assessment_path_events_immutable on assessment_path_private.events;
create trigger assessment_path_events_immutable before update or delete on assessment_path_private.events for each row execute function assessment_path_private.immutable();

create or replace function assessment_path_private.profile_has(t uuid,a uuid,keys text[])returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from public.profiles p join public.roles r on r.id=p.role_id where p.id=a and p.tenant_id=t and p.is_active and p.status='active'
 and not exists(select 1 from unnest(keys)k where not case when exists(select 1 from public.role_permission_sets z where z.tenant_id=t and z.role_key=r.key)
 then exists(select 1 from public.role_permission_sets z where z.tenant_id=t and z.role_key=r.key and z.permission_key=k)
 else exists(select 1 from public.role_permissions z where z.role_id=r.id and z.permission_key=k)end))$$;
create or replace function assessment_path_private.kind_right(kind text)returns text language sql immutable set search_path='' as $select case
 when kind in('risk_screening','risk_deep_assessment','instrument_selection')then'pflege.risks.manage'
 when kind in('review_return','release_decision')then'pflege.audit.view'
 when kind in('model_version_review','person_perspective_observation','cognition_assessment','mobility_assessment','disease_demands_assessment','self_care_assessment','household_assessment','social_relationships_assessment','measure_plan_revision','execution_observation','effect_evaluation','review_request','reassessment_trigger','reassessment_start','correction')then'pflege.assessments.manage'end$;
create or replace function assessment_path_private.extra_rights(kind text)returns text[] language sql immutable set search_path='' as $select case
 when kind='disease_demands_assessment'then array['pflege.orders.view']
 else array[]::text[]end$;
create or replace function assessment_path_private.actor(t uuid,a uuid,kind text default null)returns text language plpgsql security definer set search_path='' as $$
declare sid uuid;n text;k text;right_key text:=assessment_path_private.kind_right(kind);keys text[]:=array['pflege.plans.view'];begin
 if auth.uid()is null or auth.uid()is distinct from a or public.resolve_current_profile_id()is distinct from a or public.current_tenant_id()is distinct from t
 or coalesce((auth.jwt()->>'exp')::bigint,0)<=extract(epoch from clock_timestamp())then raise exception using errcode='42501',message='Aktuelles eigenes Konto fehlt.';end if;
 sid:=nullif(auth.jwt()->>'session_id','')::uuid;perform 1 from auth.sessions s where s.id=sid and s.user_id=auth.uid()and(s.not_after is null or s.not_after>clock_timestamp())for share;
 if not found then raise exception using errcode='42501',message='Aktuelle native Sitzung fehlt.';end if;
 if kind is not null and right_key is null then raise exception using errcode='22023',message='Assessmentpfadvorgang ist unbekannt.';end if;
 if right_key is not null then keys:=keys||right_key||assessment_path_private.extra_rights(kind);lock table public.roles,public.role_permissions,public.role_permission_sets in share mode;end if;
 select coalesce(nullif(btrim(p.display_name),''),'Name nicht bestätigt')into n from public.profiles p join public.roles r on r.id=p.role_id where p.id=a and p.tenant_id=t and p.is_active and p.status='active'and(p.auth_user_id is null or p.auth_user_id=auth.uid())for share of p,r;
 if n is null or not assessment_path_private.profile_has(t,a,keys)then raise exception using errcode='42501',message='Aktuelle Akten-, Dokument- oder Schreibrechte fehlen.';end if;
 foreach k in array keys loop if public.has_permission(k)is not true then raise exception using errcode='42501',message='Nativer Rechtezugang fehlt.';end if;end loop;return n;
end$$;

create or replace function assessment_path_private.event_json(e assessment_path_private.events)returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('id',e.id,'sequence',e.sequence,'previousId',e.previous_id,'tenantId',e.tenant_id,'assessmentId',e.assessment_id,'actorId',e.actor_id,'actorName',e.actor_name,'recordedAt',to_char(e.recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'command',e.command)$$;
create or replace function assessment_path_private.history(t uuid,c uuid)returns jsonb language plpgsql security definer set search_path='' as $$
declare e assessment_path_private.events%rowtype;head uuid;prev uuid;n bigint:=0;rows jsonb:='[]';begin
 select r.head_id into head from assessment_path_private.roots r where r.tenant_id=t and r.assessment_id=c;
 for e in select*from assessment_path_private.events z where z.tenant_id=t and z.assessment_id=c order by z.sequence loop
  if e.sequence<>n+1 or e.previous_id is distinct from prev or e.command->>'eventId'is distinct from e.id::text or e.command->>'tenantId'is distinct from t::text or e.command->>'assessmentId'is distinct from c::text or e.command->>'actorId'is distinct from e.actor_id::text or(e.command->>'expectedHeadId')is distinct from prev::text then raise exception using errcode='23514',message='Assessmentpfadverlauf ist widersprüchlich.';end if;
  rows:=rows||jsonb_build_array(assessment_path_private.event_json(e));prev:=e.id;n:=n+1;
 end loop;
 if head is distinct from prev then raise exception using errcode='23514',message='Assessmentpfadverlaufskopf ist unvollständig.';end if;
 return jsonb_build_object('version','2026-10-16.3','tenantId',t,'assessmentId',c,'count',n,'headId',head,'events',rows);
end$$;

create or replace function assessment_path_private.sources(t uuid,c uuid)returns jsonb language sql security definer set search_path='' as $
 with current_assessment as(select*from public.care_assessments where tenant_id=t and id=c and subject_type='client'),
 s as(
  select 'care_assessment'::text kind,x.id,to_jsonb(x)snapshot from public.care_assessments x,current_assessment a where x.tenant_id=t and x.subject_id=a.subject_id and x.subject_type='client'
  union all select 'assessment_topic',x.id,to_jsonb(x)from public.care_assessment_topics x where x.tenant_id=t and x.assessment_id=c
  union all select 'assessment_risk',x.id,to_jsonb(x)from public.care_assessment_risks x where x.tenant_id=t and x.assessment_id=c
  union all select 'assessment_measure',x.id,to_jsonb(x)from public.care_assessment_measures x where x.tenant_id=t and x.assessment_id=c
  union all select 'assessment_evaluation',x.id,to_jsonb(x)from public.care_assessment_evaluations x where x.tenant_id=t and x.assessment_id=c
  union all select 'care_observation',x.id,to_jsonb(x)from public.care_assessment_events x where x.tenant_id=t and x.assessment_id=c
  union all select 'care_event',x.id,to_jsonb(x)from public.care_assessment_events x where x.tenant_id=t and x.assessment_id=c
  union all select 'person_statement',x.id,to_jsonb(x)from public.care_assessment_events x where x.tenant_id=t and x.assessment_id=c
  union all select 'care_execution',x.id,to_jsonb(x)from public.care_assessment_events x where x.tenant_id=t and x.assessment_id=c
  union all select 'care_visit',x.id,to_jsonb(x)from public.care_assessment_events x where x.tenant_id=t and x.assessment_id=c
  union all select 'assessment_model',x.id,to_jsonb(x)||jsonb_build_object('assessment_id',c)snapshot from care_private.assessment_models x where x.tenant_id=t
  union all select 'assessment_instrument_catalog',x.id,to_jsonb(x)||jsonb_build_object('assessment_id',c)from care_private.assessment_models x where x.tenant_id=t
  union all select 'assessment_instrument',x.id,to_jsonb(x)||jsonb_build_object('assessment_id',c)from care_private.assessment_instruments x where x.tenant_id=t
  union all select 'employee_profile',x.id,to_jsonb(x)||jsonb_build_object('assessment_id',c)from public.profiles x where x.tenant_id=t and x.is_active
  union all select 'assessment_path_event',e.id,assessment_path_private.event_json(e)from assessment_path_private.events e where e.tenant_id=t and e.assessment_id=c
 )select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'id',id,'snapshot',snapshot)order by kind,id),'[]'::jsonb)from s$;
create or replace function assessment_path_private.walk_sources(v jsonb,src jsonb)returns void language plpgsql set search_path='' as $$declare x jsonb;begin
 if jsonb_typeof(v)='array'then for x in select value from jsonb_array_elements(v)loop perform assessment_path_private.walk_sources(x,src);end loop;
 elsif jsonb_typeof(v)='object'then if v?'snapshot'and v?'kind'and v?'id'then if not exists(select 1 from jsonb_array_elements(src)x where x=v)then raise exception using errcode='40001',message='Ausgewählte Originalgrundlage wurde geändert oder ist nicht mehr zugänglich.';end if;else for x in select value from jsonb_each(v)loop perform assessment_path_private.walk_sources(x,src);end loop;end if;end if;
end$$;
create or replace function assessment_path_private.payload_keys(k text)returns text[] language sql immutable set search_path='' as $select case k
 when'model_version_review'then array['assessment','model','catalog','modelName','modelVersion','usageState','termsSha256']
 when'person_perspective_observation'then array['assessment','statement','observation','perspective','observedFinding','context']
 when'cognition_assessment'then array['assessment','topic','observation','finding','resources','supportNeed']
 when'mobility_assessment'then array['assessment','topic','observation','finding','resources','supportNeed']
 when'disease_demands_assessment'then array['assessment','topic','clinical','finding','resources','supportNeed']
 when'self_care_assessment'then array['assessment','topic','observation','finding','resources','supportNeed']
 when'household_assessment'then array['assessment','topic','observation','finding','resources','supportNeed']
 when'social_relationships_assessment'then array['assessment','topic','statement','finding','resources','supportNeed']
 when'risk_screening'then array['assessment','observation','risk','riskCode','screeningResult','rationale']
 when'risk_deep_assessment'then array['screening','risk','instrument','outcome','limitations','nextReviewAt']
 when'instrument_selection'then array['model','instrument','risk','decision','rationale','instrumentSha256']
 when'measure_plan_revision'then array['assessment','risk','measure','goal','action','frequency','responsibility','dueAt']
 when'execution_observation'then array['plan','execution','executionState','observation','deviation']
 when'effect_evaluation'then array['execution','evaluation','effectState','observedEffect','personFeedback','conclusion']
 when'review_request'then array['assessment','model','plan','evaluation','reason','packetSha256']
 when'review_return'then array['review','assessment','reason','requiredChange']
 when'release_decision'then array['review','assessment','reviewer','decision','rationale','releaseSha256']
 when'reassessment_trigger'then array['released','trigger','triggerCode','rationale','dueAt']
 when'reassessment_start'then array['trigger','previous','next','relationshipSha256','scope','state']
 when'correction'then array['targetId','reason','evidenceSha256']
 else null end$;
create or replace function assessment_path_private.validate_command(cmd jsonb,src jsonb)returns void language plpgsql set search_path='' as $$
declare keys text[];actual text[];kind text:=cmd->>'kind';v text;begin
 if jsonb_typeof(cmd)is distinct from'object'or cmd->>'version'<>'2026-10-16.3'or cmd->>'requestId'!~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'or cmd->>'eventId'!~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'or cmd->>'tenantId'!~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'or cmd->>'assessmentId'!~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'or cmd->>'actorId'!~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'or(cmd->'expectedHeadId'<>'null'::jsonb and cmd->>'expectedHeadId'!~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')or cmd->>'occurredAt'!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$'or nullif(btrim(cmd->>'note'),'')is null or length(cmd->>'note')>4000 or jsonb_typeof(cmd->'payload')is distinct from'object'then raise exception using errcode='22023',message='Assessmentpfadanfrage ist unvollständig.';end if;
 keys:=assessment_path_private.payload_keys(kind);if keys is null then raise exception using errcode='22023',message='Vorgangsart ist unbekannt.';end if;
 select array_agg(x order by x)into actual from jsonb_object_keys(cmd->'payload')x;if actual is distinct from(select array_agg(x order by x)from unnest(keys)x)then raise exception using errcode='22023',message='Vorgangsfelder sind nicht vollständig oder enthalten Fremdfelder.';end if;
 for v in select value#>>'{}'from jsonb_each(cmd->'payload')where jsonb_typeof(value)='string'loop if nullif(btrim(v),'')is null then raise exception using errcode='22023',message='Leeres Vorgangsfeld.';end if;end loop;
 perform assessment_path_private.walk_sources(cmd->'payload',src);
end$$;

create or replace function assessment_path_private.read_context(t uuid,a uuid,c uuid)returns jsonb language plpgsql security definer set search_path='' as $$declare n text;client jsonb;src jsonb;begin
 n:=assessment_path_private.actor(t,a,null);select to_jsonb(x)into client from public.care_assessments x where x.tenant_id=t and x.id=c and x.subject_type='client' for share;
 if client is null then raise exception using errcode='42501',message='Pflegefall fehlt oder ist nicht zugänglich.';end if;src:=assessment_path_private.sources(t,c);
 return jsonb_build_object('version','2026-10-16.3','tenantId',t,'assessmentId',c,'actorId',a,'loadedAt',to_char(clock_timestamp()at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'sources',jsonb_build_object('count',jsonb_array_length(src),'rows',src),'history',assessment_path_private.history(t,c));
end$$;
create or replace function assessment_path_private.commit_event(cmd jsonb)returns jsonb language plpgsql security definer set search_path='' as $$
declare t uuid:=(cmd->>'tenantId')::uuid;c uuid:=(cmd->>'assessmentId')::uuid;a uuid:=(cmd->>'actorId')::uuid;rid uuid:=(cmd->>'requestId')::uuid;eid uuid:=(cmd->>'eventId')::uuid;n text;root assessment_path_private.roots%rowtype;e assessment_path_private.events%rowtype;src jsonb;begin
 n:=assessment_path_private.actor(t,a,cmd->>'kind');perform 1 from public.care_assessments x where x.tenant_id=t and x.id=c and x.subject_type='client' for share;if not found then raise exception using errcode='42501',message='Pflegefall fehlt.';end if;
 lock table public.care_assessments,public.care_assessment_topics,public.care_assessment_risks,public.care_assessment_measures,public.care_assessment_evaluations,public.care_assessment_events in share mode;
 insert into assessment_path_private.roots(tenant_id,assessment_id)values(t,c)on conflict do nothing;select*into root from assessment_path_private.roots r where r.tenant_id=t and r.assessment_id=c for update;
 select*into e from assessment_path_private.events z where z.tenant_id=t and z.request_id=rid;if e.id is not null then if e.command is distinct from cmd then raise exception using errcode='23505',message='Anfragekennung gehört zu anderem Inhalt.';end if;return jsonb_build_object('version','2026-10-16.3','requestId',rid,'command',e.command,'event',assessment_path_private.event_json(e));end if;
 src:=assessment_path_private.sources(t,c);perform assessment_path_private.validate_command(cmd,src);
 if(cmd->>'expectedHeadId')is distinct from root.head_id::text then raise exception using errcode='40001',message='Assessmentpfadverlauf wurde geändert.';end if;
 if cmd->>'kind'='correction'and not exists(select 1 from assessment_path_private.events x where x.tenant_id=t and x.assessment_id=c and x.id=(cmd#>>'{payload,targetId}')::uuid and x.kind<>'correction'and not exists(select 1 from assessment_path_private.events z where z.tenant_id=t and z.assessment_id=c and z.kind='correction'and z.command#>>'{payload,targetId}'=x.id::text))then raise exception using errcode='23514',message='Nur ein vorhandenes unberichtigtes Original kann berichtigt werden.';end if;
 insert into assessment_path_private.events(id,tenant_id,assessment_id,sequence,previous_id,request_id,actor_id,actor_name,occurred_at,kind,command)values(eid,t,c,coalesce((select max(sequence)+1 from assessment_path_private.events where tenant_id=t and assessment_id=c),1),root.head_id,rid,a,n,(cmd->>'occurredAt')::timestamptz,cmd->>'kind',cmd)returning*into e;
 update assessment_path_private.roots set head_id=eid,updated_at=clock_timestamp()where tenant_id=t and assessment_id=c;
 return jsonb_build_object('version','2026-10-16.3','requestId',rid,'command',cmd,'event',assessment_path_private.event_json(e));
end$$;
create or replace function assessment_path_private.confirm_event(t uuid,a uuid,c uuid,rid uuid,cmd jsonb)returns jsonb language plpgsql security definer set search_path='' as $$declare e assessment_path_private.events%rowtype;begin
 perform assessment_path_private.actor(t,a,null);select*into e from assessment_path_private.events z where z.tenant_id=t and z.assessment_id=c and z.request_id=rid;
 if e.id is null or e.command is distinct from cmd or e.actor_id<>a then raise exception using errcode='P0P01',message='Passende native Quittung fehlt.';end if;
 return jsonb_build_object('version','2026-10-16.3','requestId',rid,'command',e.command,'event',assessment_path_private.event_json(e));
end$$;

create or replace function public.web_assessment_path_workspace_context(p_tenant_id uuid,p_assessment_id uuid,p_actor_id uuid)returns jsonb language sql security invoker set search_path='' as $$select assessment_path_private.read_context(p_tenant_id,p_actor_id,p_assessment_id)$$;
create or replace function public.web_commit_assessment_path_event(p_command jsonb)returns jsonb language sql security invoker set search_path='' as $$select assessment_path_private.commit_event(p_command)$$;
create or replace function public.web_confirm_assessment_path_event(p_tenant_id uuid,p_assessment_id uuid,p_actor_id uuid,p_request_id uuid,p_command jsonb)returns jsonb language sql security invoker set search_path='' as $$select assessment_path_private.confirm_event(p_tenant_id,p_actor_id,p_assessment_id,p_request_id,p_command)$$;
revoke all on function public.web_assessment_path_workspace_context(uuid,uuid,uuid),public.web_commit_assessment_path_event(jsonb),public.web_confirm_assessment_path_event(uuid,uuid,uuid,uuid,jsonb)from public,anon;
grant usage on schema assessment_path_private to authenticated;
grant execute on function assessment_path_private.read_context(uuid,uuid,uuid),assessment_path_private.commit_event(jsonb),assessment_path_private.confirm_event(uuid,uuid,uuid,uuid,jsonb)to authenticated;
grant execute on function public.web_assessment_path_workspace_context(uuid,uuid,uuid),public.web_commit_assessment_path_event(jsonb),public.web_confirm_assessment_path_event(uuid,uuid,uuid,uuid,jsonb)to authenticated;
commit;

