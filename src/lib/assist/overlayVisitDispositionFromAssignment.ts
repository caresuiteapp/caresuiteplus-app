/**
 * Overlay assignments.status + portal execution data onto assist_visits disposition reads.
 * Prevents office/client lists and detail from showing stale canonical_status / visit tasks.
 */
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import { assignmentStatusToRemote } from '@/lib/assist/assignmentStatusBridge';
import {
  assignmentStatusToDimensions,
  isVisitIncomplete,
} from '@/lib/assist/visitWorkflow';
import type {
  VisitDispositionDetail,
  VisitDispositionListItem,
  VisitProofStatus,
  VisitTaskItem,
} from '@/lib/assist/visitTypes';
import { resolveVisitMasterId } from '@/lib/assist/visitRecurrenceExpansion';
import {
  fetchAssignmentExecutionSnapshotBatch,
  snapshotAllowedTransitions,
  type AssignmentExecutionSnapshot,
} from '@/lib/assist/resolveAssignmentExecutionSnapshot';

function assignmentStatusToWorkflowFilter(status: AssignmentStatus) {
  const map: Partial<Record<AssignmentStatus, VisitDispositionListItem['status']>> = {
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

function resolveProofStatus(
  snapshot: AssignmentExecutionSnapshot,
  current: VisitProofStatus,
): VisitProofStatus {
  if (snapshot.hasSignature) return 'signed';
  if (snapshot.proofStatus === 'signed' || snapshot.proofStatus === 'verified') {
    return snapshot.proofStatus as VisitProofStatus;
  }
  const dims = assignmentStatusToDimensions(snapshot.assignmentStatus);
  return dims.proof !== 'none' ? dims.proof : current;
}

function resolveDocumentationStatus(
  snapshot: AssignmentExecutionSnapshot,
  current: VisitDispositionDetail['documentationStatus'],
): VisitDispositionDetail['documentationStatus'] {
  if (snapshot.hasDocumentation) return 'complete';
  const dims = assignmentStatusToDimensions(snapshot.assignmentStatus);
  return dims.documentation !== 'none' ? dims.documentation : current;
}

function preferTasks(
  snapshotTasks: VisitTaskItem[],
  visitTasks: VisitTaskItem[],
): VisitTaskItem[] {
  if (snapshotTasks.length > 0) return snapshotTasks;
  return visitTasks;
}

export function applySnapshotToVisitListItem(
  item: VisitDispositionListItem,
  snapshot: AssignmentExecutionSnapshot,
): VisitDispositionListItem {
  const assignmentStatus = snapshot.assignmentStatus;
  const dims = assignmentStatusToDimensions(assignmentStatus);
  return {
    ...item,
    assignmentStatus,
    status: assignmentStatusToWorkflowFilter(assignmentStatus),
    isIncomplete:
      snapshot.isIncomplete ||
      isVisitIncomplete({
        documentationStatus: snapshot.hasDocumentation ? 'complete' : dims.documentation,
        proofStatus: snapshot.hasSignature ? 'signed' : dims.proof,
        executionStatus: dims.execution,
      }),
  };
}

function applySnapshotToDetail(
  detail: VisitDispositionDetail,
  snapshot: AssignmentExecutionSnapshot,
): VisitDispositionDetail {
  const assignmentStatus = snapshot.assignmentStatus;
  const dims = assignmentStatusToDimensions(assignmentStatus);
  const documentationStatus = resolveDocumentationStatus(snapshot, detail.documentationStatus);
  const proofStatus = resolveProofStatus(snapshot, detail.proofStatus);
  const tasks = preferTasks(snapshot.tasks, detail.tasks);

  return {
    ...detail,
    assignmentStatus,
    status: assignmentStatusToWorkflowFilter(assignmentStatus),
    executionStatus: dims.execution,
    documentationStatus,
    proofStatus,
    portalStatus: dims.portal,
    planningStatus: dims.planning,
    billingStatus: dims.billing,
    allowedStatusTransitions: snapshotAllowedTransitions(assignmentStatus),
    tasks,
    employeeNotes: snapshot.documentationNotes ?? detail.employeeNotes,
    isIncomplete:
      snapshot.isIncomplete ||
      isVisitIncomplete({
        documentationStatus,
        proofStatus,
        executionStatus: dims.execution,
      }),
  };
}

export async function overlayVisitDispositionListFromAssignments(
  tenantId: string,
  items: VisitDispositionListItem[],
): Promise<VisitDispositionListItem[]> {
  if (items.length === 0) return items;

  const snapshots = await fetchAssignmentExecutionSnapshotBatch(
    tenantId,
    items.map((item) => ({
      assignmentId: resolveVisitMasterId(item.id),
      visitId: resolveVisitMasterId(item.id),
      fallbackStatus: item.assignmentStatus,
    })),
  );

  return items.map((item) => {
    const snapshot = snapshots.get(resolveVisitMasterId(item.id));
    if (!snapshot) return item;
    return applySnapshotToVisitListItem(item, snapshot);
  });
}

export async function overlayVisitDispositionDetailFromAssignment(
  tenantId: string,
  detail: VisitDispositionDetail,
): Promise<VisitDispositionDetail> {
  const masterId = resolveVisitMasterId(detail.id);
  const snapshot = await fetchAssignmentExecutionSnapshotBatch(
    tenantId,
    [
      {
        assignmentId: masterId,
        visitId: masterId,
        fallbackStatus: detail.assignmentStatus,
        fallbackTasks: detail.tasks,
      },
    ],
    { includePersistedArtifacts: true },
  ).then((map) => map.get(masterId));

  if (!snapshot) return detail;
  return applySnapshotToDetail(detail, snapshot);
}
