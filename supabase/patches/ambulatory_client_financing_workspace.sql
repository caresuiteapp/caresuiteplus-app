-- PREPARED ONLY: unrestricted company actors only; scoped-record support remains blocked.
-- PREPARED ONLY: T-01..T-10 connected Web/Desktop contract and financing workspace.
-- Not applied. No legacy writer, native/Android surface, delivery, care proof or billing table is changed.
-- Required runtime gates: PostgreSQL/PostgREST/RLS/grants, two-session CAS/deadlock/rollback,
-- SDK argument names, native writer compatibility, browser/layout and qualified care/privacy/legal acceptance.
begin;
create schema if not exists client_financing_private;
revoke all on schema client_financing_private from public,anon,authenticated;

create table if not exists client_financing_private.roots(
 tenant_id uuid not null,client_id uuid not null,head_id uuid,updated_at timestamptz not null default clock_timestamp(),
 primary key(tenant_id,client_id));
create table if not exists client_financing_private.events(
 id uuid primary key,tenant_id uuid not null,client_id uuid not null,sequence bigint not null,previous_id uuid,request_id uuid not null,
 actor_id uuid not null,actor_name text not null,occurred_at timestamptz not null,recorded_at timestamptz not null default clock_timestamp(),
 kind text not null,command jsonb not null,unique(tenant_id,client_id,sequence),unique(tenant_id,request_id));
alter table client_financing_private.roots enable row level security;
alter table client_financing_private.events enable row level security;
revoke all on all tables in schema client_financing_private from public,anon,authenticated;

create or replace function client_financing_private.immutable()returns trigger language plpgsql security definer set search_path='' as $$begin raise exception using errcode='P0P01',message='Vertrags- und Finanzierungsoriginale bleiben unveränderlich.';end$$;
drop trigger if exists client_financing_roots_delete on client_financing_private.roots;
create trigger client_financing_roots_delete before delete on client_financing_private.roots for each row execute function client_financing_private.immutable();
drop trigger if exists client_financing_events_immutable on client_financing_private.events;
create trigger client_financing_events_immutable before update or delete on client_financing_private.events for each row execute function client_financing_private.immutable();

create or replace function client_financing_private.profile_has(t uuid,a uuid,keys text[])returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from public.profiles p join public.roles r on r.id=p.role_id where p.id=a and p.tenant_id=t and p.is_active and p.status='active'
 and not exists(select 1 from unnest(keys)k where not case when exists(select 1 from public.role_permission_sets z where z.tenant_id=t and z.role_key=r.key)
 then exists(select 1 from public.role_permission_sets z where z.tenant_id=t and z.role_key=r.key and z.permission_key=k)
 else exists(select 1 from public.role_permissions z where z.role_id=r.id and z.permission_key=k)end))$$;
create or replace function client_financing_private.actor(t uuid,a uuid,writing boolean)returns text language plpgsql security definer set search_path='' as $$
declare sid uuid;n text;k text;keys text[]:=array['office.clients.view','office.clients.view_sensitive','office.documents.view']||case when writing then array['office.clients.edit']else array[]::text[]end;begin
 if auth.uid()is null or auth.uid()is distinct from a or public.resolve_current_profile_id()is distinct from a or public.current_tenant_id()is distinct from t
 or coalesce((auth.jwt()->>'exp')::bigint,0)<=extract(epoch from clock_timestamp())then raise exception using errcode='42501',message='Aktuelles eigenes Konto fehlt.';end if;
 sid:=nullif(auth.jwt()->>'session_id','')::uuid;perform 1 from auth.sessions s where s.id=sid and s.user_id=auth.uid()and(s.not_after is null or s.not_after>clock_timestamp())for share;
 if not found then raise exception using errcode='42501',message='Aktuelle native Sitzung fehlt.';end if;
 if writing then lock table public.roles,public.role_permissions,public.role_permission_sets in share mode;end if;
 select coalesce(nullif(btrim(p.display_name),''),'Name nicht bestätigt')into n from public.profiles p join public.roles r on r.id=p.role_id where p.id=a and p.tenant_id=t and p.is_active and p.status='active'and(p.auth_user_id is null or p.auth_user_id=auth.uid())for share of p,r;
 if n is null or not client_financing_private.profile_has(t,a,keys)then raise exception using errcode='42501',message='Aktuelle Akten-, Dokument- oder Schreibrechte fehlen.';end if;
 foreach k in array keys loop if care_security.company_actor(t,k)is not true or public.has_permission(k)is not true then raise exception using errcode='42501',message='Nativer Rechtezugang fehlt.';end if;end loop;return n;
end$$;

create or replace function client_financing_private.event_json(e client_financing_private.events)returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('id',e.id,'sequence',e.sequence,'previousId',e.previous_id,'tenantId',e.tenant_id,'clientId',e.client_id,'actorId',e.actor_id,'actorName',e.actor_name,'recordedAt',to_char(e.recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'command',e.command)$$;
create or replace function client_financing_private.history(t uuid,c uuid)returns jsonb language plpgsql security definer set search_path='' as $$
declare e client_financing_private.events%rowtype;head uuid;prev uuid;n bigint:=0;rows jsonb:='[]';begin
 select r.head_id into head from client_financing_private.roots r where r.tenant_id=t and r.client_id=c;
 for e in select*from client_financing_private.events z where z.tenant_id=t and z.client_id=c order by z.sequence loop
  if e.sequence<>n+1 or e.previous_id is distinct from prev or e.command->>'eventId'is distinct from e.id::text or e.command->>'tenantId'is distinct from t::text or e.command->>'clientId'is distinct from c::text or e.command->>'actorId'is distinct from e.actor_id::text or(e.command->>'expectedHeadId')is distinct from prev::text then raise exception using errcode='23514',message='Finanzierungsverlauf ist widersprüchlich.';end if;
  rows:=rows||jsonb_build_array(client_financing_private.event_json(e));prev:=e.id;n:=n+1;
 end loop;
 if head is distinct from prev then raise exception using errcode='23514',message='Finanzierungsverlaufskopf ist unvollständig.';end if;
 return jsonb_build_object('version','2026-10-16.1','tenantId',t,'clientId',c,'count',n,'headId',head,'events',rows);
end$$;

create or replace function client_financing_private.sources(t uuid,c uuid)returns jsonb language sql security definer set search_path='' as $$
 with s as(
  select 'contract'::text kind,x.id,to_jsonb(x)snapshot from public.client_contracts x where x.tenant_id=t and x.client_id=c
  union all select 'document',x.id,to_jsonb(x)from public.client_documents x where x.tenant_id=t and x.client_id=c
  union all select 'decision',x.id,to_jsonb(x)from public.client_documents x where x.tenant_id=t and x.client_id=c
  union all select 'financing_path',x.id,to_jsonb(x)from public.client_financing_paths x where x.tenant_id=t and x.client_id=c
  union all select 'approval',x.id,to_jsonb(x)from public.client_financing_approvals x where x.tenant_id=t and x.client_id=c
  union all select 'tariff',x.id,to_jsonb(x)from public.client_tariff_positions x where x.tenant_id=t and x.client_id=c
  union all select 'budget',x.id,to_jsonb(x)from public.client_budget_entitlement_periods x where x.tenant_id=t and x.client_id=c
  union all select 'estimate',x.id,to_jsonb(x)from public.client_cost_estimates x where x.tenant_id=t and x.client_id=c
  union all select 'combination_rule',x.id,to_jsonb(x)from public.client_service_combination_rules x where x.tenant_id=t
  union all select 'service',x.id,to_jsonb(x)from public.client_service_records x where x.tenant_id=t and x.client_id=c
  union all select 'proof',x.id,to_jsonb(x)from public.pfleger_service_proofs x where x.tenant_id=t and x.client_id=c
  union all select 'workspace_event',e.id,client_financing_private.event_json(e)from client_financing_private.events e where e.tenant_id=t and e.client_id=c
 )select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'id',id,'snapshot',snapshot)order by kind,id),'[]'::jsonb)from s$$;
create or replace function client_financing_private.walk_sources(v jsonb,src jsonb)returns void language plpgsql set search_path='' as $$declare x jsonb;begin
 if jsonb_typeof(v)='array'then for x in select value from jsonb_array_elements(v)loop perform client_financing_private.walk_sources(x,src);end loop;
 elsif jsonb_typeof(v)='object'then if v?'snapshot'and v?'kind'and v?'id'then if not exists(select 1 from jsonb_array_elements(src)x where x=v)then raise exception using errcode='40001',message='Ausgewählte Originalgrundlage wurde geändert oder ist nicht mehr zugänglich.';end if;else for x in select value from jsonb_each(v)loop perform client_financing_private.walk_sources(x,src);end loop;end if;end if;
end$$;
create or replace function client_financing_private.payload_keys(k text)returns text[] language sql immutable set search_path='' as $$select case k
 when'contract_basis'then array['contract','document','partner','serviceBasis','validFrom','versionLabel']
 when'financing_path'then array['basis','financingKind','payer','validFrom','status']
 when'approval_application'then array['path','document','applicationOn','requestedFrom','requestedUntil','reference']
 when'approval_decision'then array['path','application','document','decision','decidedOn','approvedFrom','approvedUntil']
 when'tariff_position'then array['path','agreement','serviceCode','unit','unitPrice','validFrom','roundingRule']
 when'calculation'then array['path','tariff','quantity','baseAmount','surcharge','totalAmount','calculationRule']
 when'budget_basis'then array['path','decision','serviceType','allocatedAmount','validFrom','validUntil']
 when'budget_consumption'then array['budget','service','eventKind','amount','serviceOn','evidence']
 when'estimate_version'then array['path','tariff','document','versionLabel','payerAmount','selfPayAmount','serviceFrom','serviceUntil','fingerprint']
 when'estimate_decision'then array['estimate','document','decision','decidingPerson','decidedAt','evidence']
 when'contract_change'then array['contract','document','effectiveOn','reason','consequences','versionLabel']
 when'contract_closure'then array['contract','document','effectiveOn','reason','consequences']
 when'combination_review'then array['path','rule','serviceA','serviceB','serviceOn','outcome','ruleReference']
 when'entitlement_version'then array['path','decision','entitlementKind','unit','quantity','validFrom','validUntil','fingerprint']
 when'correction'then array['targetId','reason']else null end$$;

create or replace function client_financing_private.valid_id(v jsonb)returns boolean language sql immutable set search_path='' as $$select coalesce(jsonb_typeof(v)='string' and(v#>>'{}')~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',false)$$;
create or replace function client_financing_private.valid_text(v jsonb,max_units integer default 4000)returns boolean language sql immutable set search_path='' as $$select coalesce(jsonb_typeof(v)='string'and nullif(btrim(v#>>'{}'),'')is not null and(max_units=0 or(select coalesce(sum(case when ascii(c)>65535 then 2 else 1 end),0)from regexp_split_to_table(v#>>'{}','')c)<=max_units),false)$$;
create or replace function client_financing_private.valid_date(v jsonb)returns boolean language plpgsql immutable set search_path='' as $$declare d date;begin if jsonb_typeof(v)is distinct from'string'or(v#>>'{}')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'then return false;end if;d:=(v#>>'{}')::date;return to_char(d,'YYYY-MM-DD')=v#>>'{}';exception when others then return false;end$$;
create or replace function client_financing_private.valid_instant(v jsonb)returns boolean language plpgsql immutable set search_path='' as $$begin if jsonb_typeof(v)is distinct from'string'or(v#>>'{}')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$'then return false;end if;perform(v#>>'{}')::timestamptz;return true;exception when others then return false;end$$;
create or replace function client_financing_private.payload_contract(k text)returns jsonb language sql immutable set search_path='' as $$select '{"contract_basis":{"contract":"source:contract","document":"source:document","partner":"text","serviceBasis":"text","validFrom":"date","versionLabel":"text"},"financing_path":{"basis":"source:contract,document,decision","financingKind":"text","payer":"text","validFrom":"date","status":"text"},"approval_application":{"path":"source:financing_path","document":"source:document,decision","applicationOn":"date","requestedFrom":"date","requestedUntil":"date","reference":"text"},"approval_decision":{"path":"source:financing_path","application":"source:approval","document":"source:document,decision","decision":"text","decidedOn":"date","approvedFrom":"date","approvedUntil":"date"},"tariff_position":{"path":"source:financing_path","agreement":"source:contract,document,tariff","serviceCode":"text","unit":"text","unitPrice":"money","validFrom":"date","roundingRule":"text"},"calculation":{"path":"source:financing_path","tariff":"source:tariff","quantity":"quantity","baseAmount":"money","surcharge":"money","totalAmount":"money","calculationRule":"text"},"budget_basis":{"path":"source:financing_path","decision":"source:document,decision","serviceType":"text","allocatedAmount":"money","validFrom":"date","validUntil":"date"},"budget_consumption":{"budget":"source:budget","service":"source:service,proof,visit","eventKind":"text","amount":"money","serviceOn":"date","evidence":"text"},"estimate_version":{"path":"source:financing_path","tariff":"source:tariff","document":"source:document","versionLabel":"text","payerAmount":"money","selfPayAmount":"money","serviceFrom":"date","serviceUntil":"date","fingerprint":"text"},"estimate_decision":{"estimate":"source:estimate","document":"source:document","decision":"text","decidingPerson":"text","decidedAt":"instant","evidence":"text"},"contract_change":{"contract":"source:contract","document":"source:document","effectiveOn":"date","reason":"text","consequences":"text","versionLabel":"text"},"contract_closure":{"contract":"source:contract","document":"source:document","effectiveOn":"date","reason":"text","consequences":"text"},"combination_review":{"path":"source:financing_path","rule":"source:combination_rule","serviceA":"text","serviceB":"text","serviceOn":"date","outcome":"text","ruleReference":"text"},"entitlement_version":{"path":"source:financing_path","decision":"source:document,decision","entitlementKind":"text","unit":"text","quantity":"quantity","validFrom":"date","validUntil":"date","fingerprint":"text"},"correction":{"targetId":"id","reason":"text"}}'::jsonb->k$$;
create or replace function client_financing_private.validate_command(cmd jsonb,src jsonb)returns void language plpgsql security definer set search_path='' as $$
declare command jsonb:=cmd;spec jsonb;name text;typ text;v jsonb;keys text[];expected text[];begin
 if jsonb_typeof(command)is distinct from'object'or command->>'version'is distinct from'2026-10-16.1' then raise exception using errcode='22023',message='Invalid command/version';end if;
 select array_agg(k order by k)into keys from jsonb_object_keys(command)k;
 if keys is distinct from array['actorId','eventId','expectedHeadId','kind','note','occurredAt','payload','requestId','tenantId','version','clientId']::text[] then
  select array_agg(k order by k)into expected from unnest(array['actorId','eventId','expectedHeadId','kind','note','occurredAt','payload','requestId','tenantId','version','clientId'])k;
  if keys is distinct from expected then raise exception using errcode='22023',message='Invalid command keys';end if;
 end if;
 foreach name in array array['actorId','eventId','requestId','tenantId','clientId']loop if not client_financing_private.valid_id(command->name)then raise exception using errcode='22023',message='Invalid command UUID';end if;end loop;
 if not(command->'expectedHeadId'='null'::jsonb or client_financing_private.valid_id(command->'expectedHeadId'))or not client_financing_private.valid_text(command->'note',4000)or not client_financing_private.valid_instant(command->'occurredAt')or jsonb_typeof(command->'payload')is distinct from'object' then raise exception using errcode='22023',message='Invalid command scope/time/note';end if;
 spec:=client_financing_private.payload_contract(command->>'kind');if spec is null then raise exception using errcode='22023',message='Unknown command kind';end if;
 select array_agg(k order by k)into expected from jsonb_object_keys(spec)k;select array_agg(k order by k)into keys from jsonb_object_keys(command->'payload')k;if keys is distinct from expected then raise exception using errcode='22023',message='Invalid payload keys';end if;
 for name,typ in select key,value#>>'{}'from jsonb_each(spec)loop
  v:=command->'payload'->name;
  if typ='text'and not client_financing_private.valid_text(v,0) or typ='id'and not client_financing_private.valid_id(v)or typ='date'and not client_financing_private.valid_date(v)or typ='date?'and not(v='null'::jsonb or client_financing_private.valid_date(v))or typ='instant'and not client_financing_private.valid_instant(v)then raise exception using errcode='22023',message='Invalid payload value: '||name;end if;
  if typ like'enum:%'and(jsonb_typeof(v)is distinct from'string'or not(v#>>'{}'=any(string_to_array(substr(typ,6),','))))then raise exception using errcode='22023',message='Invalid payload enum';end if;
  if typ in('money','quantity')and(jsonb_typeof(v)is distinct from'string'or(v#>>'{}')!~case when typ='money'then'^(0|[1-9][0-9]*)(\.[0-9]{1,2})?$'else'^(0|[1-9][0-9]*)(\.[0-9]{1,4})?$'end)then raise exception using errcode='22023',message='Invalid amount/quantity';end if;
  if typ like'source:%'then
   if jsonb_typeof(v)is distinct from'object'or(select count(*)from jsonb_object_keys(v))<>3 or not(v?'kind'and v?'id'and v?'snapshot')or not client_financing_private.valid_id(v->'id')or jsonb_typeof(v->'snapshot')is distinct from'object'or not(v->>'kind'=any(string_to_array(substr(typ,8),',')))or v#>>'{snapshot,id}'is distinct from v->>'id'then raise exception using errcode='22023',message='Invalid source shape/kind';end if;
   if not exists(select 1 from jsonb_array_elements(src)x where x=v)then raise exception using errcode='40001',message='Original source changed';end if;
  end if;
 end loop;
end$$;


create or replace function client_financing_private.read_context(t uuid,a uuid,c uuid)returns jsonb language plpgsql security definer set search_path='' as $$declare n text;client jsonb;src jsonb;begin
 n:=client_financing_private.actor(t,a,false);select to_jsonb(x)into client from public.clients x where x.tenant_id=t and x.id=c for share;
 if client is null then raise exception using errcode='42501',message='Pflegefall fehlt oder ist nicht zugänglich.';end if;src:=client_financing_private.sources(t,c);
 return jsonb_build_object('version','2026-10-16.1','tenantId',t,'clientId',c,'actorId',a,'loadedAt',to_char(clock_timestamp()at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'client',client,'sources',jsonb_build_object('count',jsonb_array_length(src),'rows',src),'history',client_financing_private.history(t,c));
end$$;
create or replace function client_financing_private.commit_event(cmd jsonb)returns jsonb language plpgsql security definer set search_path='' as $$
declare t uuid:=(cmd->>'tenantId')::uuid;c uuid:=(cmd->>'clientId')::uuid;a uuid:=(cmd->>'actorId')::uuid;rid uuid:=(cmd->>'requestId')::uuid;eid uuid:=(cmd->>'eventId')::uuid;n text;root client_financing_private.roots%rowtype;e client_financing_private.events%rowtype;src jsonb;begin
 n:=client_financing_private.actor(t,a,true);perform 1 from public.clients x where x.tenant_id=t and x.id=c for share;if not found then raise exception using errcode='42501',message='Pflegefall fehlt.';end if;
 lock table public.client_contracts,public.client_documents,public.client_financing_paths,public.client_financing_approvals,public.client_tariff_positions,public.client_budget_entitlement_periods,public.client_cost_estimates,public.client_service_combination_rules,public.client_service_records,public.pfleger_service_proofs in share mode;
 insert into client_financing_private.roots(tenant_id,client_id)values(t,c)on conflict do nothing;select*into root from client_financing_private.roots r where r.tenant_id=t and r.client_id=c for update;
 select*into e from client_financing_private.events z where z.tenant_id=t and z.request_id=rid;if e.id is not null then if e.command is distinct from cmd then raise exception using errcode='23505',message='Anfragekennung gehört zu anderem Inhalt.';end if;return jsonb_build_object('version','2026-10-16.1','requestId',rid,'command',e.command,'event',client_financing_private.event_json(e));end if;
 src:=client_financing_private.sources(t,c);perform client_financing_private.validate_command(cmd,src);
 if(cmd->>'expectedHeadId')is distinct from root.head_id::text then raise exception using errcode='40001',message='Finanzierungsverlauf wurde geändert.';end if;
 if cmd->>'kind'='correction'and not exists(select 1 from client_financing_private.events x where x.tenant_id=t and x.client_id=c and x.id=(cmd#>>'{payload,targetId}')::uuid and x.kind<>'correction'and not exists(select 1 from client_financing_private.events z where z.tenant_id=t and z.client_id=c and z.kind='correction'and z.command#>>'{payload,targetId}'=x.id::text))then raise exception using errcode='23514',message='Nur ein vorhandenes unberichtigtes Original kann berichtigt werden.';end if;
 insert into client_financing_private.events(id,tenant_id,client_id,sequence,previous_id,request_id,actor_id,actor_name,occurred_at,kind,command)values(eid,t,c,coalesce((select max(sequence)+1 from client_financing_private.events where tenant_id=t and client_id=c),1),root.head_id,rid,a,n,(cmd->>'occurredAt')::timestamptz,cmd->>'kind',cmd)returning*into e;
 update client_financing_private.roots set head_id=eid,updated_at=clock_timestamp()where tenant_id=t and client_id=c;
 return jsonb_build_object('version','2026-10-16.1','requestId',rid,'command',cmd,'event',client_financing_private.event_json(e));
end$$;
create or replace function client_financing_private.confirm_event(t uuid,a uuid,c uuid,rid uuid,cmd jsonb)returns jsonb language plpgsql security definer set search_path='' as $$declare e client_financing_private.events%rowtype;begin
 perform client_financing_private.actor(t,a,false);select*into e from client_financing_private.events z where z.tenant_id=t and z.client_id=c and z.request_id=rid;
 if e.id is null or e.command is distinct from cmd or e.actor_id<>a then raise exception using errcode='P0P01',message='Passende native Quittung fehlt.';end if;
 return jsonb_build_object('version','2026-10-16.1','requestId',rid,'command',e.command,'event',client_financing_private.event_json(e));
end$$;

create or replace function public.web_client_financing_context(p_tenant_id uuid,p_client_id uuid,p_actor_id uuid)returns jsonb language sql security invoker set search_path='' as $$select client_financing_private.read_context(p_tenant_id,p_actor_id,p_client_id)$$;
create or replace function public.web_commit_client_financing_event(p_command jsonb)returns jsonb language sql security invoker set search_path='' as $$select client_financing_private.commit_event(p_command)$$;
create or replace function public.web_confirm_client_financing_event(p_tenant_id uuid,p_client_id uuid,p_actor_id uuid,p_request_id uuid,p_command jsonb)returns jsonb language sql security invoker set search_path='' as $$select client_financing_private.confirm_event(p_tenant_id,p_actor_id,p_client_id,p_request_id,p_command)$$;
revoke all on function public.web_client_financing_context(uuid,uuid,uuid),public.web_commit_client_financing_event(jsonb),public.web_confirm_client_financing_event(uuid,uuid,uuid,uuid,jsonb)from public,anon;
revoke all on all functions in schema client_financing_private from public,anon,authenticated;
grant usage on schema client_financing_private to authenticated;
grant execute on function client_financing_private.read_context(uuid,uuid,uuid),client_financing_private.commit_event(jsonb),client_financing_private.confirm_event(uuid,uuid,uuid,uuid,jsonb)to authenticated;
grant execute on function public.web_client_financing_context(uuid,uuid,uuid),public.web_commit_client_financing_event(jsonb),public.web_confirm_client_financing_event(uuid,uuid,uuid,uuid,jsonb)to authenticated;
commit;
