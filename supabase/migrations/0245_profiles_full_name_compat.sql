-- ==========================================================================
-- CareSuite+ — Migration 0245: profiles.full_name compatibility
-- Auth bootstrap (tenantService PROFILE_SELECT) expects full_name on live DB.
-- Baseline 0001 had display_name only; 0198 added first_name/last_name.
-- Idempotent add + backfill for fresh DB, staging, and future production apply.
-- ==========================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name TEXT;

UPDATE public.profiles p
SET full_name = src.computed_name
FROM (
  SELECT
    id,
    NULLIF(
      trim(
        coalesce(
          NULLIF(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), ''),
          NULLIF(trim(display_name), ''),
          NULLIF(trim(email), '')
        )
      ),
      ''
    ) AS computed_name
  FROM public.profiles
) src
WHERE p.id = src.id
  AND src.computed_name IS NOT NULL
  AND (p.full_name IS NULL OR trim(p.full_name) = '');
