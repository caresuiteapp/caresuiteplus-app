import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildSync } from 'esbuild';
import { resolve } from 'node:path';
import { DOMParser } from '@xmldom/xmldom';
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

type RasterSource = { uri: string };
type RasterImages = Record<'small' | 'medium' | 'large', RasterSource>;
type CatalogEntry = { id: string; route: string; images?: RasterImages; desktopWidgetId?: string };
type ArtworkCatalog = {
  desktopCatalogArtwork: (route: string, preferred?: RasterImages) => RasterImages;
  desktopCatalogArtworkName: (route: string) => string;
  desktopCatalogArtworkXml: (route: string, label?: string) => string;
  widgetArtworkTheme: (route: string, label?: string) => { identity: string; primary: string; secondary: string; reviewed: boolean };
  buildDesktopApps: (widgets: readonly CatalogEntry[], role?: string) => CatalogEntry[];
  WIDGETS: readonly CatalogEntry[];
  WORKFLOWS: readonly CatalogEntry[];
  stationaerNav: { groups: { items: { href: string }[] }[] };
  beratungNav: { groups: { items: { href: string }[] }[] };
};

// Keep static image requires in the real catalogue, but resolve them to local
// paths instead of embedding every full-size background into this test bundle.
const artworkBundle = buildSync({
  stdin: {
    contents: `
      export { desktopCatalogArtwork, desktopCatalogArtworkName, desktopCatalogArtworkXml } from './src/liquid-command/components/desktopCatalogArtworkModel.web';
      export { widgetArtworkTheme } from './src/liquid-command/components/widgetArtworkTheme.shared';
      export { buildDesktopApps } from './src/liquid-command/navigation/desktopAppCatalogModel';
      export { WIDGETS, WORKFLOWS } from './src/liquid-command/screens/administrationDesktopCatalog';
      export { stationaerNav } from './src/lib/navigation/moduleNav/stationaerNav';
      export { beratungNav } from './src/lib/navigation/moduleNav/beratungNav';
    `,
    resolveDir: process.cwd(), loader: 'ts',
  },
  bundle: true, write: false, platform: 'node', format: 'cjs',
  external: ['react-native', '*.png', '*.jpg'],
}).outputFiles[0].text;
function loadArtworkCatalog(platform = 'web'): ArtworkCatalog {
  const artworkModule = { exports: {} as ArtworkCatalog };
  new Function('require', 'module', 'exports', artworkBundle)((id: string) => {
    if (id === 'react-native') return { Platform: { OS: platform } };
    const assetsIndex = id.indexOf('assets/');
    if (assetsIndex >= 0 && /\.(png|jpg)$/.test(id)) return { uri: resolve(id.slice(assetsIndex)) };
    const publicIndex = id.indexOf('public/widget-artwork/');
    if (publicIndex >= 0 && /\.png$/.test(id)) return { uri: resolve(id.slice(publicIndex)) };
    throw new Error(`Unexpected artwork dependency: ${id}`);
  }, artworkModule, artworkModule.exports);
  return artworkModule.exports;
}
const artworkCatalog = loadArtworkCatalog();

describe('unique function artwork', () => {
  afterEach(() => vi.unstubAllEnvs());

  const entries = [
    ...artworkCatalog.buildDesktopApps(artworkCatalog.WIDGETS, 'business_admin'),
    ...artworkCatalog.buildDesktopApps(artworkCatalog.WIDGETS, 'platform_admin'),
    ...artworkCatalog.WIDGETS, ...artworkCatalog.WORKFLOWS,
  ];

  it.each(['web', 'android', 'ios'])('requires a 3D original for every catalogue function on %s, with consultation enabled and disabled', platform => {
    for (const enabled of ['false', 'true']) {
      vi.stubEnv('EXPO_PUBLIC_CONSULTATION_WORKSPACE_ENABLED', enabled);
      const catalogue = loadArtworkCatalog(platform);
      const functions = [
        ...['business_admin', 'business_manager', 'dispatch', 'platform_admin'].flatMap(role => catalogue.buildDesktopApps(catalogue.WIDGETS, role)),
        ...catalogue.WIDGETS, ...catalogue.WORKFLOWS,
        ...[catalogue.stationaerNav, catalogue.beratungNav].flatMap(nav => nav.groups.flatMap(group => group.items.map(item => ({ route: item.href })))),
      ];
      for (const entry of functions) {
        const images = catalogue.desktopCatalogArtwork(entry.route);
        expect(images.large.uri, `${entry.route}, consultation=${enabled}`).toMatch(/\/widget-artwork\/[^/]+\/[^/]+\/large\.png$/);
        expect(images.small.uri).toMatch(/\/small\.png$/);
        expect(images.medium.uri).toMatch(/\/medium\.png$/);
      }
    }
  });

  it('keeps the redirected Beratung entry and the published workspace on the same original', () => {
    const original = artworkCatalog.desktopCatalogArtwork('/beratung');
    expect(original.large.uri).toContain('/beratung/large.png');
    expect(artworkCatalog.desktopCatalogArtwork('/beratung/arbeitsplatz')).toBe(original);
    expect(artworkCatalog.desktopCatalogArtwork('/beratung/arbeitsplatz/?source=desktop#overview')).toBe(original);
    expect(artworkCatalog.desktopCatalogArtwork('/beratung/protokolle').large.uri).not.toBe(original.large.uri);
  });

  it('uses recovered 3D originals for published functions and keeps aliases on the same original', () => {
    const clients = artworkCatalog.desktopCatalogArtwork('/business/office/clients');
    expect(clients.large.uri).toContain('/widget-artwork/originals-20261106-v1/business-office-clients/large.png');
    expect(clients.small.uri).toContain('/small.png');
    expect(clients.medium.uri).toContain('/medium.png');
    expect(artworkCatalog.desktopCatalogArtwork('/office/clients?source=desktop#details')).toBe(clients);
    expect(artworkCatalog.desktopCatalogArtwork('/business/office/clients/new').large.uri).not.toBe(clients.large.uri);
    expect(artworkCatalog.desktopCatalogArtwork('/office/notizen').large.uri).not.toBe(artworkCatalog.desktopCatalogArtwork('/office/dokumentation').large.uri);
    expect(artworkCatalog.desktopCatalogArtworkName('/assist/kalender')).toBe(artworkCatalog.desktopCatalogArtworkName('/assist/calendar'));
  });

  it('gives every actual catalogue function a distinct, complete vector instead of a shared family image', () => {
    const drawings = new Map<string, string>();
    const motifs = new Map<string, string>();
    const identities = new Set<string>();
    const parser = new DOMParser({ errorHandler: { warning: () => {}, error: message => { throw new Error(message); }, fatalError: message => { throw new Error(message); } } });
    for (const entry of entries) {
      const theme = artworkCatalog.widgetArtworkTheme(entry.route);
      const xml = artworkCatalog.desktopCatalogArtworkXml(entry.route);
      expect(theme.reviewed, entry.route).toBe(true);
      const document = parser.parseFromString(xml, 'image/svg+xml');
      expect(document.documentElement.tagName, entry.route).toBe('svg');
      expect(document.documentElement.getAttribute('width')).toBe('2048');
      expect(document.documentElement.getAttribute('height')).toBe('2048');
      for (const name of ['script', 'image', 'foreignObject', 'text']) expect(document.getElementsByTagName(name)).toHaveLength(0);
      expect(xml).not.toMatch(/undefined|NaN/);
      expect(drawings.get(xml) ?? theme.identity).toBe(theme.identity);
      drawings.set(xml, theme.identity);
      const motif = `${theme.primary}:${theme.secondary}`;
      expect(motifs.get(motif) ?? theme.identity, entry.route).toBe(theme.identity);
      motifs.set(motif, theme.identity);
      identities.add(theme.identity);
    }
    expect(identities.size).toBeGreaterThan(120);
    expect(drawings.size).toBe(identities.size);
  });

  it('separates the previously repeated documentation and communication motifs', () => {
    const routes = [
      '/office/notizen', '/office/dokumentation', '/business/office/documents',
      '/business/office/documents/signatures', '/assist/nachweise',
      '/business/office/document-catalog', '/office/catalogs',
      '/business/templates/documents-hub', '/business/messages',
      '/office/messages?audience=clients', '/office/messages?audience=employees',
      '/office/messages?audience=employees&view=chats&chatAge=new',
      '/office/messages?audience=employees&view=broadcasts',
    ];
    expect(new Set(routes.map(route => artworkCatalog.desktopCatalogArtworkXml(route))).size).toBe(routes.length);
    const borrowed = artworkCatalog.WIDGETS.find(widget => widget.route === '/assist/nachweise')!.images;
    expect(artworkCatalog.desktopCatalogArtwork('/office/notizen', borrowed))
      .toBe(artworkCatalog.desktopCatalogArtwork('/office/notizen'));
  });

  it('keeps catalogue controls unique while retaining stored widget IDs after an ID collision', () => {
    const apps = artworkCatalog.buildDesktopApps(artworkCatalog.WIDGETS, 'business_admin');
    expect(new Set(apps.map(app => app.id)).size).toBe(apps.length);
    const risks = apps.find(app => app.route === '/pflege/risiken')!;
    const reports = apps.find(app => app.route === '/pflege/reports')!;
    expect(risks.id).not.toBe(reports.id);
    expect(reports.desktopWidgetId).toBe('area-app:pflege-quality');
  });

  it('keeps related operational screens separate when their actual routes serve different functions', () => {
    for (const routes of [
      ['/business/office/time-tracking', '/business/office/time-tracking/live'],
      ['/pflege/planung', '/pflege/massnahmen', '/pflege/plans'],
      ['/assist/touren', '/assist/tourenplanung'],
    ]) {
      expect(new Set(routes.map(artworkCatalog.desktopCatalogArtworkName)).size).toBe(routes.length);
      expect(new Set(routes.map(route => artworkCatalog.desktopCatalogArtworkXml(route))).size).toBe(routes.length);
    }
  });

  it('keeps true aliases and irrelevant queries stable while separating real service and action targets', () => {
    for (const routes of [
      ['/office/clients', '/business/office/clients?source=desktop#details'],
      ['/assist/kalender', '/assist/calendar'],
      ['/business/qm', '/office/qm'],
      ['/akademie/courses', '/akademie/kurse'],
      ['/?area=decisions', '/Desktop?area=decisions'],
      ['/office/messages?view=broadcasts&audience=employees&source=desktop', '/business/messages?audience=employees&view=broadcasts'],
    ]) {
      expect(new Set(routes.map(artworkCatalog.desktopCatalogArtworkName)).size).toBe(1);
      expect(new Set(routes.map(route => artworkCatalog.desktopCatalogArtworkXml(route))).size).toBe(1);
    }
    const services = ['gmail', 'calendar', 'meet', 'drive', 'docs', 'sheets', 'slides', 'tasks', 'contacts', 'chat', 'activity'];
    expect(new Set(services.map(service => artworkCatalog.desktopCatalogArtworkXml(`/business/connect/google-workspace?service=${service}`))).size).toBe(services.length);
    expect(artworkCatalog.desktopCatalogArtworkXml('/assist/calendar')).not.toBe(artworkCatalog.desktopCatalogArtworkXml('/business/connect/google-workspace?service=calendar'));
    expect(artworkCatalog.desktopCatalogArtworkXml('/business/office/clients/new')).not.toBe(artworkCatalog.desktopCatalogArtworkXml('/business/office/clients'));
  });

  it('designs new function artwork immediately without a borrowed image, network request or unsafe label interpolation', () => {
    const first = '/pflege/neue-wundkontrolle';
    const second = '/pflege/weitere-wundkontrolle';
    const xml = artworkCatalog.desktopCatalogArtworkXml(first, '</svg><script>test</script>');
    expect(artworkCatalog.widgetArtworkTheme(first).primary).toBe('bandage');
    expect(xml).not.toMatch(/<script|href=|<text/);
    expect(xml).not.toBe(artworkCatalog.desktopCatalogArtworkXml(second));
    expect(xml).not.toBe(artworkCatalog.desktopCatalogArtworkXml('/pflege/wunddokumentation'));
    const image = artworkCatalog.desktopCatalogArtwork(first);
    expect(image.large.uri).toMatch(/^data:image\/svg\+xml/);
    expect(image.small).toBe(image.large);
    expect(image.medium).toBe(image.large);
  });
});
