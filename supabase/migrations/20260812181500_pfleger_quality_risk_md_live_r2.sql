-- CareSuite HealthOS — PFLEGE TEIL 3 · QUALITÄT, RISIKO & MD LIVE R2
-- Risikoreviews, Maßnahmenfortschreibung, Abweichungsregelkreis und MD-Prüfbereitschaft.

INSERT INTO public.permission_catalog
  (key,module,category,label,description,risk_level,requires_audit)
VALUES
 ('pflege.risks.view','pflege','quality','Pflege-Risiken ansehen','SIS-Risiken und fällige Risikoreviews einsehen.','high',TRUE),
 ('pflege.risks.manage','pflege','quality','Pflege-Risiken bewerten','Risikostatus, Dringlichkeit und fachliche Begründung fortschreiben.','critical',TRUE),
 ('pflege.measures.review','pflege','quality','Pflegemaßnahmen fortschreiben','Maßnahmen wirksamkeitsbezogen bestätigen, ändern, pausieren oder abschließen.','critical',TRUE),
 ('pflege.deviations.view','pflege','quality','Qualitätsabweichungen ansehen','Abweichungen, Fristen und Wirksamkeitskontrollen einsehen.','high',TRUE),
 ('pflege.deviations.manage','pflege','quality','Qualitätsabweichungen bearbeiten','Abweichungen bewerten, Maßnahmen zuweisen und nach Wirksamkeitskontrolle schließen.','critical',TRUE),
 ('pflege.md.readiness','pflege','quality','MD-Prüfbereitschaft ansehen','Nachweisbasierte Prüfbereitschaft je aktivem Pflegefall einsehen.','high',TRUE)
ON CONFLICT(key) DO UPDATE SET module=EXCLUDED.module,category=EXCLUDED.category,label=EXCLUDED.label,
 description=EXCLUDED.description,risk_level=EXCLUDED.risk_level,requires_audit=EXCLUDED.requires_audit,updated_at=NOW();

INSERT INTO public.role_permissions(role_id,permission_key)
SELECT r.id,p.key FROM public.roles r CROSS JOIN (VALUES
 ('pflege.risks.view'),('pflege.risks.manage'),('pflege.measures.review'),
 ('pflege.deviations.view'),('pflege.deviations.manage'),('pflege.md.readiness')) p(key)
WHERE r.key IN ('owner','admin','management','geschaeftsfuehrung','business_admin','business_manager','nurse','pdl','pflege','pflegefachkraft')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_template_permissions(role_template_id,permission_key,allowed)
SELECT rt.id,p.key,TRUE FROM public.role_templates rt CROSS JOIN (VALUES
 ('pflege.risks.view'),('pflege.risks.manage'),('pflege.measures.review'),
 ('pflege.deviations.view'),('pflege.deviations.manage'),('pflege.md.readiness')) p(key)
WHERE rt.tenant_id IS NULL AND rt.role_key IN ('business_admin','business_manager','nurse')
ON CONFLICT(role_template_id,permission_key) DO UPDATE SET allowed=TRUE,updated_at=NOW();

CREATE TABLE IF NOT EXISTS public.care_plan_measure_reviews(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
 care_plan_id UUID NOT NULL REFERENCES public.care_plans(id) ON DELETE CASCADE,
 care_plan_item_id UUID NOT NULL REFERENCES public.care_plan_items(id) ON DELETE RESTRICT,
 decision TEXT NOT NULL CHECK(decision IN('continue','change','pause','complete')),
 observed_effect TEXT NOT NULL,
 person_feedback TEXT NOT NULL DEFAULT '',
 professional_rationale TEXT NOT NULL,
 changed_intervention TEXT NOT NULL DEFAULT '',
 changed_frequency TEXT NOT NULL DEFAULT '',
 next_evaluation_at TIMESTAMPTZ,
 reviewer_profile_id UUID,
 reviewer_name_snapshot TEXT NOT NULL,
 reviewed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS public.care_quality_deviations(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
 care_plan_id UUID REFERENCES public.care_plans(id) ON DELETE SET NULL,
 source_type TEXT NOT NULL CHECK(source_type IN('visit','evaluation','risk','medication','treatment','wound','documentation','complaint','other')),
 source_id UUID,
 category TEXT NOT NULL,
 severity TEXT NOT NULL CHECK(severity IN('low','medium','high','critical')),
 title TEXT NOT NULL,
 description TEXT NOT NULL,
 immediate_action TEXT NOT NULL DEFAULT '',
 root_cause TEXT NOT NULL DEFAULT '',
 corrective_action TEXT NOT NULL DEFAULT '',
 responsible_name TEXT NOT NULL DEFAULT '',
 due_at TIMESTAMPTZ,
 status TEXT NOT NULL DEFAULT 'identified' CHECK(status IN('identified','assessed','in_progress','effectiveness_check','closed','cancelled')),
 recurring_problem BOOLEAN NOT NULL DEFAULT FALSE,
 effectiveness_result TEXT NOT NULL DEFAULT '',
 effectiveness_checked_at TIMESTAMPTZ,
 closed_at TIMESTAMPTZ,
 created_by UUID,
 created_by_name TEXT NOT NULL,
 updated_by UUID,
 updated_by_name TEXT NOT NULL DEFAULT '',
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 CHECK(status NOT IN('in_progress','effectiveness_check','closed') OR trim(corrective_action) <> ''),
 CHECK(status <> 'closed' OR (trim(effectiveness_result) <> '' AND effectiveness_checked_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_measure_reviews_item ON public.care_plan_measure_reviews(tenant_id,care_plan_item_id,reviewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_quality_deviations_queue ON public.care_quality_deviations(tenant_id,status,severity,due_at);
CREATE INDEX IF NOT EXISTS idx_quality_deviations_client ON public.care_quality_deviations(tenant_id,client_id,created_at DESC);

DROP TRIGGER IF EXISTS set_care_quality_deviations_updated_at ON public.care_quality_deviations;
CREATE TRIGGER set_care_quality_deviations_updated_at BEFORE UPDATE ON public.care_quality_deviations
 FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.care_plan_measure_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_quality_deviations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS measure_reviews_live_read ON public.care_plan_measure_reviews;
CREATE POLICY measure_reviews_live_read ON public.care_plan_measure_reviews FOR SELECT TO authenticated
 USING(tenant_id=public.current_tenant_id() AND (public.has_permission('pflege.measures.review') OR public.can_view_pfleger_core()));
DROP POLICY IF EXISTS quality_deviations_live_read ON public.care_quality_deviations;
CREATE POLICY quality_deviations_live_read ON public.care_quality_deviations FOR SELECT TO authenticated
 USING(tenant_id=public.current_tenant_id() AND public.has_permission('pflege.deviations.view'));
REVOKE INSERT,UPDATE,DELETE ON public.care_plan_measure_reviews,public.care_quality_deviations FROM authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.care_assessment_risks FROM authenticated;
REVOKE UPDATE,DELETE ON public.care_plan_items FROM authenticated;
GRANT SELECT ON public.care_plan_measure_reviews,public.care_quality_deviations TO authenticated;

CREATE OR REPLACE FUNCTION public.review_care_risk(p_risk_id UUID,p_payload JSONB)
RETURNS public.care_assessment_risks LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.care_assessment_risks; before_row JSONB; client_id UUID; t UUID:=public.current_tenant_id();
 state_value TEXT:=COALESCE(NULLIF(p_payload->>'state',''),'unclear'); urgency_value TEXT:=COALESCE(NULLIF(p_payload->>'urgency',''),'routine');
BEGIN
 IF NOT public.has_permission('pflege.risks.manage') THEN RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501'; END IF;
 IF state_value NOT IN('none','unclear','present','controlled') OR urgency_value NOT IN('routine','timely','urgent','immediate') THEN
  RAISE EXCEPTION 'Ungültiger Risiko- oder Dringlichkeitsstatus.' USING ERRCODE='23514';
 END IF;
 SELECT to_jsonb(cr),ca.subject_id INTO before_row,client_id FROM public.care_assessment_risks cr
 JOIN public.care_assessments ca ON ca.id=cr.assessment_id AND ca.tenant_id=cr.tenant_id
 WHERE cr.id=p_risk_id AND cr.tenant_id=t AND ca.subject_type='client' FOR UPDATE OF cr;
 IF client_id IS NULL OR NOT public.is_active_pfleger_client(client_id) THEN RAISE EXCEPTION 'Kein aktiver Pflegefall.' USING ERRCODE='23514'; END IF;
 IF trim(COALESCE(p_payload->>'professionalRationale',''))='' THEN RAISE EXCEPTION 'Fachliche Begründung ist erforderlich.' USING ERRCODE='23514'; END IF;
 UPDATE public.care_assessment_risks SET risk_state=state_value,urgency=urgency_value,
  evidence=COALESCE(p_payload->>'evidence',''),protective_factors=COALESCE(p_payload->>'protectiveFactors',''),
  professional_rationale=trim(p_payload->>'professionalRationale'),counseling_provided=COALESCE(p_payload->>'counselingProvided',''),
  person_decision=COALESCE(p_payload->>'personDecision',''),refusal_documented=COALESCE((p_payload->>'refusalDocumented')::BOOLEAN,FALSE),
  next_review_at=NULLIF(p_payload->>'nextReviewAt','')::TIMESTAMPTZ,updated_at=clock_timestamp()
 WHERE id=p_risk_id AND tenant_id=t RETURNING * INTO r;
 INSERT INTO public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,before_data,after_data,actor_id,actor_name)
 VALUES(t,client_id,'care_risk',r.id,'review','Pflege-Risiko fachlich überprüft.',before_row,to_jsonb(r),public.clinical_actor_id(),public.clinical_actor_name());
 RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.review_care_plan_measure(p_item_id UUID,p_payload JSONB)
RETURNS public.care_plan_measure_reviews LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE review_row public.care_plan_measure_reviews; care_plan_id UUID; client_id UUID; t UUID:=public.current_tenant_id();
 decision_value TEXT:=COALESCE(NULLIF(p_payload->>'decision',''),'continue'); next_status TEXT;
BEGIN
 IF NOT public.has_permission('pflege.measures.review') THEN RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501'; END IF;
 SELECT i.care_plan_id,p.client_id INTO care_plan_id,client_id FROM public.care_plan_items i JOIN public.care_plans p ON p.id=i.care_plan_id AND p.tenant_id=i.tenant_id
 WHERE i.id=p_item_id AND i.tenant_id=t FOR UPDATE OF i;
 IF client_id IS NULL OR NOT public.is_active_pfleger_client(client_id) THEN RAISE EXCEPTION 'Kein aktiver Pflegefall.' USING ERRCODE='23514'; END IF;
 IF decision_value NOT IN('continue','change','pause','complete') THEN RAISE EXCEPTION 'Ungültige Maßnahmenentscheidung.' USING ERRCODE='23514'; END IF;
 IF trim(COALESCE(p_payload->>'observedEffect',''))='' OR trim(COALESCE(p_payload->>'professionalRationale',''))='' THEN
  RAISE EXCEPTION 'Wirkung und fachliche Begründung sind erforderlich.' USING ERRCODE='23514';
 END IF;
 next_status:=CASE decision_value WHEN 'pause' THEN 'paused' WHEN 'complete' THEN 'completed' ELSE 'active' END;
 INSERT INTO public.care_plan_measure_reviews(tenant_id,client_id,care_plan_id,care_plan_item_id,decision,observed_effect,
  person_feedback,professional_rationale,changed_intervention,changed_frequency,next_evaluation_at,reviewer_profile_id,reviewer_name_snapshot)
 VALUES(t,client_id,care_plan_id,p_item_id,decision_value,trim(p_payload->>'observedEffect'),COALESCE(p_payload->>'personFeedback',''),
  trim(p_payload->>'professionalRationale'),COALESCE(p_payload->>'changedIntervention',''),COALESCE(p_payload->>'changedFrequency',''),
  NULLIF(p_payload->>'nextEvaluationAt','')::TIMESTAMPTZ,public.clinical_actor_id(),public.clinical_actor_name()) RETURNING * INTO review_row;
 UPDATE public.care_plan_items SET status=next_status,
  intervention=CASE WHEN decision_value='change' AND trim(COALESCE(p_payload->>'changedIntervention',''))<>'' THEN trim(p_payload->>'changedIntervention') ELSE intervention END,
  frequency=CASE WHEN decision_value='change' AND trim(COALESCE(p_payload->>'changedFrequency',''))<>'' THEN trim(p_payload->>'changedFrequency') ELSE frequency END,
  next_evaluation_date=NULLIF(p_payload->>'nextEvaluationAt','')::DATE,updated_by=auth.uid(),updated_at=clock_timestamp()
 WHERE id=p_item_id AND tenant_id=t;
 INSERT INTO public.care_audit_events(tenant_id,client_id,care_plan_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name)
 VALUES(t,client_id,care_plan_id,'care_plan_measure_review',review_row.id,decision_value,'Pflegemaßnahme fortgeschrieben.',to_jsonb(review_row),public.clinical_actor_id(),public.clinical_actor_name());
 RETURN review_row;
END $$;

CREATE OR REPLACE FUNCTION public.create_care_quality_deviation(p_client_id UUID,p_care_plan_id UUID,p_payload JSONB)
RETURNS public.care_quality_deviations LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.care_quality_deviations; t UUID:=public.current_tenant_id();
BEGIN
 IF NOT public.has_permission('pflege.deviations.manage') THEN RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501'; END IF;
 IF p_client_id IS NOT NULL AND NOT public.is_active_pfleger_client(p_client_id) THEN RAISE EXCEPTION 'Kein aktiver Pflegefall.' USING ERRCODE='23514'; END IF;
 IF trim(COALESCE(p_payload->>'title',''))='' OR trim(COALESCE(p_payload->>'description',''))='' THEN RAISE EXCEPTION 'Titel und Beschreibung sind erforderlich.' USING ERRCODE='23514'; END IF;
 INSERT INTO public.care_quality_deviations(tenant_id,client_id,care_plan_id,source_type,source_id,category,severity,title,description,
  immediate_action,recurring_problem,created_by,created_by_name,updated_by,updated_by_name)
 VALUES(t,p_client_id,p_care_plan_id,COALESCE(NULLIF(p_payload->>'sourceType',''),'other'),NULLIF(p_payload->>'sourceId','')::UUID,
  trim(p_payload->>'category'),COALESCE(NULLIF(p_payload->>'severity',''),'medium'),trim(p_payload->>'title'),trim(p_payload->>'description'),
  COALESCE(p_payload->>'immediateAction',''),COALESCE((p_payload->>'recurringProblem')::BOOLEAN,FALSE),public.clinical_actor_id(),public.clinical_actor_name(),public.clinical_actor_id(),public.clinical_actor_name()) RETURNING * INTO r;
 INSERT INTO public.care_audit_events(tenant_id,client_id,care_plan_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name)
 VALUES(t,p_client_id,p_care_plan_id,'care_quality_deviation',r.id,'identified','Qualitätsabweichung festgestellt.',to_jsonb(r),public.clinical_actor_id(),public.clinical_actor_name());
 RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.advance_care_quality_deviation(p_deviation_id UUID,p_payload JSONB)
RETURNS public.care_quality_deviations LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.care_quality_deviations; old JSONB; t UUID:=public.current_tenant_id(); new_status TEXT:=p_payload->>'status';
BEGIN
 IF NOT public.has_permission('pflege.deviations.manage') THEN RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501'; END IF;
 IF new_status NOT IN('assessed','in_progress','effectiveness_check','closed','cancelled') THEN RAISE EXCEPTION 'Ungültiger Folgestatus.' USING ERRCODE='23514'; END IF;
 SELECT to_jsonb(d) INTO old FROM public.care_quality_deviations d WHERE id=p_deviation_id AND tenant_id=t FOR UPDATE;
 IF old IS NULL THEN RAISE EXCEPTION 'Abweichung nicht gefunden.'; END IF;
 UPDATE public.care_quality_deviations SET status=new_status,root_cause=COALESCE(p_payload->>'rootCause',root_cause),
  corrective_action=COALESCE(p_payload->>'correctiveAction',corrective_action),responsible_name=COALESCE(p_payload->>'responsibleName',responsible_name),
  due_at=COALESCE(NULLIF(p_payload->>'dueAt','')::TIMESTAMPTZ,due_at),effectiveness_result=COALESCE(p_payload->>'effectivenessResult',effectiveness_result),
  effectiveness_checked_at=CASE WHEN new_status='closed' THEN clock_timestamp() ELSE effectiveness_checked_at END,
  closed_at=CASE WHEN new_status='closed' THEN clock_timestamp() ELSE NULL END,updated_by=public.clinical_actor_id(),updated_by_name=public.clinical_actor_name()
 WHERE id=p_deviation_id AND tenant_id=t RETURNING * INTO r;
 INSERT INTO public.care_audit_events(tenant_id,client_id,care_plan_id,entity_type,entity_id,action,summary,before_data,after_data,actor_id,actor_name)
 VALUES(t,r.client_id,r.care_plan_id,'care_quality_deviation',r.id,new_status,'Qualitätsabweichung fortgeschrieben.',old,to_jsonb(r),public.clinical_actor_id(),public.clinical_actor_name());
 RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.get_pfleger_md_readiness()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
WITH active_plans AS (
 SELECT p.id,p.client_id,p.title,c.first_name,c.last_name FROM public.care_plans p
 JOIN public.clients c ON c.id=p.client_id AND c.tenant_id=p.tenant_id
 WHERE p.tenant_id=public.current_tenant_id() AND p.status='active' AND public.is_active_pfleger_client(p.client_id)
), checks AS (
 SELECT p.*,
  EXISTS(SELECT 1 FROM public.care_assessments a WHERE a.tenant_id=public.current_tenant_id() AND a.subject_type='client' AND a.subject_id=p.client_id AND a.status='approved') sis,
  EXISTS(SELECT 1 FROM public.care_plan_items i WHERE i.tenant_id=public.current_tenant_id() AND i.care_plan_id=p.id AND i.status='active') measures,
  NOT EXISTS(SELECT 1 FROM public.care_assessment_risks r JOIN public.care_assessments a ON a.id=r.assessment_id AND a.tenant_id=r.tenant_id WHERE r.tenant_id=public.current_tenant_id() AND a.subject_id=p.client_id AND r.risk_state IN('present','unclear') AND (r.next_review_at IS NULL OR r.next_review_at<clock_timestamp())) risks_current,
  EXISTS(SELECT 1 FROM public.care_plan_evaluations e WHERE e.tenant_id=public.current_tenant_id() AND e.care_plan_id=p.id AND e.evaluated_at>=clock_timestamp()-INTERVAL '90 days') evaluation,
  EXISTS(SELECT 1 FROM public.care_quality_visits v WHERE v.tenant_id=public.current_tenant_id() AND v.client_id=p.client_id AND v.status='completed' AND v.conducted_at>=clock_timestamp()-INTERVAL '90 days') visit,
  EXISTS(SELECT 1 FROM public.clinical_documentation_entries d WHERE d.tenant_id=public.current_tenant_id() AND d.client_id=p.client_id AND d.signature_status='signed' AND d.recorded_at>=clock_timestamp()-INTERVAL '30 days') signed_documentation,
  NOT EXISTS(SELECT 1 FROM public.care_quality_deviations q WHERE q.tenant_id=public.current_tenant_id() AND q.client_id=p.client_id AND q.status NOT IN('closed','cancelled') AND (q.severity='critical' OR (q.due_at IS NOT NULL AND q.due_at<clock_timestamp()))) deviations_clear
 FROM active_plans p
)
SELECT COALESCE(jsonb_agg(jsonb_build_object(
 'clientId',client_id,'clientName',trim(COALESCE(first_name,'')||' '||COALESCE(last_name,'')),'carePlanId',id,'planTitle',title,
 'checks',jsonb_build_object('approvedSis',sis,'activeMeasures',measures,'risksCurrent',risks_current,'recentEvaluation',evaluation,'recentVisit',visit,'signedDocumentation',signed_documentation,'deviationsClear',deviations_clear),
 'readinessPercent',round(((sis::int+measures::int+risks_current::int+evaluation::int+visit::int+signed_documentation::int+deviations_clear::int)*100.0/7)),
 'ready',sis AND measures AND risks_current AND evaluation AND visit AND signed_documentation AND deviations_clear
) ORDER BY last_name,first_name),'[]'::jsonb) FROM checks
WHERE public.has_permission('pflege.md.readiness')
$$;

GRANT EXECUTE ON FUNCTION public.review_care_risk(UUID,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_care_plan_measure(UUID,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_care_quality_deviation(UUID,UUID,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.advance_care_quality_deviation(UUID,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pfleger_md_readiness() TO authenticated;

COMMENT ON FUNCTION public.get_pfleger_md_readiness() IS 'Nachweisbasierter Arbeitsstand; keine automatische Bestätigung einer bestandenen MD-Prüfung.';
