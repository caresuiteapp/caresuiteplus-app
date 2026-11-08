import { remoteStatusToAssignment } from '@/lib/assist/assignmentStatusBridge';
import type { PortalAppointmentItem } from '@/lib/portal/appointmentService';
import { employeePortalHomeAppointmentTitle } from '@/lib/portal/portalHomeAppointment';

export function employeePortalAssignmentStatus(appointment: PortalAppointmentItem) {
  return appointment.assignmentStatus ?? remoteStatusToAssignment(appointment.status);
}

export function employeePortalAssignmentTitle(appointment: PortalAppointmentItem) {
  return appointment.id.startsWith('calendar:') ? appointment.title : employeePortalHomeAppointmentTitle(appointment);
}

const date = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
const weekday = new Intl.DateTimeFormat('de-DE', { weekday: 'short' });
const month = new Intl.DateTimeFormat('de-DE', { month: 'short' });
const clock = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });

export function employeePortalAssignmentSchedule(appointment: Pick<PortalAppointmentItem, 'startsAt' | 'endsAt'>) {
  const start = new Date(appointment.startsAt);
  const end = new Date(appointment.endsAt);
  const hasStart = Number.isFinite(start.getTime());
  const hasEnd = Number.isFinite(end.getTime());
  const sameDay = hasStart && hasEnd && start.toDateString() === end.toDateString();
  const minutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  return {
    date: hasStart ? date.format(start) : 'Datum offen',
    weekday: hasStart ? weekday.format(start) : '',
    day: hasStart ? String(start.getDate()).padStart(2, '0') : '',
    monthAndYear: hasStart ? `${month.format(start)} ${start.getFullYear()}` : '',
    time: hasStart && hasEnd ? `${clock.format(start)} – ${clock.format(end)}` : 'Uhrzeit offen',
    endDay: hasStart && hasEnd && !sameDay ? date.format(end) : null,
    duration: !hasStart || !hasEnd ? null : hours === 0
      ? `${minutes} Min.`
      : `${hours} Std.${remainder ? ` ${remainder} Min.` : ''}`,
  };
}
