-- LOCAL REVIEW ONLY. Requires the existing ambulatory medication, source and documentation patches.
-- Never apply as part of local verification. Existing native/direct writers, PostgREST schema cache,
-- grants, RLS, triggers, locks, rollback, parallelism and SDK compatibility require a real test database.
begin;
create schema if not exists care_private;
revoke all on schema care_private from public,anon;
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
 select jsonb_agg(jsonb_build_object('id',e.id,'revision',e.revision,'previousId',e.previous_id,'recordedAt',to_char(e.recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'recordedBy',e.recorded_by,'recordedByName',e.recorded_by_name,'reason',e.reason,'payload',e.payload,'contentFingerprint',e.content_fingerprint) order by e.revision) into history from public.medication_safety_events e where e.tenant_id=head.tenant_id and e.root_id=head.root_id;
 return jsonb_build_object('id',head.id,'tenantId',head.tenant_id,'clientId',head.client_id,'medicationId',head.medication_id,'rootId',head.root_id,'headId',head.id,'revision',head.revision,'kind',head.kind,'recordedAt',to_char(head.recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'recordedBy',head.recorded_by,'recordedByName',head.recorded_by_name,'payload',head.payload,'contentFingerprint',head.content_fingerprint,'history',coalesce(history,'[]'::jsonb),'voided',head.voided);
end $$;

create or replace function care_private.validate_medication_packet(p jsonb,p_actor uuid,p_sources jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare e jsonb:=p->'entry';kind text:=e->>'kind';actual text:=e->'administration'->>'outcome';ref jsonb;source_row jsonb;reference_at timestamptz;latest_at timestamptz;claimed_interval numeric;calculated_interval numeric;claimed_total numeric;calculated_total numeric:=0;
begin
 if p->>'schemaVersion'<>'1' or p->>'action' not in('create','revise') or p->>'actorId'<>p_actor::text or e->>'medicationId'<>p->>'medicationId' or e->>'clientId'<>p->>'clientId' or p->'sources' is distinct from p_sources then raise exception 'Paket- oder Quellbindung ist widersprüchlich.' using errcode='23514';end if;
 if kind not in('reconciliation','order_capture','schedule_version','administration','late_administration','non_administration','prn_administration','effect_review','safety_signal','controlled_witness','preparation_stock','order_pause_stop','prn_interval_check','maximum_dose_check','controlled_ledger','correction') then raise exception 'Medikationsvorgang ist ungültig.' using errcode='23514';end if;
 if nullif(btrim(e->>'title'),'') is null or e->>'orderVersion'<>p_sources->'order'->>'updatedAt' or e->'sourceReview'->>'planFingerprint'<>p_sources->'order'->>'fingerprint' then raise exception 'Verordnungsstand fehlt oder ist veraltet.' using errcode='40001';end if;
 if kind in('administration','late_administration','prn_administration') and (actual not in('administered','late') or nullif(e->'administration'->>'actualAt','') is null or nullif(e->'administration'->>'actualDose','') is null or nullif(e->'administration'->>'performedBy','') is null) then raise exception 'Tatsächliche Gabeangaben fehlen.' using errcode='23514';end if;
 if kind='non_administration' and (actual not in('omitted','refused','held') or e->'administration'->'actualAt'<>'null'::jsonb or e->'administration'->'actualDose'<>'null'::jsonb or e->'administration'->'performedBy'<>'null'::jsonb or coalesce(e->'administration'->>'unit','')<>'' or coalesce(e->'administration'->>'route','')<>'') then raise exception 'Nichtgabe darf keine tatsächliche Gabe enthalten.' using errcode='23514';end if;
 if kind='controlled_witness' and (e->'witness'->>'assertion'<>'independently_authenticated' or e->'witness'->>'profileId'<>p_actor::text or e->'witness'->>'signatureId'<>p->>'requestId' or e->'administration'->>'performedBy'=p_actor::text or nullif(e->'administration'->>'performedBy','') is null or e->'witness'->>'qualificationEvidence' is distinct from (select x->>'qualificationState' from jsonb_array_elements(p_sources->'witnesses') x where x->>'profileId'=p_actor::text and x->>'active'='true' limit 1)) then raise exception 'Zweitsignatur ist nicht an eigene Sitzung, andere ausführende Person, Anfrage und Qualifikationsfassung gebunden.' using errcode='42501';end if;
 if kind in('preparation_stock','controlled_ledger') and (nullif(e->'stock'->>'packageId','') is null or (e->'stock'->>'balanceAfter')::numeric<0) then raise exception 'Bestandsbuchung ist unvollständig oder negativ.' using errcode='23514';end if;
 if kind='correction' and e->'correction'->>'targetEventId'=e->'correction'->>'replacementEventId' then raise exception 'Korrektur benötigt eine neue Ereignisidentität.' using errcode='23514';end if;
 if jsonb_typeof(e->'administration'->'precedingAdministrationIds') is distinct from 'array' then raise exception 'Vorherige tatsächliche Gaben fehlen.' using errcode='23514';end if;
 if jsonb_array_length(e->'administration'->'precedingAdministrationIds')<>(select count(distinct value#>>'{}') from jsonb_array_elements(e->'administration'->'precedingAdministrationIds')) then raise exception 'Doppelte tatsächliche Gabe ist unzulässig.' using errcode='23514';end if;
 for ref in select value from jsonb_array_elements(e->'administration'->'precedingAdministrationIds') loop
  select value into source_row from jsonb_array_elements(p_sources->'administrations') where value->>'id'=ref#>>'{}' and value->>'status' in('administered','late') limit 1;
  if source_row is null then raise exception 'Referenzierte tatsächliche Gabe fehlt im vollständigen Quellbestand.' using errcode='40001';end if;
  if kind in('prn_administration','prn_interval_check') then if source_row->>'occurredAt' is null then raise exception 'Tatsächliche Originalzeit fehlt.' using errcode='23514';end if;latest_at:=greatest(coalesce(latest_at,'-infinity'::timestamptz),(source_row->>'occurredAt')::timestamptz);end if;
  if kind in('prn_administration','maximum_dose_check') then if coalesce(source_row->>'dose','')!~'^(0|[1-9][0-9]{0,7})(\.[0-9]{1,3})?$' or source_row->>'unit'<>e->'order'->>'maximumDoseUnit' then raise exception 'Strukturierte tatsächliche Originaldosis oder Einheit fehlt.' using errcode='23514';end if;calculated_total:=calculated_total+(source_row->>'dose')::numeric;end if;
 end loop;
 if kind in('prn_administration','prn_interval_check') then if latest_at is null then raise exception 'Mindestens eine tatsächliche Vorgabe ist für die Abstandsprüfung erforderlich.' using errcode='23514';end if;reference_at:=(case when kind='prn_administration' then e->'administration'->>'actualAt' else e->>'plannedAt' end)::timestamptz;claimed_interval:=(e->'administration'->>'intervalMinutes')::numeric;calculated_interval:=floor(extract(epoch from(reference_at-latest_at))*1000/60)/1000;if reference_at<latest_at or claimed_interval<>calculated_interval then raise exception 'Abstandsminuten stimmen nicht mit tatsächlichen Originalzeiten überein.' using errcode='23514';end if;end if;
 if kind in('prn_administration','maximum_dose_check') then if kind='prn_administration' then calculated_total:=calculated_total+(e->'administration'->>'actualDose')::numeric;end if;claimed_total:=(e->'administration'->>'maximumPeriodDose')::numeric;if claimed_total<>calculated_total or claimed_total>(e->'order'->>'maximumDose')::numeric then raise exception 'Zeitraumssumme stimmt nicht mit tatsächlichen Originaldosen oder Höchstmenge überein.' using errcode='23514';end if;end if;
 if nullif(e->'effect'->>'administrationId','') is not null and not exists(select 1 from jsonb_array_elements(p_sources->'administrations') x where x->>'id'=e->'effect'->>'administrationId' and x->>'status' in('administered','late')) then raise exception 'Wirkungskontrolle ist nicht an eine tatsächliche Gabe gebunden.' using errcode='40001';end if;
 if nullif(e->'witness'->>'profileId','') is not null and not exists(select 1 from jsonb_array_elements(p_sources->'witnesses') x where x->>'profileId'=e->'witness'->>'profileId' and x->>'active'='true') then raise exception 'Gegenkontrollperson fehlt im aktuellen vollständigen Personenbestand.' using errcode='40001';end if;
 if nullif(e->'stock'->>'packageId','') is not null and e->'stock'->>'operation'<>'receipt' and not exists(select 1 from jsonb_array_elements(p_sources->'stockMovements') x where x->>'packageId'=e->'stock'->>'packageId') then raise exception 'Packungsbestand fehlt im vollständigen Quellbestand.' using errcode='40001';end if;
end $$;

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
declare tenant uuid:=(p_packet->>'tenantId')::uuid;client uuid:=(p_packet->>'clientId')::uuid;medication uuid:=(p_packet->>'medicationId')::uuid;actor_id uuid:=(p_packet->>'actorId')::uuid;request_id uuid:=(p_packet->>'requestId')::uuid;actor uuid;sources jsonb;prior care_private.medication_safety_requests%rowtype;head public.medication_safety_events%rowtype;new_id uuid:=gen_random_uuid();root uuid;revision integer;actor_name text;fingerprint text;
begin
 actor:=care_private.medication_packet_actor(case when p_packet->'entry'->>'kind' in('administration','late_administration','non_administration','prn_administration','effect_review','controlled_witness') then 'pflege.medications.administer' else 'pflege.medications.manage' end,tenant,client,medication,actor_id);
 perform pg_advisory_xact_lock(hashtextextended(tenant::text||':'||client::text||':'||medication::text,0));perform 1 from public.medications m where m.id=medication and m.tenant_id=tenant and m.client_id=client for update;sources:=care_private.medication_source_snapshot(tenant,client,medication);
 select * into prior from care_private.medication_safety_requests r where r.tenant_id=tenant and r.request_id=request_id;
 if prior.request_id is not null then if prior.actor_id<>actor or prior.client_id<>client or prior.medication_id<>medication or prior.packet<>p_packet then raise exception 'Anfrage wurde mit anderen Daten verwendet.' using errcode='23514';end if;return jsonb_build_object('requestId',request_id,'packet',prior.packet,'original',care_private.medication_original(prior.event_id));end if;
 perform care_private.validate_medication_packet(p_packet,actor,sources);
 if p_packet->>'action'='revise' then select * into head from public.medication_safety_events e where e.id=(p_packet->>'expectedHeadId')::uuid and e.tenant_id=tenant and e.client_id=client and e.medication_id=medication for update;if head.id is null or head.revision<>(p_packet->>'expectedRevision')::integer or exists(select 1 from public.medication_safety_events n where n.previous_id=head.id) or care_private.medication_original(head.id) is distinct from p_packet->'original' then raise exception 'Vollständiges Medikationsoriginal oder CAS stimmt nicht.' using errcode='40001';end if;root:=head.root_id;revision:=head.revision+1;else if (p_packet->>'expectedRevision')::integer<>0 or p_packet->'original'<>'null'::jsonb or p_packet->'expectedHeadId'<>'null'::jsonb then raise exception 'Neuanlage enthält ein erfundenes Original.' using errcode='23514';end if;root:=new_id;revision:=1;end if;
 select coalesce(nullif(to_jsonb(p)->>'full_name',''),nullif(p.display_name,''),p.email,'Pflegekraft') into actor_name from public.profiles p where p.id=actor;fingerprint:=care_private.medication_json_fingerprint(p_packet->'entry');
 insert into public.medication_safety_events(id,tenant_id,client_id,medication_id,root_id,previous_id,revision,kind,payload,source_snapshot,reason,content_fingerprint,recorded_by,recorded_by_name) values(new_id,tenant,client,medication,root,head.id,revision,p_packet->'entry'->>'kind',p_packet->'entry',sources,case when revision=1 then '' else btrim(p_packet->>'reason') end,fingerprint,actor,actor_name);
 insert into care_private.medication_safety_requests(tenant_id,client_id,medication_id,actor_id,request_id,packet,event_id) values(tenant,client,medication,actor,request_id,p_packet,new_id);
 return jsonb_build_object('requestId',request_id,'packet',p_packet,'original',care_private.medication_original(new_id));
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
revoke all on function public.web_read_medication_safety_context(uuid,uuid,uuid,uuid),public.web_read_medication_safety_page(uuid,uuid,uuid,uuid,timestamptz,uuid,integer),public.web_commit_medication_safety_packet(jsonb),public.web_confirm_medication_safety_packet(uuid,uuid,uuid,uuid,uuid,jsonb) from public,anon;
grant execute on function care_private.read_medication_safety_context(uuid,uuid,uuid,uuid),care_private.read_medication_safety_page(uuid,uuid,uuid,uuid,timestamptz,uuid,integer),care_private.commit_medication_safety_packet(jsonb),care_private.confirm_medication_safety_packet(uuid,uuid,uuid,uuid,uuid,jsonb) to authenticated;
grant execute on function public.web_read_medication_safety_context(uuid,uuid,uuid,uuid),public.web_read_medication_safety_page(uuid,uuid,uuid,uuid,timestamptz,uuid,integer),public.web_commit_medication_safety_packet(jsonb),public.web_confirm_medication_safety_packet(uuid,uuid,uuid,uuid,uuid,jsonb) to authenticated;
commit;
