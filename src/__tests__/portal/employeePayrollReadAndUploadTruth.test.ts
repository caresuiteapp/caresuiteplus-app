import { beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), upload: vi.fn(), bytes: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ from: h.from, rpc: h.rpc, storage: { from: () => ({ upload: h.upload }) } }) }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/portal/employeePortalMediaBytes', () => ({ readEmployeePortalMediaBytes: h.bytes }));
import { createExpenseClaim, loadEmployeePayrollMonth, uploadExpenseReceipt } from '@/lib/payroll/payrollMonthService';
import { createLogbookReceipt, uploadLogbookFile } from '@/lib/employeeLogbook/employeeLogbookRepository.supabase';
const chains: Record<string, ReturnType<typeof chain>> = {};
function chain(data: unknown, error: unknown = null) {
  const result = { data, error };
  return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), gte: vi.fn().mockReturnThis(), lte: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue(result), then: (resolve: any) => Promise.resolve(result).then(resolve) };
}
beforeEach(() => {
  vi.clearAllMocks(); h.rpc.mockResolvedValue({ data: 30, error: null }); h.upload.mockResolvedValue({ error: null });
  chains.payroll_month_statements = chain(null); chains.employee_expense_claims = chain([]); h.from.mockImplementation(table => chains[table]);
  h.bytes.mockResolvedValue(new Uint8Array([0,1,2,3]).subarray(1,3));
});
describe('employee payroll reads and binary receipt uploads', () => {
  it.each([{ amountCents: Number.NaN, expenseDate: '2026-10-11' }, { amountCents: -1, expenseDate: '2026-10-11' }, { amountCents: 100, expenseDate: '2026-02-30' }])('rejects invalid logbook receipt data before a database write', async invalid => {
    await expect(createLogbookReceipt({ tenantId: 'tenant', employeeId: 'employee', tripId: null, category: 'parking', storagePath: 'path', fileName: 'receipt.pdf', ...invalid })).rejects.toThrow('Bitte');
    expect(h.from).not.toHaveBeenCalled();
  });
  it('preserves a stored mileage rate of zero instead of showing 30 cents', async () => {
    h.rpc.mockResolvedValue({ data: 0, error: null });
    const result = await loadEmployeePayrollMonth('tenant', 'employee', 2026, 7);
    expect(result.ok && result.data.mileageRateCents).toBe(0);
    expect(chains.payroll_month_statements.eq.mock.calls).toContainEqual(['period_month', 7]);
    expect(chains.employee_expense_claims.eq.mock.calls).toContainEqual(['employee_id', 'employee']);
    expect(chains.employee_expense_claims.gte.mock.calls).toContainEqual(['expense_date', '2026-07-01']);
    expect(chains.employee_expense_claims.lte.mock.calls).toContainEqual(['expense_date', '2026-07-31']);
  });
  it.each([{ data: null, error: { message: 'Kilometersatz gesperrt' } }, { data: null, error: null }, { data: -1, error: null }])('does not invent a live rate on RPC failure or missing/invalid data', async (reply) => {
    h.rpc.mockResolvedValue(reply);
    expect((await loadEmployeePayrollMonth('tenant', 'employee', 2026, 7)).ok).toBe(false);
  });
  it.each(['2026-02-30','12.10.2026','', '2026-13-01'])('rejects invalid expense day %s before writing', async (expenseDate) => {
    const result = await createExpenseClaim({ tenantId:'tenant', employeeId:'employee', expenseDate, category:'receipt', amountCents:100, description:'Ticket', businessPurpose:'Dienstliche Fahrt', receiptPath:'path' });
    expect(result.ok).toBe(false); expect(h.from).not.toHaveBeenCalled();
  });
  it('uploads the selected bytes as an exact ArrayBuffer for native payroll receipts', async () => {
    const result = await uploadExpenseReceipt({ tenantId:'tenant', employeeId:'employee', uri:'file:///receipt.pdf', fileName:'receipt.pdf', mimeType:'application/pdf' });
    expect(result.ok).toBe(true); expect(h.bytes).toHaveBeenCalledWith('file:///receipt.pdf');
    const payload = h.upload.mock.calls[0][1]; expect(payload).toBeInstanceOf(ArrayBuffer); expect([...new Uint8Array(payload)]).toEqual([1,2]);
  });
  it('uses the same binary path for logbook licences and receipt uploads', async () => {
    await uploadLogbookFile({ tenantId:'tenant', employeeId:'employee', area:'license', uri:'content://licence.jpg', fileName:'licence.jpg', mimeType:'image/jpeg' });
    const payload = h.upload.mock.calls[0][1]; expect(payload).toBeInstanceOf(ArrayBuffer); expect([...new Uint8Array(payload)]).toEqual([1,2]);
    expect(h.upload.mock.calls[0][0]).toContain('tenant/employee/license/');
  });
  it('reports a receipt read failure without uploading empty content', async () => {
    h.bytes.mockRejectedValue(new Error('Datei ist leer'));
    expect(await uploadExpenseReceipt({ tenantId:'tenant', employeeId:'employee', uri:'file:///empty.pdf', fileName:'empty.pdf' })).toEqual({ ok:false, error:'Datei ist leer' });
    expect(h.upload).not.toHaveBeenCalled();
  });
});
