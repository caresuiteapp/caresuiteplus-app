-- LOCAL REVIEW ONLY, NOT APPLIED. Requires evaluation_measure_reviews.sql.
-- Scope comes exclusively from the immutable first order, never from a result request.
begin;
create or replace function care_private.control_evaluation_scope(original jsonb,measure_id text,t jsonb,server_now timestamptz) returns void language plpgsql set search_path='' as $$
begin
 if original->>'kind' is distinct from 'plan_evaluation' or measure_id is null or not care_private.plan_eval_uuid(to_jsonb(measure_id)) then raise exception 'Native Auftragsmaßnahme fehlt.' using errcode='23514';end if;
 perform care_private.control_evaluation_shape(original->'snapshot',t,server_now);
 perform care_private.plan_eval_measure_reviews(original->'snapshot'->'draft'->'entry',original->'snapshot'->'plan',true);
 if not exists(select 1 from jsonb_array_elements(original->'snapshot'->'plan'->'measures') m where m->>'id'=measure_id) then raise exception 'Fremde Auftragsmaßnahme.' using errcode='23514';end if;
end $$;

create or replace function care_private.control_draft(t jsonb,d jsonb,server_now timestamptz) returns void language plpgsql set search_path='' as $$
declare k text:=d->>'kind';fields text[];f text;s jsonb;at_time timestamptz;evidence_at timestamptz;begin
 fields:=case k when 'create' then array['title','reason','instruction','source','policy'] when 'assign' then array['assigneeId','backupId','escalationRecipientId','reason'] when 'reschedule' then array['dueAt','escalationAt','reason']
 when 'attempt' then array['outcome','result','reason','communication','personDecision','qualificationBasis','evidence','overrideReason'] when 'resolve' then array['outcome','result','reason','communication','personDecision','qualificationBasis','evidence','overrideReason','followUpTaskId','noFollowUpReason']
 when 'cancel' then array['reason','communication'] when 'reopen' then array['reason','policy'] when 'escalate' then array['policyEventId','recipientId','channel','delivery','message','response'] when 'acknowledge' then array['escalationEventId','response','nextStep'] else null end;
 if k='create' and d?'evaluationMeasureId' then fields:=fields||array['evaluationMeasureId'];end if;
 if fields is null or jsonb_typeof(d) is distinct from 'object' or d-(fields||array['kind','occurredAt'])<>'{}'::jsonb or (select count(*) from jsonb_each(d))<>cardinality(fields)+2 then raise exception 'Kontrollereignisfelder unvollständig oder fremd.' using errcode='23514';end if;
 foreach f in array fields||array['kind','occurredAt'] loop if f not in ('source','policy','evidence') and (jsonb_typeof(d->f) is distinct from 'string' or length(d->>f)>4000) then raise exception 'Kontrollereignisfeld ungültig: %',f using errcode='23514';end if;end loop;
 at_time:=care_private.infusion_time(d->>'occurredAt');if at_time>server_now then raise exception 'Tatsächliches Kontrollereignis liegt in der Zukunft.' using errcode='23514';end if;
 if k='create' then foreach f in array array['title','reason','instruction'] loop if nullif(btrim(d->>f),'') is null then raise exception 'Individueller Kontrollauftrag unvollständig.' using errcode='23514';end if;end loop;perform care_private.control_source_shape(d->'source',t);if d?'evaluationMeasureId' then perform care_private.control_evaluation_scope(d->'source',d->>'evaluationMeasureId',t,server_now);end if;if d->'source'->>'kind' in ('protocol_event','plan_evaluation') and care_private.infusion_time(d->'source'->'snapshot'->>'occurred_at')>at_time then raise exception 'Originalbeobachtung liegt nach dem dokumentierten Auftrag.' using errcode='23514';end if;end if;
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

create or replace function care_private.control_evaluation_result(evidence jsonb,original jsonb,t jsonb,actor uuid,cycle_at timestamptz,result_at timestamptz,recorded_at timestamptz,complete boolean,server_now timestamptz) returns void language plpgsql set search_path='' as $$
declare s jsonb:=evidence->'snapshot';o jsonb:=original->'snapshot';m jsonb;measure_id text:=coalesce(t->>'evaluationMeasureId','');begin
 if evidence->>'kind' is distinct from 'plan_evaluation' or original->>'kind' is distinct from 'plan_evaluation' then raise exception 'Folgeevaluation ausschließlich für eigenen Evaluationsauftrag.' using errcode='23514';end if;
 perform care_private.control_evaluation_evidence(s,t,server_now);perform care_private.control_evaluation_shape(o,t,server_now);
 if actor is null or s->>'actor_id' is distinct from actor::text or cycle_at is null or result_at is null or recorded_at is null or complete is null then raise exception 'Eigene Evaluationsperson und Auftragszeiten bestätigen.' using errcode='23514';end if;
 if s->>'id' is distinct from evidence->>'id' or o->>'id' is distinct from original->>'id' or s->>'root_id'=o->>'root_id' or s->>'assessment_id' is distinct from o->>'assessment_id' then raise exception 'Eigenständiger neuer Evaluationsbeleg zum selben Assessment erforderlich.' using errcode='23514';end if;
 if care_private.plan_eval_time(s->>'root_created_at')<cycle_at or care_private.plan_eval_time(s->'draft'->'entry'->>'periodStartAt')<cycle_at or care_private.plan_eval_time(s->>'occurred_at')>result_at or care_private.plan_eval_time(s->>'recorded_at')>recorded_at then raise exception 'Folgebeobachtung oder verfügbarer Ergebnisbeleg passt nicht zur Auftragsfassung.' using errcode='23514';end if;
 if measure_id<>'' then perform care_private.control_evaluation_scope(original,measure_id,t,server_now);perform care_private.plan_eval_measure_reviews(s->'draft'->'entry',s->'plan',true);if not exists(select 1 from jsonb_array_elements(s->'draft'->'entry'->'measureReviews') r where r->>'measureId'=measure_id) then raise exception 'Einzelbefund der Auftragsmaßnahme fehlt.' using errcode='23514';end if;end if;
 if measure_id='' and complete and s->'draft'->'entry'->>'outcome'='not_assessable' then raise exception 'Nicht beurteilbare Wirkung bleibt Teilprüfung.' using errcode='23514';end if;
 if s->'draft'->'entry'?'measureReviews' then
  if not exists(select 1 from jsonb_array_elements(s->'draft'->'entry'->'measureReviews') r where (measure_id='' or r->>'measureId'=measure_id) and r->>'source'='observed') then raise exception 'Reine Fremdangaben belegen keine eigene Folgeprüfung.' using errcode='23514';end if;
  if complete and exists(select 1 from jsonb_array_elements(s->'draft'->'entry'->'measureReviews') r where (measure_id='' or r->>'measureId'=measure_id) and (r->>'source'<>'observed' or r->>'outcome'='not_assessable')) then raise exception 'Jede Maßnahme für vollständigen Abschluss selbst beurteilen. Teilprüfung bleibt offen.' using errcode='23514';end if;
 end if;
 for m in select value from jsonb_array_elements(o->'plan'->'measures') x where measure_id='' or x->>'id'=measure_id loop
  if not exists(select 1 from jsonb_array_elements(s->'plan'->'measures') n where n->>'id'=m->>'id' and n=m) then raise exception 'Alle Originalmaßnahmen, Ziele und Kriterien unverändert erneut bewerten.' using errcode='23514';end if;
 end loop;
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
    perform care_private.control_evaluation_result(snapshot,order_source,t||jsonb_build_object('evaluationMeasureId',coalesce(history->0->'draft'->>'evaluationMeasureId','')),actor,care_private.infusion_time(cycle->'draft'->>'occurredAt'),care_private.infusion_time(d->>'occurredAt'),care_private.infusion_time(t->>'controlRecordedAt'),k='resolve' and d->>'outcome'='performed',clock_timestamp());
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
revoke all on function care_private.control_evaluation_scope(jsonb,text,jsonb,timestamptz) from public,anon,authenticated;
commit;
