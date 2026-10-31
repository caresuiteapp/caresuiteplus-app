-- Reconstructed NEW native author-time proof candidate; prior lost hashes/results do not apply.
-- Applied after BasicCare base, DTO limits and exact binding intents. No backfill or grants.
-- Clinical identity proof is bounded to full unchanged version/item authors and actual care participants.
-- Tour contributors are current conservative exclusions only, not historically authenticated authors.
create table if not exists care_private.basic_care_native_author_proofs(
 source_kind text not null check(source_kind in('care_plan_version','care_plan_item')),source_id uuid not null,
 tenant_id uuid not null references public.tenants(id),client_id uuid not null references public.clients(id),native_author_id uuid not null,
 actor_profile_id uuid not null references public.profiles(id),auth_user_id uuid not null,session_id uuid not null,
 author_semantics text not null check(author_semantics in('auth_user_id','profile_id')),native_original jsonb not null check(jsonb_typeof(native_original)='object'),
 native_fingerprint text not null check(length(native_fingerprint)=71 and native_fingerprint~'^sha256:[0-9a-f]{64}$'),profile_original jsonb not null check(jsonb_typeof(profile_original)='object'),captured_at timestamptz not null default clock_timestamp(),primary key(source_kind,source_id)
);
create index if not exists basic_care_native_author_scope on care_private.basic_care_native_author_proofs(tenant_id,client_id,source_kind,source_id);
create table if not exists care_private.basic_care_native_author_retirements(source_kind text not null,source_id uuid not null,retired_at timestamptz not null default clock_timestamp(),primary key(source_kind,source_id),foreign key(source_kind,source_id)references care_private.basic_care_native_author_proofs(source_kind,source_id));
alter table care_private.basic_care_native_author_proofs enable row level security;
alter table care_private.basic_care_native_author_retirements enable row level security;
drop trigger if exists basic_care_native_author_immutable on care_private.basic_care_native_author_proofs;
create trigger basic_care_native_author_immutable before update or delete on care_private.basic_care_native_author_proofs for each row execute function care_private.basic_care_immutable();
drop trigger if exists basic_care_native_author_retirement_immutable on care_private.basic_care_native_author_retirements;
create trigger basic_care_native_author_retirement_immutable before update or delete on care_private.basic_care_native_author_retirements for each row execute function care_private.basic_care_immutable();
create or replace function care_private.capture_basic_care_native_author()returns trigger language plpgsql security definer set search_path='' as $$
declare raw_value jsonb:=to_jsonb(new);t uuid;c uuid;native_actor uuid;actual_actor uuid;actual_user uuid;sid uuid;kind_value text;profile_value jsonb;begin
 if tg_table_name='care_plan_versions'then kind_value:='care_plan_version';elsif tg_table_name='care_plan_items'then kind_value:='care_plan_item';else return new;end if;
 -- Reinserted exact UUID is a new native incarnation, even with byte-identical content or no Auth.
 if exists(select 1 from care_private.basic_care_native_author_proofs p where p.source_kind=kind_value and p.source_id=new.id)then
  insert into care_private.basic_care_native_author_retirements(source_kind,source_id)values(kind_value,new.id)on conflict(source_kind,source_id)do nothing;return new;
 end if;
 -- Unproved native writers retain success; later clinical decisions fail closed.
 begin
  t:=(raw_value->>'tenant_id')::uuid;actual_user:=auth.uid();if actual_user is null or t is null then return new;end if;
  native_actor:=nullif(case when kind_value='care_plan_version'then raw_value->>'actor_id'else raw_value->>'created_by'end,'')::uuid;
  if native_actor is null then return new;end if;actual_actor:=public.resolve_current_profile_id();
  if actual_actor is null or(native_actor<>actual_actor and native_actor<>actual_user)then return new;end if;
  perform care_private.require_workspace_session(t,actual_actor);if care_private.basic_care_has('pflege.plans.manage')is not true then return new;end if;
  select p.client_id into c from public.care_plans p where p.id=(raw_value->>'care_plan_id')::uuid and p.tenant_id=t for share;if c is null then return new;end if;
  select to_jsonb(p)into profile_value from public.profiles p where p.id=actual_actor and p.tenant_id=t and p.is_active and p.status='active'for share;if profile_value is null then return new;end if;
  perform care_private.require_workspace_session(t,actual_actor);sid:=(auth.jwt()->>'session_id')::uuid;if sid is null then return new;end if;
  insert into care_private.basic_care_native_author_proofs(source_kind,source_id,tenant_id,client_id,native_author_id,actor_profile_id,auth_user_id,session_id,author_semantics,native_original,native_fingerprint,profile_original)
  values(kind_value,new.id,t,c,native_actor,actual_actor,actual_user,sid,case when native_actor=actual_user then 'auth_user_id'else 'profile_id'end,raw_value,care_private.basic_care_fingerprint(raw_value),profile_value)on conflict(source_kind,source_id)do nothing;
 exception when others then return new;
 end;return new;
end$$;
drop trigger if exists basic_care_native_version_author_capture on public.care_plan_versions;
create trigger basic_care_native_version_author_capture after insert on public.care_plan_versions for each row execute function care_private.capture_basic_care_native_author();
drop trigger if exists basic_care_native_item_author_capture on public.care_plan_items;
create trigger basic_care_native_item_author_capture after insert on public.care_plan_items for each row execute function care_private.capture_basic_care_native_author();
create or replace function care_private.basic_care_native_author_proof(t uuid,c uuid,kind_value text,source_value jsonb)returns care_private.basic_care_native_author_proofs language plpgsql security definer set search_path='' as $$
declare proof care_private.basic_care_native_author_proofs;native_actor text;begin
 lock table care_private.basic_care_native_author_proofs,care_private.basic_care_native_author_retirements in share mode;
 if kind_value='care_plan_version'then native_actor:=source_value->>'actor_id';elsif kind_value='care_plan_item'then native_actor:=source_value->>'created_by';else raise exception 'Unbekannte ursprüngliche Autorenquelle.'using errcode='42501';end if;
 if exists(select 1 from care_private.basic_care_native_author_retirements r where r.source_kind=kind_value and r.source_id=(source_value->>'id')::uuid)then raise exception 'Neue native Instanz darf keinen früheren Autorenbeleg übernehmen.'using errcode='42501';end if;
 select * into proof from care_private.basic_care_native_author_proofs p where p.source_kind=kind_value and p.source_id=(source_value->>'id')::uuid and p.tenant_id=t and p.client_id=c for share;
 if proof.source_id is null or proof.native_author_id::text is distinct from native_actor or proof.native_original is distinct from source_value
 or proof.native_fingerprint is distinct from care_private.basic_care_fingerprint(proof.native_original)or proof.profile_original->>'id'is distinct from proof.actor_profile_id::text or proof.profile_original->>'tenant_id'is distinct from t::text
 or(proof.author_semantics='auth_user_id'and proof.native_author_id<>proof.auth_user_id)or(proof.author_semantics='profile_id'and proof.native_author_id<>proof.actor_profile_id)
 or(kind_value='care_plan_item'and nullif(source_value->>'updated_by','')is not null and(source_value->>'updated_by')::uuid not in(proof.native_author_id,proof.actor_profile_id,proof.auth_user_id))then
  raise exception 'Unveränderlicher tatsächlicher Autorenbeleg der vollständigen nativen Quelle fehlt.'using errcode='42501';
 end if;return proof;
end$$;
create or replace function care_private.basic_care_involved(t uuid,e jsonb,a uuid,b public.basic_care_plan_bindings)returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb:='[]';proof care_private.basic_care_native_author_proofs;kind_value text;source_value jsonb;native_people uuid[]:=array[]::uuid[];current_people uuid[];person_id uuid;accounts jsonb;begin
 foreach kind_value in array array['care_plan_version','care_plan_item']loop
  source_value:=case when kind_value='care_plan_version'then b.plan_original#>'{sources,planVersion}'else b.plan_original#>'{sources,measure}'end;
  begin proof:=care_private.basic_care_native_author_proof(t,b.client_id,kind_value,source_value);
   result:=result||jsonb_build_array(jsonb_build_object('profileId',proof.actor_profile_id,'authUserIds',jsonb_build_array(proof.auth_user_id),'nativeSourceKind',proof.source_kind,'nativeSourceId',proof.source_id,'nativeSourceFingerprint',proof.native_fingerprint));
   native_people:=array_append(array_append(array_append(native_people,proof.actor_profile_id),proof.native_author_id),proof.auth_user_id);
  exception when insufficient_privilege then null;end;
 end loop;
 select array_agg(distinct x.id)into current_people from(select a id union select(b.plan_original->>'issuedBy')::uuid union select value::uuid from jsonb_array_elements_text(e#>'{assistance,helpers}')union select value::uuid from jsonb_array_elements_text(e#>'{execution,performedBy}')union select nullif(e#>>'{followUp,responsibleProfileId}','')::uuid)x where x.id is not null;
 for person_id in select distinct x.id from(select unnest(current_people)id union select nullif(b.plan_original#>>'{sources,measure,updated_by}','')::uuid union select nullif(b.plan_original#>>'{sources,tour,created_by}','')::uuid union select nullif(b.plan_original#>>'{sources,tour,updated_by}','')::uuid)x where x.id is not null loop
  -- Tagged historical authors retain original Auth; overlapping current tour identities also keep their separate current exclusions.
  if person_id=any(native_people)and not(person_id=any(current_people))and person_id is distinct from nullif(b.plan_original#>>'{sources,tour,created_by}','')::uuid and person_id is distinct from nullif(b.plan_original#>>'{sources,tour,updated_by}','')::uuid then continue;end if;accounts:='[]';
  if person_id=a then accounts:=accounts||jsonb_build_array(auth.uid());end if;if person_id=(b.plan_original->>'issuedBy')::uuid then accounts:=accounts||jsonb_build_array((b.plan_original->>'issuedByAuthUser')::uuid);end if;
  if accounts='[]'::jsonb then select coalesce(jsonb_agg(distinct u.id),'[]'::jsonb)into accounts from public.profiles p join auth.users u on u.id=p.id or u.id=p.auth_user_id where p.id=person_id and p.tenant_id=t;end if;
  result:=result||jsonb_build_array(jsonb_build_object('profileId',person_id,'authUserIds',accounts));
 end loop;return result;
end$$;
create or replace function care_private.basic_care_require_native_authorship(t uuid,c uuid,care_root uuid,b public.basic_care_plan_bindings)returns void language plpgsql security definer set search_path='' as $$
declare kind_value text;source_value jsonb;proof care_private.basic_care_native_author_proofs;event_value record;person jsonb;matched boolean;event_count integer;begin
 if b.tenant_id is distinct from t or b.client_id is distinct from c then raise exception 'Native Autorenquelle gehört nicht zum eigenen Fall.'using errcode='42501';end if;
 foreach kind_value in array array['care_plan_version','care_plan_item']loop
  source_value:=case when kind_value='care_plan_version'then b.plan_original#>'{sources,planVersion}'else b.plan_original#>'{sources,measure}'end;proof:=care_private.basic_care_native_author_proof(t,c,kind_value,source_value);event_count:=0;
  for event_value in select e.involved_auth from public.basic_care_events e where e.root_id=care_root and e.tenant_id=t and e.client_id=c loop
   event_count:=event_count+1;if jsonb_typeof(event_value.involved_auth)is distinct from 'array'then raise exception 'Ursprüngliche beteiligte Konten fehlen.'using errcode='42501';end if;matched:=false;
   for person in select value from jsonb_array_elements(event_value.involved_auth)loop
    if person->>'profileId'=proof.actor_profile_id::text and person->>'nativeSourceKind'=kind_value and person->>'nativeSourceId'=proof.source_id::text and person->>'nativeSourceFingerprint'=proof.native_fingerprint then
     if jsonb_typeof(person->'authUserIds')is distinct from 'array'then raise exception 'Ursprüngliche Autorenkonten sind unvollständig.'using errcode='42501';end if;if person->'authUserIds'@>jsonb_build_array(proof.auth_user_id)then matched:=true;end if;
    end if;
   end loop;if not matched then raise exception 'Tatsächlicher nativer Autorenbeleg fehlt in unveränderter Historie.'using errcode='42501';end if;
  end loop;if event_count=0 then raise exception 'Das tatsächliche eigene Pflegeoriginal fehlt.'using errcode='42501';end if;
 end loop;
end$$;

create or replace function care_private.commit_basic_care_packet(p jsonb)returns jsonb language plpgsql security definer set search_path='' as $$declare t uuid;c uuid;a uuid;req uuid;r uuid;event_ref uuid:=gen_random_uuid();b public.basic_care_plan_bindings;prior public.basic_care_events;receipt public.basic_care_receipts;original jsonb;name text;now_at timestamptz;expected integer;field text;begin
 perform care_private.basic_care_require(care_private.basic_care_keys(p,array['schemaVersion','action','requestId','tenantId','clientId','actorId','expectedHeadId','expectedRevision','entry','reason','original','pressureOriginals','fallOriginals']) and p->'schemaVersion'='"1"'::jsonb and p->>'action' in('create','revise') and jsonb_typeof(p->'expectedRevision')='number' and p->>'expectedRevision'~'^(0|[1-9][0-9]{0,3})$' and(p->>'expectedRevision')::integer<2000 and care_private.basic_care_text(p->'reason',0,2000),'Vollständiges eigenes Grundpflegepaket fehlt.');
 foreach field in array array['requestId','tenantId','clientId','actorId'] loop perform care_private.basic_care_require(care_private.basic_care_uuid(p->field),'Grundpflegekennung ist ungültig.');end loop;
 t:=(p->>'tenantId')::uuid;c:=(p->>'clientId')::uuid;a:=(p->>'actorId')::uuid;req:=(p->>'requestId')::uuid;expected:=(p->>'expectedRevision')::integer;
 perform care_private.basic_care_actor(t,c,a,true);perform pg_advisory_xact_lock(hashtextextended('basic-care-request:'||req,0));perform pg_advisory_xact_lock(hashtextextended('basic-care:'||t||':'||c,0));
 perform care_private.basic_care_actor(t,c,a,true);
 select * into receipt from public.basic_care_receipts x where x.request_id=req for share;
 if found then if receipt.tenant_id<>t or receipt.client_id<>c or receipt.actor_id<>a or receipt.packet is distinct from p or not exists(select 1 from public.basic_care_events e where e.id=receipt.event_id and e.auth_user_id=auth.uid()) then raise exception 'Grundpflegeanfrage ist anders belegt.' using errcode='40001';end if;return jsonb_build_object('requestId',req,'packet',p,'original',receipt.original);end if;
 perform care_private.basic_care_require(care_private.basic_care_uuid(p#>'{entry,planVersionId}') and care_private.basic_care_uuid(p#>'{entry,measureId}') and care_private.basic_care_uuid(p#>'{entry,visitId}'),'Eindeutige native Plan-, Maßnahmen- und Einsatzkennung fehlt.');
 select * into b from public.basic_care_plan_bindings x where x.tenant_id=t and x.client_id=c and x.plan_version_id=(p#>>'{entry,planVersionId}')::uuid and x.measure_id=(p#>>'{entry,measureId}')::uuid and x.visit_id=(p#>>'{entry,visitId}')::uuid for share;
 if b.id is null or care_private.basic_care_binding_current(b) is not true then raise exception 'Aktuelle unveränderte native Planbindung fehlt.' using errcode='40001';end if;
 perform care_private.basic_care_require(p->'pressureOriginals'='null'::jsonb and p->'fallOriginals'='null'::jsonb,'Prophylaxeoriginale sind noch nicht an native Quellen angebunden.');
 perform care_private.validate_basic_care_entry(p->'entry',t,b);
 if p->>'action'='create' then
  perform care_private.basic_care_require(expected=0 and p->'expectedHeadId'='null'::jsonb and p->'original'='null'::jsonb and p->>'reason'='','Neuanlage enthält einen erfundenen historischen Kopf.');r:=event_ref;
 else
  perform care_private.basic_care_require(care_private.basic_care_uuid(p->'expectedHeadId') and care_private.basic_care_text(p->'reason',10,2000),'Fortschreibung benötigt Kopf und konkreten Grund.');
  select * into prior from public.basic_care_events e where e.id=(p->>'expectedHeadId')::uuid and e.tenant_id=t and e.client_id=c for update;
  if prior.id is null or prior.revision<>expected or exists(select 1 from public.basic_care_events n where n.root_id=prior.root_id and n.revision>prior.revision) or care_private.basic_care_original(prior.root_id) is distinct from p->'original' or prior.payload=p->'entry' or not exists(select 1 from public.basic_care_roots x where x.id=prior.root_id and x.plan_binding_id=b.id) then raise exception 'Aktuelles vollständiges Grundpflegeoriginal wurde geändert.' using errcode='40001';end if;r:=prior.root_id;
 end if;
 perform care_private.basic_care_actor(t,c,a,true);perform care_private.validate_basic_care_entry(p->'entry',t,b);now_at:=clock_timestamp();
 select p0.display_name into name from public.profiles p0 where p0.id=a and p0.tenant_id=t;
 perform care_private.basic_care_require(care_private.basic_care_js_text(to_jsonb(name),1,500),'Aktueller Dokumentationsname fehlt.');
 if expected=0 then insert into public.basic_care_roots(id,tenant_id,client_id,kind,plan_binding_id,created_at)values(r,t,c,b.kind,b.id,now_at);end if;
 insert into public.basic_care_events(id,tenant_id,client_id,root_id,revision,previous_id,request_id,actor_id,actor_name,recorded_at,reason,payload,content_fingerprint,packet,auth_user_id,involved_auth)
 values(event_ref,t,c,r,expected+1,prior.id,req,a,name,now_at,p->>'reason',p->'entry',care_private.basic_care_fingerprint(p->'entry'),p,auth.uid(),care_private.basic_care_involved(t,p->'entry',a,b));
 original:=care_private.basic_care_original(r);insert into public.basic_care_receipts(request_id,tenant_id,client_id,actor_id,root_id,event_id,packet,original,recorded_at)values(req,t,c,a,r,event_ref,p,original,now_at);
 return jsonb_build_object('requestId',req,'packet',p,'original',original);
end$$;

create or replace function care_private.basic_care_review_qualification(t uuid,a uuid)returns jsonb language plpgsql security definer set search_path='' as $$declare qvalue jsonb;now_at timestamptz;today date;begin
 -- Locks precede the fresh clock. Generic roles or an arbitrary credential title never imply this scope.
 lock table public.employees,public.employee_employment_details,public.employee_qualifications,public.employee_documents,care_private.basic_care_review_scopes in share mode;
 perform care_private.require_workspace_session(t,a);now_at:=clock_timestamp();today:=(now_at at time zone 'Europe/Berlin')::date;
 select jsonb_build_object('id',q.id,'employeeId',e.id,'profileId',a,'qualificationType',q.qualification_type,'title',q.title,'status',q.status,'validUntil',to_char(q.valid_until,'YYYY-MM-DD'),'verifiedAt',to_char(q.verified_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'updatedAt',to_char(q.updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'sourceFingerprint',sc.qualification_fingerprint,
 'documentId',d.id,'documentFingerprint',sc.document_fingerprint,'scopeId',sc.id,'scopeKind',sc.kind,'scopeFingerprint',care_private.basic_care_fingerprint(to_jsonb(sc)),'employeeFingerprint',care_private.basic_care_fingerprint(jsonb_build_object('employee',to_jsonb(e),'employment',to_jsonb(ed)))) into qvalue
 from public.employees e join public.employee_employment_details ed on ed.employee_id=e.id and ed.tenant_id=e.tenant_id join public.employee_qualifications q on q.employee_id=e.id and q.tenant_id=e.tenant_id join public.employee_documents d on d.id=q.document_id and d.employee_id=e.id and d.tenant_id=e.tenant_id
 join care_private.basic_care_review_scopes sc on sc.employee_id=e.id and sc.qualification_id=q.id and sc.tenant_id=e.tenant_id and sc.kind='basic_care_review'
 where e.tenant_id=t and e.profile_id=a and e.status='aktiv' and ed.employment_status='active' and coalesce(e.entry_date,e.start_date)<=today and(e.entry_date is null or e.entry_date<=today) and(e.start_date is null or e.start_date<=today) and(e.exit_date is null or e.exit_date>=today)
 and q.status in('valid','expires_soon') and q.verified_at is not null and q.verified_at<=now_at and q.updated_at<=now_at and(q.issued_at is null or q.issued_at<=today) and(q.valid_until is null or q.valid_until>=today)
 and care_private.basic_care_js_text(to_jsonb(q.title),1,500)and care_private.basic_care_js_text(to_jsonb(q.qualification_type),1,200) and(d.valid_until is null or d.valid_until>=today) and btrim(coalesce(d.storage_path,''))<>''
 and sc.approved_at<=now_at and sc.valid_until>now_at and sc.revoked_at is null and sc.qualification_fingerprint=care_private.basic_care_fingerprint(to_jsonb(q)) and sc.document_fingerprint=care_private.basic_care_fingerprint(to_jsonb(d))
 order by sc.approved_at desc,sc.id desc limit 1;
 if qvalue is null then raise exception 'Aktuelle Beschäftigung, verifiziertes Dokument und ausdrücklicher Grundpflegeprüfbereich fehlen.' using errcode='42501';end if;return qvalue;
end$$;

create or replace function care_private.commit_basic_care_review(p jsonb)returns jsonb language plpgsql security definer set search_path='' as $$declare t uuid;c uuid;a uuid;req uuid;care_root uuid;care_head uuid;review_root uuid;event_ref uuid:=gen_random_uuid();receipt public.basic_care_review_receipts;prior public.basic_care_review_events;b public.basic_care_plan_bindings;expected integer;field text;action_value text;kind_value text;qualification jsonb;original jsonb;name text;now_at timestamptz;begin
 perform care_private.basic_care_require(care_private.basic_care_keys(p,array['schemaVersion','action','requestId','tenantId','clientId','actorId','occurredAt','expectedReviewHeadId','expectedReviewRevision','careOriginal','reviewOriginal','reason','requiredChange','rationale']) and p->'schemaVersion'='"1"'::jsonb and p->>'action' in('request','return','accept') and jsonb_typeof(p->'expectedReviewRevision')='number' and p->>'expectedReviewRevision'~'^[01]$' and care_private.basic_care_text(p->'reason',0,2000) and care_private.basic_care_text(p->'requiredChange',0,4000) and care_private.basic_care_text(p->'rationale',0,4000),'Vollständiges eigenes Grundpflegeprüfpaket fehlt.');
 foreach field in array array['requestId','tenantId','clientId','actorId'] loop perform care_private.basic_care_require(care_private.basic_care_uuid(p->field),'Prüfkennung ist ungültig.');end loop;
 perform care_private.basic_care_require(care_private.basic_care_uuid(p#>'{careOriginal,rootId}') and care_private.basic_care_uuid(p#>'{careOriginal,headId}'),'Vollständige aktuelle Grundpflegekennung fehlt.');
 t:=(p->>'tenantId')::uuid;c:=(p->>'clientId')::uuid;a:=(p->>'actorId')::uuid;req:=(p->>'requestId')::uuid;expected:=(p->>'expectedReviewRevision')::integer;action_value:=p->>'action';care_root:=(p#>>'{careOriginal,rootId}')::uuid;care_head:=(p#>>'{careOriginal,headId}')::uuid;
 perform care_private.basic_care_actor(t,c,a,false);perform pg_advisory_xact_lock(hashtextextended('basic-care-request:'||req,0));perform pg_advisory_xact_lock(hashtextextended('basic-care:'||t||':'||c,0));
 perform care_private.basic_care_actor(t,c,a,false);
 select * into receipt from public.basic_care_review_receipts r where r.request_id=req for share;
 if found then if receipt.tenant_id<>t or receipt.client_id<>c or receipt.actor_id<>a or receipt.packet is distinct from p or not exists(select 1 from public.basic_care_review_events e where e.id=receipt.event_id and e.auth_user_id=auth.uid()) then raise exception 'Prüfanfrage ist anders belegt.' using errcode='40001';end if;return jsonb_build_object('requestId',req,'packet',p,'original',receipt.original);end if;
 perform 1 from public.basic_care_roots r where r.id=care_root and r.tenant_id=t and r.client_id=c for share;
 if not found or care_private.basic_care_original(care_root) is distinct from p->'careOriginal' or p#>>'{careOriginal,headId}' is distinct from care_head::text then raise exception 'Aktuelles vollständiges Grundpflegeoriginal fehlt.' using errcode='40001';end if;
 select x.* into b from public.basic_care_roots r join public.basic_care_plan_bindings x on x.id=r.plan_binding_id where r.id=care_root;
 if care_private.basic_care_binding_current(b) is not true then raise exception 'Native Planbindung wurde seit der Dokumentation verändert.' using errcode='40001';end if;
 perform care_private.basic_care_require(p#>>'{careOriginal,payload,lifecycle}'='completed' and p#>>'{careOriginal,payload,execution,outcome}' not in('planned','offered'),'Planung oder offenes weiteres Vorgehen ist keine abgeschlossene tatsächliche Versorgung.');
 if action_value='request' then
  perform care_private.basic_care_actor(t,c,a,true);
  perform care_private.basic_care_require(expected=0 and p->'expectedReviewHeadId'='null'::jsonb and p->'reviewOriginal'='null'::jsonb and care_private.basic_care_text(p->'reason',10,2000) and p->>'requiredChange'='' and p->>'rationale'='','Prüfanfrage darf keine Fachentscheidung vorwegnehmen.');
  review_root:=event_ref;kind_value:='review_request';
 else
  if care_private.basic_care_has('pflege.documentation.sign') is not true then raise exception 'Eigenes Fachprüfrecht fehlt.' using errcode='42501';end if;
  perform care_private.basic_care_require(care_private.basic_care_uuid(p->'expectedReviewHeadId'),'Aktueller Prüfkopf fehlt.');review_root:=(p#>>'{reviewOriginal,rootId}')::uuid;
  select * into prior from public.basic_care_review_events e where e.review_root_id=review_root and e.tenant_id=t and e.client_id=c order by e.revision desc limit 1 for update;
  if prior.id is null or prior.id<>(p->>'expectedReviewHeadId')::uuid or prior.revision<>expected or expected<>1 or prior.kind<>'review_request' or care_private.basic_care_review_original(review_root) is distinct from p->'reviewOriginal' or prior.care_head_id<>care_head or prior.care_content_fingerprint is distinct from p#>>'{careOriginal,contentFingerprint}' then raise exception 'Aktuelle unveränderte Prüfanfrage fehlt.' using errcode='40001';end if;
  if prior.actor_id=a or prior.auth_user_id is null or prior.auth_user_id=auth.uid() or exists(select 1 from public.basic_care_events e where e.root_id=care_root and(e.actor_id=a or e.auth_user_id is null or e.auth_user_id=auth.uid() or e.involved_auth is null or exists(select 1 from jsonb_array_elements(e.involved_auth)person where person->>'profileId'=a::text or jsonb_array_length(person->'authUserIds')=0 or person->'authUserIds'@>jsonb_build_array(auth.uid())))) then raise exception 'Anfragende, planende, dokumentierende oder ausführende Person und dasselbe angemeldete Konto dürfen nicht selbst entscheiden.' using errcode='42501';end if;
  perform care_private.basic_care_require_native_authorship(t,c,care_root,b);
  qualification:=care_private.basic_care_review_qualification(t,a);
  if action_value='return' then perform care_private.basic_care_require(care_private.basic_care_text(p->'reason',10,2000) and care_private.basic_care_text(p->'requiredChange',10,4000) and p->>'rationale'='','Rückgabe benötigt eigenen Grund und konkrete Änderung.');kind_value:='review_return';
  else perform care_private.basic_care_require(p->>'reason'='' and p->>'requiredChange'='' and care_private.basic_care_text(p->'rationale',10,4000),'Fachliche Annahme benötigt eigene Begründung.');kind_value:='review_acceptance';end if;
 end if;
 perform care_private.basic_care_actor(t,c,a,action_value='request');
 if action_value<>'request' then
  if care_private.basic_care_has('pflege.documentation.sign') is not true then raise exception 'Fachprüfrecht wurde beendet.' using errcode='42501';end if;
  perform care_private.basic_care_require_native_authorship(t,c,care_root,b);
  if qualification is distinct from care_private.basic_care_review_qualification(t,a) then raise exception 'Beschäftigungs- oder Fachprüfgrundlage wurde verändert.' using errcode='42501';end if;
 end if;
 now_at:=clock_timestamp();perform care_private.basic_care_require(care_private.basic_care_time(p->'occurredAt')<=now_at and care_private.basic_care_time(p->'occurredAt')>=(select e.recorded_at from public.basic_care_events e where e.id=care_head) and(prior.id is null or care_private.basic_care_time(p->'occurredAt')>=prior.recorded_at),'Prüfzeit muss nach der dokumentierten Fassung und vor der aktuellen Serverzeit liegen.');
 select x.display_name into name from public.profiles x where x.id=a and x.tenant_id=t;perform care_private.basic_care_require(care_private.basic_care_js_text(to_jsonb(name),1,500),'Aktueller Prüfungsname fehlt.');
 if action_value='request' then insert into public.basic_care_review_roots(id,tenant_id,client_id,basic_care_root_id,care_head_id,care_content_fingerprint,created_at)values(review_root,t,c,care_root,care_head,p#>>'{careOriginal,contentFingerprint}',now_at);end if;
 insert into public.basic_care_review_events(id,tenant_id,client_id,review_root_id,revision,previous_id,request_id,actor_id,actor_name,recorded_at,kind,reason,required_change,rationale,qualification_original,care_head_id,care_content_fingerprint,content_fingerprint,packet,auth_user_id)
 values(event_ref,t,c,review_root,expected+1,prior.id,req,a,name,now_at,kind_value,p->>'reason',p->>'requiredChange',p->>'rationale',qualification,care_head,p#>>'{careOriginal,contentFingerprint}',care_private.basic_care_fingerprint(jsonb_build_object('packet',p,'qualification',qualification)),p,auth.uid());
 original:=care_private.basic_care_review_original(review_root);insert into public.basic_care_review_receipts(request_id,tenant_id,client_id,actor_id,review_root_id,event_id,packet,original,recorded_at)values(req,t,c,a,review_root,event_ref,p,original,now_at);return jsonb_build_object('requestId',req,'packet',p,'original',original);
end$$;

create or replace function care_private.basic_care_state(t uuid,c uuid,a uuid)returns text language plpgsql security definer set search_path='' as $$declare sources jsonb;begin
 perform care_private.basic_care_actor(t,c,a,false);
 select jsonb_build_object('nativeAuthorProofs',coalesce((select jsonb_agg(to_jsonb(p)order by p.source_kind,p.source_id)from care_private.basic_care_native_author_proofs p where p.tenant_id=t and p.client_id=c),'[]'::jsonb),'nativeAuthorRetirements',coalesce((select jsonb_agg(to_jsonb(r)order by r.source_kind,r.source_id)from care_private.basic_care_native_author_retirements r join care_private.basic_care_native_author_proofs p using(source_kind,source_id)where p.tenant_id=t and p.client_id=c),'[]'::jsonb),'client',(select to_jsonb(x) from public.clients x where x.id=c and x.tenant_id=t),'assignment',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from public.client_module_assignments x where x.client_id=c and x.tenant_id=t),'[]'::jsonb),'actor',(select to_jsonb(x) from public.profiles x where x.id=a and x.tenant_id=t),'ownRole',(select to_jsonb(r) from public.roles r join public.profiles x on x.role_id=r.id where x.id=a and x.tenant_id=t),'rolePermissions',coalesce((select jsonb_agg(to_jsonb(z) order by z.permission_key) from public.role_permissions z join public.profiles x on x.role_id=z.role_id where x.id=a and x.tenant_id=t),'[]'::jsonb),'tenantPermissionSets',coalesce((select jsonb_agg(to_jsonb(z) order by z.permission_key) from public.role_permission_sets z join public.roles r on r.key=z.role_key join public.profiles x on x.role_id=r.id where x.id=a and x.tenant_id=t and z.tenant_id=t),'[]'::jsonb),'bindings',coalesce((select jsonb_agg(to_jsonb(b) order by b.id) from public.basic_care_plan_bindings b where b.tenant_id=t and b.client_id=c),'[]'::jsonb),'care',coalesce((select jsonb_agg(to_jsonb(e) order by e.id) from public.basic_care_events e where e.tenant_id=t and e.client_id=c),'[]'::jsonb),'reviews',coalesce((select jsonb_agg(to_jsonb(e) order by e.id) from public.basic_care_review_events e where e.tenant_id=t and e.client_id=c),'[]'::jsonb),
 'plans',coalesce((select jsonb_agg(to_jsonb(p) order by p.id) from public.care_plans p where p.tenant_id=t and p.client_id=c),'[]'::jsonb),'versions',coalesce((select jsonb_agg(to_jsonb(v) order by v.id) from public.care_plan_versions v join public.care_plans p on p.id=v.care_plan_id and p.tenant_id=v.tenant_id where p.tenant_id=t and p.client_id=c),'[]'::jsonb),'measures',coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from public.care_plan_items i join public.care_plans p on p.id=i.care_plan_id and p.tenant_id=i.tenant_id where p.tenant_id=t and p.client_id=c),'[]'::jsonb),'visits',coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object('tour',to_jsonb(tr)) order by s.id) from public.care_tour_stops s join public.care_tours tr on tr.id=s.tour_id and tr.tenant_id=s.tenant_id where s.tenant_id=t and s.client_id=c),'[]'::jsonb)) into sources;
 perform care_private.basic_care_actor(t,c,a,false);return care_private.basic_care_fingerprint(sources);
end$$;
revoke all on care_private.basic_care_native_author_proofs,care_private.basic_care_native_author_retirements from public,anon,authenticated,service_role;
revoke all on function care_private.capture_basic_care_native_author(),care_private.basic_care_native_author_proof(uuid,uuid,text,jsonb),care_private.basic_care_involved(uuid,jsonb,uuid,public.basic_care_plan_bindings),care_private.basic_care_require_native_authorship(uuid,uuid,uuid,public.basic_care_plan_bindings),care_private.commit_basic_care_packet(jsonb),care_private.basic_care_review_qualification(uuid,uuid),care_private.commit_basic_care_review(jsonb),care_private.basic_care_state(uuid,uuid,uuid) from public,anon,authenticated,service_role;
