-- LOCAL REVIEW ONLY. Requires clinical core, ambulatory medication/vital documentation and invalidations.
-- Does not authorize treatment, calculate doses, issue prescriptions or book medication/stock/billing.
begin;
create table if not exists public.structured_treatment_source_links(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),client_id uuid not null references public.clients(id),
 execution_id uuid not null unique references public.clinical_treatment_executions(id),profile_version text not null,
 medical_order_id uuid references public.care_medical_orders(id),order_snapshot jsonb,
 administration_id uuid references public.medication_administrations(id),administration_snapshot jsonb,
 measurement_id uuid references public.vital_sign_measurements(id),measurement_snapshot jsonb,
 recorded_by uuid not null references public.profiles(id),created_at timestamptz not null default clock_timestamp(),
 check((medical_order_id is null)=(order_snapshot is null)),check((administration_id is null)=(administration_snapshot is null)),check((measurement_id is null)=(measurement_snapshot is null))
);
alter table public.structured_treatment_source_links enable row level security;
revoke all on public.structured_treatment_source_links from public,anon,authenticated;
grant select on public.structured_treatment_source_links to authenticated;
create index if not exists structured_treatment_source_history on public.structured_treatment_source_links(tenant_id,client_id,created_at desc,id desc);
drop policy if exists structured_treatment_sources_read on public.structured_treatment_source_links;
create policy structured_treatment_sources_read on public.structured_treatment_source_links for select to authenticated using(
 auth.uid() is not null and tenant_id=public.current_tenant_id() and public.has_permission('pflege.treatment.view') and public.has_permission('pflege.orders.view') and public.is_active_pfleger_client(client_id)
 and (administration_id is null or public.has_permission('pflege.medications.view')) and (measurement_id is null or public.has_permission('pflege.vitals.view'))
 and (medical_order_id is null or (order_snapshot->>'id'=medical_order_id::text and order_snapshot->>'tenant_id'=tenant_id::text and order_snapshot->>'client_id'=client_id::text))
 and (administration_id is null or (administration_snapshot->>'id'=administration_id::text and administration_snapshot->>'tenant_id'=tenant_id::text and administration_snapshot->>'client_id'=client_id::text))
 and (measurement_id is null or (measurement_snapshot->>'id'=measurement_id::text and measurement_snapshot->>'tenant_id'=tenant_id::text and measurement_snapshot->>'client_id'=client_id::text))
 and exists(select 1 from public.profiles p where p.id=public.resolve_current_profile_id() and p.tenant_id=structured_treatment_source_links.tenant_id and p.is_active)
 and exists(select 1 from public.clinical_treatment_executions e where e.id=structured_treatment_source_links.execution_id and e.tenant_id=structured_treatment_source_links.tenant_id and e.client_id=structured_treatment_source_links.client_id)
);
create table if not exists care_private.structured_treatment_requests(tenant_id uuid not null,request_id uuid not null,actor_id uuid not null,payload jsonb not null,result_id uuid not null,created_at timestamptz not null default clock_timestamp(),primary key(tenant_id,request_id));
alter table care_private.structured_treatment_requests enable row level security;
revoke all on care_private.structured_treatment_requests from public,anon,authenticated;
create or replace function care_private.write_structured_treatment(request_id uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare tenant uuid:=public.current_tenant_id();actor uuid:=public.resolve_current_profile_id();actor_name text;subject uuid;at_time timestamptz;event_day date;actual boolean;drug boolean;profile text;fields text[];field text;d jsonb;core_details jsonb;
 o public.care_medical_orders%rowtype;a public.medication_administrations%rowtype;m public.vital_sign_measurements%rowtype;receipt care_private.structured_treatment_requests%rowtype;result_id uuid;
 keys text[]:=array['clientId','profileVersion','treatmentType','title','occurredAt','outcome','orderState','orderId','expectedOrderJson','orderRelation','basisReason','qualificationState','qualificationBasis','detailsJson','observation','deviation','communication','personDecision','reviewState','nextReviewAt','reviewReason','medicationState','administrationId','expectedAdministrationJson','medicationReason','measurementState','measurementId','expectedMeasurementJson','measurementReason','measurementMaxAgeMinutes'];
begin
 if auth.uid() is null or tenant is null or actor is null or public.has_permission('pflege.treatment.view') is not true or public.has_permission('pflege.treatment.manage') is not true or public.has_permission('pflege.orders.view') is not true
 or not exists(select 1 from public.profiles p where p.id=actor and p.tenant_id=tenant and p.is_active) then raise exception 'Keine Berechtigung oder kein aktives Profil.' using errcode='42501';end if;
 if request_id is null or jsonb_typeof(payload) is distinct from 'object' or (payload-keys)<>'{}'::jsonb or length(payload::text)>600000 then raise exception 'Ungültige Anfrage.' using errcode='23514';end if;
 foreach field in array keys loop if jsonb_typeof(payload->field) is distinct from 'string' or length(payload->>field)>case when field like 'expected%' then 180000 when field='detailsJson' then 20000 else 2000 end then raise exception 'Angaben fehlen oder zu umfangreich.' using errcode='23514';end if;end loop;
 subject:=(payload->>'clientId')::uuid;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(tenant::text||':structured-treatment:'||request_id::text,0));
 perform 1 from public.clients c where c.id=subject and c.tenant_id=tenant and c.deleted_at is null for no key update;
 if not found or public.is_active_pfleger_client(subject) is not true then raise exception 'Kein aktiver Pflegefall.' using errcode='42501';end if;
 if payload->>'administrationId'<>'' and public.has_permission('pflege.medications.view') is not true then raise exception 'Medikationsleserecht fehlt.' using errcode='42501';end if;
 if payload->>'measurementId'<>'' and public.has_permission('pflege.vitals.view') is not true then raise exception 'Vitalwertleserecht fehlt.' using errcode='42501';end if;
 select * into receipt from care_private.structured_treatment_requests r where r.tenant_id=tenant and r.request_id=write_structured_treatment.request_id;
 if receipt.result_id is not null then if receipt.actor_id<>actor or receipt.payload<>payload then raise exception 'Anfrage mit anderen Daten verwendet.' using errcode='23514';end if;return receipt.result_id;end if;
 if payload->>'profileVersion'<>'2026-10-09.1' or nullif(btrim(payload->>'title'),'') is null or payload->>'outcome' not in ('performed','partial','omitted','refused','failed') then raise exception 'Art, Titel, Fassung und Ergebnis prüfen.' using errcode='23514';end if;
 at_time:=(payload->>'occurredAt')::timestamptz;if at_time is null or not isfinite(at_time) or at_time>clock_timestamp() then raise exception 'Tatsächlicher Zeitpunkt ungültig.' using errcode='23514';end if;
 event_day:=(at_time at time zone 'Europe/Berlin')::date;actual:=payload->>'outcome' in ('performed','partial');profile:=payload->>'treatmentType';drug:=profile in ('injection','insulin','inhalation','instillation');
 case profile
 when 'injection' then fields:=array['substance','strength','amount','unit','route','site','device','siteReview'];
 when 'insulin' then fields:=array['substance','strength','amount','unit','route','site','schema','decision','mealContext','siteReview'];
 when 'inhalation' then fields:=array['substance','strength','amount','unit','route','site','device','durationMinutes','respiratoryResponse'];
 when 'instillation' then fields:=array['substance','strength','amount','unit','route','site','technique','localResponse'];
 when 'compression' then fields:=array['action','site','material','technique','skinBefore','skinAfter','tolerance'];
 when 'access' then fields:=array['accessType','site','action','siteReview','flow','volumeState','volume','volumeReason','technique'];
 else raise exception 'Behandlungsart nicht unterstützt.' using errcode='23514';end case;
 d:=(payload->>'detailsJson')::jsonb;if jsonb_typeof(d) is distinct from 'object' or (d-fields)<>'{}'::jsonb then raise exception 'Behandlungsangaben passen nicht zur Art.' using errcode='23514';end if;
 foreach field in array fields loop
  if jsonb_typeof(d->field) is distinct from 'string' or length(d->>field)>2000 then raise exception 'Behandlungsfeld fehlt oder ungültig.' using errcode='23514';end if;
  if not actual and nullif(btrim(d->>field),'') is not null then raise exception 'Nichtdurchführung darf keine tatsächliche Gabe oder Versorgung vortäuschen.' using errcode='23514';end if;
  if actual and not (profile='access' and field in ('volume','volumeReason')) and nullif(btrim(d->>field),'') is null then raise exception 'Tatsächliche Behandlungsangaben fehlen.' using errcode='23514';end if;
  if actual and field in ('amount','durationMinutes') then if d->>field !~ '^[0-9]+([.,][0-9]+)?$' or replace(d->>field,',','.')::numeric<=0 or replace(d->>field,',','.')::numeric>1000000 then raise exception 'Tatsächliche Menge / Dauer ungültig.' using errcode='23514';end if;end if;
 end loop;
 if actual and profile='access' then
  if d->>'volumeState'='measured' then if d->>'volume' !~ '^[0-9]+([.,][0-9]+)?$' or replace(d->>'volume',',','.')::numeric>1000000 or nullif(btrim(d->>'volumeReason'),'') is not null then raise exception 'Gemessene Menge ungültig.' using errcode='23514';end if;
  elsif d->>'volumeState'='not_measured' and nullif(btrim(d->>'volume'),'') is null and nullif(btrim(d->>'volumeReason'),'') is not null then null;
  else raise exception 'Fehlende Menge ausdrücklich begründen.' using errcode='23514';end if;
 end if;
 foreach field in array array['observation','communication','personDecision','qualificationBasis'] loop if nullif(btrim(payload->>field),'') is null then raise exception 'Beobachtung, Rücksprache, Personenentscheidung und Qualifikationsbasis erforderlich.' using errcode='23514';end if;end loop;
 if payload->>'outcome'<>'performed' and nullif(btrim(payload->>'deviation'),'') is null then raise exception 'Abweichungsgrund fehlt.' using errcode='23514';end if;
 if payload->>'qualificationState' not in ('documented','unconfirmed') or (payload->>'qualificationState'='unconfirmed' and nullif(btrim(payload->>'deviation'),'') is null) then raise exception 'Qualifikationsbezug ungeklärt.' using errcode='23514';end if;
 if payload->>'orderState'='linked' then
  select * into o from public.care_medical_orders x where x.id=(payload->>'orderId')::uuid and x.tenant_id=tenant and x.client_id=subject for share;
  if o.id is null or to_jsonb(o) is distinct from (payload->>'expectedOrderJson')::jsonb then raise exception 'Anordnung geändert oder fremd.' using errcode='40001';end if;
  if o.status<>'active' or o.ordered_at is null or o.valid_from is null or event_day<o.ordered_at or event_day<o.valid_from or (o.valid_until is not null and event_day>o.valid_until) or nullif(btrim(o.ordering_physician),'') is null or nullif(btrim(o.description),'') is null or nullif(btrim(payload->>'orderRelation'),'') is null or nullif(btrim(payload->>'basisReason'),'') is not null then raise exception 'Anordnung deckt Durchführung nicht ab oder Bezug fehlt.' using errcode='23514';end if;
 else
  if payload->>'orderState'<>'unconfirmed' or payload->>'orderId'<>'' or payload->>'expectedOrderJson'<>'' or payload->>'orderRelation'<>'' or nullif(btrim(payload->>'basisReason'),'') is null or nullif(btrim(payload->>'deviation'),'') is null then raise exception 'Ungeklärte Grundlage ausdrücklich begründen.' using errcode='23514';end if;
 end if;
 -- Insurer decision remains in the order snapshot; it is never promoted to clinical authorization.
 if payload->>'medicationState'='linked' then
  select * into a from public.medication_administrations x where x.id=(payload->>'administrationId')::uuid and x.tenant_id=tenant and x.client_id=subject for share;
  if a.id is null or to_jsonb(a) is distinct from (payload->>'expectedAdministrationJson')::jsonb then raise exception 'Gabenachweis geändert oder fremd.' using errcode='40001';end if;
  if not drug or not actual or a.status::text not in ('administered','late') or a.occurred_at is distinct from at_time or jsonb_typeof(a.order_snapshot) is distinct from 'object' or a.order_snapshot->>'id' is distinct from a.medication_id::text or a.order_snapshot->>'tenant_id' is distinct from tenant::text or a.order_snapshot->>'client_id' is distinct from subject::text
  or lower(btrim(a.order_snapshot->>'name')) is distinct from lower(btrim(d->>'substance')) or lower(regexp_replace(replace(btrim(a.administered_dose),',','.'),'\s+',' ','g')) is distinct from lower(regexp_replace(replace(btrim((d->>'amount')||' '||(d->>'unit')),',','.'),'\s+',' ','g')) or lower(btrim(a.route)) is distinct from lower(btrim(d->>'route')) then raise exception 'Präparat, Gabezeitpunkt, Dosis und Applikation widersprechen sich.' using errcode='23514';end if;
 else
  if payload->>'medicationState'<>case when drug then 'unconfirmed' else 'not_applicable' end or payload->>'administrationId'<>'' or payload->>'expectedAdministrationJson'<>'' or (drug and nullif(btrim(payload->>'deviation'),'') is null) then raise exception 'Medikationsbezug ungeklärt.' using errcode='23514';end if;
 end if;
 if nullif(btrim(payload->>'medicationReason'),'') is null then raise exception 'Medikationsbezug begründen.' using errcode='23514';end if;
 if payload->>'measurementState'='linked' then
  select * into m from public.vital_sign_measurements x where x.id=(payload->>'measurementId')::uuid and x.tenant_id=tenant and x.client_id=subject for share;
  if m.id is null or to_jsonb(m) is distinct from (payload->>'expectedMeasurementJson')::jsonb then raise exception 'Messnachweis geändert oder fremd.' using errcode='40001';end if;
  if m.occurred_at is null or not isfinite(m.occurred_at) or nullif(btrim(m.display_value),'') is null or nullif(btrim(m.unit),'') is null or jsonb_typeof(m.values) is distinct from 'object' or m.occurred_at>at_time or payload->>'measurementMaxAgeMinutes' !~ '^[0-9]{1,6}$' or (payload->>'measurementMaxAgeMinutes')::integer<1 or at_time-m.occurred_at>make_interval(mins=>(payload->>'measurementMaxAgeMinutes')::integer) or (profile='insulin' and m.vital_key<>'blood_glucose') or exists(select 1 from public.vital_measurement_invalidations i where i.measurement_id=m.id and i.tenant_id=tenant) then raise exception 'Messung ungültig, ungeeignet oder zeitlich unpassend.' using errcode='23514';end if;
 else
  if payload->>'measurementState'<>case when profile='insulin' then 'unconfirmed' else 'not_required' end or payload->>'measurementId'<>'' or payload->>'expectedMeasurementJson'<>'' or payload->>'measurementMaxAgeMinutes'<>'' or (profile='insulin' and nullif(btrim(payload->>'deviation'),'') is null) then raise exception 'Messbezug ungeklärt.' using errcode='23514';end if;
 end if;
 if nullif(btrim(payload->>'measurementReason'),'') is null then raise exception 'Messbezug begründen.' using errcode='23514';end if;
 if payload->>'reviewState'='scheduled' then if (payload->>'nextReviewAt')::timestamptz<=at_time or not isfinite((payload->>'nextReviewAt')::timestamptz) then raise exception 'Kontrolltermin muss nach Ereignis liegen.' using errcode='23514';end if;
 elsif payload->>'reviewState' not in ('pending','not_required') or payload->>'nextReviewAt'<>'' then raise exception 'Kontrollstatus ungültig.' using errcode='23514';end if;
 if nullif(btrim(payload->>'reviewReason'),'') is null then raise exception 'Kontrollabstimmung / Zuständigkeit dokumentieren.' using errcode='23514';end if;
 select coalesce(nullif(btrim(p.display_name),''),nullif(btrim(p.email),''),'Person ohne Anzeigenamen') into actor_name from public.profiles p where p.id=actor and p.tenant_id=tenant and p.is_active;
 core_details:=d||(payload-array['detailsJson','expectedOrderJson','expectedAdministrationJson','expectedMeasurementJson'])||jsonb_build_object('title',btrim(payload->>'title'),'clientId',subject::text,'orderId',coalesce(o.id::text,''),'administrationId',coalesce(a.id::text,''),'measurementId',coalesce(m.id::text,''));
 insert into public.clinical_treatment_executions(tenant_id,client_id,medical_order_id,treatment_type,title,performed_at,outcome,details,deviation_reason,escalation,qualification_snapshot,recorded_by,recorded_by_name)
 values(tenant,subject,o.id,profile,btrim(payload->>'title'),at_time,payload->>'outcome',core_details::text,btrim(payload->>'deviation'),btrim(payload->>'communication'),btrim(payload->>'qualificationBasis'),actor,actor_name) returning id into result_id;
 insert into public.structured_treatment_source_links(tenant_id,client_id,execution_id,profile_version,medical_order_id,order_snapshot,administration_id,administration_snapshot,measurement_id,measurement_snapshot,recorded_by)
 values(tenant,subject,result_id,payload->>'profileVersion',o.id,case when o.id is null then null else to_jsonb(o) end,a.id,case when a.id is null then null else to_jsonb(a) end,m.id,case when m.id is null then null else to_jsonb(m) end,actor);
 insert into care_private.structured_treatment_requests(tenant_id,request_id,actor_id,payload,result_id) values(tenant,request_id,actor,payload,result_id);
 insert into public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name) values(tenant,subject,'treatment_execution',result_id,'created','Strukturierte tatsächliche Behandlungspflege dokumentiert',core_details,actor,actor_name);
 return result_id;
end $$;
create or replace function public.write_structured_treatment_execution(request_id uuid,payload jsonb)
returns uuid language sql security invoker set search_path='' as $$select care_private.write_structured_treatment(request_id,payload)$$;
revoke all on function care_private.write_structured_treatment(uuid,jsonb),public.write_structured_treatment_execution(uuid,jsonb) from public,anon;
grant execute on function care_private.write_structured_treatment(uuid,jsonb),public.write_structured_treatment_execution(uuid,jsonb) to authenticated;
commit;
