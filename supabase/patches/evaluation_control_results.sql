-- LOCAL REVIEW ONLY, NOT APPLIED. Requires evaluation_control_sources.sql.
-- Reassessment evidence closes its own evaluation task; never proves treatment or goal attainment.
begin;
create or replace function care_private.control_evaluation_evidence(s jsonb,t jsonb,server_now timestamptz) returns void language plpgsql set search_path='' as $$begin
 perform care_private.control_evaluation_shape(s,t,server_now);
 if s->'draft'->'entry'->>'source' is distinct from 'observed' then raise exception 'Übermittelte Evaluation ist kein eigener Prüfbeleg.' using errcode='23514';end if;
end $$;
create or replace function care_private.control_evaluation_result(evidence jsonb,original jsonb,t jsonb,actor uuid,cycle_at timestamptz,result_at timestamptz,recorded_at timestamptz,complete boolean,server_now timestamptz) returns void language plpgsql set search_path='' as $$
declare s jsonb:=evidence->'snapshot';o jsonb:=original->'snapshot';m jsonb;begin
 if evidence->>'kind' is distinct from 'plan_evaluation' or original->>'kind' is distinct from 'plan_evaluation' then raise exception 'Folgeevaluation ausschließlich für eigenen Evaluationsauftrag.' using errcode='23514';end if;
 perform care_private.control_evaluation_evidence(s,t,server_now);perform care_private.control_evaluation_shape(o,t,server_now);
 if actor is null or s->>'actor_id' is distinct from actor::text or cycle_at is null or result_at is null or recorded_at is null or complete is null then raise exception 'Eigene Evaluationsperson und Auftragszeiten bestätigen.' using errcode='23514';end if;
 if s->>'id' is distinct from evidence->>'id' or o->>'id' is distinct from original->>'id' or s->>'root_id'=o->>'root_id' or s->>'assessment_id' is distinct from o->>'assessment_id' then raise exception 'Eigenständiger neuer Evaluationsbeleg zum selben Assessment erforderlich.' using errcode='23514';end if;
 if care_private.plan_eval_time(s->>'root_created_at')<cycle_at or care_private.plan_eval_time(s->'draft'->'entry'->>'periodStartAt')<cycle_at or care_private.plan_eval_time(s->>'occurred_at')>result_at or care_private.plan_eval_time(s->>'recorded_at')>recorded_at then raise exception 'Folgebeobachtung oder verfügbarer Ergebnisbeleg passt nicht zur Auftragsfassung.' using errcode='23514';end if;
 if complete and s->'draft'->'entry'->>'outcome'='not_assessable' then raise exception 'Nicht beurteilbare Wirkung bleibt Teilprüfung.' using errcode='23514';end if;
 for m in select value from jsonb_array_elements(o->'plan'->'measures') loop
  if not exists(select 1 from jsonb_array_elements(s->'plan'->'measures') n where n->>'id'=m->>'id' and n=m) then raise exception 'Alle Originalmaßnahmen, Ziele und Kriterien unverändert erneut bewerten.' using errcode='23514';end if;
 end loop;
end $$;

create or replace function care_private.control_draft(t jsonb,d jsonb,server_now timestamptz) returns void language plpgsql set search_path='' as $$
declare k text:=d->>'kind';fields text[];f text;s jsonb;at_time timestamptz;evidence_at timestamptz;begin
 fields:=case k when 'create' then array['title','reason','instruction','source','policy'] when 'assign' then array['assigneeId','backupId','escalationRecipientId','reason'] when 'reschedule' then array['dueAt','escalationAt','reason']
 when 'attempt' then array['outcome','result','reason','communication','personDecision','qualificationBasis','evidence','overrideReason'] when 'resolve' then array['outcome','result','reason','communication','personDecision','qualificationBasis','evidence','overrideReason','followUpTaskId','noFollowUpReason']
 when 'cancel' then array['reason','communication'] when 'reopen' then array['reason','policy'] when 'escalate' then array['policyEventId','recipientId','channel','delivery','message','response'] when 'acknowledge' then array['escalationEventId','response','nextStep'] else null end;
 if fields is null or jsonb_typeof(d) is distinct from 'object' or d-(fields||array['kind','occurredAt'])<>'{}'::jsonb or (select count(*) from jsonb_each(d))<>cardinality(fields)+2 then raise exception 'Kontrollereignisfelder unvollständig oder fremd.' using errcode='23514';end if;
 foreach f in array fields||array['kind','occurredAt'] loop if f not in ('source','policy','evidence') and (jsonb_typeof(d->f) is distinct from 'string' or length(d->>f)>4000) then raise exception 'Kontrollereignisfeld ungültig: %',f using errcode='23514';end if;end loop;
 at_time:=care_private.infusion_time(d->>'occurredAt');if at_time>server_now then raise exception 'Tatsächliches Kontrollereignis liegt in der Zukunft.' using errcode='23514';end if;
 if k='create' then foreach f in array array['title','reason','instruction'] loop if nullif(btrim(d->>f),'') is null then raise exception 'Individueller Kontrollauftrag unvollständig.' using errcode='23514';end if;end loop;perform care_private.control_source_shape(d->'source',t);if d->'source'->>'kind' in ('protocol_event','plan_evaluation') and care_private.infusion_time(d->'source'->'snapshot'->>'occurred_at')>at_time then raise exception 'Originalbeobachtung liegt nach dem dokumentierten Auftrag.' using errcode='23514';end if;end if;
 if k in ('create','reopen') then perform care_private.control_policy(d->'policy',at_time);end if;
 if k in ('assign','reschedule','reopen','cancel') and nullif(btrim(d->>'reason'),'') is null then raise exception 'Tatsächlicher Änderungsgrund fehlt.' using errcode='23514';end if;
 if k='assign' and (not care_private.control_uuid(d->>'assigneeId') or (d->>'backupId'<>'' and not care_private.control_uuid(d->>'backupId')) or d->>'backupId'=d->>'assigneeId' or not care_private.control_uuid(d->>'escalationRecipientId')) then raise exception 'Zuständige Personen ungültig.' using errcode='23514';end if;
 if k='reschedule' and (care_private.infusion_time(d->>'dueAt')<at_time or care_private.infusion_time(d->>'escalationAt')<care_private.infusion_time(d->>'dueAt')) then raise exception 'Neue Fristen widersprüchlich.' using errcode='23514';end if;
 if k='cancel' and nullif(btrim(d->>'communication'),'') is null then raise exception 'Tatsächliche Abstimmung fehlt.' using errcode='23514';end if;
 if k in ('attempt','resolve') then
  foreach f in array array['result','communication','personDecision','qualificationBasis'] loop if nullif(btrim(d->>f),'') is null then raise exception 'Tatsächliches Ergebnis, Abstimmung oder Personenbezug fehlt.' using errcode='23514';end if;end loop;
  if (k='attempt' and d->>'outcome'<>'partial') or (k='resolve' and d->>'outcome' not in ('performed','omitted','refused','failed')) or ((k='attempt' or d->>'outcome'<>'performed') and nullif(btrim(d->>'reason'),'') is null) then raise exception 'Tatsächliches Durchführungsergebnis oder Abweichungsgrund fehlt.' using errcode='23514';end if;
  s:=d->'evidence';if k='attempt' or d->>'outcome'='performed' or s<>'null'::jsonb then
   perform care_private.control_source_shape(s,t);if s->>'kind' not in ('treatment_execution','medication_administration','vital_measurement','protocol_event','plan_evaluation') then raise exception 'Planung ist kein tatsächlicher Ergebnisbeleg.' using errcode='23514';end if;
   evidence_at:=care_private.infusion_time(s->'snapshot'->>case when s->>'kind'='treatment_execution' then 'performed_at' else 'occurred_at' end);if evidence_at>at_time then raise exception 'Beleg liegt nach dem Kontrollergebnis.' using errcode='23514';end if;
   if s->>'kind'='plan_evaluation' then perform care_private.control_evaluation_evidence(s->'snapshot',t,server_now);end if;
   if s->>'kind'='protocol_event' then perform care_private.control_protocol_evidence(s->'snapshot',t,server_now);end if;
   if s->>'kind'='treatment_execution' and (coalesce(s->'snapshot'->>'outcome','') not in ('performed','partial') or nullif(btrim(s->'snapshot'->>'title'),'') is null or nullif(btrim(s->'snapshot'->>'treatment_type'),'') is null or s->'snapshot'->>'created_at' is null) then raise exception 'Tatsächlicher Behandlungspflegenachweis fehlt.' using errcode='23514';end if;
   if s->>'kind'='medication_administration' and coalesce(s->'snapshot'->>'status','') not in ('administered','late') then raise exception 'Ausgebliebene Gabe ist kein Durchführungsbeleg.' using errcode='23514';end if;
   if s->>'kind'='vital_measurement' and (nullif(btrim(s->'snapshot'->>'display_value'),'') is null or nullif(btrim(s->'snapshot'->>'unit'),'') is null or jsonb_typeof(s->'snapshot'->'values') is distinct from 'object' or s->'snapshot'->'values'='{}'::jsonb) then raise exception 'Tatsächliche Messwerte fehlen.' using errcode='23514';end if;
  end if;
  if k='resolve' and ((d->>'followUpTaskId'<>'' and not care_private.control_uuid(d->>'followUpTaskId')) or d->>'followUpTaskId'=t->>'id' or (d->>'followUpTaskId'<>'')=(nullif(btrim(d->>'noFollowUpReason'),'') is not null)) then raise exception 'Genau einen bestehenden Folgeauftrag oder individuellen Abschlussgrund wählen.' using errcode='23514';end if;
 end if;
 if k='escalate' and (not care_private.control_uuid(d->>'policyEventId') or not care_private.control_uuid(d->>'recipientId') or d->>'channel' not in ('phone','in_person','secure_message') or d->>'delivery' not in ('sent','failed') or nullif(btrim(d->>'message'),'') is null or nullif(btrim(d->>'response'),'') is null) then raise exception 'Tatsächlicher Kontaktversuch fehlt.' using errcode='23514';end if;
 if k='acknowledge' and (not care_private.control_uuid(d->>'escalationEventId') or nullif(btrim(d->>'response'),'') is null or nullif(btrim(d->>'nextStep'),'') is null) then raise exception 'Tatsächliche Rückmeldung und nächster Schritt fehlen.' using errcode='23514';end if;
end $$;

create or replace function care_private.control_fold(t jsonb,d jsonb,actor uuid,event_id uuid,s jsonb,history jsonb) returns jsonb language plpgsql set search_path='' as $$
declare k text:=d->>'kind';p jsonb;snapshot jsonb;original jsonb;cycle jsonb;order_source jsonb;responsible boolean;begin
 if s is null then if k<>'create' then raise exception 'Erstes Auftragsereignis fehlt.' using errcode='23514';end if;
  return jsonb_build_object('status','open','policy',d->'policy','policyEventId',event_id::text);end if;
 if k='create' then raise exception 'Auftrag bereits angelegt.' using errcode='23514';end if;p:=s->'policy';
 if k='reopen' then if s->>'status'='open' then raise exception 'Offener Auftrag kann nicht erneut eröffnet werden.' using errcode='23514';end if;return jsonb_build_object('status','open','policy',d->'policy','policyEventId',event_id::text);end if;
 if s->>'status'<>'open' then raise exception 'Geschlossener Auftrag benötigt Wiedereröffnung.' using errcode='23514';end if;
 if k='assign' then
  if p->>'assigneeId'=d->>'assigneeId' and p->>'backupId'=d->>'backupId' and p->>'escalationRecipientId'=d->>'escalationRecipientId' then raise exception 'Keine tatsächliche Zuständigkeitsänderung.' using errcode='23514';end if;
  s:=s||jsonb_build_object('policy',p||jsonb_build_object('assigneeId',d->>'assigneeId','backupId',d->>'backupId','escalationRecipientId',d->>'escalationRecipientId'),'policyEventId',event_id::text);
 elsif k='reschedule' then
  if p->>'dueAt'=d->>'dueAt' and p->>'escalationAt'=d->>'escalationAt' then raise exception 'Keine tatsächliche Friständerung.' using errcode='23514';end if;
  s:=s||jsonb_build_object('policy',p||jsonb_build_object('dueAt',d->>'dueAt','escalationAt',d->>'escalationAt'),'policyEventId',event_id::text);
 elsif k in ('attempt','resolve') then
  responsible:=actor::text=p->>'assigneeId' or actor::text=p->>'backupId';if responsible=(nullif(btrim(d->>'overrideReason'),'') is not null) then raise exception 'Abweichende Durchführungsperson ausdrücklich begründen.' using errcode='23514';end if;
  snapshot:=d->'evidence';if snapshot is not null and snapshot<>'null'::jsonb then
   select x into cycle from jsonb_array_elements(history) x where x->>'id'=s->>'policyEventId';
   order_source:=history->0->'draft'->'source';
   if snapshot->>'kind'='plan_evaluation' or order_source->>'kind'='plan_evaluation' then
    -- The writer supplies the actual historical/new control record time, never a read-time substitute.
    perform care_private.control_evaluation_result(snapshot,order_source,t,actor,care_private.infusion_time(cycle->'draft'->>'occurredAt'),care_private.infusion_time(d->>'occurredAt'),care_private.infusion_time(t->>'controlRecordedAt'),k='resolve' and d->>'outcome'='performed',clock_timestamp());
   end if;
   if cycle is null or care_private.infusion_time(snapshot->'snapshot'->>case when snapshot->>'kind'='treatment_execution' then 'performed_at' else 'occurred_at' end)<care_private.infusion_time(cycle->'draft'->>'occurredAt') then raise exception 'Ergebnisbeleg vor aktueller Auftragsfassung.' using errcode='23514';end if;
  end if;
  if k='resolve' then s:=s||jsonb_build_object('status',case when d->>'outcome'='performed' then 'completed' else 'not_fulfilled' end);end if;
 elsif k='cancel' then s:=s||jsonb_build_object('status','cancelled');
 elsif k='escalate' then
  if d->>'policyEventId'<>s->>'policyEventId' or d->>'recipientId'<>p->>'escalationRecipientId' or care_private.infusion_time(d->>'occurredAt')<care_private.infusion_time(p->>'escalationAt') then raise exception 'Eskalationsregel geändert oder noch nicht fällig.' using errcode='40001';end if;
 elsif k='acknowledge' then
  select x into original from jsonb_array_elements(history) x where x->>'id'=d->>'escalationEventId';
  if original is null or original->'draft'->>'kind'<>'escalate' or original->'draft'->>'delivery'<>'sent' or original->'draft'->>'policyEventId'<>s->>'policyEventId' or original->'draft'->>'recipientId'<>actor::text
   or exists(select 1 from jsonb_array_elements(history) x where x->'draft'->>'kind'='acknowledge' and x->'draft'->>'escalationEventId'=d->>'escalationEventId') then raise exception 'Keine eigene unbestätigte aktuelle Eskalation.' using errcode='23514';end if;
 end if;return s;
end $$;

create or replace function care_private.write_clinical_control_event(request_id uuid,payload jsonb) returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare tenant uuid:=public.current_tenant_id();actor uuid;subject uuid;control_id uuid;t jsonb;d jsonb;k text;s jsonb;source jsonb;order_source jsonb;history jsonb:='[]';
 task public.care_control_tasks%rowtype;receipt public.care_control_events%rowtype;e public.care_control_events%rowtype;head uuid;seq integer:=0;last_at timestamptz;last_recorded timestamptz;at_time timestamptz;server_now timestamptz;result uuid:=gen_random_uuid();name text;person text;f text;follow public.care_control_tasks%rowtype;follow_state jsonb;follow_history jsonb;
begin
 actor:=care_private.assert_control_access(tenant,null);
 if request_id is null or jsonb_typeof(payload) is distinct from 'object' or payload-array['task','expectedHeadId','draft']<>'{}'::jsonb or (select count(*) from jsonb_each(payload))<>3 or jsonb_typeof(payload->'expectedHeadId') is distinct from 'string' or length(payload::text)>300000 then raise exception 'Kontrollanfrage ungültig.' using errcode='23514';end if;
 t:=payload->'task';if jsonb_typeof(t) is distinct from 'object' or t-array['id','clientId','version']<>'{}'::jsonb or (select count(*) from jsonb_each(t))<>3 or not care_private.control_uuid(t->>'id') or not care_private.control_uuid(t->>'clientId') or t->>'version' is distinct from '2026-10-09.1' or (payload->>'expectedHeadId'<>'' and not care_private.control_uuid(payload->>'expectedHeadId')) then raise exception 'Auftrag oder Revision ungültig.' using errcode='23514';end if;
 subject:=(t->>'clientId')::uuid;control_id:=(t->>'id')::uuid;t:=t||jsonb_build_object('tenantId',tenant::text);d:=payload->'draft';k:=d->>'kind';
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(tenant::text||':control:'||request_id::text,0));
 perform 1 from public.clients c where c.id=subject and c.tenant_id=tenant and c.status='active' and c.deleted_at is null for no key update;if not found then raise exception 'Aktive Pflegeakte fehlt.' using errcode='42501';end if;
 perform care_private.assert_control_access(tenant,subject);
 select coalesce(nullif(btrim(p.display_name),''),'Person ohne Anzeigenamen') into name from public.profiles p where p.id=actor and p.tenant_id=tenant and p.is_active for share;if not found then raise exception 'Aktives eigenes Profil fehlt.' using errcode='42501';end if;
 select * into receipt from public.care_control_events x where x.tenant_id=tenant and x.request_id=write_clinical_control_event.request_id;
 if receipt.id is not null then
  if receipt.actor_id<>actor or receipt.request_payload<>payload then raise exception 'Anfrage bereits mit anderer Person oder anderem Inhalt belegt.' using errcode='23514';end if;
  if care_private.control_task_readable(receipt.task_id,tenant,subject) is not true then raise exception 'Historische Kontrollbelege nicht mehr zugänglich.' using errcode='42501';end if;
  return jsonb_build_object('id',receipt.id::text,'tenantId',tenant::text,'taskId',receipt.task_id::text,'requestId',request_id::text,'previousId',coalesce(receipt.previous_id::text,''),'sequence',receipt.sequence);
 end if;
 if k in ('create','assign','reschedule','cancel','reopen') then if public.has_permission('pflege.treatment.manage') is not true then raise exception 'Kontrollverwaltungsrecht fehlt.' using errcode='42501';end if;
 else if public.has_permission('pflege.documentation.create') is not true or (k in ('escalate','acknowledge') and public.has_permission('pflege.handovers.manage') is not true) then raise exception 'Dokumentations-/Übergaberecht fehlt.' using errcode='42501';end if;end if;
 select * into task from public.care_control_tasks x where x.id=control_id for update;
 if task.id is not null then if task.tenant_id<>tenant or task.client_id<>subject or task.version<>t->>'version' or care_private.control_task_readable(control_id,tenant,subject) is not true then raise exception 'Auftrag fremd oder nicht vollständig zugänglich.' using errcode='42501';end if;
 elsif k is distinct from 'create' or payload->>'expectedHeadId'<>'' then raise exception 'Neuer Auftrag benötigt echtes Auftragsereignis.' using errcode='23514';end if;
 server_now:=clock_timestamp();perform care_private.control_draft(t,d,server_now);at_time:=care_private.infusion_time(d->>'occurredAt');
 for e in select * from public.care_control_events x where x.task_id=control_id and x.tenant_id=tenant and x.client_id=subject order by sequence loop
  perform care_private.control_draft(t,e.draft,server_now);
  if e.sequence<>seq+1 or e.previous_id is distinct from head or e.recorded_at<care_private.infusion_time(e.draft->>'occurredAt') or (last_at is not null and care_private.infusion_time(e.draft->>'occurredAt')<last_at) or (last_recorded is not null and e.recorded_at<last_recorded) then raise exception 'Originalkette beschädigt.' using errcode='23514';end if;
  s:=care_private.control_fold(t||jsonb_build_object('controlRecordedAt',to_char(e.recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')),e.draft,e.actor_id,e.id,s,history);history:=history||jsonb_build_array(jsonb_build_object('id',e.id::text,'draft',e.draft));head:=e.id;seq:=e.sequence;last_at:=care_private.infusion_time(e.draft->>'occurredAt');last_recorded:=e.recorded_at;
 end loop;
 if coalesce(head::text,'')<>payload->>'expectedHeadId' then raise exception 'Auftrag inzwischen geändert.' using errcode='40001';end if;
 if (last_at is not null and at_time<last_at) or (last_recorded is not null and server_now<last_recorded) then raise exception 'Tatsächliche Reihenfolge widersprüchlich.' using errcode='23514';end if;
 s:=care_private.control_fold(t||jsonb_build_object('controlRecordedAt',to_char(server_now at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')),d,actor,result,s,history);
 if k in ('create','reopen','assign') then
  foreach f in array array['assigneeId','backupId','escalationRecipientId'] loop person:=case when k='assign' then d->>f else d->'policy'->>f end;
   if person<>'' then perform 1 from public.profiles p where p.id=person::uuid and p.tenant_id=tenant and p.is_active and p.role_key not in ('client_portal','family_portal') for share;if not found then raise exception 'Zuständige Person nicht im aktiven eigenen Team.' using errcode='42501';end if;end if;
  end loop;
 end if;
 source:=case when k='create' then d->'source' when k in ('attempt','resolve') then d->'evidence' else null end;
 if source is not null and source<>'null'::jsonb then if care_private.control_source_current(source->>'kind',(source->>'id')::uuid,tenant,subject) is distinct from source->'snapshot' then raise exception 'Originalquelle inzwischen geändert.' using errcode='40001';end if;end if;
 order_source:=history->0->'draft'->'source';
 if source is not null and source<>'null'::jsonb and k in ('attempt','resolve') and order_source->>'kind'='plan_evaluation' then
  if care_private.control_source_current('plan_evaluation',(order_source->>'id')::uuid,tenant,subject) is distinct from order_source->'snapshot' then raise exception 'Beauftragte Evaluation inzwischen geändert. Auftrag ausdrücklich neu klären.' using errcode='40001';end if;
 end if;
 if k='resolve' and d->>'followUpTaskId'<>'' then
  select * into follow from public.care_control_tasks x where x.id=(d->>'followUpTaskId')::uuid and x.tenant_id=tenant and x.client_id=subject for update;
  if follow.id is null or care_private.control_task_readable(follow.id,tenant,subject) is not true then raise exception 'Bestehender Folgeauftrag nicht zugänglich.' using errcode='42501';end if;
  follow_history:='[]';follow_state:=null;
  for e in select * from public.care_control_events x where x.task_id=follow.id and x.tenant_id=tenant and x.client_id=subject order by sequence loop follow_state:=care_private.control_fold(jsonb_build_object('id',follow.id::text,'tenantId',tenant::text,'clientId',subject::text,'version',follow.version,'controlRecordedAt',to_char(e.recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')),e.draft,e.actor_id,e.id,follow_state,follow_history);follow_history:=follow_history||jsonb_build_array(jsonb_build_object('id',e.id::text,'draft',e.draft));end loop;
  if follow_state->>'status' is distinct from 'open' then raise exception 'Folgeauftrag bereits geschlossen oder ohne echten Auftrag.' using errcode='40001';end if;
 end if;
 if task.id is null then insert into public.care_control_tasks(id,tenant_id,client_id,version,created_at,recorded_by) values(control_id,tenant,subject,t->>'version',server_now,actor);end if;
 insert into public.care_control_events(id,tenant_id,client_id,task_id,sequence,previous_id,actor_id,actor_name,request_id,recorded_at,draft,request_payload) values(result,tenant,subject,control_id,seq+1,head,actor,name,request_id,server_now,d,payload);
 insert into public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name) values(tenant,subject,'control_event',result,'created','Kontrollauftrag oder tatsächliches Ergebnis dokumentiert',jsonb_build_object('taskId',control_id::text,'sequence',seq+1,'kind',k),actor,name);
 return jsonb_build_object('id',result::text,'tenantId',tenant::text,'taskId',control_id::text,'requestId',request_id::text,'previousId',coalesce(head::text,''),'sequence',seq+1);
end $$;

revoke all on function care_private.control_evaluation_evidence(jsonb,jsonb,timestamptz),care_private.control_evaluation_result(jsonb,jsonb,jsonb,uuid,timestamptz,timestamptz,timestamptz,boolean,timestamptz),care_private.control_draft(jsonb,jsonb,timestamptz),care_private.control_fold(jsonb,jsonb,uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
-- Existing wrapper, writer grants, receipt replay, RLS and all source adapters are retained.
commit;
