-- CareSuite HealthOS — PFLEGE LIVE CORE R1
-- Produktiver Pflegefachkern für ambulante Pflegedienste.
-- Nicht destruktiv: vorhandene Pflegepläne und SIS-Daten bleiben erhalten.

INSERT INTO public.permission_catalog
  (key, module, category, label, description, risk_level, requires_audit)
VALUES
  ('pflege.plans.manage', 'pflege', 'plans', 'Pflegepläne verwalten',
   'Pflegepläne und Maßnahmen erstellen, bearbeiten, prüfen und freigeben.', 'high', TRUE),
  ('pflege.diagnoses.view', 'pflege', 'diagnoses', 'Pflegediagnosen ansehen',
   'Ärztlich mitgeteilte und pflegefachlich relevante Diagnosen einsehen.', 'high', TRUE),
  ('pflege.diagnoses.manage', 'pflege', 'diagnoses', 'Pflegediagnosen verwalten',
   'Diagnosen als ärztliche Angabe dokumentieren, ändern und archivieren.', 'high', TRUE),
  ('pflege.orders.view', 'pflege', 'orders', 'Ärztliche Verordnungen ansehen',
   'Verordnungen, Gültigkeiten und Genehmigungsstände einsehen.', 'high', TRUE),
  ('pflege.orders.manage', 'pflege', 'orders', 'Ärztliche Verordnungen verwalten',
   'Ärztliche Verordnungen dokumentieren, prüfen und fortschreiben.', 'high', TRUE),
  ('pflege.audit.view', 'pflege', 'audit', 'Pflege-Audit einsehen',
   'Versionen und sicherheitsrelevante Pflegeereignisse einsehen.', 'high', TRUE)
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
  ('pflege.plans.manage'), ('pflege.diagnoses.view'), ('pflege.diagnoses.manage'),
  ('pflege.orders.view'), ('pflege.orders.manage'), ('pflege.audit.view')
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
  ('pflege.plans.manage'), ('pflege.diagnoses.view'), ('pflege.diagnoses.manage'),
  ('pflege.orders.view'), ('pflege.orders.manage'), ('pflege.audit.view')
) p(permission_key)
WHERE rt.tenant_id IS NULL
  AND rt.role_key IN ('business_admin', 'business_manager', 'nurse')
ON CONFLICT (role_template_id, permission_key) DO UPDATE SET
  allowed = TRUE,
  updated_at = NOW();

ALTER TABLE public.care_plans
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS goals TEXT,
  ADD COLUMN IF NOT EXISTS resources TEXT,
  ADD COLUMN IF NOT EXISTS risks TEXT,
  ADD COLUMN IF NOT EXISTS biographical_notes TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS evaluation_notes TEXT,
  ADD COLUMN IF NOT EXISTS source_assessment_id UUID REFERENCES public.care_assessments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS primary_nurse_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS review_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID,
  ADD COLUMN IF NOT EXISTS approved_by_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID;

CREATE TABLE IF NOT EXISTS public.care_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  care_plan_id UUID NOT NULL REFERENCES public.care_plans(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT,
  description TEXT,
  goal TEXT,
  intervention TEXT,
  frequency TEXT,
  timing TEXT,
  responsible_role TEXT,
  person_contribution TEXT,
  relatives_contribution TEXT,
  warning_signs TEXT,
  escalation_path TEXT,
  evaluation_criteria TEXT,
  evaluation_interval_days INTEGER,
  next_evaluation_date DATE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','paused','completed','cancelled')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.care_plan_items
  ADD COLUMN IF NOT EXISTS timing TEXT,
  ADD COLUMN IF NOT EXISTS person_contribution TEXT,
  ADD COLUMN IF NOT EXISTS relatives_contribution TEXT,
  ADD COLUMN IF NOT EXISTS warning_signs TEXT,
  ADD COLUMN IF NOT EXISTS escalation_path TEXT,
  ADD COLUMN IF NOT EXISTS evaluation_criteria TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID;

CREATE TABLE IF NOT EXISTS public.care_diagnoses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  care_plan_id UUID REFERENCES public.care_plans(id) ON DELETE SET NULL,
  diagnosis_type TEXT NOT NULL DEFAULT 'physician_statement'
    CHECK (diagnosis_type IN ('physician_statement','confirmed','suspected','nursing_relevant')),
  icd_code TEXT,
  icd_title TEXT NOT NULL,
  physician_statement TEXT NOT NULL DEFAULT '',
  diagnosed_at DATE,
  diagnosed_by TEXT NOT NULL DEFAULT '',
  source_document TEXT NOT NULL DEFAULT '',
  relevance_for_care TEXT NOT NULL DEFAULT '',
  precautions TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','resolved','superseded','archived')),
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  recorded_by UUID,
  recorded_by_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (valid_until IS NULL OR valid_until >= valid_from)
);

CREATE TABLE IF NOT EXISTS public.care_medical_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  care_plan_id UUID REFERENCES public.care_plans(id) ON DELETE SET NULL,
  order_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  ordering_physician TEXT NOT NULL,
  physician_bsnr TEXT NOT NULL DEFAULT '',
  physician_lanr TEXT NOT NULL DEFAULT '',
  ordered_at DATE NOT NULL,
  valid_from DATE NOT NULL,
  valid_until DATE,
  insurer_approval_required BOOLEAN NOT NULL DEFAULT FALSE,
  insurer_approval_status TEXT NOT NULL DEFAULT 'not_required'
    CHECK (insurer_approval_status IN ('not_required','pending','approved','rejected','expired')),
  insurer_approval_reference TEXT NOT NULL DEFAULT '',
  frequency TEXT NOT NULL DEFAULT '',
  execution_instructions TEXT NOT NULL DEFAULT '',
  qualification_requirement TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('draft','active','paused','completed','expired','cancelled','archived')),
  source_document TEXT NOT NULL DEFAULT '',
  recorded_by UUID,
  recorded_by_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (valid_until IS NULL OR valid_until >= valid_from)
);

CREATE TABLE IF NOT EXISTS public.care_plan_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  care_plan_id UUID NOT NULL REFERENCES public.care_plans(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  reason TEXT NOT NULL DEFAULT 'save',
  actor_id UUID,
  actor_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (care_plan_id, version)
);

CREATE TABLE IF NOT EXISTS public.care_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  care_plan_id UUID REFERENCES public.care_plans(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  summary TEXT NOT NULL,
  before_data JSONB,
  after_data JSONB,
  actor_id UUID,
  actor_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_care_plans_live_tenant_client
  ON public.care_plans (tenant_id, client_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_care_plan_items_live_plan
  ON public.care_plan_items (tenant_id, care_plan_id, status, sort_order);
CREATE INDEX IF NOT EXISTS idx_care_diagnoses_live_client
  ON public.care_diagnoses (tenant_id, client_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_care_orders_live_client
  ON public.care_medical_orders (tenant_id, client_id, status, valid_until);
CREATE INDEX IF NOT EXISTS idx_care_audit_live_plan
  ON public.care_audit_events (tenant_id, care_plan_id, created_at DESC);

DROP TRIGGER IF EXISTS set_care_plan_items_updated_at ON public.care_plan_items;
CREATE TRIGGER set_care_plan_items_updated_at
  BEFORE UPDATE ON public.care_plan_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS set_care_diagnoses_updated_at ON public.care_diagnoses;
CREATE TRIGGER set_care_diagnoses_updated_at
  BEFORE UPDATE ON public.care_diagnoses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS set_care_medical_orders_updated_at ON public.care_medical_orders;
CREATE TRIGGER set_care_medical_orders_updated_at
  BEFORE UPDATE ON public.care_medical_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.can_view_pfleger_core()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_tenant_admin()
    OR public.has_permission('pflege.plans.view')
    OR public.has_permission('pflege.plans.manage')
    OR public.has_permission('pflege.assessments.manage')
$$;

CREATE OR REPLACE FUNCTION public.can_manage_pfleger_core()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_tenant_admin()
    OR public.has_permission('pflege.plans.manage')
    OR public.has_permission('pflege.assessments.manage')
$$;

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'care_plans','care_plan_items','care_diagnoses','care_medical_orders',
    'care_plan_versions','care_audit_events'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_pflege_live_read', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT USING (tenant_id = public.current_tenant_id() AND public.can_view_pfleger_core())',
      tbl || '_pflege_live_read', tbl
    );
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_pflege_live_write', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL USING (tenant_id = public.current_tenant_id() AND public.can_manage_pfleger_core()) WITH CHECK (tenant_id = public.current_tenant_id() AND public.can_manage_pfleger_core())',
      tbl || '_pflege_live_write', tbl
    );
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.save_live_care_plan(
  p_plan_id UUID,
  p_client_id UUID,
  p_title TEXT,
  p_description TEXT,
  p_goals TEXT,
  p_resources TEXT,
  p_risks TEXT,
  p_valid_from DATE,
  p_valid_until DATE,
  p_source_assessment_id UUID,
  p_primary_nurse_id UUID,
  p_actor_name TEXT,
  p_items JSONB DEFAULT '[]'::JSONB
) RETURNS public.care_plans
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_plan public.care_plans;
  v_before JSONB;
  v_item JSONB;
  v_id UUID := COALESCE(p_plan_id, gen_random_uuid());
  v_tenant UUID := public.current_tenant_id();
BEGIN
  IF NOT public.can_manage_pfleger_core() THEN
    RAISE EXCEPTION 'Keine Berechtigung zum Speichern von Pflegeplänen.' USING ERRCODE = '42501';
  END IF;
  IF trim(COALESCE(p_title,'')) = '' THEN RAISE EXCEPTION 'Bezeichnung fehlt.'; END IF;
  IF NOT public.is_active_pfleger_client(p_client_id) THEN
    RAISE EXCEPTION 'Pflegeplan gesperrt: kein aktiver Pflegefall.' USING ERRCODE = '23514';
  END IF;
  IF p_valid_until IS NOT NULL AND p_valid_until < p_valid_from THEN
    RAISE EXCEPTION 'Gültig-bis darf nicht vor Gültig-ab liegen.';
  END IF;

  SELECT to_jsonb(cp) INTO v_before
  FROM public.care_plans cp
  WHERE cp.id = v_id AND cp.tenant_id = v_tenant
  FOR UPDATE;

  INSERT INTO public.care_plans (
    id, tenant_id, client_id, title, description, goals, resources, risks,
    valid_from, valid_until, source_assessment_id, primary_nurse_id,
    status, version, created_by, updated_by
  ) VALUES (
    v_id, v_tenant, p_client_id, trim(p_title), COALESCE(p_description,''),
    COALESCE(p_goals,''), COALESCE(p_resources,''), COALESCE(p_risks,''),
    p_valid_from, p_valid_until, p_source_assessment_id, p_primary_nurse_id,
    'draft', 1, auth.uid(), auth.uid()
  )
  ON CONFLICT (id) DO UPDATE SET
    client_id = EXCLUDED.client_id,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    goals = EXCLUDED.goals,
    resources = EXCLUDED.resources,
    risks = EXCLUDED.risks,
    valid_from = EXCLUDED.valid_from,
    valid_until = EXCLUDED.valid_until,
    source_assessment_id = EXCLUDED.source_assessment_id,
    primary_nurse_id = EXCLUDED.primary_nurse_id,
    version = public.care_plans.version + 1,
    updated_by = auth.uid(),
    updated_at = NOW()
  WHERE public.care_plans.tenant_id = v_tenant
  RETURNING * INTO v_plan;

  DELETE FROM public.care_plan_items
  WHERE tenant_id = v_tenant AND care_plan_id = v_plan.id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_items, '[]'::JSONB)) LOOP
    INSERT INTO public.care_plan_items (
      tenant_id, care_plan_id, title, category, description, goal, intervention,
      frequency, timing, responsible_role, person_contribution, relatives_contribution,
      warning_signs, escalation_path, evaluation_criteria, evaluation_interval_days,
      next_evaluation_date, status, sort_order, notes, created_by, updated_by
    ) VALUES (
      v_tenant, v_plan.id, COALESCE(NULLIF(v_item->>'title',''),'Pflegemaßnahme'),
      NULLIF(v_item->>'category',''), NULLIF(v_item->>'description',''),
      NULLIF(v_item->>'goal',''), NULLIF(v_item->>'intervention',''),
      NULLIF(v_item->>'frequency',''), NULLIF(v_item->>'timing',''),
      NULLIF(v_item->>'responsibleRole',''), NULLIF(v_item->>'personContribution',''),
      NULLIF(v_item->>'relativesContribution',''), NULLIF(v_item->>'warningSigns',''),
      NULLIF(v_item->>'escalationPath',''), NULLIF(v_item->>'evaluationCriteria',''),
      NULLIF(v_item->>'evaluationIntervalDays','')::INTEGER,
      NULLIF(v_item->>'nextEvaluationAt','')::DATE,
      COALESCE(NULLIF(v_item->>'status',''),'active'),
      COALESCE(NULLIF(v_item->>'sortOrder','')::INTEGER, 0), NULLIF(v_item->>'notes',''),
      auth.uid(), auth.uid()
    );
  END LOOP;

  INSERT INTO public.care_plan_versions
    (tenant_id, care_plan_id, version, snapshot, reason, actor_id, actor_name)
  VALUES (
    v_tenant, v_plan.id, v_plan.version,
    jsonb_build_object(
      'plan', to_jsonb(v_plan),
      'items', COALESCE((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.sort_order)
        FROM public.care_plan_items i WHERE i.care_plan_id = v_plan.id), '[]'::JSONB)
    ), CASE WHEN v_before IS NULL THEN 'created' ELSE 'updated' END,
    auth.uid(), COALESCE(p_actor_name,'')
  ) ON CONFLICT (care_plan_id, version) DO NOTHING;

  INSERT INTO public.care_audit_events (
    tenant_id, client_id, care_plan_id, entity_type, entity_id, action,
    summary, before_data, after_data, actor_id, actor_name
  ) VALUES (
    v_tenant, v_plan.client_id, v_plan.id, 'care_plan', v_plan.id,
    CASE WHEN v_before IS NULL THEN 'created' ELSE 'updated' END,
    CASE WHEN v_before IS NULL THEN 'Pflegeplan angelegt' ELSE 'Pflegeplan fortgeschrieben' END,
    v_before, to_jsonb(v_plan), auth.uid(), COALESCE(p_actor_name,'')
  );

  RETURN v_plan;
END;
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_plan_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.care_diagnoses TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.care_medical_orders TO authenticated;
GRANT SELECT ON public.care_plan_versions, public.care_audit_events TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_pfleger_core() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_pfleger_core() TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_live_care_plan(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, DATE, UUID, UUID, TEXT, JSONB
) TO authenticated;

COMMENT ON FUNCTION public.save_live_care_plan(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, DATE, UUID, UUID, TEXT, JSONB
) IS 'Atomare Live-Pflegeplanspeicherung mit Maßnahmen, Version und Audit-Readback.';
