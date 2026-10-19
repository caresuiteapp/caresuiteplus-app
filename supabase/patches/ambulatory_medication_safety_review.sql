-- PREPARED ONLY. Requires ambulatory_medication_safety_packet.sql.
-- No production execution, no inferred medication administration and no automatic clinical acceptance.
begin;
create schema if not exists care_private;
revoke all on schema care_private from public,anon;
grant usage on schema care_private to authenticated;

create table if not exists care_private.medication_safety_review_scopes(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),
 employee_id uuid not null references public.employees(id),qualification_id uuid not null references public.employee_qualifications(id),
 kind text not null check(kind in('reconciliation','order_capture','schedule_version','administration','late_administration','non_administration','prn_administration','effect_review','safety_signal','controlled_witness','preparation_stock','order_pause_stop','prn_interval_check','maximum_dose_check','controlled_ledger','correction')),
 qualification_fingerprint text not null check(qualification_fingerprint~'^sha256:[0-9a-f]{64}$'),
 document_fingerprint text not null check(document_fingerprint~'^sha256:[0-9a-f]{64}$'),
 approved_by uuid not null references public.profiles(id),approved_at timestamptz not null,valid_until timestamptz not null,revoked_at timestamptz,
 check(valid_until>approved_at)
);
create table if not exists public.medication_safety_review_roots(
 id uuid primary key,tenant_id uuid not null,client_id uuid not null,medication_id uuid not null,
 medication_root_id uuid not null,medication_head_id uuid not null references public.medication_safety_events(id),
 medication_fingerprint text not null,medication_kind text not null,created_at timestamptz not null,
 unique(id,tenant_id,client_id,medication_id),unique(tenant_id,client_id,medication_id,medication_head_id)
);
create table if not exists public.medication_safety_review_events(
 id uuid primary key,tenant_id uuid not null,client_id uuid not null,medication_id uuid not null,root_id uuid not null,
 revision integer not null check(revision in(1,2)),previous_id uuid,request_id uuid not null unique,
 action text not null check(action in('request','return','accept')),actor_id uuid not null references public.profiles(id),actor_name text not null,
 recorded_at timestamptz not null,reason text not null,required_change text not null,rationale text not null,
 medication_head_id uuid not null,medication_fingerprint text not null,qualification_original jsonb,fingerprint text not null,packet jsonb not null,
 unique(root_id,revision),unique(id,root_id),foreign key(root_id,tenant_id,client_id,medication_id) references public.medication_safety_review_roots(id,tenant_id,client_id,medication_id),
 foreign key(previous_id,root_id) references public.medication_safety_review_events(id,root_id),
 check((revision=1)=(previous_id is null)),check((action='request')=(revision=1)),check((action='request')=(qualification_original is null))
);
create table if not exists public.medication_safety_review_receipts(
 request_id uuid primary key,tenant_id uuid not null,client_id uuid not null,medication_id uuid not null,actor_id uuid not null,
 root_id uuid not null,event_id uuid not null,packet jsonb not null,original jsonb not null,recorded_at timestamptz not null,
 foreign key(event_id,root_id) references public.medication_safety_review_events(id,root_id)
);
create index if not exists medication_safety_review_page on public.medication_safety_review_roots(tenant_id,client_id,medication_id,created_at desc,id desc);
alter table care_private.medication_safety_review_scopes enable row level security;
alter table public.medication_safety_review_roots enable row level security;
alter table public.medication_safety_review_events enable row level security;
alter table public.medication_safety_review_receipts enable row level security;
revoke all on care_private.medication_safety_review_scopes,public.medication_safety_review_roots,public.medication_safety_review_events,public.medication_safety_review_receipts from public,anon,authenticated;

create or replace function care_private.medication_safety_review_immutable()
returns trigger language plpgsql security invoker set search_path='' as $$begin raise exception 'Medikationsprüforiginale und Quittungen sind unveränderlich.' using errcode='23514';end$$;
do $$declare tab text;begin foreach tab in array array['medication_safety_review_roots','medication_safety_review_events','medication_safety_review_receipts'] loop execute format('drop trigger if exists medication_safety_review_immutable on public.%I',tab);execute format('create trigger medication_safety_review_immutable before update or delete on public.%I for each row execute function care_private.medication_safety_review_immutable()',tab);end loop;end$$;

create or replace function care_private.medication_safety_review_original(root_ref uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',h.id::text,'tenantId',r.tenant_id::text,'clientId',r.client_id::text,'medicationId',r.medication_id::text,'rootId',r.id::text,'headId',h.id::text,'revision',h.revision,
 'medicationRootId',r.medication_root_id::text,'medicationHeadId',r.medication_head_id::text,'medicationFingerprint',r.medication_fingerprint,'medicationKind',r.medication_kind,
 'status',case h.action when 'request' then 'requested' when 'return' then 'returned' else 'accepted' end,
 'history',(select jsonb_agg(jsonb_build_object('id',e.id::text,'revision',e.revision,'previousId',e.previous_id::text,'requestId',e.request_id::text,
 'action',e.action,'recordedAt',to_char(e.recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'actorId',e.actor_id::text,'actorName',e.actor_name,
 'reason',e.reason,'requiredChange',e.required_change,'rationale',e.rationale,'medicationHeadId',e.medication_head_id::text,'medicationFingerprint',e.medication_fingerprint,
 'qualification',e.qualification_original,'fingerprint',e.fingerprint) order by e.revision) from public.medication_safety_review_events e where e.root_id=r.id))
 from public.medication_safety_review_roots r join lateral(select e.* from public.medication_safety_review_events e where e.root_id=r.id order by e.revision desc limit 1)h on true where r.id=root_ref
$$;
create or replace function care_private.read_medication_safety_review_page(t uuid,c uuid,m uuid,actor uuid,at_cursor timestamptz,id_cursor uuid,page_size integer)
returns jsonb language plpgsql security definer set search_path='' as $$declare result jsonb;begin
 perform care_private.medication_packet_actor('pflege.medications.view',t,c,m,actor);
 if page_size is null or page_size<1 or page_size>100 or(at_cursor is null)<>(id_cursor is null) then raise exception 'Ungültige Cursorbindung.' using errcode='22023';end if;
 with page as materialized(select r.* from public.medication_safety_review_roots r where r.tenant_id=t and r.client_id=c and r.medication_id=m and(at_cursor is null or(r.created_at,r.id)<(at_cursor,id_cursor)) order by r.created_at desc,r.id desc limit page_size)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(care_private.medication_safety_review_original(p.id) order by p.created_at desc,p.id desc) from page p),'[]'::jsonb),
 'nextCursorRecordedAt',(select to_char(p.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') from page p order by p.created_at,p.id limit 1),
 'nextCursorId',(select p.id::text from page p order by p.created_at,p.id limit 1)) into result;return result;
end$$;

create or replace function care_private.commit_medication_safety_review(p jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t uuid:=(p->>'tenantId')::uuid;c uuid:=(p->>'clientId')::uuid;m uuid:=(p->>'medicationId')::uuid;actor uuid:=(p->>'actorId')::uuid;req uuid:=(p->>'requestId')::uuid;action_value text:=p->>'action';
 medication_root uuid:=(p#>>'{medicationOriginal,rootId}')::uuid;medication_head uuid:=(p#>>'{medicationOriginal,headId}')::uuid;medication jsonb;latest public.medication_safety_events;
 review_root uuid;event_ref uuid:=gen_random_uuid();prior public.medication_safety_review_events;receipt public.medication_safety_review_receipts;
 now_at timestamptz:=clock_timestamp();today date:=(clock_timestamp() at time zone 'Europe/Berlin')::date;expected integer:=(p->>'expectedRevision')::integer;name text;qualification jsonb:=null;fingerprint text;original jsonb;
begin
 perform care_private.medication_packet_actor(case when action_value='request' then 'pflege.medications.manage' else 'pflege.documentation.sign' end,t,c,m,actor);
 if jsonb_typeof(p) is distinct from 'object' or not(p ?& array['schemaVersion','action','requestId','tenantId','clientId','medicationId','actorId','expectedHeadId','expectedRevision','medicationOriginal','reviewOriginal','reason','requiredChange','rationale'])
 or exists(select 1 from jsonb_object_keys(p) k where k not in('schemaVersion','action','requestId','tenantId','clientId','medicationId','actorId','expectedHeadId','expectedRevision','medicationOriginal','reviewOriginal','reason','requiredChange','rationale'))
 or p->>'schemaVersion' is distinct from '1' or action_value not in('request','return','accept') or t is null or c is null or m is null or actor is null or req is null or expected is null
 or jsonb_typeof(p->'reason') is distinct from 'string' or jsonb_typeof(p->'requiredChange') is distinct from 'string' or jsonb_typeof(p->'rationale') is distinct from 'string'
 or length(p->>'reason')>2000 or length(p->>'requiredChange')>4000 or length(p->>'rationale')>4000 then raise exception 'Medikationsprüfpaket ist unvollständig.' using errcode='23514';end if;
 perform pg_advisory_xact_lock(hashtextextended(t::text||':'||c::text||':'||m::text,0));
 select * into receipt from public.medication_safety_review_receipts r where r.request_id=req for update;
 if found then if receipt.tenant_id<>t or receipt.client_id<>c or receipt.medication_id<>m or receipt.actor_id<>actor or receipt.packet<>p then raise exception 'Anfragekennung ist anders gebunden.' using errcode='40001';end if;return jsonb_build_object('requestId',req::text,'packet',p,'original',receipt.original);end if;
 select * into latest from public.medication_safety_events e where e.tenant_id=t and e.client_id=c and e.medication_id=m and e.root_id=medication_root order by e.revision desc limit 1 for update;
 if not found or latest.id<>medication_head then raise exception 'Aktuelle unveränderte Medikationsfassung fehlt.' using errcode='40001';end if;
 medication:=care_private.medication_original(medication_head);
 if medication is distinct from p->'medicationOriginal' or medication->>'contentFingerprint' is distinct from latest.content_fingerprint or medication->>'voided' is distinct from 'false' or medication#>>'{payload,lifecycle}' is distinct from 'completed' then raise exception 'Unverändertes abgeschlossenes Medikationsoriginal fehlt.' using errcode='40001';end if;
 if (medication->>'kind' in('administration','late_administration','prn_administration') and medication#>>'{payload,administration,outcome}' not in('administered','late')) or (medication->>'kind'='non_administration' and medication#>>'{payload,administration,outcome}' not in('omitted','refused','held')) then raise exception 'Planung oder Auswahl belegt kein tatsächliches Medikationsereignis.' using errcode='23514';end if;
 select coalesce(pr.display_name,pr.email) into name from public.profiles pr where pr.id=actor and pr.tenant_id=t and pr.is_active=true;if btrim(coalesce(name,''))='' then raise exception 'Aktiver Akteur fehlt.' using errcode='42501';end if;
 if action_value='request' then
  if expected<>0 or p->'expectedHeadId' is distinct from 'null'::jsonb or p->'reviewOriginal' is distinct from 'null'::jsonb or length(btrim(p->>'reason'))<10 or p->>'requiredChange'<>'' or p->>'rationale'<>'' then raise exception 'Prüfanfrage darf keine Entscheidung enthalten.' using errcode='23514';end if;
  review_root:=gen_random_uuid();insert into public.medication_safety_review_roots(id,tenant_id,client_id,medication_id,medication_root_id,medication_head_id,medication_fingerprint,medication_kind,created_at) values(review_root,t,c,m,medication_root,medication_head,medication->>'contentFingerprint',medication->>'kind',now_at);
 else
  review_root:=(p#>>'{reviewOriginal,rootId}')::uuid;
  perform 1 from public.medication_safety_review_roots r where r.id=review_root and r.tenant_id=t and r.client_id=c and r.medication_id=m and r.medication_root_id=medication_root and r.medication_head_id=medication_head for update;if not found then raise exception 'Passende Medikationsprüfanfrage fehlt.' using errcode='40001';end if;
  select * into prior from public.medication_safety_review_events e where e.root_id=review_root order by e.revision desc limit 1 for update;
  if not found or expected<>1 or prior.revision<>expected or prior.action<>'request' or prior.id::text is distinct from p->>'expectedHeadId' or care_private.medication_safety_review_original(review_root) is distinct from p->'reviewOriginal' then raise exception 'Medikationsprüfanfrage hat sich geändert.' using errcode='40001';end if;
  if actor=prior.actor_id or exists(select 1 from jsonb_array_elements(medication->'history') h where h->>'recordedBy'=actor::text or actor::text in(h#>>'{payload,administration,performedBy}',h#>>'{payload,stock,responsibleBy}',h#>>'{payload,correction,approvedBy}')) then raise exception 'Anfragende, dokumentierende, ausführende, bestandsverantwortliche oder freigebende Person darf nicht selbst entscheiden.' using errcode='42501';end if;
  lock table public.employees,public.employee_employment_details,public.employee_qualifications,public.employee_documents,care_private.medication_safety_review_scopes in share mode;
  select jsonb_build_object('id',q.id::text,'employeeId',e.id::text,'profileId',e.profile_id::text,'qualificationType',q.qualification_type,'title',q.title,'status',q.status,
   'issuedAt',to_char(q.issued_at,'YYYY-MM-DD'),'validUntil',to_char(q.valid_until,'YYYY-MM-DD'),'verifiedAt',to_char(q.verified_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'updatedAt',to_char(q.updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
   'documentId',d.id::text,'documentFingerprint',scope.document_fingerprint,'sourceFingerprint',scope.qualification_fingerprint,'employmentStart',to_char(coalesce(e.entry_date,e.start_date),'YYYY-MM-DD'),'employmentEnd',to_char(e.exit_date,'YYYY-MM-DD'),
   'employeeFingerprint','sha256:'||encode(extensions.digest(convert_to(jsonb_build_object('employee',to_jsonb(e),'employment',to_jsonb(ed))::text,'UTF8'),'sha256'),'hex'),
   'scopeId',scope.id::text,'scopeKind',scope.kind,'scopeFingerprint','sha256:'||encode(extensions.digest(convert_to(to_jsonb(scope)::text,'UTF8'),'sha256'),'hex')) into qualification
  from public.employees e join public.employee_employment_details ed on ed.employee_id=e.id and ed.tenant_id=e.tenant_id join public.employee_qualifications q on q.employee_id=e.id and q.tenant_id=e.tenant_id join public.employee_documents d on d.id=q.document_id and d.employee_id=e.id and d.tenant_id=e.tenant_id
  join care_private.medication_safety_review_scopes scope on scope.employee_id=e.id and scope.qualification_id=q.id and scope.tenant_id=e.tenant_id and scope.kind=medication->>'kind'
  where e.tenant_id=t and e.profile_id=actor and e.status='aktiv' and ed.employment_status='active' and coalesce(e.entry_date,e.start_date)<=today and(e.entry_date is null or e.entry_date<=today) and(e.start_date is null or e.start_date<=today) and(e.exit_date is null or e.exit_date>=today)
   and q.status in('valid','expires_soon') and q.verified_at<=now_at and q.updated_at<=now_at and(q.issued_at is null or q.issued_at<=today) and(q.valid_until is null or q.valid_until>=today) and(d.valid_until is null or d.valid_until>=today) and btrim(coalesce(d.storage_path,''))<>''
   and scope.approved_at<=now_at and scope.valid_until>now_at and scope.revoked_at is null and scope.qualification_fingerprint='sha256:'||encode(extensions.digest(convert_to(to_jsonb(q)::text,'UTF8'),'sha256'),'hex') and scope.document_fingerprint='sha256:'||encode(extensions.digest(convert_to(to_jsonb(d)::text,'UTF8'),'sha256'),'hex')
  order by scope.approved_at desc,scope.id desc limit 1;
  if qualification is null then raise exception 'Aktuelle Beschäftigung, Qualifikation, Dokument und Medikationsprüfbereich fehlen.' using errcode='42501';end if;
  if action_value='return' then if length(btrim(p->>'reason'))<10 or length(btrim(p->>'requiredChange'))<10 or p->>'rationale'<>'' then raise exception 'Rückgabe benötigt Grund und konkrete Änderung.' using errcode='23514';end if;
  else if medication#>>'{payload,sourceReview,decision}'='unresolved' or medication#>>'{payload,witness,required}'='true' and medication#>>'{payload,witness,assertion}'<>'independently_authenticated' or p->>'reason'<>'' or p->>'requiredChange'<>'' or length(btrim(p->>'rationale'))<10 then raise exception 'Abgeschlossener Quellenabgleich, erforderliche Zweitsignatur oder fachliche Begründung fehlt.' using errcode='23514';end if;end if;
 end if;
 fingerprint:='sha256:'||encode(extensions.digest(convert_to(jsonb_build_object('packet',p,'qualification',qualification)::text,'UTF8'),'sha256'),'hex');
 insert into public.medication_safety_review_events(id,tenant_id,client_id,medication_id,root_id,revision,previous_id,request_id,action,actor_id,actor_name,recorded_at,reason,required_change,rationale,medication_head_id,medication_fingerprint,qualification_original,fingerprint,packet)
 values(event_ref,t,c,m,review_root,expected+1,case when expected=0 then null else prior.id end,req,action_value,actor,name,now_at,p->>'reason',p->>'requiredChange',p->>'rationale',medication_head,medication->>'contentFingerprint',qualification,fingerprint,p);
 original:=care_private.medication_safety_review_original(review_root);insert into public.medication_safety_review_receipts(request_id,tenant_id,client_id,medication_id,actor_id,root_id,event_id,packet,original,recorded_at) values(req,t,c,m,actor,review_root,event_ref,p,original,now_at);
 return jsonb_build_object('requestId',req::text,'packet',p,'original',original);
end$$;
create or replace function care_private.confirm_medication_safety_review(t uuid,c uuid,m uuid,actor uuid,req uuid,p jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$declare r public.medication_safety_review_receipts;begin perform care_private.medication_packet_actor('pflege.medications.view',t,c,m,actor);select * into r from public.medication_safety_review_receipts x where x.request_id=req and x.tenant_id=t and x.client_id=c and x.medication_id=m and x.actor_id=actor;if not found or r.packet is distinct from p then raise exception 'Keine passende unveränderliche Medikationsprüfquittung.' using errcode='P0H03';end if;return jsonb_build_object('requestId',req::text,'packet',r.packet,'original',r.original);end$$;
create or replace function public.web_read_medication_safety_review_page(p_tenant_id uuid,p_client_id uuid,p_medication_id uuid,p_actor_profile_id uuid,p_cursor_recorded_at timestamptz,p_cursor_id uuid,p_page_size integer)returns jsonb language sql security invoker set search_path='' as $$select care_private.read_medication_safety_review_page(p_tenant_id,p_client_id,p_medication_id,p_actor_profile_id,p_cursor_recorded_at,p_cursor_id,p_page_size)$$;
create or replace function public.web_commit_medication_safety_review(p_packet jsonb)returns jsonb language sql security invoker set search_path='' as $$select care_private.commit_medication_safety_review(p_packet)$$;
create or replace function public.web_confirm_medication_safety_review(p_tenant_id uuid,p_client_id uuid,p_medication_id uuid,p_actor_profile_id uuid,p_request_id uuid,p_packet jsonb)returns jsonb language sql security invoker set search_path='' as $$select care_private.confirm_medication_safety_review(p_tenant_id,p_client_id,p_medication_id,p_actor_profile_id,p_request_id,p_packet)$$;
revoke all on function care_private.medication_safety_review_immutable(),care_private.medication_safety_review_original(uuid),care_private.read_medication_safety_review_page(uuid,uuid,uuid,uuid,timestamptz,uuid,integer),care_private.commit_medication_safety_review(jsonb),care_private.confirm_medication_safety_review(uuid,uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.web_read_medication_safety_review_page(uuid,uuid,uuid,uuid,timestamptz,uuid,integer),public.web_commit_medication_safety_review(jsonb),public.web_confirm_medication_safety_review(uuid,uuid,uuid,uuid,uuid,jsonb) from public,anon;
grant execute on function care_private.read_medication_safety_review_page(uuid,uuid,uuid,uuid,timestamptz,uuid,integer),care_private.commit_medication_safety_review(jsonb),care_private.confirm_medication_safety_review(uuid,uuid,uuid,uuid,uuid,jsonb),public.web_read_medication_safety_review_page(uuid,uuid,uuid,uuid,timestamptz,uuid,integer),public.web_commit_medication_safety_review(jsonb),public.web_confirm_medication_safety_review(uuid,uuid,uuid,uuid,uuid,jsonb) to authenticated;
commit;
