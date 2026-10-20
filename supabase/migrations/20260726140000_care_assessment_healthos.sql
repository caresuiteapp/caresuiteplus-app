-- CareSuite HealthOS — gemeinsamer SIS-/Assessment-Fachkern 2026
INSERT INTO public.permission_catalog
  (key, module, category, label, description, risk_level, requires_audit)
VALUES
  ('pflege.assessments.manage', 'pflege', 'assessments',
   'SIS und Assessments bearbeiten und freigeben',
   'Erstellen, fachlich prüfen, versionieren und freigeben.', 'high', TRUE),
  ('stationaer.assessments.manage', 'stationaer', 'assessments',
   'Stationäre SIS und Assessments bearbeiten und freigeben',
   'Erstellen, fachlich prüfen, versionieren und freigeben.', 'high', TRUE)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  risk_level = EXCLUDED.risk_level,
  requires_audit = EXCLUDED.requires_audit,
  updated_at = NOW();

INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.permission_key
FROM public.roles r
CROSS JOIN (VALUES ('pflege.assessments.manage'), ('stationaer.assessments.manage')) p(permission_key)
WHERE r.key IN ('business_admin', 'business_manager', 'nurse')
ON CONFLICT (role_id, permission_key) DO NOTHING;

INSERT INTO public.role_template_permissions (role_template_id, permission_key, allowed)
SELECT rt.id, p.permission_key, TRUE
FROM public.role_templates rt
CROSS JOIN (VALUES ('pflege.assessments.manage'), ('stationaer.assessments.manage')) p(permission_key)
WHERE rt.tenant_id IS NULL AND rt.role_key IN ('business_admin', 'business_manager', 'nurse')
ON CONFLICT (role_template_id, permission_key) DO UPDATE SET allowed = TRUE, updated_at = NOW();

CREATE TABLE IF NOT EXISTS public.care_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('client', 'resident')),
  subject_id UUID NOT NULL,
  subject_name_snapshot TEXT NOT NULL,
  variant TEXT NOT NULL CHECK (variant IN ('ambulant', 'stationaer', 'tagespflege', 'kurzzeitpflege')),
  reason TEXT NOT NULL DEFAULT 'initial' CHECK (
    reason IN ('initial', 'scheduled_review', 'event_triggered', 'hospital_return', 'care_level_change', 'other')
  ),
  reason_detail TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'in_progress', 'professional_review', 'approved', 'superseded', 'archived')
  ),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  schema_version TEXT NOT NULL DEFAULT 'caresuite-2026.1',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  next_review_at TIMESTAMPTZ,
  person_statement TEXT NOT NULL DEFAULT '',
  statement_source TEXT NOT NULL DEFAULT 'person' CHECK (
    statement_source IN ('person', 'relative', 'representative', 'professional', 'not_possible')
  ),
  statement_source_name TEXT NOT NULL DEFAULT '',
  conversation_participants TEXT[] NOT NULL DEFAULT '{}',
  communication_support TEXT NOT NULL DEFAULT '',
  information_source_summary TEXT NOT NULL DEFAULT '',
  professional_summary TEXT NOT NULL DEFAULT '',
  change_summary TEXT NOT NULL DEFAULT '',
  destabilization_summary TEXT NOT NULL DEFAULT '',
  qpr_rating TEXT NOT NULL DEFAULT 'not_assessed' CHECK (qpr_rating IN ('A', 'B', 'C', 'D', 'not_assessed')),
  qpr_rationale TEXT NOT NULL DEFAULT '',
  completeness_percent INTEGER NOT NULL DEFAULT 0 CHECK (completeness_percent BETWEEN 0 AND 100),
  active_risk_count INTEGER NOT NULL DEFAULT 0,
  urgent_risk_count INTEGER NOT NULL DEFAULT 0,
  open_measure_count INTEGER NOT NULL DEFAULT 0,
  reassessment_required BOOLEAN NOT NULL DEFAULT FALSE,
  legacy_assessment_run_id UUID,
  legacy_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  assessor_profile_id UUID,
  assessor_name_snapshot TEXT NOT NULL DEFAULT '',
  approver_profile_id UUID,
  approver_name_snapshot TEXT NOT NULL DEFAULT '',
  created_by UUID,
  updated_by UUID,
  approved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_care_assessments_subject
  ON public.care_assessments (tenant_id, subject_type, subject_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_care_assessments_due
  ON public.care_assessments (tenant_id, next_review_at)
  WHERE status IN ('in_progress', 'professional_review', 'approved');

CREATE TABLE IF NOT EXISTS public.care_assessment_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES public.care_assessments(id) ON DELETE CASCADE,
  topic_key TEXT NOT NULL CHECK (topic_key IN (
    'cognition_communication', 'mobility', 'disease_demands',
    'self_care', 'social_relationships', 'living_environment'
  )),
  person_perspective TEXT NOT NULL DEFAULT '',
  resources TEXT NOT NULL DEFAULT '',
  impairments TEXT NOT NULL DEFAULT '',
  wishes TEXT NOT NULL DEFAULT '',
  habits_biography TEXT NOT NULL DEFAULT '',
  professional_assessment TEXT NOT NULL DEFAULT '',
  action_needed TEXT NOT NULL DEFAULT '',
  information_sources TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assessment_id, topic_key)
);

CREATE TABLE IF NOT EXISTS public.care_assessment_risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES public.care_assessments(id) ON DELETE CASCADE,
  risk_key TEXT NOT NULL,
  risk_state TEXT NOT NULL DEFAULT 'unclear' CHECK (risk_state IN ('none', 'unclear', 'present', 'controlled')),
  urgency TEXT NOT NULL DEFAULT 'routine' CHECK (urgency IN ('routine', 'timely', 'urgent', 'immediate')),
  evidence TEXT NOT NULL DEFAULT '',
  protective_factors TEXT NOT NULL DEFAULT '',
  professional_rationale TEXT NOT NULL DEFAULT '',
  counseling_provided TEXT NOT NULL DEFAULT '',
  person_decision TEXT NOT NULL DEFAULT '',
  refusal_documented BOOLEAN NOT NULL DEFAULT FALSE,
  focused_assessment_key TEXT,
  focused_assessment_result JSONB NOT NULL DEFAULT '{}'::JSONB,
  linked_bodymap_marker_ids UUID[] NOT NULL DEFAULT '{}',
  next_review_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assessment_id, risk_key)
);

CREATE TABLE IF NOT EXISTS public.care_assessment_measures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES public.care_assessments(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  related_topic_key TEXT,
  related_risk_key TEXT,
  personal_goal TEXT NOT NULL DEFAULT '',
  intervention TEXT NOT NULL DEFAULT '',
  timing TEXT NOT NULL DEFAULT '',
  frequency TEXT NOT NULL DEFAULT '',
  responsible_role TEXT NOT NULL DEFAULT '',
  person_contribution TEXT NOT NULL DEFAULT '',
  relatives_contribution TEXT NOT NULL DEFAULT '',
  warning_signs TEXT NOT NULL DEFAULT '',
  escalation_path TEXT NOT NULL DEFAULT '',
  evaluation_criteria TEXT NOT NULL DEFAULT '',
  next_evaluation_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'paused', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.care_assessment_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES public.care_assessments(id) ON DELETE CASCADE,
  outcome TEXT NOT NULL CHECK (outcome IN ('effective', 'partly_effective', 'not_effective', 'deteriorated', 'not_assessable')),
  observed_effect TEXT NOT NULL DEFAULT '',
  person_feedback TEXT NOT NULL DEFAULT '',
  professional_conclusion TEXT NOT NULL DEFAULT '',
  changes_required TEXT NOT NULL DEFAULT '',
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  evaluator_profile_id UUID,
  evaluator_name_snapshot TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.care_assessment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES public.care_assessments(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'routine' CHECK (severity IN ('routine', 'timely', 'urgent', 'immediate')),
  summary TEXT NOT NULL,
  event_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  requires_reassessment BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.care_assessment_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES public.care_assessments(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  relation TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.care_assessment_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES public.care_assessments(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  transition_from TEXT,
  transition_to TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  created_by UUID,
  actor_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assessment_id, version, transition_to)
);

CREATE OR REPLACE FUNCTION public.can_view_care_assessment(p_subject_type TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN p_subject_type = 'resident'
    THEN public.has_permission('stationaer.residents.view')
    ELSE public.has_permission('pflege.plans.view') END
$$;

CREATE OR REPLACE FUNCTION public.can_manage_care_assessment(p_subject_type TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN p_subject_type = 'resident'
    THEN public.has_permission('stationaer.assessments.manage')
    ELSE public.has_permission('pflege.assessments.manage') END
$$;

CREATE OR REPLACE FUNCTION public.validate_care_assessment_subject()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.subject_type = 'client' AND NOT EXISTS (
    SELECT 1 FROM public.clients WHERE id = NEW.subject_id AND tenant_id = NEW.tenant_id
  ) THEN RAISE EXCEPTION 'Klient:in gehört nicht zum Mandanten oder existiert nicht.'; END IF;
  IF NEW.subject_type = 'resident' AND NOT EXISTS (
    SELECT 1 FROM public.care_records
    WHERE id = NEW.subject_id AND tenant_id = NEW.tenant_id AND record_type = 'resident'
  ) THEN RAISE EXCEPTION 'Bewohner:in gehört nicht zum Mandanten oder existiert nicht.'; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS validate_care_assessment_subject_trigger ON public.care_assessments;
CREATE TRIGGER validate_care_assessment_subject_trigger
  BEFORE INSERT OR UPDATE OF tenant_id, subject_type, subject_id ON public.care_assessments
  FOR EACH ROW EXECUTE FUNCTION public.validate_care_assessment_subject();

CREATE OR REPLACE FUNCTION public.protect_approved_care_assessment()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status = 'approved' AND NEW.status <> 'superseded' THEN
    RAISE EXCEPTION 'Freigegebene Assessments sind unveränderbar. Neue Version anlegen.';
  END IF;
  IF OLD.status = 'superseded' THEN RAISE EXCEPTION 'Abgelöste Assessments sind unveränderbar.'; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_approved_care_assessment_trigger ON public.care_assessments;
CREATE TRIGGER protect_approved_care_assessment_trigger
  BEFORE UPDATE ON public.care_assessments FOR EACH ROW
  EXECUTE FUNCTION public.protect_approved_care_assessment();

CREATE OR REPLACE FUNCTION public.save_care_assessment(p_assessment_id UUID, p_payload JSONB)
RETURNS public.care_assessments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v public.care_assessments;
  p JSONB := COALESCE(p_payload->'assessment', '{}'::JSONB);
  item JSONB;
BEGIN
  SELECT * INTO v FROM public.care_assessments
  WHERE id = p_assessment_id AND tenant_id = public.current_tenant_id() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SIS / Assessment wurde nicht gefunden.'; END IF;
  IF NOT public.can_manage_care_assessment(v.subject_type) THEN RAISE EXCEPTION 'Keine Berechtigung.'; END IF;
  IF v.status IN ('approved', 'superseded', 'archived') THEN RAISE EXCEPTION 'Assessment ist unveränderbar.'; END IF;
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
    updated_by = auth.uid(), updated_at = NOW()
  WHERE id = p_assessment_id RETURNING * INTO v;
  DELETE FROM public.care_assessment_topics WHERE assessment_id = p_assessment_id;
  DELETE FROM public.care_assessment_risks WHERE assessment_id = p_assessment_id;
  DELETE FROM public.care_assessment_measures WHERE assessment_id = p_assessment_id;
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
  END LOOP;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.transition_care_assessment(
  p_assessment_id UUID, p_new_status TEXT, p_actor_name TEXT DEFAULT ''
) RETURNS public.care_assessments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v public.care_assessments;
  old_status TEXT;
  topic_count INTEGER;
  risk_errors INTEGER;
  uncovered INTEGER;
  snapshot JSONB;
BEGIN
  SELECT * INTO v FROM public.care_assessments
  WHERE id = p_assessment_id AND tenant_id = public.current_tenant_id() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SIS / Assessment wurde nicht gefunden.'; END IF;
  IF NOT public.can_manage_care_assessment(v.subject_type) THEN RAISE EXCEPTION 'Keine Berechtigung.'; END IF;
  old_status := v.status;
  SELECT COUNT(*) INTO topic_count FROM public.care_assessment_topics
    WHERE assessment_id = v.id AND (trim(resources) <> '' OR trim(impairments) <> '' OR trim(professional_assessment) <> '');
  SELECT COUNT(*) INTO risk_errors FROM public.care_assessment_risks
    WHERE assessment_id = v.id AND risk_state IN ('unclear','present')
      AND (trim(professional_rationale) = '' OR trim(counseling_provided) = '');
  SELECT COUNT(*) INTO uncovered FROM public.care_assessment_risks r
    WHERE r.assessment_id = v.id AND r.risk_state IN ('unclear','present')
      AND NOT EXISTS (SELECT 1 FROM public.care_assessment_measures m
        WHERE m.assessment_id = r.assessment_id AND m.related_risk_key = r.risk_key
          AND m.status IN ('planned','active'));
  IF p_new_status IN ('professional_review','approved') THEN
    IF trim(v.person_statement) = '' AND v.statement_source <> 'not_possible' THEN RAISE EXCEPTION 'Originalton fehlt.'; END IF;
    IF trim(v.professional_summary) = '' THEN RAISE EXCEPTION 'Gesamteinschätzung fehlt.'; END IF;
    IF topic_count < 6 THEN RAISE EXCEPTION 'Nicht alle sechs Themenfelder sind eingeschätzt.'; END IF;
    IF risk_errors > 0 THEN RAISE EXCEPTION 'Risiken sind nicht vollständig begründet oder beraten.'; END IF;
    IF uncovered > 0 THEN RAISE EXCEPTION 'Risiken besitzen keine aktive Maßnahme.'; END IF;
  END IF;
  IF p_new_status = 'approved' AND (old_status <> 'professional_review' OR v.next_review_at IS NULL) THEN
    RAISE EXCEPTION 'Freigabe erfordert fachliche Prüfung und Prüftermin.';
  END IF;
  UPDATE public.care_assessments SET
    status = p_new_status,
    completed_at = CASE WHEN p_new_status IN ('professional_review','approved') THEN COALESCE(completed_at,NOW()) ELSE completed_at END,
    approved_at = CASE WHEN p_new_status = 'approved' THEN NOW() ELSE approved_at END,
    effective_at = CASE WHEN p_new_status = 'approved' THEN COALESCE(effective_at,NOW()) ELSE effective_at END,
    approver_profile_id = CASE WHEN p_new_status = 'approved' THEN auth.uid() ELSE approver_profile_id END,
    approver_name_snapshot = CASE WHEN p_new_status = 'approved' THEN COALESCE(NULLIF(p_actor_name,''),approver_name_snapshot) ELSE approver_name_snapshot END,
    qpr_rating = CASE WHEN p_new_status = 'approved' THEN 'A' ELSE qpr_rating END,
    completeness_percent = CASE WHEN p_new_status IN ('professional_review','approved') THEN 100 ELSE completeness_percent END,
    updated_by = auth.uid(), updated_at = NOW()
  WHERE id = v.id RETURNING * INTO v;
  snapshot := jsonb_build_object(
    'assessment', to_jsonb(v),
    'topics', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM public.care_assessment_topics t WHERE t.assessment_id=v.id),'[]'),
    'risks', COALESCE((SELECT jsonb_agg(to_jsonb(r)) FROM public.care_assessment_risks r WHERE r.assessment_id=v.id),'[]'),
    'measures', COALESCE((SELECT jsonb_agg(to_jsonb(m)) FROM public.care_assessment_measures m WHERE m.assessment_id=v.id),'[]')
  );
  INSERT INTO public.care_assessment_versions (
    tenant_id, assessment_id, version, transition_from, transition_to, snapshot, created_by, actor_name
  ) VALUES (v.tenant_id,v.id,v.version,old_status,p_new_status,snapshot,auth.uid(),COALESCE(p_actor_name,''))
  ON CONFLICT (assessment_id,version,transition_to) DO UPDATE SET snapshot=EXCLUDED.snapshot, actor_name=EXCLUDED.actor_name;
  RETURN v;
END;
$$;

-- Bestehende assessment_runs bleiben vollständig erhalten und werden nachvollziehbar kopiert.
DO $$
BEGIN
  IF to_regclass('public.assessment_runs') IS NOT NULL THEN
    EXECUTE $migration$
      INSERT INTO public.care_assessments (
        id, tenant_id, subject_type, subject_id, subject_name_snapshot, variant,
        reason, status, version, started_at, person_statement, professional_summary,
        legacy_assessment_run_id, legacy_payload, assessor_name_snapshot, created_at, updated_at
      )
      SELECT ar.id, ar.tenant_id, 'client', ar.client_id,
        trim(concat_ws(' ',c.first_name,c.last_name)), 'ambulant', 'initial',
        CASE WHEN to_jsonb(ar)->>'status' IN ('active','completed') THEN 'professional_review'
             WHEN to_jsonb(ar)->>'status' IN ('archived','deprecated') THEN 'archived'
             WHEN to_jsonb(ar)->>'status'='draft' THEN 'draft' ELSE 'in_progress' END,
        1, COALESCE(NULLIF(to_jsonb(ar)->>'started_at','')::TIMESTAMPTZ,NOW()),
        COALESCE(to_jsonb(ar)#>>'{result_payload,personStatement}',''),
        COALESCE(to_jsonb(ar)#>>'{result_payload,professionalSummary}',''),
        ar.id, to_jsonb(ar), COALESCE(to_jsonb(ar)#>>'{result_payload,assessorName}',''),
        COALESCE(NULLIF(to_jsonb(ar)->>'created_at','')::TIMESTAMPTZ,NOW()),
        COALESCE(NULLIF(to_jsonb(ar)->>'updated_at','')::TIMESTAMPTZ,NOW())
      FROM public.assessment_runs ar
      JOIN public.clients c ON c.id=ar.client_id AND c.tenant_id=ar.tenant_id
      WHERE ar.client_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.client_module_assignments assignment
          WHERE assignment.tenant_id = ar.tenant_id
            AND assignment.client_id = ar.client_id
            AND assignment.module_key = 'pflege'
            AND assignment.is_active = TRUE
            AND assignment.status NOT IN ('inactive', 'deactivated', 'archiviert')
        )
      ON CONFLICT (id) DO NOTHING
    $migration$;
  END IF;
END;
$$;

INSERT INTO public.care_assessment_topics (tenant_id, assessment_id, topic_key)
SELECT a.tenant_id, a.id, t.key FROM public.care_assessments a
CROSS JOIN (VALUES
  ('cognition_communication'),('mobility'),('disease_demands'),
  ('self_care'),('social_relationships'),('living_environment')
) t(key)
ON CONFLICT (assessment_id,topic_key) DO NOTHING;

ALTER TABLE public.care_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_assessment_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_assessment_risks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_assessment_measures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_assessment_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_assessment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_assessment_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_assessment_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS care_assessments_select ON public.care_assessments;
CREATE POLICY care_assessments_select ON public.care_assessments FOR SELECT USING (
  tenant_id=public.current_tenant_id() AND public.can_view_care_assessment(subject_type)
);
DROP POLICY IF EXISTS care_assessments_write ON public.care_assessments;
CREATE POLICY care_assessments_write ON public.care_assessments FOR ALL USING (
  tenant_id=public.current_tenant_id() AND public.can_manage_care_assessment(subject_type)
) WITH CHECK (
  tenant_id=public.current_tenant_id() AND public.can_manage_care_assessment(subject_type)
);

DO $$
DECLARE tab TEXT;
BEGIN
  FOREACH tab IN ARRAY ARRAY[
    'care_assessment_topics','care_assessment_risks','care_assessment_measures',
    'care_assessment_evaluations','care_assessment_events','care_assessment_links','care_assessment_versions'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_tenant ON public.%I',tab,tab);
    EXECUTE format(
      'CREATE POLICY %I_tenant ON public.%I FOR ALL USING (
        tenant_id=public.current_tenant_id() AND EXISTS (
          SELECT 1 FROM public.care_assessments a WHERE a.id=%I.assessment_id
          AND a.tenant_id=%I.tenant_id AND public.can_view_care_assessment(a.subject_type)
        )
      ) WITH CHECK (
        tenant_id=public.current_tenant_id() AND EXISTS (
          SELECT 1 FROM public.care_assessments a WHERE a.id=%I.assessment_id
          AND a.tenant_id=%I.tenant_id AND public.can_manage_care_assessment(a.subject_type)
        )
      )',tab,tab,tab,tab,tab,tab
    );
  END LOOP;
END;
$$;

GRANT SELECT,INSERT,UPDATE ON public.care_assessments TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.care_assessment_topics TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.care_assessment_risks TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.care_assessment_measures TO authenticated;
GRANT SELECT,INSERT ON public.care_assessment_evaluations TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.care_assessment_events TO authenticated;
GRANT SELECT,INSERT,DELETE ON public.care_assessment_links TO authenticated;
GRANT SELECT ON public.care_assessment_versions TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_care_assessment(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_care_assessment(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_care_assessment(UUID,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transition_care_assessment(UUID,TEXT,TEXT) TO authenticated;
