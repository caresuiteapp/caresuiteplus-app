-- CareSuite+ WFM V32.5: vollständige Reparatur für Fahrzeitregeln und Team-Meetings
-- Idempotent und auch für Datenbanken geeignet, in denen 0260 nicht registriert wurde.

BEGIN;

CREATE TABLE IF NOT EXISTS public.workforce_travel_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  min_gap_minutes INTEGER NOT NULL DEFAULT 0 CHECK (min_gap_minutes >= 0),
  max_gap_minutes INTEGER CHECK (max_gap_minutes IS NULL OR max_gap_minutes >= min_gap_minutes),
  counts_as_work_time BOOLEAN NOT NULL DEFAULT TRUE,
  round_to_minutes INTEGER NOT NULL DEFAULT 1 CHECK (round_to_minutes IN (1, 5, 10, 15, 30)),
  mileage_rate_cents INTEGER NOT NULL DEFAULT 0 CHECK (mileage_rate_cents >= 0),
  priority INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workforce_travel_rules_tenant
  ON public.workforce_travel_rules (tenant_id, is_active, priority);

CREATE TABLE IF NOT EXISTS public.workforce_team_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL CHECK (ends_at > starts_at),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  counts_as_work_time BOOLEAN NOT NULL DEFAULT TRUE,
  calendar_event_id UUID,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workforce_team_meetings_tenant_time
  ON public.workforce_team_meetings (tenant_id, starts_at DESC);

CREATE TABLE IF NOT EXISTS public.workforce_team_meeting_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL REFERENCES public.workforce_team_meetings(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  attendance_status TEXT NOT NULL DEFAULT 'invited'
    CHECK (attendance_status IN ('invited', 'accepted', 'declined', 'attended', 'absent')),
  booked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (meeting_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_workforce_team_meeting_attendees_employee
  ON public.workforce_team_meeting_attendees (tenant_id, employee_id, meeting_id);

ALTER TABLE public.workforce_travel_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_team_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_team_meeting_attendees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wfm_travel_rules_select ON public.workforce_travel_rules;
CREATE POLICY wfm_travel_rules_select ON public.workforce_travel_rules
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS wfm_travel_rules_manage ON public.workforce_travel_rules;
CREATE POLICY wfm_travel_rules_manage ON public.workforce_travel_rules
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (public.has_permission('time.settings.manage') OR public.is_tenant_admin())
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (public.has_permission('time.settings.manage') OR public.is_tenant_admin())
  );

DROP POLICY IF EXISTS wfm_team_meetings_select ON public.workforce_team_meetings;
CREATE POLICY wfm_team_meetings_select ON public.workforce_team_meetings
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS wfm_team_meetings_manage ON public.workforce_team_meetings;
CREATE POLICY wfm_team_meetings_manage ON public.workforce_team_meetings
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (public.has_permission('time.settings.manage') OR public.is_tenant_admin())
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (public.has_permission('time.settings.manage') OR public.is_tenant_admin())
  );

DROP POLICY IF EXISTS wfm_team_meeting_attendees_select ON public.workforce_team_meeting_attendees;
CREATE POLICY wfm_team_meeting_attendees_select ON public.workforce_team_meeting_attendees
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS wfm_team_meeting_attendees_manage ON public.workforce_team_meeting_attendees;
CREATE POLICY wfm_team_meeting_attendees_manage ON public.workforce_team_meeting_attendees
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (public.has_permission('time.settings.manage') OR public.is_tenant_admin())
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (public.has_permission('time.settings.manage') OR public.is_tenant_admin())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workforce_travel_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workforce_team_meetings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workforce_team_meeting_attendees TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_wfm_team_meeting(
  p_tenant_id UUID,
  p_meeting_id UUID,
  p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meeting public.workforce_team_meetings%ROWTYPE;
  v_booked INTEGER := 0;
BEGIN
  IF p_tenant_id IS DISTINCT FROM public.current_tenant_id() THEN
    RAISE EXCEPTION 'Mandant stimmt nicht mit der Sitzung überein.';
  END IF;
  IF NOT (public.has_permission('time.settings.manage') OR public.is_tenant_admin()) THEN
    RAISE EXCEPTION 'Keine Berechtigung zum Abschließen des Team-Meetings.';
  END IF;

  SELECT * INTO v_meeting
  FROM public.workforce_team_meetings
  WHERE tenant_id = p_tenant_id AND id = p_meeting_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Team-Meeting nicht gefunden.';
  END IF;
  IF v_meeting.status = 'cancelled' THEN
    RAISE EXCEPTION 'Abgesagtes Team-Meeting kann nicht gebucht werden.';
  END IF;

  IF v_meeting.counts_as_work_time THEN
    WITH attendees_to_book AS (
      SELECT attendee.employee_id
      FROM public.workforce_team_meeting_attendees attendee
      WHERE attendee.tenant_id = p_tenant_id
        AND attendee.meeting_id = p_meeting_id
        AND attendee.booked_at IS NULL
      FOR UPDATE
    ), inserted_events AS (
      INSERT INTO public.workforce_time_events (
        tenant_id, employee_id, event_type, work_mode, source,
        occurred_at, note, metadata, created_by
      )
      SELECT
        p_tenant_id,
        attendee.employee_id,
        event.event_type,
        'office',
        'office',
        event.occurred_at,
        v_meeting.title,
        jsonb_build_object('meeting_id', p_meeting_id, 'source', 'team_meeting'),
        p_actor_id
      FROM attendees_to_book attendee
      CROSS JOIN LATERAL (
        VALUES
          ('meeting_start'::TEXT, v_meeting.starts_at),
          ('meeting_end'::TEXT, v_meeting.ends_at)
      ) AS event(event_type, occurred_at)
      RETURNING employee_id
    )
    SELECT COUNT(DISTINCT employee_id) INTO v_booked FROM inserted_events;

    UPDATE public.workforce_team_meeting_attendees
    SET attendance_status = 'attended', booked_at = now()
    WHERE tenant_id = p_tenant_id
      AND meeting_id = p_meeting_id
      AND booked_at IS NULL;
  END IF;

  UPDATE public.workforce_team_meetings
  SET status = 'completed', updated_at = now()
  WHERE tenant_id = p_tenant_id AND id = p_meeting_id;

  RETURN jsonb_build_object('ok', TRUE, 'booked_attendees', v_booked);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_wfm_team_meeting(UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_wfm_team_meeting(UUID, UUID, UUID) TO authenticated;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.workforce_travel_rules;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.workforce_team_meetings;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
