import type { WorkflowStatus } from '../core/base';

export type PortalEmployeeProfile = {
  employeeId: string;
  displayName: string;
  avatarUrl: string | null;
  avatarUpdatedAt: string | null;
  jobTitle: string | null;
  jobTitleLabel: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  status: WorkflowStatus;
  teamName: string | null;
  departmentLabel: string | null;
  employmentTypeLabel: string | null;
  startDate: string | null;
  locationLabel: string | null;
  qualificationLabel: string | null;
  employeeNumber: string | null;
  weeklyHoursTarget: number | null;
  weeklyHoursLogged: number | null;
  upcomingShifts: number;
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
