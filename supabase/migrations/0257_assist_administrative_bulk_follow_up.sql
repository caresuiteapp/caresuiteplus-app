-- Assist administrative Nachbearbeitung: praxistaugliche Sammelbearbeitung.
-- Mehrere Aufgaben werden in einer Transaktion validiert, gespeichert und auditiert.

INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.permission_key
FROM public.roles r
CROSS JOIN (
  VALUES
    ('assist.execution.manage'::text),
    ('time.tracking.admin.correct'::text)
) AS p(permission_key)
WHERE r.key IN (
  'owner', 'admin', 'management', 'geschaeftsfuehrung',
  'business_admin', 'business_manager'
)
ON CONFLICT (role_id, permission_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.admin_bulk_update_assist_visit_tasks(
  p_visit_id UUID,
  p_updates JSONB,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_item JSONB;
  v_task_id UUID;
  v_status TEXT;
  v_old_status TEXT;
  v_updated INTEGER := 0;
BEGIN
  IF NOT (
    public.is_tenant_admin()
    OR public.has_permission('assist.execution.manage')
  ) THEN
    RAISE EXCEPTION 'Keine Berechtigung für administrative Nachbearbeitung';
  END IF;

  IF length(trim(coalesce(p_reason, ''))) = 0 THEN
    RAISE EXCEPTION 'Begründung ist erforderlich';
  END IF;

  IF p_updates IS NULL
     OR jsonb_typeof(p_updates) <> 'array'
     OR jsonb_array_length(p_updates) = 0 THEN
    RAISE EXCEPTION 'Keine Aufgabenänderungen übergeben';
  END IF;

  SELECT tenant_id
  INTO v_tenant_id
  FROM public.assist_visits
  WHERE id = p_visit_id
    AND tenant_id = public.current_tenant_id()
  FOR UPDATE;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Einsatz nicht gefunden';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_updates)
  LOOP
    BEGIN
      v_task_id := NULLIF(v_item->>'task_id', '')::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Ungültige Aufgaben-ID';
    END;
    v_status := v_item->>'status';

    IF v_task_id IS NULL OR v_status NOT IN (
      'open', 'done', 'partial', 'not_requested',
      'not_possible', 'cancelled', 'deferred'
    ) THEN
      RAISE EXCEPTION 'Ungültiger Aufgabenstatus';
    END IF;

    SELECT status
    INTO v_old_status
    FROM public.assist_visit_tasks
    WHERE id = v_task_id
      AND visit_id = p_visit_id
      AND tenant_id = v_tenant_id
    FOR UPDATE;

    IF v_old_status IS NULL THEN
      RAISE EXCEPTION 'Aufgabe nicht gefunden';
    END IF;

    IF v_old_status IS DISTINCT FROM v_status THEN
      UPDATE public.assist_visit_tasks
      SET
        status = v_status,
        not_done_reason = CASE WHEN v_status = 'done' THEN NULL ELSE p_reason END,
        completed_at = CASE WHEN v_status = 'done' THEN NOW() ELSE NULL END,
        updated_at = NOW()
      WHERE id = v_task_id
        AND visit_id = p_visit_id
        AND tenant_id = v_tenant_id;

      INSERT INTO public.assist_visit_admin_audit (
        tenant_id, visit_id, action, previous_value, new_value, reason
      ) VALUES (
        v_tenant_id,
        p_visit_id,
        'task_updated',
        jsonb_build_object('task_id', v_task_id, 'status', v_old_status),
        jsonb_build_object('task_id', v_task_id, 'status', v_status),
        trim(p_reason)
      );

      v_updated := v_updated + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', TRUE, 'updated', v_updated);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_bulk_update_assist_visit_tasks(UUID, JSONB, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_bulk_update_assist_visit_tasks(UUID, JSONB, TEXT)
  TO authenticated;

COMMENT ON FUNCTION public.admin_bulk_update_assist_visit_tasks(UUID, JSONB, TEXT) IS
  'Atomare, tenant-sichere Sammelkorrektur von Einsatzaufgaben mit Einzelaudit.';
