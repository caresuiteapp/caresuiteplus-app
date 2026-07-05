import { describe, expect, it } from 'vitest';
import { groupEmployeePortalTasks, countDoneTasks } from '@/lib/portal/groupEmployeePortalTasks';
import type { EmployeePortalTaskItem } from '@/types/modules/employeePortalExecution';

function task(
  id: string,
  title: string,
  status: EmployeePortalTaskItem['status'] = 'open',
): EmployeePortalTaskItem {
  return {
    id,
    title,
    description: '',
    required: false,
    status,
    completionNote: null,
    requiresNote: false,
  };
}

describe('groupEmployeePortalTasks', () => {
  it('groups tasks by inferred category', () => {
    const groups = groupEmployeePortalTasks([
      task('1', 'Staubsaugen Wohnzimmer'),
      task('2', 'Lebensmitteleinkauf'),
      task('3', 'Spaziergang begleiten'),
      task('4', 'Sonstige Aufgabe'),
    ]);
    expect(groups.some((g) => g.key === 'haushalt')).toBe(true);
    expect(groups.some((g) => g.key === 'einkauf')).toBe(true);
    expect(groups.some((g) => g.key === 'betreuung')).toBe(true);
    expect(groups.some((g) => g.key === 'sonstiges')).toBe(true);
  });

  it('counts done tasks per group', () => {
    const groups = groupEmployeePortalTasks([
      task('1', 'Staubsaugen', 'done'),
      task('2', 'Boden wischen', 'open'),
    ]);
    const haushalt = groups.find((g) => g.key === 'haushalt');
    expect(haushalt?.doneCount).toBe(1);
    expect(haushalt?.totalCount).toBe(2);
    expect(countDoneTasks([task('1', 'A', 'done'), task('2', 'B', 'open')])).toBe(1);
  });
});
