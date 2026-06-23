import { OFFICE_NOTIFICATIONS_TABLE } from '@/lib/office/notificationtable';
import { subscribeToTenantTables, type RealtimeHandler, type TenantTableSpec } from './subscribeToTenantTables';

function tenantFilter(tenantId: string): string {
  return `tenant_id=eq.${tenantId}`;
}

function clientFilter(clientId: string): string {
  return `client_id=eq.${clientId}`;
}

function withTenantAndClient(tenantId: string, clientId: string): TenantTableSpec[] {
  const tenant = tenantFilter(tenantId);
  const client = clientFilter(clientId);
  return [
    { table: 'portal_requests', filter: client },
    { table: 'portal_activities', filter: client },
    { table: 'portal_uploads', filter: client },
    { table: 'client_documents', filter: client },
    { table: 'assignments', filter: client },
    { table: 'appointments', filter: tenant },
    { table: 'message_threads', filter: client },
  ];
}

/** Portal Assist overview, sidebar KPIs, open-request/activity modals. */
export function subscribeToPortalAssistChanges(
  tenantId: string,
  clientId: string,
  handler: RealtimeHandler,
): () => void {
  return subscribeToTenantTables(
    {
      subscriptionKey: `portal-assist:${tenantId}:${clientId}`,
      channelName: `portal:assist:${tenantId}:${clientId}`,
      specs: withTenantAndClient(tenantId, clientId),
    },
    handler,
  );
}

/** Office dashboard KPIs, timeline and workspace counts. */
export function subscribeToOfficeDashboardChanges(
  tenantId: string,
  handler: RealtimeHandler,
): () => void {
  const filter = tenantFilter(tenantId);
  return subscribeToTenantTables(
    {
      subscriptionKey: `office-dashboard:${tenantId}`,
      channelName: `office:dashboard:${tenantId}`,
      specs: [
        { table: 'clients', filter },
        { table: 'employees', filter },
        { table: 'invoices', filter },
        { table: 'appointments', filter },
        { table: 'assignments', filter },
        { table: 'audit_logs', filter },
      ],
    },
    handler,
  );
}

/** Notification bell — legacy `notifications` and `office_notifications`. */
export function subscribeToNotificationChanges(
  tenantId: string,
  handler: RealtimeHandler,
): () => void {
  const filter = tenantFilter(tenantId);
  return subscribeToTenantTables(
    {
      subscriptionKey: `notifications:${tenantId}`,
      channelName: `office:notifications:${tenantId}`,
      specs: [
        { table: 'notifications', filter },
        { table: OFFICE_NOTIFICATIONS_TABLE, filter },
      ],
    },
    handler,
  );
}

/** Klientenakte — client header, documents and related assignments. */
export function subscribeToClientRecordChanges(
  tenantId: string,
  clientId: string,
  handler: RealtimeHandler,
): () => void {
  const tenant = tenantFilter(tenantId);
  const client = clientFilter(clientId);
  return subscribeToTenantTables(
    {
      subscriptionKey: `client-record:${tenantId}:${clientId}`,
      channelName: `office:client:${tenantId}:${clientId}`,
      specs: [
        { table: 'clients', filter: `id=eq.${clientId}` },
        { table: 'client_documents', filter: client },
        { table: 'assignments', filter: client },
        { table: 'portal_requests', filter: client },
        { table: 'audit_logs', filter: tenant },
      ],
    },
    handler,
  );
}

/** Office client list and employee assignment lists. */
export function subscribeToAssignmentChanges(
  tenantId: string,
  handler: RealtimeHandler,
): () => void {
  return subscribeToTenantTables(
    {
      subscriptionKey: `assignments:${tenantId}`,
      channelName: `tenant:${tenantId}:assignments`,
      specs: [{ table: 'assignments', filter: tenantFilter(tenantId) }],
    },
    handler,
  );
}

/** Office Mitarbeitendenliste. */
export function subscribeToEmployeeListChanges(
  tenantId: string,
  handler: RealtimeHandler,
): () => void {
  return subscribeToTenantTables(
    {
      subscriptionKey: `employee-list:${tenantId}`,
      channelName: `office:employees:${tenantId}`,
      specs: [{ table: 'employees', filter: tenantFilter(tenantId) }],
    },
    handler,
  );
}

/** Mitarbeitenden-Detail (Stammdaten, Zeiterfassung). */
export function subscribeToEmployeeDetailChanges(
  tenantId: string,
  employeeId: string,
  handler: RealtimeHandler,
): () => void {
  const tenant = tenantFilter(tenantId);
  return subscribeToTenantTables(
    {
      subscriptionKey: `employee-detail:${tenantId}:${employeeId}`,
      channelName: `office:employee:${tenantId}:${employeeId}`,
      specs: [
        { table: 'employees', filter: `id=eq.${employeeId}` },
        { table: 'time_entries', filter: `employee_id=eq.${employeeId}` },
        { table: 'employee_absences', filter: tenant },
      ],
    },
    handler,
  );
}

/**
 * Assist Live-Betrieb: Einsätze, Zeiterfassung, Geo/Touren, Live-Events.
 * Für Live-Monitor, Einsatzlisten, Fahrten und Durchführung.
 */
export function subscribeToAssistOperationsChanges(
  tenantId: string,
  handler: RealtimeHandler,
): () => void {
  const filter = tenantFilter(tenantId);
  return subscribeToTenantTables(
    {
      subscriptionKey: `assist-ops:${tenantId}`,
      channelName: `assist:ops:${tenantId}`,
      demoPollMs: 15_000,
      specs: [
        { table: 'assignments', filter },
        { table: 'time_entries', filter },
        { table: 'trips', filter },
        { table: 'trip_gps_events', filter },
        { table: 'live_operation_events', filter },
        { table: 'assignment_executions', filter },
      ],
    },
    handler,
  );
}

/** Assist Live-Status — Standort-Sessions und Einsätze. */
export function subscribeToAssistLiveTrackingChanges(
  tenantId: string,
  handler: RealtimeHandler,
): () => void {
  const filter = tenantFilter(tenantId);
  return subscribeToTenantTables(
    {
      subscriptionKey: `assist-live-tracking:${tenantId}`,
      channelName: `assist:live-tracking:${tenantId}`,
      demoPollMs: 15_000,
      specs: [
        { table: 'assignments', filter },
        { table: 'assist_tracking_sessions', filter },
        { table: 'assist_location_points', filter },
        { table: 'assist_time_events', filter },
      ],
    },
    handler,
  );
}

/** Zeiterfassung — Personalbüro und Mitarbeiterportal. */
export function subscribeToTimeTrackingChanges(
  tenantId: string,
  handler: RealtimeHandler,
): () => void {
  return subscribeToTenantTables(
    {
      subscriptionKey: `time-tracking:${tenantId}`,
      channelName: `office:time:${tenantId}`,
      demoPollMs: 15_000,
      specs: [{ table: 'time_entries', filter: tenantFilter(tenantId) }],
    },
    handler,
  );
}

/** Office Klientenliste. */
export function subscribeToClientListChanges(
  tenantId: string,
  handler: RealtimeHandler,
): () => void {
  return subscribeToTenantTables(
    {
      subscriptionKey: `client-list:${tenantId}`,
      channelName: `office:clients:${tenantId}`,
      specs: [{ table: 'clients', filter: tenantFilter(tenantId) }],
    },
    handler,
  );
}
