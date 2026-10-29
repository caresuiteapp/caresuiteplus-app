// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  calendarAnchor, calendarWorkspaceKey, readCalendarWorkspace, saveCalendarWorkspace,
  type CalendarWorkspaceState,
} from '@/lib/calendar/calendarWorkspaceState.web';

const now = new Date(2026, 9, 17, 12);
const saved: CalendarWorkspaceState = {
  view: 'week', anchor: '2026-10-25', employeeId: 'employee-1', query: 'Erika', status: 'open',
};
beforeEach(() => sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('Calendar workspace restoration', () => {
  it('restores the same date, view and filters after a reload', () => {
    const key = calendarWorkspaceKey('tenant', 'user', 'assist', 'window-1');
    expect(saveCalendarWorkspace(key, saved)).toBe(true);
    expect(readCalendarWorkspace(key, 'month', now)).toEqual({ restored: true, state: saved });
  });

  it.each([
    ['different-tenant', 'user', 'assist', 'window-1'],
    ['tenant', 'different-user', 'assist', 'window-1'],
    ['tenant', 'user', 'office', 'window-1'],
    ['tenant', 'user', 'assist', 'window-2'],
  ])('does not reuse a different tenant, person, module or workspace: %j', (...scope) => {
    saveCalendarWorkspace(calendarWorkspaceKey('tenant', 'user', 'assist', 'window-1'), saved);
    expect(readCalendarWorkspace(calendarWorkspaceKey(...scope as [string, string, string, string]), 'agenda', now)).toEqual({
      restored: false, state: { view: 'agenda', anchor: '2026-10-17', employeeId: '', query: '', status: 'all' },
    });
  });

  it('does not collide for scope names containing separators or quotation marks', () => {
    expect(calendarWorkspaceKey('a:b', 'c', 'assist')).not.toBe(calendarWorkspaceKey('a', 'b:c', 'assist'));
    expect(calendarWorkspaceKey('a"', 'b', 'assist')).not.toBe(calendarWorkspaceKey('a', '"b', 'assist'));
  });

  it.each(['not-json', '{}', '{"view":"timeline","anchor":"2026-10-17"}', '{"view":"month","anchor":"2026-02-31"}'])('recovers from invalid persisted data: %s', raw => {
    sessionStorage.setItem('state', raw);
    expect(readCalendarWorkspace('state', 'month', now).restored).toBe(false);
    expect(readCalendarWorkspace('state', 'month', now).state.anchor).toBe('2026-10-17');
  });

  it('discards invalid optional fields without losing a valid date and view', () => {
    sessionStorage.setItem('state', JSON.stringify({ ...saved, employeeId: { id: 'employee' }, query: 'x'.repeat(240), status: 'unexpected' }));
    expect(readCalendarWorkspace('state', 'month', now)).toEqual({
      restored: true, state: { ...saved, employeeId: '', query: 'x'.repeat(200), status: 'all' },
    });
  });

  it.each(['access', 'operations'])('still opens when browser storage blocks %s', mode => {
    // Storage is a binding proxy in happy-dom. Replacing a bound instance
    // method can silently leave the actual API untouched. Model the browser
    // boundary directly, including a SecurityError from the storage getter.
    const blocked = () => { throw new DOMException('blocked', 'SecurityError'); };
    const storage = vi.spyOn(window, 'sessionStorage', 'get');
    if (mode === 'access') storage.mockImplementation(blocked);
    else storage.mockReturnValue({ getItem: blocked, setItem: blocked } as unknown as Storage);
    expect(readCalendarWorkspace('state', 'month', now).restored).toBe(false);
    expect(saveCalendarWorkspace('state', saved)).toBe(false);
  });

  it('uses stable local noon through both daylight-saving transitions', () => {
    for (const date of ['2026-03-29', '2026-10-25']) {
      expect(calendarAnchor(date)?.getHours()).toBe(12);
      expect(calendarAnchor(date)?.getDate()).toBe(Number(date.slice(-2)));
    }
    expect(calendarAnchor('2026-02-29')).toBeNull();
    expect(calendarAnchor('2028-02-29')?.getDate()).toBe(29);
    expect(calendarAnchor('2026-13-01')).toBeNull();
  });
});
