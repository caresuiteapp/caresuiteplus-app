-- PREPARED ONLY: R-01..R-12, separated planning specialist review, 2026-10-17.
-- Not applied. Depends on ambulatory_tour_planning_workspace.sql and current HR originals.
-- Gates: real PostgreSQL/PostgREST/RLS/GRANT/trigger/two-session/rollback/SDK/native-writer tests.
begin;
create schema if not exists care_tour_planning_review_private;
revoke all on schema care_tour_planning_review_private from public,anon,authenticated;

create table if not exists care_tour_planning_review_private.review_scopes(
 id uuid primary key,tenant_id uuid not null,employee_id uuid not null,qualification_id uuid not null,
 kind text not null check(kind='tour_planning_review'),qualification_fingerprint text not null,
 document_fingerprint text not null,approved_at timestamptz not null,valid_until timestamptz not null,
 revoked_at timestamptz,approved_by uuid not null);
create table if not exists care_tour_planning_review_private.roots(
 id uuid primary key,tenant_id uuid not null,plan_id uuid not null,planning_head_id uuid not null,
 planning_fingerprint text not null,created_at timestamptz not null);
create table if not exists care_tour_planning_review_private.events(
 id uuid primary key,tenant_id uuid not null,plan_id uuid not null,root_id uuid not null references care_tour_planning_review_private.roots(id),
 revision integer not null check(revision between 1 and 2),previous_id uuid,request_id uuid not null,
 action text not null check(action in('request','return','accept')),actor_id uuid not null,actor_name text not null,
 recorded_at timestamptz not null,reason text not null,required_change text not null,rationale text not null,
 planning_head_id uuid not null,planning_fingerprint text not null,qualification_original jsonb,fingerprint text not null,packet jsonb not null,
 unique(root_id,revision),unique(tenant_id,request_id));
create table if not exists care_tour_planning_review_private.receipts(
 request_id uuid primary key,tenant_id uuid not null,plan_id uuid not null,actor_id uuid not null,
 root_id uuid not null,event_id uuid not null,packet jsonb not null,original jsonb not null,recorded_at timestamptz not null);
alter table care_tour_planning_review_private.review_scopes enable row level security;
alter table care_tour_planning_review_private.roots enable row level security;
alter table care_tour_planning_review_private.events enable row level security;
alter table care_tour_planning_review_private.receipts enable row level security;
revoke all on all tables in schema care_tour_planning_review_private from public,anon,authenticated;

create or replace function care_tour_planning_review_private.immutable()returns trigger language plpgsql security definer set search_path='' as $$
begin raise exception 'Planungsprüforiginale bleiben unveränderlich.' using errcode='P0S01';end$$;
drop trigger if exists tour_planning_review_scopes_immutable on care_tour_planning_review_private.review_scopes;
create trigger tour_planning_review_scopes_immutable before update or delete on care_tour_planning_review_private.review_scopes for each row execute function care_tour_planning_review_private.immutable();
drop trigger if exists tour_planning_review_roots_immutable on care_tour_planning_review_private.roots;
create trigger tour_planning_review_roots_immutable before update or delete on care_tour_planning_review_private.roots for each row execute function care_tour_planning_review_private.immutable();
drop trigger if exists tour_planning_review_events_immutable on care_tour_planning_review_private.events;
create trigger tour_planning_review_events_immutable before update or delete on care_tour_planning_review_private.events for each row execute function care_tour_planning_review_private.immutable();
drop trigger if exists tour_planning_review_receipts_immutable on care_tour_planning_review_private.receipts;
create trigger tour_planning_review_receipts_immutable before update or delete on care_tour_planning_review_private.receipts for each row execute function care_tour_planning_review_private.immutable();

create or replace function care_tour_planning_review_private.review_source(t uuid,actor uuid,p uuid)returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;begin
 result:=care_tour_planning_private.read_context(t,actor,p)-'actorId'-'loadedAt';
 if result#>>'{history,headId}' is null or jsonb_array_length(result#>'{history,events}')<1 then raise exception 'Vollständiger Planungskopf fehlt.' using errcode='23514';end if;
 return result;
end$$;

create or replace function care_tour_planning_review_private.review_original(rid uuid)returns jsonb language plpgsql security definer set search_path='' as $$
declare root care_tour_planning_review_private.roots%rowtype;items jsonb;head care_tour_planning_review_private.events%rowtype;begin
 select * into root from care_tour_planning_review_private.roots r where r.id=rid;
 if not found then raise exception 'Planungsprüfwurzel fehlt.' using errcode='P0S01';end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',e.id::text,'revision',e.revision,'previousId',e.previous_id::text,'requestId',e.request_id::text,
  'action',e.action,'recordedAt',to_char(e.recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
  'actorId',e.actor_id::text,'actorName',e.actor_name,'reason',e.reason,'requiredChange',e.required_change,
  'rationale',e.rationale,'planningHeadId',e.planning_head_id::text,'planningFingerprint',e.planning_fingerprint,
  'qualification',e.qualification_original,'fingerprint',e.fingerprint) order by e.revision),'[]'::jsonb)
 into items from care_tour_planning_review_private.events e where e.root_id=rid;
 select * into head from care_tour_planning_review_private.events e where e.root_id=rid order by e.revision desc limit 1;
 if not found or jsonb_array_length(items)<>head.revision then raise exception 'Planungsprüfhistorie ist unvollständig.' using errcode='P0S01';end if;
 return jsonb_build_object('id',head.id::text,'tenantId',root.tenant_id::text,'planId',root.plan_id::text,
  'rootId',root.id::text,'headId',head.id::text,'revision',head.revision,'planningHeadId',root.planning_head_id::text,
  'planningFingerprint',root.planning_fingerprint,'status',case head.action when 'request'then 'requested' when 'return'then 'returned' else 'accepted'end,'history',items);
end$$;

create or replace function care_tour_planning_review_private.involved(source jsonb,actor uuid)returns boolean language sql immutable set search_path='' as $$
 with recursive walk(v)as(
  select source
  union all
  select child from walk w cross join lateral(
   select value as child from jsonb_each(case when jsonb_typeof(w.v)='object'then w.v else '{}'::jsonb end)
   union all
   select value from jsonb_array_elements(case when jsonb_typeof(w.v)='array'then w.v else '[]'::jsonb end)
  )children
 )
 select exists(select 1 from walk where jsonb_typeof(v)='object'and(v->>'actorId'=actor::text or v->>'profileId'=actor::text))
$$;

create or replace function care_tour_planning_review_private.read_page(t uuid,p uuid,actor uuid,cursor_at timestamptz,cursor_id uuid,page_size integer)returns jsonb language plpgsql security definer set search_path='' as $$
declare rows jsonb;next_at timestamptz;next_id uuid;begin
 perform care_tour_planning_private.actor(t,actor,false);perform care_tour_planning_private.plan_access(t,p);
 if page_size is null or page_size<1 or page_size>100 then raise exception 'Seitengröße ungültig.' using errcode='22023';end if;
 select coalesce(jsonb_agg(care_tour_planning_review_private.review_original(q.root_id)order by q.recorded_at desc,q.id desc),'[]'::jsonb)
 into rows from(select distinct on(e.root_id)e.root_id,e.recorded_at,e.id from care_tour_planning_review_private.events e
  where e.tenant_id=t and e.plan_id=p and(cursor_at is null or(e.recorded_at,e.id)<(cursor_at,cursor_id))
  order by e.root_id,e.revision desc,e.recorded_at desc,e.id desc limit page_size)q;
 select x.recorded_at,x.id into next_at,next_id from care_tour_planning_review_private.events x
 where x.root_id=(select(y.value->>'rootId')::uuid from jsonb_array_elements(rows)with ordinality as y(value,ord)order by y.ord desc limit 1)
 order by x.revision desc limit 1;
 perform care_tour_planning_private.actor(t,actor,false);
 return jsonb_build_object('rows',rows,'nextCursorRecordedAt',case when next_at is null then null else to_char(next_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')end,'nextCursorId',next_id::text);
end$$;

create or replace function care_tour_planning_review_private.commit_review(p jsonb)returns jsonb language plpgsql security definer set search_path='' as $$
declare t uuid:=(p->>'tenantId')::uuid;plan_id uuid:=(p->>'planId')::uuid;actor uuid:=(p->>'actorId')::uuid;req uuid:=(p->>'requestId')::uuid;
 action_value text:=p->>'action';expected integer:=(p->>'expectedRevision')::integer;event_ref uuid:=gen_random_uuid();
 source jsonb;source_head uuid;source_fingerprint text;root_ref uuid;prior care_tour_planning_review_private.events%rowtype;
 receipt care_tour_planning_review_private.receipts%rowtype;name text;qualification jsonb;fingerprint text;original jsonb;today date:=timezone('Europe/Berlin',clock_timestamp())::date;now_at timestamptz:=clock_timestamp();
begin
 if p->>'schemaVersion'<>'1'or action_value not in('request','return','accept')then raise exception 'Planungsprüfanfrage ungültig.' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('tour-planning-review:'||t::text||':'||plan_id::text,0));
 select * into receipt from care_tour_planning_review_private.receipts r where r.request_id=req for update;
 if found then if receipt.packet is distinct from p then raise exception 'Anfragekennung ist anders gebunden.' using errcode='P0S01';end if;return jsonb_build_object('requestId',req::text,'packet',p,'original',receipt.original);end if;
 source:=care_tour_planning_review_private.review_source(t,actor,plan_id);
 if source is distinct from p->'planningOriginal'then raise exception 'Vollständiger aktueller Planungsbestand wurde verändert.' using errcode='P0S01';end if;
 source_head:=(source#>>'{history,headId}')::uuid;
 source_fingerprint:='sha256:'||encode(extensions.digest(convert_to(source::text,'UTF8'),'sha256'),'hex');
 select coalesce(nullif(btrim(pr.display_name),''),pr.email)into name from public.profiles pr where pr.id=actor and pr.tenant_id=t and pr.is_active=true;
 if btrim(coalesce(name,''))=''then raise exception 'Aktiver Akteur fehlt.' using errcode='42501';end if;
 if action_value='request'then
  perform care_tour_planning_private.actor(t,actor,true);
  if expected<>0 or p->'expectedHeadId'<>'null'::jsonb or p->'reviewOriginal'<>'null'::jsonb or length(btrim(p->>'reason'))<10 or p->>'requiredChange'<>'' or p->>'rationale'<>''then raise exception 'Prüfanfrage darf keine Entscheidung enthalten.' using errcode='23514';end if;
  root_ref:=event_ref;
  insert into care_tour_planning_review_private.roots(id,tenant_id,plan_id,planning_head_id,planning_fingerprint,created_at)values(root_ref,t,plan_id,source_head,source_fingerprint,now_at);
 else
  perform care_tour_planning_private.actor(t,actor,true);
  if public.has_permission('pflege.documentation.sign')is not true then raise exception 'Planungsfachprüfrecht fehlt.' using errcode='42501';end if;
  root_ref:=(p#>>'{reviewOriginal,rootId}')::uuid;
  select * into prior from care_tour_planning_review_private.events e where e.root_id=root_ref order by e.revision desc limit 1 for update;
  if not found or expected<>1 or prior.action<>'request'or prior.id::text<>p->>'expectedHeadId'or care_tour_planning_review_private.review_original(root_ref)is distinct from p->'reviewOriginal'then raise exception 'Planungsprüfanfrage hat sich geändert.' using errcode='P0S01';end if;
  if care_tour_planning_review_private.involved(source,actor)or actor=prior.actor_id then raise exception 'Beteiligte Person darf diese Planungsfassung nicht selbst entscheiden.' using errcode='42501';end if;
  lock table public.employees,public.employee_employment_details,public.employee_qualifications,public.employee_documents,care_tour_planning_review_private.review_scopes in share mode;
  select jsonb_build_object('id',q.id::text,'employeeId',e.id::text,'profileId',e.profile_id::text,'qualificationType',q.qualification_type,'title',q.title,
   'status',q.status,'issuedAt',to_char(q.issued_at,'YYYY-MM-DD'),'validUntil',to_char(q.valid_until,'YYYY-MM-DD'),
   'verifiedAt',to_char(q.verified_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'updatedAt',to_char(q.updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
   'documentId',d.id::text,'documentFingerprint',scope.document_fingerprint,'sourceFingerprint',scope.qualification_fingerprint,
   'employmentStart',to_char(coalesce(e.entry_date,e.start_date),'YYYY-MM-DD'),'employmentEnd',to_char(e.exit_date,'YYYY-MM-DD'),
   'employeeFingerprint','sha256:'||encode(extensions.digest(convert_to(jsonb_build_object('employee',to_jsonb(e),'employment',to_jsonb(ed))::text,'UTF8'),'sha256'),'hex'),
   'scopeId',scope.id::text,'scopeKind','tour_planning_review','scopeFingerprint','sha256:'||encode(extensions.digest(convert_to(to_jsonb(scope)::text,'UTF8'),'sha256'),'hex'))into qualification
  from public.employees e join public.employee_employment_details ed on ed.employee_id=e.id and ed.tenant_id=e.tenant_id
  join public.employee_qualifications q on q.employee_id=e.id and q.tenant_id=e.tenant_id
  join public.employee_documents d on d.id=q.document_id and d.employee_id=e.id and d.tenant_id=e.tenant_id
  join care_tour_planning_review_private.review_scopes scope on scope.employee_id=e.id and scope.qualification_id=q.id and scope.tenant_id=e.tenant_id
  where e.tenant_id=t and e.profile_id=actor and e.status='aktiv'and ed.employment_status='active'and coalesce(e.entry_date,e.start_date)<=today and(e.exit_date is null or e.exit_date>=today)
   and q.status in('valid','expires_soon')and q.verified_at<=now_at and q.updated_at<=now_at and(q.issued_at is null or q.issued_at<=today)and(q.valid_until is null or q.valid_until>=today)
   and(d.valid_until is null or d.valid_until>=today)and btrim(coalesce(d.storage_path,''))<>''and scope.kind='tour_planning_review'and scope.approved_at<=now_at and scope.valid_until>now_at and scope.revoked_at is null
   and scope.qualification_fingerprint='sha256:'||encode(extensions.digest(convert_to(to_jsonb(q)::text,'UTF8'),'sha256'),'hex')
   and scope.document_fingerprint='sha256:'||encode(extensions.digest(convert_to(to_jsonb(d)::text,'UTF8'),'sha256'),'hex')
  order by scope.approved_at desc,scope.id desc limit 1;
  if qualification is null then raise exception 'Aktuelle Beschäftigung, Qualifikation, Dokument und Planungsprüfbereich fehlen.' using errcode='42501';end if;
  if action_value='return'then if length(btrim(p->>'reason'))<10 or length(btrim(p->>'requiredChange'))<10 or p->>'rationale'<>''then raise exception 'Rückgabe benötigt Grund und konkrete Änderung.' using errcode='23514';end if;
  elsif p->>'reason'<>''or p->>'requiredChange'<>''or length(btrim(p->>'rationale'))<10 then raise exception 'Annahme benötigt eine fachliche Begründung.' using errcode='23514';end if;
 end if;
 fingerprint:='sha256:'||encode(extensions.digest(convert_to(jsonb_build_object('packet',p,'qualification',qualification)::text,'UTF8'),'sha256'),'hex');
 insert into care_tour_planning_review_private.events(id,tenant_id,plan_id,root_id,revision,previous_id,request_id,action,actor_id,actor_name,recorded_at,reason,required_change,rationale,planning_head_id,planning_fingerprint,qualification_original,fingerprint,packet)
 values(event_ref,t,plan_id,root_ref,expected+1,case when expected=0 then null else prior.id end,req,action_value,actor,name,now_at,p->>'reason',p->>'requiredChange',p->>'rationale',source_head,source_fingerprint,qualification,fingerprint,p);
 original:=care_tour_planning_review_private.review_original(root_ref);
 insert into care_tour_planning_review_private.receipts(request_id,tenant_id,plan_id,actor_id,root_id,event_id,packet,original,recorded_at)values(req,t,plan_id,actor,root_ref,event_ref,p,original,now_at);
 return jsonb_build_object('requestId',req::text,'packet',p,'original',original);
end$$;

create or replace function care_tour_planning_review_private.confirm_review(t uuid,p uuid,actor uuid,req uuid,packet jsonb)returns jsonb language plpgsql security definer set search_path='' as $$
declare r care_tour_planning_review_private.receipts%rowtype;begin
 perform care_tour_planning_private.actor(t,actor,false);
 select * into r from care_tour_planning_review_private.receipts x where x.request_id=req and x.tenant_id=t and x.plan_id=p and x.actor_id=actor;
 if not found or r.packet is distinct from packet then raise exception 'Keine passende unveränderliche Planungsprüfquittung.' using errcode='P0S03';end if;
 return jsonb_build_object('requestId',req::text,'packet',r.packet,'original',r.original);
end$$;

create or replace function public.web_read_tour_planning_review_page(p_tenant_id uuid,p_plan_id uuid,p_actor_profile_id uuid,p_cursor_recorded_at timestamptz,p_cursor_id uuid,p_page_size integer)returns jsonb language sql security invoker set search_path='' as $$
 select care_tour_planning_review_private.read_page(p_tenant_id,p_plan_id,p_actor_profile_id,p_cursor_recorded_at,p_cursor_id,p_page_size)$$;
create or replace function public.web_commit_tour_planning_review(p_packet jsonb)returns jsonb language sql security invoker set search_path='' as $$
 select care_tour_planning_review_private.commit_review(p_packet)$$;
create or replace function public.web_confirm_tour_planning_review(p_tenant_id uuid,p_plan_id uuid,p_actor_profile_id uuid,p_request_id uuid,p_packet jsonb)returns jsonb language sql security invoker set search_path='' as $$
 select care_tour_planning_review_private.confirm_review(p_tenant_id,p_plan_id,p_actor_profile_id,p_request_id,p_packet)$$;

revoke all on all functions in schema care_tour_planning_review_private from public,anon,authenticated;
grant usage on schema care_tour_planning_review_private to authenticated;
grant execute on function care_tour_planning_review_private.read_page(uuid,uuid,uuid,timestamptz,uuid,integer),care_tour_planning_review_private.commit_review(jsonb),care_tour_planning_review_private.confirm_review(uuid,uuid,uuid,uuid,jsonb)to authenticated;
revoke all on function public.web_read_tour_planning_review_page(uuid,uuid,uuid,timestamptz,uuid,integer),public.web_commit_tour_planning_review(jsonb),public.web_confirm_tour_planning_review(uuid,uuid,uuid,uuid,jsonb)from public,anon,authenticated;
grant execute on function public.web_read_tour_planning_review_page(uuid,uuid,uuid,timestamptz,uuid,integer),public.web_commit_tour_planning_review(jsonb),public.web_confirm_tour_planning_review(uuid,uuid,uuid,uuid,jsonb)to authenticated;
commit;

