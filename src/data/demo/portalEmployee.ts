import type { PortalEmployeeProfile, PortalTimesheetEntry } from '@/types/portal/employee';
import { demoEmployees } from './employees';

const TIMESHEET_SEEDS: Omit<PortalTimesheetEntry, 'id'>[] = [
  {
    date: '2026-06-09',
    assignmentTitle: 'Haushaltsführung',
    clientName: 'Ingrid Hoffmann',
    startTime: '09:00',
    endTime: '11:00',
    durationMinutes: 120,
    status: 'abgeschlossen',
  },
  {
    date: '2026-06-10',
    assignmentTitle: 'Spaziergang',
    clientName: 'Helga Schneider',
    startTime: '14:00',
    endTime: '15:30',
    durationMinutes: 90,
    status: 'abgeschlossen',
  },
  {
    date: '2026-06-11',
    assignmentTitle: 'Haushaltsführung',
    clientName: 'Ingrid Hoffmann',
    startTime: '10:00',
    endTime: '12:00',
    durationMinutes: 120,
    status: 'in_bearbeitung',
  },
];

export function getDemoEmployeeProfile(employeeId: string): PortalEmployeeProfile | null {
  const employee = demoEmployees.find((e) => e.id === employeeId);
  if (!employee) return null;

  return {
    employeeId: employee.id,
    displayName: `${employee.firstName} ${employee.lastName}`,
    avatarUrl: employee.avatarUrl ?? null,
    avatarUpdatedAt: null,
    jobTitle: employee.jobTitle,
    jobTitleLabel: employee.jobTitle,
    email: employee.email,
    phone: employee.phone,
    mobile: null,
    status: employee.status,
    teamName: 'Alltagsbegleitung Berlin',
    departmentLabel: 'Alltagsbegleitung Berlin',
    employmentTypeLabel: 'Vollzeit',
    startDate: null,
    locationLabel: 'Berlin',
    qualificationLabel: null,
    employeeNumber: null,
    weeklyHoursTarget: 38,
    weeklyHoursLogged: 12.5,
    upcomingShifts: 3,
  };
}

export function getDemoTimesheetEntries(employeeId: string): PortalTimesheetEntry[] {
  if (employeeId !== 'employee-003') return [];

  return TIMESHEET_SEEDS.map((entry, index) => ({
    id: `timesheet-${employeeId}-${index + 1}`,
    ...entry,
  }));
}
