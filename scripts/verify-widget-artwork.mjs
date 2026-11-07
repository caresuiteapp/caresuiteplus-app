import { buildSync } from 'esbuild';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rasterManifest = JSON.parse(readFileSync(resolve(root, 'src/liquid-command/components/widgetRasterArtworkManifest.shared.json'), 'utf8'));
const rasterRegistry = readFileSync(resolve(root, 'src/liquid-command/components/widgetRasterArtworkAssets.ts'), 'utf8');
const identities = new Set();
const sourceHashes = new Set();
for (const artwork of rasterManifest.artworks) {
  if (identities.has(artwork.identity) || sourceHashes.has(artwork.sourceSha256)) throw new Error(`Reused 3D original: ${artwork.identity}`);
  identities.add(artwork.identity);
  sourceHashes.add(artwork.sourceSha256);
  for (const [size, expectedWidth] of [['small', 192], ['medium', 512], ['large', 1254]]) {
    const variant = artwork.variants[size];
    if (variant.width !== expectedWidth) throw new Error(`Incorrect variant resolution: ${artwork.identity}/${size}`);
    if (!variant.path.startsWith(`/widget-artwork/${rasterManifest.version}/${artwork.id}/`) || variant.path.includes('..')) throw new Error(`Invalid 3D path: ${artwork.identity}`);
    const bytes = readFileSync(resolve(root, `public${variant.path}`));
    const hash = createHash('sha256').update(bytes).digest('hex');
    if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || bytes.readUInt32BE(16) !== expectedWidth || bytes.readUInt32BE(20) !== expectedWidth || bytes[25] !== 6) throw new Error(`Invalid RGBA original/derivative: ${variant.path}`);
    if (hash !== variant.sha256 || (size === 'large' && hash !== artwork.sourceSha256)) throw new Error(`Original bytes changed: ${artwork.identity}`);
    if (!rasterRegistry.includes(`require('../../../public${variant.path}')`)) throw new Error(`Native original missing: ${variant.path}`);
  }
}
const code = buildSync({ stdin: { contents: `
  export { WIDGETS, WORKFLOWS } from './src/liquid-command/screens/administrationDesktopCatalog';
  export { buildDesktopApps } from './src/liquid-command/navigation/desktopAppCatalogModel';
  export { widgetArtworkTheme, WIDGET_ARTWORK_PATHS } from './src/liquid-command/components/widgetArtworkTheme.shared';
  export { desktopCatalogArtworkXml } from './src/liquid-command/components/desktopCatalogArtworkModel.shared';
  export { widgetRasterArtwork } from './src/liquid-command/components/widgetRasterArtwork.shared';
  export { stationaerNav } from './src/lib/navigation/moduleNav/stationaerNav';
  export { beratungNav } from './src/lib/navigation/moduleNav/beratungNav';
  export { employeePortalArtwork } from './src/components/portal/employee/employeePortalDesign';
  export { employeePortalNavigation } from './src/lib/portal/employee/employeePortalNavigation';
  export { employeePortalWorkspaces } from './src/lib/portal/employee/employeePortalWorkspaces';
`, resolveDir: root, loader: 'ts' }, bundle: true, write: false, platform: 'node', format: 'cjs',
  external: ['react-native'], loader: { '.png': 'empty', '.jpg': 'empty' },
}).outputFiles[0].text;
const functions = new Map();
const consultationFlag = process.env.EXPO_PUBLIC_CONSULTATION_WORKSPACE_ENABLED;
for (const consultationEnabled of ['false', 'true']) for (const platform of ['web', 'android', 'ios']) {
  process.env.EXPO_PUBLIC_CONSULTATION_WORKSPACE_ENABLED = consultationEnabled;
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', code)(id => {
    if (id === 'react-native') return { Platform: { OS: platform } };
    throw new Error(`Unexpected artwork dependency: ${id}`);
  }, loaded, loaded.exports);
  const catalog = loaded.exports;
  for (const artwork of rasterManifest.artworks) {
    const selected = catalog.widgetRasterArtwork(artwork.identity);
    if (selected?.sourceSha256 !== artwork.sourceSha256) throw new Error(`Original identity mismatch: ${platform}/${artwork.identity}`);
  }
  const portalArtwork = new Map();
  for (const workspace of [null, ...catalog.employeePortalWorkspaces]) {
    for (const item of catalog.employeePortalNavigation(workspace)) {
      const original = catalog.widgetRasterArtwork(catalog.employeePortalArtwork[item.id] ?? '');
      if (!original) throw new Error(`Missing employee portal original: ${item.id} (${platform}/${workspace})`);
      const prior = portalArtwork.get(original.id);
      if (prior && prior !== item.id) throw new Error(`Repeated portal original: ${prior} / ${item.id}`);
      portalArtwork.set(original.id, item.id);
    }
  }
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
    // A development vector is no release-ready 3D original. Inspect both
    // consultation configurations so the published workspace cannot be missed.
    if (!catalog.widgetRasterArtwork(entry.route)) throw new Error(`Missing 3D original: ${entry.route} (${platform}, consultation=${consultationEnabled}). Add its own original before release.`);
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
if (consultationFlag === undefined) delete process.env.EXPO_PUBLIC_CONSULTATION_WORKSPACE_ENABLED;
else process.env.EXPO_PUBLIC_CONSULTATION_WORKSPACE_ENABLED = consultationFlag;
console.log(`[widget-artwork] ${functions.size} functions: unique subjects/compositions, 2048 px vector masters, Web/Android/iOS parity. No shared stock fallback.`);
console.log(`[widget-artwork] ${rasterManifest.artworks.length} unique 3D originals: unchanged high-resolution RGBA masters, 192/512 px derivatives, matching native bundles and versioned Web paths. Every catalogue entry is covered with consultation enabled and disabled.`);
