-- Prepared only; not applied. One append-only Web contract for E-01..E-10.
-- Legacy/native writers remain untouched until this patch is proven in an allowed test project.
begin;
create schema if not exists care_documentation_private;
revoke all on schema care_documentation_private from public,anon,authenticated;

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
revoke all on all tables in schema care_documentation_private from public,anon,authenticated;

create or replace function care_documentation_private.authorize(p_tenant uuid,p_actor uuid,p_write boolean,p_confirm boolean default false)
returns uuid language plpgsql security definer set search_path='' as $$
declare sid uuid:=nullif(auth.jwt()->>'session_id','')::uuid;profile public.profiles%rowtype;
begin
 if auth.uid() is null or sid is null or coalesce((auth.jwt()->>'exp')::bigint,0)<=extract(epoch from clock_timestamp())
  or not exists(select 1 from auth.sessions s where s.id=sid and s.user_id=auth.uid()) then raise exception using errcode='42501',message='Aktuelle Sitzung fehlt.';end if;
 select * into profile from public.profiles p where p.id=p_actor and p.tenant_id=p_tenant and p.id=auth.uid() and coalesce(p.is_active,true);
 if not found or p_tenant is distinct from public.current_tenant_id() or not public.has_permission('pflege.documentation.view')
  or p_write and not public.has_permission(case when p_confirm then 'pflege.documentation.sign' else 'pflege.documentation.create' end)
 then raise exception using errcode='42501',message='Aktuelle Dokumentationsberechtigung fehlt.';end if;
 return sid;
end $$;

create or replace function care_documentation_private.entry_issue(e jsonb) returns text language plpgsql immutable set search_path='' as $$
declare k text:=e->>'kind';d jsonb;
begin
 if jsonb_typeof(e)<>'object' or k not in('care_report','planned_service','refusal','incident','structured_protocol','control','external')
  or length(btrim(coalesce(e->>'title',''))) not between 3 and 300 or nullif(e->>'occurredAt','')::timestamptz is null
  or length(btrim(coalesce(e->>'observation',''))) not between 1 and 8000
 then return 'Grundangaben fehlen.';end if;
 if k='planned_service' then d:=e->'plannedService';if jsonb_typeof(d)<>'object' or nullif(d->>'planVersionId','')::uuid is null or nullif(d->>'visitId','')::uuid is null or d->>'outcome' not in('performed','partial','not_performed') or d->>'outcome'<>'performed' and(length(btrim(coalesce(d->>'reason','')))<3 or length(btrim(coalesce(d->>'reaction','')))<3) then return 'Leistungsbezug fehlt.';end if;
 elsif k='refusal' then d:=e->'refusal';if jsonb_typeof(d)<>'object' or length(btrim(coalesce(d->>'measure','')))<3 or length(btrim(coalesce(d->>'statedReason','')))<1 or length(btrim(coalesce(d->>'consultation','')))<3 or length(btrim(coalesce(d->>'followUp','')))<3 or coalesce(e->>'result','')~*'durchgeführt|erbracht|erfolgreich' then return 'Ablehnung ist unvollständig oder positiv umgedeutet.';end if;
 elsif k='incident' then d:=e->'incident';if jsonb_typeof(d)<>'object' or length(btrim(coalesce(d->>'incidentType','')))<3 or length(btrim(coalesce(d->>'people','')))<3 or length(btrim(coalesce(d->>'measures','')))<3 or length(btrim(coalesce(d->>'forwardedTo','')))<1 or d->>'closureState' not in('open','closed') or d->>'closureState'='closed' and length(btrim(coalesce(d->>'closureEvidence','')))<3 then return 'Ereignisverlauf ist unvollständig.';end if;
 elsif k='structured_protocol' then d:=e->'protocol';if jsonb_typeof(d)<>'object' or length(btrim(coalesce(d->>'protocolType','')))<3 or length(btrim(coalesce(d->>'specialistVersion','')))<1 or jsonb_typeof(d->'fields')<>'array' or jsonb_array_length(d->'fields') not between 1 and 100 or exists(select 1 from jsonb_array_elements(d->'fields') f where length(btrim(coalesce(f->>'key','')))<1 or length(btrim(coalesce(f->>'label','')))<1 or length(btrim(coalesce(f->>'value','')))<1) then return 'Protokollfelder fehlen.';end if;
 elsif k='control' then d:=e->'control';if jsonb_typeof(d)<>'object' or length(btrim(coalesce(d->>'cause','')))<3 or length(btrim(coalesce(d->>'frequency','')))<1 or length(btrim(coalesce(d->>'responsible','')))<1 or nullif(d->>'dueAt','')::timestamptz is null or d->>'resultState' not in('pending','documented','not_performed') or d->>'resultState'='documented' and length(btrim(coalesce(d->>'result','')))<1 or d->>'resultState'='not_performed' and length(btrim(coalesce(d->>'nonPerformanceReason','')))<3 then return 'Kontrollauftrag oder Ergebnis fehlt.';end if;
 elsif k='external' then d:=e->'external';if jsonb_typeof(d)<>'object' or length(btrim(coalesce(d->>'source','')))<3 or length(btrim(coalesce(d->>'author','')))<1 or nullif(d->>'receivedAt','')::timestamptz is null or nullif(d->>'eventAt','')::timestamptz is null or length(btrim(coalesce(d->>'review','')))<3 or coalesce(e->>'result','')~*'selbst durchgeführt' then return 'Fremddokumentation ist unvollständig oder als Eigenleistung umgedeutet.';end if;end if;
 return null;
exception when others then return 'Dokumentationswerte sind technisch ungültig.';end $$;

create or replace function care_documentation_private.record_json(v care_documentation_private.versions)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare h jsonb;c care_documentation_private.confirmations%rowtype;history jsonb;
begin
 select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'revision',x.revision,'previousId',x.previous_id,'occurredAt',x.occurred_at,'recordedAt',x.created_at,'recordedBy',x.actor_profile_id,'recordedByName',coalesce(p.display_name,p.email,'Unbekannt'),'payload',x.payload,'correctionReason',x.correction_reason,'contentFingerprint',x.content_fingerprint) order by x.revision),'[]'::jsonb) into history from care_documentation_private.versions x left join public.profiles p on p.id=x.actor_profile_id where x.root_id=v.root_id;
 select * into c from care_documentation_private.confirmations x where x.version_id=v.id;
 h:=jsonb_build_object('id',v.id,'tenantId',v.tenant_id,'clientId',v.client_id,'rootId',v.root_id,'headId',v.id,'revision',v.revision,'kind',v.kind,'recordedAt',v.created_at,'occurredAt',v.occurred_at,'createdAt',v.created_at,'recordedBy',v.actor_profile_id,'recordedByName',coalesce((select coalesce(p.display_name,p.email,'Unbekannt') from public.profiles p where p.id=v.actor_profile_id),'Unbekannt'),'payload',v.payload,'contentFingerprint',v.content_fingerprint,'history',history,'voided',false,'signature',case when c.id is null then null else jsonb_build_object('personId',c.person_id,'personName',c.person_name,'role',c.confirming_role,'scope',c.scope,'basis',c.basis,'confirmedAt',c.confirmed_at,'contentFingerprint',c.content_fingerprint) end);
 return h;
end $$;

create or replace function care_documentation_private.current_version(p_tenant uuid,p_client uuid,p_any_id uuid)
returns care_documentation_private.versions language sql security definer set search_path='' stable as $$
 select h from care_documentation_private.versions seed join care_documentation_private.versions h on h.root_id=seed.root_id
 where seed.tenant_id=$1 and seed.client_id=$2 and seed.id=$3 and not exists(select 1 from care_documentation_private.versions n where n.previous_id=h.id)
$$;

create or replace function care_documentation_private.read_page(p_tenant uuid,p_client uuid,p_actor uuid,p_cursor_at timestamptz,p_cursor_id uuid,p_size integer)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare rows jsonb;
begin
 perform care_documentation_private.authorize(p_tenant,p_actor,false);
 if p_size not between 1 and 100 or not exists(select 1 from public.clients c where c.tenant_id=p_tenant and c.id=p_client) then raise exception using errcode='P0E01',message='Pflegefall oder Seitengröße ungültig.';end if;
 select coalesce(jsonb_agg(care_documentation_private.record_json(q) order by q.occurred_at desc,q.id desc),'[]'::jsonb) into rows from(select v.* from care_documentation_private.versions v where v.tenant_id=p_tenant and v.client_id=p_client and not exists(select 1 from care_documentation_private.versions n where n.previous_id=v.id) and(p_cursor_at is null or(v.occurred_at,v.id)<(p_cursor_at,p_cursor_id)) order by v.occurred_at desc,v.id desc limit p_size)q;
 return jsonb_build_object('rows',rows);
end $$;
create or replace function care_documentation_private.read_record(p_tenant uuid,p_client uuid,p_actor uuid,p_id uuid) returns jsonb language plpgsql security definer set search_path='' stable as $$
declare v care_documentation_private.versions%rowtype;begin perform care_documentation_private.authorize(p_tenant,p_actor,false);v:=care_documentation_private.current_version(p_tenant,p_client,p_id);if v.id is null then raise exception using errcode='P0E01',message='Dokumentationsoriginal fehlt.';end if;return care_documentation_private.record_json(v);end $$;

create or replace function care_documentation_private.commit_packet(packet jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare tenant uuid:=(packet->>'tenantId')::uuid;client uuid:=(packet->>'clientId')::uuid;actor uuid:=(packet->>'actorId')::uuid;request uuid:=(packet->>'requestId')::uuid;action text:=packet->>'action';entry jsonb:=packet->'entry';original jsonb:=packet->'original';prior care_documentation_private.requests%rowtype;head care_documentation_private.versions%rowtype;next care_documentation_private.versions%rowtype;mapping text;fingerprint text;confirmation jsonb:=packet->'confirmation';
begin
 if packet->>'schemaVersion'<>'1' or action not in('create','correct','confirm') or request is null or tenant is null or client is null or actor is null then raise exception using errcode='22023',message='Dokumentationsanfrage ungültig.';end if;
 perform care_documentation_private.authorize(tenant,actor,true,action='confirm');
 perform pg_advisory_xact_lock(hashtextextended('care-documentation:'||tenant::text||':'||client::text,0));perform care_documentation_private.authorize(tenant,actor,true,action='confirm');
 select * into prior from care_documentation_private.requests r where r.request_id=request for update;if found then if prior.tenant_id<>tenant or prior.client_id<>client or prior.actor_profile_id<>actor or prior.packet_original<>packet then raise exception using errcode='23514',message='Anfragekennung gehört zu einem anderen Original.';end if;select * into next from care_documentation_private.versions where id=prior.version_id;return jsonb_build_object('requestId',request,'packet',packet,'original',care_documentation_private.record_json(next));end if;
 if not exists(select 1 from public.clients c where c.id=client and c.tenant_id=tenant and lower(c.status::text) not in('deleted','archived','deceased')) then raise exception using errcode='P0E01',message='Aktiver eigener Pflegefall fehlt.';end if;
 if action='create' then
  if packet->'original' is not null or packet->>'expectedHeadId' is not null or (packet->>'expectedRevision')::integer<>0 or care_documentation_private.entry_issue(entry) is not null then raise exception using errcode='23514',message='Neue Dokumentation ist unvollständig.';end if;
  next.id:=gen_random_uuid();next.root_id:=next.id;next.previous_id:=null;next.revision:=1;
 else
  head:=care_documentation_private.current_version(tenant,client,(packet->>'expectedHeadId')::uuid);
  if head.id is null or head.id<>(packet->>'expectedHeadId')::uuid or head.revision<>(packet->>'expectedRevision')::integer or care_documentation_private.record_json(head)<>original then raise exception using errcode='40001',message='Dokumentationsoriginal wurde geändert. Vollständig neu laden.';end if;
  if action='correct' then if care_documentation_private.entry_issue(entry) is not null or entry->>'kind'<>head.kind or length(btrim(coalesce(packet->>'correctionReason',''))) not between 10 and 2000 or entry=head.payload or packet->'confirmation' is not null then raise exception using errcode='23514',message='Nachtrag ist unvollständig oder verändert die Dokumentationsart.';end if;next.id:=gen_random_uuid();next.root_id:=head.root_id;next.previous_id:=head.id;next.revision:=head.revision+1;
  else
   if packet->'entry' is not null or coalesce(packet->>'correctionReason','')<>'' or jsonb_typeof(confirmation)<>'object' or confirmation->>'contentFingerprint'<>head.content_fingerprint or (confirmation->>'personId')::uuid<>actor or length(btrim(coalesce(confirmation->>'personName',''))) not between 2 and 300 or length(btrim(coalesce(confirmation->>'role',''))) not between 2 and 300 or length(btrim(coalesce(confirmation->>'scope',''))) not between 3 and 2000 or length(btrim(coalesce(confirmation->>'basis',''))) not between 3 and 2000 then raise exception using errcode='23514',message='Bestätigung ist nicht an die unveränderte Fassung gebunden.';end if;
   if exists(select 1 from care_documentation_private.confirmations c where c.version_id=head.id)
    or not exists(select 1 from public.clinical_documentation_entries d where d.id=head.id and d.tenant_id=tenant and d.signature_status='unsigned')
   then raise exception using errcode='40001',message='Diese Fassung ist bereits bestätigt oder hat einen fremden Signaturstand.';end if;
   insert into care_documentation_private.confirmations(request_id,version_id,tenant_id,client_id,actor_profile_id,person_id,person_name,confirming_role,scope,basis,confirmed_at,content_fingerprint)values(request,head.id,tenant,client,actor,actor,btrim(confirmation->>'personName'),btrim(confirmation->>'role'),btrim(confirmation->>'scope'),btrim(confirmation->>'basis'),(confirmation->>'confirmedAt')::timestamptz,head.content_fingerprint);
   update public.clinical_documentation_entries set signature_status='signed',signed_at=(confirmation->>'confirmedAt')::timestamptz,signed_by=actor,signed_by_name=btrim(confirmation->>'personName') where id=head.id and tenant_id=tenant and signature_status='unsigned';
   if not found then raise exception using errcode='40001',message='Die Bestätigung konnte nicht an den unveränderten Signaturstand gebunden werden.';end if;
   insert into care_documentation_private.requests values(request,tenant,client,actor,action,packet,head.id,clock_timestamp());return jsonb_build_object('requestId',request,'packet',packet,'original',care_documentation_private.record_json(head));
  end if;
 end if;
 fingerprint:='sha256:'||encode(digest(convert_to(entry::text,'UTF8'),'sha256'),'hex');mapping:=case entry->>'kind' when 'planned_service' then 'visit' when 'refusal' then 'consultation' when 'incident' then 'incident' when 'structured_protocol' then 'observation' when 'control' then 'evaluation' when 'external' then 'consultation' else 'care_report' end;
 next.request_id:=request;next.tenant_id:=tenant;next.client_id:=client;next.actor_profile_id:=actor;next.kind:=entry->>'kind';next.occurred_at:=(entry->>'occurredAt')::timestamptz;next.payload:=entry;next.correction_reason:=case when action='correct' then btrim(packet->>'correctionReason') else '' end;next.content_fingerprint:=fingerprint;
 insert into public.clinical_documentation_entries(id,tenant_id,client_id,entry_type,title,content,observations,interventions,result,deviation,escalation,recorded_at,recorded_by,recorded_by_name,signature_status,correction_of_id,correction_reason)values(next.id,tenant,client,mapping,btrim(entry->>'title'),btrim(entry->>'observation'),btrim(entry->>'observation'),coalesce(entry->>'intervention',''),coalesce(entry->>'result',''),'','',next.occurred_at,actor,coalesce((select coalesce(p.display_name,p.email,'Unbekannt') from public.profiles p where p.id=actor),'Unbekannt'),'unsigned',next.previous_id,next.correction_reason);
 insert into care_documentation_private.versions(id,root_id,previous_id,request_id,tenant_id,client_id,actor_profile_id,revision,kind,occurred_at,payload,correction_reason,content_fingerprint)values(next.id,next.root_id,next.previous_id,request,tenant,client,actor,next.revision,next.kind,next.occurred_at,next.payload,next.correction_reason,next.content_fingerprint) returning * into next;
 insert into care_documentation_private.requests values(request,tenant,client,actor,action,packet,next.id,clock_timestamp());
 return jsonb_build_object('requestId',request,'packet',packet,'original',care_documentation_private.record_json(next));
end $$;

create or replace function care_documentation_private.confirm_packet(p_tenant uuid,p_client uuid,p_actor uuid,p_request uuid,p_packet jsonb) returns jsonb language plpgsql security definer set search_path='' stable as $$
declare r care_documentation_private.requests%rowtype;v care_documentation_private.versions%rowtype;begin perform care_documentation_private.authorize(p_tenant,p_actor,false);select * into r from care_documentation_private.requests x where x.request_id=p_request;if not found or r.tenant_id<>p_tenant or r.client_id<>p_client or r.actor_profile_id<>p_actor or r.packet_original<>p_packet then raise exception using errcode='P0E02',message='Passende unveränderte Quittung fehlt.';end if;select * into v from care_documentation_private.versions where id=r.version_id;return jsonb_build_object('requestId',p_request,'packet',p_packet,'original',care_documentation_private.record_json(v));end $$;

create or replace function public.web_read_care_documentation_page(uuid,uuid,uuid,timestamptz,uuid,integer) returns jsonb language sql security invoker set search_path='' as $$select care_documentation_private.read_page($1,$2,$3,$4,$5,$6)$$;
create or replace function public.web_read_care_documentation_record(uuid,uuid,uuid,uuid) returns jsonb language sql security invoker set search_path='' as $$select care_documentation_private.read_record($1,$2,$3,$4)$$;
create or replace function public.web_commit_care_documentation_packet(jsonb) returns jsonb language sql security invoker set search_path='' as $$select care_documentation_private.commit_packet($1)$$;
create or replace function public.web_confirm_care_documentation_packet(uuid,uuid,uuid,uuid,jsonb) returns jsonb language sql security invoker set search_path='' as $$select care_documentation_private.confirm_packet($1,$2,$3,$4,$5)$$;
revoke all on all functions in schema care_documentation_private from public,anon,authenticated;
revoke all on function public.web_read_care_documentation_page(uuid,uuid,uuid,timestamptz,uuid,integer),public.web_read_care_documentation_record(uuid,uuid,uuid,uuid),public.web_commit_care_documentation_packet(jsonb),public.web_confirm_care_documentation_packet(uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function care_documentation_private.authorize(uuid,uuid,boolean,boolean),care_documentation_private.entry_issue(jsonb),care_documentation_private.record_json(care_documentation_private.versions),care_documentation_private.current_version(uuid,uuid,uuid),care_documentation_private.read_page(uuid,uuid,uuid,timestamptz,uuid,integer),care_documentation_private.read_record(uuid,uuid,uuid,uuid),care_documentation_private.commit_packet(jsonb),care_documentation_private.confirm_packet(uuid,uuid,uuid,uuid,jsonb) to authenticated;
grant execute on function public.web_read_care_documentation_page(uuid,uuid,uuid,timestamptz,uuid,integer),public.web_read_care_documentation_record(uuid,uuid,uuid,uuid),public.web_commit_care_documentation_packet(jsonb),public.web_confirm_care_documentation_packet(uuid,uuid,uuid,uuid,jsonb) to authenticated;
commit;
