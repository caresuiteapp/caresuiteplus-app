-- PREPARED ONLY: A-10 and B-01..B-10 connected Web/Desktop client intake and lifecycle workspace.
-- Not applied. No legacy writer, native/Android surface, delivery, care proof or billing table is changed.
-- Required runtime gates: PostgreSQL/PostgREST/RLS/grants, two-session CAS/deadlock/rollback,
-- SDK argument names, native writer compatibility, browser/layout and qualified care/privacy/legal acceptance.
begin;
create schema if not exists client_lifecycle_private;
revoke all on schema client_lifecycle_private from public,anon,authenticated;

create table if not exists client_lifecycle_private.roots(
 tenant_id uuid not null,client_id uuid not null,head_id uuid,updated_at timestamptz not null default clock_timestamp(),
 primary key(tenant_id,client_id));
create table if not exists client_lifecycle_private.events(
 id uuid primary key,tenant_id uuid not null,client_id uuid not null,sequence bigint not null,previous_id uuid,request_id uuid not null,
 actor_id uuid not null,actor_name text not null,occurred_at timestamptz not null,recorded_at timestamptz not null default clock_timestamp(),
 kind text not null,command jsonb not null,unique(tenant_id,client_id,sequence),unique(tenant_id,request_id));
alter table client_lifecycle_private.roots enable row level security;
alter table client_lifecycle_private.events enable row level security;
revoke all on all tables in schema client_lifecycle_private from public,anon,authenticated;

create or replace function client_lifecycle_private.immutable()returns trigger language plpgsql security definer set search_path='' as $$begin raise exception using errcode='P0P01',message='Klientenaufnahme- und Stammdatenoriginale bleiben unveränderlich.';end$$;
drop trigger if exists client_lifecycle_roots_delete on client_lifecycle_private.roots;
create trigger client_lifecycle_roots_delete before delete on client_lifecycle_private.roots for each row execute function client_lifecycle_private.immutable();
drop trigger if exists client_lifecycle_events_immutable on client_lifecycle_private.events;
create trigger client_lifecycle_events_immutable before update or delete on client_lifecycle_private.events for each row execute function client_lifecycle_private.immutable();

create or replace function client_lifecycle_private.profile_has(t uuid,a uuid,keys text[])returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from public.profiles p join public.roles r on r.id=p.role_id where p.id=a and p.tenant_id=t and p.is_active and p.status='active'
 and not exists(select 1 from unnest(keys)k where not case when exists(select 1 from public.role_permission_sets z where z.tenant_id=t and z.role_key=r.key)
 then exists(select 1 from public.role_permission_sets z where z.tenant_id=t and z.role_key=r.key and z.permission_key=k)
 else exists(select 1 from public.role_permissions z where z.role_id=r.id and z.permission_key=k)end))$$;
create or replace function client_lifecycle_private.kind_right(kind text)returns text language sql immutable set search_path='' as $$select case
 when kind in('function_inventory_review')then'office.clients.view'
 when kind in('inquiry_capture','inquiry_decision','identity_candidate','identity_resolution')then'office.clients.create'
 when kind in('contact_revision','representation_evidence','medical_contact_revision')then'office.clients.manage_contacts'
 when kind in('admission_prerequisite_review','admission_release_decision','interruption_revision','return_plan_review','exit_revision')then'office.clients.status_change'
 when kind in('residence_revision','future_visit_replan_review','diagnosis_revision','allergy_revision','document_ingest','document_content_confirmation','emergency_information_revision','correction')then'office.clients.edit'end$$;
create or replace function client_lifecycle_private.extra_rights(kind text)returns text[] language sql immutable set search_path='' as $$select case
 when kind in('representation_evidence')then array['office.clients.manage_consents']
 when kind in('medical_contact_revision','diagnosis_revision','allergy_revision','document_ingest','document_content_confirmation','emergency_information_revision','admission_prerequisite_review','admission_release_decision')then array['office.clients.view_sensitive']
 else array[]::text[]end$$;
create or replace function client_lifecycle_private.actor(t uuid,a uuid,kind text default null)returns text language plpgsql security definer set search_path='' as $$
declare sid uuid;n text;k text;right_key text:=client_lifecycle_private.kind_right(kind);keys text[]:=array['office.clients.view'];begin
 if auth.uid()is null or auth.uid()is distinct from a or public.resolve_current_profile_id()is distinct from a or public.current_tenant_id()is distinct from t
 or coalesce((auth.jwt()->>'exp')::bigint,0)<=extract(epoch from clock_timestamp())then raise exception using errcode='42501',message='Aktuelles eigenes Konto fehlt.';end if;
 sid:=nullif(auth.jwt()->>'session_id','')::uuid;perform 1 from auth.sessions s where s.id=sid and s.user_id=auth.uid()and(s.not_after is null or s.not_after>clock_timestamp())for share;
 if not found then raise exception using errcode='42501',message='Aktuelle native Sitzung fehlt.';end if;
 if kind is not null and right_key is null then raise exception using errcode='22023',message='Klientenvorgang ist unbekannt.';end if;
 if right_key is not null then keys:=keys||right_key||client_lifecycle_private.extra_rights(kind);lock table public.roles,public.role_permissions,public.role_permission_sets in share mode;end if;
 select coalesce(nullif(btrim(p.display_name),''),'Name nicht bestätigt')into n from public.profiles p join public.roles r on r.id=p.role_id where p.id=a and p.tenant_id=t and p.is_active and p.status='active'and(p.auth_user_id is null or p.auth_user_id=auth.uid())for share of p,r;
 if n is null or not client_lifecycle_private.profile_has(t,a,keys)then raise exception using errcode='42501',message='Aktuelle Akten-, Dokument- oder Schreibrechte fehlen.';end if;
 foreach k in array keys loop if public.has_permission(k)is not true then raise exception using errcode='42501',message='Nativer Rechtezugang fehlt.';end if;end loop;return n;
end$$;

create or replace function client_lifecycle_private.event_json(e client_lifecycle_private.events)returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('id',e.id,'sequence',e.sequence,'previousId',e.previous_id,'tenantId',e.tenant_id,'clientId',e.client_id,'actorId',e.actor_id,'actorName',e.actor_name,'recordedAt',to_char(e.recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'command',e.command)$$;
create or replace function client_lifecycle_private.history(t uuid,c uuid)returns jsonb language plpgsql security definer set search_path='' as $$
declare e client_lifecycle_private.events%rowtype;head uuid;prev uuid;n bigint:=0;rows jsonb:='[]';begin
 select r.head_id into head from client_lifecycle_private.roots r where r.tenant_id=t and r.client_id=c;
 for e in select*from client_lifecycle_private.events z where z.tenant_id=t and z.client_id=c order by z.sequence loop
  if e.sequence<>n+1 or e.previous_id is distinct from prev or e.command->>'eventId'is distinct from e.id::text or e.command->>'tenantId'is distinct from t::text or e.command->>'clientId'is distinct from c::text or e.command->>'actorId'is distinct from e.actor_id::text or(e.command->>'expectedHeadId')is distinct from prev::text then raise exception using errcode='23514',message='Klientenverlauf ist widersprüchlich.';end if;
  rows:=rows||jsonb_build_array(client_lifecycle_private.event_json(e));prev:=e.id;n:=n+1;
 end loop;
 if head is distinct from prev then raise exception using errcode='23514',message='Klientenverlaufskopf ist unvollständig.';end if;
 return jsonb_build_object('version','2026-10-16.2','tenantId',t,'clientId',c,'count',n,'headId',head,'events',rows);
end$$;

create or replace function client_lifecycle_private.sources(t uuid,c uuid)returns jsonb language sql security definer set search_path='' as $$
 with s as(
  select 'client'::text kind,x.id,to_jsonb(x)snapshot from public.clients x where x.tenant_id=t and x.id=c
  union all select 'client_status',x.id,to_jsonb(x)from public.clients x where x.tenant_id=t and x.id=c
  union all select 'care_case',x.id,to_jsonb(x)from public.clients x where x.tenant_id=t and x.id=c
  union all select 'diagnosis',x.id,to_jsonb(x)from public.clients x where x.tenant_id=t and x.id=c
  union all select 'allergy',x.id,to_jsonb(x)from public.clients x where x.tenant_id=t and x.id=c
  union all select 'client_address',x.id,to_jsonb(x)from public.client_addresses x where x.tenant_id=t and x.client_id=c
  union all select 'address',x.id,to_jsonb(x)from public.client_addresses x where x.tenant_id=t and x.client_id=c
  union all select 'client_contact',x.id,to_jsonb(x)from public.client_contacts x where x.tenant_id=t and x.client_id=c
  union all select 'contact',x.id,to_jsonb(x)from public.client_contacts x where x.tenant_id=t and x.client_id=c
  union all select 'doctor',x.id,to_jsonb(x)from public.client_contacts x where x.tenant_id=t and x.client_id=c
  union all select 'medical_contact',x.id,to_jsonb(x)from public.client_contacts x where x.tenant_id=t and x.client_id=c
  union all select 'client_document',x.id,to_jsonb(x)from public.client_documents x where x.tenant_id=t and x.client_id=c
  union all select 'document',x.id,to_jsonb(x)from public.client_documents x where x.tenant_id=t and x.client_id=c
  union all select 'inquiry',x.id,to_jsonb(x)from public.client_notes x where x.tenant_id=t and x.client_id=c
  union all select 'client_task',x.id,to_jsonb(x)from public.client_tasks x where x.tenant_id=t and x.client_id=c
  union all select 'visit',x.id,to_jsonb(x)from public.client_tasks x where x.tenant_id=t and x.client_id=c
  union all select 'tour_stop',x.id,to_jsonb(x)from public.client_tasks x where x.tenant_id=t and x.client_id=c
  union all select 'care_visit',x.id,to_jsonb(x)from public.client_tasks x where x.tenant_id=t and x.client_id=c
  union all select 'assessment',x.id,to_jsonb(x)from public.care_assessments x where x.tenant_id=t and x.subject_id=c and x.subject_type='client'
  union all select 'client_lifecycle_event',e.id,client_lifecycle_private.event_json(e)from client_lifecycle_private.events e where e.tenant_id=t and e.client_id=c
 )select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'id',id,'snapshot',snapshot)order by kind,id),'[]'::jsonb)from s$$;
create or replace function client_lifecycle_private.walk_sources(v jsonb,src jsonb)returns void language plpgsql set search_path='' as $$declare x jsonb;begin
 if jsonb_typeof(v)='array'then for x in select value from jsonb_array_elements(v)loop perform client_lifecycle_private.walk_sources(x,src);end loop;
 elsif jsonb_typeof(v)='object'then if v?'snapshot'and v?'kind'and v?'id'then if not exists(select 1 from jsonb_array_elements(src)x where x=v)then raise exception using errcode='40001',message='Ausgewählte Originalgrundlage wurde geändert oder ist nicht mehr zugänglich.';end if;else for x in select value from jsonb_each(v)loop perform client_lifecycle_private.walk_sources(x,src);end loop;end if;end if;
end$$;
create or replace function client_lifecycle_private.payload_keys(k text)returns text[] language sql immutable set search_path='' as $$select case k
 when'function_inventory_review'then array['client','function','inventorySha256','coverage','openFunctions']
 when'inquiry_capture'then array['inquiry','contact','concern','urgencyCode','callbackAt','state']
 when'inquiry_decision'then array['inquiry','capture','decision','reasonCode','decisionSha256']
 when'identity_candidate'then array['inquiry','client','candidateSetSha256','matchBasis','state']
 when'identity_resolution'then array['candidate','client','decision','reason','resolutionSha256']
 when'residence_revision'then array['client','address','residenceSha256','validFrom','state']
 when'future_visit_replan_review'then array['residence','visit','affectedFrom','planSha256','decision']
 when'contact_revision'then array['client','contact','relationshipCode','contactSha256','state']
 when'representation_evidence'then array['client','representative','document','scope','validFrom','validUntil','evidenceSha256','state']
 when'medical_contact_revision'then array['client','contact','professionCode','contactSha256','state']
 when'diagnosis_revision'then array['client','diagnosis','document','codeSystem','diagnosisCode','validFrom','evidenceSha256','state']
 when'allergy_revision'then array['client','allergy','document','substanceCode','reaction','evidenceSha256','state']
 when'document_ingest'then array['client','document','contentSha256','documentType','receivedAt','state']
 when'document_content_confirmation'then array['document','nativeDocument','contentSha256','decision','limitations']
 when'emergency_information_revision'then array['client','contact','document','informationSha256','validFrom','state']
 when'admission_prerequisite_review'then array['client','inquiry','document','prerequisiteSha256','decision','openItems']
 when'admission_release_decision'then array['review','client','decision','decisionSha256','limitations']
 when'interruption_revision'then array['client','care','reasonCode','startsAt','endsAt','state']
 when'return_plan_review'then array['interruption','care','returnAt','planSha256','decision']
 when'exit_revision'then array['client','care','document','exitAt','reasonCode','evidenceSha256','state']
 when'correction'then array['targetId','reason','evidenceSha256']else null end$$;
create or replace function client_lifecycle_private.validate_command(cmd jsonb,src jsonb)returns void language plpgsql set search_path='' as $$
declare keys text[];actual text[];kind text:=cmd->>'kind';v text;begin
 if jsonb_typeof(cmd)is distinct from'object'or cmd->>'version'<>'2026-10-16.2'or cmd->>'requestId'!~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'or cmd->>'eventId'!~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'or cmd->>'tenantId'!~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'or cmd->>'clientId'!~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'or cmd->>'actorId'!~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'or(cmd->'expectedHeadId'<>'null'::jsonb and cmd->>'expectedHeadId'!~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')or cmd->>'occurredAt'!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$'or nullif(btrim(cmd->>'note'),'')is null or length(cmd->>'note')>4000 or jsonb_typeof(cmd->'payload')is distinct from'object'then raise exception using errcode='22023',message='Klientenanfrage ist unvollständig.';end if;
 keys:=client_lifecycle_private.payload_keys(kind);if keys is null then raise exception using errcode='22023',message='Vorgangsart ist unbekannt.';end if;
 select array_agg(x order by x)into actual from jsonb_object_keys(cmd->'payload')x;if actual is distinct from(select array_agg(x order by x)from unnest(keys)x)then raise exception using errcode='22023',message='Vorgangsfelder sind nicht vollständig oder enthalten Fremdfelder.';end if;
 for v in select value#>>'{}'from jsonb_each(cmd->'payload')where jsonb_typeof(value)='string'loop if nullif(btrim(v),'')is null then raise exception using errcode='22023',message='Leeres Vorgangsfeld.';end if;end loop;
 perform client_lifecycle_private.walk_sources(cmd->'payload',src);
end$$;

create or replace function client_lifecycle_private.read_context(t uuid,a uuid,c uuid)returns jsonb language plpgsql security definer set search_path='' as $$declare n text;client jsonb;src jsonb;begin
 n:=client_lifecycle_private.actor(t,a,null);select to_jsonb(x)into client from public.clients x where x.tenant_id=t and x.id=c for share;
 if client is null then raise exception using errcode='42501',message='Pflegefall fehlt oder ist nicht zugänglich.';end if;src:=client_lifecycle_private.sources(t,c);
 return jsonb_build_object('version','2026-10-16.2','tenantId',t,'clientId',c,'actorId',a,'loadedAt',to_char(clock_timestamp()at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'sources',jsonb_build_object('count',jsonb_array_length(src),'rows',src),'history',client_lifecycle_private.history(t,c));
end$$;
create or replace function client_lifecycle_private.commit_event(cmd jsonb)returns jsonb language plpgsql security definer set search_path='' as $$
declare t uuid:=(cmd->>'tenantId')::uuid;c uuid:=(cmd->>'clientId')::uuid;a uuid:=(cmd->>'actorId')::uuid;rid uuid:=(cmd->>'requestId')::uuid;eid uuid:=(cmd->>'eventId')::uuid;n text;root client_lifecycle_private.roots%rowtype;e client_lifecycle_private.events%rowtype;src jsonb;begin
 n:=client_lifecycle_private.actor(t,a,cmd->>'kind');perform 1 from public.clients x where x.tenant_id=t and x.id=c for share;if not found then raise exception using errcode='42501',message='Pflegefall fehlt.';end if;
 lock table public.clients,public.client_addresses,public.client_contacts,public.client_documents,public.client_notes,public.client_tasks,public.care_assessments in share mode;
 insert into client_lifecycle_private.roots(tenant_id,client_id)values(t,c)on conflict do nothing;select*into root from client_lifecycle_private.roots r where r.tenant_id=t and r.client_id=c for update;
 select*into e from client_lifecycle_private.events z where z.tenant_id=t and z.request_id=rid;if e.id is not null then if e.command is distinct from cmd then raise exception using errcode='23505',message='Anfragekennung gehört zu anderem Inhalt.';end if;return jsonb_build_object('version','2026-10-16.2','requestId',rid,'command',e.command,'event',client_lifecycle_private.event_json(e));end if;
 src:=client_lifecycle_private.sources(t,c);perform client_lifecycle_private.validate_command(cmd,src);
 if(cmd->>'expectedHeadId')is distinct from root.head_id::text then raise exception using errcode='40001',message='Klientenverlauf wurde geändert.';end if;
 if cmd->>'kind'='correction'and not exists(select 1 from client_lifecycle_private.events x where x.tenant_id=t and x.client_id=c and x.id=(cmd#>>'{payload,targetId}')::uuid and x.kind<>'correction'and not exists(select 1 from client_lifecycle_private.events z where z.tenant_id=t and z.client_id=c and z.kind='correction'and z.command#>>'{payload,targetId}'=x.id::text))then raise exception using errcode='23514',message='Nur ein vorhandenes unberichtigtes Original kann berichtigt werden.';end if;
 insert into client_lifecycle_private.events(id,tenant_id,client_id,sequence,previous_id,request_id,actor_id,actor_name,occurred_at,kind,command)values(eid,t,c,coalesce((select max(sequence)+1 from client_lifecycle_private.events where tenant_id=t and client_id=c),1),root.head_id,rid,a,n,(cmd->>'occurredAt')::timestamptz,cmd->>'kind',cmd)returning*into e;
 update client_lifecycle_private.roots set head_id=eid,updated_at=clock_timestamp()where tenant_id=t and client_id=c;
 return jsonb_build_object('version','2026-10-16.2','requestId',rid,'command',cmd,'event',client_lifecycle_private.event_json(e));
end$$;
create or replace function client_lifecycle_private.confirm_event(t uuid,a uuid,c uuid,rid uuid,cmd jsonb)returns jsonb language plpgsql security definer set search_path='' as $$declare e client_lifecycle_private.events%rowtype;begin
 perform client_lifecycle_private.actor(t,a,null);select*into e from client_lifecycle_private.events z where z.tenant_id=t and z.client_id=c and z.request_id=rid;
 if e.id is null or e.command is distinct from cmd or e.actor_id<>a then raise exception using errcode='P0P01',message='Passende native Quittung fehlt.';end if;
 return jsonb_build_object('version','2026-10-16.2','requestId',rid,'command',e.command,'event',client_lifecycle_private.event_json(e));
end$$;

create or replace function public.web_client_lifecycle_workspace_context(p_tenant_id uuid,p_client_id uuid,p_actor_id uuid)returns jsonb language sql security invoker set search_path='' as $$select client_lifecycle_private.read_context(p_tenant_id,p_actor_id,p_client_id)$$;
create or replace function public.web_commit_client_lifecycle_event(p_command jsonb)returns jsonb language sql security invoker set search_path='' as $$select client_lifecycle_private.commit_event(p_command)$$;
create or replace function public.web_confirm_client_lifecycle_event(p_tenant_id uuid,p_client_id uuid,p_actor_id uuid,p_request_id uuid,p_command jsonb)returns jsonb language sql security invoker set search_path='' as $$select client_lifecycle_private.confirm_event(p_tenant_id,p_actor_id,p_client_id,p_request_id,p_command)$$;
revoke all on function public.web_client_lifecycle_workspace_context(uuid,uuid,uuid),public.web_commit_client_lifecycle_event(jsonb),public.web_confirm_client_lifecycle_event(uuid,uuid,uuid,uuid,jsonb)from public,anon;
grant usage on schema client_lifecycle_private to authenticated;
grant execute on function client_lifecycle_private.read_context(uuid,uuid,uuid),client_lifecycle_private.commit_event(jsonb),client_lifecycle_private.confirm_event(uuid,uuid,uuid,uuid,jsonb)to authenticated;
grant execute on function public.web_client_lifecycle_workspace_context(uuid,uuid,uuid),public.web_commit_client_lifecycle_event(jsonb),public.web_confirm_client_lifecycle_event(uuid,uuid,uuid,uuid,jsonb)to authenticated;
commit;
