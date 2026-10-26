-- Durable employee planning notices. Apply with the web assignment notice gate.
-- This patch changes neither assignment access nor notification RLS. It uses
-- the existing recipient-scoped inbox; native push remains independent.
BEGIN;

-- A stale Office bundle must not hide an already published employee plan or
-- confirm a draft through a legacy status RPC. Publication stays explicit.
CREATE OR REPLACE FUNCTION public.guard_assist_visit_publication()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.planning_status <> 'draft' AND NEW.planning_status = 'draft' THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Ein bereits veröffentlichter Einsatz kann nicht wieder als Entwurf gespeichert werden. Bitte den Einsatz ändern oder absagen.';
    END IF;
    -- Leave unrelated maintenance of legacy inconsistent rows possible; never
    -- silently publish or reclassify them as a side effect of this migration.
    IF ROW(OLD.planning_status, OLD.canonical_status) IS NOT DISTINCT FROM ROW(NEW.planning_status, NEW.canonical_status) THEN RETURN NEW; END IF;
  END IF;
  IF NEW.planning_status = 'draft' AND NEW.canonical_status NOT IN ('planned', 'cancelled') THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Dieser Einsatz ist noch ein Entwurf. Bitte zuerst ausdrücklich veröffentlichen, bevor er bestätigt oder gestartet wird.';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_assist_visit_publication() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS zz_guard_assist_visit_publication ON public.assist_visits;
CREATE TRIGGER zz_guard_assist_visit_publication
  BEFORE INSERT OR UPDATE OF planning_status, canonical_status ON public.assist_visits
  FOR EACH ROW EXECUTE FUNCTION public.guard_assist_visit_publication();

CREATE OR REPLACE FUNCTION public.guard_assignment_draft_publication()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  END IF;
  IF NEW.status::text NOT IN ('planned', 'cancelled') AND EXISTS (
    SELECT 1 FROM public.assist_visits v
    WHERE v.tenant_id = NEW.tenant_id AND (v.id = NEW.id OR v.legacy_assignment_id = NEW.id)
      AND v.planning_status = 'draft'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Dieser Einsatz ist noch ein Entwurf. Bitte zuerst ausdrücklich veröffentlichen, bevor er bestätigt oder gestartet wird.';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_assignment_draft_publication() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS zz_guard_assignment_draft_publication ON public.assignments;
CREATE TRIGGER zz_guard_assignment_draft_publication
  BEFORE INSERT OR UPDATE OF status ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.guard_assignment_draft_publication();

CREATE UNIQUE INDEX IF NOT EXISTS office_notifications_assignment_event_unique
  ON public.office_notifications (tenant_id, recipient_employee_id, (metadata->>'eventKey'))
  WHERE notification_type = 'appointment' AND metadata->>'kind' = 'assignment_change';

CREATE OR REPLACE FUNCTION public.notify_employee_assignment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  before_row public.assist_visits;
  after_row public.assist_visits;
  old_visible boolean := false;
  new_visible boolean := false;
  new_cancelled boolean := false;
  relevant_change boolean := true;
  notice record;
  appointment_label text;
BEGIN
  -- The trigger runs only after a write that already passed assist_visits ACLs,
  -- RLS and its existing planning guards. No publicly callable privileged RPC.
  -- Client tracking release and the obsolete employee_portal_visible flag are
  -- not employee planning gates. Own non-draft assignment/RLS is authoritative.
  IF TG_OP <> 'INSERT' THEN
    before_row := OLD;
    old_visible := before_row.employee_id IS NOT NULL
      AND before_row.planning_status NOT IN ('draft', 'cancelled')
      AND before_row.canonical_status NOT IN ('cancelled', 'no_show')
      AND (before_row.canonical_status <> 'completed' OR coalesce(before_row.recurrence_json->>'pattern', 'none') <> 'none')
      AND EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = before_row.tenant_id)
      AND EXISTS (SELECT 1 FROM public.employees e WHERE e.id = before_row.employee_id AND e.tenant_id = before_row.tenant_id)
      AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = before_row.client_id AND c.tenant_id = before_row.tenant_id);
  END IF;
  IF TG_OP <> 'DELETE' THEN
    after_row := NEW;
    new_cancelled := after_row.planning_status = 'cancelled' OR after_row.canonical_status IN ('cancelled', 'no_show');
    new_visible := after_row.employee_id IS NOT NULL
      AND after_row.planning_status NOT IN ('draft', 'cancelled')
      AND after_row.canonical_status NOT IN ('cancelled', 'no_show')
      AND (after_row.canonical_status <> 'completed' OR coalesce(after_row.recurrence_json->>'pattern', 'none') <> 'none')
      AND EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = after_row.tenant_id)
      AND EXISTS (SELECT 1 FROM public.employees e WHERE e.id = after_row.employee_id AND e.tenant_id = after_row.tenant_id)
      AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = after_row.client_id AND c.tenant_id = after_row.tenant_id);
  END IF;
  -- Starting a virtual series occurrence materializes an already planned
  -- appointment. Its INSERT is workflow bookkeeping, not a new allocation.
  IF TG_OP = 'INSERT' AND nullif(after_row.recurrence_json->>'parentSeriesId', '') IS NOT NULL THEN
    RETURN NEW;
  END IF;
  -- The repository removes a freshly materialized child if recording its
  -- parent mapping failed. If that same occurrence is still virtual in the
  -- same employee's parent plan, cleanup is not an appointment cancellation.
  IF TG_OP = 'DELETE' AND EXISTS (
    SELECT 1 FROM public.assist_visits parent
    WHERE parent.id::text = before_row.recurrence_json->>'parentSeriesId'
      AND parent.tenant_id = before_row.tenant_id
      AND parent.employee_id = before_row.employee_id AND parent.client_id = before_row.client_id
      AND parent.planning_status NOT IN ('draft', 'cancelled')
      AND parent.canonical_status NOT IN ('cancelled', 'no_show')
      AND coalesce(parent.recurrence_json->>'pattern', 'none') <> 'none'
      AND nullif(before_row.recurrence_json->>'sourceOccurrenceDate', '') IS NOT NULL
      AND parent.recurrence_json->'materializedOccurrences'->>(before_row.recurrence_json->>'sourceOccurrenceDate') IS NULL
      AND NOT coalesce(parent.recurrence_json->'detachedOccurrenceDates', '[]'::jsonb) ? (before_row.recurrence_json->>'sourceOccurrenceDate')
  ) THEN RETURN OLD; END IF;
  IF TG_OP = 'UPDATE' THEN
    -- Do not turn location pings, completion, documentation, signatures, client
    -- release or timestamp maintenance into a new scheduling announcement.
    relevant_change := ROW(after_row.tenant_id, after_row.employee_id, after_row.client_id, after_row.assignment_date,
      after_row.planned_start_at, after_row.planned_end_at, after_row.title, after_row.address_snapshot,
      after_row.planning_status, after_row.description, after_row.location_notes, after_row.route_notes, after_row.employee_notes,
      after_row.service_key, after_row.service_name)
      IS DISTINCT FROM ROW(before_row.tenant_id, before_row.employee_id, before_row.client_id, before_row.assignment_date,
      before_row.planned_start_at, before_row.planned_end_at, before_row.title, before_row.address_snapshot,
      before_row.planning_status, before_row.description, before_row.location_notes, before_row.route_notes, before_row.employee_notes,
      before_row.service_key, before_row.service_name)
      OR ROW(coalesce(after_row.recurrence_json->>'pattern', 'none'), after_row.recurrence_json->'weekdays',
        after_row.recurrence_json->>'endDate', after_row.recurrence_json->'occurrenceCount',
        coalesce(after_row.recurrence_json->>'anchorDate', after_row.assignment_date::text),
        coalesce(after_row.recurrence_json->>'masterOccurrenceDate', after_row.assignment_date::text))
        IS DISTINCT FROM ROW(coalesce(before_row.recurrence_json->>'pattern', 'none'), before_row.recurrence_json->'weekdays',
        before_row.recurrence_json->>'endDate', before_row.recurrence_json->'occurrenceCount',
        coalesce(before_row.recurrence_json->>'anchorDate', before_row.assignment_date::text),
        coalesce(before_row.recurrence_json->>'masterOccurrenceDate', before_row.assignment_date::text))
      -- A detached date backed by a materialized visit is still planned. Only
      -- actual skipped dates affect the schedule and merit a change notice.
      OR (SELECT array_agg(d.value ORDER BY d.value)
        FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(after_row.recurrence_json->'detachedOccurrenceDates') = 'array'
          THEN after_row.recurrence_json->'detachedOccurrenceDates' ELSE '[]'::jsonb END) d
        WHERE NOT coalesce(after_row.recurrence_json->'materializedOccurrences', '{}'::jsonb) ? d.value)
        IS DISTINCT FROM (SELECT array_agg(d.value ORDER BY d.value)
        FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(before_row.recurrence_json->'detachedOccurrenceDates') = 'array'
          THEN before_row.recurrence_json->'detachedOccurrenceDates' ELSE '[]'::jsonb END) d
        WHERE NOT coalesce(before_row.recurrence_json->'materializedOccurrences', '{}'::jsonb) ? d.value)
      OR ((after_row.canonical_status IN ('cancelled', 'no_show')) IS DISTINCT FROM (before_row.canonical_status IN ('cancelled', 'no_show')))
      OR (before_row.canonical_status = 'completed' AND after_row.canonical_status IN ('planned', 'scheduled', 'confirmed'))
      OR (after_row.canonical_status IN ('planned', 'scheduled', 'confirmed')
          AND before_row.canonical_status IN ('planned', 'scheduled', 'confirmed')
          AND after_row.canonical_status IS DISTINCT FROM before_row.canonical_status);
    IF NOT relevant_change THEN RETURN NEW; END IF;
  END IF;

  -- At most two recipients. A previous assignee only sees the OLD appointment
  -- time and that it was removed, never the new assignee/client/time/address.
  FOR notice IN
    SELECT before_row.tenant_id AS tenant_id, before_row.employee_id AS employee_id, before_row.id AS visit_id,
      before_row.planned_start_at AS starts_at, before_row.planned_end_at AS ends_at,
      CASE WHEN TG_OP <> 'DELETE' AND new_cancelled
        AND after_row.employee_id IS NOT DISTINCT FROM before_row.employee_id
        AND after_row.tenant_id IS NOT DISTINCT FROM before_row.tenant_id THEN 'cancelled' ELSE 'removed' END AS change_kind
    WHERE TG_OP <> 'INSERT' AND old_visible AND
      (TG_OP = 'DELETE' OR after_row.tenant_id IS DISTINCT FROM before_row.tenant_id
       OR after_row.employee_id IS DISTINCT FROM before_row.employee_id OR new_cancelled)
    UNION ALL
    SELECT after_row.tenant_id, after_row.employee_id, after_row.id, after_row.planned_start_at, after_row.planned_end_at,
      CASE WHEN TG_OP = 'INSERT' OR NOT old_visible
        OR after_row.employee_id IS DISTINCT FROM before_row.employee_id
        OR after_row.tenant_id IS DISTINCT FROM before_row.tenant_id THEN 'created' ELSE 'changed' END
    WHERE TG_OP <> 'DELETE' AND new_visible
  LOOP
    appointment_label := 'Einsatz am ' || to_char(notice.starts_at AT TIME ZONE 'Europe/Berlin', 'DD.MM.YYYY, HH24:MI')
      || '–' || to_char(notice.ends_at AT TIME ZONE 'Europe/Berlin',
        CASE WHEN (notice.starts_at AT TIME ZONE 'Europe/Berlin')::date = (notice.ends_at AT TIME ZONE 'Europe/Berlin')::date
          THEN 'HH24:MI' ELSE 'DD.MM.YYYY, HH24:MI' END) || ' Uhr (Berliner Zeit). ';
    INSERT INTO public.office_notifications (
      tenant_id, recipient_employee_id, notification_type, title, body_preview, metadata
    ) VALUES (
      notice.tenant_id, notice.employee_id, 'appointment',
      CASE notice.change_kind
        WHEN 'created' THEN 'Neuer Einsatz'
        WHEN 'changed' THEN 'Einsatz geändert'
        WHEN 'cancelled' THEN 'Einsatz abgesagt'
        ELSE 'Einsatz entfällt für dich' END,
      appointment_label || CASE notice.change_kind
        WHEN 'created' THEN 'Du wurdest für einen Einsatz eingeplant. Bitte prüfe die aktuellen Angaben.'
        WHEN 'changed' THEN 'Deine Einsatzplanung wurde geändert. Bitte prüfe die aktuellen Angaben.'
        WHEN 'cancelled' THEN 'Dieser Einsatz wurde abgesagt und gehört nicht mehr zu deiner offenen Planung.'
        ELSE 'Dieser Einsatz ist dir nicht mehr zugeordnet. Bitte beachte deine aktuelle Planung.' END,
      jsonb_build_object('kind', 'assignment_change', 'changeKind', notice.change_kind,
        'visitId', notice.visit_id, 'plannedStartAt', notice.starts_at, 'plannedEndAt', notice.ends_at,
        'eventKey', notice.visit_id::text || ':' || txid_current()::text)
    )
    ON CONFLICT (tenant_id, recipient_employee_id, (metadata->>'eventKey'))
      WHERE notification_type = 'appointment' AND metadata->>'kind' = 'assignment_change'
    DO UPDATE SET
      title = CASE WHEN office_notifications.metadata->>'changeKind' = 'created'
        AND EXCLUDED.metadata->>'changeKind' = 'changed' THEN 'Neuer Einsatz' ELSE EXCLUDED.title END,
      body_preview = EXCLUDED.body_preview,
      metadata = CASE WHEN office_notifications.metadata->>'changeKind' = 'created'
        AND EXCLUDED.metadata->>'changeKind' = 'changed'
        THEN jsonb_set(EXCLUDED.metadata, '{changeKind}', '"created"'::jsonb) ELSE EXCLUDED.metadata END,
      is_read = false, read_at = NULL;
  END LOOP;
  -- Each committed transaction has a new event key. Repeated mirror writes in
  -- the SAME transaction coalesce to its final values and keep one notice ID.
  -- Rollback also rolls back the notices; no external delivery is triggered.
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_employee_assignment_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS employee_assignment_change_notice ON public.assist_visits;
CREATE TRIGGER employee_assignment_change_notice
  AFTER INSERT OR UPDATE OR DELETE ON public.assist_visits
  FOR EACH ROW EXECUTE FUNCTION public.notify_employee_assignment_change();

-- One bounded rollout summary per active portal employee, not one alert for
-- every historical visit. Only still-upcoming own active plans are counted.
-- Reapplying this patch cannot resurrect a previously acknowledged summary.
INSERT INTO public.office_notifications (
  tenant_id, recipient_employee_id, notification_type, title, body_preview, metadata
)
SELECT v.tenant_id, v.employee_id, 'appointment', 'Deine aktuelle Einsatzplanung',
  CASE WHEN count(*) = 1 THEN 'Es liegt ein bevorstehender Einsatz für dich vor. Bitte prüfe deinen Kalender.'
    ELSE 'Es liegen ' || count(*)::text || ' bevorstehende Einsätze für dich vor. Bitte prüfe deinen Kalender.' END,
  jsonb_build_object('kind', 'assignment_change', 'changeKind', 'current_plan',
    'upcomingCount', count(*), 'eventKey', 'current_plan:v1')
FROM public.assist_visits v
JOIN public.employees e ON e.id = v.employee_id AND e.tenant_id = v.tenant_id
JOIN public.clients c ON c.id = v.client_id AND c.tenant_id = v.tenant_id
WHERE v.planned_end_at > now()
  AND v.planning_status NOT IN ('draft', 'cancelled')
  AND v.canonical_status NOT IN ('cancelled', 'no_show', 'completed', 'finished', 'documentation_open', 'signature_open')
  AND EXISTS (SELECT 1 FROM public.employee_portal_accounts a
    WHERE a.tenant_id = v.tenant_id AND a.employee_id = v.employee_id AND a.status = 'active')
GROUP BY v.tenant_id, v.employee_id
ON CONFLICT (tenant_id, recipient_employee_id, (metadata->>'eventKey'))
  WHERE notification_type = 'appointment' AND metadata->>'kind' = 'assignment_change'
DO NOTHING;

COMMIT;
