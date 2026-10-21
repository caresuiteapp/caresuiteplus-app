-- LOCAL REVIEW ONLY. NOT EXECUTED. Apply after ambulatory_plan_amendments.sql.
-- Client measures retain IDs and created_at on general draft saves. Stationary path unchanged.
begin;
create table if not exists care_private.assessment_write_authorizations(
 assessment_id uuid not null,transaction_key text not null,actor_id uuid not null,
 primary key(assessment_id,transaction_key)
);
alter table care_private.assessment_write_authorizations enable row level security;
revoke all on care_private.assessment_write_authorizations from public,anon,authenticated;
CREATE OR REPLACE FUNCTION care_private.save_care_assessment_stable(p_assessment_id UUID, p_payload JSONB)
RETURNS public.care_assessments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v public.care_assessments;
  p JSONB := COALESCE(p_payload->'assessment', '{}'::JSONB);
  item JSONB;
  ids uuid[]:='{}';
  native_id uuid;
BEGIN
  SELECT * INTO v FROM public.care_assessments
  WHERE id = p_assessment_id AND tenant_id = public.current_tenant_id() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SIS / Assessment wurde nicht gefunden.'; END IF;
  IF NOT public.can_manage_care_assessment(v.subject_type) THEN RAISE EXCEPTION 'Keine Berechtigung.'; END IF;
  IF v.status IN ('approved', 'superseded', 'archived') THEN RAISE EXCEPTION 'Assessment ist unveränderbar.'; END IF;
  IF v.subject_type='client' THEN
    IF NOT EXISTS(SELECT 1 FROM care_private.assessment_write_authorizations z WHERE z.assessment_id=v.id AND z.transaction_key=pg_catalog.pg_current_xact_id()::text AND z.actor_id=public.resolve_current_profile_id()) THEN RAISE EXCEPTION 'Ambulanter Entwurf benötigt den Originalrequest-Writer.' USING errcode='42501';END IF;
    IF jsonb_typeof(p_payload->'measures') IS DISTINCT FROM 'array' OR jsonb_array_length(p_payload->'measures')>200 THEN RAISE EXCEPTION 'Maßnahmenliste ungültig.' USING errcode='23514';END IF;
    FOR item IN SELECT value FROM jsonb_array_elements(p_payload->'measures') LOOP
      IF jsonb_typeof(item) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Maßnahmendatensatz ungültig.' USING errcode='23514';END IF;
      IF item ? 'id' THEN
        IF NOT care_private.plan_eval_uuid(item->'id') THEN RAISE EXCEPTION 'Native Maßnahmenkennung ungültig.' USING errcode='23514';END IF;
        native_id:=(item->>'id')::uuid;
        IF native_id=ANY(ids) OR NOT EXISTS(SELECT 1 FROM public.care_assessment_measures m WHERE m.id=native_id AND m.assessment_id=v.id AND m.tenant_id=v.tenant_id) THEN RAISE EXCEPTION 'Maßnahme ist doppelt, fremd, gelöscht oder nicht gespeichert.' USING errcode='23514';END IF;
        ids:=array_append(ids,native_id);
      END IF;
    END LOOP;
  END IF;

  UPDATE public.care_assessments SET
    reason = COALESCE(p->>'reason', reason),
    reason_detail = COALESCE(p->>'reason_detail', ''),
    next_review_at = NULLIF(p->>'next_review_at', '')::TIMESTAMPTZ,
    person_statement = COALESCE(p->>'person_statement', ''),
    statement_source = COALESCE(p->>'statement_source', statement_source),
    statement_source_name = COALESCE(p->>'statement_source_name', ''),
    conversation_participants = ARRAY(SELECT jsonb_array_elements_text(COALESCE(p->'conversation_participants', '[]'))),
    communication_support = COALESCE(p->>'communication_support', ''),
    information_source_summary = COALESCE(p->>'information_source_summary', ''),
    professional_summary = COALESCE(p->>'professional_summary', ''),
    change_summary = COALESCE(p->>'change_summary', ''),
    destabilization_summary = COALESCE(p->>'destabilization_summary', ''),
    assessor_name_snapshot = COALESCE(p->>'assessor_name_snapshot', assessor_name_snapshot),
    completeness_percent = COALESCE((p->>'completeness_percent')::INTEGER, 0),
    active_risk_count = COALESCE((p->>'active_risk_count')::INTEGER, 0),
    urgent_risk_count = COALESCE((p->>'urgent_risk_count')::INTEGER, 0),
    open_measure_count = COALESCE((p->>'open_measure_count')::INTEGER, 0),
    updated_by = auth.uid(), updated_at = CASE WHEN v.subject_type='client' THEN clock_timestamp() ELSE NOW() END
  WHERE id = p_assessment_id RETURNING * INTO v;
  DELETE FROM public.care_assessment_topics WHERE assessment_id = p_assessment_id;
  DELETE FROM public.care_assessment_risks WHERE assessment_id = p_assessment_id;
  IF v.subject_type='client' THEN
    DELETE FROM public.care_assessment_measures WHERE assessment_id=v.id AND tenant_id=v.tenant_id AND NOT (id=ANY(ids));
  ELSE
    DELETE FROM public.care_assessment_measures WHERE assessment_id=p_assessment_id;
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(COALESCE(p_payload->'topics', '[]')) LOOP
    INSERT INTO public.care_assessment_topics (
      tenant_id, assessment_id, topic_key, person_perspective, resources, impairments,
      wishes, habits_biography, professional_assessment, action_needed, information_sources
    ) VALUES (
      v.tenant_id, v.id, item->>'topicKey', COALESCE(item->>'personPerspective',''),
      COALESCE(item->>'resources',''), COALESCE(item->>'impairments',''), COALESCE(item->>'wishes',''),
      COALESCE(item->>'habitsBiography',''), COALESCE(item->>'professionalAssessment',''),
      COALESCE(item->>'actionNeeded',''),
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(item->'informationSources','[]')))
    );
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(COALESCE(p_payload->'risks', '[]')) LOOP
    INSERT INTO public.care_assessment_risks (
      tenant_id, assessment_id, risk_key, risk_state, urgency, evidence, protective_factors,
      professional_rationale, counseling_provided, person_decision, refusal_documented,
      focused_assessment_key, focused_assessment_result, linked_bodymap_marker_ids, next_review_at
    ) VALUES (
      v.tenant_id, v.id, item->>'riskKey', COALESCE(item->>'state','unclear'),
      COALESCE(item->>'urgency','routine'), COALESCE(item->>'evidence',''),
      COALESCE(item->>'protectiveFactors',''), COALESCE(item->>'professionalRationale',''),
      COALESCE(item->>'counselingProvided',''), COALESCE(item->>'personDecision',''),
      COALESCE((item->>'refusalDocumented')::BOOLEAN,FALSE), NULLIF(item->>'focusedAssessmentKey',''),
      COALESCE(item->'focusedAssessmentResult','{}'),
      ARRAY(SELECT x::UUID FROM jsonb_array_elements_text(COALESCE(item->'linkedBodyMapMarkerIds','[]')) x),
      NULLIF(item->>'nextReviewAt','')::TIMESTAMPTZ
    );
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(COALESCE(p_payload->'measures', '[]')) LOOP
    IF v.subject_type='client' AND item ? 'id' THEN
      UPDATE public.care_assessment_measures SET title=COALESCE(item->>'title',''),related_topic_key=NULLIF(item->>'relatedTopicKey',''),related_risk_key=NULLIF(item->>'relatedRiskKey',''),personal_goal=COALESCE(item->>'personalGoal',''),intervention=COALESCE(item->>'intervention',''),timing=COALESCE(item->>'timing',''),frequency=COALESCE(item->>'frequency',''),responsible_role=COALESCE(item->>'responsibleRole',''),person_contribution=COALESCE(item->>'personContribution',''),relatives_contribution=COALESCE(item->>'relativesContribution',''),warning_signs=COALESCE(item->>'warningSigns',''),escalation_path=COALESCE(item->>'escalationPath',''),evaluation_criteria=COALESCE(item->>'evaluationCriteria',''),next_evaluation_at=NULLIF(item->>'nextEvaluationAt','')::TIMESTAMPTZ,status=COALESCE(item->>'status','planned'),updated_at=clock_timestamp() WHERE id=(item->>'id')::uuid AND assessment_id=v.id AND tenant_id=v.tenant_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Originalmaßnahme fehlt.' USING errcode='40001';END IF;
    ELSE
    INSERT INTO public.care_assessment_measures (
      tenant_id, assessment_id, title, related_topic_key, related_risk_key, personal_goal,
      intervention, timing, frequency, responsible_role, person_contribution, relatives_contribution,
      warning_signs, escalation_path, evaluation_criteria, next_evaluation_at, status
    ) VALUES (
      v.tenant_id, v.id, COALESCE(NULLIF(item->>'title',''),'Pflegemaßnahme'),
      NULLIF(item->>'relatedTopicKey',''), NULLIF(item->>'relatedRiskKey',''),
      COALESCE(item->>'personalGoal',''), COALESCE(item->>'intervention',''),
      COALESCE(item->>'timing',''), COALESCE(item->>'frequency',''),
      COALESCE(item->>'responsibleRole',''), COALESCE(item->>'personContribution',''),
      COALESCE(item->>'relativesContribution',''), COALESCE(item->>'warningSigns',''),
      COALESCE(item->>'escalationPath',''), COALESCE(item->>'evaluationCriteria',''),
      NULLIF(item->>'nextEvaluationAt','')::TIMESTAMPTZ, COALESCE(item->>'status','planned')
    );
    END IF;
  END LOOP;
  RETURN v;
END;
$$;

create or replace function care_private.write_ambulatory_assessment_draft(request_id uuid,payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.care_assessments%rowtype;previous care_private.assessment_draft_requests%rowtype;actor uuid:=public.resolve_current_profile_id();tenant uuid:=public.current_tenant_id();ref uuid;revision integer;body jsonb;receipt jsonb;actor_name text;tab text;r jsonb;
begin
 if auth.uid() is null or tenant is null or public.has_permission('pflege.assessments.manage') is not true or public.has_permission('pflege.plans.view') is not true then raise exception 'Keine Berechtigung.' using errcode='42501';end if;
 select coalesce(nullif(p.display_name,''),p.email,'Pflegefachperson') into actor_name from public.profiles p where p.id=actor and p.tenant_id=tenant and p.is_active;
 if actor_name is null then raise exception 'Kein aktives Profil.' using errcode='42501';end if;
 if request_id is null or jsonb_typeof(payload) is distinct from 'object' or octet_length(payload::text)>300000 or coalesce(payload->>'intent','') not in ('save','review') then raise exception 'Ungültige Speicheranfrage.' using errcode='23514';end if;
 ref:=(payload->>'assessmentId')::uuid;revision:=(payload->>'expectedRevision')::integer;
 select * into v from public.care_assessments a where a.id=ref and a.tenant_id=tenant and a.subject_type='client' for update;
 if v.id is null or public.is_active_pfleger_client(v.subject_id) is not true then raise exception 'Kein zugänglicher aktiver Pflegefall.' using errcode='42501';end if;
 select * into previous from care_private.assessment_draft_requests r where r.tenant_id=tenant and r.request_id=write_ambulatory_assessment_draft.request_id;
 if previous.request_id is not null then
  if previous.assessment_id<>ref or previous.actor_id<>actor or previous.payload<>payload then raise exception 'Anfrage-ID bereits mit anderen Daten verwendet.' using errcode='23514';end if;
  return previous.result;
 end if;
 if revision is null or revision<>v.draft_revision then raise exception 'Zwischenstand geändert. Gespeicherten Stand laden und Änderungen abgleichen.' using errcode='40001';end if;
 if v.status not in ('draft','in_progress') then raise exception 'Assessment ist nicht mehr bearbeitbar.' using errcode='23514';end if;
 if octet_length(coalesce(payload->>'payloadJson',''))>262144 then raise exception 'Assessment ist zu umfangreich.' using errcode='23514';end if;
 body:=(payload->>'payloadJson')::jsonb;
 if jsonb_typeof(body) is distinct from 'object' or jsonb_typeof(body->'assessment') is distinct from 'object' then raise exception 'Assessmentstruktur fehlt.' using errcode='23514';end if;
 foreach tab in array array['topics','risks','measures'] loop
  if jsonb_typeof(body->tab) is distinct from 'array' then raise exception 'Assessmentkindliste fehlt.' using errcode='23514';end if;
  if jsonb_array_length(body->tab)>200 then raise exception 'Assessmentkindliste zu umfangreich.' using errcode='23514';end if;
 end loop;
 for r in select value from jsonb_array_elements(body->'risks') loop
  if r->>'focusedAssessmentKey'='caresuite_continence_v1' then
   if r->>'riskKey' is distinct from 'continence' then raise exception 'Kontinenzprofil benötigt Kontinenzbezug.' using errcode='23514';end if;
   perform care_private.validate_continence_profile(r->'focusedAssessmentResult',false,clock_timestamp());
  end if;
 end loop;
 -- A draft never asserts a clinical quality rating or trusts a supplied actor name.
 body:=jsonb_set(body,'{assessment,assessor_name_snapshot}',to_jsonb(actor_name));
 body:=jsonb_set(body,'{assessment,completeness_percent}','0'::jsonb);
 body:=jsonb_set(body,'{assessment,active_risk_count}',to_jsonb((select count(*) from jsonb_array_elements(body->'risks') r where r->>'state'='present')));
 body:=jsonb_set(body,'{assessment,urgent_risk_count}',to_jsonb((select count(*) from jsonb_array_elements(body->'risks') r where r->>'urgency' in ('urgent','immediate'))));
 body:=jsonb_set(body,'{assessment,open_measure_count}',to_jsonb((select count(*) from jsonb_array_elements(body->'measures') m where m->>'status' in ('planned','active'))));
 -- Existing RPC already saves parent and its three child lists atomically.
 insert into care_private.assessment_write_authorizations(assessment_id,transaction_key,actor_id) values(ref,pg_catalog.pg_current_xact_id()::text,actor);
 perform care_private.save_care_assessment_stable(ref,body);
 delete from care_private.assessment_write_authorizations where assessment_id=ref and transaction_key=pg_catalog.pg_current_xact_id()::text and actor_id=actor;
 select * into v from public.care_assessments a where a.id=ref;
 if payload->>'intent'='review' then
  perform care_private.submit_ambulatory_assessment_review(ref,v.version);
  select * into v from public.care_assessments a where a.id=ref;
 end if;
 receipt:=jsonb_build_object('assessmentId',v.id,'draftRevision',v.draft_revision,'status',v.status);
 insert into care_private.assessment_draft_requests(tenant_id,request_id,assessment_id,actor_id,payload,result) values(tenant,request_id,ref,actor,payload,receipt);
 return receipt;
end $$;

create or replace function public.save_care_assessment(p_assessment_id uuid,p_payload jsonb) returns public.care_assessments language sql security invoker set search_path='' as $$select care_private.save_care_assessment_stable(p_assessment_id,p_payload)$$;
revoke all on function care_private.save_care_assessment_stable(uuid,jsonb),public.save_care_assessment(uuid,jsonb) from public,anon;
grant execute on function care_private.save_care_assessment_stable(uuid,jsonb),public.save_care_assessment(uuid,jsonb) to authenticated;
commit;
