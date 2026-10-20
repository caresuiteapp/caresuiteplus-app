-- PREPARED ONLY: D-01..D-08 connected Web/Desktop care-plan, execution, deviation, effect, evaluation and visit path.
-- Not applied. No legacy writer, native/Android surface, delivery, care proof or billing table is changed.
-- Required runtime gates: PostgreSQL/PostgREST/RLS/grants, two-session CAS/deadlock/rollback,
-- SDK argument names, native writer compatibility, browser/layout and qualified care/privacy/legal acceptance.
begin;
create schema if not exists care_plan_path_private;
revoke all on schema care_plan_path_private from public,anon,authenticated;

create table if not exists care_plan_path_private.roots(
 tenant_id uuid not null,assessment_id uuid not null,head_id uuid,updated_at timestamptz not null default clock_timestamp(),
 primary key(tenant_id,assessment_id));
create table if not exists care_plan_path_private.events(
 id uuid primary key,tenant_id uuid not null,assessment_id uuid not null,sequence bigint not null,previous_id uuid,request_id uuid not null,
 actor_id uuid not null,actor_name text not null,occurred_at timestamptz not null,recorded_at timestamptz not null default clock_timestamp(),
 kind text not null,command jsonb not null,unique(tenant_id,assessment_id,sequence),unique(tenant_id,request_id));
alter table care_plan_path_private.roots enable row level security;
alter table care_plan_path_private.events enable row level security;
revoke all on all tables in schema care_plan_path_private from public,anon,authenticated;

create or replace function care_plan_path_private.immutable()returns trigger language plpgsql security definer set search_path='' as $$begin raise exception using errcode='P0P01',message='Pflegeplan-, Durchfuehrungs- und Wirkungswegoriginale bleiben unveränderlich.';end$$;
drop trigger if exists care_plan_path_roots_delete on care_plan_path_private.roots;
create trigger care_plan_path_roots_delete before delete on care_plan_path_private.roots for each row execute function care_plan_path_private.immutable();
drop trigger if exists care_plan_path_events_immutable on care_plan_path_private.events;
create trigger care_plan_path_events_immutable before update or delete on care_plan_path_private.events for each row execute function care_plan_path_private.immutable();

create or replace function care_plan_path_private.profile_has(t uuid,a uuid,keys text[])returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from public.profiles p join public.roles r on r.id=p.role_id where p.id=a and p.tenant_id=t and p.is_active and p.status='active'
 and not exists(select 1 from unnest(keys)k where not case when exists(select 1 from public.role_permission_sets z where z.tenant_id=t and z.role_key=r.key)
 then exists(select 1 from public.role_permission_sets z where z.tenant_id=t and z.role_key=r.key and z.permission_key=k)
 else exists(select 1 from public.role_permissions z where z.role_id=r.id and z.permission_key=k)end))$$;
create or replace function care_plan_path_private.kind_right(kind text)returns text language sql immutable set search_path='' as $select case
 when kind in('plan_review_return','plan_release_decision','visit_decision')then'pflege.audit.view'
 when kind in('goal_plan','measure_plan','daily_routine','support_boundary','responsibility_assignment','schedule_commitment','plan_review_request','execution_record','non_execution_record','deviation_assessment','effect_observation','regular_evaluation','visit_observation','change_order','correction')then'pflege.assessments.manage'end$;
create or replace function care_plan_path_private.extra_rights(kind text)returns text[] language sql immutable set search_path='' as $select array[]::text[]$;
create or replace function care_plan_path_private.actor(t uuid,a uuid,kind text default null)returns text language plpgsql security definer set search_path='' as $$
declare sid uuid;n text;k text;right_key text:=care_plan_path_private.kind_right(kind);keys text[]:=array['pflege.plans.view'];begin
 if auth.uid()is null or auth.uid()is distinct from a or public.resolve_current_profile_id()is distinct from a or public.current_tenant_id()is distinct from t
 or coalesce((auth.jwt()->>'exp')::bigint,0)<=extract(epoch from clock_timestamp())then raise exception using errcode='42501',message='Aktuelles eigenes Konto fehlt.';end if;
 sid:=nullif(auth.jwt()->>'session_id','')::uuid;perform 1 from auth.sessions s where s.id=sid and s.user_id=auth.uid()and(s.not_after is null or s.not_after>clock_timestamp())for share;
 if not found then raise exception using errcode='42501',message='Aktuelle native Sitzung fehlt.';end if;
 if kind is not null and right_key is null then raise exception using errcode='22023',message='Pflegeplanpfadvorgang ist unbekannt.';end if;
 if right_key is not null then keys:=keys||right_key||care_plan_path_private.extra_rights(kind);lock table public.roles,public.role_permissions,public.role_permission_sets in share mode;end if;
 select coalesce(nullif(btrim(p.display_name),''),'Name nicht bestätigt')into n from public.profiles p join public.roles r on r.id=p.role_id where p.id=a and p.tenant_id=t and p.is_active and p.status='active'and(p.auth_user_id is null or p.auth_user_id=auth.uid())for share of p,r;
 if n is null or not care_plan_path_private.profile_has(t,a,keys)then raise exception using errcode='42501',message='Aktuelle Akten-, Dokument- oder Schreibrechte fehlen.';end if;
 foreach k in array keys loop if public.has_permission(k)is not true then raise exception using errcode='42501',message='Nativer Rechtezugang fehlt.';end if;end loop;return n;
end$$;

create or replace function care_plan_path_private.event_json(e care_plan_path_private.events)returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('id',e.id,'sequence',e.sequence,'previousId',e.previous_id,'tenantId',e.tenant_id,'assessmentId',e.assessment_id,'actorId',e.actor_id,'actorName',e.actor_name,'recordedAt',to_char(e.recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'command',e.command)$$;
create or replace function care_plan_path_private.history(t uuid,c uuid)returns jsonb language plpgsql security definer set search_path='' as $$
declare e care_plan_path_private.events%rowtype;head uuid;prev uuid;n bigint:=0;rows jsonb:='[]';begin
 select r.head_id into head from care_plan_path_private.roots r where r.tenant_id=t and r.assessment_id=c;
 for e in select*from care_plan_path_private.events z where z.tenant_id=t and z.assessment_id=c order by z.sequence loop
  if e.sequence<>n+1 or e.previous_id is distinct from prev or e.command->>'eventId'is distinct from e.id::text or e.command->>'tenantId'is distinct from t::text or e.command->>'assessmentId'is distinct from c::text or e.command->>'actorId'is distinct from e.actor_id::text or(e.command->>'expectedHeadId')is distinct from prev::text then raise exception using errcode='23514',message='Pflegeplanpfadverlauf ist widersprüchlich.';end if;
  rows:=rows||jsonb_build_array(care_plan_path_private.event_json(e));prev:=e.id;n:=n+1;
 end loop;
 if head is distinct from prev then raise exception using errcode='23514',message='Pflegeplanpfadverlaufskopf ist unvollständig.';end if;
 return jsonb_build_object('version','2026-10-16.4','tenantId',t,'assessmentId',c,'count',n,'headId',head,'events',rows);
end$$;

create or replace function care_plan_path_private.sources(t uuid,c uuid)returns jsonb language sql security definer set search_path='' as $
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
  union all select 'care_plan_path_event',e.id,care_plan_path_private.event_json(e)from care_plan_path_private.events e where e.tenant_id=t and e.assessment_id=c
 )select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'id',id,'snapshot',snapshot)order by kind,id),'[]'::jsonb)from s$;
create or replace function care_plan_path_private.walk_sources(v jsonb,src jsonb)returns void language plpgsql set search_path='' as $$declare x jsonb;begin
 if jsonb_typeof(v)='array'then for x in select value from jsonb_array_elements(v)loop perform care_plan_path_private.walk_sources(x,src);end loop;
 elsif jsonb_typeof(v)='object'then if v?'snapshot'and v?'kind'and v?'id'then if not exists(select 1 from jsonb_array_elements(src)x where x=v)then raise exception using errcode='40001',message='Ausgewählte Originalgrundlage wurde geändert oder ist nicht mehr zugänglich.';end if;else for x in select value from jsonb_each(v)loop perform care_plan_path_private.walk_sources(x,src);end loop;end if;end if;
end$$;
create or replace function care_plan_path_private.payload_keys(k text)returns text[] language sql immutable set search_path='' as $select case k
 when'goal_plan'then array['assessment','finding','goal','outcome','baseline','priority','reviewAt']
 when'measure_plan'then array['goal','measure','action','frequency','aids','responsibleRole']
 when'daily_routine'then array['assessment','plan','timeWindow','ritual','preference','dependency']
 when'support_boundary'then array['plan','finding','supportLevel','ownContribution','professionalBoundary']
 when'responsibility_assignment'then array['measure','employee','responsibleRole','substituteRule','qualificationBoundary']
 when'schedule_commitment'then array['measure','routine','startsAt','dueAt','frequency','exceptionRule']
 when'plan_review_request'then array['assessment','goal','measure','schedule','reason','packetSha256']
 when'plan_review_return'then array['review','assessment','reason','requiredChange']
 when'plan_release_decision'then array['review','reviewer','decision','validFrom','rationale','releaseSha256']
 when'execution_record'then array['releasedPlan','execution','executionState','performedAt','observation']
 when'non_execution_record'then array['releasedPlan','execution','reason','observedAt','immediateAction']
 when'deviation_assessment'then array['plan','execution','deviation','priority','followUp','dueAt']
 when'effect_observation'then array['execution','evaluation','effectState','observedEffect','personFeedback']
 when'regular_evaluation'then array['goal','effect','evaluation','decision','rationale','nextReviewAt']
 when'visit_observation'then array['releasedPlan','visit','evaluation','participants','checkpoint','finding','deviation']
 when'visit_decision'then array['visit','reviewer','decision','implementationOrder','dueAt','acceptanceBoundary']
 when'change_order'then array['currentPlan','trigger','reason','scope','responsibleRole','dueAt']
 when'correction'then array['targetId','reason','evidenceSha256']
 else null end$;
create or replace function care_plan_path_private.validate_command(cmd jsonb,src jsonb)returns void language plpgsql set search_path='' as $$
declare keys text[];actual text[];kind text:=cmd->>'kind';v text;begin
 if jsonb_typeof(cmd)is distinct from'object'or cmd->>'version'<>'2026-10-16.4'or cmd->>'requestId'!~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'or cmd->>'eventId'!~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'or cmd->>'tenantId'!~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'or cmd->>'assessmentId'!~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'or cmd->>'actorId'!~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'or(cmd->'expectedHeadId'<>'null'::jsonb and cmd->>'expectedHeadId'!~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')or cmd->>'occurredAt'!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$'or nullif(btrim(cmd->>'note'),'')is null or length(cmd->>'note')>4000 or jsonb_typeof(cmd->'payload')is distinct from'object'then raise exception using errcode='22023',message='Pflegeplanpfadanfrage ist unvollständig.';end if;
 keys:=care_plan_path_private.payload_keys(kind);if keys is null then raise exception using errcode='22023',message='Vorgangsart ist unbekannt.';end if;
 select array_agg(x order by x)into actual from jsonb_object_keys(cmd->'payload')x;if actual is distinct from(select array_agg(x order by x)from unnest(keys)x)then raise exception using errcode='22023',message='Vorgangsfelder sind nicht vollständig oder enthalten Fremdfelder.';end if;
 for v in select value#>>'{}'from jsonb_each(cmd->'payload')where jsonb_typeof(value)='string'loop if nullif(btrim(v),'')is null then raise exception using errcode='22023',message='Leeres Vorgangsfeld.';end if;end loop;
 perform care_plan_path_private.walk_sources(cmd->'payload',src);
 if kind='goal_plan'and not(cmd#>>'{payload,finding,snapshot,command,kind}'=any(array['cognition_assessment','mobility_assessment','disease_demands_assessment','self_care_assessment','household_assessment','social_relationships_assessment','risk_screening','risk_deep_assessment']))then raise exception using errcode='23514',message='Einschätzungsoriginal hat die falsche fachliche Vorgangsart.';
 elsif kind='measure_plan'and cmd#>>'{payload,goal,snapshot,command,kind}'<>'goal_plan'then raise exception using errcode='23514',message='Zielplanung fehlt.';
 elsif kind='daily_routine'and not(cmd#>>'{payload,plan,snapshot,command,kind}'=any(array['goal_plan','measure_plan']))then raise exception using errcode='23514',message='Planungsoriginal fehlt.';
 elsif kind='support_boundary'and(not(cmd#>>'{payload,plan,snapshot,command,kind}'=any(array['goal_plan','measure_plan']))or not(cmd#>>'{payload,finding,snapshot,command,kind}'=any(array['cognition_assessment','mobility_assessment','self_care_assessment','household_assessment'])))then raise exception using errcode='23514',message='Ressourcen- oder Planungsoriginal fehlt.';
 elsif kind='responsibility_assignment'and cmd#>>'{payload,measure,snapshot,command,kind}'<>'measure_plan'then raise exception using errcode='23514',message='Maßnahmenplanung fehlt.';
 elsif kind='schedule_commitment'and(cmd#>>'{payload,measure,snapshot,command,kind}'<>'measure_plan'or cmd#>>'{payload,routine,snapshot,command,kind}'<>'daily_routine')then raise exception using errcode='23514',message='Maßnahmen- oder Tagesstrukturplanung fehlt.';
 elsif kind='plan_review_request'and(cmd#>>'{payload,goal,snapshot,command,kind}'<>'goal_plan'or cmd#>>'{payload,measure,snapshot,command,kind}'<>'measure_plan'or cmd#>>'{payload,schedule,snapshot,command,kind}'<>'schedule_commitment')then raise exception using errcode='23514',message='Prüfpaket ist unvollständig.';
 elsif kind in('plan_review_return','plan_release_decision')and cmd#>>'{payload,review,snapshot,command,kind}'<>'plan_review_request'then raise exception using errcode='23514',message='Prüfanfrage fehlt.';
 elsif kind in('execution_record','non_execution_record','visit_observation')and cmd#>>'{payload,releasedPlan,snapshot,command,kind}'<>'plan_release_decision'then raise exception using errcode='23514',message='Freigegebene Planfassung fehlt.';
 elsif kind='deviation_assessment'and(cmd#>>'{payload,plan,snapshot,command,kind}'<>'plan_release_decision'or not(cmd#>>'{payload,execution,snapshot,command,kind}'=any(array['execution_record','non_execution_record'])))then raise exception using errcode='23514',message='Plan- oder Durchführungsbeleg fehlt.';
 elsif kind='effect_observation'and cmd#>>'{payload,execution,snapshot,command,kind}'<>'execution_record'then raise exception using errcode='23514',message='Durchführungsbeleg fehlt.';
 elsif kind='regular_evaluation'and(cmd#>>'{payload,goal,snapshot,command,kind}'<>'goal_plan'or cmd#>>'{payload,effect,snapshot,command,kind}'<>'effect_observation')then raise exception using errcode='23514',message='Ziel- oder Wirkungsoriginal fehlt.';
 elsif kind='visit_observation'and cmd#>>'{payload,evaluation,snapshot,command,kind}'<>'regular_evaluation'then raise exception using errcode='23514',message='Evaluationsstand fehlt.';
 elsif kind='visit_decision'and cmd#>>'{payload,visit,snapshot,command,kind}'<>'visit_observation'then raise exception using errcode='23514',message='Visitenfeststellung fehlt.';
 elsif kind='change_order'and cmd#>>'{payload,currentPlan,snapshot,command,kind}'<>'plan_release_decision'then raise exception using errcode='23514',message='Aktuelle freigegebene Planfassung fehlt.';end if;
end$$;

create or replace function care_plan_path_private.read_context(t uuid,a uuid,c uuid)returns jsonb language plpgsql security definer set search_path='' as $$declare n text;client jsonb;src jsonb;begin
 n:=care_plan_path_private.actor(t,a,null);select to_jsonb(x)into client from public.care_assessments x where x.tenant_id=t and x.id=c and x.subject_type='client' for share;
 if client is null then raise exception using errcode='42501',message='Pflegefall fehlt oder ist nicht zugänglich.';end if;src:=care_plan_path_private.sources(t,c);
 return jsonb_build_object('version','2026-10-16.4','tenantId',t,'assessmentId',c,'actorId',a,'loadedAt',to_char(clock_timestamp()at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'sources',jsonb_build_object('count',jsonb_array_length(src),'rows',src),'history',care_plan_path_private.history(t,c));
end$$;
create or replace function care_plan_path_private.commit_event(cmd jsonb)returns jsonb language plpgsql security definer set search_path='' as $$
declare t uuid:=(cmd->>'tenantId')::uuid;c uuid:=(cmd->>'assessmentId')::uuid;a uuid:=(cmd->>'actorId')::uuid;rid uuid:=(cmd->>'requestId')::uuid;eid uuid:=(cmd->>'eventId')::uuid;n text;root care_plan_path_private.roots%rowtype;e care_plan_path_private.events%rowtype;src jsonb;begin
 n:=care_plan_path_private.actor(t,a,cmd->>'kind');perform 1 from public.care_assessments x where x.tenant_id=t and x.id=c and x.subject_type='client' for share;if not found then raise exception using errcode='42501',message='Pflegefall fehlt.';end if;
 lock table public.care_assessments,public.care_assessment_topics,public.care_assessment_risks,public.care_assessment_measures,public.care_assessment_evaluations,public.care_assessment_events in share mode;
 insert into care_plan_path_private.roots(tenant_id,assessment_id)values(t,c)on conflict do nothing;select*into root from care_plan_path_private.roots r where r.tenant_id=t and r.assessment_id=c for update;
 select*into e from care_plan_path_private.events z where z.tenant_id=t and z.request_id=rid;if e.id is not null then if e.command is distinct from cmd then raise exception using errcode='23505',message='Anfragekennung gehört zu anderem Inhalt.';end if;return jsonb_build_object('version','2026-10-16.4','requestId',rid,'command',e.command,'event',care_plan_path_private.event_json(e));end if;
 src:=care_plan_path_private.sources(t,c);perform care_plan_path_private.validate_command(cmd,src);
 if(cmd->>'expectedHeadId')is distinct from root.head_id::text then raise exception using errcode='40001',message='Pflegeplanpfadverlauf wurde geändert.';end if;
 if cmd->>'kind'='correction'and not exists(select 1 from care_plan_path_private.events x where x.tenant_id=t and x.assessment_id=c and x.id=(cmd#>>'{payload,targetId}')::uuid and x.kind<>'correction'and not exists(select 1 from care_plan_path_private.events z where z.tenant_id=t and z.assessment_id=c and z.kind='correction'and z.command#>>'{payload,targetId}'=x.id::text))then raise exception using errcode='23514',message='Nur ein vorhandenes unberichtigtes Original kann berichtigt werden.';end if;
 insert into care_plan_path_private.events(id,tenant_id,assessment_id,sequence,previous_id,request_id,actor_id,actor_name,occurred_at,kind,command)values(eid,t,c,coalesce((select max(sequence)+1 from care_plan_path_private.events where tenant_id=t and assessment_id=c),1),root.head_id,rid,a,n,(cmd->>'occurredAt')::timestamptz,cmd->>'kind',cmd)returning*into e;
 update care_plan_path_private.roots set head_id=eid,updated_at=clock_timestamp()where tenant_id=t and assessment_id=c;
 return jsonb_build_object('version','2026-10-16.4','requestId',rid,'command',cmd,'event',care_plan_path_private.event_json(e));
end$$;
create or replace function care_plan_path_private.confirm_event(t uuid,a uuid,c uuid,rid uuid,cmd jsonb)returns jsonb language plpgsql security definer set search_path='' as $$declare e care_plan_path_private.events%rowtype;begin
 perform care_plan_path_private.actor(t,a,null);select*into e from care_plan_path_private.events z where z.tenant_id=t and z.assessment_id=c and z.request_id=rid;
 if e.id is null or e.command is distinct from cmd or e.actor_id<>a then raise exception using errcode='P0P01',message='Passende native Quittung fehlt.';end if;
 return jsonb_build_object('version','2026-10-16.4','requestId',rid,'command',e.command,'event',care_plan_path_private.event_json(e));
end$$;

create or replace function public.web_care_plan_path_workspace_context(p_tenant_id uuid,p_assessment_id uuid,p_actor_id uuid)returns jsonb language sql security invoker set search_path='' as $$select care_plan_path_private.read_context(p_tenant_id,p_actor_id,p_assessment_id)$$;
create or replace function public.web_commit_care_plan_path_event(p_command jsonb)returns jsonb language sql security invoker set search_path='' as $$select care_plan_path_private.commit_event(p_command)$$;
create or replace function public.web_confirm_care_plan_path_event(p_tenant_id uuid,p_assessment_id uuid,p_actor_id uuid,p_request_id uuid,p_command jsonb)returns jsonb language sql security invoker set search_path='' as $$select care_plan_path_private.confirm_event(p_tenant_id,p_actor_id,p_assessment_id,p_request_id,p_command)$$;
revoke all on function public.web_care_plan_path_workspace_context(uuid,uuid,uuid),public.web_commit_care_plan_path_event(jsonb),public.web_confirm_care_plan_path_event(uuid,uuid,uuid,uuid,jsonb)from public,anon;
grant usage on schema care_plan_path_private to authenticated;
grant execute on function care_plan_path_private.read_context(uuid,uuid,uuid),care_plan_path_private.commit_event(jsonb),care_plan_path_private.confirm_event(uuid,uuid,uuid,uuid,jsonb)to authenticated;
grant execute on function public.web_care_plan_path_workspace_context(uuid,uuid,uuid),public.web_commit_care_plan_path_event(jsonb),public.web_confirm_care_plan_path_event(uuid,uuid,uuid,uuid,jsonb)to authenticated;
commit;

