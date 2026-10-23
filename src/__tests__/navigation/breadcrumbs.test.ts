import { describe, expect, it } from 'vitest';
import { formatBreadcrumbTrail, getBreadcrumbs } from '@/lib/navigation/breadcrumbs';
import { officeModuleAssignmentBreadcrumbs, officeModuleAssignmentRouteTitle } from '@/lib/navigation/officeModuleAssignmentRoutes.web';
import { officeQmBreadcrumbs, officeQmRouteTitle } from '@/lib/navigation/officeQmRoutes.web';

describe('getBreadcrumbs', () => {
  it('liefert sinnvolle Labels für Klient:innenakte ohne doppelte Business-Bereich-Einträge', () => {
    const clientId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const trail = getBreadcrumbs(`/business/office/clients/${clientId}`);

    expect(formatBreadcrumbTrail(trail)).toBe(
      'Start › Business-Bereich › Office › Klient:innen › Klient:innenakte',
    );
  });

  it('löst dynamische Routen wie Mitarbeitenden-Offboarding', () => {
    const employeeId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const trail = getBreadcrumbs(`/office/employees/${employeeId}/offboarding`);

    expect(trail[trail.length - 1]?.label).toBe('Offboarding');
  });

  it('nutzt exakte Routen-Labels für Business-Unterrouten', () => {
    const trail = getBreadcrumbs('/business/messages/archived');

    expect(formatBreadcrumbTrail(trail)).toBe(
      'Start › Business-Bereich › Kommunikationszentrum › Archived',
    );
  });

  it('behält klickbare Pfade für Zwischensegmente', () => {
    const trail = getBreadcrumbs('/business/office/clients');

    expect(trail.map((item) => item.path)).toEqual([
      '/',
      '/business',
      '/business/office',
      '/business/office/clients',
    ]);
    expect(trail[trail.length - 1]?.isCurrent).toBe(true);
    expect(trail.slice(0, -1).every((item) => !item.isCurrent)).toBe(true);
  });

  it('liefert Mandanten-Labels für /settings/tenant', () => {
    const trail = getBreadcrumbs('/settings/tenant');

    expect(formatBreadcrumbTrail(trail)).toBe('Start › Einstellungen › Mandant');
    expect(trail[1]?.path).toBe('/settings');
  });
});

describe('Office assignment navigation on web', () => {
  it('distinguishes assignments from the separate platform/module overview', () => {
    const trail = officeModuleAssignmentBreadcrumbs('/business/office/modules');
    expect(trail).toEqual([
      { path: '/Desktop', label: 'Desktop' },
      { path: '/office', label: 'Office' },
      { path: '/business/office/modules', label: 'Modulzuordnungen', isCurrent: true },
    ]);
    expect(officeModuleAssignmentRouteTitle('/business/modules')).toBeNull();
    expect(officeModuleAssignmentBreadcrumbs('/business/modules')).toBeNull();
    expect(getBreadcrumbs('/business/modules').at(-1)?.label).toBe('Module & Lizenzen');
  });

  it.each([
    ['clients', 'Klient:innen-Zuordnung'],
    ['employees', 'Mitarbeitende-Zuordnung'],
    ['services', 'Leistungskatalog'],
    ['documents', 'Dokument-Sichtbarkeit'],
    ['templates', 'Vorlagen-Zuordnung'],
    ['permissions', 'Berechtigungsprofile'],
    ['billing', 'Abrechnungsquellen'],
  ])('keeps the popup and breadcrumb labels consistent for %s', (section, label) => {
    const path = `/business/office/modules/${section}`;
    const location = `${path}/?module=assist#details`;
    expect(officeModuleAssignmentRouteTitle(location)).toBe(label);
    const trail = officeModuleAssignmentBreadcrumbs(location)!;
    expect(trail.at(-1)).toEqual({ path, label, isCurrent: true });
    expect(trail.filter(item => item.isCurrent)).toHaveLength(1);
    expect(trail.at(-2)).toEqual({ path: '/business/office/modules', label: 'Modulzuordnungen', isCurrent: false });
  });

  it.each([
    '/business/office/modules-old',
    '/business/office/modules/unknown',
    '/business/office/modules/clients/client-1',
    '/business/office/modules/toString',
    '/business/office/clients/client-1/modules',
    '/platform/modules',
  ])('does not relabel an unrelated or unknown destination: %s', path => {
    expect(officeModuleAssignmentRouteTitle(path)).toBeNull();
    expect(officeModuleAssignmentBreadcrumbs(path)).toBeNull();
  });
});

describe('Office QM navigation on web', () => {
  it.each(['/office/qm', '/business/office/qm', '/business/qm'])('names the QM entry consistently: %s', path => {
    expect(officeQmRouteTitle(`${path}/?status=pending#content`)).toBe('Qualitätsmanagement');
    expect(officeQmBreadcrumbs(path)?.at(-1)?.label).toBe('Qualitätsmanagement');
  });

  it.each([
    ['documents', 'QM-Dokumente'], ['handbook', 'QM-Handbuch'], ['compliance', 'Compliance'],
    ['md-audit', 'MD-Prüfungsmappen'], ['legal-references', 'Rechtsgrundlagen'],
    ['documents/123', 'QM-Dokument'], ['handbook/123', 'Handbuchkapitel'],
  ])('keeps the page title and clickable trail aligned for %s', (section, label) => {
    const path = `/business/office/qm/${section}`;
    expect(officeQmRouteTitle(path)).toBe(label);
    const trail = officeQmBreadcrumbs(path)!;
    expect(trail.at(-1)).toEqual({ path, label, isCurrent: true });
    expect(trail.filter(item => item.isCurrent)).toHaveLength(1);
    expect(trail[2].path).toBe('/business/office/qm');
  });

  it.each(['/office/qm-old', '/office/qm/toString', '/office/qm/documents/123/unknown', '/office/clients'])('does not relabel other paths: %s', path => {
    expect(officeQmRouteTitle(path)).toBeNull();
    expect(officeQmBreadcrumbs(path)).toBeNull();
  });
});
