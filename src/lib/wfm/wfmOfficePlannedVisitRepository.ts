import type { ServiceResult } from '@/types';
import type { WfmOfficePlannedVisit } from '@/types/modules/wfmOfficeTimekeeping';
import { getServiceMode } from '@/lib/services/mode';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';

const CANCELLED_STATUSES = new Set(['cancelled', 'storniert', 'no_show', 'nicht_erschienen']);

type AssignmentRow = {
  id: string;
  tenant_id: string;
  client_id: string | null;
  employee_id: string | null;
  assignment_date: string;
  planned_start_at: string | null;
  planned_end_at: string | null;
  actual_start_at: string | null;
  actual_end_at: string | null;
  status: string | null;
  title: string | null;
  clients?: { first_name: string | null; last_name: string | null } | null;
};

const demoPlannedVisits = new Map<string, WfmOfficePlannedVisit[]>();

function demoKey(tenantId: string, fromDate: string, toDate: string): string {
  return `${tenantId}:${fromDate}:${toDate}`;
}

export function resetWfmOfficePlannedVisitDemoStore(): void {
  demoPlannedVisits.clear();
}

export function seedWfmOfficePlannedVisits(tenantId: string, visits: WfmOfficePlannedVisit[]): void {
  for (const visit of visits) {
    const key = demoKey(tenantId, visit.workDate, visit.workDate);
    const list = demoPlannedVisits.get(key) ?? [];
    list.push(visit);
    demoPlannedVisits.set(key, list);
  }
}

function clientLabelFromRow(row: AssignmentRow): string | null {
  const client = row.clients;
  if (!client) return null;
  const name = [client.first_name, client.last_name].filter(Boolean).join(' ').trim();
  return name || null;
}

function mapAssignmentRow(row: AssignmentRow): WfmOfficePlannedVisit | null {
  if (!row.employee_id) return null;
  const status = row.status ?? '';
  if (CANCELLED_STATUSES.has(status)) return null;
  const workDate = row.assignment_date?.slice(0, 10) ?? '';
  if (!workDate) return null;
  return {
    assignmentId: row.id,
    visitId: row.id,
    tenantId: row.tenant_id,
    employeeId: row.employee_id,
    workDate,
    plannedStartAt: row.planned_start_at,
    plannedEndAt: row.planned_end_at,
    assignmentActualStartAt: row.actual_start_at,
    assignmentActualEndAt: row.actual_end_at,
    clientLabel: clientLabelFromRow(row),
    assignmentTitle: row.title?.trim() || 'Einsatz',
    assignmentStatus: status,
  };
}

export async function listPlannedVisitsForPeriod(
  tenantId: string,
  fromDate: string,
  toDate: string,
): Promise<ServiceResult<WfmOfficePlannedVisit[]>> {
  if (getServiceMode() !== 'supabase') {
    const results: WfmOfficePlannedVisit[] = [];
    for (const [key, list] of demoPlannedVisits.entries()) {
      if (!key.startsWith(`${tenantId}:`)) continue;
      for (const visit of list) {
        if (visit.workDate >= fromDate && visit.workDate <= toDate) {
          results.push(visit);
        }
      }
    }
    return { ok: true, data: results };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const select =
    'id, tenant_id, client_id, employee_id, assignment_date, planned_start_at, planned_end_at, actual_start_at, actual_end_at, status, title, clients(first_name, last_name)';

  const { data, error } = await fromUnknownTable(supabase, 'assignments')
    .select(select)
    .eq('tenant_id', tenantId)
    .gte('assignment_date', fromDate)
    .lte('assignment_date', toDate)
    .not('employee_id', 'is', null)
    .order('planned_start_at', { ascending: true });

  if (error) {
    if (isSupabaseMissingTableError(error)) return { ok: true, data: [] };
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  const visits: WfmOfficePlannedVisit[] = [];
  for (const row of (data ?? []) as unknown as AssignmentRow[]) {
    const mapped = mapAssignmentRow(row);
    if (mapped) visits.push(mapped);
  }
  return { ok: true, data: visits };
}

export async function fetchActiveEmployeeIds(tenantId: string): Promise<ServiceResult<string[]>> {
  if (getServiceMode() !== 'supabase') {
    const ids = new Set<string>();
    for (const [key] of demoPlannedVisits.entries()) {
      if (!key.startsWith(`${tenantId}:`)) continue;
    }
    for (const list of demoPlannedVisits.values()) {
      for (const v of list) {
        if (v.tenantId === tenantId) ids.add(v.employeeId);
      }
    }
    return { ok: true, data: [...ids] };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { data, error } = await supabase
    .from('employees')
    .select('id')
    .eq('tenant_id', tenantId);

  if (error) {
    if (isSupabaseMissingTableError(error)) return { ok: true, data: [] };
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: (data ?? []).map((r) => (r as { id: string }).id) };
}
