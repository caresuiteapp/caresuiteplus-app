-- Quarantined Staging preparation only; no production activation or API grants.
-- Supported: explicit unsigned narrative care_report + append-only correction.
-- Clinical performance, templates, control execution, external facts and signatures
-- remain blocked until their exact current native source/authority contract exists.
-- Existing native/Android writers remain unchanged for unrelated clinical rows.
create schema if not exists care_documentation_private;

create table if not exists care_documentation_private.versions(
 id uuid primary key,root_id uuid not null,previous_id uuid references care_documentation_private.versions(id) on delete restrict,
 request_id uuid not null unique,tenant_id uuid not null references public.tenants(id) on delete cascade,
 client_id uuid not null references public.clients(id) on delete restrict,actor_profile_id uuid not null references public.profiles(id) on delete restrict,
 revision integer not null check(revision>0),kind text not null check(kind in('care_report','planned_service','refusal','incident','structured_protocol','control','external')),
 occurred_at timestamptz not null,payload jsonb not null check(jsonb_typeof(payload)='object'),correction_reason text not null default '',
 content_fingerprint text not null,created_at timestamptz not null default clock_timestamp(),
 unique(root_id,revision),unique(id,tenant_id,client_id)
);
create table if not exists care_documentation_private.confirmations(
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique,version_id uuid not null unique references care_documentation_private.versions(id) on delete restrict,
 tenant_id uuid not null,client_id uuid not null,actor_profile_id uuid not null references public.profiles(id) on delete restrict,
 person_id uuid not null references public.profiles(id) on delete restrict,person_name text not null,confirming_role text not null,scope text not null,basis text not null,
 confirmed_at timestamptz not null,content_fingerprint text not null,created_at timestamptz not null default clock_timestamp(),
 foreign key(version_id,tenant_id,client_id) references care_documentation_private.versions(id,tenant_id,client_id) on delete restrict
);
create table if not exists care_documentation_private.requests(
 request_id uuid primary key,tenant_id uuid not null,client_id uuid not null,actor_profile_id uuid not null,action text not null,
 packet_original jsonb not null,version_id uuid not null references care_documentation_private.versions(id) on delete restrict,created_at timestamptz not null default clock_timestamp()
);
create index if not exists care_documentation_versions_page on care_documentation_private.versions(tenant_id,client_id,occurred_at desc,id desc);
alter table care_documentation_private.versions enable row level security;
alter table care_documentation_private.confirmations enable row level security;
alter table care_documentation_private.requests enable row level security;

create schema if not exists care_documentation_path_private;

create table if not exists care_documentation_path_private.roots(
 tenant_id uuid not null,client_id uuid not null,head_id uuid,updated_at timestamptz not null default clock_timestamp(),
 primary key(tenant_id,client_id));
create table if not exists care_documentation_path_private.events(
 id uuid primary key,tenant_id uuid not null,client_id uuid not null,sequence bigint not null,previous_id uuid,request_id uuid not null,
 actor_id uuid not null,actor_name text not null,occurred_at timestamptz not null,recorded_at timestamptz not null default clock_timestamp(),
 kind text not null,command jsonb not null,unique(tenant_id,client_id,sequence),unique(tenant_id,request_id));
alter table care_documentation_path_private.roots enable row level security;
alter table care_documentation_path_private.events enable row level security;

-- Hardened contracts follow.
alter table care_documentation_private.versions add column if not exists actor_name_snapshot text;
alter table care_documentation_private.versions add column if not exists native_original jsonb;
alter table care_documentation_private.versions add column if not exists auth_user_id uuid;
alter table care_documentation_private.requests add column if not exists original jsonb;
alter table care_documentation_private.requests add column if not exists auth_user_id uuid;
create unique index if not exists care_documentation_single_successor on care_documentation_private.versions(previous_id) where previous_id is not null;
create index if not exists care_documentation_versions_root_scope on care_documentation_private.versions(tenant_id,client_id,root_id,revision);
create index if not exists care_documentation_requests_scope on care_documentation_private.requests(tenant_id,client_id,request_id);

create or replace function care_documentation_private.fingerprint(v jsonb) returns text
language sql immutable strict set search_path='' as $$select 'sha256:'||encode(extensions.digest(convert_to(v::text,'UTF8'),'sha256'),'hex')$$;

create or replace function care_documentation_private.require_scope(t uuid,c uuid,a uuid,w boolean default false)
returns text language plpgsql security definer set search_path='' as $$
declare own_role uuid;own_role_key text;actor_name text;required text;required_keys text[]:=array['pflege.documentation.view'];
begin
 perform care_private.require_workspace_session(t,a);
 perform 1 from public.clients x where x.id=c and x.tenant_id=t and x.status::text in('active','aktiv') and x.lifecycle_status::text in('active','aktiv') and x.deleted_at is null and x.archived_at is null for share;
 if not found then raise exception 'Aktive eigene Pflegeakte fehlt.' using errcode='42501';end if;
 perform 1 from public.client_module_assignments x where x.tenant_id=t and x.client_id=c and x.module_key='pflege' and x.is_active and x.status in('active','aktiv') for share;
 if not found then raise exception 'Aktive eigene Pflegezuordnung fehlt.' using errcode='42501';end if;
 select p.role_id,r.key,nullif(p.display_name,'') into own_role,own_role_key,actor_name from public.profiles p join public.roles r on r.id=p.role_id where p.id=a and p.tenant_id=t and p.is_active and p.status='active' for share of p,r;
 if own_role is null or actor_name is null or btrim(actor_name)='' or length(actor_name)>500 then raise exception 'Das aktuelle eigene Profil und der ursprüngliche Name fehlen.' using errcode='42501';end if;
 lock table public.roles,public.role_permissions,public.role_permission_sets in share mode;
 if w then required_keys:=required_keys||array['pflege.documentation.create'];end if;
 foreach required in array required_keys loop
  if exists(select 1 from public.role_permission_sets rp where rp.tenant_id=t and rp.role_key=own_role_key) then
   if not exists(select 1 from public.role_permission_sets rp where rp.tenant_id=t and rp.role_key=own_role_key and rp.permission_key=required) then raise exception 'Aktuelles eigenes Dokumentationsrecht fehlt.' using errcode='42501';end if;
  elsif not exists(select 1 from public.role_permissions rp where rp.role_id=own_role and rp.permission_key=required) then raise exception 'Aktuelles eigenes Dokumentationsrecht fehlt.' using errcode='42501';end if;
 end loop;
 perform care_private.require_workspace_session(t,a);
 return actor_name;
end$$;

create or replace function care_documentation_private.entry_issue(e jsonb)
returns text language plpgsql immutable set search_path='' as $$
begin
 if not care_private.med_packet_keys(e,array['kind','title','occurredAt','observation','intervention','result','plannedService','refusal','incident','protocol','control','external'])
 or e->>'kind' is distinct from 'care_report' or not care_private.med_packet_text(e->'title',3,300)
 or not care_private.med_packet_text(e->'observation',1,8000) or not care_private.med_packet_text(e->'intervention',0,8000)
 or not care_private.med_packet_text(e->'result',0,8000)
 or e->'plannedService' is distinct from 'null'::jsonb or e->'refusal' is distinct from 'null'::jsonb
 or e->'incident' is distinct from 'null'::jsonb or e->'protocol' is distinct from 'null'::jsonb
 or e->'control' is distinct from 'null'::jsonb or e->'external' is distinct from 'null'::jsonb then return 'Das ausdrückliche unveränderte Berichtspaket ist unvollständig.';end if;
 perform care_private.med_packet_time(e->'occurredAt');return null;
exception when others then return 'Dokumentationswerte oder Originalzeitpunkt sind technisch ungültig.';
end$$;

create or replace function care_documentation_private.block_mutation() returns trigger
language plpgsql security definer set search_path='' as $$begin raise exception 'Dokumentationsoriginale und historische Quittungen sind unveränderlich.' using errcode='42501';end$$;
create or replace function care_documentation_private.guard_native_original() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from care_documentation_private.versions v where v.id=old.id) then
  raise exception 'Dieses gebundene native Dokumentationsoriginal bleibt unverändert; einen begründeten Nachtrag erstellen.' using errcode='42501';
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end$$;
drop trigger if exists care_documentation_bound_native_immutable on public.clinical_documentation_entries;
create trigger care_documentation_bound_native_immutable before update or delete on public.clinical_documentation_entries for each row execute function care_documentation_private.guard_native_original();
do $$declare tab text;begin
 foreach tab in array array['versions','confirmations','requests'] loop
  execute format('drop trigger if exists care_documentation_immutable on care_documentation_private.%I',tab);
  execute format('create trigger care_documentation_immutable before update or delete on care_documentation_private.%I for each row execute function care_documentation_private.block_mutation()',tab);
 end loop;
end$$;

create or replace function care_documentation_private.record_json(v care_documentation_private.versions)
returns jsonb language plpgsql security definer set search_path='' as $$
declare item care_documentation_private.versions%rowtype;prior_id uuid;history jsonb:='[]';native jsonb;signature jsonb;history_count integer:=0;
begin
 if v.id is null then return null;end if;
 for item in select x.* from care_documentation_private.versions x where x.tenant_id=v.tenant_id and x.client_id=v.client_id and x.root_id=v.root_id and x.revision<=v.revision order by x.revision loop
  history_count:=history_count+1;
  perform care_private.med_packet_require(item.revision=history_count and item.previous_id is not distinct from prior_id and(history_count<>1 or item.id=item.root_id) and item.actor_name_snapshot is not null and btrim(item.actor_name_snapshot)<>'' and item.native_original is not null,'Die gespeicherte ursprüngliche Dokumentationshistorie ist unvollständig.');
  select to_jsonb(d) into native from public.clinical_documentation_entries d where d.id=item.id and d.tenant_id=item.tenant_id and d.client_id=item.client_id;
  perform care_private.med_packet_require(native is not null and native is not distinct from item.native_original and item.content_fingerprint=care_documentation_private.fingerprint(item.payload),'Das genaue gebundene native Dokumentationsoriginal wurde verändert.');
  history:=history||jsonb_build_array(jsonb_build_object('id',item.id,'revision',item.revision,'previousId',item.previous_id,'occurredAt',item.payload->>'occurredAt','recordedAt',to_char(item.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'recordedBy',item.actor_profile_id,'recordedByName',item.actor_name_snapshot,'payload',item.payload,'correctionReason',item.correction_reason,'contentFingerprint',item.content_fingerprint));prior_id:=item.id;
 end loop;
 perform care_private.med_packet_require(history_count=v.revision and prior_id=v.id,'Die ursprüngliche Dokumentationsfassung ist abgeschnitten.');
 select jsonb_build_object('personId',x.person_id,'personName',x.person_name,'role',x.confirming_role,'scope',x.scope,'basis',x.basis,'confirmedAt',to_char(x.confirmed_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'contentFingerprint',x.content_fingerprint) into signature from care_documentation_private.confirmations x where x.version_id=v.id;
 return jsonb_build_object('id',v.id,'tenantId',v.tenant_id,'clientId',v.client_id,'rootId',v.root_id,'headId',v.id,'revision',v.revision,'kind',v.kind,'recordedAt',to_char(v.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'occurredAt',v.payload->>'occurredAt','createdAt',to_char(v.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'recordedBy',v.actor_profile_id,'recordedByName',v.actor_name_snapshot,'payload',v.payload,'signature',signature,'contentFingerprint',v.content_fingerprint,'history',history,'voided',false);
end$$;

create or replace function care_documentation_private.current_version(p_tenant uuid,p_client uuid,p_any_id uuid)
returns care_documentation_private.versions language sql security definer set search_path='' as $$
 select h from care_documentation_private.versions seed join care_documentation_private.versions h on h.root_id=seed.root_id and h.tenant_id=seed.tenant_id and h.client_id=seed.client_id
 where seed.tenant_id=p_tenant and seed.client_id=p_client and seed.id=p_any_id and not exists(select 1 from care_documentation_private.versions n where n.tenant_id=h.tenant_id and n.client_id=h.client_id and n.previous_id=h.id)
$$;

create or replace function care_documentation_private.state_fingerprint(t uuid,c uuid) returns text
language sql security definer set search_path='' as $$
 select care_documentation_private.fingerprint(jsonb_build_object(
 'client',(select to_jsonb(x) from public.clients x where x.tenant_id=t and x.id=c),
 'assignments',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from public.client_module_assignments x where x.tenant_id=t and x.client_id=c),'[]'::jsonb),
 'native',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from public.clinical_documentation_entries x where x.tenant_id=t and x.client_id=c),'[]'::jsonb),
 'versions',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from care_documentation_private.versions x where x.tenant_id=t and x.client_id=c),'[]'::jsonb),
 'requests',coalesce((select jsonb_agg(to_jsonb(x) order by x.request_id) from care_documentation_private.requests x where x.tenant_id=t and x.client_id=c),'[]'::jsonb),
 'confirmations',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from care_documentation_private.confirmations x where x.tenant_id=t and x.client_id=c),'[]'::jsonb),
 'pathRoots',coalesce((select jsonb_agg(to_jsonb(x) order by x.tenant_id,x.client_id) from care_documentation_path_private.roots x where x.tenant_id=t and x.client_id=c),'[]'::jsonb),
 'pathEvents',coalesce((select jsonb_agg(to_jsonb(x) order by x.sequence) from care_documentation_path_private.events x where x.tenant_id=t and x.client_id=c),'[]'::jsonb),
 'people',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from public.profiles x where x.tenant_id=t),'[]'::jsonb)))
$$;

create or replace function care_documentation_private.read_page(p_tenant uuid,p_client uuid,p_actor uuid,p_cursor_at timestamptz,p_cursor_id uuid,p_size integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare rows jsonb;at_value timestamptz;id_value uuid;before_state text;after_state text;
begin
 perform care_documentation_private.require_scope(p_tenant,p_client,p_actor,false);
 perform pg_advisory_xact_lock(hashtextextended('care-documentation:'||p_tenant||':'||p_client,0));
 perform care_documentation_private.require_scope(p_tenant,p_client,p_actor,false);
 if p_size is null or p_size<1 or p_size>100 or(p_cursor_at is null)<>(p_cursor_id is null) then raise exception 'Ungültige Seitengröße oder Cursorbindung.' using errcode='22023';end if;
 lock table public.clinical_documentation_entries,care_documentation_private.versions,care_documentation_private.requests,care_documentation_private.confirmations,care_documentation_path_private.events in share mode;
 if p_cursor_id is not null and not exists(select 1 from care_documentation_private.versions v where v.tenant_id=p_tenant and v.client_id=p_client and v.id=p_cursor_id and v.occurred_at=p_cursor_at and not exists(select 1 from care_documentation_private.versions n where n.previous_id=v.id)) then raise exception 'Der eigene aktuelle Cursor wurde ersetzt oder ist fremd.' using errcode='40001';end if;
 before_state:=care_documentation_private.state_fingerprint(p_tenant,p_client);
 with page as materialized(select v.* from care_documentation_private.versions v where v.tenant_id=p_tenant and v.client_id=p_client and not exists(select 1 from care_documentation_private.versions n where n.previous_id=v.id) and(p_cursor_at is null or(v.occurred_at,v.id)<(p_cursor_at,p_cursor_id)) order by v.occurred_at desc,v.id desc limit p_size)
 select coalesce(jsonb_agg(care_documentation_private.record_json(x::care_documentation_private.versions) order by x.occurred_at desc,x.id desc),'[]'::jsonb),(array_agg(x.occurred_at order by x.occurred_at,x.id))[1],(array_agg(x.id order by x.occurred_at,x.id))[1] into rows,at_value,id_value from page x;
 perform care_documentation_private.require_scope(p_tenant,p_client,p_actor,false);after_state:=care_documentation_private.state_fingerprint(p_tenant,p_client);
 perform care_private.med_packet_require(before_state=after_state,'Der vollständige Dokumentations- oder native Quellenstand wurde während des Lesens geändert.');
 return jsonb_build_object('rows',rows,'nextCursorOccurredAt',case when at_value is null then null else to_char(at_value at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') end,'nextCursorId',id_value,'stateFingerprint',after_state);
end$$;

create or replace function care_documentation_private.read_record(p_tenant uuid,p_client uuid,p_actor uuid,p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v care_documentation_private.versions%rowtype;result jsonb;before_state text;
begin
 perform care_documentation_private.require_scope(p_tenant,p_client,p_actor,false);
 perform pg_advisory_xact_lock(hashtextextended('care-documentation:'||p_tenant||':'||p_client,0));
 perform care_documentation_private.require_scope(p_tenant,p_client,p_actor,false);
 before_state:=care_documentation_private.state_fingerprint(p_tenant,p_client);v:=care_documentation_private.current_version(p_tenant,p_client,p_id);
 if v.id is null then raise exception 'Eigenes Dokumentationsoriginal fehlt.' using errcode='P0E01';end if;
 result:=care_documentation_private.record_json(v);perform care_documentation_private.require_scope(p_tenant,p_client,p_actor,false);
 perform care_private.med_packet_require(before_state=care_documentation_private.state_fingerprint(p_tenant,p_client),'Dokumentationsbestand während des Lesens geändert.');return result;
end$$;

create or replace function care_documentation_private.commit_packet(packet jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare tenant_value uuid:=(packet->>'tenantId')::uuid;client_value uuid:=(packet->>'clientId')::uuid;actor_value uuid:=(packet->>'actorId')::uuid;request_value uuid:=(packet->>'requestId')::uuid;action_value text:=packet->>'action';entry_value jsonb:=packet->'entry';prior care_documentation_private.requests%rowtype;head care_documentation_private.versions%rowtype;next_value care_documentation_private.versions%rowtype;actor_name text;native_value jsonb;original_value jsonb;
begin
 actor_name:=care_documentation_private.require_scope(tenant_value,client_value,actor_value,true);
 perform care_private.med_packet_require(care_private.med_packet_keys(packet,array['schemaVersion','action','requestId','tenantId','clientId','actorId','expectedHeadId','expectedRevision','entry','correctionReason','confirmation','original']) and packet->'schemaVersion'='"1"'::jsonb and action_value in('create','correct','confirm') and care_private.med_packet_uuid(packet->'requestId') and jsonb_typeof(packet->'expectedRevision')='number' and packet->>'expectedRevision' ~ '^(0|[1-9][0-9]{0,3})$' and(packet->>'expectedRevision')::integer<2000,'Die vollständige eigene Dokumentationsanfrage fehlt.');
 perform pg_advisory_xact_lock(hashtextextended('care-documentation-request:'||tenant_value||':'||request_value,0));
 perform pg_advisory_xact_lock(hashtextextended('care-documentation:'||tenant_value||':'||client_value,0));
 actor_name:=care_documentation_private.require_scope(tenant_value,client_value,actor_value,true);
 select * into prior from care_documentation_private.requests r where r.request_id=request_value for share;
 if prior.request_id is not null then
  perform care_private.med_packet_require(prior.tenant_id=tenant_value and prior.client_id=client_value and prior.actor_profile_id=actor_value and prior.auth_user_id=auth.uid() and prior.packet_original is not distinct from packet and prior.original is not null,'Anfragekennung, ursprüngliches Konto oder historischer eigener Beleg wurde verändert.');
  return jsonb_build_object('requestId',request_value,'packet',prior.packet_original,'original',prior.original);
 end if;
 if action_value='confirm' or entry_value->>'kind' is distinct from 'care_report' then raise exception 'Plan-, Durchführungs-, Vorlagen-, Kontroll-, Fremd- und Identitätsbelege fehlen für diesen Ablauf; Freigabe und Bestätigung bleiben gesperrt.' using errcode='42501';end if;
 perform care_private.med_packet_require(care_documentation_private.entry_issue(entry_value) is null and packet->'confirmation'='null'::jsonb,'Das ursprüngliche reine Berichtspaket ist unvollständig oder enthält eine Bestätigung.');
 perform care_private.med_packet_require(care_private.med_packet_time(entry_value->'occurredAt')<=clock_timestamp(),'Ein tatsächlicher Bericht darf keinen zukünftigen Ereigniszeitpunkt behaupten.');
 if action_value='create' then
  perform care_private.med_packet_require(packet->'original'='null'::jsonb and packet->'expectedHeadId'='null'::jsonb and packet->'expectedRevision'='0'::jsonb and packet->'correctionReason'='""'::jsonb,'Neuanlage enthält ein erfundenes Original, eine Bestätigung oder einen Nachtrag.');
  next_value.id:=gen_random_uuid();next_value.root_id:=next_value.id;next_value.revision:=1;
 else
  perform care_private.med_packet_require(care_private.med_packet_uuid(packet->'expectedHeadId') and care_private.med_packet_text(packet->'correctionReason',10,2000),'Ein vollständiger Nachtrag mit Originalkopf und konkretem Grund fehlt.');
  head:=care_documentation_private.current_version(tenant_value,client_value,(packet->>'expectedHeadId')::uuid);
  if head.id is null or head.id is distinct from(packet->>'expectedHeadId')::uuid or head.revision is distinct from(packet->>'expectedRevision')::integer or care_documentation_private.record_json(head) is distinct from packet->'original' then raise exception 'Der aktuelle unveränderte Dokumentationskopf wurde geändert.' using errcode='40001';end if;
  perform care_private.med_packet_require(head.kind='care_report' and head.payload is distinct from entry_value,'Nachtrag benötigt dieselbe Vorgangsart und eine tatsächliche Änderung.');
  next_value.id:=gen_random_uuid();next_value.root_id:=head.root_id;next_value.previous_id:=head.id;next_value.revision:=head.revision+1;
 end if;
 actor_name:=care_documentation_private.require_scope(tenant_value,client_value,actor_value,true);perform care_private.require_workspace_session(tenant_value,actor_value);
 insert into public.clinical_documentation_entries(id,tenant_id,client_id,entry_type,title,content,observations,interventions,result,deviation,escalation,recorded_at,recorded_by,recorded_by_name,signature_status,correction_of_id,correction_reason)
 values(next_value.id,tenant_value,client_value,'care_report',entry_value->>'title',entry_value->>'observation',entry_value->>'observation',entry_value->>'intervention',entry_value->>'result','','',care_private.med_packet_time(entry_value->'occurredAt'),actor_value,actor_name,'unsigned',next_value.previous_id,case when action_value='correct' then packet->>'correctionReason' else '' end);
 select to_jsonb(d) into native_value from public.clinical_documentation_entries d where d.id=next_value.id and d.tenant_id=tenant_value and d.client_id=client_value;
 insert into care_documentation_private.versions(id,root_id,previous_id,request_id,tenant_id,client_id,actor_profile_id,revision,kind,occurred_at,payload,correction_reason,content_fingerprint,actor_name_snapshot,native_original,auth_user_id)
 values(next_value.id,next_value.root_id,next_value.previous_id,request_value,tenant_value,client_value,actor_value,next_value.revision,'care_report',care_private.med_packet_time(entry_value->'occurredAt'),entry_value,case when action_value='correct' then packet->>'correctionReason' else '' end,care_documentation_private.fingerprint(entry_value),actor_name,native_value,auth.uid()) returning * into next_value;
 original_value:=care_documentation_private.record_json(next_value);
 insert into care_documentation_private.requests(request_id,tenant_id,client_id,actor_profile_id,action,packet_original,version_id,original,auth_user_id) values(request_value,tenant_value,client_value,actor_value,action_value,packet,next_value.id,original_value,auth.uid());
 return jsonb_build_object('requestId',request_value,'packet',packet,'original',original_value);
end$$;

create or replace function care_documentation_private.confirm_packet(p_tenant uuid,p_client uuid,p_actor uuid,p_request uuid,p_packet jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r care_documentation_private.requests%rowtype;
begin
 perform care_documentation_private.require_scope(p_tenant,p_client,p_actor,false);
 select * into r from care_documentation_private.requests x where x.request_id=p_request and x.tenant_id=p_tenant and x.client_id=p_client and x.actor_profile_id=p_actor and x.auth_user_id=auth.uid();
 if r.request_id is null or r.original is null or r.packet_original is distinct from p_packet then raise exception 'Passende unveränderte native Quittung fehlt.' using errcode='P0E02';end if;
 perform care_documentation_private.require_scope(p_tenant,p_client,p_actor,false);
 return jsonb_build_object('requestId',r.request_id,'packet',r.packet_original,'original',r.original);
end$$;

create or replace function public.web_read_care_documentation_page(p_tenant_id uuid,p_client_id uuid,p_actor_profile_id uuid,p_cursor_occurred_at timestamptz,p_cursor_id uuid,p_page_size integer)
returns jsonb language sql security invoker set search_path='' as $$select care_documentation_private.read_page(p_tenant_id,p_client_id,p_actor_profile_id,p_cursor_occurred_at,p_cursor_id,p_page_size)$$;
create or replace function public.web_read_care_documentation_record(p_tenant_id uuid,p_client_id uuid,p_actor_profile_id uuid,p_entry_id uuid)
returns jsonb language sql security invoker set search_path='' as $$select care_documentation_private.read_record(p_tenant_id,p_client_id,p_actor_profile_id,p_entry_id)$$;
create or replace function public.web_commit_care_documentation_packet(p_packet jsonb)
returns jsonb language sql security invoker set search_path='' as $$select care_documentation_private.commit_packet(p_packet)$$;
create or replace function public.web_confirm_care_documentation_packet(p_tenant_id uuid,p_client_id uuid,p_actor_profile_id uuid,p_request_id uuid,p_packet jsonb)
returns jsonb language sql security invoker set search_path='' as $$select care_documentation_private.confirm_packet(p_tenant_id,p_client_id,p_actor_profile_id,p_request_id,p_packet)$$;

-- The installed path ledger is preserved without inventing historical Auth
-- ownership. Its old
-- operations cannot establish a native plan execution, qualified approval,
-- representative identity or actual control result and remain write-blocked.
create or replace function care_documentation_path_private.immutable() returns trigger
language plpgsql security definer set search_path='' as $$begin raise exception 'Dokumentationspfadoriginale bleiben unverändert.' using errcode='42501';end$$;
drop trigger if exists care_documentation_path_roots_delete on care_documentation_path_private.roots;
create trigger care_documentation_path_roots_delete before delete on care_documentation_path_private.roots for each row execute function care_documentation_path_private.immutable();
drop trigger if exists care_documentation_path_events_immutable on care_documentation_path_private.events;
create trigger care_documentation_path_events_immutable before update or delete on care_documentation_path_private.events for each row execute function care_documentation_path_private.immutable();

create or replace function care_documentation_path_private.event_json(e care_documentation_path_private.events)
returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('id',e.id,'sequence',e.sequence,'previousId',e.previous_id,'tenantId',e.tenant_id,'clientId',e.client_id,'actorId',e.actor_id,'actorName',e.actor_name,'recordedAt',to_char(e.recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'command',e.command)
$$;
create or replace function care_documentation_path_private.history(t uuid,c uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e care_documentation_path_private.events%rowtype;head uuid;previous_id uuid;history_count bigint:=0;rows jsonb:='[]';
begin
 select r.head_id into head from care_documentation_path_private.roots r where r.tenant_id=t and r.client_id=c;
 for e in select x.* from care_documentation_path_private.events x where x.tenant_id=t and x.client_id=c order by x.sequence loop
  history_count:=history_count+1;
  perform care_private.med_packet_require(e.sequence=history_count and e.previous_id is not distinct from previous_id and e.command->>'eventId'=e.id::text and e.command->>'requestId'=e.request_id::text and e.command->>'tenantId'=t::text and e.command->>'clientId'=c::text and e.command->>'actorId'=e.actor_id::text and(e.command->>'expectedHeadId') is not distinct from previous_id::text,'Der ursprüngliche Dokumentationspfad ist unvollständig oder fremd.');
  rows:=rows||jsonb_build_array(care_documentation_path_private.event_json(e));previous_id:=e.id;
 end loop;
 perform care_private.med_packet_require(head is not distinct from previous_id,'Der ursprüngliche Dokumentationspfadkopf ist abgeschnitten.');
 return jsonb_build_object('version','2026-10-16.5','tenantId',t,'clientId',c,'count',history_count,'headId',head,'events',rows);
end$$;

create or replace function care_documentation_path_private.sources(t uuid,c uuid)
returns jsonb language sql security definer set search_path='' as $$
 with source_rows as(
  select 'client_record'::text kind,x.id,jsonb_build_object('id',x.id,'tenant_id',x.tenant_id,'first_name',x.first_name,'last_name',x.last_name,'status',x.status,'lifecycle_status',x.lifecycle_status) snapshot from public.clients x where x.tenant_id=t and x.id=c
  union all select 'care_documentation',x.id,to_jsonb(x) from public.clinical_documentation_entries x where x.tenant_id=t and x.client_id=c
  union all select 'care_documentation_path_event',x.id,care_documentation_path_private.event_json(x)||jsonb_build_object('client_id',c) from care_documentation_path_private.events x where x.tenant_id=t and x.client_id=c
 )
 select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'id',id,'snapshot',snapshot) order by kind,id),'[]'::jsonb) from source_rows
$$;

create or replace function care_documentation_path_private.read_context(t uuid,a uuid,c uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare src jsonb;history_value jsonb;before_state text;after_state text;
begin
 perform care_documentation_private.require_scope(t,c,a,false);
 perform pg_advisory_xact_lock(hashtextextended('care-documentation:'||t||':'||c,0));
 perform care_documentation_private.require_scope(t,c,a,false);
 before_state:=care_documentation_private.state_fingerprint(t,c);
 src:=care_documentation_path_private.sources(t,c);history_value:=care_documentation_path_private.history(t,c);
 perform care_documentation_private.require_scope(t,c,a,false);after_state:=care_documentation_private.state_fingerprint(t,c);
 perform care_private.med_packet_require(before_state=after_state,'Der vollständige native Dokumentations- und Pfadstand wurde während des Lesens geändert.');
 return jsonb_build_object('version','2026-10-16.5','tenantId',t,'clientId',c,'actorId',a,'loadedAt',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'sources',jsonb_build_object('count',jsonb_array_length(src),'rows',src,'stateFingerprint',after_state),'history',history_value);
end$$;

create or replace function care_documentation_path_private.commit_event(cmd jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform care_documentation_private.require_scope((cmd->>'tenantId')::uuid,(cmd->>'clientId')::uuid,(cmd->>'actorId')::uuid,true);
 raise exception 'Dieser getrennte Dokumentationspfad ist bis zum genauen nativen Plan-, Durchführungs-, Identitäts- und Qualifikationsnachweis schreibgesperrt. Berichte ohne Bestätigung verwenden das gebundene Berichtspaket.' using errcode='42501';
end$$;

create or replace function care_documentation_path_private.confirm_event(t uuid,a uuid,c uuid,rid uuid,cmd jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform care_documentation_private.require_scope(t,c,a,false);
 raise exception 'Für diesen älteren Pfad fehlt der unveränderte Beleg des ursprünglich authentifizierten Kontos. Die Quittungsbestätigung bleibt gesperrt; ursprüngliche Daten bleiben erhalten.' using errcode='42501';
end$$;

create or replace function public.web_care_documentation_path_workspace_context(p_tenant_id uuid,p_client_id uuid,p_actor_id uuid)
returns jsonb language sql security invoker set search_path='' as $$select care_documentation_path_private.read_context(p_tenant_id,p_actor_id,p_client_id)$$;
create or replace function public.web_commit_care_documentation_path_event(p_command jsonb)
returns jsonb language sql security invoker set search_path='' as $$select care_documentation_path_private.commit_event(p_command)$$;
create or replace function public.web_confirm_care_documentation_path_event(p_tenant_id uuid,p_client_id uuid,p_actor_id uuid,p_request_id uuid,p_command jsonb)
returns jsonb language sql security invoker set search_path='' as $$select care_documentation_path_private.confirm_event(p_tenant_id,p_actor_id,p_client_id,p_request_id,p_command)$$;

-- Exact family scope only: includes the three formerly authenticated path APIs.
-- No schema-wide ACL or unrelated native/shared writer is changed.
revoke all on care_documentation_private.versions,care_documentation_private.requests,care_documentation_private.confirmations,care_documentation_path_private.roots,care_documentation_path_private.events from public,anon,authenticated,service_role;
do $$declare entry record;begin
 for entry in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where
 (n.nspname='care_documentation_private' and p.proname in('authorize','require_scope','entry_issue','record_json','current_version','read_page','read_record','commit_packet','confirm_packet','fingerprint','state_fingerprint','block_mutation','guard_native_original'))
 or(n.nspname='care_documentation_path_private' and p.proname in('immutable','profile_has','kind_right','actor','event_json','history','sources','walk_sources','payload_keys','validate_command','read_context','commit_event','confirm_event'))
 or(n.nspname='public' and p.proname in('web_read_care_documentation_page','web_read_care_documentation_record','web_commit_care_documentation_packet','web_confirm_care_documentation_packet','web_care_documentation_path_workspace_context','web_commit_care_documentation_path_event','web_confirm_care_documentation_path_event'))
 loop execute format('revoke all on function %s from public,anon,authenticated,service_role',entry.oid::regprocedure);end loop;
end$$;
