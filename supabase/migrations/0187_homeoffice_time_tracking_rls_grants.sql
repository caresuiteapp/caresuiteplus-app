-- ==========================================================================
-- CareSuite+ — Migration 0187: Homeoffice time tracking RLS, grants, permissions
-- Completes 0161 after table rename (live repair path).
-- ==========================================================================

ALTER TABLE public.tenant_time_tracking_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_work_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_activity_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homeoffice_workdays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homeoffice_time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homeoffice_activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homeoffice_inactivity_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homeoffice_warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homeoffice_correction_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homeoffice_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS time_settings_select ON public.tenant_time_tracking_settings;
CREATE POLICY time_settings_select ON public.tenant_time_tracking_settings
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS time_settings_manage ON public.tenant_time_tracking_settings;
CREATE POLICY time_settings_manage ON public.tenant_time_tracking_settings
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (public.has_permission('time.settings.manage') OR public.is_tenant_admin())
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (public.has_permission('time.settings.manage') OR public.is_tenant_admin())
  );

DROP POLICY IF EXISTS time_catalogs_select ON public.tenant_work_organizations;
CREATE POLICY time_catalogs_select ON public.tenant_work_organizations
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS time_catalogs_manage_org ON public.tenant_work_organizations;
CREATE POLICY time_catalogs_manage_org ON public.tenant_work_organizations
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (public.has_permission('time.settings.manage') OR public.is_tenant_admin())
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (public.has_permission('time.settings.manage') OR public.is_tenant_admin())
  );

DROP POLICY IF EXISTS time_cost_centers_select ON public.tenant_cost_centers;
CREATE POLICY time_cost_centers_select ON public.tenant_cost_centers
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS time_cost_centers_manage ON public.tenant_cost_centers;
CREATE POLICY time_cost_centers_manage ON public.tenant_cost_centers
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (public.has_permission('time.settings.manage') OR public.is_tenant_admin())
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (public.has_permission('time.settings.manage') OR public.is_tenant_admin())
  );

DROP POLICY IF EXISTS time_projects_select ON public.tenant_projects;
CREATE POLICY time_projects_select ON public.tenant_projects
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS time_projects_manage ON public.tenant_projects;
CREATE POLICY time_projects_manage ON public.tenant_projects
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (public.has_permission('time.settings.manage') OR public.is_tenant_admin())
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (public.has_permission('time.settings.manage') OR public.is_tenant_admin())
  );

DROP POLICY IF EXISTS time_activity_types_select ON public.tenant_activity_types;
CREATE POLICY time_activity_types_select ON public.tenant_activity_types
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS time_activity_types_manage ON public.tenant_activity_types;
CREATE POLICY time_activity_types_manage ON public.tenant_activity_types
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (public.has_permission('time.settings.manage') OR public.is_tenant_admin())
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (public.has_permission('time.settings.manage') OR public.is_tenant_admin())
  );

DROP POLICY IF EXISTS time_workdays_select ON public.homeoffice_workdays;
CREATE POLICY time_workdays_select ON public.homeoffice_workdays
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      user_id = auth.uid()
      OR public.has_permission('time.tracking.team.view')
      OR public.has_permission('time.tracking.admin.view')
      OR public.has_permission('time.audit.view')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS time_workdays_insert ON public.homeoffice_workdays;
CREATE POLICY time_workdays_insert ON public.homeoffice_workdays
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND user_id = auth.uid()
    AND public.has_permission('time.tracking.own.start')
  );

DROP POLICY IF EXISTS time_workdays_update ON public.homeoffice_workdays;
CREATE POLICY time_workdays_update ON public.homeoffice_workdays
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      (user_id = auth.uid() AND (
        public.has_permission('time.tracking.own.pause')
        OR public.has_permission('time.tracking.own.resume')
        OR public.has_permission('time.tracking.own.switch')
        OR public.has_permission('time.tracking.own.close')
      ))
      OR public.has_permission('time.tracking.admin.correct')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS time_entries_select ON public.homeoffice_time_entries;
CREATE POLICY time_entries_select ON public.homeoffice_time_entries
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      user_id = auth.uid()
      OR public.has_permission('time.tracking.team.view')
      OR public.has_permission('time.tracking.admin.view')
      OR public.has_permission('time.audit.view')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS time_entries_insert ON public.homeoffice_time_entries;
CREATE POLICY time_entries_insert ON public.homeoffice_time_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND user_id = auth.uid()
    AND public.has_permission('time.tracking.own.start')
  );

DROP POLICY IF EXISTS time_entries_update ON public.homeoffice_time_entries;
CREATE POLICY time_entries_update ON public.homeoffice_time_entries
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      (user_id = auth.uid() AND (
        public.has_permission('time.tracking.own.pause')
        OR public.has_permission('time.tracking.own.resume')
        OR public.has_permission('time.tracking.own.switch')
        OR public.has_permission('time.tracking.own.close')
      ))
      OR public.has_permission('time.tracking.admin.correct')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS time_activity_events_select ON public.homeoffice_activity_events;
CREATE POLICY time_activity_events_select ON public.homeoffice_activity_events
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      user_id = auth.uid()
      OR public.has_permission('time.tracking.team.view')
      OR public.has_permission('time.audit.view')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS time_activity_events_insert ON public.homeoffice_activity_events;
CREATE POLICY time_activity_events_insert ON public.homeoffice_activity_events
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS time_inactivity_select ON public.homeoffice_inactivity_checks;
CREATE POLICY time_inactivity_select ON public.homeoffice_inactivity_checks
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      user_id = auth.uid()
      OR public.has_permission('time.tracking.team.view')
      OR public.has_permission('time.audit.view')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS time_inactivity_insert ON public.homeoffice_inactivity_checks;
CREATE POLICY time_inactivity_insert ON public.homeoffice_inactivity_checks
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() AND user_id = auth.uid());

DROP POLICY IF EXISTS time_inactivity_update ON public.homeoffice_inactivity_checks;
CREATE POLICY time_inactivity_update ON public.homeoffice_inactivity_checks
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND user_id = auth.uid());

DROP POLICY IF EXISTS time_warnings_select ON public.homeoffice_warnings;
CREATE POLICY time_warnings_select ON public.homeoffice_warnings
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      user_id = auth.uid()
      OR public.has_permission('time.tracking.team.view')
      OR public.has_permission('time.audit.view')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS time_warnings_insert ON public.homeoffice_warnings;
CREATE POLICY time_warnings_insert ON public.homeoffice_warnings
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS time_corrections_select ON public.homeoffice_correction_requests;
CREATE POLICY time_corrections_select ON public.homeoffice_correction_requests
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      requested_by = auth.uid()
      OR public.has_permission('time.tracking.admin.view')
      OR public.has_permission('time.audit.view')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS time_corrections_insert ON public.homeoffice_correction_requests;
CREATE POLICY time_corrections_insert ON public.homeoffice_correction_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND requested_by = auth.uid()
    AND public.has_permission('time.tracking.own.view')
  );

DROP POLICY IF EXISTS time_corrections_update ON public.homeoffice_correction_requests;
CREATE POLICY time_corrections_update ON public.homeoffice_correction_requests
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('time.tracking.admin.correct')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS time_audit_logs_select ON public.homeoffice_audit_logs;
CREATE POLICY time_audit_logs_select ON public.homeoffice_audit_logs
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('time.audit.view')
      OR public.has_permission('time.tracking.admin.view')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS time_audit_logs_insert ON public.homeoffice_audit_logs;
CREATE POLICY time_audit_logs_insert ON public.homeoffice_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

GRANT SELECT, INSERT, UPDATE ON public.tenant_time_tracking_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_work_organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_cost_centers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_projects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_activity_types TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.homeoffice_workdays TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.homeoffice_time_entries TO authenticated;
GRANT SELECT, INSERT ON public.homeoffice_activity_events TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.homeoffice_inactivity_checks TO authenticated;
GRANT SELECT, INSERT ON public.homeoffice_warnings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.homeoffice_correction_requests TO authenticated;
GRANT SELECT, INSERT ON public.homeoffice_audit_logs TO authenticated;

INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN (
  VALUES
    ('time.tracking.own.start'),
    ('time.tracking.own.pause'),
    ('time.tracking.own.resume'),
    ('time.tracking.own.switch'),
    ('time.tracking.own.close'),
    ('time.tracking.own.view'),
    ('time.tracking.team.view'),
    ('time.tracking.admin.view'),
    ('time.tracking.admin.correct'),
    ('time.tracking.admin.export'),
    ('time.audit.view'),
    ('time.settings.manage')
) AS p(key)
WHERE r.key IN ('business_admin', 'business_manager', 'owner', 'admin', 'management', 'geschaeftsfuehrung')
ON CONFLICT (role_id, permission_key) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN (
  VALUES
    ('time.tracking.own.start'),
    ('time.tracking.own.pause'),
    ('time.tracking.own.resume'),
    ('time.tracking.own.switch'),
    ('time.tracking.own.close'),
    ('time.tracking.own.view'),
    ('time.tracking.team.view'),
    ('time.tracking.admin.view'),
    ('time.tracking.admin.correct')
) AS p(key)
WHERE r.key IN ('office', 'team_lead', 'pdl', 'planning')
ON CONFLICT (role_id, permission_key) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN (
  VALUES
    ('time.tracking.own.start'),
    ('time.tracking.own.pause'),
    ('time.tracking.own.resume'),
    ('time.tracking.own.switch'),
    ('time.tracking.own.close'),
    ('time.tracking.own.view')
) AS p(key)
WHERE r.key IN ('nurse', 'caregiver', 'counselor', 'dispatch', 'employee_portal')
ON CONFLICT (role_id, permission_key) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN (
  VALUES
    ('time.tracking.team.view'),
    ('time.tracking.admin.view'),
    ('time.audit.view')
) AS p(key)
WHERE r.key IN ('billing')
ON CONFLICT (role_id, permission_key) DO NOTHING;
