import { describe, expect, it, vi } from 'vitest';
import { ensureVisitTimeEvent } from '@/features/assistWorkflow/saveVisitTimeEvent';

vi.mock('@/lib/services/mode', () => ({
  getServiceMode: () => 'demo',
}));

describe('ensureVisitTimeEvent recurring execution cycles', () => {
  it('creates a new service_start after an earlier cycle was completed', async () => {
    const result = await ensureVisitTimeEvent(
      {
        tenantId: 'tenant-1',
        visitId: 'recurring-visit-1',
        eventType: 'service_start',
        occurredAt: '2026-07-24T07:25:00.000Z',
      },
      [
        { eventType: 'service_start', occurredAt: '2026-07-23T07:30:00.000Z' },
        { eventType: 'service_end', occurredAt: '2026-07-23T09:30:00.000Z' },
      ],
    );

    expect(result).toEqual({ ok: true, data: { id: 'demo', created: true } });
  });

  it('does not duplicate an open service_start from the current cycle', async () => {
    const result = await ensureVisitTimeEvent(
      {
        tenantId: 'tenant-1',
        visitId: 'recurring-visit-1',
        eventType: 'service_start',
        occurredAt: '2026-07-24T07:26:00.000Z',
      },
      [
        { eventType: 'service_start', occurredAt: '2026-07-23T07:30:00.000Z' },
        { eventType: 'service_end', occurredAt: '2026-07-23T09:30:00.000Z' },
        { eventType: 'service_start', occurredAt: '2026-07-24T07:25:00.000Z' },
      ],
    );

    expect(result).toEqual({ ok: true, data: { id: 'existing', created: false } });
  });
});
