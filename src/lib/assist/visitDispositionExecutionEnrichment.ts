/**
 * Office disposition detail enrichment — merges portal execution truth from
 * assignments, assignment_tasks, assist_visit_execution_state, time events,
 * documentation and signatures when assist_visits snapshot is stale.
 */
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import { remoteStatusToAssignment } from '@/lib/assist/assignmentStatusBridge';
import { fetchTimeEventsForVisit } from '@/lib/assist/assistTrackingPersistenceService';
import { fetchValidVisitSignature } from '@/lib/assist/assistVisitSignaturePersistenceService';
import { calculateVisitTimes } from '@/features/assistWorkflow/calculateVisitTimes';
import {
  assignmentStatusToDimensions,
  dedupeStatusTransitionButtons,
  getVisitAllowedTransitions,
  isVisitIncomplete,
} from '@/lib/assist/visitWorkflow';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import type { VisitDispositionDetail, VisitTaskItem, VisitTaskStatus } from '@/lib/assist/visitTypes';
import type { VisitSignatureCapture } from '@/lib/assist/visitSignatureSessionStore';
import type { WorkflowStatus } from '@/types/core/base';

function assignmentStatusToWorkflowFilter(status: AssignmentStatus): WorkflowStatus {
  const map: Partial<Record<AssignmentStatus, WorkflowStatus>> = {
    geplant: 'entwurf',
    bestaetigt: 'aktiv',
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

const STATUS_PROGRESS: Record<AssignmentStatus, number> = {
  geplant: 0,
  bestaetigt: 1,
  unterwegs: 2,
  angekommen: 3,
  gestartet: 4,
  pausiert: 4,
  beendet: 5,
  dokumentation_offen: 6,
  unterschrift_offen: 7,
  abgeschlossen: 8,
  storniert: -1,
  nicht_erschienen: -1,
};

const WORKFLOW_TASK_TITLES = {
  startVisit: 'einsatz antreten',
  markOnWay: 'unterwegs markieren',
  markArrived: 'angekommen markieren',
  startService: 'einsatz starten',
  documentVisit: 'einsatz dokumentieren',
  generateProof: 'leistungsnachweis erzeugen',
  collectSignature: 'unterschrift einholen',
} as const;

function normalizeTaskTitle(title: string): string {
  return title.trim().toLowerCase();
}

function assignmentTaskStatusToVisit(status: string): VisitTaskStatus {
  if (status === 'done') return 'done';
  if (status === 'not_done') return 'not_possible';
  if (status === 'not_requested') return 'not_requested';
  if (status === 'cancelled') return 'cancelled';
  return 'open';
}

function visitTasksLookStale(tasks: VisitTaskItem[]): boolean {
  if (tasks.length === 0) return false;
  return tasks.every((task) => task.status === 'open');
}

function pickAdvancedStatus(
  current: AssignmentStatus,
  candidate: AssignmentStatus,
): AssignmentStatus {
  const currentRank = STATUS_PROGRESS[current] ?? 0;
  const candidateRank = STATUS_PROGRESS[candidate] ?? 0;
  return candidateRank > currentRank ? candidate : current;
}

function buildDocumentationText(row: {
  short_description?: string | null;
  special_notes?: string | null;
  deviations?: string | null;
  deviation_justification?: string | null;
  referral_required?: boolean | null;
  emergency_or_problem?: boolean | null;
}): string | null {
  const parts: string[] = [];
  const short = row.short_description?.trim();
  if (short) parts.push(short);
  const special = row.special_notes?.trim();
  if (special) parts.push(`Besonderheiten: ${special}`);
  const deviations = row.deviations?.trim();
  if (deviations) {
    parts.push(`Abweichungen: ${deviations}`);
    const justification = row.deviation_justification?.trim();
    if (justification) parts.push(`Begründung: ${justification}`);
  }
  if (row.referral_required) parts.push('Weiterleitung erforderlich.');
  if (row.emergency_or_problem) parts.push('Notfall/Problem gemeldet.');
  return parts.length > 0 ? parts.join('\n\n') : null;
}

type WorkflowTaskContext = {
  hasDriveStart: boolean;
  hasArrived: boolean;
  hasServiceStart: boolean;
  hasServiceEnd: boolean;
  hasDocumentation: boolean;
  hasSignature: boolean;
  hasProof: boolean;
};

function deriveWorkflowTaskStatus(
  title: string,
  ctx: WorkflowTaskContext,
): VisitTaskStatus | null {
  const normalized = normalizeTaskTitle(title);
  switch (normalized) {
    case WORKFLOW_TASK_TITLES.startVisit:
      return ctx.hasDriveStart || ctx.hasServiceStart || ctx.hasServiceEnd ? 'done' : null;
    case WORKFLOW_TASK_TITLES.markOnWay:
      return ctx.hasDriveStart ? 'done' : null;
    case WORKFLOW_TASK_TITLES.markArrived:
      return ctx.hasArrived ? 'done' : null;
    case WORKFLOW_TASK_TITLES.startService:
      return ctx.hasServiceStart ? 'done' : null;
    case WORKFLOW_TASK_TITLES.documentVisit:
      return ctx.hasDocumentation ? 'done' : null;
    case WORKFLOW_TASK_TITLES.generateProof:
      return ctx.hasProof ? 'done' : null;
    case WORKFLOW_TASK_TITLES.collectSignature:
      return ctx.hasSignature ? 'done' : null;
    default:
      return null;
  }
}

function applyWorkflowTaskOverrides(
  tasks: VisitTaskItem[],
  ctx: WorkflowTaskContext,
): VisitTaskItem[] {
  return tasks.map((task) => {
    const derived = deriveWorkflowTaskStatus(task.title, ctx);
    if (!derived || task.status === derived) return task;
    if (task.status !== 'open') return task;
    return { ...task, status: derived };
  });
}

function mapAssignmentTasks(
  rows: Array<{
    id: string;
    title: string;
    status: string;
    is_required?: boolean | null;
    not_done_reason?: string | null;
    sort_order?: number | null;
  }>,
): VisitTaskItem[] {
  return [...rows]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((row) => ({
      id: row.id,
      title: row.title,
      status: assignmentTaskStatusToVisit(row.status),
      isRequired: row.is_required ?? false,
      notDoneReason: row.not_done_reason ?? null,
    }));
}

export function mergeVisitDispositionWithExecution(input: {
  detail: VisitDispositionDetail;
  assignmentStatus: AssignmentStatus;
  assignmentTasks: VisitTaskItem[];
  documentationText: string | null;
  visitTimes: ReturnType<typeof calculateVisitTimes> | null;
  executionStateStatus: AssignmentStatus | null;
  hasSignature: boolean;
  hasProof: boolean;
  persistedSignature: VisitSignatureCapture | null;
  assignmentOnTheWayAt: string | null;
  assignmentArrivedAt: string | null;
  assignmentActualStartAt: string | null;
  assignmentActualEndAt: string | null;
  assignmentFinishedAt: string | null;
}): VisitDispositionDetail {
  const {
    detail,
    assignmentTasks,
    documentationText,
    visitTimes,
    hasSignature,
    hasProof,
    persistedSignature,
  } = input;

  let assignmentStatus = input.assignmentStatus;
  if (input.executionStateStatus) {
    assignmentStatus = pickAdvancedStatus(assignmentStatus, input.executionStateStatus);
  }
  assignmentStatus = pickAdvancedStatus(assignmentStatus, detail.assignmentStatus);

  const hasDocumentation = Boolean(documentationText?.trim());
  const workflowCtx: WorkflowTaskContext = {
    hasDriveStart: Boolean(visitTimes?.driveStartedAt),
    hasArrived: Boolean(visitTimes?.arrivedAt),
    hasServiceStart: Boolean(visitTimes?.serviceStartedAt),
    hasServiceEnd: Boolean(visitTimes?.serviceEndedAt),
    hasDocumentation,
    hasSignature,
    hasProof,
  };

  const baseTasks =
    assignmentTasks.length > 0 && (visitTasksLookStale(detail.tasks) || assignmentTasks.length >= detail.tasks.length)
      ? assignmentTasks
      : detail.tasks;
  const tasks = applyWorkflowTaskOverrides(baseTasks, workflowCtx);

  const dims = assignmentStatusToDimensions(assignmentStatus);
  if (hasDocumentation) {
    dims.documentation = 'complete';
  }
  if (hasSignature) {
    dims.proof = 'signed';
  } else if (hasDocumentation || assignmentStatus === 'beendet' || assignmentStatus === 'dokumentation_offen') {
    dims.proof = 'pending';
  }

  const onTheWayAt =
    visitTimes?.driveStartedAt ??
    input.assignmentOnTheWayAt ??
    detail.onTheWayAt;
  const arrivedAt =
    visitTimes?.arrivedAt ??
    input.assignmentArrivedAt ??
    detail.arrivedAt;
  const actualStartAt =
    visitTimes?.serviceStartedAt ??
    input.assignmentActualStartAt ??
    detail.actualStartAt;
  const actualEndAt =
    visitTimes?.serviceEndedAt ??
    input.assignmentActualEndAt ??
    detail.actualEndAt;
  const finishedAt = input.assignmentFinishedAt ?? actualEndAt ?? detail.finishedAt;

  const incomplete = isVisitIncomplete({
    documentationStatus: dims.documentation,
    proofStatus: dims.proof,
    executionStatus: dims.execution,
    isIncomplete: false,
  });

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
    tasks,
    employeeNotes: documentationText ?? detail.employeeNotes,
    notes: documentationText ?? detail.notes,
    onTheWayAt,
    arrivedAt,
    actualStartAt,
    actualEndAt,
    finishedAt,
    isIncomplete: incomplete,
    persistedSignature,
  };
}

/** Load portal execution data and merge into office visit disposition detail. */
export async function enrichVisitDispositionDetail(
  tenantId: string,
  detail: VisitDispositionDetail,
): Promise<VisitDispositionDetail> {
  const supabase = getSupabaseClient();
  if (!supabase) return detail;

  const visitId = detail.id;
  const assignmentId = visitId;

  const [
    assignmentResult,
    executionStateResult,
    documentationResult,
    timeEventsResult,
    signatureResult,
  ] = await Promise.all([
    fromUnknownTable(supabase, 'assignments')
      .select(
        'id, status, documentation_notes, on_the_way_at, arrived_at, finished_at, actual_start_at, actual_end_at, assignment_tasks(id, title, status, is_required, not_done_reason, sort_order)',
      )
      .eq('tenant_id', tenantId)
      .eq('id', assignmentId)
      .maybeSingle(),
    fromUnknownTable(supabase, 'assist_visit_execution_state')
      .select(
        'assignment_status, documentation_complete, signature_complete, proof_generated, travel_started_at, travel_ended_at, service_started_at, service_ended_at',
      )
      .eq('tenant_id', tenantId)
      .eq('visit_id', visitId)
      .maybeSingle(),
    fromUnknownTable(supabase, 'assist_visit_documentation')
      .select(
        'short_description, special_notes, deviations, deviation_justification, referral_required, emergency_or_problem',
      )
      .eq('tenant_id', tenantId)
      .eq('visit_id', visitId)
      .maybeSingle(),
    fetchTimeEventsForVisit(tenantId, visitId, 100),
    fetchValidVisitSignature(tenantId, visitId),
  ]);

  if (assignmentResult.error && !isSupabaseMissingTableError(assignmentResult.error)) {
    console.warn(
      '[visitDispositionExecutionEnrichment] assignments:',
      toGermanSupabaseError(assignmentResult.error),
    );
    return detail;
  }

  const assignmentRow = assignmentResult.data as {
    status?: string;
    documentation_notes?: string | null;
    on_the_way_at?: string | null;
    arrived_at?: string | null;
    finished_at?: string | null;
    actual_start_at?: string | null;
    actual_end_at?: string | null;
    assignment_tasks?: Array<{
      id: string;
      title: string;
      status: string;
      is_required?: boolean | null;
      not_done_reason?: string | null;
      sort_order?: number | null;
    }>;
  } | null;

  if (!assignmentRow) return detail;

  const assignmentStatus = remoteStatusToAssignment(assignmentRow.status);

  const executionState = executionStateResult.data as {
    assignment_status?: string;
    documentation_complete?: boolean;
    signature_complete?: boolean;
    proof_generated?: boolean;
    travel_started_at?: string | null;
    travel_ended_at?: string | null;
    service_started_at?: string | null;
    service_ended_at?: string | null;
  } | null;

  const documentationRow = documentationResult.data as {
    short_description?: string | null;
    special_notes?: string | null;
    deviations?: string | null;
    deviation_justification?: string | null;
    referral_required?: boolean | null;
    emergency_or_problem?: boolean | null;
  } | null;

  const documentationText =
    buildDocumentationText(documentationRow ?? {}) ??
    assignmentRow.documentation_notes?.trim() ??
    detail.employeeNotes?.trim() ??
    null;

  const executionStateStatus = executionState?.assignment_status
    ? remoteStatusToAssignment(executionState.assignment_status)
    : null;

  const timeEvents =
    timeEventsResult.ok && timeEventsResult.data.length
      ? timeEventsResult.data.map((event) => ({
          eventType: event.eventType,
          occurredAt: event.occurredAt,
        }))
      : [];

  const visitTimesFromEvents =
    timeEvents.length > 0
      ? calculateVisitTimes(timeEvents, assignmentStatus)
      : null;

  const visitTimes =
    visitTimesFromEvents ??
    (executionState
      ? calculateVisitTimes([], assignmentStatus, new Date())
      : null);

  if (executionState && visitTimes) {
    if (!visitTimes.driveStartedAt && executionState.travel_started_at) {
      visitTimes.driveStartedAt = executionState.travel_started_at;
    }
    if (!visitTimes.arrivedAt && executionState.travel_ended_at) {
      visitTimes.arrivedAt = executionState.travel_ended_at;
    }
    if (!visitTimes.serviceStartedAt && executionState.service_started_at) {
      visitTimes.serviceStartedAt = executionState.service_started_at;
    }
    if (!visitTimes.serviceEndedAt && executionState.service_ended_at) {
      visitTimes.serviceEndedAt = executionState.service_ended_at;
    }
  }

  const hasSignature =
    Boolean(signatureResult.ok && signatureResult.data) ||
    Boolean(executionState?.signature_complete);
  const hasProof = Boolean(executionState?.proof_generated);
  const hasDocumentation =
    Boolean(documentationText?.trim()) || Boolean(executionState?.documentation_complete);

  const persistedSignature: VisitSignatureCapture | null =
    signatureResult.ok && signatureResult.data
      ? {
          visitId,
          signerName: signatureResult.data.signerName,
          signerRole: signatureResult.data.signerRole,
          signedAt: signatureResult.data.signedAt,
          dataUrl: '',
        }
      : null;

  return mergeVisitDispositionWithExecution({
    detail,
    assignmentStatus,
    assignmentTasks: mapAssignmentTasks(assignmentRow.assignment_tasks ?? []),
    documentationText: hasDocumentation ? documentationText : null,
    visitTimes,
    executionStateStatus,
    hasSignature,
    hasProof,
    persistedSignature,
    assignmentOnTheWayAt: assignmentRow.on_the_way_at ?? null,
    assignmentArrivedAt: assignmentRow.arrived_at ?? null,
    assignmentActualStartAt: assignmentRow.actual_start_at ?? null,
    assignmentActualEndAt: assignmentRow.actual_end_at ?? null,
    assignmentFinishedAt: assignmentRow.finished_at ?? null,
  });
}
