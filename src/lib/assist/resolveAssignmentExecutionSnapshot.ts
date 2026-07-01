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
} from '@/lib/assist/visitWorkflow';
import type { VisitTaskItem, VisitTaskStatus } from '@/lib/assist/visitTypes';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { calculateVisitTimes } from '@/features/assistWorkflow/calculateVisitTimes';
import { resolveVisitMasterId } from '@/lib/assist/visitRecurrenceExpansion';

export type AssignmentExecutionSnapshot = {
  assignmentId: string;
  visitId: string;
  assignmentStatus: AssignmentStatus;
  hasDocumentation: boolean;
  documentationNotes: string | null;
  hasSignature: boolean;
  hasProof: boolean;
  proofStatus: string | null;
  tasks: VisitTaskItem[];
  openRequiredTasks: number;
  documentationMissing: boolean;
  signatureMissing: boolean;
  isIncomplete: boolean;
  visitTimes: ReturnType<typeof calculateVisitTimes> | null;
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
}> {
  const assignments = new Map<string, AssignmentRow>();
  const tasksByAssignment = new Map<string, VisitTaskItem[]>();
  const documentationByVisit = new Map<string, string>();

  if (visitIds.length === 0) {
    return { assignments, tasksByAssignment, documentationByVisit };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { assignments, tasksByAssignment, documentationByVisit };
  }

  const uniqueIds = [...new Set(visitIds.map((id) => resolveVisitMasterId(id)).filter(Boolean))];

  const [assignmentResult, taskResult, docResult] = await Promise.all([
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
      .select('visit_id, short_description')
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
    }
  }

  return { assignments, tasksByAssignment, documentationByVisit };
}

function buildSnapshotFromRows(input: {
  assignmentId: string;
  visitId: string;
  assignmentRow: AssignmentRow | null;
  tasks: VisitTaskItem[];
  documentationText: string | null;
  hasSignature: boolean;
  hasProof: boolean;
  proofStatus: string | null;
  visitTimes: ReturnType<typeof calculateVisitTimes> | null;
  fallbackStatus: AssignmentStatus;
}): AssignmentExecutionSnapshot {
  const assignmentStatus = input.assignmentRow
    ? remoteStatusToAssignment(input.assignmentRow.status)
    : input.fallbackStatus;

  const documentationNotes =
    input.documentationText?.trim() ||
    input.assignmentRow?.documentation_notes?.trim() ||
    null;
  const hasDocumentation = Boolean(documentationNotes);
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
    hasDocumentation,
    documentationNotes,
    hasSignature: input.hasSignature,
    hasProof: input.hasProof,
    proofStatus: input.proofStatus,
    tasks: input.tasks,
    openRequiredTasks,
    documentationMissing,
    signatureMissing,
    isIncomplete,
    visitTimes: input.visitTimes,
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
  const { assignments, tasksByAssignment, documentationByVisit } = await fetchSnapshotBatchRows(
    tenantId,
    visitIds,
  );

  for (const input of inputs) {
    const assignmentRow = assignments.get(input.assignmentId) ?? null;
    const assignmentStatus = assignmentRow
      ? remoteStatusToAssignment(assignmentRow.status)
      : input.fallbackStatus;

    let hasSignature = false;
    let hasProof = false;
    let proofStatus: string | null = null;
    let visitTimes: ReturnType<typeof calculateVisitTimes> | null = null;

    if (options?.includePersistedArtifacts) {
      const artifacts = await loadPersistedArtifacts(
        tenantId,
        input.visitId,
        assignmentStatus,
      );
      hasSignature = artifacts.hasSignature;
      hasProof = artifacts.hasProof;
      proofStatus = artifacts.proofStatus;
      visitTimes = artifacts.visitTimes;
    }

    result.set(
      input.assignmentId,
      buildSnapshotFromRows({
        assignmentId: input.assignmentId,
        visitId: input.visitId,
        assignmentRow,
        tasks: tasksByAssignment.get(input.assignmentId) ?? input.fallbackTasks ?? [],
        documentationText: documentationByVisit.get(input.visitId) ?? null,
        hasSignature,
        hasProof,
        proofStatus,
        visitTimes,
        fallbackStatus: input.fallbackStatus,
      }),
    );
  }

  return result;
}

export function snapshotAllowedTransitions(status: AssignmentStatus): AssignmentStatus[] {
  return dedupeStatusTransitionButtons(getVisitAllowedTransitions(status));
}
