// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  emptyLiveWorkspaceState, formatLivePlannedTime, formatLiveTimer, liveReadableName,
  liveSnapshotIsCurrent, liveTimerSeconds, liveWorkspaceStorageKey, normalizeLiveSearch,
  restoreLiveWorkspaceState, saveLiveWorkspaceState,
} from '@/features/assistLive/liveStatusWorkspacePresentation.web';

const now = Date.parse('2026-10-17T10:00:30Z');
beforeEach(() => sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());
describe('live workspace state and timer presentation', () => {
  it('advances only the active timer from a confirmed current snapshot', () => {
    expect(liveTimerSeconds(90, 'service', 'service', '2026-10-17T10:00:00Z', now, true)).toBe(120);
    expect(liveTimerSeconds(90, 'service', 'drive', '2026-10-17T10:00:00Z', now, true)).toBe(90);
    expect(liveTimerSeconds(90, 'service', 'service', '2026-10-17T10:00:00Z', now, false)).toBe(90);
  });
  it('does not invent elapsed time when the snapshot is old, missing, invalid or ahead', () => {
    for (const at of [null, 'invalid', '2026-10-17T09:58:00Z', '2026-10-17T10:10:00Z']) {
      expect(liveSnapshotIsCurrent(at, now)).toBe(false);
      expect(liveTimerSeconds(90, 'service', 'service', at, now, true)).toBe(90);
    }
  });
  it('formats durations beyond an hour and prevents non-finite or negative display values', () => {
    expect(formatLiveTimer(3701)).toBe('01:01:41');
    expect(formatLiveTimer(36 * 3600)).toBe('36:00:00');
    expect(formatLiveTimer(Number.NaN)).toBe('00:00:00');
    expect(formatLiveTimer(-20)).toBe('00:00:00');
  });
  it('labels overnight planned time in Berlin independently of the process timezone', () => {
    expect(formatLivePlannedTime('2026-10-17T21:30:00Z', '2026-10-17T23:30:00Z')).toBe('17.10. 23:30 – 18.10. 01:30 Uhr');
    expect(formatLivePlannedTime('invalid', '2026-10-17T23:30:00Z')).toBe('Uhrzeit nicht hinterlegt');
  });
  it('isolates saved filters by company, actor and desktop window', () => {
    const key = liveWorkspaceStorageKey('tenant-a', 'user-a', 'window-a');
    const state = { ...emptyLiveWorkspaceState(), query: 'Erika', view: 'problems' as const, employeeId: 'employee-a' };
    saveLiveWorkspaceState(key, state);
    expect(restoreLiveWorkspaceState(key)).toEqual(state);
    for (const other of [liveWorkspaceStorageKey('tenant-b', 'user-a', 'window-a'), liveWorkspaceStorageKey('tenant-a', 'user-b', 'window-a'), liveWorkspaceStorageKey('tenant-a', 'user-a', 'window-b')]) {
      expect(restoreLiveWorkspaceState(other)).toEqual(emptyLiveWorkspaceState());
    }
  });
  it('recovers safely from corrupt or outdated stored state', () => {
    sessionStorage.setItem('bad-json', '{invalid'); expect(restoreLiveWorkspaceState('bad-json')).toEqual(emptyLiveWorkspaceState());
    sessionStorage.setItem('old-state', JSON.stringify({ view: 'old', status: 'removed', query: 'x'.repeat(300), employeeId: 10, selectedId: {} }));
    expect(restoreLiveWorkspaceState('old-state')).toEqual({ ...emptyLiveWorkspaceState(), query: 'x'.repeat(200) });
  });
  it('continues to operate when session storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(restoreLiveWorkspaceState('blocked')).toEqual(emptyLiveWorkspaceState());
    expect(() => saveLiveWorkspaceState('blocked', emptyLiveWorkspaceState())).not.toThrow();
  });
  it('matches names independently of case and accents and does not display raw identifiers as names', () => {
    expect(normalizeLiveSearch('  MÜLLER  ')).toBe('muller');
    expect(liveReadableName('00000000-0000-0000-0000-000000000001', 'Nicht zugewiesen')).toBe('Nicht zugewiesen');
    expect(liveReadableName(' Alex Beispiel ', 'Nicht zugewiesen')).toBe('Alex Beispiel');
  });
});
