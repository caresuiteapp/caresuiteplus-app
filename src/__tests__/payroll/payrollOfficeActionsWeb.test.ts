import { beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import type { PayrollOfficeEmployeeMonth } from '@/lib/payroll/payrollOfficeReadModel.web';

const mock = vi.hoisted(() => ({ rpc: vi.fn(), user: vi.fn(), read: vi.fn(), render: vi.fn(), upload: vi.fn(), from: vi.fn(), sign: vi.fn(), guard: vi.fn() }));
vi.mock('@/lib/permissions', () => ({ enforcePermission: (role: string) => role === 'business_admin' ? null : { ok: false, error: 'Keine Berechtigung' }, isPortalOnlyRole: (role: string) => role.includes('portal') }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: mock.guard }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ rpc: mock.rpc, auth: { getUser: mock.user }, storage: { from: () => ({ createSignedUrl: mock.sign }) } }) }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: mock.from }));
vi.mock('@/lib/supabase/errors', () => ({ toGermanSupabaseError: (error: { message?: string }) => error?.message || 'Datenfehler' }));
vi.mock('@/lib/supabase/edgeFunctions', () => ({ invokeEdgeFunction: mock.upload }));
vi.mock('@/lib/documents/documentPdfService', () => ({ renderHtmlToPdfBytes: mock.render }));
vi.mock('@/lib/payroll/payrollMonthService.web', () => ({ listPayrollMonthOverview: mock.read }));
vi.mock('@/lib/payroll/payrollCalculator.web', () => ({ buildPayrollStatementHtml: () => '<html>Geprüfte Monatsübersicht</html>' }));

const tenant = '10000000-0000-4000-8000-000000000001';
const employeeId = '20000000-0000-4000-8000-000000000001';
const userId = '30000000-0000-4000-8000-000000000001';
const claimId = '40000000-0000-4000-8000-000000000001';
const stamp = '2026-10-18T05:00:00.000Z';
let api: typeof import('@/lib/payroll/payrollOfficeActions.web');
let employee: PayrollOfficeEmployeeMonth;
const publishedRow = (input: Record<string, unknown>) => ({ id: input.p_statement_id, tenant_id: input.p_tenant_id, employee_id: input.p_employee_id,
  period_year: input.p_year, period_month: input.p_month, version: Number(input.p_expected_version) + 1, status: 'published',
  snapshot_json: input.p_snapshot, pdf_path: input.p_pdf_path, pdf_sha256: input.p_pdf_sha256, published_at: stamp, created_at: stamp, updated_at: stamp });
const claimRow = { id: claimId, tenant_id: tenant, employee_id: employeeId, expense_date: '2026-10-10', amount_cents: 500,
  approved_amount_cents: 400, currency: 'EUR', status: 'partially_approved', tax_treatment: 'taxable', updated_at: stamp, created_at: stamp };
const review = () => ({ tenantId: tenant, employeeId, year: 2026, month: 10, claimId, expectedUpdatedAt: stamp,
  status: 'partially_approved' as const, approvedAmountCents: 400, officeNote: 'Privatanteil abgezogen' });
function queryRow(row: unknown) {
  const query = { select: vi.fn(), eq: vi.fn(), single: vi.fn().mockResolvedValue({ data: row, error: null }) };
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query); mock.from.mockReturnValue(query); return query;
}

beforeEach(async () => {
  vi.resetModules(); Object.values(mock).forEach(fn => fn.mockReset()); vi.stubGlobal('crypto', webcrypto);
  mock.guard.mockReturnValue(null); mock.user.mockResolvedValue({ data: { user: { id: userId } }, error: null });
  employee = { employeeId, employeeName: 'Test Person', employeeNumber: null, periodYear: 2026, periodMonth: 10,
    compensationType: 'hourly', hourlyRateCents: 1500, fixedSalaryCents: 0, maxPayoutMinutes: null,
    actualWorkMinutes: 60, travelMinutes: 0, vacationMinutes: 0, sickMinutes: 0, otherPaidAbsenceMinutes: 0,
    plannedMinutes: 0, payableMinutes: 60, overtimeTransferMinutes: 0, timeAccountBalanceMinutes: 0,
    earnedGrossCents: 1500, projectedGrossCents: 1500, approvedExpensesCents: 0, pendingExpensesCents: 0,
    advancesCents: 0, deductionsCents: 0, payoutGrossCents: 1500, projectedTotalPayoutCents: 1500,
    generatedAt: stamp, expenseClaims: [], latestStatement: null, pendingPortalUploads: [], calculationReady: true,
    blockers: [], warnings: [], unapprovedEntryCount: 0, employmentStatus: 'active', statementHistory: [] };
  mock.read.mockImplementation(async () => ({ ok: true, data: { employees: [{ ...employee, generatedAt: '2026-10-18T05:01:00.000Z' }] } }));
  mock.rpc.mockImplementation(async (name: string, input: Record<string, unknown>) => name === 'payroll_office_source_revision'
    ? { data: 'a'.repeat(32), error: null } : name === 'review_office_payroll_expense' ? { data: claimRow, error: null }
      : { data: publishedRow(input), error: null });
  mock.render.mockResolvedValue(new Uint8Array([37, 80, 68, 70, 45, 49]));
  mock.upload.mockImplementation(async (_name: string, input: { tenantId: string; documentId: string; pdfBase64: string }) => {
    const bytes = Uint8Array.from(atob(input.pdfBase64), character => character.charCodeAt(0));
    const hash = Array.from(new Uint8Array(await webcrypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('');
    return { ok: true, data: { pdfPath: `tenant/${input.tenantId}/generated/${input.documentId}/${hash}.pdf`, sha256: hash } };
  });
  mock.sign.mockResolvedValue({ data: { signedUrl: 'https://example.invalid/signed-private-document' }, error: null });
  api = await import('@/lib/payroll/payrollOfficeActions.web');
});

describe('Office payroll publication', () => {
  it('publishes a fresh reviewed snapshot with one atomic RPC and verified upload hash', async () => {
    expect((await api.publishPayrollStatement(tenant, employee, 'business_admin')).ok).toBe(true);
    expect(mock.rpc.mock.calls.filter(([name]) => name === 'publish_office_payroll_statement')).toHaveLength(1);
    expect(mock.from).not.toHaveBeenCalled();
    const input = mock.rpc.mock.calls.find(([name]) => name === 'publish_office_payroll_statement')?.[1];
    expect(input.p_snapshot).not.toHaveProperty('latestStatement'); expect(input.p_snapshot).not.toHaveProperty('blockers');
    expect(input.p_snapshot.generatedAt).toBe('2026-10-18T05:01:00.000Z');
  });
  it('does not publish changed amounts the user has not reviewed', async () => {
    mock.read.mockResolvedValue({ ok: true, data: { employees: [{ ...employee, earnedGrossCents: 1700 }] } });
    expect(await api.publishPayrollStatement(tenant, employee, 'business_admin')).toMatchObject({ ok: false, error: expect.stringContaining('geändert') });
    expect(mock.render).not.toHaveBeenCalled(); expect(mock.upload).not.toHaveBeenCalled();
  });
  it('rejects a source change while the refreshed overview was read', async () => {
    mock.rpc.mockResolvedValueOnce({ data: 'a'.repeat(32), error: null }).mockResolvedValueOnce({ data: 'b'.repeat(32), error: null });
    expect((await api.publishPayrollStatement(tenant, employee, 'business_admin')).ok).toBe(false); expect(mock.render).not.toHaveBeenCalled();
  });
  it('keeps a failed source read as an error, with no PDF or writes', async () => {
    mock.read.mockResolvedValue({ ok: false, error: 'Arbeitszeit unvollständig' });
    expect(await api.publishPayrollStatement(tenant, employee, 'business_admin')).toEqual({ ok: false, error: 'Arbeitszeit unvollständig' });
    expect(mock.upload).not.toHaveBeenCalled();
  });
  it('blocks pending time approval, missing pay settings and immutable periods', async () => {
    employee.blockers = ['Zeit noch nicht freigegeben'];
    expect((await api.publishPayrollStatement(tenant, employee, 'business_admin')).ok).toBe(false);
    employee.blockers = []; employee.calculationReady = false;
    expect((await api.publishPayrollStatement(tenant, employee, 'business_admin')).ok).toBe(false);
    employee.calculationReady = true; employee.latestStatement = { status: 'confirmed' } as PayrollOfficeEmployeeMonth['latestStatement'];
    expect((await api.publishPayrollStatement(tenant, employee, 'business_admin')).ok).toBe(false);
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it('does not publish on a renderer error or mismatched uploaded content', async () => {
    mock.render.mockRejectedValueOnce(new Error('PDF fehlgeschlagen'));
    expect((await api.publishPayrollStatement(tenant, employee, 'business_admin')).ok).toBe(false);
    mock.upload.mockResolvedValueOnce({ ok: true, data: { pdfPath: 'foreign/file.pdf', sha256: 'b'.repeat(64) } });
    expect((await api.publishPayrollStatement(tenant, employee, 'business_admin')).ok).toBe(false);
    expect(mock.rpc.mock.calls.some(([name]) => name === 'publish_office_payroll_statement')).toBe(false);
  });
  it('coalesces duplicate clicks into one PDF and one commit', async () => {
    const responses = await Promise.all([api.publishPayrollStatement(tenant, employee, 'business_admin'), api.publishPayrollStatement(tenant, employee, 'business_admin')]);
    expect(responses.every(response => response.ok)).toBe(true); expect(mock.render).toHaveBeenCalledTimes(1);
    expect(mock.rpc.mock.calls.filter(([name]) => name === 'publish_office_payroll_statement')).toHaveLength(1);
  });
  it('replays the same publication ID and PDF after a lost commit response', async () => {
    let first = true;
    mock.rpc.mockImplementation(async (name: string, input: Record<string, unknown>) => {
      if (name === 'payroll_office_source_revision') return { data: 'a'.repeat(32), error: null };
      if (first) { first = false; return { data: null, error: { message: 'Verbindung unterbrochen', code: '' } }; }
      return { data: publishedRow(input), error: null };
    });
    expect((await api.publishPayrollStatement(tenant, employee, 'business_admin')).ok).toBe(false);
    expect((await api.publishPayrollStatement(tenant, employee, 'business_admin')).ok).toBe(true);
    const calls = mock.rpc.mock.calls.filter(([name]) => name === 'publish_office_payroll_statement');
    expect(calls[0][1]).toEqual(calls[1][1]); expect(mock.render).toHaveBeenCalledTimes(1); expect(mock.upload).toHaveBeenCalledTimes(1);
  });
  it('refreshes again after a definite stale revision rejection', async () => {
    mock.rpc.mockImplementation(async (name: string) => name === 'payroll_office_source_revision' ? { data: 'a'.repeat(32), error: null }
      : { data: null, error: { message: 'Quelldaten geändert', code: '40001' } });
    await api.publishPayrollStatement(tenant, employee, 'business_admin'); await api.publishPayrollStatement(tenant, employee, 'business_admin');
    expect(mock.read).toHaveBeenCalledTimes(2);
  });
  it('uses the highest stored draft version as the revision head', async () => {
    const published = { id: claimId, tenantId: tenant, employeeId, periodYear: 2026, periodMonth: 10, version: 1, status: 'published',
      snapshot: api.payrollSnapshotForPublication(employee), pdfPath: 'old.pdf', pdfSha256: 'a'.repeat(64), updatedAt: stamp, createdAt: stamp, publishedAt: stamp,
      employeeDecisionReason: null, confirmedAt: null, rejectedAt: null, lockedAt: null } as const;
    employee.latestStatement = published;
    employee.statementHistory = [{ ...published, id: userId, version: 3, status: 'draft' }, published];
    expect((await api.publishPayrollStatement(tenant, employee, 'business_admin')).ok).toBe(true);
    expect(mock.rpc.mock.calls.find(([name]) => name === 'publish_office_payroll_statement')?.[1].p_expected_version).toBe(3);
  });
  it('stops before upload when the signed-in user changes during rendering', async () => {
    mock.user.mockResolvedValueOnce({ data: { user: { id: userId } }, error: null })
      .mockResolvedValueOnce({ data: { user: { id: userId } }, error: null })
      .mockResolvedValue({ data: { user: { id: claimId } }, error: null });
    expect((await api.publishPayrollStatement(tenant, employee, 'business_admin')).ok).toBe(false);
    expect(mock.upload).not.toHaveBeenCalled();
  });
  it('rejects foreign server confirmation instead of showing success', async () => {
    mock.rpc.mockImplementation(async (name: string, input: Record<string, unknown>) => name === 'payroll_office_source_revision'
      ? { data: 'a'.repeat(32), error: null } : { data: { ...publishedRow(input), employee_id: userId }, error: null });
    expect((await api.publishPayrollStatement(tenant, employee, 'business_admin')).ok).toBe(false);
  });
  it('requires an authorized office identity and a live authenticated user', async () => {
    expect((await api.publishPayrollStatement(tenant, employee, 'employee_portal')).ok).toBe(false);
    mock.user.mockResolvedValue({ data: { user: null }, error: null });
    expect((await api.publishPayrollStatement(tenant, employee, 'business_admin')).ok).toBe(false); expect(mock.read).not.toHaveBeenCalled();
  });
});

describe('Office expense decision', () => {
  it('sends the full period, employee and expected revision and preserves taxable classification', async () => {
    const result = await api.reviewExpenseClaim(review(), 'business_admin');
    expect(result).toMatchObject({ ok: true, data: { taxTreatment: 'taxable', approvedAmountCents: 400 } });
    const input = mock.rpc.mock.calls[0][1];
    expect(input).toMatchObject({ p_tenant_id: tenant, p_employee_id: employeeId, p_year: 2026, p_month: 10, p_expected_updated_at: stamp });
    expect(input).not.toHaveProperty('tax_treatment'); expect(mock.from).not.toHaveBeenCalled();
  });
  it.each([{ amount: -1 }, { amount: Number.NaN }, { amount: 0.1 }, { amount: Number.POSITIVE_INFINITY }, { amount: 2_147_483_648 }])('rejects invalid approved cents: $amount', async ({ amount }) => {
    expect((await api.reviewExpenseClaim({ ...review(), approvedAmountCents: amount }, 'business_admin')).ok).toBe(false); expect(mock.rpc).not.toHaveBeenCalled();
  });
  it('requires a current revision and specific explanations', async () => {
    expect((await api.reviewExpenseClaim({ ...review(), expectedUpdatedAt: '' }, 'business_admin')).ok).toBe(false);
    expect((await api.reviewExpenseClaim({ ...review(), officeNote: '' }, 'business_admin')).ok).toBe(false);
    expect((await api.reviewExpenseClaim({ ...review(), status: 'needs_info', officeNote: '' }, 'business_admin')).ok).toBe(false);
    expect((await api.reviewExpenseClaim({ ...review(), status: 'rejected', rejectionReason: 'nein' }, 'business_admin')).ok).toBe(false);
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it('does not accept a changed month or status returned by the server', async () => {
    mock.rpc.mockResolvedValue({ data: { ...claimRow, expense_date: '2026-09-10' }, error: null });
    expect((await api.reviewExpenseClaim(review(), 'business_admin')).ok).toBe(false);
    mock.rpc.mockResolvedValue({ data: { ...claimRow, status: 'reimbursed' }, error: null });
    expect((await api.reviewExpenseClaim(review(), 'business_admin')).ok).toBe(false);
  });
});

describe('Office scoped document access', () => {
  it('reads the exact stored receipt reference before issuing a short signed URL', async () => {
    const path = `${tenant}/payroll/expenses/${employeeId}/receipt.pdf`;
    const query = queryRow({ id: claimId, tenant_id: tenant, employee_id: employeeId, receipt_path: path });
    expect((await api.getPayrollPdfUrl(path, { tenantId: tenant, employeeId, documentId: claimId, kind: 'expense' }, 'business_admin')).ok).toBe(true);
    expect(query.eq).toHaveBeenCalledWith('employee_id', employeeId); expect(mock.sign).toHaveBeenCalledWith(path, 300);
  });
  it('keeps an older stored PDF readable without generating a new statement', async () => {
    const path = `${tenant}/generated/historical.pdf`;
    queryRow({ id: claimId, tenant_id: tenant, employee_id: employeeId, pdf_path: path });
    expect((await api.getPayrollPdfUrl(path, { tenantId: tenant, employeeId, documentId: claimId, kind: 'statement' }, 'business_admin')).ok).toBe(true);
    expect(mock.render).not.toHaveBeenCalled();
  });
  it('rejects a foreign receipt path even when it is stored on the row', async () => {
    const path = `${tenant}/payroll/expenses/${userId}/receipt.pdf`;
    queryRow({ id: claimId, tenant_id: tenant, employee_id: employeeId, receipt_path: path });
    expect((await api.getPayrollPdfUrl(path, { tenantId: tenant, employeeId, documentId: claimId, kind: 'expense' }, 'business_admin')).ok).toBe(false);
    expect(mock.sign).not.toHaveBeenCalled();
  });
  it('rejects another person’s row and an upload made for a client', async () => {
    const path = `tenant/${tenant}/employees/${employeeId}/portal-uploads/file.pdf`;
    queryRow({ id: claimId, tenant_id: tenant, employee_id: userId, storage_path: path, upload_context: 'mitarbeiter' });
    expect((await api.getPayrollPdfUrl(path, { tenantId: tenant, employeeId, documentId: claimId, kind: 'portal' }, 'business_admin')).ok).toBe(false);
    queryRow({ id: claimId, tenant_id: tenant, employee_id: employeeId, storage_path: path, upload_context: 'klient' });
    expect((await api.getPayrollPdfUrl(path, { tenantId: tenant, employeeId, documentId: claimId, kind: 'portal' }, 'business_admin')).ok).toBe(false);
    expect(mock.sign).not.toHaveBeenCalled();
  });
});
