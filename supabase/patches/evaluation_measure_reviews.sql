-- LOCAL REVIEW ONLY, NOT APPLIED. Requires evaluation_control_results.sql.
-- Historical 15-field entries remain intact; every fresh non-void evaluation requires individual reviews.
begin;
create or replace function care_private.plan_eval_measure_reviews(e jsonb,p jsonb,required boolean default false) returns void language plpgsql set search_path='' as $$
declare r jsonb;ids text[]:='{}';begin
 if not(e?'measureReviews') then if required then raise exception 'Jede Originalmaßnahme einzeln bewerten.' using errcode='23514';end if;return;end if;
 if jsonb_typeof(e->'measureReviews') is distinct from 'array' then raise exception 'Einzelbewertungen fehlen.' using errcode='23514';end if;
 if jsonb_array_length(e->'measureReviews')<>jsonb_array_length(p->'measures') then raise exception 'Genau eine Einzelbewertung je Originalmaßnahme erforderlich.' using errcode='23514';end if;
 for r in select value from jsonb_array_elements(e->'measureReviews') loop
  perform care_private.plan_eval_fields(r,array['measureId','periodStartAt','periodEndAt','source','reportedBy','outcome','observedEffect','feedbackState','personFeedback','professionalConclusion','nextAction','nextActionReason','reviewState','reviewAt','reviewReason']);
  if not care_private.plan_eval_uuid(r->'measureId') or r->>'measureId'=any(ids) or not exists(select 1 from jsonb_array_elements(p->'measures') m where m->>'id'=r->>'measureId') then raise exception 'Einzelbewertung fremd oder doppelt.' using errcode='23514';end if;
  ids:=array_append(ids,r->>'measureId');
  -- Reuse the base entry contract. Removing measureId yields a legacy-shaped entry, without recursion into this helper.
  perform care_private.plan_eval_draft(jsonb_build_object('action','record','reason','','entry',(r-'measureId')||jsonb_build_object('evaluatedAt',e->>'evaluatedAt')),p,care_private.plan_eval_time(e->>'evaluatedAt'));
  if care_private.plan_eval_time(r->>'periodStartAt')<care_private.plan_eval_time(e->>'periodStartAt') or care_private.plan_eval_time(r->>'periodEndAt')>care_private.plan_eval_time(e->>'periodEndAt') then raise exception 'Maßnahmenbeobachtung außerhalb des Evaluationszeitraums.' using errcode='23514';end if;
 end loop;
end $$;

create or replace function care_private.plan_eval_draft(d jsonb,p jsonb,server_now timestamptz) returns void language plpgsql set search_path='' as $$
declare e jsonb:=d->'entry';f text;at_time timestamptz;start_at timestamptz;end_at timestamptz;begin
 perform care_private.plan_eval_fields(d,array['action','entry','reason']);perform care_private.plan_eval_text(d,'action');perform care_private.plan_eval_text(d,'reason',d->>'action'<>'record');
 if d->>'action' not in ('record','replace','void') or (d->>'action'='record' and d->>'reason'<>'') then raise exception 'Evaluationshandlung ungültig.' using errcode='23514';end if;
 if d->>'action'='void' then if e<>'null'::jsonb then raise exception 'Rücknahme darf keine neue Wirkung tragen.' using errcode='23514';end if;return;end if;
 perform care_private.plan_eval_fields(e,array['evaluatedAt','periodStartAt','periodEndAt','source','reportedBy','outcome','observedEffect','feedbackState','personFeedback','professionalConclusion','nextAction','nextActionReason','reviewState','reviewAt','reviewReason']||case when e?'measureReviews' then array['measureReviews'] else array[]::text[] end);
 foreach f in array array['evaluatedAt','periodStartAt','periodEndAt','source','outcome','observedEffect','feedbackState','personFeedback','professionalConclusion','nextAction','nextActionReason','reviewState','reviewReason'] loop perform care_private.plan_eval_text(e,f);end loop;
 foreach f in array array['reportedBy','reviewAt'] loop perform care_private.plan_eval_text(e,f,false);end loop;
 at_time:=care_private.plan_eval_time(e->>'evaluatedAt');start_at:=care_private.plan_eval_time(e->>'periodStartAt');end_at:=care_private.plan_eval_time(e->>'periodEndAt');
 if start_at<care_private.plan_eval_time(p->>'updatedAt') or start_at>end_at or end_at>at_time or at_time>server_now then raise exception 'Beobachtungszeitraum passt nicht zum Planstand oder tatsächlichen Zeitpunkt.' using errcode='23514';end if;
 if e->>'source' not in ('observed','reported') or (e->>'source'='observed' and e->>'reportedBy'<>'') then raise exception 'Eigene Wirkung und Fremdangaben trennen.' using errcode='23514';end if;if e->>'source'='reported' then perform care_private.plan_eval_text(e,'reportedBy');end if;
 if e->>'outcome' not in ('effective','partly_effective','not_effective','deteriorated','not_assessable') or e->>'feedbackState' not in ('given','declined','not_possible') or e->>'nextAction' not in ('continue','adjust','reassess','clarify') or e->>'reviewState' not in ('scheduled','pending','not_required') then raise exception 'Wirkung, Personenentscheidung und nächste Prüfung wählen.' using errcode='23514';end if;
 if e->>'reviewState'='scheduled' then if care_private.plan_eval_time(e->>'reviewAt')<at_time then raise exception 'Prüfung liegt vor Evaluation.' using errcode='23514';end if;elsif e->>'reviewAt'<>'' then raise exception 'Unvereinbarte Prüffrist entfernen.' using errcode='23514';end if;
 perform care_private.plan_eval_measure_reviews(e,p,false);
end $$;

create or replace function care_private.write_ambulatory_plan_evaluation(request_id uuid,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare tenant uuid:=public.current_tenant_id();actor uuid:=public.resolve_current_profile_id();a public.care_assessments%rowtype;r public.care_plan_evaluation_roots%rowtype;prior public.care_plan_evaluation_events%rowtype;old record;ref uuid;root_ref uuid;expected uuid;seq integer:=0;head uuid;last_at timestamptz;entry jsonb;p jsonb:=payload->'snapshot';d jsonb:=payload->'draft';m jsonb;native jsonb;server_now timestamptz;name text;result uuid:=gen_random_uuid();begin
 perform care_private.plan_eval_fields(payload,array['version','assessmentId','rootId','expectedHeadId','expectedSequence','snapshot','draft']);
 if payload->>'version' is distinct from '2026-10-09.1' or request_id is null or not care_private.plan_eval_uuid(payload->'assessmentId') or not care_private.plan_eval_uuid(payload->'rootId') or jsonb_typeof(payload->'expectedHeadId') is distinct from 'string' or (payload->>'expectedHeadId'<>'' and not care_private.plan_eval_uuid(payload->'expectedHeadId')) or jsonb_typeof(payload->'expectedSequence') is distinct from 'number' or (payload->>'expectedSequence') !~ '^(0|[1-9][0-9]{0,9})$' or (payload->>'expectedSequence')::numeric>2147483646 or octet_length(payload::text)>262144 then raise exception 'Evaluationsauftrag ungültig.' using errcode='23514';end if;
 ref:=(payload->>'assessmentId')::uuid;root_ref:=(payload->>'rootId')::uuid;expected:=nullif(payload->>'expectedHeadId','')::uuid;
 if care_private.plan_eval_access(tenant,ref) is not true then raise exception 'Eigene aktive Pflegeakte nicht zugänglich.' using errcode='42501';end if;
 select * into a from public.care_assessments x where x.id=ref and x.tenant_id=tenant and x.subject_type='client' for update;
 if a.id is null then raise exception 'Eigener Assessmentstand fehlt.' using errcode='42501';end if;
 perform 1 from public.clients c where c.id=a.subject_id and c.tenant_id=tenant and c.status='active' and c.deleted_at is null for share;
 if not found or care_private.plan_eval_access(tenant,ref) is not true then raise exception 'Aktiver Pflegefall geändert.' using errcode='42501';end if;
 perform 1 from public.client_module_assignments x where x.client_id=a.subject_id and x.tenant_id=tenant and x.module_key='pflege' and x.is_active and x.status not in ('inactive','deactivated','archiviert') for share;
 if not found then raise exception 'Pflegezuordnung geändert.' using errcode='42501';end if;
 select nullif(btrim(x.display_name),'') into name from public.profiles x where x.id=actor and x.tenant_id=tenant and x.is_active and x.role_key not in ('client_portal','family_portal') for share;
 if name is null or length(name)>4000 then raise exception 'Aktuelles tatsächliches Profil fehlt.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(tenant::text||':plan-eval-request:'||request_id::text,0));
 select * into prior from public.care_plan_evaluation_events x where x.tenant_id=tenant and x.request_id=write_ambulatory_plan_evaluation.request_id;
 if found then if prior.actor_id<>actor or prior.request_payload<>payload then raise exception 'Originalrequest mit anderen Angaben belegt.' using errcode='23514';end if;return jsonb_build_object('id',prior.id::text,'tenantId',tenant::text,'assessmentId',ref::text,'rootId',prior.root_id::text,'requestId',request_id::text,'previousId',coalesce(prior.previous_id::text,''),'sequence',prior.sequence);end if;
 if public.has_permission('pflege.assessments.manage') is not true or a.status in ('superseded','archived','professional_review') then raise exception 'Keine aktuelle Evaluations-Schreibfreigabe.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(tenant::text||':plan-eval-root:'||root_ref::text,0));
 select * into r from public.care_plan_evaluation_roots x where x.id=root_ref for update;server_now:=clock_timestamp();
 perform care_private.plan_eval_snapshot(p,server_now);perform care_private.plan_eval_draft(d,p,server_now);
 if d->>'action'<>'void' then perform care_private.plan_eval_measure_reviews(d->'entry',p,true);end if;
 if p->>'assessmentId'<>ref::text or p->>'tenantId'<>tenant::text or p->>'clientId'<>a.subject_id::text then raise exception 'Fremder historischer Planbezug.' using errcode='42501';end if;
 if r.id is not null then
  if r.tenant_id<>tenant or r.assessment_id<>ref or r.snapshot<>p then raise exception 'Originalplan darf nicht ausgetauscht werden.' using errcode='23514';end if;
 else
  if (p->>'version')::integer<>a.version or (p->>'draftRevision')::integer<>a.draft_revision or care_private.plan_eval_time(p->>'updatedAt')<>a.updated_at or p->>'status'<>a.status then raise exception 'Bewerteter Planstand inzwischen geändert.' using errcode='40001';end if;
  for m in select value from jsonb_array_elements(p->'measures') loop
   select jsonb_build_object('id',x.id::text,'title',x.title,'relatedTopicKey',x.related_topic_key,'relatedRiskKey',x.related_risk_key,'personalGoal',x.personal_goal,'intervention',x.intervention,'timing',x.timing,'frequency',x.frequency,'responsibleRole',x.responsible_role,'personContribution',x.person_contribution,'relativesContribution',x.relatives_contribution,'warningSigns',x.warning_signs,'escalationPath',x.escalation_path,'evaluationCriteria',x.evaluation_criteria,'nextEvaluationAt',x.next_evaluation_at,'status',x.status) into native from public.care_assessment_measures x where x.id=(m->>'id')::uuid and x.assessment_id=ref and x.tenant_id=tenant for share;
   if native is null or native-'nextEvaluationAt'<>m-'nextEvaluationAt' or ((native->'nextEvaluationAt'='null'::jsonb)<>(m->'nextEvaluationAt'='null'::jsonb)) or (m->'nextEvaluationAt'<>'null'::jsonb and care_private.plan_eval_time(m->>'nextEvaluationAt')<>(native->>'nextEvaluationAt')::timestamptz) then raise exception 'Ausgewählte Originalmaßnahme inzwischen geändert.' using errcode='40001';end if;
  end loop;
 end if;
 for old in select x.* from public.care_plan_evaluation_events x where x.root_id=root_ref order by x.sequence loop
  if old.tenant_id<>tenant or old.assessment_id<>ref or old.sequence<>seq+1 or old.previous_id is distinct from head or old.recorded_at>server_now or (last_at is not null and old.recorded_at<last_at) or (seq=0 and old.recorded_at<>r.created_at) then raise exception 'Originalverlauf unvollständig.' using errcode='23514';end if;
  perform care_private.plan_eval_draft(old.draft,r.snapshot,old.recorded_at);
  if (seq=0 and old.draft->>'action'<>'record') or (seq>0 and (old.draft->>'action'='record' or entry='null'::jsonb)) or (old.draft->>'action'='replace' and old.draft->'entry'=entry) then raise exception 'Originalfolge widersprüchlich.' using errcode='23514';end if;entry:=old.draft->'entry';seq:=old.sequence;head:=old.id;last_at:=old.recorded_at;
 end loop;
 if seq<>(payload->>'expectedSequence')::integer or head is distinct from expected or (r.id is not null and seq=0) or (seq=0 and d->>'action'<>'record') or (seq>0 and (d->>'action'='record' or entry='null'::jsonb)) or (d->>'action'='replace' and d->'entry'=entry) then raise exception 'Evaluationskopf geändert, zurückgenommen oder keine tatsächliche Berichtigung.' using errcode='40001';end if;
 if r.id is null then insert into public.care_plan_evaluation_roots(id,tenant_id,assessment_id,snapshot,created_at) values(root_ref,tenant,ref,p,server_now);end if;
 insert into public.care_plan_evaluation_events(id,tenant_id,assessment_id,root_id,sequence,previous_id,request_id,actor_id,actor_name,recorded_at,draft,request_payload) values(result,tenant,ref,root_ref,seq+1,head,request_id,actor,name,server_now,d,payload);
 return jsonb_build_object('id',result::text,'tenantId',tenant::text,'assessmentId',ref::text,'rootId',root_ref::text,'requestId',request_id::text,'previousId',coalesce(head::text,''),'sequence',seq+1);
end $$;

create or replace function care_private.control_evaluation_result(evidence jsonb,original jsonb,t jsonb,actor uuid,cycle_at timestamptz,result_at timestamptz,recorded_at timestamptz,complete boolean,server_now timestamptz) returns void language plpgsql set search_path='' as $$
declare s jsonb:=evidence->'snapshot';o jsonb:=original->'snapshot';m jsonb;begin
 if evidence->>'kind' is distinct from 'plan_evaluation' or original->>'kind' is distinct from 'plan_evaluation' then raise exception 'Folgeevaluation ausschließlich für eigenen Evaluationsauftrag.' using errcode='23514';end if;
 perform care_private.control_evaluation_evidence(s,t,server_now);perform care_private.control_evaluation_shape(o,t,server_now);
 if actor is null or s->>'actor_id' is distinct from actor::text or cycle_at is null or result_at is null or recorded_at is null or complete is null then raise exception 'Eigene Evaluationsperson und Auftragszeiten bestätigen.' using errcode='23514';end if;
 if s->>'id' is distinct from evidence->>'id' or o->>'id' is distinct from original->>'id' or s->>'root_id'=o->>'root_id' or s->>'assessment_id' is distinct from o->>'assessment_id' then raise exception 'Eigenständiger neuer Evaluationsbeleg zum selben Assessment erforderlich.' using errcode='23514';end if;
 if care_private.plan_eval_time(s->>'root_created_at')<cycle_at or care_private.plan_eval_time(s->'draft'->'entry'->>'periodStartAt')<cycle_at or care_private.plan_eval_time(s->>'occurred_at')>result_at or care_private.plan_eval_time(s->>'recorded_at')>recorded_at then raise exception 'Folgebeobachtung oder verfügbarer Ergebnisbeleg passt nicht zur Auftragsfassung.' using errcode='23514';end if;
 if complete and s->'draft'->'entry'->>'outcome'='not_assessable' then raise exception 'Nicht beurteilbare Wirkung bleibt Teilprüfung.' using errcode='23514';end if;
 if s->'draft'->'entry'?'measureReviews' then
  if not exists(select 1 from jsonb_array_elements(s->'draft'->'entry'->'measureReviews') r where r->>'source'='observed') then raise exception 'Reine Fremdangaben belegen keine eigene Folgeprüfung.' using errcode='23514';end if;
  if complete and exists(select 1 from jsonb_array_elements(s->'draft'->'entry'->'measureReviews') r where r->>'source'<>'observed' or r->>'outcome'='not_assessable') then raise exception 'Jede Maßnahme für vollständigen Abschluss selbst beurteilen. Teilprüfung bleibt offen.' using errcode='23514';end if;
 end if;
 for m in select value from jsonb_array_elements(o->'plan'->'measures') loop
  if not exists(select 1 from jsonb_array_elements(s->'plan'->'measures') n where n->>'id'=m->>'id' and n=m) then raise exception 'Alle Originalmaßnahmen, Ziele und Kriterien unverändert erneut bewerten.' using errcode='23514';end if;
 end loop;
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
 if k in ('attempt','resolve') and d->'evidence'->>'kind'='plan_evaluation' then perform care_private.plan_eval_measure_reviews(d->'evidence'->'snapshot'->'draft'->'entry',d->'evidence'->'snapshot'->'plan',true);end if;
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
revoke all on function care_private.plan_eval_measure_reviews(jsonb,jsonb,boolean) from public,anon,authenticated;
-- Existing private helper revocations and explicit writer/wrapper grants remain unchanged.
commit;
