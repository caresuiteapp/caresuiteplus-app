export {
  ensureTimeTrackingSettings,
  fetchTimeTrackingSettings,
  updateTimeTrackingSettings,
  fetchTimeTrackingCatalogs,
  upsertActivityType,
  upsertWorkOrganization,
  upsertCostCenter,
  upsertProject,
} from './timeTrackingSettingsService';

export {
  getCurrentWorkdayStatus,
  startWorkday,
  pauseWorkday,
  resumeWorkday,
  switchActivity,
  closeWorkday,
  listTeamWorkdays,
  markEntryUnclear,
  getWorkdayById,
  computeDayTrafficLight,
} from './timeTrackingWorkdayService';

export {
  triggerInactivityCheck,
  respondToInactivityCheck,
  shouldTriggerInactivityCheck,
  isInactivityResponseExpired,
  countInactivityChecksToday,
  shouldShowWarningModal,
  INACTIVITY_TRIGGER_MS,
  INACTIVITY_RESPONSE_MS,
} from './timeTrackingInactivityService';

export {
  requestTimeCorrection,
  reviewTimeCorrection,
  listTimeCorrectionRequests,
} from './timeTrackingCorrectionService';

export { writeTimeAuditLog, listTimeAuditLogs, verifyAuditChain } from './timeTrackingAuditService';

export { evaluateTrafficLight } from './timeTrackingAmpelService';

export {
  recordTimeActivityEvent,
  recordNavigationActivity,
  recordFormSaveActivity,
  getLastActivityTimestamp,
  resetActivityBridgeState,
} from './timeTrackingActivityBridge';

export {
  registerActiveSession,
  detectMultiTabConflict,
  syncMultiTabHeartbeat,
} from './timeTrackingMultiTabService';

export {
  recordIntegrationSignal,
  isIntegrationEnabled,
  handleOfflineReconnect,
} from './timeTrackingIntegrationSignals';

export {
  exportTimeTrackingSummary,
  fetchAuditDashboardSummary,
  buildEmployeeDashboardCards,
  buildWorkdayExportRows,
  serializeWorkdayExportCsv,
} from './timeTrackingExportService';

export { resetTimeTrackingStore } from './timeTrackingStore';
export { seedDemoTimeTrackingCatalog, resetDemoTimeTrackingSeedFlag } from './timeTrackingDemoSeed';

export const TIME_TRACKING_EMPLOYEE_ROUTE = '/business/office/time-tracking';
export const TIME_TRACKING_SETTINGS_ROUTE = '/business/office/settings/time-tracking';
export const TIME_TRACKING_AUDIT_ROUTE = '/business/office/time-tracking/audit';
export const TIME_TRACKING_PORTAL_ROUTE = '/portal/employee/arbeitszeit';
