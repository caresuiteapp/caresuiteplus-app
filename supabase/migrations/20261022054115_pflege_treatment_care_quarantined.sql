-- Quarantined Staging treatment packet/review family. No grants or clinical execution.
-- Native prerequisites were catalogued before preparation. The actual vital time is
-- measured_at. No shared/native writers or policies are replaced by this patch.
-- The technical metadata path is explicitly bounded again below; clinical kinds
-- and independent clinical decisions remain blocked even under privileged testing.
create schema if not exists care_private;

create table if not exists public.treatment_care_events(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),client_id uuid not null references public.clients(id),order_id uuid not null references public.care_medical_orders(id),
 root_id uuid not null,previous_id uuid references public.treatment_care_events(id),revision integer not null check(revision>0),kind text not null,
 payload jsonb not null,source_snapshot jsonb not null,reason text not null default '',content_fingerprint text not null,
 recorded_by uuid not null references public.profiles(id),recorded_by_name text not null,recorded_at timestamptz not null default clock_timestamp(),voided boolean not null default false,
 unique(tenant_id,root_id,revision),unique(tenant_id,previous_id)
);
create index if not exists treatment_care_client_page on public.treatment_care_events(tenant_id,client_id,recorded_at desc,id desc);
alter table public.treatment_care_events enable row level security;
revoke insert,update,delete,truncate on public.treatment_care_events from public,anon,authenticated;

create table if not exists care_private.treatment_care_requests(tenant_id uuid not null,client_id uuid not null,order_id uuid not null,actor_id uuid not null,request_id uuid not null,packet jsonb not null,event_id uuid not null references public.treatment_care_events(id),created_at timestamptz not null default clock_timestamp(),primary key(tenant_id,request_id));
alter table care_private.treatment_care_requests enable row level security;
revoke all on care_private.treatment_care_requests from public,anon,authenticated;

create or replace function care_private.treatment_care_fingerprint(value jsonb) returns text language sql immutable strict set search_path='' as $$select 'sha256:'||encode(extensions.digest(convert_to(value::text,'UTF8'),'sha256'),'hex')$$;
create or replace function care_private.treatment_care_actor(permission_name text,p_tenant uuid,p_client uuid,p_order uuid,p_actor uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare claims jsonb;session_id uuid;actor uuid;
begin claims:=coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb;if claims->>'session_id' is null or claims->>'session_id' !~* '^[0-9a-f-]{36}$' then raise exception 'Sitzungsbindung fehlt.' using errcode='42501';end if;session_id:=(claims->>'session_id')::uuid;actor:=public.resolve_current_profile_id();
 if auth.uid() is null or p_tenant is distinct from public.current_tenant_id() or actor is distinct from p_actor or not exists(select 1 from auth.sessions s where s.id=session_id and s.user_id=auth.uid() and coalesce(s.not_after,clock_timestamp()+interval '1 second')>clock_timestamp()) or not exists(select 1 from public.profiles p where p.id=actor and p.tenant_id=p_tenant and p.is_active) or public.has_permission('pflege.treatment.view') is not true or public.has_permission('pflege.orders.view') is not true or public.has_permission(permission_name) is not true or public.is_active_pfleger_client(p_client) is not true or not exists(select 1 from public.care_medical_orders o where o.id=p_order and o.tenant_id=p_tenant and o.client_id=p_client) then raise exception 'Aktueller Behandlungsbezug oder Berechtigung fehlt.' using errcode='42501';end if;return actor;end $$;

create or replace function care_private.treatment_care_ref(row_json jsonb,p_client uuid,p_order uuid) returns jsonb language sql immutable strict set search_path='' as $$select jsonb_build_object('id',row_json->>'id','revision',case when row_json->>'version' ~ '^[1-9][0-9]*$' then (row_json->>'version')::integer else 1 end,'recordedAt',coalesce(row_json->>'recorded_at',row_json->>'updated_at',row_json->>'created_at'),'fingerprint',care_private.treatment_care_fingerprint(row_json),'clientId',p_client,'orderId',p_order,'payload',row_json)$$;
create or replace function care_private.treatment_care_sources(p_tenant uuid,p_client uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 select jsonb_build_object(
  'orders',coalesce((select jsonb_agg(care_private.treatment_care_ref((to_jsonb(o)||jsonb_build_object('recorded_at',to_char(coalesce(o.updated_at,o.created_at) at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))),p_client,o.id) order by coalesce(o.updated_at,o.created_at),o.id) from public.care_medical_orders o where o.tenant_id=p_tenant and o.client_id=p_client),'[]'::jsonb),
  'approvals',coalesce((select jsonb_agg(care_private.treatment_care_ref(jsonb_build_object('id',o.id,'version',1,'recorded_at',to_char(coalesce(o.updated_at,o.created_at) at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'state',o.insurer_approval_status,'reference',o.insurer_approval_reference,'valid_from',o.valid_from,'valid_until',o.valid_until),p_client,o.id) order by coalesce(o.updated_at,o.created_at),o.id) from public.care_medical_orders o where o.tenant_id=p_tenant and o.client_id=p_client and nullif(o.insurer_approval_status,'') is not null),'[]'::jsonb),
  'executions',coalesce((select jsonb_agg(care_private.treatment_care_ref((to_jsonb(e)||jsonb_build_object('recorded_at',to_char(e.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))),p_client,e.medical_order_id) order by e.created_at,e.id) from public.clinical_treatment_executions e where e.tenant_id=p_tenant and e.client_id=p_client),'[]'::jsonb),
  'infusions',coalesce((select jsonb_agg(care_private.treatment_care_ref(jsonb_build_object('id',e.id,'version',e.sequence,'recorded_at',to_char(e.recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'course_id',e.episode_id,'sequence',e.sequence,'draft',e.draft),p_client,nullif(e.request_payload->'draft'->>'orderId','')::uuid) order by e.recorded_at,e.id) from public.care_infusion_events e where e.tenant_id=p_tenant and e.client_id=p_client),'[]'::jsonb),
  'measurements',coalesce((select jsonb_agg(care_private.treatment_care_ref((to_jsonb(m)||jsonb_build_object('recorded_at',to_char(m.measured_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))),p_client,null) order by m.measured_at,m.id) from public.vital_sign_measurements m where m.tenant_id=p_tenant and m.client_id=p_client),'[]'::jsonb),
  'invalidations',coalesce((select jsonb_agg(care_private.treatment_care_ref((to_jsonb(i)||jsonb_build_object('recorded_at',to_char(i.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))),p_client,null) order by i.created_at,i.id) from public.vital_measurement_invalidations i where i.tenant_id=p_tenant and i.client_id=p_client),'[]'::jsonb),
  'corrections',coalesce((select jsonb_agg(care_private.treatment_care_ref((to_jsonb(c)||jsonb_build_object('recorded_at',to_char(c.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))),p_client,null) order by c.created_at,c.id) from public.clinical_treatment_corrections c where c.tenant_id=p_tenant and c.client_id=p_client),'[]'::jsonb),
  'people',coalesce((select jsonb_agg(care_private.treatment_care_ref(jsonb_build_object('id',p.id,'version',1,'recorded_at',to_char(coalesce(p.updated_at,p.created_at) at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'active',p.is_active,'qualification_state',to_jsonb(p)->>'qualification_state'),p_client,null) order by p.id) from public.profiles p where p.tenant_id=p_tenant),'[]'::jsonb),
  'documents','[]'::jsonb
 ) into result;return result;end $$;

create or replace function care_private.treatment_care_original(p_event uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare head public.treatment_care_events%rowtype;history jsonb;begin select * into head from public.treatment_care_events where id=p_event;if head.id is null then return null;end if;select jsonb_agg(jsonb_build_object('id',e.id,'revision',e.revision,'previousId',e.previous_id,'recordedAt',to_char(e.recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'recordedBy',e.recorded_by,'recordedByName',e.recorded_by_name,'reason',e.reason,'payload',e.payload,'contentFingerprint',e.content_fingerprint) order by e.revision) into history from public.treatment_care_events e where e.tenant_id=head.tenant_id and e.root_id=head.root_id and e.revision<=head.revision;return jsonb_build_object('id',head.id,'tenantId',head.tenant_id,'clientId',head.client_id,'orderId',head.order_id,'rootId',head.root_id,'headId',head.id,'revision',head.revision,'kind',head.kind,'recordedAt',to_char(head.recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'recordedBy',head.recorded_by,'recordedByName',head.recorded_by_name,'payload',head.payload,'contentFingerprint',head.content_fingerprint,'history',coalesce(history,'[]'::jsonb),'voided',head.voided);end $$;

create or replace function care_private.validate_treatment_care_prepared_packet(p jsonb,p_actor uuid,p_sources jsonb) returns void language plpgsql security definer set search_path='' as $$declare e jsonb:=p->'entry';kind text:=e->>'kind';order_source jsonb;approval_source jsonb;measurement_source jsonb;infusion_source jsonb;material_source jsonb;begin
 if p->>'schemaVersion'<>'1' or p->>'action' not in('create','revise') or p->>'actorId'<>p_actor::text or e->>'clientId'<>p->>'clientId' or e->>'orderId'<>p->>'orderId' or p->'sources' is distinct from p_sources then raise exception 'Paket- oder Quellenbindung ist widersprüchlich.' using errcode='23514';end if;
 if kind not in('order_review','payer_review','injection','insulin','infusion','pump','inhalation','instillation','compression','access_drain','other_hkp','order_revision','measurement_link','completion_review','correction') then raise exception 'Behandlungspflegevorgang ist ungültig.' using errcode='23514';end if;
 select value into order_source from jsonb_array_elements(p_sources->'orders') where value->>'id'=p->>'orderId' limit 1;if order_source is null or order_source->>'recordedAt'<>e->>'orderVersion' then raise exception 'Verordnungsfassung fehlt oder ist veraltet.' using errcode='40001';end if;
 if kind in('injection','insulin','infusion','pump','inhalation','instillation','compression','access_drain','other_hkp') and (e->'execution'->>'outcome' not in('performed','partial','omitted','refused','failed') or nullif(e->>'occurredAt','') is null or nullif(btrim(e->'execution'->>'action'),'') is null or nullif(btrim(e->'execution'->>'observation'),'') is null) then raise exception 'Tatsächliche Durchführung oder Nichtdurchführung ist unvollständig.' using errcode='23514';end if;
 if kind='insulin' and e->'measurement'->>'state'<>'linked' and e->>'lifecycle'='completed' then raise exception 'Insulinabschluss ohne bestätigten Messwertbezug ist gesperrt.' using errcode='23514';end if;
 if nullif(e->'payer'->>'approvalId','') is not null then select value into approval_source from jsonb_array_elements(p_sources->'approvals') where value->>'id'=e->'payer'->>'approvalId' limit 1;if approval_source is null or approval_source->>'orderId'<>p->>'orderId' or coalesce(approval_source->'payload'->>'reference','')<>coalesce(e->'payer'->>'reference','') or coalesce(approval_source->'payload'->>'valid_from','')<>coalesce(e->'payer'->>'validFrom','') or coalesce(approval_source->'payload'->>'valid_until','')<>coalesce(e->'payer'->>'validUntil','') then raise exception 'Kostenträgerentscheidung wurde verändert oder gehört nicht zur Verordnung.' using errcode='40001';end if;end if;
 if e->'measurement'->>'state'='linked' then select value into measurement_source from jsonb_array_elements(p_sources->'measurements') where value->>'id'=e->'measurement'->>'measurementId' limit 1;if measurement_source is null or measurement_source->>'recordedAt'<>e->'measurement'->>'occurredAt' or coalesce(measurement_source->'payload'->>'vital_key','')<>e->'measurement'->>'kind' or coalesce(measurement_source->'payload'->>'display_value',measurement_source->'payload'->>'value','')<>e->'measurement'->>'value' or coalesce(measurement_source->'payload'->>'unit','')<>e->'measurement'->>'unit' or exists(select 1 from jsonb_array_elements(p_sources->'invalidations') x where x->'payload'->>'measurement_id'=measurement_source->>'id') or (measurement_source->>'recordedAt')::timestamptz>coalesce((e->>'occurredAt')::timestamptz,(e->>'plannedAt')::timestamptz) or extract(epoch from(coalesce((e->>'occurredAt')::timestamptz,(e->>'plannedAt')::timestamptz)-(measurement_source->>'recordedAt')::timestamptz))/60>(e->'measurement'->>'maximumAgeMinutes')::numeric then raise exception 'Messwert ist fremd, verändert, ungültig oder außerhalb der Altersgrenze.' using errcode='40001';end if;end if;
 if e->'infusion'->>'state'='linked' then select value into infusion_source from jsonb_array_elements(p_sources->'infusions') where value->>'id'=e->'infusion'->>'headId' limit 1;if infusion_source is null or infusion_source->'payload'->>'course_id'<>e->'infusion'->>'courseId' or (infusion_source->'payload'->>'sequence')::integer<>(e->'infusion'->>'sequence')::integer then raise exception 'Infusionsverlaufskopf oder Sequenz wurde verändert.' using errcode='40001';end if;end if;
 if e->'material'->>'state' not in('not_required','selected','used','unavailable') or length(btrim(coalesce(e->'material'->>'reason','')))<3 then raise exception 'Materialstatus und Begründung sind unvollständig.' using errcode='23514';end if;
 if e->'material'->>'state'='used' and (nullif(e->'material'->>'originalId','') is null or length(btrim(coalesce(e->'material'->>'name','')))<1 or coalesce(e->'material'->>'quantity','')!~'^(0|[1-9][0-9]{0,7})(\.[0-9]{1,3})?$' or length(btrim(coalesce(e->'material'->>'unit','')))<1 or length(btrim(coalesce(e->'material'->>'purpose','')))<3) then raise exception 'Tatsächlicher Materialverbrauch benötigt Original, Menge, Einheit und Zweck.' using errcode='23514';end if;
 if e->'material'->>'state' in('not_required','unavailable') and (e->'material'->'originalId'<>'null'::jsonb or e->'material'->'quantity'<>'null'::jsonb or coalesce(e->'material'->>'name','')<>'' or coalesce(e->'material'->>'batch','')<>'' or coalesce(e->'material'->>'unit','')<>'' or coalesce(e->'material'->>'purpose','')<>'') then raise exception 'Nicht erforderliches oder nicht verfügbares Material darf keinen Verbrauch vortäuschen.' using errcode='23514';end if;
 if kind in('injection','insulin','infusion','pump','inhalation','instillation','compression','access_drain','other_hkp') and e->'execution'->>'outcome' in('performed','partial') and e->'material'->>'state' not in('used','not_required') then raise exception 'Durchgeführte Behandlung benötigt Verbrauch oder ausdrückliche Nicht-Erforderlichkeit.' using errcode='23514';end if;
 if (kind not in('injection','insulin','infusion','pump','inhalation','instillation','compression','access_drain','other_hkp') or e->'execution'->>'outcome' not in('performed','partial')) and e->'material'->>'state'='used' then raise exception 'Planung oder Nichtdurchführung darf keinen Materialverbrauch ableiten.' using errcode='23514';end if;
 if nullif(e->'material'->>'originalId','') is not null then select value into material_source from jsonb_array_elements(p_sources->'executions') where value->>'id'=e->'material'->>'originalId' limit 1;if material_source is null or material_source->>'clientId'<>p->>'clientId' or material_source->>'orderId'<>p->>'orderId' or coalesce(material_source->'payload'->>'material_name',material_source->'payload'->>'material','')<>coalesce(e->'material'->>'name','') or coalesce(material_source->'payload'->>'material_batch',material_source->'payload'->>'batch','')<>coalesce(e->'material'->>'batch','') or coalesce(material_source->'payload'->>'material_expiry',material_source->'payload'->>'expires_on','')<>coalesce(e->'material'->>'expiresOn','') or coalesce(material_source->'payload'->>'material_quantity',material_source->'payload'->>'quantity','')<>coalesce(e->'material'->>'quantity','') or coalesce(material_source->'payload'->>'material_unit',material_source->'payload'->>'unit','')<>coalesce(e->'material'->>'unit','') then raise exception 'Materialoriginal ist fremd, verändert oder gehört nicht zur Verordnung.' using errcode='40001';end if;end if;
 if nullif(e->'qualification'->>'performedBy','') is not null and not exists(select 1 from jsonb_array_elements(p_sources->'people') x where x->>'id'=e->'qualification'->>'performedBy' and x->'payload'->>'active'='true' and x->'payload'->>'qualification_state'=e->'qualification'->>'evidence') then raise exception 'Ausführende Person oder Qualifikationsfassung fehlt im aktuellen Personenbestand.' using errcode='40001';end if;
 if e->'qualification'->>'state'='independently_confirmed' and e->'qualification'->>'reviewedBy'<>p_actor::text then raise exception 'Unabhängige Prüfung ist nicht an die eigene Sitzung gebunden.' using errcode='42501';end if;
 if kind='order_revision' and not exists(select 1 from jsonb_array_elements(p_sources->'orders') x where x->>'id'=e->'order'->>'previousOrderId' and x->>'clientId'=p->>'clientId') then raise exception 'Historische Vorgängerverordnung fehlt.' using errcode='40001';end if;
 if kind='correction' and (e->'correction'->>'approvedBy'<>p_actor::text or e->'correction'->>'replacementId'<>p->>'requestId' or not exists(select 1 from jsonb_array_elements(p_sources->'executions') x where x->>'id'=e->'correction'->>'targetId' and x->>'clientId'=p->>'clientId')) then raise exception 'Korrektur ist nicht an Original, Sitzung und Anfrage gebunden.' using errcode='42501';end if;
 if e->>'lifecycle'='completed' and (e->'qualification'->>'state'='unconfirmed' or e->'payer'->>'state'='unknown' or e->'measurement'->>'state'='unconfirmed' or e->'infusion'->>'state'='unconfirmed' or e->'followUp'->>'state' in('pending','scheduled')) then raise exception 'Abschluss enthält ungeklärte Quellen oder Folgehandlungen.' using errcode='23514';end if;
end $$;

create or replace function care_private.read_treatment_care_context(p_tenant uuid,p_client uuid,p_actor uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare first_order uuid;begin perform care_private.require_workspace_session(p_tenant,p_actor);select o.id into first_order from public.care_medical_orders o where o.tenant_id=p_tenant and o.client_id=p_client order by coalesce(o.updated_at,o.created_at) desc,o.id desc limit 1;if first_order is null then raise exception 'Keine zugängliche Verordnungsfassung.' using errcode='P0H01';end if;perform care_private.treatment_care_actor('pflege.treatment.view',p_tenant,p_client,first_order,p_actor);return care_private.treatment_care_sources(p_tenant,p_client);end $$;
create or replace function public.web_read_treatment_care_context(p_tenant_id uuid,p_client_id uuid,p_actor_profile_id uuid) returns jsonb language sql security invoker set search_path='' as $$select care_private.read_treatment_care_context(p_tenant_id,p_client_id,p_actor_profile_id)$$;

create or replace function care_private.read_treatment_care_page(p_tenant uuid,p_client uuid,p_actor uuid,p_cursor timestamptz,p_cursor_id uuid,p_size integer) returns jsonb language plpgsql security definer set search_path='' as $$declare first_order uuid;rows jsonb;next_at timestamptz;next_id uuid;begin select o.id into first_order from public.care_medical_orders o where o.tenant_id=p_tenant and o.client_id=p_client order by o.id limit 1;perform care_private.treatment_care_actor('pflege.treatment.view',p_tenant,p_client,first_order,p_actor);if p_size<1 or p_size>100 then raise exception 'Ungültige Seitengröße.' using errcode='23514';end if;with heads as(select distinct on(e.root_id)e.* from public.treatment_care_events e where e.tenant_id=p_tenant and e.client_id=p_client order by e.root_id,e.revision desc),page as(select * from heads h where p_cursor is null or (h.recorded_at,h.id)<(p_cursor,p_cursor_id) order by h.recorded_at desc,h.id desc limit p_size) select coalesce(jsonb_agg(care_private.treatment_care_original(x.id) order by x.recorded_at desc,x.id desc),'[]'::jsonb),(array_agg(x.recorded_at order by x.recorded_at,x.id))[1],(array_agg(x.id order by x.recorded_at,x.id))[1] into rows,next_at,next_id from page x;return jsonb_build_object('rows',rows,'nextCursorRecordedAt',case when next_at is null then null else to_char(next_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') end,'nextCursorId',next_id);end $$;
create or replace function public.web_read_treatment_care_page(p_tenant_id uuid,p_client_id uuid,p_actor_profile_id uuid,p_cursor_recorded_at timestamptz,p_cursor_id uuid,p_page_size integer) returns jsonb language sql security invoker set search_path='' as $$select care_private.read_treatment_care_page(p_tenant_id,p_client_id,p_actor_profile_id,p_cursor_recorded_at,p_cursor_id,p_page_size)$$;

create or replace function care_private.commit_treatment_care_packet(p_packet jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare tenant uuid:=(p_packet->>'tenantId')::uuid;client uuid:=(p_packet->>'clientId')::uuid;order_id uuid:=(p_packet->>'orderId')::uuid;actor_id uuid:=(p_packet->>'actorId')::uuid;request_id uuid:=(p_packet->>'requestId')::uuid;actor uuid;sources jsonb;receipt care_private.treatment_care_requests%rowtype;head public.treatment_care_events%rowtype;new_id uuid:=gen_random_uuid();root uuid;next_revision integer;actor_name text;permission_name text;begin permission_name:=case when p_packet->'entry'->>'kind' in('order_review','payer_review','order_revision','completion_review','correction') then 'pflege.orders.manage' else 'pflege.treatment.manage' end;actor:=care_private.treatment_care_actor(permission_name,tenant,client,order_id,actor_id);perform pg_advisory_xact_lock(hashtextextended(tenant::text||':treatment-care:'||client::text||':'||order_id::text,0));perform 1 from public.care_medical_orders o where o.id=order_id and o.tenant_id=tenant and o.client_id=client for update;sources:=care_private.treatment_care_sources(tenant,client);select * into receipt from care_private.treatment_care_requests r where r.tenant_id=tenant and r.request_id=request_id;if receipt.request_id is not null then if receipt.actor_id<>actor or receipt.client_id<>client or receipt.order_id<>order_id or receipt.packet<>p_packet then raise exception 'Anfrage wurde mit anderen Daten verwendet.' using errcode='23514';end if;return jsonb_build_object('requestId',request_id,'packet',receipt.packet,'original',care_private.treatment_care_original(receipt.event_id));end if;perform care_private.validate_treatment_care_prepared_packet(p_packet,actor,sources);
 if p_packet->>'action'='revise' then select * into head from public.treatment_care_events e where e.id=(p_packet->>'expectedHeadId')::uuid and e.tenant_id=tenant and e.client_id=client and e.order_id=order_id for update;if head.id is null or head.revision<>(p_packet->>'expectedRevision')::integer or exists(select 1 from public.treatment_care_events n where n.previous_id=head.id) or care_private.treatment_care_original(head.id) is distinct from p_packet->'original' then raise exception 'Vollständiges Behandlungsoriginal oder CAS stimmt nicht.' using errcode='40001';end if;root:=head.root_id;next_revision:=head.revision+1;else if (p_packet->>'expectedRevision')::integer<>0 or p_packet->'original'<>'null'::jsonb or p_packet->'expectedHeadId'<>'null'::jsonb then raise exception 'Neuanlage enthält ein erfundenes Original.' using errcode='23514';end if;root:=new_id;next_revision:=1;end if;
 select coalesce(nullif(to_jsonb(p)->>'full_name',''),nullif(p.display_name,''),p.email,'Pflegekraft') into actor_name from public.profiles p where p.id=actor;insert into public.treatment_care_events(id,tenant_id,client_id,order_id,root_id,previous_id,revision,kind,payload,source_snapshot,reason,content_fingerprint,recorded_by,recorded_by_name) values(new_id,tenant,client,order_id,root,head.id,next_revision,p_packet->'entry'->>'kind',p_packet->'entry',sources,case when next_revision=1 then '' else btrim(p_packet->>'reason') end,care_private.treatment_care_fingerprint(p_packet->'entry'),actor,actor_name);insert into care_private.treatment_care_requests(tenant_id,client_id,order_id,actor_id,request_id,packet,event_id) values(tenant,client,order_id,actor,request_id,p_packet,new_id);return jsonb_build_object('requestId',request_id,'packet',p_packet,'original',care_private.treatment_care_original(new_id));end $$;
create or replace function public.web_commit_treatment_care_packet(p_packet jsonb) returns jsonb language sql security invoker set search_path='' as $$select care_private.commit_treatment_care_packet(p_packet)$$;

create or replace function care_private.confirm_treatment_care_packet(p_tenant uuid,p_client uuid,p_order uuid,p_actor uuid,p_request uuid,p_packet jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare actor uuid;receipt care_private.treatment_care_requests%rowtype;begin actor:=care_private.treatment_care_actor('pflege.treatment.view',p_tenant,p_client,p_order,p_actor);select * into receipt from care_private.treatment_care_requests r where r.tenant_id=p_tenant and r.request_id=p_request;if receipt.request_id is null or receipt.client_id<>p_client or receipt.order_id<>p_order or receipt.actor_id<>actor or receipt.packet<>p_packet then raise exception 'Passende native Behandlungspflegequittung fehlt.' using errcode='P0H02';end if;return jsonb_build_object('requestId',p_request,'packet',receipt.packet,'original',care_private.treatment_care_original(receipt.event_id));end $$;
create or replace function public.web_confirm_treatment_care_packet(p_tenant_id uuid,p_client_id uuid,p_order_id uuid,p_actor_profile_id uuid,p_request_id uuid,p_packet jsonb) returns jsonb language sql security invoker set search_path='' as $$select care_private.confirm_treatment_care_packet(p_tenant_id,p_client_id,p_order_id,p_actor_profile_id,p_request_id,p_packet)$$;

create or replace function care_private.block_treatment_care_mutation() returns trigger language plpgsql security definer set search_path='' as $$begin raise exception 'Behandlungspflegeoriginale und Quittungen sind append-only.' using errcode='42501';end $$;
drop trigger if exists treatment_care_immutable on public.treatment_care_events;create trigger treatment_care_immutable before update or delete on public.treatment_care_events for each row execute function care_private.block_treatment_care_mutation();
drop trigger if exists treatment_care_receipt_immutable on care_private.treatment_care_requests;create trigger treatment_care_receipt_immutable before update or delete on care_private.treatment_care_requests for each row execute function care_private.block_treatment_care_mutation();

revoke all on function care_private.treatment_care_fingerprint(jsonb),care_private.treatment_care_actor(text,uuid,uuid,uuid,uuid),care_private.treatment_care_ref(jsonb,uuid,uuid),care_private.treatment_care_sources(uuid,uuid),care_private.treatment_care_original(uuid),care_private.validate_treatment_care_prepared_packet(jsonb,uuid,jsonb),care_private.read_treatment_care_context(uuid,uuid,uuid),care_private.read_treatment_care_page(uuid,uuid,uuid,timestamptz,uuid,integer),care_private.commit_treatment_care_packet(jsonb),care_private.confirm_treatment_care_packet(uuid,uuid,uuid,uuid,uuid,jsonb),care_private.block_treatment_care_mutation() from public,anon,authenticated;
revoke all on function public.web_read_treatment_care_context(uuid,uuid,uuid),public.web_read_treatment_care_page(uuid,uuid,uuid,timestamptz,uuid,integer),public.web_commit_treatment_care_packet(jsonb),public.web_confirm_treatment_care_packet(uuid,uuid,uuid,uuid,uuid,jsonb) from public,anon;

create schema if not exists care_private;

create table if not exists care_private.treatment_care_review_scopes(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),
 employee_id uuid not null references public.employees(id),qualification_id uuid not null references public.employee_qualifications(id),
 kind text not null check(kind in('order_review','payer_review','injection','insulin','infusion','pump','inhalation','instillation','compression','access_drain','other_hkp','order_revision','measurement_link','completion_review','correction')),
 qualification_fingerprint text not null check(qualification_fingerprint~'^sha256:[0-9a-f]{64}$'),
 document_fingerprint text not null check(document_fingerprint~'^sha256:[0-9a-f]{64}$'),
 approved_by uuid not null references public.profiles(id),approved_at timestamptz not null,valid_until timestamptz not null,revoked_at timestamptz,
 check(valid_until>approved_at)
);
create table if not exists public.treatment_care_review_roots(
 id uuid primary key,tenant_id uuid not null,client_id uuid not null,order_id uuid not null,
 treatment_root_id uuid not null,treatment_head_id uuid not null references public.treatment_care_events(id),
 treatment_fingerprint text not null,treatment_kind text not null,created_at timestamptz not null,
 unique(id,tenant_id,client_id,order_id),unique(tenant_id,client_id,order_id,treatment_head_id)
);
create table if not exists public.treatment_care_review_events(
 id uuid primary key,tenant_id uuid not null,client_id uuid not null,order_id uuid not null,root_id uuid not null,
 revision integer not null check(revision in(1,2)),previous_id uuid,request_id uuid not null unique,
 action text not null check(action in('request','return','accept')),actor_id uuid not null references public.profiles(id),actor_name text not null,
 recorded_at timestamptz not null,reason text not null,required_change text not null,rationale text not null,
 treatment_head_id uuid not null,treatment_fingerprint text not null,qualification_original jsonb,fingerprint text not null,packet jsonb not null,
 unique(root_id,revision),unique(id,root_id),foreign key(root_id,tenant_id,client_id,order_id) references public.treatment_care_review_roots(id,tenant_id,client_id,order_id),
 foreign key(previous_id,root_id) references public.treatment_care_review_events(id,root_id),
 check((revision=1)=(previous_id is null)),check((action='request')=(revision=1)),check((action='request')=(qualification_original is null))
);
create table if not exists public.treatment_care_review_receipts(
 request_id uuid primary key,tenant_id uuid not null,client_id uuid not null,order_id uuid not null,actor_id uuid not null,
 root_id uuid not null,event_id uuid not null,packet jsonb not null,original jsonb not null,recorded_at timestamptz not null,
 foreign key(event_id,root_id) references public.treatment_care_review_events(id,root_id)
);
create index if not exists treatment_care_review_page on public.treatment_care_review_roots(tenant_id,client_id,order_id,created_at desc,id desc);
alter table care_private.treatment_care_review_scopes enable row level security;
alter table public.treatment_care_review_roots enable row level security;
alter table public.treatment_care_review_events enable row level security;
alter table public.treatment_care_review_receipts enable row level security;
revoke all on care_private.treatment_care_review_scopes,public.treatment_care_review_roots,public.treatment_care_review_events,public.treatment_care_review_receipts from public,anon,authenticated;

create or replace function care_private.treatment_care_review_immutable()
returns trigger language plpgsql security invoker set search_path='' as $$begin raise exception 'Behandlungspflegeprüforiginale und Quittungen sind unveränderlich.' using errcode='23514';end$$;
do $$declare tab text;begin foreach tab in array array['treatment_care_review_roots','treatment_care_review_events','treatment_care_review_receipts'] loop execute format('drop trigger if exists treatment_care_review_immutable on public.%I',tab);execute format('create trigger treatment_care_review_immutable before update or delete on public.%I for each row execute function care_private.treatment_care_review_immutable()',tab);end loop;end$$;

create or replace function care_private.treatment_care_review_original(root_ref uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',h.id::text,'tenantId',r.tenant_id::text,'clientId',r.client_id::text,'orderId',r.order_id::text,'rootId',r.id::text,'headId',h.id::text,'revision',h.revision,
 'treatmentRootId',r.treatment_root_id::text,'treatmentHeadId',r.treatment_head_id::text,'treatmentFingerprint',r.treatment_fingerprint,'treatmentKind',r.treatment_kind,
 'status',case h.action when 'request' then 'requested' when 'return' then 'returned' else 'accepted' end,
 'history',(select jsonb_agg(jsonb_build_object('id',e.id::text,'revision',e.revision,'previousId',e.previous_id::text,'requestId',e.request_id::text,
 'action',e.action,'recordedAt',to_char(e.recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'actorId',e.actor_id::text,'actorName',e.actor_name,
 'reason',e.reason,'requiredChange',e.required_change,'rationale',e.rationale,'treatmentHeadId',e.treatment_head_id::text,'treatmentFingerprint',e.treatment_fingerprint,
 'qualification',e.qualification_original,'fingerprint',e.fingerprint) order by e.revision) from public.treatment_care_review_events e where e.root_id=r.id))
 from public.treatment_care_review_roots r join lateral(select e.* from public.treatment_care_review_events e where e.root_id=r.id order by e.revision desc limit 1)h on true where r.id=root_ref
$$;
create or replace function care_private.read_treatment_care_review_page(t uuid,c uuid,o uuid,actor uuid,at_cursor timestamptz,id_cursor uuid,page_size integer)
returns jsonb language plpgsql security definer set search_path='' as $$declare result jsonb;begin
 perform care_private.treatment_care_actor('pflege.treatment.view',t,c,o,actor);
 if page_size is null or page_size<1 or page_size>100 or(at_cursor is null)<>(id_cursor is null) then raise exception 'Ungültige Cursorbindung.' using errcode='22023';end if;
 with page as materialized(select r.* from public.treatment_care_review_roots r where r.tenant_id=t and r.client_id=c and r.order_id=o and(at_cursor is null or(r.created_at,r.id)<(at_cursor,id_cursor)) order by r.created_at desc,r.id desc limit page_size)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(care_private.treatment_care_review_original(p.id) order by p.created_at desc,p.id desc) from page p),'[]'::jsonb),
 'nextCursorRecordedAt',(select to_char(p.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') from page p order by p.created_at,p.id limit 1),
 'nextCursorId',(select p.id::text from page p order by p.created_at,p.id limit 1)) into result;return result;
end$$;

create or replace function care_private.commit_treatment_care_review(p jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t uuid:=(p->>'tenantId')::uuid;c uuid:=(p->>'clientId')::uuid;m uuid:=(p->>'orderId')::uuid;actor uuid:=(p->>'actorId')::uuid;req uuid:=(p->>'requestId')::uuid;action_value text:=p->>'action';
 treatment_root uuid:=(p#>>'{treatmentOriginal,rootId}')::uuid;treatment_head uuid:=(p#>>'{treatmentOriginal,headId}')::uuid;treatment jsonb;latest public.treatment_care_events;
 review_root uuid;event_ref uuid:=gen_random_uuid();prior public.treatment_care_review_events;receipt public.treatment_care_review_receipts;
 now_at timestamptz:=clock_timestamp();today date:=(clock_timestamp() at time zone 'Europe/Berlin')::date;expected integer:=(p->>'expectedRevision')::integer;name text;qualification jsonb:=null;fingerprint text;original jsonb;
begin
 if action_value in('accept','return') then raise exception 'Fachliche Behandlungspflegeentscheidungen bleiben bis zum vollständigen nativen Qualifikations- und Ausführungsnachweis gesperrt.' using errcode='42501';end if;
 perform care_private.treatment_care_actor('pflege.treatment.view',t,c,m,actor);
 if jsonb_typeof(p) is distinct from 'object' or not(p ?& array['schemaVersion','action','requestId','tenantId','clientId','orderId','actorId','expectedHeadId','expectedRevision','treatmentOriginal','reviewOriginal','reason','requiredChange','rationale'])
 or exists(select 1 from jsonb_object_keys(p) k where k not in('schemaVersion','action','requestId','tenantId','clientId','orderId','actorId','expectedHeadId','expectedRevision','treatmentOriginal','reviewOriginal','reason','requiredChange','rationale'))
 or p->>'schemaVersion' is distinct from '1' or action_value not in('request','return','accept') or t is null or c is null or m is null or actor is null or req is null or expected is null
 or jsonb_typeof(p->'reason') is distinct from 'string' or jsonb_typeof(p->'requiredChange') is distinct from 'string' or jsonb_typeof(p->'rationale') is distinct from 'string'
 or length(p->>'reason')>2000 or length(p->>'requiredChange')>4000 or length(p->>'rationale')>4000 then raise exception 'Behandlungspflegeprüfpaket ist unvollständig.' using errcode='23514';end if;
 perform pg_advisory_xact_lock(hashtextextended(t::text||':'||c::text||':'||m::text,0));
 select * into receipt from public.treatment_care_review_receipts r where r.request_id=req for update;
 if found then if receipt.tenant_id<>t or receipt.client_id<>c or receipt.order_id<>m or receipt.actor_id<>actor or receipt.packet<>p then raise exception 'Anfragekennung ist anders gebunden.' using errcode='40001';end if;return jsonb_build_object('requestId',req::text,'packet',p,'original',receipt.original);end if;
 select * into latest from public.treatment_care_events e where e.tenant_id=t and e.client_id=c and e.order_id=m and e.root_id=treatment_root order by e.revision desc limit 1 for update;
 if not found or latest.id<>treatment_head then raise exception 'Aktuelle unveränderte Behandlungspflegefassung fehlt.' using errcode='40001';end if;
 treatment:=care_private.treatment_care_original(treatment_head);
 if treatment is distinct from p->'treatmentOriginal' or treatment->>'contentFingerprint' is distinct from latest.content_fingerprint or treatment->>'voided' is distinct from 'false' or treatment#>>'{payload,lifecycle}' is distinct from 'completed' then raise exception 'Unverändertes abgeschlossenes Behandlungspflegeoriginal fehlt.' using errcode='40001';end if;
 if treatment->>'kind' in('injection','insulin','infusion','pump','inhalation','instillation','compression','access_drain','other_hkp') and treatment#>>'{payload,execution,outcome}' not in('performed','partial','omitted','refused','failed') then raise exception 'Planung oder Auswahl belegt kein tatsächliches Behandlungspflegeereignis.' using errcode='23514';end if;
 perform care_private.treatment_care_actor(case when action_value='request' then case when treatment->>'kind' in('order_review','payer_review','order_revision','completion_review','correction') then 'pflege.orders.manage' else 'pflege.treatment.manage' end else 'pflege.documentation.sign' end,t,c,m,actor);
 select coalesce(pr.display_name,pr.email) into name from public.profiles pr where pr.id=actor and pr.tenant_id=t and pr.is_active=true;if btrim(coalesce(name,''))='' then raise exception 'Aktiver Akteur fehlt.' using errcode='42501';end if;
 perform care_private.require_workspace_session(t,actor);now_at:=clock_timestamp();today:=(now_at at time zone 'Europe/Berlin')::date;
 if action_value='request' then
  if expected<>0 or p->'expectedHeadId' is distinct from 'null'::jsonb or p->'reviewOriginal' is distinct from 'null'::jsonb or length(btrim(p->>'reason'))<10 or p->>'requiredChange'<>'' or p->>'rationale'<>'' then raise exception 'Prüfanfrage darf keine Entscheidung enthalten.' using errcode='23514';end if;
  review_root:=event_ref;insert into public.treatment_care_review_roots(id,tenant_id,client_id,order_id,treatment_root_id,treatment_head_id,treatment_fingerprint,treatment_kind,created_at) values(review_root,t,c,m,treatment_root,treatment_head,treatment->>'contentFingerprint',treatment->>'kind',now_at);
 else
  review_root:=(p#>>'{reviewOriginal,rootId}')::uuid;
  perform 1 from public.treatment_care_review_roots r where r.id=review_root and r.tenant_id=t and r.client_id=c and r.order_id=m and r.treatment_root_id=treatment_root and r.treatment_head_id=treatment_head for update;if not found then raise exception 'Passende Behandlungspflegeprüfanfrage fehlt.' using errcode='40001';end if;
  select * into prior from public.treatment_care_review_events e where e.root_id=review_root order by e.revision desc limit 1 for update;
  if not found or expected<>1 or prior.revision<>expected or prior.action<>'request' or prior.id::text is distinct from p->>'expectedHeadId' or care_private.treatment_care_review_original(review_root) is distinct from p->'reviewOriginal' then raise exception 'Behandlungspflegeprüfanfrage hat sich geändert.' using errcode='40001';end if;
  if actor=prior.actor_id or exists(select 1 from jsonb_array_elements(treatment->'history') h where h->>'recordedBy'=actor::text or actor::text in(h#>>'{payload,qualification,performedBy}',h#>>'{payload,qualification,reviewedBy}',h#>>'{payload,followUp,responsibleBy}',h#>>'{payload,correction,approvedBy}')) then raise exception 'Anfragende, dokumentierende, ausführende, kontrollierende oder freigebende Person darf nicht selbst entscheiden.' using errcode='42501';end if;
  lock table public.employees,public.employee_employment_details,public.employee_qualifications,public.employee_documents,care_private.treatment_care_review_scopes in share mode;
  select jsonb_build_object('id',q.id::text,'employeeId',e.id::text,'profileId',e.profile_id::text,'qualificationType',q.qualification_type,'title',q.title,'status',q.status,
   'issuedAt',to_char(q.issued_at,'YYYY-MM-DD'),'validUntil',to_char(q.valid_until,'YYYY-MM-DD'),'verifiedAt',to_char(q.verified_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'updatedAt',to_char(q.updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
   'documentId',d.id::text,'documentFingerprint',scope.document_fingerprint,'sourceFingerprint',scope.qualification_fingerprint,'employmentStart',to_char(coalesce(e.entry_date,e.start_date),'YYYY-MM-DD'),'employmentEnd',to_char(e.exit_date,'YYYY-MM-DD'),
   'employeeFingerprint','sha256:'||encode(extensions.digest(convert_to(jsonb_build_object('employee',to_jsonb(e),'employment',to_jsonb(ed))::text,'UTF8'),'sha256'),'hex'),
   'scopeId',scope.id::text,'scopeKind',scope.kind,'scopeFingerprint','sha256:'||encode(extensions.digest(convert_to(to_jsonb(scope)::text,'UTF8'),'sha256'),'hex')) into qualification
  from public.employees e join public.employee_employment_details ed on ed.employee_id=e.id and ed.tenant_id=e.tenant_id join public.employee_qualifications q on q.employee_id=e.id and q.tenant_id=e.tenant_id join public.employee_documents d on d.id=q.document_id and d.employee_id=e.id and d.tenant_id=e.tenant_id
  join care_private.treatment_care_review_scopes scope on scope.employee_id=e.id and scope.qualification_id=q.id and scope.tenant_id=e.tenant_id and scope.kind=treatment->>'kind'
  where e.tenant_id=t and e.profile_id=actor and e.status='aktiv' and ed.employment_status='active' and coalesce(e.entry_date,e.start_date)<=today and(e.entry_date is null or e.entry_date<=today) and(e.start_date is null or e.start_date<=today) and(e.exit_date is null or e.exit_date>=today)
   and q.status in('valid','expires_soon') and q.verified_at<=now_at and q.updated_at<=now_at and(q.issued_at is null or q.issued_at<=today) and(q.valid_until is null or q.valid_until>=today) and(d.valid_until is null or d.valid_until>=today) and btrim(coalesce(d.storage_path,''))<>''
   and scope.approved_at<=now_at and scope.valid_until>now_at and scope.revoked_at is null and scope.qualification_fingerprint='sha256:'||encode(extensions.digest(convert_to(to_jsonb(q)::text,'UTF8'),'sha256'),'hex') and scope.document_fingerprint='sha256:'||encode(extensions.digest(convert_to(to_jsonb(d)::text,'UTF8'),'sha256'),'hex')
  order by scope.approved_at desc,scope.id desc limit 1;
  if qualification is null then raise exception 'Aktuelle Beschäftigung, Qualifikation, Dokument und Behandlungspflegeprüfbereich fehlen.' using errcode='42501';end if;
  if action_value='return' then if length(btrim(p->>'reason'))<10 or length(btrim(p->>'requiredChange'))<10 or p->>'rationale'<>'' then raise exception 'Rückgabe benötigt Grund und konkrete Änderung.' using errcode='23514';end if;
  else if treatment#>'{payload,material}' is null or treatment#>>'{payload,order,status}'<>'active' or treatment#>>'{payload,payer,state}'='unknown' or treatment#>>'{payload,qualification,state}'='unconfirmed' or treatment#>>'{payload,followUp,state}' in('pending','scheduled') or treatment->>'kind' in('injection','insulin','infusion','pump','inhalation','instillation','compression','access_drain','other_hkp') and treatment#>>'{payload,material,state}'='selected' or p->>'reason'<>'' or p->>'requiredChange'<>'' or length(btrim(p->>'rationale'))<10 then raise exception 'Aktive Verordnung, Finanzierung, Qualifikation, Materialentscheidung, Folgeabschluss oder fachliche Begründung fehlt.' using errcode='23514';end if;end if;
 end if;
 fingerprint:='sha256:'||encode(extensions.digest(convert_to(jsonb_build_object('packet',p,'qualification',qualification)::text,'UTF8'),'sha256'),'hex');
 insert into public.treatment_care_review_events(id,tenant_id,client_id,order_id,root_id,revision,previous_id,request_id,action,actor_id,actor_name,recorded_at,reason,required_change,rationale,treatment_head_id,treatment_fingerprint,qualification_original,fingerprint,packet)
 values(event_ref,t,c,m,review_root,expected+1,case when expected=0 then null else prior.id end,req,action_value,actor,name,now_at,p->>'reason',p->>'requiredChange',p->>'rationale',treatment_head,treatment->>'contentFingerprint',qualification,fingerprint,p);
 original:=care_private.treatment_care_review_original(review_root);insert into public.treatment_care_review_receipts(request_id,tenant_id,client_id,order_id,actor_id,root_id,event_id,packet,original,recorded_at) values(req,t,c,m,actor,review_root,event_ref,p,original,now_at);
 return jsonb_build_object('requestId',req::text,'packet',p,'original',original);
end$$;
create or replace function care_private.confirm_treatment_care_review(t uuid,c uuid,m uuid,actor uuid,req uuid,p jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$declare r public.treatment_care_review_receipts;begin perform care_private.treatment_care_actor('pflege.treatment.view',t,c,m,actor);select * into r from public.treatment_care_review_receipts x where x.request_id=req and x.tenant_id=t and x.client_id=c and x.order_id=m and x.actor_id=actor;if not found or r.packet is distinct from p then raise exception 'Keine passende unveränderliche Behandlungspflegeprüfquittung.' using errcode='P0H03';end if;return jsonb_build_object('requestId',req::text,'packet',r.packet,'original',r.original);end$$;
create or replace function public.web_read_treatment_care_review_page(p_tenant_id uuid,p_client_id uuid,p_order_id uuid,p_actor_profile_id uuid,p_cursor_recorded_at timestamptz,p_cursor_id uuid,p_page_size integer)returns jsonb language sql security invoker set search_path='' as $$select care_private.read_treatment_care_review_page(p_tenant_id,p_client_id,p_order_id,p_actor_profile_id,p_cursor_recorded_at,p_cursor_id,p_page_size)$$;
create or replace function public.web_commit_treatment_care_review(p_packet jsonb)returns jsonb language sql security invoker set search_path='' as $$select care_private.commit_treatment_care_review(p_packet)$$;
create or replace function public.web_confirm_treatment_care_review(p_tenant_id uuid,p_client_id uuid,p_order_id uuid,p_actor_profile_id uuid,p_request_id uuid,p_packet jsonb)returns jsonb language sql security invoker set search_path='' as $$select care_private.confirm_treatment_care_review(p_tenant_id,p_client_id,p_order_id,p_actor_profile_id,p_request_id,p_packet)$$;
revoke all on function care_private.treatment_care_review_immutable(),care_private.treatment_care_review_original(uuid),care_private.read_treatment_care_review_page(uuid,uuid,uuid,uuid,timestamptz,uuid,integer),care_private.commit_treatment_care_review(jsonb),care_private.confirm_treatment_care_review(uuid,uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.web_read_treatment_care_review_page(uuid,uuid,uuid,uuid,timestamptz,uuid,integer),public.web_commit_treatment_care_review(jsonb),public.web_confirm_treatment_care_review(uuid,uuid,uuid,uuid,uuid,jsonb) from public,anon;

-- Shared session helper checks exact Auth user/profile/tenant/session ownership.
-- This family checks only the current profile's own role; no linked role grants.
create or replace function care_private.treatment_care_actor(permission_name text,p_tenant uuid,p_client uuid,p_order uuid,p_actor uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare own_role uuid;required text;
begin
 perform care_private.require_workspace_session(p_tenant,p_actor);
 perform 1 from public.clients c where c.id=p_client and c.tenant_id=p_tenant and c.status::text in('active','aktiv') and c.lifecycle_status::text in('active','aktiv') for share;
 if not found then raise exception 'Aktive eigene Pflegeakte fehlt.' using errcode='42501';end if;
 perform 1 from public.client_module_assignments a where a.tenant_id=p_tenant and a.client_id=p_client and a.module_key='pflege' and a.is_active and a.status in('active','aktiv') for share;
 if not found then raise exception 'Aktive eigene Pflegezuordnung fehlt.' using errcode='42501';end if;
 select p.role_id into own_role from public.profiles p where p.id=p_actor and p.tenant_id=p_tenant and p.is_active and p.status='active' for share;
 perform 1 from public.role_permissions rp where rp.role_id=own_role for share;
 foreach required in array array['pflege.treatment.view','pflege.orders.view',permission_name] loop
  if not exists(select 1 from public.role_permissions rp where rp.role_id=own_role and rp.permission_key=required) then raise exception 'Aktuelles eigenes Behandlungsrecht fehlt.' using errcode='42501';end if;
 end loop;
 perform 1 from public.care_medical_orders o where o.id=p_order and o.tenant_id=p_tenant and o.client_id=p_client for share;
 if not found then raise exception 'Eigene ursprüngliche Behandlungsverordnung fehlt.' using errcode='42501';end if;
 return p_actor;
end$$;

-- A retained receipt is historical. Later corrections must not rewrite its history.
alter table care_private.treatment_care_requests add column if not exists original jsonb;

create or replace function care_private.validate_treatment_care_packet(p jsonb,p_actor uuid,p_sources jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare e jsonb:=p->'entry';o jsonb;native_order jsonb;expected_payer jsonb;
begin
 perform care_private.med_packet_require(care_private.med_packet_keys(p,array['schemaVersion','action','requestId','tenantId','clientId','orderId','actorId','expectedHeadId','expectedRevision','entry','reason','original','sources']) and p->'schemaVersion'='"1"'::jsonb and p->>'action' in('create','revise') and p->>'actorId'=p_actor::text,'Vollständige eigene Behandlungspflegeanfrage fehlt.');
 perform care_private.med_packet_require(care_private.med_packet_uuid(p->'requestId') and care_private.med_packet_uuid(p->'tenantId') and care_private.med_packet_uuid(p->'clientId') and care_private.med_packet_uuid(p->'orderId') and jsonb_typeof(p->'expectedRevision')='number' and p->>'expectedRevision' ~ '^(0|[1-9][0-9]{0,3})$' and (p->>'expectedRevision')::integer<2000 and p->'sources' is not distinct from p_sources,'Kennungen, Revision oder vollständiger Quellenstand stimmen nicht.');
 if not coalesce(e->>'kind' in('order_review','payer_review'),false) or e->>'lifecycle' is distinct from 'open' then raise exception 'Klinische Durchführung, Freigabe, Verordnungsänderung und Abschluss bleiben gesperrt; native Qualifikations-, Material- und Ausführungsabnahme fehlt.' using errcode='42501';end if;
 perform care_private.med_packet_require(care_private.med_packet_keys(e,array['kind','title','plannedAt','occurredAt','clientId','orderId','orderVersion','order','payer','execution','material','qualification','measurement','infusion','followUp','correction','lifecycle']) and care_private.med_packet_text(e->'title',3,300) and e->'occurredAt'='null'::jsonb and e->'clientId'=p->'clientId' and e->'orderId'=p->'orderId','Der offene technische Prüfvorgang ist unvollständig.');
 perform care_private.med_packet_time(e->'plannedAt');
 select value into o from jsonb_array_elements(p_sources->'orders') where value->'id'=p->'orderId';
 perform care_private.med_packet_require(o is not null and o->'recordedAt'=e->'orderVersion','Die genaue native Verordnungsfassung fehlt.');native_order:=o->'payload';
 perform care_private.med_packet_require(native_order->>'status' in('draft','active','paused','stopped','expired') and care_private.med_packet_text(native_order->'ordering_physician',1,8000) and care_private.med_packet_text(native_order->'title',3,8000) and care_private.med_packet_text(native_order->'execution_instructions',3,8000),'Native Verordnungsangaben sind unvollständig und werden nicht ergänzt.');
 perform care_private.med_packet_require(e->'order'=jsonb_build_object('status',native_order->'status','validFrom',native_order->'valid_from','validUntil',native_order->'valid_until','prescriber',native_order->'ordering_physician','scope',native_order->'title','instructions',native_order->'execution_instructions','revisionReason','','previousOrderId',null),'Status, Gültigkeit, verordnende Person, Umfang oder Originalanweisung wurde verändert.');
 perform care_private.med_packet_require(care_private.med_packet_text(e#>'{payer,decisionNote}',3,8000) and native_order->>'insurer_approval_status' in('not_required','pending','approved','partially_approved','rejected','unknown'),'Die eigene getrennte Kostenträgerdarstellung ist unvollständig.');
 expected_payer:=jsonb_build_object('state',native_order->'insurer_approval_status','approvalId',case when native_order->>'insurer_approval_status'='approved' then p->'orderId' else 'null'::jsonb end,'reference',native_order->'insurer_approval_reference','validFrom',case when native_order->>'insurer_approval_status'='approved' then native_order->'valid_from' else 'null'::jsonb end,'validUntil',case when native_order->>'insurer_approval_status'='approved' then native_order->'valid_until' else 'null'::jsonb end,'decisionNote',e#>'{payer,decisionNote}');
 perform care_private.med_packet_require(e->'payer'=expected_payer,'Die Kostenträgerdarstellung darf keine neue native Entscheidung ableiten.');
 perform care_private.med_packet_require(e->'execution'='{"treatmentType":"none","outcome":"planned","action":"","substance":"","amount":null,"unit":"","route":"","site":"","device":"","observation":"","deviation":""}'::jsonb,'Ein technischer Prüfvorgang darf keine Behandlung oder Dosis dokumentieren.');
 perform care_private.med_packet_require(care_private.med_packet_text(e#>'{material,reason}',3,8000) and e->'material'=jsonb_build_object('state','not_required','originalId',null,'name','','batch','','expiresOn',null,'quantity',null,'unit','','purpose','','reason',e#>'{material,reason}'),'Materialverbrauch ist in diesem technischen Vorgang nicht freigegeben.');
 perform care_private.med_packet_require(e->'qualification'='{"state":"unconfirmed","performedBy":null,"reviewedBy":null,"evidence":"","delegation":""}'::jsonb,'Technische Prüfdaten dürfen keine Qualifikation oder Delegation bestätigen.');
 perform care_private.med_packet_require(care_private.med_packet_text(e#>'{measurement,reason}',3,8000) and e->'measurement'=jsonb_build_object('state','not_required','measurementId',null,'kind','','value','','unit','','occurredAt',null,'maximumAgeMinutes',null,'reason',e#>'{measurement,reason}'),'Ein Messwert darf nicht aus einem technischen Prüfvorgang abgeleitet werden.');
 perform care_private.med_packet_require(e->'infusion'='{"state":"not_applicable","courseId":null,"headId":null,"sequence":null,"deviceMode":"none","rateMlHour":null,"deliveredMl":null,"remainingMl":null,"sourceNote":""}'::jsonb,'Infusions- oder Pumpendurchführung bleibt gesperrt.');
 perform care_private.med_packet_require(care_private.med_packet_text(e#>'{followUp,communication}',3,8000) and care_private.med_packet_text(e#>'{followUp,personDecision}',3,8000) and e->'followUp'=jsonb_build_object('state','pending','scheduledAt',null,'completedAt',null,'responsibleBy',null,'communication',e#>'{followUp,communication}','personDecision',e#>'{followUp,personDecision}','result',''),'Folgehandlung und tatsächlicher Abschluss bleiben ausdrücklich offen.');
 perform care_private.med_packet_require(e->'correction'='{"targetId":null,"reason":"","replacementId":null,"approvedBy":null,"approvedAt":null}'::jsonb,'Klinische Korrektur oder Freigabe bleibt gesperrt.');
 if p->>'action'='create' then perform care_private.med_packet_require(p->'expectedRevision'='0'::jsonb and p->'expectedHeadId'='null'::jsonb and p->'original'='null'::jsonb and p->'reason'='""'::jsonb,'Neuanlage enthält fremde Originalangaben.');
 else perform care_private.med_packet_require(care_private.med_packet_text(p->'reason',10,2000) and e is distinct from p#>'{original,payload}','Fortschreibung benötigt einen konkreten Grund und tatsächliche Änderung.');end if;
end$$;

create or replace function care_private.commit_treatment_care_packet(p_packet jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare tenant_value uuid:=(p_packet->>'tenantId')::uuid;client_value uuid:=(p_packet->>'clientId')::uuid;order_value uuid:=(p_packet->>'orderId')::uuid;actor_value uuid:=(p_packet->>'actorId')::uuid;request_value uuid:=(p_packet->>'requestId')::uuid;actor uuid;sources jsonb;receipt care_private.treatment_care_requests%rowtype;head public.treatment_care_events%rowtype;new_id uuid:=gen_random_uuid();root_value uuid;next_revision integer;actor_name text;original_value jsonb;
begin
 actor:=care_private.treatment_care_actor('pflege.orders.manage',tenant_value,client_value,order_value,actor_value);
 perform pg_advisory_xact_lock(hashtextextended('treatment-care-request:'||tenant_value||':'||request_value,0));
 perform pg_advisory_xact_lock(hashtextextended('treatment-care:'||tenant_value||':'||client_value||':'||order_value,0));
 perform care_private.treatment_care_actor('pflege.orders.manage',tenant_value,client_value,order_value,actor_value);
 select * into receipt from care_private.treatment_care_requests r where r.tenant_id=tenant_value and r.request_id=request_value for share;
 if receipt.request_id is not null then
  perform care_private.med_packet_require(receipt.actor_id=actor and receipt.client_id=client_value and receipt.order_id=order_value and receipt.packet is not distinct from p_packet and receipt.original is not null,'Anfragekennung oder historischer eigener Beleg wurde verändert.');
  return jsonb_build_object('requestId',request_value,'packet',receipt.packet,'original',receipt.original);
 end if;
 lock table public.care_medical_orders,public.clinical_treatment_executions,public.care_infusion_events,public.vital_sign_measurements,public.vital_measurement_invalidations,public.clinical_treatment_corrections,public.profiles in share mode;
 sources:=care_private.treatment_care_sources(tenant_value,client_value);perform care_private.validate_treatment_care_packet(p_packet,actor,sources);
 if p_packet->>'action'='revise' then
  select * into head from public.treatment_care_events e where e.id=(p_packet->>'expectedHeadId')::uuid and e.tenant_id=tenant_value and e.client_id=client_value and e.order_id=order_value for share;
  perform care_private.med_packet_require(head.id is not null and head.revision=(p_packet->>'expectedRevision')::integer and not exists(select 1 from public.treatment_care_events n where n.tenant_id=tenant_value and n.root_id=head.root_id and n.previous_id=head.id) and care_private.treatment_care_original(head.id) is not distinct from p_packet->'original','Vollständiges Behandlungsoriginal oder CAS wurde geändert.');
  perform care_private.med_packet_require(head.kind=p_packet#>>'{entry,kind}','Die technische Vorgangsart darf durch eine Fortschreibung nicht wechseln.');root_value:=head.root_id;next_revision:=head.revision+1;
 else root_value:=new_id;next_revision:=1;end if;
 select nullif(p.display_name,'') into actor_name from public.profiles p where p.id=actor and p.tenant_id=tenant_value;
 if actor_name is null then raise exception 'Der ursprüngliche Akteurname fehlt und wird nicht ergänzt.' using errcode='42501';end if;
 perform care_private.require_workspace_session(tenant_value,actor);
 insert into public.treatment_care_events(id,tenant_id,client_id,order_id,root_id,previous_id,revision,kind,payload,source_snapshot,reason,content_fingerprint,recorded_by,recorded_by_name)
 values(new_id,tenant_value,client_value,order_value,root_value,head.id,next_revision,p_packet#>>'{entry,kind}',p_packet->'entry',sources,case when next_revision=1 then '' else p_packet->>'reason' end,care_private.treatment_care_fingerprint(p_packet->'entry'),actor,actor_name);
 original_value:=care_private.treatment_care_original(new_id);
 insert into care_private.treatment_care_requests(tenant_id,client_id,order_id,actor_id,request_id,packet,event_id,original) values(tenant_value,client_value,order_value,actor,request_value,p_packet,new_id,original_value);
 return jsonb_build_object('requestId',request_value,'packet',p_packet,'original',original_value);
end$$;

create or replace function care_private.confirm_treatment_care_packet(p_tenant uuid,p_client uuid,p_order uuid,p_actor uuid,p_request uuid,p_packet jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare receipt care_private.treatment_care_requests%rowtype;
begin
 perform care_private.treatment_care_actor('pflege.treatment.view',p_tenant,p_client,p_order,p_actor);
 select * into receipt from care_private.treatment_care_requests r where r.tenant_id=p_tenant and r.request_id=p_request and r.client_id=p_client and r.order_id=p_order and r.actor_id=p_actor for share;
 if receipt.request_id is null or receipt.packet is distinct from p_packet or receipt.original is null then raise exception 'Passender unveränderlicher eigener Originalbeleg fehlt.' using errcode='P0H02';end if;
 return jsonb_build_object('requestId',p_request,'packet',receipt.packet,'original',receipt.original);
end$$;

create or replace function care_private.treatment_care_state_fingerprint(p_tenant uuid,p_client uuid)
returns text language plpgsql security definer set search_path='' as $$
declare first_order uuid;actor uuid:=public.resolve_current_profile_id();events jsonb;reviews jsonb;
begin
 select o.id into first_order from public.care_medical_orders o where o.tenant_id=p_tenant and o.client_id=p_client order by o.id limit 1;
 perform care_private.treatment_care_actor('pflege.treatment.view',p_tenant,p_client,first_order,actor);
 select coalesce(jsonb_agg(to_jsonb(e) order by e.recorded_at,e.id),'[]'::jsonb) into events from public.treatment_care_events e where e.tenant_id=p_tenant and e.client_id=p_client;
 select coalesce(jsonb_agg(to_jsonb(e) order by e.recorded_at,e.id),'[]'::jsonb) into reviews from public.treatment_care_review_events e where e.tenant_id=p_tenant and e.client_id=p_client;
 return care_private.treatment_care_fingerprint(jsonb_build_object('sources',care_private.treatment_care_sources(p_tenant,p_client),'events',events,'reviews',reviews));
end$$;

create or replace function care_private.read_treatment_care_page(p_tenant uuid,p_client uuid,p_actor uuid,p_cursor timestamptz,p_cursor_id uuid,p_size integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare first_order uuid;rows_value jsonb;next_at timestamptz;next_id uuid;before_state text;after_state text;
begin
 select o.id into first_order from public.care_medical_orders o where o.tenant_id=p_tenant and o.client_id=p_client order by o.id limit 1;
 perform care_private.treatment_care_actor('pflege.treatment.view',p_tenant,p_client,first_order,p_actor);
 perform care_private.med_packet_require(p_size between 1 and 100 and (p_cursor is null)=(p_cursor_id is null) and (p_cursor is null or isfinite(p_cursor)),'Ungültige vollständige Behandlungspflegeseite.');
 before_state:=care_private.treatment_care_state_fingerprint(p_tenant,p_client);
 if p_cursor_id is not null and not exists(select 1 from public.treatment_care_events e where e.id=p_cursor_id and e.tenant_id=p_tenant and e.client_id=p_client and e.recorded_at=p_cursor and not exists(select 1 from public.treatment_care_events n where n.tenant_id=p_tenant and n.root_id=e.root_id and n.previous_id=e.id)) then raise exception 'Der Cursor gehört nicht zu einem aktuellen Original dieser Pflegeakte.' using errcode='23514';end if;
 with heads as(select distinct on(e.root_id)e.* from public.treatment_care_events e where e.tenant_id=p_tenant and e.client_id=p_client order by e.root_id,e.revision desc),page as(select * from heads h where p_cursor is null or (h.recorded_at,h.id)<(p_cursor,p_cursor_id) order by h.recorded_at desc,h.id desc limit p_size)
 select coalesce(jsonb_agg(care_private.treatment_care_original(x.id) order by x.recorded_at desc,x.id desc),'[]'::jsonb),(array_agg(x.recorded_at order by x.recorded_at,x.id))[1],(array_agg(x.id order by x.recorded_at,x.id))[1] into rows_value,next_at,next_id from page x;
 after_state:=care_private.treatment_care_state_fingerprint(p_tenant,p_client);
 perform care_private.med_packet_require(before_state=after_state,'Behandlungsoriginale oder vollständige native Quellen wurden während der Seitenabfrage geändert.');
 return jsonb_build_object('rows',rows_value,'nextCursorRecordedAt',case when next_at is null then null else to_char(next_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') end,'nextCursorId',next_id,'stateFingerprint',after_state);
end$$;

create or replace function care_private.read_treatment_care_review_page(t uuid,c uuid,o uuid,actor uuid,at_cursor timestamptz,id_cursor uuid,page_size integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result_value jsonb;before_state text;after_state text;
begin
 perform care_private.treatment_care_actor('pflege.treatment.view',t,c,o,actor);
 perform care_private.med_packet_require(page_size between 1 and 100 and (at_cursor is null)=(id_cursor is null) and (at_cursor is null or isfinite(at_cursor)),'Ungültige vollständige Behandlungspflegeprüfseite.');
 if id_cursor is not null and not exists(select 1 from public.treatment_care_review_roots r where r.id=id_cursor and r.tenant_id=t and r.client_id=c and r.order_id=o and r.created_at=at_cursor) then raise exception 'Der Prüfcursor gehört nicht zur eigenen Verordnung.' using errcode='23514';end if;
 before_state:=care_private.treatment_care_state_fingerprint(t,c);
 with page as materialized(select r.* from public.treatment_care_review_roots r where r.tenant_id=t and r.client_id=c and r.order_id=o and(at_cursor is null or(r.created_at,r.id)<(at_cursor,id_cursor)) order by r.created_at desc,r.id desc limit page_size)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(care_private.treatment_care_review_original(p.id) order by p.created_at desc,p.id desc) from page p),'[]'::jsonb),'nextCursorRecordedAt',(select to_char(p.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') from page p order by p.created_at,p.id limit 1),'nextCursorId',(select p.id::text from page p order by p.created_at,p.id limit 1)) into result_value;
 after_state:=care_private.treatment_care_state_fingerprint(t,c);perform care_private.med_packet_require(before_state=after_state,'Der vollständige Behandlungsprüfstand wurde während der Seitenabfrage geändert.');
 return result_value||jsonb_build_object('stateFingerprint',after_state);
end$$;

-- Quarantine every new family function and table, including service-role callers.
revoke all on public.treatment_care_events,care_private.treatment_care_requests,care_private.treatment_care_review_scopes,public.treatment_care_review_roots,public.treatment_care_review_events,public.treatment_care_review_receipts from public,anon,authenticated,service_role;
do $$declare entry record;begin
 for entry in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','care_private') and p.proname in('block_treatment_care_mutation','commit_treatment_care_packet','commit_treatment_care_review','confirm_treatment_care_packet','confirm_treatment_care_review','read_treatment_care_context','read_treatment_care_page','read_treatment_care_review_page','treatment_care_actor','treatment_care_fingerprint','treatment_care_original','treatment_care_ref','treatment_care_review_immutable','treatment_care_review_original','treatment_care_sources','treatment_care_state_fingerprint','validate_treatment_care_packet','validate_treatment_care_prepared_packet','web_commit_treatment_care_packet','web_commit_treatment_care_review','web_confirm_treatment_care_packet','web_confirm_treatment_care_review','web_read_treatment_care_context','web_read_treatment_care_page','web_read_treatment_care_review_page') loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',entry.oid::regprocedure);
 end loop;
end$$;
