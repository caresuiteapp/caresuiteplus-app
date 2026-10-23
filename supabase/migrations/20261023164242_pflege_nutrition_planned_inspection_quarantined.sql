-- Quarantined followup: open technical planning may be retained by an inspection request.
-- No clinical decision or actual execution is enabled; historical replay is unchanged.

create or replace function care_private.commit_nutrition_review(p jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t uuid:=(p->>'tenantId')::uuid;c uuid:=(p->>'clientId')::uuid;actor uuid:=(p->>'actorId')::uuid;req uuid:=(p->>'requestId')::uuid;care_root uuid:=(p#>>'{careOriginal,rootId}')::uuid;care jsonb;r public.nutrition_review_receipts%rowtype;event_ref uuid:=gen_random_uuid();name text;recorded timestamptz;original jsonb;
begin
 perform care_private.nutrition_elimination_actor(t,c,actor,p->>'action'='request');
 perform care_private.nutrition_require(care_private.nutrition_fields(p,array['schemaVersion','action','requestId','tenantId','clientId','actorId','expectedHeadId','expectedRevision','careOriginal','reviewOriginal','reason','requiredChange','rationale']) and p->'schemaVersion'='"1"'::jsonb and p->>'action' in('request','return','accept') and care_private.nutrition_uuid(p->'requestId') and care_private.nutrition_text(p->'reason',0,2000) and care_private.nutrition_text(p->'requiredChange',0,4000) and care_private.nutrition_text(p->'rationale',0,4000),'Vollständiges unverändertes Prüfpaket fehlt.');
 select * into r from public.nutrition_review_receipts x where x.tenant_id=t and x.request_id=req;
 if r.request_id is not null then
  if r.auth_user_id is distinct from auth.uid() then raise exception 'Ursprüngliches eigenes Konto der Prüfung fehlt.' using errcode='42501';end if;
  if r.client_id<>c or r.actor_id<>actor or r.packet is distinct from p then raise exception 'Prüfanfragekennung wurde anders verwendet.' using errcode='40001';end if;
  return jsonb_build_object('requestId',req,'packet',r.packet,'original',r.original);
 end if;
 if p->>'action' in('return','accept') then
  if care_private.nutrition_own_permission('pflege.documentation.sign') is not true then raise exception 'Eigenes aktuelles Prüfrecht fehlt.' using errcode='42501';end if;
  -- A second linked profile is not an independent authenticated person.
  if exists(select 1 from jsonb_array_elements(coalesce(p#>'{careOriginal,history}','[]'::jsonb)) h join public.profiles x on x.id=(h->>'recordedBy')::uuid and x.tenant_id=t where x.id=actor or coalesce(x.auth_user_id,x.id)=auth.uid()) then raise exception 'Dieselbe angemeldete Person darf die eigene Fassung nicht unabhängig entscheiden.' using errcode='42501';end if;
  raise exception 'Klinische Annahme/Rückgabe bleibt ohne nachgewiesene ausführungsgebundene Qualifikations-/Einwilligungsoriginale und geschlossene native Schreiber gesperrt.' using errcode='42501';
 end if;
 perform 1 from public.nutrition_elimination_roots x where x.id=care_root and x.tenant_id=t and x.client_id=c for update;
 if not found then raise exception 'Eigenes historisches Pflegeoriginal fehlt.' using errcode='40001';end if;
 care:=care_private.nutrition_elimination_original(care_root);
 if care is distinct from p->'careOriginal' or care->>'voided' is distinct from 'false' or care#>>'{payload,execution,outcome}'='offered' or care#>>'{payload,execution,outcome}' is null or(care#>>'{payload,execution,outcome}'='planned' and care#>>'{payload,lifecycle}' is distinct from 'open') then raise exception 'Unverändertes tatsächliches Original oder ausdrücklich offene technische Planung fehlt.' using errcode='40001';end if;
 perform care_private.nutrition_require(p->'expectedRevision'='0'::jsonb and p->'expectedHeadId'='null'::jsonb and p->'reviewOriginal'='null'::jsonb and care_private.nutrition_text(p->'reason',10,2000) and p->>'requiredChange'='' and p->>'rationale'='','Prüfanfrage darf weder Entscheidung noch fremden Kopf enthalten.');
 select nullif(x.display_name,'') into name from public.profiles x where x.id=actor and x.tenant_id=t and x.is_active and x.status='active';
 if care_private.nutrition_text(to_jsonb(name),1,500) is not true then raise exception 'Ursprünglicher eigener Name fehlt.' using errcode='42501';end if;
 perform care_private.nutrition_elimination_actor(t,c,actor,true);recorded:=clock_timestamp();
 insert into public.nutrition_review_roots(id,tenant_id,client_id,care_root_id,care_head_id,care_fingerprint,care_kind,created_at)values(event_ref,t,c,care_root,(care->>'headId')::uuid,care->>'contentFingerprint',care->>'kind',recorded);
 insert into public.nutrition_review_events(id,tenant_id,client_id,root_id,revision,previous_id,request_id,action,actor_id,actor_name,recorded_at,reason,required_change,rationale,care_head_id,care_fingerprint,qualification_original,fingerprint,packet)
 values(event_ref,t,c,event_ref,1,null,req,'request',actor,name,recorded,p->>'reason','','',(care->>'headId')::uuid,care->>'contentFingerprint',null,care_private.nutrition_fingerprint(jsonb_build_object('packet',p,'qualification',null)),p);
 original:=care_private.nutrition_review_original(event_ref);
 insert into public.nutrition_review_receipts(request_id,tenant_id,client_id,actor_id,root_id,event_id,packet,original,recorded_at,auth_user_id)values(req,t,c,actor,event_ref,event_ref,p,original,recorded,auth.uid());
 return jsonb_build_object('requestId',req,'packet',p,'original',original);
end$$;

revoke all on function care_private.commit_nutrition_review(jsonb) from PUBLIC,anon,authenticated,service_role;
