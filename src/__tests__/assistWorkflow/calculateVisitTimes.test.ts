import { describe, expect, it } from 'vitest';
import { calculateVisitTimes } from '@/features/assistWorkflow/calculateVisitTimes';

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
});
