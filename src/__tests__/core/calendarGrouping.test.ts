import { describe, expect, it } from 'vitest';
import { fetchCalendarWeek } from '@/lib/assist/calendarService';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';

describe('Calendar Grouping', () => {
  it('gruppiert Einsätze nach Datum', async () => {
    const result = await fetchCalendarWeek(DEMO_TENANT_ID, 'dispatch');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.length).toBeGreaterThan(0);
    for (const group of result.data) {
      expect(group.dateKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(group.label).toBeTruthy();
      expect(group.assignments.length).toBeGreaterThan(0);
      for (const assignment of group.assignments) {
        expect(assignment.scheduledStart.startsWith(group.dateKey)).toBe(true);
      }
    }
  });

  it('verweigert ohne Berechtigung', async () => {
    const result = await fetchCalendarWeek(DEMO_TENANT_ID, 'client_portal');
    expect(result.ok).toBe(false);
  });
});
