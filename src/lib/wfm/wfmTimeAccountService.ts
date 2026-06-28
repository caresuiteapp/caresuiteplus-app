import type { RoleKey, ServiceResult } from '@/types';
import type { WfmTimeAccount, WfmTrafficLight } from '@/types/modules/wfm';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import {
  fetchEmployeeEventsInRange,
  listSessionsForDate,
  resolveEmployeeIdForUser,
} from './wfmWorkSessionRepository';

const TABLE = 'workforce_time_accounts';
const DEFAULT_TARGET_MINUTES = 8 * 60;

type AccountRow = {
  id: string;
  tenant_id: string;
  employee_id: string;
  period_year: number;
  period_month: number;
  target_minutes: number;
  actual_minutes: number;
  overtime_minutes: number;
  undertime_minutes: number;
  pause_minutes: number;
  vacation_days_used: number;
  sick_days: number;
  traffic_light: WfmTrafficLight | null;
  is_closed: boolean;
};

const demoAccounts = new Map<string, WfmTimeAccount>();

function accountKey(tenantId: string, employeeId: string, year: number, month: number): string {
  return `${tenantId}:${employeeId}:${year}:${month}`;
}

function mapRow(row: AccountRow): WfmTimeAccount {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    employeeId: row.employee_id,
    periodYear: row.period_year,
    periodMonth: row.period_month,
    targetMinutes: row.target_minutes,
    actualMinutes: row.actual_minutes,
    overtimeMinutes: row.overtime_minutes,
    undertimeMinutes: row.undertime_minutes,
    pauseMinutes: row.pause_minutes,
    vacationDaysUsed: row.vacation_days_used,
    sickDays: row.sick_days,
    trafficLight: row.traffic_light,
    isClosed: row.is_closed,
  };
}

function computeTrafficLight(actual: number, target: number): WfmTrafficLight {
  if (target <= 0) return 'green';
  const ratio = actual / target;
  if (ratio >= 0.95 && ratio <= 1.05) return 'green';
  if (ratio >= 0.85 && ratio <= 1.15) return 'yellow';
  return 'red';
}

export function resetWfmTimeAccountDemoStore(): void {
  demoAccounts.clear();
}

export async function getWfmTimeAccountForMonth(
  tenantId: string,
  userId: string,
  actorRoleKey: RoleKey | null,
  year: number,
  month: number,
  options?: { employeeId?: string | null },
): Promise<ServiceResult<WfmTimeAccount>> {
  const denied = enforcePermission(actorRoleKey, 'time.tracking.own.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const employeeResult = await resolveEmployeeIdForUser(tenantId, userId, options?.employeeId);
  if (!employeeResult.ok) return employeeResult;

  const employeeId = employeeResult.data;
  const key = accountKey(tenantId, employeeId, year, month);

  if (getServiceMode() !== 'supabase') {
    const cached = demoAccounts.get(key);
    if (cached) return { ok: true, data: cached };
    const computed = await aggregateWfmTimeAccount(tenantId, employeeId, year, month);
    if (!computed.ok) return computed;
    demoAccounts.set(key, computed.data);
    return computed;
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { data, error } = await fromUnknownTable(supabase, TABLE)
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .eq('period_year', year)
    .eq('period_month', month)
    .maybeSingle();

  if (error) {
    if (isSupabaseMissingTableError(error)) {
      return aggregateWfmTimeAccount(tenantId, employeeId, year, month);
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  if (data) return { ok: true, data: mapRow(data as AccountRow) };
  return aggregateWfmTimeAccount(tenantId, employeeId, year, month);
}

async function aggregateWfmTimeAccount(
  tenantId: string,
  employeeId: string,
  year: number,
  month: number,
): Promise<ServiceResult<WfmTimeAccount>> {
  const from = new Date(year, month - 1, 1).toISOString();
  const to = new Date(year, month, 0, 23, 59, 59, 999).toISOString();

  let actualMinutes = 0;
  let pauseMinutes = 0;

  const daysInMonth = new Date(year, month, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const workDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const sessionsResult = await listSessionsForDate(tenantId, workDate);
    if (!sessionsResult.ok) continue;
    const session = sessionsResult.data.find((s) => s.employeeId === employeeId);
    if (session) {
      actualMinutes += session.netMinutes || session.grossMinutes;
      pauseMinutes += session.pauseMinutes;
    }
  }

  const eventsResult = await fetchEmployeeEventsInRange(tenantId, employeeId, from, to);
  if (eventsResult.ok && actualMinutes === 0) {
    actualMinutes = Math.round(eventsResult.data.length * 15);
  }

  const targetMinutes = DEFAULT_TARGET_MINUTES * 22;
  const diff = actualMinutes - targetMinutes;
  const account: WfmTimeAccount = {
    id: accountKey(tenantId, employeeId, year, month),
    tenantId,
    employeeId,
    periodYear: year,
    periodMonth: month,
    targetMinutes,
    actualMinutes,
    overtimeMinutes: Math.max(0, diff),
    undertimeMinutes: Math.max(0, -diff),
    pauseMinutes,
    vacationDaysUsed: 0,
    sickDays: 0,
    trafficLight: computeTrafficLight(actualMinutes, targetMinutes),
    isClosed: false,
  };

  return { ok: true, data: account };
}

export async function getWfmTodayAmpel(
  tenantId: string,
  userId: string,
  actorRoleKey: RoleKey | null,
  options?: { employeeId?: string | null },
): Promise<ServiceResult<{ trafficLight: WfmTrafficLight; actualMinutes: number; targetMinutes: number }>> {
  const now = new Date();
  const sessionResult = await listSessionsForDate(tenantId, now.toISOString().slice(0, 10));
  if (!sessionResult.ok) return sessionResult;

  const employeeResult = await resolveEmployeeIdForUser(tenantId, userId, options?.employeeId);
  if (!employeeResult.ok) return employeeResult;

  const session = sessionResult.data.find((s) => s.employeeId === employeeResult.data);
  const actualMinutes = session?.netMinutes ?? session?.grossMinutes ?? 0;
  const targetMinutes = DEFAULT_TARGET_MINUTES;
  const trafficLight = computeTrafficLight(actualMinutes, targetMinutes);

  return { ok: true, data: { trafficLight, actualMinutes, targetMinutes } };
}
