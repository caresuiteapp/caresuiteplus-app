-- PREPARED CONTRACT ONLY. DO NOT APPLY TO PRODUCTION FROM THIS CHECKPOINT.
-- Requires ambulatory_vital_documentation.sql, ambulatory_care_operations.sql, structured_treatment_executions.sql, employee qualifications and ambulatory_handover.sql.
begin;
create schema if not exists care_private;
revoke all on schema care_private from public,anon;
grant usage on schema care_private to authenticated;

alter table public.client_vital_sign_settings
 add column if not exists source_kind text not null default 'individual_configuration' check(source_kind in ('physician_order','care_plan','individual_configuration')),
 add column if not exists approved_by uuid references public.profiles(id),
 add column if not exists valid_from timestamptz not null default clock_timestamp(),
 add column if not exists valid_to timestamptz,
 add column if not exists active boolean not null default true,
 add column if not exists revision integer not null default 1 check(revision>0);

create table if not exists public.vital_measurement_devices(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),client_id uuid references public.clients(id),
 name text not null,serial_number text,method text not null,active boolean not null default true,revision integer not null default 1 check(revision>0),
 recorded_by uuid not null references public.profiles(id),created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp()
);
create table if not exists public.vital_device_calibrations(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),device_id uuid not null references public.vital_measurement_devices(id) on delete restrict,
 status text not null check(status in ('valid','limited','expired','unknown')),performed_at timestamptz not null,valid_until timestamptz,limitation text,
 revision integer not null default 1 check(revision>0),recorded_by uuid not null references public.profiles(id),created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp()
);
create table if not exists public.respiratory_intensive_care_paths(
 id uuid primary key,tenant_id uuid not null references public.tenants(id),client_id uuid not null references public.clients(id),measurement_id uuid not null references public.vital_sign_measurements(id) on delete restrict,
 root_id uuid not null,previous_id uuid references public.respiratory_intensive_care_paths(id) on delete restrict,revision integer not null check(revision>0),kind text not null check(kind in ('oxygen_support','tracheostomy_care','suction','ventilation_review','alarm_response','emergency_equipment','qualification_review','intensive_handover','correction')),
 payload jsonb not null,reason text not null default '',recorded_by uuid not null references public.profiles(id),recorded_by_name text not null,recorded_at timestamptz not null default clock_timestamp(),content_fingerprint text not null,
 unique(root_id,revision)
);
create index if not exists respiratory_intensive_care_path_page on public.respiratory_intensive_care_paths(tenant_id,client_id,measurement_id,recorded_at desc,id desc);

create table if not exists care_private.respiratory_intensive_care_path_receipts(
 tenant_id uuid not null,request_id uuid not null,client_id uuid not null,measurement_id uuid not null,actor_id uuid not null,packet jsonb not null,path_id uuid not null references public.respiratory_intensive_care_paths(id),created_at timestamptz not null default clock_timestamp(),primary key(tenant_id,request_id)
);
create or replace function care_private.reject_vital_care_original_change()
returns trigger language plpgsql security definer set search_path='' as $$begin raise exception 'Atem-/Intensivpflegepfad-Originale und Quittungen sind append-only.' using errcode='42501';end$$;
revoke all on function care_private.reject_vital_care_original_change() from public,anon,authenticated;
drop trigger if exists protect_respiratory_intensive_care_path_original on public.respiratory_intensive_care_paths;
create trigger protect_respiratory_intensive_care_path_original before update or delete on public.respiratory_intensive_care_paths for each row execute function care_private.reject_vital_care_original_change();
drop trigger if exists protect_vital_care_receipt_original on care_private.respiratory_intensive_care_path_receipts;
create trigger protect_vital_care_receipt_original before update or delete on care_private.respiratory_intensive_care_path_receipts for each row execute function care_private.reject_vital_care_original_change();
alter table public.vital_measurement_devices enable row level security;
alter table public.vital_device_calibrations enable row level security;
alter table public.respiratory_intensive_care_paths enable row level security;
alter table care_private.respiratory_intensive_care_path_receipts enable row level security;
revoke all on public.vital_measurement_devices,public.vital_device_calibrations,public.respiratory_intensive_care_paths,care_private.respiratory_intensive_care_path_receipts from public,anon,authenticated;
grant select on public.vital_measurement_devices,public.vital_device_calibrations,public.respiratory_intensive_care_paths to authenticated;
drop policy if exists vital_devices_read on public.vital_measurement_devices;
create policy vital_devices_read on public.vital_measurement_devices for select to authenticated using(tenant_id=public.current_tenant_id() and public.has_permission('pflege.vitals.view') and (client_id is null or public.is_active_pfleger_client(client_id)));
drop policy if exists vital_calibrations_read on public.vital_device_calibrations;
create policy vital_calibrations_read on public.vital_device_calibrations for select to authenticated using(tenant_id=public.current_tenant_id() and public.has_permission('pflege.vitals.view') and exists(select 1 from public.vital_measurement_devices d where d.id=device_id and d.tenant_id=vital_device_calibrations.tenant_id and (d.client_id is null or public.is_active_pfleger_client(d.client_id))));
drop policy if exists respiratory_intensive_care_paths_read on public.respiratory_intensive_care_paths;
create policy respiratory_intensive_care_paths_read on public.respiratory_intensive_care_paths for select to authenticated using(tenant_id=public.current_tenant_id() and public.has_permission('pflege.vitals.view') and public.is_active_pfleger_client(client_id));

create or replace function care_private.assert_respiratory_path_actor(p_tenant uuid,p_actor uuid,p_manage boolean default false)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or p_tenant is distinct from public.current_tenant_id() or p_actor is distinct from public.resolve_current_profile_id()
 or not exists(select 1 from public.profiles p where p.id=p_actor and p.tenant_id=p_tenant and p.is_active)
 or public.has_permission('pflege.vitals.view') is not true or (p_manage and public.has_permission('pflege.vitals.manage') is not true)
 then raise exception 'Aktuelle Sitzung, Profil, Mandant oder Atem-/Intensivpflegerecht fehlt.' using errcode='42501';end if;
end $$;
revoke all on function care_private.assert_respiratory_path_actor(uuid,uuid,boolean) from public,anon,authenticated;

create or replace function care_private.respiratory_ref(p_id uuid,p_revision integer,p_recorded timestamptz,p_tenant uuid,p_client uuid,p_measurement uuid,p_payload jsonb)
returns jsonb language sql immutable strict set search_path='' as $$select jsonb_build_object('id',p_id,'revision',p_revision,'recordedAt',to_char(p_recorded at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'fingerprint','sha256:'||encode(digest(convert_to(p_payload::text,'UTF8'),'sha256'),'hex'),'tenantId',p_tenant,'clientId',p_client,'measurementId',p_measurement,'payload',p_payload)$$;
revoke all on function care_private.respiratory_ref(uuid,integer,timestamptz,uuid,uuid,uuid,jsonb) from public,anon,authenticated;

create or replace function care_private.respiratory_path_original(p_path uuid)
returns jsonb language sql security definer set search_path='' stable as $$
with selected as(select * from public.respiratory_intensive_care_paths where id=p_path),root as(select s.* from selected s),history as(
 select h.* from public.respiratory_intensive_care_paths h join root r on r.root_id=h.root_id where h.revision<=r.revision order by h.revision
),items as(select jsonb_agg(jsonb_build_object('id',id,'revision',revision,'previousId',previous_id,'recordedAt',to_char(recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'recordedBy',recorded_by,'recordedByName',recorded_by_name,'reason',reason,'payload',payload,'contentFingerprint',content_fingerprint) order by revision) value from history)
select jsonb_build_object('id',r.id,'tenantId',r.tenant_id,'clientId',r.client_id,'measurementId',r.measurement_id,'rootId',r.root_id,'headId',r.id,'revision',r.revision,'kind',r.kind,'recordedAt',to_char(r.recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'recordedBy',r.recorded_by,'recordedByName',r.recorded_by_name,'payload',r.payload,'contentFingerprint',r.content_fingerprint,'history',i.value) from root r cross join items i$$;
revoke all on function care_private.respiratory_path_original(uuid) from public,anon,authenticated;

create or replace function care_private.read_respiratory_intensive_care_path_context(p_tenant_id uuid,p_client_id uuid,p_measurement_id uuid,p_actor_profile_id uuid)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare m public.vital_sign_measurements%rowtype;result jsonb;
begin
 perform care_private.assert_respiratory_path_actor(p_tenant_id,p_actor_profile_id,false);
 select * into m from public.vital_sign_measurements x where x.id=p_measurement_id and x.tenant_id=p_tenant_id and x.client_id=p_client_id;
 if m.id is null or public.is_active_pfleger_client(p_client_id) is not true then raise exception 'Messung oder aktiver Pflegefall fehlt.' using errcode='42501';end if;
 select jsonb_build_object(
 'measurements',jsonb_build_array(care_private.respiratory_ref(m.id,1,m.created_at,p_tenant_id,p_client_id,m.id,to_jsonb(m))),
 'medicalOrders',coalesce((select jsonb_agg(care_private.respiratory_ref(o.id,1,o.updated_at,p_tenant_id,p_client_id,m.id,to_jsonb(o)-'tenant_id'-'client_id') order by o.updated_at,o.id) from public.care_medical_orders o where o.tenant_id=p_tenant_id and o.client_id=p_client_id),'[]'::jsonb),
 'devices',coalesce((select jsonb_agg(care_private.respiratory_ref(d.id,d.revision,d.updated_at,p_tenant_id,p_client_id,m.id,to_jsonb(d)-'tenant_id'-'client_id') order by d.updated_at,d.id) from public.vital_measurement_devices d where d.tenant_id=p_tenant_id and d.active and (d.client_id is null or d.client_id=p_client_id)),'[]'::jsonb),
 'calibrations',coalesce((select jsonb_agg(care_private.respiratory_ref(c.id,c.revision,c.updated_at,p_tenant_id,p_client_id,m.id,to_jsonb(c)-'tenant_id') order by c.updated_at,c.id) from public.vital_device_calibrations c join public.vital_measurement_devices d on d.id=c.device_id where c.tenant_id=p_tenant_id and (d.client_id is null or d.client_id=p_client_id)),'[]'::jsonb),
 'treatmentExecutions',coalesce((select jsonb_agg(care_private.respiratory_ref(e.id,1,e.created_at,p_tenant_id,p_client_id,m.id,to_jsonb(e)-'tenant_id'-'client_id') order by e.created_at,e.id) from public.clinical_treatment_executions e where e.tenant_id=p_tenant_id and e.client_id=p_client_id),'[]'::jsonb),
 'qualifications',coalesce((select jsonb_agg(care_private.respiratory_ref(q.id,1,q.updated_at,p_tenant_id,p_client_id,m.id,jsonb_build_object('employee_id',q.employee_id,'profile_id',e.profile_id,'qualification_type',q.qualification_type,'title',q.title,'valid_until',case when q.valid_until is null then null else to_char(q.valid_until,'YYYY-MM-DD"T"00:00:00.000000"Z"') end,'status',q.status,'revoked',q.status in ('expired','missing','rejected'))) order by q.updated_at,q.id) from public.employee_qualifications q join public.employees e on e.id=q.employee_id and e.tenant_id=q.tenant_id where q.tenant_id=p_tenant_id),'[]'::jsonb),
 'handovers',coalesce((select jsonb_agg(care_private.respiratory_ref(h.id,1,h.created_at,p_tenant_id,p_client_id,m.id,to_jsonb(h)-'tenant_id'-'client_id') order by h.created_at,h.id) from public.ambulatory_handovers h where h.tenant_id=p_tenant_id and h.client_id=p_client_id),'[]'::jsonb),
 'people',coalesce((select jsonb_agg(care_private.respiratory_ref(p.id,1,coalesce(p.updated_at,p.created_at),p_tenant_id,p_client_id,m.id,jsonb_build_object('display_name',coalesce(nullif(p.display_name,''),p.email),'active',p.is_active)) order by p.id) from public.profiles p where p.tenant_id=p_tenant_id and p.is_active),'[]'::jsonb),
 'paths',coalesce((select jsonb_agg(care_private.respiratory_ref(v.id,v.revision,v.recorded_at,p_tenant_id,p_client_id,m.id,jsonb_build_object('title',v.payload->>'title','kind',v.kind)) order by v.recorded_at,v.id) from public.respiratory_intensive_care_paths v where v.tenant_id=p_tenant_id and v.client_id=p_client_id and v.measurement_id=m.id),'[]'::jsonb)
 ) into result;
 return result;
end $$;
revoke all on function care_private.read_respiratory_intensive_care_path_context(uuid,uuid,uuid,uuid) from public,anon,authenticated;
create or replace function public.web_read_respiratory_intensive_care_path_context(p_tenant_id uuid,p_client_id uuid,p_measurement_id uuid,p_actor_profile_id uuid)
returns jsonb language sql security invoker set search_path='' as $$select care_private.read_respiratory_intensive_care_path_context(p_tenant_id,p_client_id,p_measurement_id,p_actor_profile_id)$$;
revoke all on function public.web_read_respiratory_intensive_care_path_context(uuid,uuid,uuid,uuid) from public,anon;
grant execute on function public.web_read_respiratory_intensive_care_path_context(uuid,uuid,uuid,uuid) to authenticated;

create or replace function care_private.read_respiratory_intensive_care_path_page(p_tenant_id uuid,p_client_id uuid,p_measurement_id uuid,p_actor_profile_id uuid,p_cursor_recorded_at timestamptz,p_cursor_id uuid,p_page_size integer)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare rows jsonb;last_at timestamptz;last_id uuid;
begin
 perform care_private.assert_respiratory_path_actor(p_tenant_id,p_actor_profile_id,false);if p_page_size not between 1 and 100 or public.is_active_pfleger_client(p_client_id) is not true then raise exception 'Ungültige Verlaufsauswahl.' using errcode='42501';end if;
 with heads as(select distinct on(root_id) * from public.respiratory_intensive_care_paths where tenant_id=p_tenant_id and client_id=p_client_id and measurement_id=p_measurement_id order by root_id,revision desc),page as(select * from heads where p_cursor_recorded_at is null or (recorded_at,id)<(p_cursor_recorded_at,p_cursor_id) order by recorded_at desc,id desc limit p_page_size)
 select coalesce(jsonb_agg(care_private.respiratory_path_original(id) order by recorded_at desc,id desc),'[]'::jsonb),(array_agg(recorded_at order by recorded_at desc,id desc))[count(*)],(array_agg(id order by recorded_at desc,id desc))[count(*)] into rows,last_at,last_id from page;
 return jsonb_build_object('rows',rows,'nextCursorRecordedAt',case when last_at is null then null else to_char(last_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') end,'nextCursorId',last_id);
end $$;
revoke all on function care_private.read_respiratory_intensive_care_path_page(uuid,uuid,uuid,uuid,timestamptz,uuid,integer) from public,anon,authenticated;
create or replace function public.web_read_respiratory_intensive_care_path_page(p_tenant_id uuid,p_client_id uuid,p_measurement_id uuid,p_actor_profile_id uuid,p_cursor_recorded_at timestamptz,p_cursor_id uuid,p_page_size integer)
returns jsonb language sql security invoker set search_path='' as $$select care_private.read_respiratory_intensive_care_path_page(p_tenant_id,p_client_id,p_measurement_id,p_actor_profile_id,p_cursor_recorded_at,p_cursor_id,p_page_size)$$;
revoke all on function public.web_read_respiratory_intensive_care_path_page(uuid,uuid,uuid,uuid,timestamptz,uuid,integer) from public,anon;
grant execute on function public.web_read_respiratory_intensive_care_path_page(uuid,uuid,uuid,uuid,timestamptz,uuid,integer) to authenticated;

create or replace function care_private.commit_respiratory_intensive_care_path_packet(p_packet jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare tenant uuid:=(p_packet->>'tenantId')::uuid;client uuid:=(p_packet->>'clientId')::uuid;measurement uuid:=(p_packet->>'measurementId')::uuid;actor uuid:=(p_packet->>'actorId')::uuid;request uuid:=(p_packet->>'requestId')::uuid;entry jsonb:=p_packet->'entry';prior care_private.respiratory_intensive_care_path_receipts%rowtype;head public.respiratory_intensive_care_paths%rowtype;m public.vital_sign_measurements%rowtype;next_id uuid:=gen_random_uuid();next_root uuid;next_revision integer;actor_name text;fingerprint text;current_sources jsonb;observed timestamptz;approval_at timestamptz;medical_order uuid;device uuid;calibration uuid;qualification uuid;kind text;person_id uuid;event_at timestamptz;
begin
 if jsonb_typeof(p_packet) is distinct from 'object' or length(p_packet::text)>2000000 or p_packet->>'schemaVersion'<>'1' or p_packet->>'action' not in ('create','revise') then raise exception 'Ungültiges Atem-/Intensivpflegepfadpaket.' using errcode='23514';end if;
 perform care_private.assert_respiratory_path_actor(tenant,actor,true);perform pg_advisory_xact_lock(hashtextextended(tenant::text||':'||client::text||':'||measurement::text,0));
 select * into m from public.vital_sign_measurements x where x.id=measurement and x.tenant_id=tenant and x.client_id=client for update;if m.id is null or public.is_active_pfleger_client(client) is not true then raise exception 'Messung oder Pflegefall nicht zugänglich.' using errcode='42501';end if;
 select * into prior from care_private.respiratory_intensive_care_path_receipts r where r.tenant_id=tenant and r.request_id=request for update;
 if prior.request_id is not null then if prior.client_id<>client or prior.measurement_id<>measurement or prior.actor_id<>actor or prior.packet<>p_packet then raise exception 'Anfrage mit anderen Originalen verwendet.' using errcode='23514';end if;return jsonb_build_object('requestId',request,'packet',prior.packet,'original',care_private.respiratory_path_original(prior.path_id));end if;
 kind:=entry->>'kind';observed:=(entry->>'observedAt')::timestamptz;
 if entry->>'tenantId' is distinct from tenant::text or entry->>'clientId' is distinct from client::text or entry->>'measurementId' is distinct from measurement::text or coalesce(kind,'') not in ('oxygen_support','tracheostomy_care','suction','ventilation_review','alarm_response','emergency_equipment','qualification_review','intensive_handover','correction') or length(btrim(coalesce(entry->>'title',''))) not between 3 and 300 then raise exception 'Atem-/Intensivpflegepfadidentität oder Phase fehlt.' using errcode='23514';end if;
 if observed is distinct from m.occurred_at or entry#>>'{source,measurementType}' is distinct from m.vital_key or entry#>>'{source,unit}' is distinct from m.unit or entry#>'{source,values}' is distinct from m.values or entry#>'{source,context}' is distinct from m.context or m.vital_key not in ('respiratory_rate','oxygen','oxygen_saturation','oxygen_flow','fio2','peep','tidal_volume','minute_ventilation','peak_pressure','plateau_pressure','ventilator_rate') then raise exception 'Atemmessung, Zeitpunkt, Einheit oder Messsituation weichen vom Original ab.' using errcode='23514';end if;
 medical_order:=nullif(entry#>>'{source,medicalOrderId}','')::uuid;device:=nullif(entry#>>'{source,deviceId}','')::uuid;calibration:=nullif(entry#>>'{source,calibrationId}','')::uuid;
 if medical_order is not null and not exists(select 1 from public.care_medical_orders o where o.id=medical_order and o.tenant_id=tenant and o.client_id=client) then raise exception 'Medizinische Verordnung ist nicht aktuell vollständig gebunden.' using errcode='23514';end if;
 if (calibration is not null and device is null) or (device is not null and not exists(select 1 from public.vital_measurement_devices d where d.id=device and d.tenant_id=tenant and d.active and (d.client_id is null or d.client_id=client))) or (calibration is not null and not exists(select 1 from public.vital_device_calibrations c where c.id=calibration and c.tenant_id=tenant and c.device_id=device)) then raise exception 'Gerät oder Kalibrierungsoriginal ist nicht aktuell gebunden.' using errcode='23514';end if;
 if kind='oxygen_support' and (medical_order is null or length(btrim(coalesce(entry#>>'{oxygen,prescribedFlow}','')))<3 or length(btrim(coalesce(entry#>>'{oxygen,actualFlow}','')))<3 or length(btrim(coalesce(entry#>>'{oxygen,application}','')))<3 or length(btrim(coalesce(entry#>>'{oxygen,device}','')))<3) then raise exception 'Sauerstoffverordnung und tatsächliche Gabe bleiben getrennt vollständig erforderlich.' using errcode='23514';end if;
 if kind='tracheostomy_care' and (length(btrim(coalesce(entry#>>'{tracheostomy,cannulaType}','')))<3 or length(btrim(coalesce(entry#>>'{tracheostomy,care}','')))<3 or length(btrim(coalesce(entry#>>'{tracheostomy,changeBasis}','')))<3 or length(btrim(coalesce(entry#>>'{tracheostomy,skin}','')))<3 or length(btrim(coalesce(entry#>>'{tracheostomy,secretion}','')))<3) then raise exception 'Tracheostomaversorgung, Wechselgrundlage, Haut und Sekret sind unvollständig.' using errcode='23514';end if;
 if kind='suction' and (length(btrim(coalesce(entry#>>'{suction,reason}','')))<3 or length(btrim(coalesce(entry#>>'{suction,route}','')))<3 or length(btrim(coalesce(entry#>>'{suction,secretion}','')))<3 or length(btrim(coalesce(entry#>>'{suction,execution}','')))<3 or length(btrim(coalesce(entry#>>'{suction,tolerance}','')))<3 or length(btrim(coalesce(entry#>>'{suction,followUp}','')))<3) then raise exception 'Absaugung, Beobachtung, Verträglichkeit und Folge sind unvollständig.' using errcode='23514';end if;
 if kind='ventilation_review' and (medical_order is null or length(btrim(coalesce(entry#>>'{ventilation,mode}','')))<3 or jsonb_typeof(entry#>'{ventilation,prescribedSettings}')<>'object' or entry#>'{ventilation,prescribedSettings}'='{}'::jsonb or jsonb_typeof(entry#>'{ventilation,actualSettings}')<>'object' or entry#>'{ventilation,actualSettings}'='{}'::jsonb or length(btrim(coalesce(entry#>>'{ventilation,deviation}','')))<3) then raise exception 'Beatmungsverordnung, Ist-Werte und Abweichung müssen getrennt vollständig vorliegen.' using errcode='23514';end if;
 if kind='alarm_response' and (length(btrim(coalesce(entry#>>'{alarm,label}','')))<3 or length(btrim(coalesce(entry#>>'{alarm,reaction}','')))<3 or length(btrim(coalesce(entry#>>'{alarm,cause}','')))<3 or (nullif(entry#>>'{alarm,resolvedAt}','') is not null and length(btrim(coalesce(entry#>>'{alarm,control}','')))<3)) then raise exception 'Alarmreaktion, Ursache und Abschlusskontrolle sind unvollständig; Quittierung allein ist kein Abschluss.' using errcode='23514';end if;
 if kind='emergency_equipment' and (length(btrim(coalesce(entry#>>'{equipment,required}','')))<3 or length(btrim(coalesce(entry#>>'{equipment,present}','')))<3 or length(btrim(coalesce(entry#>>'{equipment,functionResult}','')))<3 or (length(btrim(coalesce(entry#>>'{equipment,missing}','')))>0 and nullif(entry#>>'{equipment,resolvedAt}','') is null)) then raise exception 'Notfallausstattung, Funktionsprüfung oder bestätigte Behebung ist unvollständig.' using errcode='23514';end if;
 qualification:=nullif(entry#>>'{qualification,qualificationId}','')::uuid;if kind='qualification_review' and (qualification is null or not exists(select 1 from public.employee_qualifications q where q.id=qualification and q.tenant_id=tenant and q.status not in ('expired','missing','rejected') and to_char(q.valid_until,'YYYY-MM-DD"T"00:00:00.000000"Z"') is not distinct from entry#>>'{qualification,validUntil}') or coalesce(entry#>>'{qualification,eligible}','unknown')='unknown' or length(btrim(coalesce(entry#>>'{qualification,requirement}','')))<3 or length(btrim(coalesce(entry#>>'{qualification,evidence}','')))<3 or length(btrim(coalesce(entry#>>'{qualification,instruction}','')))<3) then raise exception 'Qualifikationsnachweis, Gültigkeit, Einweisung oder Einsatzentscheidung ist unvollständig.' using errcode='23514';end if;
 if kind='intensive_handover' and (length(btrim(coalesce(entry#>>'{handover,careProfile}','')))<3 or length(btrim(coalesce(entry#>>'{handover,monitoring}','')))<3 or length(btrim(coalesce(entry#>>'{handover,pending}','')))<3 or length(btrim(coalesce(entry#>>'{handover,recipient}','')))<3 or coalesce(entry#>>'{handover,specialistApproval}','') not in ('not_requested','pending','approved','rejected') or (entry#>>'{handover,specialistApproval}'='approved' and (nullif(entry#>>'{handover,approvedBy}','') is null or nullif(entry#>>'{handover,approvedAt}','') is null))) then raise exception 'Intensivpflegeübergabe und eigenständige Spezialfreigabe sind unvollständig.' using errcode='23514';end if;
 foreach person_id in array array[nullif(entry#>>'{oxygen,performedBy}','')::uuid,nullif(entry#>>'{tracheostomy,performedBy}','')::uuid,nullif(entry#>>'{suction,performedBy}','')::uuid,nullif(entry#>>'{ventilation,reviewedBy}','')::uuid,nullif(entry#>>'{alarm,responsibleBy}','')::uuid,nullif(entry#>>'{equipment,responsibleBy}','')::uuid,nullif(entry#>>'{qualification,reviewedBy}','')::uuid,nullif(entry#>>'{handover,handedOverBy}','')::uuid,nullif(entry#>>'{handover,approvedBy}','')::uuid] loop if person_id is not null and not exists(select 1 from public.profiles p where p.id=person_id and p.tenant_id=tenant and p.is_active) then raise exception 'Verantwortliche Person ist nicht aktuell aktiv.' using errcode='23514';end if;end loop;
 foreach event_at in array array[nullif(entry#>>'{oxygen,occurredAt}','')::timestamptz,nullif(entry#>>'{tracheostomy,occurredAt}','')::timestamptz,nullif(entry#>>'{suction,occurredAt}','')::timestamptz,nullif(entry#>>'{ventilation,occurredAt}','')::timestamptz,nullif(entry#>>'{alarm,beganAt}','')::timestamptz,nullif(entry#>>'{equipment,functionCheckAt}','')::timestamptz,nullif(entry#>>'{handover,handedOverAt}','')::timestamptz] loop if event_at is not null and event_at<observed then raise exception 'Tatsächliche Handlung oder Prüfung liegt vor dem Ausgangswert.' using errcode='23514';end if;end loop;
 if kind='correction' then approval_at:=(entry#>>'{correction,approvedAt}')::timestamptz;if nullif(entry#>>'{correction,targetId}','')::uuid is null or not exists(select 1 from public.respiratory_intensive_care_paths v where v.id=(entry#>>'{correction,targetId}')::uuid and v.tenant_id=tenant and v.client_id=client and v.measurement_id=measurement) or length(btrim(coalesce(entry#>>'{correction,reason}','')))<10 or (entry#>>'{correction,replacementId}')::uuid<>request or (entry#>>'{correction,approvedBy}')::uuid<>actor or approval_at<observed then raise exception 'Append-only Korrektur ist nicht an Original, Anfrage und aktuelle Freigabe gebunden.' using errcode='23514';end if;
 elsif coalesce(entry#>'correction','{}'::jsonb) is distinct from '{"targetId":null,"reason":"","replacementId":null,"approvedBy":null,"approvedAt":null}'::jsonb then raise exception 'Nur ein Korrekturvorgang darf Korrekturfelder setzen.' using errcode='23514';end if;
 current_sources:=care_private.read_respiratory_intensive_care_path_context(tenant,client,measurement,actor);if current_sources is distinct from p_packet->'sources' then raise exception 'Atem-/Intensivpflegepfadquellen wurden verändert. Neu laden.' using errcode='40001';end if;
 if p_packet->>'action'='create' then if p_packet->'original'<>'null'::jsonb or p_packet->'expectedHeadId'<>'null'::jsonb or (p_packet->>'expectedRevision')::integer<>0 or coalesce(p_packet->>'reason','')<>'' then raise exception 'Neuanlage enthält historischen Kopf.' using errcode='23514';end if;next_root:=next_id;next_revision:=1;
 else select * into head from public.respiratory_intensive_care_paths v where v.id=(p_packet->>'expectedHeadId')::uuid and v.tenant_id=tenant and v.client_id=client and v.measurement_id=measurement for update;if head.id is null or exists(select 1 from public.respiratory_intensive_care_paths newer where newer.root_id=head.root_id and newer.revision>head.revision) or head.revision<>(p_packet->>'expectedRevision')::integer or care_private.respiratory_path_original(head.id) is distinct from p_packet->'original' or length(btrim(coalesce(p_packet->>'reason','')))<10 or head.payload=entry then raise exception 'Atem-/Intensivpflegepfadkopf, Historie oder Fortschreibungsgrund wurde verändert.' using errcode='40001';end if;next_root:=head.root_id;next_revision:=head.revision+1;end if;
 select coalesce(nullif(p.display_name,''),p.email,'Pflegekraft') into actor_name from public.profiles p where p.id=actor and p.tenant_id=tenant and p.is_active;fingerprint:='sha256:'||encode(digest(convert_to(entry::text,'UTF8'),'sha256'),'hex');
 insert into public.respiratory_intensive_care_paths(id,tenant_id,client_id,measurement_id,root_id,previous_id,revision,kind,payload,reason,recorded_by,recorded_by_name,content_fingerprint) values(next_id,tenant,client,measurement,next_root,head.id,next_revision,entry,coalesce(p_packet->>'reason',''),actor,actor_name,fingerprint);
 insert into care_private.respiratory_intensive_care_path_receipts(tenant_id,request_id,client_id,measurement_id,actor_id,packet,path_id) values(tenant,request,client,measurement,actor,p_packet,next_id);
 return jsonb_build_object('requestId',request,'packet',p_packet,'original',care_private.respiratory_path_original(next_id));
end $$;
revoke all on function care_private.commit_respiratory_intensive_care_path_packet(jsonb) from public,anon,authenticated;
create or replace function public.web_commit_respiratory_intensive_care_path_packet(p_packet jsonb) returns jsonb language sql security invoker set search_path='' as $$select care_private.commit_respiratory_intensive_care_path_packet(p_packet)$$;
revoke all on function public.web_commit_respiratory_intensive_care_path_packet(jsonb) from public,anon;
grant execute on function public.web_commit_respiratory_intensive_care_path_packet(jsonb) to authenticated;

create or replace function care_private.confirm_respiratory_intensive_care_path_packet(p_tenant_id uuid,p_client_id uuid,p_measurement_id uuid,p_actor_profile_id uuid,p_request_id uuid,p_packet jsonb)
returns jsonb language plpgsql security definer set search_path='' stable as $$declare r care_private.respiratory_intensive_care_path_receipts%rowtype;begin perform care_private.assert_respiratory_path_actor(p_tenant_id,p_actor_profile_id,false);select * into r from care_private.respiratory_intensive_care_path_receipts x where x.tenant_id=p_tenant_id and x.request_id=p_request_id;if r.request_id is null or r.client_id<>p_client_id or r.measurement_id<>p_measurement_id or r.actor_id<>p_actor_profile_id or r.packet<>p_packet then return null;end if;return jsonb_build_object('requestId',p_request_id,'packet',r.packet,'original',care_private.respiratory_path_original(r.path_id));end $$;
revoke all on function care_private.confirm_respiratory_intensive_care_path_packet(uuid,uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated;
create or replace function public.web_confirm_respiratory_intensive_care_path_packet(p_tenant_id uuid,p_client_id uuid,p_measurement_id uuid,p_actor_profile_id uuid,p_request_id uuid,p_packet jsonb)
returns jsonb language sql security invoker set search_path='' as $$select care_private.confirm_respiratory_intensive_care_path_packet(p_tenant_id,p_client_id,p_measurement_id,p_actor_profile_id,p_request_id,p_packet)$$;
revoke all on function public.web_confirm_respiratory_intensive_care_path_packet(uuid,uuid,uuid,uuid,uuid,jsonb) from public,anon;
grant execute on function public.web_confirm_respiratory_intensive_care_path_packet(uuid,uuid,uuid,uuid,uuid,jsonb) to authenticated;
commit;
