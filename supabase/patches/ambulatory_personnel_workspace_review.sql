-- Prepared only. Apply and verify in an authorized non-production Supabase environment.
begin;
create schema if not exists care_personnel_review_private;
create extension if not exists pgcrypto with schema extensions;

create table if not exists care_personnel_review_private.review_scopes(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,employee_id uuid not null,qualification_id uuid not null,kind text not null check(kind='personnel_care_review'),
 qualification_fingerprint text not null,document_fingerprint text not null,approved_at timestamptz not null,valid_until timestamptz not null,approved_by uuid not null,revoked_at timestamptz,
 check(valid_until>approved_at),unique(tenant_id,employee_id,qualification_id,kind,approved_at)
);
create table if not exists public.personnel_review_roots(
 id uuid primary key,tenant_id uuid not null,employee_id uuid not null,personnel_head_id uuid not null,personnel_fingerprint text not null,created_at timestamptz not null
);
create table if not exists public.personnel_review_events(
 id uuid not null,tenant_id uuid not null,employee_id uuid not null,root_id uuid not null references public.personnel_review_roots(id),revision integer not null check(revision in(1,2)),previous_id uuid,
 request_id uuid not null unique,action text not null check(action in('request','return','accept')),actor_id uuid not null references public.profiles(id),actor_name text not null,recorded_at timestamptz not null,
 reason text not null,required_change text not null,rationale text not null,personnel_head_id uuid not null,personnel_fingerprint text not null,qualification_original jsonb,fingerprint text not null,packet jsonb not null,
 primary key(id,root_id),unique(root_id,revision),foreign key(previous_id,root_id) references public.personnel_review_events(id,root_id),check((revision=1)=(previous_id is null)),check((action='request')=(revision=1)),check((action='request')=(qualification_original is null))
);
create table if not exists public.personnel_review_receipts(
 request_id uuid primary key,tenant_id uuid not null,employee_id uuid not null,actor_id uuid not null,root_id uuid not null,event_id uuid not null,packet jsonb not null,original jsonb not null,recorded_at timestamptz not null,
 foreign key(event_id,root_id) references public.personnel_review_events(id,root_id)
);
create index if not exists personnel_review_page on public.personnel_review_roots(tenant_id,employee_id,created_at desc,id desc);
alter table care_personnel_review_private.review_scopes enable row level security;
alter table public.personnel_review_roots enable row level security;
alter table public.personnel_review_events enable row level security;
alter table public.personnel_review_receipts enable row level security;
revoke all on care_personnel_review_private.review_scopes,public.personnel_review_roots,public.personnel_review_events,public.personnel_review_receipts from public,anon,authenticated;

create or replace function care_personnel_review_private.review_immutable() returns trigger language plpgsql security invoker set search_path='' as $$begin raise exception 'Personalfachprüforiginale und Quittungen sind unveränderlich.' using errcode='23514';end$$;
do $$declare tab text;begin foreach tab in array array['personnel_review_roots','personnel_review_events','personnel_review_receipts'] loop execute format('drop trigger if exists personnel_review_immutable on public.%I',tab);execute format('create trigger personnel_review_immutable before update or delete on public.%I for each row execute function care_personnel_review_private.review_immutable()',tab);end loop;end$$;

create or replace function care_personnel_review_private.review_source(t uuid,actor uuid,c uuid)
returns jsonb language sql volatile security definer set search_path='' as $$select care_personnel_private.read_context(t,actor,c)-'actorId'-'loadedAt'$$;
create or replace function care_personnel_review_private.review_original(root_ref uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',h.id::text,'tenantId',r.tenant_id::text,'employeeId',r.employee_id::text,'rootId',r.id::text,'headId',h.id::text,'revision',h.revision,
 'personnelHeadId',r.personnel_head_id::text,'personnelFingerprint',r.personnel_fingerprint,'status',case h.action when 'request' then 'requested' when 'return' then 'returned' else 'accepted' end,
 'history',(select jsonb_agg(jsonb_build_object('id',e.id::text,'revision',e.revision,'previousId',e.previous_id::text,'requestId',e.request_id::text,'action',e.action,
 'recordedAt',to_char(e.recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'actorId',e.actor_id::text,'actorName',e.actor_name,'reason',e.reason,'requiredChange',e.required_change,'rationale',e.rationale,
 'personnelHeadId',e.personnel_head_id::text,'personnelFingerprint',e.personnel_fingerprint,'qualification',e.qualification_original,'fingerprint',e.fingerprint) order by e.revision) from public.personnel_review_events e where e.root_id=r.id))
 from public.personnel_review_roots r join lateral(select e.* from public.personnel_review_events e where e.root_id=r.id order by e.revision desc limit 1)h on true where r.id=root_ref
$$;
create or replace function care_personnel_review_private.read_review_page(t uuid,c uuid,actor uuid,at_cursor timestamptz,id_cursor uuid,page_size integer)
returns jsonb language plpgsql security definer set search_path='' as $$declare result jsonb;begin
 perform care_personnel_private.actor(t,actor,false);if page_size is null or page_size<1 or page_size>100 or(at_cursor is null)<>(id_cursor is null) then raise exception 'Ungültige Cursor- oder Personalaktenbindung.' using errcode='22023';end if;
 with page as materialized(select r.* from public.personnel_review_roots r where r.tenant_id=t and r.employee_id=c and(at_cursor is null or(r.created_at,r.id)<(at_cursor,id_cursor)) order by r.created_at desc,r.id desc limit page_size)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(care_personnel_review_private.review_original(p.id) order by p.created_at desc,p.id desc) from page p),'[]'::jsonb),'nextCursorRecordedAt',(select to_char(p.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') from page p order by p.created_at,p.id limit 1),'nextCursorId',(select p.id::text from page p order by p.created_at,p.id limit 1)) into result;return result;
end$$;

create or replace function care_personnel_review_private.commit_review(p jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t uuid:=(p->>'tenantId')::uuid;c uuid:=(p->>'employeeId')::uuid;actor uuid:=(p->>'actorId')::uuid;req uuid:=(p->>'requestId')::uuid;action_value text:=p->>'action';expected integer:=(p->>'expectedRevision')::integer;
 source jsonb;source_head uuid;source_fingerprint text;review_root uuid;event_ref uuid:=gen_random_uuid();prior public.personnel_review_events;receipt public.personnel_review_receipts;now_at timestamptz:=clock_timestamp();today date:=(clock_timestamp() at time zone 'Europe/Berlin')::date;
 name text;qualification jsonb:=null;fingerprint text;original jsonb;
begin
 perform care_personnel_private.actor(t,actor,false);
 if jsonb_typeof(p) is distinct from 'object' or length(p::text)>18000000 or not(p ?& array['schemaVersion','action','requestId','tenantId','employeeId','actorId','expectedHeadId','expectedRevision','personnelOriginal','reviewOriginal','reason','requiredChange','rationale'])
 or exists(select 1 from jsonb_object_keys(p) k where k not in('schemaVersion','action','requestId','tenantId','employeeId','actorId','expectedHeadId','expectedRevision','personnelOriginal','reviewOriginal','reason','requiredChange','rationale'))
 or p->>'schemaVersion'<>'1' or action_value not in('request','return','accept') or expected is null or length(p->>'reason')>2000 or length(p->>'requiredChange')>4000 or length(p->>'rationale')>4000 then raise exception 'Personalprüfpaket ist unvollständig.' using errcode='23514';end if;
 perform pg_advisory_xact_lock(hashtextextended(t::text||':'||c::text,0));
 select * into receipt from public.personnel_review_receipts r where r.request_id=req for update;if found then if receipt.tenant_id<>t or receipt.employee_id<>c or receipt.actor_id<>actor or receipt.packet<>p then raise exception 'Anfragekennung ist anders gebunden.' using errcode='P0S01';end if;return jsonb_build_object('requestId',req::text,'packet',p,'original',receipt.original);end if;
 source:=care_personnel_review_private.review_source(t,actor,c);if source is distinct from p->'personnelOriginal' then raise exception 'Vollständiger aktueller Personalbestand wurde verändert.' using errcode='P0S01';end if;
 source_head:=(source#>>'{history,headId}')::uuid;if source_head is null or jsonb_array_length(source#>'{history,events}')<1 then raise exception 'Ein gespeicherter Personalbestand fehlt.' using errcode='23514';end if;
 source_fingerprint:='sha256:'||encode(extensions.digest(convert_to(source::text,'UTF8'),'sha256'),'hex');
 if action_value='request' then perform care_personnel_private.actor(t,actor,true);elsif not public.has_permission('pflege.documentation.sign') or not public.has_permission('office.employees.view_sensitive') then raise exception 'Personalfachprüfrecht fehlt.' using errcode='42501';end if;
 select coalesce(pr.display_name,pr.email) into name from public.profiles pr where pr.id=actor and pr.tenant_id=t and pr.is_active=true;if btrim(coalesce(name,''))='' then raise exception 'Aktiver Akteur fehlt.' using errcode='42501';end if;
 if action_value='request' then
  if expected<>0 or p->'expectedHeadId'<>'null'::jsonb or p->'reviewOriginal'<>'null'::jsonb or length(btrim(p->>'reason'))<10 or p->>'requiredChange'<>'' or p->>'rationale'<>'' then raise exception 'Prüfanfrage darf keine Entscheidung enthalten.' using errcode='23514';end if;
  review_root:=event_ref;insert into public.personnel_review_roots(id,tenant_id,employee_id,personnel_head_id,personnel_fingerprint,created_at) values(review_root,t,c,source_head,source_fingerprint,now_at);
 else
  review_root:=(p#>>'{reviewOriginal,rootId}')::uuid;perform 1 from public.personnel_review_roots r where r.id=review_root and r.tenant_id=t and r.employee_id=c and r.personnel_head_id=source_head and r.personnel_fingerprint=source_fingerprint for update;if not found then raise exception 'Passende unveränderte Personalprüfanfrage fehlt.' using errcode='P0S01';end if;
  select * into prior from public.personnel_review_events e where e.root_id=review_root order by e.revision desc limit 1 for update;if not found or expected<>1 or prior.action<>'request' or prior.id::text<>p->>'expectedHeadId' or care_personnel_review_private.review_original(review_root) is distinct from p->'reviewOriginal' then raise exception 'Personalprüfanfrage hat sich geändert.' using errcode='P0S01';end if;
  if actor=prior.actor_id or exists(select 1 from jsonb_array_elements(source#>'{history,events}') e where e->>'actorId'=actor::text) then raise exception 'Anfragende oder am Personalbestand beteiligte Person darf nicht selbst entscheiden.' using errcode='42501';end if;
  if exists(select 1 from public.employees own where own.id=c and own.tenant_id=t and own.profile_id=actor) then raise exception 'Die geprüfte Person darf ihre eigene Personalaktenfassung nicht entscheiden.' using errcode='42501';end if;
  lock table public.employees,public.employee_employment_details,public.employee_qualifications,public.employee_documents,care_personnel_review_private.review_scopes in share mode;
  select jsonb_build_object('id',q.id::text,'employeeId',e.id::text,'profileId',e.profile_id::text,'qualificationType',q.qualification_type,'title',q.title,'status',q.status,'issuedAt',to_char(q.issued_at,'YYYY-MM-DD'),'validUntil',to_char(q.valid_until,'YYYY-MM-DD'),'verifiedAt',to_char(q.verified_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'updatedAt',to_char(q.updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'documentId',d.id::text,'documentFingerprint',scope.document_fingerprint,'sourceFingerprint',scope.qualification_fingerprint,'employmentStart',to_char(coalesce(e.entry_date,e.start_date),'YYYY-MM-DD'),'employmentEnd',to_char(e.exit_date,'YYYY-MM-DD'),'employeeFingerprint','sha256:'||encode(extensions.digest(convert_to(jsonb_build_object('employee',to_jsonb(e),'employment',to_jsonb(ed))::text,'UTF8'),'sha256'),'hex'),'scopeId',scope.id::text,'scopeKind','personnel_care_review','scopeFingerprint','sha256:'||encode(extensions.digest(convert_to(to_jsonb(scope)::text,'UTF8'),'sha256'),'hex')) into qualification
  from public.employees e join public.employee_employment_details ed on ed.employee_id=e.id and ed.tenant_id=e.tenant_id join public.employee_qualifications q on q.employee_id=e.id and q.tenant_id=e.tenant_id join public.employee_documents d on d.id=q.document_id and d.employee_id=e.id and d.tenant_id=e.tenant_id join care_personnel_review_private.review_scopes scope on scope.employee_id=e.id and scope.qualification_id=q.id and scope.tenant_id=e.tenant_id and scope.kind='personnel_care_review'
  where e.tenant_id=t and e.profile_id=actor and e.status='aktiv' and ed.employment_status='active' and coalesce(e.entry_date,e.start_date)<=today and(e.exit_date is null or e.exit_date>=today) and q.status in('valid','expires_soon') and q.verified_at<=now_at and q.updated_at<=now_at and(q.issued_at is null or q.issued_at<=today) and(q.valid_until is null or q.valid_until>=today) and(d.valid_until is null or d.valid_until>=today) and btrim(coalesce(d.storage_path,''))<>'' and scope.approved_at<=now_at and scope.valid_until>now_at and scope.revoked_at is null and scope.qualification_fingerprint='sha256:'||encode(extensions.digest(convert_to(to_jsonb(q)::text,'UTF8'),'sha256'),'hex') and scope.document_fingerprint='sha256:'||encode(extensions.digest(convert_to(to_jsonb(d)::text,'UTF8'),'sha256'),'hex') order by scope.approved_at desc,scope.id desc limit 1;
  if qualification is null then raise exception 'Aktuelle Beschäftigung, Qualifikation, Dokument und Personalprüfbereich fehlen.' using errcode='42501';end if;
  if action_value='return' then if length(btrim(p->>'reason'))<10 or length(btrim(p->>'requiredChange'))<10 or p->>'rationale'<>'' then raise exception 'Rückgabe benötigt Grund und konkrete Änderung.' using errcode='23514';end if;else if p->>'reason'<>'' or p->>'requiredChange'<>'' or length(btrim(p->>'rationale'))<10 then raise exception 'Fachliche Annahme benötigt eine konkrete Begründung.' using errcode='23514';end if;end if;
 end if;
 fingerprint:='sha256:'||encode(extensions.digest(convert_to(jsonb_build_object('packet',p,'qualification',qualification)::text,'UTF8'),'sha256'),'hex');insert into public.personnel_review_events(id,tenant_id,employee_id,root_id,revision,previous_id,request_id,action,actor_id,actor_name,recorded_at,reason,required_change,rationale,personnel_head_id,personnel_fingerprint,qualification_original,fingerprint,packet) values(event_ref,t,c,review_root,expected+1,case when expected=0 then null else prior.id end,req,action_value,actor,name,now_at,p->>'reason',p->>'requiredChange',p->>'rationale',source_head,source_fingerprint,qualification,fingerprint,p);
 original:=care_personnel_review_private.review_original(review_root);insert into public.personnel_review_receipts(request_id,tenant_id,employee_id,actor_id,root_id,event_id,packet,original,recorded_at) values(req,t,c,actor,review_root,event_ref,p,original,now_at);return jsonb_build_object('requestId',req::text,'packet',p,'original',original);
end$$;
create or replace function care_personnel_review_private.confirm_review(t uuid,c uuid,actor uuid,req uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare r public.personnel_review_receipts;begin perform care_personnel_private.actor(t,actor,false);select * into r from public.personnel_review_receipts x where x.request_id=req and x.tenant_id=t and x.employee_id=c and x.actor_id=actor;if not found or r.packet is distinct from p then raise exception 'Keine passende unveränderliche Personalprüfquittung.' using errcode='P0S03';end if;return jsonb_build_object('requestId',req::text,'packet',r.packet,'original',r.original);end$$;
create or replace function public.web_read_personnel_review_page(p_tenant_id uuid,p_employee_id uuid,p_actor_profile_id uuid,p_cursor_recorded_at timestamptz,p_cursor_id uuid,p_page_size integer)returns jsonb language sql security invoker set search_path='' as $$select care_personnel_review_private.read_review_page(p_tenant_id,p_employee_id,p_actor_profile_id,p_cursor_recorded_at,p_cursor_id,p_page_size)$$;
create or replace function public.web_commit_personnel_review(p_packet jsonb)returns jsonb language sql security invoker set search_path='' as $$select care_personnel_review_private.commit_review(p_packet)$$;
create or replace function public.web_confirm_personnel_review(p_tenant_id uuid,p_employee_id uuid,p_actor_profile_id uuid,p_request_id uuid,p_packet jsonb)returns jsonb language sql security invoker set search_path='' as $$select care_personnel_review_private.confirm_review(p_tenant_id,p_employee_id,p_actor_profile_id,p_request_id,p_packet)$$;
revoke all on function care_personnel_review_private.review_immutable(),care_personnel_review_private.review_source(uuid,uuid,uuid),care_personnel_review_private.review_original(uuid),care_personnel_review_private.read_review_page(uuid,uuid,uuid,timestamptz,uuid,integer),care_personnel_review_private.commit_review(jsonb),care_personnel_review_private.confirm_review(uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.web_read_personnel_review_page(uuid,uuid,uuid,timestamptz,uuid,integer),public.web_commit_personnel_review(jsonb),public.web_confirm_personnel_review(uuid,uuid,uuid,uuid,jsonb) from public,anon;
grant execute on function care_personnel_review_private.read_review_page(uuid,uuid,uuid,timestamptz,uuid,integer),care_personnel_review_private.commit_review(jsonb),care_personnel_review_private.confirm_review(uuid,uuid,uuid,uuid,jsonb),public.web_read_personnel_review_page(uuid,uuid,uuid,timestamptz,uuid,integer),public.web_commit_personnel_review(jsonb),public.web_confirm_personnel_review(uuid,uuid,uuid,uuid,jsonb) to authenticated;
commit;
