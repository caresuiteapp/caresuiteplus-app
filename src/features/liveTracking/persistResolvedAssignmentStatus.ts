import type { ServiceResult } from '@/types';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import {
  assignmentSupabaseRepository,
  type AssignmentDetail,
} from '@/lib/assist/repositories/assignmentRepository.supabase';
import { visitSupabaseRepository } from '@/lib/assist/repositories/visitRepository.supabase';
import { mapVisitDetailToAssignmentDetail } from '@/lib/portal/employeePortalAssignmentBridge';
import type { LiveAssignmentResolution } from './resolveLiveAssignment';

export type PersistResolvedAssignmentStatusInput = {
  tenantId: string;
  employeeId: string;
  profileId?: string | null;
  resolution: LiveAssignmentResolution;
  toStatus: AssignmentStatus;
  note?: string;
  fastWorkflow?: boolean;
};

/**
 * Persist an execution transition in the table that actually owns the record.
 * Some employee-portal routes only have an assist_visits row; treating their
 * visit id as an assignments id previously produced a successful no-op.
 */
export async function persistResolvedAssignmentStatus(
  input: PersistResolvedAssignmentStatusInput,
): Promise<ServiceResult<AssignmentDetail>> {
  if (input.resolution.persistenceSource === 'assist_visits') {
    const updatedVisit = await visitSupabaseRepository.updateAssignmentStatus(
      input.tenantId,
      input.resolution.visitId,
      input.toStatus,
      input.profileId ?? input.employeeId,
      input.note,
    );
    if (!updatedVisit.ok) return updatedVisit;
    return { ok: true, data: mapVisitDetailToAssignmentDetail(updatedVisit.data) };
  }

  return assignmentSupabaseRepository.updateStatus(
    input.tenantId,
    input.resolution.assignmentId,
    input.toStatus,
    {
      actorProfileId: input.profileId ?? undefined,
      actorEmployeeId: input.employeeId,
      knownExistingDetail: input.resolution.detail,
      // A status button may only report success after a server readback. The
      // former optimistic fast path could hide an RLS-filtered zero-row write.
      fastWorkflow: false,
    },
    input.note,
  );
}
