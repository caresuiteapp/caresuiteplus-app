// Generated native presentation from src/lib/office/invoiceFinanceWorkspaceService.web.ts. Update through scripts/port-native-workspaces.mjs.
import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getSupabaseClient } from "../supabase/client.ts";
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fetchOfficeInvoices } from "./invoiceWorkspaceService.native.ts";
import { isOfficeInvoiceDate, type OfficeInvoice } from "./invoiceWorkspaceTypes.native.ts";
import { invoiceRunPeriod } from "./invoiceRunModel.native.ts";
type Row = Record<string, unknown>;
export type OfficeInvoicePaymentRow = {
    id: string;
    invoiceId: string | null;
    invoiceNumber: string;
    clientName: string;
    recipientName: string;
    paymentDate: string;
    valueDate: string | null;
    amountCents: number | null;
    currency: string;
    status: string;
    method: string;
    reference: string;
    issues: string[];
};
export type OfficeInvoiceDunningRow = {
    id: string;
    invoiceId: string | null;
    invoiceNumber: string;
    clientName: string;
    recipientName: string;
    level: number | null;
    dueDate: string | null;
    openCents: number | null;
    status: string;
    issues: string[];
};
export type OfficeInvoiceMonthSummary = {
    month: string;
    invoices: OfficeInvoice[];
    draftCount: number;
    issuedCount: number;
    totalCents: number | null;
    openCents: number | null;
    paidCents: number | null;
    unknownCount: number;
};
const string = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
function cents(value: unknown): number | null {
    if ((typeof value !== 'number' && typeof value !== 'string') || value === '')
        return null;
    const amount = Number(value);
    const rounded = Math.round(amount * 100);
    return Number.isFinite(amount) && Number.isSafeInteger(rounded) && amount >= 0 ? rounded : null;
}
function denied<T>(tenantId: string, role?: RoleKey | null): ServiceResult<T> | null {
    return enforcePermission<T>(role, 'office.invoices.view') ?? guardServiceTenant(tenantId);
}
async function readRows(tenantId: string, table: string, columns: string): Promise<ServiceResult<Row[]>> {
    const client = getSupabaseClient();
    if (!client)
        return { ok: false, error: 'Die Datenverbindung ist nicht verfügbar.' };
    const rows: Row[] = [];
    const ids = new Set<string>();
    try {
        for (let page = 0; page < 100; page += 1) {
            const { data, error } = await fromUnknownTable(client, table).select(columns).eq('tenant_id', tenantId)
                .order('id', { ascending: true }).range(page * 1000, page * 1000 + 999);
            if (error)
                return { ok: false, error: toGermanSupabaseError(error) };
            const next = (data ?? []) as unknown as Row[];
            for (const row of next) {
                const id = string(row.id);
                if (row.tenant_id !== tenantId)
                    return { ok: false, error: 'Die Finanzdaten gehören nicht zum aktuellen Mandanten.' };
                if (!id || ids.has(id))
                    return { ok: false, error: 'Die Finanzübersicht wurde während des Ladens verändert. Bitte erneut laden.' };
                ids.add(id);
                rows.push(row);
            }
            if (next.length < 1000)
                return { ok: true, data: rows };
        }
        return { ok: false, error: 'Die vollständige Finanzübersicht ist zu groß. Bitte die Buchhaltung zur Eingrenzung kontaktieren.' };
    }
    catch {
        return { ok: false, error: 'Die Finanzübersicht konnte nicht geladen werden. Bitte erneut versuchen.' };
    }
}
function reference(row: Row, invoices: Map<string, OfficeInvoice>) {
    const invoiceId = string(row.invoice_id) || null;
    const invoice = invoiceId ? invoices.get(invoiceId) : undefined;
    return { invoiceId, invoiceNumber: invoice ? invoice.status === 'draft' && invoice.invoiceNumber.startsWith('DRAFT-') ? 'Rechnungsentwurf' : invoice.invoiceNumber : 'Nicht zugeordnet',
        clientName: invoice?.clientName ?? '', recipientName: invoice?.recipient.name ?? string(row.payer_name),
        issues: invoiceId && !invoice ? ['Die zugehörige Rechnung ist nicht verfügbar.'] : [] };
}
export function mapOfficeInvoicePayments(rows: Row[], invoices: OfficeInvoice[]): OfficeInvoicePaymentRow[] {
    const byId = new Map(invoices.map(invoice => [invoice.id, invoice]));
    return rows.map(row => {
        const related = reference(row, byId);
        const currency = string(row.currency);
        const amountCents = currency === 'EUR' ? cents(row.amount) : null;
        const paymentDate = string(row.payment_date);
        const valueDate = string(row.value_date) || null;
        const issues = [...related.issues];
        if (currency !== 'EUR')
            issues.push(currency ? `Währung ${currency}: keine Umrechnung in Euro vorgenommen.` : 'Die Zahlungswährung fehlt.');
        else if (amountCents === null)
            issues.push('Der Zahlungsbetrag ist nicht vollständig lesbar.');
        if (!isOfficeInvoiceDate(paymentDate))
            issues.push('Das Zahlungsdatum ist ungültig oder fehlt.');
        if (valueDate && !isOfficeInvoiceDate(valueDate))
            issues.push('Das Wertstellungsdatum ist ungültig.');
        return { id: string(row.id), ...related, paymentDate, valueDate, amountCents, currency, status: string(row.status),
            method: string(row.payment_method), reference: string(row.reference), issues };
    }).sort((a, b) => b.paymentDate.localeCompare(a.paymentDate) || a.id.localeCompare(b.id));
}
export function mapOfficeInvoiceDunning(rows: Row[], invoices: OfficeInvoice[]): OfficeInvoiceDunningRow[] {
    const byId = new Map(invoices.map(invoice => [invoice.id, invoice]));
    return rows.map(row => {
        const related = reference(row, byId);
        const parsed = typeof row.level === 'number' || typeof row.level === 'string' ? Number(row.level) : NaN;
        const level = Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
        const dueDate = string(row.due_date) || null;
        const openCents = cents(row.open_amount_at_creation);
        const issues = [...related.issues];
        if (level === null)
            issues.push('Die Mahnstufe fehlt oder ist ungültig.');
        if (dueDate && !isOfficeInvoiceDate(dueDate))
            issues.push('Das Fälligkeitsdatum ist ungültig.');
        if (openCents === null)
            issues.push('Der offene Betrag bei Erstellung der Mahnung ist nicht vollständig lesbar.');
        return { id: string(row.id), ...related, level, dueDate, openCents, status: string(row.status), issues };
    }).sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || a.id.localeCompare(b.id));
}
export async function fetchOfficeInvoicePayments(tenantId: string, role?: RoleKey | null): Promise<ServiceResult<OfficeInvoicePaymentRow[]>> {
    const blocked = denied<OfficeInvoicePaymentRow[]>(tenantId, role);
    if (blocked)
        return blocked;
    const [rows, invoices] = await Promise.all([readRows(tenantId, 'payments', 'id,tenant_id,invoice_id,payment_date,value_date,amount,currency,status,payment_method,reference,payer_name'), fetchOfficeInvoices(tenantId, role)]);
    if (!rows.ok)
        return rows;
    if (!invoices.ok)
        return invoices;
    return { ok: true, data: mapOfficeInvoicePayments(rows.data, invoices.data) };
}
export async function fetchOfficeInvoiceDunning(tenantId: string, role?: RoleKey | null): Promise<ServiceResult<OfficeInvoiceDunningRow[]>> {
    const blocked = denied<OfficeInvoiceDunningRow[]>(tenantId, role);
    if (blocked)
        return blocked;
    const [rows, invoices] = await Promise.all([readRows(tenantId, 'dunning_cases', 'id,tenant_id,invoice_id,level,due_date,open_amount_at_creation,status'), fetchOfficeInvoices(tenantId, role)]);
    if (!rows.ok)
        return rows;
    if (!invoices.ok)
        return invoices;
    return { ok: true, data: mapOfficeInvoiceDunning(rows.data, invoices.data) };
}
function total(values: (number | null)[]): number | null {
    if (values.some(value => value === null || !Number.isSafeInteger(value)))
        return null;
    const amount = values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
    return Number.isSafeInteger(amount) ? amount : null;
}
/** Live balances for invoices dated in a month, not cash receipts in that month. */
export function buildOfficeInvoiceMonthSummary(month: string, invoices: OfficeInvoice[]): OfficeInvoiceMonthSummary {
    const selected = invoices.filter(invoice => invoice.invoiceDate.slice(0, 7) === month);
    const issued = selected.filter(invoice => !['draft', 'cancelled', 'written_off'].includes(invoice.status));
    return { month, invoices: selected, draftCount: selected.filter(invoice => invoice.status === 'draft').length, issuedCount: issued.length,
        totalCents: total(issued.map(invoice => invoice.amountCents)), openCents: total(issued.map(invoice => invoice.openCents)),
        paidCents: total(issued.map(invoice => invoice.paidCents)), unknownCount: issued.filter(invoice => [invoice.amountCents, invoice.openCents, invoice.paidCents].some(value => value === null)).length };
}
export async function fetchOfficeInvoiceMonthSummary(tenantId: string, month: string, role?: RoleKey | null): Promise<ServiceResult<OfficeInvoiceMonthSummary>> {
    const blocked = denied<OfficeInvoiceMonthSummary>(tenantId, role);
    if (blocked)
        return blocked;
    if (!invoiceRunPeriod(month))
        return { ok: false, error: 'Bitte einen gültigen Rechnungsmonat auswählen.' };
    const invoices = await fetchOfficeInvoices(tenantId, role);
    if (!invoices.ok)
        return invoices;
    return { ok: true, data: buildOfficeInvoiceMonthSummary(month, invoices.data) };
}
