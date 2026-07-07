/**
 * Single source of truth for assignment execution state across portals.
 * assignments.status drives workflow; assist_visit_* tables hold doc/tasks/signature/proof.
 */
import type { AssignmentStatus, AssignmentTaskStatus } from '@/types/modules/assignmentStatus';
import { remoteStatusToAssignment } from '@/lib/assist/assignmentStatusBridge';
import { fetchLatestVisitProof } from '@/lib/assist/assistVisitProofPersistenceService';
import { fetchValidVisitSignature } from '@/lib/assist/assistVisitSignaturePersistenceService';
import { fetchTimeEventsForVisit } from '@/lib/assist/assistTrackingPersistenceService';
import {
  assignmentStatusToDimensions,
  dedupeStatusTransitionButtons,
  getVisitAllowedTransitions,
  isVisitIncomplete,
  resolveAssignmentStatusFromExecutionContext,
} from '@/lib/assist/visitWorkflow';
import type {
  VisitDocumentationStatus,
  VisitExecutionStatus,
  VisitProofStatus,
  VisitTaskItem,
  VisitTaskStatus,
} from '@/lib/assist/visitTypes';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { calculateVisitTimes } from '@/features/assistWorkflow/calculateVisitTimes';
import { normalizePhotoReferenceList } from '@/lib/assist/visitInternalAttachmentService';
import { resolveVisitMasterId } from '@/lib/assist/visitRecurrenceExpansion';

export type AssignmentExecutionSnapshot = {
  assignmentId: string;
  visitId: string;
  assignmentStatus: AssignmentStatus;
  executionStatus?: VisitExecutionStatus;
  documentationStatus?: VisitDocumentationStatus;
  proofStatus?: VisitProofStatus | null;
  executionStateStatus?: AssignmentStatus | null;
  serviceEnded?: boolean;
  hasDocumentation: boolean;
  documentationNotes: string | null;
  hasSignature: boolean;
  hasProof: boolean;
  tasks: VisitTaskItem[];
  openRequiredTasks: number;
  documentationMissing: boolean;
  signatureMissing: boolean;
  isIncomplete: boolean;
  visitTimes: ReturnType<typeof calculateVisitTimes> | null;
  /** Normalized storage paths from assist_visit_documentation.photo_references. */
  photoReferences: string[];
};

type AssignmentRow = {
  id: string;
  status: string;
  documentation_notes?: string | null;
};

type AssignmentTaskRow = {
  id: string;
  assignment_id: string;
  title: string;
  status: AssignmentTaskStatus | string;
  is_required: boolean | null;
  not_done_reason: string | null;
  sort_order: number | null;
};

type VisitDocRow = {
  visit_id: string;
  short_description?: string | null;
  photo_references?: unknown;
};

type ExecutionStateRow = {
  visit_id: string;
  assignment_status?: string | null;
  documentation_complete?: boolean | null;
  signature_complete?: boolean | null;
  service_ended_at?: string | null;
};

function assignmentTaskStatusToVisit(status: string): VisitTaskStatus {
  switch (status) {
    case 'done':
      return 'done';
    case 'not_done':
      return 'not_possible';
    case 'not_requested':
      return 'not_requested';
    case 'cancelled':
    case 'skipped':
      return 'cancelled';
    default:
      return 'open';
  }
}

function mapAssignmentTaskRow(row: AssignmentTaskRow): VisitTaskItem {
  return {
    id: row.id,
    title: row.title,
    status: assignmentTaskStatusToVisit(String(row.status)),
    isRequired: row.is_required ?? false,
    notDoneReason: row.not_done_reason,
  };
}

function countOpenRequiredTasks(tasks: VisitTaskItem[]): number {
  return tasks.filter(
    (task) =>
      task.isRequired &&
      task.status !== 'done' &&
      task.status !== 'deferred' &&
      task.status !== 'not_requested',
  ).length;
}

function resolveDocumentationMissing(
  assignmentStatus: AssignmentStatus,
  hasDocumentation: boolean,
): boolean {
  if (hasDocumentation) return false;
  return (
    assignmentStatus === 'beendet' ||
    assignmentStatus === 'dokumentation_offen' ||
    assignmentStatus === 'unterschrift_offen'
  );
}

function resolveSignatureMissing(
  assignmentStatus: AssignmentStatus,
  hasSignature: boolean,
  requiresSignature: boolean,
): boolean {
  if (!requiresSignature || hasSignature) return false;
  return assignmentStatus === 'unterschrift_offen' || assignmentStatus === 'dokumentation_offen';
}

function requiresSignatureFromStatus(assignmentStatus: AssignmentStatus): boolean {
  return (
    assignmentStatus === 'unterschrift_offen' ||
    assignmentStatus === 'dokumentation_offen' ||
    assignmentStatus === 'abgeschlossen'
  );
}

async function fetchSnapshotBatchRows(
  tenantId: string,
  visitIds: string[],
): Promise<{
  assignments: Map<string, AssignmentRow>;
  tasksByAssignment: Map<string, VisitTaskItem[]>;
  documentationByVisit: Map<string, string>;
  photoReferencesByVisit: Map<string, string[]>;
  executionStateByVisit: Map<string, ExecutionStateRow>;
}> {
  const assignments = new Map<string, AssignmentRow>();
  const tasksByAssignment = new Map<string, VisitTaskItem[]>();
  const documentationByVisit = new Map<string, string>();
  const photoReferencesByVisit = new Map<string, string[]>();
  const executionStateByVisit = new Map<string, ExecutionStateRow>();

  if (visitIds.length === 0) {
    return {
      assignments,
      tasksByAssignment,
      documentationByVisit,
      photoReferencesByVisit,
      executionStateByVisit,
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      assignments,
      tasksByAssignment,
      documentationByVisit,
      photoReferencesByVisit,
      executionStateByVisit,
    };
  }

  const uniqueIds = [...new Set(visitIds.map((id) => resolveVisitMasterId(id)).filter(Boolean))];

  const [assignmentResult, taskResult, docResult, executionStateResult] = await Promise.all([
    fromUnknownTable(supabase, 'assignments')
      .select('id, status, documentation_notes')
      .eq('tenant_id', tenantId)
      .in('id', uniqueIds),
    fromUnknownTable(supabase, 'assignment_tasks')
      .select('id, assignment_id, title, status, is_required, not_done_reason, sort_order')
      .eq('tenant_id', tenantId)
      .in('assignment_id', uniqueIds)
      .order('sort_order', { ascending: true }),
    fromUnknownTable(supabase, 'assist_visit_documentation')
      .select('visit_id, short_description, photo_references')
      .eq('tenant_id', tenantId)
      .in('visit_id', uniqueIds),
    fromUnknownTable(supabase, 'assist_visit_execution_state')
      .select(
        'visit_id, assignment_status, documentation_complete, signature_complete, service_ended_at',
      )
      .eq('tenant_id', tenantId)
      .in('visit_id', uniqueIds),
  ]);

  if (!assignmentResult.error) {
    for (const row of (assignmentResult.data ?? []) as AssignmentRow[]) {
      assignments.set(row.id, row);
    }
  }

  if (!taskResult.error) {
    for (const row of (taskResult.data ?? []) as AssignmentTaskRow[]) {
      const mapped = mapAssignmentTaskRow(row);
      const list = tasksByAssignment.get(row.assignment_id) ?? [];
      list.push(mapped);
      tasksByAssignment.set(row.assignment_id, list);
    }
  }

  if (!docResult.error || !isSupabaseMissingTableError(docResult.error)) {
    for (const row of (docResult.data ?? []) as VisitDocRow[]) {
      const text = row.short_description?.trim();
      if (text) documentationByVisit.set(row.visit_id, text);
      const photoReferences = normalizePhotoReferenceList(row.photo_references);
      if (photoReferences.length > 0) {
        photoReferencesByVisit.set(row.visit_id, photoReferences);
      }
    }
  }

  if (!executionStateResult.error || !isSupabaseMissingTableError(executionStateResult.error)) {
    for (const row of (executionStateResult.data ?? []) as ExecutionStateRow[]) {
      executionStateByVisit.set(row.visit_id, row);
    }
  }

  return { assignments, tasksByAssignment, documentationByVisit, photoReferencesByVisit, executionStateByVisit };
}

function buildSnapshotFromRows(input: {
  assignmentId: string;
  visitId: string;
  assignmentRow: AssignmentRow | null;
  executionState: ExecutionStateRow | null;
  tasks: VisitTaskItem[];
  documentationText: string | null;
  hasSignature: boolean;
  hasProof: boolean;
  proofStatus: VisitProofStatus | null;
  visitTimes: ReturnType<typeof calculateVisitTimes> | null;
  fallbackStatus: AssignmentStatus;
  executionStatus?: VisitExecutionStatus;
  documentationStatus?: VisitDocumentationStatus;
  visitProofStatus?: VisitProofStatus;
  photoReferences?: string[];
}): AssignmentExecutionSnapshot {
  const rowStatus = input.assignmentRow
    ? remoteStatusToAssignment(input.assignmentRow.status)
    : input.fallbackStatus;
  const executionStateStatus = input.executionState?.assignment_status
    ? remoteStatusToAssignment(input.executionState.assignment_status)
    : null;
  const documentationNotes =
    input.documentationText?.trim() ||
    input.assignmentRow?.documentation_notes?.trim() ||
    null;
  const hasDocumentation =
    Boolean(documentationNotes) || Boolean(input.executionState?.documentation_complete);
  const hasSignature =
    input.hasSignature || Boolean(input.executionState?.signature_complete);
  const serviceEnded =
    Boolean(input.executionState?.service_ended_at) ||
    Boolean(input.visitTimes?.serviceEndedAt);
  const assignmentStatus = resolveAssignmentStatusFromExecutionContext({
    assignmentStatus: rowStatus,
    executionStatus: input.executionStatus,
    documentationStatus: input.documentationStatus,
    proofStatus: input.visitProofStatus ?? input.proofStatus ?? undefined,
    hasDocumentation,
    hasSignature,
    serviceEnded,
    executionStateStatus,
  });
  const openRequiredTasks = countOpenRequiredTasks(input.tasks);
  const requiresSignature = requiresSignatureFromStatus(assignmentStatus);
  const documentationMissing = resolveDocumentationMissing(assignmentStatus, hasDocumentation);
  const signatureMissing = resolveSignatureMissing(
    assignmentStatus,
    input.hasSignature,
    requiresSignature,
  );

  const dims = assignmentStatusToDimensions(assignmentStatus);
  const isIncomplete =
    openRequiredTasks > 0 ||
    documentationMissing ||
    signatureMissing ||
    isVisitIncomplete({
      documentationStatus: hasDocumentation ? 'complete' : dims.documentation,
      proofStatus: input.hasSignature ? 'signed' : dims.proof,
      executionStatus: dims.execution,
    });

  return {
    assignmentId: input.assignmentId,
    visitId: input.visitId,
    assignmentStatus,
    executionStatus: input.executionStatus,
    documentationStatus: input.documentationStatus,
    proofStatus: input.proofStatus ?? input.visitProofStatus ?? null,
    executionStateStatus,
    serviceEnded,
    hasDocumentation,
    documentationNotes,
    hasSignature,
    hasProof: input.hasProof,
    tasks: input.tasks,
    openRequiredTasks,
    documentationMissing,
    signatureMissing,
    isIncomplete,
    visitTimes: input.visitTimes,
    photoReferences: input.photoReferences ?? [],
  };
}

/** Resolve execution snapshot for one assignment/visit pair. */
export async function resolveAssignmentExecutionSnapshot(
  tenantId: string,
  assignmentId: string,
  visitId?: string | null,
  fallbackStatus: AssignmentStatus = 'geplant',
): Promise<AssignmentExecutionSnapshot> {
  const masterId = resolveVisitMasterId(assignmentId);
  const resolvedVisitId = resolveVisitMasterId(visitId ?? assignmentId);

  const batch = await fetchAssignmentExecutionSnapshotBatch(
    tenantId,
    [{ assignmentId: masterId, visitId: resolvedVisitId, fallbackStatus }],
    { includePersistedArtifacts: true },
  );
  return batch.get(masterId) ?? buildSnapshotFromRows({
    assignmentId: masterId,
    visitId: resolvedVisitId,
    assignmentRow: null,
    tasks: [],
    documentationText: null,
    hasSignature: false,
    hasProof: false,
    proofStatus: null,
    visitTimes: null,
    fallbackStatus,
  });
}

export type AssignmentExecutionSnapshotInput = {
  assignmentId: string;
  visitId: string;
  fallbackStatus: AssignmentStatus;
  fallbackTasks?: VisitTaskItem[];
  executionStatus?: VisitExecutionStatus;
  documentationStatus?: VisitDocumentationStatus;
  proofStatus?: VisitProofStatus;
};

type SnapshotBatchOptions = {
  /** Load signature/proof/time events — use for detail views only. */
  includePersistedArtifacts?: boolean;
};

async function loadPersistedArtifacts(
  tenantId: string,
  visitId: string,
  assignmentStatus: AssignmentStatus,
): Promise<{
  hasSignature: boolean;
  hasProof: boolean;
  proofStatus: string | null;
  visitTimes: ReturnType<typeof calculateVisitTimes> | null;
}> {
  const [sig, proof, events] = await Promise.all([
    fetchValidVisitSignature(tenantId, visitId),
    fetchLatestVisitProof(tenantId, visitId),
    fetchTimeEventsForVisit(tenantId, visitId, 100),
  ]);

  const visitTimes =
    events.ok && events.data.length
      ? calculateVisitTimes(
          events.data.map((event) => ({
            eventType: event.eventType,
            occurredAt: event.occurredAt,
          })),
          assignmentStatus,
        )
      : null;

  return {
    hasSignature: sig.ok && Boolean(sig.data),
    hasProof: proof.ok && Boolean(proof.data),
    proofStatus: proof.ok && proof.data ? proof.data.status : null,
    visitTimes,
  };
}

/** Batch resolver — lightweight for lists, full artifacts optional for detail. */
export async function fetchAssignmentExecutionSnapshotBatch(
  tenantId: string,
  inputs: AssignmentExecutionSnapshotInput[],
  options?: SnapshotBatchOptions,
): Promise<Map<string, AssignmentExecutionSnapshot>> {
  const result = new Map<string, AssignmentExecutionSnapshot>();
  if (inputs.length === 0) return result;

  const visitIds = inputs.map((input) => input.visitId);
  const {
    assignments,
    tasksByAssignment,
    documentationByVisit,
    photoReferencesByVisit,
    executionStateByVisit,
  } = await fetchSnapshotBatchRows(tenantId, visitIds);

  for (const input of inputs) {
    const assignmentRow = assignments.get(input.assignmentId) ?? null;
    const executionState = executionStateByVisit.get(input.visitId) ?? null;
    const assignmentStatus = assignmentRow
      ? remoteStatusToAssignment(assignmentRow.status)
      : input.fallbackStatus;

    let hasSignature = Boolean(executionState?.signature_complete);
    let hasProof = false;
    let proofStatus: VisitProofStatus | null = input.proofStatus ?? null;
    let visitTimes: ReturnType<typeof calculateVisitTimes> | null = null;

    if (options?.includePersistedArtifacts) {
      const artifacts = await loadPersistedArtifacts(
        tenantId,
        input.visitId,
        assignmentStatus,
      );
      hasSignature = hasSignature || artifacts.hasSignature;
      hasProof = artifacts.hasProof;
      proofStatus = (artifacts.proofStatus as VisitProofStatus | null) ?? proofStatus;
      visitTimes = artifacts.visitTimes;
    }

    result.set(
      input.assignmentId,
      buildSnapshotFromRows({
        assignmentId: input.assignmentId,
        visitId: input.visitId,
        assignmentRow,
        executionState,
        tasks: tasksByAssignment.get(input.assignmentId) ?? input.fallbackTasks ?? [],
        documentationText: documentationByVisit.get(input.visitId) ?? null,
        hasSignature,
        hasProof,
        proofStatus,
        visitTimes,
        fallbackStatus: input.fallbackStatus,
        executionStatus: input.executionStatus,
        documentationStatus: input.documentationStatus,
        visitProofStatus: input.proofStatus,
        photoReferences: photoReferencesByVisit.get(input.visitId) ?? [],
      }),
    );
  }

  return result;
}

export function snapshotAllowedTransitions(status: AssignmentStatus): AssignmentStatus[] {
  return dedupeStatusTransitionButtons(getVisitAllowedTransitions(status));
}
