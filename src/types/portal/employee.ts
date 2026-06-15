import type { WorkflowStatus } from '../core/base';

export type PortalEmployeeProfile = {
  employeeId: string;
  displayName: string;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  status: WorkflowStatus;
  teamName: string;
  weeklyHoursTarget: number;
  weeklyHoursLogged: number;
  upcomingShifts: number;
  openRequests: number;
};

export type PortalTimesheetEntry = {
  id: string;
  date: string;
  assignmentTitle: string;
  clientName: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  status: WorkflowStatus;
};

export type PortalAppointmentDetail = {
  id: string;
  assignmentId: string | null;
  title: string;
  startsAt: string;
  endsAt: string;
  status: WorkflowStatus;
  location: string | null;
  clientId: string;
  clientName: string;
  clientPhone: string | null;
  notes: string | null;
  tasks: string[];
  canStartExecution: boolean;
  executionRoute: string | null;
};
