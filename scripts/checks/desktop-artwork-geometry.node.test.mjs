import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DESKTOP_ARTWORK_FILL, desktopArtworkFrame, desktopArtworkResolution,
} from '../../src/liquid-command/components/desktopArtworkGeometry.web.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const sourceDirectory = resolve(root, 'src/liquid-command/components');
const assetSources = new Map();
const metadataSource = readFileSync(resolve(sourceDirectory, 'desktopArtworkAssets.web.ts'), 'utf8');
const metadataCode = stripTypeScriptTypes(metadataSource).replace(/\bexport /g, '');
const assets = new Function('require', `${metadataCode}; return DESKTOP_ARTWORK_ASSETS;`)(path => {
  const uri = resolve(sourceDirectory, path);
  if (!assetSources.has(uri)) assetSources.set(uri, { uri });
  return assetSources.get(uri);
});
const selectorSource = readFileSync(resolve(sourceDirectory, 'desktopArtworkSource.web.ts'), 'utf8');
const selectorCode = stripTypeScriptTypes(selectorSource)
  .replace(/^import .*?;\n/gm, '').replace(/\bexport /g, '');
const selector = new Function('DESKTOP_ARTWORK_ASSETS', 'DESKTOP_ARTWORK_FILL', 'desktopArtworkResolution',
  `${selectorCode}; return { desktopArtworkUri, desktopArtworkAsset, selectDesktopArtworkAsset };`)(
  assets, DESKTOP_ARTWORK_FILL, desktopArtworkResolution);
const asset = suffix => {
  const match = assets.find(entry => entry.path.endsWith(suffix));
  assert.ok(match, suffix);
  return match;
};
const family = file => Object.fromEntries([
  ['small', `compact/${file}`], ['medium', `medium/${file}`], ['large', `large/${file}`],
].map(([variant, suffix]) => [variant, asset(suffix).source]));
const academyFamily = name => Object.fromEntries([
  ['small', `academy/${name}-compact.png`], ['medium', `academy/${name}-medium.png`], ['large', `academy/${name}-large.png`],
].map(([variant, suffix]) => [variant, asset(suffix).source]));
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-7, `${message}: ${actual} !== ${expected}`);

test('Every measured asset exists with matching PNG dimensions and byte count', () => {
  assert.equal(assets.length, 98);
  assert.equal(new Set(assets.map(item => item.path)).size, assets.length);
  for (const entry of assets) {
    const path = resolve(root, entry.path);
    const png = readFileSync(path);
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', entry.path);
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], entry.pixelSize, entry.path);
    assert.equal(statSync(path).size, entry.bytes, entry.path);
    assert.equal(entry.source.uri, path);
  }
});

test('All original motifs and the new catalogue share one visible size and center', () => {
  for (const entry of assets) {
    const frame = desktopArtworkFrame(entry);
    assert.ok(frame, entry.path);
    const [x, y, width, height] = entry.contentBounds;
    close(desktopArtworkResolution(entry) / frame.side, 0.88, entry.path);
    close((x + width / 2 - frame.x) / frame.side, 0.5, `${entry.path} center x`);
    close((y + height / 2 - frame.y) / frame.side, 0.5, `${entry.path} center y`);
  }
});

test('Every visible shadow fits inside the normalized frame', () => {
  for (const entry of assets) {
    const frame = desktopArtworkFrame(entry);
    const [x, y, width, height] = entry.paintBounds;
    assert.ok(x >= frame.x && y >= frame.y && x + width <= frame.x + frame.side &&
      y + height <= frame.y + frame.side, entry.path);
  }
});

test('QM documents, handbook, catalogue and hero no longer shrink because of canvas padding', () => {
  const groups = [family('07-dokumente.png'), academyFamily('library'), {
    small: asset('web/document-catalog-3d.png').source,
    medium: asset('web/document-catalog-3d.png').source,
    large: asset('web/document-catalog-3d.png').source,
  }, family('11-audit.png')];
  for (const size of [24, 48, 49, 64, 86, 112, 160]) {
    for (const group of groups) {
      const selected = selector.selectDesktopArtworkAsset(group, size);
      const frame = desktopArtworkFrame(selected);
      close(desktopArtworkResolution(selected) / frame.side * size, size * 0.88, `${size}px motif`);
    }
  }
});

test('Fixed-size artwork receives enough real motif pixels for a sharp 2x image', () => {
  for (const group of [family('07-dokumente.png'), family('11-audit.png'), academyFamily('library')]) {
    for (const size of [24, 48, 64, 86, 112]) {
      const selected = selector.selectDesktopArtworkAsset(group, size);
      assert.ok(desktopArtworkResolution(selected) >= size * 0.88 * 2);
    }
  }
});

test('Responsive stages use best motif resolution without rewarding transparent large canvases', () => {
  const audit = selector.selectDesktopArtworkAsset(family('11-audit.png'), '100%');
  assert.ok(audit.path.endsWith('medium/11-audit.png'));
  const academy = selector.selectDesktopArtworkAsset(academyFamily('library'), '100%');
  assert.ok(academy.path.endsWith('academy/library-large.png'));
  const original = asset('medium/07-dokumente.png');
  const frame = desktopArtworkFrame(original);
  for (const [stageWidth, stageHeight] of [[400, 178], [88, 156], [64, 64]]) {
    // SVG preserveAspectRatio="xMidYMid meet" uses one common scale in both axes.
    const scale = Math.min(stageWidth, stageHeight) / frame.side;
    close(desktopArtworkResolution(original) * scale, Math.min(stageWidth, stageHeight) * 0.88, 'responsive size');
  }
});

test('Unknown custom images are preserved and never identified by a matching filename', () => {
  const fake = { uri: 'https://example.test/medium/07-dokumente.png' };
  assert.equal(selector.desktopArtworkAsset(fake), undefined);
  assert.equal(selector.selectDesktopArtworkAsset({ ...family('07-dokumente.png'), medium: fake }, 64), undefined);
  assert.equal(selector.desktopArtworkAsset({ uri: asset('medium/07-dokumente.png').source.uri }), asset('medium/07-dokumente.png'));
});

test('URI resolution supports bundled Web objects and numeric registered assets safely', () => {
  assert.equal(selector.desktopArtworkUri({ uri: '/known.png' }), '/known.png');
  assert.equal(selector.desktopArtworkUri(23, id => ({ uri: `/asset-${id}.png` })), '/asset-23.png');
  assert.equal(selector.desktopArtworkUri(23), undefined);
  assert.equal(selector.desktopArtworkUri({ uri: '' }), undefined);
  assert.equal(selector.desktopArtworkUri([{ uri: '/custom-1x.png' }]), undefined);
});

test('Malformed measurements are rejected and future wide shadows receive sufficient room', () => {
  const valid = { pixelSize: [100, 100], contentBounds: [30, 30, 40, 40], paintBounds: [10, 10, 80, 80] };
  const frame = desktopArtworkFrame(valid);
  assert.deepEqual(frame, { x: 10, y: 10, side: 80 });
  for (const bad of [
    { ...valid, pixelSize: [0, 100] }, { ...valid, contentBounds: [0, 0, 101, 10] },
    { ...valid, contentBounds: [NaN, 0, 10, 10] }, { ...valid, paintBounds: [-1, 0, 80, 80] },
  ]) assert.equal(desktopArtworkFrame(bad), null);
});
