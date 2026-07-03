import type { RoleKey, ServiceResult } from '@/types';
import type { WfmApproval, WfmApprovalStatus, WfmApprovalType } from '@/types/modules/wfm';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';

const TABLE = 'workforce_approvals';

type ApprovalRow = {
  id: string;
  tenant_id: string;
  employee_id: string;
  approval_type: WfmApprovalType;
  status: WfmApprovalStatus;
  reference_type: string | null;
  reference_id: string | null;
  requested_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

const demoApprovals = new Map<string, WfmApproval>();

function mapRow(row: ApprovalRow): WfmApproval {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    employeeId: row.employee_id,
    approvalType: row.approval_type,
    status: row.status,
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    requestedBy: row.requested_by,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    rejectionReason: row.rejection_reason,
    payload: row.payload ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function newUuid(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `demo-appr-${Date.now()}`;
}

export function resetWfmApprovalDemoStore(): void {
  demoApprovals.clear();
}

export async function createWfmApproval(
  tenantId: string,
  userId: string,
  actorRoleKey: RoleKey | null,
  input: {
    employeeId: string;
    approvalType: WfmApprovalType;
    referenceType?: string | null;
    referenceId?: string | null;
    payload?: Record<string, unknown>;
  },
): Promise<ServiceResult<WfmApproval>> {
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const now = new Date().toISOString();
  const id = newUuid();

  if (getServiceMode() !== 'supabase') {
    const approval: WfmApproval = {
      id,
      tenantId,
      employeeId: input.employeeId,
      approvalType: input.approvalType,
      status: 'pending',
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      requestedBy: userId,
      reviewedBy: null,
      reviewedAt: null,
      rejectionReason: null,
      payload: input.payload ?? {},
      createdAt: now,
      updatedAt: now,
    };
    demoApprovals.set(id, approval);
    return { ok: true, data: approval };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { data, error } = await fromUnknownTable(supabase, TABLE)
    .insert({
      id,
      tenant_id: tenantId,
      employee_id: input.employeeId,
      approval_type: input.approvalType,
      status: 'pending',
      reference_type: input.referenceType ?? null,
      reference_id: input.referenceId ?? null,
      requested_by: userId,
      payload: input.payload ?? {},
    })
    .select('*')
    .single();

  if (error) {
    if (isSupabaseMissingTableError(error)) {
      return { ok: false, error: 'Genehmigungstabellen (0190) noch nicht verfügbar.' };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: mapRow(data as ApprovalRow) };
}

export async function listWfmApprovalsForAbsenceReferences(
  tenantId: string,
  actorRoleKey: RoleKey | null,
  absenceIds: string[],
): Promise<ServiceResult<WfmApproval[]>> {
  const denied = enforcePermission(actorRoleKey, 'portal.employee.absences.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const uniqueIds = [...new Set(absenceIds.filter(Boolean))];
  if (uniqueIds.length === 0) return { ok: true, data: [] };

  if (getServiceMode() !== 'supabase') {
    const list = [...demoApprovals.values()].filter(
      (a) =>
        a.tenantId === tenantId
        && a.referenceType === 'workforce_absence'
        && a.referenceId
        && uniqueIds.includes(a.referenceId),
    );
    return { ok: true, data: list };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { data, error } = await fromUnknownTable(supabase, TABLE)
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('reference_type', 'workforce_absence')
    .in('reference_id', uniqueIds)
    .order('reviewed_at', { ascending: false });

  if (error) {
    if (isSupabaseMissingTableError(error)) return { ok: true, data: [] };
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: (data ?? []).map((row) => mapRow(row as ApprovalRow)) };
}

export async function listPendingWfmApprovals(
  tenantId: string,
  actorRoleKey: RoleKey | null,
): Promise<ServiceResult<WfmApproval[]>> {
  const denied = enforcePermission(actorRoleKey, 'office.employees.absences.approve');
  if (denied) return denied;

  if (getServiceMode() !== 'supabase') {
    const list = [...demoApprovals.values()].filter(
      (a) => a.tenantId === tenantId && a.status === 'pending',
    );
    return { ok: true, data: list };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { data, error } = await fromUnknownTable(supabase, TABLE)
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    if (isSupabaseMissingTableError(error)) return { ok: true, data: [] };
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: (data ?? []).map((row) => mapRow(row as ApprovalRow)) };
}

export async function reviewWfmApproval(
  tenantId: string,
  reviewerId: string,
  actorRoleKey: RoleKey | null,
  approvalId: string,
  decision: 'approved' | 'rejected',
  rejectionReason?: string,
): Promise<ServiceResult<WfmApproval>> {
  const denied = enforcePermission(actorRoleKey, 'office.employees.absences.approve');
  if (denied) return denied;

  const now = new Date().toISOString();
  const status: WfmApprovalStatus = decision === 'approved' ? 'approved' : 'rejected';

  if (getServiceMode() !== 'supabase') {
    const existing = demoApprovals.get(approvalId);
    if (!existing || existing.tenantId !== tenantId) {
      return { ok: false, error: 'Genehmigung nicht gefunden.' };
    }
    const updated: WfmApproval = {
      ...existing,
      status,
      reviewedBy: reviewerId,
      reviewedAt: now,
      rejectionReason: rejectionReason ?? null,
      updatedAt: now,
    };
    demoApprovals.set(approvalId, updated);
    return { ok: true, data: updated };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { data, error } = await fromUnknownTable(supabase, TABLE)
    .update({
      status,
      reviewed_by: reviewerId,
      reviewed_at: now,
      rejection_reason: rejectionReason ?? null,
      updated_at: now,
    })
    .eq('id', approvalId)
    .eq('tenant_id', tenantId)
    .select('*')
    .single();

  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: mapRow(data as ApprovalRow) };
}
