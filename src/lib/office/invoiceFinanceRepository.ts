import type { PostgrestError } from '@supabase/supabase-js';
import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import type { InvoiceRunItem, InvoicePaymentItem, InvoiceDunningItem } from './invoiceExtensionService';

type Row = Record<string, unknown>;
type Result = { data: Row[] | null; error: PostgrestError | null };
type Query = PromiseLike<Result> & {
  select: (columns: string) => Query; eq: (column: string, value: string) => Query;
  order: (column: string, options: { ascending: boolean }) => Query;
  range: (from: number, to: number) => Query;
};

async function readRows(tenantId: string, table: string, columns: string): Promise<ServiceResult<Row[]>> {
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
  const db = client as unknown as { from: (table: string) => Query };
  const rows: Row[] = [];
  try {
  for (let page = 0; page < 100; page += 1) {
    const { data, error } = await db.from(table).select(columns).eq('tenant_id', tenantId)
      .order('id', { ascending: true }).range(page * 1000, page * 1000 + 999);
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    if ((data ?? []).some(row => row.tenant_id !== tenantId)) return { ok: false, error: 'Die Finanzdaten gehören nicht zum aktuellen Mandanten.' };
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return { ok: true, data: rows };
  }
  return { ok: false, error: 'Die Finanzübersicht ist zu groß. Bitte den Zeitraum einschränken.' };
  } catch {
    return { ok: false, error: 'Die Finanzdaten konnten nicht abgerufen werden. Bitte erneut versuchen.' };
  }
}

const text = (value: unknown) => typeof value === 'string' ? value : '';
function cents(value: unknown): number {
  const parsed = Number(value);
  if (value === null || value === undefined || !Number.isFinite(parsed) || !Number.isSafeInteger(Math.round(parsed * 100))) {
    throw new Error('Ein Finanzbetrag konnte nicht gelesen werden.');
  }
  return Math.round(parsed * 100);
}

function count(value: unknown): number {
  const parsed = Number(value);
  if (value === null || value === undefined || !Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error('Eine Anzahl in der Finanzübersicht konnte nicht gelesen werden.');
  }
  return parsed;
}

export async function fetchLiveMonthInvoiceTotals(tenantId: string, month: string): Promise<ServiceResult<{ invoiceCount: number; draftCount: number; totalCents: number }>> {
  const result = await readRows(tenantId, 'invoices', 'id, tenant_id, status, total_amount, service_month, invoice_date');
  if (!result.ok) return result;
  try {
    const selected = result.data.filter(row => text(row.service_month ?? row.invoice_date).slice(0, 7) === month);
    const totalCents = selected.filter(row => !['cancelled', 'written_off'].includes(text(row.status)))
      .reduce((sum, row) => sum + cents(row.total_amount), 0);
    if (!Number.isSafeInteger(totalCents)) throw new Error('Die Gesamtsumme liegt außerhalb des unterstützten Zahlenbereichs.');
    return { ok: true, data: { invoiceCount: selected.length, draftCount: selected.filter(row => row.status === 'draft').length, totalCents } };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Die Monatssumme konnte nicht gelesen werden.' }; }
}

async function withInvoices<T>(tenantId: string, table: string, columns: string,
  map: (row: Row, invoice: Row | undefined) => T): Promise<ServiceResult<T[]>> {
  const [records, invoices] = await Promise.all([
    readRows(tenantId, table, columns), readRows(tenantId, 'invoices', 'id, tenant_id, invoice_number, recipient_name'),
  ]);
  if (!records.ok) return records;
  if (!invoices.ok) return invoices;
  const byId = new Map(invoices.data.map(invoice => [invoice.id, invoice]));
  try { return { ok: true, data: records.data.map(row => map(row, byId.get(row.invoice_id))) }; }
  catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Die Finanzübersicht konnte nicht geladen werden.' }; }
}

export async function fetchLiveInvoiceRuns(tenantId: string): Promise<ServiceResult<InvoiceRunItem[]>> {
  const result = await readRows(tenantId, 'billing_runs', 'id, tenant_id, title, billing_month, invoices_count, total_amount, status, created_at');
  if (!result.ok) return result;
  try { return { ok: true, data: result.data.map(row => ({ id: text(row.id), tenantId,
    label: text(row.title) || `Rechnungslauf ${text(row.billing_month).slice(0, 7)}`,
    runAt: text(row.billing_month), invoiceCount: count(row.invoices_count), totalCents: cents(row.total_amount), status: text(row.status),
  })).sort((a, b) => b.runAt.localeCompare(a.runAt)) }; }
  catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Rechnungsläufe konnten nicht geladen werden.' }; }
}

export function fetchLiveInvoicePayments(tenantId: string): Promise<ServiceResult<InvoicePaymentItem[]>> {
  return withInvoices(tenantId, 'payments', 'id, tenant_id, invoice_id, payment_date, amount, currency, payment_method, status, payer_name', (row, invoice) => {
    if (row.currency !== 'EUR') throw new Error('Eine Zahlung verwendet eine andere Währung. Bitte die Buchung einzeln prüfen.');
    return { id: text(row.id), tenantId, invoiceId: text(row.invoice_id), invoiceNumber: text(invoice?.invoice_number) || 'Nicht zugeordnet',
      clientName: text(invoice?.recipient_name) || text(row.payer_name) || 'Nicht zugeordnet', paidAt: text(row.payment_date),
      amountCents: cents(row.amount), method: text(row.payment_method), status: text(row.status) };
  });
}

export function fetchLiveDunningCases(tenantId: string): Promise<ServiceResult<InvoiceDunningItem[]>> {
  return withInvoices(tenantId, 'dunning_cases', 'id, tenant_id, invoice_id, level, due_date, open_amount_at_creation, status', (row, invoice) => ({
    id: text(row.id), tenantId, invoiceId: text(row.invoice_id), invoiceNumber: text(invoice?.invoice_number) || 'Nicht zugeordnet',
    clientName: text(invoice?.recipient_name) || 'Nicht zugeordnet', dunningLevel: count(row.level), dueDate: text(row.due_date),
    openCents: cents(row.open_amount_at_creation), status: text(row.status),
  }));
}
