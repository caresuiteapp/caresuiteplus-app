/** Prompt 73 — Arbeitszeit, Fahrzeit, Pausen, Lohnexport */

export type WorkTimeStatus =
  | 'draft'
  | 'calculated'
  | 'employee_review'
  | 'correction_requested'
  | 'corrected'
  | 'management_review'
  | 'approved'
  | 'exported'
  | 'locked'
  | 'rejected';

export const WORK_TIME_STATUS_LABELS: Record<WorkTimeStatus, string> = {
  draft: 'Entwurf',
  calculated: 'Berechnet',
  employee_review: 'MA-Prüfung',
  correction_requested: 'Korrektur angefragt',
  corrected: 'Korrigiert',
  management_review: 'Führungskraft-Prüfung',
  approved: 'Freigegeben',
  exported: 'Exportiert',
  locked: 'Gesperrt',
  rejected: 'Abgelehnt',
};

export type EmployeeTimeEntryType =
  | 'assignment_time'
  | 'travel_time'
  | 'break_time'
  | 'admin_time'
  | 'training_time'
  | 'sick_time'
  | 'vacation_time'
  | 'standby_time'
  | 'correction_time';

export const EMPLOYEE_TIME_ENTRY_TYPE_LABELS: Record<EmployeeTimeEntryType, string> = {
  assignment_time: 'Einsatzzeit',
  travel_time: 'Fahrzeit',
  break_time: 'Pause',
  admin_time: 'Verwaltung',
  training_time: 'Schulung',
  sick_time: 'Krankheit',
  vacation_time: 'Urlaub',
  standby_time: 'Bereitschaft',
  correction_time: 'Korrektur',
};

export type EmployeeTimePeriodKind = 'daily' | 'weekly' | 'monthly' | 'payroll_custom';

export type TimePlausibilityFlag =
  | 'missing_times'
  | 'implausible_duration'
  | 'implausible_pause'
  | 'implausible_travel'
  | 'future_timestamp'
  | 'end_before_start'
  | 'fake_timestamp'
  | 'open_pause';

export type AssignmentStatusTimes = {
  onTheWayAt: string | null;
  arrivedAt: string | null;
  startedAt: string | null;
  pausedAt: string | null;
  resumedAt: string | null;
  finishedAt: string | null;
  completedAt: string | null;
};

export type AssignmentPauseEvent = {
  id: string;
  tenantId: string;
  assignmentId: string;
  pauseStartAt: string;
  pauseEndAt: string | null;
  pauseDurationMinutes: number | null;
  pauseReason: string | null;
  source: 'assignment_execution' | 'manual';
  createdAt: string;
};

export type TravelTimeSource = {
  routeStartedAt: string | null;
  routeFinishedAt: string | null;
  estimatedTravelMinutes: number | null;
  actualTravelMinutes: number | null;
  distanceKm: number | null;
  source: 'route_provider' | 'manual' | 'status_times';
};

export type EmployeeTimeEntry = {
  id: string;
  tenantId: string;
  employeeId: string;
  assignmentId: string | null;
  entryType: EmployeeTimeEntryType;
  periodDate: string;
  startedAt: string | null;
  endedAt: string | null;
  grossMinutes: number;
  pauseMinutes: number;
  netMinutes: number;
  travelMinutes: number;
  paidMinutes: number;
  unpaidMinutes: number;
  plannedMinutes: number | null;
  deviationMinutes: number | null;
  status: WorkTimeStatus;
  plausibilityFlags: TimePlausibilityFlag[];
  traceReference: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EmployeeTimePeriod = {
  id: string;
  tenantId: string;
  employeeId: string;
  periodKind: EmployeeTimePeriodKind;
  periodStart: string;
  periodEnd: string;
  totalAssignmentMinutes: number;
  totalTravelMinutes: number;
  totalBreakMinutes: number;
  totalPaidMinutes: number;
  totalUnpaidMinutes: number;
  status: WorkTimeStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  exportedAt: string | null;
  lockedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EmployeeTimeCorrection = {
  id: string;
  tenantId: string;
  employeeId: string;
  timeEntryId: string;
  correctedStartAt: string | null;
  correctedEndAt: string | null;
  correctionReason: string;
  correctedBy: string;
  correctedAt: string;
  previousStatus: WorkTimeStatus;
  auditEventId: string;
};

export type TravelTimeEntry = {
  id: string;
  tenantId: string;
  employeeId: string;
  assignmentId: string | null;
  routeStartedAt: string | null;
  routeFinishedAt: string | null;
  estimatedTravelMinutes: number | null;
  actualTravelMinutes: number | null;
  distanceKm: number | null;
  countsAsWorkTime: boolean;
  kmBillable: boolean;
  source: TravelTimeSource['source'];
  traceReference: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EmployeeMileageLogEntry = {
  id: string;
  tenantId: string;
  employeeId: string;
  assignmentId: string | null;
  travelTimeEntryId: string | null;
  tripDate: string;
  startAddress: string | null;
  endAddress: string | null;
  distanceKm: number | null;
  purposeCategory: string | null;
  serviceType: string | null;
  kmBillable: boolean;
  gpsCaptured: boolean;
  routeProviderUsed: boolean;
  source: 'manual' | 'route_calculation' | 'assignment_sync';
  status: 'prepared' | 'confirmed' | 'exported';
  createdAt: string;
  updatedAt: string;
};

export type PayrollExportStatus =
  | 'not_ready'
  | 'ready'
  | 'exported'
  | 'export_failed'
  | 'corrected_after_export'
  | 'locked';

export type PayrollProviderKey = 'datev' | 'lexware' | 'agenda' | 'csv' | 'generic';

export const PAYROLL_PROVIDER_LABELS: Record<PayrollProviderKey, string> = {
  datev: 'DATEV Lohn',
  lexware: 'Lexware Lohn',
  agenda: 'Agenda Lohn',
  csv: 'CSV-Export',
  generic: 'Generischer Export',
};

export type PayrollExportBatch = {
  id: string;
  tenantId: string;
  providerKey: PayrollProviderKey;
  exportFormat: 'csv' | 'datev' | 'lexware' | 'agenda' | 'generic';
  status: PayrollExportStatus;
  periodStart: string;
  periodEnd: string;
  employeeCount: number;
  itemCount: number;
  externalTransfer: boolean;
  preparedAt: string | null;
  exportedAt: string | null;
  lockedAt: string | null;
  errorSummary: string | null;
  initiatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PayrollExportItem = {
  id: string;
  tenantId: string;
  batchId: string;
  employeeId: string;
  periodId: string | null;
  timeEntryIds: string[];
  payloadReference: string;
  totalPaidMinutes: number;
  status: PayrollExportStatus;
  createdAt: string;
  updatedAt: string;
};

export type PayrollExportAuditEvent = {
  id: string;
  tenantId: string;
  batchId: string | null;
  action: string;
  actorId: string | null;
  summary: string;
  metadata?: Record<string, string>;
  createdAt: string;
};

export type EmployeeTimeAuditEvent = {
  id: string;
  tenantId: string;
  entityType:
    | 'employee_time_entry'
    | 'employee_time_period'
    | 'employee_time_correction'
    | 'payroll_export_batch';
  entityId: string;
  action: string;
  actorId: string | null;
  summary: string;
  metadata?: Record<string, string>;
  createdAt: string;
};

export type TenantWorkTimeSettings = {
  tenantId: string;
  countsTravelAsWorkTime: boolean;
  kmBillableByServiceType: Record<string, boolean>;
  routeProviderConfigured: boolean;
  payrollProviderConfigured: Partial<Record<PayrollProviderKey, boolean>>;
  updatedAt: string;
};

export type TimeCalculationInput = {
  tenantId: string;
  employeeId: string;
  assignmentId: string;
  plannedStartAt: string;
  plannedEndAt: string;
  plannedDurationMinutes: number;
  serviceType: string;
  statusTimes: AssignmentStatusTimes;
  pauseEvents: AssignmentPauseEvent[];
  travel?: TravelTimeSource | null;
  settings: TenantWorkTimeSettings;
};

export type TimeCalculationResult = {
  grossMinutes: number;
  pauseMinutes: number;
  netMinutes: number;
  travelMinutes: number;
  paidMinutes: number;
  unpaidMinutes: number;
  plannedMinutes: number;
  deviationMinutes: number;
  plausibilityFlags: TimePlausibilityFlag[];
  billable: boolean;
  traceReference: string;
};

export type EmployeeAbsenceBlock = {
  id: string;
  tenantId: string;
  employeeId: string;
  absenceType: 'vacation' | 'sick' | 'training' | 'blocked';
  startsAt: string;
  endsAt: string;
  note: string | null;
};

export type WorkTimeListView =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'open'
  | 'erroneous'
  | 'corrections'
  | 'approval'
  | 'export';
