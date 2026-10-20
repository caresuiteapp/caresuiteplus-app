-- PREPARED ONLY: W-01..W-12 connected Web/Desktop communication evidence workspace.
-- Not applied. Existing handover, portal, message, push, TI, integration and care originals are read only.
-- Runtime gates still required: PostgreSQL/PostgREST/RLS/grants, two sessions, lock/rollback,
-- legacy/native writers, provider sandboxes, browser/layout and qualified care/privacy/legal acceptance.
begin;
create schema if not exists communication_evidence_private;
revoke all on schema communication_evidence_private from public,anon,authenticated;
create table if not exists communication_evidence_private.roots(tenant_id uuid primary key,head_id uuid,updated_at timestamptz not null default clock_timestamp());
create table if not exists communication_evidence_private.events(id uuid primary key,tenant_id uuid not null,sequence bigint not null,previous_id uuid,request_id uuid not null,actor_id uuid not null,actor_name text not null,occurred_at timestamptz not null,recorded_at timestamptz not null default clock_timestamp(),kind text not null,command jsonb not null,unique(tenant_id,sequence),unique(tenant_id,request_id));
alter table communication_evidence_private.roots enable row level security;alter table communication_evidence_private.events enable row level security;
revoke all on all tables in schema communication_evidence_private from public,anon,authenticated;
create or replace function communication_evidence_private.immutable()returns trigger language plpgsql security definer set search_path='' as $$begin raise exception using errcode='P0P01',message='Kommunikationsverlauf bleibt unveränderlich.';end$$;
drop trigger if exists communication_evidence_roots_delete on communication_evidence_private.roots;create trigger communication_evidence_roots_delete before delete on communication_evidence_private.roots for each row execute function communication_evidence_private.immutable();
drop trigger if exists communication_evidence_events_immutable on communication_evidence_private.events;create trigger communication_evidence_events_immutable before update or delete on communication_evidence_private.events for each row execute function communication_evidence_private.immutable();

create or replace function communication_evidence_private.profile_has(t uuid,a uuid,keys text[])returns boolean language sql stable set search_path='' as $$
select exists(select 1 from public.profiles p join public.roles r on r.id=p.role_id where p.id=a and p.tenant_id=t and p.is_active and p.status='active'and not exists(select 1 from unnest(keys)k where not case when exists(select 1 from public.role_permission_sets z where z.tenant_id=t and z.role_key=r.key)then exists(select 1 from public.role_permission_sets z where z.tenant_id=t and z.role_key=r.key and z.permission_key=k)else exists(select 1 from public.role_permissions z where z.role_id=r.id and z.permission_key=k)end))$$;
create or replace function communication_evidence_private.kind_right(k text)returns text language sql immutable set search_path='' as $$select case
 when k in('handover_version','case_conference_plan')then'communication.create_thread'
 when k in('task_escalation','case_conference_follow_up')then'communication.assign_thread'
 when k in('employee_portal_scope_review','client_portal_scope_review','relative_portal_scope_review')then'communication.manage_participants'
 when k in('secure_message_request','secure_message_receipt','secure_message_reply')then'communication.send_message'
 when k='secure_message_closure'then'communication.archive_thread'
 when k in('notification_dispatch','notification_result','secure_message_delivery')then'communication.manage_settings'
 when k in('kim_exchange','kim_receipt')then'ti.kim.manage'
 when k in('epa_scope_review','epa_exchange','interface_exchange','interface_reconciliation')then'integrations.manage'
 when k in('case_conference_occurrence','case_conference_decision')then'communication.send_internal_note'
 when k='correction'then'communication.edit_any_message'end$$;
create or replace function communication_evidence_private.extra_rights(k text)returns text[] language sql immutable set search_path='' as $$select case when k in('kim_exchange','kim_receipt')then array['ti.kim.view']when k in('epa_scope_review','epa_exchange')then array['ti.epa.view']else array[]::text[]end$$;
create or replace function communication_evidence_private.actor(t uuid,a uuid,k text default null)returns text language plpgsql security definer set search_path='' as $$
declare sid uuid;n text;permission text;required text[]:=array['communication.view_center','office.clients.view','office.clients.view_sensitive','integrations.view','ti.view'];begin
 if auth.uid()is null or auth.uid()is distinct from a or public.resolve_current_profile_id()is distinct from a or public.current_tenant_id()is distinct from t or coalesce((auth.jwt()->>'exp')::bigint,0)<=extract(epoch from clock_timestamp())then raise exception using errcode='42501',message='Aktuelles eigenes Konto fehlt.';end if;
 sid:=nullif(auth.jwt()->>'session_id','')::uuid;perform 1 from auth.sessions s where s.id=sid and s.user_id=auth.uid()and(s.not_after is null or s.not_after>clock_timestamp())for share;if not found then raise exception using errcode='42501',message='Aktuelle native Sitzung fehlt.';end if;
 permission:=communication_evidence_private.kind_right(k);if k is not null and permission is null then raise exception using errcode='22023',message='Kommunikationsvorgang ist unbekannt.';end if;if permission is not null then required:=required||permission||communication_evidence_private.extra_rights(k);lock table public.roles,public.role_permissions,public.role_permission_sets in share mode;end if;
 select coalesce(nullif(btrim(p.display_name),''),'Name nicht bestätigt')into n from public.profiles p join public.roles r on r.id=p.role_id where p.id=a and p.tenant_id=t and p.is_active and p.status='active'and(p.auth_user_id is null or p.auth_user_id=auth.uid())for share of p,r;
 if n is null or not communication_evidence_private.profile_has(t,a,required)then raise exception using errcode='42501',message='Aktuelle Kommunikations-, Pflegefall-, Integrations- oder TI-Rechte fehlen.';end if;foreach permission in array required loop if public.has_permission(permission)is not true then raise exception using errcode='42501',message='Nativer Rechtezugang fehlt.';end if;end loop;return n;
end$$;

create or replace function communication_evidence_private.sources(t uuid)returns jsonb language sql security definer set search_path='' as $$with s as(
 select'profile'::text kind,x.id,to_jsonb(x)snapshot from public.profiles x where x.tenant_id=t and x.is_active
 union all select'client',x.id,to_jsonb(x)from public.clients x where x.tenant_id=t
 union all select'case_handover',x.id,to_jsonb(x)from public.ambulatory_handovers x where x.tenant_id=t
 union all select'case_handover_source',x.id,to_jsonb(x)from public.ambulatory_handover_changes x where x.tenant_id=t
 union all select'client_document',x.id,to_jsonb(x)from public.client_documents x where x.tenant_id=t
 union all select'care_risk',x.id,to_jsonb(x)from public.client_risks x where x.tenant_id=t
 union all select'care_plan_version',x.id,to_jsonb(x)from public.care_plan_versions x where x.tenant_id=t
 union all select'clinical_control',x.id,to_jsonb(x)from public.care_control_tasks x where x.tenant_id=t
 union all select'task',x.id,to_jsonb(x)from public.care_control_tasks x where x.tenant_id=t
 union all select'employee_portal_account',x.id,to_jsonb(x)from public.employee_portal_accounts x where x.tenant_id=t
 union all select'client_portal_account',x.id,to_jsonb(x)from public.client_portal_codes x where x.tenant_id=t
 union all select'relative_portal_account',x.id,to_jsonb(x)from public.relative_portal_codes x where x.tenant_id=t
 union all select'employee_assignment',x.id,to_jsonb(x)from public.assist_visits x where x.tenant_id=t
 union all select'care_visit_assignment',x.id,to_jsonb(x)from public.assist_visits x where x.tenant_id=t
 union all select'portal_release',x.id,to_jsonb(x)from public.client_portal_access x where x.tenant_id=t
 union all select'client_document_release',x.id,to_jsonb(x)from public.client_portal_access x where x.tenant_id=t
 union all select'representation_evidence',x.id,to_jsonb(x)from public.relative_portal_codes x where x.tenant_id=t
 union all select'relative_portal_access',x.id,to_jsonb(x)from public.relative_portal_codes x where x.tenant_id=t
 union all select'communication_thread',x.id,to_jsonb(x)from public.communication_threads x where x.tenant_id=t
 union all select'case_conference',x.id,to_jsonb(x)from public.communication_threads x where x.tenant_id=t
 union all select'communication_message',x.id,to_jsonb(x)from public.communication_messages x where x.tenant_id=t
 union all select'case_conference_decision',x.id,to_jsonb(x)from public.communication_messages x where x.tenant_id=t and x.is_internal_note
 union all select'communication_transport',x.id,to_jsonb(x)from public.communication_outbound_messages x where x.tenant_id=t
 union all select'portal_device',x.id,to_jsonb(x)from public.portal_push_devices x where x.tenant_id=t
 union all select'notification_dispatch',x.id,to_jsonb(x)from public.portal_push_outbox x where x.tenant_id=t
 union all select'notification_receipt',x.id,to_jsonb(x)from public.communication_delivery_events x where x.tenant_id=t
 union all select'kim_mailbox',x.id,to_jsonb(x)from public.kim_mailboxes x where x.tenant_id=t
 union all select'kim_identity',x.id,to_jsonb(x)from public.kim_mailboxes x where x.tenant_id=t
 union all select'kim_message',x.id,to_jsonb(x)from public.kim_messages x where x.tenant_id=t
 union all select'kim_receipt',x.id,to_jsonb(x)from public.kim_messages x where x.tenant_id=t and x.status in('read','archived','error')
 union all select'ti_consent',x.id,to_jsonb(x)from public.ti_consents x where x.tenant_id=t and x.scope='epa'
 union all select'epa_scope',x.id,to_jsonb(x)from public.epa_connections x where x.tenant_id=t
 union all select'epa_exchange_request',x.id,to_jsonb(x)from public.epa_connections x where x.tenant_id=t
 union all select'epa_exchange_receipt',x.id,to_jsonb(x)from public.ti_audit_events x where x.tenant_id=t
 union all select'epa_audit',x.id,to_jsonb(x)from public.ti_audit_events x where x.tenant_id=t
 union all select'integration_contract',x.id,to_jsonb(x)from public.tenant_connect_integrations x where x.tenant_id=t
 union all select'integration_specification',x.id,to_jsonb(x)from public.tenant_connect_integrations x where x.tenant_id=t
 union all select'integration_outbox',x.id,to_jsonb(x)from public.connect_audit_events x where x.tenant_id=t
 union all select'integration_receipt',x.id,to_jsonb(x)from public.connect_audit_events x where x.tenant_id=t
 union all select'integration_record',x.id,to_jsonb(x)from public.connect_audit_events x where x.tenant_id=t
)select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'id',id,'snapshot',snapshot)order by kind,id),'[]'::jsonb)from s$$;

create or replace function communication_evidence_private.source_rules(k text)returns jsonb language sql immutable set search_path='' as $$select case k
 when'handover_version'then'{"handover":["case_handover"],"recipient":["profile","employee_portal_account","client_portal_account","relative_portal_account"],"source":["case_handover_source","client_document","care_risk","care_plan_version"]}'
 when'task_escalation'then'{"handover":["case_handover"],"task":["clinical_control","task"],"recipient":["profile"]}'
 when'employee_portal_scope_review'then'{"account":["employee_portal_account"],"assignment":["employee_assignment","care_visit_assignment"]}'
 when'client_portal_scope_review'then'{"account":["client_portal_account"],"client":["client"],"release":["portal_release","client_document_release"]}'
 when'relative_portal_scope_review'then'{"account":["relative_portal_account"],"representation":["representation_evidence"],"release":["relative_portal_access"]}'
 when'secure_message_request'then'{"thread":["communication_thread"],"sender":["profile","employee_portal_account","client_portal_account","relative_portal_account"],"recipient":["profile","employee_portal_account","client_portal_account","relative_portal_account"]}'
 when'secure_message_delivery'then'{"message":["communication_message"],"transport":["communication_transport","kim_message"]}'
 when'secure_message_receipt'then'{"message":["communication_message"],"recipient":["profile","employee_portal_account","client_portal_account","relative_portal_account"]}'
 when'secure_message_reply'then'{"request":["communication_message"],"reply":["communication_message"]}'
 when'secure_message_closure'then'{"thread":["communication_thread"],"request":["communication_message"],"reply":["communication_message"]}'
 when'notification_dispatch'then'{"trigger":["communication_message","case_handover","task"],"device":["portal_device"],"account":["employee_portal_account","client_portal_account","relative_portal_account"]}'
 when'notification_result'then'{"dispatch":["notification_dispatch"],"provider":["notification_receipt"]}'
 when'kim_exchange'then'{"mailbox":["kim_mailbox"],"message":["kim_message"],"identity":["kim_identity"]}'
 when'kim_receipt'then'{"message":["kim_message"],"receipt":["kim_receipt"]}'
 when'epa_scope_review'then'{"consent":["ti_consent"],"scope":["epa_scope"],"protocol":["epa_audit"]}'
 when'epa_exchange'then'{"scope":["epa_scope"],"request":["epa_exchange_request"],"receipt":["epa_exchange_receipt"]}'
 when'interface_exchange'then'{"contract":["integration_contract"],"specification":["integration_specification"],"request":["integration_outbox"]}'
 when'interface_reconciliation'then'{"request":["integration_outbox"],"receipt":["integration_receipt"],"record":["integration_record"]}'
 when'case_conference_plan'then'{"client":["client"],"participant":["profile"],"trigger":["case_handover","clinical_control","care_risk"]}'
 when'case_conference_occurrence'then'{"plan":["case_conference"],"participant":["profile"]}'
 when'case_conference_decision'then'{"conference":["case_conference"],"participant":["profile"]}'
 when'case_conference_follow_up'then'{"conference":["case_conference"],"decision":["case_conference_decision"],"task":["clinical_control","task"]}'
 when'correction'then'{}'end::jsonb$$;
create or replace function communication_evidence_private.field_keys(k text)returns text[] language sql immutable set search_path='' as $$select case k
 when'handover_version'then array['priority','changeSummary','openConsequence']when'task_escalation'then array['dueAt','escalationState','response']
 when'employee_portal_scope_review'then array['scopeSha256','decision','reason']when'client_portal_scope_review'then array['scopeSha256','decision','reason']when'relative_portal_scope_review'then array['validUntil','scopeSha256','decision','reason']
 when'secure_message_request'then array['purpose','contentSha256','channel']when'secure_message_delivery'then array['state','providerReference','observedAt']when'secure_message_receipt'then array['receivedAt','receiptSha256']when'secure_message_reply'then array['replySummary','replySha256']when'secure_message_closure'then array['decision','openFollowUp','closureSha256']
 when'notification_dispatch'then array['channel','publicEnvelopeSha256']when'notification_result'then array['state','providerReference','observedAt']when'kim_exchange'then array['direction','contentSha256','certificateState']when'kim_receipt'then array['state','observedAt','receiptSha256']
 when'epa_scope_review'then array['procedureVersion','decision','reason']when'epa_exchange'then array['state','payloadSha256','observedAt']when'interface_exchange'then array['partner','mappingSha256','state']when'interface_reconciliation'then array['state','resultSha256','reason']
 when'case_conference_plan'then array['scheduledAt','purpose']when'case_conference_occurrence'then array['occurredAt','minutesSha256']when'case_conference_decision'then array['decision','decisionSha256']when'case_conference_follow_up'then array['dueAt','outcome','result']when'correction'then array['targetId','reason','evidenceSha256']end$$;

create or replace function communication_evidence_private.validate_command(cmd jsonb,src jsonb)returns void language plpgsql set search_path='' as $$declare k text:=cmd->>'kind';p jsonb:=cmd->'payload';rules jsonb:=communication_evidence_private.source_rules(k);actual text[];expected text[];entry record;v jsonb;begin
 select array_agg(x order by x)into actual from jsonb_object_keys(cmd)x;if jsonb_typeof(cmd)is distinct from'object'or actual is distinct from array['actorId','eventId','expectedHeadId','kind','note','occurredAt','payload','requestId','tenantId','version']::text[]or cmd->>'version'<>'2026-10-16.1'or communication_evidence_private.kind_right(k)is null or cmd->>'requestId'!~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'or cmd->>'eventId'!~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'or cmd->>'tenantId'!~'^[0-9a-f-]{36}$'or cmd->>'actorId'!~'^[0-9a-f-]{36}$'or(cmd->'expectedHeadId'<>'null'::jsonb and cmd->>'expectedHeadId'!~'^[0-9a-f-]{36}$')or cmd->>'occurredAt'!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$'or nullif(btrim(cmd->>'note'),'')is null or length(cmd->>'note')>4000 or jsonb_typeof(p)is distinct from'object'or rules is null then raise exception using errcode='22023',message='Kommunikationsanfrage ist unvollständig.';end if;
 select array_agg(key order by key)into expected from(select jsonb_object_keys(rules)key union all select unnest(communication_evidence_private.field_keys(k)))q;select array_agg(x order by x)into actual from jsonb_object_keys(p)x;if actual is distinct from expected then raise exception using errcode='22023',message='Vorgangsfelder sind unvollständig oder enthalten Fremdfelder.';end if;
 for entry in select key,value from jsonb_each(rules)loop v:=p->entry.key;if jsonb_typeof(v)is distinct from'object'or(select array_agg(x order by x)from jsonb_object_keys(v)x)is distinct from array['id','kind','snapshot']::text[]or not exists(select 1 from jsonb_array_elements(entry.value)x where x#>>'{}'=v->>'kind')or v->>'id'!~'^[0-9a-f-]{36}$'or jsonb_typeof(v->'snapshot')is distinct from'object'or v#>>'{snapshot,id}'is distinct from v->>'id'or not exists(select 1 from jsonb_array_elements(src)x where x=v)then raise exception using errcode='40001',message='Originalquelle ist falsch, geändert oder nicht mehr zugänglich.';end if;end loop;
 for entry in select x key from unnest(communication_evidence_private.field_keys(k))x loop if nullif(btrim(p->>entry.key),'')is null then raise exception using errcode='22023',message='Pflichtangabe fehlt.';end if;if entry.key~'(Sha256)$'and(p->>entry.key)!~'^[0-9a-f]{64}$'then raise exception using errcode='22023',message='Fingerabdruck ist ungültig.';elsif entry.key in('dueAt','validUntil','observedAt','receivedAt','scheduledAt','occurredAt')and(p->>entry.key)!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$'then raise exception using errcode='22007',message='Zeitpunkt ist ungültig.';elsif entry.key='targetId'and(p->>entry.key)!~'^[0-9a-f-]{36}$'then raise exception using errcode='22P02',message='UUID ist ungültig.';end if;end loop;
end$$;

create or replace function communication_evidence_private.event_json(e communication_evidence_private.events)returns jsonb language sql immutable set search_path='' as $$select jsonb_build_object('id',e.id,'sequence',e.sequence,'previousId',e.previous_id,'tenantId',e.tenant_id,'actorId',e.actor_id,'actorName',e.actor_name,'recordedAt',to_char(e.recorded_at at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'command',e.command)$$;
create or replace function communication_evidence_private.history(t uuid)returns jsonb language plpgsql security definer set search_path='' as $$declare e communication_evidence_private.events%rowtype;head uuid;prev uuid;n bigint:=0;rows jsonb:='[]';begin select r.head_id into head from communication_evidence_private.roots r where r.tenant_id=t;for e in select*from communication_evidence_private.events z where z.tenant_id=t order by z.sequence loop if e.sequence<>n+1 or e.previous_id is distinct from prev or e.command->>'eventId'is distinct from e.id::text or e.command->>'tenantId'is distinct from t::text or e.command->>'actorId'is distinct from e.actor_id::text or(e.command->>'expectedHeadId')is distinct from prev::text then raise exception using errcode='23514',message='Kommunikationsverlauf ist widersprüchlich.';end if;rows:=rows||jsonb_build_array(communication_evidence_private.event_json(e));prev:=e.id;n:=n+1;end loop;if head is distinct from prev then raise exception using errcode='23514',message='Kommunikationsverlaufskopf ist unvollständig.';end if;return jsonb_build_object('version','2026-10-16.1','tenantId',t,'count',n,'headId',head,'events',rows);end$$;
create or replace function communication_evidence_private.read_context(t uuid,a uuid)returns jsonb language plpgsql security definer set search_path='' as $$declare n text;src jsonb;begin n:=communication_evidence_private.actor(t,a,null);src:=communication_evidence_private.sources(t);return jsonb_build_object('version','2026-10-16.1','tenantId',t,'actorId',a,'loadedAt',to_char(clock_timestamp()at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'sources',jsonb_build_object('count',jsonb_array_length(src),'rows',src),'history',communication_evidence_private.history(t));end$$;
create or replace function communication_evidence_private.commit_event(cmd jsonb)returns jsonb language plpgsql security definer set search_path='' as $$declare t uuid:=(cmd->>'tenantId')::uuid;a uuid:=(cmd->>'actorId')::uuid;rid uuid:=(cmd->>'requestId')::uuid;eid uuid:=(cmd->>'eventId')::uuid;n text;root communication_evidence_private.roots%rowtype;e communication_evidence_private.events%rowtype;src jsonb;begin n:=communication_evidence_private.actor(t,a,cmd->>'kind');perform pg_advisory_xact_lock(hashtextextended('communication-evidence:'||t::text,0));insert into communication_evidence_private.roots(tenant_id)values(t)on conflict do nothing;select*into root from communication_evidence_private.roots r where r.tenant_id=t for update;select*into e from communication_evidence_private.events z where z.tenant_id=t and z.request_id=rid;if e.id is not null then if e.command is distinct from cmd then raise exception using errcode='23505',message='Anfragekennung gehört zu anderem Inhalt.';end if;return jsonb_build_object('version','2026-10-16.1','requestId',rid,'command',e.command,'event',communication_evidence_private.event_json(e));end if;src:=communication_evidence_private.sources(t);perform communication_evidence_private.validate_command(cmd,src);if(cmd->>'expectedHeadId')is distinct from root.head_id::text then raise exception using errcode='40001',message='Kommunikationsverlauf wurde geändert.';end if;if cmd->>'kind'='correction'and not exists(select 1 from communication_evidence_private.events x where x.tenant_id=t and x.id=(cmd#>>'{payload,targetId}')::uuid and x.kind<>'correction'and not exists(select 1 from communication_evidence_private.events z where z.tenant_id=t and z.kind='correction'and z.command#>>'{payload,targetId}'=x.id::text))then raise exception using errcode='23514',message='Nur ein vorhandenes unberichtigtes Original kann berichtigt werden.';end if;insert into communication_evidence_private.events(id,tenant_id,sequence,previous_id,request_id,actor_id,actor_name,occurred_at,kind,command)values(eid,t,coalesce((select max(sequence)+1 from communication_evidence_private.events where tenant_id=t),1),root.head_id,rid,a,n,(cmd->>'occurredAt')::timestamptz,cmd->>'kind',cmd)returning*into e;update communication_evidence_private.roots set head_id=eid,updated_at=clock_timestamp()where tenant_id=t;return jsonb_build_object('version','2026-10-16.1','requestId',rid,'command',cmd,'event',communication_evidence_private.event_json(e));end$$;
create or replace function communication_evidence_private.confirm_event(t uuid,a uuid,rid uuid,cmd jsonb)returns jsonb language plpgsql security definer set search_path='' as $$declare e communication_evidence_private.events%rowtype;begin perform communication_evidence_private.actor(t,a,null);select*into e from communication_evidence_private.events z where z.tenant_id=t and z.request_id=rid;if e.id is null or e.command is distinct from cmd or e.actor_id<>a then raise exception using errcode='P0P01',message='Passende native Quittung fehlt.';end if;return jsonb_build_object('version','2026-10-16.1','requestId',rid,'command',e.command,'event',communication_evidence_private.event_json(e));end$$;
create or replace function public.web_communication_evidence_workspace_context(p_tenant_id uuid,p_actor_id uuid)returns jsonb language sql security invoker set search_path='' as $$select communication_evidence_private.read_context(p_tenant_id,p_actor_id)$$;
create or replace function public.web_commit_communication_evidence_event(p_command jsonb)returns jsonb language sql security invoker set search_path='' as $$select communication_evidence_private.commit_event(p_command)$$;
create or replace function public.web_confirm_communication_evidence_event(p_tenant_id uuid,p_actor_id uuid,p_request_id uuid,p_command jsonb)returns jsonb language sql security invoker set search_path='' as $$select communication_evidence_private.confirm_event(p_tenant_id,p_actor_id,p_request_id,p_command)$$;
revoke all on function public.web_communication_evidence_workspace_context(uuid,uuid),public.web_commit_communication_evidence_event(jsonb),public.web_confirm_communication_evidence_event(uuid,uuid,uuid,jsonb)from public,anon;
grant usage on schema communication_evidence_private to authenticated;
grant execute on function communication_evidence_private.read_context(uuid,uuid),communication_evidence_private.commit_event(jsonb),communication_evidence_private.confirm_event(uuid,uuid,uuid,jsonb)to authenticated;
grant execute on function public.web_communication_evidence_workspace_context(uuid,uuid),public.web_commit_communication_evidence_event(jsonb),public.web_confirm_communication_evidence_event(uuid,uuid,uuid,jsonb)to authenticated;
commit;
