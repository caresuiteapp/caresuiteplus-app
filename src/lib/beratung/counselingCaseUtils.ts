import type { WorkflowStatus } from '@/types/workflow/status';

export function isCaseOpen(status: WorkflowStatus): boolean {
  return status !== 'abgeschlossen' && status !== 'gesperrt';
}

export function isAppointmentUpcoming(nextAppointmentAt: string | null): boolean {
  if (!nextAppointmentAt) return false;
  return new Date(nextAppointmentAt) > new Date();
}

export function isCaseClosedThisMonth(closedAt: string | null): boolean {
  if (!closedAt) return false;
  const closed = new Date(closedAt);
  const now = new Date();
  return closed.getMonth() === now.getMonth() && closed.getFullYear() === now.getFullYear();
}
