import { describe, expect, it } from 'vitest';
import { groupEmployeePortalTasks } from '@/lib/portal/groupEmployeePortalTasks';
import { resolveVisitTaskCategory } from '@/lib/portal/resolveVisitTaskCategory';
import type { EmployeePortalTaskItem } from '@/types/modules/employeePortalExecution';

function task(
  id: string,
  title: string,
  overrides: Partial<EmployeePortalTaskItem> = {},
): EmployeePortalTaskItem {
  return {
    id,
    title,
    description: '',
    required: false,
    status: 'open',
    completionNote: null,
    requiresNote: false,
    ...overrides,
  };
}

describe('resolveVisitTaskCategory', () => {
  it('prefers explicit workflow category over title inference', () => {
    const resolved = resolveVisitTaskCategory(
      task('1', 'Allgemeine Aufgabe', { categoryKey: 'demenzbegleitung' }),
    );
    expect(resolved.key).toBe('betreuung');
    expect(resolved.label).toBeTruthy();
  });
});

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

  it('groups by explicit category key when provided', () => {
    const groups = groupEmployeePortalTasks([
      task('1', 'Aufgabe A', { categoryKey: 'haeusliche_alltagsunterstuetzung' }),
      task('2', 'Aufgabe B', { categoryKey: 'haeusliche_alltagsunterstuetzung' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.totalCount).toBe(2);
    expect(groups[0]?.key).toBe('haushalt');
  });
});
