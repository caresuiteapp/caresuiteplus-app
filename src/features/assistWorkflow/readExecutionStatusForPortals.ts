/**
 * ASSIST.WORKFLOW.1 — Read execution status for Office/Assist/Client portals.
 */
import type { ServiceResult } from '@/types';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import { assignmentStatusToWorkflowStep } from './assistVisitStateMachine';
import { resolveAssignmentExecutionSnapshot } from '@/lib/assist/resolveAssignmentExecutionSnapshot';

export type PortalExecutionStatusView = {
  assignmentId: string;
  visitId: string;
  workflowStep: ReturnType<typeof assignmentStatusToWorkflowStep>;
  assignmentStatus: AssignmentStatus;
  hasDocumentation: boolean;
  hasSignature: boolean;
  hasProof: boolean;
  proofStatus: string | null;
  visitTimes: Awaited<ReturnType<typeof resolveAssignmentExecutionSnapshot>>['visitTimes'];
  noShowNote: string | null;
};

export async function readExecutionStatusForPortals(
  tenantId: string,
  assignmentId: string,
  visitId: string,
  assignmentStatus: AssignmentStatus,
): Promise<ServiceResult<PortalExecutionStatusView>> {
  const snapshot = await resolveAssignmentExecutionSnapshot(
    tenantId,
    assignmentId,
    visitId,
    assignmentStatus,
  );

  return {
    ok: true,
    data: {
      assignmentId: snapshot.assignmentId,
      visitId: snapshot.visitId,
      workflowStep: assignmentStatusToWorkflowStep(snapshot.assignmentStatus),
      assignmentStatus: snapshot.assignmentStatus,
      hasDocumentation: snapshot.hasDocumentation,
      hasSignature: snapshot.hasSignature,
      hasProof: snapshot.hasProof,
      proofStatus: snapshot.proofStatus,
      visitTimes: snapshot.visitTimes,
      noShowNote: null,
    },
  };
}
