import { buildSync } from 'esbuild';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const code = buildSync({ stdin: { contents: `
  export { WIDGETS, WORKFLOWS } from './src/liquid-command/screens/administrationDesktopCatalog';
  export { buildDesktopApps } from './src/liquid-command/navigation/desktopAppCatalogModel';
  export { widgetArtworkTheme, WIDGET_ARTWORK_PATHS } from './src/liquid-command/components/widgetArtworkTheme.shared';
  export { desktopCatalogArtworkXml } from './src/liquid-command/components/desktopCatalogArtworkModel.shared';
  export { stationaerNav } from './src/lib/navigation/moduleNav/stationaerNav';
  export { beratungNav } from './src/lib/navigation/moduleNav/beratungNav';
`, resolveDir: root, loader: 'ts' }, bundle: true, write: false, platform: 'node', format: 'cjs',
  external: ['react-native'], loader: { '.png': 'empty', '.jpg': 'empty' },
}).outputFiles[0].text;
const functions = new Map();
for (const platform of ['web', 'android', 'ios']) {
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', code)(id => {
    if (id === 'react-native') return { Platform: { OS: platform } };
    throw new Error(`Unexpected artwork dependency: ${id}`);
  }, loaded, loaded.exports);
  const catalog = loaded.exports;
  const apps = ['business_admin', 'business_manager', 'dispatch', 'platform_admin'].flatMap(role => {
    const pages = catalog.buildDesktopApps(catalog.WIDGETS, role);
    if (new Set(pages.map(page => page.id)).size !== pages.length) throw new Error(`Duplicate catalogue IDs: ${platform}/${role}`);
    return pages;
  });
  const entries = [
    ...apps,
    ...catalog.WIDGETS, ...catalog.WORKFLOWS,
    ...[catalog.stationaerNav, catalog.beratungNav].flatMap(nav => nav.groups.flatMap(group => group.items.map(item => ({ route: item.href, label: item.label })))),
  ];
  const drawings = new Map();
  const motifs = new Map();
  for (const entry of entries) {
    const theme = catalog.widgetArtworkTheme(entry.route, entry.label);
    const xml = catalog.desktopCatalogArtworkXml(entry.route, entry.label);
    if (!catalog.WIDGET_ARTWORK_PATHS[theme.primary] || !catalog.WIDGET_ARTWORK_PATHS[theme.secondary]) throw new Error(`Missing subject: ${entry.route}`);
    if (theme.primary === 'puzzle' && theme.secondary === 'sparkles') throw new Error(`Missing function theme: ${entry.route}. Add a matching semantic motif.`);
    if (!xml.includes('width="2048" height="2048"') || /undefined|NaN|<script|<image|<foreignObject|<text|\shref=/.test(xml)) throw new Error(`Invalid vector: ${entry.route}`);
    const hash = createHash('sha256').update(xml).digest('hex');
    const prior = drawings.get(hash);
    if (prior && prior !== theme.identity) throw new Error(`Reused artwork: ${prior} / ${theme.identity}`);
    drawings.set(hash, theme.identity);
    const motif = `${theme.primary}:${theme.secondary}`;
    const priorMotif = motifs.get(motif);
    // A new destination may be generated immediately, but must receive its own
    // meaningful subject/context pair before a release can reuse another pair.
    if (priorMotif && priorMotif !== theme.identity) throw new Error(`Repeated motif: ${priorMotif} / ${theme.identity}. Assign a distinct subject and context in widgetArtworkTheme.shared.ts.`);
    motifs.set(motif, theme.identity);
    const existing = functions.get(theme.identity);
    if (existing && existing !== hash) throw new Error(`Web/native artwork differs: ${theme.identity}`);
    functions.set(theme.identity, hash);
  }
}
console.log(`[widget-artwork] ${functions.size} functions: unique subjects/compositions, 2048 px vector masters, Web/Android/iOS parity. No shared stock fallback.`);
