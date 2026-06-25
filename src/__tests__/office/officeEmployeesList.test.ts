import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildEmployeeListKpis } from '@/lib/office/employeeListStats';
import { demoEmployees } from '@/data/demo/employees';
import { fetchEmployeeList } from '@/lib/office/employeeListService';
import { fetchEmployeeDetail } from '@/lib/office/employeeDetailService';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { enforcePermission } from '@/lib/permissions';
import { EMPLOYEE_STATUS_FILTERS, EMPLOYEE_SORT_OPTIONS } from '@/hooks/useEmployeeList';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Office Mitarbeitende list', () => {
  it('enforcePermission schützt Employee-List-Service', () => {
    expect(enforcePermission(null, 'office.employees.view' as never)).not.toBeNull();
  });

  it('fetchEmployeeList liefert Demo-Mitarbeitende', async () => {
    const result = await fetchEmployeeList(DEMO_TENANT_ID, 'business_admin');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0]?.firstName).toBeTruthy();
    }
  });

  it('fetchEmployeeDetail liefert Demo-Detail', async () => {
    const result = await fetchEmployeeDetail('employee-001', DEMO_TENANT_ID, 'business_admin');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.firstName).toBe('Thomas');
      expect(result.data.department).toBeTruthy();
    }
  });

  it('buildEmployeeListKpis berechnet Kennzahlen aus Demo-Daten', () => {
    const kpis = buildEmployeeListKpis(demoEmployees);
    expect(kpis.length).toBe(3);
    expect(kpis[0]?.value).toBe(demoEmployees.length);
    expect(kpis.some((k) => k.id === 'employees-kpi-onboarding')).toBe(true);
  });

  it('Status- und Sortierfilter sind vollständig definiert', () => {
    expect(EMPLOYEE_STATUS_FILTERS.some((f) => f.key === 'aktiv')).toBe(true);
    expect(EMPLOYEE_SORT_OPTIONS.some((o) => o.key === 'name_asc')).toBe(true);
  });

  it('EmployeesListView hat Suche, Filter und States', () => {
    const source = readSrc('src/components/office/EmployeesListView.tsx');
    expect(source).toContain('PremiumInput');
    expect(source).toContain('FilterChipGroup');
    expect(source).toContain('EmptyState');
    expect(source).toContain('ErrorState');
    expect(source).toContain('LoadingState');
    expect(source).not.toContain('Coming Soon');
    expect(source).not.toContain('onPress={() => {}}');
  });

  it('EmployeesAdaptiveScreen nutzt AdaptiveListDetail mit Summary-Panel', () => {
    const source = readSrc('src/screens/office/EmployeesAdaptiveScreen.tsx');
    expect(source).toContain('AdaptiveListDetail');
    expect(source).toContain('EmployeeDetailSummaryPanel');
    expect(source).toContain('embedded');
    expect(source).not.toContain('EmployeeDetailScreen');
  });

  it('EmployeeDetailSummaryPanel zeigt Kontakt und Edit-CTA', () => {
    const source = readSrc('src/components/office/EmployeeDetailSummaryPanel.tsx');
    expect(source).toContain('Personalakte öffnen');
    expect(source).toContain('Stammdaten bearbeiten');
    expect(source).toContain('Offboarding');
    expect(source).toContain('useEmployeeDetail');
    expect(source).not.toContain('Coming Soon');
  });

  it('EmployeeListCard unterstützt Auswahlzustand für Master-Detail', () => {
    const source = readSrc('src/components/office/EmployeeListCard.tsx');
    expect(source).toContain('selected');
    expect(source).toContain('cardSelected');
  });

  it('employeeListService nutzt guardServiceTenant', () => {
    const source = readSrc('src/lib/office/employeeListService.ts');
    expect(source).toContain('guardServiceTenant');
  });

  it('employeeDetailService nutzt guardServiceTenant', () => {
    const source = readSrc('src/lib/office/employeeDetailService.ts');
    expect(source).toContain('guardServiceTenant');
    expect(source).toContain('employeeSupabaseRepository');
  });

  it('EmployeeDetailModal öffnet Personalakte im Popup', () => {
    const source = readSrc('src/components/office/employeedetailmodal.tsx');
    expect(source).toContain('EmployeePersonnelFilePanel');
    expect(source).toContain("mode === 'personnel'");
    expect(source).toContain('employeeId={employeeId}');
    expect(source).toContain('onOpenFullRecord={handleOpenPersonnelRecord}');
  });

  it('EmployeesListView nutzt Desktop-Tabellenansicht ab desktop breakpoint', () => {
    const source = readSrc('src/components/office/EmployeesListView.tsx');
    expect(source).toContain('useDeviceClass');
    expect(source).toContain('isDesktopClass');
    expect(source).toContain('EmployeesListTable');
  });

  it('EmployeesListTable hat Spalten Name, Status, Rolle, Aktionen', () => {
    const source = readSrc('src/components/office/EmployeesListTable.tsx');
    expect(source).toContain("label: 'Name'");
    expect(source).toContain("label: 'Status'");
    expect(source).toContain("label: 'Rolle'");
    expect(source).not.toContain("label: 'E-Mail'");
    expect(source).toContain("label: 'Aktionen'");
    expect(source).toContain('PremiumDataTable');
    expect(source).toContain('size="lg"');
  });

  it('EmployeesListScreen nutzt Glass-Modals für Anlegen und Profil', () => {
    const source = readSrc('src/screens/office/EmployeesListScreen.tsx');
    expect(source).toContain('EmployeeCreateModal');
    expect(source).toContain('EmployeeDetailModal');
    expect(source).toContain('useModals');
    expect(source).toContain('openCreate');
    expect(source).toContain('openDetail');
  });

  it('EmployeeDetailModal nutzt Popup-Modals für Edit und Offboarding', () => {
    const source = readSrc('src/components/office/employeedetailmodal.tsx');
    expect(source).toContain('EmployeeEditModal');
    expect(source).toContain('EmployeeOffboardingModal');
    expect(source).toContain('onEditMasterData');
    expect(source).toContain('onOpenOffboarding');
  });

  it('EmployeesListTable nutzt sortierbare Spalten', () => {
    const source = readSrc('src/components/office/EmployeesListTable.tsx');
    expect(source).toContain('sortable: true');
    expect(source).toContain('onSortColumn');
  });
});
