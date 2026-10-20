import type { RoleKey, ServiceResult } from '@/types';
import type { WfmTimeAccount, WfmTrafficLight, WfmWorkSession } from '@/types/modules/wfm';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import {
  fetchSessionForDate,
  fetchSessionEvents,
  todayWorkDate,
  resolveEmployeeIdForUser,
} from './wfmWorkSessionRepository';
import { calculateContractTargetMinutesForRange } from './wfmContractTarget';
import { deriveWfmTimelineTotals } from './wfmTimeline';

const TABLE = 'workforce_time_accounts';

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
  const fromDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const toDate = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
  const contract = await loadContractWorkDays(tenantId, employeeId);
  if (!contract.ok) return contract;
  let actualMinutes = 0;
  let pauseMinutes = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const workDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const sessionResult = await fetchSessionForDate(tenantId, employeeId, workDate);
    if (!sessionResult.ok) return sessionResult;
    if (sessionResult.data) {
      const totals = await readSessionTotals(tenantId, sessionResult.data);
      if (!totals.ok) return totals;
      actualMinutes += totals.data.netMinutes;
      pauseMinutes += totals.data.pauseMinutes;
    }
  }
  const targetMinutes = calculateContractTargetMinutesForRange(contract.data, fromDate, toDate);
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
  const denied = enforcePermission(actorRoleKey, 'time.tracking.own.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  const employeeResult = await resolveEmployeeIdForUser(tenantId, userId, options?.employeeId);
  if (!employeeResult.ok) return employeeResult;
  const workDate = todayWorkDate();
  const [sessionResult, contract] = await Promise.all([
    fetchSessionForDate(tenantId, employeeResult.data, workDate),
    loadContractWorkDays(tenantId, employeeResult.data),
  ]);
  if (!sessionResult.ok) return sessionResult;
  if (!contract.ok) return contract;
  const session = sessionResult.data;
  const totals = session ? await readSessionTotals(tenantId, session) : { ok: true as const, data: { netMinutes: 0 } };
  if (!totals.ok) return totals;
  const actualMinutes = totals.data.netMinutes;
  const targetMinutes = calculateContractTargetMinutesForRange(contract.data, workDate, workDate);
  const trafficLight = computeTrafficLight(actualMinutes, targetMinutes);
  return { ok: true, data: { trafficLight, actualMinutes, targetMinutes } };
}

async function readSessionTotals(tenantId: string, session: WfmWorkSession): Promise<ServiceResult<{ netMinutes: number; pauseMinutes: number }>> {
  // Closed sessions can include approved corrections. Active sessions store
  // their elapsed totals only at clock-out, so read the same real timeline as
  // the workday controls instead of reporting their initial zero indefinitely.
  if (session.isOnline && !session.endedAt && session.id) {
    const events = await fetchSessionEvents(tenantId, session.id);
    if (!events.ok) return events;
    const totals = deriveWfmTimelineTotals(events.data, { session });
    if (totals.blockCount === 0) return { ok: false, error: 'Die laufende Arbeitszeit konnte nicht aus den Zeitereignissen ermittelt werden. Bitte erneut laden.' };
    return { ok: true, data: totals };
  }
  // A zero net duration is valid, for example a fully paused session.
  return { ok: true, data: { netMinutes: session.netMinutes ?? session.grossMinutes, pauseMinutes: session.pauseMinutes } };
}

async function loadContractWorkDays(tenantId: string, employeeId: string): Promise<ServiceResult<Record<string, unknown>>> {
  if (getServiceMode() !== 'supabase') return { ok: true, data: {} };
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
  const { data, error } = await fromUnknownTable(supabase, 'employee_contract_settings')
    .select('work_days').eq('tenant_id', tenantId).eq('employee_id', employeeId).maybeSingle();
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  const schedule = (data as { work_days?: unknown } | null)?.work_days;
  if (!schedule || typeof schedule !== 'object' || Array.isArray(schedule)) {
    return { ok: false, error: 'Die vertragliche Sollzeit ist noch nicht hinterlegt oder nicht freigegeben. Bitte die Verwaltung kontaktieren.' };
  }
  return { ok: true, data: schedule as Record<string, unknown> };
}
