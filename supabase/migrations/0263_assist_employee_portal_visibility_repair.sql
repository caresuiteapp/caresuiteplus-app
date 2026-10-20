-- Existing assigned Assist visits must be visible in the employee portal.
-- Drafts remain private. This migration does not delete or merge visit records.
UPDATE public.assist_visits
SET employee_portal_visible = true,
    updated_at = now()
WHERE employee_id IS NOT NULL
  AND planning_status <> 'draft'
  AND employee_portal_visible IS DISTINCT FROM true;
