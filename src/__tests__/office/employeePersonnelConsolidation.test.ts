import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Personalakte consolidation', () => {
  it('EmployeeDetailModal nutzt einheitliches EmployeePersonnelFilePanel', () => {
    const modal = readSrc('src/components/office/employeedetailmodal.tsx');
    expect(modal).toContain('EmployeePersonnelFilePanel');
    expect(modal).toContain('employeeId={employeeId}');
    expect(modal).not.toContain('EmployeeDetailScreen');
    expect(modal).not.toContain("mode === 'full'");
    expect(modal).toContain("mode === 'personnel'");
  });

  it('EmployeePersonnelRecordScreen delegiert an EmployeePersonnelFilePanel', () => {
    const screen = readSrc('src/screens/office/EmployeePersonnelRecordScreen.tsx');
    expect(screen).toContain('EmployeePersonnelFilePanel');
  });

  it('Portal-Tab enthält Zugang anlegen', () => {
    const panel = readSrc('src/components/office/EmployeePortalAccessPanel.tsx');
    expect(panel).toContain('Zugang anlegen');
    expect(panel).toContain('createEmployeePortalAccount');
  });

  it('EmployeePersonnelFilePanel definiert Office-Tabs inkl. Portal und Dokumente', () => {
    const panel = readSrc('src/components/office/EmployeePersonnelFilePanel.tsx');
    expect(panel).toContain("label: 'Portal'");
    expect(panel).toContain("label: 'Dokumente'");
    expect(panel).toContain("label: 'Rollen & Rechte'");
    expect(panel).toContain("label: 'Qualifikationen'");
    expect(panel).toContain("label: 'Einsatzfähigkeit'");
    expect(panel).toContain("label: 'Arbeitsmaterial'");
    expect(panel).toContain("label: 'Verlauf'");
    expect(panel).toContain('EmployeePortalAccessPanel');
    expect(panel).toContain('EmployeeRolesPermissionsHub');
    expect(panel).toContain('InfoBanner');
    expect(panel).toContain('resolvePersonnelUiTab');
    expect(panel).not.toContain('labelBackgroundCheckStatus(overview.backgroundCheckStatus)');
    expect(panel).toContain('updateEmployeeEmployment');
    expect(panel).toContain('updateEmployeeRolesPermissions');
    expect(panel).toContain('deleteEmployeePersonnelDocument');
    expect(panel).toContain('FilterChipGroup');
    expect(panel).toContain('Anstellung speichern');
    expect(panel).toContain('resolveEmploymentTypeLabel');
    expect(panel).toContain("viewContext: 'form'");
    expect(panel).toContain('Timeline');
  });

  it('Homeoffice-Zeiterfassung wird aus Rollenrechten abgeleitet', () => {
    const source = readSrc('src/lib/office/employeeHomeOfficeService.ts');
    expect(source).toContain('time.tracking.own.view');
    expect(source).toContain('assist.execution.manage');
    expect(source).toContain('resolveEmployeeTimeTrackingMode');
    expect(source).toContain('roleQualifiesForHomeOfficeSetting');
    expect(source).toContain('persistEmployeeHomeOfficeOverride');
    expect(source).toContain('employee_work_settings');
  });

  it('EmployeeDetailScreen blendet Personalakte-CTA im Modal aus', () => {
    const detail = readSrc('src/screens/office/EmployeeDetailScreen.tsx');
    expect(detail).toContain('embeddedInModal');
    expect(detail).toContain('Personalakte öffnen');
  });

  it('updateEmployeeEmployment service validates weekly hours before persist', () => {
    const source = readSrc('src/lib/office/employeePersonnelUpdateService.ts');
    expect(source).toContain('updateEmployeeEmployment');
    expect(source).toContain('Wochenstunden zwischen 0 und 60');
    expect(source).toContain('buildEmploymentLiveUpdatePayload');
  });
});
