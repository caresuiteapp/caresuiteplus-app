/**
 * Recurring visit execution isolation — each occurrence must be executed independently.
 */
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import type { WorkflowStatus } from '@/types/core/base';
import {
  assignmentStatusToDimensions,
  dedupeStatusTransitionButtons,
  getVisitAllowedTransitions,
  isVisitIncomplete,
} from '@/lib/assist/visitWorkflow';
import type {
  VisitDispositionDetail,
  VisitDispositionListItem,
  VisitPlanningStatus,
  VisitRecurrenceJson,
} from '@/lib/assist/visitTypes';
import {
  parseVisitOccurrenceId,
  parseVisitRecurrenceJson,
  resolveVisitMasterId,
} from '@/lib/assist/visitRecurrenceExpansion';

/** Europe/Berlin cutoff for P0 series occurrence reset (YYYY-MM-DD). */
export const SERIES_OCCURRENCE_RESET_CUTOFF_DATE = '2026-07-07';

const EXECUTION_LIKE_ASSIGNMENT_STATUSES = new Set<AssignmentStatus>([
  'unterwegs',
  'angekommen',
  'gestartet',
  'pausiert',
  'beendet',
  'dokumentation_offen',
  'unterschrift_offen',
  'abgeschlossen',
]);

const EXECUTION_LIKE_WORKFLOW_STATUSES = new Set<WorkflowStatus>([
  'in_bearbeitung',
  'abgeschlossen',
]);

const SIGNED_PROOF_STATUSES = new Set(['signed', 'verified']);

export function dateKeyFromIso(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null;
  const key = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : null;
}

export function isVirtualRecurringOccurrenceId(id: string): boolean {
  return parseVisitOccurrenceId(id).occurrenceDate != null;
}

export function getMaterializedOccurrenceId(
  recurrence: VisitRecurrenceJson | Record<string, unknown> | null | undefined,
  occurrenceDate: string,
): string | null {
  const parsed = parseVisitRecurrenceJson(recurrence ?? { pattern: 'none' });
  const mapped = parsed.materializedOccurrences?.[occurrenceDate];
  return typeof mapped === 'string' && mapped.trim() ? mapped : null;
}

export function getDetachedOccurrenceDates(
  recurrence: VisitRecurrenceJson | Record<string, unknown> | null | undefined,
): string[] {
  const parsed = parseVisitRecurrenceJson(recurrence ?? { pattern: 'none' });
  return Array.isArray(parsed.detachedOccurrenceDates)
    ? parsed.detachedOccurrenceDates.filter((date): date is string => typeof date === 'string')
    : [];
}

export function isScheduledOnOrAfterCutoff(
  scheduledStart: string,
  cutoffDateKey: string = SERIES_OCCURRENCE_RESET_CUTOFF_DATE,
): boolean {
  const dateKey = dateKeyFromIso(scheduledStart);
  return Boolean(dateKey && dateKey >= cutoffDateKey);
}

export function hasSignedProofStatus(proofStatus: string | null | undefined): boolean {
  return SIGNED_PROOF_STATUSES.has(String(proofStatus ?? ''));
}

/** True when master execution snapshot must NOT be applied to this list/detail item. */
export function shouldIsolateOccurrenceExecution(input: { itemId: string }): boolean {
  return isVirtualRecurringOccurrenceId(input.itemId);
}

function defaultVirtualOccurrenceAssignmentStatus(
  detail: VisitDispositionDetail,
): AssignmentStatus {
  if (detail.planningStatus === 'draft') return 'geplant';
  return 'bestaetigt';
}

function defaultVirtualOccurrencePlanningStatus(
  planningStatus: VisitPlanningStatus = 'scheduled',
): VisitPlanningStatus {
  return planningStatus === 'draft' ? 'draft' : 'confirmed';
}

/** Workflow label for confirmed, not-yet-started occurrences. */
export function confirmedOccurrenceWorkflowStatus(): WorkflowStatus {
  return 'bestaetigt';
}

function assignmentStatusToWorkflowFilter(status: AssignmentStatus): WorkflowStatus {
  if (status === 'bestaetigt' || status === 'geplant') {
    return confirmedOccurrenceWorkflowStatus();
  }
  const map: Partial<Record<AssignmentStatus, WorkflowStatus>> = {
    geplant: 'entwurf',
    bestaetigt: 'bestaetigt',
    unterwegs: 'aktiv',
    angekommen: 'in_bearbeitung',
    gestartet: 'in_bearbeitung',
    pausiert: 'in_bearbeitung',
    beendet: 'in_bearbeitung',
    dokumentation_offen: 'in_bearbeitung',
    unterschrift_offen: 'in_bearbeitung',
    abgeschlossen: 'abgeschlossen',
    storniert: 'fehlerhaft',
    nicht_erschienen: 'fehlerhaft',
  };
  return map[status] ?? 'aktiv';
}

function openOccurrenceDimensions(planningStatus: VisitPlanningStatus = 'scheduled') {
  const assignmentStatus: AssignmentStatus = planningStatus === 'draft' ? 'geplant' : 'bestaetigt';
  return assignmentStatusToDimensions(assignmentStatus);
}

/**
 * True when a future list item still carries master execution/completion state
 * without signed proof (materialized rows or overlay leaks).
 */
export function shouldNeutralizeFutureListItem(item: VisitDispositionListItem): boolean {
  if (isVirtualRecurringOccurrenceId(item.id)) {
    return isScheduledOnOrAfterCutoff(item.scheduledStart);
  }

  if (!isScheduledOnOrAfterCutoff(item.scheduledStart)) return false;
  if (hasSignedProofStatus(item.proofStatus)) return false;

  return (
    item.status === 'abgeschlossen' ||
    item.assignmentStatus === 'abgeschlossen' ||
    EXECUTION_LIKE_ASSIGNMENT_STATUSES.has(item.assignmentStatus) ||
    EXECUTION_LIKE_WORKFLOW_STATUSES.has(item.status) ||
    (item.proofStatus !== 'none' && item.proofStatus !== 'pending') ||
    item.isIncomplete
  );
}

/** Strip master execution progress from a virtual series occurrence for display. */
export function resetVirtualOccurrenceExecutionState(
  detail: VisitDispositionDetail,
): VisitDispositionDetail {
  const planningStatus = defaultVirtualOccurrencePlanningStatus(detail.planningStatus);
  const assignmentStatus = defaultVirtualOccurrenceAssignmentStatus(detail);
  const dims = openOccurrenceDimensions(planningStatus);

  return {
    ...detail,
    assignmentStatus,
    status: assignmentStatusToWorkflowFilter(assignmentStatus),
    planningStatus: dims.planning,
    executionStatus: dims.execution,
    documentationStatus: dims.documentation,
    proofStatus: dims.proof,
    billingStatus: dims.billing,
    portalStatus: dims.portal,
    allowedStatusTransitions: dedupeStatusTransitionButtons(
      getVisitAllowedTransitions(assignmentStatus),
    ),
    tasks: detail.tasks.map((task) =>
      task.status === 'open' ? task : { ...task, status: 'open' as const, notDoneReason: null },
    ),
    employeeNotes: null,
    onTheWayAt: null,
    arrivedAt: null,
    finishedAt: null,
    actualStartAt: null,
    actualEndAt: null,
    isAtRisk: false,
    isIncomplete: false,
    persistedSignature: null,
  };
}

export function resetVirtualOccurrenceListItem(
  item: VisitDispositionListItem,
  planningStatus: VisitPlanningStatus = 'scheduled',
): VisitDispositionListItem {
  const normalizedPlanning = defaultVirtualOccurrencePlanningStatus(planningStatus);
  const assignmentStatus: AssignmentStatus =
    normalizedPlanning === 'draft' ? 'geplant' : 'bestaetigt';
  const dims = openOccurrenceDimensions(normalizedPlanning);

  return {
    ...item,
    assignmentStatus,
    status: assignmentStatusToWorkflowFilter(assignmentStatus),
    planningStatus: dims.planning,
    proofStatus: dims.proof,
    billingStatus: dims.billing,
    isAtRisk: false,
    isIncomplete: false,
  };
}

export function neutralizeFutureOccurrenceListItem(
  item: VisitDispositionListItem,
): VisitDispositionListItem {
  if (shouldIsolateOccurrenceExecution({ itemId: item.id })) {
    return resetVirtualOccurrenceListItem(item, item.planningStatus);
  }
  if (shouldNeutralizeFutureListItem(item)) {
    return resetVirtualOccurrenceListItem(item, item.planningStatus);
  }
  return item;
}

export function buildRecurrenceJsonWithMaterializedOccurrence(
  recurrence: VisitRecurrenceJson,
  occurrenceDate: string,
  materializedVisitId: string,
): VisitRecurrenceJson {
  const detached = new Set(getDetachedOccurrenceDates(recurrence));
  detached.add(occurrenceDate);

  return {
    ...recurrence,
    detachedOccurrenceDates: [...detached],
    materializedOccurrences: {
      ...(recurrence.materializedOccurrences ?? {}),
      [occurrenceDate]: materializedVisitId,
    },
  };
}

export function resolveOccurrenceAwareVisitId(rawId: string): {
  masterId: string;
  occurrenceDate: string | null;
} {
  const masterId = resolveVisitMasterId(rawId);
  const { occurrenceDate } = parseVisitOccurrenceId(rawId);
  return { masterId, occurrenceDate };
}
