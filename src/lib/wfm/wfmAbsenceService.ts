import type { RoleKey, ServiceResult } from '@/types';
import type {
  WfmAbsence,
  WfmAbsenceStatus,
  WfmAbsenceType,
} from '@/types/modules/wfm';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { resolveEmployeeIdForUser } from './wfmWorkSessionRepository';
import { createWfmApproval } from './wfmApprovalService';

const TABLE = 'workforce_absences';

type AbsenceRow = {
  id: string;
  tenant_id: string;
  employee_id: string;
  absence_type: WfmAbsenceType;
  status: WfmAbsenceStatus;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  requested_days: number | null;
  employee_note: string;
  internal_note: string;
  created_at: string;
  updated_at: string;
};

const demoAbsences = new Map<string, WfmAbsence>();

function mapRow(row: AbsenceRow): WfmAbsence {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    employeeId: row.employee_id,
    absenceType: row.absence_type,
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    allDay: row.all_day,
    requestedDays: row.requested_days,
    employeeNote: row.employee_note,
    internalNote: row.internal_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function newUuid(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `demo-abs-${Date.now()}`;
}

export function resetWfmAbsenceDemoStore(): void {
  demoAbsences.clear();
}

export async function listWfmAbsencesForEmployee(
  tenantId: string,
  userId: string,
  actorRoleKey: RoleKey | null,
  options?: { employeeId?: string | null; year?: number },
): Promise<ServiceResult<WfmAbsence[]>> {
  const denied = enforcePermission(actorRoleKey, 'portal.employee.absences.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const employeeResult = await resolveEmployeeIdForUser(tenantId, userId, options?.employeeId);
  if (!employeeResult.ok) return employeeResult;

  if (getServiceMode() !== 'supabase') {
    const year = options?.year ?? new Date().getFullYear();
    const list = [...demoAbsences.values()].filter(
      (a) =>
        a.tenantId === tenantId &&
        a.employeeId === employeeResult.data &&
        new Date(a.startsAt).getFullYear() === year,
    );
    list.sort((a, b) => b.startsAt.localeCompare(a.startsAt));
    return { ok: true, data: list };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  let query = fromUnknownTable(supabase, TABLE)
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeResult.data)
    .order('starts_at', { ascending: false });

  if (options?.year) {
    const from = `${options.year}-01-01T00:00:00.000Z`;
    const to = `${options.year}-12-31T23:59:59.999Z`;
    query = query.gte('starts_at', from).lte('starts_at', to);
  }

  const { data, error } = await query;
  if (error) {
    if (isSupabaseMissingTableError(error)) return { ok: true, data: [] };
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: (data ?? []).map((row) => mapRow(row as AbsenceRow)) };
}

export async function listWfmAbsencesForTeam(
  tenantId: string,
  actorRoleKey: RoleKey | null,
  status?: WfmAbsenceStatus,
): Promise<ServiceResult<WfmAbsence[]>> {
  const denied = enforcePermission(actorRoleKey, 'office.employees.absences.view');
  if (denied) return denied;

  if (getServiceMode() !== 'supabase') {
    let list = [...demoAbsences.values()].filter((a) => a.tenantId === tenantId);
    if (status) list = list.filter((a) => a.status === status);
    return { ok: true, data: list };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  let query = fromUnknownTable(supabase, TABLE)
    .select('*')
    .eq('tenant_id', tenantId)
    .order('starts_at', { ascending: false })
    .limit(100);

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) {
    if (isSupabaseMissingTableError(error)) return { ok: true, data: [] };
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: (data ?? []).map((row) => mapRow(row as AbsenceRow)) };
}

export async function requestWfmAbsence(
  tenantId: string,
  userId: string,
  actorRoleKey: RoleKey | null,
  input: {
    absenceType: WfmAbsenceType;
    startsAt: string;
    endsAt: string;
    allDay?: boolean;
    requestedDays?: number;
    employeeNote?: string;
    employeeId?: string | null;
  },
): Promise<ServiceResult<WfmAbsence>> {
  const denied = enforcePermission(actorRoleKey, 'portal.employee.absences.request');
  if (denied) return denied;

  const employeeResult = await resolveEmployeeIdForUser(tenantId, userId, input.employeeId);
  if (!employeeResult.ok) return employeeResult;

  const now = new Date().toISOString();
  const id = newUuid();
  const payload = {
    tenant_id: tenantId,
    employee_id: employeeResult.data,
    absence_type: input.absenceType,
    status: 'requested' as const,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    all_day: input.allDay ?? true,
    requested_days: input.requestedDays ?? null,
    employee_note: input.employeeNote ?? '',
    internal_note: '',
    created_by: userId,
  };

  if (getServiceMode() !== 'supabase') {
    const absence: WfmAbsence = {
      id,
      tenantId,
      employeeId: employeeResult.data,
      absenceType: input.absenceType,
      status: 'requested',
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      allDay: input.allDay ?? true,
      requestedDays: input.requestedDays ?? null,
      employeeNote: input.employeeNote ?? '',
      internalNote: '',
      createdAt: now,
      updatedAt: now,
    };
    demoAbsences.set(id, absence);
    await createWfmApproval(tenantId, userId, actorRoleKey, {
      employeeId: employeeResult.data,
      approvalType: input.absenceType === 'vacation' ? 'vacation' : 'absence',
      referenceType: 'workforce_absence',
      referenceId: id,
      payload: { absenceType: input.absenceType, startsAt: input.startsAt, endsAt: input.endsAt },
    });
    return { ok: true, data: absence };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { data, error } = await fromUnknownTable(supabase, TABLE)
    .insert({ id, ...payload })
    .select('*')
    .single();

  if (error) return { ok: false, error: toGermanSupabaseError(error) };

  const absence = mapRow(data as AbsenceRow);
  await createWfmApproval(tenantId, userId, actorRoleKey, {
    employeeId: employeeResult.data,
    approvalType: input.absenceType === 'vacation' ? 'vacation' : 'absence',
    referenceType: 'workforce_absence',
    referenceId: id,
    payload: { absenceType: input.absenceType, startsAt: input.startsAt, endsAt: input.endsAt },
  });

  return { ok: true, data: absence };
}

export async function getWfmAbsenceById(
  tenantId: string,
  actorRoleKey: RoleKey | null,
  absenceId: string,
): Promise<ServiceResult<WfmAbsence | null>> {
  const denied = enforcePermission(actorRoleKey, 'office.employees.absences.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() !== 'supabase') {
    const existing = demoAbsences.get(absenceId);
    if (!existing || existing.tenantId !== tenantId) return { ok: true, data: null };
    return { ok: true, data: existing };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { data, error } = await fromUnknownTable(supabase, TABLE)
    .select('*')
    .eq('id', absenceId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) {
    if (isSupabaseMissingTableError(error)) return { ok: true, data: null };
    return { ok: false, error: toGermanSupabaseError(error) };
  }
  if (!data) return { ok: true, data: null };
  return { ok: true, data: mapRow(data as AbsenceRow) };
}

export async function withdrawWfmAbsence(
  tenantId: string,
  userId: string,
  actorRoleKey: RoleKey | null,
  absenceId: string,
  employeeId?: string | null,
): Promise<ServiceResult<WfmAbsence>> {
  const denied = enforcePermission(actorRoleKey, 'portal.employee.absences.request');
  if (denied) return denied;

  const employeeResult = await resolveEmployeeIdForUser(tenantId, userId, employeeId);
  if (!employeeResult.ok) return employeeResult;

  const now = new Date().toISOString();

  if (getServiceMode() !== 'supabase') {
    const existing = demoAbsences.get(absenceId);
    if (!existing || existing.tenantId !== tenantId || existing.employeeId !== employeeResult.data) {
      return { ok: false, error: 'Abwesenheit nicht gefunden.' };
    }
    if (existing.status !== 'requested') {
      return { ok: false, error: 'Nur ausstehende Anträge können zurückgezogen werden.' };
    }
    const updated = { ...existing, status: 'cancelled' as const, updatedAt: now };
    demoAbsences.set(absenceId, updated);
    return { ok: true, data: updated };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { data, error } = await fromUnknownTable(supabase, TABLE)
    .update({ status: 'cancelled', updated_at: now })
    .eq('id', absenceId)
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeResult.data)
    .eq('status', 'requested')
    .select('*')
    .maybeSingle();

  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  if (!data) {
    return { ok: false, error: 'Antrag nicht gefunden oder bereits bearbeitet.' };
  }
  return { ok: true, data: mapRow(data as AbsenceRow) };
}

export async function reviewWfmAbsence(
  tenantId: string,
  reviewerId: string,
  actorRoleKey: RoleKey | null,
  absenceId: string,
  decision: 'approved' | 'rejected',
  rejectionReason?: string,
  approvalComment?: string,
): Promise<ServiceResult<WfmAbsence>> {
  const denied = enforcePermission(actorRoleKey, 'office.employees.absences.approve');
  if (denied) return denied;

  if (decision === 'rejected' && !rejectionReason?.trim()) {
    return { ok: false, error: 'Ablehnungsgrund ist erforderlich.' };
  }

  const newStatus: WfmAbsenceStatus = decision === 'approved' ? 'approved' : 'rejected';
  const now = new Date().toISOString();
  const internalNote =
    decision === 'rejected'
      ? rejectionReason?.trim() ?? ''
      : approvalComment?.trim() ?? '';

  if (getServiceMode() !== 'supabase') {
    const existing = demoAbsences.get(absenceId);
    if (!existing || existing.tenantId !== tenantId) {
      return { ok: false, error: 'Abwesenheit nicht gefunden.' };
    }
    const updated = {
      ...existing,
      status: newStatus,
      internalNote: internalNote || existing.internalNote,
      updatedAt: now,
    };
    demoAbsences.set(absenceId, updated);
    return { ok: true, data: updated };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const updatePayload: Record<string, unknown> = {
    status: newStatus,
    updated_at: now,
  };
  if (decision === 'rejected') {
    updatePayload.internal_note = rejectionReason?.trim() ?? '';
  } else if (approvalComment?.trim()) {
    updatePayload.internal_note = approvalComment.trim();
  }

  const { data, error } = await fromUnknownTable(supabase, TABLE)
    .update(updatePayload)
    .eq('id', absenceId)
    .eq('tenant_id', tenantId)
    .select('*')
    .single();

  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: mapRow(data as AbsenceRow) };
}
