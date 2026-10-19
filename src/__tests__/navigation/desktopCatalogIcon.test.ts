import { describe, expect, it } from 'vitest';
import { buildSync } from 'esbuild';
import { closeSync, openSync, readSync } from 'node:fs';
import { resolve } from 'node:path';
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
type CatalogEntry = { route: string; images?: RasterImages };
type ArtworkCatalog = {
  desktopCatalogArtwork: (route: string, preferred?: RasterImages) => RasterImages;
  desktopCatalogArtworkName: (route: string) => string;
  buildDesktopApps: (widgets: readonly CatalogEntry[], role?: string) => CatalogEntry[];
  WIDGETS: readonly CatalogEntry[];
  WORKFLOWS: readonly CatalogEntry[];
};

// Keep static image requires in the real catalogue, but resolve them to local
// paths instead of embedding every full-size background into this test bundle.
const artworkBundle = buildSync({
  stdin: {
    contents: `
      export { desktopCatalogArtwork, desktopCatalogArtworkName } from './src/liquid-command/components/desktopCatalogArtwork.web';
      export { buildDesktopApps } from './src/liquid-command/navigation/desktopAppCatalogModel';
      export { WIDGETS, WORKFLOWS } from './src/liquid-command/screens/administrationDesktopCatalog';
    `,
    resolveDir: process.cwd(), loader: 'ts',
  },
  bundle: true, write: false, platform: 'node', format: 'cjs',
  external: ['react-native', '*.png', '*.jpg'],
}).outputFiles[0].text;
const artworkModule = { exports: {} as ArtworkCatalog };
new Function('require', 'module', 'exports', artworkBundle)((id: string) => {
  if (id === 'react-native') return { Platform: { OS: 'web' } };
  const assetsIndex = id.indexOf('assets/');
  if (assetsIndex >= 0 && /\.(png|jpg)$/.test(id)) return { uri: resolve(id.slice(assetsIndex)) };
  throw new Error(`Unexpected artwork dependency: ${id}`);
}, artworkModule, artworkModule.exports);
const artworkCatalog = artworkModule.exports;

describe('desktop catalogue picture artwork', () => {
  it('resolves every catalogue page, widget and workflow to existing raster artwork in all three sizes', () => {
    const routes = new Set([
      ...artworkCatalog.buildDesktopApps(artworkCatalog.WIDGETS, 'business_admin'),
      ...artworkCatalog.buildDesktopApps(artworkCatalog.WIDGETS, 'platform_admin'),
      ...artworkCatalog.WIDGETS, ...artworkCatalog.WORKFLOWS,
      { route: '/business/subscription' },
    ].map(entry => entry.route));
    expect(routes.size).toBeGreaterThan(70);
    const paths = new Set<string>();
    for (const route of routes) {
      for (const source of Object.values(artworkCatalog.desktopCatalogArtwork(route))) {
        expect(source.uri, route).toContain('/assets/healthos/widgets-premium/');
        expect(source.uri, route).toMatch(/\.png$/);
        paths.add(source.uri);
      }
    }
    // Reading the PNG signature and dimensions catches missing, empty and
    // non-image files, while the DOM test checks their actual use in cards.
    for (const path of paths) {
      const file = openSync(path, 'r');
      try {
        const header = Buffer.alloc(24);
        expect(readSync(file, header, 0, header.length, 0), path).toBe(24);
        expect(header.subarray(0, 8).toString('hex'), path).toBe('89504e470d0a1a0a');
        expect(header.readUInt32BE(16), path).toBeGreaterThan(0);
        expect(header.readUInt32BE(20), path).toBeGreaterThan(0);
      } finally { closeSync(file); }
    }
  });

  it('keeps existing premium pictures and uses the same motif for aliases and workflow destinations', () => {
    for (const widget of artworkCatalog.WIDGETS) {
      if (!widget.images || widget.route === '/office/notizen') continue;
      expect(artworkCatalog.desktopCatalogArtwork(widget.route, widget.images)).toBe(widget.images);
    }
    for (const routes of [
      ['/office/clients', '/business/office/clients', '/business/office/clients/new'],
      ['/assist/kalender', '/assist/calendar'],
      ['/assist/assignments', '/assist/einsaetze', '/assist/einsaetze/new'],
      ['/office/invoices', '/business/office/invoices/new'],
    ]) {
      expect(new Set(routes.map(artworkCatalog.desktopCatalogArtworkName)).size).toBe(1);
    }
  });

  it('replaces the previous flat Notes illustration and gives new pages a raster fallback', () => {
    const notes = artworkCatalog.WIDGETS.find(widget => widget.route === '/office/notizen')!;
    expect(notes).toBeTruthy();
    for (const source of Object.values(artworkCatalog.desktopCatalogArtwork(notes.route, notes.images))) {
      expect(source.uri).toMatch(/\.png$/);
      expect(source.uri).not.toMatch(/^data:/);
    }
    expect(artworkCatalog.desktopCatalogArtwork('/future-feature').medium.uri).toMatch(/18-command-center\.png$/);
  });

  it('chooses Workspace pictures from the requested service and ignores incidental query parameters', () => {
    const name = artworkCatalog.desktopCatalogArtworkName;
    expect(name('/business/connect/google-workspace?service=gmail')).not.toBe(name('/business/connect/google-workspace?service=calendar'));
    expect(name('/business/connect/google-workspace?source=desktop&service=calendar#panel')).toBe(name('/assist/calendar'));
    expect(name('/business/office/clients/new?returnTo=/calendar')).toBe(name('/business/office/clients'));
  });
});
