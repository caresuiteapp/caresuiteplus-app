#!/usr/bin/env node
/** Verify approved source artwork AND the bitmaps actually shipped in the AAB.
 * pngjs is already locked through Expo. Expo writes PNG bytes in .webp files.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const { PNG } = createRequire(import.meta.url)('pngjs');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(join(root, path));
const hash = data => createHash('sha256').update(data).digest('hex');
const artwork = JSON.parse(read('assets/brand/app-icon-source.json'));
for (const [path, digest] of [[artwork.source, artwork.sourceSha256], [artwork.png, artwork.pngSha256]]) {
  if (hash(read(path)) !== digest) throw new Error(`Approved artwork changed: ${path}`);
}
const decode = data => PNG.sync.read(data, { checkCRC: true });
const source = decode(read(artwork.png));
if (source.width !== source.height || source.width < 256) throw new Error('Invalid approved artwork dimensions.');
const background = [248, 250, 252, 255];

// Coarse area averages tolerate different Expo/Pillow resamplers, but detect
// another logo, the old black matte, wrong scale, missing alpha and clipping.
function features(image, { circle = false, alphaOnly = false } = {}) {
  const cells = Array.from({ length: 64 }, () => ({ sum: [0, 0, 0, 0], count: 0 }));
  for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
    const nx = (x + 0.5) / image.width, ny = (y + 0.5) / image.height;
    if (circle && (nx - 0.5) ** 2 + (ny - 0.5) ** 2 > 0.43 ** 2) continue;
    const cell = cells[Math.min(7, Math.floor(ny * 8)) * 8 + Math.min(7, Math.floor(nx * 8))];
    const i = (y * image.width + x) * 4, alpha = image.data[i + 3] / 255;
    for (let c = 0; c < 3; c++) cell.sum[c] += image.data[i + c] * alpha + 255 * (1 - alpha);
    cell.sum[3] += image.data[i + 3]; cell.count++;
  }
  return cells.flatMap(cell => cell.count ? (alphaOnly ? [cell.sum[3] / cell.count] : cell.sum.map(v => v / cell.count)) : []);
}

function compare(actual, expected, label, options = {}, limit = 8) {
  const a = features(actual, options), b = features(expected, options);
  if (a.length !== b.length || !a.length) throw new Error(`Invalid image comparison: ${label}`);
  const error = a.reduce((sum, value, i) => sum + Math.abs(value - b[i]), 0) / a.length;
  if (error > limit) throw new Error(`Wrong packaged app artwork: ${label} (pixel error ${error.toFixed(2)}, maximum ${limit}).`);
  return Number(error.toFixed(3));
}

function frame(image, ratio, { ink = false, opaque = false, size = 1024 } = {}) {
  const output = new PNG({ width: size, height: size });
  const inner = Math.round(size * ratio), offset = Math.floor((size - inner) / 2);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    if (opaque) output.data.set(background, i);
    if (x < offset || y < offset || x >= offset + inner || y >= offset + inner) continue;
    const sx = Math.min(image.width - 1, Math.floor((x - offset + 0.5) * image.width / inner));
    const sy = Math.min(image.height - 1, Math.floor((y - offset + 0.5) * image.height / inner));
    const j = (sy * image.width + sx) * 4;
    if (ink) {
      const dark = image.data[j] * 0.299 + image.data[j + 1] * 0.587 + image.data[j + 2] * 0.114 < 170;
      output.data.set([255, 255, 255, dark ? image.data[j + 3] : 0], i);
    } else output.data.set(image.data.subarray(j, j + 4), i);
  }
  return output;
}

const assets = {};
for (const [name, expected, options] of [
  ['icon.png', frame(source, 1, { opaque: true }), {}],
  ['splash-icon.png', frame(source, 1, { opaque: true }), {}],
  ['android-icon-foreground.png', frame(source, artwork.adaptiveScale), {}],
  ['android-icon-monochrome.png', frame(source, artwork.adaptiveScale, { ink: true }), { alphaOnly: true }],
  ['notification-icon.png', frame(source, artwork.adaptiveScale, { ink: true }), { alphaOnly: true }],
]) {
  assets[name] = decode(read(`assets/${name}`));
  compare(assets[name], expected, `assets/${name}`, options, 6);
}
assets['android-icon-background.png'] = decode(read('assets/android-icon-background.png'));
for (let i = 0; i < assets['android-icon-background.png'].data.length; i++) {
  if (assets['android-icon-background.png'].data[i] !== background[i % 4]) throw new Error('Adaptive background must be the approved light matte.');
}
const config = JSON.parse(read('app.json')).expo;
const splash = config.plugins.find(plugin => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen')?.[1];
if (splash?.imageWidth !== artwork.splashImageWidth || splash?.backgroundColor !== artwork.backgroundColor) throw new Error('Splash artwork configuration differs from the approved source.');

const report = { source: artwork.source, sourceSha256: artwork.sourceSha256, pngSha256: artwork.pngSha256, verifiedSourceImages: 6, resources: [] };
const [mode, resourcesDirectory, outputDirectory] = process.argv.slice(2);
if (mode && (mode !== '--resources' || !resourcesDirectory || !outputDirectory)) throw new Error('Usage: verify-android-app-icons.mjs [--resources extracted-resources report-directory]');
if (mode) {
  const paths = readdirSync(resourcesDirectory, { recursive: true }).map(path => String(path));
  const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  const compiled = {};
  for (const [dpi, scale] of Object.entries(densities)) {
    for (const [name, asset, adaptive, options] of [
      ['ic_launcher', 'icon.png', false, {}],
      ['ic_launcher_round', 'icon.png', false, { circle: true }],
      ['ic_launcher_foreground', 'android-icon-foreground.png', true, {}],
      ['ic_launcher_background', 'android-icon-background.png', true, {}],
      ['ic_launcher_monochrome', 'android-icon-monochrome.png', true, { alphaOnly: true }],
      ['notification_icon', 'android-icon-monochrome.png', null, { alphaOnly: true }],
      ['splashscreen_logo', 'splash-icon.png', null, {}],
    ]) {
      const folder = adaptive === null ? 'drawable' : 'mipmap';
      const pattern = new RegExp(`(?:^|/)${folder}-${dpi}(?:-v4)?/${name}\\.(?:png|webp)$`);
      const matches = paths.filter(path => pattern.test(path));
      if (matches.length !== 1) throw new Error(`Expected one compiled ${dpi}/${name}, found ${matches.length}.`);
      const data = readFileSync(join(resourcesDirectory, matches[0]));
      const image = decode(data);
      const expectedSize = (name === 'splashscreen_logo' ? 288 : name === 'notification_icon' ? 24 : adaptive ? 108 : 48) * scale;
      if (image.width !== expectedSize || image.height !== expectedSize) throw new Error(`Incorrect compiled icon dimensions: ${matches[0]}`);
      const expected = name === 'splashscreen_logo' ? frame(assets[asset], artwork.splashImageWidth / 288) : assets[asset];
      const error = compare(image, expected, matches[0], options);
      report.resources.push({ path: matches[0], width: image.width, sha256: hash(data), pixelError: error });
      if (dpi === 'xxxhdpi') compiled[name] = image;
    }
  }
  mkdirSync(outputDirectory, { recursive: true });
  // Preview the actual packaged square, round, adaptive and themed variants.
  const preview = new PNG({ width: 896, height: 224 });
  preview.data.fill(255);
  for (const [column, name] of ['ic_launcher', 'ic_launcher_round', 'ic_launcher_foreground', 'ic_launcher_monochrome'].entries()) {
    const image = compiled[name];
    for (let y = 0; y < 192; y++) for (let x = 0; x < 192; x++) {
      const nx = (x + 0.5) / 192, ny = (y + 0.5) / 192;
      if (column >= 2 && (nx - 0.5) ** 2 + (ny - 0.5) ** 2 > 0.25) continue;
      const u = column >= 2 ? (nx - 0.5) * 2 / 3 + 0.5 : nx;
      const v = column >= 2 ? (ny - 0.5) * 2 / 3 + 0.5 : ny;
      const j = (Math.min(image.height - 1, Math.floor(v * image.height)) * image.width + Math.min(image.width - 1, Math.floor(u * image.width))) * 4;
      const i = ((y + 16) * preview.width + column * 224 + x + 16) * 4;
      const alpha = image.data[j + 3] / 255;
      for (let c = 0; c < 3; c++) preview.data[i + c] = column === 3 ? [35, 80, 155][c] * alpha + [220, 233, 255][c] * (1 - alpha) : image.data[j + c] * alpha + background[c] * (1 - alpha);
    }
  }
  writeFileSync(join(outputDirectory, 'APP-ICON-PREVIEW.png'), PNG.sync.write(preview));
  writeFileSync(join(outputDirectory, 'APP-ICON-VERIFICATION.json'), JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify(report));
