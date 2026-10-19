import { describe, expect, it } from 'vitest';
import { desktopCatalogIconName } from '@/liquid-command/components/desktopCatalogIconModel.web';

describe('desktop catalogue icons', () => {
  it('uses the same semantic icon for page aliases and workflow destinations', () => {
    for (const routes of [
      ['/office/clients', '/business/office/clients', '/business/office/clients/new'],
      ['/assist/kalender', '/assist/calendar'],
      ['/assist/assignments', '/assist/einsaetze', '/assist/einsaetze/new'],
      ['/office/invoices', '/business/office/invoices/new'],
      ['/business/office/documents/signatures', '/assist/nachweise/review'],
      ['/office/employees', '/business/office/employees/new'],
    ]) {
      const icons = routes.map(desktopCatalogIconName);
      expect(new Set(icons).size).toBe(1);
      expect(icons[0]).not.toBe('apps');
    }
  });

  it('keeps Workspace services distinct even when their pathname is shared', () => {
    const services = ['gmail', 'calendar', 'meet', 'drive', 'docs', 'sheets', 'slides', 'tasks', 'contacts', 'chat', 'activity'];
    const icons = services.map(service => desktopCatalogIconName(`/business/connect/google-workspace?source=desktop&service=${service}#panel`));
    expect(new Set(icons).size).toBe(services.length);
    expect(desktopCatalogIconName('/business/connect/google-workspace?service=unknown')).toBe('plug');
  });

  it('keeps settings subpages and legacy workflow areas specific', () => {
    expect(desktopCatalogIconName('/settings/tenant')).toBe('company');
    expect(desktopCatalogIconName('/settings/profile')).toBe('profile');
    expect(desktopCatalogIconName('/settings/security')).toBe('shield');
    expect(desktopCatalogIconName('/settings/appearance')).toBe('palette');
    expect(desktopCatalogIconName('/settings/data-request')).toBe('shield');
    expect(desktopCatalogIconName('/office?area=people')).toBe('people');
    expect(desktopCatalogIconName('/robotics?area=tasks')).toBe('tasks');
    expect(desktopCatalogIconName('/robotics?area=telemetry')).toBe('activity');
  });

  it('ignores incidental query words and retains a visible fallback for future pages', () => {
    expect(desktopCatalogIconName('/business/office/employees/new?returnTo=/calendar#settings')).toBe('people');
    expect(desktopCatalogIconName('/office/notizen/')).toBe('notes');
    expect(desktopCatalogIconName('/future-feature')).toBe('apps');
    expect(desktopCatalogIconName('')).toBe('home');
  });
});
