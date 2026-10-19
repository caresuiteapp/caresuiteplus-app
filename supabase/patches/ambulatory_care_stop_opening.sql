-- CareSuite+ ambulant: S-01 — Einsatz vor tatsächlichem Beginn sicher öffnen.
-- Plantermin, Identitätsabgleich und tatsächlicher Beginn bleiben getrennte Ereignisse.

CREATE TABLE IF NOT EXISTS public.care_tour_stop_openings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tour_id uuid NOT NULL REFERENCES public.care_tours(id) ON DELETE RESTRICT,
  stop_id uuid NOT NULL REFERENCES public.care_tour_stops(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  care_plan_id uuid NOT NULL REFERENCES public.care_plans(id) ON DELETE RESTRICT,
  care_plan_version integer NOT NULL,
  stop_updated_at timestamptz NOT NULL,
  client_updated_at timestamptz NOT NULL,
  care_plan_updated_at timestamptz NOT NULL,
  plan_items_snapshot jsonb NOT NULL CHECK (jsonb_typeof(plan_items_snapshot)='array'),
  identity_method text NOT NULL CHECK (identity_method='last_name_and_date_of_birth'),
  warning_snapshot jsonb NOT NULL,
  opened_by uuid NOT NULL,
  opened_by_name text NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX IF NOT EXISTS care_tour_stop_openings_one_start
  ON public.care_tour_stop_openings(stop_id);
CREATE INDEX IF NOT EXISTS care_tour_stop_openings_tenant_client
  ON public.care_tour_stop_openings(tenant_id,client_id,opened_at DESC);
ALTER TABLE public.care_tour_stop_openings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.care_tour_stop_openings FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION care_private.stop_opening_allowed(p_tour public.care_tours) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND (
  public.has_permission('pflege.plans.manage') OR
  (public.current_portal_type() IS NOT DISTINCT FROM 'employee'
   AND p_tour.employee_id IS NOT DISTINCT FROM public.resolve_current_employee_id())
 )
$$;

CREATE OR REPLACE FUNCTION care_private.stop_opening_context(p_stop_id uuid) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 t uuid:=public.current_tenant_id(); s public.care_tour_stops; tr public.care_tours;
 cl public.clients; p public.care_plans; plan_count integer; plan_items jsonb; warnings jsonb;
BEGIN
 IF t IS NULL OR auth.uid() IS NULL THEN RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501'; END IF;
 SELECT * INTO s FROM public.care_tour_stops WHERE id=p_stop_id AND tenant_id=t;
 IF NOT FOUND THEN RAISE EXCEPTION 'Einsatz nicht gefunden.' USING ERRCODE='42501'; END IF;
 SELECT * INTO tr FROM public.care_tours WHERE id=s.tour_id AND tenant_id=t;
 IF NOT FOUND OR NOT care_private.stop_opening_allowed(tr) THEN RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501'; END IF;
 IF tr.status<>'in_progress' OR s.status<>'arrived' THEN RAISE EXCEPTION 'Einsatz muss vor dem Öffnen als angekommen geführt werden.' USING ERRCODE='40001'; END IF;
 SELECT * INTO cl FROM public.clients WHERE id=s.client_id AND tenant_id=t AND deleted_at IS NULL;
 IF NOT FOUND OR NOT public.is_active_pfleger_client(cl.id) THEN RAISE EXCEPTION 'Kein aktiver Pflegefall.' USING ERRCODE='23514'; END IF;
 SELECT count(*) INTO plan_count FROM public.care_plans
  WHERE tenant_id=t AND client_id=cl.id AND status IN('active','aktiv')
   AND valid_from<=tr.tour_date AND (valid_until IS NULL OR valid_until>=tr.tour_date);
 IF plan_count<>1 THEN RAISE EXCEPTION 'Für den Einsatz muss genau eine gültige aktive Pflegeplanfassung vorliegen.' USING ERRCODE='23514'; END IF;
 SELECT * INTO p FROM public.care_plans
  WHERE tenant_id=t AND client_id=cl.id AND status IN('active','aktiv')
   AND valid_from<=tr.tour_date AND (valid_until IS NULL OR valid_until>=tr.tour_date)
  ORDER BY updated_at DESC,id DESC LIMIT 1;
 SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'id',i.id,'title',i.title,'intervention',i.intervention,'timing',i.timing,
  'frequency',i.frequency,'warningSigns',i.warning_signs,'escalationPath',i.escalation_path,
  'status',i.status) ORDER BY i.sort_order,i.id),'[]'::jsonb) INTO plan_items
 FROM public.care_plan_items i WHERE i.tenant_id=t AND i.care_plan_id=p.id AND i.status NOT IN('completed','archived');
 warnings:=jsonb_strip_nulls(jsonb_build_object(
  'allergies',NULLIF(cl.allergies,''),
  'employeeNotes',NULLIF(cl.visible_notes_for_employee,''),
  'emergencyNotes',NULLIF(cl.emergency_notes,''),
  'planRisks',NULLIF(p.risks,''),
  'planNotes',NULLIF(p.notes,'')));
 RETURN jsonb_build_object(
  'stopId',s.id,'tourId',tr.id,'clientId',cl.id,
  'clientName',concat_ws(' ',cl.first_name,cl.last_name),
  'serviceSummary',s.service_summary,'plannedStart',s.planned_start,'plannedEnd',s.planned_end,
  'identity',jsonb_build_object('lastNameRequired',true,'dateOfBirthRequired',true,'dateOfBirthAvailable',cl.date_of_birth IS NOT NULL),
  'plan',jsonb_build_object('id',p.id,'title',p.title,'version',p.version,'validFrom',p.valid_from,'validUntil',p.valid_until,'updatedAt',p.updated_at,'items',plan_items),
  'warnings',warnings,
  'expected',jsonb_build_object('stopUpdatedAt',s.updated_at,'clientUpdatedAt',cl.updated_at,'planUpdatedAt',p.updated_at));
END $$;

CREATE OR REPLACE FUNCTION care_private.confirm_stop_opening(
 p_stop_id uuid,p_plan_id uuid,p_plan_version integer,p_expected_stop_updated_at timestamptz,
 p_expected_client_updated_at timestamptz,p_expected_plan_updated_at timestamptz,
 p_last_name text,p_date_of_birth date
) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 t uuid:=public.current_tenant_id(); s public.care_tour_stops; tr public.care_tours;
 cl public.clients; p public.care_plans; plan_count integer; warnings jsonb; plan_items jsonb; opening_id uuid; actor_name text;
BEGIN
 IF t IS NULL OR auth.uid() IS NULL THEN RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501'; END IF;
 SELECT * INTO s FROM public.care_tour_stops WHERE id=p_stop_id AND tenant_id=t FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Einsatz nicht gefunden.' USING ERRCODE='42501'; END IF;
 SELECT * INTO tr FROM public.care_tours WHERE id=s.tour_id AND tenant_id=t FOR UPDATE;
 IF NOT FOUND OR NOT care_private.stop_opening_allowed(tr) THEN RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501'; END IF;
 IF tr.status<>'in_progress' OR s.status<>'arrived' OR s.updated_at IS DISTINCT FROM p_expected_stop_updated_at THEN
  RAISE EXCEPTION 'Einsatz wurde zwischenzeitlich geändert. Bitte erneut öffnen.' USING ERRCODE='40001';
 END IF;
 SELECT * INTO cl FROM public.clients WHERE id=s.client_id AND tenant_id=t AND deleted_at IS NULL FOR SHARE;
 IF NOT FOUND OR NOT public.is_active_pfleger_client(cl.id) OR cl.updated_at IS DISTINCT FROM p_expected_client_updated_at THEN
  RAISE EXCEPTION 'Pflegefall wurde geändert. Einsatz erneut öffnen.' USING ERRCODE='40001';
 END IF;
 IF cl.date_of_birth IS NULL OR lower(btrim(cl.last_name)) IS DISTINCT FROM lower(btrim(p_last_name)) OR cl.date_of_birth IS DISTINCT FROM p_date_of_birth THEN
  RAISE EXCEPTION 'Identität stimmt nicht mit dem gebundenen Pflegefall überein.' USING ERRCODE='23514';
 END IF;
 SELECT count(*) INTO plan_count FROM public.care_plans
  WHERE tenant_id=t AND client_id=cl.id AND status IN('active','aktiv')
   AND valid_from<=tr.tour_date AND (valid_until IS NULL OR valid_until>=tr.tour_date);
 IF plan_count<>1 THEN RAISE EXCEPTION 'Gültige Pflegeplanfassung ist nicht mehr eindeutig. Einsatz erneut öffnen.' USING ERRCODE='40001'; END IF;
 SELECT * INTO p FROM public.care_plans WHERE id=p_plan_id AND tenant_id=t AND client_id=cl.id
  AND status IN('active','aktiv') AND valid_from<=tr.tour_date AND (valid_until IS NULL OR valid_until>=tr.tour_date) FOR SHARE;
 IF NOT FOUND OR p.version IS DISTINCT FROM p_plan_version OR p.updated_at IS DISTINCT FROM p_expected_plan_updated_at THEN
  RAISE EXCEPTION 'Pflegeplan wurde geändert. Einsatz erneut öffnen.' USING ERRCODE='40001';
 END IF;
 IF EXISTS(SELECT 1 FROM public.care_tour_stops x JOIN public.care_tours xt ON xt.id=x.tour_id
  WHERE xt.tenant_id=t AND xt.employee_id=tr.employee_id AND x.id<>s.id AND x.status='in_progress') THEN
  RAISE EXCEPTION 'Ein anderer Einsatz läuft bereits.' USING ERRCODE='23514';
 END IF;
 SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'id',i.id,'updatedAt',i.updated_at,'sortOrder',i.sort_order,'title',i.title,'category',i.category,
  'description',i.description,'goal',i.goal,'intervention',i.intervention,'frequency',i.frequency,
  'timing',i.timing,'responsibleRole',i.responsible_role,'personContribution',i.person_contribution,
  'relativesContribution',i.relatives_contribution,'warningSigns',i.warning_signs,
  'escalationPath',i.escalation_path,'evaluationCriteria',i.evaluation_criteria,'notes',i.notes,'status',i.status
 ) ORDER BY i.sort_order,i.id),'[]'::jsonb) INTO plan_items
 FROM public.care_plan_items i WHERE i.tenant_id=t AND i.care_plan_id=p.id AND i.status NOT IN('completed','cancelled');
 warnings:=jsonb_strip_nulls(jsonb_build_object('allergies',NULLIF(cl.allergies,''),'employeeNotes',NULLIF(cl.visible_notes_for_employee,''),'emergencyNotes',NULLIF(cl.emergency_notes,''),'planRisks',NULLIF(p.risks,''),'planNotes',NULLIF(p.notes,'')));
 actor_name:=COALESCE(NULLIF(public.clinical_actor_name(),''),NULLIF(tr.employee_name_snapshot,''),'Unbekannt');
 INSERT INTO public.care_tour_stop_openings(tenant_id,tour_id,stop_id,client_id,care_plan_id,care_plan_version,stop_updated_at,client_updated_at,care_plan_updated_at,plan_items_snapshot,identity_method,warning_snapshot,opened_by,opened_by_name)
 VALUES(t,tr.id,s.id,cl.id,p.id,p.version,s.updated_at,cl.updated_at,p.updated_at,plan_items,'last_name_and_date_of_birth',warnings,auth.uid(),actor_name)
 RETURNING id INTO opening_id;
 UPDATE public.care_tour_stops SET status='in_progress',actual_started_at=clock_timestamp(),updated_at=clock_timestamp() WHERE id=s.id;
 INSERT INTO public.care_tour_events(tenant_id,tour_id,stop_id,actor_id,actor_name,action,note)
 VALUES(t,tr.id,s.id,auth.uid(),actor_name,'opening_confirmed→in_progress','Identität und aktuelle Pflegeplanfassung gebunden.');
 RETURN jsonb_build_object('id',s.id,'openingId',opening_id);
END $$;

CREATE OR REPLACE FUNCTION public.get_ambulatory_care_stop_opening_context(p_stop_id uuid) RETURNS jsonb
 LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT care_private.stop_opening_context(p_stop_id)$$;
CREATE OR REPLACE FUNCTION public.confirm_ambulatory_care_stop_opening(
 p_stop_id uuid,p_plan_id uuid,p_plan_version integer,p_expected_stop_updated_at timestamptz,
 p_expected_client_updated_at timestamptz,p_expected_plan_updated_at timestamptz,p_last_name text,p_date_of_birth date
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT care_private.confirm_stop_opening(p_stop_id,p_plan_id,p_plan_version,p_expected_stop_updated_at,p_expected_client_updated_at,p_expected_plan_updated_at,p_last_name,p_date_of_birth)
$$;
REVOKE ALL ON FUNCTION care_private.stop_opening_allowed(public.care_tours),care_private.stop_opening_context(uuid),care_private.confirm_stop_opening(uuid,uuid,integer,timestamptz,timestamptz,timestamptz,text,date) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.get_ambulatory_care_stop_opening_context(uuid),public.confirm_ambulatory_care_stop_opening(uuid,uuid,integer,timestamptz,timestamptz,timestamptz,text,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION care_private.stop_opening_context(uuid),care_private.confirm_stop_opening(uuid,uuid,integer,timestamptz,timestamptz,timestamptz,text,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ambulatory_care_stop_opening_context(uuid),public.confirm_ambulatory_care_stop_opening(uuid,uuid,integer,timestamptz,timestamptz,timestamptz,text,date) TO authenticated;
