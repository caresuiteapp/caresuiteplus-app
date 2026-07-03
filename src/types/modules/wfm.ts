/** WFM — zentrale Workforce-Zeiterfassung (Migration 0190) */

export type WfmEventType =
  | 'clock_in'
  | 'clock_out'
  | 'pause_start'
  | 'pause_end'
  | 'homeoffice_start'
  | 'homeoffice_end'
  | 'office_check_in'
  | 'office_check_out'
  | 'visit_drive_start'
  | 'visit_arrived'
  | 'visit_started'
  | 'visit_ended'
  | 'visit_paused'
  | 'mode_switch'
  | 'correction'
  | 'manual_booking'
  | 'standby_start'
  | 'standby_end'
  | 'training_start'
  | 'training_end'
  | 'meeting_start'
  | 'meeting_end'
  | 'travel_start'
  | 'travel_end';

export type WfmWorkMode =
  | 'field'
  | 'office'
  | 'homeoffice'
  | 'hybrid'
  | 'standby'
  | 'training'
  | 'travel'
  | 'none';

export type WfmSessionStatus =
  | 'offline'
  | 'clocked_in'
  | 'paused'
  | 'on_visit'
  | 'driving'
  | 'homeoffice'
  | 'office'
  | 'standby'
  | 'training'
  | 'ended';

export type WfmDisplayStatus =
  | 'im_einsatz'
  | 'buero'
  | 'homeoffice'
  | 'pause'
  | 'unterwegs'
  | 'feierabend'
  | 'krank'
  | 'urlaub'
  | 'offline';

export type WfmEventSource = 'portal' | 'office' | 'assist' | 'system' | 'import' | 'correction';

export type WfmWorkTypeKey =
  | 'buero'
  | 'homeoffice'
  | 'einsatz'
  | 'pause'
  | 'bereitschaft'
  | 'fortbildung'
  | 'besprechung'
  | 'fahrt';

export interface WfmWorkType {
  key: WfmWorkTypeKey;
  label: string;
  startEventType: WfmEventType;
  workMode: WfmWorkMode;
  sessionStatus: WfmSessionStatus;
  displayStatus: WfmDisplayStatus;
}

export interface WfmWorkSession {
  id: string;
  tenantId: string;
  employeeId: string;
  userId: string | null;
  workDate: string;
  status: WfmSessionStatus;
  workMode: WfmWorkMode;
  displayStatus: WfmDisplayStatus | null;
  startedAt: string | null;
  endedAt: string | null;
  lastEventAt: string | null;
  grossMinutes: number;
  netMinutes: number;
  pauseMinutes: number;
  isOnline: boolean;
  locationLabel?: string | null;
  currentVisitId?: string | null;
}

export interface WfmTimeEvent {
  id: string;
  tenantId: string;
  employeeId: string;
  userId: string | null;
  eventType: WfmEventType;
  workMode: WfmWorkMode | null;
  source: WfmEventSource;
  occurredAt: string;
  sessionId: string | null;
  note: string | null;
}

export interface WfmTodayStatus {
  session: WfmWorkSession | null;
  events: WfmTimeEvent[];
  statusLabel: string;
  blockCount: number;
}

export type WfmAbsenceType =
  | 'vacation'
  | 'sick_leave'
  | 'child_sick_leave'
  | 'unpaid_leave'
  | 'training'
  | 'school'
  | 'maternity'
  | 'parental_leave'
  | 'special_leave'
  | 'business_trip'
  | 'public_holiday'
  | 'blocked_time'
  | 'other';

export type WfmAbsenceStatus =
  | 'requested'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'active'
  | 'completed';

export type WfmApprovalType =
  | 'vacation'
  | 'absence'
  | 'homeoffice'
  | 'time_correction'
  | 'shift_swap'
  | 'training';

export type WfmApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export type WfmTrafficLight = 'green' | 'yellow' | 'red';

export interface WfmAbsence {
  id: string;
  tenantId: string;
  employeeId: string;
  absenceType: WfmAbsenceType;
  status: WfmAbsenceStatus;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  requestedDays: number | null;
  employeeNote: string;
  internalNote: string;
  createdAt: string;
  updatedAt: string;
}

export interface WfmApproval {
  id: string;
  tenantId: string;
  employeeId: string;
  approvalType: WfmApprovalType;
  status: WfmApprovalStatus;
  referenceType: string | null;
  referenceId: string | null;
  requestedBy: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface WfmTimeAccount {
  id: string;
  tenantId: string;
  employeeId: string;
  periodYear: number;
  periodMonth: number;
  targetMinutes: number;
  actualMinutes: number;
  overtimeMinutes: number;
  undertimeMinutes: number;
  pauseMinutes: number;
  vacationDaysUsed: number;
  sickDays: number;
  trafficLight: WfmTrafficLight | null;
  isClosed: boolean;
}

export interface WfmLiveEmployeeRow {
  employeeId: string;
  employeeName: string;
  session: WfmWorkSession | null;
  statusLabel: string;
  locationLabel: string | null;
  lastEventAt: string | null;
}

export interface WfmVisitTimeRow {
  id: string;
  visitId: string;
  assignmentLabel: string;
  eventType: string;
  eventLabel: string;
  occurredAt: string;
  durationSeconds: number | null;
}

export interface WfmDrivingLogRow {
  id: string;
  visitId: string | null;
  purpose: string | null;
  startedAt: string | null;
  endedAt: string | null;
  distanceKm: number | null;
  startAddress: string | null;
  endAddress: string | null;
  status: string;
}

export const WFM_ABSENCE_TYPE_LABELS: Record<WfmAbsenceType, string> = {
  vacation: 'Urlaub',
  sick_leave: 'Krankheit',
  child_sick_leave: 'Kind krank',
  unpaid_leave: 'Unbezahlter Urlaub',
  training: 'Fortbildung',
  school: 'Schule',
  maternity: 'Mutterschutz',
  parental_leave: 'Elternzeit',
  special_leave: 'Sonderurlaub',
  business_trip: 'Dienstreise',
  public_holiday: 'Feiertag',
  blocked_time: 'Blockierte Zeit',
  other: 'Sonstige Abwesenheit',
};

export const WFM_ABSENCE_STATUS_LABELS: Record<WfmAbsenceStatus, string> = {
  requested: 'Beantragt',
  approved: 'Genehmigt',
  rejected: 'Abgelehnt',
  cancelled: 'Storniert',
  active: 'Aktiv',
  completed: 'Abgeschlossen',
};

/** Portal-facing status labels (ABSENCE.1) */
export const WFM_PORTAL_ABSENCE_STATUS_LABELS: Record<WfmAbsenceStatus, string> = {
  requested: 'Ausstehend',
  approved: 'Genehmigt',
  rejected: 'Abgelehnt',
  cancelled: 'Zurückgezogen',
  active: 'Aktiv',
  completed: 'Abgeschlossen',
};

export const WFM_APPROVAL_TYPE_LABELS: Record<WfmApprovalType, string> = {
  vacation: 'Urlaubsantrag',
  absence: 'Abwesenheit',
  homeoffice: 'Home Office',
  time_correction: 'Zeitkorrektur',
  shift_swap: 'Schichttausch',
  training: 'Fortbildung',
};
