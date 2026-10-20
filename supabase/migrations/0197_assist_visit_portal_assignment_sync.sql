-- Backfill legacy assignments mirror for assist_visits created after disposition migration.
-- Root cause: Office/Assist writes assist_visits; employee/client portals query assignments.

-- Client portal: scoped read on own assignments (employee portal policy exists in 0189).
DROP POLICY IF EXISTS assignments_portal_client_select ON public.assignments;
CREATE POLICY assignments_portal_client_select ON public.assignments
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND client_id = public.current_client_id()
    AND public.current_client_id() IS NOT NULL
  );

COMMENT ON POLICY assignments_portal_client_select ON public.assignments IS
  'Client/relative portal users read assignments for their linked client record.';

-- Mirror non-draft assist_visits into assignments (same id for stable portal bridge).
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
  updated_at
)
SELECT
  v.id,
  v.tenant_id,
  v.client_id,
  v.employee_id,
  v.assignment_date,
  v.planned_start_at,
  v.planned_end_at,
  v.title,
  v.description,
  v.address_snapshot,
  v.internal_notes,
  v.client_visible_notes,
  CASE v.canonical_status
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
  v.created_by,
  v.created_at,
  v.updated_at
FROM public.assist_visits v
WHERE v.planning_status <> 'draft'
  AND NOT EXISTS (
    SELECT 1 FROM public.assignments a WHERE a.id = v.id
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
  updated_at = EXCLUDED.updated_at;

UPDATE public.assist_visits v
SET legacy_assignment_id = v.id
WHERE v.planning_status <> 'draft'
  AND (v.legacy_assignment_id IS NULL OR v.legacy_assignment_id <> v.id)
  AND EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = v.id);

-- Mirror visit tasks into assignment_tasks where missing.
INSERT INTO public.assignment_tasks (
  tenant_id,
  assignment_id,
  title,
  status,
  is_required,
  requires_note_if_not_done,
  sort_order,
  created_at,
  updated_at
)
SELECT
  t.tenant_id,
  v.id,
  t.title,
  t.status::TEXT,
  COALESCE(t.is_required, TRUE),
  COALESCE(t.requires_note_if_not_done, FALSE),
  COALESCE(t.sort_order, 0),
  t.created_at,
  t.updated_at
FROM public.assist_visit_tasks t
JOIN public.assist_visits v ON v.id = t.visit_id AND v.tenant_id = t.tenant_id
WHERE v.planning_status <> 'draft'
  AND NOT EXISTS (
    SELECT 1
    FROM public.assignment_tasks at
    WHERE at.tenant_id = t.tenant_id
      AND at.assignment_id = v.id
      AND at.title = t.title
  );
