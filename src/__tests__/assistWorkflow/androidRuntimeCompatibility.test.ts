import { describe, expect, it } from 'vitest';
import { calculateVisitTimes } from '@/features/assistWorkflow/calculateVisitTimes';
import { formatReturnTripDuration } from '@/lib/portal/employeePortalReturnTripRules';

/* eslint-disable no-extend-native -- the test intentionally emulates an older Android JS runtime */

describe('Android execution runtime compatibility', () => {
  it('builds the server-synced execution context without Array.at or String.padStart', () => {
    const originalAt = Array.prototype.at;
    const originalPadStart = String.prototype.padStart;
    try {
      Object.defineProperty(Array.prototype, 'at', { configurable: true, value: undefined });
      Object.defineProperty(String.prototype, 'padStart', { configurable: true, value: undefined });
      const times = calculateVisitTimes([
        { eventType: 'drive_start', occurredAt: '2026-09-05T08:00:00.000Z' },
        { eventType: 'arrive', occurredAt: '2026-09-05T08:20:00.000Z' },
        { eventType: 'service_start', occurredAt: '2026-09-05T08:22:00.000Z' },
      ], 'gestartet', new Date('2026-09-05T08:30:00.000Z'));
      expect(times.driveSeconds).toBe(1_200);
      expect(times.serviceSeconds).toBe(480);
      expect(formatReturnTripDuration('2026-09-05T08:00:00.000Z', new Date('2026-09-05T08:01:05.000Z')))
        .toBe('01:05');
    } finally {
      Object.defineProperty(Array.prototype, 'at', { configurable: true, value: originalAt });
      Object.defineProperty(String.prototype, 'padStart', { configurable: true, value: originalPadStart });
    }
  });
});
