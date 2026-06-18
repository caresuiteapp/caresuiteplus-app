/**
 * One-off: convert baked black background to true alpha on CareSuite mascot PNGs.
 * Flood-fills from image corners through near-black pixels only.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const TARGETS = [
  'assets/images/caresuite-mascot.png',
  'assets/images/caresuite-icon.png',
  'assets/icon.png',
  'assets/favicon.png',
  'assets/splash-icon.png',
  'assets/notification-icon.png',
  'assets/android-icon-foreground.png',
  'assets/android-icon-monochrome.png',
];

const BLACK_THRESHOLD = 28;

function isNearBlack(r, g, b) {
  return r <= BLACK_THRESHOLD && g <= BLACK_THRESHOLD && b <= BLACK_THRESHOLD;
}

function floodFillTransparent(data, width, height) {
  const total = width * height;
  const visited = new Uint8Array(total);
  const queue = [];

  const pushIfBlack = (x, y) => {
    const idx = y * width + x;
    if (visited[idx]) return;
    const o = idx * 4;
    if (!isNearBlack(data[o], data[o + 1], data[o + 2])) return;
    visited[idx] = 1;
    queue.push(idx);
  };

  for (let x = 0; x < width; x++) {
    pushIfBlack(x, 0);
    pushIfBlack(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    pushIfBlack(0, y);
    pushIfBlack(width - 1, y);
  }

  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++];
    const x = idx % width;
    const y = (idx - x) / width;
    if (x > 0) pushIfBlack(x - 1, y);
    if (x < width - 1) pushIfBlack(x + 1, y);
    if (y > 0) pushIfBlack(x, y - 1);
    if (y < height - 1) pushIfBlack(x, y + 1);
  }

  let madeTransparent = 0;
  for (let idx = 0; idx < total; idx++) {
    if (!visited[idx]) continue;
    const o = idx * 4;
    data[o + 3] = 0;
    madeTransparent++;
  }
  return madeTransparent;
}

async function processFile(relPath) {
  const abs = path.join(ROOT, relPath);
  if (!fs.existsSync(abs)) {
    console.log('SKIP missing', relPath);
    return;
  }

  const { data, info } = await sharp(abs).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const buf = Buffer.from(data);
  const madeTransparent = floodFillTransparent(buf, info.width, info.height);

  await sharp(buf, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(abs + '.tmp');

  fs.renameSync(abs + '.tmp', abs);
  console.log(`${relPath}: ${madeTransparent} pixels -> transparent`);
}

for (const target of TARGETS) {
  await processFile(target);
}
