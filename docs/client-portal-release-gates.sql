-- REVIEW DRAFT ONLY — not a migration, never applied to a Supabase project.
-- Generate a real migration with the Supabase CLI after reviewing the deployed
-- policy inventory, query plans and Database Advisors. Existing write policies
-- and internal/employee access are preserved; restrictive SELECT ceilings stop
-- other permissive policies from bypassing client release flags.
-- Reference: https://supabase.com/docs/guides/database/postgres/row-level-security
--
-- GPS release is not the whole privacy contract: the Data API still needs a
-- latest-position-only projection/RPC before release. These policies intentionally
-- do not claim to hide GPS history, employee_id or session internals. Client access
-- to raw history must be revoked when that projection is ready.
BEGIN;

DROP POLICY IF EXISTS client_budget_accounts_client_release_ceiling ON public.client_budget_accounts;
CREATE POLICY client_budget_accounts_client_release_ceiling ON public.client_budget_accounts
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
  COALESCE((SELECT public.current_role_key()), '') NOT IN ('client_portal', 'family_portal')
  OR (
    client_budget_accounts.tenant_id = (SELECT public.current_tenant_id())
    AND client_budget_accounts.client_id = (SELECT public.current_client_id())
    AND EXISTS (
      SELECT 1
      FROM public.tenant_client_portal_defaults defaults
      LEFT JOIN public.client_portal_settings settings
        ON settings.tenant_id = defaults.tenant_id
        AND settings.client_id = client_budget_accounts.client_id
      WHERE defaults.tenant_id = client_budget_accounts.tenant_id
        AND CASE WHEN settings.inherit_tenant_defaults IS FALSE
          THEN COALESCE(settings.portal_enabled, defaults.portal_enabled)
          ELSE defaults.portal_enabled END
        AND CASE WHEN settings.inherit_tenant_defaults IS FALSE
          THEN COALESCE(settings.show_budget, defaults.show_budget)
          ELSE defaults.show_budget END
    )
  )
);

DROP POLICY IF EXISTS client_care_entitlement_client_release_ceiling ON public.client_care_entitlement;
CREATE POLICY client_care_entitlement_client_release_ceiling ON public.client_care_entitlement
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
  COALESCE((SELECT public.current_role_key()), '') NOT IN ('client_portal', 'family_portal')
  OR (
    client_care_entitlement.tenant_id = (SELECT public.current_tenant_id())
    AND client_care_entitlement.client_id = (SELECT public.current_client_id())
    AND EXISTS (
      SELECT 1
      FROM public.tenant_client_portal_defaults defaults
      LEFT JOIN public.client_portal_settings settings
        ON settings.tenant_id = defaults.tenant_id
        AND settings.client_id = client_care_entitlement.client_id
      WHERE defaults.tenant_id = client_care_entitlement.tenant_id
        AND CASE WHEN settings.inherit_tenant_defaults IS FALSE
          THEN COALESCE(settings.portal_enabled, defaults.portal_enabled)
          ELSE defaults.portal_enabled END
        AND CASE WHEN settings.inherit_tenant_defaults IS FALSE
          THEN COALESCE(settings.show_budget, defaults.show_budget)
          ELSE defaults.show_budget END
    )
  )
);

DROP POLICY IF EXISTS client_service_entitlements_client_release_ceiling ON public.client_service_entitlements;
CREATE POLICY client_service_entitlements_client_release_ceiling ON public.client_service_entitlements
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
  COALESCE((SELECT public.current_role_key()), '') NOT IN ('client_portal', 'family_portal')
  OR (
    client_service_entitlements.tenant_id = (SELECT public.current_tenant_id())
    AND client_service_entitlements.client_id = (SELECT public.current_client_id())
    AND EXISTS (
      SELECT 1
      FROM public.tenant_client_portal_defaults defaults
      LEFT JOIN public.client_portal_settings settings
        ON settings.tenant_id = defaults.tenant_id
        AND settings.client_id = client_service_entitlements.client_id
      WHERE defaults.tenant_id = client_service_entitlements.tenant_id
        AND CASE WHEN settings.inherit_tenant_defaults IS FALSE
          THEN COALESCE(settings.portal_enabled, defaults.portal_enabled)
          ELSE defaults.portal_enabled END
        AND CASE WHEN settings.inherit_tenant_defaults IS FALSE
          THEN COALESCE(settings.show_budget, defaults.show_budget)
          ELSE defaults.show_budget END
    )
  )
);

DROP POLICY IF EXISTS client_funding_selections_client_release_ceiling ON public.client_funding_selections;
CREATE POLICY client_funding_selections_client_release_ceiling ON public.client_funding_selections
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
  COALESCE((SELECT public.current_role_key()), '') NOT IN ('client_portal', 'family_portal')
  OR (
    client_funding_selections.tenant_id = (SELECT public.current_tenant_id())
    AND client_funding_selections.client_id = (SELECT public.current_client_id())
    AND EXISTS (
      SELECT 1
      FROM public.tenant_client_portal_defaults defaults
      LEFT JOIN public.client_portal_settings settings
        ON settings.tenant_id = defaults.tenant_id
        AND settings.client_id = client_funding_selections.client_id
      WHERE defaults.tenant_id = client_funding_selections.tenant_id
        AND CASE WHEN settings.inherit_tenant_defaults IS FALSE
          THEN COALESCE(settings.portal_enabled, defaults.portal_enabled)
          ELSE defaults.portal_enabled END
        AND CASE WHEN settings.inherit_tenant_defaults IS FALSE
          THEN COALESCE(settings.show_budget, defaults.show_budget)
          ELSE defaults.show_budget END
    )
  )
);

DROP POLICY IF EXISTS portal_budget_snapshots_client_release_ceiling ON public.portal_budget_snapshots;
CREATE POLICY portal_budget_snapshots_client_release_ceiling ON public.portal_budget_snapshots
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
  COALESCE((SELECT public.current_role_key()), '') NOT IN ('client_portal', 'family_portal')
  OR (
    portal_budget_snapshots.tenant_id = (SELECT public.current_tenant_id())
    AND portal_budget_snapshots.client_id = (SELECT public.current_client_id())
    AND EXISTS (
      SELECT 1
      FROM public.tenant_client_portal_defaults defaults
      LEFT JOIN public.client_portal_settings settings
        ON settings.tenant_id = defaults.tenant_id
        AND settings.client_id = portal_budget_snapshots.client_id
      WHERE defaults.tenant_id = portal_budget_snapshots.tenant_id
        AND CASE WHEN settings.inherit_tenant_defaults IS FALSE
          THEN COALESCE(settings.portal_enabled, defaults.portal_enabled)
          ELSE defaults.portal_enabled END
        AND CASE WHEN settings.inherit_tenant_defaults IS FALSE
          THEN COALESCE(settings.show_budget, defaults.show_budget)
          ELSE defaults.show_budget END
    )
  )
);

DROP POLICY IF EXISTS assist_tracking_sessions_client_release_ceiling ON public.assist_tracking_sessions;
CREATE POLICY assist_tracking_sessions_client_release_ceiling ON public.assist_tracking_sessions
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
  COALESCE((SELECT public.current_role_key()), '') NOT IN ('client_portal', 'family_portal')
  OR (
    assist_tracking_sessions.tenant_id = (SELECT public.current_tenant_id())
    AND EXISTS (
      SELECT 1
      FROM public.assist_visits visit
      JOIN public.assignments assignment
        ON assignment.tenant_id = visit.tenant_id
        AND assignment.client_id = visit.client_id
        AND (assignment.id = visit.id OR assignment.id = visit.legacy_assignment_id)
      JOIN public.tenant_client_portal_defaults defaults ON defaults.tenant_id = visit.tenant_id
      LEFT JOIN public.client_portal_settings settings
        ON settings.tenant_id = visit.tenant_id AND settings.client_id = visit.client_id
      WHERE visit.tenant_id = assist_tracking_sessions.tenant_id
        AND visit.client_id = (SELECT public.current_client_id())
        AND (assist_tracking_sessions.visit_id = visit.id OR assist_tracking_sessions.visit_id = visit.legacy_assignment_id)
        AND visit.portal_release_enabled IS TRUE
        AND visit.planning_status <> 'draft'
        AND assignment.status::text IN ('on_the_way', 'arrived', 'started')
        AND CASE WHEN settings.inherit_tenant_defaults IS FALSE
          THEN COALESCE(settings.portal_enabled, defaults.portal_enabled)
          ELSE defaults.portal_enabled END
        AND CASE WHEN settings.inherit_tenant_defaults IS FALSE
          THEN COALESCE(settings.show_appointments, defaults.show_appointments)
          ELSE defaults.show_appointments END
    )
  )
);
-- Permit canonical visit IDs as well as legacy assignment IDs; the restrictive
-- ceiling also constrains existing broader own-assignment policies.
DROP POLICY IF EXISTS assist_tracking_sessions_client_released_visit_select ON public.assist_tracking_sessions;
CREATE POLICY assist_tracking_sessions_client_released_visit_select ON public.assist_tracking_sessions
  FOR SELECT TO authenticated
  USING (
  COALESCE((SELECT public.current_role_key()), '') IN ('client_portal', 'family_portal')
  AND (
    assist_tracking_sessions.tenant_id = (SELECT public.current_tenant_id())
    AND EXISTS (
      SELECT 1
      FROM public.assist_visits visit
      JOIN public.assignments assignment
        ON assignment.tenant_id = visit.tenant_id
        AND assignment.client_id = visit.client_id
        AND (assignment.id = visit.id OR assignment.id = visit.legacy_assignment_id)
      JOIN public.tenant_client_portal_defaults defaults ON defaults.tenant_id = visit.tenant_id
      LEFT JOIN public.client_portal_settings settings
        ON settings.tenant_id = visit.tenant_id AND settings.client_id = visit.client_id
      WHERE visit.tenant_id = assist_tracking_sessions.tenant_id
        AND visit.client_id = (SELECT public.current_client_id())
        AND (assist_tracking_sessions.visit_id = visit.id OR assist_tracking_sessions.visit_id = visit.legacy_assignment_id)
        AND visit.portal_release_enabled IS TRUE
        AND visit.planning_status <> 'draft'
        AND assignment.status::text IN ('on_the_way', 'arrived', 'started')
        AND CASE WHEN settings.inherit_tenant_defaults IS FALSE
          THEN COALESCE(settings.portal_enabled, defaults.portal_enabled)
          ELSE defaults.portal_enabled END
        AND CASE WHEN settings.inherit_tenant_defaults IS FALSE
          THEN COALESCE(settings.show_appointments, defaults.show_appointments)
          ELSE defaults.show_appointments END
    )
  )
);

DROP POLICY IF EXISTS assist_location_points_client_release_ceiling ON public.assist_location_points;
CREATE POLICY assist_location_points_client_release_ceiling ON public.assist_location_points
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
  COALESCE((SELECT public.current_role_key()), '') NOT IN ('client_portal', 'family_portal')
  OR (
    assist_location_points.tenant_id = (SELECT public.current_tenant_id())
    AND EXISTS (
      SELECT 1
      FROM public.assist_visits visit
      JOIN public.assignments assignment
        ON assignment.tenant_id = visit.tenant_id
        AND assignment.client_id = visit.client_id
        AND (assignment.id = visit.id OR assignment.id = visit.legacy_assignment_id)
      JOIN public.tenant_client_portal_defaults defaults ON defaults.tenant_id = visit.tenant_id
      LEFT JOIN public.client_portal_settings settings
        ON settings.tenant_id = visit.tenant_id AND settings.client_id = visit.client_id
      WHERE visit.tenant_id = assist_location_points.tenant_id
        AND visit.client_id = (SELECT public.current_client_id())
        AND (assist_location_points.visit_id = visit.id OR assist_location_points.visit_id = visit.legacy_assignment_id)
        AND visit.portal_release_enabled IS TRUE
        AND visit.planning_status <> 'draft'
        AND assignment.status::text IN ('on_the_way', 'arrived', 'started')
        AND CASE WHEN settings.inherit_tenant_defaults IS FALSE
          THEN COALESCE(settings.portal_enabled, defaults.portal_enabled)
          ELSE defaults.portal_enabled END
        AND CASE WHEN settings.inherit_tenant_defaults IS FALSE
          THEN COALESCE(settings.show_appointments, defaults.show_appointments)
          ELSE defaults.show_appointments END
    )
  )
);
-- Permit canonical visit IDs as well as legacy assignment IDs; the restrictive
-- ceiling also constrains existing broader own-assignment policies.
DROP POLICY IF EXISTS assist_location_points_client_released_visit_select ON public.assist_location_points;
CREATE POLICY assist_location_points_client_released_visit_select ON public.assist_location_points
  FOR SELECT TO authenticated
  USING (
  COALESCE((SELECT public.current_role_key()), '') IN ('client_portal', 'family_portal')
  AND (
    assist_location_points.tenant_id = (SELECT public.current_tenant_id())
    AND EXISTS (
      SELECT 1
      FROM public.assist_visits visit
      JOIN public.assignments assignment
        ON assignment.tenant_id = visit.tenant_id
        AND assignment.client_id = visit.client_id
        AND (assignment.id = visit.id OR assignment.id = visit.legacy_assignment_id)
      JOIN public.tenant_client_portal_defaults defaults ON defaults.tenant_id = visit.tenant_id
      LEFT JOIN public.client_portal_settings settings
        ON settings.tenant_id = visit.tenant_id AND settings.client_id = visit.client_id
      WHERE visit.tenant_id = assist_location_points.tenant_id
        AND visit.client_id = (SELECT public.current_client_id())
        AND (assist_location_points.visit_id = visit.id OR assist_location_points.visit_id = visit.legacy_assignment_id)
        AND visit.portal_release_enabled IS TRUE
        AND visit.planning_status <> 'draft'
        AND assignment.status::text IN ('on_the_way', 'arrived', 'started')
        AND CASE WHEN settings.inherit_tenant_defaults IS FALSE
          THEN COALESCE(settings.portal_enabled, defaults.portal_enabled)
          ELSE defaults.portal_enabled END
        AND CASE WHEN settings.inherit_tenant_defaults IS FALSE
          THEN COALESCE(settings.show_appointments, defaults.show_appointments)
          ELSE defaults.show_appointments END
    )
  )
);

COMMIT;

