-- P0 2026-07-24: Assist "Zeiten prüfen und buchen" produktiv reparieren.
--
-- Die Office-Oberfläche darf nicht davon abhängen, ob ältere, nicht in der
-- Remote-Historie geführte 0255/0257/0266/0267-Migrationen einzeln vorhanden
-- sind. Diese Migration stellt den konkreten Zeitkorrekturpfad additiv und
-- idempotent bereit, ohne die bestehende Migrationshistorie umzuschreiben.

ALTER TABLE public.assist_visits
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.assist_visit_admin_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  visit_id UUID NOT NULL REFERENCES public.assist_visits(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  previous_value JSONB,
  new_value JSONB,
  reason TEXT NOT NULL CHECK (length(trim(reason)) > 0),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS assist_visit_admin_audit_visit_idx
  ON public.assist_visit_admin_audit(tenant_id, visit_id, created_at DESC);

ALTER TABLE public.assist_visit_admin_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS assist_admin_audit_office
  ON public.assist_visit_admin_audit;
CREATE POLICY assist_admin_audit_office
  ON public.assist_visit_admin_audit
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.is_tenant_admin()
      OR public.has_permission('assist.execution.view')
      OR public.has_permission('time.audit.view')
    )
  );

REVOKE ALL ON public.assist_visit_admin_audit FROM PUBLIC, anon;
GRANT SELECT ON public.assist_visit_admin_audit TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_current_profile_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.id
  FROM public.profiles p
  WHERE p.id = auth.uid()
     OR p.auth_user_id = auth.uid()
  ORDER BY CASE WHEN p.id = auth.uid() THEN 0 ELSE 1 END
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.resolve_current_profile_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_current_profile_id() TO authenticated;

CREATE OR REPLACE FUNCTION public.normalize_assist_visit_updated_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.updated_by IS NOT NULL THEN
    NEW.updated_by := public.resolve_current_profile_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_assist_visit_updated_by_trigger
  ON public.assist_visits;
CREATE TRIGGER normalize_assist_visit_updated_by_trigger
BEFORE INSERT OR UPDATE OF updated_by ON public.assist_visits
FOR EACH ROW
EXECUTE FUNCTION public.normalize_assist_visit_updated_by();

CREATE OR REPLACE FUNCTION public.normalize_assist_time_event_recorded_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.recorded_by IS NOT NULL THEN
    NEW.recorded_by := public.resolve_current_profile_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_assist_time_event_recorded_by_trigger
  ON public.assist_time_events;
CREATE TRIGGER normalize_assist_time_event_recorded_by_trigger
BEFORE INSERT OR UPDATE OF recorded_by ON public.assist_time_events
FOR EACH ROW
EXECUTE FUNCTION public.normalize_assist_time_event_recorded_by();

INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.permission_key
FROM public.roles r
CROSS JOIN (
  VALUES
    ('assist.execution.manage'::TEXT),
    ('time.tracking.admin.correct'::TEXT)
) AS p(permission_key)
WHERE r.key IN (
  'owner', 'admin', 'management', 'geschaeftsfuehrung',
  'business_admin', 'business_manager'
)
ON CONFLICT (role_id, permission_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.admin_correct_assist_visit_times(
  p_visit_id UUID,
  p_on_the_way_at TIMESTAMPTZ,
  p_arrived_at TIMESTAMPTZ,
  p_started_at TIMESTAMPTZ,
  p_ended_at TIMESTAMPTZ,
  p_pause_minutes INTEGER,
  p_travel_minutes INTEGER,
  p_reason TEXT,
  p_confirm_overlap BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v public.assist_visits%ROWTYPE;
  v_old JSONB;
  v_overlap INTEGER := 0;
  v_net INTEGER;
  v_profile_id UUID;
  v_auth_user_id UUID;
BEGIN
  IF NOT (
    public.is_tenant_admin()
    OR (
      public.has_permission('assist.execution.manage')
      AND public.has_permission('time.tracking.admin.correct')
    )
  ) THEN
    RAISE EXCEPTION 'Keine Berechtigung für administrative Zeitkorrekturen';
  END IF;

  IF length(trim(coalesce(p_reason, ''))) = 0 THEN
    RAISE EXCEPTION 'Begründung ist erforderlich';
  END IF;

  SELECT *
  INTO v
  FROM public.assist_visits
  WHERE id = p_visit_id
    AND tenant_id = public.current_tenant_id()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Einsatz nicht gefunden';
  END IF;

  IF v.employee_id IS NULL THEN
    RAISE EXCEPTION 'Mitarbeitenden-Zuordnung fehlt';
  END IF;

  IF p_started_at IS NULL
     OR p_ended_at IS NULL
     OR p_started_at >= p_ended_at
     OR coalesce(p_pause_minutes, 0) < 0
     OR coalesce(p_travel_minutes, 0) < 0
     OR (
       p_on_the_way_at IS NOT NULL
       AND p_arrived_at IS NOT NULL
       AND p_on_the_way_at > p_arrived_at
     )
     OR (
       p_arrived_at IS NOT NULL
       AND p_arrived_at > p_started_at
     ) THEN
    RAISE EXCEPTION 'Ungültige Zeitfolge';
  END IF;

  v_net :=
    floor(extract(epoch FROM (p_ended_at - p_started_at)) / 60)::INTEGER
    - coalesce(p_pause_minutes, 0);

  IF v_net <= 0 THEN
    RAISE EXCEPTION 'Pausen überschreiten die Einsatzdauer';
  END IF;

  SELECT count(*)
  INTO v_overlap
  FROM public.assist_visits x
  WHERE x.tenant_id = v.tenant_id
    AND x.employee_id = v.employee_id
    AND x.id <> v.id
    AND coalesce(x.actual_start_at, x.planned_start_at) < p_ended_at
    AND coalesce(x.actual_end_at, x.planned_end_at) > p_started_at
    AND x.execution_status NOT IN ('cancelled', 'no_show');

  IF v_overlap > 0 AND NOT p_confirm_overlap THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'overlap', TRUE,
      'count', v_overlap
    );
  END IF;

  v_old := to_jsonb(v);
  v_profile_id := public.resolve_current_profile_id();

  SELECT coalesce(epa.auth_user_id, p.auth_user_id)
  INTO v_auth_user_id
  FROM public.employees employee
  LEFT JOIN public.employee_portal_accounts epa
    ON epa.tenant_id = employee.tenant_id
   AND epa.employee_id = employee.id
   AND epa.status = 'active'
  LEFT JOIN public.profiles p
    ON p.id = employee.profile_id
  WHERE employee.tenant_id = v.tenant_id
    AND employee.id = v.employee_id
  LIMIT 1;

  UPDATE public.assist_visits
  SET
    on_the_way_at = p_on_the_way_at,
    arrived_at = p_arrived_at,
    actual_start_at = p_started_at,
    actual_end_at = p_ended_at,
    finished_at = p_ended_at,
    duration_minutes = v_net,
    updated_by = v_profile_id,
    updated_at = NOW()
  WHERE id = v.id
    AND tenant_id = v.tenant_id;

  DELETE FROM public.assist_time_events
  WHERE tenant_id = v.tenant_id
    AND visit_id = v.id
    AND metadata->>'source' = 'administrative_follow_up';

  INSERT INTO public.assist_time_events (
    tenant_id,
    visit_id,
    event_type,
    occurred_at,
    recorded_by,
    metadata
  )
  SELECT
    v.tenant_id,
    v.id,
    e.event_type,
    e.occurred_at,
    v_profile_id,
    jsonb_build_object(
      'source', 'administrative_follow_up',
      'reason', trim(p_reason),
      'corrected_at', NOW()
    )
  FROM (
    VALUES
      ('drive_start'::TEXT, p_on_the_way_at),
      ('arrive'::TEXT, p_arrived_at),
      ('service_start'::TEXT, p_started_at),
      ('service_end'::TEXT, p_ended_at)
  ) AS e(event_type, occurred_at)
  WHERE e.occurred_at IS NOT NULL;

  -- Bereits vorhandene WFM-Ereignisse müssen auf die korrigierten Zeiten
  -- verschoben werden. Der ältere Sync war nur insert-idempotent und ließ
  -- vorhandene, aber falsche Zeitstempel unverändert.
  UPDATE public.workforce_time_events
  SET
    occurred_at = CASE event_type
      WHEN 'visit_drive_start' THEN coalesce(p_on_the_way_at, occurred_at)
      WHEN 'visit_arrived' THEN coalesce(p_arrived_at, occurred_at)
      WHEN 'visit_started' THEN p_started_at
      WHEN 'visit_ended' THEN p_ended_at
      ELSE occurred_at
    END,
    note = trim(p_reason),
    metadata = coalesce(metadata, '{}'::JSONB)
      || jsonb_build_object(
        'source', 'administrative_follow_up',
        'pause_minutes', coalesce(p_pause_minutes, 0),
        'travel_minutes', coalesce(p_travel_minutes, 0),
        'net_minutes', v_net
      )
  WHERE tenant_id = v.tenant_id
    AND employee_id = v.employee_id
    AND reference_type = 'visit'
    AND reference_id = v.id
    AND event_type IN (
      'visit_drive_start',
      'visit_arrived',
      'visit_started',
      'visit_ended'
    );

  INSERT INTO public.workforce_time_events (
    tenant_id,
    employee_id,
    user_id,
    event_type,
    work_mode,
    source,
    occurred_at,
    reference_type,
    reference_id,
    note,
    metadata,
    created_by
  )
  SELECT
    v.tenant_id,
    v.employee_id,
    v_auth_user_id,
    e.event_type,
    'field',
    'assist',
    e.occurred_at,
    'visit',
    v.id,
    trim(p_reason),
    jsonb_build_object(
      'source', 'administrative_follow_up',
      'pause_minutes', coalesce(p_pause_minutes, 0),
      'travel_minutes', coalesce(p_travel_minutes, 0),
      'net_minutes', v_net
    ),
    auth.uid()
  FROM (
    VALUES
      ('visit_drive_start'::TEXT, p_on_the_way_at),
      ('visit_arrived'::TEXT, p_arrived_at),
      ('visit_started'::TEXT, p_started_at),
      ('visit_ended'::TEXT, p_ended_at)
  ) AS e(event_type, occurred_at)
  WHERE e.occurred_at IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.workforce_time_events existing
      WHERE existing.tenant_id = v.tenant_id
        AND existing.employee_id = v.employee_id
        AND existing.reference_type = 'visit'
        AND existing.reference_id = v.id
        AND existing.event_type = e.event_type
    );

  INSERT INTO public.workforce_time_events (
    tenant_id,
    employee_id,
    user_id,
    event_type,
    work_mode,
    source,
    occurred_at,
    reference_type,
    reference_id,
    note,
    metadata,
    created_by
  )
  VALUES (
    v.tenant_id,
    v.employee_id,
    auth.uid(),
    'correction',
    'field',
    'correction',
    NOW(),
    'visit',
    v.id,
    trim(p_reason),
    jsonb_build_object(
      'source', 'administrative_follow_up',
      'actual_start_at', p_started_at,
      'actual_end_at', p_ended_at,
      'pause_minutes', coalesce(p_pause_minutes, 0),
      'travel_minutes', coalesce(p_travel_minutes, 0),
      'net_minutes', v_net
    ),
    auth.uid()
  );

  INSERT INTO public.assist_visit_admin_audit (
    tenant_id,
    visit_id,
    action,
    previous_value,
    new_value,
    reason
  )
  VALUES (
    v.tenant_id,
    v.id,
    'times_corrected',
    v_old,
    jsonb_build_object(
      'on_the_way_at', p_on_the_way_at,
      'arrived_at', p_arrived_at,
      'actual_start_at', p_started_at,
      'actual_end_at', p_ended_at,
      'pause_minutes', coalesce(p_pause_minutes, 0),
      'travel_minutes', coalesce(p_travel_minutes, 0),
      'net_minutes', v_net,
      'overlap_confirmed', v_overlap > 0
    ),
    trim(p_reason)
  );

  RETURN jsonb_build_object(
    'ok', TRUE,
    'overlap', FALSE,
    'net_minutes', v_net,
    'overlap_confirmed', v_overlap > 0
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_correct_assist_visit_times(
  UUID,
  TIMESTAMPTZ,
  TIMESTAMPTZ,
  TIMESTAMPTZ,
  TIMESTAMPTZ,
  INTEGER,
  INTEGER,
  TEXT,
  BOOLEAN
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_correct_assist_visit_times(
  UUID,
  TIMESTAMPTZ,
  TIMESTAMPTZ,
  TIMESTAMPTZ,
  TIMESTAMPTZ,
  INTEGER,
  INTEGER,
  TEXT,
  BOOLEAN
) TO authenticated;

NOTIFY pgrst, 'reload schema';
