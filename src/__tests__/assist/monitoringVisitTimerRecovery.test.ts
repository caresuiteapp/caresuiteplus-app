import { describe, expect, it } from 'vitest';
import { resolveMonitoringVisitTimers } from '@/features/assistLive/resolveMonitoringVisitTimers';
import { calculateVisitTimes, type TimeEventLike } from '@/features/assistWorkflow/calculateVisitTimes';

const at = (hour: number, minute = 0) => new Date(Date.UTC(2026, 0, 15, hour, minute)).toISOString();
const now = new Date(at(20));
const event = (eventType: string, hour: number, minute = 0): TimeEventLike => ({ eventType, occurredAt: at(hour, minute) });
const recorded = {
  ...calculateVisitTimes([], 'gestartet', now),
  driveStartedAt: at(8), arrivedAt: at(8, 30), serviceStartedAt: at(9), serviceEndedAt: at(11),
};
describe('administration timers use the same evidence as the workflow status', () => {
  it('uses the recorded arrival even when its event is missing', () => {
    const result = resolveMonitoringVisitTimers([event('drive_start', 8), event('service_start', 9)], 'gestartet', { ...recorded, serviceEndedAt: null }, now);
    expect(result.driveSeconds).toBe(30 * 60);
    expect(result.activeTimer).toBe('service');
  });
  it('stops service at the recorded end when the event mirror is incomplete', () => {
    const result = resolveMonitoringVisitTimers([event('service_start', 9)], 'unterschrift_offen', recorded, now);
    expect(result.serviceSeconds).toBe(2 * 60 * 60);
    expect(result.activeTimer).toBeNull();
  });
  it('retains real pause events when supplementing a missing end', () => {
    const result = resolveMonitoringVisitTimers([event('service_start', 9), event('pause_start', 10), event('pause_end', 10, 15)], 'dokumentation_offen', recorded, now);
    expect(result.serviceSeconds).toBe(105 * 60);
    expect(result.pauseSeconds).toBe(15 * 60);
  });
  it('does not invent an end or keep extrapolating a completed phase with missing end evidence', () => {
    const result = resolveMonitoringVisitTimers([event('service_start', 9)], 'unterschrift_offen', null, now);
    expect(result.serviceSeconds).toBeNull();
    expect(result.serviceEndedAt).toBeNull();
    expect(result.activeTimer).toBeNull();
  });
  it('keeps a genuinely unfinished trip running instead of substituting planned arrival', () => {
    const result = resolveMonitoringVisitTimers([event('drive_start', 14)], 'unterwegs', null, now);
    expect(result.driveSeconds).toBe(6 * 60 * 60);
    expect(result.activeTimer).toBe('drive');
    expect(result.arrivedAt).toBeNull();
  });
});
