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
): WfmOfficeTimeEntry[] {
  const plannedByKey = new Map<string, WfmOfficePlannedVisit>();
  for (const planned of plannedVisits) {
    plannedByKey.set(
      plannedVisitJoinKey(planned.employeeId, planned.assignmentId, planned.workDate),
      planned,
    );
  }

  const merged: WfmOfficeTimeEntry[] = [];
  const handledPlannedKeys = new Set<string>();

  for (const actual of actualEntries) {
    const joinKey = actualVisitJoinKey(actual);
    const planned = joinKey ? plannedByKey.get(joinKey) : undefined;

    if (planned) {
      handledPlannedKeys.add(joinKey!);
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

  for (const [key, planned] of plannedByKey.entries()) {
    if (handledPlannedKeys.has(key)) continue;
    const name = employeeNames.get(planned.employeeId) ?? `Mitarbeitende ${planned.employeeId.slice(0, 8)}`;
    merged.push(buildPlannedMissingEntry(planned, name));
  }

  merged.sort((a, b) => {
    const dateCmp = b.workDate.localeCompare(a.workDate);
    if (dateCmp !== 0) return dateCmp;
    const planA = a.plannedStartAt ?? a.actualStartAt ?? '';
    const planB = b.plannedStartAt ?? b.actualStartAt ?? '';
    return planB.localeCompare(planA);
  });

  return merged;
}
