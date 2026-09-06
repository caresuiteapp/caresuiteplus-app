import type { PortalAppointmentItem } from './appointmentService';
import { remoteStatusToAssignment } from '@/lib/assist/assignmentStatusBridge';

/** Explicit completion ends the employee work item, even if optional tasks remain. */
export function selectEmployeeOpenAssignments(items: PortalAppointmentItem[], employeeId: string) {
  return items.filter((item) => {
    const status = item.assignmentStatus ?? remoteStatusToAssignment(item.status);
    return item.employeeId === employeeId && !['abgeschlossen', 'storniert', 'nicht_erschienen'].includes(status);
  }).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
