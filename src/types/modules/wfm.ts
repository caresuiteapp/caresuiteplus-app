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
