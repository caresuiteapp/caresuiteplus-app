import type { ServiceResult } from '@/types';
import { listAssignmentWorkflows } from '@/lib/assist/assignmentWorkflowService';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { getServiceMode } from '@/lib/services/mode';

export const OFFICE_DELETE_ASSIGNMENT_BLOCK =
  'Einsätze vorhanden — bitte zuerst archivieren.';

const TERMINAL_ASSIGNMENT_STATUSES = new Set(['completed', 'cancelled', 'no_show']);

function countActiveDemoAssignments(
  tenantId: string,
  filter: { clientId?: string; employeeId?: string },
): number {
  return listAssignmentWorkflows(tenantId).filter((assignment) => {
    if (filter.clientId && assignment.clientId !== filter.clientId) return false;
    if (filter.employeeId && assignment.employeeId !== filter.employeeId) return false;
    return !TERMINAL_ASSIGNMENT_STATUSES.has(assignment.canonicalStatus);
  }).length;
}

async function countActiveLiveAssignments(
  tenantId: string,
  filter: { clientId?: string; employeeId?: string },
): Promise<ServiceResult<number>> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, error: 'Supabase ist nicht verfügbar.' };
  }

  let query = supabase
    .from('assignments')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .not('status', 'in', '("completed","cancelled","no_show")');

  if (filter.clientId) {
    query = query.eq('client_id', filter.clientId);
  }
  if (filter.employeeId) {
    query = query.eq('employee_id', filter.employeeId);
  }

  const { count, error } = await query;
  if (error) {
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: count ?? 0 };
}

async function assertNoActiveAssignments(
  tenantId: string,
  filter: { clientId?: string; employeeId?: string },
): Promise<ServiceResult<void> | null> {
  if (getServiceMode() === 'supabase') {
    const countResult = await countActiveLiveAssignments(tenantId, filter);
    if (!countResult.ok) return countResult;
    if (countResult.data > 0) {
      return { ok: false, error: OFFICE_DELETE_ASSIGNMENT_BLOCK };
    }
    return null;
  }

  if (countActiveDemoAssignments(tenantId, filter) > 0) {
    return { ok: false, error: OFFICE_DELETE_ASSIGNMENT_BLOCK };
  }

  return null;
}

export async function assertNoActiveAssignmentsForClient(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<void> | null> {
  return assertNoActiveAssignments(tenantId, { clientId });
}

export async function assertNoActiveAssignmentsForEmployee(
  tenantId: string,
  employeeId: string,
): Promise<ServiceResult<void> | null> {
  return assertNoActiveAssignments(tenantId, { employeeId });
}
