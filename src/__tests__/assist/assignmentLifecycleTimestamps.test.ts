import { describe, expect, it } from 'vitest';
import {
  resolveServiceEndedAt,
  timestampPatchForStatusTransition,
} from '@/lib/assist/assignmentLifecycleTimestamps';

describe('assignmentLifecycleTimestamps', () => {
  it('does not patch timestamps when finalizing to abgeschlossen', () => {
    const patch = timestampPatchForStatusTransition('abgeschlossen', '2026-07-07T16:40:00.000Z', {
      actual_end_at: '2026-07-07T09:50:39.114Z',
      finished_at: '2026-07-07T09:50:39.114Z',
    });
    expect(patch).toEqual({});
  });

  it('does not overwrite existing beendet timestamps on repeat transition', () => {
    const patch = timestampPatchForStatusTransition('beendet', '2026-07-07T16:40:00.000Z', {
      actual_end_at: '2026-07-07T09:50:39.114Z',
      finished_at: '2026-07-07T09:50:39.114Z',
    });
    expect(patch).toEqual({});
  });

  it('sets service end only once on first beendet transition', () => {
    const now = '2026-07-07T09:50:39.114Z';
    const patch = timestampPatchForStatusTransition('beendet', now, {});
    expect(patch).toEqual({ actual_end_at: now, finished_at: now });
  });

  it('prefers execution_state service end when assignment end was overwritten by finalize', () => {
    const resolved = resolveServiceEndedAt({
      fromEvents: null,
      fromExecutionState: '2026-07-07T09:50:39.114Z',
      fromAssignment: '2026-07-07T16:40:51.851Z',
    });
    expect(resolved).toBe('2026-07-07T09:50:39.114Z');
  });

  it('prefers time events over assignment and execution state', () => {
    const resolved = resolveServiceEndedAt({
      fromEvents: '2026-07-07T09:50:39.114Z',
      fromExecutionState: '2026-07-07T09:51:00.000Z',
      fromAssignment: '2026-07-07T16:40:51.851Z',
    });
    expect(resolved).toBe('2026-07-07T09:50:39.114Z');
  });
});
