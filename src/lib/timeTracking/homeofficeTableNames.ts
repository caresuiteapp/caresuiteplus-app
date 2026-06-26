/** Supabase table names for Homeoffice time tracking (migration 0161). */
export const HOMEOFFICE_TIME_TABLES = {
  settings: 'tenant_time_tracking_settings',
  organizations: 'tenant_work_organizations',
  costCenters: 'tenant_cost_centers',
  projects: 'tenant_projects',
  activityTypes: 'tenant_activity_types',
  workdays: 'homeoffice_workdays',
  entries: 'homeoffice_time_entries',
  activityEvents: 'homeoffice_activity_events',
  inactivityChecks: 'homeoffice_inactivity_checks',
  warnings: 'homeoffice_warnings',
  correctionRequests: 'homeoffice_correction_requests',
  auditLogs: 'homeoffice_audit_logs',
} as const;

/** Legacy Assist GPS time entries — do not use for Homeoffice module. */
export const ASSIST_GPS_TIME_ENTRIES_TABLE = 'time_entries' as const;
