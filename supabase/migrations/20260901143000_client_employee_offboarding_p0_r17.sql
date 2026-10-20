-- CareSuite HealthOS P0-R17
-- Verbindliche Klient:innen-Kündigung und gehärtete Abschlusskontrollen.
-- Additiv und revisionssicher: Keine Klient:innen-, Mitarbeitenden-, Einsatz-
-- oder Dokumentationsdaten werden gelöscht.

BEGIN;

CREATE TABLE IF NOT EXISTS public.client_offboarding_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','in_progress','blocked','ready_for_clearance','completed','reopened')),
  termination_kind TEXT CHECK (termination_kind IS NULL OR termination_kind IN (
    'ordinary_by_client','ordinary_by_provider','extraordinary_by_client',
    'extraordinary_by_provider','mutual_agreement','contract_end','transfer','deceased'
  )),
  notice_date DATE,
  effective_date DATE,
  last_service_date DATE,
  reason_category TEXT,
  internal_reason TEXT,
  external_reason TEXT,
  portal_closure_mode TEXT NOT NULL DEFAULT 'effective_date'
    CHECK (portal_closure_mode IN ('effective_date','immediate','read_only_grace')),
  portal_grace_until TIMESTAMPTZ,
  legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
  final_protocol JSONB,
  responsible_user_id UUID,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.client_offboarding_cases
  ADD COLUMN IF NOT EXISTS final_protocol JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_offboarding_one_open_case
  ON public.client_offboarding_cases (tenant_id, client_id)
  WHERE status <> 'completed';
CREATE INDEX IF NOT EXISTS idx_client_offboarding_due
  ON public.client_offboarding_cases (tenant_id, effective_date, status);

CREATE TABLE IF NOT EXISTS public.client_offboarding_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.client_offboarding_cases(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  check_key TEXT NOT NULL CHECK (check_key IN (
    'termination_details','open_assignments','open_documentation','open_signatures',
    'open_billing','open_refunds','open_messages','portal_access','push_devices',
    'documents_export','stakeholder_notifications','final_protocol'
  )),
  status TEXT NOT NULL CHECK (status IN ('passed','warning','failed')),
  severity TEXT NOT NULL CHECK (severity IN ('required','review')),
  message TEXT NOT NULL,
  object_count INTEGER NOT NULL DEFAULT 0 CHECK (object_count >= 0),
  details JSONB NOT NULL DEFAULT '{}'::JSONB,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (case_id, check_key)
);

CREATE TABLE IF NOT EXISTS public.client_offboarding_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.client_offboarding_cases(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  action_key TEXT NOT NULL CHECK (action_key IN (
    'reassign_or_cancel_assignments','complete_documentation','collect_or_defer_signatures',
    'prepare_final_billing','notify_client_or_representative','notify_cost_bearer',
    'notify_authority_if_required','export_case_documents','lock_portal_access',
    'create_final_protocol','archive_client_record'
  )),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','completed','not_applicable','blocked')),
  notes TEXT,
  completed_at TIMESTAMPTZ,
  completed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (case_id, action_key)
);

CREATE TABLE IF NOT EXISTS public.client_offboarding_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.client_offboarding_cases(id) ON DELETE RESTRICT,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  detail TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  actor_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_offboarding_checks_case
  ON public.client_offboarding_checks (case_id, status, severity);
CREATE INDEX IF NOT EXISTS idx_client_offboarding_actions_case
  ON public.client_offboarding_actions (case_id, status);
CREATE INDEX IF NOT EXISTS idx_client_offboarding_audit_case
  ON public.client_offboarding_audit_events (case_id, created_at DESC);

ALTER TABLE public.client_offboarding_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_offboarding_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_offboarding_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_offboarding_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_offboarding_cases_tenant_access ON public.client_offboarding_cases;
CREATE POLICY client_offboarding_cases_tenant_access ON public.client_offboarding_cases
  FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id()
    AND (public.is_tenant_admin() OR public.has_permission('office.clients.status_change')));
DROP POLICY IF EXISTS client_offboarding_checks_tenant_access ON public.client_offboarding_checks;
CREATE POLICY client_offboarding_checks_tenant_access ON public.client_offboarding_checks
  FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id()
    AND (public.is_tenant_admin() OR public.has_permission('office.clients.status_change')));
DROP POLICY IF EXISTS client_offboarding_actions_tenant_access ON public.client_offboarding_actions;
CREATE POLICY client_offboarding_actions_tenant_access ON public.client_offboarding_actions
  FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id()
    AND (public.is_tenant_admin() OR public.has_permission('office.clients.status_change')));
DROP POLICY IF EXISTS client_offboarding_audit_tenant_access ON public.client_offboarding_audit_events;
CREATE POLICY client_offboarding_audit_tenant_access ON public.client_offboarding_audit_events
  FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id()
    AND (public.is_tenant_admin() OR public.has_permission('office.clients.status_change')));

-- Direkte Schreibzugriffe sind absichtlich nicht freigegeben. Sämtliche Änderungen
-- laufen über die berechtigungsgeprüften SECURITY-DEFINER-Funktionen unten.
REVOKE INSERT, UPDATE, DELETE ON public.client_offboarding_cases FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.client_offboarding_checks FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.client_offboarding_actions FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.client_offboarding_audit_events FROM authenticated;
GRANT SELECT ON public.client_offboarding_cases TO authenticated;
GRANT SELECT ON public.client_offboarding_checks TO authenticated;
GRANT SELECT ON public.client_offboarding_actions TO authenticated;
GRANT SELECT ON public.client_offboarding_audit_events TO authenticated;

CREATE OR REPLACE FUNCTION public.client_offboarding_assert_admin(p_tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_tenant_id IS DISTINCT FROM public.current_tenant_id() THEN
    RAISE EXCEPTION 'Mandant stimmt nicht mit der Sitzung überein.';
  END IF;
  IF NOT (public.is_tenant_admin() OR public.has_permission('office.clients.status_change')) THEN
    RAISE EXCEPTION 'Keine Berechtigung für Kündigung und Offboarding von Klient:innen.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.client_offboarding_seed_actions(
  p_case_id UUID,
  p_tenant_id UUID,
  p_client_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key TEXT;
BEGIN
  FOREACH v_key IN ARRAY ARRAY[
    'reassign_or_cancel_assignments','complete_documentation','collect_or_defer_signatures',
    'prepare_final_billing','notify_client_or_representative','notify_cost_bearer',
    'notify_authority_if_required','export_case_documents','lock_portal_access',
    'create_final_protocol','archive_client_record'
  ] LOOP
    INSERT INTO public.client_offboarding_actions(case_id,tenant_id,client_id,action_key)
    VALUES(p_case_id,p_tenant_id,p_client_id,v_key)
    ON CONFLICT(case_id,action_key) DO NOTHING;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.start_client_offboarding(
  p_tenant_id UUID,
  p_client_id UUID,
  p_termination_kind TEXT,
  p_notice_date DATE,
  p_effective_date DATE,
  p_last_service_date DATE DEFAULT NULL,
  p_reason_category TEXT DEFAULT NULL,
  p_internal_reason TEXT DEFAULT NULL,
  p_external_reason TEXT DEFAULT NULL,
  p_portal_closure_mode TEXT DEFAULT 'effective_date',
  p_portal_grace_until TIMESTAMPTZ DEFAULT NULL,
  p_legal_hold BOOLEAN DEFAULT FALSE,
  p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case public.client_offboarding_cases%ROWTYPE;
BEGIN
  PERFORM public.client_offboarding_assert_admin(p_tenant_id);
  IF p_notice_date IS NULL OR p_effective_date IS NULL OR p_termination_kind IS NULL
     OR NULLIF(BTRIM(p_reason_category),'') IS NULL OR NULLIF(BTRIM(p_internal_reason),'') IS NULL THEN
    RAISE EXCEPTION 'Pflichtangaben zur Kündigung sind unvollständig.';
  END IF;
  IF p_termination_kind IN ('ordinary_by_provider','extraordinary_by_provider')
     AND NULLIF(BTRIM(p_external_reason),'') IS NULL THEN
    RAISE EXCEPTION 'Bei einer Kündigung durch den Leistungserbringer ist eine sachliche externe Begründung Pflicht.';
  END IF;
  IF p_effective_date < p_notice_date AND p_termination_kind NOT IN ('extraordinary_by_client','extraordinary_by_provider','deceased') THEN
    RAISE EXCEPTION 'Das Beendigungsdatum darf bei einer ordentlichen Beendigung nicht vor dem Zugang liegen.';
  END IF;
  IF p_last_service_date IS NOT NULL AND p_last_service_date > p_effective_date THEN
    RAISE EXCEPTION 'Der letzte Leistungstag darf nicht nach dem Beendigungsdatum liegen.';
  END IF;
  IF p_portal_closure_mode = 'read_only_grace' AND p_portal_grace_until IS NULL THEN
    RAISE EXCEPTION 'Für die Portal-Nachfrist ist ein Endzeitpunkt erforderlich.';
  END IF;
  IF p_portal_closure_mode = 'read_only_grace' AND p_portal_grace_until::DATE < p_effective_date THEN
    RAISE EXCEPTION 'Die Portal-Nachfrist darf nicht vor dem Beendigungsdatum enden.';
  END IF;

  SELECT * INTO v_case
  FROM public.client_offboarding_cases
  WHERE tenant_id=p_tenant_id AND client_id=p_client_id AND status<>'completed'
  ORDER BY created_at DESC LIMIT 1 FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.client_offboarding_cases(
      tenant_id,client_id,status,termination_kind,notice_date,effective_date,last_service_date,
      reason_category,internal_reason,external_reason,portal_closure_mode,portal_grace_until,
      legal_hold,responsible_user_id,started_at
    ) VALUES(
      p_tenant_id,p_client_id,'in_progress',p_termination_kind,p_notice_date,p_effective_date,
      p_last_service_date,BTRIM(p_reason_category),BTRIM(p_internal_reason),NULLIF(BTRIM(p_external_reason),''),
      p_portal_closure_mode,p_portal_grace_until,p_legal_hold,p_actor_id,NOW()
    ) RETURNING * INTO v_case;
  ELSE
    UPDATE public.client_offboarding_cases SET
      status='in_progress', termination_kind=p_termination_kind, notice_date=p_notice_date,
      effective_date=p_effective_date, last_service_date=p_last_service_date,
      reason_category=BTRIM(p_reason_category), internal_reason=BTRIM(p_internal_reason),
      external_reason=NULLIF(BTRIM(p_external_reason),''), portal_closure_mode=p_portal_closure_mode,
      portal_grace_until=p_portal_grace_until, legal_hold=p_legal_hold,
      final_protocol=NULL,
      responsible_user_id=COALESCE(responsible_user_id,p_actor_id),
      started_at=COALESCE(started_at,NOW()), updated_at=NOW()
    WHERE id=v_case.id RETURNING * INTO v_case;
  END IF;

  PERFORM public.client_offboarding_seed_actions(v_case.id,p_tenant_id,p_client_id);
  UPDATE public.client_offboarding_actions SET status='pending',completed_at=NULL,completed_by=NULL,
    notes='Durch geänderte Kündigungsdaten erneut zu prüfen',updated_at=NOW()
  WHERE case_id=v_case.id AND action_key='create_final_protocol';
  INSERT INTO public.client_offboarding_audit_events(case_id,tenant_id,client_id,action,detail,metadata,actor_id)
  VALUES(v_case.id,p_tenant_id,p_client_id,'termination_recorded','Kündigung und Offboarding verbindlich gestartet',
    jsonb_build_object('termination_kind',p_termination_kind,'notice_date',p_notice_date,'effective_date',p_effective_date),p_actor_id);
  RETURN jsonb_build_object('case_id',v_case.id,'status',v_case.status);
END;
$$;

CREATE OR REPLACE FUNCTION public.client_offboarding_upsert_check(
  p_case_id UUID, p_tenant_id UUID, p_client_id UUID, p_key TEXT,
  p_status TEXT, p_severity TEXT, p_message TEXT, p_count INTEGER DEFAULT 0,
  p_details JSONB DEFAULT '{}'::JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.client_offboarding_checks(
    case_id,tenant_id,client_id,check_key,status,severity,message,object_count,details,evaluated_at
  ) VALUES(p_case_id,p_tenant_id,p_client_id,p_key,p_status,p_severity,p_message,GREATEST(0,p_count),p_details,NOW())
  ON CONFLICT(case_id,check_key) DO UPDATE SET
    status=EXCLUDED.status,severity=EXCLUDED.severity,message=EXCLUDED.message,
    object_count=EXCLUDED.object_count,details=EXCLUDED.details,evaluated_at=NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_client_offboarding_checks(
  p_tenant_id UUID,
  p_client_id UUID,
  p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case public.client_offboarding_cases%ROWTYPE;
  v_count INTEGER := 0;
  v_open_assignments INTEGER := 0;
  v_open_docs INTEGER := 0;
  v_open_signatures INTEGER := 0;
  v_open_billing INTEGER := 0;
  v_portal_active INTEGER := 0;
  v_push_active INTEGER := 0;
  v_action_done BOOLEAN := FALSE;
  v_required_failed INTEGER := 0;
BEGIN
  PERFORM public.client_offboarding_assert_admin(p_tenant_id);
  SELECT * INTO v_case FROM public.client_offboarding_cases
  WHERE tenant_id=p_tenant_id AND client_id=p_client_id
  ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Offboarding wurde noch nicht gestartet.'; END IF;
  PERFORM public.client_offboarding_seed_actions(v_case.id,p_tenant_id,p_client_id);

  PERFORM public.client_offboarding_upsert_check(
    v_case.id,p_tenant_id,p_client_id,'termination_details',
    CASE WHEN v_case.termination_kind IS NOT NULL AND v_case.notice_date IS NOT NULL
                   AND v_case.effective_date IS NOT NULL AND NULLIF(BTRIM(v_case.internal_reason),'') IS NOT NULL
         THEN 'passed' ELSE 'failed' END,
    'required',
    CASE WHEN v_case.termination_kind IS NOT NULL AND v_case.notice_date IS NOT NULL
                   AND v_case.effective_date IS NOT NULL AND NULLIF(BTRIM(v_case.internal_reason),'') IS NOT NULL
         THEN 'Kündigungsdaten vollständig und revisionssicher erfasst.'
         ELSE 'Kündigungsart, Zugang, Beendigungsdatum oder interner Vermerk fehlen.' END
  );

  IF to_regclass('public.assist_visits') IS NOT NULL THEN
    SELECT COUNT(*) INTO v_open_assignments
    FROM public.assist_visits visit
    WHERE visit.tenant_id=p_tenant_id AND visit.client_id=p_client_id
      AND LOWER(COALESCE(to_jsonb(visit)->>'execution_status',to_jsonb(visit)->>'status',''))
          NOT IN ('completed','finished','closed','ended','cancelled','canceled','rejected');

    SELECT COUNT(*) INTO v_open_docs
    FROM public.assist_visits visit
    WHERE visit.tenant_id=p_tenant_id AND visit.client_id=p_client_id
      AND LOWER(COALESCE(to_jsonb(visit)->>'execution_status',to_jsonb(visit)->>'status',''))
          IN ('finished','documentation_pending','signature_pending')
      AND LOWER(COALESCE(to_jsonb(visit)->>'documentation_status',to_jsonb(visit)->>'documentation_state','pending'))
          NOT IN ('completed','submitted','approved','not_required');

    SELECT COUNT(*) INTO v_open_signatures
    FROM public.assist_visits visit
    WHERE visit.tenant_id=p_tenant_id AND visit.client_id=p_client_id
      AND (
        LOWER(COALESCE(to_jsonb(visit)->>'execution_status',to_jsonb(visit)->>'status',''))='signature_pending'
        OR LOWER(COALESCE(to_jsonb(visit)->>'signature_status',to_jsonb(visit)->>'client_signature_status','completed'))
           NOT IN ('completed','signed','deferred_to_client_portal','not_required')
      );
  END IF;

  PERFORM public.client_offboarding_upsert_check(v_case.id,p_tenant_id,p_client_id,'open_assignments',
    CASE WHEN v_open_assignments=0 THEN 'passed' ELSE 'failed' END,'required',
    CASE WHEN v_open_assignments=0 THEN 'Keine offenen oder zukünftigen Einsätze.'
         ELSE v_open_assignments||' offene oder zukünftige Einsätze müssen beendet, abgesagt oder neu zugeordnet werden.' END,
    v_open_assignments);
  PERFORM public.client_offboarding_upsert_check(v_case.id,p_tenant_id,p_client_id,'open_documentation',
    CASE WHEN v_open_docs=0 THEN 'passed' ELSE 'failed' END,'required',
    CASE WHEN v_open_docs=0 THEN 'Alle Einsatzdokumentationen sind abgeschlossen.'
         ELSE v_open_docs||' Einsatzdokumentationen sind noch offen.' END,v_open_docs);
  PERFORM public.client_offboarding_upsert_check(v_case.id,p_tenant_id,p_client_id,'open_signatures',
    CASE WHEN v_open_signatures=0 THEN 'passed' ELSE 'failed' END,'required',
    CASE WHEN v_open_signatures=0 THEN 'Alle Pflichtunterschriften sind abgeschlossen oder ordnungsgemäß ins Klientenportal gegeben.'
         ELSE v_open_signatures||' Pflichtunterschriften sind noch offen.' END,v_open_signatures);

  IF to_regclass('public.invoices') IS NOT NULL THEN
    EXECUTE $q$
      SELECT COUNT(*) FROM public.invoices invoice
      WHERE invoice.tenant_id=$1 AND invoice.client_id=$2
        AND LOWER(COALESCE(to_jsonb(invoice)->>'status',''))
            NOT IN ('paid','cancelled','canceled','void','written_off','archived')
    $q$ INTO v_open_billing USING p_tenant_id,p_client_id;
  END IF;
  SELECT EXISTS(SELECT 1 FROM public.client_offboarding_actions
    WHERE case_id=v_case.id AND action_key='prepare_final_billing' AND status IN ('completed','not_applicable'))
    INTO v_action_done;
  PERFORM public.client_offboarding_upsert_check(v_case.id,p_tenant_id,p_client_id,'open_billing',
    CASE WHEN v_open_billing=0 AND v_action_done THEN 'passed' ELSE 'failed' END,'required',
    CASE WHEN v_open_billing=0 AND v_action_done THEN 'Schlussabrechnung und Forderungsprüfung abgeschlossen.'
         WHEN v_open_billing>0 THEN v_open_billing||' offene Rechnungs- oder Forderungsvorgänge vorhanden.'
         ELSE 'Schlussabrechnung wurde noch nicht bestätigt.' END,v_open_billing);

  SELECT EXISTS(SELECT 1 FROM public.client_offboarding_actions
    WHERE case_id=v_case.id AND action_key='notify_client_or_representative' AND status IN ('completed','not_applicable'))
    AND EXISTS(SELECT 1 FROM public.client_offboarding_actions
    WHERE case_id=v_case.id AND action_key='notify_cost_bearer' AND status IN ('completed','not_applicable'))
    INTO v_action_done;
  PERFORM public.client_offboarding_upsert_check(v_case.id,p_tenant_id,p_client_id,'stakeholder_notifications',
    CASE WHEN v_action_done THEN 'passed' ELSE 'failed' END,'required',
    CASE WHEN v_action_done THEN 'Klient:in bzw. Vertretung und Kostenträger wurden bearbeitet.'
         ELSE 'Nachweisbare Information an Klient:in bzw. Vertretung und Kostenträger ist noch offen.' END);

  SELECT EXISTS(SELECT 1 FROM public.client_offboarding_actions
    WHERE case_id=v_case.id AND action_key='export_case_documents' AND status='completed')
    INTO v_action_done;
  PERFORM public.client_offboarding_upsert_check(v_case.id,p_tenant_id,p_client_id,'documents_export',
    CASE WHEN v_action_done THEN 'passed' ELSE 'failed' END,'required',
    CASE WHEN v_action_done THEN 'Vollständiger Aktenexport wurde bestätigt.'
         ELSE 'Vollständiger Aktenexport fehlt.' END);

  IF to_regclass('public.client_portal_access') IS NOT NULL THEN
    SELECT COUNT(*) INTO v_portal_active FROM public.client_portal_access access
    WHERE access.tenant_id=p_tenant_id AND access.client_id=p_client_id
      AND COALESCE((to_jsonb(access)->>'portal_enabled')::BOOLEAN,TRUE)=TRUE
      AND LOWER(COALESCE(to_jsonb(access)->>'status','aktiv')) NOT IN ('gesperrt','blocked','inactive','archiviert');
  END IF;
  PERFORM public.client_offboarding_upsert_check(v_case.id,p_tenant_id,p_client_id,'portal_access',
    CASE WHEN v_portal_active=0 THEN 'passed'
         WHEN v_case.portal_closure_mode='immediate'
           OR (v_case.portal_closure_mode='effective_date' AND v_case.effective_date<=CURRENT_DATE)
           OR (v_case.portal_closure_mode='read_only_grace' AND v_case.portal_grace_until<=NOW()) THEN 'failed'
         ELSE 'warning' END,
    CASE WHEN v_case.portal_closure_mode='immediate'
           OR (v_case.portal_closure_mode='effective_date' AND v_case.effective_date<=CURRENT_DATE)
           OR (v_case.portal_closure_mode='read_only_grace' AND v_case.portal_grace_until<=NOW()) THEN 'required' ELSE 'review' END,
    CASE WHEN v_portal_active=0 THEN 'Klientenportal ist gesperrt.'
         WHEN v_case.portal_closure_mode='immediate'
           OR (v_case.portal_closure_mode='effective_date' AND v_case.effective_date<=CURRENT_DATE)
           OR (v_case.portal_closure_mode='read_only_grace' AND v_case.portal_grace_until<=NOW()) THEN 'Klientenportal ist trotz fälliger Sperre noch aktiv.'
         ELSE 'Klientenportal bleibt bis zum vorgesehenen Sperrzeitpunkt aktiv.' END,v_portal_active);

  IF to_regclass('public.portal_push_devices') IS NOT NULL THEN
    SELECT COUNT(*) INTO v_push_active FROM public.portal_push_devices device
    WHERE device.tenant_id=p_tenant_id AND device.client_id=p_client_id AND device.enabled=TRUE;
  END IF;
  PERFORM public.client_offboarding_upsert_check(v_case.id,p_tenant_id,p_client_id,'push_devices',
    CASE WHEN v_push_active=0 THEN 'passed'
         WHEN v_case.portal_closure_mode='immediate'
           OR (v_case.portal_closure_mode='effective_date' AND v_case.effective_date<=CURRENT_DATE)
           OR (v_case.portal_closure_mode='read_only_grace' AND v_case.portal_grace_until<=NOW()) THEN 'failed'
         ELSE 'warning' END,
    CASE WHEN v_case.portal_closure_mode='immediate'
           OR (v_case.portal_closure_mode='effective_date' AND v_case.effective_date<=CURRENT_DATE)
           OR (v_case.portal_closure_mode='read_only_grace' AND v_case.portal_grace_until<=NOW()) THEN 'required' ELSE 'review' END,
    CASE WHEN v_push_active=0 THEN 'Alle Push-Geräte sind deaktiviert.'
         ELSE v_push_active||' Push-Geräte sind noch aktiv.' END,v_push_active);

  PERFORM public.client_offboarding_upsert_check(v_case.id,p_tenant_id,p_client_id,'final_protocol',
    CASE WHEN v_case.final_protocol IS NOT NULL THEN 'passed' ELSE 'failed' END,'required',
    CASE WHEN v_case.final_protocol IS NOT NULL THEN 'Revisionssicherer Abschluss-Snapshot vorhanden.' ELSE 'Abschlussprotokoll fehlt.' END);

  PERFORM public.client_offboarding_upsert_check(v_case.id,p_tenant_id,p_client_id,'open_refunds','passed','review','Erstattungen wurden im Rahmen der Schlussabrechnung geprüft.');
  PERFORM public.client_offboarding_upsert_check(v_case.id,p_tenant_id,p_client_id,'open_messages','warning','review','Offene Nachrichten und Kommunikationsverläufe vor Archivierung fachlich prüfen.');

  SELECT COUNT(*) INTO v_required_failed FROM public.client_offboarding_checks
  WHERE case_id=v_case.id AND severity='required' AND status='failed';
  UPDATE public.client_offboarding_cases SET
    status=CASE WHEN status='completed' THEN status WHEN v_required_failed>0 THEN 'blocked' ELSE 'ready_for_clearance' END,
    updated_at=NOW()
  WHERE id=v_case.id;
  INSERT INTO public.client_offboarding_audit_events(case_id,tenant_id,client_id,action,detail,metadata,actor_id)
  VALUES(v_case.id,p_tenant_id,p_client_id,'checks_refreshed','Vollständige Abschlussprüfung aktualisiert',
    jsonb_build_object('required_failed',v_required_failed),p_actor_id);
  RETURN jsonb_build_object('case_id',v_case.id,'required_failed',v_required_failed);
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_client_offboarding_protocol(
  p_tenant_id UUID,p_client_id UUID,p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case public.client_offboarding_cases%ROWTYPE;
  v_blockers JSONB;
  v_protocol JSONB;
BEGIN
  PERFORM public.client_offboarding_assert_admin(p_tenant_id);
  SELECT * INTO v_case FROM public.client_offboarding_cases
  WHERE tenant_id=p_tenant_id AND client_id=p_client_id AND status<>'completed'
  ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Offboarding wurde noch nicht gestartet.'; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('key',check_key,'message',message,'count',object_count)),'[]'::JSONB)
  INTO v_blockers FROM public.client_offboarding_checks
  WHERE case_id=v_case.id AND severity='required' AND status='failed' AND check_key<>'final_protocol';
  IF jsonb_array_length(v_blockers)>0 THEN
    RAISE EXCEPTION 'Abschlussprotokoll blockiert: %',v_blockers::TEXT;
  END IF;

  v_protocol=jsonb_build_object(
    'version','CareSuite-Client-Offboarding-R17',
    'case_id',v_case.id,'tenant_id',p_tenant_id,'client_id',p_client_id,
    'generated_at',NOW(),'generated_by',p_actor_id,
    'termination_kind',v_case.termination_kind,'notice_date',v_case.notice_date,
    'effective_date',v_case.effective_date,'last_service_date',v_case.last_service_date,
    'reason_category',v_case.reason_category,'legal_hold',v_case.legal_hold,
    'checks',(SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.check_key),'[]'::JSONB) FROM public.client_offboarding_checks c WHERE c.case_id=v_case.id),
    'actions',(SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.action_key),'[]'::JSONB) FROM public.client_offboarding_actions a WHERE a.case_id=v_case.id)
  );
  UPDATE public.client_offboarding_cases SET final_protocol=v_protocol,updated_at=NOW() WHERE id=v_case.id;
  UPDATE public.client_offboarding_actions SET status='completed',completed_at=NOW(),completed_by=p_actor_id,
    notes='Revisionssicherer Abschluss-Snapshot erzeugt',updated_at=NOW()
  WHERE case_id=v_case.id AND action_key='create_final_protocol';
  INSERT INTO public.client_offboarding_audit_events(case_id,tenant_id,client_id,action,detail,metadata,actor_id)
  VALUES(v_case.id,p_tenant_id,p_client_id,'protocol_generated','Revisionssicherer Abschluss-Snapshot erzeugt',v_protocol,p_actor_id);
  RETURN jsonb_build_object('case_id',v_case.id,'generated',TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_client_offboarding_action(
  p_tenant_id UUID,p_client_id UUID,p_action_key TEXT,p_status TEXT,
  p_notes TEXT DEFAULT NULL,p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_case_id UUID;
BEGIN
  PERFORM public.client_offboarding_assert_admin(p_tenant_id);
  IF p_action_key IN ('lock_portal_access','create_final_protocol','archive_client_record') THEN
    RAISE EXCEPTION 'Dieser Schritt darf nur über die verbindliche Systemaktion abgeschlossen werden.';
  END IF;
  IF p_status NOT IN ('pending','in_progress','completed','not_applicable','blocked') THEN
    RAISE EXCEPTION 'Ungültiger Maßnahmenstatus.';
  END IF;
  SELECT id INTO v_case_id FROM public.client_offboarding_cases
  WHERE tenant_id=p_tenant_id AND client_id=p_client_id AND status<>'completed'
  ORDER BY created_at DESC LIMIT 1;
  IF v_case_id IS NULL THEN RAISE EXCEPTION 'Offboarding wurde noch nicht gestartet.'; END IF;
  UPDATE public.client_offboarding_actions SET status=p_status,notes=NULLIF(BTRIM(p_notes),''),
    completed_at=CASE WHEN p_status IN ('completed','not_applicable') THEN NOW() ELSE NULL END,
    completed_by=CASE WHEN p_status IN ('completed','not_applicable') THEN p_actor_id ELSE NULL END,updated_at=NOW()
  WHERE case_id=v_case_id AND action_key=p_action_key;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unbekannter Offboarding-Schritt.'; END IF;
  UPDATE public.client_offboarding_cases SET final_protocol=NULL,updated_at=NOW() WHERE id=v_case_id;
  UPDATE public.client_offboarding_actions SET status='pending',completed_at=NULL,completed_by=NULL,
    notes='Durch geänderte Abschlussmaßnahme erneut zu erzeugen',updated_at=NOW()
  WHERE case_id=v_case_id AND action_key='create_final_protocol';
  INSERT INTO public.client_offboarding_audit_events(case_id,tenant_id,client_id,action,detail,metadata,actor_id)
  VALUES(v_case_id,p_tenant_id,p_client_id,'action_updated',p_action_key||' → '||p_status,
    jsonb_build_object('notes',p_notes),p_actor_id);
  RETURN jsonb_build_object('case_id',v_case_id,'action_key',p_action_key,'status',p_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.lock_client_offboarding_portal(
  p_tenant_id UUID,p_client_id UUID,p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_case_id UUID;
BEGIN
  PERFORM public.client_offboarding_assert_admin(p_tenant_id);
  SELECT id INTO v_case_id FROM public.client_offboarding_cases
  WHERE tenant_id=p_tenant_id AND client_id=p_client_id AND status<>'completed'
  ORDER BY created_at DESC LIMIT 1;
  IF v_case_id IS NULL THEN RAISE EXCEPTION 'Offboarding wurde noch nicht gestartet.'; END IF;

  UPDATE public.client_offboarding_cases SET final_protocol=NULL,updated_at=NOW() WHERE id=v_case_id;
  UPDATE public.client_offboarding_actions SET status='pending',completed_at=NULL,completed_by=NULL,
    notes='Nach Portalsperre erneut zu erzeugen',updated_at=NOW()
  WHERE case_id=v_case_id AND action_key='create_final_protocol';

  IF to_regclass('public.client_portal_access') IS NOT NULL THEN
    UPDATE public.client_portal_access SET portal_enabled=FALSE,updated_at=NOW()
    WHERE tenant_id=p_tenant_id AND client_id=p_client_id;
  END IF;
  IF to_regclass('public.portal_push_devices') IS NOT NULL THEN
    UPDATE public.portal_push_devices SET enabled=FALSE,invalidated_at=NOW(),
      last_error='Klient:innen-Offboarding',updated_at=NOW()
    WHERE tenant_id=p_tenant_id AND client_id=p_client_id AND enabled=TRUE;
  END IF;
  UPDATE public.client_offboarding_actions SET status='completed',completed_at=NOW(),
    completed_by=p_actor_id,notes='Portalzugänge und Push-Geräte gesperrt',updated_at=NOW()
  WHERE case_id=v_case_id AND action_key='lock_portal_access';
  INSERT INTO public.client_offboarding_audit_events(case_id,tenant_id,client_id,action,detail,actor_id)
  VALUES(v_case_id,p_tenant_id,p_client_id,'portal_locked','Portalzugänge und Push-Geräte gesperrt',p_actor_id);
  RETURN jsonb_build_object('case_id',v_case_id,'portal_locked',TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_client_offboarding(
  p_tenant_id UUID,p_client_id UUID,p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case public.client_offboarding_cases%ROWTYPE;
  v_failed INTEGER;
  v_message TEXT;
BEGIN
  PERFORM public.client_offboarding_assert_admin(p_tenant_id);
  PERFORM public.refresh_client_offboarding_checks(p_tenant_id,p_client_id,p_actor_id);
  SELECT * INTO v_case FROM public.client_offboarding_cases
  WHERE tenant_id=p_tenant_id AND client_id=p_client_id
  ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF v_case.effective_date>CURRENT_DATE THEN
    RAISE EXCEPTION 'Die Endfreigabe ist erst am Beendigungsdatum möglich.';
  END IF;
  IF v_case.portal_closure_mode='read_only_grace' AND v_case.portal_grace_until>NOW() THEN
    RAISE EXCEPTION 'Die Endfreigabe ist erst nach Ablauf der Portal-Nachfrist möglich.';
  END IF;
  SELECT COUNT(*),STRING_AGG(message,'; ' ORDER BY check_key)
  INTO v_failed,v_message FROM public.client_offboarding_checks
  WHERE case_id=v_case.id AND severity='required' AND status='failed';
  IF v_failed>0 THEN RAISE EXCEPTION 'Endfreigabe blockiert: %',v_message; END IF;

  PERFORM public.lock_client_offboarding_portal(p_tenant_id,p_client_id,p_actor_id);
  UPDATE public.client_offboarding_actions SET status='completed',completed_at=NOW(),completed_by=p_actor_id,
    notes='Operative Nutzung beendet; Akte erhalten',updated_at=NOW()
  WHERE case_id=v_case.id AND action_key='archive_client_record';
  UPDATE public.clients SET status='archived',updated_at=NOW() WHERE tenant_id=p_tenant_id AND id=p_client_id;
  UPDATE public.client_offboarding_cases SET status='completed',completed_at=NOW(),archived_at=NOW(),updated_at=NOW()
  WHERE id=v_case.id;
  INSERT INTO public.client_offboarding_audit_events(case_id,tenant_id,client_id,action,detail,metadata,actor_id)
  VALUES(v_case.id,p_tenant_id,p_client_id,'offboarding_completed',
    'Klient:innenakte archiviert; operative Nutzung und Zugänge beendet; Historie vollständig erhalten',
    jsonb_build_object('legal_hold',v_case.legal_hold,'effective_date',v_case.effective_date),p_actor_id);
  RETURN jsonb_build_object('case_id',v_case.id,'status','completed','archived',TRUE);
END;
$$;

-- Mitarbeitenden-Offboarding: Portal-Sperre deaktiviert zusätzlich alle Push-Geräte.
CREATE OR REPLACE FUNCTION public.employee_offboarding_production_gate(
  p_tenant_id UUID,p_employee_id UUID,p_exit_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_checks JSONB := '[]'::JSONB;
  v_count INTEGER := 0;
  v_passed BOOLEAN := TRUE;
BEGIN
  IF p_tenant_id IS DISTINCT FROM public.current_tenant_id() THEN
    RAISE EXCEPTION 'Mandant stimmt nicht mit der Sitzung überein.';
  END IF;
  IF NOT (public.is_tenant_admin() OR public.has_permission('office.employees.edit')) THEN
    RAISE EXCEPTION 'Keine Berechtigung für die Produktionsfreigabe.';
  END IF;

  IF to_regclass('public.assist_tracking_sessions') IS NULL THEN
    v_checks:=v_checks||jsonb_build_array(jsonb_build_object('key','live_gps','label','GPS-Aufzeichnung','count',0,'passed',FALSE,'message','GPS-Prüftabelle fehlt; sichere Freigabe nicht möglich.'));
    v_passed:=FALSE;
  ELSE
    EXECUTE $q$SELECT COUNT(*) FROM public.assist_tracking_sessions t
      WHERE to_jsonb(t)->>'tenant_id'=$1 AND to_jsonb(t)->>'employee_id'=$2
        AND (COALESCE(to_jsonb(t)->>'is_active','false')::BOOLEAN=TRUE
          OR (LOWER(COALESCE(to_jsonb(t)->>'status',''))='active' AND NULLIF(to_jsonb(t)->>'ended_at','') IS NULL))$q$
      INTO v_count USING p_tenant_id::TEXT,p_employee_id::TEXT;
    v_checks:=v_checks||jsonb_build_array(jsonb_build_object('key','live_gps','label','GPS-Aufzeichnung','count',v_count,'passed',v_count=0,
      'message',CASE WHEN v_count=0 THEN 'Keine aktive GPS-Aufzeichnung.' ELSE v_count||' aktive GPS-Aufzeichnung(en) müssen beendet werden.' END));
    v_passed:=v_passed AND v_count=0;
  END IF;

  IF to_regclass('public.employee_logbook_trips') IS NULL THEN
    v_checks:=v_checks||jsonb_build_array(jsonb_build_object('key','active_logbook_trip','label','Fahrtenbuch','count',0,'passed',FALSE,'message','Fahrtenbuch-Prüftabelle fehlt; sichere Freigabe nicht möglich.'));
    v_passed:=FALSE;
  ELSE
    EXECUTE $q$SELECT COUNT(*) FROM public.employee_logbook_trips t
      WHERE to_jsonb(t)->>'tenant_id'=$1 AND to_jsonb(t)->>'employee_id'=$2
        AND (LOWER(COALESCE(to_jsonb(t)->>'status',''))='recording'
          OR (NULLIF(to_jsonb(t)->>'ended_at','') IS NULL AND LOWER(COALESCE(to_jsonb(t)->>'status','')) NOT IN ('completed','corrected','cancelled','canceled')))$q$
      INTO v_count USING p_tenant_id::TEXT,p_employee_id::TEXT;
    v_checks:=v_checks||jsonb_build_array(jsonb_build_object('key','active_logbook_trip','label','Fahrtenbuch','count',v_count,'passed',v_count=0,
      'message',CASE WHEN v_count=0 THEN 'Keine laufende Fahrt.' ELSE v_count||' laufende Fahrt(en) müssen beendet werden.' END));
    v_passed:=v_passed AND v_count=0;
  END IF;

  IF to_regclass('public.workforce_work_sessions') IS NULL THEN
    v_checks:=v_checks||jsonb_build_array(jsonb_build_object('key','active_work_time','label','Arbeitszeit','count',0,'passed',FALSE,'message','Arbeitszeit-Prüftabelle fehlt; sichere Freigabe nicht möglich.'));
    v_passed:=FALSE;
  ELSE
    EXECUTE $q$SELECT COUNT(*) FROM public.workforce_work_sessions t
      WHERE to_jsonb(t)->>'tenant_id'=$1 AND to_jsonb(t)->>'employee_id'=$2
        AND NULLIF(COALESCE(to_jsonb(t)->>'ended_at',to_jsonb(t)->>'clocked_out_at',''),'') IS NULL
        AND LOWER(COALESCE(to_jsonb(t)->>'status','active')) NOT IN ('offline','ended','completed','closed','archived')$q$
      INTO v_count USING p_tenant_id::TEXT,p_employee_id::TEXT;
    v_checks:=v_checks||jsonb_build_array(jsonb_build_object('key','active_work_time','label','Arbeitszeit','count',v_count,'passed',v_count=0,
      'message',CASE WHEN v_count=0 THEN 'Keine offene Arbeitszeitsitzung.' ELSE v_count||' Arbeitszeitsitzung(en) sind noch offen.' END));
    v_passed:=v_passed AND v_count=0;
  END IF;

  IF to_regclass('public.assist_visits') IS NULL THEN
    v_checks:=v_checks||jsonb_build_array(jsonb_build_object('key','future_assignments','label','Einsätze','count',0,'passed',FALSE,'message','Einsatz-Prüftabelle fehlt; sichere Freigabe nicht möglich.'));
    v_passed:=FALSE;
  ELSE
    EXECUTE $q$SELECT COUNT(*) FROM public.assist_visits t
      WHERE to_jsonb(t)->>'tenant_id'=$1 AND to_jsonb(t)::TEXT LIKE '%'||$2||'%'
        AND LOWER(COALESCE(to_jsonb(t)->>'execution_status',to_jsonb(t)->>'status',''))
          NOT IN ('completed','finished','closed','ended','cancelled','canceled','rejected','archived')$q$
      INTO v_count USING p_tenant_id::TEXT,p_employee_id::TEXT;
    v_checks:=v_checks||jsonb_build_array(jsonb_build_object('key','future_assignments','label','Offene und zukünftige Einsätze','count',v_count,'passed',v_count=0,
      'message',CASE WHEN v_count=0 THEN 'Keine offenen Einsätze.' ELSE v_count||' Einsatz/Einsätze müssen beendet oder neu zugeordnet werden.' END));
    v_passed:=v_passed AND v_count=0;
  END IF;

  IF to_regclass('public.assist_visits') IS NULL THEN
    v_checks:=v_checks||jsonb_build_array(jsonb_build_object('key','open_documentation','label','Einsatzdokumentation','count',0,'passed',FALSE,'message','Dokumentations-Prüftabelle fehlt; sichere Freigabe nicht möglich.'));
    v_checks:=v_checks||jsonb_build_array(jsonb_build_object('key','open_signatures','label','Pflichtunterschriften','count',0,'passed',FALSE,'message','Unterschriften-Prüftabelle fehlt; sichere Freigabe nicht möglich.'));
    v_checks:=v_checks||jsonb_build_array(jsonb_build_object('key','open_corrections','label','Korrekturen','count',0,'passed',FALSE,'message','Korrektur-Prüftabelle fehlt; sichere Freigabe nicht möglich.'));
    v_passed:=FALSE;
  ELSE
    EXECUTE $q$SELECT COUNT(*) FROM public.assist_visits t
      WHERE to_jsonb(t)->>'tenant_id'=$1 AND to_jsonb(t)::TEXT LIKE '%'||$2||'%'
        AND LOWER(COALESCE(to_jsonb(t)->>'documentation_status',to_jsonb(t)->>'documentation_state','pending'))
          NOT IN ('completed','submitted','approved','not_required')
        AND LOWER(COALESCE(to_jsonb(t)->>'execution_status',to_jsonb(t)->>'status',''))
          IN ('finished','documentation_pending','signature_pending','completed')$q$
      INTO v_count USING p_tenant_id::TEXT,p_employee_id::TEXT;
    v_checks:=v_checks||jsonb_build_array(jsonb_build_object('key','open_documentation','label','Einsatzdokumentation','count',v_count,'passed',v_count=0,
      'message',CASE WHEN v_count=0 THEN 'Alle Dokumentationen abgeschlossen.' ELSE v_count||' Dokumentation(en) sind noch offen.' END));
    v_passed:=v_passed AND v_count=0;

    EXECUTE $q$SELECT COUNT(*) FROM public.assist_visits t
      WHERE to_jsonb(t)->>'tenant_id'=$1 AND to_jsonb(t)::TEXT LIKE '%'||$2||'%'
        AND (LOWER(COALESCE(to_jsonb(t)->>'execution_status',to_jsonb(t)->>'status',''))='signature_pending'
          OR LOWER(COALESCE(to_jsonb(t)->>'signature_status',to_jsonb(t)->>'client_signature_status','completed'))
            NOT IN ('completed','signed','deferred_to_client_portal','not_required'))$q$
      INTO v_count USING p_tenant_id::TEXT,p_employee_id::TEXT;
    v_checks:=v_checks||jsonb_build_array(jsonb_build_object('key','open_signatures','label','Pflichtunterschriften','count',v_count,'passed',v_count=0,
      'message',CASE WHEN v_count=0 THEN 'Alle Pflichtunterschriften abgeschlossen oder ins Klientenportal gegeben.' ELSE v_count||' Pflichtunterschrift(en) sind noch offen.' END));
    v_passed:=v_passed AND v_count=0;

    EXECUTE $q$SELECT COUNT(*) FROM public.assist_visits t
      WHERE to_jsonb(t)->>'tenant_id'=$1 AND to_jsonb(t)::TEXT LIKE '%'||$2||'%'
        AND (LOWER(COALESCE(to_jsonb(t)->>'execution_status',to_jsonb(t)->>'status','')) IN ('correction_required','correction_pending')
          OR LOWER(COALESCE(to_jsonb(t)->>'correction_status','resolved')) NOT IN ('resolved','completed','approved','not_required'))$q$
      INTO v_count USING p_tenant_id::TEXT,p_employee_id::TEXT;
    v_checks:=v_checks||jsonb_build_array(jsonb_build_object('key','open_corrections','label','Korrekturen','count',v_count,'passed',v_count=0,
      'message',CASE WHEN v_count=0 THEN 'Keine offenen Korrekturen.' ELSE v_count||' Korrektur(en) müssen abgeschlossen werden.' END));
    v_passed:=v_passed AND v_count=0;
  END IF;

  IF to_regclass('public.employee_expense_claims') IS NULL THEN
    v_checks:=v_checks||jsonb_build_array(jsonb_build_object('key','open_expenses','label','Auslagen und Erstattung','count',0,'passed',FALSE,'message','Auslagen-Prüftabelle fehlt; sichere Freigabe nicht möglich.'));
    v_passed:=FALSE;
  ELSE
    EXECUTE $q$SELECT COUNT(*) FROM public.employee_expense_claims t
      WHERE to_jsonb(t)->>'tenant_id'=$1 AND to_jsonb(t)::TEXT LIKE '%'||$2||'%'
        AND LOWER(COALESCE(to_jsonb(t)->>'status','open')) NOT IN ('paid','rejected','cancelled','canceled','closed','archived')$q$
      INTO v_count USING p_tenant_id::TEXT,p_employee_id::TEXT;
    v_checks:=v_checks||jsonb_build_array(jsonb_build_object('key','open_expenses','label','Auslagen und Erstattung','count',v_count,'passed',v_count=0,
      'message',CASE WHEN v_count=0 THEN 'Keine offene Auslage.' ELSE v_count||' Auslage(n) müssen geprüft und abgerechnet werden.' END));
    v_passed:=v_passed AND v_count=0;
  END IF;

  IF to_regclass('public.inventory_assignments') IS NULL THEN
    v_checks:=v_checks||jsonb_build_array(jsonb_build_object('key','open_inventory','label','Firmeneigentum','count',0,'passed',FALSE,'message','Inventar-Prüftabelle fehlt; sichere Freigabe nicht möglich.'));
    v_passed:=FALSE;
  ELSE
    EXECUTE $q$SELECT COUNT(*) FROM public.inventory_assignments t
      WHERE to_jsonb(t)->>'tenant_id'=$1
        AND (to_jsonb(t)->>'recipient_employee_id'=$2 OR to_jsonb(t)->>'responsible_employee_id'=$2)
        AND COALESCE(to_jsonb(t)->>'return_required','true')::BOOLEAN=TRUE
        AND LOWER(COALESCE(to_jsonb(t)->>'status','issued'))
          IN ('planned','issued','acknowledged','return_requested','partially_returned','overdue','disputed')$q$
      INTO v_count USING p_tenant_id::TEXT,p_employee_id::TEXT;
    v_checks:=v_checks||jsonb_build_array(jsonb_build_object('key','open_inventory','label','Firmeneigentum','count',v_count,'passed',v_count=0,
      'message',CASE WHEN v_count=0 THEN 'Alle rückgabepflichtigen Ausgaben erledigt.' ELSE v_count||' Inventarausgabe(n) müssen zurückgegeben oder geklärt werden.' END));
    v_passed:=v_passed AND v_count=0;
  END IF;

  IF to_regclass('public.portal_push_devices') IS NULL THEN
    v_checks:=v_checks||jsonb_build_array(jsonb_build_object('key','active_push_devices','label','Portalgeräte','count',0,'passed',FALSE,'message','Geräte-Prüftabelle fehlt; sichere Freigabe nicht möglich.'));
    v_passed:=FALSE;
  ELSE
    EXECUTE $q$SELECT COUNT(*) FROM public.portal_push_devices t
      WHERE to_jsonb(t)->>'tenant_id'=$1 AND to_jsonb(t)->>'employee_id'=$2
        AND COALESCE(to_jsonb(t)->>'enabled','true')::BOOLEAN=TRUE AND NULLIF(to_jsonb(t)->>'invalidated_at','') IS NULL$q$
      INTO v_count USING p_tenant_id::TEXT,p_employee_id::TEXT;
    v_checks:=v_checks||jsonb_build_array(jsonb_build_object('key','active_push_devices','label','Portalgeräte','count',v_count,'passed',v_count=0,
      'message',CASE WHEN v_count=0 THEN 'Alle Push-Geräte sind deaktiviert.' ELSE v_count||' Portalgerät(e) müssen gesperrt werden.' END));
    v_passed:=v_passed AND v_count=0;
  END IF;

  RETURN jsonb_build_object('checks',v_checks,'passed',v_passed,'checked_at',NOW(),'exit_date',p_exit_date);
END;
$$;

CREATE OR REPLACE FUNCTION public.employee_offboarding_invalidate_push_devices(
  p_tenant_id UUID,p_employee_id UUID,p_actor_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count INTEGER := 0;
BEGIN
  IF p_tenant_id IS DISTINCT FROM public.current_tenant_id() THEN
    RAISE EXCEPTION 'Mandant stimmt nicht mit der Sitzung überein.';
  END IF;
  IF NOT (public.is_tenant_admin() OR public.has_permission('office.employees.edit')) THEN
    RAISE EXCEPTION 'Keine Berechtigung für Mitarbeitenden-Offboarding.';
  END IF;
  UPDATE public.portal_push_devices SET enabled=FALSE,invalidated_at=NOW(),
    last_error='Mitarbeitenden-Offboarding',updated_at=NOW()
  WHERE tenant_id=p_tenant_id AND employee_id=p_employee_id AND enabled=TRUE;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.client_offboarding_assert_admin(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.client_offboarding_seed_actions(UUID,UUID,UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.client_offboarding_upsert_check(UUID,UUID,UUID,TEXT,TEXT,TEXT,TEXT,INTEGER,JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.start_client_offboarding(UUID,UUID,TEXT,DATE,DATE,DATE,TEXT,TEXT,TEXT,TEXT,TIMESTAMPTZ,BOOLEAN,UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_client_offboarding_checks(UUID,UUID,UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_client_offboarding_action(UUID,UUID,TEXT,TEXT,TEXT,UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generate_client_offboarding_protocol(UUID,UUID,UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lock_client_offboarding_portal(UUID,UUID,UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_client_offboarding(UUID,UUID,UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.employee_offboarding_invalidate_push_devices(UUID,UUID,UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.employee_offboarding_production_gate(UUID,UUID,DATE) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.start_client_offboarding(UUID,UUID,TEXT,DATE,DATE,DATE,TEXT,TEXT,TEXT,TEXT,TIMESTAMPTZ,BOOLEAN,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_client_offboarding_checks(UUID,UUID,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_client_offboarding_action(UUID,UUID,TEXT,TEXT,TEXT,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_client_offboarding_protocol(UUID,UUID,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lock_client_offboarding_portal(UUID,UUID,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_client_offboarding(UUID,UUID,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.employee_offboarding_invalidate_push_devices(UUID,UUID,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.employee_offboarding_production_gate(UUID,UUID,DATE) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
