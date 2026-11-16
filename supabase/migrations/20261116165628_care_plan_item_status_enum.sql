-- Pflegeplanmaßnahmen speichern den Status als care_plan_item_status.
-- Der übrige Vertrag der vorhandenen planweisen Transaktion bleibt erhalten.
BEGIN;

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
      COALESCE(NULLIF(v_item->>'status',''),'active')::public.care_plan_item_status,
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

COMMIT;
