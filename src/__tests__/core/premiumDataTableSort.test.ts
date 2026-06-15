import { describe, expect, it } from 'vitest';
import {
  resolveTableColumnSort,
  sortKeyToColumnState,
} from '@/lib/table/tableColumnSort';
import { CLIENT_SORT_OPTIONS } from '@/hooks/useClientList';
import { EMPLOYEE_SORT_OPTIONS } from '@/hooks/useEmployeeList';

describe('tableColumnSort', () => {
  it('resolveTableColumnSort wechselt Name von asc zu desc', () => {
    const next = resolveTableColumnSort('name', 'name_asc', CLIENT_SORT_OPTIONS, {
      name: 'lastName',
      city: 'city',
    });
    expect(next).toBe('name_desc');
  });

  it('resolveTableColumnSort setzt Ort auf city_asc', () => {
    const next = resolveTableColumnSort('city', 'name_asc', CLIENT_SORT_OPTIONS, {
      name: 'lastName',
      city: 'city',
    });
    expect(next).toBe('city_asc');
  });

  it('sortKeyToColumnState mappt Sort-Key auf Spalte und Richtung', () => {
    const state = sortKeyToColumnState('name_desc', CLIENT_SORT_OPTIONS, {
      name: 'lastName',
      city: 'city',
    });
    expect(state.columnKey).toBe('name');
    expect(state.direction).toBe('desc');
  });

  it('resolveTableColumnSort wechselt Rolle für Mitarbeitende', () => {
    const next = resolveTableColumnSort('role', 'name_asc', EMPLOYEE_SORT_OPTIONS, {
      name: 'lastName',
      role: 'jobTitle',
    });
    expect(next).toBe('role_asc');
  });
});
