import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import type { PayrollExpenseClaim } from '@/types/modules/payrollMonth';
import { approvePayrollExpenses, openPayrollExpenseClaims, preparePayrollExpenseApproval } from '../../lib/payroll/payrollExpenseApproval';

const scope = { tenantId: 'tenant-1', employeeId: 'employee-1', year: 2026, month: 9 };
function claim(overrides: Partial<PayrollExpenseClaim> = {}): PayrollExpenseClaim {
  return { id: 'claim-1', tenantId: scope.tenantId, employeeId: scope.employeeId, expenseDate: '2026-09-29',
    category: 'mileage', description: 'Kilometervergütung', amountCents: 838, approvedAmountCents: null,
    currency: 'EUR', assignmentId: null, clientId: null, paymentMethod: null, receiptNumber: null,
    receiptPath: null, mileageKm: 27.92, mileageRateCents: 30, origin: null, destination: null,
    vehicleLabel: null, businessPurpose: 'Einsatzfahrt', taxTreatment: 'review', status: 'submitted',
    officeNote: null, rejectionReason: null, submittedAt: '2026-09-29T10:00:00Z', reviewedAt: null,
    createdAt: '2026-09-29T10:00:00Z', updatedAt: '2026-09-29T10:00:00Z', ...overrides };
}

describe('Sammelgenehmigung der Monatsbelege', () => {
  it('uses only submitted or needs-info claims of the selected tenant, employee and month', () => {
    const rows = [claim(), claim(), claim({ id: 'needs-info', status: 'needs_info' }),
      claim({ id: 'other-tenant', tenantId: 'tenant-2' }), claim({ id: 'other-person', employeeId: 'employee-2' }),
      claim({ id: 'other-month', expenseDate: '2026-10-01' }), claim({ id: 'other-year', expenseDate: '2025-09-29' }),
      ...(['draft', 'approved', 'partially_approved', 'rejected', 'reimbursed'] as const).map(status => claim({ id: status, status }))];
    assert.deepEqual(openPayrollExpenseClaims(rows, scope).map(row => row.id), ['claim-1', 'needs-info']);
  });

  it('preserves edited amounts and notes and totals cents exactly', () => {
    const result = preparePayrollExpenseApproval([claim(), claim({ id: 'claim-2', amountCents: 840, officeNote: 'Beleg geprüft' })],
      scope, { 'claim-1': ' 5,25 ' }, { 'claim-1': '  Korrigierte Strecke  ' });
    if (!result.ok) throw new Error(result.error);
    assert.equal(result.ok, true);
    assert.equal(result.data.totalCents, 1365);
    assert.deepEqual(result.data.items.map(item => [item.status, item.approvedAmountCents, item.officeNote]),
      [['partially_approved', 525, 'Korrigierte Strecke'], ['approved', 840, 'Beleg geprüft']]);
  });

  it('accepts zero and dot decimals without turning zero into the original amount', () => {
    const result = preparePayrollExpenseApproval([claim(), claim({ id: 'claim-2' })], scope, { 'claim-1': '0', 'claim-2': '8.38' }, {});
    if (!result.ok) throw new Error(result.error);
    assert.equal(result.ok, true);
    assert.deepEqual(result.data.items.map(item => item.approvedAmountCents), [0, 838]);
    assert.equal(result.data.totalCents, 838);
  });

  it('rejects the entire preparation for invalid or excessive amounts', () => {
    for (const amount of ['-1', '8,39', '8,381', 'Infinity', 'NaN', '1e2', '1.000,00', 'abc']) {
      assert.equal(preparePayrollExpenseApproval([claim()], scope, { 'claim-1': amount }, {}).ok, false, amount);
    }
    assert.equal(preparePayrollExpenseApproval([claim(), claim({ id: 'bad' })], scope, { bad: 'invalid' }, {}).ok, false);
  });

  it('requires EUR and a valid revision timestamp before any write', () => {
    for (const overrides of [{ currency: 'USD' }, { updatedAt: '' }, { updatedAt: 'invalid' }]) {
      assert.equal(preparePayrollExpenseApproval([claim(overrides)], scope, {}, {}).ok, false);
    }
  });

  it('separates successful approvals, server errors and thrown errors and continues sequentially', async () => {
    const rows = ['ok', 'server-error', 'throws', 'unconfirmed', 'last'].map(id => claim({ id }));
    const prepared = preparePayrollExpenseApproval(rows, scope, { last: '5,00' }, {});
    if (!prepared.ok) throw new Error(prepared.error);
    const calls: string[] = [], progress: number[][] = [];
    let inFlight = 0;
    const result = await approvePayrollExpenses(prepared.data.items, async item => {
      assert.equal(inFlight++, 0);
      calls.push(item.claim.id);
      await Promise.resolve();
      inFlight--;
      if (item.claim.id === 'server-error') return { ok: false, error: 'Beleg inzwischen geändert' };
      if (item.claim.id === 'throws') throw new Error('Zeitüberschreitung');
      return { ok: true, data: { ...item.claim, status: item.claim.id === 'unconfirmed' ? 'submitted' : item.status,
        approvedAmountCents: item.approvedAmountCents } };
    }, (done, total) => progress.push([done, total]));
    assert.deepEqual(calls, rows.map(row => row.id));
    assert.deepEqual(result.saved.map(row => row.id), ['ok', 'last']);
    assert.equal(result.saved[1].status, 'partially_approved');
    assert.deepEqual(result.failed.map(item => item.claim.id), ['server-error', 'throws', 'unconfirmed']);
    assert.equal(result.failed[1].error, 'Zeitüberschreitung');
    assert.deepEqual(progress, rows.map((_, i) => [i + 1, 5]));
  });

  it('does not count a mismatching record, person, tenant or amount as saved', async () => {
    const prepared = preparePayrollExpenseApproval([claim()], scope, {}, {});
    if (!prepared.ok) throw new Error(prepared.error);
    for (const mismatch of [{ id: 'other' }, { tenantId: 'other' }, { employeeId: 'other' }, { approvedAmountCents: 999 }]) {
      const result = await approvePayrollExpenses(prepared.data.items, async item => ({ ok: true,
        data: { ...item.claim, status: item.status, approvedAmountCents: item.approvedAmountCents, ...mismatch } }));
      assert.equal(result.saved.length, 0);
      assert.equal(result.failed.length, 1);
    }
  });

  it('sends no duplicate writes and handles an empty month', async () => {
    const prepared = preparePayrollExpenseApproval([claim()], scope, {}, {});
    if (!prepared.ok) throw new Error(prepared.error);
    let calls = 0;
    const item = prepared.data.items[0];
    const result = await approvePayrollExpenses([item, item], async row => {
      calls++;
      return { ok: true, data: { ...row.claim, status: row.status, approvedAmountCents: row.approvedAmountCents } };
    });
    assert.equal(calls, 1);
    assert.equal(result.saved.length, 1);
    assert.deepEqual(await approvePayrollExpenses([], async () => { throw new Error('must not call'); }), { saved: [], failed: [] });
  });
});
