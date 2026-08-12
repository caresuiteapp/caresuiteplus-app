-- CareSuite HealthOS — PFLEGE TEIL 3 · PLANUNG & QUALITÄT LIVE R1
-- Produktive Evaluationen, Pflegevisiten und prüffähige Qualitätskennzahlen.

INSERT INTO public.permission_catalog
  (key, module, category, label, description, risk_level, requires_audit)
VALUES
  ('pflege.evaluations.view', 'pflege', 'quality', 'Evaluationen ansehen',
   'Pflegefachliche Wirksamkeitsprüfungen und Fortschreibungsbedarf einsehen.', 'high', TRUE),
  ('pflege.evaluations.manage', 'pflege', 'quality', 'Evaluationen dokumentieren',
   'Evaluationen revisionssicher erfassen und nächste Prüftermine festlegen.', 'high', TRUE),
  ('pflege.visits.view', 'pflege', 'quality', 'Pflegevisiten ansehen',
   'Geplante und durchgeführte Pflegevisiten einsehen.', 'high', TRUE),
  ('pflege.visits.manage', 'pflege', 'quality', 'Pflegevisiten dokumentieren',
   'Pflegevisiten, Feststellungen und Folgemaßnahmen dokumentieren.', 'high', TRUE),
  ('pflege.quality.view', 'pflege', 'quality', 'Pflegequalität auswerten',
   'Mandantenbezogene Qualitätskennzahlen für ambulante Pflege und Intensivpflege einsehen.', 'high', TRUE)
ON CONFLICT (key) DO UPDATE SET
  module = EXCLUDED.module,
  category = EXCLUDED.category,
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  risk_level = EXCLUDED.risk_level,
  requires_audit = EXCLUDED.requires_audit,
  updated_at = NOW();

INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.permission_key
FROM public.roles r
CROSS JOIN (VALUES
  ('pflege.evaluations.view'), ('pflege.evaluations.manage'),
  ('pflege.visits.view'), ('pflege.visits.manage'), ('pflege.quality.view')
) p(permission_key)
WHERE r.key IN (
  'owner', 'admin', 'management', 'geschaeftsfuehrung',
  'business_admin', 'business_manager', 'nurse', 'pdl', 'pflege', 'pflegefachkraft'
)
ON CONFLICT (role_id, permission_key) DO NOTHING;

INSERT INTO public.role_template_permissions (role_template_id, permission_key, allowed)
SELECT rt.id, p.permission_key, TRUE
FROM public.role_templates rt
CROSS JOIN (VALUES
  ('pflege.evaluations.view'), ('pflege.evaluations.manage'),
  ('pflege.visits.view'), ('pflege.visits.manage'), ('pflege.quality.view')
) p(permission_key)
WHERE rt.tenant_id IS NULL
  AND rt.role_key IN ('business_admin', 'business_manager', 'nurse')
ON CONFLICT (role_template_id, permission_key) DO UPDATE SET
  allowed = TRUE,
  updated_at = NOW();

CREATE TABLE IF NOT EXISTS public.care_plan_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  care_plan_id UUID NOT NULL REFERENCES public.care_plans(id) ON DELETE CASCADE,
  outcome TEXT NOT NULL CHECK (outcome IN (
    'effective', 'partly_effective', 'not_effective', 'deteriorated', 'not_assessable'
  )),
  observed_effect TEXT NOT NULL,
  person_feedback TEXT NOT NULL DEFAULT '',
  professional_conclusion TEXT NOT NULL,
  changes_required TEXT NOT NULL DEFAULT '',
  requires_plan_update BOOLEAN NOT NULL DEFAULT FALSE,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  next_evaluation_at TIMESTAMPTZ,
  evaluator_profile_id UUID,
  evaluator_name_snapshot TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK (next_evaluation_at IS NULL OR next_evaluation_at >= evaluated_at)
);

CREATE TABLE IF NOT EXISTS public.care_quality_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  care_plan_id UUID REFERENCES public.care_plans(id) ON DELETE SET NULL,
  visit_type TEXT NOT NULL CHECK (visit_type IN (
    'pdl', 'professional', 'intensive_care', 'hygiene', 'medication', 'event_triggered'
  )),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('planned', 'completed', 'cancelled')),
  scheduled_at TIMESTAMPTZ,
  conducted_at TIMESTAMPTZ,
  scope TEXT NOT NULL,
  findings TEXT NOT NULL DEFAULT '',
  deviations TEXT NOT NULL DEFAULT '',
  agreed_actions TEXT NOT NULL DEFAULT '',
  person_feedback TEXT NOT NULL DEFAULT '',
  next_visit_at TIMESTAMPTZ,
  visitor_profile_id UUID,
  visitor_name_snapshot TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK (status <> 'completed' OR conducted_at IS NOT NULL),
  CHECK (next_visit_at IS NULL OR next_visit_at >= COALESCE(conducted_at, scheduled_at, created_at))
);

CREATE INDEX IF NOT EXISTS idx_care_plan_evaluations_tenant_due
  ON public.care_plan_evaluations (tenant_id, next_evaluation_at, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_care_plan_evaluations_plan
  ON public.care_plan_evaluations (tenant_id, care_plan_id, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_care_quality_visits_tenant_due
  ON public.care_quality_visits (tenant_id, status, next_visit_at, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_care_quality_visits_client
  ON public.care_quality_visits (tenant_id, client_id, created_at DESC);

DROP TRIGGER IF EXISTS set_care_quality_visits_updated_at ON public.care_quality_visits;
CREATE TRIGGER set_care_quality_visits_updated_at
  BEFORE UPDATE ON public.care_quality_visits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.care_plan_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_quality_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS care_plan_evaluations_live_read ON public.care_plan_evaluations;
CREATE POLICY care_plan_evaluations_live_read ON public.care_plan_evaluations
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (public.can_view_pfleger_core() OR public.has_permission('pflege.evaluations.view'))
  );

DROP POLICY IF EXISTS care_quality_visits_live_read ON public.care_quality_visits;
CREATE POLICY care_quality_visits_live_read ON public.care_quality_visits
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (public.can_view_pfleger_core() OR public.has_permission('pflege.visits.view'))
  );

REVOKE INSERT, UPDATE, DELETE ON public.care_plan_evaluations FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.care_quality_visits FROM authenticated;
GRANT SELECT ON public.care_plan_evaluations, public.care_quality_visits TO authenticated;

CREATE OR REPLACE FUNCTION public.create_care_plan_evaluation(
  p_care_plan_id UUID,
  p_payload JSONB
) RETURNS public.care_plan_evaluations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant UUID := public.current_tenant_id();
  v_client UUID;
  v_result public.care_plan_evaluations;
  v_outcome TEXT := COALESCE(NULLIF(p_payload->>'outcome', ''), 'not_assessable');
BEGIN
  IF NOT (public.can_manage_pfleger_core() OR public.has_permission('pflege.evaluations.manage')) THEN
    RAISE EXCEPTION 'Keine Berechtigung zum Dokumentieren von Evaluationen.' USING ERRCODE = '42501';
  END IF;

  SELECT client_id INTO v_client
  FROM public.care_plans
  WHERE id = p_care_plan_id AND tenant_id = v_tenant
  FOR UPDATE;

  IF v_client IS NULL OR NOT public.is_active_pfleger_client(v_client) THEN
    RAISE EXCEPTION 'Evaluation gesperrt: kein aktiver Pflegefall.' USING ERRCODE = '23514';
  END IF;
  IF v_outcome NOT IN ('effective','partly_effective','not_effective','deteriorated','not_assessable') THEN
    RAISE EXCEPTION 'Ungültiges Evaluationsergebnis.' USING ERRCODE = '23514';
  END IF;
  IF trim(COALESCE(p_payload->>'observedEffect','')) = ''
     OR trim(COALESCE(p_payload->>'professionalConclusion','')) = '' THEN
    RAISE EXCEPTION 'Beobachtete Wirkung und fachliche Schlussfolgerung sind erforderlich.' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.care_plan_evaluations (
    tenant_id, client_id, care_plan_id, outcome, observed_effect, person_feedback,
    professional_conclusion, changes_required, requires_plan_update, evaluated_at,
    next_evaluation_at, evaluator_profile_id, evaluator_name_snapshot
  ) VALUES (
    v_tenant, v_client, p_care_plan_id, v_outcome, trim(p_payload->>'observedEffect'),
    COALESCE(p_payload->>'personFeedback',''), trim(p_payload->>'professionalConclusion'),
    COALESCE(p_payload->>'changesRequired',''),
    COALESCE((p_payload->>'requiresPlanUpdate')::BOOLEAN, FALSE),
    COALESCE(NULLIF(p_payload->>'evaluatedAt','')::TIMESTAMPTZ, clock_timestamp()),
    NULLIF(p_payload->>'nextEvaluationAt','')::TIMESTAMPTZ,
    auth.uid(), COALESCE(NULLIF(trim(p_payload->>'actorName'),''), 'Pflegefachperson')
  ) RETURNING * INTO v_result;

  UPDATE public.care_plans
  SET review_due_at = v_result.next_evaluation_at,
      evaluation_notes = v_result.professional_conclusion,
      updated_by = auth.uid(), updated_at = clock_timestamp()
  WHERE id = p_care_plan_id AND tenant_id = v_tenant;

  UPDATE public.care_plan_items
  SET next_evaluation_date = v_result.next_evaluation_at::DATE,
      updated_by = auth.uid(), updated_at = clock_timestamp()
  WHERE care_plan_id = p_care_plan_id AND tenant_id = v_tenant
    AND status IN ('active','paused');

  INSERT INTO public.care_audit_events (
    tenant_id, client_id, care_plan_id, entity_type, entity_id, action,
    summary, after_data, actor_id, actor_name
  ) VALUES (
    v_tenant, v_client, p_care_plan_id, 'care_plan_evaluation', v_result.id,
    'create', 'Pflegeplan-Wirksamkeit evaluiert.', to_jsonb(v_result), auth.uid(),
    v_result.evaluator_name_snapshot
  );
  RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.create_care_quality_visit(
  p_client_id UUID,
  p_care_plan_id UUID,
  p_payload JSONB
) RETURNS public.care_quality_visits
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant UUID := public.current_tenant_id();
  v_result public.care_quality_visits;
  v_type TEXT := COALESCE(NULLIF(p_payload->>'visitType',''), 'professional');
  v_status TEXT := COALESCE(NULLIF(p_payload->>'status',''), 'completed');
BEGIN
  IF NOT (public.can_manage_pfleger_core() OR public.has_permission('pflege.visits.manage')) THEN
    RAISE EXCEPTION 'Keine Berechtigung zum Dokumentieren von Pflegevisiten.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_active_pfleger_client(p_client_id) THEN
    RAISE EXCEPTION 'Pflegevisite gesperrt: kein aktiver Pflegefall.' USING ERRCODE = '23514';
  END IF;
  IF p_care_plan_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.care_plans
    WHERE id = p_care_plan_id AND tenant_id = v_tenant AND client_id = p_client_id
  ) THEN
    RAISE EXCEPTION 'Pflegeplan gehört nicht zum gewählten Pflegefall.' USING ERRCODE = '23514';
  END IF;
  IF trim(COALESCE(p_payload->>'scope','')) = '' THEN
    RAISE EXCEPTION 'Prüfumfang der Pflegevisite ist erforderlich.' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.care_quality_visits (
    tenant_id, client_id, care_plan_id, visit_type, status, scheduled_at, conducted_at,
    scope, findings, deviations, agreed_actions, person_feedback, next_visit_at,
    visitor_profile_id, visitor_name_snapshot
  ) VALUES (
    v_tenant, p_client_id, p_care_plan_id, v_type, v_status,
    NULLIF(p_payload->>'scheduledAt','')::TIMESTAMPTZ,
    CASE WHEN v_status = 'completed' THEN
      COALESCE(NULLIF(p_payload->>'conductedAt','')::TIMESTAMPTZ, clock_timestamp())
    ELSE NULLIF(p_payload->>'conductedAt','')::TIMESTAMPTZ END,
    trim(p_payload->>'scope'), COALESCE(p_payload->>'findings',''),
    COALESCE(p_payload->>'deviations',''), COALESCE(p_payload->>'agreedActions',''),
    COALESCE(p_payload->>'personFeedback',''), NULLIF(p_payload->>'nextVisitAt','')::TIMESTAMPTZ,
    auth.uid(), COALESCE(NULLIF(trim(p_payload->>'actorName'),''), 'Pflegefachperson')
  ) RETURNING * INTO v_result;

  INSERT INTO public.care_audit_events (
    tenant_id, client_id, care_plan_id, entity_type, entity_id, action,
    summary, after_data, actor_id, actor_name
  ) VALUES (
    v_tenant, p_client_id, p_care_plan_id, 'care_quality_visit', v_result.id,
    'create', 'Pflegevisite dokumentiert.', to_jsonb(v_result), auth.uid(),
    v_result.visitor_name_snapshot
  );
  RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.get_pfleger_quality_stats()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'activePlans', (SELECT count(*) FROM public.care_plans p
      WHERE p.tenant_id = public.current_tenant_id() AND p.status = 'active'),
    'sisAssessmentsDue', (SELECT count(*) FROM public.care_assessments a
      WHERE a.tenant_id = public.current_tenant_id()
        AND a.status IN ('in_progress','professional_review','approved')
        AND a.next_review_at IS NOT NULL AND a.next_review_at <= clock_timestamp()),
    'vitalsDocumentedThisWeek', (SELECT count(*) FROM public.vital_sign_measurements v
      WHERE v.tenant_id = public.current_tenant_id()
        AND v.measured_at >= date_trunc('week', clock_timestamp())),
    'woundCasesOpen', (SELECT count(*) FROM public.clinical_wound_cases w
      WHERE w.tenant_id = public.current_tenant_id() AND w.status <> 'archived'),
    'mdkReadyCount', (SELECT count(DISTINCT p.id) FROM public.care_plans p
      WHERE p.tenant_id = public.current_tenant_id() AND p.status = 'active'
        AND EXISTS (SELECT 1 FROM public.care_plan_evaluations e
          WHERE e.tenant_id = p.tenant_id AND e.care_plan_id = p.id)
        AND EXISTS (SELECT 1 FROM public.care_quality_visits q
          WHERE q.tenant_id = p.tenant_id AND q.care_plan_id = p.id AND q.status = 'completed'))
  )
  WHERE public.can_view_pfleger_core() OR public.has_permission('pflege.quality.view')
$$;

GRANT EXECUTE ON FUNCTION public.create_care_plan_evaluation(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_care_quality_visit(UUID, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pfleger_quality_stats() TO authenticated;

COMMENT ON TABLE public.care_plan_evaluations IS
  'Append-only Wirksamkeitsprüfungen für Pflegepläne und Maßnahmen.';
COMMENT ON TABLE public.care_quality_visits IS
  'Mandantengetrennte PDL-, Fach-, Intensivpflege-, Hygiene- und Medikationsvisiten.';
