-- ==========================================================================
-- CareSuite+ — Migration 0224: Employee Group Chats (Gruppen-Chats Mitarbeitende)
-- Office can create group conversations with multiple employees.
-- Reuses message_threads + messages; adds employee_group type + participants.
-- Apply before live group chat usage. Office UI works without migration in preview.
-- Enum value added in 0223 (same-transaction safety).
-- ==========================================================================

-- Allow employee_group threads without single employee_id
ALTER TABLE public.message_threads
  DROP CONSTRAINT IF EXISTS message_threads_no_cross_participants;

ALTER TABLE public.message_threads
  ADD CONSTRAINT message_threads_no_cross_participants CHECK (
    (thread_type = 'client' AND client_id IS NOT NULL AND employee_id IS NULL)
    OR (thread_type = 'employee' AND employee_id IS NOT NULL AND client_id IS NULL)
    OR (thread_type = 'employee_group' AND client_id IS NULL AND employee_id IS NULL)
    OR (thread_type = 'internal' AND client_id IS NULL AND employee_id IS NULL)
    OR (thread_type IN ('support', 'system'))
  );

-- --------------------------------------------------------------------------
-- message_thread_employee_participants — group chat members (Mitarbeitende)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.message_thread_employee_participants (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  thread_id   UUID        NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
  employee_id UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at     TIMESTAMPTZ,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (thread_id, employee_id)
);

DROP TRIGGER IF EXISTS set_message_thread_employee_participants_updated_at
  ON public.message_thread_employee_participants;
CREATE TRIGGER set_message_thread_employee_participants_updated_at
  BEFORE UPDATE ON public.message_thread_employee_participants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_message_thread_employee_participants_thread
  ON public.message_thread_employee_participants (thread_id, is_active);

CREATE INDEX IF NOT EXISTS idx_message_thread_employee_participants_employee
  ON public.message_thread_employee_participants (tenant_id, employee_id, is_active);

-- --------------------------------------------------------------------------
-- RLS
-- --------------------------------------------------------------------------
ALTER TABLE public.message_thread_employee_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS message_thread_employee_participants_tenant
  ON public.message_thread_employee_participants;
CREATE POLICY message_thread_employee_participants_tenant
  ON public.message_thread_employee_participants
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- Office: include employee_group in thread policies
DROP POLICY IF EXISTS message_threads_office_select ON public.message_threads;
CREATE POLICY message_threads_office_select ON public.message_threads
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND thread_type IN ('client', 'employee', 'employee_group', 'internal')
  );

DROP POLICY IF EXISTS message_threads_office_write ON public.message_threads;
CREATE POLICY message_threads_office_write ON public.message_threads
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND thread_type IN ('client', 'employee', 'employee_group', 'internal')
  );

-- Portal employee: 1:1 employee threads OR group membership
DROP POLICY IF EXISTS message_threads_portal_employee_select ON public.message_threads;
CREATE POLICY message_threads_portal_employee_select ON public.message_threads
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      (
        thread_type = 'employee'
        AND employee_id IS NOT NULL
        AND employee_id = public.resolve_current_employee_id()
      )
      OR (
        thread_type = 'employee_group'
        AND EXISTS (
          SELECT 1
          FROM public.message_thread_employee_participants p
          WHERE p.thread_id = message_threads.id
            AND p.tenant_id = message_threads.tenant_id
            AND p.is_active = TRUE
            AND p.employee_id = public.resolve_current_employee_id()
        )
      )
    )
  );

-- Portal messages: include employee_group threads
DROP POLICY IF EXISTS messages_portal_select ON public.messages;
CREATE POLICY messages_portal_select ON public.messages
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND is_internal_note = FALSE
    AND is_system_message = FALSE
    AND EXISTS (
      SELECT 1
      FROM public.message_threads mt
      WHERE mt.id = messages.thread_id
        AND mt.tenant_id = messages.tenant_id
        AND (
          (mt.thread_type = 'client' AND mt.client_id = public.current_client_id())
          OR (mt.thread_type = 'employee' AND mt.employee_id = public.resolve_current_employee_id())
          OR (
            mt.thread_type = 'employee_group'
            AND EXISTS (
              SELECT 1
              FROM public.message_thread_employee_participants p
              WHERE p.thread_id = mt.id
                AND p.tenant_id = mt.tenant_id
                AND p.is_active = TRUE
                AND p.employee_id = public.resolve_current_employee_id()
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS messages_portal_insert ON public.messages;
CREATE POLICY messages_portal_insert ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND is_internal_note = FALSE
    AND (
      (
        sender_client_id IS NOT NULL
        AND sender_client_id = public.current_client_id()
      )
      OR (
        sender_employee_id IS NOT NULL
        AND sender_employee_id = public.resolve_current_employee_id()
        AND EXISTS (
          SELECT 1
          FROM public.message_threads mt
          WHERE mt.id = messages.thread_id
            AND mt.tenant_id = messages.tenant_id
            AND (
              (mt.thread_type = 'employee' AND mt.employee_id = sender_employee_id)
              OR (
                mt.thread_type = 'employee_group'
                AND EXISTS (
                  SELECT 1
                  FROM public.message_thread_employee_participants p
                  WHERE p.thread_id = mt.id
                    AND p.tenant_id = mt.tenant_id
                    AND p.is_active = TRUE
                    AND p.employee_id = sender_employee_id
                )
              )
            )
        )
      )
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.message_thread_employee_participants TO authenticated;

COMMENT ON TABLE public.message_thread_employee_participants IS
  'Teilnehmer Gruppen-Chats mit Mitarbeitenden (Office ↔ mehrere Mitarbeitende)';

-- P0.1 — WFM assist mirror via SECURITY DEFINER RPC (portal finalize + audit grants).
DO $$
BEGIN
  IF to_regclass('public.workforce_work_sessions') IS NOT NULL THEN
    GRANT SELECT ON public.workforce_work_sessions TO service_role;
  END IF;
END $$;

DROP POLICY IF EXISTS wfm_sessions_update ON public.workforce_work_sessions;
CREATE POLICY wfm_sessions_update ON public.workforce_work_sessions
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      employee_id = public.resolve_current_employee_id()
      OR public.has_permission('time.tracking.admin.correct')
      OR public.is_tenant_admin()
    )
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (
      employee_id = public.resolve_current_employee_id()
      OR public.has_permission('time.tracking.admin.correct')
      OR public.is_tenant_admin()
      OR public.is_employee_portal_rls_context(tenant_id)
    )
  );

CREATE OR REPLACE FUNCTION public.sync_assist_visit_times_to_wfm(
  p_tenant_id UUID,
  p_visit_id  UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_id UUID;
  v_auth_user_id UUID;
  v_work_date DATE;
  v_session_id UUID;
  v_inserted INTEGER := 0;
  r RECORD;
  v_wfm_type TEXT;
  v_session_status TEXT;
  v_display_status TEXT;
BEGIN
  IF p_tenant_id IS NULL OR p_visit_id IS NULL THEN
    RAISE EXCEPTION 'sync_assist_visit_times_to_wfm: missing required parameters';
  END IF;

  IF p_tenant_id IS DISTINCT FROM public.current_tenant_id() THEN
    RAISE EXCEPTION 'sync_assist_visit_times_to_wfm: tenant mismatch';
  END IF;

  IF public.is_employee_portal_rls_context(p_tenant_id) THEN
    v_employee_id := public.resolve_current_employee_id();
    IF v_employee_id IS NULL THEN
      RAISE EXCEPTION 'sync_assist_visit_times_to_wfm: portal context without employee link';
    END IF;
  ELSIF NOT (
    public.has_permission('time.tracking.admin.correct')
    OR public.has_permission('time.tracking.own.start')
    OR public.is_tenant_admin()
  ) THEN
    RAISE EXCEPTION 'sync_assist_visit_times_to_wfm: insufficient permissions';
  END IF;

  IF v_employee_id IS NULL THEN
    SELECT COALESCE(av.employee_id, a.employee_id)
    INTO v_employee_id
    FROM public.assist_visits av
    FULL OUTER JOIN public.assignments a
      ON a.id = p_visit_id AND a.tenant_id = p_tenant_id
    WHERE (av.id = p_visit_id AND av.tenant_id = p_tenant_id)
       OR (a.id = p_visit_id AND a.tenant_id = p_tenant_id)
    LIMIT 1;
  END IF;

  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'sync_assist_visit_times_to_wfm: employee not resolved for visit';
  END IF;

  SELECT epa.auth_user_id INTO v_auth_user_id
  FROM public.employee_portal_accounts epa
  WHERE epa.tenant_id = p_tenant_id
    AND epa.employee_id = v_employee_id
  LIMIT 1;

  IF v_auth_user_id IS NULL THEN
    SELECT e.profile_id INTO v_auth_user_id
    FROM public.employees e
    WHERE e.tenant_id = p_tenant_id AND e.id = v_employee_id
    LIMIT 1;
  END IF;

  FOR r IN
    SELECT event_type, occurred_at
    FROM public.assist_time_events
    WHERE tenant_id = p_tenant_id
      AND visit_id = p_visit_id
    ORDER BY occurred_at ASC
  LOOP
    v_wfm_type := CASE r.event_type
      WHEN 'drive_start'   THEN 'visit_drive_start'
      WHEN 'drive_end'     THEN 'travel_end'
      WHEN 'arrive'        THEN 'visit_arrived'
      WHEN 'service_start' THEN 'visit_started'
      WHEN 'service_end'   THEN 'visit_ended'
      WHEN 'pause_start'   THEN 'pause_start'
      WHEN 'pause_end'     THEN 'pause_end'
      WHEN 'depart'        THEN 'visit_ended'
      ELSE NULL
    END;

    IF v_wfm_type IS NULL THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.workforce_time_events e
      WHERE e.tenant_id = p_tenant_id
        AND e.employee_id = v_employee_id
        AND e.event_type = v_wfm_type
        AND e.reference_type = 'visit'
        AND e.reference_id = p_visit_id
    ) THEN
      CONTINUE;
    END IF;

    v_work_date := (r.occurred_at AT TIME ZONE 'Europe/Berlin')::date;

    SELECT ws.id INTO v_session_id
    FROM public.workforce_work_sessions ws
    WHERE ws.tenant_id = p_tenant_id
      AND ws.employee_id = v_employee_id
      AND ws.work_date = v_work_date
    LIMIT 1;

    v_session_status := CASE r.event_type
      WHEN 'drive_start'   THEN 'driving'
      WHEN 'arrive'        THEN 'on_visit'
      WHEN 'service_start' THEN 'on_visit'
      WHEN 'pause_start'   THEN 'paused'
      WHEN 'pause_end'     THEN 'on_visit'
      WHEN 'service_end'   THEN 'clocked_in'
      WHEN 'depart'        THEN 'clocked_in'
      WHEN 'drive_end'     THEN 'clocked_in'
      ELSE 'on_visit'
    END;

    v_display_status := CASE r.event_type
      WHEN 'drive_start'   THEN 'unterwegs'
      WHEN 'arrive'        THEN 'im_einsatz'
      WHEN 'service_start' THEN 'im_einsatz'
      WHEN 'pause_start'   THEN 'pause'
      WHEN 'pause_end'     THEN 'im_einsatz'
      WHEN 'service_end'   THEN 'buero'
      WHEN 'depart'        THEN 'buero'
      WHEN 'drive_end'     THEN 'buero'
      ELSE 'im_einsatz'
    END;

    IF v_session_id IS NULL THEN
      v_session_id := gen_random_uuid();
      INSERT INTO public.workforce_work_sessions (
        id, tenant_id, employee_id, user_id, work_date,
        status, work_mode, display_status,
        started_at, last_event_at, is_online,
        gross_minutes, net_minutes, pause_minutes, current_visit_id
      ) VALUES (
        v_session_id, p_tenant_id, v_employee_id, v_auth_user_id, v_work_date,
        v_session_status, 'field', v_display_status,
        r.occurred_at, r.occurred_at, r.event_type NOT IN ('service_end', 'depart'),
        0, 0, 0, p_visit_id
      );
    ELSE
      UPDATE public.workforce_work_sessions
      SET
        status = v_session_status,
        display_status = v_display_status,
        last_event_at = r.occurred_at,
        is_online = r.event_type NOT IN ('service_end', 'depart'),
        current_visit_id = COALESCE(current_visit_id, p_visit_id),
        updated_at = NOW()
      WHERE id = v_session_id;
    END IF;

    INSERT INTO public.workforce_time_events (
      id, tenant_id, employee_id, user_id,
      event_type, work_mode, source, occurred_at,
      session_id, reference_type, reference_id
    ) VALUES (
      gen_random_uuid(), p_tenant_id, v_employee_id, v_auth_user_id,
      v_wfm_type, 'field', 'assist', r.occurred_at,
      v_session_id, 'visit', p_visit_id
    );

    v_inserted := v_inserted + 1;
  END LOOP;

  RETURN v_inserted;
END;
$$;

COMMENT ON FUNCTION public.sync_assist_visit_times_to_wfm(UUID, UUID) IS
  'P0.1 — Idempotent Assist→WFM mirror for portal finalize (SECURITY DEFINER).';

GRANT EXECUTE ON FUNCTION public.sync_assist_visit_times_to_wfm(UUID, UUID) TO authenticated;
