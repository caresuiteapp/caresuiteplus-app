-- LOCAL REVIEW ONLY, NOT APPLIED. Apply only after clinical_control_tasks.sql AND daily_care_protocols.sql.
-- Full replacements preserve existing seven source adapters, policies and public RPC identities.
-- Requires actual DB parity, RLS, shared/exclusive lock races and rollback review before any migration.
begin;
create or replace function care_private.control_protocol_snapshot(r public.care_protocol_roots,e public.care_protocol_events) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('id',e.id::text,'tenant_id',e.tenant_id::text,'client_id',e.client_id::text,'root_id',r.id::text,'protocol_version',r.version,'protocol_kind',r.kind,'sequence',e.sequence,'previous_id',coalesce(e.previous_id::text,''),'actor_id',e.actor_id::text,'actor_name',e.actor_name,'request_id',e.request_id::text,'recorded_at',to_char(e.recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'occurred_at',e.draft->'entry'->>'occurredAt','title',case r.kind when 'drink' then 'Trinkprotokoll' when 'meal' then 'Mahlzeitenprotokoll' when 'stool' then 'Stuhl-/Darmprotokoll' when 'urine' then 'Miktions-/Urinprotokoll' when 'fluid_output' then 'Weitere Flüssigkeitsausfuhr' end,'draft',e.draft)
$$;
create or replace function care_private.control_protocol_shape(s jsonb,t jsonb,server_now timestamptz) returns void language plpgsql set search_path='' as $$
declare f text;at_time timestamptz;recorded timestamptz;begin
 if jsonb_typeof(s) is distinct from 'object' or s-array['id','tenant_id','client_id','root_id','protocol_version','protocol_kind','sequence','previous_id','actor_id','actor_name','request_id','recorded_at','occurred_at','title','draft']<>'{}'::jsonb or (select count(*) from jsonb_each(s))<>15 then raise exception 'Vollständiger nativer Protokollbeleg fehlt.' using errcode='23514';end if;
 foreach f in array array['id','tenant_id','client_id','root_id','actor_id','request_id'] loop if jsonb_typeof(s->f) is distinct from 'string' or not care_private.control_uuid(s->>f) then raise exception 'Nativer Protokollbezug ungültig.' using errcode='23514';end if;end loop;
 foreach f in array array['protocol_version','protocol_kind','previous_id','actor_name','recorded_at','occurred_at','title'] loop if jsonb_typeof(s->f) is distinct from 'string' or length(s->>f)>4000 then raise exception 'Protokollbelegfeld fehlt.' using errcode='23514';end if;end loop;
 if s->>'tenant_id' is distinct from t->>'tenantId' or s->>'client_id' is distinct from t->>'clientId' or s->>'protocol_version'<>'2026-10-09.1' or s->>'protocol_kind' not in ('drink','meal','stool','urine','fluid_output') or nullif(btrim(s->>'actor_name'),'') is null then raise exception 'Fremde oder unvollständige Protokollquelle.' using errcode='23514';end if;
 if jsonb_typeof(s->'sequence') is distinct from 'number' or (s->>'sequence') !~ '^[1-9][0-9]*$' then raise exception 'Protokollfassung ungültig.' using errcode='23514';end if;
 if (s->>'sequence')::numeric>9007199254740991 or ((s->>'sequence')::numeric=1)<>(s->>'previous_id'='') or (s->>'previous_id'<>'' and not care_private.control_uuid(s->>'previous_id')) then raise exception 'Protokollvorgänger widersprüchlich.' using errcode='23514';end if;
 perform care_private.protocol_draft(s->'draft',server_now);
 if s->'draft'->>'action'='void' or s->'draft'->'entry'->>'kind' is distinct from s->>'protocol_kind' or ((s->>'sequence')::numeric=1)<>(s->'draft'->>'action'='record') or s->>'occurred_at' is distinct from s->'draft'->'entry'->>'occurredAt'
 or s->>'title' is distinct from case s->>'protocol_kind' when 'drink' then 'Trinkprotokoll' when 'meal' then 'Mahlzeitenprotokoll' when 'stool' then 'Stuhl-/Darmprotokoll' when 'urine' then 'Miktions-/Urinprotokoll' when 'fluid_output' then 'Weitere Flüssigkeitsausfuhr' end then raise exception 'Zurückgenommene oder widersprüchliche Protokollfassung.' using errcode='23514';end if;
 at_time:=care_private.infusion_time(s->>'occurred_at');recorded:=care_private.infusion_time(s->>'recorded_at');if recorded<at_time or recorded>server_now then raise exception 'Protokollzeitpunkte widersprüchlich.' using errcode='23514';end if;
end $$;
create or replace function care_private.control_protocol_evidence(s jsonb,t jsonb,server_now timestamptz) returns void language plpgsql set search_path='' as $$
declare e jsonb:=s->'draft'->'entry';begin
 perform care_private.control_protocol_shape(s,t,server_now);
 if e->>'source'<>'observed' or (e->>'kind'='stool' and e->>'occurrence'<>'passed') or (e->>'kind' in ('urine','fluid_output') and (e->>'occurrence' not in ('passed','collected','zero_collected') or e->'actual'->>'state'='not_measured')) or (e->>'kind' in ('drink','meal') and (e->>'outcome' not in ('taken','partial','none_taken') or e->'actual'->>'state'='not_measured')) then raise exception 'Fremdangabe, Beobachtungsgrenze oder fehlende Menge ist kein Ergebnisbeleg.' using errcode='23514';end if;
end $$;

create or replace function care_private.control_source_allowed(kind text) returns boolean language sql stable set search_path='' as $$
 select case kind
 when 'treatment_execution' then public.has_permission('pflege.treatment.view') and public.has_permission('pflege.medications.view') and public.has_permission('pflege.vitals.view')
 when 'infusion_event' then public.has_permission('pflege.treatment.view') and public.has_permission('pflege.orders.view')
 when 'wound_assessment' then public.has_permission('pflege.wounds.view')
 when 'medication_administration' then public.has_permission('pflege.medications.view')
 when 'vital_measurement' then public.has_permission('pflege.vitals.view')
 when 'care_plan' then public.has_permission('pflege.plans.view')
 when 'protocol_event' then public.has_permission('pflege.documentation.view')
 when 'pflege_report' then public.has_permission('pflege.documentation.view') else false end
$$;

create or replace function care_private.control_source_shape(s jsonb,t jsonb) returns void language plpgsql set search_path='' as $$begin
 if jsonb_typeof(s) is distinct from 'object' or s-array['kind','id','snapshot']<>'{}'::jsonb or (select count(*) from jsonb_each(s))<>3
 or jsonb_typeof(s->'kind') is distinct from 'string' or s->>'kind' not in ('infusion_event','treatment_execution','wound_assessment','medication_administration','vital_measurement','care_plan','pflege_report','protocol_event')
 or not care_private.control_uuid(s->>'id') or jsonb_typeof(s->'snapshot') is distinct from 'object' or length((s->'snapshot')::text)>120000
 or s->'snapshot'->>'id' is distinct from s->>'id' or s->'snapshot'->>'tenant_id' is distinct from t->>'tenantId' or s->'snapshot'->>'client_id' is distinct from t->>'clientId' then raise exception 'Originalbeleg ungültig, fremd oder zu umfangreich.' using errcode='23514';end if;
 if s->>'kind'='protocol_event' then perform care_private.control_protocol_shape(s->'snapshot',t,clock_timestamp());end if;
end $$;

create or replace function care_private.control_draft(t jsonb,d jsonb,server_now timestamptz) returns void language plpgsql set search_path='' as $$
declare k text:=d->>'kind';fields text[];f text;s jsonb;at_time timestamptz;evidence_at timestamptz;begin
 fields:=case k when 'create' then array['title','reason','instruction','source','policy'] when 'assign' then array['assigneeId','backupId','escalationRecipientId','reason'] when 'reschedule' then array['dueAt','escalationAt','reason']
 when 'attempt' then array['outcome','result','reason','communication','personDecision','qualificationBasis','evidence','overrideReason'] when 'resolve' then array['outcome','result','reason','communication','personDecision','qualificationBasis','evidence','overrideReason','followUpTaskId','noFollowUpReason']
 when 'cancel' then array['reason','communication'] when 'reopen' then array['reason','policy'] when 'escalate' then array['policyEventId','recipientId','channel','delivery','message','response'] when 'acknowledge' then array['escalationEventId','response','nextStep'] else null end;
 if fields is null or jsonb_typeof(d) is distinct from 'object' or d-(fields||array['kind','occurredAt'])<>'{}'::jsonb or (select count(*) from jsonb_each(d))<>cardinality(fields)+2 then raise exception 'Kontrollereignisfelder unvollständig oder fremd.' using errcode='23514';end if;
 foreach f in array fields||array['kind','occurredAt'] loop if f not in ('source','policy','evidence') and (jsonb_typeof(d->f) is distinct from 'string' or length(d->>f)>4000) then raise exception 'Kontrollereignisfeld ungültig: %',f using errcode='23514';end if;end loop;
 at_time:=care_private.infusion_time(d->>'occurredAt');if at_time>server_now then raise exception 'Tatsächliches Kontrollereignis liegt in der Zukunft.' using errcode='23514';end if;
 if k='create' then foreach f in array array['title','reason','instruction'] loop if nullif(btrim(d->>f),'') is null then raise exception 'Individueller Kontrollauftrag unvollständig.' using errcode='23514';end if;end loop;perform care_private.control_source_shape(d->'source',t);if d->'source'->>'kind'='protocol_event' and care_private.infusion_time(d->'source'->'snapshot'->>'occurred_at')>at_time then raise exception 'Protokollbeobachtung liegt nach dem dokumentierten Auftrag.' using errcode='23514';end if;end if;
 if k in ('create','reopen') then perform care_private.control_policy(d->'policy',at_time);end if;
 if k in ('assign','reschedule','reopen','cancel') and nullif(btrim(d->>'reason'),'') is null then raise exception 'Tatsächlicher Änderungsgrund fehlt.' using errcode='23514';end if;
 if k='assign' and (not care_private.control_uuid(d->>'assigneeId') or (d->>'backupId'<>'' and not care_private.control_uuid(d->>'backupId')) or d->>'backupId'=d->>'assigneeId' or not care_private.control_uuid(d->>'escalationRecipientId')) then raise exception 'Zuständige Personen ungültig.' using errcode='23514';end if;
 if k='reschedule' and (care_private.infusion_time(d->>'dueAt')<at_time or care_private.infusion_time(d->>'escalationAt')<care_private.infusion_time(d->>'dueAt')) then raise exception 'Neue Fristen widersprüchlich.' using errcode='23514';end if;
 if k='cancel' and nullif(btrim(d->>'communication'),'') is null then raise exception 'Tatsächliche Abstimmung fehlt.' using errcode='23514';end if;
 if k in ('attempt','resolve') then
  foreach f in array array['result','communication','personDecision','qualificationBasis'] loop if nullif(btrim(d->>f),'') is null then raise exception 'Tatsächliches Ergebnis, Abstimmung oder Personenbezug fehlt.' using errcode='23514';end if;end loop;
  if (k='attempt' and d->>'outcome'<>'partial') or (k='resolve' and d->>'outcome' not in ('performed','omitted','refused','failed')) or ((k='attempt' or d->>'outcome'<>'performed') and nullif(btrim(d->>'reason'),'') is null) then raise exception 'Tatsächliches Durchführungsergebnis oder Abweichungsgrund fehlt.' using errcode='23514';end if;
  s:=d->'evidence';if k='attempt' or d->>'outcome'='performed' or s<>'null'::jsonb then
   perform care_private.control_source_shape(s,t);if s->>'kind' not in ('treatment_execution','medication_administration','vital_measurement','protocol_event') then raise exception 'Planung ist kein tatsächlicher Ergebnisbeleg.' using errcode='23514';end if;
   evidence_at:=care_private.infusion_time(s->'snapshot'->>case when s->>'kind'='treatment_execution' then 'performed_at' else 'occurred_at' end);if evidence_at>at_time then raise exception 'Beleg liegt nach dem Kontrollergebnis.' using errcode='23514';end if;
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

create or replace function care_private.control_source_current(kind text,requested_source uuid,tenant uuid,subject uuid) returns jsonb language plpgsql set search_path='' as $$
declare result jsonb;protocol_root uuid;head public.care_protocol_events%rowtype;root public.care_protocol_roots%rowtype;begin
 if care_private.control_source_allowed(kind) is not true then raise exception 'Bereichsleserecht für Originalquelle fehlt.' using errcode='42501';end if;
 case kind
 when 'treatment_execution' then
  select to_jsonb(x) into result from public.clinical_treatment_executions x where x.id=requested_source and x.tenant_id=tenant and x.client_id=subject for share;
  if result->>'treatment_type'='wound_dressing' and public.has_permission('pflege.wounds.view') is not true then raise exception 'Wundleserecht für Verbandnachweis fehlt.' using errcode='42501';end if;
  if exists(select 1 from public.clinical_treatment_corrections c where c.execution_id=requested_source and c.tenant_id=tenant and c.client_id=subject) then raise exception 'Berichtigter Nachweis benötigt gesonderte Quellenprüfung.' using errcode='40001';end if;
 when 'wound_assessment' then
  select to_jsonb(x) into result from public.clinical_wound_assessments x where x.id=requested_source and x.tenant_id=tenant and x.client_id=subject for share;
  if exists(select 1 from public.ambulatory_wound_assessment_corrections c where c.assessment_id=requested_source and c.tenant_id=tenant and c.client_id=subject) then raise exception 'Berichtigtes Assessment benötigt gesonderte Quellenprüfung.' using errcode='40001';end if;
 when 'medication_administration' then select to_jsonb(x) into result from public.medication_administrations x where x.id=requested_source and x.tenant_id=tenant and x.client_id=subject for share;
 when 'vital_measurement' then
  select to_jsonb(x) into result from public.vital_sign_measurements x where x.id=requested_source and x.tenant_id=tenant and x.client_id=subject for share;
  if exists(select 1 from public.vital_measurement_invalidations i where i.measurement_id=requested_source and i.tenant_id=tenant and i.client_id=subject) then raise exception 'Ungültige Messung darf kein Kontrollbeleg sein.' using errcode='40001';end if;
 when 'care_plan' then select to_jsonb(x) into result from public.care_plans x where x.id=requested_source and x.tenant_id=tenant and x.client_id=subject for share;
 when 'protocol_event' then
  select x.root_id into protocol_root from public.care_protocol_events x where x.id=requested_source and x.tenant_id=tenant and x.client_id=subject;
  if protocol_root is null or care_private.protocol_access(tenant,subject) is not true then raise exception 'Protokollquelle nicht zugänglich.' using errcode='42501';end if;
  -- Same key as protocol writer, shared read versus exclusive append. No read/append race.
  perform pg_advisory_xact_lock_shared(hashtextextended(tenant::text||':protocol-root:'||protocol_root::text,0));
  select r.* into root from public.care_protocol_roots r where r.id=protocol_root and r.tenant_id=tenant and r.client_id=subject for share;
  select e.* into head from public.care_protocol_events e where e.root_id=protocol_root and e.tenant_id=tenant and e.client_id=subject order by e.sequence desc limit 1 for share;
  if head.id is distinct from requested_source or head.draft->>'action'='void' then raise exception 'Protokollquelle inzwischen berichtigt oder zurückgenommen. Aktuellen Originalbestand laden.' using errcode='40001';end if;
  result:=care_private.control_protocol_snapshot(root,head);
  perform care_private.control_protocol_shape(result,jsonb_build_object('tenantId',tenant::text,'clientId',subject::text),clock_timestamp());
 when 'pflege_report' then select to_jsonb(x) into result from public.clinical_documentation_entries x where x.id=requested_source and x.tenant_id=tenant and x.client_id=subject and x.signature_status<>'superseded' for share;
 when 'infusion_event' then
  select to_jsonb(x) into result from public.care_infusion_events x where x.id=requested_source and x.tenant_id=tenant and x.client_id=subject and x.draft->>'kind'<>'correction' for share;
  if exists(select 1 from public.care_infusion_events c where c.tenant_id=tenant and c.client_id=subject and c.draft->>'kind'='correction' and c.draft->>'targetEventId'=requested_source::text) then raise exception 'Berichtigtes Infusionsereignis benötigt gesonderte Quellenprüfung.' using errcode='40001';end if;
 else raise exception 'Originalquelle nicht angebunden.' using errcode='23514';end case;
 if result is null then raise exception 'Originalquelle fehlt oder gehört nicht zur eigenen Akte.' using errcode='42501';end if;return result;
end $$;

create or replace function care_private.read_clinical_control_sources(requested_tenant uuid,requested_client uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare answer jsonb;begin
 if requested_client is null then raise exception 'Aktive Pflegeakte auswählen.' using errcode='23514';end if;perform care_private.assert_control_access(requested_tenant,requested_client);
 with sources as (
  select 'treatment_execution' kind,x.id,to_jsonb(x) snapshot from public.clinical_treatment_executions x where x.tenant_id=requested_tenant and x.client_id=requested_client and care_private.control_source_allowed('treatment_execution') and (x.treatment_type<>'wound_dressing' or public.has_permission('pflege.wounds.view')) and not exists(select 1 from public.clinical_treatment_corrections c where c.execution_id=x.id and c.tenant_id=x.tenant_id and c.client_id=x.client_id)
  union all select 'wound_assessment',x.id,to_jsonb(x) from public.clinical_wound_assessments x where x.tenant_id=requested_tenant and x.client_id=requested_client and care_private.control_source_allowed('wound_assessment') and not exists(select 1 from public.ambulatory_wound_assessment_corrections c where c.assessment_id=x.id and c.tenant_id=x.tenant_id and c.client_id=x.client_id)
  union all select 'medication_administration',x.id,to_jsonb(x) from public.medication_administrations x where x.tenant_id=requested_tenant and x.client_id=requested_client and care_private.control_source_allowed('medication_administration')
  union all select 'vital_measurement',x.id,to_jsonb(x) from public.vital_sign_measurements x where x.tenant_id=requested_tenant and x.client_id=requested_client and care_private.control_source_allowed('vital_measurement') and not exists(select 1 from public.vital_measurement_invalidations i where i.measurement_id=x.id and i.tenant_id=x.tenant_id and i.client_id=x.client_id)
  union all select 'care_plan',x.id,to_jsonb(x) from public.care_plans x where x.tenant_id=requested_tenant and x.client_id=requested_client and care_private.control_source_allowed('care_plan')
  union all select 'pflege_report',x.id,to_jsonb(x) from public.clinical_documentation_entries x where x.tenant_id=requested_tenant and x.client_id=requested_client and care_private.control_source_allowed('pflege_report') and x.signature_status<>'superseded'
  union all select 'infusion_event',x.id,to_jsonb(x) from public.care_infusion_events x where x.tenant_id=requested_tenant and x.client_id=requested_client and care_private.control_source_allowed('infusion_event') and x.draft->>'kind'<>'correction' and not exists(select 1 from public.care_infusion_events c where c.tenant_id=x.tenant_id and c.client_id=x.client_id and c.draft->>'kind'='correction' and c.draft->>'targetEventId'=x.id::text)
  union all select 'protocol_event',e.id,care_private.control_protocol_snapshot(r,e) from public.care_protocol_roots r
   join lateral(select x.* from public.care_protocol_events x where x.root_id=r.id and x.tenant_id=r.tenant_id and x.client_id=r.client_id order by x.sequence desc limit 1)e on true
   where r.tenant_id=requested_tenant and r.client_id=requested_client and care_private.control_source_allowed('protocol_event') and care_private.protocol_access(requested_tenant,requested_client) and e.draft->>'action'<>'void'
 ) select jsonb_build_object('version','2026-10-09.1','tenantId',requested_tenant::text,'clientId',requested_client::text,'count',count(*),'sources',coalesce(jsonb_agg(jsonb_build_object('kind',kind,'id',id::text,'snapshot',snapshot) order by kind,id),'[]')) into answer from sources;return answer;
end $$;
revoke all on function care_private.control_protocol_snapshot(public.care_protocol_roots,public.care_protocol_events) from public,anon,authenticated;
revoke all on function care_private.control_protocol_shape(jsonb,jsonb,timestamptz) from public,anon,authenticated;
revoke all on function care_private.control_protocol_evidence(jsonb,jsonb,timestamptz) from public,anon,authenticated;
commit;
