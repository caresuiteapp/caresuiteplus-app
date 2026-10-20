import { describe, expect, it } from 'vitest';
import { formatBreadcrumbTrail, getBreadcrumbs } from '@/lib/navigation/breadcrumbs';

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
