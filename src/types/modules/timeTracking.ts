export type WorkdayStatus = 'draft' | 'active' | 'paused' | 'closed' | 'submitted';

export type TimeEntryStatus = 'active' | 'paused' | 'closed';

export type TimeActivityEventType =
  | 'navigation'
  | 'module_open'
  | 'form_save'
  | 'integration_signal'
  | 'workday_start'
  | 'workday_pause'
  | 'workday_resume'
  | 'activity_switch'
  | 'workday_close'
  | 'inactivity_prompt'
  | 'inactivity_response';

export type InactivityCheckStatus = 'pending' | 'responded' | 'timed_out' | 'unclear';

export type InactivityResponseAction = 'continue' | 'pause' | 'switch' | 'unclear';

export type TimeWarningType = 'inactivity_threshold' | 'unclear_time' | 'manual';

export type CorrectionRequestStatus = 'pending' | 'approved' | 'rejected';

export type TrafficLight = 'green' | 'yellow' | 'red';

export type ActivityTypeCategory =
  | 'office'
  | 'care_planning'
  | 'administration'
  | 'training'
  | 'other';

export type TenantTimeTrackingSettings = {
  id: string;
  tenantId: string;
  moduleEnabled: boolean;
  requirePrivacyConsent: boolean;
  inactivityTriggerMinutes: number;
  inactivityResponseMinutes: number;
  warningThresholdPerDay: number;
  allowManualCorrections: boolean;
  integrationMicrosoft: boolean;
  integrationGoogle: boolean;
  integrationPhoneMetadata: boolean;
  defaultActivityTypeId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkOrganization = {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
};

export type CostCenter = {
  id: string;
  tenantId: string;
  organizationId: string | null;
  code: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
};

export type WorkProject = {
  id: string;
  tenantId: string;
  costCenterId: string | null;
  code: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
};

export type ActivityType = {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  category: ActivityTypeCategory;
  isActive: boolean;
  sortOrder: number;
};

export type TimeWorkday = {
  id: string;
  tenantId: string;
  userId: string;
  employeeId: string | null;
  workDate: string;
  status: WorkdayStatus;
  startedAt: string | null;
  endedAt: string | null;
  privacyConsentAt: string | null;
  activeSessionId: string | null;
  closureNote: string | null;
  trafficLight: TrafficLight | null;
  createdAt: string;
  updatedAt: string;
};

export type TimeEntry = {
  id: string;
  tenantId: string;
  workdayId: string;
  userId: string;
  activityTypeId: string | null;
  organizationId: string | null;
  costCenterId: string | null;
  projectId: string | null;
  blockIndex: number;
  status: TimeEntryStatus;
  startedAt: string;
  endedAt: string | null;
  pauseStartedAt: string | null;
  netMinutes: number | null;
  note: string | null;
  isUnclear: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TimeActivityEvent = {
  id: string;
  tenantId: string;
  workdayId: string | null;
  userId: string;
  eventType: TimeActivityEventType;
  moduleKey: string | null;
  resourceId: string | null;
  occurredAt: string;
  metadata: Record<string, string | number | boolean | null>;
  createdAt: string;
};

export type TimeInactivityCheck = {
  id: string;
  tenantId: string;
  workdayId: string;
  userId: string;
  triggeredAt: string;
  respondedAt: string | null;
  status: InactivityCheckStatus;
  responseAction: InactivityResponseAction | null;
  createdAt: string;
};

export type TimeWarning = {
  id: string;
  tenantId: string;
  workdayId: string;
  userId: string;
  warningType: TimeWarningType;
  message: string;
  checkCount: number | null;
  acknowledged: boolean;
  createdAt: string;
};

export type TimeCorrectionRequest = {
  id: string;
  tenantId: string;
  workdayId: string;
  timeEntryId: string | null;
  requestedBy: string;
  status: CorrectionRequestStatus;
  reason: string;
  proposedStartedAt: string | null;
  proposedEndedAt: string | null;
  proposedActivityTypeId: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  counterEntryId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TimeAuditLogEntry = {
  id: string;
  tenantId: string;
  workdayId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  actorId: string | null;
  summary: string;
  metadata: Record<string, string | number | boolean | null>;
  prevHash: string | null;
  entryHash: string | null;
  createdAt: string;
};

export type StartWorkdayInput = {
  activityTypeId: string;
  organizationId?: string | null;
  costCenterId?: string | null;
  projectId?: string | null;
  privacyConsentAccepted?: boolean;
  sessionId?: string;
};

export type SwitchActivityInput = {
  activityTypeId: string;
  organizationId?: string | null;
  costCenterId?: string | null;
  projectId?: string | null;
  note?: string | null;
};

export type TimeTrackingDashboardCard = {
  id: string;
  label: string;
  value: string;
  route?: string;
  accentColor?: string;
};

export type AmpelEvaluation = {
  trafficLight: TrafficLight;
  reasons: string[];
  activityEventCount: number;
  inactivityCheckCount: number;
  unclearBlockCount: number;
  warningCount: number;
};
