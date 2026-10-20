import { describe, expect, it } from 'vitest';
import { buildClientPortalPrimaryTabs, resolveClientPortalNavigationTabs } from '@/lib/navigation/clientPortalNavigation';
import { isPortalBegleitungService } from '@/lib/portal/portalBegleitungenFilter';

describe('Klient:innenportal K.1 refactor', () => {
  it('uses five primary bottom tabs matching spec', () => {
    const tabs = buildClientPortalPrimaryTabs();
    expect(tabs.map((tab) => tab.label)).toEqual([
      'Übersicht',
      'Einsätze',
      'Dokumente',
      'Nachrichten',
      'Profil',
    ]);
  });

  it('exposes drawer overflow tabs for Nachweise, Unterschriften, Anfragen, Aktivitäten, Einstellungen', () => {
    const drawer = resolveClientPortalNavigationTabs();
    const labels = drawer.map((tab) => tab.label);
    expect(labels).toContain('Nachweise');
    expect(labels).toContain('Unterschriften');
    expect(labels).toContain('Anfragen');
    expect(labels).toContain('Aktivitäten');
    expect(labels).toContain('Einstellungen');
    const proofs = drawer.find((tab) => tab.key === 'proofs');
    expect(proofs?.href).toBe('/portal/client/proofs');
  });

  it('counts only Begleitungsleistungen, not generic Haushalt/Betreuung', () => {
    expect(
      isPortalBegleitungService({
        serviceKey: 'alltagsbegleitung',
        serviceName: 'Alltagsbegleitung',
        title: 'Einsatz',
      }),
    ).toBe(true);

    expect(
      isPortalBegleitungService({
        serviceKey: 'haushalt',
        serviceName: 'Haushaltsunterstützung',
        title: 'Haushalt',
      }),
    ).toBe(false);

    expect(
      isPortalBegleitungService({
        serviceKey: 'betreuung',
        serviceName: 'Betreuung',
        title: 'Betreuung',
      }),
    ).toBe(false);
  });
});
