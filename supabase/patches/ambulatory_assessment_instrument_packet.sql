-- LOCAL ONLY / NOT APPLIED. Requires ambulatory_assessment_draft_requests.sql first.
-- Connects model/instrument selection to the same assessment draft transaction.
begin;
create schema if not exists care_private;
revoke all on schema care_private from public,anon;

create table if not exists care_private.assessment_models(
 model_key text primary key, title text not null, model_version text not null,
 claim text not null check(claim in ('product_model','external_standard')),
 status text not null check(status in ('active','unavailable','retired')),
 source_revision text not null, updated_at timestamptz not null default clock_timestamp()
);
create table if not exists care_private.assessment_instruments(
 id uuid primary key,key text unique not null,title text not null,instrument_version text not null,
 ownership text not null check(ownership in ('caresuite','licensed_external','external_reference')),
 availability text not null check(availability in ('active','unavailable','retired')),
 license_state text not null check(license_state in ('owned','licensed','unverified','expired')),
 risk_keys text[] not null default '{}',source_revision text not null,updated_at timestamptz not null default clock_timestamp()
);
create table if not exists care_private.assessment_instrument_selections(
 tenant_id uuid not null references public.tenants(id),assessment_id uuid primary key references public.care_assessments(id),
 subject_id uuid not null,model_key text not null references care_private.assessment_models(model_key),model_version text not null,
 catalog_revision text not null,selection_revision integer not null default 0 check(selection_revision>=0),
 selected_instrument_ids uuid[] not null default '{}',selected_originals jsonb not null default '[]',rationale text not null default '',
 updated_at timestamptz not null default clock_timestamp(),updated_by uuid not null references public.profiles(id)
);
alter table care_private.assessment_models enable row level security;
alter table care_private.assessment_instruments enable row level security;
alter table care_private.assessment_instrument_selections enable row level security;
revoke all on care_private.assessment_models,care_private.assessment_instruments,care_private.assessment_instrument_selections from public,anon,authenticated;

insert into care_private.assessment_models(model_key,title,model_version,claim,status,source_revision) values
 ('caresuite_pflegeassessment','CareSuite Pflegeassessment','1','product_model','active','cp310-model-1'),
 ('strukturmodell_sis_reference','Strukturmodell / SIS – Referenz','unverified','external_standard','unavailable','cp310-unverified-reference')
on conflict(model_key) do nothing;
insert into care_private.assessment_instruments(id,key,title,instrument_version,ownership,availability,license_state,risk_keys,source_revision) values
 ('c3100000-0000-4100-8100-000000000001','caresuite_fall_context_v1','Sturzrisiko-Kontextprüfung','1','caresuite','active','owned',array['fall'],'cp310-instrument-1'),
 ('c3100000-0000-4100-8100-000000000002','caresuite_pressure_context_v1','Dekubitusrisiko-Kontextprüfung','1','caresuite','active','owned',array['pressure_injury'],'cp310-instrument-1'),
 ('c3100000-0000-4100-8100-000000000003','caresuite_nutrition_context_v1','Ernährungsrisiko-Kontextprüfung','1','caresuite','active','owned',array['nutrition'],'cp310-instrument-1'),
 ('c3100000-0000-4100-8100-000000000004','caresuite_continence_context_v1','Kontinenz-Kontextprüfung','1','caresuite','active','owned',array['continence'],'cp310-instrument-1'),
 ('c3100000-0000-4100-8100-000000000007','caresuite_pain_context_v1','Schmerz-Kontextprüfung','1','caresuite','active','owned',array['pain'],'cp310-instrument-1'),
 ('c3100000-0000-4100-8100-000000000008','caresuite_hydration_context_v1','Flüssigkeits-Kontextprüfung','1','caresuite','active','owned',array['dehydration'],'cp310-instrument-1'),
 ('c3100000-0000-4100-8100-000000000009','caresuite_cognition_context_v1','Kognitions-/Delir-Kontextprüfung','1','caresuite','active','owned',array['cognition_delirium'],'cp310-instrument-1'),
 ('c3100000-0000-4100-8100-000000000005','external_fall_scale_reference','Externe Sturzskala – Referenz','unverified','external_reference','unavailable','unverified',array['fall'],'cp310-unverified-reference'),
 ('c3100000-0000-4100-8100-000000000006','external_nutrition_scale_reference','Externes Ernährungsscreening – Referenz','unverified','external_reference','unavailable','unverified',array['nutrition'],'cp310-unverified-reference')
on conflict(id) do nothing;

create or replace function care_private.assert_ambulatory_assessment_instrument_access(p_tenant uuid,p_assessment uuid,p_subject uuid,p_actor uuid,p_manage boolean)
returns public.care_assessments language plpgsql security definer set search_path='' as $$
declare a public.care_assessments%rowtype;session_ok boolean;begin
 session_ok:=auth.uid() is not null and coalesce((auth.jwt()->>'exp')::bigint,0)>extract(epoch from clock_timestamp())::bigint
  and exists(select 1 from auth.sessions s where s.user_id=auth.uid() and s.not_after>clock_timestamp());
 if not session_ok or p_tenant is distinct from public.current_tenant_id() or p_actor is distinct from public.resolve_current_profile_id()
  or public.has_permission('pflege.plans.view') is not true or public.has_permission('pflege.assessments.manage') is distinct from true and p_manage
  or not exists(select 1 from public.profiles p where p.id=p_actor and p.tenant_id=p_tenant and p.user_id=auth.uid() and p.is_active) then
  raise exception 'Kein aktueller berechtigter Assessmentzugriff.' using errcode='42501';
 end if;
 select * into a from public.care_assessments x where x.id=p_assessment and x.tenant_id=p_tenant and x.subject_id=p_subject and x.subject_type='client';
 if a.id is null or public.is_active_pfleger_client(p_subject) is not true then raise exception 'Aktiver eigener Pflegefall fehlt.' using errcode='42501';end if;
 return a;
end $$;
revoke all on function care_private.assert_ambulatory_assessment_instrument_access(uuid,uuid,uuid,uuid,boolean) from public,anon,authenticated;

create or replace function care_private.read_ambulatory_assessment_instrument_packet(p_tenant uuid,p_assessment uuid,p_subject uuid,p_actor uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.care_assessments%rowtype;m care_private.assessment_models%rowtype;s care_private.assessment_instrument_selections%rowtype;revision text;begin
 a:=care_private.assert_ambulatory_assessment_instrument_access(p_tenant,p_assessment,p_subject,p_actor,false);
 select * into m from care_private.assessment_models where model_key='caresuite_pflegeassessment' and status='active';
 if m.model_key is null then raise exception 'Aktives CareSuite-Assessmentmodell fehlt.' using errcode='23514';end if;
 select * into s from care_private.assessment_instrument_selections x where x.assessment_id=p_assessment and x.tenant_id=p_tenant;
 select encode(digest(string_agg(i.id::text||':'||i.source_revision||':'||i.updated_at::text,'|' order by i.id)||'|'||m.source_revision||'|'||m.updated_at::text,'sha256'),'hex') into revision from care_private.assessment_instruments i;
 return jsonb_build_object('tenantId',p_tenant,'assessmentId',p_assessment,'subjectId',p_subject,'actorId',p_actor,'catalogRevision',revision,'readAt',clock_timestamp(),
  'model',jsonb_build_object('key',m.model_key,'title',m.title,'version',m.model_version,'claim',m.claim,'status',m.status),
  'instruments',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'key',i.key,'title',i.title,'version',i.instrument_version,'ownership',i.ownership,'availability',i.availability,'licenseState',i.license_state,'riskKeys',to_jsonb(i.risk_keys),'sourceRevision',i.source_revision) order by i.key) from care_private.assessment_instruments i),'[]'::jsonb),
  'selection',jsonb_build_object('revision',coalesce(s.selection_revision,0),'modelKey',coalesce(s.model_key,m.model_key),'modelVersion',coalesce(s.model_version,m.model_version),'selectedInstrumentIds',coalesce(to_jsonb(s.selected_instrument_ids),'[]'::jsonb),'rationale',coalesce(s.rationale,''),'updatedAt',s.updated_at));
end $$;

create or replace function public.web_read_ambulatory_assessment_instrument_packet(p_tenant_id uuid,p_assessment_id uuid,p_subject_id uuid,p_actor_profile_id uuid)
returns jsonb language sql security invoker set search_path='' as $$select care_private.read_ambulatory_assessment_instrument_packet(p_tenant_id,p_assessment_id,p_subject_id,p_actor_profile_id)$$;
revoke all on function care_private.read_ambulatory_assessment_instrument_packet(uuid,uuid,uuid,uuid),public.web_read_ambulatory_assessment_instrument_packet(uuid,uuid,uuid,uuid) from public,anon;
grant execute on function public.web_read_ambulatory_assessment_instrument_packet(uuid,uuid,uuid,uuid) to authenticated;

create or replace function care_private.persist_assessment_instrument_packet(p_payload jsonb,p_actor uuid,p_tenant uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare packet jsonb;model care_private.assessment_models%rowtype;existing care_private.assessment_instrument_selections%rowtype;item jsonb;native care_private.assessment_instruments%rowtype;assessment public.care_assessments%rowtype;catalog text;selected uuid[]:='{}';risk_keys text[];next_revision integer;begin
 packet:=(p_payload->>'payloadJson')::jsonb->'instrumentPacket';
 if jsonb_typeof(packet) is distinct from 'object' or packet->>'schemaVersion'<>'1' then raise exception 'Vollständiges Instrumentenpaket fehlt.' using errcode='23514';end if;
 assessment:=care_private.assert_ambulatory_assessment_instrument_access(p_tenant,(packet->>'assessmentId')::uuid,(packet->>'subjectId')::uuid,p_actor,true);
 if packet->>'tenantId'<>p_tenant::text or packet->>'actorId'<>p_actor::text then raise exception 'Instrumentenpaket gehört nicht zum aktuellen Kontext.' using errcode='42501';end if;
 select * into model from care_private.assessment_models m where m.model_key=packet#>>'{model,key}' and m.model_version=packet#>>'{model,version}' and m.claim=packet#>>'{model,claim}' and m.status='active';
 if model.model_key is null or model.claim<>'product_model' then raise exception 'Assessmentmodell ist nicht aktiv freigegeben.' using errcode='23514';end if;
 select encode(digest(string_agg(i.id::text||':'||i.source_revision||':'||i.updated_at::text,'|' order by i.id)||'|'||model.source_revision||'|'||model.updated_at::text,'sha256'),'hex') into catalog from care_private.assessment_instruments i;
 if packet->>'catalogRevision' is distinct from catalog then raise exception 'Instrumentenkatalog wurde geändert. Vollständig neu laden.' using errcode='40001';end if;
 select * into existing from care_private.assessment_instrument_selections x where x.assessment_id=assessment.id for update;
 if coalesce(existing.selection_revision,0)<>(packet->>'selectionRevision')::integer or existing.updated_at is distinct from nullif(packet->>'selectionUpdatedAt','')::timestamptz then raise exception 'Instrumentenauswahl wurde geändert. Vollständig neu laden.' using errcode='40001';end if;
 select coalesce(array_agg(distinct r->>'riskKey'),'{}') into risk_keys from jsonb_array_elements((p_payload->>'payloadJson')::jsonb->'risks') r;
 if jsonb_array_length(packet->'selectedInstrumentIds')<>jsonb_array_length(packet->'selectedOriginals') or jsonb_array_length(packet->'selectedInstrumentIds')>200 then raise exception 'Instrumentenoriginale sind unvollständig.' using errcode='23514';end if;
 for item in select value from jsonb_array_elements(packet->'selectedOriginals') loop
  select * into native from care_private.assessment_instruments i where i.id=(item->>'id')::uuid for share;
  if native.id is null or native.availability<>'active' or native.license_state not in ('owned','licensed')
   or item is distinct from jsonb_build_object('id',native.id,'key',native.key,'title',native.title,'version',native.instrument_version,'ownership',native.ownership,'availability',native.availability,'licenseState',native.license_state,'riskKeys',to_jsonb(native.risk_keys),'sourceRevision',native.source_revision)
   or cardinality(native.risk_keys)>0 and not native.risk_keys&&risk_keys then raise exception 'Instrument ist nicht verfügbar, verändert oder ohne aktuellen Risikobezug.' using errcode='23514';end if;
  selected:=array_append(selected,native.id);
 end loop;
 if cardinality(selected)<>(select count(distinct x) from unnest(selected) x) or selected is distinct from array(select jsonb_array_elements_text(packet->'selectedInstrumentIds')::uuid order by 1) then raise exception 'Instrumentenreihenfolge oder Eindeutigkeit stimmt nicht.' using errcode='23514';end if;
 if length(coalesce(packet->>'rationale',''))>4000 then raise exception 'Instrumentenbegründung ist zu lang.' using errcode='23514';end if;
 next_revision:=coalesce(existing.selection_revision,0)+1;
 insert into care_private.assessment_instrument_selections(tenant_id,assessment_id,subject_id,model_key,model_version,catalog_revision,selection_revision,selected_instrument_ids,selected_originals,rationale,updated_at,updated_by)
 values(p_tenant,assessment.id,assessment.subject_id,model.model_key,model.model_version,catalog,next_revision,selected,packet->'selectedOriginals',btrim(coalesce(packet->>'rationale','')),clock_timestamp(),p_actor)
 on conflict(assessment_id) do update set model_key=excluded.model_key,model_version=excluded.model_version,catalog_revision=excluded.catalog_revision,selection_revision=excluded.selection_revision,selected_instrument_ids=excluded.selected_instrument_ids,selected_originals=excluded.selected_originals,rationale=excluded.rationale,updated_at=excluded.updated_at,updated_by=excluded.updated_by;
 return jsonb_build_object('instrumentSelectionRevision',next_revision,'instrumentCatalogRevision',catalog);
end $$;
revoke all on function care_private.persist_assessment_instrument_packet(jsonb,uuid,uuid) from public,anon,authenticated;

create or replace function care_private.write_ambulatory_assessment_with_instruments(request_id uuid,payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.resolve_current_profile_id();tenant uuid:=public.current_tenant_id();prior care_private.assessment_draft_requests%rowtype;receipt jsonb;instrument_receipt jsonb;begin
 select * into prior from care_private.assessment_draft_requests r where r.tenant_id=tenant and r.request_id=write_ambulatory_assessment_with_instruments.request_id for share;
 if prior.request_id is not null then
  if prior.actor_id<>actor or prior.payload<>payload then raise exception 'Anfrage-ID bereits mit anderen Daten verwendet.' using errcode='23514';end if;
  if prior.result ? 'instrumentSelectionRevision' and prior.result ? 'instrumentCatalogRevision' then return prior.result;end if;
  raise exception 'Alte unvollständige Assessmentanfrage bleibt gesperrt.' using errcode='23514';
 end if;
 receipt:=care_private.write_ambulatory_assessment_draft(request_id,payload);
 instrument_receipt:=care_private.persist_assessment_instrument_packet(payload,actor,tenant);
 receipt:=receipt||instrument_receipt;
 update care_private.assessment_draft_requests set result=receipt where tenant_id=tenant and request_id=write_ambulatory_assessment_with_instruments.request_id and actor_id=actor and payload=write_ambulatory_assessment_with_instruments.payload;
 if not found then raise exception 'Assessmentquittung konnte nicht vollständig gebunden werden.' using errcode='23514';end if;
 return receipt;
end $$;
create or replace function public.write_ambulatory_assessment_draft(request_id uuid,payload jsonb)
returns jsonb language sql security invoker set search_path='' as $$select care_private.write_ambulatory_assessment_with_instruments(request_id,payload)$$;
revoke all on function care_private.write_ambulatory_assessment_with_instruments(uuid,jsonb),public.write_ambulatory_assessment_draft(uuid,jsonb) from public,anon;
grant execute on function public.write_ambulatory_assessment_draft(uuid,jsonb) to authenticated;
commit;
