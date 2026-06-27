import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { formatEmployeePortalDisplayName } from '@/lib/portal/employeePortalDisplayName';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('employeePortalDisplayName', () => {
  it('formats first and last name', () => {
    expect(formatEmployeePortalDisplayName({ firstName: 'anna', lastName: 'müller' })).toBe(
      'Anna Müller',
    );
  });

  it('usePortalActor loads employee display name from employees table', () => {
    const hook = readSrc('src/hooks/usePortalActor.ts');
    expect(hook).toContain('fetchEmployeePortalDisplayName');
    expect(hook).toContain("roleKey !== 'employee_portal'");
    expect(hook).toContain('employeeDisplayName');
  });

  it('useEmployeePortalDashboard returns ServiceResult to useAsyncQuery', () => {
    const hook = readSrc('src/hooks/useEmployeePortalDashboard.ts');
    expect(hook).toContain('getEmployeePortalDashboardProjection');
    expect(hook).not.toContain('throw new Error');
    expect(hook).toContain('ok: false');
  });
});
