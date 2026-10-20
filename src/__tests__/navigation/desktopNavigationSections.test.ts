import { describe, expect, it } from 'vitest';
import {
  buildDesktopApps,
  buildDesktopNavigationGroups,
  type DesktopApp,
} from '@/liquid-command/navigation/desktopAppCatalog.web';

const widgetApps: readonly DesktopApp[] = [
  {
    id: 'office-widget',
    label: 'Klient:innen',
    description: 'Office-Akten',
    route: '/business/office/clients',
    category: 'Verwaltung',
  },
  {
    id: 'assist-widget',
    label: 'Einsätze',
    description: 'Assist-Einsätze',
    route: '/assist/einsaetze',
    category: 'Versorgung',
  },
  {
    id: 'settings-widget',
    label: 'Einstellungen',
    description: 'HealthOS konfigurieren',
    route: '/settings',
    category: 'Verwaltung',
  },
];

describe('Desktop-Navigation', () => {
  it('gliedert die Navigation ausschließlich in Assist, Office und Einstellungen', () => {
    const groups = buildDesktopNavigationGroups(buildDesktopApps(widgetApps, 'business_admin'));

    expect(groups.map(group => group.title)).toEqual(['Assist', 'Office', 'Einstellungen']);
    expect(groups.flatMap(group => group.items)).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ route: expect.stringMatching(/^\/robotics/) }),
      ]),
    );
  });

  it('ordnet globale Einstellungsrouten dem Bereich Einstellungen zu', () => {
    const apps = buildDesktopApps(widgetApps, 'business_admin');
    const groups = buildDesktopNavigationGroups(apps, 'Rollen');
    const settings = groups.find(group => group.title === 'Einstellungen');

    expect(settings?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ route: '/business/office/permissions' }),
      ]),
    );
  });
});
