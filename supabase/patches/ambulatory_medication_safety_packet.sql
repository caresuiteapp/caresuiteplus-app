-- LOCAL REVIEW ONLY. Requires the existing ambulatory medication, source and documentation patches.
-- Never apply as part of local verification. Existing native/direct writers, PostgREST schema cache,
-- grants, RLS, triggers, locks, rollback, parallelism and SDK compatibility require a real test database.
begin;
create schema if not exists care_private;
revoke all on schema care_private from public,anon,authenticated;
grant usage on schema care_private to authenticated;

create or replace function care_private.medication_client_is_active(p_tenant uuid,p_client uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 perform care_private.require_workspace_session(p_tenant,public.resolve_current_profile_id());
 return exists(select 1 from public.clients c join public.client_module_assignments a
 on a.tenant_id=c.tenant_id and a.client_id=c.id and a.module_key='pflege'
 where c.tenant_id=p_tenant and c.id=p_client and c.status::text in('active','aktiv')
 and c.lifecycle_status::text in('active','aktiv') and a.is_active and a.status in('active','aktiv'));
end $$;
revoke all on function care_private.medication_client_is_active(uuid,uuid) from public,anon,authenticated;

create table if not exists public.medication_safety_events(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),
 client_id uuid not null references public.clients(id),medication_id uuid not null references public.medications(id),
 root_id uuid not null,previous_id uuid references public.medication_safety_events(id),revision integer not null check(revision>0),
 kind text not null check(kind in('reconciliation','order_capture','schedule_version','administration','late_administration','non_administration','prn_administration','effect_review','safety_signal','controlled_witness','preparation_stock','order_pause_stop','prn_interval_check','maximum_dose_check','controlled_ledger','correction')),
 payload jsonb not null,source_snapshot jsonb not null,reason text not null default '',content_fingerprint text not null,
 recorded_by uuid not null references public.profiles(id),recorded_by_name text not null,recorded_at timestamptz not null default clock_timestamp(),
 voided boolean not null default false,unique(tenant_id,root_id,revision),unique(tenant_id,previous_id)
);
create index if not exists medication_safety_client_page on public.medication_safety_events(tenant_id,client_id,medication_id,recorded_at desc,id desc);
alter table public.medication_safety_events enable row level security;
drop policy if exists medication_safety_read on public.medication_safety_events;
create policy medication_safety_read on public.medication_safety_events for select to authenticated using(
 tenant_id=public.current_tenant_id() and public.has_permission('pflege.medications.view')
 and care_private.medication_client_is_active(tenant_id,client_id)
);
revoke select on public.medication_safety_events from public,anon,authenticated;
revoke insert,update,delete,truncate on public.medication_safety_events from public,anon,authenticated;

create table if not exists care_private.medication_safety_requests(
 tenant_id uuid not null,client_id uuid not null,medication_id uuid not null,actor_id uuid not null,request_id uuid not null,
 packet jsonb not null,event_id uuid not null references public.medication_safety_events(id),created_at timestamptz not null default clock_timestamp(),
 primary key(tenant_id,request_id)
);
alter table care_private.medication_safety_requests enable row level security;
revoke all on care_private.medication_safety_requests from public,anon,authenticated;

create or replace function care_private.medication_json_fingerprint(value jsonb)
returns text language sql immutable strict set search_path='' as $$select 'sha256:'||encode(extensions.digest(convert_to(value::text,'UTF8'),'sha256'),'hex')$$;
create or replace function care_private.medication_packet_actor(permission_name text,p_tenant uuid,p_client uuid,p_medication uuid,p_actor uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare claims jsonb;session_id uuid;actor uuid;
begin
 perform care_private.require_workspace_session(p_tenant,p_actor);
 claims:=coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb;
 if claims->>'session_id' is null or claims->>'session_id' !~* '^[0-9a-f-]{36}$' then raise exception 'Sitzungsbindung fehlt.' using errcode='42501';end if;
 session_id:=(claims->>'session_id')::uuid;actor:=public.resolve_current_profile_id();
 if auth.uid() is null or p_tenant is distinct from public.current_tenant_id() or actor is distinct from p_actor
 or not exists(select 1 from auth.sessions s where s.id=session_id and s.user_id=auth.uid() and coalesce(s.not_after,clock_timestamp()+interval '1 second')>clock_timestamp())
 or not exists(select 1 from public.profiles p where p.id=actor and p.tenant_id=p_tenant and p.is_active)
 or public.has_permission('pflege.medications.view') is not true or public.has_permission(permission_name) is not true
 or care_private.medication_client_is_active(p_tenant,p_client) is not true
 or not exists(select 1 from public.medications m where m.id=p_medication and m.tenant_id=p_tenant and m.client_id=p_client)
 then raise exception 'Aktueller Medikationsbezug oder Berechtigung fehlt.' using errcode='42501';end if;
 return actor;
end $$;

create or replace function care_private.medication_source_snapshot(p_tenant uuid,p_client uuid,p_medication uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.medications%rowtype;c public.clients%rowtype;result jsonb;allergy_state text;allergy_text text;order_json jsonb;
begin
 select * into m from public.medications where id=p_medication and tenant_id=p_tenant and client_id=p_client;
 select * into c from public.clients where id=p_client and tenant_id=p_tenant;
 if m.id is null or c.id is null then raise exception 'Verordnungsoriginal fehlt.' using errcode='P0H01';end if;
 order_json:=to_jsonb(m)-'created_by'-'updated_by';allergy_text:=coalesce(nullif(btrim(to_jsonb(c)->>'allergies'),''),'');allergy_state:=case when allergy_text<>'' then 'documented' else 'unknown' end;
 select jsonb_build_object(
  'order',jsonb_build_object('id',m.id,'revision',1,'recordedAt',to_char(m.updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'fingerprint',care_private.medication_json_fingerprint(order_json),'medicationId',m.id,'clientId',m.client_id,'status',m.status::text,'updatedAt',to_char(m.updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'payload',order_json),
  'allergies',jsonb_build_object('id',c.id,'revision',1,'recordedAt',to_char(coalesce(c.updated_at,m.updated_at) at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'fingerprint',care_private.medication_json_fingerprint(jsonb_build_object('state',allergy_state,'text',allergy_text)),'state',allergy_state,'text',allergy_text),
  'documents',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'revision',1,'recordedAt',to_char(s.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'fingerprint',care_private.medication_json_fingerprint(jsonb_build_object('snapshot',s.document_snapshot,'order',s.order_snapshot)),'title',coalesce(s.document_snapshot->>'title','Quelle'),'version',coalesce(s.document_snapshot->>'updated_at',s.document_snapshot->>'version',to_char(s.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))) order by s.created_at,s.id) from public.medication_order_sources s where s.tenant_id=p_tenant and s.medication_id=p_medication),'[]'::jsonb),
  'administrations',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'revision',1,'recordedAt',to_char(a.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'fingerprint',care_private.medication_json_fingerprint(to_jsonb(a)),'status',a.status::text,'occurredAt',case when a.occurred_at is null then null else to_char(a.occurred_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') end,'dose',a.administered_dose,'unit',nullif(a.creation_payload->>'unit',''),'route',a.route) order by a.created_at,a.id) from public.medication_administrations a where a.tenant_id=p_tenant and a.medication_id=p_medication),'[]'::jsonb),
  'statusEvents',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'revision',1,'recordedAt',to_char(e.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'fingerprint',care_private.medication_json_fingerprint(to_jsonb(e)),'previousStatus',e.previous_status,'nextStatus',e.next_status) order by e.created_at,e.id) from public.medication_order_status_events e where e.tenant_id=p_tenant and e.medication_id=p_medication),'[]'::jsonb),
  'witnesses',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'revision',1,'recordedAt',to_char(coalesce(p.updated_at,p.created_at) at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'fingerprint',care_private.medication_json_fingerprint(to_jsonb(p)-'email'-'phone'),'profileId',p.id,'active',p.is_active,'qualificationState',coalesce(nullif(to_jsonb(p)->>'qualification_state',''),'not_verified')) order by p.id) from public.profiles p where p.tenant_id=p_tenant),'[]'::jsonb),
  'stockMovements',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'revision',e.revision,'recordedAt',to_char(e.recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'fingerprint',e.content_fingerprint,'packageId',e.payload->'stock'->>'packageId','operation',e.payload->'stock'->>'operation','quantity',e.payload->'stock'->>'quantity','unit',e.payload->'stock'->>'unit','balanceAfter',e.payload->'stock'->>'balanceAfter') order by e.recorded_at,e.id) from public.medication_safety_events e where e.tenant_id=p_tenant and e.medication_id=p_medication and e.kind in('preparation_stock','controlled_ledger') and not e.voided),'[]'::jsonb)
 ) into result;return result;
end $$;

create or replace function care_private.medication_original(p_event uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare head public.medication_safety_events%rowtype;history jsonb;
begin
 select * into head from public.medication_safety_events where id=p_event;
 if head.id is null then return null;end if;
 select jsonb_agg(jsonb_build_object('id',e.id,'revision',e.revision,'previousId',e.previous_id,'recordedAt',to_char(e.recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'recordedBy',e.recorded_by,'recordedByName',e.recorded_by_name,'reason',e.reason,'payload',e.payload,'contentFingerprint',e.content_fingerprint) order by e.revision) into history from public.medication_safety_events e where e.tenant_id=head.tenant_id and e.client_id=head.client_id and e.medication_id=head.medication_id and e.root_id=head.root_id and e.revision<=head.revision;
 return jsonb_build_object('id',head.id,'tenantId',head.tenant_id,'clientId',head.client_id,'medicationId',head.medication_id,'rootId',head.root_id,'headId',head.id,'revision',head.revision,'kind',head.kind,'recordedAt',to_char(head.recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'recordedBy',head.recorded_by,'recordedByName',head.recorded_by_name,'payload',head.payload,'contentFingerprint',head.content_fingerprint,'history',coalesce(history,'[]'::jsonb),'voided',head.voided);
end $$;

-- Quarantined validation helpers. No EXECUTE grants for application roles.
create or replace function care_private.med_packet_text(v jsonb, minimum integer default 0, maximum integer default 8000)
returns boolean language sql immutable set search_path='' as $$select coalesce(jsonb_typeof(v)='string' and length(btrim(v#>>'{}'))>=minimum and length(v#>>'{}')<=maximum,false)$$;
create or replace function care_private.med_packet_uuid(v jsonb)
returns boolean language sql immutable set search_path='' as $$select coalesce(jsonb_typeof(v)='string' and v#>>'{}' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',false)$$;
create or replace function care_private.med_packet_decimal(v jsonb)
returns boolean language sql immutable set search_path='' as $$select coalesce(jsonb_typeof(v)='string' and v#>>'{}' ~ '^(0|[1-9][0-9]{0,7})(\.[0-9]{1,3})?$',false)$$;
create or replace function care_private.med_packet_keys(v jsonb, expected text[])
returns boolean language plpgsql immutable set search_path='' as $$begin
 if jsonb_typeof(v) is distinct from 'object' then return false;end if;
 return v ?& expected and (select count(*) from jsonb_object_keys(v))=cardinality(expected);
end $$;
create or replace function care_private.med_packet_require(ok boolean, message text)
returns void language plpgsql immutable set search_path='' as $$begin if ok is not true then raise exception '%',message using errcode='23514';end if;end $$;
create or replace function care_private.med_packet_time(v jsonb)
returns timestamptz language plpgsql immutable set search_path='' as $$declare result timestamptz;begin
 perform care_private.med_packet_require(jsonb_typeof(v)='string' and v#>>'{}' ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:?\d{2})$','Ungültiger Originalzeitpunkt.');
 result:=(v#>>'{}')::timestamptz;perform care_private.med_packet_require(isfinite(result),'Nicht endlicher Originalzeitpunkt.');return result;
end $$;
create or replace function care_private.med_packet_date(v jsonb)
returns date language plpgsql immutable set search_path='' as $$declare result date;begin
 perform care_private.med_packet_require(jsonb_typeof(v)='string' and v#>>'{}' ~ '^\d{4}-\d{2}-\d{2}$','Ungültiges Originaldatum.');
 result:=(v#>>'{}')::date;perform care_private.med_packet_require(to_char(result,'YYYY-MM-DD')=v#>>'{}','Ungültiges Originaldatum.');return result;
end $$;
create or replace function care_private.med_packet_uuid_list(v jsonb)
returns boolean language plpgsql immutable set search_path='' as $$begin
 if jsonb_typeof(v) is distinct from 'array' then return false;end if;
 return jsonb_array_length(v)<=2000 and not exists(select 1 from jsonb_array_elements(v) x where not care_private.med_packet_uuid(x)) and jsonb_array_length(v)=(select count(distinct x) from jsonb_array_elements(v) x);
end $$;
-- Staging foundation only: nullable structured facts, no legacy conversion or application grants.
alter table public.medications
 add column if not exists prescribed_dose text,
 add column if not exists dose_unit text,
 add column if not exists minimum_interval_minutes text,
 add column if not exists maximum_dose text,
 add column if not exists maximum_dose_unit text,
 add column if not exists maximum_period_hours text;

-- Existing table-level UPDATE grants must not expose the new structured facts to direct clients.
create or replace function care_private.guard_medication_order_facts()
returns trigger language plpgsql security invoker set search_path='' as $$
declare next_facts jsonb;previous_facts jsonb:='[null,null,null,null,null,null]'::jsonb;
begin
 next_facts:=jsonb_build_array(new.prescribed_dose,new.dose_unit,new.minimum_interval_minutes,new.maximum_dose,new.maximum_dose_unit,new.maximum_period_hours);
 if tg_op='UPDATE' then previous_facts:=jsonb_build_array(old.prescribed_dose,old.dose_unit,old.minimum_interval_minutes,old.maximum_dose,old.maximum_dose_unit,old.maximum_period_hours);end if;
 if next_facts is distinct from previous_facts and current_user not in('postgres','service_role') then
  raise exception 'Strukturierte Verordnungsangaben benötigen einen freigegebenen serverseitigen Originalbeleg.' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function care_private.guard_medication_order_facts() from public,anon,authenticated;
create trigger medication_structured_order_guard before insert or update on public.medications for each row execute function care_private.guard_medication_order_facts();

create or replace function care_private.medication_native_order(p_native jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare key text;result jsonb;
begin
 perform care_private.med_packet_require(jsonb_typeof(p_native)='object','Strukturierte native Verordnung fehlt.');
 foreach key in array array['name','active_ingredient','strength','form','dose_unit','route','prescribed_by','indication'] loop
  perform care_private.med_packet_require(care_private.med_packet_text(p_native->key,1),'Native Verordnungsangabe fehlt: '||key);
 end loop;
 perform care_private.med_packet_require(care_private.med_packet_decimal(p_native->'prescribed_dose') and (p_native->>'prescribed_dose')::numeric>0 and jsonb_typeof(p_native->'is_prn')='boolean','Native strukturierte Dosis oder Bedarfskennzeichnung fehlt.');
 perform care_private.med_packet_date(p_native->'start_date');
 perform care_private.med_packet_require(p_native ? 'end_date','Native Gültigkeitsgrenze fehlt.');
 if p_native->'end_date'<>'null'::jsonb then perform care_private.med_packet_require(care_private.med_packet_date(p_native->'end_date')>=care_private.med_packet_date(p_native->'start_date'),'Native Gültigkeit widersprüchlich.');end if;
 if p_native->'is_prn'='true'::jsonb then
  foreach key in array array['minimum_interval_minutes','maximum_dose','maximum_period_hours'] loop
   perform care_private.med_packet_require(care_private.med_packet_decimal(p_native->key) and (p_native->>key)::numeric>0,'Native strukturierte Bedarfsgrenze fehlt: '||key);
  end loop;
  perform care_private.med_packet_require(care_private.med_packet_text(p_native->'maximum_dose_unit',1) and p_native->'maximum_dose_unit'=p_native->'dose_unit','Native Höchstmengeneinheit widersprüchlich.');
 else
  perform care_private.med_packet_require(p_native->'minimum_interval_minutes'='null'::jsonb and p_native->'maximum_dose'='null'::jsonb and p_native->'maximum_period_hours'='null'::jsonb and (p_native->'maximum_dose_unit'='null'::jsonb or p_native->>'maximum_dose_unit'=''),'Native Regelmedikation enthält Bedarfsgrenzen.');
 end if;
 result:=jsonb_build_object('medicationName',p_native->'name','activeIngredient',p_native->'active_ingredient','strength',p_native->'strength','form',p_native->'form','dose',p_native->'prescribed_dose','unit',p_native->'dose_unit','route',p_native->'route','prescriber',p_native->'prescribed_by','validFrom',p_native->'start_date','validUntil',p_native->'end_date','indication',p_native->'indication','isPrn',p_native->'is_prn','minimumIntervalMinutes',p_native->'minimum_interval_minutes','maximumDose',p_native->'maximum_dose','maximumDoseUnit',case when p_native->'is_prn'='true'::jsonb then p_native->'maximum_dose_unit' else '""'::jsonb end,'maximumPeriodHours',p_native->'maximum_period_hours');
 return result;
end $$;
revoke all on function care_private.medication_native_order(jsonb) from public,anon,authenticated;

create or replace function care_private.validate_medication_packet(p jsonb,p_actor uuid,p_sources jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare e jsonb:=p->'entry';o jsonb:=e->'order';a jsonb:=e->'administration';sr jsonb:=e->'sourceReview';s jsonb:=e->'stock';k text:=e->>'kind';key text;item jsonb;ref jsonb;source_row jsonb;actual boolean;reference_at timestamptz;prior_balance numeric;last_stock jsonb;
begin
 perform care_private.med_packet_require(care_private.med_packet_keys(p,array['schemaVersion','action','requestId','tenantId','clientId','medicationId','actorId','expectedHeadId','expectedRevision','entry','reason','original','sources']) and p->>'schemaVersion'='1' and p->>'action' in('create','revise') and p_actor is not null and p->>'actorId'=p_actor::text and octet_length(p::text)<=2000000,'Paketstruktur oder Akteursbindung fehlt.');
 foreach key in array array['requestId','tenantId','clientId','medicationId','actorId'] loop perform care_private.med_packet_require(care_private.med_packet_uuid(p->key),'Ungültige Paketidentität.');end loop;
 perform care_private.med_packet_require(p->'sources' is not distinct from p_sources and jsonb_typeof(p_sources)='object' and p_sources#>>'{order,medicationId}'=p->>'medicationId' and p_sources#>>'{order,clientId}'=p->>'clientId','Aktuelle Quellenbindung fehlt.');
 perform care_private.med_packet_require(care_private.med_packet_keys(e,array['kind','title','plannedAt','occurredAt','medicationId','clientId','orderVersion','sourceReview','order','schedule','administration','effect','safety','witness','stock','orderStatus','correction','lifecycle']) and e->>'medicationId'=p->>'medicationId' and e->>'clientId'=p->>'clientId' and care_private.med_packet_text(e->'title',3,300) and e->>'lifecycle' in('open','completed'),'Medikationsereignis unvollständig.');
 perform care_private.med_packet_require(k in('reconciliation','order_capture','schedule_version','administration','late_administration','non_administration','prn_administration','effect_review','safety_signal','controlled_witness','preparation_stock','order_pause_stop','prn_interval_check','maximum_dose_check','controlled_ledger','correction'),'Unbekannte Medikationsart.');
 perform care_private.med_packet_time(e->'plannedAt');perform care_private.med_packet_time(e->'orderVersion');
 if e->'occurredAt'<>'null'::jsonb then perform care_private.med_packet_require(care_private.med_packet_time(e->'occurredAt')<=clock_timestamp(),'Zukünftiges tatsächliches Ereignis.');end if;
 perform care_private.med_packet_require(care_private.med_packet_keys(sr,array['planFingerprint','documentIds','discrepancies','allergyState','allergyText','clarification','decision']) and sr->>'planFingerprint'=p_sources#>>'{order,fingerprint}' and e->>'orderVersion'=p_sources#>>'{order,updatedAt}' and sr->'allergyState'=p_sources#>'{allergies,state}' and sr->'allergyText'=p_sources#>'{allergies,text}' and care_private.med_packet_text(sr->'allergyText') and sr->>'decision' in('unresolved','confirmed','rejected') and care_private.med_packet_text(sr->'clarification') and care_private.med_packet_uuid_list(sr->'documentIds') and jsonb_typeof(sr->'discrepancies')='array','Quellen-, Allergie- oder Verordnungsfassung widersprüchlich.');
 perform care_private.med_packet_require(jsonb_array_length(sr->'discrepancies')<=2000,'Zu viele Differenzen.');
 for item in select value from jsonb_array_elements(sr->'discrepancies') loop perform care_private.med_packet_require(care_private.med_packet_text(item,3,1000),'Ungültige Differenz.');end loop;
 for ref in select value from jsonb_array_elements(sr->'documentIds') loop perform care_private.med_packet_require(exists(select 1 from jsonb_array_elements(p_sources->'documents') d where d->'id'=ref),'Dokument fehlt im Originalbestand.');end loop;
 if e->>'lifecycle'='completed' then perform care_private.med_packet_require(sr->>'decision'='confirmed','Ungeklärte Quelle sperrt Abschluss.');end if;
 if sr->>'decision'='confirmed' and jsonb_array_length(sr->'discrepancies')>0 then perform care_private.med_packet_require(care_private.med_packet_text(sr->'clarification',10),'Differenzen benötigen konkrete Klärung.');end if;
 perform care_private.med_packet_require(care_private.med_packet_keys(o,array['medicationName','activeIngredient','strength','form','dose','unit','route','prescriber','validFrom','validUntil','indication','isPrn','minimumIntervalMinutes','maximumDose','maximumDoseUnit','maximumPeriodHours']),'Verordnungsstruktur fehlt.');
 foreach key in array array['medicationName','activeIngredient','strength','form','unit','route','prescriber','indication'] loop perform care_private.med_packet_require(care_private.med_packet_text(o->key,1),'Pflichtangabe der Verordnung fehlt.');end loop;
 perform care_private.med_packet_require(care_private.med_packet_decimal(o->'dose') and jsonb_typeof(o->'isPrn')='boolean','Dosis oder Bedarfskennzeichnung fehlt.');
 perform care_private.med_packet_date(o->'validFrom');if o->'validUntil'<>'null'::jsonb then perform care_private.med_packet_require(care_private.med_packet_date(o->'validUntil')>=care_private.med_packet_date(o->'validFrom'),'Verordnungsgültigkeit widersprüchlich.');end if;
 -- A candidate may stay unresolved in an open capture; confirmed facts must match the native row exactly.
 if not(k in('reconciliation','order_capture') and sr->>'decision' in('unresolved','rejected') and e->>'lifecycle'='open') then
  perform care_private.med_packet_require(o is not distinct from care_private.medication_native_order(p_sources#>'{order,payload}'),'Verordnungsangaben weichen vom strukturierten Datenbankoriginal ab.');
 end if;
 if o->'isPrn'='true'::jsonb then
  raise exception 'Native bestätigte Bedarfsgrenzen fehlen im aktuellen Quellenvertrag.' using errcode='42501';
  foreach key in array array['minimumIntervalMinutes','maximumDose','maximumPeriodHours'] loop perform care_private.med_packet_require(care_private.med_packet_decimal(o->key) and (o->>key)::numeric>0,'Bedarfsgrenzen fehlen.');end loop;
  perform care_private.med_packet_require(care_private.med_packet_text(o->'maximumDoseUnit',1),'Höchstmengeneinheit fehlt.');
 else perform care_private.med_packet_require(o->'minimumIntervalMinutes'='null'::jsonb and o->'maximumDose'='null'::jsonb and o->'maximumPeriodHours'='null'::jsonb and o->>'maximumDoseUnit'='','Regelmedikation enthält Bedarfsgrenzen.');end if;
 perform care_private.med_packet_require(care_private.med_packet_keys(a,array['outcome','actualAt','actualDose','unit','route','performedBy','deviationReason','prnIndication','precedingAdministrationIds','intervalMinutes','maximumPeriodDose']) and care_private.med_packet_uuid_list(a->'precedingAdministrationIds') and care_private.med_packet_text(a->'unit') and care_private.med_packet_text(a->'route') and care_private.med_packet_text(a->'deviationReason') and care_private.med_packet_text(a->'prnIndication'),'Gabenstruktur fehlt.');
 actual:=k in('administration','late_administration','prn_administration');
 if actual then
  perform care_private.med_packet_require(sr->>'decision'='confirmed' and p_sources#>>'{order,status}'='active' and a->>'outcome' in('administered','late') and care_private.med_packet_decimal(a->'actualDose') and a->'unit'=o->'unit' and a->'route'=o->'route' and care_private.med_packet_uuid(a->'performedBy') and e->'occurredAt'=a->'actualAt','Tatsächliche Gabe ist nicht vollständig belegt.');
  reference_at:=care_private.med_packet_time(a->'actualAt');perform care_private.med_packet_require(reference_at<=clock_timestamp() and (reference_at at time zone 'Europe/Berlin')::date>=care_private.med_packet_date(o->'validFrom') and (o->'validUntil'='null'::jsonb or (reference_at at time zone 'Europe/Berlin')::date<=care_private.med_packet_date(o->'validUntil')),'Gabezeit außerhalb bestätigter Gültigkeit.');
  -- This safety packet may reference care performed through a native writer; it is not a substitute for that writer.
  perform care_private.med_packet_require(exists(select 1 from public.medication_administrations n where n.tenant_id=(p->>'tenantId')::uuid and n.client_id=(p->>'clientId')::uuid and n.medication_id=(p->>'medicationId')::uuid and n.status=a->>'outcome' and n.occurred_at=reference_at and n.administered_by=(a->>'performedBy')::uuid and n.administered_dose=a->>'actualDose' and n.route=a->>'route' and n.creation_payload->>'unit'=a->>'unit' and exists(select 1 from jsonb_array_elements(p_sources->'administrations') original where original->>'id'=n.id::text)),'Passender nativer Gabennachweis fehlt.');
  if k='late_administration' then perform care_private.med_packet_require(care_private.med_packet_text(a->'deviationReason',3),'Verspätungsgrund fehlt.');end if;
 elsif k='non_administration' then
  perform care_private.med_packet_require(a->>'outcome' in('omitted','refused','held') and e->'occurredAt'<>'null'::jsonb and a->'actualAt'='null'::jsonb and a->'actualDose'='null'::jsonb and a->'performedBy'='null'::jsonb and a->>'unit'='' and a->>'route'='' and care_private.med_packet_text(a->'deviationReason',3),'Nichtgabe darf keine tatsächliche Gabe behaupten.');
 else perform care_private.med_packet_require(a->>'outcome'='planned' and a->'actualAt'='null'::jsonb and a->'actualDose'='null'::jsonb,'Planung darf keine tatsächliche Gabe behaupten.');end if;
 perform care_private.med_packet_require(care_private.med_packet_keys(e->'schedule',array['versionId','effectiveFrom','slots','changeReason']) and jsonb_typeof(e#>'{schedule,slots}')='array' and jsonb_array_length(e#>'{schedule,slots}')<=2000,'Gabeplanstruktur fehlt.');
 if k='schedule_version' then
  perform care_private.med_packet_require(care_private.med_packet_uuid(e#>'{schedule,versionId}') and care_private.med_packet_text(e#>'{schedule,changeReason}',10) and jsonb_array_length(e#>'{schedule,slots}')>0,'Gabeplanfassung fehlt.');perform care_private.med_packet_time(e#>'{schedule,effectiveFrom}');
  for item in select value from jsonb_array_elements(e#>'{schedule,slots}') loop perform care_private.med_packet_require(care_private.med_packet_keys(item,array['id','plannedAt','dose','unit','route']) and care_private.med_packet_uuid(item->'id') and care_private.med_packet_decimal(item->'dose') and item->'unit'=o->'unit' and item->'route'=o->'route','Gabeplanposition widersprüchlich.');perform care_private.med_packet_time(item->'plannedAt');end loop;
  perform care_private.med_packet_require((select count(distinct value->>'id') from jsonb_array_elements(e#>'{schedule,slots}'))=jsonb_array_length(e#>'{schedule,slots}'),'Doppelte Gabeplanposition.');
 end if;
 -- PRN calculations stay blocked until structured limits are bound to an authoritative native prescription.
 if k in('prn_administration','prn_interval_check','maximum_dose_check') then raise exception 'Native bestätigte Bedarfsgrenzen fehlen im aktuellen Quellenvertrag.' using errcode='42501';end if;
 perform care_private.med_packet_require(care_private.med_packet_keys(e->'effect',array['administrationId','observedAt','observation','action','painScore']) and care_private.med_packet_keys(e->'safety',array['state','observation','suspectedRelation','reaction','clinicianContact','followUp']) and care_private.med_packet_keys(e->'witness',array['required','profileId','assertion','signedAt','signatureId','qualificationEvidence']),'Kontroll- oder Gegenkontrollstruktur fehlt.');
 if k='effect_review' then perform care_private.med_packet_require(care_private.med_packet_uuid(e#>'{effect,administrationId}') and care_private.med_packet_text(e#>'{effect,observation}',3) and care_private.med_packet_text(e#>'{effect,action}',3) and exists(select 1 from jsonb_array_elements(p_sources->'administrations') x where x->'id'=e#>'{effect,administrationId}' and x->>'status' in('administered','late')),'Wirkungskontrolle ohne tatsächliche Gabe.');perform care_private.med_packet_require(care_private.med_packet_time(e#>'{effect,observedAt}')<=clock_timestamp() and exists(select 1 from jsonb_array_elements(p_sources->'administrations') x where x->'id'=e#>'{effect,administrationId}' and x->'occurredAt'<>'null'::jsonb and care_private.med_packet_time(x->'occurredAt')<=care_private.med_packet_time(e#>'{effect,observedAt}')),'Zukünftige Wirkungskontrolle.');if e#>'{effect,painScore}'<>'null'::jsonb then perform care_private.med_packet_require(jsonb_typeof(e#>'{effect,painScore}')='number' and e#>>'{effect,painScore}' ~ '^(0|[1-9]|10)$','Ungültiger Schmerzwert.');end if;end if;
 if k='safety_signal' then perform care_private.med_packet_require(e#>>'{safety,state}'='suspected','Externe Bestätigung benötigt gesonderten verifizierten Originalbeleg.');foreach key in array array['observation','suspectedRelation','reaction','clinicianContact','followUp'] loop perform care_private.med_packet_require(care_private.med_packet_text(e->'safety'->key,3),'Sicherheitsverlauf unvollständig.');end loop;end if;
 if k in('controlled_witness','order_pause_stop','correction') then raise exception 'Originalbindung für Zweitsignatur, Verordnungsänderung oder Korrektur noch nicht serverseitig freigegeben.' using errcode='42501';end if;
 perform care_private.med_packet_require(care_private.med_packet_keys(s,array['operation','packageId','batch','expiry','quantity','unit','balanceBefore','balanceAfter','reason','responsibleBy']) and care_private.med_packet_keys(e->'orderStatus',array['current','next','effectiveAt','reason','authorizationId','followUpPlanId']) and care_private.med_packet_keys(e->'correction',array['targetEventId','reason','replacementEventId','approvedBy','approvedAt']),'Bestands- oder Freigabestruktur fehlt.');
 if k in('preparation_stock','controlled_ledger') then
  perform care_private.med_packet_require(s->>'operation' in('receipt','prepare','consumption','correction') and care_private.med_packet_uuid(s->'packageId') and care_private.med_packet_decimal(s->'quantity') and (s->>'quantity')::numeric>0 and care_private.med_packet_decimal(s->'balanceBefore') and care_private.med_packet_decimal(s->'balanceAfter') and care_private.med_packet_text(s->'unit',1) and s->>'responsibleBy'=p_actor::text,'Bestandsangaben oder Verantwortung fehlen.');
  select value into last_stock from jsonb_array_elements(p_sources->'stockMovements') where value->'packageId'=s->'packageId' order by care_private.med_packet_time(value->'recordedAt') desc,(value->>'id')::uuid desc limit 1;
  prior_balance:=case when last_stock is null then 0 else (last_stock->>'balanceAfter')::numeric end;
  perform care_private.med_packet_require((last_stock is not null or s->>'operation'='receipt') and (last_stock is null or last_stock->'unit'=s->'unit') and (s->>'balanceBefore')::numeric=prior_balance,'Vorbestand stimmt nicht mit letztem Original überein.');
  if s->>'operation'='receipt' then perform care_private.med_packet_require((s->>'balanceAfter')::numeric=prior_balance+(s->>'quantity')::numeric,'Zugangssumme falsch.');elsif s->>'operation' in('prepare','consumption') then perform care_private.med_packet_require((s->>'balanceAfter')::numeric=prior_balance-(s->>'quantity')::numeric,'Abgangssumme falsch.');else perform care_private.med_packet_require(care_private.med_packet_text(s->'reason',10),'Bestandskorrekturgrund fehlt.');end if;
  if s->>'operation'='prepare' then perform care_private.med_packet_require(care_private.med_packet_text(s->'reason',3),'Richtgrund fehlt.');end if;
  if k='controlled_ledger' then perform care_private.med_packet_require(care_private.med_packet_text(s->'batch',1),'Charge fehlt.');perform care_private.med_packet_date(s->'expiry');end if;
 end if;

 perform care_private.med_packet_require(e#>>'{orderStatus,next}'='unchanged' and e#>'{orderStatus,effectiveAt}'='null'::jsonb and e#>'{orderStatus,authorizationId}'='null'::jsonb and e#>'{orderStatus,followUpPlanId}'='null'::jsonb and e#>>'{orderStatus,reason}'='','Unbelegte Verordnungsfreigabe ist gesperrt.');
 perform care_private.med_packet_require(e->'correction'='{"targetEventId":null,"reason":"","replacementEventId":null,"approvedBy":null,"approvedAt":null}'::jsonb,'Unbelegte Korrekturfreigabe ist gesperrt.');
 if k<>'effect_review' then perform care_private.med_packet_require(e->'effect'='{"administrationId":null,"observedAt":null,"observation":"","action":"","painScore":null}'::jsonb,'Wirkungsbehauptung außerhalb einer belegten Kontrolle.');end if;
 if k<>'safety_signal' then perform care_private.med_packet_require(e->'safety'='{"state":"not_observed","observation":"","suspectedRelation":"","reaction":"","clinicianContact":"","followUp":""}'::jsonb,'Unbelegte Sicherheitsbestätigung ist gesperrt.');end if;
 if k not in('preparation_stock','controlled_ledger') then perform care_private.med_packet_require(s='{"operation":"none","packageId":null,"batch":"","expiry":null,"quantity":null,"unit":"","balanceBefore":null,"balanceAfter":null,"reason":"","responsibleBy":null}'::jsonb,'Bestandsbehauptung außerhalb eines Bestandsereignisses.');end if;
 perform care_private.med_packet_require(jsonb_typeof(e#>'{witness,required}')='boolean' and e#>>'{witness,assertion}'='not_required' and e#>'{witness,required}'='false'::jsonb and e#>'{witness,profileId}'='null'::jsonb and e#>'{witness,signedAt}'='null'::jsonb and e#>'{witness,signatureId}'='null'::jsonb,'Unbelegte Zweitsignatur ist gesperrt.');
 perform care_private.med_packet_require(care_private.med_packet_text(p->'reason',0,2000) and jsonb_typeof(p->'expectedRevision')='number' and p->>'expectedRevision' ~ '^(0|[1-9][0-9]*)$' and (p->>'expectedRevision')::numeric<=2147483647,'Revision oder Änderungsgrund ungültig.');
 if p->>'action'='create' then perform care_private.med_packet_require(p->'expectedHeadId'='null'::jsonb and p->'original'='null'::jsonb and p->>'expectedRevision'='0' and p->>'reason'='','Neuanlage enthält erfundenes Original.');else perform care_private.med_packet_require(care_private.med_packet_uuid(p->'expectedHeadId') and jsonb_typeof(p->'original')='object' and care_private.med_packet_text(p->'reason',10,2000) and e is distinct from p#>'{original,payload}','Fortschreibung ohne Original, Änderung oder Grund.');end if;
end $$;
revoke all on function care_private.med_packet_text(jsonb,integer,integer) from public,anon,authenticated;
revoke all on function care_private.med_packet_uuid(jsonb) from public,anon,authenticated;
revoke all on function care_private.med_packet_decimal(jsonb) from public,anon,authenticated;
revoke all on function care_private.med_packet_keys(jsonb,text[]) from public,anon,authenticated;
revoke all on function care_private.med_packet_require(boolean,text) from public,anon,authenticated;
revoke all on function care_private.med_packet_time(jsonb) from public,anon,authenticated;
revoke all on function care_private.med_packet_date(jsonb) from public,anon,authenticated;
revoke all on function care_private.med_packet_uuid_list(jsonb) from public,anon,authenticated;
revoke all on function care_private.validate_medication_packet(jsonb,uuid,jsonb) from public,anon,authenticated;

create or replace function care_private.read_medication_safety_context(p_tenant uuid,p_client uuid,p_medication uuid,p_actor uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;sources jsonb;m public.medications%rowtype;dose text;unit text;prior_order jsonb;
begin actor:=care_private.medication_packet_actor('pflege.medications.view',p_tenant,p_client,p_medication,p_actor);sources:=care_private.medication_source_snapshot(p_tenant,p_client,p_medication);select * into m from public.medications where id=p_medication and tenant_id=p_tenant for share;select e.payload->'order' into prior_order from public.medication_safety_events e where e.tenant_id=p_tenant and e.client_id=p_client and e.medication_id=p_medication and e.kind in('reconciliation','order_capture') and e.payload->'sourceReview'->>'decision'='confirmed' and e.source_snapshot->'order'->>'fingerprint'=sources->'order'->>'fingerprint' and not e.voided order by e.recorded_at desc,e.id desc limit 1;dose:=coalesce(nullif(m.dosage,''),'');unit:=coalesce(nullif(to_jsonb(m)->>'dose_unit',''),'');return jsonb_build_object('sources',sources,'orderDefaults',coalesce(prior_order,jsonb_build_object('medicationName',coalesce(m.name,''),'activeIngredient',coalesce(m.active_ingredient,''),'strength',coalesce(m.strength,''),'form',coalesce(m.form,''),'dose',dose,'unit',unit,'route',coalesce(m.route,''),'prescriber',coalesce(m.prescribed_by,''),'validFrom',coalesce(m.start_date::text,''),'validUntil',case when m.end_date is null then null else m.end_date::text end,'indication',coalesce(m.indication,''),'isPrn',m.is_prn,'minimumIntervalMinutes',null,'maximumDose',null,'maximumDoseUnit','','maximumPeriodHours',null)));end $$;
create or replace function public.web_read_medication_safety_context(p_tenant_id uuid,p_client_id uuid,p_medication_id uuid,p_actor_profile_id uuid)
returns jsonb language sql security invoker set search_path='' as $$select care_private.read_medication_safety_context(p_tenant_id,p_client_id,p_medication_id,p_actor_profile_id)$$;

create or replace function care_private.read_medication_safety_page(p_tenant uuid,p_client uuid,p_medication uuid,p_actor uuid,p_cursor timestamptz,p_cursor_id uuid,p_size integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;rows jsonb;last_row jsonb;
begin actor:=care_private.medication_packet_actor('pflege.medications.view',p_tenant,p_client,p_medication,p_actor);if p_size is null or p_size<1 or p_size>100 or (p_cursor is null)<>(p_cursor_id is null) then raise exception 'Ungültige Seitengröße.' using errcode='23514';end if;
 with heads as(select distinct on(e.root_id)e.* from public.medication_safety_events e where e.tenant_id=p_tenant and e.client_id=p_client and e.medication_id=p_medication order by e.root_id,e.revision desc),page as(select * from heads h where p_cursor is null or (h.recorded_at,h.id)<(p_cursor,p_cursor_id) order by h.recorded_at desc,h.id desc limit p_size)
 select coalesce(jsonb_agg(care_private.medication_original(x.id) order by x.recorded_at desc,x.id desc),'[]'::jsonb) into rows from page x;
 last_row:=rows->(jsonb_array_length(rows)-1);
 return jsonb_build_object('rows',rows,'nextCursorRecordedAt',last_row->>'recordedAt','nextCursorId',last_row->>'headId');
end $$;
create or replace function public.web_read_medication_safety_page(p_tenant_id uuid,p_client_id uuid,p_medication_id uuid,p_actor_profile_id uuid,p_cursor_recorded_at timestamptz,p_cursor_id uuid,p_page_size integer)
returns jsonb language sql security invoker set search_path='' as $$select care_private.read_medication_safety_page(p_tenant_id,p_client_id,p_medication_id,p_actor_profile_id,p_cursor_recorded_at,p_cursor_id,p_page_size)$$;

create or replace function care_private.commit_medication_safety_packet(p_packet jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare tenant uuid:=(p_packet->>'tenantId')::uuid;client uuid:=(p_packet->>'clientId')::uuid;medication uuid:=(p_packet->>'medicationId')::uuid;actor_id uuid:=(p_packet->>'actorId')::uuid;v_request_id uuid:=(p_packet->>'requestId')::uuid;actor uuid;sources jsonb;prior care_private.medication_safety_requests%rowtype;head public.medication_safety_events%rowtype;new_id uuid:=gen_random_uuid();root uuid;revision integer;actor_name text;fingerprint text;
begin
 actor:=care_private.medication_packet_actor(case when p_packet->'entry'->>'kind' in('administration','late_administration','non_administration','prn_administration','effect_review','controlled_witness') then 'pflege.medications.administer' else 'pflege.medications.manage' end,tenant,client,medication,actor_id);
 perform pg_advisory_xact_lock(hashtextextended(tenant::text||':'||client::text||':'||medication::text,0));perform 1 from public.medications m where m.id=medication and m.tenant_id=tenant and m.client_id=client for update;sources:=care_private.medication_source_snapshot(tenant,client,medication);
 select * into prior from care_private.medication_safety_requests r where r.tenant_id=tenant and r.request_id=v_request_id;
 if prior.request_id is not null then if prior.actor_id<>actor or prior.client_id<>client or prior.medication_id<>medication or prior.packet<>p_packet then raise exception 'Anfrage wurde mit anderen Daten verwendet.' using errcode='23514';end if;return jsonb_build_object('requestId',v_request_id,'packet',prior.packet,'original',care_private.medication_original(prior.event_id));end if;
 perform care_private.validate_medication_packet(p_packet,actor,sources);
 if p_packet->>'action'='revise' then select * into head from public.medication_safety_events e where e.id=(p_packet->>'expectedHeadId')::uuid and e.tenant_id=tenant and e.client_id=client and e.medication_id=medication for update;if head.id is null or head.revision is distinct from (p_packet->>'expectedRevision')::integer or head.voided or head.kind is distinct from p_packet#>>'{entry,kind}' or exists(select 1 from public.medication_safety_events n where n.previous_id=head.id) or care_private.medication_original(head.id) is distinct from p_packet->'original' then raise exception 'Vollständiges Medikationsoriginal oder CAS stimmt nicht.' using errcode='40001';end if;root:=head.root_id;revision:=head.revision+1;else if (p_packet->>'expectedRevision')::integer<>0 or p_packet->'original'<>'null'::jsonb or p_packet->'expectedHeadId'<>'null'::jsonb then raise exception 'Neuanlage enthält ein erfundenes Original.' using errcode='23514';end if;root:=new_id;revision:=1;end if;
 select coalesce(nullif(to_jsonb(p)->>'full_name',''),nullif(p.display_name,''),p.email,'Pflegekraft') into actor_name from public.profiles p where p.id=actor;fingerprint:=care_private.medication_json_fingerprint(p_packet->'entry');
 insert into public.medication_safety_events(id,tenant_id,client_id,medication_id,root_id,previous_id,revision,kind,payload,source_snapshot,reason,content_fingerprint,recorded_by,recorded_by_name,recorded_at) values(new_id,tenant,client,medication,root,head.id,revision,p_packet->'entry'->>'kind',p_packet->'entry',sources,case when revision=1 then '' else btrim(p_packet->>'reason') end,fingerprint,actor,actor_name,clock_timestamp());
 insert into care_private.medication_safety_requests(tenant_id,client_id,medication_id,actor_id,request_id,packet,event_id) values(tenant,client,medication,actor,v_request_id,p_packet,new_id);
 return jsonb_build_object('requestId',v_request_id,'packet',p_packet,'original',care_private.medication_original(new_id));
end $$;
create or replace function public.web_commit_medication_safety_packet(p_packet jsonb)
returns jsonb language sql security invoker set search_path='' as $$select care_private.commit_medication_safety_packet(p_packet)$$;

create or replace function care_private.confirm_medication_safety_packet(p_tenant uuid,p_client uuid,p_medication uuid,p_actor uuid,p_request uuid,p_packet jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$declare actor uuid;receipt care_private.medication_safety_requests%rowtype;begin actor:=care_private.medication_packet_actor('pflege.medications.view',p_tenant,p_client,p_medication,p_actor);select * into receipt from care_private.medication_safety_requests r where r.tenant_id=p_tenant and r.request_id=p_request;if receipt.request_id is null or receipt.client_id<>p_client or receipt.medication_id<>p_medication or receipt.actor_id<>actor or receipt.packet<>p_packet then raise exception 'Passende native Medikationsquittung fehlt.' using errcode='P0H02';end if;return jsonb_build_object('requestId',p_request,'packet',receipt.packet,'original',care_private.medication_original(receipt.event_id));end $$;
create or replace function public.web_confirm_medication_safety_packet(p_tenant_id uuid,p_client_id uuid,p_medication_id uuid,p_actor_profile_id uuid,p_request_id uuid,p_packet jsonb)
returns jsonb language sql security invoker set search_path='' as $$select care_private.confirm_medication_safety_packet(p_tenant_id,p_client_id,p_medication_id,p_actor_profile_id,p_request_id,p_packet)$$;

create or replace function care_private.block_medication_safety_mutation()
returns trigger language plpgsql security definer set search_path='' as $$begin raise exception 'Medikationsoriginale und Quittungen sind append-only.' using errcode='42501';end $$;
drop trigger if exists medication_safety_immutable on public.medication_safety_events;
create trigger medication_safety_immutable before update or delete on public.medication_safety_events for each row execute function care_private.block_medication_safety_mutation();
drop trigger if exists medication_safety_receipt_immutable on care_private.medication_safety_requests;
create trigger medication_safety_receipt_immutable before update or delete on care_private.medication_safety_requests for each row execute function care_private.block_medication_safety_mutation();

revoke all on function care_private.medication_json_fingerprint(jsonb),care_private.medication_packet_actor(text,uuid,uuid,uuid,uuid),care_private.medication_source_snapshot(uuid,uuid,uuid),care_private.medication_original(uuid),care_private.validate_medication_packet(jsonb,uuid,jsonb),care_private.read_medication_safety_context(uuid,uuid,uuid,uuid),care_private.read_medication_safety_page(uuid,uuid,uuid,uuid,timestamptz,uuid,integer),care_private.commit_medication_safety_packet(jsonb),care_private.confirm_medication_safety_packet(uuid,uuid,uuid,uuid,uuid,jsonb),care_private.block_medication_safety_mutation() from public,anon,authenticated;
revoke all on function public.web_read_medication_safety_context(uuid,uuid,uuid,uuid),public.web_read_medication_safety_page(uuid,uuid,uuid,uuid,timestamptz,uuid,integer),public.web_commit_medication_safety_packet(jsonb),public.web_confirm_medication_safety_packet(uuid,uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated;
commit;
