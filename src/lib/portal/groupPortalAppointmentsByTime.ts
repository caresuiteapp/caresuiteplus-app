import type { PortalAppointmentItem } from '@/lib/portal/appointmentService';

export type PortalAppointmentTimeGroup = {
  key: 'upcoming' | 'past';
  label: string;
  items: PortalAppointmentItem[];
};

function sortUpcoming(a: PortalAppointmentItem, b: PortalAppointmentItem): number {
  return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
}

function sortPast(a: PortalAppointmentItem, b: PortalAppointmentItem): number {
  return new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime();
}

/** Splits portal appointments into upcoming and past sections (client + employee lists). */
export function groupPortalAppointmentsByTime(
  items: PortalAppointmentItem[],
  now: Date = new Date(),
): PortalAppointmentTimeGroup[] {
  const nowMs = now.getTime();
  const upcoming = items.filter((item) => new Date(item.startsAt).getTime() >= nowMs).sort(sortUpcoming);
  const past = items.filter((item) => new Date(item.startsAt).getTime() < nowMs).sort(sortPast);

  const groups: PortalAppointmentTimeGroup[] = [];
  if (upcoming.length > 0) {
    groups.push({ key: 'upcoming', label: 'Kommende Einsätze', items: upcoming });
  }
  if (past.length > 0) {
    groups.push({ key: 'past', label: 'Vergangene Einsätze', items: past });
  }
  return groups;
}
