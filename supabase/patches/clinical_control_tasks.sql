-- LOCAL REVIEW ONLY, NOT APPLIED. Requires clinical core and the preceding ambulatory
-- infusion, vital invalidation, treatment/wound correction patches in this checkpoint.
-- No scheduled delivery, clinical authorization, new medication, stock or billing booking.
begin;
create table if not exists public.care_control_tasks(
 id uuid primary key,tenant_id uuid not null references public.tenants(id),client_id uuid not null references public.clients(id),
 version text not null check(version='2026-10-09.1'),created_at timestamptz not null,
 recorded_by uuid not null references public.profiles(id),unique(id,tenant_id,client_id)
);
create table if not exists public.care_control_events(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),client_id uuid not null references public.clients(id),task_id uuid not null,
 sequence integer not null check(sequence>0),previous_id uuid,actor_id uuid not null references public.profiles(id),actor_name text not null,
 request_id uuid not null,recorded_at timestamptz not null,draft jsonb not null,request_payload jsonb not null,
 unique(task_id,sequence),unique(tenant_id,request_id),unique(id,task_id),
 foreign key(task_id,tenant_id,client_id) references public.care_control_tasks(id,tenant_id,client_id),
 foreign key(previous_id,task_id) references public.care_control_events(id,task_id),
 check((sequence=1)=(previous_id is null)),check(jsonb_typeof(draft)='object'),check(jsonb_typeof(request_payload)='object')
);
create index if not exists care_control_client on public.care_control_tasks(tenant_id,client_id,created_at desc,id desc);
create index if not exists care_control_history on public.care_control_events(tenant_id,task_id,sequence);
alter table public.care_control_tasks enable row level security;
alter table public.care_control_events enable row level security;
revoke all on public.care_control_tasks,public.care_control_events from public,anon,authenticated;
grant select on public.care_control_tasks,public.care_control_events to authenticated;

create or replace function care_private.control_source_allowed(kind text) returns boolean language sql stable set search_path='' as $$
 select case kind
 when 'treatment_execution' then public.has_permission('pflege.treatment.view') and public.has_permission('pflege.medications.view') and public.has_permission('pflege.vitals.view')
 when 'infusion_event' then public.has_permission('pflege.treatment.view') and public.has_permission('pflege.orders.view')
 when 'wound_assessment' then public.has_permission('pflege.wounds.view')
 when 'medication_administration' then public.has_permission('pflege.medications.view')
 when 'vital_measurement' then public.has_permission('pflege.vitals.view')
 when 'care_plan' then public.has_permission('pflege.plans.view')
 when 'pflege_report' then public.has_permission('pflege.documentation.view') else false end
$$;
create or replace function care_private.assert_control_access(tenant uuid,subject uuid) returns uuid language plpgsql stable set search_path='' as $$
declare actor uuid:=public.resolve_current_profile_id();begin
 if auth.uid() is null or tenant is distinct from public.current_tenant_id() or actor is null
 or public.has_permission('pflege.documentation.view') is not true or public.has_permission('pflege.treatment.view') is not true or public.has_permission('pflege.orders.view') is not true
 or not exists(select 1 from public.profiles p where p.id=actor and p.tenant_id=tenant and p.is_active and p.role_key not in ('client_portal','family_portal'))
 or (subject is not null and (public.is_active_pfleger_client(subject) is not true or not exists(select 1 from public.clients c where c.id=subject and c.tenant_id=tenant and c.status='active' and c.deleted_at is null))) then raise exception 'Aktiver eigener Pflegeaktenzugang oder Kontrollleserecht fehlt.' using errcode='42501';end if;return actor;
end $$;
-- Whole-task visibility: losing rights to one historical embedded source hides the
-- entire task, never a deceptively truncated chain. Definer prevents recursive RLS.
create or replace function care_private.control_task_readable(task uuid,tenant uuid,subject uuid) returns boolean language plpgsql stable security definer set search_path='' as $$
declare e record;s jsonb;begin
 perform care_private.assert_control_access(tenant,subject);
 if not exists(select 1 from public.care_control_tasks t where t.id=task and t.tenant_id=tenant and t.client_id=subject) then return false;end if;
 for e in select x.draft from public.care_control_events x where x.task_id=task and x.tenant_id=tenant and x.client_id=subject loop
  foreach s in array array[e.draft->'source',e.draft->'evidence'] loop
   if s is not null and s<>'null'::jsonb and (care_private.control_source_allowed(s->>'kind') is not true or (s->>'kind'='treatment_execution' and s->'snapshot'->>'treatment_type'='wound_dressing' and public.has_permission('pflege.wounds.view') is not true)) then return false;end if;
  end loop;
 end loop;return true;
 exception when insufficient_privilege then return false;
end $$;
drop policy if exists control_task_read on public.care_control_tasks;
create policy control_task_read on public.care_control_tasks for select to authenticated using(care_private.control_task_readable(id,tenant_id,client_id));
drop policy if exists control_event_read on public.care_control_events;
create policy control_event_read on public.care_control_events for select to authenticated using(care_private.control_task_readable(task_id,tenant_id,client_id));

create or replace function care_private.control_uuid(value text) returns boolean language sql immutable set search_path='' as $$select coalesce(value ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',false)$$;
create or replace function care_private.control_source_shape(s jsonb,t jsonb) returns void language plpgsql set search_path='' as $$begin
 if jsonb_typeof(s) is distinct from 'object' or s-array['kind','id','snapshot']<>'{}'::jsonb or (select count(*) from jsonb_each(s))<>3
 or jsonb_typeof(s->'kind') is distinct from 'string' or s->>'kind' not in ('infusion_event','treatment_execution','wound_assessment','medication_administration','vital_measurement','care_plan','pflege_report')
 or not care_private.control_uuid(s->>'id') or jsonb_typeof(s->'snapshot') is distinct from 'object' or length((s->'snapshot')::text)>120000
 or s->'snapshot'->>'id' is distinct from s->>'id' or s->'snapshot'->>'tenant_id' is distinct from t->>'tenantId' or s->'snapshot'->>'client_id' is distinct from t->>'clientId' then raise exception 'Originalbeleg ungültig, fremd oder zu umfangreich.' using errcode='23514';end if;
end $$;
create or replace function care_private.control_policy(p jsonb,at_time timestamptz) returns void language plpgsql set search_path='' as $$
declare f text;begin
 if jsonb_typeof(p) is distinct from 'object' or p-array['assigneeId','backupId','dueAt','priority','escalationAt','escalationRecipientId']<>'{}'::jsonb or (select count(*) from jsonb_each(p))<>6 then raise exception 'Auftragsregel unvollständig.' using errcode='23514';end if;
 foreach f in array array['assigneeId','backupId','dueAt','priority','escalationAt','escalationRecipientId'] loop if jsonb_typeof(p->f) is distinct from 'string' or length(p->>f)>4000 then raise exception 'Auftragsregel ungültig.' using errcode='23514';end if;end loop;
 if not care_private.control_uuid(p->>'assigneeId') or (p->>'backupId'<>'' and not care_private.control_uuid(p->>'backupId')) or p->>'backupId'=p->>'assigneeId' or not care_private.control_uuid(p->>'escalationRecipientId') or p->>'priority' not in ('routine','important','urgent')
 or care_private.infusion_time(p->>'dueAt')<at_time or care_private.infusion_time(p->>'escalationAt')<care_private.infusion_time(p->>'dueAt') then raise exception 'Personen, Priorität oder Fristen widersprüchlich.' using errcode='23514';end if;
end $$;
create or replace function care_private.control_draft(t jsonb,d jsonb,server_now timestamptz) returns void language plpgsql set search_path='' as $$
declare k text:=d->>'kind';fields text[];f text;s jsonb;at_time timestamptz;evidence_at timestamptz;begin
 fields:=case k when 'create' then array['title','reason','instruction','source','policy'] when 'assign' then array['assigneeId','backupId','escalationRecipientId','reason'] when 'reschedule' then array['dueAt','escalationAt','reason']
 when 'attempt' then array['outcome','result','reason','communication','personDecision','qualificationBasis','evidence','overrideReason'] when 'resolve' then array['outcome','result','reason','communication','personDecision','qualificationBasis','evidence','overrideReason','followUpTaskId','noFollowUpReason']
 when 'cancel' then array['reason','communication'] when 'reopen' then array['reason','policy'] when 'escalate' then array['policyEventId','recipientId','channel','delivery','message','response'] when 'acknowledge' then array['escalationEventId','response','nextStep'] else null end;
 if fields is null or jsonb_typeof(d) is distinct from 'object' or d-(fields||array['kind','occurredAt'])<>'{}'::jsonb or (select count(*) from jsonb_each(d))<>cardinality(fields)+2 then raise exception 'Kontrollereignisfelder unvollständig oder fremd.' using errcode='23514';end if;
 foreach f in array fields||array['kind','occurredAt'] loop if f not in ('source','policy','evidence') and (jsonb_typeof(d->f) is distinct from 'string' or length(d->>f)>4000) then raise exception 'Kontrollereignisfeld ungültig: %',f using errcode='23514';end if;end loop;
 at_time:=care_private.infusion_time(d->>'occurredAt');if at_time>server_now then raise exception 'Tatsächliches Kontrollereignis liegt in der Zukunft.' using errcode='23514';end if;
 if k='create' then foreach f in array array['title','reason','instruction'] loop if nullif(btrim(d->>f),'') is null then raise exception 'Individueller Kontrollauftrag unvollständig.' using errcode='23514';end if;end loop;perform care_private.control_source_shape(d->'source',t);end if;
 if k in ('create','reopen') then perform care_private.control_policy(d->'policy',at_time);end if;
 if k in ('assign','reschedule','reopen','cancel') and nullif(btrim(d->>'reason'),'') is null then raise exception 'Tatsächlicher Änderungsgrund fehlt.' using errcode='23514';end if;
 if k='assign' and (not care_private.control_uuid(d->>'assigneeId') or (d->>'backupId'<>'' and not care_private.control_uuid(d->>'backupId')) or d->>'backupId'=d->>'assigneeId' or not care_private.control_uuid(d->>'escalationRecipientId')) then raise exception 'Zuständige Personen ungültig.' using errcode='23514';end if;
 if k='reschedule' and (care_private.infusion_time(d->>'dueAt')<at_time or care_private.infusion_time(d->>'escalationAt')<care_private.infusion_time(d->>'dueAt')) then raise exception 'Neue Fristen widersprüchlich.' using errcode='23514';end if;
 if k='cancel' and nullif(btrim(d->>'communication'),'') is null then raise exception 'Tatsächliche Abstimmung fehlt.' using errcode='23514';end if;
 if k in ('attempt','resolve') then
  foreach f in array array['result','communication','personDecision','qualificationBasis'] loop if nullif(btrim(d->>f),'') is null then raise exception 'Tatsächliches Ergebnis, Abstimmung oder Personenbezug fehlt.' using errcode='23514';end if;end loop;
  if (k='attempt' and d->>'outcome'<>'partial') or (k='resolve' and d->>'outcome' not in ('performed','omitted','refused','failed')) or ((k='attempt' or d->>'outcome'<>'performed') and nullif(btrim(d->>'reason'),'') is null) then raise exception 'Tatsächliches Durchführungsergebnis oder Abweichungsgrund fehlt.' using errcode='23514';end if;
  s:=d->'evidence';if k='attempt' or d->>'outcome'='performed' or s<>'null'::jsonb then
   perform care_private.control_source_shape(s,t);if s->>'kind' not in ('treatment_execution','medication_administration','vital_measurement') then raise exception 'Planung ist kein tatsächlicher Ergebnisbeleg.' using errcode='23514';end if;
   evidence_at:=care_private.infusion_time(s->'snapshot'->>case when s->>'kind'='treatment_execution' then 'performed_at' else 'occurred_at' end);if evidence_at>at_time then raise exception 'Beleg liegt nach dem Kontrollergebnis.' using errcode='23514';end if;
   if s->>'kind'='treatment_execution' and (coalesce(s->'snapshot'->>'outcome','') not in ('performed','partial') or nullif(btrim(s->'snapshot'->>'title'),'') is null or nullif(btrim(s->'snapshot'->>'treatment_type'),'') is null or s->'snapshot'->>'created_at' is null) then raise exception 'Tatsächlicher Behandlungspflegenachweis fehlt.' using errcode='23514';end if;
   if s->>'kind'='medication_administration' and coalesce(s->'snapshot'->>'status','') not in ('administered','late') then raise exception 'Ausgebliebene Gabe ist kein Durchführungsbeleg.' using errcode='23514';end if;
   if s->>'kind'='vital_measurement' and (nullif(btrim(s->'snapshot'->>'display_value'),'') is null or nullif(btrim(s->'snapshot'->>'unit'),'') is null or jsonb_typeof(s->'snapshot'->'values') is distinct from 'object' or s->'snapshot'->'values'='{}'::jsonb) then raise exception 'Tatsächliche Messwerte fehlen.' using errcode='23514';end if;
  end if;
  if k='resolve' and ((d->>'followUpTaskId'<>'' and not care_private.control_uuid(d->>'followUpTaskId')) or d->>'followUpTaskId'=t->>'id' or (d->>'followUpTaskId'<>'')=(nullif(btrim(d->>'noFollowUpReason'),'') is not null)) then raise exception 'Genau einen bestehenden Folgeauftrag oder individuellen Abschlussgrund wählen.' using errcode='23514';end if;
 end if;
 if k='escalate' and (not care_private.control_uuid(d->>'policyEventId') or not care_private.control_uuid(d->>'recipientId') or d->>'channel' not in ('phone','in_person','secure_message') or d->>'delivery' not in ('sent','failed') or nullif(btrim(d->>'message'),'') is null or nullif(btrim(d->>'response'),'') is null) then raise exception 'Tatsächlicher Kontaktversuch fehlt.' using errcode='23514';end if;
 if k='acknowledge' and (not care_private.control_uuid(d->>'escalationEventId') or nullif(btrim(d->>'response'),'') is null or nullif(btrim(d->>'nextStep'),'') is null) then raise exception 'Tatsächliche Rückmeldung und nächster Schritt fehlen.' using errcode='23514';end if;
end $$;

-- Resolve only real own native sources; arbitrary client-supplied snapshots cannot
-- establish provenance. FOR SHARE pins native sources against edits/invalidations.
create or replace function care_private.control_source_current(kind text,requested_source uuid,tenant uuid,subject uuid) returns jsonb language plpgsql set search_path='' as $$
declare result jsonb;begin
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
 when 'pflege_report' then select to_jsonb(x) into result from public.clinical_documentation_entries x where x.id=requested_source and x.tenant_id=tenant and x.client_id=subject and x.signature_status<>'superseded' for share;
 when 'infusion_event' then
  select to_jsonb(x) into result from public.care_infusion_events x where x.id=requested_source and x.tenant_id=tenant and x.client_id=subject and x.draft->>'kind'<>'correction' for share;
  if exists(select 1 from public.care_infusion_events c where c.tenant_id=tenant and c.client_id=subject and c.draft->>'kind'='correction' and c.draft->>'targetEventId'=requested_source::text) then raise exception 'Berichtigtes Infusionsereignis benötigt gesonderte Quellenprüfung.' using errcode='40001';end if;
 else raise exception 'Originalquelle nicht angebunden.' using errcode='23514';end case;
 if result is null then raise exception 'Originalquelle fehlt oder gehört nicht zur eigenen Akte.' using errcode='42501';end if;return result;
end $$;

create or replace function care_private.control_fold(t jsonb,d jsonb,actor uuid,event_id uuid,s jsonb,history jsonb) returns jsonb language plpgsql set search_path='' as $$
declare k text:=d->>'kind';p jsonb;snapshot jsonb;original jsonb;cycle jsonb;responsible boolean;begin
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
declare tenant uuid:=public.current_tenant_id();actor uuid;subject uuid;control_id uuid;t jsonb;d jsonb;k text;s jsonb;source jsonb;history jsonb:='[]';
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
  s:=care_private.control_fold(t,e.draft,e.actor_id,e.id,s,history);history:=history||jsonb_build_array(jsonb_build_object('id',e.id::text,'draft',e.draft));head:=e.id;seq:=e.sequence;last_at:=care_private.infusion_time(e.draft->>'occurredAt');last_recorded:=e.recorded_at;
 end loop;
 if coalesce(head::text,'')<>payload->>'expectedHeadId' then raise exception 'Auftrag inzwischen geändert.' using errcode='40001';end if;
 if (last_at is not null and at_time<last_at) or (last_recorded is not null and server_now<last_recorded) then raise exception 'Tatsächliche Reihenfolge widersprüchlich.' using errcode='23514';end if;
 s:=care_private.control_fold(t,d,actor,result,s,history);
 if k in ('create','reopen','assign') then
  foreach f in array array['assigneeId','backupId','escalationRecipientId'] loop person:=case when k='assign' then d->>f else d->'policy'->>f end;
   if person<>'' then perform 1 from public.profiles p where p.id=person::uuid and p.tenant_id=tenant and p.is_active and p.role_key not in ('client_portal','family_portal') for share;if not found then raise exception 'Zuständige Person nicht im aktiven eigenen Team.' using errcode='42501';end if;end if;
  end loop;
 end if;
 source:=case when k='create' then d->'source' when k in ('attempt','resolve') then d->'evidence' else null end;
 if source is not null and source<>'null'::jsonb then if care_private.control_source_current(source->>'kind',(source->>'id')::uuid,tenant,subject) is distinct from source->'snapshot' then raise exception 'Originalquelle inzwischen geändert.' using errcode='40001';end if;end if;
 if k='resolve' and d->>'followUpTaskId'<>'' then
  select * into follow from public.care_control_tasks x where x.id=(d->>'followUpTaskId')::uuid and x.tenant_id=tenant and x.client_id=subject for update;
  if follow.id is null or care_private.control_task_readable(follow.id,tenant,subject) is not true then raise exception 'Bestehender Folgeauftrag nicht zugänglich.' using errcode='42501';end if;
  follow_history:='[]';follow_state:=null;
  for e in select * from public.care_control_events x where x.task_id=follow.id and x.tenant_id=tenant and x.client_id=subject order by sequence loop follow_state:=care_private.control_fold(jsonb_build_object('id',follow.id::text),e.draft,e.actor_id,e.id,follow_state,follow_history);follow_history:=follow_history||jsonb_build_array(jsonb_build_object('id',e.id::text,'draft',e.draft));end loop;
  if follow_state->>'status' is distinct from 'open' then raise exception 'Folgeauftrag bereits geschlossen oder ohne echten Auftrag.' using errcode='40001';end if;
 end if;
 if task.id is null then insert into public.care_control_tasks(id,tenant_id,client_id,version,created_at,recorded_by) values(control_id,tenant,subject,t->>'version',server_now,actor);end if;
 insert into public.care_control_events(id,tenant_id,client_id,task_id,sequence,previous_id,actor_id,actor_name,request_id,recorded_at,draft,request_payload) values(result,tenant,subject,control_id,seq+1,head,actor,name,request_id,server_now,d,payload);
 insert into public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name) values(tenant,subject,'control_event',result,'created','Kontrollauftrag oder tatsächliches Ergebnis dokumentiert',jsonb_build_object('taskId',control_id::text,'sequence',seq+1,'kind',k),actor,name);
 return jsonb_build_object('id',result::text,'tenantId',tenant::text,'taskId',control_id::text,'requestId',request_id::text,'previousId',coalesce(head::text,''),'sequence',seq+1);
end $$;
create or replace function public.write_clinical_control_event(request_id uuid,payload jsonb) returns jsonb language sql security invoker set search_path='' as $$select care_private.write_clinical_control_event(request_id,payload)$$;

create or replace function public.read_clinical_controls(requested_tenant uuid,requested_client uuid default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare answer jsonb;begin
 perform care_private.assert_control_access(requested_tenant,requested_client);
 with tasks as (
  select t.id,t.created_at,jsonb_build_object('task',jsonb_build_object('id',t.id::text,'tenantId',t.tenant_id::text,'clientId',t.client_id::text,'version',t.version),'headId',coalesce(h.head,''),'eventCount',h.n,'events',coalesce(h.items,'[]'),'actorNames',coalesce(h.names,'{}')) item
  from public.care_control_tasks t cross join lateral (
   select count(*) n,(array_agg(x.id::text order by x.sequence desc))[1] head,jsonb_object_agg(x.id::text,x.actor_name) names,
    jsonb_agg(jsonb_build_object('id',x.id::text,'taskId',x.task_id::text,'tenantId',x.tenant_id::text,'clientId',x.client_id::text,'sequence',x.sequence,'previousId',coalesce(x.previous_id::text,''),'actorId',x.actor_id::text,'requestId',x.request_id::text,'recordedAt',to_char(x.recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'draft',x.draft) order by x.sequence) items
   from public.care_control_events x where x.task_id=t.id and x.tenant_id=t.tenant_id and x.client_id=t.client_id
  ) h where t.tenant_id=requested_tenant and (requested_client is null or t.client_id=requested_client)
 ) select jsonb_build_object('version','2026-10-09.1','tenantId',requested_tenant::text,'clientId',requested_client::text,'count',count(*),'tasks',coalesce(jsonb_agg(item order by created_at desc,id desc),'[]')) into answer from tasks;return answer;
end $$;

-- Single-statement eligible source catalog. Corrected originals remain in their
-- original clinical histories; this picker does not treat them as unreviewed proof.
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
 ) select jsonb_build_object('version','2026-10-09.1','tenantId',requested_tenant::text,'clientId',requested_client::text,'count',count(*),'sources',coalesce(jsonb_agg(jsonb_build_object('kind',kind,'id',id::text,'snapshot',snapshot) order by kind,id),'[]')) into answer from sources;return answer;
end $$;
create or replace function public.read_clinical_control_sources(requested_tenant uuid,requested_client uuid) returns jsonb language sql security invoker set search_path='' as $$select care_private.read_clinical_control_sources(requested_tenant,requested_client)$$;
-- Minimal authorized team lookup; ordinary profile RLS permits only the own
-- bootstrap profile. No email, role details or full employee records are exposed.
create or replace function care_private.read_clinical_control_people(requested_tenant uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare answer jsonb;begin
 perform care_private.assert_control_access(requested_tenant,null);
 select jsonb_build_object('version','2026-10-09.1','tenantId',requested_tenant::text,'count',count(*),'people',coalesce(jsonb_agg(jsonb_build_object('id',p.id::text,'tenantId',p.tenant_id::text,'name',coalesce(nullif(btrim(p.display_name),''),'Name nicht bestätigt')) order by p.display_name,p.id),'[]')) into answer
 from public.profiles p where p.tenant_id=requested_tenant and p.is_active and p.role_key not in ('client_portal','family_portal');return answer;
end $$;
create or replace function public.read_clinical_control_people(requested_tenant uuid) returns jsonb language sql security invoker set search_path='' as $$select care_private.read_clinical_control_people(requested_tenant)$$;
revoke all on function care_private.read_clinical_control_people(uuid),public.read_clinical_control_people(uuid) from public,anon;
grant execute on function care_private.read_clinical_control_people(uuid),public.read_clinical_control_people(uuid) to authenticated;
revoke all on function care_private.control_source_allowed(text),care_private.assert_control_access(uuid,uuid),care_private.control_uuid(text),care_private.control_source_shape(jsonb,jsonb),care_private.control_policy(jsonb,timestamptz),care_private.control_draft(jsonb,jsonb,timestamptz),care_private.control_source_current(text,uuid,uuid,uuid),care_private.control_fold(jsonb,jsonb,uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
-- RLS needs only its boolean predicate, not source lookup/folding helper access.
revoke all on function care_private.control_task_readable(uuid,uuid,uuid) from public,anon;
grant execute on function care_private.control_task_readable(uuid,uuid,uuid),care_private.assert_control_access(uuid,uuid) to authenticated;
revoke all on function care_private.write_clinical_control_event(uuid,jsonb),care_private.read_clinical_control_sources(uuid,uuid),public.write_clinical_control_event(uuid,jsonb),public.read_clinical_controls(uuid,uuid),public.read_clinical_control_sources(uuid,uuid) from public,anon;
grant execute on function care_private.write_clinical_control_event(uuid,jsonb),care_private.read_clinical_control_sources(uuid,uuid),public.write_clinical_control_event(uuid,jsonb),public.read_clinical_controls(uuid,uuid),public.read_clinical_control_sources(uuid,uuid) to authenticated;
commit;
