import type {
  WfmOfficeActualDisplayStatus,
  WfmOfficePlanDisplayStatus,
  WfmOfficePlannedVisit,
  WfmOfficeTimeEntry,
  WfmOfficeTimeRowKind,
} from '@/types/modules/wfmOfficeTimekeeping';
import {
  combineDeviationAmpel,
  evaluateVisitTimeDeviation,
  shouldAutoPendingReview,
} from './wfmVisitDeviationAmpelService';
import { enrichOfficeTimeEntryDisplay } from './wfmOfficeTimeDisplayResolver';

export function plannedVisitJoinKey(employeeId: string, assignmentId: string, workDate: string): string {
  return `${employeeId}:${assignmentId}:${workDate}`;
}

export function actualVisitJoinKey(entry: WfmOfficeTimeEntry): string | null {
  const assignmentId = entry.assignmentId ?? entry.visitId;
  if (!assignmentId) return null;
  return plannedVisitJoinKey(entry.employeeId, assignmentId, entry.workDate);
}

/**
 * A recurring occurrence can exist more than once with different technical IDs
 * after retries or legacy materialisation. For Office timekeeping it is still
 * one planned visit when employee, client, date and planned time are identical.
 */
export function plannedVisitOccurrenceKey(planned: WfmOfficePlannedVisit): string {
  return [
    planned.tenantId,
    planned.employeeId,
    planned.workDate,
    planned.clientLabel?.trim().toLocaleLowerCase('de-DE') ?? '',
    planned.plannedStartAt ?? '',
    planned.plannedEndAt ?? '',
    planned.assignmentTitle?.trim().toLocaleLowerCase('de-DE') ?? '',
  ].join('|');
}

function plannedActualSignalScore(planned: WfmOfficePlannedVisit): number {
  return [
    planned.assignmentActualStartAt,
    planned.assignmentActualEndAt,
    planned.assignmentOnTheWayAt,
    planned.assignmentArrivedAt,
    planned.assignmentFinishedAt,
  ].filter(Boolean).length;
}

function preferPlannedVisit(
  current: WfmOfficePlannedVisit,
  candidate: WfmOfficePlannedVisit,
  actualReferenceIds: Set<string>,
): WfmOfficePlannedVisit {
  const currentLinked = actualReferenceIds.has(current.assignmentId) ||
    Boolean(current.visitId && actualReferenceIds.has(current.visitId));
  const candidateLinked = actualReferenceIds.has(candidate.assignmentId) ||
    Boolean(candidate.visitId && actualReferenceIds.has(candidate.visitId));
  if (candidateLinked !== currentLinked) return candidateLinked ? candidate : current;

  const currentSignals = plannedActualSignalScore(current);
  const candidateSignals = plannedActualSignalScore(candidate);
  if (candidateSignals !== currentSignals) return candidateSignals > currentSignals ? candidate : current;

  return candidate.assignmentId.localeCompare(current.assignmentId) < 0 ? candidate : current;
}

export function dedupePlannedVisits(
  plannedVisits: WfmOfficePlannedVisit[],
  actualEntries: WfmOfficeTimeEntry[] = [],
): WfmOfficePlannedVisit[] {
  const actualReferenceIds = new Set<string>();
  for (const actual of actualEntries) {
    if (actual.assignmentId) actualReferenceIds.add(actual.assignmentId);
    if (actual.visitId) actualReferenceIds.add(actual.visitId);
  }

  const byOccurrence = new Map<string, WfmOfficePlannedVisit>();
  for (const planned of plannedVisits) {
    const key = plannedVisitOccurrenceKey(planned);
    const current = byOccurrence.get(key);
    byOccurrence.set(
      key,
      current ? preferPlannedVisit(current, planned, actualReferenceIds) : planned,
    );
  }
  return [...byOccurrence.values()];
}

function actualEntryQuality(entry: WfmOfficeTimeEntry): number {
  let score = 0;
  if (entry.actualStartAt) score += 4;
  if (entry.actualEndAt) score += 4;
  if (entry.sessionId) score += 2;
  if (entry.source !== 'system') score += 1;
  return score;
}

function dedupeJoinedOccurrences(entries: WfmOfficeTimeEntry[]): WfmOfficeTimeEntry[] {
  const result: WfmOfficeTimeEntry[] = [];
  const indexByOccurrence = new Map<string, number>();

  for (const entry of entries) {
    if (!entry.assignmentId || (!entry.plannedStartAt && !entry.plannedEndAt)) {
      result.push(entry);
      continue;
    }
    const key = [
      entry.tenantId,
      entry.employeeId,
      entry.workDate,
      entry.clientLabel?.trim().toLocaleLowerCase('de-DE') ?? '',
      entry.plannedStartAt ?? '',
      entry.plannedEndAt ?? '',
      entry.assignmentTitle?.trim().toLocaleLowerCase('de-DE') ?? '',
    ].join('|');
    const existingIndex = indexByOccurrence.get(key);
    if (existingIndex == null) {
      indexByOccurrence.set(key, result.length);
      result.push(entry);
      continue;
    }
    if (actualEntryQuality(entry) > actualEntryQuality(result[existingIndex])) {
      result[existingIndex] = entry;
    }
  }
  return result;
}

function resolvePlanDisplayStatus(
  plannedStart: string | null,
  plannedEnd: string | null,
  hasPlannedVisit: boolean,
): WfmOfficePlanDisplayStatus {
  if (!hasPlannedVisit) return 'no_planned_visit';
  if (!plannedStart && !plannedEnd) return 'plan_missing';
  return 'planned';
}

function resolveActualDisplayStatus(
  actualStart: string | null,
  actualEnd: string | null,
): WfmOfficeActualDisplayStatus {
  if (!actualStart && !actualEnd) return 'not_captured';
  if (actualStart && actualEnd) return 'captured';
  return 'partial';
}

function computeAmpelFields(
  plannedStartAt: string | null,
  plannedEndAt: string | null,
  actualStartAt: string | null,
  actualEndAt: string | null,
): {
  startAmpel: WfmOfficeTimeEntry['startAmpel'];
  endAmpel: WfmOfficeTimeEntry['endAmpel'];
  overallAmpel: WfmOfficeTimeEntry['overallAmpel'];
  startDeviationMinutes: number | null;
  endDeviationMinutes: number | null;
} {
  const startEval = evaluateVisitTimeDeviation(plannedStartAt, actualStartAt, 'start');
  const endEval = evaluateVisitTimeDeviation(plannedEndAt, actualEndAt, 'end');

  const startAmpel =
    plannedStartAt && actualStartAt && !startEval.noPlannedTime ? startEval.ampel : null;
  const endAmpel = plannedEndAt && actualEndAt && !endEval.noPlannedTime ? endEval.ampel : null;

  return {
    startAmpel,
    endAmpel,
    overallAmpel: combineDeviationAmpel(startAmpel, endAmpel),
    startDeviationMinutes:
      plannedStartAt && actualStartAt ? startEval.deviationMinutes : null,
    endDeviationMinutes: plannedEndAt && actualEndAt ? endEval.deviationMinutes : null,
  };
}

function intervalMinutes(startAt: string, endAt: string): number {
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.round((end - start) / 60_000);
}

function intervalsOverlap(
  startAt: string,
  endAt: string,
  otherStartAt: string,
  otherEndAt: string,
): boolean {
  return new Date(startAt).getTime() < new Date(otherEndAt).getTime() &&
    new Date(endAt).getTime() > new Date(otherStartAt).getTime();
}

/**
 * Complete Assist actuals inside the green tolerance are authoritative time
 * records. They may be booked automatically when no other recorded interval
 * for the employee overlaps the visit.
 */
export function isPlannedVisitAutoBookable(
  planned: WfmOfficePlannedVisit,
  actualEntries: WfmOfficeTimeEntry[],
  now: Date = new Date(),
): boolean {
  const startAt = planned.assignmentActualStartAt ?? null;
  const endAt = planned.assignmentActualEndAt ?? null;
  if (!planned.plannedStartAt || !planned.plannedEndAt || !startAt || !endAt) return false;
  if (intervalMinutes(startAt, endAt) <= 0 || new Date(endAt).getTime() > now.getTime()) return false;

  const status = planned.assignmentStatus ?? '';
  if (!['beendet', 'dokumentation_offen', 'unterschrift_offen', 'abgeschlossen', 'completed'].includes(status)) {
    return false;
  }

  const ampel = computeAmpelFields(
    planned.plannedStartAt,
    planned.plannedEndAt,
    startAt,
    endAt,
  );
  if (ampel.startAmpel !== 'green' || ampel.endAmpel !== 'green') return false;

  return !actualEntries.some((entry) => {
    if (entry.employeeId !== planned.employeeId || !entry.actualStartAt || !entry.actualEndAt) {
      return false;
    }
    const sameReference =
      entry.assignmentId === planned.assignmentId ||
      entry.visitId === planned.visitId ||
      entry.visitId === planned.assignmentId;
    if (sameReference) return false;
    return intervalsOverlap(startAt, endAt, entry.actualStartAt, entry.actualEndAt);
  });
}

function enrichEntryWithJoinMeta(
  entry: WfmOfficeTimeEntry,
  rowKind: WfmOfficeTimeRowKind,
  hasPlannedVisit: boolean,
): WfmOfficeTimeEntry {
  const ampel = computeAmpelFields(
    entry.plannedStartAt,
    entry.plannedEndAt,
    entry.actualStartAt,
    entry.actualEndAt,
  );

  const planDisplayStatus = resolvePlanDisplayStatus(
    entry.plannedStartAt,
    entry.plannedEndAt,
    hasPlannedVisit,
  );
  const actualDisplayStatus = resolveActualDisplayStatus(entry.actualStartAt, entry.actualEndAt);

  const flags = [...(entry.flags ?? [])];
  if (rowKind === 'planned_missing_actual' && !flags.includes('missing_booking')) {
    flags.push('missing_booking');
  }
  if (rowKind === 'unplanned_actual' && !flags.includes('unplanned')) {
    flags.push('unplanned');
  }

  let reviewStatus = entry.reviewStatus;
  if (rowKind === 'planned_missing_actual' && reviewStatus === 'open') {
    reviewStatus = 'pending_review';
  }
  if (rowKind === 'unplanned_actual' && reviewStatus === 'open') {
    reviewStatus = 'pending_review';
  }

  return enrichOfficeTimeEntryDisplay({
    ...entry,
    rowKind,
    planDisplayStatus,
    actualDisplayStatus,
    startAmpel: ampel.startAmpel,
    endAmpel: ampel.endAmpel,
    overallAmpel: ampel.overallAmpel,
    startDeviationMinutes: ampel.startDeviationMinutes,
    endDeviationMinutes: ampel.endDeviationMinutes,
    reviewStatus,
    flags,
    status:
      reviewStatus === 'pending_review' && shouldAutoPendingReview(ampel.startAmpel, ampel.endAmpel)
        ? 'pending_review'
        : entry.status,
  });
}

function buildPlannedMissingEntry(
  planned: WfmOfficePlannedVisit,
  employeeName: string,
): WfmOfficeTimeEntry {
  const entry: WfmOfficeTimeEntry = {
    id: `planned:${planned.assignmentId}:${planned.workDate}`,
    tenantId: planned.tenantId,
    employeeId: planned.employeeId,
    employeeName,
    workDate: planned.workDate,
    assignmentId: planned.assignmentId,
    visitId: planned.visitId,
    clientLabel: planned.clientLabel,
    assignmentTitle: planned.assignmentTitle,
    assignmentStatus: planned.assignmentStatus,
    plannedStartAt: planned.plannedStartAt,
    plannedEndAt: planned.plannedEndAt,
    assignmentActualStartAt: planned.assignmentActualStartAt ?? null,
    assignmentActualEndAt: planned.assignmentActualEndAt ?? null,
    actualStartAt: null,
    actualEndAt: null,
    startDeviationMinutes: null,
    endDeviationMinutes: null,
    startAmpel: null,
    endAmpel: null,
    overallAmpel: null,
    startJustification: null,
    endJustification: null,
    startJustificationAt: null,
    endJustificationAt: null,
    pauseMinutes: 0,
    grossMinutes: 0,
    netMinutes: 0,
    travelMinutes: null,
    workKind: 'einsatz',
    status: 'pending_review',
    source: 'system',
    reviewStatus: 'pending_review',
    exportStatus: 'not_exported',
    sessionId: null,
    officeComment: null,
    hasOpenOfficeMessage: false,
    flags: ['missing_booking'],
  };
  return enrichEntryWithJoinMeta(entry, 'planned_missing_actual', true);
}

function buildUpcomingPlannedEntry(
  planned: WfmOfficePlannedVisit,
  employeeName: string,
): WfmOfficeTimeEntry {
  const entry: WfmOfficeTimeEntry = {
    id: `planned:${planned.assignmentId}:${planned.workDate}`,
    tenantId: planned.tenantId,
    employeeId: planned.employeeId,
    employeeName,
    workDate: planned.workDate,
    assignmentId: planned.assignmentId,
    visitId: planned.visitId,
    clientLabel: planned.clientLabel,
    assignmentTitle: planned.assignmentTitle,
    assignmentStatus: planned.assignmentStatus,
    plannedStartAt: planned.plannedStartAt,
    plannedEndAt: planned.plannedEndAt,
    assignmentActualStartAt: null,
    assignmentActualEndAt: null,
    actualStartAt: null,
    actualEndAt: null,
    startDeviationMinutes: null,
    endDeviationMinutes: null,
    startAmpel: null,
    endAmpel: null,
    overallAmpel: null,
    startJustification: null,
    endJustification: null,
    startJustificationAt: null,
    endJustificationAt: null,
    pauseMinutes: 0,
    grossMinutes: 0,
    netMinutes: 0,
    travelMinutes: null,
    workKind: 'einsatz',
    status: 'open',
    source: 'system',
    reviewStatus: 'open',
    exportStatus: 'not_exported',
    sessionId: null,
    officeComment: null,
    hasOpenOfficeMessage: false,
    flags: ['upcoming'],
  };
  return enrichEntryWithJoinMeta(entry, 'planned_upcoming', true);
}

function isPlannedVisitOverdue(
  planned: WfmOfficePlannedVisit,
  now: Date,
): boolean {
  if (planned.assignmentActualStartAt || planned.assignmentActualEndAt) return true;
  const deadline = planned.plannedEndAt
    ? new Date(planned.plannedEndAt)
    : new Date(`${planned.workDate}T23:59:59`);
  return Number.isFinite(deadline.getTime()) && deadline.getTime() < now.getTime();
}

function buildAutomaticAssignmentBooking(
  planned: WfmOfficePlannedVisit,
  employeeName: string,
): WfmOfficeTimeEntry {
  const actualStartAt = planned.assignmentActualStartAt!;
  const actualEndAt = planned.assignmentActualEndAt!;
  const minutes = intervalMinutes(actualStartAt, actualEndAt);
  const visitId = planned.visitId ?? planned.assignmentId;

  return enrichEntryWithJoinMeta({
    id: `visit:${visitId}:${planned.workDate}`,
    tenantId: planned.tenantId,
    employeeId: planned.employeeId,
    employeeName,
    workDate: planned.workDate,
    assignmentId: planned.assignmentId,
    visitId,
    clientLabel: planned.clientLabel,
    assignmentTitle: planned.assignmentTitle,
    assignmentStatus: planned.assignmentStatus,
    plannedStartAt: planned.plannedStartAt,
    plannedEndAt: planned.plannedEndAt,
    assignmentActualStartAt: actualStartAt,
    assignmentActualEndAt: actualEndAt,
    actualStartAt,
    actualEndAt,
    startDeviationMinutes: null,
    endDeviationMinutes: null,
    startAmpel: null,
    endAmpel: null,
    overallAmpel: null,
    startJustification: null,
    endJustification: null,
    startJustificationAt: null,
    endJustificationAt: null,
    pauseMinutes: 0,
    grossMinutes: minutes,
    netMinutes: minutes,
    travelMinutes: null,
    workKind: 'einsatz',
    status: 'approved',
    source: 'system',
    reviewStatus: 'approved',
    exportStatus: 'export_ready',
    sessionId: null,
    officeComment: 'Automatisch aus vollständigem Einsatz-Ist innerhalb der Toleranz gebucht.',
    hasOpenOfficeMessage: false,
    flags: ['auto_booked_from_assignment_actual'],
  }, 'planned_with_actual', true);
}

function mergePlannedIntoActual(
  actual: WfmOfficeTimeEntry,
  planned: WfmOfficePlannedVisit,
): WfmOfficeTimeEntry {
  const merged: WfmOfficeTimeEntry = {
    ...actual,
    assignmentId: actual.assignmentId ?? planned.assignmentId,
    visitId: actual.visitId ?? planned.visitId,
    clientLabel: actual.clientLabel ?? planned.clientLabel,
    assignmentTitle: actual.assignmentTitle ?? planned.assignmentTitle,
    assignmentStatus: actual.assignmentStatus ?? planned.assignmentStatus,
    plannedStartAt: actual.plannedStartAt ?? planned.plannedStartAt,
    plannedEndAt: actual.plannedEndAt ?? planned.plannedEndAt,
    assignmentActualStartAt:
      actual.assignmentActualStartAt ?? planned.assignmentActualStartAt ?? null,
    assignmentActualEndAt: actual.assignmentActualEndAt ?? planned.assignmentActualEndAt ?? null,
    workKind: actual.workKind === 'sonstige' ? 'einsatz' : actual.workKind,
  };
  const rowKind: WfmOfficeTimeRowKind =
    merged.source === 'manual_addition' || merged.workKind === 'nachtrag' || merged.workKind === 'korrektur'
      ? 'manual_entry'
      : 'planned_with_actual';
  return enrichEntryWithJoinMeta(merged, rowKind, true);
}

/**
 * ZEIT.3.1 — Merge geplante Einsätze mit Ist-Zeiten, Nachträgen und Session-Einträgen.
 */
export function joinOfficeTimekeepingData(
  plannedVisits: WfmOfficePlannedVisit[],
  actualEntries: WfmOfficeTimeEntry[],
  employeeNames: Map<string, string>,
  now: Date = new Date(),
): WfmOfficeTimeEntry[] {
  const uniquePlannedVisits = dedupePlannedVisits(plannedVisits, actualEntries);
  const canonicalByOccurrence = new Map(
    uniquePlannedVisits.map((planned) => [plannedVisitOccurrenceKey(planned), planned]),
  );
  const plannedByKey = new Map<string, WfmOfficePlannedVisit>();
  for (const planned of plannedVisits) {
    const canonical = canonicalByOccurrence.get(plannedVisitOccurrenceKey(planned)) ?? planned;
    plannedByKey.set(
      plannedVisitJoinKey(planned.employeeId, planned.assignmentId, planned.workDate),
      canonical,
    );
    if (planned.visitId) {
      plannedByKey.set(
        plannedVisitJoinKey(planned.employeeId, planned.visitId, planned.workDate),
        canonical,
      );
    }
  }

  const merged: WfmOfficeTimeEntry[] = [];
  const handledOccurrenceKeys = new Set<string>();

  for (const actual of actualEntries) {
    const joinKey = actualVisitJoinKey(actual);
    const planned = joinKey ? plannedByKey.get(joinKey) : undefined;

    if (planned) {
      handledOccurrenceKeys.add(plannedVisitOccurrenceKey(planned));
      merged.push(mergePlannedIntoActual(actual, planned));
      continue;
    }

    const isManual =
      actual.source === 'manual_addition' ||
      actual.source === 'correction' ||
      actual.workKind === 'nachtrag' ||
      actual.workKind === 'korrektur';

    if (isManual) {
      merged.push(enrichEntryWithJoinMeta({ ...actual, rowKind: 'manual_entry' }, 'manual_entry', false));
      continue;
    }

    const hasAssignment = Boolean(actual.assignmentId || actual.visitId);
    const rowKind: WfmOfficeTimeRowKind = hasAssignment ? 'session_only' : 'unplanned_actual';
    merged.push(enrichEntryWithJoinMeta(actual, rowKind, hasAssignment));
  }

  for (const planned of uniquePlannedVisits) {
    if (handledOccurrenceKeys.has(plannedVisitOccurrenceKey(planned))) continue;
    const name = employeeNames.get(planned.employeeId) ?? `Mitarbeitende ${planned.employeeId.slice(0, 8)}`;
    merged.push(
      isPlannedVisitAutoBookable(planned, actualEntries, now)
        ? buildAutomaticAssignmentBooking(planned, name)
        : isPlannedVisitOverdue(planned, now)
          ? buildPlannedMissingEntry(planned, name)
          : buildUpcomingPlannedEntry(planned, name),
    );
  }

  const deduped = dedupeJoinedOccurrences(merged);

  deduped.sort((a, b) => {
    const dateCmp = b.workDate.localeCompare(a.workDate);
    if (dateCmp !== 0) return dateCmp;
    const planA = a.plannedStartAt ?? a.actualStartAt ?? '';
    const planB = b.plannedStartAt ?? b.actualStartAt ?? '';
    return planB.localeCompare(planA);
  });

  return deduped;
}
