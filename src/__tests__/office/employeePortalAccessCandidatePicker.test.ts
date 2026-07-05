import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.join(__dirname, '..', '..', '..');

describe('employee portal access candidate picker', () => {
  it('service lädt Personalnummern und filtert bestehende Portalzugänge', () => {
    const service = readFileSync(
      path.join(root, 'src/lib/access/employeePortalAccessCandidateService.ts'),
      'utf8',
    );
    expect(service).toContain('employee_number');
    expect(service).toContain('employee_portal_accounts');
    expect(service).toContain("enforcePermission");
    expect(service).toContain("'office.access'");
  });

  it('CreateEmployeePortalAccountScreen nutzt Auswahlliste statt Freitext-ID', () => {
    const screen = readFileSync(
      path.join(root, 'src/screens/office/access/CreateEmployeePortalAccountScreen.tsx'),
      'utf8',
    );
    expect(screen).toContain('EmployeePortalAccessCandidatePicker');
    expect(screen).not.toContain('Personalnummer oder Mitarbeiter-UUID');
    expect(screen).toContain('selectedEmployee.id');
  });

  it('Picker zeigt Personalnummer-Badge pro Zeile', () => {
    const picker = readFileSync(
      path.join(root, 'src/components/access/EmployeePortalAccessCandidatePicker.tsx'),
      'utf8',
    );
    expect(picker).toContain('employeeNumber');
    expect(picker).toContain('Ohne Personalnummer');
  });
});
