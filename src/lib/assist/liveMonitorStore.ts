import type {
  CorrectionRequest,
  EmergencyReport,
  LiveOperationEvent,
  ManagementTask,
  MonitorAuditEvent,
  MonitorNotification,
  NotificationDelivery,
  NotificationPreference,
  ProblemReport,
} from '@/types/modules/liveMonitor';

export type LiveMonitorStore = {
  liveEvents: LiveOperationEvent[];
  auditEvents: MonitorAuditEvent[];
  notifications: MonitorNotification[];
  notificationPreferences: NotificationPreference[];
  notificationDeliveries: NotificationDelivery[];
  managementTasks: ManagementTask[];
  problemReports: ProblemReport[];
  emergencyReports: EmergencyReport[];
  correctionRequests: CorrectionRequest[];
};

export const LIVE_MONITOR_STORE: LiveMonitorStore = {
  liveEvents: [],
  auditEvents: [],
  notifications: [],
  notificationPreferences: [],
  notificationDeliveries: [],
  managementTasks: [],
  problemReports: [],
  emergencyReports: [],
  correctionRequests: [],
};

let liveEventCounter = 0;
let auditCounter = 0;
let notificationCounter = 0;
let deliveryCounter = 0;
let taskCounter = 0;
let problemCounter = 0;
let emergencyCounter = 0;
let correctionCounter = 0;

export function nextLiveEventId(): string {
  liveEventCounter += 1;
  return `live-ev-${liveEventCounter}`;
}

export function nextAuditId(): string {
  auditCounter += 1;
  return `mon-audit-${auditCounter}`;
}

export function nextNotificationId(): string {
  notificationCounter += 1;
  return `mon-notif-${notificationCounter}`;
}

export function nextDeliveryId(): string {
  deliveryCounter += 1;
  return `mon-del-${deliveryCounter}`;
}

export function nextTaskId(): string {
  taskCounter += 1;
  return `mgmt-task-${taskCounter}`;
}

export function nextProblemId(): string {
  problemCounter += 1;
  return `prob-${problemCounter}`;
}

export function nextEmergencyId(): string {
  emergencyCounter += 1;
  return `emerg-${emergencyCounter}`;
}

export function nextCorrectionId(): string {
  correctionCounter += 1;
  return `corr-${correctionCounter}`;
}

export function resetLiveMonitorStore(): void {
  LIVE_MONITOR_STORE.liveEvents.length = 0;
  LIVE_MONITOR_STORE.auditEvents.length = 0;
  LIVE_MONITOR_STORE.notifications.length = 0;
  LIVE_MONITOR_STORE.notificationPreferences.length = 0;
  LIVE_MONITOR_STORE.notificationDeliveries.length = 0;
  LIVE_MONITOR_STORE.managementTasks.length = 0;
  LIVE_MONITOR_STORE.problemReports.length = 0;
  LIVE_MONITOR_STORE.emergencyReports.length = 0;
  LIVE_MONITOR_STORE.correctionRequests.length = 0;
  liveEventCounter = 0;
  auditCounter = 0;
  notificationCounter = 0;
  deliveryCounter = 0;
  taskCounter = 0;
  problemCounter = 0;
  emergencyCounter = 0;
  correctionCounter = 0;
}

export function filterByTenant<T extends { tenantId: string }>(items: T[], tenantId: string): T[] {
  return items.filter((item) => item.tenantId === tenantId);
}
