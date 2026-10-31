import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CalendarEventRecord, CalendarViewConfig } from '@/types/calendar';

const f = vi.hoisted(() => ({ rows: [] as unknown[], writes: [] as Record<string, unknown>[], queries: [] as [string, unknown[]][][] }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({}) }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: () => {
  const operations: [string, unknown[]][] = []; f.queries.push(operations);
  const chain: Record<string, unknown> = {};
  for (const name of ['select', 'eq', 'is', 'order', 'gte', 'lte', 'neq', 'or']) chain[name] = (...args: unknown[]) => { operations.push([name, args]); return chain; };
  chain.upsert = (payload: Record<string, unknown>) => { f.writes.push(payload); return chain; };
  chain.single = () => Promise.resolve({ data: { ...f.writes.at(-1), id: 'meeting' }, error: null });
  chain.then = (resolve: (value: unknown) => void) => Promise.resolve({ data: f.rows, error: null }).then(resolve);
  return chain;
} }));
import { calendarEventRepository } from '@/lib/calendar/calendarEventRepository';
import { mapCalendarEventRecordToUi, mapCalendarEventRow } from '@/lib/calendar/calendarEventMapper';
import { filterCalendarRecords } from '@/lib/calendar/calendarFilters';
import { filterEmployeeEvents } from '@/lib/calendar/employeeMonthPlanning';

const first = '00000000-0000-4000-8000-000000000011', second = '00000000-0000-4000-8000-000000000012';
const config: CalendarViewConfig = { calendarScope: 'office', moduleKey: 'all', showAllModules: true };
const record: CalendarEventRecord = {
  id: 'meeting', tenantId: 'tenant', title: 'Teammeeting', sourceType: 'custom_event', sourceId: 'source', moduleKey: 'office',
  eventType: 'besprechung', relatedEmployeeId: first, participantEmployeeIds: [first, second],
  startAt: '2026-10-23T08:00:00Z', endAt: '2026-10-23T09:00:00Z', status: 'aktiv',
  isOfficeVisible: true, isEmployeePortalVisible: true,
} as CalendarEventRecord;
beforeEach(() => { f.rows = []; f.writes = []; f.queries = []; });

describe('calendar employee membership survives persistence and filtering', () => {
  it('maps every persisted employee and falls back to a legacy singular relation', () => {
    const multi = mapCalendarEventRow({ related_employee_id: first, participant_employee_ids: [first, second] } as never);
    const legacy = mapCalendarEventRow({ related_employee_id: second } as never);
    expect(multi.participantEmployeeIds).toEqual([first, second]); expect(legacy.participantEmployeeIds).toEqual([second]);
  });
  it('includes the same meeting for each employee in personal views and availability planning', () => {
    const event = mapCalendarEventRecordToUi(record);
    for (const employeeId of [first, second]) {
      expect(filterCalendarRecords([record], { ...config, entityContext: { employeeId } })).toEqual([record]);
      expect(filterCalendarRecords([record], config, { employeeId })).toEqual([record]);
      expect(filterEmployeeEvents([event], employeeId)).toEqual([event]);
    }
    expect(filterEmployeeEvents([event], 'another-employee')).toEqual([]);
    expect(filterEmployeeEvents([event], '')).toHaveLength(1);
  });
  it('persists every participant in a single calendar row and reads the full selection back', async () => {
    const saved = await calendarEventRepository.upsert({ ...record, sourceId: 'source' });
    expect(f.writes).toHaveLength(1);
    expect(f.writes[0]).toMatchObject({ tenant_id: 'tenant', related_employee_id: first, participant_employee_ids: [first, second] });
    expect(saved.ok && saved.data.participantEmployeeIds).toEqual([first, second]);
  });
  it('keeps unrelated source syncs from explicitly clearing the participant list', async () => {
    const { participantEmployeeIds: _participants, ...legacy } = record;
    await calendarEventRepository.upsert({ ...legacy, sourceId: 'source' });
    expect(f.writes[0]).not.toHaveProperty('participant_employee_ids');
  });
  it('queries personal portals by primary or additional membership and retains tenant, visibility and range filters', async () => {
    await calendarEventRepository.listForPortal('tenant', { portalType: 'employee', employeeId: second }, record.startAt, record.endAt);
    await calendarEventRepository.listForEmployee('tenant', second, record.startAt, record.endAt);
    for (const operations of f.queries) {
      expect(operations).toContainEqual(['or', [`related_employee_id.eq.${second},participant_employee_ids.cs.{${second}}`]]);
      expect(operations).toContainEqual(['eq', ['tenant_id', 'tenant']]);
      expect(operations).toContainEqual(['eq', ['is_employee_portal_visible', true]]);
      expect(operations).toContainEqual(['is', ['archived_at', null]]);
      expect(operations).toContainEqual(['gte', ['end_at', record.startAt]]);
    }
  });
  it('rejects untrusted filter syntax instead of interpolating it into portal queries', async () => {
    expect((await calendarEventRepository.listForEmployee('tenant', 'x,tenant_id.neq.tenant')).ok).toBe(false);
    expect(f.queries).toHaveLength(0);
  });
});
