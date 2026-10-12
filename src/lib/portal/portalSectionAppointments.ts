import type { PortalAppointmentItem } from './appointmentService';
import { isPortalBegleitungService } from './portalBegleitungenFilter';
import { groupPortalAppointmentsByTime } from './groupPortalAppointmentsByTime';
import { remoteStatusToAssignment } from '@/lib/assist/assignmentStatusBridge';

export function selectPortalSectionAppointments(items: PortalAppointmentItem[], section: string): PortalAppointmentItem[] {
  return section === 'begleitungen' ? items.filter(isPortalBegleitungService) : items;
}

export function resolvePortalUpcomingCareTeam(items: PortalAppointmentItem[], now: Date = new Date()): { id: string; name: string }[] {
  const upcoming = groupPortalAppointmentsByTime(items, now).find((group) => group.key === 'upcoming')?.items ?? [];
  const team = new Map<string, { id: string; name: string }>();
  for (const item of upcoming) {
    if ((item.assignmentStatus ?? remoteStatusToAssignment(item.status)) === 'storniert') continue;
    const name = item.employeeName?.trim();
    if (!name) continue;
    const id = item.employeeId ?? name;
    if (!team.has(id)) team.set(id, { id, name });
  }
  return [...team.values()];
}
