import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import type { PortalAppointmentItem } from './appointmentService';

const STATUS_PROGRESS: Record<AssignmentStatus, number> = {
  geplant: 10,
  bestaetigt: 20,
  unterwegs: 30,
  angekommen: 40,
  gestartet: 50,
  pausiert: 55,
  beendet: 60,
  dokumentation_offen: 70,
  unterschrift_offen: 80,
  abgeschlossen: 90,
  storniert: 100,
  nicht_erschienen: 100,
};

/**
 * Stable identity of one real appointment occurrence.
 *
 * A series occurrence keeps this identity when a formerly virtual occurrence
 * is materialized and receives a new database id. Independent one-time
 * appointments intentionally remain distinct, even when client and time match.
 */
export function employeePortalAppointmentIdentity(item: PortalAppointmentItem): string {
  if (item.seriesMasterId && item.seriesOccurrenceDate) {
    return `series|${item.seriesMasterId}|${item.seriesOccurrenceDate}`;
  }
  return `single|${item.id}`;
}

function appointmentPriority(item: PortalAppointmentItem): number {
  const statusScore = item.assignmentStatus ? STATUS_PROGRESS[item.assignmentStatus] : 0;
  const physicalOccurrenceScore = item.id.includes('::') ? 0 : 1_000;
  const canonicalStatusScore = item.assignmentStatus ? 100 : 0;
  const freshCacheScore = (item as PortalAppointmentItem & { cacheStale?: boolean }).cacheStale
    ? 0
    : 10_000;
  return freshCacheScore + physicalOccurrenceScore + canonicalStatusScore + statusScore;
}

/**
 * One card per real occurrence. Prefer a persisted occurrence and the furthest
 * known lifecycle state so a stale planned/active row cannot shadow completion.
 */
export function dedupePortalAppointmentOccurrences<T extends PortalAppointmentItem>(
  items: T[],
): T[] {
  const byOccurrence = new Map<string, T>();
  for (const item of items) {
    const key = employeePortalAppointmentIdentity(item);
    const current = byOccurrence.get(key);
    if (!current || appointmentPriority(item) > appointmentPriority(current)) {
      byOccurrence.set(key, item);
    }
  }
  return [...byOccurrence.values()];
}
