import type {
  ActivityType,
  CostCenter,
  TenantTimeTrackingSettings,
  TimeActivityEvent,
  TimeAuditLogEntry,
  TimeCorrectionRequest,
  TimeEntry,
  TimeInactivityCheck,
  TimeWarning,
  TimeWorkday,
  WorkOrganization,
  WorkProject,
} from '@/types/modules/timeTracking';

type Store = {
  settings: Map<string, TenantTimeTrackingSettings>;
  organizations: Map<string, WorkOrganization>;
  costCenters: Map<string, CostCenter>;
  projects: Map<string, WorkProject>;
  activityTypes: Map<string, ActivityType>;
  workdays: Map<string, TimeWorkday>;
  entries: Map<string, TimeEntry>;
  activityEvents: Map<string, TimeActivityEvent>;
  inactivityChecks: Map<string, TimeInactivityCheck>;
  warnings: Map<string, TimeWarning>;
  corrections: Map<string, TimeCorrectionRequest>;
  auditLogs: TimeAuditLogEntry[];
  activeSessions: Map<string, { tenantId: string; userId: string; sessionId: string; updatedAt: string }>;
};

const STORE: Store = {
  settings: new Map(),
  organizations: new Map(),
  costCenters: new Map(),
  projects: new Map(),
  activityTypes: new Map(),
  workdays: new Map(),
  entries: new Map(),
  activityEvents: new Map(),
  inactivityChecks: new Map(),
  warnings: new Map(),
  corrections: new Map(),
  auditLogs: [],
  activeSessions: new Map(),
};

let idCounter = 0;

export function nextTimeTrackingId(prefix = 'tt'): string {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

export function resetTimeTrackingStore(): void {
  STORE.settings.clear();
  STORE.organizations.clear();
  STORE.costCenters.clear();
  STORE.projects.clear();
  STORE.activityTypes.clear();
  STORE.workdays.clear();
  STORE.entries.clear();
  STORE.activityEvents.clear();
  STORE.inactivityChecks.clear();
  STORE.warnings.clear();
  STORE.corrections.clear();
  STORE.auditLogs.length = 0;
  STORE.activeSessions.clear();
  idCounter = 0;
}

export function getSettings(tenantId: string): TenantTimeTrackingSettings | null {
  return STORE.settings.get(tenantId) ?? null;
}

export function saveSettings(settings: TenantTimeTrackingSettings): void {
  STORE.settings.set(settings.tenantId, settings);
}

export function listOrganizations(tenantId: string): WorkOrganization[] {
  return [...STORE.organizations.values()].filter((o) => o.tenantId === tenantId && o.isActive);
}

export function listCostCenters(tenantId: string): CostCenter[] {
  return [...STORE.costCenters.values()].filter((c) => c.tenantId === tenantId && c.isActive);
}

export function listProjects(tenantId: string): WorkProject[] {
  return [...STORE.projects.values()].filter((p) => p.tenantId === tenantId && p.isActive);
}

export function listActivityTypes(tenantId: string): ActivityType[] {
  return [...STORE.activityTypes.values()].filter((a) => a.tenantId === tenantId && a.isActive);
}

export function saveOrganization(org: WorkOrganization): void {
  STORE.organizations.set(org.id, org);
}

export function saveCostCenter(cc: CostCenter): void {
  STORE.costCenters.set(cc.id, cc);
}

export function saveProject(project: WorkProject): void {
  STORE.projects.set(project.id, project);
}

export function saveActivityType(at: ActivityType): void {
  STORE.activityTypes.set(at.id, at);
}

export function getWorkday(id: string): TimeWorkday | null {
  return STORE.workdays.get(id) ?? null;
}

export function listWorkdays(tenantId: string, userId?: string): TimeWorkday[] {
  return [...STORE.workdays.values()]
    .filter((w) => w.tenantId === tenantId && (!userId || w.userId === userId))
    .sort((a, b) => b.workDate.localeCompare(a.workDate));
}

export function saveWorkday(workday: TimeWorkday): void {
  STORE.workdays.set(workday.id, workday);
}

export function getEntry(id: string): TimeEntry | null {
  return STORE.entries.get(id) ?? null;
}

export function listEntriesForWorkday(workdayId: string): TimeEntry[] {
  return [...STORE.entries.values()]
    .filter((e) => e.workdayId === workdayId)
    .sort((a, b) => a.blockIndex - b.blockIndex);
}

export function listEntries(tenantId: string, userId?: string): TimeEntry[] {
  return [...STORE.entries.values()].filter(
    (e) => e.tenantId === tenantId && (!userId || e.userId === userId),
  );
}

export function saveEntry(entry: TimeEntry): void {
  STORE.entries.set(entry.id, entry);
}

export function saveActivityEvent(event: TimeActivityEvent): void {
  STORE.activityEvents.set(event.id, event);
}

export function listActivityEvents(workdayId: string): TimeActivityEvent[] {
  return [...STORE.activityEvents.values()]
    .filter((e) => e.workdayId === workdayId)
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
}

export function listActivityEventsForTenant(tenantId: string): TimeActivityEvent[] {
  return [...STORE.activityEvents.values()].filter((e) => e.tenantId === tenantId);
}

export function saveInactivityCheck(check: TimeInactivityCheck): void {
  STORE.inactivityChecks.set(check.id, check);
}

export function listInactivityChecks(workdayId: string): TimeInactivityCheck[] {
  return [...STORE.inactivityChecks.values()]
    .filter((c) => c.workdayId === workdayId)
    .sort((a, b) => a.triggeredAt.localeCompare(b.triggeredAt));
}

export function saveWarning(warning: TimeWarning): void {
  STORE.warnings.set(warning.id, warning);
}

export function listWarnings(workdayId: string): TimeWarning[] {
  return [...STORE.warnings.values()].filter((w) => w.workdayId === workdayId);
}

export function listWarningsForTenant(tenantId: string): TimeWarning[] {
  return [...STORE.warnings.values()].filter((w) => w.tenantId === tenantId);
}

export function saveCorrection(correction: TimeCorrectionRequest): void {
  STORE.corrections.set(correction.id, correction);
}

export function listCorrections(tenantId: string, status?: string): TimeCorrectionRequest[] {
  return [...STORE.corrections.values()].filter(
    (c) => c.tenantId === tenantId && (!status || c.status === status),
  );
}

export function appendAuditLog(entry: TimeAuditLogEntry): void {
  STORE.auditLogs.push(entry);
}

export function listAuditLogs(tenantId: string, workdayId?: string): TimeAuditLogEntry[] {
  return STORE.auditLogs.filter(
    (l) => l.tenantId === tenantId && (!workdayId || l.workdayId === workdayId),
  );
}

export function getLastAuditHash(tenantId: string, workdayId?: string | null): string | null {
  const logs = listAuditLogs(tenantId, workdayId ?? undefined);
  if (logs.length === 0) return null;
  return logs[logs.length - 1]?.entryHash ?? null;
}

export function setActiveSession(tenantId: string, userId: string, sessionId: string): void {
  const key = `${tenantId}:${userId}`;
  STORE.activeSessions.set(key, { tenantId, userId, sessionId, updatedAt: new Date().toISOString() });
}

export function getActiveSession(tenantId: string, userId: string): string | null {
  const key = `${tenantId}:${userId}`;
  return STORE.activeSessions.get(key)?.sessionId ?? null;
}

export function clearActiveSession(tenantId: string, userId: string): void {
  STORE.activeSessions.delete(`${tenantId}:${userId}`);
}

export function findActiveWorkday(tenantId: string, userId: string): TimeWorkday | null {
  return (
    listWorkdays(tenantId, userId).find((w) => w.status === 'active' || w.status === 'paused') ?? null
  );
}

export function findWorkdayByDate(tenantId: string, userId: string, workDate: string): TimeWorkday | null {
  return listWorkdays(tenantId, userId).find((w) => w.workDate === workDate) ?? null;
}
