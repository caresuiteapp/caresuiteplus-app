import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

const PORTAL_EMPLOYEE_PATTERN = [
  'usePortalActor',
  'portalEmployeeId ?? profile?.employeeId ?? null',
];

describe('ZEIT.1 portal employeeId preference on WFM screens', () => {
  it('TimeTrackingEmployeeScreen prefers portal employeeId over profile', () => {
    const source = readSrc('src/components/timeTracking/TimeTrackingEmployeeScreen.tsx');
    for (const fragment of PORTAL_EMPLOYEE_PATTERN) {
      expect(source).toContain(fragment);
    }
    expect(source).toContain('Sie haben keine Berechtigung, diese Arbeitszeiten zu öffnen.');
  });

  it('EmployeePortalTimesScreen prefers portal employeeId over profile', () => {
    const source = readSrc('src/components/wfm/EmployeePortalTimesScreen.tsx');
    for (const fragment of PORTAL_EMPLOYEE_PATTERN) {
      expect(source).toContain(fragment);
    }
    expect(source).toContain('Für den ausgewählten Zeitraum sind noch keine Zeiten erfasst.');
  });

  it('WfmAbsencePortalScreen prefers portal employeeId over profile', () => {
    const source = readSrc('src/components/wfm/WfmAbsencePortalScreen.tsx');
    for (const fragment of PORTAL_EMPLOYEE_PATTERN) {
      expect(source).toContain(fragment);
    }
  });

  it('Office path still resolves employeeId from profile when portal context absent', () => {
    const source = readSrc('src/components/timeTracking/TimeTrackingEmployeeScreen.tsx');
    expect(source).toContain('profile?.employeeId');
    expect(source).not.toMatch(/employeeId\s*=\s*profile\?\.employeeId\s*\?\?\s*null/);
  });
});
