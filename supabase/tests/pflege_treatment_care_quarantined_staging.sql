-- Staging only: real private SQL, synthetic Auth claims and native metadata.
-- All fixtures roll back. No application grants, HTTP login, parallel-transaction,
-- clinical execution, qualification or medical approval evidence is claimed.
-- The outer transaction cannot persist any fixture, even if an assertion fails.
BEGIN;
DO $test$
DECLARE
 t uuid:=gen_random_uuid();u uuid:=gen_random_uuid();s uuid:=gen_random_uuid();r uuid:=gen_random_uuid();
 other_actor uuid:=gen_random_uuid();other_session uuid:=gen_random_uuid();c uuid:=gen_random_uuid();other_client uuid:=gen_random_uuid();
 order_ref uuid:=gen_random_uuid();request1 uuid:=gen_random_uuid();request2 uuid:=gen_random_uuid();request3 uuid:=gen_random_uuid();
 historical_event uuid:=gen_random_uuid();review_request uuid:=gen_random_uuid();head1 uuid;head2 uuid;root1 uuid;
 claims jsonb;other_claims jsonb;sources jsonb;native_order jsonb;entry jsonb;packet jsonb;revision_packet jsonb;second_packet jsonb;
 receipt1 jsonb;receipt2 jsonb;receipt3 jsonb;review_packet jsonb;review_receipt jsonb;historical_original jsonb;
 page1 jsonb;page2 jsonb;tail_page jsonb;value jsonb;bad jsonb;mutation jsonb;key_name text;kind_name text;table_name text;role_name text;action_name text;
 today date:=(clock_timestamp() at time zone 'Europe/Berlin')::date;passed boolean:=false;
BEGIN
 BEGIN
  INSERT INTO public.tenants(id,name) VALUES(t,'CP365 treatment quarantine rollback fixture');
  INSERT INTO public.roles(id,key,name) VALUES(r,'cp365_treatment_'||r,'Synthetic treatment metadata role');
  INSERT INTO public.role_permissions(role_id,permission_key) SELECT r,p.permission_key FROM unnest(ARRAY['pflege.treatment.view','pflege.treatment.manage','pflege.orders.view','pflege.orders.manage','pflege.documentation.sign']) AS p(permission_key);
  INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data) VALUES(u,u||'@example.invalid','{}','{}'),(other_actor,other_actor||'@example.invalid','{}','{}');
  UPDATE public.profiles SET tenant_id=t,role_id=r,role_key='pfleger',is_active=true,status='active',display_name='Synthetic treatment metadata author' WHERE id=u;
  UPDATE public.profiles SET tenant_id=t,role_id=r,role_key='pfleger',is_active=true,status='active',display_name='Synthetic different treatment actor' WHERE id=other_actor;
  INSERT INTO auth.sessions(id,user_id,not_after) VALUES(s,u,clock_timestamp()+interval '1 hour'),(other_session,other_actor,clock_timestamp()+interval '1 hour');
  INSERT INTO public.clients(id,tenant_id,first_name,last_name,status) VALUES(c,t,'CP365','Treatment fixture','aktiv'),(other_client,t,'CP365','Different client fixture','aktiv');
  INSERT INTO public.client_module_assignments(tenant_id,client_id,module_key,status,is_active) VALUES(t,c,'pflege','active',true),(t,other_client,'pflege','active',true);
  INSERT INTO public.care_medical_orders(id,tenant_id,client_id,order_type,title,description,ordering_physician,ordered_at,valid_from,valid_until,insurer_approval_required,insurer_approval_status,insurer_approval_reference,execution_instructions,status,recorded_by,recorded_by_name)
   VALUES(order_ref,t,c,'other_hkp','Synthetic retained native order','Synthetic native description','Synthetic original prescriber',today-2,today-1,today+30,true,'approved','Synthetic approval reference','Retain the exact original synthetic instruction','active',u,'Synthetic original author');
  claims:=jsonb_build_object('sub',u,'role','authenticated','session_id',s,'exp',extract(epoch from clock_timestamp()+interval '1 hour')::bigint);
  other_claims:=jsonb_build_object('sub',other_actor,'role','authenticated','session_id',other_session,'exp',extract(epoch from clock_timestamp()+interval '1 hour')::bigint);
  PERFORM set_config('request.jwt.claims',claims::text,true);
  sources:=care_private.read_treatment_care_context(t,c,u);
  SELECT to_jsonb(o) INTO native_order FROM public.care_medical_orders o WHERE o.id=order_ref;
  IF jsonb_array_length(sources->'orders') IS DISTINCT FROM 1 OR jsonb_array_length(sources->'approvals') IS DISTINCT FROM 1 OR jsonb_array_length(sources->'people') IS DISTINCT FROM 2 OR sources#>>'{orders,0,clientId}' IS DISTINCT FROM c::text OR sources#>>'{orders,0,orderId}' IS DISTINCT FROM order_ref::text THEN RAISE EXCEPTION 'Native treatment context is not bound to exact synthetic sources';END IF;
  value:=care_private.treatment_care_ref(jsonb_build_object('id',other_actor,'recorded_at',sources#>'{orders,0,recordedAt}'),c,null);
  IF jsonb_typeof(value) IS DISTINCT FROM 'object' OR value->>'id' IS DISTINCT FROM other_actor::text OR value->'orderId' IS DISTINCT FROM 'null'::jsonb OR care_private.treatment_care_ref(null,c,null) IS NOT NULL OR care_private.treatment_care_ref('{}'::jsonb,null,null) IS NOT NULL THEN RAISE EXCEPTION 'Nullable source order relation erased a real reference or accepted invalid required source input';END IF;
  FOREACH key_name IN ARRAY ARRAY['orders','approvals','executions','infusions','measurements','invalidations','corrections','people','documents'] LOOP
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(sources->key_name) AS source_rows(item) WHERE jsonb_typeof(source_rows.item) IS DISTINCT FROM 'object' OR source_rows.item->>'clientId' IS DISTINCT FROM c::text OR source_rows.item->>'id' IS NULL OR jsonb_typeof(source_rows.item->'payload') IS DISTINCT FROM 'object' OR (source_rows.item->>'fingerprint' ~ '^sha256:[0-9a-f]{64}$') IS DISTINCT FROM true) THEN RAISE EXCEPTION 'Native source array contains erased/null or malformed references: %',key_name;END IF;
  END LOOP;
  SELECT source_rows.item INTO value FROM jsonb_array_elements(sources->'people') AS source_rows(item) WHERE source_rows.item->>'id'=other_actor::text;
  IF value#>>'{payload,display_name}' IS DISTINCT FROM 'Synthetic different treatment actor' OR value->'orderId' IS DISTINCT FROM 'null'::jsonb OR value->>'fingerprint' IS DISTINCT FROM (SELECT care_private.treatment_care_fingerprint(to_jsonb(p)) FROM public.profiles p WHERE p.id=other_actor) OR (value->'payload'?'phone') IS DISTINCT FROM false THEN RAISE EXCEPTION 'Minimal person projection lost explicit native label, full-row fingerprint or nullable order relation';END IF;
  entry:=jsonb_build_object('kind','order_review','title','Open technical source review','plannedAt',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'occurredAt',null,'clientId',c,'orderId',order_ref,'orderVersion',sources#>'{orders,0,recordedAt}',
   'order',jsonb_build_object('status',native_order->'status','validFrom',native_order->'valid_from','validUntil',native_order->'valid_until','prescriber',native_order->'ordering_physician','scope',native_order->'title','instructions',native_order->'execution_instructions','revisionReason','','previousOrderId',null),
   'payer',jsonb_build_object('state','approved','approvalId',order_ref,'reference',native_order->'insurer_approval_reference','validFrom',native_order->'valid_from','validUntil',native_order->'valid_until','decisionNote','Technical comparison with retained native approval only'),
   'execution','{"treatmentType":"none","outcome":"planned","action":"","substance":"","amount":null,"unit":"","route":"","site":"","device":"","observation":"","deviation":""}'::jsonb,
   'material','{"state":"not_required","originalId":null,"name":"","batch":"","expiresOn":null,"quantity":null,"unit":"","purpose":"","reason":"No material use in technical metadata review"}'::jsonb,
   'qualification','{"state":"unconfirmed","performedBy":null,"reviewedBy":null,"evidence":"","delegation":""}'::jsonb,
   'measurement','{"state":"not_required","measurementId":null,"kind":"","value":"","unit":"","occurredAt":null,"maximumAgeMinutes":null,"reason":"No measurement is derived by this metadata review"}'::jsonb,
   'infusion','{"state":"not_applicable","courseId":null,"headId":null,"sequence":null,"deviceMode":"none","rateMlHour":null,"deliveredMl":null,"remainingMl":null,"sourceNote":""}'::jsonb,
   'followUp','{"state":"pending","scheduledAt":null,"completedAt":null,"responsibleBy":null,"communication":"Technical review remains pending","personDecision":"No clinical decision is derived","result":""}'::jsonb,
   'correction','{"targetId":null,"reason":"","replacementId":null,"approvedBy":null,"approvedAt":null}'::jsonb,'lifecycle','open');
  packet:=jsonb_build_object('schemaVersion','1','action','create','requestId',request1,'tenantId',t,'clientId',c,'orderId',order_ref,'actorId',u,'expectedHeadId',null,'expectedRevision',0,'entry',entry,'reason','','original',null,'sources',sources);
  receipt1:=care_private.commit_treatment_care_packet(packet);head1:=(receipt1#>>'{original,headId}')::uuid;root1:=(receipt1#>>'{original,rootId}')::uuid;
  IF receipt1->'packet' IS DISTINCT FROM packet OR receipt1#>'{original,payload}' IS DISTINCT FROM entry OR receipt1#>>'{original,revision}' IS DISTINCT FROM '1' OR receipt1#>>'{original,recordedBy}' IS DISTINCT FROM u::text OR receipt1#>>'{original,contentFingerprint}' IS DISTINCT FROM care_private.treatment_care_fingerprint(entry) OR jsonb_array_length(receipt1#>'{original,history}') IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'Technical treatment receipt lost original source metadata';END IF;
  IF care_private.commit_treatment_care_packet(packet) IS DISTINCT FROM receipt1 OR care_private.confirm_treatment_care_packet(t,c,order_ref,u,request1,packet) IS DISTINCT FROM receipt1 THEN RAISE EXCEPTION 'Exact technical request retry/confirmation differs';END IF;
  BEGIN PERFORM care_private.commit_treatment_care_packet(jsonb_set(packet,'{entry,title}','"Different data on same request"'));RAISE EXCEPTION 'Conflicting technical request retry accepted';EXCEPTION WHEN check_violation THEN NULL;END;
  BEGIN PERFORM care_private.confirm_treatment_care_packet(t,c,order_ref,u,request1,jsonb_set(packet,'{reason}','"Changed"'));RAISE EXCEPTION 'Changed confirmation packet accepted';EXCEPTION WHEN SQLSTATE 'P0H02' THEN NULL;END;

  -- Actual server validation rejects fabricated native or clinical facts.
  FOREACH kind_name IN ARRAY ARRAY['injection','insulin','infusion','pump','inhalation','instillation','compression','access_drain','other_hkp','order_revision','measurement_link','completion_review','correction'] LOOP
   BEGIN PERFORM care_private.commit_treatment_care_packet(jsonb_set(packet||jsonb_build_object('requestId',gen_random_uuid()),'{entry,kind}',to_jsonb(kind_name)));RAISE EXCEPTION 'Quarantined clinical kind accepted: %',kind_name;EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  END LOOP;
  BEGIN PERFORM care_private.commit_treatment_care_packet(jsonb_set(packet||jsonb_build_object('requestId',gen_random_uuid()),'{entry,lifecycle}','"completed"'));RAISE EXCEPTION 'Technical metadata became clinical completion';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  FOR mutation IN SELECT x.item FROM jsonb_array_elements('[{"path":["order","scope"],"value":"Invented native instruction"},{"path":["order","status"],"value":"paused"},{"path":["payer","reference"],"value":"Invented insurer decision"},{"path":["payer","approvalId"],"value":null},{"path":["execution","action"],"value":"Performed injection"},{"path":["execution","amount"],"value":"0.000"},{"path":["material","state"],"value":"selected"},{"path":["qualification","state"],"value":"independently_confirmed"},{"path":["measurement","state"],"value":"linked"},{"path":["infusion","deviceMode"],"value":"pump"},{"path":["followUp","state"],"value":"completed"},{"path":["correction","reason"],"value":"Invented clinical correction"},{"path":["title"],"value":""}]'::jsonb) AS x(item) LOOP
   BEGIN
    bad:=jsonb_set(entry,ARRAY(SELECT jsonb_array_elements_text(mutation->'path')),mutation->'value');
    PERFORM care_private.commit_treatment_care_packet(packet||jsonb_build_object('requestId',gen_random_uuid(),'entry',bad));
    RAISE EXCEPTION 'Technical metadata accepted a fabricated source/clinical field: %',mutation;
   EXCEPTION WHEN check_violation THEN NULL;END;
  END LOOP;
  BEGIN PERFORM care_private.commit_treatment_care_packet(jsonb_set(packet||jsonb_build_object('requestId',gen_random_uuid()),'{entry,plannedAt}','"2026-02-30T12:00:00Z"'));RAISE EXCEPTION 'Impossible calendar plannedAt accepted';EXCEPTION WHEN datetime_field_overflow THEN NULL;END;
  FOREACH key_name IN ARRAY ARRAY['schemaVersion','reason','original','sources'] LOOP
   BEGIN PERFORM care_private.commit_treatment_care_packet((packet||jsonb_build_object('requestId',gen_random_uuid()))-key_name);RAISE EXCEPTION 'Incomplete technical packet accepted: %',key_name;EXCEPTION WHEN check_violation THEN NULL;END;
  END LOOP;
  BEGIN PERFORM care_private.commit_treatment_care_packet(packet||jsonb_build_object('requestId',gen_random_uuid(),'unexpected',true));RAISE EXCEPTION 'Unknown technical packet key accepted';EXCEPTION WHEN check_violation THEN NULL;END;
  BEGIN PERFORM care_private.commit_treatment_care_packet(packet||jsonb_build_object('requestId',gen_random_uuid(),'sources',jsonb_set(sources,'{people}','[]')));RAISE EXCEPTION 'Partial source snapshot accepted';EXCEPTION WHEN check_violation THEN NULL;END;
  BEGIN UPDATE public.care_medical_orders SET execution_instructions='Changed native instruction' WHERE id=order_ref;PERFORM care_private.commit_treatment_care_packet(packet||jsonb_build_object('requestId',gen_random_uuid()));RAISE EXCEPTION 'Stale full native source snapshot accepted';EXCEPTION WHEN check_violation THEN NULL;END;
  -- Minimal displayed people fields and the full native row fingerprint must both remain current.
  BEGIN UPDATE public.profiles SET display_name='Changed current native person source' WHERE id=other_actor;PERFORM care_private.commit_treatment_care_packet(packet||jsonb_build_object('requestId',gen_random_uuid()));RAISE EXCEPTION 'Changed native people source ignored';EXCEPTION WHEN check_violation THEN NULL;END;
  BEGIN UPDATE public.profiles SET phone='Synthetic omitted profile field changed' WHERE id=other_actor;PERFORM care_private.commit_treatment_care_packet(packet||jsonb_build_object('requestId',gen_random_uuid()));RAISE EXCEPTION 'Full native people fingerprint ignored a field omitted from the UI projection';EXCEPTION WHEN check_violation THEN NULL;END;
  BEGIN UPDATE public.profiles SET is_active=false WHERE id=other_actor;PERFORM care_private.commit_treatment_care_packet(packet||jsonb_build_object('requestId',gen_random_uuid()));RAISE EXCEPTION 'Changed projected native people activity ignored';EXCEPTION WHEN check_violation THEN NULL;END;

  revision_packet:=packet||jsonb_build_object('action','revise','requestId',request2,'expectedHeadId',head1,'expectedRevision',1,'original',receipt1->'original','reason','Clarify the technical review title without any clinical change','entry',jsonb_set(entry,'{title}','"Revised open technical review title"'));
  BEGIN PERFORM care_private.commit_treatment_care_packet(jsonb_set(revision_packet,'{original,payload,title}','"Tampered original"'));RAISE EXCEPTION 'Tampered original accepted in revision';EXCEPTION WHEN check_violation THEN NULL;END;
  BEGIN PERFORM care_private.commit_treatment_care_packet(revision_packet||jsonb_build_object('reason','short'));RAISE EXCEPTION 'Revision without meaningful reason accepted';EXCEPTION WHEN check_violation THEN NULL;END;
  BEGIN PERFORM care_private.commit_treatment_care_packet(revision_packet||jsonb_build_object('entry',entry));RAISE EXCEPTION 'Revision without actual metadata change accepted';EXCEPTION WHEN check_violation THEN NULL;END;
  BEGIN PERFORM care_private.commit_treatment_care_packet(jsonb_set(revision_packet,'{entry,kind}','"payer_review"'));RAISE EXCEPTION 'Revision changed the original technical kind';EXCEPTION WHEN check_violation THEN NULL;END;
  receipt2:=care_private.commit_treatment_care_packet(revision_packet);head2:=(receipt2#>>'{original,headId}')::uuid;
  IF receipt2#>>'{original,rootId}' IS DISTINCT FROM root1::text OR receipt2#>>'{original,revision}' IS DISTINCT FROM '2' OR receipt2#>>'{original,history,1,previousId}' IS DISTINCT FROM head1::text OR receipt2#>'{original,history,0}' IS DISTINCT FROM receipt1#>'{original,history,0}' OR receipt2#>>'{original,history,1,reason}' IS DISTINCT FROM revision_packet->>'reason' THEN RAISE EXCEPTION 'Technical revision rewrote original or severed history';END IF;
  IF care_private.commit_treatment_care_packet(packet) IS DISTINCT FROM receipt1 OR care_private.confirm_treatment_care_packet(t,c,order_ref,u,request1,packet) IS DISTINCT FROM receipt1 OR care_private.treatment_care_original(head1) IS DISTINCT FROM receipt1->'original' OR care_private.commit_treatment_care_packet(revision_packet) IS DISTINCT FROM receipt2 THEN RAISE EXCEPTION 'Historical request receipt changed after later revision';END IF;
  BEGIN PERFORM care_private.commit_treatment_care_packet(revision_packet||jsonb_build_object('requestId',gen_random_uuid()));RAISE EXCEPTION 'Stale head CAS accepted a second successor';EXCEPTION WHEN check_violation THEN NULL;END;

  second_packet:=packet||jsonb_build_object('requestId',request3,'entry',jsonb_set(entry,'{kind}','"payer_review"'));receipt3:=care_private.commit_treatment_care_packet(second_packet);
  page1:=care_private.read_treatment_care_page(t,c,u,null,null,1);
  page2:=care_private.read_treatment_care_page(t,c,u,(page1->>'nextCursorRecordedAt')::timestamptz,(page1->>'nextCursorId')::uuid,1);
  tail_page:=care_private.read_treatment_care_page(t,c,u,(page2->>'nextCursorRecordedAt')::timestamptz,(page2->>'nextCursorId')::uuid,1);
  IF page1->'rows' IS DISTINCT FROM jsonb_build_array(receipt3->'original') OR page2->'rows' IS DISTINCT FROM jsonb_build_array(receipt2->'original') OR tail_page->'rows' IS DISTINCT FROM '[]'::jsonb OR page1->>'stateFingerprint' IS NULL OR page1->'stateFingerprint' IS DISTINCT FROM page2->'stateFingerprint' OR page1->'stateFingerprint' IS DISTINCT FROM tail_page->'stateFingerprint' THEN RAISE EXCEPTION 'Current treatment heads pagination repeated or omitted originals';END IF;
  BEGIN
   UPDATE public.care_medical_orders SET description='Changed native source outside projected treatment rows' WHERE id=order_ref;
   value:=care_private.read_treatment_care_page(t,c,u,null,null,1);
   IF value->'rows' IS DISTINCT FROM page1->'rows' OR value->'stateFingerprint' IS NOT DISTINCT FROM page1->'stateFingerprint' THEN RAISE EXCEPTION 'Off-page native source change was absent from whole-state fingerprint';END IF;
   RAISE EXCEPTION USING ERRCODE='Z0002';
  EXCEPTION WHEN SQLSTATE 'Z0002' THEN NULL;END;
  BEGIN PERFORM care_private.read_treatment_care_page(t,c,u,null,null,null);RAISE EXCEPTION 'Null page size accepted';EXCEPTION WHEN check_violation OR invalid_parameter_value THEN NULL;END;
  BEGIN PERFORM care_private.read_treatment_care_page(t,c,u,null,null,101);RAISE EXCEPTION 'Excess page size accepted';EXCEPTION WHEN check_violation OR invalid_parameter_value THEN NULL;END;
  BEGIN PERFORM care_private.read_treatment_care_page(t,c,u,(receipt1#>>'{original,recordedAt}')::timestamptz,head1,1);RAISE EXCEPTION 'Historical replaced head accepted as current pagination cursor';EXCEPTION WHEN check_violation THEN NULL;END;
  BEGIN PERFORM care_private.read_treatment_care_page(t,c,u,null,head2,1);RAISE EXCEPTION 'Partial treatment cursor accepted';EXCEPTION WHEN check_violation OR invalid_parameter_value THEN NULL;END;
  BEGIN PERFORM care_private.read_treatment_care_page(t,c,u,clock_timestamp(),gen_random_uuid(),1);RAISE EXCEPTION 'Foreign treatment cursor accepted';EXCEPTION WHEN check_violation OR invalid_parameter_value THEN NULL;END;

  -- Only a privileged synthetic historical *metadata* original is seeded here.
  -- The current technical packet writer cannot create completed or clinical events.
  bad:=jsonb_set(jsonb_set(jsonb_set(entry,'{lifecycle}','"completed"'),'{qualification}',jsonb_build_object('state','documented','performedBy',u,'reviewedBy',null,'evidence','Wholly synthetic retained historical metadata qualification','delegation','Wholly synthetic historical metadata delegation')),'{followUp}',jsonb_build_object('state','not_required','scheduledAt',null,'completedAt',null,'responsibleBy',null,'communication','Historical technical-only follow-up explicitly not required','personDecision','Historical technical-only choice retained','result',''));
  INSERT INTO public.treatment_care_events(id,tenant_id,client_id,order_id,root_id,revision,kind,payload,source_snapshot,content_fingerprint,recorded_by,recorded_by_name)
   VALUES(historical_event,t,c,order_ref,historical_event,1,'order_review',bad,sources,care_private.treatment_care_fingerprint(bad),u,'Synthetic retained historical metadata author');
  historical_original:=care_private.treatment_care_original(historical_event);
  review_packet:=jsonb_build_object('schemaVersion','1','action','request','requestId',review_request,'tenantId',t,'clientId',c,'orderId',order_ref,'actorId',u,'expectedHeadId',null,'expectedRevision',0,'treatmentOriginal',historical_original,'reviewOriginal',null,'reason','Request technical inspection of retained historical metadata','requiredChange','','rationale','');
  BEGIN PERFORM care_private.commit_treatment_care_review(review_packet||jsonb_build_object('requestId',gen_random_uuid(),'treatmentOriginal',receipt2->'original'));RAISE EXCEPTION 'Open technical review became completed review request';EXCEPTION WHEN serialization_failure THEN NULL;END;
  review_receipt:=care_private.commit_treatment_care_review(review_packet);
  IF review_receipt#>>'{original,rootId}' IS DISTINCT FROM review_receipt#>>'{original,history,0,id}' OR review_receipt#>>'{original,status}' IS DISTINCT FROM 'requested' OR review_receipt#>>'{original,treatmentHeadId}' IS DISTINCT FROM historical_event::text OR jsonb_array_length(review_receipt#>'{original,history}') IS DISTINCT FROM 1 OR review_receipt#>'{original,history,0,qualification}' IS DISTINCT FROM 'null'::jsonb OR care_private.commit_treatment_care_review(review_packet) IS DISTINCT FROM review_receipt OR care_private.confirm_treatment_care_review(t,c,order_ref,u,review_request,review_packet) IS DISTINCT FROM review_receipt THEN RAISE EXCEPTION 'Historical technical review request/receipt changed facts';END IF;
  BEGIN PERFORM care_private.commit_treatment_care_review(review_packet||jsonb_build_object('reason','Conflicting same-request review metadata'));RAISE EXCEPTION 'Conflicting review replay accepted';EXCEPTION WHEN serialization_failure THEN NULL;END;
  FOREACH action_name IN ARRAY ARRAY['return','accept'] LOOP
   BEGIN PERFORM care_private.commit_treatment_care_review(review_packet||jsonb_build_object('action',action_name,'requestId',gen_random_uuid()));RAISE EXCEPTION 'Quarantined clinical review decision accepted: %',action_name;EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  END LOOP;
  value:=care_private.read_treatment_care_review_page(t,c,order_ref,u,null,null,1);
  IF value->'rows' IS DISTINCT FROM jsonb_build_array(review_receipt->'original') OR care_private.read_treatment_care_review_page(t,c,order_ref,u,(value->>'nextCursorRecordedAt')::timestamptz,(value->>'nextCursorId')::uuid,1)->'rows' IS DISTINCT FROM '[]'::jsonb THEN RAISE EXCEPTION 'Review original pagination mismatch';END IF;
  BEGIN PERFORM care_private.read_treatment_care_review_page(t,c,order_ref,u,null,null,null);RAISE EXCEPTION 'Null review page size accepted';EXCEPTION WHEN invalid_parameter_value OR check_violation THEN NULL;END;
  BEGIN PERFORM care_private.read_treatment_care_review_page(t,c,order_ref,u,null,gen_random_uuid(),1);RAISE EXCEPTION 'Partial review cursor accepted';EXCEPTION WHEN invalid_parameter_value OR check_violation THEN NULL;END;
  BEGIN PERFORM care_private.read_treatment_care_review_page(t,c,order_ref,u,clock_timestamp(),gen_random_uuid(),1);RAISE EXCEPTION 'Foreign review cursor accepted';EXCEPTION WHEN invalid_parameter_value OR check_violation THEN NULL;END;

  -- Reauthorization applies even to exact historical receipt retries.
  BEGIN PERFORM care_private.read_treatment_care_context(t,c,other_actor);RAISE EXCEPTION 'Another same-tenant profile substituted for current actor';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  BEGIN PERFORM care_private.commit_treatment_care_packet(packet||jsonb_build_object('tenantId',gen_random_uuid()));RAISE EXCEPTION 'Foreign tenant accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  BEGIN PERFORM care_private.commit_treatment_care_packet(packet||jsonb_build_object('clientId',other_client));RAISE EXCEPTION 'Foreign client/order binding accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  BEGIN UPDATE auth.sessions SET not_after=clock_timestamp()-interval '1 minute' WHERE id=s;PERFORM care_private.commit_treatment_care_packet(packet);RAISE EXCEPTION 'Ended session replayed receipt';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  BEGIN PERFORM set_config('request.jwt.claims',(claims||jsonb_build_object('session_id',other_session))::text,true);PERFORM care_private.read_treatment_care_context(t,c,u);RAISE EXCEPTION 'Another user session accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  BEGIN DELETE FROM public.role_permissions WHERE role_id=r AND permission_key='pflege.orders.manage';PERFORM care_private.commit_treatment_care_packet(packet);RAISE EXCEPTION 'Revoked own role replayed metadata write';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  BEGIN DELETE FROM public.role_permissions WHERE role_id=r AND permission_key='pflege.treatment.view';PERFORM care_private.confirm_treatment_care_packet(t,c,order_ref,u,request1,packet);RAISE EXCEPTION 'Revoked own view read receipt';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  BEGIN UPDATE public.client_module_assignments SET is_active=false WHERE tenant_id=t AND client_id=c;PERFORM care_private.read_treatment_care_context(t,c,u);RAISE EXCEPTION 'Lost active Pflege assignment accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  BEGIN UPDATE public.clients SET lifecycle_status='archiviert' WHERE id=c;PERFORM care_private.read_treatment_care_context(t,c,u);RAISE EXCEPTION 'Archived client accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  BEGIN UPDATE public.profiles SET display_name=null WHERE id=u;bad:=care_private.read_treatment_care_context(t,c,u);PERFORM care_private.commit_treatment_care_packet(packet||jsonb_build_object('requestId',gen_random_uuid(),'sources',bad));RAISE EXCEPTION 'Missing original actor name silently fabricated';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  PERFORM set_config('request.jwt.claims',other_claims::text,true);
  BEGIN PERFORM care_private.confirm_treatment_care_packet(t,c,order_ref,other_actor,request1,packet);RAISE EXCEPTION 'Other current actor read own receipt';EXCEPTION WHEN SQLSTATE 'P0H02' THEN NULL;END;
  BEGIN PERFORM care_private.confirm_treatment_care_review(t,c,order_ref,other_actor,review_request,review_packet);RAISE EXCEPTION 'Other current actor read review receipt';EXCEPTION WHEN SQLSTATE 'P0H03' THEN NULL;END;
  PERFORM set_config('request.jwt.claims',claims::text,true);

  BEGIN UPDATE public.treatment_care_events SET reason='Changed' WHERE id=head1;RAISE EXCEPTION 'Treatment original mutable';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  BEGIN DELETE FROM care_private.treatment_care_requests WHERE tenant_id=t;RAISE EXCEPTION 'Original treatment receipt deletable';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  BEGIN UPDATE public.treatment_care_review_roots SET treatment_fingerprint='Changed' WHERE tenant_id=t;RAISE EXCEPTION 'Review root mutable';EXCEPTION WHEN check_violation THEN NULL;END;
  BEGIN DELETE FROM public.treatment_care_review_events WHERE tenant_id=t;RAISE EXCEPTION 'Review event deletable';EXCEPTION WHEN check_violation THEN NULL;END;
  BEGIN UPDATE public.treatment_care_review_receipts SET original='{}' WHERE tenant_id=t;RAISE EXCEPTION 'Review receipt mutable';EXCEPTION WHEN check_violation THEN NULL;END;
  IF (SELECT to_jsonb(o) FROM public.care_medical_orders o WHERE o.id=order_ref) IS DISTINCT FROM native_order OR EXISTS(SELECT 1 FROM public.clinical_treatment_executions e WHERE e.tenant_id=t) OR EXISTS(SELECT 1 FROM public.clinical_treatment_corrections x WHERE x.tenant_id=t) OR EXISTS(SELECT 1 FROM public.care_infusion_events e WHERE e.tenant_id=t) OR EXISTS(SELECT 1 FROM public.vital_sign_measurements m WHERE m.tenant_id=t) OR EXISTS(SELECT 1 FROM care_private.treatment_care_review_scopes q WHERE q.tenant_id=t) OR (SELECT count(*) FROM public.treatment_care_events e WHERE e.tenant_id=t) IS DISTINCT FROM 4 THEN RAISE EXCEPTION 'Technical metadata mutated a native clinical fact or created unapproved execution';END IF;
  IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('public','care_private') AND p.proname IN('block_treatment_care_mutation','commit_treatment_care_packet','commit_treatment_care_review','confirm_treatment_care_packet','confirm_treatment_care_review','read_treatment_care_context','read_treatment_care_page','read_treatment_care_review_page','treatment_care_actor','treatment_care_fingerprint','treatment_care_original','treatment_care_ref','treatment_care_review_immutable','treatment_care_review_original','treatment_care_sources','treatment_care_state_fingerprint','validate_treatment_care_packet','validate_treatment_care_prepared_packet','web_commit_treatment_care_packet','web_commit_treatment_care_review','web_confirm_treatment_care_packet','web_confirm_treatment_care_review','web_read_treatment_care_context','web_read_treatment_care_page','web_read_treatment_care_review_page') AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE') OR has_function_privilege('service_role',p.oid,'EXECUTE'))) THEN RAISE EXCEPTION 'Treatment function quarantine missing';END IF;
  FOREACH table_name IN ARRAY ARRAY['public.treatment_care_events','care_private.treatment_care_requests','care_private.treatment_care_review_scopes','public.treatment_care_review_roots','public.treatment_care_review_events','public.treatment_care_review_receipts'] LOOP
   FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF has_table_privilege(role_name,table_name,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') THEN RAISE EXCEPTION 'Treatment table grants widened: % / %',role_name,table_name;END IF;
   END LOOP;
  END LOOP;
  passed:=true;RAISE EXCEPTION USING ERRCODE='Z0001';
 EXCEPTION WHEN SQLSTATE 'Z0001' THEN NULL;END;
 IF NOT passed OR EXISTS(SELECT 1 FROM public.roles x WHERE x.id=r) OR EXISTS(SELECT 1 FROM auth.sessions x WHERE x.id IN(s,other_session)) OR EXISTS(SELECT 1 FROM public.clients x WHERE x.id IN(c,other_client)) OR EXISTS(SELECT 1 FROM public.care_medical_orders x WHERE x.id=order_ref) OR EXISTS(SELECT 1 FROM public.client_module_assignments x WHERE x.tenant_id=t) OR EXISTS(SELECT 1 FROM care_private.treatment_care_review_scopes x WHERE x.tenant_id=t) OR EXISTS(SELECT 1 FROM public.tenants x WHERE x.id=t) OR EXISTS(SELECT 1 FROM auth.users x WHERE x.id IN(u,other_actor)) OR EXISTS(SELECT 1 FROM public.treatment_care_events x WHERE x.tenant_id=t) OR EXISTS(SELECT 1 FROM care_private.treatment_care_requests x WHERE x.tenant_id=t) OR EXISTS(SELECT 1 FROM public.treatment_care_review_roots x WHERE x.tenant_id=t) OR EXISTS(SELECT 1 FROM public.treatment_care_review_events x WHERE x.tenant_id=t) OR EXISTS(SELECT 1 FROM public.treatment_care_review_receipts x WHERE x.tenant_id=t) THEN RAISE EXCEPTION 'Treatment quarantine fixture or full rollback cleanup failed';END IF;
 PERFORM set_config('cp365.treatment_quarantine_evidence',jsonb_build_object('packet',packet,'receipt',receipt1,'revisedReceipt',receipt2,'payerReceipt',receipt3,'reviewPacket',review_packet,'reviewReceipt',review_receipt)::text,true);
END $test$;
-- Only synthetic response evidence is emitted after cleanup and before outer rollback.
SELECT current_setting('cp365.treatment_quarantine_evidence',true)::jsonb AS evidence;
ROLLBACK;
