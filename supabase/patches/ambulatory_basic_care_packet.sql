-- PREPARED ONLY: F-01..F-08 Grundpflege/Prophylaxen. Do not apply without a real compatibility/RLS test.
create schema if not exists care_private;

create table if not exists public.basic_care_plan_bindings(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),client_id uuid not null references public.clients(id),
 plan_version_id uuid not null,measure_id uuid not null references public.care_plan_items(id),visit_id uuid not null references public.care_tour_stops(id),
 kind text not null check(kind in('body_care','oral_care','dressing','transfer_positioning','pressure_prevention','fall_prevention','contracture_prevention','individual_prevention')),
 title text not null check(btrim(title)<>''),planned_at timestamptz not null,plan_snapshot_sha256 text not null check(plan_snapshot_sha256~'^sha256:[0-9a-f]{64}$'),
 second_person_required boolean not null default false,pressure_originals jsonb,fall_originals jsonb,plan_original jsonb not null,created_at timestamptz not null default clock_timestamp(),
 check((kind='pressure_prevention')=(pressure_originals is not null)),check((kind='fall_prevention')=(fall_originals is not null)),
 unique(tenant_id,client_id,plan_version_id,measure_id,visit_id)
);
create table if not exists public.basic_care_roots(
 id uuid primary key,tenant_id uuid not null references public.tenants(id),client_id uuid not null references public.clients(id),kind text not null,
 plan_binding_id uuid not null references public.basic_care_plan_bindings(id),created_at timestamptz not null,unique(id,tenant_id,client_id)
);
create table if not exists public.basic_care_events(
 id uuid primary key,tenant_id uuid not null,client_id uuid not null,root_id uuid not null,revision integer not null check(revision>0),previous_id uuid,
 request_id uuid not null,actor_id uuid not null references public.profiles(id),actor_name text not null check(btrim(actor_name)<>''),recorded_at timestamptz not null,
 reason text not null,payload jsonb not null,content_fingerprint text not null check(content_fingerprint~'^sha256:[0-9a-f]{64}$'),packet jsonb not null,
 unique(root_id,revision),unique(tenant_id,request_id),unique(id,root_id),foreign key(root_id,tenant_id,client_id) references public.basic_care_roots(id,tenant_id,client_id),
 foreign key(previous_id,root_id) references public.basic_care_events(id,root_id),check((revision=1)=(previous_id is null))
);
create table if not exists public.basic_care_receipts(
 request_id uuid primary key,tenant_id uuid not null,client_id uuid not null,actor_id uuid not null,root_id uuid not null,event_id uuid not null,
 packet jsonb not null,original jsonb not null,recorded_at timestamptz not null,foreign key(event_id,root_id) references public.basic_care_events(id,root_id)
);
create index if not exists basic_care_scope on public.basic_care_roots(tenant_id,client_id,created_at desc,id desc);
alter table public.basic_care_plan_bindings enable row level security;
alter table public.basic_care_roots enable row level security;
alter table public.basic_care_events enable row level security;
alter table public.basic_care_receipts enable row level security;
revoke all on public.basic_care_plan_bindings,public.basic_care_roots,public.basic_care_events,public.basic_care_receipts from public,anon,authenticated;

create or replace function care_private.basic_care_actor(requested_tenant uuid,requested_client uuid,requested_actor uuid,write_access boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare t uuid:=public.current_tenant_id();session_user uuid:=auth.uid();actor uuid:=public.resolve_current_profile_id();profile_count integer;begin
 if t is null or t<>requested_tenant or session_user is null or actor is null or actor<>requested_actor then raise exception 'Keine aktuelle Grundpflegeberechtigung.' using errcode='42501';end if;
 if not exists(select 1 from auth.sessions s where s.user_id=session_user and s.not_after>clock_timestamp())
    or coalesce((auth.jwt()->>'exp')::bigint,0)<=extract(epoch from clock_timestamp())::bigint then raise exception 'Sitzung ist abgelaufen.' using errcode='42501';end if;
 select count(*) into profile_count from public.profiles p where p.id=actor and p.tenant_id=t and coalesce(p.is_active,true)=true;
 if profile_count<>1 or not public.is_active_pfleger_client(requested_client)
    or not public.has_permission('pflege.plans.view') or not public.has_permission('pflege.documentation.view')
    or write_access and not public.has_permission('pflege.documentation.create') then raise exception 'Keine aktuelle Grundpflegeberechtigung.' using errcode='42501';end if;
 return actor;
end$$;

create or replace function care_private.basic_care_original(root_ref uuid)
returns jsonb language sql security definer set search_path='' stable as $$
 select jsonb_build_object('id',h.id::text,'tenantId',r.tenant_id::text,'clientId',r.client_id::text,'rootId',r.id::text,'headId',h.id::text,'revision',h.revision,'kind',r.kind,
 'recordedAt',to_char(h.recorded_at,'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'recordedBy',h.actor_id::text,'recordedByName',h.actor_name,'payload',h.payload,'contentFingerprint',h.content_fingerprint,
 'history',(select jsonb_agg(jsonb_build_object('id',e.id::text,'revision',e.revision,'previousId',case when e.previous_id is null then null else e.previous_id::text end,'recordedAt',to_char(e.recorded_at,'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'recordedBy',e.actor_id::text,'recordedByName',e.actor_name,'reason',e.reason,'payload',e.payload,'contentFingerprint',e.content_fingerprint) order by e.revision) from public.basic_care_events e where e.root_id=r.id),'voided',false)
 from public.basic_care_roots r join lateral(select e.* from public.basic_care_events e where e.root_id=r.id order by e.revision desc limit 1)h on true where r.id=root_ref
$$;

create or replace function care_private.read_basic_care_prerequisites(requested_tenant uuid,requested_client uuid,requested_actor uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;begin perform care_private.basic_care_actor(requested_tenant,requested_client,requested_actor,false);
 select jsonb_build_object(
  'plans',coalesce(jsonb_agg(jsonb_build_object('planVersionId',b.plan_version_id::text,'measureId',b.measure_id::text,'visitId',b.visit_id::text,'planSnapshotSha256',b.plan_snapshot_sha256,'kind',b.kind,'title',b.title,'plannedAt',to_char(b.planned_at,'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'secondPersonRequired',b.second_person_required,'pressureOriginals',b.pressure_originals,'fallOriginals',b.fall_originals) order by b.planned_at,b.id) filter(where b.id is not null),'[]'::jsonb),
  'pressure',null,'fall',null) into result from public.basic_care_plan_bindings b where b.tenant_id=requested_tenant and b.client_id=requested_client and b.planned_at>=clock_timestamp()-interval '30 days';
 return result;
end$$;

create or replace function care_private.read_basic_care_page(requested_tenant uuid,requested_client uuid,requested_actor uuid,cursor_recorded_at timestamptz,cursor_id uuid,page_size integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;begin perform care_private.basic_care_actor(requested_tenant,requested_client,requested_actor,false);if page_size<1 or page_size>100 then raise exception 'Ungültige Seitengröße.' using errcode='22023';end if;
 select jsonb_build_object('rows',coalesce(jsonb_agg(care_private.basic_care_original(x.id) order by x.created_at desc,x.id desc),'[]'::jsonb)) into result from(select r.* from public.basic_care_roots r where r.tenant_id=requested_tenant and r.client_id=requested_client and (cursor_recorded_at is null or (r.created_at,r.id)<(cursor_recorded_at,cursor_id)) order by r.created_at desc,r.id desc limit page_size)x;return result;
end$$;

create or replace function care_private.commit_basic_care_packet(p jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t uuid:=(p->>'tenantId')::uuid;c uuid:=(p->>'clientId')::uuid;actor uuid:=(p->>'actorId')::uuid;req uuid:=(p->>'requestId')::uuid;root_ref uuid;head_ref uuid;event_ref uuid:=gen_random_uuid();expected_revision integer:=(p->>'expectedRevision')::integer;binding public.basic_care_plan_bindings;prior public.basic_care_events;name text;actual_time timestamptz:=clock_timestamp();fingerprint text;original jsonb;receipt public.basic_care_receipts;begin
 perform care_private.basic_care_actor(t,c,actor,true);perform pg_advisory_xact_lock(hashtextextended(t::text||':'||c::text,0));
 if p->>'schemaVersion'<>'1' or p->>'action' not in('create','revise') or jsonb_typeof(p->'entry')<>'object' or p->'entry'->>'kind' not in('body_care','oral_care','dressing','transfer_positioning','pressure_prevention','fall_prevention','contracture_prevention','individual_prevention')
    or btrim(coalesce(p->'entry'->>'title',''))='' or coalesce(p->'entry'->>'planSnapshotSha256','')!~'^sha256:[0-9a-f]{64}$'
    or p->'entry'->'execution'->>'outcome' not in('planned','offered','performed','partial','refused','not_performed')
    or p->'entry'->>'lifecycle' not in('open','completed') then raise exception 'Grundpflegepaket ist unvollständig.' using errcode='23514';end if;
 if p->'entry'->'execution'->>'outcome' in('performed','partial') and (p->'entry'->'consent'->>'state'<>'consented' or jsonb_array_length(coalesce(p->'entry'->'execution'->'performedBy','[]'::jsonb))<1 or jsonb_array_length(coalesce(p->'entry'->'execution'->'interventions','[]'::jsonb))<1 or btrim(coalesce(p->'entry'->'execution'->>'result',''))='') then raise exception 'Durchführung ist nicht vollständig belegt.' using errcode='23514';end if;
 if p->'entry'->'execution'->>'outcome'='refused' and (p->'entry'->'consent'->>'state'<>'refused' or btrim(coalesce(p->'entry'->'consent'->>'statedReason',''))='' or btrim(coalesce(p->'entry'->'consent'->>'consultation',''))='' or coalesce((p->'entry'->'followUp'->>'required')::boolean,false)=false) then raise exception 'Ablehnung ist nicht vollständig dokumentiert.' using errcode='23514';end if;
 if p->'entry'->>'lifecycle'='completed' and (p->'entry'->'execution'->>'outcome' in('planned','offered') or coalesce((p->'entry'->'followUp'->>'required')::boolean,false) and p->'entry'->'followUp'->>'state'<>'closed') then raise exception 'Abschlussvoraussetzungen fehlen.' using errcode='23514';end if;
 select * into receipt from public.basic_care_receipts r where r.tenant_id=t and r.request_id=req for update;if found then if receipt.packet<>p or receipt.actor_id<>actor then raise exception 'Anfragekennung ist bereits anders gebunden.' using errcode='40001';end if;return jsonb_build_object('requestId',req::text,'packet',p,'original',receipt.original);end if;
 select * into binding from public.basic_care_plan_bindings b where b.tenant_id=t and b.client_id=c and b.plan_version_id=(p->'entry'->>'planVersionId')::uuid and b.measure_id=(p->'entry'->>'measureId')::uuid and b.visit_id=(p->'entry'->>'visitId')::uuid for share;
 if not found or binding.plan_snapshot_sha256<>p->'entry'->>'planSnapshotSha256' or binding.kind<>p->'entry'->>'kind' or coalesce(binding.pressure_originals,'null'::jsonb)<>coalesce(p->'pressureOriginals','null'::jsonb) or coalesce(binding.fall_originals,'null'::jsonb)<>coalesce(p->'fallOriginals','null'::jsonb) then raise exception 'Plan- oder Prophylaxeoriginal hat sich geändert.' using errcode='40001';end if;
 if p->>'action'='create' then if expected_revision<>0 or p->'original'<>'null'::jsonb then raise exception 'Neuanlage enthält ein fremdes Original.' using errcode='23514';end if;root_ref:=gen_random_uuid();head_ref:=null;insert into public.basic_care_roots(id,tenant_id,client_id,kind,plan_binding_id,created_at)values(root_ref,t,c,binding.kind,binding.id,actual_time);
 else root_ref:=(p->'original'->>'rootId')::uuid;select * into prior from public.basic_care_events e where e.root_id=root_ref order by e.revision desc limit 1 for update;if not found or prior.id<>(p->>'expectedHeadId')::uuid or prior.revision<>expected_revision or care_private.basic_care_original(root_ref)<>p->'original' then raise exception 'Grundpflegeoriginal hat sich geändert.' using errcode='40001';end if;head_ref:=prior.id;if btrim(coalesce(p->>'reason',''))='' then raise exception 'Fortschreibungsgrund fehlt.' using errcode='23514';end if;end if;
 select display_name into name from public.profiles where id=actor and tenant_id=t;if btrim(coalesce(name,''))='' then raise exception 'Akteur ist unvollständig.' using errcode='42501';end if;
 fingerprint:='sha256:'||encode(extensions.digest(convert_to((p->'entry')::text,'UTF8'),'sha256'),'hex');
 insert into public.basic_care_events(id,tenant_id,client_id,root_id,revision,previous_id,request_id,actor_id,actor_name,recorded_at,reason,payload,content_fingerprint,packet)values(event_ref,t,c,root_ref,expected_revision+1,head_ref,req,actor,name,actual_time,coalesce(p->>'reason',''),p->'entry',fingerprint,p);
 original:=care_private.basic_care_original(root_ref);insert into public.basic_care_receipts(request_id,tenant_id,client_id,actor_id,root_id,event_id,packet,original,recorded_at)values(req,t,c,actor,root_ref,event_ref,p,original,actual_time);return jsonb_build_object('requestId',req::text,'packet',p,'original',original);
end$$;

create or replace function care_private.confirm_basic_care_packet(requested_tenant uuid,requested_client uuid,requested_actor uuid,requested_request uuid,p jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$declare r public.basic_care_receipts;begin perform care_private.basic_care_actor(requested_tenant,requested_client,requested_actor,false);select * into r from public.basic_care_receipts x where x.request_id=requested_request and x.tenant_id=requested_tenant and x.client_id=requested_client and x.actor_id=requested_actor;if not found or r.packet<>p or care_private.basic_care_original(r.root_id)<>r.original then raise exception 'Keine unveränderte native Quittung.' using errcode='P0F02';end if;return jsonb_build_object('requestId',r.request_id::text,'packet',r.packet,'original',r.original);end$$;

create or replace function public.web_read_basic_care_prerequisites(p_tenant_id uuid,p_client_id uuid,p_actor_profile_id uuid)returns jsonb language sql security invoker set search_path='' as $$select care_private.read_basic_care_prerequisites(p_tenant_id,p_client_id,p_actor_profile_id)$$;
create or replace function public.web_read_basic_care_page(p_tenant_id uuid,p_client_id uuid,p_actor_profile_id uuid,p_cursor_recorded_at timestamptz,p_cursor_id uuid,p_page_size integer)returns jsonb language sql security invoker set search_path='' as $$select care_private.read_basic_care_page(p_tenant_id,p_client_id,p_actor_profile_id,p_cursor_recorded_at,p_cursor_id,p_page_size)$$;
create or replace function public.web_commit_basic_care_packet(p_packet jsonb)returns jsonb language sql security invoker set search_path='' as $$select care_private.commit_basic_care_packet(p_packet)$$;
create or replace function public.web_confirm_basic_care_packet(p_tenant_id uuid,p_client_id uuid,p_actor_profile_id uuid,p_request_id uuid,p_packet jsonb)returns jsonb language sql security invoker set search_path='' as $$select care_private.confirm_basic_care_packet(p_tenant_id,p_client_id,p_actor_profile_id,p_request_id,p_packet)$$;
revoke all on function public.web_read_basic_care_prerequisites(uuid,uuid,uuid),public.web_read_basic_care_page(uuid,uuid,uuid,timestamptz,uuid,integer),public.web_commit_basic_care_packet(jsonb),public.web_confirm_basic_care_packet(uuid,uuid,uuid,uuid,jsonb) from public,anon;
grant execute on function public.web_read_basic_care_prerequisites(uuid,uuid,uuid),public.web_read_basic_care_page(uuid,uuid,uuid,timestamptz,uuid,integer),public.web_commit_basic_care_packet(jsonb),public.web_confirm_basic_care_packet(uuid,uuid,uuid,uuid,jsonb) to authenticated;

-- Prepared-only CP344 reconstruction: the professional review is append-only and
-- deliberately separate from care planning, execution, communication and billing.
create table if not exists public.basic_care_review_roots(
 id uuid primary key,tenant_id uuid not null references public.tenants(id),client_id uuid not null references public.clients(id),
 basic_care_root_id uuid not null references public.basic_care_roots(id),care_head_id uuid not null unique references public.basic_care_events(id),
 care_content_fingerprint text not null check(care_content_fingerprint~'^sha256:[0-9a-f]{64}$'),created_at timestamptz not null
);
create table if not exists public.basic_care_review_events(
 id uuid primary key,tenant_id uuid not null,client_id uuid not null,review_root_id uuid not null references public.basic_care_review_roots(id),
 revision integer not null check(revision in(1,2)),previous_id uuid references public.basic_care_review_events(id),request_id uuid not null,
 actor_id uuid not null references public.profiles(id),actor_name text not null check(btrim(actor_name)<>''),recorded_at timestamptz not null,
 kind text not null check(kind in('review_request','review_return','review_acceptance')),reason text not null,required_change text not null,rationale text not null,
 qualification_original jsonb,care_head_id uuid not null references public.basic_care_events(id),care_content_fingerprint text not null check(care_content_fingerprint~'^sha256:[0-9a-f]{64}$'),
 content_fingerprint text not null check(content_fingerprint~'^sha256:[0-9a-f]{64}$'),packet jsonb not null,
 unique(review_root_id,revision),unique(tenant_id,request_id),check((revision=1)=(previous_id is null))
);
create table if not exists public.basic_care_review_receipts(
 request_id uuid primary key,tenant_id uuid not null,client_id uuid not null,actor_id uuid not null,review_root_id uuid not null references public.basic_care_review_roots(id),
 event_id uuid not null references public.basic_care_review_events(id),packet jsonb not null,original jsonb not null,recorded_at timestamptz not null
);
create index if not exists basic_care_review_scope on public.basic_care_review_roots(tenant_id,client_id,created_at desc,id desc);
alter table public.basic_care_review_roots enable row level security;
alter table public.basic_care_review_events enable row level security;
alter table public.basic_care_review_receipts enable row level security;
revoke all on public.basic_care_review_roots,public.basic_care_review_events,public.basic_care_review_receipts from public,anon,authenticated;

create or replace function care_private.basic_care_review_original(root_ref uuid)
returns jsonb language sql security definer set search_path='' stable as $$
 select jsonb_build_object('id',h.id::text,'tenantId',r.tenant_id::text,'clientId',r.client_id::text,'rootId',r.id::text,'headId',h.id::text,'revision',h.revision,
 'careRootId',r.basic_care_root_id::text,'careHeadId',r.care_head_id::text,'careContentFingerprint',r.care_content_fingerprint,
 'status',case h.kind when 'review_request' then 'requested' when 'review_return' then 'returned' else 'accepted' end,
 'history',(select jsonb_agg(jsonb_build_object('id',e.id::text,'revision',e.revision,'previousId',case when e.previous_id is null then null else e.previous_id::text end,
 'requestId',e.request_id::text,'kind',e.kind,'recordedAt',to_char(e.recorded_at,'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'actorId',e.actor_id::text,'actorName',e.actor_name,
 'reason',e.reason,'requiredChange',e.required_change,'rationale',e.rationale,'careHeadId',e.care_head_id::text,'careContentFingerprint',e.care_content_fingerprint,
 'qualificationOriginal',e.qualification_original,'contentFingerprint',e.content_fingerprint) order by e.revision) from public.basic_care_review_events e where e.review_root_id=r.id))
 from public.basic_care_review_roots r join lateral(select e.* from public.basic_care_review_events e where e.review_root_id=r.id order by e.revision desc limit 1)h on true where r.id=root_ref
$$;

create or replace function care_private.read_basic_care_review_page(requested_tenant uuid,requested_client uuid,requested_actor uuid,cursor_recorded_at timestamptz,cursor_id uuid,page_size integer)
returns jsonb language plpgsql security definer set search_path='' as $$declare result jsonb;begin
 perform care_private.basic_care_actor(requested_tenant,requested_client,requested_actor,false);if page_size<1 or page_size>100 then raise exception 'Ungültige Seitengröße.' using errcode='22023';end if;
 select jsonb_build_object('rows',coalesce(jsonb_agg(care_private.basic_care_review_original(x.id) order by x.created_at desc,x.id desc),'[]'::jsonb)) into result
 from(select r.* from public.basic_care_review_roots r where r.tenant_id=requested_tenant and r.client_id=requested_client and(cursor_recorded_at is null or(r.created_at,r.id)<(cursor_recorded_at,cursor_id)) order by r.created_at desc,r.id desc limit page_size)x;return result;
end$$;

create or replace function care_private.commit_basic_care_review(p jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t uuid:=(p->>'tenantId')::uuid;c uuid:=(p->>'clientId')::uuid;actor uuid:=(p->>'actorId')::uuid;req uuid:=(p->>'requestId')::uuid;action text:=p->>'action';
 care_root uuid:=(p->'careOriginal'->>'rootId')::uuid;care_head uuid:=(p->'careOriginal'->>'headId')::uuid;review_root uuid;event_ref uuid:=gen_random_uuid();prior public.basic_care_review_events;
 receipt public.basic_care_review_receipts;name text;now_at timestamptz:=clock_timestamp();kind_value text;qualification jsonb:=null;fingerprint text;original jsonb;expected integer:=(p->>'expectedReviewRevision')::integer;
begin
 perform care_private.basic_care_actor(t,c,actor,action='request');
 if action in('return','accept') and not public.has_permission('pflege.documentation.sign') then raise exception 'Aktuelles Prüfungsrecht fehlt.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('basic-care-review:'||t::text||':'||c::text||':'||care_head::text,0));
 if p->>'schemaVersion'<>'1' or action not in('request','return','accept') or p->'careOriginal' is null or care_private.basic_care_original(care_root)<>p->'careOriginal'
  or p->'careOriginal'->>'headId'<>care_head::text then raise exception 'Unverändertes vollständiges Pflegeoriginal fehlt.' using errcode='40001';end if;
 select * into receipt from public.basic_care_review_receipts x where x.tenant_id=t and x.request_id=req for update;
 if found then if receipt.packet<>p or receipt.actor_id<>actor then raise exception 'Anfragekennung ist anders gebunden.' using errcode='40001';end if;return jsonb_build_object('requestId',req::text,'packet',p,'original',receipt.original);end if;
 select coalesce(pr.display_name,pr.email) into name from public.profiles pr where pr.id=actor and pr.tenant_id=t and coalesce(pr.is_active,true);if btrim(coalesce(name,''))='' then raise exception 'Aktiver Akteur fehlt.' using errcode='42501';end if;
 if action='request' then
  if expected<>0 or p->'reviewOriginal'<>'null'::jsonb or length(btrim(coalesce(p->>'reason','')))<10 or coalesce(p->>'requiredChange','')<>'' or coalesce(p->>'rationale','')<>'' then raise exception 'Prüfanfrage ist unvollständig.' using errcode='23514';end if;
  if exists(select 1 from public.basic_care_review_roots r where r.care_head_id=care_head) then raise exception 'Diese Fassung besitzt bereits eine Prüfhistorie.' using errcode='40001';end if;
  review_root:=gen_random_uuid();kind_value:='review_request';insert into public.basic_care_review_roots(id,tenant_id,client_id,basic_care_root_id,care_head_id,care_content_fingerprint,created_at)values(review_root,t,c,care_root,care_head,p->'careOriginal'->>'contentFingerprint',now_at);
 else
  review_root:=(p->'reviewOriginal'->>'rootId')::uuid;select * into prior from public.basic_care_review_events e where e.review_root_id=review_root order by e.revision desc limit 1 for update;
  if not found or prior.id<>(p->>'expectedReviewHeadId')::uuid or prior.revision<>expected or expected<>1 or prior.kind<>'review_request' or care_private.basic_care_review_original(review_root)<>p->'reviewOriginal' then raise exception 'Aktuelle Prüfanfrage hat sich geändert.' using errcode='40001';end if;
  if actor=prior.actor_id or exists(select 1 from jsonb_array_elements(p->'careOriginal'->'history') h cross join jsonb_array_elements_text(coalesce(h->'payload'->'execution'->'performedBy','[]'::jsonb)) performer where performer::uuid=actor) then raise exception 'Anfragende oder ausführende Person darf nicht selbst entscheiden.' using errcode='42501';end if;
  select jsonb_build_object('id',q.id::text,'employeeId',q.employee_id::text,'qualificationType',q.qualification_type,'title',q.title,'status',q.status,'validUntil',case when q.valid_until is null then null else to_char(q.valid_until,'YYYY-MM-DD') end,'verifiedAt',to_char(q.verified_at,'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'updatedAt',to_char(q.updated_at,'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'sourceFingerprint','sha256:'||encode(extensions.digest(convert_to(to_jsonb(q)::text,'UTF8'),'sha256'),'hex')) into qualification
  from public.employees e join public.employee_qualifications q on q.employee_id=e.id and q.tenant_id=e.tenant_id where e.tenant_id=t and e.profile_id=actor and coalesce(e.status,'')='active' and q.status in('valid','expires_soon') and q.verified_at is not null and(q.valid_until is null or q.valid_until>=now_at::date) order by q.updated_at desc,q.id desc limit 1 for share;
  if qualification is null then raise exception 'Aktuelles verifiziertes Qualifikationsoriginal fehlt.' using errcode='42501';end if;
  if action='return' then if length(btrim(coalesce(p->>'reason','')))<10 or length(btrim(coalesce(p->>'requiredChange','')))<10 or coalesce(p->>'rationale','')<>'' then raise exception 'Begründete Rückgabe ist unvollständig.' using errcode='23514';end if;kind_value:='review_return';
  else if coalesce(p->>'reason','')<>'' or coalesce(p->>'requiredChange','')<>'' or length(btrim(coalesce(p->>'rationale','')))<10 then raise exception 'Qualifizierte Annahme ist unvollständig.' using errcode='23514';end if;kind_value:='review_acceptance';end if;
 end if;
 fingerprint:='sha256:'||encode(extensions.digest(convert_to(jsonb_build_object('packet',p,'qualificationOriginal',qualification)::text,'UTF8'),'sha256'),'hex');
 insert into public.basic_care_review_events(id,tenant_id,client_id,review_root_id,revision,previous_id,request_id,actor_id,actor_name,recorded_at,kind,reason,required_change,rationale,qualification_original,care_head_id,care_content_fingerprint,content_fingerprint,packet)
 values(event_ref,t,c,review_root,expected+1,case when expected=0 then null else prior.id end,req,actor,name,now_at,kind_value,coalesce(p->>'reason',''),coalesce(p->>'requiredChange',''),coalesce(p->>'rationale',''),qualification,care_head,p->'careOriginal'->>'contentFingerprint',fingerprint,p);
 original:=care_private.basic_care_review_original(review_root);insert into public.basic_care_review_receipts(request_id,tenant_id,client_id,actor_id,review_root_id,event_id,packet,original,recorded_at)values(req,t,c,actor,review_root,event_ref,p,original,now_at);return jsonb_build_object('requestId',req::text,'packet',p,'original',original);
end$$;

create or replace function care_private.confirm_basic_care_review(requested_tenant uuid,requested_client uuid,requested_actor uuid,requested_request uuid,p jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$declare r public.basic_care_review_receipts;begin perform care_private.basic_care_actor(requested_tenant,requested_client,requested_actor,false);select * into r from public.basic_care_review_receipts x where x.request_id=requested_request and x.tenant_id=requested_tenant and x.client_id=requested_client and x.actor_id=requested_actor;if not found or r.packet<>p or care_private.basic_care_review_original(r.review_root_id)<>r.original then raise exception 'Keine unveränderte native Prüfquittung.' using errcode='P0F02';end if;return jsonb_build_object('requestId',r.request_id::text,'packet',r.packet,'original',r.original);end$$;

create or replace function public.web_read_basic_care_review_page(p_tenant_id uuid,p_client_id uuid,p_actor_profile_id uuid,p_cursor_recorded_at timestamptz,p_cursor_id uuid,p_page_size integer)returns jsonb language sql security invoker set search_path='' as $$select care_private.read_basic_care_review_page(p_tenant_id,p_client_id,p_actor_profile_id,p_cursor_recorded_at,p_cursor_id,p_page_size)$$;
create or replace function public.web_commit_basic_care_review(p_packet jsonb)returns jsonb language sql security invoker set search_path='' as $$select care_private.commit_basic_care_review(p_packet)$$;
create or replace function public.web_confirm_basic_care_review(p_tenant_id uuid,p_client_id uuid,p_actor_profile_id uuid,p_request_id uuid,p_packet jsonb)returns jsonb language sql security invoker set search_path='' as $$select care_private.confirm_basic_care_review(p_tenant_id,p_client_id,p_actor_profile_id,p_request_id,p_packet)$$;
revoke all on function public.web_read_basic_care_review_page(uuid,uuid,uuid,timestamptz,uuid,integer),public.web_commit_basic_care_review(jsonb),public.web_confirm_basic_care_review(uuid,uuid,uuid,uuid,jsonb) from public,anon;
grant execute on function public.web_read_basic_care_review_page(uuid,uuid,uuid,timestamptz,uuid,integer),public.web_commit_basic_care_review(jsonb),public.web_confirm_basic_care_review(uuid,uuid,uuid,uuid,jsonb) to authenticated;
