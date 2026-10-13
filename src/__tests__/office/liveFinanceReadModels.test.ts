import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  mode: 'supabase', rows: {} as Record<string, Record<string, unknown>[]>,
  calls: [] as { table: string; tenant: string; from: number; to: number }[],
  error: null as null | { code: string; message: string }, failTransport: false,
  budgets: vi.fn(), invoices: vi.fn(),
}));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => state.mode }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: (id: string) => id ? null : { ok: false, error: 'Kein Mandant.' } }));
vi.mock('@/lib/tenant/tenantResolver', () => ({ assertTenantForMode: (id: string) => id ? null : { ok: false, error: 'Kein Mandant.' } }));
vi.mock('@/lib/services/repositories/budgetRepository.supabase', () => ({ budgetSupabaseRepository: { list: state.budgets } }));
vi.mock('@/lib/services/repositories/invoiceRepository.supabase', () => ({ invoiceSupabaseRepository: { list: state.invoices } }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ from: (table: string) => {
  let tenant = '', from = 0, to = 999;
  const q = { select: () => q, eq: (_: string, id: string) => { tenant = id; return q; }, order: () => q,
    range: (start: number, end: number) => { from = start; to = end; return q; },
    then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => {
      state.calls.push({ table, tenant, from, to });
      return (state.failTransport ? Promise.reject(new Error('Netzwerk')) : Promise.resolve({ data: (state.rows[table] ?? []).slice(from, to + 1), error: state.error })).then(resolve, reject);
    } };
  return q;
} }) }));
import { fetchBudgetSummary } from '@/lib/office/invoiceListService';
import { fetchBillingDashboardStats } from '@/lib/office/budgetListService';
import { fetchInvoiceRuns, fetchInvoicePayments, fetchInvoiceDunningCases } from '@/lib/office/invoiceExtensionService';
import { fetchMonthEndInvoiceOverview } from '@/lib/office/monthEndInvoiceOverview';
const tenant = 'tenant-live';
const invoice = { id: 'invoice-1', tenant_id: tenant, invoice_number: 'RE-2026-1', recipient_name: 'Anna', total_amount: '123.45', invoice_date: '2026-10-01', service_month: null, status: 'sent', due_date: '2026-01-01' };
beforeEach(() => {
  vi.clearAllMocks(); state.mode = 'supabase'; state.rows = { invoices: [invoice] }; state.calls = []; state.error = null; state.failTransport = false;
  state.budgets.mockResolvedValue({ ok: true, data: [] }); state.invoices.mockResolvedValue({ ok: true, data: [invoice] });
});
describe('live finance read models', () => {
  it('uses live budget data and propagates failure instead of showing demo budgets', async () => {
    state.budgets.mockResolvedValueOnce({ ok: true, data: [{ id: 'live-budget', tenantId: tenant }] });
    expect(await fetchBudgetSummary(tenant, 'business_admin')).toMatchObject({ ok: true, data: [{ id: 'live-budget' }] });
    expect(state.budgets).toHaveBeenCalledWith(tenant);
    state.budgets.mockResolvedValueOnce({ ok: false, error: 'Budgetzugriff gesperrt' });
    expect(await fetchBudgetSummary(tenant, 'business_admin')).toEqual({ ok: false, error: 'Budgetzugriff gesperrt' });
  });
  it('rejects portal actors before reading office budgets or finance tables', async () => {
    expect((await fetchBudgetSummary(tenant, 'employee_portal')).ok).toBe(false);
    expect((await fetchInvoicePayments(tenant, 'client_portal')).ok).toBe(false);
    expect(state.budgets).not.toHaveBeenCalled(); expect(state.calls).toEqual([]);
  });
  it('loads actual stored runs, payments and dunning cases scoped to the tenant', async () => {
    state.rows.billing_runs = [{ id: 'run-1', tenant_id: tenant, title: 'Oktoberlauf', billing_month: '2026-10-01', invoices_count: 1, total_amount: '123.45', status: 'draft' }];
    state.rows.payments = [{ id: 'payment-1', tenant_id: tenant, invoice_id: invoice.id, payment_date: '2026-10-04', amount: '20.55', currency: 'EUR', payment_method: 'bank_transfer', status: 'completed' }];
    state.rows.dunning_cases = [{ id: 'case-1', tenant_id: tenant, invoice_id: invoice.id, level: 2, due_date: '2026-10-20', open_amount_at_creation: '102.90', status: 'open' }];
    expect(await fetchInvoiceRuns(tenant, 'business_admin')).toMatchObject({ ok: true, data: [{ id: 'run-1', totalCents: 12345, invoiceCount: 1 }] });
    expect(await fetchInvoicePayments(tenant, 'business_admin')).toMatchObject({ ok: true, data: [{ id: 'payment-1', invoiceNumber: 'RE-2026-1', clientName: 'Anna', amountCents: 2055 }] });
    expect(await fetchInvoiceDunningCases(tenant, 'business_admin')).toMatchObject({ ok: true, data: [{ id: 'case-1', dunningLevel: 2, openCents: 10290 }] });
    expect(state.calls.every(call => call.tenant === tenant)).toBe(true);
  });
  it('does not infer a payment from a paid invoice, or invent records when the live tables are empty', async () => {
    state.rows.invoices = [{ ...invoice, status: 'paid' }];
    expect(await fetchInvoicePayments(tenant, 'business_admin')).toEqual({ ok: true, data: [] });
    expect(await fetchInvoiceRuns(tenant, 'business_admin')).toEqual({ ok: true, data: [] });
    expect(await fetchInvoiceDunningCases(tenant, 'business_admin')).toEqual({ ok: true, data: [] });
  });
  it('rejects missing tables, transport failure, foreign records and invalid amounts', async () => {
    state.error = { code: '42P01', message: 'payments missing' };
    expect((await fetchInvoicePayments(tenant, 'business_admin')).ok).toBe(false);
    state.error = null; state.failTransport = true;
    expect((await fetchInvoiceRuns(tenant, 'business_admin')).ok).toBe(false);
    state.failTransport = false; state.rows.billing_runs = [{ id: 'foreign', tenant_id: 'other' }];
    expect((await fetchInvoiceRuns(tenant, 'business_admin')).ok).toBe(false);
    state.rows.billing_runs = [{ id: 'invalid', tenant_id: tenant, invoices_count: 1, total_amount: 'broken' }];
    expect((await fetchInvoiceRuns(tenant, 'business_admin')).ok).toBe(false);
  });
  it('reads every invoice page for a month and excludes cancelled and written-off totals', async () => {
    state.rows.invoices = Array.from({ length: 1001 }, (_, i) => ({ ...invoice, id: `invoice-${i}`, total_amount: '1.01' }));
    state.rows.invoices.push({ ...invoice, id: 'cancelled', total_amount: '5000', status: 'cancelled' },
      { ...invoice, id: 'written-off', total_amount: '5000', status: 'written_off' },
      { ...invoice, id: 'draft', total_amount: '2.50', status: 'draft' },
      { ...invoice, id: 'other-month', total_amount: '9000', service_month: '2026-09-01' });
    expect(await fetchMonthEndInvoiceOverview(tenant, '2026-10', 'business_admin')).toEqual({ ok: true, data: { invoiceCount: 1004, draftCount: 1, totalCents: 101351, runs: [] } });
    expect(state.calls.some(call => call.table === 'invoices' && call.from === 1000)).toBe(true);
    expect((await fetchMonthEndInvoiceOverview(tenant, '2026-13', 'business_admin')).ok).toBe(false);
  });
  it('does not report a zero budget total after a failed budget query and computes real overdue invoices', async () => {
    state.budgets.mockResolvedValueOnce({ ok: false, error: 'Kein Budgetzugriff' });
    expect(await fetchBillingDashboardStats(tenant, 'business_admin')).toEqual({ ok: false, error: 'Kein Budgetzugriff' });
    expect(await fetchBillingDashboardStats(tenant, 'business_admin')).toMatchObject({ ok: true, data: { overdueCount: 1, openInvoicesCents: 12345 } });
  });
});
