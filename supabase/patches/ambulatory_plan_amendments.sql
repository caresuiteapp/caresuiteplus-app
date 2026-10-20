-- LOCAL REVIEW ONLY. NOT EXECUTED. Requires CP13 assessment guards and CP34 evaluation_measure_reviews.sql.
-- Dedicated draft-only writer: one existing native measure; original evaluation and request remain immutable.
begin;
create table if not exists care_private.plan_amendment_requests(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),
 request_id uuid not null,assessment_id uuid not null references public.care_assessments(id),
 client_id uuid not null references public.clients(id),actor_id uuid not null references public.profiles(id),actor_name text not null,
 payload jsonb not null,result jsonb not null,recorded_at timestamptz not null,unique(tenant_id,request_id)
);
alter table care_private.plan_amendment_requests enable row level security;
revoke all on care_private.plan_amendment_requests from public,anon,authenticated;
drop trigger if exists plan_amendment_immutable on care_private.plan_amendment_requests;
create trigger plan_amendment_immutable before update or delete on care_private.plan_amendment_requests for each row execute function care_private.plan_eval_immutable();

create or replace function care_private.write_ambulatory_plan_amendment(request_id uuid,payload jsonb)
returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare tenant uuid:=public.current_tenant_id();actor uuid:=public.resolve_current_profile_id();name text;
 a public.care_assessments%rowtype;prior care_private.plan_amendment_requests%rowtype;
 target jsonb:=payload->'target';source jsonb:=payload->'source';proposed jsonb:=payload->'proposed';
 ref uuid;root_ref uuid;measure_ref uuid;native jsonb;current_source jsonb;review jsonb;original jsonb;
 prepared timestamptz;server_now timestamptz;result_id uuid:=gen_random_uuid();receipt jsonb;old_revision integer;f text;
begin
 perform care_private.plan_eval_fields(payload,array['version','source','target','measureId','preparedAt','proposed','reason','personDecision']);
 if request_id is null or payload->>'version' is distinct from '2026-10-10.1' or octet_length(payload::text)>262144 or not care_private.plan_eval_uuid(payload->'measureId') or not care_private.plan_eval_uuid(target->'assessmentId') or not care_private.plan_eval_uuid(source->'root'->'id') then raise exception 'Ungültiger Maßnahmenänderungsauftrag.' using errcode='23514';end if;
 ref:=(target->>'assessmentId')::uuid;root_ref:=(source->'root'->>'id')::uuid;measure_ref:=(payload->>'measureId')::uuid;
 if care_private.plan_eval_access(tenant,ref) is not true then raise exception 'Eigene aktive Pflegeakte fehlt.' using errcode='42501';end if;
 -- Same parent first, then source-root lock order as evaluation and child writers.
 select * into a from public.care_assessments x where x.id=ref and x.tenant_id=tenant and x.subject_type='client' for update;
 if a.id is null then raise exception 'Eigener Planstand fehlt.' using errcode='42501';end if;
 perform 1 from public.clients c where c.id=a.subject_id and c.tenant_id=tenant and c.status='active' and c.deleted_at is null for share;
 if not found then raise exception 'Pflegeakte nicht aktiv.' using errcode='42501';end if;
 perform 1 from public.client_module_assignments x where x.client_id=a.subject_id and x.tenant_id=tenant and x.module_key='pflege' and x.is_active and x.status not in ('inactive','deactivated','archiviert') for share;
 if not found or care_private.plan_eval_access(tenant,ref) is not true then raise exception 'Pflegezuordnung geändert.' using errcode='42501';end if;
 select nullif(btrim(p.display_name),'') into name from public.profiles p where p.id=actor and p.tenant_id=tenant and p.is_active and p.role_key not in ('client_portal','family_portal') for share;
 if name is null or length(name)>4000 then raise exception 'Aktives tatsächliches Profil fehlt.' using errcode='42501';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(tenant::text||':plan-amendment-request:'||request_id::text,0));
 select * into prior from care_private.plan_amendment_requests r where r.tenant_id=tenant and r.request_id=write_ambulatory_plan_amendment.request_id;
 if found then
  if prior.actor_id<>actor or prior.assessment_id<>ref or prior.payload<>payload then raise exception 'Originalanfrage mit anderer Person oder anderem Inhalt belegt.' using errcode='23514';end if;
  return prior.result; -- Original accepted replay does not reapply or depend on later source/plan changes.
 end if;
 if public.has_permission('pflege.assessments.manage') is not true or a.status not in ('draft','in_progress') then raise exception 'Maßnahmenänderung benötigt bearbeitbaren Entwurf und aktuelle Schreibberechtigung.' using errcode='42501';end if;
 perform pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.hashtextextended(tenant::text||':plan-eval-root:'||root_ref::text,0));
 server_now:=clock_timestamp();prepared:=care_private.plan_eval_time(payload->>'preparedAt');
 perform care_private.plan_eval_snapshot(target,server_now);
 perform care_private.plan_eval_snapshot(jsonb_set(target,'{measures}',jsonb_build_array(proposed)),server_now);
 perform care_private.plan_eval_text(payload,'reason');perform care_private.plan_eval_text(payload,'personDecision');
 if prepared>server_now or prepared<care_private.plan_eval_time(target->>'updatedAt') or jsonb_array_length(target->'measures')<>1 or target->'measures'->0->>'id'<>measure_ref::text or proposed->>'id'<>measure_ref::text or proposed=target->'measures'->0 then raise exception 'Tatsächliche Einzeländerung mit unveränderter Kennung fehlt.' using errcode='23514';end if;
 if target->>'tenantId'<>tenant::text or target->>'clientId'<>a.subject_id::text or (target->>'version')::integer<>a.version or (target->>'draftRevision')::integer<>a.draft_revision or target->>'status'<>a.status or care_private.plan_eval_time(target->>'updatedAt')<>a.updated_at then raise exception 'Zielplan inzwischen geändert oder fremd.' using errcode='40001';end if;
 select value into current_source from jsonb_array_elements(care_private.read_ambulatory_plan_evaluations(tenant,ref)->'records') where value->'root'->>'id'=root_ref::text;
 if current_source is null or current_source<>source or source->'events'->-1->'draft'->'entry'='null'::jsonb then raise exception 'Originalevaluation verändert oder zurückgenommen.' using errcode='40001';end if;
 perform care_private.plan_eval_measure_reviews(source->'events'->-1->'draft'->'entry',source->'root'->'snapshot',true);
 select value into review from jsonb_array_elements(source->'events'->-1->'draft'->'entry'->'measureReviews') where value->>'measureId'=measure_ref::text;
 select value into original from jsonb_array_elements(source->'root'->'snapshot'->'measures') where value->>'id'=measure_ref::text;
 if review is null or review->>'nextAction' is distinct from 'adjust' or original is null or original<>target->'measures'->0 or prepared<care_private.plan_eval_time(source->'events'->-1->>'recordedAt') or (source->'root'->'snapshot'->>'version')::integer>a.version then raise exception 'Ausdrückliche Einzelanpassung oder unveränderter Originalmaßnahmenbezug fehlt.' using errcode='23514';end if;
 if proposed->>'status' in ('planned','active') and (proposed->'nextEvaluationAt'='null'::jsonb or care_private.plan_eval_time(proposed->>'nextEvaluationAt')<=server_now) then raise exception 'Aktive/geplante Änderung benötigt zukünftigen Prüftermin.' using errcode='23514';end if;
 if proposed->'relatedTopicKey'<>'null'::jsonb and not exists(select 1 from public.care_assessment_topics t where t.assessment_id=ref and t.tenant_id=tenant and t.topic_key=proposed->>'relatedTopicKey') then raise exception 'Themenfeld gehört nicht zum Assessment.' using errcode='23514';end if;
 if proposed->'relatedRiskKey'<>'null'::jsonb and not exists(select 1 from public.care_assessment_risks r where r.assessment_id=ref and r.tenant_id=tenant and r.risk_key=proposed->>'relatedRiskKey') then raise exception 'Risikobezug gehört nicht zum Assessment.' using errcode='23514';end if;
 select jsonb_build_object('id',x.id::text,'title',x.title,'relatedTopicKey',x.related_topic_key,'relatedRiskKey',x.related_risk_key,'personalGoal',x.personal_goal,'intervention',x.intervention,'timing',x.timing,'frequency',x.frequency,'responsibleRole',x.responsible_role,'personContribution',x.person_contribution,'relativesContribution',x.relatives_contribution,'warningSigns',x.warning_signs,'escalationPath',x.escalation_path,'evaluationCriteria',x.evaluation_criteria,'nextEvaluationAt',x.next_evaluation_at,'status',x.status) into native from public.care_assessment_measures x where x.id=measure_ref and x.assessment_id=ref and x.tenant_id=tenant for update;
 if native is null or native-'nextEvaluationAt'<>original-'nextEvaluationAt' or ((native->'nextEvaluationAt'='null'::jsonb)<>(original->'nextEvaluationAt'='null'::jsonb)) or (original->'nextEvaluationAt'<>'null'::jsonb and care_private.plan_eval_time(original->>'nextEvaluationAt')<>(native->>'nextEvaluationAt')::timestamptz) then raise exception 'Originalmaßnahme inzwischen geändert.' using errcode='40001';end if;
 old_revision:=a.draft_revision;
 update public.care_assessment_measures set title=proposed->>'title',related_topic_key=proposed->>'relatedTopicKey',related_risk_key=proposed->>'relatedRiskKey',personal_goal=proposed->>'personalGoal',intervention=proposed->>'intervention',timing=proposed->>'timing',frequency=proposed->>'frequency',responsible_role=proposed->>'responsibleRole',person_contribution=proposed->>'personContribution',relatives_contribution=proposed->>'relativesContribution',warning_signs=proposed->>'warningSigns',escalation_path=proposed->>'escalationPath',evaluation_criteria=proposed->>'evaluationCriteria',next_evaluation_at=(proposed->>'nextEvaluationAt')::timestamptz,status=proposed->>'status',updated_at=server_now where id=measure_ref and assessment_id=ref and tenant_id=tenant;
 if not found then raise exception 'Geänderte Originalmaßnahme fehlt.' using errcode='40001';end if;
 update public.care_assessments set change_summary=concat_ws(E'\n',nullif(change_summary,''),'Maßnahmenänderung '||result_id::text||' aus Evaluation '||(source->>'headId')||': '||(payload->>'reason')),open_measure_count=(select count(*) from public.care_assessment_measures m where m.assessment_id=ref and m.tenant_id=tenant and m.status in ('planned','active')),updated_at=server_now,updated_by=auth.uid() where id=ref and tenant_id=tenant returning * into a;
 if a.draft_revision<=old_revision or a.version<>(target->>'version')::integer or a.status<>target->>'status' then raise exception 'Entwurfrevision oder Status nicht bestätigt.' using errcode='23514';end if;
 receipt:=jsonb_build_object('id',result_id::text,'tenantId',tenant::text,'assessmentId',ref::text,'clientId',a.subject_id::text,'requestId',request_id::text,'sourceRootId',root_ref::text,'sourceHeadId',source->>'headId','measureId',measure_ref::text,'previousRevision',old_revision,'draftRevision',a.draft_revision,'status',a.status,'planVersion',a.version,'appliedMeasure',proposed);
 insert into care_private.plan_amendment_requests(id,tenant_id,request_id,assessment_id,client_id,actor_id,actor_name,payload,result,recorded_at) values(result_id,tenant,request_id,ref,a.subject_id,actor,name,payload,receipt,server_now);
 return receipt;
end $$;
create or replace function public.write_ambulatory_plan_amendment(request_id uuid,payload jsonb) returns jsonb language sql security invoker set search_path='' as $$select care_private.write_ambulatory_plan_amendment(request_id,payload)$$;
revoke all on function care_private.write_ambulatory_plan_amendment(uuid,jsonb),public.write_ambulatory_plan_amendment(uuid,jsonb) from public,anon;
grant execute on function care_private.write_ambulatory_plan_amendment(uuid,jsonb),public.write_ambulatory_plan_amendment(uuid,jsonb) to authenticated;
commit;
