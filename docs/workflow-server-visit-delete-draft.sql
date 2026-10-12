-- REVIEW DRAFT ONLY. Not a migration; never applied to any remote database.
-- Captured RPC: workflow-server-write-rpc-metadata-20261011.json.
-- Actual columns/FKs: workflow-server-visit-delete-schema-metadata-20261011.json,
-- workflow-server-object-metadata-20261011.json and Core/permission metadata.
-- Review/apply with the identity, core RLS and execution lifecycle drafts.
-- App action contract: assist.assignments.manage (not an invented .delete key).
-- Hard deletion is limited to unstarted planning. Completed/cancelled history
-- requires its separate audited workflow; performed budget is never reset here.
BEGIN;

CREATE OR REPLACE FUNCTION public.delete_assist_visit(p_tenant_id uuid, p_visit_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v public.assist_visits%ROWTYPE;
  a public.assignments%ROWTYPE;
  account public.client_budget_accounts%ROWTYPE;
  reservation public.client_budget_transactions%ROWTYPE;
  actor_profile uuid;
  assignment_ids uuid[];
  balance_after bigint;
  released integer := 0;
  changed integer;
BEGIN
  IF auth.uid() IS NULL OR p_tenant_id IS NULL OR p_visit_id IS NULL
    OR p_tenant_id IS DISTINCT FROM public.current_tenant_id()
    OR COALESCE(public.current_portal_type(), 'business') <> 'business' THEN
    RAISE EXCEPTION 'Anmeldung im aktuellen Geschäftsmandanten erforderlich.' USING ERRCODE='42501';
  END IF;

  -- Resolve identity, active account and action on the SAME tenant-bound role.
  -- Legacy has_permission/is_tenant_member can accept a foreign profile or a
  -- portal membership; they are not an authorization shortcut for this definer.
  SELECT p.id INTO actor_profile FROM public.profiles p JOIN public.roles r ON r.id=p.role_id
  WHERE p.tenant_id=p_tenant_id AND p.status::text='active' AND p.is_active IS TRUE
    AND (p.auth_user_id=auth.uid() OR (p.auth_user_id IS NULL AND p.id=auth.uid()))
    AND (r.tenant_id=p_tenant_id OR r.tenant_id IS NULL)
    AND r.key NOT IN ('employee_portal','client_portal','family_portal')
    AND NOT EXISTS (SELECT 1 FROM public.tenant_users u
      WHERE u.tenant_id=p_tenant_id AND u.auth_user_id=auth.uid()
        AND (u.status IS DISTINCT FROM 'active' OR u.must_change_password IS DISTINCT FROM FALSE
          OR u.first_login_completed IS DISTINCT FROM TRUE))
    AND (r.is_admin_role IS TRUE OR r.key IN ('owner','admin','management','geschaeftsfuehrung','business_admin')
      OR EXISTS (SELECT 1 FROM public.role_permissions rp WHERE rp.role_id=r.id
        AND rp.tenant_id IS NOT DISTINCT FROM r.tenant_id
        AND (rp.permission_key='assist.assignments.manage'
          OR (rp.permission_key='assignments' AND rp.can_update IS TRUE))))
  ORDER BY p.id LIMIT 1 FOR SHARE OF p,r;
  IF actor_profile IS NULL THEN
    RAISE EXCEPTION 'Aktives Geschäftsprofil mit Einsatzplanungsberechtigung erforderlich.' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v FROM public.assist_visits WHERE tenant_id=p_tenant_id AND id=p_visit_id FOR UPDATE;
  IF NOT FOUND THEN
    IF EXISTS (SELECT 1 FROM public.assist_visits WHERE id=p_visit_id) THEN
      RAISE EXCEPTION 'Einsatz gehört nicht zum aktuellen Mandanten.' USING ERRCODE='42501';
    END IF;
    -- A lost successful RPC response can be retried without releasing twice.
    RETURN jsonb_build_object('deleted',TRUE,'visitId',p_visit_id,'legacyAssignmentId',NULL,
      'budgetReservationsReleased',0,'alreadyDeleted',TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.id=v.client_id AND c.tenant_id=p_tenant_id)
    OR (v.employee_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.employees e
      WHERE e.id=v.employee_id AND e.tenant_id=p_tenant_id)) THEN
    RAISE EXCEPTION 'Einsatzzuordnung ist mandantenfremd oder fehlt.' USING ERRCODE='42501';
  END IF;
  IF v.planning_status NOT IN ('draft','scheduled','confirmed') OR v.planning_status IS NULL
    OR v.execution_status IS DISTINCT FROM 'pending'
    OR v.documentation_status IS DISTINCT FROM 'none' OR v.proof_status IS DISTINCT FROM 'none'
    OR v.billing_status NOT IN ('none','reserved') OR v.billing_status IS NULL
    OR v.canonical_status NOT IN ('planned','assigned','confirmed') OR v.canonical_status IS NULL
    OR v.actual_start_at IS NOT NULL OR v.actual_end_at IS NOT NULL OR v.on_the_way_at IS NOT NULL
    OR v.arrived_at IS NOT NULL OR v.finished_at IS NOT NULL THEN
    RAISE EXCEPTION 'Begonnene, belegte oder abgeschlossene Einsätze dürfen nicht gelöscht werden.' USING ERRCODE='55000';
  END IF;
  assignment_ids := ARRAY[v.id];
  IF v.legacy_assignment_id IS NOT NULL THEN
    SELECT * INTO a FROM public.assignments WHERE id=v.legacy_assignment_id FOR UPDATE;
    IF NOT FOUND OR a.tenant_id IS DISTINCT FROM p_tenant_id OR a.client_id IS DISTINCT FROM v.client_id
      OR a.employee_id IS DISTINCT FROM v.employee_id THEN
      RAISE EXCEPTION 'Legacy-Einsatzbindung ist nicht eindeutig und mandantenrichtig.' USING ERRCODE='42501';
    END IF;
    IF a.status::text NOT IN ('planned','confirmed') OR a.status IS NULL
      OR a.actual_start_at IS NOT NULL OR a.actual_end_at IS NOT NULL OR a.on_the_way_at IS NOT NULL
      OR a.arrived_at IS NOT NULL OR a.finished_at IS NOT NULL
      OR NULLIF(trim(a.documentation_notes),'') IS NOT NULL THEN
      RAISE EXCEPTION 'Legacy-Einsatz hat bereits Durchführung oder Dokumentation.' USING ERRCODE='55000';
    END IF;
    assignment_ids := ARRAY[v.id,a.id];
    IF EXISTS (SELECT 1 FROM public.assist_visits other WHERE other.id<>v.id AND other.legacy_assignment_id=a.id)
      OR EXISTS (SELECT 1 FROM public.assignments other WHERE other.parent_assignment_id=a.id) THEN
      RAISE EXCEPTION 'Der Einsatz hat weitere gebundene Termine.' USING ERRCODE='55000';
    END IF;
  END IF;
  -- Empty planning snapshots/tasks may exist before work starts. Lock them so
  -- their completion flags cannot change between the guard and FK cascade.
  PERFORM 1 FROM public.assist_visit_execution_state s WHERE s.visit_id=v.id ORDER BY s.id FOR UPDATE;
  PERFORM 1 FROM public.assist_visit_tasks t WHERE t.visit_id=v.id ORDER BY t.id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.assist_visits other WHERE other.id<>v.id
      AND other.recurrence_json->>'parentSeriesId'=v.id::text)
    OR EXISTS (SELECT 1 FROM public.assist_time_events e WHERE e.visit_id=v.id)
    OR EXISTS (SELECT 1 FROM public.assist_visit_execution_state s WHERE s.visit_id=v.id
      AND (s.tenant_id IS DISTINCT FROM p_tenant_id OR s.current_step IS DISTINCT FROM 'consent'
        OR COALESCE(s.assignment_status,'geplant') NOT IN ('geplant','bestaetigt')
        OR s.travel_started_at IS NOT NULL OR s.travel_ended_at IS NOT NULL
        OR s.service_started_at IS NOT NULL OR s.service_ended_at IS NOT NULL OR s.finalized_at IS NOT NULL
        OR s.tasks_complete IS DISTINCT FROM FALSE OR s.documentation_complete IS DISTINCT FROM FALSE
        OR s.signature_complete IS DISTINCT FROM FALSE OR s.proof_generated IS DISTINCT FROM FALSE
        OR NULLIF(trim(s.no_show_note),'') IS NOT NULL OR s.metadata IS DISTINCT FROM '{}'::jsonb))
    OR EXISTS (SELECT 1 FROM public.assist_visit_tasks t WHERE t.visit_id=v.id
      AND (t.tenant_id IS DISTINCT FROM p_tenant_id OR t.status IS DISTINCT FROM 'open'
        OR NULLIF(trim(t.not_done_reason),'') IS NOT NULL))
    OR EXISTS (SELECT 1 FROM public.assist_visit_documentation d WHERE d.visit_id=v.id)
    OR EXISTS (SELECT 1 FROM public.assist_visit_signatures s WHERE s.visit_id=v.id)
    OR EXISTS (SELECT 1 FROM public.assist_visit_proofs p WHERE p.visit_id=v.id)
    OR EXISTS (SELECT 1 FROM public.documentation_entries d WHERE d.assignment_id=ANY(assignment_ids))
    OR EXISTS (SELECT 1 FROM public.signatures s WHERE s.assignment_id=ANY(assignment_ids))
    OR EXISTS (SELECT 1 FROM public.time_entries e WHERE e.assignment_id=ANY(assignment_ids))
    OR EXISTS (SELECT 1 FROM public.service_records r WHERE r.assist_visit_id=v.id OR r.assignment_id=ANY(assignment_ids)) THEN
    RAISE EXCEPTION 'Zeiten, Dokumentation, Unterschriften oder Nachweise müssen erhalten bleiben.' USING ERRCODE='55000';
  END IF;

  -- Lock the complete financial source before deciding; performed/finalized
  -- reservations and invoiced transactions are never undoable planning here.
  PERFORM 1 FROM public.client_budget_transactions tx
    WHERE tx.reference_type='assist_visit' AND tx.reference_id=v.id
    ORDER BY tx.budget_account_id,tx.id FOR UPDATE;
  PERFORM 1 FROM public.assignment_budget_allocations ba WHERE ba.assignment_id=ANY(assignment_ids)
    ORDER BY ba.id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.client_budget_transactions tx
      WHERE tx.reference_type='assist_visit' AND tx.reference_id=v.id
        AND (tx.tenant_id IS DISTINCT FROM p_tenant_id OR tx.client_id IS DISTINCT FROM v.client_id
          OR tx.invoice_id IS NOT NULL OR tx.transaction_type IS NULL OR tx.transaction_type NOT IN ('reservation','release')
          OR COALESCE(tx.lifecycle_status,'geplant') NOT IN ('geplant','storniert')))
    OR EXISTS (SELECT 1 FROM public.assignment_budget_allocations ba WHERE ba.assignment_id=ANY(assignment_ids)
      AND (ba.tenant_id IS DISTINCT FROM p_tenant_id OR ba.client_id IS DISTINCT FROM v.client_id
        OR ba.allocation_status NOT IN ('planned','reserved','released','storniert')
        OR ba.allocation_status IS NULL OR COALESCE(ba.final_amount_cents,0)<>0)) THEN
    RAISE EXCEPTION 'Verbrauchte, abgerechnete oder fremde Budgetbuchungen dürfen nicht zurückgesetzt werden.' USING ERRCODE='55000';
  END IF;
  IF EXISTS (SELECT 1 FROM public.assignment_budget_allocations ba
      WHERE ba.assignment_id=ANY(assignment_ids) AND ba.allocation_status IN ('planned','reserved')
        AND ba.reserved_amount_cents>0
        AND NOT EXISTS (SELECT 1 FROM public.client_budget_accounts b
          WHERE b.id=ba.budget_account_id AND b.tenant_id=p_tenant_id AND b.client_id=v.client_id))
    OR EXISTS (SELECT 1 FROM public.assignment_budget_allocations ba
      WHERE ba.assignment_id=ANY(assignment_ids) AND ba.allocation_status IN ('planned','reserved')
      GROUP BY ba.budget_account_id HAVING SUM(ba.reserved_amount_cents) > COALESCE((
        SELECT SUM(tx.amount_cents) FROM public.client_budget_transactions tx
        WHERE tx.tenant_id=p_tenant_id AND tx.client_id=v.client_id AND tx.budget_account_id=ba.budget_account_id
          AND tx.reference_type='assist_visit' AND tx.reference_id=v.id
          AND tx.transaction_type='reservation' AND COALESCE(tx.lifecycle_status,'geplant')='geplant'),0))
    OR EXISTS (SELECT 1 FROM public.client_budget_transactions tx
      WHERE tx.reference_type='assignment' AND tx.reference_id=ANY(assignment_ids)) THEN
    RAISE EXCEPTION 'Budgetprojektion oder Legacy-Budgetbindung ist nicht konsistent.' USING ERRCODE='55000';
  END IF;

  FOR reservation IN SELECT tx.* FROM public.client_budget_transactions tx
    WHERE tx.tenant_id=p_tenant_id AND tx.reference_type='assist_visit' AND tx.reference_id=v.id
      AND tx.transaction_type='reservation' AND COALESCE(tx.lifecycle_status,'geplant')='geplant'
    ORDER BY tx.budget_account_id,tx.id FOR UPDATE LOOP
    SELECT * INTO account FROM public.client_budget_accounts b
      WHERE b.id=reservation.budget_account_id AND b.tenant_id=p_tenant_id AND b.client_id=v.client_id FOR UPDATE;
    IF NOT FOUND OR reservation.amount_cents IS NULL OR reservation.amount_cents<0
      OR account.reserved_cents IS NULL OR account.reserved_cents<reservation.amount_cents
      OR account.allocated_cents IS NULL OR account.used_cents IS NULL
      OR account.allocated_cents<0 OR account.used_cents<0 THEN
      RAISE EXCEPTION 'Budgetkonto oder reservierter Betrag ist nicht konsistent.' USING ERRCODE='55000';
    END IF;
    UPDATE public.client_budget_accounts SET reserved_cents=reserved_cents-reservation.amount_cents,updated_at=clock_timestamp()
      WHERE id=account.id AND tenant_id=p_tenant_id AND client_id=v.client_id
      RETURNING allocated_cents-used_cents-reserved_cents INTO balance_after;
    UPDATE public.client_budget_transactions SET lifecycle_status='storniert',
      note=concat_ws(' · ',NULLIF(note,''),'Einsatz aus Einsatzplanung gelöscht')
      WHERE id=reservation.id AND tenant_id=p_tenant_id AND reference_id=v.id;
    INSERT INTO public.client_budget_transactions(tenant_id,client_id,budget_account_id,transaction_type,amount_cents,
      balance_after_cents,reference_type,reference_id,lifecycle_status,note,created_by)
      VALUES(p_tenant_id,v.client_id,account.id,'release',reservation.amount_cents,balance_after,'assist_visit',v.id,
        'storniert','Planbetrag durch Löschen des Einsatzes freigegeben',actor_profile);
    released := released+1;
  END LOOP;
  UPDATE public.assignment_budget_allocations SET allocation_status='released',reserved_amount_cents=0,updated_at=clock_timestamp()
    WHERE tenant_id=p_tenant_id AND client_id=v.client_id AND assignment_id=ANY(assignment_ids)
      AND allocation_status IN ('planned','reserved');
  DELETE FROM public.assist_visits WHERE id=v.id AND tenant_id=p_tenant_id;
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed<>1 THEN RAISE EXCEPTION 'Einsatzlöschung nicht bestätigt.' USING ERRCODE='55000'; END IF;
  IF v.legacy_assignment_id IS NOT NULL THEN
    DELETE FROM public.assignments WHERE id=a.id AND tenant_id=p_tenant_id;
    GET DIAGNOSTICS changed=ROW_COUNT;
    IF changed<>1 THEN RAISE EXCEPTION 'Legacy-Löschung nicht bestätigt.' USING ERRCODE='55000'; END IF;
  END IF;
  RETURN jsonb_build_object('deleted',TRUE,'visitId',v.id,'legacyAssignmentId',v.legacy_assignment_id,
    'budgetReservationsReleased',released,'alreadyDeleted',FALSE);
END $$;
REVOKE ALL ON FUNCTION public.delete_assist_visit(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.delete_assist_visit(uuid,uuid) TO authenticated;
COMMIT;
