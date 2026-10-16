import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServiceResult } from '@/types';
import type { AssistTimeEventRow } from '@/types/assistExecutionPersistence';
const h = vi.hoisted(() => ({
  denied: null as ServiceResult<never> | null, blocked: null as ServiceResult<never> | null,
  client: true, rows: [] as Record<string, unknown>[], error: null as unknown, thrown: false,
  from: vi.fn(), events: vi.fn(), conditions: [] as [string, unknown][],
}));
vi.mock('@/lib/permissions', () => ({ enforcePermission: () => h.denied }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: () => h.blocked }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => h.client ? { from: h.from } : null }));
vi.mock('@/lib/assist/assistTrackingPersistenceService', () => ({ fetchTimeEventsForVisit: h.events }));
import { fetchAdministrativeMinutes } from '@/lib/assist/administrativeMinutes.web';

const tenant = '11111111-1111-4111-8111-111111111111', visit = '22222222-2222-4222-8222-222222222222';
const metadata = (pause: unknown = 15, travel: unknown = 22) => ({ source: 'administrative_follow_up', pause_minutes: pause, travel_minutes: travel });
const correction = (changes: Record<string, unknown> = {}) => ({ tenant_id: tenant, reference_type: 'visit', reference_id: visit, metadata: metadata(), created_at: '2026-10-16T08:00:00Z', ...changes });
const time = (eventType: AssistTimeEventRow['eventType'], occurredAt: string, meta: Record<string, unknown> = {}): AssistTimeEventRow => ({ id: `${eventType}-${occurredAt}`, tenantId: tenant, visitId: visit, sessionId: null, eventType, occurredAt, recordedBy: null, durationSeconds: null, metadata: meta, createdAt: occurredAt });
const read = () => fetchAdministrativeMinutes(tenant, visit, 'beendet', 'business_admin');
beforeEach(() => {
  vi.clearAllMocks(); h.denied = null; h.blocked = null; h.client = true; h.rows = []; h.error = null; h.thrown = false; h.conditions = [];
  h.events.mockResolvedValue({ ok: true, data: [] });
  h.from.mockImplementation(() => {
    const conditions: [string, unknown][] = []; let orderKey = '', ascending = false, limit = Infinity;
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn((key: string, value: unknown) => { conditions.push([key, value]); h.conditions.push([key, value]); return query; }),
      order: vi.fn((key: string, options: { ascending: boolean }) => { orderKey = key; ascending = options.ascending; return query; }),
      limit: vi.fn((value: number) => { limit = value; return query; }),
      maybeSingle: vi.fn(async () => {
        if (h.thrown) throw new Error('Transport failed');
        const rows = h.rows.filter(row => conditions.every(([key, value]) => key === 'metadata->>source'
          ? (row.metadata as Record<string, unknown> | undefined)?.source === value : row[key] === value));
        rows.sort((a, b) => String(a[orderKey]).localeCompare(String(b[orderKey])) * (ascending ? 1 : -1));
        return { data: rows.slice(0, limit)[0] ?? null, error: h.error };
      }),
    };
    return query;
  });
});

describe('Stored administrative pause and travel minutes', () => {
  it('uses the latest scoped persisted correction rather than recalculating old original events', async () => {
    h.rows = [correction({ created_at: '2026-10-15T08:00:00Z', metadata: metadata(5, 6) }), correction(),
      correction({ tenant_id: 'other-tenant', created_at: '2026-10-17T08:00:00Z', metadata: metadata(50, 60) }),
      correction({ reference_id: 'other-visit', created_at: '2026-10-18T08:00:00Z', metadata: metadata(70, 80) }),
      correction({ reference_type: 'appointment', created_at: '2026-10-19T08:00:00Z' }),
      correction({ metadata: { source: 'other', pause_minutes: 90, travel_minutes: 90 }, created_at: '2026-10-20T08:00:00Z' })];
    expect(await read()).toEqual({ ok: true, data: { pause: '15', travel: '22' } });
    expect(h.from).toHaveBeenCalledWith('workforce_time_events');
    expect(h.conditions).toEqual(expect.arrayContaining([['tenant_id', tenant], ['reference_id', visit], ['reference_type', 'visit'], ['metadata->>source', 'administrative_follow_up']]));
    expect(h.events).not.toHaveBeenCalled();
  });
  it('preserves explicit saved zero values', async () => {
    h.rows = [correction({ metadata: metadata(0, 0) })];
    expect(await read()).toEqual({ ok: true, data: { pause: '0', travel: '0' } });
  });
  it.each([
    ['missing pause', { source: 'administrative_follow_up', travel_minutes: 20 }], ['missing travel', { source: 'administrative_follow_up', pause_minutes: 10 }],
    ['string', metadata('15', 20)], ['negative', metadata(-1, 20)], ['fraction', metadata(1.5, 20)],
    ['unsafe integer', metadata(Number.MAX_SAFE_INTEGER + 1, 20)], ['NaN', metadata(Number.NaN, 20)],
  ])('blocks %s metadata without falling back to zero or old events', async (_label, saved) => {
    h.rows = [correction({ metadata: saved })];
    const result = await read(); expect(result.ok).toBe(false); expect(h.events).not.toHaveBeenCalled();
  });
  it.each(['denied', 'blocked', 'unconfigured'] as const)('does not query or fabricate values when %s', async reason => {
    if (reason === 'denied') h.denied = { ok: false, error: 'Keine Berechtigung' };
    if (reason === 'blocked') h.blocked = { ok: false, error: 'Falscher Mandant' };
    if (reason === 'unconfigured') h.client = false;
    expect((await read()).ok).toBe(false); expect(h.from).not.toHaveBeenCalled(); expect(h.events).not.toHaveBeenCalled();
  });
  it.each(['database', 'transport'] as const)('blocks %s failures without falling back', async failure => {
    if (failure === 'database') h.error = { message: 'row level security' }; else h.thrown = true;
    expect((await read()).ok).toBe(false); expect(h.events).not.toHaveBeenCalled();
  });
  it('does not replace an unmatched administrative correction with values from ordinary events', async () => {
    h.events.mockResolvedValue({ ok: true, data: [time('service_start', '2026-10-16T08:00:00Z', { source: 'administrative_follow_up' })] });
    const result = await read(); expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('korrigierten Minutenwerte');
  });
  it.each([{ ok: false, error: 'Not allowed' }, { ok: true, data: [], tableMissing: true }])('blocks incomplete time-event reads', async result => {
    h.events.mockResolvedValue(result); expect((await read()).ok).toBe(false);
  });
  it('derives pause and travel from complete recorded event pairs when there is no correction', async () => {
    h.events.mockResolvedValue({ ok: true, data: [time('drive_start', '2026-10-16T07:40:00Z'), time('arrive', '2026-10-16T08:00:00Z'), time('service_start', '2026-10-16T08:00:00Z'), time('pause_start', '2026-10-16T08:30:00Z'), time('pause_end', '2026-10-16T08:45:00Z'), time('service_end', '2026-10-16T09:00:00Z')] });
    expect(await read()).toEqual({ ok: true, data: { pause: '15', travel: '20' } });
    expect(h.events).toHaveBeenCalledWith(tenant, visit);
  });
  it('allows zero only when the successful complete read contains no pause or travel records', async () => {
    h.events.mockResolvedValue({ ok: true, data: [time('service_start', '2026-10-16T08:00:00Z'), time('service_end', '2026-10-16T09:00:00Z')] });
    expect(await read()).toEqual({ ok: true, data: { pause: '0', travel: '0' } });
  });
  it.each([
    ['unclosed pause', [time('service_start', '2026-10-16T08:00:00Z'), time('pause_start', '2026-10-16T08:30:00Z'), time('service_end', '2026-10-16T09:00:00Z')]],
    ['pause end without start', [time('service_start', '2026-10-16T08:00:00Z'), time('pause_end', '2026-10-16T08:45:00Z'), time('service_end', '2026-10-16T09:00:00Z')]],
    ['unclosed drive', [time('drive_start', '2026-10-16T07:40:00Z'), time('service_start', '2026-10-16T08:00:00Z'), time('service_end', '2026-10-16T09:00:00Z')]],
    ['invalid timestamp', [time('drive_start', 'invalid'), time('arrive', '2026-10-16T08:00:00Z')]],
    ['inverted pause', [time('service_start', '2026-10-16T08:00:00Z'), time('pause_end', '2026-10-16T08:15:00Z'), time('pause_start', '2026-10-16T08:30:00Z'), time('service_end', '2026-10-16T09:00:00Z')]],
  ])('does not write a silent zero baseline for %s', async (_label, events) => {
    h.events.mockResolvedValue({ ok: true, data: events }); expect((await read()).ok).toBe(false);
  });
});
