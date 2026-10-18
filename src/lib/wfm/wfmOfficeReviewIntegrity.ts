import type { WfmOfficeTimeEntry } from '@/types/modules/wfmOfficeTimekeeping';
import type { WfmTimeEvent } from '@/types/modules/wfm';
import { coerceReferenceUuid, buildReferenceKey, type WfmTimeEntryReview } from './wfmTimeReviewService';

/** Occurrence IDs can contain colons; the work date always comes from the actual row. */
export function officeReviewIdentity(entry: WfmOfficeTimeEntry) {
  const entryKind: WfmTimeEntryReview['entryKind'] = entry.id.startsWith('session:') || entry.sessionId && !entry.id.startsWith('visit:') && !entry.id.startsWith('planned:')
    ? 'session' : entry.id.startsWith('visit:') || entry.id.startsWith('planned:') || entry.rowKind === 'planned_missing_actual' ? 'visit' : 'manual';
  const rawReferenceId = entryKind === 'session' ? entry.sessionId ?? entry.id.replace(/^session:/, '')
    : entryKind === 'visit' ? entry.visitId ?? entry.assignmentId ?? entry.id.replace(/^(visit|planned):/, '').replace(/:\d{4}-\d{2}-\d{2}$/, '') : entry.id;
  const referenceId = coerceReferenceUuid(rawReferenceId);
  return { employeeId: entry.employeeId, workDate: entry.workDate, entryKind, rawReferenceId, referenceId,
    referenceKey: buildReferenceKey(entry.tenantId, entry.employeeId, entry.workDate, entryKind, referenceId) };
}

export function confirmedOfficeReview(
  review: WfmTimeEntryReview,
  entry: WfmOfficeTimeEntry,
  decision: WfmTimeEntryReview['reviewStatus'],
  expectedSnapshot?: WfmOfficeTimeEntry,
): boolean {
  const identity = officeReviewIdentity(entry);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(review.id) || !review.updatedAt || !Number.isFinite(Date.parse(review.updatedAt))
    || review.tenantId !== entry.tenantId || review.employeeId !== entry.employeeId || review.workDate !== entry.workDate
    || review.entryKind !== identity.entryKind || review.referenceId !== identity.referenceId || review.referenceKey !== identity.referenceKey
    || review.reviewStatus !== decision) return false;
  if (!expectedSnapshot) return true;
  const saved = review.officeEntry;
  return Boolean(saved && saved.id === entry.id && saved.tenantId === entry.tenantId && saved.employeeId === entry.employeeId && saved.workDate === entry.workDate
    && Date.parse(saved.actualStartAt ?? '') === Date.parse(expectedSnapshot.actualStartAt ?? '')
    && Date.parse(saved.actualEndAt ?? '') === Date.parse(expectedSnapshot.actualEndAt ?? '')
    && saved.pauseMinutes === expectedSnapshot.pauseMinutes && saved.grossMinutes === expectedSnapshot.grossMinutes
    && saved.netMinutes === expectedSnapshot.netMinutes && saved.workKind === expectedSnapshot.workKind && saved.source === expectedSnapshot.source);
}

/** Attribute only the part of a recorded pause that overlaps this visit. */
export function officeVisitPauseMinutes(events: WfmTimeEvent[], startAt: string | null, endAt: string | null): number {
  const start = Date.parse(startAt ?? ''), end = Date.parse(endAt ?? '');
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  let pauseStart: number | null = null;
  let elapsed = 0;
  for (const event of [...events].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))) {
    const at = Date.parse(event.occurredAt);
    if (!Number.isFinite(at) || at > end) continue;
    if (event.eventType === 'pause_start' && pauseStart == null) pauseStart = at;
    if ((event.eventType === 'pause_end' || event.eventType === 'clock_out') && pauseStart != null) {
      elapsed += Math.max(0, Math.min(at, end) - Math.max(pauseStart, start));
      pauseStart = null;
    }
  }
  if (pauseStart != null) elapsed += Math.max(0, end - Math.max(pauseStart, start));
  return Math.min(Math.round((end - start) / 60000), Math.round(elapsed / 60000));
}
