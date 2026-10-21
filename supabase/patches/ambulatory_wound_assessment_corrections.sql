-- LOCAL REVIEW ONLY. Requires wound_documentation and wound_lifecycle.
-- Narrative errata retain the original; they are not new observations or replacement measurements.
begin;
create table if not exists public.ambulatory_wound_assessment_corrections(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),
 client_id uuid not null references public.clients(id),wound_case_id uuid not null references public.clinical_wound_cases(id),
 assessment_id uuid not null references public.clinical_wound_assessments(id),version integer not null check(version>0),
 previous_id uuid references public.ambulatory_wound_assessment_corrections(id),
 section text not null check(section in ('observation','measurement','appearance','pain','infection','person','action','review')),
 original_snapshot jsonb not null,original_section jsonb not null,
 corrected_statement text not null,reason text not null,evidence_basis text not null,clinical_impact text not null,communication text not null,person_decision text not null,
 recorded_by uuid not null references public.profiles(id),recorded_by_name text not null,created_at timestamptz not null default clock_timestamp(),
 unique(tenant_id,assessment_id,version),
 check(length(btrim(corrected_statement))>0 and length(corrected_statement)<=2000),
 check(length(btrim(reason))>0 and length(reason)<=2000),check(length(btrim(evidence_basis))>0 and length(evidence_basis)<=2000),
 check(length(btrim(clinical_impact))>0 and length(clinical_impact)<=2000),check(length(btrim(communication))>0 and length(communication)<=2000),
 check(length(btrim(person_decision))>0 and length(person_decision)<=2000)
);
create index if not exists wound_correction_history on public.ambulatory_wound_assessment_corrections(tenant_id,wound_case_id,created_at desc,id desc);
alter table public.ambulatory_wound_assessment_corrections enable row level security;
revoke all on public.ambulatory_wound_assessment_corrections from public,anon,authenticated;
grant select on public.ambulatory_wound_assessment_corrections to authenticated;
drop policy if exists wound_correction_read on public.ambulatory_wound_assessment_corrections;
create policy wound_correction_read on public.ambulatory_wound_assessment_corrections for select to authenticated using(true);
drop policy if exists wound_correction_scope on public.ambulatory_wound_assessment_corrections;
create policy wound_correction_scope on public.ambulatory_wound_assessment_corrections as restrictive for select to authenticated using(
 auth.uid() is not null and tenant_id=public.current_tenant_id() and public.has_permission('pflege.wounds.view') and public.is_active_pfleger_client(client_id)
 and exists(select 1 from public.profiles p where p.id=public.resolve_current_profile_id() and p.tenant_id=ambulatory_wound_assessment_corrections.tenant_id and p.is_active)
 and exists(select 1 from public.clinical_wound_cases w where w.id=ambulatory_wound_assessment_corrections.wound_case_id and w.tenant_id=ambulatory_wound_assessment_corrections.tenant_id and w.client_id=ambulatory_wound_assessment_corrections.client_id)
 and exists(select 1 from public.clinical_wound_assessments a where a.id=ambulatory_wound_assessment_corrections.assessment_id and a.tenant_id=ambulatory_wound_assessment_corrections.tenant_id and a.client_id=ambulatory_wound_assessment_corrections.client_id and a.wound_case_id=ambulatory_wound_assessment_corrections.wound_case_id)
);
create table if not exists care_private.wound_correction_requests(
 tenant_id uuid not null,request_id uuid not null,actor_id uuid not null,payload jsonb not null,result_id uuid not null,
 created_at timestamptz not null default clock_timestamp(),primary key(tenant_id,request_id)
);
alter table care_private.wound_correction_requests enable row level security;
revoke all on care_private.wound_correction_requests from public,anon,authenticated;
create or replace function care_private.wound_assessment_section(s jsonb,section_name text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare keys text[];result jsonb:='{}'::jsonb;field text;
begin
 case section_name
 when 'observation' then return jsonb_build_object('observed_at',s->'observed_at','wound_case_id',s->'wound_case_id','client_id',s->'client_id');
 when 'measurement' then keys:=array['measurementMethod','lengthState','lengthCm','lengthReason','widthState','widthCm','widthReason','depthState','depthCm','depthReason'];result:=jsonb_build_object('length_cm',s->'length_cm','width_cm',s->'width_cm','depth_cm',s->'depth_cm','unit','cm');
 when 'appearance' then keys:=array['woundBed','exudate','odor','woundEdge','surroundingSkin'];result:=jsonb_build_object('wound_bed',s->'wound_bed','legacy_exudate',s->'exudate','legacy_odor',s->'odor','wound_edge',s->'wound_edge','surrounding_skin',s->'surrounding_skin');
 when 'pain' then keys:=array['painState','painScore','painReason'];result:=jsonb_build_object('pain_score',s->'pain_score');
 when 'infection' then keys:=array['infectionObservation'];result:=jsonb_build_object('infection_signs',s->'infection_signs');
 when 'person' then keys:=array['personalImpact','preferences','selfManagement'];
 when 'action' then keys:=array['actualAction','response'];result:=jsonb_build_object('intervention',s->'intervention','legacy_response',s->'response');
 when 'review' then keys:=array['nextReviewAt','reviewStatus','reviewPendingReason'];
 else raise exception 'Betroffenen Inhalt ausdrücklich wählen.' using errcode='23514';
 end case;
 foreach field in array keys loop result:=result||jsonb_build_object(field,coalesce(s->'documentation_details'->field,'null'::jsonb));end loop;
 return result;
end $$;
revoke all on function care_private.wound_assessment_section(jsonb,text) from public,anon,authenticated;
create or replace function care_private.write_wound_assessment_correction(request_id uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare tenant uuid:=public.current_tenant_id();actor uuid:=public.resolve_current_profile_id();actor_name text;
 w public.clinical_wound_cases%rowtype;a public.clinical_wound_assessments%rowtype;head public.ambulatory_wound_assessment_corrections%rowtype;
 receipt care_private.wound_correction_requests%rowtype;keys text[]:=array['woundId','assessmentId','expectedSourceJson','expectedHeadJson','section','correctedStatement','reason','evidenceBasis','clinicalImpact','communication','personDecision'];
 field text;original jsonb;expected_head jsonb;result_id uuid;
begin
 if auth.uid() is null or tenant is null or actor is null or public.has_permission('pflege.wounds.view') is not true or public.has_permission('pflege.wounds.manage') is not true
 or not exists(select 1 from public.profiles p where p.id=actor and p.tenant_id=tenant and p.is_active)
 then raise exception 'Keine Berechtigung oder kein aktives Profil.' using errcode='42501';end if;
 if request_id is null or jsonb_typeof(payload) is distinct from 'object' or (payload-keys)<>'{}'::jsonb or length(payload::text)>300000 then raise exception 'Ungültige Berichtigungsanfrage.' using errcode='23514';end if;
 foreach field in array keys loop
  if jsonb_typeof(payload->field) is distinct from 'string' or length(payload->>field)>case field when 'expectedSourceJson' then 80000 when 'expectedHeadJson' then 120000 else 2000 end then raise exception 'Berichtigungsangaben fehlen oder sind zu umfangreich.' using errcode='23514';end if;
 end loop;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(tenant::text||':wound-correction:'||request_id::text,0));
 select * into w from public.clinical_wound_cases c where c.id=(payload->>'woundId')::uuid and c.tenant_id=tenant;
 perform 1 from public.clients c where c.id=w.client_id and c.tenant_id=tenant for no key update;
 if not found or public.is_active_pfleger_client(w.client_id) is not true then raise exception 'Kein aktiver zugänglicher Pflegefall.' using errcode='42501';end if;
 select * into receipt from care_private.wound_correction_requests r where r.tenant_id=tenant and r.request_id=write_wound_assessment_correction.request_id;
 if receipt.result_id is not null then
  if receipt.actor_id<>actor or receipt.payload<>payload then raise exception 'Anfrage mit anderen Daten verwendet.' using errcode='23514';end if;
  return receipt.result_id;
 end if;
 select * into w from public.clinical_wound_cases c where c.id=(payload->>'woundId')::uuid and c.tenant_id=tenant for update;
 if w.id is null or public.is_active_pfleger_client(w.client_id) is not true then raise exception 'Wundfall nicht zugänglich.' using errcode='42501';end if;
 select * into a from public.clinical_wound_assessments x where x.id=(payload->>'assessmentId')::uuid and x.tenant_id=tenant and x.client_id=w.client_id and x.wound_case_id=w.id for update;
 if a.id is null then raise exception 'Originalassessment gehört nicht zu dieser Akte.' using errcode='42501';end if;
 original:=(payload->>'expectedSourceJson')::jsonb;
 if to_jsonb(a) is distinct from original then raise exception 'Originalbefund seit Bearbeitungsbeginn geändert. Neu prüfen.' using errcode='40001';end if;
 select * into head from public.ambulatory_wound_assessment_corrections c where c.tenant_id=tenant and c.assessment_id=a.id order by c.version desc limit 1 for update;
 expected_head:=case when payload->>'expectedHeadJson'='' then null else (payload->>'expectedHeadJson')::jsonb end;
 if (case when head.id is null then null else to_jsonb(head) end) is distinct from expected_head then raise exception 'Berichtigungsstand inzwischen geändert. Neu prüfen.' using errcode='40001';end if;
 foreach field in array array['correctedStatement','reason','evidenceBasis','clinicalImpact','communication','personDecision'] loop
  if nullif(btrim(payload->>field),'') is null then raise exception 'Aussage, Grund, Grundlage, Auswirkungen, Rücksprache und Personenbezug erforderlich.' using errcode='23514';end if;
 end loop;
 -- Closed cases remain documentable. This does not reopen a case or change a previous decision.
 select coalesce(nullif(p.display_name,''),p.email,'Pflegekraft') into actor_name from public.profiles p where p.id=actor and p.tenant_id=tenant and p.is_active;
 insert into public.ambulatory_wound_assessment_corrections(tenant_id,client_id,wound_case_id,assessment_id,version,previous_id,section,original_snapshot,original_section,corrected_statement,reason,evidence_basis,clinical_impact,communication,person_decision,recorded_by,recorded_by_name)
 values(tenant,w.client_id,w.id,a.id,coalesce(head.version,0)+1,head.id,payload->>'section',original,care_private.wound_assessment_section(original,payload->>'section'),btrim(payload->>'correctedStatement'),btrim(payload->>'reason'),btrim(payload->>'evidenceBasis'),btrim(payload->>'clinicalImpact'),btrim(payload->>'communication'),btrim(payload->>'personDecision'),actor,actor_name) returning id into result_id;
 update public.clinical_wound_cases set updated_at=clock_timestamp() where id=w.id and tenant_id=tenant;
 insert into care_private.wound_correction_requests(tenant_id,request_id,actor_id,payload,result_id) values(tenant,request_id,actor,payload,result_id);
 insert into public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name)
 values(tenant,w.client_id,'wound_assessment_correction',result_id,'created','Begründete Assessmentberichtigung dokumentiert',payload-array['expectedSourceJson','expectedHeadJson'],actor,actor_name);
 return result_id;
end $$;
create or replace function public.write_ambulatory_wound_assessment_correction(request_id uuid,payload jsonb)
returns uuid language sql security invoker set search_path='' as $$select care_private.write_wound_assessment_correction(request_id,payload)$$;
revoke all on function care_private.write_wound_assessment_correction(uuid,jsonb),public.write_ambulatory_wound_assessment_correction(uuid,jsonb) from public,anon;
grant execute on function care_private.write_wound_assessment_correction(uuid,jsonb),public.write_ambulatory_wound_assessment_correction(uuid,jsonb) to authenticated;
create or replace function care_private.require_uncorrected_healing_assessment()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.action='close' and new.closure_kind='healed' and exists(select 1 from public.ambulatory_wound_assessment_corrections c where c.tenant_id=new.tenant_id and c.wound_case_id=new.wound_case_id and c.assessment_id=new.assessment_id) then
  raise exception 'Befund besitzt Berichtigungsvermerke. Abheilung fachlich neu beurteilen und eigenes tatsächliches Assessment dokumentieren.' using errcode='40001';
 end if;
 return new;
end $$;
revoke all on function care_private.require_uncorrected_healing_assessment() from public,anon,authenticated;
drop trigger if exists require_uncorrected_healing_assessment on public.ambulatory_wound_lifecycle_events;
create trigger require_uncorrected_healing_assessment before insert on public.ambulatory_wound_lifecycle_events for each row execute function care_private.require_uncorrected_healing_assessment();
commit;
