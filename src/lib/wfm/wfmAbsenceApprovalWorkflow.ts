import type { RoleKey, ServiceResult } from '@/types';
import type { WfmAbsence, WfmApproval, WfmApprovalType } from '@/types/modules/wfm';
import type { AssignmentWorkflowRecord } from '@/types/modules/assignmentWorkflow';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { listAssignmentWorkflows } from '@/lib/assist/assignmentWorkflowService';
import { countRequestedDays } from '@/lib/office/absenceConflictService';
import {
  detectWfmAbsenceOverlapConflicts,
  detectWfmAssignmentConflicts,
  detectWfmVacationBalanceWarning,
  mergeWfmConflictWarnings,
  type WfmAbsenceConflictWarning,
} from './wfmAbsenceConflictService';
import {
  getWfmAbsenceById,
  listWfmAbsencesForTeam,
  reviewWfmAbsence,
  withdrawWfmAbsence,
} from './wfmAbsenceService';
import { listPendingWfmApprovals, reviewWfmApproval } from './wfmApprovalService';
import {
  cancelWfmAbsenceCalendarAsync,
  syncWfmAbsenceToCalendarAsync,
} from './wfmAbsenceCalendarBridge';

export type WfmAbsenceApprovalDetail = {
  approval: WfmApproval;
  absence: WfmAbsence | null;
  employeeName: string;
  conflicts: WfmAbsenceConflictWarning[];
};

export async function listWfmAbsenceApprovalDetails(
  tenantId: string,
  actorRoleKey: RoleKey | null,
  options?: { approvalType?: WfmApprovalType },
): Promise<ServiceResult<WfmAbsenceApprovalDetail[]>> {
  const denied = enforcePermission(actorRoleKey, 'office.employees.absences.approve');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const [approvalsResult, absencesResult] = await Promise.all([
    listPendingWfmApprovals(tenantId, actorRoleKey),
    listWfmAbsencesForTeam(tenantId, actorRoleKey),
  ]);

  if (!approvalsResult.ok) return approvalsResult;
  if (!absencesResult.ok) return absencesResult;

  const absences = absencesResult.data;
  const absenceById = new Map(absences.map((a) => [a.id, a]));
  const employeeIds = [...new Set(approvalsResult.data.map((a) => a.employeeId))];
  const employeeNames = await resolveEmployeeNames(tenantId, employeeIds);
  const assignments = listAssignmentWorkflows(tenantId);

  let approvals = approvalsResult.data.filter(
    (a) => a.approvalType === 'vacation' || a.approvalType === 'absence',
  );
  if (options?.approvalType) {
    approvals = approvals.filter((a) => a.approvalType === options.approvalType);
  }

  const details: WfmAbsenceApprovalDetail[] = approvals.map((approval) => {
    const absence = approval.referenceId ? absenceById.get(approval.referenceId) ?? null : null;
    const conflicts = absence
      ? buildAbsenceConflicts(absence, absences, assignments)
      : [];
    return {
      approval,
      absence,
      employeeName: employeeNames.get(approval.employeeId) ?? `MA ${approval.employeeId.slice(0, 8)}`,
      conflicts,
    };
  });

  return { ok: true, data: details };
}

function buildAbsenceConflicts(
  absence: WfmAbsence,
  allAbsences: WfmAbsence[],
  assignments: AssignmentWorkflowRecord[],
): WfmAbsenceConflictWarning[] {
  const overlap = detectWfmAbsenceOverlapConflicts(absence, allAbsences);
  const assignmentConflicts = detectWfmAssignmentConflicts(absence, assignments);
  const requestedDays =
    absence.requestedDays ??
    countRequestedDays(absence.startsAt, absence.endsAt);
  const balance = detectWfmVacationBalanceWarning({
    absenceType: absence.absenceType,
    requestedDays,
    remainingDays: null,
  });
  return mergeWfmConflictWarnings(overlap, assignmentConflicts, balance);
}

type EmployeeNameRow = { id: string; first_name: string | null; last_name: string | null };

async function resolveEmployeeNames(
  tenantId: string,
  employeeIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (employeeIds.length === 0) return map;

  const { getServiceMode } = await import('@/lib/services/mode');
  if (getServiceMode() !== 'supabase') {
    for (const id of employeeIds) {
      map.set(id, `Mitarbeiter ${id.slice(-4)}`);
    }
    return map;
  }

  const { getSupabaseClient } = await import('@/lib/supabase/client');
  const supabase = getSupabaseClient();
  if (!supabase) return map;

  const { data } = await supabase
    .from('employees')
    .select('id, first_name, last_name')
    .eq('tenant_id', tenantId)
    .in('id', employeeIds);

  for (const row of (data ?? []) as EmployeeNameRow[]) {
    const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
    map.set(row.id, name || `MA ${row.id.slice(0, 8)}`);
  }
  return map;
}

export async function reviewWfmAbsenceRequest(
  tenantId: string,
  reviewerId: string,
  actorRoleKey: RoleKey | null,
  approvalId: string,
  decision: 'approved' | 'rejected',
  options?: { rejectionReason?: string; approvalComment?: string },
): Promise<ServiceResult<{ approval: WfmApproval; absence: WfmAbsence | null }>> {
  const denied = enforcePermission(actorRoleKey, 'office.employees.absences.approve');
  if (denied) return denied;

  if (decision === 'rejected' && !options?.rejectionReason?.trim()) {
    return { ok: false, error: 'Ablehnungsgrund ist erforderlich.' };
  }

  const approvalResult = await reviewWfmApproval(
    tenantId,
    reviewerId,
    actorRoleKey,
    approvalId,
    decision,
    options?.rejectionReason?.trim(),
  );
  if (!approvalResult.ok) return approvalResult;

  let absence: WfmAbsence | null = null;
  const referenceId = approvalResult.data.referenceId;

  if (referenceId && approvalResult.data.referenceType === 'workforce_absence') {
    const absenceResult = await reviewWfmAbsence(
      tenantId,
      reviewerId,
      actorRoleKey,
      referenceId,
      decision,
      options?.rejectionReason?.trim(),
      options?.approvalComment?.trim(),
    );
    if (!absenceResult.ok) return absenceResult;
    absence = absenceResult.data;

    if (decision === 'approved') {
      syncWfmAbsenceToCalendarAsync(absence);
    } else {
      cancelWfmAbsenceCalendarAsync(absence);
    }
  }

  return { ok: true, data: { approval: approvalResult.data, absence } };
}

export async function withdrawWfmAbsenceRequest(
  tenantId: string,
  userId: string,
  actorRoleKey: RoleKey | null,
  absenceId: string,
  employeeId?: string | null,
): Promise<ServiceResult<WfmAbsence>> {
  const withdrawResult = await withdrawWfmAbsence(
    tenantId,
    userId,
    actorRoleKey,
    absenceId,
    employeeId,
  );
  if (!withdrawResult.ok) return withdrawResult;

  cancelWfmAbsenceCalendarAsync(withdrawResult.data);
  return withdrawResult;
}

export async function getWfmAbsenceApprovalDetail(
  tenantId: string,
  actorRoleKey: RoleKey | null,
  approvalId: string,
): Promise<ServiceResult<WfmAbsenceApprovalDetail | null>> {
  const list = await listWfmAbsenceApprovalDetails(tenantId, actorRoleKey);
  if (!list.ok) return list;
  const found = list.data.find((d) => d.approval.id === approvalId) ?? null;
  return { ok: true, data: found };
}

export async function loadAbsenceConflictsForReview(
  tenantId: string,
  actorRoleKey: RoleKey | null,
  absenceId: string,
): Promise<ServiceResult<WfmAbsenceConflictWarning[]>> {
  const denied = enforcePermission(actorRoleKey, 'office.employees.absences.approve');
  if (denied) return denied;

  const absenceResult = await getWfmAbsenceById(tenantId, actorRoleKey, absenceId);
  if (!absenceResult.ok) return absenceResult;
  if (!absenceResult.data) return { ok: true, data: [] };

  const [absencesResult] = await Promise.all([
    listWfmAbsencesForTeam(tenantId, actorRoleKey),
  ]);
  if (!absencesResult.ok) return absencesResult;

  const assignments = listAssignmentWorkflows(tenantId);
  return {
    ok: true,
    data: buildAbsenceConflicts(absenceResult.data, absencesResult.data, assignments),
  };
}
