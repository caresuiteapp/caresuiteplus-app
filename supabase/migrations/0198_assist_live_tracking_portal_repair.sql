-- Live tracking portal repair: profile tenant backfill, visit→assignment sync trigger,
-- portal-scoped RLS for assist tracking reads/writes.

-- --------------------------------------------------------------------------
-- Portal profile tenant backfill (client + employee portal users)
-- Root cause: profiles.tenant_id NULL → is_tenant_member() false → assist_location_points blocked.
-- --------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT;

UPDATE public.profiles p
SET
  tenant_id = cpa.tenant_id,
  first_name = COALESCE(NULLIF(trim(p.first_name), ''), c.first_name),
  last_name = COALESCE(NULLIF(trim(p.last_name), ''), c.last_name),
  updated_at = NOW()
FROM public.client_portal_access cpa
JOIN public.clients c ON c.id = cpa.client_id AND c.tenant_id = cpa.tenant_id
WHERE p.auth_user_id = cpa.auth_user_id
  AND cpa.auth_user_id IS NOT NULL
  AND cpa.portal_enabled = TRUE
  AND p.tenant_id IS NULL;

UPDATE public.profiles p
SET
  tenant_id = epa.tenant_id,
  first_name = COALESCE(NULLIF(trim(p.first_name), ''), e.first_name),
  last_name = COALESCE(NULLIF(trim(p.last_name), ''), e.last_name),
  updated_at = NOW()
FROM public.employee_portal_accounts epa
JOIN public.employees e ON e.id = epa.employee_id AND e.tenant_id = epa.tenant_id
WHERE p.auth_user_id = epa.auth_user_id
  AND epa.auth_user_id IS NOT NULL
  AND epa.status = 'active'
  AND p.tenant_id IS NULL;

-- JWT fallback when profile row still lacks tenant_id
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT p.tenant_id
      FROM public.profiles p
      WHERE p.id = auth.uid() OR p.auth_user_id = auth.uid()
      LIMIT 1
    ),
    (
      SELECT cpa.tenant_id
      FROM public.client_portal_access cpa
      WHERE cpa.auth_user_id = auth.uid()
      LIMIT 1
    ),
    (
      SELECT epa.tenant_id
      FROM public.employee_portal_accounts epa
      WHERE epa.auth_user_id = auth.uid()
      LIMIT 1
    ),
    NULLIF(auth.jwt()->'app_metadata'->>'tenant_id', '')::uuid
  )
$$;

-- --------------------------------------------------------------------------
-- Keep assignments mirror in sync when assist_visits change (Office/Assist writes visits).
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_assignment_mirror_from_assist_visit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.planning_status = 'draft' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.assignments (
    id,
    tenant_id,
    client_id,
    employee_id,
    assignment_date,
    planned_start_at,
    planned_end_at,
    title,
    description,
    address_snapshot,
    internal_notes,
    client_visible_notes,
    status,
    product_key,
    created_by,
    created_at,
    updated_at,
    on_the_way_at,
    arrived_at,
    actual_start_at,
    actual_end_at,
    finished_at
  )
  VALUES (
    NEW.id,
    NEW.tenant_id,
    NEW.client_id,
    NEW.employee_id,
    NEW.assignment_date,
    NEW.planned_start_at,
    NEW.planned_end_at,
    NEW.title,
    NEW.description,
    NEW.address_snapshot,
    NEW.internal_notes,
    NEW.client_visible_notes,
    CASE NEW.canonical_status
      WHEN 'planned' THEN 'planned'::public.assignment_status
      WHEN 'confirmed' THEN 'confirmed'::public.assignment_status
      WHEN 'on_the_way' THEN 'on_the_way'::public.assignment_status
      WHEN 'arrived' THEN 'arrived'::public.assignment_status
      WHEN 'started' THEN 'started'::public.assignment_status
      WHEN 'paused' THEN 'paused'::public.assignment_status
      WHEN 'finished' THEN 'finished'::public.assignment_status
      WHEN 'documentation_open' THEN 'documentation_open'::public.assignment_status
      WHEN 'signature_open' THEN 'signature_open'::public.assignment_status
      WHEN 'completed' THEN 'completed'::public.assignment_status
      WHEN 'cancelled' THEN 'cancelled'::public.assignment_status
      WHEN 'no_show' THEN 'no_show'::public.assignment_status
      WHEN 'scheduled' THEN 'planned'::public.assignment_status
      ELSE 'planned'::public.assignment_status
    END,
    'assist'::public.product_key,
    NEW.created_by,
    NEW.created_at,
    NEW.updated_at,
    NEW.on_the_way_at,
    NEW.arrived_at,
    NEW.actual_start_at,
    NEW.actual_end_at,
    NEW.finished_at
  )
  ON CONFLICT (id) DO UPDATE SET
    client_id = EXCLUDED.client_id,
    employee_id = EXCLUDED.employee_id,
    assignment_date = EXCLUDED.assignment_date,
    planned_start_at = EXCLUDED.planned_start_at,
    planned_end_at = EXCLUDED.planned_end_at,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    address_snapshot = EXCLUDED.address_snapshot,
    internal_notes = EXCLUDED.internal_notes,
    client_visible_notes = EXCLUDED.client_visible_notes,
    status = EXCLUDED.status,
    on_the_way_at = EXCLUDED.on_the_way_at,
    arrived_at = EXCLUDED.arrived_at,
    actual_start_at = EXCLUDED.actual_start_at,
    actual_end_at = EXCLUDED.actual_end_at,
    finished_at = EXCLUDED.finished_at,
    updated_at = EXCLUDED.updated_at;

  IF NEW.legacy_assignment_id IS NULL OR NEW.legacy_assignment_id <> NEW.id THEN
    UPDATE public.assist_visits
    SET legacy_assignment_id = NEW.id
    WHERE id = NEW.id AND tenant_id = NEW.tenant_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_assignment_mirror_from_assist_visit ON public.assist_visits;
CREATE TRIGGER trg_sync_assignment_mirror_from_assist_visit
  AFTER INSERT OR UPDATE ON public.assist_visits
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_assignment_mirror_from_assist_visit();

-- --------------------------------------------------------------------------
-- Portal RLS: client reads tracking for own assignments; employee writes own visits
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS assist_tracking_sessions_portal_client_select ON public.assist_tracking_sessions;
CREATE POLICY assist_tracking_sessions_portal_client_select ON public.assist_tracking_sessions
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_client_id() IS NOT NULL
    AND visit_id IN (
      SELECT a.id
      FROM public.assignments a
      WHERE a.tenant_id = public.current_tenant_id()
        AND a.client_id = public.current_client_id()
    )
  );

DROP POLICY IF EXISTS assist_location_points_portal_client_select ON public.assist_location_points;
CREATE POLICY assist_location_points_portal_client_select ON public.assist_location_points
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_client_id() IS NOT NULL
    AND visit_id IN (
      SELECT a.id
      FROM public.assignments a
      WHERE a.tenant_id = public.current_tenant_id()
        AND a.client_id = public.current_client_id()
    )
  );

DROP POLICY IF EXISTS assist_time_events_portal_client_select ON public.assist_time_events;
CREATE POLICY assist_time_events_portal_client_select ON public.assist_time_events
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_client_id() IS NOT NULL
    AND visit_id IN (
      SELECT a.id
      FROM public.assignments a
      WHERE a.tenant_id = public.current_tenant_id()
        AND a.client_id = public.current_client_id()
    )
  );

DROP POLICY IF EXISTS assist_tracking_sessions_portal_employee_all ON public.assist_tracking_sessions;
CREATE POLICY assist_tracking_sessions_portal_employee_all ON public.assist_tracking_sessions
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() = 'employee_portal'
    AND employee_id = public.resolve_current_employee_id()
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() = 'employee_portal'
    AND employee_id = public.resolve_current_employee_id()
  );

DROP POLICY IF EXISTS assist_location_points_portal_employee_insert ON public.assist_location_points;
CREATE POLICY assist_location_points_portal_employee_insert ON public.assist_location_points
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() = 'employee_portal'
    AND visit_id IN (
      SELECT a.id
      FROM public.assignments a
      WHERE a.tenant_id = public.current_tenant_id()
        AND a.employee_id = public.resolve_current_employee_id()
    )
  );

DROP POLICY IF EXISTS assist_location_points_portal_employee_select ON public.assist_location_points;
CREATE POLICY assist_location_points_portal_employee_select ON public.assist_location_points
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() = 'employee_portal'
    AND visit_id IN (
      SELECT a.id
      FROM public.assignments a
      WHERE a.tenant_id = public.current_tenant_id()
        AND a.employee_id = public.resolve_current_employee_id()
    )
  );

DROP POLICY IF EXISTS assist_time_events_portal_employee_insert ON public.assist_time_events;
CREATE POLICY assist_time_events_portal_employee_insert ON public.assist_time_events
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() = 'employee_portal'
    AND visit_id IN (
      SELECT a.id
      FROM public.assignments a
      WHERE a.tenant_id = public.current_tenant_id()
        AND a.employee_id = public.resolve_current_employee_id()
    )
  );

DROP POLICY IF EXISTS assist_time_events_portal_employee_select ON public.assist_time_events;
CREATE POLICY assist_time_events_portal_employee_select ON public.assist_time_events
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() = 'employee_portal'
    AND visit_id IN (
      SELECT a.id
      FROM public.assignments a
      WHERE a.tenant_id = public.current_tenant_id()
        AND a.employee_id = public.resolve_current_employee_id()
    )
  );

COMMENT ON FUNCTION public.sync_assignment_mirror_from_assist_visit() IS
  'Mirrors assist_visits into assignments on every write — keeps employee/client portals in sync.';
