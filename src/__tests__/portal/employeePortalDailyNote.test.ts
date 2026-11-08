import { describe, expect, it } from 'vitest';
import { employeePortalDailyNote } from '@/lib/portal/employee/employeePortalDailyNote';

describe('employee portal daily note', () => {
  it('uses the same note throughout the local day and changes at midnight', () => {
    const morning = employeePortalDailyNote(new Date(2026, 10, 8, 0, 0));
    expect(employeePortalDailyNote(new Date(2026, 10, 8, 23, 59))).toEqual(morning);
    expect(employeePortalDailyNote(new Date(2026, 10, 9, 0, 0))).not.toEqual(morning);
  });

  it('rotates all 40 notes before reshuffling, including across calendar months', () => {
    const notes = Array.from({ length: 400 }, (_, day) => employeePortalDailyNote(new Date(1970, 0, day + 1, 12)));
    for (let index = 0; index < notes.length; index += 40) {
      const cycle = notes.slice(index, index + 40);
      expect(new Set(cycle.map(note => note.text)).size).toBe(40);
      expect(new Set(cycle.map(note => note.kind))).toEqual(new Set(['joke', 'impulse']));
      if (index > 0) expect(cycle[0]).not.toEqual(notes[index - 1]);
    }
  });
});
