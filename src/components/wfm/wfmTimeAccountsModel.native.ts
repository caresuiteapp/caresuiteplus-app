// Generated native presentation from src/components/wfm/wfmTimeAccountsModel.web.ts. Update through scripts/port-native-workspaces.mjs.
import type { WfmOfficeEmployeeTimeAccount } from '@/types/modules/wfmOfficeTimekeeping';
export type AccountReviewFilter = 'all' | 'open' | 'negative';
export type AccountSort = 'name' | 'reviews' | 'balance';
export type AccountPeriodPreset = 'today' | 'this_week' | 'this_month';
export const queryValue = (value: string | string[] | undefined): string => (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
export const validAccountMonth = (value: string): boolean => /^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(value);
export const accountReviewFilter = (value: string): AccountReviewFilter => value === 'open' || value === 'negative' ? value : 'all';
export const accountSort = (value: string): AccountSort => value === 'reviews' || value === 'balance' ? value : 'name';
export const accountPeriodPreset = (value: string): AccountPeriodPreset => value === 'today' || value === 'this_week' ? value : 'this_month';
function searchText(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('de-DE').replace(/ß/g, 'ss');
}
export function selectTimeAccounts(accounts: WfmOfficeEmployeeTimeAccount[], filters: {
    search: string;
    employeeId: string;
    review: AccountReviewFilter;
    sort: AccountSort;
}): WfmOfficeEmployeeTimeAccount[] {
    const terms = searchText(filters.search.trim()).split(/\s+/).filter(Boolean);
    const names = (left: WfmOfficeEmployeeTimeAccount, right: WfmOfficeEmployeeTimeAccount) => left.employeeName.localeCompare(right.employeeName, 'de') || left.employeeId.localeCompare(right.employeeId);
    return accounts.filter(account => (!filters.employeeId || account.employeeId === filters.employeeId)
        && terms.every(term => searchText(account.employeeName).includes(term))
        && (filters.review !== 'open' || account.openReviewCount > 0)
        && (filters.review !== 'negative' || account.saldoMinutes < 0)).sort((left, right) => {
        if (filters.sort === 'reviews')
            return right.openReviewCount - left.openReviewCount || names(left, right);
        if (filters.sort === 'balance')
            return left.saldoMinutes - right.saldoMinutes || names(left, right);
        return names(left, right);
    });
}
export function timeAccountTotals(accounts: WfmOfficeEmployeeTimeAccount[]) {
    return accounts.reduce((total, account) => ({
        employees: total.employees + 1,
        targetMinutes: total.targetMinutes + account.targetMinutes,
        actualMinutes: total.actualMinutes + account.actualMinutes,
        approvedMinutes: total.approvedMinutes + account.approvedMinutes,
        saldoMinutes: total.saldoMinutes + account.saldoMinutes,
        absenceMinutes: total.absenceMinutes + account.absenceMinutes,
        openReviews: total.openReviews + account.openReviewCount,
    }), { employees: 0, targetMinutes: 0, actualMinutes: 0, approvedMinutes: 0, saldoMinutes: 0, absenceMinutes: 0, openReviews: 0 });
}
export function accountDuration(minutes: number, signed = false): string {
    const rounded = Math.round(minutes);
    const absolute = Math.abs(rounded);
    const prefix = rounded < 0 ? '−' : signed && rounded > 0 ? '+' : '';
    return `${prefix}${Math.floor(absolute / 60).toLocaleString('de-DE')}:${String(absolute % 60).padStart(2, '0')} h`;
}
export function accountDays(days: number | null): string {
    return days === null ? 'Nicht hinterlegt' : `${days.toLocaleString('de-DE', { maximumFractionDigits: 1 })} Tage`;
}
export function accountInitials(name: string): string {
    return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toLocaleUpperCase('de-DE');
}
