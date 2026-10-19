-- PREPARED ONLY: E-01..E-10 connected Web/Desktop documentation, protocol, confirmation and review path.
-- Not applied. Existing documentation, plan, visit, native/Android, delivery, care proof and billing writers remain unchanged.
-- Required runtime gates: PostgreSQL/PostgREST/RLS/grants, two-session CAS/deadlock/rollback,
-- SDK argument names, legacy/native writer compatibility, browser/layout and qualified care/privacy/legal acceptance.
begin;
create schema if not exists care_documentation_path_private;
revoke all on schema care_documentation_path_private from public,anon,authenticated;

create table if not exists care_documentation_path_private.roots(
 tenant_id uuid not null,client_id uuid not null,head_id uuid,updated_at timestamptz not null default clock_timestamp(),
 primary key(tenant_id,client_id));
create table if not exists care_documentation_path_private.events(
 id uuid primary key,tenant_id uuid not null,client_id uuid not null,sequence bigint not null,previous_id uuid,request_id uuid not null,
 actor_id uuid not null,actor_name text not null,occurred_at timestamptz not null,recorded_at timestamptz not null default clock_timestamp(),
 kind text not null,command jsonb not null,unique(tenant_id,client_id,sequence),unique(tenant_id,request_id));
alter table care_documentation_path_private.roots enable row level security;
alter table care_documentation_path_private.events enable row level security;
revoke all on all tables in schema care_documentation_path_private from public,anon,authenticated;

create or replace function care_documentation_path_private.immutable()returns trigger language plpgsql security definer set search_path='' as $$begin raise exception using errcode='P0P01',message='Dokumentations- und Protokollpfadoriginale bleiben unveränderlich.';end$$;
drop trigger if exists care_documentation_path_roots_delete on care_documentation_path_private.roots;
create trigger care_documentation_path_roots_delete before delete on care_documentation_path_private.roots for each row execute function care_documentation_path_private.immutable();
drop trigger if exists care_documentation_path_events_immutable on care_documentation_path_private.events;
create trigger care_documentation_path_events_immutable before update or delete on care_documentation_path_private.events for each row execute function care_documentation_path_private.immutable();

create or replace function care_documentation_path_private.profile_has(t uuid,a uuid,keys text[])returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from public.profiles p join public.roles r on r.id=p.role_id where p.id=a and p.tenant_id=t and p.is_active and p.status='active'
 and not exists(select 1 from unnest(keys)k where not case when exists(select 1 from public.role_permission_sets z where z.tenant_id=t and z.role_key=r.key)
 then exists(select 1 from public.role_permission_sets z where z.tenant_id=t and z.role_key=r.key and z.permission_key=k)
 else exists(select 1 from public.role_permissions z where z.role_id=r.id and z.permission_key=k)end))$$;
create or replace function care_documentation_path_private.kind_right(kind text)returns text language sql immutable set search_path='' as $$select case
 when kind='content_confirmation'then'pflege.documentation.sign'
 when kind in('incident_closure','documentation_review_return','documentation_review_decision')then'pflege.audit.view'
 when kind in('care_report','planned_service_record','partial_service_record','non_service_record','refusal_record','incident_report','protocol_record','control_order','control_result','control_nonperformance','external_document_review','documentation_review_request','correction')then'pflege.documentation.create'
 when kind='history_review'then'pflege.documentation.view'end$$;
create or replace function care_documentation_path_private.actor(t uuid,a uuid,kind text default null)returns text language plpgsql security definer set search_path='' as $$
declare sid uuid;n text;k text;right_key text:=care_documentation_path_private.kind_right(kind);keys text[]:=array['pflege.documentation.view'];begin
 if auth.uid()is null or public.resolve_current_profile_id()is distinct from a or public.current_tenant_id()is distinct from t
 or coalesce((auth.jwt()->>'exp')::bigint,0)<=extract(epoch from clock_timestamp())then raise exception using errcode='42501',message='Aktuelles eigenes Konto fehlt.';end if;
 sid:=nullif(auth.jwt()->>'session_id','')::uuid;perform 1 from auth.sessions s where s.id=sid and s.user_id=auth.uid()and(s.not_after is null or s.not_after>clock_timestamp())for share;
 if not found then raise exception using errcode='42501',message='Aktuelle native Sitzung fehlt.';end if;
 if kind is not null and right_key is null then raise exception using errcode='22023',message='Dokumentationspfadvorgang ist unbekannt.';end if;
 if right_key is not null then keys:=keys||right_key;lock table public.roles,public.role_permissions,public.role_permission_sets in share mode;end if;
 select coalesce(nullif(btrim(p.display_name),''),'Name nicht bestätigt')into n from public.profiles p join public.roles r on r.id=p.role_id where p.id=a and p.tenant_id=t and p.is_active and p.status='active'and(p.auth_user_id is null or p.auth_user_id=auth.uid())for share of p,r;
 if n is null or not care_documentation_path_private.profile_has(t,a,keys)then raise exception using errcode='42501',message='Aktuelle Dokumentations- oder Prüfberechtigung fehlt.';end if;
 foreach k in array keys loop if public.has_permission(k)is not true then raise exception using errcode='42501',message='Nativer Rechtezugang fehlt.';end if;end loop;return n;
end$$;

create or replace function care_documentation_path_private.event_json(e care_documentation_path_private.events)returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('id',e.id,'sequence',e.sequence,'previousId',e.previous_id,'tenantId',e.tenant_id,'clientId',e.client_id,'actorId',e.actor_id,'actorName',e.actor_name,'recordedAt',to_char(e.recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'command',e.command)$$;
create or replace function care_documentation_path_private.history(t uuid,c uuid)returns jsonb language plpgsql security definer set search_path='' as $$
declare e care_documentation_path_private.events%rowtype;head uuid;prev uuid;n bigint:=0;rows jsonb:='[]';begin
 select r.head_id into head from care_documentation_path_private.roots r where r.tenant_id=t and r.client_id=c;
 for e in select*from care_documentation_path_private.events z where z.tenant_id=t and z.client_id=c order by z.sequence loop
  if e.sequence<>n+1 or e.previous_id is distinct from prev or e.command->>'eventId'is distinct from e.id::text or e.command->>'tenantId'is distinct from t::text or e.command->>'clientId'is distinct from c::text or e.command->>'actorId'is distinct from e.actor_id::text or(e.command->>'expectedHeadId')is distinct from prev::text then raise exception using errcode='23514',message='Dokumentationspfadverlauf ist widersprüchlich.';end if;
  rows:=rows||jsonb_build_array(care_documentation_path_private.event_json(e));prev:=e.id;n:=n+1;
 end loop;
 if head is distinct from prev then raise exception using errcode='23514',message='Dokumentationspfadverlaufskopf ist unvollständig.';end if;
 return jsonb_build_object('version','2026-10-16.5','tenantId',t,'clientId',c,'count',n,'headId',head,'events',rows);
end$$;

create or replace function care_documentation_path_private.sources(t uuid,c uuid)returns jsonb language sql security definer set search_path='' as $$
 with s as(
  select 'client_record'::text kind,x.id,to_jsonb(x)snapshot from public.clients x where x.tenant_id=t and x.id=c
  union all select 'care_visit',x.id,to_jsonb(x)from public.care_tour_stops x where x.tenant_id=t and x.client_id=c
  union all select 'care_execution',x.id,to_jsonb(x)from public.clinical_treatment_executions x where x.tenant_id=t and x.client_id=c
  union all select 'care_documentation',x.id,to_jsonb(x)from public.clinical_documentation_entries x where x.tenant_id=t and x.client_id=c and x.signature_status<>'superseded'
  union all select 'care_documentation_history',x.id,to_jsonb(x)from care_documentation_private.versions x where x.tenant_id=t and x.client_id=c
  union all select 'documentation_template',x.id,to_jsonb(x)||jsonb_build_object('client_id',c)from public.document_templates x where x.tenant_id=t and x.is_active
  union all select 'employee_profile',x.id,to_jsonb(x)||jsonb_build_object('client_id',c)from public.profiles x where x.tenant_id=t and x.is_active
  union all select 'representative_record',x.id,to_jsonb(x)from public.client_contacts x where x.tenant_id=t and x.client_id=c
  union all select 'external_document',x.id,to_jsonb(x)from public.client_intake_documents x where x.tenant_id=t and x.client_id=c
  union all select 'care_plan_path_event',e.id,care_plan_path_private.event_json(e)||jsonb_build_object('client_id',c)from care_plan_path_private.events e join public.care_assessments a on a.id=e.assessment_id and a.tenant_id=e.tenant_id where e.tenant_id=t and a.subject_type='client'and a.subject_id=c
  union all select 'care_documentation_path_event',e.id,care_documentation_path_private.event_json(e)||jsonb_build_object('client_id',c)from care_documentation_path_private.events e where e.tenant_id=t and e.client_id=c
 )select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'id',id,'snapshot',snapshot)order by kind,id),'[]'::jsonb)from s$$;
create or replace function care_documentation_path_private.walk_sources(v jsonb,src jsonb)returns void language plpgsql set search_path='' as $$declare x jsonb;begin
 if jsonb_typeof(v)='array'then for x in select value from jsonb_array_elements(v)loop perform care_documentation_path_private.walk_sources(x,src);end loop;
 elsif jsonb_typeof(v)='object'then if v?'snapshot'and v?'kind'and v?'id'then if not exists(select 1 from jsonb_array_elements(src)x where x=v)then raise exception using errcode='40001',message='Ausgewählte Originalgrundlage wurde geändert oder ist nicht mehr zugänglich.';end if;else for x in select value from jsonb_each(v)loop perform care_documentation_path_private.walk_sources(x,src);end loop;end if;end if;
end$$;
create or replace function care_documentation_path_private.payload_keys(k text)returns text[] language sql immutable set search_path='' as $$select case k
 when'care_report'then array['client','visit','observation','action','result']
 when'planned_service_record'then array['plan','visit','execution','performedAt','performedScope','result']
 when'partial_service_record'then array['plan','visit','performedPart','missingPart','reason','reaction']
 when'non_service_record'then array['plan','visit','reason','reaction','followUp']
 when'refusal_record'then array['measure','visit','offeredMeasure','statedReason','consultation','followUp']
 when'incident_report'then array['visit','people','incidentType','finding','immediateAction','forwardedTo']
 when'incident_closure'then array['incident','reviewer','outcome','followUp','closureSha256']
 when'protocol_record'then array['template','visit','protocolType','templateVersion','fieldSetSha256','measuredAt']
 when'content_confirmation'then array['document','person','role','scope','basis','contentSha256']
 when'history_review'then array['document','fromAt','toAt','pageCount','exportSha256']
 when'control_order'then array['basis','cause','frequency','responsible','dueAt']
 when'control_result'then array['order','evidence','observedAt','result','followUp']
 when'control_nonperformance'then array['order','reason','reaction','newDueAt']
 when'external_document_review'then array['external','source','author','receivedAt','eventAt','review']
 when'documentation_review_request'then array['document','history','reason','packetSha256']
 when'documentation_review_return'then array['review','reason','requiredChange']
 when'documentation_review_decision'then array['review','reviewer','decision','rationale','decisionSha256']
 when'correction'then array['targetId','reason','evidenceSha256'] else null end$$;
create or replace function care_documentation_path_private.validate_command(cmd jsonb,src jsonb)returns void language plpgsql set search_path='' as $$
declare keys text[];actual text[];kind text:=cmd->>'kind';v text;k text;begin
 if jsonb_typeof(cmd)is distinct from'object'or cmd->>'version'<>'2026-10-16.5'or cmd->>'requestId'!~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'or cmd->>'eventId'!~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'or cmd->>'tenantId'!~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'or cmd->>'clientId'!~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'or cmd->>'actorId'!~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'or(cmd->'expectedHeadId'<>'null'::jsonb and cmd->>'expectedHeadId'!~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')or cmd->>'occurredAt'!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$'or nullif(btrim(cmd->>'note'),'')is null or length(cmd->>'note')>4000 or jsonb_typeof(cmd->'payload')is distinct from'object'then raise exception using errcode='22023',message='Dokumentationspfadanfrage ist unvollständig.';end if;
 keys:=care_documentation_path_private.payload_keys(kind);if keys is null then raise exception using errcode='22023',message='Vorgangsart ist unbekannt.';end if;
 select array_agg(x order by x)into actual from jsonb_object_keys(cmd->'payload')x;if actual is distinct from(select array_agg(x order by x)from unnest(keys)x)then raise exception using errcode='22023',message='Vorgangsfelder sind nicht vollständig oder enthalten Fremdfelder.';end if;
 for v in select value#>>'{}'from jsonb_each(cmd->'payload')where jsonb_typeof(value)='string'loop if nullif(btrim(v),'')is null then raise exception using errcode='22023',message='Leeres Vorgangsfeld.';end if;end loop;
 perform care_documentation_path_private.walk_sources(cmd->'payload',src);
 if kind='care_report'and(cmd#>>'{payload,client,kind}'<>'client_record'or cmd#>>'{payload,visit,kind}'<>'care_visit')then raise exception using errcode='23514',message='Pflegefall- oder Einsatzoriginal fehlt.';
 elsif kind in('planned_service_record','partial_service_record','non_service_record')and(cmd#>>'{payload,plan,kind}'<>'care_plan_path_event'or cmd#>>'{payload,plan,snapshot,command,kind}'<>'plan_release_decision'or cmd#>>'{payload,visit,kind}'<>'care_visit')then raise exception using errcode='23514',message='Freigegebene Planfassung oder Einsatzoriginal fehlt.';
 elsif kind='planned_service_record'and cmd#>>'{payload,execution,kind}'<>'care_execution'then raise exception using errcode='23514',message='Tatsächliches Durchführungsoriginal fehlt.';
 elsif kind='refusal_record'and(cmd#>>'{payload,measure,kind}'<>'care_plan_path_event'or cmd#>>'{payload,measure,snapshot,command,kind}'<>'measure_plan'or cmd#>>'{payload,visit,kind}'<>'care_visit')then raise exception using errcode='23514',message='Maßnahmen- oder Einsatzoriginal fehlt.';
 elsif kind='incident_report'and(cmd#>>'{payload,visit,kind}'<>'care_visit'or not(cmd#>>'{payload,people,kind}'=any(array['client_record','employee_profile'])))then raise exception using errcode='23514',message='Einsatz- oder Beteiligtenoriginal fehlt.';
 elsif kind='incident_closure'and cmd#>>'{payload,incident,snapshot,command,kind}'<>'incident_report'then raise exception using errcode='23514',message='Vorkommnisoriginal fehlt.';
 elsif kind='protocol_record'and(cmd#>>'{payload,template,kind}'<>'documentation_template'or cmd#>>'{payload,visit,kind}'<>'care_visit')then raise exception using errcode='23514',message='Vorlagen- oder Einsatzoriginal fehlt.';
 elsif kind='content_confirmation'and(cmd#>>'{payload,document,kind}'<>'care_documentation'or not(cmd#>>'{payload,person,kind}'=any(array['employee_profile','client_record','representative_record'])))then raise exception using errcode='23514',message='Dokumentations- oder Personenoriginal fehlt.';
 elsif kind='history_review'and cmd#>>'{payload,document,kind}'<>'care_documentation'then raise exception using errcode='23514',message='Dokumentationsoriginal fehlt.';
 elsif kind='control_order'and not(cmd#>>'{payload,basis,kind}'=any(array['care_documentation','care_plan_path_event']))then raise exception using errcode='23514',message='Dokumentations- oder Planoriginal fehlt.';
 elsif kind in('control_result','control_nonperformance')and cmd#>>'{payload,order,snapshot,command,kind}'<>'control_order'then raise exception using errcode='23514',message='Kontrollauftrag fehlt.';
 elsif kind='control_result'and not(cmd#>>'{payload,evidence,kind}'=any(array['care_documentation','care_execution']))then raise exception using errcode='23514',message='Kontrollergebnisoriginal fehlt.';
 elsif kind='external_document_review'and cmd#>>'{payload,external,kind}'<>'external_document'then raise exception using errcode='23514',message='Externes Dokumentoriginal fehlt.';
 elsif kind='documentation_review_request'and(cmd#>>'{payload,document,kind}'<>'care_documentation'or cmd#>>'{payload,history,kind}'<>'care_documentation_history')then raise exception using errcode='23514',message='Dokumentations- oder Verlaufsoriginal fehlt.';
 elsif kind in('documentation_review_return','documentation_review_decision')and cmd#>>'{payload,review,snapshot,command,kind}'<>'documentation_review_request'then raise exception using errcode='23514',message='Dokumentationsprüfanfrage fehlt.';
 elsif kind='documentation_review_decision'and cmd#>>'{payload,decision}'not in('accepted','returned')then raise exception using errcode='23514',message='Fachentscheidung ist unbekannt.';end if;
 foreach k in array array['closureSha256','fieldSetSha256','contentSha256','exportSha256','packetSha256','decisionSha256','evidenceSha256']loop v:=cmd->'payload'->>k;if v is not null and v!~'^[0-9a-f]{64}$'then raise exception using errcode='22023',message='Belegbindung ist ungültig.';end if;end loop;
 foreach k in array array['performedAt','measuredAt','fromAt','toAt','dueAt','observedAt','newDueAt','receivedAt','eventAt']loop v:=cmd->'payload'->>k;if v is not null and v!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$'then raise exception using errcode='22023',message='Zeitpunkt ist ungültig.';end if;end loop;
 if kind='correction'and cmd#>>'{payload,targetId}'!~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'then raise exception using errcode='22023',message='Berichtigungsziel ist ungültig.';end if;
end$$;

create or replace function care_documentation_path_private.read_context(t uuid,a uuid,c uuid)returns jsonb language plpgsql security definer set search_path='' as $$declare n text;client jsonb;src jsonb;begin
 n:=care_documentation_path_private.actor(t,a,null);select to_jsonb(x)into client from public.clients x where x.tenant_id=t and x.id=c for share;
 if client is null then raise exception using errcode='42501',message='Pflegefall fehlt oder ist nicht zugänglich.';end if;src:=care_documentation_path_private.sources(t,c);
 return jsonb_build_object('version','2026-10-16.5','tenantId',t,'clientId',c,'actorId',a,'loadedAt',to_char(clock_timestamp()at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'sources',jsonb_build_object('count',jsonb_array_length(src),'rows',src),'history',care_documentation_path_private.history(t,c));
end$$;
create or replace function care_documentation_path_private.commit_event(cmd jsonb)returns jsonb language plpgsql security definer set search_path='' as $$
declare t uuid:=(cmd->>'tenantId')::uuid;c uuid:=(cmd->>'clientId')::uuid;a uuid:=(cmd->>'actorId')::uuid;rid uuid:=(cmd->>'requestId')::uuid;eid uuid:=(cmd->>'eventId')::uuid;n text;root care_documentation_path_private.roots%rowtype;e care_documentation_path_private.events%rowtype;src jsonb;begin
 n:=care_documentation_path_private.actor(t,a,cmd->>'kind');perform 1 from public.clients x where x.tenant_id=t and x.id=c for share;if not found then raise exception using errcode='42501',message='Pflegefall fehlt.';end if;
 lock table public.clients,public.care_tour_stops,public.clinical_treatment_executions,public.clinical_documentation_entries,care_documentation_private.versions,public.document_templates,public.profiles,public.client_contacts,public.client_intake_documents,care_plan_path_private.events in share mode;
 insert into care_documentation_path_private.roots(tenant_id,client_id)values(t,c)on conflict do nothing;select*into root from care_documentation_path_private.roots r where r.tenant_id=t and r.client_id=c for update;
 select*into e from care_documentation_path_private.events z where z.tenant_id=t and z.request_id=rid;if e.id is not null then if e.command is distinct from cmd then raise exception using errcode='23505',message='Anfragekennung gehört zu anderem Inhalt.';end if;return jsonb_build_object('version','2026-10-16.5','requestId',rid,'command',e.command,'event',care_documentation_path_private.event_json(e));end if;
 src:=care_documentation_path_private.sources(t,c);perform care_documentation_path_private.validate_command(cmd,src);
 if(cmd->>'expectedHeadId')is distinct from root.head_id::text then raise exception using errcode='40001',message='Dokumentationspfadverlauf wurde geändert.';end if;
 if cmd->>'kind'='correction'and not exists(select 1 from care_documentation_path_private.events x where x.tenant_id=t and x.client_id=c and x.id=(cmd#>>'{payload,targetId}')::uuid and x.kind<>'correction'and not exists(select 1 from care_documentation_path_private.events z where z.tenant_id=t and z.client_id=c and z.kind='correction'and z.command#>>'{payload,targetId}'=x.id::text))then raise exception using errcode='23514',message='Nur ein vorhandenes unberichtigtes Original kann berichtigt werden.';end if;
 insert into care_documentation_path_private.events(id,tenant_id,client_id,sequence,previous_id,request_id,actor_id,actor_name,occurred_at,kind,command)values(eid,t,c,coalesce((select max(sequence)+1 from care_documentation_path_private.events where tenant_id=t and client_id=c),1),root.head_id,rid,a,n,(cmd->>'occurredAt')::timestamptz,cmd->>'kind',cmd)returning*into e;
 update care_documentation_path_private.roots set head_id=eid,updated_at=clock_timestamp()where tenant_id=t and client_id=c;
 return jsonb_build_object('version','2026-10-16.5','requestId',rid,'command',cmd,'event',care_documentation_path_private.event_json(e));
end$$;
create or replace function care_documentation_path_private.confirm_event(t uuid,a uuid,c uuid,rid uuid,cmd jsonb)returns jsonb language plpgsql security definer set search_path='' as $$declare e care_documentation_path_private.events%rowtype;begin
 perform care_documentation_path_private.actor(t,a,null);select*into e from care_documentation_path_private.events z where z.tenant_id=t and z.client_id=c and z.request_id=rid;
 if e.id is null or e.command is distinct from cmd or e.actor_id<>a then raise exception using errcode='P0P01',message='Passende native Quittung fehlt.';end if;
 return jsonb_build_object('version','2026-10-16.5','requestId',rid,'command',e.command,'event',care_documentation_path_private.event_json(e));
end$$;

create or replace function public.web_care_documentation_path_workspace_context(p_tenant_id uuid,p_client_id uuid,p_actor_id uuid)returns jsonb language sql security invoker set search_path='' as $$select care_documentation_path_private.read_context(p_tenant_id,p_actor_id,p_client_id)$$;
create or replace function public.web_commit_care_documentation_path_event(p_command jsonb)returns jsonb language sql security invoker set search_path='' as $$select care_documentation_path_private.commit_event(p_command)$$;
create or replace function public.web_confirm_care_documentation_path_event(p_tenant_id uuid,p_client_id uuid,p_actor_id uuid,p_request_id uuid,p_command jsonb)returns jsonb language sql security invoker set search_path='' as $$select care_documentation_path_private.confirm_event(p_tenant_id,p_actor_id,p_client_id,p_request_id,p_command)$$;
revoke all on function public.web_care_documentation_path_workspace_context(uuid,uuid,uuid),public.web_commit_care_documentation_path_event(jsonb),public.web_confirm_care_documentation_path_event(uuid,uuid,uuid,uuid,jsonb)from public,anon;
grant usage on schema care_documentation_path_private to authenticated;
grant execute on function care_documentation_path_private.read_context(uuid,uuid,uuid),care_documentation_path_private.commit_event(jsonb),care_documentation_path_private.confirm_event(uuid,uuid,uuid,uuid,jsonb)to authenticated;
grant execute on function public.web_care_documentation_path_workspace_context(uuid,uuid,uuid),public.web_commit_care_documentation_path_event(jsonb),public.web_confirm_care_documentation_path_event(uuid,uuid,uuid,uuid,jsonb)to authenticated;
commit;
