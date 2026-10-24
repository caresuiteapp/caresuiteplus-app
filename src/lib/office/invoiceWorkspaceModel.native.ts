// Generated native presentation from src/lib/office/invoiceWorkspaceModel.web.ts. Update through scripts/port-native-workspaces.mjs.
import type { InvoiceStatus } from '@/types/modules/billing';
import type { OfficeInvoice } from "./invoiceWorkspaceService.native.ts";
export const invoiceStatusChoices = [
    ['all', 'Alle Status'], ['open', 'Offene Forderungen'], ['overdue', 'Überfällig'],
    ['draft', 'Entwürfe'], ['ready', 'Bereit'], ['sent', 'Versendet'], ['partly_paid', 'Teilbezahlt'],
    ['paid', 'Bezahlt'], ['cancelled', 'Storniert'], ['written_off', 'Abgeschrieben'], ['issues', 'Mit Prüfbedarf'],
] as const;
export type InvoiceWorkspaceStatus = typeof invoiceStatusChoices[number][0];
export type InvoiceWorkspaceSort = 'newest' | 'due' | 'number' | 'client' | 'amount';
export type InvoiceWorkspaceRow = Pick<OfficeInvoice, 'id' | 'clientName' | 'invoiceNumber' | 'status' | 'invoiceDate' | 'dueDate' | 'amountCents' | 'paidCents' | 'openCents' | 'recipient' | 'issues'>;
export function invoiceParam(value: string | string[] | undefined): string { return typeof value === 'string' ? value : ''; }
export function invoiceMonth(value: string): string { return /^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(value) ? value : ''; }
export function invoiceFilter(value: string): InvoiceWorkspaceStatus { return invoiceStatusChoices.some(([key]) => key === value) ? value as InvoiceWorkspaceStatus : 'all'; }
export function invoiceSort(value: string): InvoiceWorkspaceSort { return ['newest', 'due', 'number', 'client', 'amount'].includes(value) ? value as InvoiceWorkspaceSort : 'newest'; }
export function invoiceDay(date = new Date()): string { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date); }
export function addInvoiceDays(day: string, days: number): string { const date = new Date(`${day}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
export function formatInvoiceDate(day: string | null): string { if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day))
    return '—'; const parsed = new Date(`${day}T12:00:00Z`); return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day ? day.split('-').reverse().join('.') : '—'; }
export function formatInvoiceMoney(cents: number | null): string { return validCents(cents) ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100) : '—'; }
export function invoiceDisplayNumber(row: Pick<InvoiceWorkspaceRow, 'invoiceNumber' | 'status'>): string { return !row.invoiceNumber || /^DRAFT-/i.test(row.invoiceNumber) ? row.status === 'draft' ? 'Entwurf' : 'Rechnungsnummer fehlt' : row.invoiceNumber; }
function validCents(value: number | null): value is number { return typeof value === 'number' && Number.isSafeInteger(value); }
function fold(value: string): string { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('de-DE').replace(/ß/g, 'ss'); }
export function invoiceReceivable(row: Pick<InvoiceWorkspaceRow, 'status'>): boolean { return ['sent', 'partly_paid', 'overdue'].includes(row.status); }
export function invoiceOverdue(row: Pick<InvoiceWorkspaceRow, 'status' | 'dueDate' | 'openCents'>, today: string): boolean {
    if (!invoiceReceivable(row) || (row.openCents !== null && row.openCents <= 0))
        return false;
    return row.status === 'overdue' || Boolean(row.dueDate && row.dueDate < today);
}
export function invoiceTone(status: InvoiceStatus): string {
    if (status === 'paid')
        return 'good';
    if (status === 'overdue')
        return 'bad';
    if (status === 'partly_paid')
        return 'warning';
    if (status === 'ready' || status === 'sent')
        return 'blue';
    return 'muted';
}
export function selectWorkspaceInvoices<T extends InvoiceWorkspaceRow>(rows: readonly T[], filters: {
    search: string;
    month: string;
    status: InvoiceWorkspaceStatus;
    sort: InvoiceWorkspaceSort;
    today: string;
}): T[] {
    const terms = fold(filters.search.trim()).split(/\s+/).filter(Boolean);
    return rows.filter(row => {
        if (filters.month && !row.invoiceDate.startsWith(filters.month))
            return false;
        const haystack = fold(`${row.invoiceNumber} ${row.clientName} ${row.recipient.name}`);
        if (terms.some(term => !haystack.includes(term)))
            return false;
        if (filters.status === 'open')
            return invoiceReceivable(row) && (row.openCents === null || row.openCents > 0);
        if (filters.status === 'overdue')
            return invoiceOverdue(row, filters.today);
        if (filters.status === 'issues')
            return row.issues.length > 0;
        return filters.status === 'all' || row.status === filters.status;
    }).sort((a, b) => {
        let compared = 0;
        if (filters.sort === 'client')
            compared = a.clientName.localeCompare(b.clientName, 'de');
        else if (filters.sort === 'number')
            compared = b.invoiceNumber.localeCompare(a.invoiceNumber, 'de', { numeric: true });
        else if (filters.sort === 'amount')
            compared = (validCents(b.amountCents) ? b.amountCents : -Infinity) - (validCents(a.amountCents) ? a.amountCents : -Infinity);
        else if (filters.sort === 'due')
            compared = (a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31');
        else
            compared = b.invoiceDate.localeCompare(a.invoiceDate);
        return (Number.isNaN(compared) ? 0 : compared) || a.id.localeCompare(b.id);
    });
}
export function invoiceWorkspaceTotals(rows: readonly InvoiceWorkspaceRow[], today: string) {
    const receivables = rows.filter(row => invoiceReceivable(row) && (row.openCents === null || row.openCents > 0));
    const overdue = receivables.filter(row => invoiceOverdue(row, today));
    const amount = (items: readonly InvoiceWorkspaceRow[]) => ({ cents: items.reduce((sum, row) => sum + (validCents(row.openCents) ? Math.max(0, row.openCents) : 0), 0), known: items.filter(row => validCents(row.openCents)).length, count: items.length });
    return { count: rows.length, drafts: rows.filter(row => row.status === 'draft').length, issues: rows.filter(row => row.issues.length).length, open: amount(receivables), overdue: amount(overdue) };
}
export function invoiceTotalHint(total: {
    known: number;
    count: number;
}, empty: string): string {
    if (!total.count)
        return empty;
    return total.known === total.count ? `${total.count} ${total.count === 1 ? 'Rechnung' : 'Rechnungen'}` : `Teilsumme · ${total.known} von ${total.count} Beträgen bekannt`;
}
