-- ==========================================================================
-- 0268 — Repair Assist documentation/proof field mapping
--
-- Incident 2026-07-23:
-- Employee documentation was also copied into assist_visits.employee_notes
-- (Office label: "Hinweise für Mitarbeitende"). Proof generation then stored
-- the technical token "submitted" instead of the documentation text.
--
-- This migration repairs only documentation submitted on 2026-07-23
-- (Europe/Berlin), preserves unrelated employee hints, and invalidates stale
-- generated PDF pointers so the corrected proof is rendered again.
-- ==========================================================================

-- Restore the canonical legacy assignment documentation mirror.
WITH documentation_source AS (
  SELECT
    d.tenant_id,
    d.visit_id,
    v.legacy_assignment_id AS assignment_id,
    array_to_string(
      array_remove(
        ARRAY[
          NULLIF(btrim(d.short_description), ''),
          CASE
            WHEN NULLIF(btrim(d.special_notes), '') IS NOT NULL
              THEN 'Besonderheiten: ' || btrim(d.special_notes)
          END,
          CASE
            WHEN NULLIF(btrim(d.deviations), '') IS NOT NULL
              THEN 'Abweichungen: ' || btrim(d.deviations)
          END,
          CASE
            WHEN NULLIF(btrim(d.deviation_justification), '') IS NOT NULL
              THEN 'Begründung: ' || btrim(d.deviation_justification)
          END,
          CASE WHEN d.referral_required THEN 'Weiterleitung erforderlich.' END,
          CASE WHEN d.emergency_or_problem THEN 'Notfall/Problem gemeldet.' END
        ],
        NULL
      ),
      E'\n\n'
    ) AS documentation_text
  FROM public.assist_visit_documentation d
  JOIN public.assist_visits v
    ON v.tenant_id = d.tenant_id
   AND v.id = d.visit_id
  WHERE (d.submitted_at AT TIME ZONE 'Europe/Berlin')::date = DATE '2026-07-23'
)
UPDATE public.assignments a
SET
  documentation_notes = source.documentation_text,
  updated_at = NOW()
FROM documentation_source source
WHERE source.assignment_id IS NOT NULL
  AND a.tenant_id = source.tenant_id
  AND a.id = source.assignment_id
  AND NULLIF(btrim(source.documentation_text), '') IS NOT NULL
  AND (
    NULLIF(btrim(a.documentation_notes), '') IS NULL
    OR lower(btrim(a.documentation_notes)) IN ('submitted', 'complete', 'completed')
  );

-- Put the real documentation into already generated proof snapshots.
WITH documentation_source AS (
  SELECT
    d.tenant_id,
    d.visit_id,
    array_to_string(
      array_remove(
        ARRAY[
          NULLIF(btrim(d.short_description), ''),
          CASE
            WHEN NULLIF(btrim(d.special_notes), '') IS NOT NULL
              THEN 'Besonderheiten: ' || btrim(d.special_notes)
          END,
          CASE
            WHEN NULLIF(btrim(d.deviations), '') IS NOT NULL
              THEN 'Abweichungen: ' || btrim(d.deviations)
          END,
          CASE
            WHEN NULLIF(btrim(d.deviation_justification), '') IS NOT NULL
              THEN 'Begründung: ' || btrim(d.deviation_justification)
          END,
          CASE WHEN d.referral_required THEN 'Weiterleitung erforderlich.' END,
          CASE WHEN d.emergency_or_problem THEN 'Notfall/Problem gemeldet.' END
        ],
        NULL
      ),
      E'\n\n'
    ) AS documentation_text
  FROM public.assist_visit_documentation d
  WHERE (d.submitted_at AT TIME ZONE 'Europe/Berlin')::date = DATE '2026-07-23'
)
UPDATE public.assist_visit_proofs proof
SET
  payload_snapshot = jsonb_set(
    jsonb_set(
      COALESCE(proof.payload_snapshot, '{}'::jsonb),
      '{documentation}',
      to_jsonb(source.documentation_text),
      TRUE
    ),
    '{documentationNote}',
    to_jsonb(source.documentation_text),
    TRUE
  ),
  payload_hash = NULL,
  storage_path = NULL,
  pdf_storage_path = NULL,
  pdf_hash = NULL,
  metadata = COALESCE(proof.metadata, '{}'::jsonb) || jsonb_build_object(
    'documentationMappingRepair', '0268',
    'documentationMappingRepairedAt', NOW()
  ),
  updated_at = NOW()
FROM documentation_source source
WHERE proof.tenant_id = source.tenant_id
  AND proof.visit_id = source.visit_id
  AND NULLIF(btrim(source.documentation_text), '') IS NOT NULL
  AND (
    NULLIF(btrim(proof.payload_snapshot ->> 'documentationNote'), '') IS NULL
    OR lower(btrim(proof.payload_snapshot ->> 'documentationNote'))
      IN ('submitted', 'complete', 'completed')
  );

-- Remove only the incorrectly duplicated employee hint. Genuine hints remain.
WITH documentation_source AS (
  SELECT
    d.tenant_id,
    d.visit_id,
    array_to_string(
      array_remove(
        ARRAY[
          NULLIF(btrim(d.short_description), ''),
          CASE
            WHEN NULLIF(btrim(d.special_notes), '') IS NOT NULL
              THEN 'Besonderheiten: ' || btrim(d.special_notes)
          END,
          CASE
            WHEN NULLIF(btrim(d.deviations), '') IS NOT NULL
              THEN 'Abweichungen: ' || btrim(d.deviations)
          END,
          CASE
            WHEN NULLIF(btrim(d.deviation_justification), '') IS NOT NULL
              THEN 'Begründung: ' || btrim(d.deviation_justification)
          END,
          CASE WHEN d.referral_required THEN 'Weiterleitung erforderlich.' END,
          CASE WHEN d.emergency_or_problem THEN 'Notfall/Problem gemeldet.' END
        ],
        NULL
      ),
      E'\n\n'
    ) AS documentation_text
  FROM public.assist_visit_documentation d
  WHERE (d.submitted_at AT TIME ZONE 'Europe/Berlin')::date = DATE '2026-07-23'
)
UPDATE public.assist_visits visit
SET
  employee_notes = NULL,
  updated_at = NOW()
FROM documentation_source source
WHERE visit.tenant_id = source.tenant_id
  AND visit.id = source.visit_id
  AND NULLIF(btrim(source.documentation_text), '') IS NOT NULL
  AND btrim(visit.employee_notes) = btrim(source.documentation_text);

COMMENT ON COLUMN public.assist_visits.employee_notes IS
  'Hinweise für Mitarbeitende; darf keine Einsatzdokumentation enthalten.';
