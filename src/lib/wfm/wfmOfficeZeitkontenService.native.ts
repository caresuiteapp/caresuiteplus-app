// Generated native presentation from src/lib/wfm/wfmOfficeZeitkontenService.web.ts. Update through scripts/port-native-workspaces.mjs.
import { calculateOfficeLogbookTime } from './wfmOfficeLinkedTotals';
import { isLogbookTripInBerlinRange } from '@/lib/employeeLogbook/employeeLogbookDate';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import type { RoleKey, ServiceResult } from '@/types';
import type { WfmOfficeEmployeeTimeAccount, WfmOfficeTimeEntry, WfmOfficePeriodPreset } from '@/types/modules/wfmOfficeTimekeeping';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from "../supabase/client.ts";
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { resolveWfmOfficeTimeDisplay } from './wfmOfficeTimeDisplayResolver';
import { getWfmOfficeTimeOverview } from "./wfmOfficeTimekeepingService.native.ts";
import { calculateContractTargetMinutesForRange } from './wfmContractTarget';
import { calculateOfficeAbsenceCredit, hasOfficeContractSchedule, isOfficeAccountOpenReview, officeAccountRecordedMinutes, readOfficeEmployeeAccountRows, resolveOfficeAccountTarget, } from './wfmOfficeAccountTotals';
export { calculateContractTargetMinutesForRange } from './wfmContractTarget';
type Row = Record<string, unknown>;
const numberValue = (value: unknown): number => (typeof value === 'number' || typeof value === 'string') && Number.isFinite(Number(value)) ? Number(value) : 0;
const stringValue = (value: unknown): string => typeof value === 'string' ? value : '';
function emptyAccount(employeeId: string, employeeName: string, vacationYear: number): WfmOfficeEmployeeTimeAccount {
    return {
        employeeId, employeeName, plannedMinutes: 0, actualMinutes: 0, approvedMinutes: 0,
        exportedMinutes: 0, saldoMinutes: 0, openReviewCount: 0, targetMinutes: 0,
        overtimeMinutes: 0, undertimeMinutes: 0, travelMinutes: 0, absenceMinutes: 0,
        vacationDaysUsed: 0, sickDays: 0, annualVacationDays: null, remainingVacationDays: null,
        vacationYear, payrollStatements: [], entries: [],
    };
}
function rowsByEmployee(rows: Row[]): Map<string, Row[]> {
    const result = new Map<string, Row[]>();
    for (const row of rows) {
        const employeeId = stringValue(row.employee_id);
        const bucket = result.get(employeeId) ?? [];
        bucket.push(row);
        result.set(employeeId, bucket);
    }
    return result;
}
export async function getWfmOfficeEmployeeTimeAccounts(tenantId: string, actorRoleKey: RoleKey | null, options?: {
    preset?: WfmOfficePeriodPreset;
    fromDate?: string | null;
    toDate?: string | null;
    employeeId?: string | null;
}): Promise<ServiceResult<WfmOfficeEmployeeTimeAccount[]>> {
    const denied = enforcePermission(actorRoleKey, 'time.tracking.team.view');
    if (denied)
        return denied;
    const tenantBlock = guardServiceTenant(tenantId);
    if (tenantBlock)
        return tenantBlock;
    try {
        const overview = await getWfmOfficeTimeOverview(tenantId, actorRoleKey, {
            preset: options?.preset ?? 'this_month', fromDate: options?.fromDate, toDate: options?.toDate,
            filters: options?.employeeId ? { employeeIds: [options.employeeId] } : undefined,
        });
        if (!overview.ok)
            return overview;
        const { fromDate, toDate } = overview.data.period;
        const vacationYear = Number(toDate.slice(0, 4));
        const byEmployee = new Map<string, WfmOfficeEmployeeTimeAccount>();
        for (const employee of overview.data.employees) {
            if (!options?.employeeId || employee.id === options.employeeId)
                byEmployee.set(employee.id, emptyAccount(employee.id, employee.name, vacationYear));
        }
        for (const entry of overview.data.entries) {
            if (entry.tenantId !== tenantId || (options?.employeeId && entry.employeeId !== options.employeeId))
                continue;
            const account = byEmployee.get(entry.employeeId) ?? emptyAccount(entry.employeeId, entry.employeeName, vacationYear);
            const duration = officeAccountRecordedMinutes(entry);
            account.plannedMinutes += resolveWfmOfficeTimeDisplay(entry).plannedDurationMinutes;
            account.actualMinutes += duration;
            if (entry.reviewStatus === 'approved' || entry.reviewStatus === 'exported')
                account.approvedMinutes += duration;
            if (entry.exportStatus === 'exported')
                account.exportedMinutes += duration;
            if (isOfficeAccountOpenReview(entry))
                account.openReviewCount += 1;
            account.entries.push(entry);
            byEmployee.set(entry.employeeId, account);
        }
        const targets = new Map<string, {
            contract: number | null;
            saved: number | null;
        }>();
        if (getServiceMode() === 'supabase') {
            const supabase = getSupabaseClient();
            if (!supabase)
                return { ok: false, error: 'Die Verbindung für Zeitkonten ist nicht verfügbar. Bitte erneut anmelden oder laden.' };
            if (byEmployee.size > 0) {
                const employeeIds = [...byEmployee.keys()];
                const lower = new Date(`${fromDate}T00:00:00Z`);
                lower.setUTCDate(lower.getUTCDate() - 1);
                const upper = new Date(`${toDate}T00:00:00Z`);
                upper.setUTCDate(upper.getUTCDate() + 1);
                const [accountsResult, contractsResult, statementsResult, absencesResult, tripsResult] = await Promise.all([
                    readOfficeEmployeeAccountRows(employeeIds, (batch, first, last) => fromUnknownTable(supabase, 'workforce_time_accounts')
                        .select('employee_id, period_year, period_month, target_minutes, vacation_days_used, sick_days')
                        .eq('tenant_id', tenantId).in('employee_id', batch)
                        .gte('period_year', Number(fromDate.slice(0, 4))).lte('period_year', vacationYear)
                        .order('employee_id').order('period_year').order('period_month').range(first, last)),
                    readOfficeEmployeeAccountRows(employeeIds, (batch, first, last) => fromUnknownTable(supabase, 'employee_contract_settings')
                        .select('employee_id, annual_vacation_days, work_days').eq('tenant_id', tenantId).in('employee_id', batch)
                        .order('employee_id').range(first, last)),
                    readOfficeEmployeeAccountRows(employeeIds, (batch, first, last) => fromUnknownTable(supabase, 'payroll_month_statements')
                        .select('id, employee_id, period_year, period_month, version, status, pdf_path, created_at')
                        .eq('tenant_id', tenantId).in('employee_id', batch)
                        .order('period_year', { ascending: false }).order('period_month', { ascending: false })
                        .order('version', { ascending: false }).order('id').range(first, last)),
                    readOfficeEmployeeAccountRows(employeeIds, (batch, first, last) => fromUnknownTable(supabase, 'workforce_absences')
                        .select('id, employee_id, absence_type, status, starts_at, ends_at, all_day')
                        .eq('tenant_id', tenantId).in('employee_id', batch)
                        .lte('starts_at', upper.toISOString()).gte('ends_at', lower.toISOString())
                        .order('starts_at').order('id').range(first, last)),
                    readOfficeEmployeeAccountRows(employeeIds, (batch, first, last) => fromUnknownTable(supabase, 'employee_logbook_trips')
                        .select('id, employee_id, started_at, ended_at, status, counts_as_work_time')
                        .eq('tenant_id', tenantId).in('employee_id', batch)
                        .gte('started_at', lower.toISOString()).lte('started_at', `${toDate}T23:59:59Z`)
                        .order('started_at').order('id').range(first, last)),
                ]);
                const error = [accountsResult, contractsResult, statementsResult, absencesResult, tripsResult].find(result => result.error)?.error;
                if (error)
                    return { ok: false, error: error instanceof Error ? error.message : toGermanSupabaseError(error) };
                const savedByEmployee = rowsByEmployee(accountsResult.data);
                const contractsByEmployee = rowsByEmployee(contractsResult.data);
                const absencesByEmployee = rowsByEmployee(absencesResult.data);
                const tripsByEmployee = rowsByEmployee(tripsResult.data);
                const statementsByEmployee = rowsByEmployee(statementsResult.data);
                const fromMonth = Number(fromDate.slice(0, 4)) * 12 + Number(fromDate.slice(5, 7));
                const toMonth = vacationYear * 12 + Number(toDate.slice(5, 7));
                const finalMonthEnd = new Date(Date.UTC(vacationYear, Number(toDate.slice(5, 7)), 0)).getUTCDate();
                const coversWholeMonths = fromDate.endsWith('-01') && Number(toDate.slice(8)) === finalMonthEnd;
                for (const account of byEmployee.values()) {
                    const savedRows = savedByEmployee.get(account.employeeId) ?? [];
                    const selectedMonths = new Map<number, number>();
                    for (const row of savedRows) {
                        const year = numberValue(row.period_year), month = numberValue(row.period_month);
                        if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12)
                            continue;
                        if (year === vacationYear) {
                            account.vacationDaysUsed += numberValue(row.vacation_days_used);
                            account.sickDays += numberValue(row.sick_days);
                        }
                        const key = year * 12 + month;
                        if (key >= fromMonth && key <= toMonth && row.target_minutes != null)
                            selectedMonths.set(key, Math.max(0, numberValue(row.target_minutes)));
                    }
                    const saved = coversWholeMonths && selectedMonths.size === toMonth - fromMonth + 1
                        ? [...selectedMonths.values()].reduce((sum, value) => sum + value, 0) : null;
                    const contract = contractsByEmployee.get(account.employeeId)?.[0];
                    const hasSchedule = hasOfficeContractSchedule(contract?.work_days);
                    targets.set(account.employeeId, {
                        contract: hasSchedule ? calculateContractTargetMinutesForRange(contract!.work_days, fromDate, toDate) : null,
                        saved,
                    });
                    if (contract?.annual_vacation_days != null)
                        account.annualVacationDays = numberValue(contract.annual_vacation_days);
                    account.absenceMinutes = calculateOfficeAbsenceCredit(absencesByEmployee.get(account.employeeId) ?? [], contract?.work_days, fromDate, toDate);
                    const trips = (tripsByEmployee.get(account.employeeId) ?? []).filter(trip => isLogbookTripInBerlinRange(stringValue(trip.started_at), fromDate, toDate));
                    const travel = calculateOfficeLogbookTime(trips.map(trip => ({ started_at: trip.started_at, ended_at: trip.ended_at, status: trip.status, counts_as_work_time: trip.counts_as_work_time })), account.entries);
                    account.travelMinutes = travel.travelMinutes;
                    account.logbookAdditionalMinutes = travel.additionalMinutes;
                    account.actualMinutes += travel.additionalMinutes;
                    account.payrollStatements = (statementsByEmployee.get(account.employeeId) ?? []).map(row => ({
                        id: stringValue(row.id), periodYear: numberValue(row.period_year), periodMonth: numberValue(row.period_month),
                        version: numberValue(row.version), status: stringValue(row.status), pdfPath: stringValue(row.pdf_path) || null,
                        createdAt: stringValue(row.created_at),
                    }));
                }
            }
        }
        const accounts = [...byEmployee.values()].map(account => {
            const target = targets.get(account.employeeId);
            const resolved = resolveOfficeAccountTarget(target?.contract ?? null, target?.saved ?? null, account.plannedMinutes);
            const creditedMinutes = account.actualMinutes + account.absenceMinutes;
            const saldoMinutes = creditedMinutes - resolved.targetMinutes;
            return { ...account, ...resolved, saldoMinutes,
                overtimeMinutes: Math.max(0, saldoMinutes), undertimeMinutes: Math.max(0, -saldoMinutes),
                remainingVacationDays: account.annualVacationDays == null ? null : account.annualVacationDays - account.vacationDaysUsed,
                entries: account.entries.sort((a, b) => b.workDate.localeCompare(a.workDate)),
            };
        });
        accounts.sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'de'));
        return { ok: true, data: accounts };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Die Zeitkonten konnten nicht vollständig geladen werden. Bitte erneut versuchen.' };
    }
}
export function summarizeOfficeTimeAccountKpis(accounts: WfmOfficeEmployeeTimeAccount[]) {
    const hours = (pick: (account: WfmOfficeEmployeeTimeAccount) => number) => Math.round(accounts.reduce((sum, account) => sum + pick(account), 0) / 6) / 10;
    return {
        employees: accounts.length, plannedHours: hours(account => account.plannedMinutes),
        actualHours: hours(account => account.actualMinutes), approvedHours: hours(account => account.approvedMinutes),
        exportedHours: hours(account => account.exportedMinutes),
        openReviews: accounts.reduce((sum, account) => sum + account.openReviewCount, 0),
    };
}
export function listOpenReviewEntriesForEmployee(account: WfmOfficeEmployeeTimeAccount): WfmOfficeTimeEntry[] {
    return account.entries.filter(isOfficeAccountOpenReview);
}
