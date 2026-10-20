-- PREPARED ONLY. Requires ambulatory_respiratory_intensive_care_path.sql.
-- No production execution, no inferred reaction and no automatic clinical acceptance.
begin;
create schema if not exists care_private;
revoke all on schema care_private from public,anon;
grant usage on schema care_private to authenticated;

create table if not exists care_private.respiratory_care_review_scopes(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),
 employee_id uuid not null references public.employees(id),qualification_id uuid not null references public.employee_qualifications(id),
 kind text not null check(kind='respiratory_care_review'),qualification_fingerprint text not null check(qualification_fingerprint~'^sha256:[0-9a-f]{64}$'),
 document_fingerprint text not null check(document_fingerprint~'^sha256:[0-9a-f]{64}$'),approved_by uuid not null references public.profiles(id),
 approved_at timestamptz not null,valid_until timestamptz not null,revoked_at timestamptz,check(valid_until>approved_at)
);
create table if not exists public.respiratory_care_review_roots(
 id uuid primary key,tenant_id uuid not null,client_id uuid not null,measurement_id uuid not null,
 care_root_id uuid not null,care_head_id uuid not null references public.respiratory_intensive_care_paths(id),care_fingerprint text not null,care_kind text not null,created_at timestamptz not null,
 unique(id,tenant_id,client_id,measurement_id),unique(tenant_id,client_id,measurement_id,care_head_id)
);
create table if not exists public.respiratory_care_review_events(
 id uuid primary key,tenant_id uuid not null,client_id uuid not null,measurement_id uuid not null,root_id uuid not null,
 revision integer not null check(revision in(1,2)),previous_id uuid,request_id uuid not null unique,action text not null check(action in('request','return','accept')),
 actor_id uuid not null references public.profiles(id),actor_name text not null,recorded_at timestamptz not null,reason text not null,required_change text not null,rationale text not null,
 care_head_id uuid not null,care_fingerprint text not null,qualification_original jsonb,fingerprint text not null,packet jsonb not null,
 unique(root_id,revision),unique(id,root_id),foreign key(root_id,tenant_id,client_id,measurement_id) references public.respiratory_care_review_roots(id,tenant_id,client_id,measurement_id),
 foreign key(previous_id,root_id) references public.respiratory_care_review_events(id,root_id),check((revision=1)=(previous_id is null)),check((action='request')=(revision=1)),check((action='request')=(qualification_original is null))
);
create table if not exists public.respiratory_care_review_receipts(
 request_id uuid primary key,tenant_id uuid not null,client_id uuid not null,measurement_id uuid not null,actor_id uuid not null,
 root_id uuid not null,event_id uuid not null,packet jsonb not null,original jsonb not null,recorded_at timestamptz not null,
 foreign key(event_id,root_id) references public.respiratory_care_review_events(id,root_id)
);
create index if not exists respiratory_care_review_page on public.respiratory_care_review_roots(tenant_id,client_id,measurement_id,created_at desc,id desc);
alter table care_private.respiratory_care_review_scopes enable row level security;
alter table public.respiratory_care_review_roots enable row level security;
alter table public.respiratory_care_review_events enable row level security;
alter table public.respiratory_care_review_receipts enable row level security;
revoke all on care_private.respiratory_care_review_scopes,public.respiratory_care_review_roots,public.respiratory_care_review_events,public.respiratory_care_review_receipts from public,anon,authenticated;

create or replace function care_private.respiratory_care_review_immutable()
returns trigger language plpgsql security invoker set search_path='' as $$begin raise exception 'Atemfachprueforiginale und Quittungen sind unveraenderlich.' using errcode='23514';end$$;
do $$declare tab text;begin foreach tab in array array['respiratory_care_review_roots','respiratory_care_review_events','respiratory_care_review_receipts'] loop execute format('drop trigger if exists respiratory_care_review_immutable on public.%I',tab);execute format('create trigger respiratory_care_review_immutable before update or delete on public.%I for each row execute function care_private.respiratory_care_review_immutable()',tab);end loop;end$$;

create or replace function care_private.respiratory_care_review_original(root_ref uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',h.id::text,'tenantId',r.tenant_id::text,'clientId',r.client_id::text,'measurementId',r.measurement_id::text,'rootId',r.id::text,'headId',h.id::text,'revision',h.revision,
 'careRootId',r.care_root_id::text,'careHeadId',r.care_head_id::text,'careFingerprint',r.care_fingerprint,'careKind',r.care_kind,
 'status',case h.action when 'request' then 'requested' when 'return' then 'returned' else 'accepted' end,
 'history',(select jsonb_agg(jsonb_build_object('id',e.id::text,'revision',e.revision,'previousId',e.previous_id::text,'requestId',e.request_id::text,
 'action',e.action,'recordedAt',to_char(e.recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'actorId',e.actor_id::text,'actorName',e.actor_name,
 'reason',e.reason,'requiredChange',e.required_change,'rationale',e.rationale,'careHeadId',e.care_head_id::text,'careFingerprint',e.care_fingerprint,
 'qualification',e.qualification_original,'fingerprint',e.fingerprint) order by e.revision) from public.respiratory_care_review_events e where e.root_id=r.id))
 from public.respiratory_care_review_roots r join lateral(select e.* from public.respiratory_care_review_events e where e.root_id=r.id order by e.revision desc limit 1)h on true where r.id=root_ref
$$;
create or replace function care_private.read_respiratory_care_review_page(t uuid,c uuid,m uuid,actor uuid,at_cursor timestamptz,id_cursor uuid,page_size integer)
returns jsonb language plpgsql security definer set search_path='' as $$declare result jsonb;begin
 perform care_private.assert_respiratory_path_actor(t,actor,false);
 if public.is_active_pfleger_client(c) is not true or page_size is null or page_size<1 or page_size>100 or(at_cursor is null)<>(id_cursor is null) then raise exception 'Ungueltige Cursor- oder Pflegefallbindung.' using errcode='22023';end if;
 with page as materialized(select r.* from public.respiratory_care_review_roots r where r.tenant_id=t and r.client_id=c and r.measurement_id=m and(at_cursor is null or(r.created_at,r.id)<(at_cursor,id_cursor)) order by r.created_at desc,r.id desc limit page_size)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(care_private.respiratory_care_review_original(p.id) order by p.created_at desc,p.id desc) from page p),'[]'::jsonb),
 'nextCursorRecordedAt',(select to_char(p.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') from page p order by p.created_at,p.id limit 1),
 'nextCursorId',(select p.id::text from page p order by p.created_at,p.id limit 1)) into result;return result;
end$$;

create or replace function care_private.commit_respiratory_care_review(p jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t uuid:=(p->>'tenantId')::uuid;c uuid:=(p->>'clientId')::uuid;m uuid:=(p->>'measurementId')::uuid;actor uuid:=(p->>'actorId')::uuid;req uuid:=(p->>'requestId')::uuid;action_value text:=p->>'action';
 care_root uuid:=(p#>>'{careOriginal,rootId}')::uuid;care_head uuid:=(p#>>'{careOriginal,headId}')::uuid;care jsonb;latest public.respiratory_intensive_care_paths;
 review_root uuid;event_ref uuid:=gen_random_uuid();prior public.respiratory_care_review_events;receipt public.respiratory_care_review_receipts;
 now_at timestamptz:=clock_timestamp();today date:=(clock_timestamp() at time zone 'Europe/Berlin')::date;expected integer:=(p->>'expectedRevision')::integer;name text;qualification jsonb:=null;fingerprint text;original jsonb;
begin
 perform care_private.assert_respiratory_path_actor(t,actor,false);
 if jsonb_typeof(p) is distinct from 'object' or length(p::text)>4000000 or not(p ?& array['schemaVersion','action','requestId','tenantId','clientId','measurementId','actorId','expectedHeadId','expectedRevision','careOriginal','sources','reviewOriginal','reason','requiredChange','rationale'])
 or exists(select 1 from jsonb_object_keys(p) k where k not in('schemaVersion','action','requestId','tenantId','clientId','measurementId','actorId','expectedHeadId','expectedRevision','careOriginal','sources','reviewOriginal','reason','requiredChange','rationale'))
 or p->>'schemaVersion' is distinct from '1' or action_value not in('request','return','accept') or t is null or c is null or m is null or actor is null or req is null or expected is null
 or jsonb_typeof(p->'reason') is distinct from 'string' or jsonb_typeof(p->'requiredChange') is distinct from 'string' or jsonb_typeof(p->'rationale') is distinct from 'string'
 or length(p->>'reason')>2000 or length(p->>'requiredChange')>4000 or length(p->>'rationale')>4000 then raise exception 'Atemfachpruefpaket ist unvollstaendig.' using errcode='23514';end if;
 perform pg_advisory_xact_lock(hashtextextended(t::text||':'||c::text||':'||m::text,0));
 select * into receipt from public.respiratory_care_review_receipts r where r.request_id=req for update;
 if found then if receipt.tenant_id<>t or receipt.client_id<>c or receipt.measurement_id<>m or receipt.actor_id<>actor or receipt.packet<>p then raise exception 'Anfragekennung ist anders gebunden.' using errcode='40001';end if;return jsonb_build_object('requestId',req::text,'packet',p,'original',receipt.original);end if;
 select * into latest from public.respiratory_intensive_care_paths e where e.tenant_id=t and e.client_id=c and e.measurement_id=m and e.root_id=care_root order by e.revision desc limit 1 for update;
 if not found or latest.id<>care_head then raise exception 'Aktuelle unveraenderte Atem-/Intensivpflegefassung fehlt.' using errcode='40001';end if;
 care:=care_private.respiratory_path_original(care_head);
 if care is distinct from p->'careOriginal' or care->>'contentFingerprint' is distinct from latest.content_fingerprint then raise exception 'Unveraendertes abgeschlossenes Atem-/Intensivpflegeoriginal fehlt.' using errcode='40001';end if;
 if care_private.read_respiratory_intensive_care_path_context(t,c,m,actor) is distinct from p->'sources' then raise exception 'Vollstaendige aktuelle Atem-/Intensivpflegequellen wurden veraendert.' using errcode='40001';end if;
 if care->>'kind' not in('intensive_handover','correction') or
  (care->>'kind'='intensive_handover' and (care#>>'{payload,handover,specialistApproval}'<>'approved' or care#>>'{payload,handover,handedOverBy}' is null or care#>>'{payload,handover,approvedBy}' is null or care#>>'{payload,handover,handedOverBy}'=care#>>'{payload,handover,approvedBy}' or care#>>'{payload,handover,handedOverAt}' is null or care#>>'{payload,handover,approvedAt}' is null)) or
  (care->>'kind'='correction' and (care#>>'{payload,correction,targetId}' is null or care#>>'{payload,correction,approvedBy}' is null or care#>>'{payload,correction,approvedAt}' is null or not exists(select 1 from public.respiratory_intensive_care_paths prior_path where prior_path.id=(care#>>'{payload,correction,targetId}')::uuid and prior_path.tenant_id=t and prior_path.client_id=c and prior_path.measurement_id=m and prior_path.kind='intensive_handover' and prior_path.payload#>>'{handover,specialistApproval}'='approved')))
 then raise exception 'Auswahl oder Plan belegt keine tatsaechliche, spezialisiert freigegebene Intensivpflegeuebergabe.' using errcode='23514';end if;
 if action_value='request' then perform care_private.assert_respiratory_path_actor(t,actor,true);elsif not public.has_permission('pflege.documentation.sign') then raise exception 'Atemfachpruefrecht fehlt.' using errcode='42501';end if;
 select coalesce(pr.display_name,pr.email) into name from public.profiles pr where pr.id=actor and pr.tenant_id=t and pr.is_active=true;if btrim(coalesce(name,''))='' then raise exception 'Aktiver Akteur fehlt.' using errcode='42501';end if;
 if action_value='request' then
  if expected<>0 or p->'expectedHeadId' is distinct from 'null'::jsonb or p->'reviewOriginal' is distinct from 'null'::jsonb or length(btrim(p->>'reason'))<10 or p->>'requiredChange'<>'' or p->>'rationale'<>'' then raise exception 'Pruefanfrage darf keine Entscheidung enthalten.' using errcode='23514';end if;
  review_root:=gen_random_uuid();insert into public.respiratory_care_review_roots(id,tenant_id,client_id,measurement_id,care_root_id,care_head_id,care_fingerprint,care_kind,created_at) values(review_root,t,c,m,care_root,care_head,care->>'contentFingerprint',care->>'kind',now_at);
 else
  review_root:=(p#>>'{reviewOriginal,rootId}')::uuid;
  perform 1 from public.respiratory_care_review_roots r where r.id=review_root and r.tenant_id=t and r.client_id=c and r.measurement_id=m and r.care_root_id=care_root and r.care_head_id=care_head for update;if not found then raise exception 'Passende Atemfachpruefanfrage fehlt.' using errcode='40001';end if;
  select * into prior from public.respiratory_care_review_events e where e.root_id=review_root order by e.revision desc limit 1 for update;
  if not found or expected<>1 or prior.revision<>expected or prior.action<>'request' or prior.id::text is distinct from p->>'expectedHeadId' or care_private.respiratory_care_review_original(review_root) is distinct from p->'reviewOriginal' then raise exception 'Atemfachpruefanfrage hat sich geaendert.' using errcode='40001';end if;
  if actor=prior.actor_id or exists(select 1 from jsonb_array_elements(care->'history') h where h->>'recordedBy'=actor::text or actor::text in(h#>>'{payload,oxygen,performedBy}',h#>>'{payload,tracheostomy,performedBy}',h#>>'{payload,suction,performedBy}',h#>>'{payload,ventilation,reviewedBy}',h#>>'{payload,alarm,responsibleBy}',h#>>'{payload,equipment,responsibleBy}',h#>>'{payload,qualification,reviewedBy}',h#>>'{payload,handover,handedOverBy}',h#>>'{payload,handover,approvedBy}',h#>>'{payload,correction,approvedBy}'))
   or exists(select 1 from public.vital_sign_measurements vm where vm.id=m and vm.recorded_by=actor)
   or exists(select 1 from jsonb_array_elements((p#>'{sources,medicalOrders}')||(p#>'{sources,devices}')||(p#>'{sources,calibrations}')||(p#>'{sources,treatmentExecutions}')||(p#>'{sources,qualifications}')||(p#>'{sources,handovers}')) s where actor::text in(s#>>'{payload,recorded_by}',s#>>'{payload,approved_by}',s#>>'{payload,performed_by}',s#>>'{payload,reviewed_by}',s#>>'{payload,responsible_by}',s#>>'{payload,handed_over_by}'))
  then raise exception 'Anfragende, messende, dokumentierende, ausfuehrende, uebergebende oder freigebende Person darf nicht selbst entscheiden.' using errcode='42501';end if;
  lock table public.employees,public.employee_employment_details,public.employee_qualifications,public.employee_documents,care_private.respiratory_care_review_scopes in share mode;
  select jsonb_build_object('id',q.id::text,'employeeId',e.id::text,'profileId',e.profile_id::text,'qualificationType',q.qualification_type,'title',q.title,'status',q.status,
   'issuedAt',to_char(q.issued_at,'YYYY-MM-DD'),'validUntil',to_char(q.valid_until,'YYYY-MM-DD'),'verifiedAt',to_char(q.verified_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'updatedAt',to_char(q.updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
   'documentId',d.id::text,'documentFingerprint',scope.document_fingerprint,'sourceFingerprint',scope.qualification_fingerprint,'employmentStart',to_char(coalesce(e.entry_date,e.start_date),'YYYY-MM-DD'),'employmentEnd',to_char(e.exit_date,'YYYY-MM-DD'),
   'employeeFingerprint','sha256:'||encode(extensions.digest(convert_to(jsonb_build_object('employee',to_jsonb(e),'employment',to_jsonb(ed))::text,'UTF8'),'sha256'),'hex'),
   'scopeId',scope.id::text,'scopeKind','respiratory_care_review','scopeFingerprint','sha256:'||encode(extensions.digest(convert_to(to_jsonb(scope)::text,'UTF8'),'sha256'),'hex')) into qualification
  from public.employees e join public.employee_employment_details ed on ed.employee_id=e.id and ed.tenant_id=e.tenant_id join public.employee_qualifications q on q.employee_id=e.id and q.tenant_id=e.tenant_id join public.employee_documents d on d.id=q.document_id and d.employee_id=e.id and d.tenant_id=e.tenant_id
  join care_private.respiratory_care_review_scopes scope on scope.employee_id=e.id and scope.qualification_id=q.id and scope.tenant_id=e.tenant_id and scope.kind='respiratory_care_review'
  where e.tenant_id=t and e.profile_id=actor and e.status='aktiv' and ed.employment_status='active' and coalesce(e.entry_date,e.start_date)<=today and(e.entry_date is null or e.entry_date<=today) and(e.start_date is null or e.start_date<=today) and(e.exit_date is null or e.exit_date>=today)
   and q.status in('valid','expires_soon') and q.verified_at<=now_at and q.updated_at<=now_at and(q.issued_at is null or q.issued_at<=today) and(q.valid_until is null or q.valid_until>=today) and(d.valid_until is null or d.valid_until>=today) and btrim(coalesce(d.storage_path,''))<>''
   and scope.approved_at<=now_at and scope.valid_until>now_at and scope.revoked_at is null and scope.qualification_fingerprint='sha256:'||encode(extensions.digest(convert_to(to_jsonb(q)::text,'UTF8'),'sha256'),'hex') and scope.document_fingerprint='sha256:'||encode(extensions.digest(convert_to(to_jsonb(d)::text,'UTF8'),'sha256'),'hex')
  order by scope.approved_at desc,scope.id desc limit 1;
  if qualification is null then raise exception 'Aktuelle Beschaeftigung, Qualifikation, Dokument und Atempruefbereich fehlen.' using errcode='42501';end if;
  if action_value='return' then if length(btrim(p->>'reason'))<10 or length(btrim(p->>'requiredChange'))<10 or p->>'rationale'<>'' then raise exception 'Rueckgabe benoetigt Grund und konkrete Aenderung.' using errcode='23514';end if;
  else if p->>'reason'<>'' or p->>'requiredChange'<>'' or length(btrim(p->>'rationale'))<10 then raise exception 'Fachliche Annahme benoetigt eine konkrete Begruendung ohne Rueckgabeinhalt.' using errcode='23514';end if;end if;
 end if;
 fingerprint:='sha256:'||encode(extensions.digest(convert_to(jsonb_build_object('packet',p,'qualification',qualification)::text,'UTF8'),'sha256'),'hex');
 insert into public.respiratory_care_review_events(id,tenant_id,client_id,measurement_id,root_id,revision,previous_id,request_id,action,actor_id,actor_name,recorded_at,reason,required_change,rationale,care_head_id,care_fingerprint,qualification_original,fingerprint,packet)
 values(event_ref,t,c,m,review_root,expected+1,case when expected=0 then null else prior.id end,req,action_value,actor,name,now_at,p->>'reason',p->>'requiredChange',p->>'rationale',care_head,care->>'contentFingerprint',qualification,fingerprint,p);
 original:=care_private.respiratory_care_review_original(review_root);insert into public.respiratory_care_review_receipts(request_id,tenant_id,client_id,measurement_id,actor_id,root_id,event_id,packet,original,recorded_at) values(req,t,c,m,actor,review_root,event_ref,p,original,now_at);
 return jsonb_build_object('requestId',req::text,'packet',p,'original',original);
end$$;
create or replace function care_private.confirm_respiratory_care_review(t uuid,c uuid,m uuid,actor uuid,req uuid,p jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$declare r public.respiratory_care_review_receipts;begin perform care_private.assert_respiratory_path_actor(t,actor,false);if public.is_active_pfleger_client(c) is not true then raise exception 'Aktiver Pflegefall fehlt.' using errcode='42501';end if;select * into r from public.respiratory_care_review_receipts x where x.request_id=req and x.tenant_id=t and x.client_id=c and x.measurement_id=m and x.actor_id=actor;if not found or r.packet is distinct from p then raise exception 'Keine passende unveraenderliche Atemfachpruefquittung.' using errcode='P0H03';end if;return jsonb_build_object('requestId',req::text,'packet',r.packet,'original',r.original);end$$;
create or replace function public.web_read_respiratory_care_review_page(p_tenant_id uuid,p_client_id uuid,p_measurement_id uuid,p_actor_profile_id uuid,p_cursor_recorded_at timestamptz,p_cursor_id uuid,p_page_size integer)returns jsonb language sql security invoker set search_path='' as $$select care_private.read_respiratory_care_review_page(p_tenant_id,p_client_id,p_measurement_id,p_actor_profile_id,p_cursor_recorded_at,p_cursor_id,p_page_size)$$;
create or replace function public.web_commit_respiratory_care_review(p_packet jsonb)returns jsonb language sql security invoker set search_path='' as $$select care_private.commit_respiratory_care_review(p_packet)$$;
create or replace function public.web_confirm_respiratory_care_review(p_tenant_id uuid,p_client_id uuid,p_measurement_id uuid,p_actor_profile_id uuid,p_request_id uuid,p_packet jsonb)returns jsonb language sql security invoker set search_path='' as $$select care_private.confirm_respiratory_care_review(p_tenant_id,p_client_id,p_measurement_id,p_actor_profile_id,p_request_id,p_packet)$$;
revoke all on function care_private.respiratory_care_review_immutable(),care_private.respiratory_care_review_original(uuid),care_private.read_respiratory_care_review_page(uuid,uuid,uuid,uuid,timestamptz,uuid,integer),care_private.commit_respiratory_care_review(jsonb),care_private.confirm_respiratory_care_review(uuid,uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.web_read_respiratory_care_review_page(uuid,uuid,uuid,uuid,timestamptz,uuid,integer),public.web_commit_respiratory_care_review(jsonb),public.web_confirm_respiratory_care_review(uuid,uuid,uuid,uuid,uuid,jsonb) from public,anon;
grant execute on function care_private.read_respiratory_care_review_page(uuid,uuid,uuid,uuid,timestamptz,uuid,integer),care_private.commit_respiratory_care_review(jsonb),care_private.confirm_respiratory_care_review(uuid,uuid,uuid,uuid,uuid,jsonb),public.web_read_respiratory_care_review_page(uuid,uuid,uuid,uuid,timestamptz,uuid,integer),public.web_commit_respiratory_care_review(jsonb),public.web_confirm_respiratory_care_review(uuid,uuid,uuid,uuid,uuid,jsonb) to authenticated;
commit;
