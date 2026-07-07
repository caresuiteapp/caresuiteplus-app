/**
 * Overlay assignments.status + portal execution data onto assist_visits disposition reads.
 * Prevents office/client lists and detail from showing stale canonical_status / visit tasks.
 */
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import {
  assignmentStatusToDimensions,
  isVisitIncomplete,
  resolveAssignmentStatusFromExecutionContext,
} from '@/lib/assist/visitWorkflow';
import type {
  VisitDispositionDetail,
  VisitDispositionListItem,
  VisitProofStatus,
  VisitTaskItem,
} from '@/lib/assist/visitTypes';
import { resolveVisitAndAssignmentIds } from '@/lib/assist/assistExecutionVisitResolver';
import {
  neutralizeFutureOccurrenceListItem,
  resetVirtualOccurrenceExecutionState,
  resetVirtualOccurrenceListItem,
  shouldIsolateOccurrenceExecution,
  shouldNeutralizeFutureListItem,
} from '@/lib/assist/visitRecurrenceExecution';
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
  const assignmentStatus = resolveAssignmentStatusFromExecutionContext({
    assignmentStatus: item.assignmentStatus,
    executionStateStatus: snapshot.executionStateStatus ?? snapshot.assignmentStatus,
    executionStatus: snapshot.executionStatus ?? item.executionStatus,
    documentationStatus: snapshot.documentationStatus ?? item.documentationStatus,
    proofStatus: item.proofStatus,
    hasDocumentation: snapshot.hasDocumentation,
    hasSignature: snapshot.hasSignature,
    serviceEnded: snapshot.serviceEnded,
  });
  const dims = assignmentStatusToDimensions(assignmentStatus);
  const documentationStatus = snapshot.hasDocumentation ? 'complete' : dims.documentation;
  const proofStatus = snapshot.hasSignature ? 'signed' : item.proofStatus ?? dims.proof;
  return {
    ...item,
    assignmentStatus,
    proofStatus,
    status: assignmentStatusToWorkflowFilter(assignmentStatus),
    isIncomplete:
      snapshot.isIncomplete ||
      isVisitIncomplete({
        documentationStatus,
        proofStatus,
        executionStatus: dims.execution,
      }),
    internalPhotoReferences:
      snapshot.photoReferences.length > 0
        ? snapshot.photoReferences
        : item.internalPhotoReferences,
  };
}

export function applySnapshotToDetail(
  detail: VisitDispositionDetail,
  snapshot: AssignmentExecutionSnapshot,
): VisitDispositionDetail {
  const assignmentStatus = resolveAssignmentStatusFromExecutionContext({
    assignmentStatus: detail.assignmentStatus,
    executionStateStatus: snapshot.executionStateStatus ?? snapshot.assignmentStatus,
    executionStatus: snapshot.executionStatus ?? detail.executionStatus,
    documentationStatus: snapshot.documentationStatus ?? detail.documentationStatus,
    proofStatus: detail.proofStatus,
    hasDocumentation: snapshot.hasDocumentation,
    hasSignature: snapshot.hasSignature,
    serviceEnded: snapshot.serviceEnded,
  });
  const dims = assignmentStatusToDimensions(assignmentStatus);
  const documentationStatus = resolveDocumentationStatus(snapshot, detail.documentationStatus);
  const proofStatus = resolveProofStatus(snapshot, detail.proofStatus);
  const tasks = preferTasks(snapshot.tasks, detail.tasks);
  const onTheWayAt = snapshot.visitTimes?.driveStartedAt ?? detail.onTheWayAt;
  const arrivedAt = snapshot.visitTimes?.arrivedAt ?? detail.arrivedAt;
  const actualStartAt = snapshot.visitTimes?.serviceStartedAt ?? detail.actualStartAt;
  const actualEndAt = snapshot.visitTimes?.serviceEndedAt ?? detail.actualEndAt;
  const finishedAt = detail.finishedAt ?? actualEndAt;

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
    onTheWayAt,
    arrivedAt,
    actualStartAt,
    actualEndAt,
    finishedAt,
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

  const idPairs = await Promise.all(
    items.map(async (item) => ({
      item,
      ids: await resolveVisitAndAssignmentIds(tenantId, item.id),
    })),
  );

  const snapshots = await fetchAssignmentExecutionSnapshotBatch(
    tenantId,
    idPairs.map(({ item, ids }) => ({
      assignmentId: ids.assignmentId,
      visitId: ids.visitId,
      fallbackStatus: item.assignmentStatus,
      executionStatus: item.executionStatus,
      documentationStatus: item.documentationStatus,
      proofStatus: item.proofStatus,
    })),
  );

  return idPairs.map(({ item, ids }) => {
    if (shouldIsolateOccurrenceExecution({ itemId: item.id })) {
      return resetVirtualOccurrenceListItem(item, item.planningStatus);
    }

    const snapshot = snapshots.get(ids.assignmentId) ?? snapshots.get(ids.visitId);
    const overlaid = snapshot ? applySnapshotToVisitListItem(item, snapshot) : item;
    return neutralizeFutureOccurrenceListItem(overlaid);
  });
}

export async function overlayVisitDispositionDetailFromAssignment(
  tenantId: string,
  detail: VisitDispositionDetail,
): Promise<VisitDispositionDetail> {
  if (shouldIsolateOccurrenceExecution({ itemId: detail.id })) {
    return resetVirtualOccurrenceExecutionState(detail);
  }

  const { visitId, assignmentId } = await resolveVisitAndAssignmentIds(tenantId, detail.id);

  const snapshot = await fetchAssignmentExecutionSnapshotBatch(
    tenantId,
    [
      {
        assignmentId,
        visitId,
        fallbackStatus: detail.assignmentStatus,
        fallbackTasks: detail.tasks,
        executionStatus: detail.executionStatus,
        documentationStatus: detail.documentationStatus,
        proofStatus: detail.proofStatus,
      },
    ],
    { includePersistedArtifacts: true },
  ).then((map) => map.get(assignmentId));

  if (!snapshot) {
    return shouldNeutralizeFutureListItem(detail)
      ? resetVirtualOccurrenceExecutionState(detail)
      : detail;
  }
  const overlaid = applySnapshotToDetail(detail, snapshot);
  return shouldNeutralizeFutureListItem(overlaid)
    ? resetVirtualOccurrenceExecutionState(overlaid)
    : overlaid;
}
