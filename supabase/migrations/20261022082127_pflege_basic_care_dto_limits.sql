-- Narrow followup after the immutable BasicCare quarantine base.
-- Persist only author/qualification text accepted by the actual Web DTO parser.
-- No grants, source rewrites or production activation.
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
 perform care_private.basic_care_require(length(btrim(coalesce(name,'')))>0 and length(name)<=500,'Aktueller Dokumentationsname fehlt.');
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
 and btrim(coalesce(q.title,''))<>'' and length(q.title)<=500 and btrim(coalesce(q.qualification_type,''))<>'' and length(q.qualification_type)<=200 and(d.valid_until is null or d.valid_until>=today) and btrim(coalesce(d.storage_path,''))<>''
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
  qualification:=care_private.basic_care_review_qualification(t,a);
  if action_value='return' then perform care_private.basic_care_require(care_private.basic_care_text(p->'reason',10,2000) and care_private.basic_care_text(p->'requiredChange',10,4000) and p->>'rationale'='','Rückgabe benötigt eigenen Grund und konkrete Änderung.');kind_value:='review_return';
  else perform care_private.basic_care_require(p->>'reason'='' and p->>'requiredChange'='' and care_private.basic_care_text(p->'rationale',10,4000),'Fachliche Annahme benötigt eigene Begründung.');kind_value:='review_acceptance';end if;
 end if;
 perform care_private.basic_care_actor(t,c,a,action_value='request');
 if action_value<>'request' then
  if care_private.basic_care_has('pflege.documentation.sign') is not true then raise exception 'Fachprüfrecht wurde beendet.' using errcode='42501';end if;
  if qualification is distinct from care_private.basic_care_review_qualification(t,a) then raise exception 'Beschäftigungs- oder Fachprüfgrundlage wurde verändert.' using errcode='42501';end if;
 end if;
 now_at:=clock_timestamp();perform care_private.basic_care_require(care_private.basic_care_time(p->'occurredAt')<=now_at and care_private.basic_care_time(p->'occurredAt')>=(select e.recorded_at from public.basic_care_events e where e.id=care_head) and(prior.id is null or care_private.basic_care_time(p->'occurredAt')>=prior.recorded_at),'Prüfzeit muss nach der dokumentierten Fassung und vor der aktuellen Serverzeit liegen.');
 select x.display_name into name from public.profiles x where x.id=a and x.tenant_id=t;perform care_private.basic_care_require(length(btrim(coalesce(name,'')))>0 and length(name)<=500,'Aktueller Prüfungsname fehlt.');
 if action_value='request' then insert into public.basic_care_review_roots(id,tenant_id,client_id,basic_care_root_id,care_head_id,care_content_fingerprint,created_at)values(review_root,t,c,care_root,care_head,p#>>'{careOriginal,contentFingerprint}',now_at);end if;
 insert into public.basic_care_review_events(id,tenant_id,client_id,review_root_id,revision,previous_id,request_id,actor_id,actor_name,recorded_at,kind,reason,required_change,rationale,qualification_original,care_head_id,care_content_fingerprint,content_fingerprint,packet,auth_user_id)
 values(event_ref,t,c,review_root,expected+1,prior.id,req,a,name,now_at,kind_value,p->>'reason',p->>'requiredChange',p->>'rationale',qualification,care_head,p#>>'{careOriginal,contentFingerprint}',care_private.basic_care_fingerprint(jsonb_build_object('packet',p,'qualification',qualification)),p,auth.uid());
 original:=care_private.basic_care_review_original(review_root);insert into public.basic_care_review_receipts(request_id,tenant_id,client_id,actor_id,review_root_id,event_id,packet,original,recorded_at)values(req,t,c,a,review_root,event_ref,p,original,now_at);return jsonb_build_object('requestId',req,'packet',p,'original',original);
end$$;
revoke all on function care_private.commit_basic_care_packet(jsonb),care_private.basic_care_review_qualification(uuid,uuid),care_private.commit_basic_care_review(jsonb) from public,anon,authenticated,service_role;
