import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EMPLOYEE_PORTAL_NAV_TABS } from '@/lib/navigation/employeePortalNavigation';
import { APP_ROUTES } from '@/lib/navigation/routes';

describe('Mitarbeiterportal Urlaubsantrag', () => {
  it('ist in der vollständigen Portalnavigation direkt erreichbar', () => {
    const vacation = EMPLOYEE_PORTAL_NAV_TABS.find((tab) => tab.key === 'vacation-request');
    const absence = EMPLOYEE_PORTAL_NAV_TABS.find((tab) => tab.key === 'absence-request');
    expect(vacation?.href).toBe('/portal/employee/arbeitszeit/urlaub');
    expect(absence?.href).toBe('/portal/employee/arbeitszeit/abwesenheiten');
  });

  it('ist auch aus Arbeitszeiten sichtbar verlinkt', () => {
    const source = readFileSync('src/components/wfm/EmployeePortalTimesScreen.tsx', 'utf8');
    expect(source).toContain('Urlaubsantrag stellen');
    expect(source).toContain("router.push('/portal/employee/arbeitszeit/urlaub'");
    expect(source).toContain('Abwesenheit melden');
  });

  it('registriert beide geschützten Routen', () => {
    expect(APP_ROUTES.some((route) => route.path === '/portal/employee/arbeitszeit/urlaub')).toBe(true);
    expect(
      APP_ROUTES.some((route) => route.path === '/portal/employee/arbeitszeit/abwesenheiten'),
    ).toBe(true);
  });

  it('nutzt ein zuverlässiges Datumsfeld und kurze Erfolgsmeldungen', () => {
    const source = readFileSync('src/components/wfm/WfmAbsencePortalScreen.tsx', 'utf8');
    expect(source).toContain('<CareDateInput');
    expect(source).toContain('<WorkflowToast');
    expect(source).not.toContain('<SuccessState');
  });
});
