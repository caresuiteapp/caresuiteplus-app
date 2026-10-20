import { describe, expect, it } from 'vitest';
import { calculateVisitTimes } from '@/features/assistWorkflow/calculateVisitTimes';
import { computeLiveVisitTimers } from '@/features/assistWorkflow/computeLiveVisitTimers';

describe('calculateVisitTimes', () => {
  it('computes drive duration until arrive', () => {
    const times = calculateVisitTimes(
      [
        { eventType: 'drive_start', occurredAt: '2026-06-29T08:00:00.000Z' },
        { eventType: 'arrive', occurredAt: '2026-06-29T08:30:00.000Z' },
      ],
      'angekommen',
    );
    expect(times.driveSeconds).toBe(1800);
    expect(times.activeTimer).toBeNull();
  });

  it('subtracts pause from service time', () => {
    const times = calculateVisitTimes(
      [
        { eventType: 'service_start', occurredAt: '2026-06-29T09:00:00.000Z' },
        { eventType: 'pause_start', occurredAt: '2026-06-29T09:20:00.000Z' },
        { eventType: 'pause_end', occurredAt: '2026-06-29T09:30:00.000Z' },
        { eventType: 'service_end', occurredAt: '2026-06-29T10:00:00.000Z' },
      ],
      'beendet',
    );
    expect(times.pauseSeconds).toBe(600);
    expect(times.serviceSeconds).toBe(3000);
  });

  it('shows active drive timer while unterwegs', () => {
    const times = calculateVisitTimes(
      [{ eventType: 'drive_start', occurredAt: '2026-06-29T08:00:00.000Z' }],
      'unterwegs',
      new Date('2026-06-29T08:10:00.000Z'),
    );
    expect(times.activeTimer).toBe('drive');
    expect(times.driveSeconds).toBe(600);
  });

  it('stops drive after arrive without extending to now on beendet', () => {
    const times = calculateVisitTimes(
      [
        { eventType: 'drive_start', occurredAt: '2026-06-29T08:00:00.000Z' },
        { eventType: 'arrive', occurredAt: '2026-06-29T08:30:00.000Z' },
      ],
      'beendet',
      new Date('2026-06-29T10:00:00.000Z'),
    );
    expect(times.driveSeconds).toBe(1800);
    expect(times.activeTimer).toBeNull();
    expect(times.serviceSeconds).toBeNull();
  });

  it('counts service time while paused', () => {
    const times = calculateVisitTimes(
      [
        { eventType: 'service_start', occurredAt: '2026-06-29T09:00:00.000Z' },
        { eventType: 'pause_start', occurredAt: '2026-06-29T09:20:00.000Z' },
      ],
      'pausiert',
      new Date('2026-06-29T09:30:00.000Z'),
    );
    expect(times.activeTimer).toBe('pause');
    expect(times.pauseSeconds).toBe(600);
    expect(times.serviceSeconds).toBe(1200);
  });

  it('uses only the latest drive and service cycle for recurring visits', () => {
    const times = calculateVisitTimes(
      [
        { eventType: 'drive_start', occurredAt: '2026-07-23T15:00:00.000Z' },
        { eventType: 'arrive', occurredAt: '2026-07-23T15:17:18.000Z' },
        { eventType: 'service_start', occurredAt: '2026-07-23T15:20:00.000Z' },
        { eventType: 'service_end', occurredAt: '2026-07-23T17:00:00.000Z' },
        { eventType: 'drive_start', occurredAt: '2026-07-24T07:10:00.000Z' },
        { eventType: 'arrive', occurredAt: '2026-07-24T07:25:00.000Z' },
        { eventType: 'service_start', occurredAt: '2026-07-24T07:30:00.000Z' },
      ],
      'gestartet',
      new Date('2026-07-24T08:41:00.000Z'),
    );

    expect(times.driveStartedAt).toBe('2026-07-24T07:10:00.000Z');
    expect(times.driveSeconds).toBe(900);
    expect(times.serviceStartedAt).toBe('2026-07-24T07:30:00.000Z');
    expect(times.serviceSeconds).toBe(4260);
    expect(times.serviceEndedAt).toBeNull();
    expect(times.activeTimer).toBe('service');
  });

  it('starts the live timer from the verified fallback while realtime still has only arrival rows', () => {
    const timers = computeLiveVisitTimers(
      [
        { eventType: 'drive_start', occurredAt: '2026-08-05T08:00:00.000Z' },
        { eventType: 'arrive', occurredAt: '2026-08-05T08:15:00.000Z' },
      ],
      'gestartet',
      {
        driveSeconds: 900,
        serviceSeconds: 0,
        pauseSeconds: null,
        totalSeconds: 900,
        driveStartedAt: '2026-08-05T08:00:00.000Z',
        serviceStartedAt: '2026-08-05T08:20:00.000Z',
        pauseStartedAt: null,
        arrivedAt: '2026-08-05T08:15:00.000Z',
        serviceEndedAt: null,
        activeTimer: 'service',
      },
      new Date('2026-08-05T08:20:07.000Z'),
    );

    expect(timers?.activeTimer).toBe('service');
    expect(timers?.serviceStartedAt).toBe('2026-08-05T08:20:00.000Z');
    expect(timers?.serviceSeconds).toBe(7);
  });
});
