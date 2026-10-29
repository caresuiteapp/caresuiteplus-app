import { beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({
  resolve: vi.fn(), result: { data: [] as unknown, error: null as unknown, count: 0 },
  queries: [] as { table: string; update?: unknown; filters: unknown[][] }[],
}));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: () => null }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({}) }));
vi.mock('@/lib/supabase/errors', () => ({ toGermanSupabaseError: (error: { message: string }) => error.message }));
vi.mock('@/lib/portal/resolvePortalEmployeeLink', () => ({ resolvePortalEmployeeLinkForAuthUser: h.resolve }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: (_client: unknown, table: string) => {
  const entry = { table, filters: [] as unknown[][], update: undefined as unknown };
  h.queries.push(entry);
  const query = { select: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
    eq: (key: string, value: unknown) => { entry.filters.push(['eq', key, value]); return query; },
    contains: (key: string, value: unknown) => { entry.filters.push(['contains', key, value]); return query; },
    in: (key: string, value: unknown) => { entry.filters.push(['in', key, value]); return query; },
    update: (value: unknown) => { entry.update = value; return query; },
    maybeSingle: () => Promise.resolve(h.result),
    then: (resolve: (value: typeof h.result) => unknown) => Promise.resolve(h.result).then(resolve),
  };
  return query;
} }));
import {
  acknowledgeEmployeeAssignmentNotices, fetchEmployeeAssignmentNotices,
  resolveEmployeeAssignmentNoticeRoute, type EmployeeAssignmentNotice,
} from '@/lib/portal/employeeAssignmentNoticeService.web';
const id = '10000000-0000-4000-8000-000000000001';
const visitId = '20000000-0000-4000-8000-000000000002';
const scope = { tenantId: 'tenant-a', employeeId: 'employee-a', authUserId: 'auth-a' };
const row = () => ({ id, tenant_id: scope.tenantId, recipient_employee_id: scope.employeeId,
  notification_type: 'appointment', is_read: false, title: 'Einsatz geändert', body_preview: 'Morgen 11:30–13:30 Uhr',
  metadata: { kind: 'assignment_change', changeKind: 'changed', visitId }, created_at: '2026-10-26T12:00:00Z' });
const notice: EmployeeAssignmentNotice = { id, visitId, changeKind: 'changed', title: 'Einsatz geändert', body: '', createdAt: '' };
beforeEach(() => {
  vi.clearAllMocks(); h.queries = []; h.result = { data: [], error: null, count: 0 };
  h.resolve.mockResolvedValue({ status: 'verified', employeeId: scope.employeeId, authUserId: scope.authUserId });
});
describe('employee assignment notice recipient scope', () => {
  it('uses readable text for an unknown legacy change kind', async () => {
    h.result = { data: [{ ...row(), title: '', body_preview: '', metadata: { ...row().metadata, changeKind: 'toString' } }], error: null, count: 1 };
    const result = await fetchEmployeeAssignmentNotices(scope);
    expect(result.ok && result.data.notices[0].title).toBe('Einsatz aktualisiert');
  });
  it.each(['created', 'changed', 'cancelled', 'removed'])('keeps a %s notice informative when its preview is missing', async changeKind => {
    h.result = { data: [{ ...row(), title: ' ', body_preview: '', metadata: {
      ...row().metadata, changeKind, plannedStartAt: '2026-10-29T12:00:00Z', plannedEndAt: '2026-10-29T14:00:00Z',
    } }], error: null, count: 1 };
    const result = await fetchEmployeeAssignmentNotices(scope);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.notices[0].title.trim()).not.toBe('');
    expect(result.data.notices[0].body).toContain('29.10.2026');
    expect(result.data.notices[0].body).toContain('13:00');
    expect(result.data.notices[0].changeKind).toBe(changeKind);
  });
  it.each([
    { status: 'denied' }, { status: 'unavailable' },
    { status: 'verified', employeeId: 'employee-b', authUserId: scope.authUserId },
    { status: 'verified', employeeId: scope.employeeId, authUserId: 'auth-b' },
  ])('blocks reads and receipts without the exact current authenticated employee: %j', async resolution => {
    h.resolve.mockResolvedValue(resolution);
    expect((await fetchEmployeeAssignmentNotices(scope)).ok).toBe(false);
    expect((await acknowledgeEmployeeAssignmentNotices(scope, [id])).ok).toBe(false);
    expect(h.queries).toEqual([]);
  });
  it('loads only unread assignment changes and refuses foreign, read or other-kind returned rows', async () => {
    h.result = { data: [row(), { ...row(), tenant_id: 'tenant-b' }, { ...row(), recipient_employee_id: 'employee-b' },
      { ...row(), is_read: true }, { ...row(), metadata: { kind: 'message' } }], error: null, count: 1 };
    const result = await fetchEmployeeAssignmentNotices(scope);
    expect(result).toEqual({ ok: true, data: { notices: [{ ...notice, body: 'Morgen 11:30–13:30 Uhr', createdAt: '2026-10-26T12:00:00Z' }], total: 1 } });
    expect(h.queries[0].filters).toEqual(expect.arrayContaining([
      ['eq', 'tenant_id', scope.tenantId], ['eq', 'recipient_employee_id', scope.employeeId],
      ['eq', 'notification_type', 'appointment'], ['eq', 'is_read', false], ['contains', 'metadata', { kind: 'assignment_change' }],
    ]));
  });
  it('requires the exact returned server receipt, never a successful zero-row UPDATE', async () => {
    expect((await acknowledgeEmployeeAssignmentNotices(scope, [id])).ok).toBe(false);
    h.result.data = [{ id, tenant_id: scope.tenantId, recipient_employee_id: 'employee-b', is_read: true }];
    expect((await acknowledgeEmployeeAssignmentNotices(scope, [id])).ok).toBe(false);
    h.result.data = [{ id, tenant_id: scope.tenantId, recipient_employee_id: scope.employeeId, is_read: true }];
    expect((await acknowledgeEmployeeAssignmentNotices(scope, [id])).ok).toBe(true);
    expect(h.queries.at(-1)?.update).toEqual({ is_read: true, read_at: expect.any(String) });
    expect(h.queries.at(-1)?.filters).toContainEqual(['eq', 'recipient_employee_id', scope.employeeId]);
  });
  it('does not report receipt success after a server error', async () => {
    h.result.error = { message: 'Network unavailable' };
    expect(await acknowledgeEmployeeAssignmentNotices(scope, [id])).toEqual({ ok: false, error: 'Network unavailable' });
  });
  it('does not mutate malformed or oversized batches', async () => {
    expect((await acknowledgeEmployeeAssignmentNotices(scope, ['not-an-id'])).ok).toBe(false);
    expect((await acknowledgeEmployeeAssignmentNotices(scope, [])).ok).toBe(false);
    expect((await acknowledgeEmployeeAssignmentNotices(scope,
      Array.from({ length: 51 }, (_, index) => `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`))).ok).toBe(false);
    expect(h.queries).toEqual([]);
  });
  it('rechecks current ownership before opening and ignores legacy hidden flags on an owned published visit', async () => {
    h.result.data = { id: visitId, tenant_id: scope.tenantId, employee_id: scope.employeeId,
      planning_status: 'scheduled', employee_portal_visible: false };
    expect(await resolveEmployeeAssignmentNoticeRoute(scope, notice)).toEqual({ ok: true, data: `/portal/employee/assignments/${visitId}/execute` });
    expect(h.queries[0].filters).toContainEqual(['eq', 'employee_id', scope.employeeId]);
  });
  it.each(['confirmed', 'completed'])('opens the current calendar for a series whose master is %s', async canonicalStatus => {
    h.result.data = { id: visitId, tenant_id: scope.tenantId, employee_id: scope.employeeId,
      planning_status: 'scheduled', canonical_status: canonicalStatus,
      recurrence_json: { pattern: 'weekly', weekdays: ['mon'] } };
    expect(await resolveEmployeeAssignmentNoticeRoute(scope, notice))
      .toEqual({ ok: true, data: '/portal/employee/calendar' });
  });
  it('opens the concrete execution for a materialized series child with pattern none', async () => {
    h.result.data = { id: visitId, tenant_id: scope.tenantId, employee_id: scope.employeeId,
      planning_status: 'scheduled', canonical_status: 'confirmed',
      recurrence_json: { pattern: 'none', parentSeriesId: '30000000-0000-4000-8000-000000000003', sourceOccurrenceDate: '2026-10-26' } };
    expect(await resolveEmployeeAssignmentNoticeRoute(scope, notice))
      .toEqual({ ok: true, data: `/portal/employee/assignments/${visitId}/execute` });
  });
  it('still verifies the current employee ownership before offering the calendar for a series', async () => {
    h.result.data = { id: visitId, tenant_id: scope.tenantId, employee_id: 'employee-b',
      planning_status: 'scheduled', canonical_status: 'completed', recurrence_json: { pattern: 'weekly' } };
    expect((await resolveEmployeeAssignmentNoticeRoute(scope, notice)).ok).toBe(false);
  });
  it.each([null, { employee_id: 'employee-b', planning_status: 'scheduled' },
    { employee_id: scope.employeeId, planning_status: 'draft' }, { employee_id: scope.employeeId, planning_status: 'cancelled' },
    { employee_id: scope.employeeId, planning_status: 'scheduled', canonical_status: 'cancelled' },
    { employee_id: scope.employeeId, planning_status: 'scheduled', canonical_status: 'no_show' }])(
    'refuses an unavailable, reassigned or unpublished visit: %j', async data => {
      h.result.data = data ? { id: visitId, tenant_id: scope.tenantId, ...data } : null;
      expect((await resolveEmployeeAssignmentNoticeRoute(scope, notice)).ok).toBe(false);
    });
  it('uses a fixed verified calendar route for the rollout planning notice', async () => {
    expect(await resolveEmployeeAssignmentNoticeRoute(scope, { ...notice, visitId: null, changeKind: 'current_plan' }))
      .toEqual({ ok: true, data: '/portal/employee/calendar' });
    expect(h.queries).toEqual([]);
  });
  it('does not open a removed or cancelled assignment from a historic notice', async () => {
    expect((await resolveEmployeeAssignmentNoticeRoute(scope, { ...notice, changeKind: 'removed' })).ok).toBe(false);
    expect((await resolveEmployeeAssignmentNoticeRoute(scope, { ...notice, changeKind: 'cancelled' })).ok).toBe(false);
    expect(h.queries).toEqual([]);
  });
});
