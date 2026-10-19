-- LOCAL REVIEW ONLY. New ambulatory Web review path; old native RPC is not altered.
-- Requires care_assessment_healthos schema, draft_requests patch and active Pflege boundary.
begin;
create schema if not exists care_private;
revoke all on schema care_private from public,anon;
grant usage on schema care_private to authenticated;
create or replace function care_private.submit_ambulatory_assessment_review(assessment_id uuid,expected_version integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare v public.care_assessments%rowtype;actor uuid:=public.resolve_current_profile_id();actor_name text;key text;snapshot jsonb;old_status text;r record;
begin
 if auth.uid() is null or public.current_tenant_id() is null or public.has_permission('pflege.assessments.manage') is not true or public.has_permission('pflege.plans.view') is not true then raise exception 'Keine Berechtigung.' using errcode='42501';end if;
 select coalesce(nullif(p.display_name,''),p.email,'Pflegefachperson') into actor_name from public.profiles p where p.id=actor and p.tenant_id=public.current_tenant_id() and p.is_active;
 if actor_name is null then raise exception 'Kein aktives Benutzerprofil.' using errcode='42501';end if;
 select * into v from public.care_assessments a where a.id=assessment_id and a.tenant_id=public.current_tenant_id() and a.subject_type='client' for update;
 if v.id is null or public.is_active_pfleger_client(v.subject_id) is not true then raise exception 'Kein aktiver Pflegefall.' using errcode='42501';end if;
 if expected_version is null or expected_version<>v.version then raise exception 'Assessment wurde geändert.' using errcode='40001';end if;
 -- Re-read of an already submitted version does not create another snapshot or actor claim.
 if v.status='professional_review' then return v.id;end if;
 if v.status not in ('draft','in_progress') then raise exception 'Assessment ist nicht zur Übergabe bearbeitbar.' using errcode='23514';end if;
 if (v.statement_source='not_possible' and nullif(btrim(v.communication_support),'') is null) or (v.statement_source<>'not_possible' and nullif(btrim(v.person_statement),'') is null) or (v.statement_source in ('relative','representative','professional') and nullif(btrim(v.statement_source_name),'') is null) or nullif(btrim(v.professional_summary),'') is null or v.next_review_at is null or v.next_review_at<=clock_timestamp() then raise exception 'Perspektive, Quelle, Gesamteinschätzung oder Prüftermin fehlen.' using errcode='23514';end if;
 foreach key in array array['cognition_communication','mobility','disease_demands','self_care','social_relationships','living_environment'] loop
  if not exists(select 1 from public.care_assessment_topics t where t.assessment_id=v.id and t.tenant_id=v.tenant_id and t.topic_key=key and nullif(btrim(t.professional_assessment),'') is not null) then raise exception 'Fachliche Themenfeldeinschätzung fehlt.' using errcode='23514';end if;
 end loop;
 foreach key in array array['fall','pressure_injury','nutrition','pain','continence'] loop
  if not exists(select 1 from public.care_assessment_risks r where r.assessment_id=v.id and r.tenant_id=v.tenant_id and r.risk_key=key) then raise exception 'Risikoeinschätzung fehlt; fehlend bedeutet nicht risikofrei.' using errcode='23514';end if;
 end loop;
 if exists(select 1 from public.care_assessment_risks r where r.assessment_id=v.id and (r.tenant_id<>v.tenant_id or nullif(btrim(r.evidence),'') is null or nullif(btrim(r.professional_rationale),'') is null or (r.risk_state in ('unclear','present','controlled') and (r.next_review_at is null or r.next_review_at<=clock_timestamp() or (nullif(btrim(r.counseling_provided),'') is null and not (r.refusal_documented and nullif(btrim(r.person_decision),'') is not null)) or not exists(select 1 from public.care_assessment_measures m where m.assessment_id=v.id and m.tenant_id=v.tenant_id and m.related_risk_key=r.risk_key and m.status in ('planned','active')))))) then raise exception 'Risiko ist nicht nachvollziehbar begründet, beraten oder versorgt.' using errcode='23514';end if;
 if not exists(select 1 from public.care_assessment_measures m where m.assessment_id=v.id and m.tenant_id=v.tenant_id) then raise exception 'Individuelle Maßnahmenplanung fehlt.' using errcode='23514';end if;
 if exists(select 1 from public.care_assessment_measures m where m.assessment_id=v.id and (m.tenant_id<>v.tenant_id or nullif(btrim(m.title),'') is null or nullif(btrim(m.personal_goal),'') is null or nullif(btrim(m.intervention),'') is null or nullif(btrim(m.timing),'') is null or nullif(btrim(m.frequency),'') is null or nullif(btrim(m.responsible_role),'') is null or nullif(btrim(m.evaluation_criteria),'') is null or (m.status in ('planned','active') and (m.next_evaluation_at is null or m.next_evaluation_at<=clock_timestamp())) or (m.related_risk_key is not null and not exists(select 1 from public.care_assessment_risks r where r.assessment_id=v.id and r.tenant_id=v.tenant_id and r.risk_key=m.related_risk_key)) or (m.related_topic_key is not null and not exists(select 1 from public.care_assessment_topics t where t.assessment_id=v.id and t.tenant_id=v.tenant_id and t.topic_key=m.related_topic_key)))) then raise exception 'Maßnahmenplanung ist unvollständig oder falsch verknüpft.' using errcode='23514';end if;
 for r in select x.* from public.care_assessment_risks x where x.assessment_id=v.id and x.tenant_id=v.tenant_id and (x.focused_assessment_key='caresuite_continence_v1' or (x.risk_key='continence' and x.risk_state in ('unclear','present','controlled'))) loop
  if r.risk_key is distinct from 'continence' or r.focused_assessment_key is distinct from 'caresuite_continence_v1' then raise exception 'Eigenes strukturiertes Kontinenzprofil fehlt oder Bezug ist falsch.' using errcode='23514';end if;
  perform care_private.validate_continence_profile(r.focused_assessment_result,true,clock_timestamp());
 end loop;
 old_status:=v.status;
 insert into care_private.assessment_review_authorizations(assessment_id,transaction_key,actor_id) values(v.id,pg_catalog.pg_current_xact_id()::text,actor);
 update public.care_assessments set status='professional_review',completed_at=coalesce(completed_at,clock_timestamp()),updated_by=auth.uid(),updated_at=clock_timestamp() where id=v.id returning * into v;
 delete from care_private.assessment_review_authorizations a where a.assessment_id=v.id and a.transaction_key=pg_catalog.pg_current_xact_id()::text;
 -- No automatic QPR rating, clinical approval or fabricated completeness value.
 snapshot:=jsonb_build_object('assessment',to_jsonb(v),'topics',coalesce((select jsonb_agg(to_jsonb(t)) from public.care_assessment_topics t where t.assessment_id=v.id and t.tenant_id=v.tenant_id),'[]'::jsonb),'risks',coalesce((select jsonb_agg(to_jsonb(r)) from public.care_assessment_risks r where r.assessment_id=v.id and r.tenant_id=v.tenant_id),'[]'::jsonb),'measures',coalesce((select jsonb_agg(to_jsonb(m)) from public.care_assessment_measures m where m.assessment_id=v.id and m.tenant_id=v.tenant_id),'[]'::jsonb));
 insert into public.care_assessment_versions(tenant_id,assessment_id,version,transition_from,transition_to,snapshot,created_by,actor_name)
 values(v.tenant_id,v.id,v.version,old_status,'professional_review',snapshot,auth.uid(),actor_name);
 return v.id;
end $$;
create or replace function public.submit_ambulatory_assessment_review(assessment_id uuid,expected_version integer)
returns uuid language sql security invoker set search_path='' as $$select care_private.submit_ambulatory_assessment_review(assessment_id,expected_version)$$;
revoke all on function care_private.submit_ambulatory_assessment_review(uuid,integer),public.submit_ambulatory_assessment_review(uuid,integer) from public,anon;
grant execute on function care_private.submit_ambulatory_assessment_review(uuid,integer),public.submit_ambulatory_assessment_review(uuid,integer) to authenticated;
commit;
