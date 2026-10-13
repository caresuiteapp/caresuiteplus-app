import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VisitCreateWizardData } from '@/lib/assist/visitTypes';
import { EMPTY_VISIT_WIZARD_DATA } from '@/lib/assist/visitTypes';

const f = vi.hoisted(() => ({
  rows: [] as Record<string, any>[], records: [] as any[], legacyList: vi.fn(),
  error: null as { code: string; message: string } | null,
  errorOffset: 0, throwRead: false,
}));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/permissions', () => ({ enforcePermission: () => null }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: () => null }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({}) }));
vi.mock('@/lib/assist/repositories/assignmentRepository.supabase', () => ({ assignmentSupabaseRepository: { list: f.legacyList } }));
vi.mock('@/lib/assist/overlayVisitDispositionFromAssignment', () => ({
  overlayVisitDispositionListFromAssignments: async (_tenant: string, rows: unknown) => rows,
  overlayVisitDispositionDetailFromAssignment: async (_tenant: string, row: unknown) => row,
}));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: (_client: unknown, table: string) => {
  const record: any = { table, offset: 0, end: 199, filters: [], orders: [] };
  f.records.push(record);
  const finish = () => {
    if (f.throwRead) throw new Error('Fetch failed');
    if (f.error && record.offset === f.errorOffset) return { data: null, error: f.error };
    const rows = f.rows.filter(row => record.filters.every(([op, column, value]: any[]) => {
      const actual = column === 'recurrence_json->>pattern' ? row.recurrence_json?.pattern : row[column];
      if (op === 'eq') return actual === value;
      if (op === 'neq') return actual != null && actual !== value;
      if (column.startsWith('planned_')) {
        return op === 'lt' ? Date.parse(actual) < Date.parse(value) : Date.parse(actual) > Date.parse(value);
      }
      return actual <= value;
    })).sort((a, b) => Date.parse(a.planned_start_at) - Date.parse(b.planned_start_at) || a.id.localeCompare(b.id));
    return { data: rows.slice(record.offset, record.end + 1), error: null };
  };
  const chain: any = { select: (value: string) => { record.select = value; return chain; },
    order: (...args: any[]) => { record.orders.push(args); return chain; },
    range: (from: number, to: number) => { record.offset = from; record.end = to; return chain; },
    then: (resolve: any, reject: any) => Promise.resolve().then(finish).then(resolve, reject) };
  for (const op of ['eq', 'neq', 'lt', 'gt', 'lte']) chain[op] = (column: string, value: unknown) => {
    record.filters.push([op, column, value]); return chain;
  };
  return chain;
} }));
import { visitSupabaseRepository } from '@/lib/assist/repositories/visitRepository.supabase';
import { createVisitFromWizard, fetchVisitDispositionList } from '@/lib/assist/visitService';

const tenant = 'tenant-a';
const id = '27be8d4e-e6e1-4b2a-bccb-918ade0ad1ab';
const wizard = (overrides: Partial<VisitCreateWizardData> = {}): VisitCreateWizardData => ({
  ...EMPTY_VISIT_WIZARD_DATA, clientId: 'client-a', employeeId: 'employee-a',
  assignmentDate: '2026-10-12', plannedStartTime: '10:00', plannedEndTime: '11:00',
  title: 'Neuer Plan', tasks: ['Einkauf'], serviceKey: 'assist', addressSnapshot: 'Hauptstraße 1',
  saveAsDraft: true, ...overrides,
});
const existing = (overrides: Record<string, unknown> = {}) => ({
  id: 'existing-a', tenant_id: tenant, client_id: 'client-a', employee_id: 'employee-a',
  title: 'Bestehender Plan', canonical_status: 'planned', assignment_date: '2026-10-12',
  planned_start_at: '2026-10-12T07:30:00Z', planned_end_at: '2026-10-12T09:00:00Z',
  recurrence_json: { pattern: 'none' }, ...overrides,
});
const periods = [{ plannedStartAt: '2026-10-12T08:00:00Z', plannedEndAt: '2026-10-12T09:00:00Z' }];
beforeEach(() => {
  vi.clearAllMocks(); f.rows = []; f.records = []; f.error = null; f.errorOffset = 0; f.throwRead = false;
  f.legacyList.mockResolvedValue({ ok: true, data: [] });
  vi.spyOn(visitSupabaseRepository, 'create').mockResolvedValue({ ok: true, data: { id } });
  vi.spyOn(visitSupabaseRepository, 'materializeOccurrence').mockResolvedValue({ ok: true, data: { id: 'child', materialized: true } });
});
afterEach(() => vi.restoreAllMocks());

describe('Create preflight reads existing scoped plans before any new write', () => {
  it('reports actual employee and client overlap using saved IDs and preserves the warning receipt', async () => {
    f.rows = [existing()];
    const result = await createVisitFromWizard(tenant, wizard(), 'business_admin');
    expect(result).toMatchObject({ ok: true, data: { id, conflicts: expect.arrayContaining([
      'Mitarbeitende:r doppelt verplant (Bestehender Plan).', 'Klient:in doppelt geplant (Bestehender Plan).',
    ]) } });
    expect(visitSupabaseRepository.create).toHaveBeenCalledOnce();
    expect(f.records.every(record => record.filters.some((filter: any[]) => filter[1] === 'tenant_id' && filter[2] === tenant))).toBe(true);
    expect(f.records.some(record => record.filters.some((filter: any[]) => filter[1] === 'client_id' && filter[2] === 'client-a'))).toBe(true);
    expect(f.records.some(record => record.filters.some((filter: any[]) => filter[1] === 'employee_id' && filter[2] === 'employee-a'))).toBe(true);
  });
  it('ignores adjacent, cancelled, unrelated and other-tenant plans without inventing personnel-cache warnings', async () => {
    f.rows = [existing({ planned_end_at: '2026-10-12T08:00:00Z' }),
      existing({ id: 'cancelled', canonical_status: 'cancelled' }),
      existing({ id: 'other-person', client_id: 'client-b', employee_id: 'employee-b' }),
      existing({ id: 'foreign', tenant_id: 'tenant-b' })];
    expect(await createVisitFromWizard(tenant, wizard(), 'business_admin')).toEqual({ ok: true, data: { id, conflicts: [] } });
  });
  it('checks every planned series date, including an overlap only on the later occurrence', async () => {
    f.rows = [existing({ assignment_date: '2026-10-19', planned_start_at: '2026-10-19T08:00:00Z', planned_end_at: '2026-10-19T09:00:00Z' })];
    const result = await createVisitFromWizard(tenant, wizard({ recurrencePattern: 'weekly', recurrenceWeekdays: ['mo'], recurrenceOccurrenceCount: 2 }), 'business_admin');
    expect(result).toMatchObject({ ok: true, data: { conflicts: expect.arrayContaining(['Mitarbeitende:r doppelt verplant (Bestehender Plan).']) } });
  });
  it('also checks the actual written anchor when selected weekdays start later', async () => {
    f.rows = [existing({ assignment_date: '2026-10-13', planned_start_at: '2026-10-13T08:00:00Z', planned_end_at: '2026-10-13T09:00:00Z' })];
    const result = await createVisitFromWizard(tenant, wizard({ assignmentDate: '2026-10-13', recurrencePattern: 'weekly', recurrenceWeekdays: ['mo'], recurrenceOccurrenceCount: 2 }), 'business_admin');
    expect(result).toMatchObject({ ok: true, data: { conflicts: expect.arrayContaining(['Klient:in doppelt geplant (Bestehender Plan).']) } });
  });
  it('checks an older virtual series beyond its first year using Berlin winter time', async () => {
    f.rows = [existing({ assignment_date: '2025-07-07', planned_start_at: '2025-07-07T08:00:00Z', planned_end_at: '2025-07-07T09:00:00Z', recurrence_json: { pattern: 'weekly', weekdays: ['mo'] } })];
    const result = await createVisitFromWizard(tenant, wizard({ assignmentDate: '2026-11-02' }), 'business_admin');
    expect(result).toMatchObject({ ok: true, data: { conflicts: expect.arrayContaining(['Klient:in doppelt geplant (Bestehender Plan).']) } });
  });
  it.each([
    { code: '42501', message: 'permission denied for table assist_visits' },
    { code: 'NETWORK', message: 'Connection lost' },
  ])('fails closed before create on $code', async error => {
    f.error = error;
    expect(await createVisitFromWizard(tenant, wizard(), 'business_admin')).toMatchObject({ ok: false, error: expect.stringContaining('nicht geprüft') });
    expect(visitSupabaseRepository.create).not.toHaveBeenCalled();
  });
  it('returns a thrown transport failure without creating or using a legacy substitute', async () => {
    f.throwRead = true;
    expect(await createVisitFromWizard(tenant, wizard(), 'business_admin')).toMatchObject({ ok: false });
    expect(visitSupabaseRepository.create).not.toHaveBeenCalled(); expect(f.legacyList).not.toHaveBeenCalled();
  });
});

describe('Complete paged planning reads', () => {
  it('reads all relevant pages with stable ordering instead of missing a later overlap', async () => {
    f.rows = Array.from({ length: 401 }, (_, index) => existing({ id: `row-${String(index).padStart(3, '0')}` }));
    const result = await visitSupabaseRepository.listPlanningConflictCandidates(tenant, { clientId: 'client-a', periods });
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.data).toHaveLength(401);
    const ordinary = f.records.filter(record => record.filters.some((filter: any[]) => filter[0] === 'lt'));
    expect(ordinary.map(record => record.offset)).toEqual([0, 200, 400]);
    expect(ordinary.every(record => record.orders.some((order: any[]) => order[0] === 'id'))).toBe(true);
  });
  it('does not accept the first page when a later page is denied', async () => {
    f.rows = Array.from({ length: 401 }, (_, index) => existing({ id: `row-${index}` }));
    f.errorOffset = 200; f.error = { code: '42501', message: 'permission denied' };
    expect((await createVisitFromWizard(tenant, wizard(), 'business_admin')).ok).toBe(false);
    expect(visitSupabaseRepository.create).not.toHaveBeenCalled();
  });
  it('excludes detached and already materialized virtual dates while reading their physical replacement', async () => {
    f.rows = [existing({ assignment_date: '2026-10-05', planned_start_at: '2026-10-05T08:00:00Z', planned_end_at: '2026-10-05T09:00:00Z', recurrence_json: { pattern: 'weekly', weekdays: ['mo'], occurrenceCount: 2, materializedOccurrences: { '2026-10-12': 'replacement' } } }),
      existing({ id: 'replacement', title: 'Physischer Termin', planned_start_at: '2026-10-12T12:00:00Z', planned_end_at: '2026-10-12T13:00:00Z' })];
    expect(await visitSupabaseRepository.listPlanningConflictCandidates(tenant, { clientId: 'client-a', periods })).toEqual({ ok: true, data: [] });
    f.rows[0].recurrence_json = { pattern: 'weekly', weekdays: ['mo'], occurrenceCount: 2, detachedOccurrenceDates: ['2026-10-12'] };
    expect(await visitSupabaseRepository.listPlanningConflictCandidates(tenant, { clientId: 'client-a', periods })).toEqual({ ok: true, data: [] });
  });
  it('includes an overnight virtual series occurrence which starts before the selected day', async () => {
    f.rows = [existing({ assignment_date: '2026-10-04', planned_start_at: '2026-10-04T20:00:00Z', planned_end_at: '2026-10-05T08:30:00Z', recurrence_json: { pattern: 'weekly', weekdays: ['so'], occurrenceCount: 2 } })];
    expect(await visitSupabaseRepository.listPlanningConflictCandidates(tenant, { clientId: 'client-a', periods })).toMatchObject({ ok: true, data: [expect.objectContaining({ id: 'existing-a::2026-10-11' })] });
  });
});

describe('Legacy list fallback requires confirmed absent canonical schema', () => {
  it.each(['PGRST205', '42P01'])('uses the legacy generation only for positively missing assist_visits (%s)', async code => {
    f.error = { code, message: 'Could not find the table public.assist_visits in the schema cache' };
    expect(await fetchVisitDispositionList(tenant, 'business_admin')).toEqual({ ok: true, data: [] });
    expect(f.legacyList).toHaveBeenCalledWith(tenant);
  });
  it.each([
    { code: '42501', message: 'permission denied for table assist_visits' },
    { code: 'NETWORK', message: 'schema cache refresh timed out' },
    { code: 'PGRST205', message: 'Could not find the table public.clients in the schema cache' },
    { code: '42703', message: 'column optional_field does not exist' },
  ])('preserves $code without masking it as old data', async error => {
    f.error = error;
    expect((await fetchVisitDispositionList(tenant, 'business_admin')).ok).toBe(false);
    expect(f.legacyList).not.toHaveBeenCalled();
  });
  it('keeps an authoritative empty list empty', async () => {
    expect(await fetchVisitDispositionList(tenant, 'business_admin')).toEqual({ ok: true, data: [] });
    expect(f.legacyList).not.toHaveBeenCalled();
  });
});
