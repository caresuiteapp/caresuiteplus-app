-- LOCAL REVIEW ONLY. Requires existing clinical_treatment_executions and ambulatory_wound_care.sql.
-- Append-only narrative errata. Does not change outcome, original timestamp, prescription, stock or billing.
begin;
create table if not exists public.clinical_treatment_corrections(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),client_id uuid not null references public.clients(id),
 execution_id uuid not null references public.clinical_treatment_executions(id),version integer not null check(version>0),previous_id uuid references public.clinical_treatment_corrections(id),
 dressing_id uuid references public.ambulatory_wound_dressings(id),wound_case_id uuid references public.clinical_wound_cases(id),
 section text not null check(section in ('event','basis','action','communication','wound_materials','wound_pain','wound_technique','wound_review')),
 execution_snapshot jsonb not null,original_section jsonb not null,corrected_statement text not null,reason text not null,evidence_basis text not null,
 clinical_impact text not null,communication text not null,person_decision text not null,recorded_by uuid not null references public.profiles(id),recorded_by_name text not null,
 created_at timestamptz not null default clock_timestamp(),unique(tenant_id,execution_id,version),
 check((dressing_id is null)=(wound_case_id is null)),check(section not like 'wound\_%' escape '\' or dressing_id is not null)
);
create table if not exists public.wound_dressing_correction_links(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),client_id uuid not null references public.clients(id),
 correction_id uuid not null unique references public.clinical_treatment_corrections(id),execution_id uuid not null references public.clinical_treatment_executions(id),
 dressing_id uuid not null references public.ambulatory_wound_dressings(id),wound_case_id uuid not null references public.clinical_wound_cases(id),
 dressing_snapshot jsonb not null,original_section jsonb not null,created_at timestamptz not null default clock_timestamp()
);
create index if not exists treatment_correction_history on public.clinical_treatment_corrections(tenant_id,execution_id,created_at desc,id desc);
create index if not exists treatment_correction_wound_history on public.clinical_treatment_corrections(tenant_id,wound_case_id,created_at desc,id desc);
create index if not exists dressing_correction_link_history on public.wound_dressing_correction_links(tenant_id,wound_case_id,created_at desc,id desc);
do $$declare tbl text;extra text;begin
 foreach tbl in array array['clinical_treatment_corrections','wound_dressing_correction_links'] loop
  execute format('alter table public.%I enable row level security',tbl);execute format('revoke all on public.%I from public,anon,authenticated',tbl);execute format('grant select on public.%I to authenticated',tbl);
  execute format('drop policy if exists treatment_correction_read on public.%I',tbl);execute format('create policy treatment_correction_read on public.%I for select to authenticated using(true)',tbl);
  execute format('drop policy if exists treatment_correction_scope on public.%I',tbl);
  extra:=case when tbl='wound_dressing_correction_links' then ' and public.has_permission(''pflege.wounds.view'') and public.has_permission(''pflege.orders.view'') and exists(select 1 from public.clinical_treatment_corrections c join public.ambulatory_wound_dressings d on d.id=c.dressing_id join public.clinical_wound_cases w on w.id=d.wound_case_id where c.id=wound_dressing_correction_links.correction_id and c.tenant_id=wound_dressing_correction_links.tenant_id and c.client_id=wound_dressing_correction_links.client_id and c.execution_id=wound_dressing_correction_links.execution_id and c.dressing_id=wound_dressing_correction_links.dressing_id and c.wound_case_id=wound_dressing_correction_links.wound_case_id and d.tenant_id=c.tenant_id and d.client_id=c.client_id and d.execution_id=c.execution_id and w.tenant_id=c.tenant_id and w.client_id=c.client_id)' else '' end;
  execute format('create policy treatment_correction_scope on public.%1$I as restrictive for select to authenticated using(
   auth.uid() is not null and tenant_id=public.current_tenant_id() and public.has_permission(''pflege.treatment.view'') and public.is_active_pfleger_client(client_id)
   and exists(select 1 from public.profiles p where p.id=public.resolve_current_profile_id() and p.tenant_id=%1$I.tenant_id and p.is_active)
   and exists(select 1 from public.clinical_treatment_executions e where e.id=%1$I.execution_id and e.tenant_id=%1$I.tenant_id and e.client_id=%1$I.client_id)%2$s)',tbl,extra);
 end loop;
end $$;
create table if not exists care_private.treatment_correction_requests(tenant_id uuid not null,request_id uuid not null,actor_id uuid not null,payload jsonb not null,result_id uuid not null,created_at timestamptz not null default clock_timestamp(),primary key(tenant_id,request_id));
alter table care_private.treatment_correction_requests enable row level security;
revoke all on care_private.treatment_correction_requests from public,anon,authenticated;
create or replace function care_private.assert_treatment_correction_actor(write_access boolean)
returns uuid language plpgsql security invoker set search_path='' as $$
declare tenant uuid:=public.current_tenant_id();actor uuid:=public.resolve_current_profile_id();begin
 if auth.uid() is null or tenant is null or actor is null or public.has_permission('pflege.treatment.view') is not true
 or (write_access and public.has_permission('pflege.treatment.manage') is not true)
 or not exists(select 1 from public.profiles p where p.id=actor and p.tenant_id=tenant and p.is_active)
 then raise exception 'Keine Berechtigung oder kein aktives Profil.' using errcode='42501';end if;return actor;
end $$;
revoke all on function care_private.assert_treatment_correction_actor(boolean) from public,anon,authenticated;
create or replace function care_private.read_treatment_wound_relation(execution_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=care_private.assert_treatment_correction_actor(false);tenant uuid:=public.current_tenant_id();e public.clinical_treatment_executions%rowtype;d public.ambulatory_wound_dressings%rowtype;
begin
 select * into e from public.clinical_treatment_executions x where x.id=execution_id and x.tenant_id=tenant;
 if e.id is null or public.is_active_pfleger_client(e.client_id) is not true then raise exception 'Nachweis nicht zugänglich.' using errcode='42501';end if;
 select * into d from public.ambulatory_wound_dressings x where x.execution_id=e.id and x.tenant_id=tenant and x.client_id=e.client_id;
 -- Identifiers only. Does not disclose a protected wound/plan/order snapshot.
 return jsonb_build_object('woundId',d.wound_case_id,'dressingId',d.id);
end $$;
create or replace function public.read_treatment_wound_relation(execution_id uuid)
returns jsonb language sql security invoker set search_path='' as $$select care_private.read_treatment_wound_relation(execution_id)$$;
revoke all on function care_private.read_treatment_wound_relation(uuid),public.read_treatment_wound_relation(uuid) from public,anon;
grant execute on function care_private.read_treatment_wound_relation(uuid),public.read_treatment_wound_relation(uuid) to authenticated;
create or replace function care_private.treatment_correction_section(e jsonb,section_name text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare keys text[];result jsonb:='{}'::jsonb;field text;begin
 case section_name when 'event' then keys:=array['performed_at','treatment_type','title','outcome'];when 'basis' then keys:=array['medical_order_id','qualification_snapshot'];when 'action' then keys:=array['details','deviation_reason'];when 'communication' then keys:=array['escalation'];when 'wound_materials','wound_pain','wound_technique','wound_review' then keys:=array['id','performed_at','outcome','details'];else raise exception 'Betroffenen Nachweisinhalt wählen.' using errcode='23514';end case;
 foreach field in array keys loop result:=result||jsonb_build_object(field,coalesce(e->field,'null'::jsonb));end loop;return result;
end $$;
create or replace function care_private.dressing_correction_section(d jsonb,section_name text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare keys text[];result jsonb:='{}'::jsonb;field text;begin
 case section_name when 'wound_materials' then keys:=array['materialsJson','noMaterialReason'];when 'wound_pain' then keys:=array['painBeforeState','painBeforeScore','painBeforeReason','painAfterState','painAfterScore','painAfterReason'];when 'wound_technique' then keys:=array['actualCleaning','actualTechnique','hygiene','response','deviation'];when 'wound_review' then keys:=array['reviewStatus','nextReviewAt','reviewPendingReason','personDecision','contact'];else keys:=array['occurredAt','outcome','basisState','planId','basisReason','qualificationBasis','actualCleaning','actualTechnique','hygiene','materialsJson','noMaterialReason','response','deviation','contact','personDecision'];end case;
 foreach field in array keys loop result:=result||jsonb_build_object(field,coalesce(d->'details'->field,'null'::jsonb));end loop;return result;
end $$;
revoke all on function care_private.treatment_correction_section(jsonb,text),care_private.dressing_correction_section(jsonb,text) from public,anon,authenticated;
create or replace function care_private.write_treatment_correction(request_id uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare actor uuid:=care_private.assert_treatment_correction_actor(true);tenant uuid:=public.current_tenant_id();actor_name text;subject uuid;
 e public.clinical_treatment_executions%rowtype;d public.ambulatory_wound_dressings%rowtype;w public.clinical_wound_cases%rowtype;head public.clinical_treatment_corrections%rowtype;receipt care_private.treatment_correction_requests%rowtype;
 keys text[]:=array['executionId','expectedExecutionJson','expectedDressingJson','expectedHeadJson','section','correctedStatement','reason','evidenceBasis','clinicalImpact','communication','personDecision'];field text;expected_dressing jsonb;expected_head jsonb;result_id uuid;
begin
 if request_id is null or jsonb_typeof(payload) is distinct from 'object' or (payload-keys)<>'{}'::jsonb or length(payload::text)>500000 then raise exception 'Ungültige Berichtigungsanfrage.' using errcode='23514';end if;
 foreach field in array keys loop if jsonb_typeof(payload->field) is distinct from 'string' or length(payload->>field)>case field when 'expectedExecutionJson' then 80000 when 'expectedHeadJson' then 120000 when 'expectedDressingJson' then 180000 else 2000 end then raise exception 'Angaben fehlen oder sind zu umfangreich.' using errcode='23514';end if;end loop;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(tenant::text||':treatment-correction:'||request_id::text,0));
 select * into e from public.clinical_treatment_executions x where x.id=(payload->>'executionId')::uuid and x.tenant_id=tenant;subject:=e.client_id;
 perform 1 from public.clients c where c.id=subject and c.tenant_id=tenant for no key update;
 if not found or public.is_active_pfleger_client(subject) is not true then raise exception 'Kein aktiver zugänglicher Pflegefall.' using errcode='42501';end if;
 select * into receipt from care_private.treatment_correction_requests r where r.tenant_id=tenant and r.request_id=write_treatment_correction.request_id;
 if receipt.result_id is not null then if receipt.actor_id<>actor or receipt.payload<>payload then raise exception 'Anfrage mit anderen Daten verwendet.' using errcode='23514';end if;return receipt.result_id;end if;
 -- Discover linkage again AFTER client serialization, then retain parent -> execution -> dressing lock order.
 select * into d from public.ambulatory_wound_dressings x where x.execution_id=e.id and x.tenant_id=tenant;
 if d.id is not null then
  if d.client_id<>subject or public.has_permission('pflege.wounds.view') is not true or public.has_permission('pflege.wounds.manage') is not true or public.has_permission('pflege.orders.view') is not true then raise exception 'Wund-/Anordnungsberechtigung oder passende Zuordnung fehlt.' using errcode='42501';end if;
  select * into w from public.clinical_wound_cases x where x.id=d.wound_case_id and x.tenant_id=tenant and x.client_id=subject for update;
  if w.id is null then raise exception 'Wundfall nicht zugänglich.' using errcode='42501';end if;
 end if;
 select * into e from public.clinical_treatment_executions x where x.id=(payload->>'executionId')::uuid and x.tenant_id=tenant and x.client_id=subject for update;
 if e.id is null or e.performed_at is null or e.created_at is null or e.outcome not in ('performed','partial','omitted','refused','failed') or nullif(btrim(e.treatment_type),'') is null or nullif(btrim(e.title),'') is null then raise exception 'Originalnachweis nicht zugänglich oder ungültig.' using errcode='42501';end if;
 if to_jsonb(e) is distinct from (payload->>'expectedExecutionJson')::jsonb then raise exception 'Originalnachweis geändert. Neu prüfen.' using errcode='40001';end if;
 if d.id is not null then
  select * into d from public.ambulatory_wound_dressings x where x.execution_id=e.id and x.tenant_id=tenant and x.client_id=subject and x.wound_case_id=w.id for update;
  if d.id is null or d.occurred_at<>e.performed_at or d.outcome<>e.outcome or e.treatment_type<>'wound_dressing' then raise exception 'Verbandwechsel und Behandlungspflege widersprechen sich.' using errcode='40001';end if;
 end if;
 expected_dressing:=case when payload->>'expectedDressingJson'='' then null else (payload->>'expectedDressingJson')::jsonb end;
 if (case when d.id is null then null else to_jsonb(d) end) is distinct from expected_dressing then raise exception 'Original-Verbandwechselbezug geändert oder nicht geladen.' using errcode='40001';end if;
 if payload->>'section' like 'wound\_%' escape '\' and d.id is null then raise exception 'Wundabschnitt benötigt einen Original-Verbandwechsel.' using errcode='23514';end if;
 select * into head from public.clinical_treatment_corrections c where c.tenant_id=tenant and c.execution_id=e.id order by c.version desc limit 1 for update;
 expected_head:=case when payload->>'expectedHeadJson'='' then null else (payload->>'expectedHeadJson')::jsonb end;
 if (case when head.id is null then null else to_jsonb(head) end) is distinct from expected_head then raise exception 'Berichtigungsstand inzwischen geändert. Neu prüfen.' using errcode='40001';end if;
 foreach field in array array['correctedStatement','reason','evidenceBasis','clinicalImpact','communication','personDecision'] loop if nullif(btrim(payload->>field),'') is null then raise exception 'Aussage, Grund, Erkenntnisbasis, Auswirkungen, Rücksprache und Personenbezug erforderlich.' using errcode='23514';end if;end loop;
 select coalesce(nullif(p.display_name,''),p.email,'Pflegekraft') into actor_name from public.profiles p where p.id=actor and p.tenant_id=tenant and p.is_active;
 insert into public.clinical_treatment_corrections(tenant_id,client_id,execution_id,version,previous_id,dressing_id,wound_case_id,section,execution_snapshot,original_section,corrected_statement,reason,evidence_basis,clinical_impact,communication,person_decision,recorded_by,recorded_by_name)
 values(tenant,subject,e.id,coalesce(head.version,0)+1,head.id,d.id,d.wound_case_id,payload->>'section',to_jsonb(e),care_private.treatment_correction_section(to_jsonb(e),payload->>'section'),btrim(payload->>'correctedStatement'),btrim(payload->>'reason'),btrim(payload->>'evidenceBasis'),btrim(payload->>'clinicalImpact'),btrim(payload->>'communication'),btrim(payload->>'personDecision'),actor,actor_name) returning id into result_id;
 if d.id is not null then
  insert into public.wound_dressing_correction_links(tenant_id,client_id,correction_id,execution_id,dressing_id,wound_case_id,dressing_snapshot,original_section)
  values(tenant,subject,result_id,e.id,d.id,d.wound_case_id,to_jsonb(d),care_private.dressing_correction_section(to_jsonb(d),payload->>'section'));
  update public.clinical_wound_cases set updated_at=clock_timestamp() where id=w.id and tenant_id=tenant;
 end if;
 insert into care_private.treatment_correction_requests(tenant_id,request_id,actor_id,payload,result_id) values(tenant,request_id,actor,payload,result_id);
 insert into public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name)
 values(tenant,subject,'treatment_correction',result_id,'created','Behandlungspflegenachweis begründet berichtigt',payload-array['expectedExecutionJson','expectedDressingJson','expectedHeadJson'],actor,actor_name);
 return result_id;
end $$;
create or replace function public.write_clinical_treatment_correction(request_id uuid,payload jsonb)
returns uuid language sql security invoker set search_path='' as $$select care_private.write_treatment_correction(request_id,payload)$$;
revoke all on function care_private.write_treatment_correction(uuid,jsonb),public.write_clinical_treatment_correction(uuid,jsonb) from public,anon;
grant execute on function care_private.write_treatment_correction(uuid,jsonb),public.write_clinical_treatment_correction(uuid,jsonb) to authenticated;
commit;
